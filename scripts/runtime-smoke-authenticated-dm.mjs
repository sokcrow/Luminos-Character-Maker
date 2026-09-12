import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

const firebaseMock = `(() => {
  const DM_UID = ${JSON.stringify('e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1')};
  const state = new Map();
  const listeners = new Map();
  let pushCounter = 0;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('luminous-smoke-firebase') : null;

  function keyOf(path) {
    const parts = String(path || '').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }

  function snapshot(path, value) {
    return {
      key: keyOf(path),
      val: () => value,
      exists: () => value !== null && value !== undefined,
      child: (name) => snapshot(path + '/' + name, value && typeof value === 'object' ? value[name] : null),
      forEach: (callback) => {
        if (!value || typeof value !== 'object') return false;
        for (const [key, childValue] of Object.entries(value)) {
          if (callback(snapshot(path + '/' + key, childValue)) === true) return true;
        }
        return false;
      }
    };
  }

  function notify(path, value, broadcast = true) {
    state.set(path, value);
    const callbacks = listeners.get(path);
    if (callbacks) {
      for (const callback of [...callbacks]) queueMicrotask(() => callback(snapshot(path, value)));
    }
    if (broadcast && channel) channel.postMessage({ path, value });
  }

  channel && (channel.onmessage = (event) => {
    if (!event?.data?.path) return;
    notify(event.data.path, event.data.value, false);
  });

  class Ref {
    constructor(path) { this.path = String(path || '').replace(/^\\/+|\\/+$/g, ''); this.key = keyOf(this.path); }
    child(name) { return new Ref(this.path ? this.path + '/' + name : String(name)); }
    on(event, callback) {
      if (event !== 'value' || typeof callback !== 'function') return callback;
      if (!listeners.has(this.path)) listeners.set(this.path, new Set());
      listeners.get(this.path).add(callback);
      queueMicrotask(() => callback(snapshot(this.path, state.has(this.path) ? state.get(this.path) : null)));
      return callback;
    }
    off(event, callback) {
      if (event !== 'value') return;
      if (!callback) listeners.delete(this.path);
      else listeners.get(this.path)?.delete(callback);
    }
    once() { return Promise.resolve(snapshot(this.path, state.has(this.path) ? state.get(this.path) : null)); }
    set(value) { notify(this.path, value); return Promise.resolve(); }
    update(value) {
      const current = state.get(this.path);
      const merged = value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(current && typeof current === 'object' ? current : {}), ...value }
        : value;
      notify(this.path, merged);
      return Promise.resolve();
    }
    remove() { notify(this.path, null); return Promise.resolve(); }
    push(value) {
      const child = new Ref(this.path + '/mock_' + (++pushCounter));
      if (arguments.length) {
        const promise = child.set(value).then(() => ({ key: child.key }));
        return promise;
      }
      return child;
    }
    transaction(updater, onComplete) {
      try {
        const current = state.has(this.path) ? state.get(this.path) : null;
        const next = updater(current);
        notify(this.path, next);
        const snap = snapshot(this.path, next);
        onComplete && onComplete(null, true, snap);
        return Promise.resolve({ committed: true, snapshot: snap });
      } catch (error) {
        onComplete && onComplete(error, false, snapshot(this.path, null));
        return Promise.reject(error);
      }
    }
    orderByChild() { return this; }
    orderByKey() { return this; }
    equalTo() { return this; }
    startAt() { return this; }
    endAt() { return this; }
    limitToFirst() { return this; }
    limitToLast() { return this; }
  }

  const auth = {
    currentUser: { uid: DM_UID, email: 'dm-smoke@local.test' },
    onAuthStateChanged(callback) { setTimeout(() => callback(this.currentUser), 0); return () => {}; },
    signOut() { return Promise.resolve(); }
  };
  const db = { ref: (path) => new Ref(path), goOnline() {}, goOffline() {} };
  const firebase = {
    apps: [{}],
    initializeApp() { return {}; },
    auth() { return auth; },
    database() { return db; }
  };
  firebase.auth.GoogleAuthProvider = class GoogleAuthProvider {};
  firebase.database.ServerValue = { TIMESTAMP: Date.now() };
  window.firebase = firebase;
  window.__mockFirebase = {
    set(path, value) { notify(String(path).replace(/^\\/+|\\/+$/g, ''), value); },
    get(path) { return state.get(String(path).replace(/^\\/+|\\/+$/g, '')); }
  };
})();`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript({ content: firebaseMock });
await context.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/, async route => {
  await route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Firebase mocked by authenticated DM smoke test' });
});

const pages = {
  dm: await context.newPage(),
  onGame: await context.newPage(),
};
const errors = { dm: [], onGame: [] };
for (const [name, page] of Object.entries(pages)) {
  page.on('pageerror', error => errors[name].push(String(error?.stack || error)));
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
}

async function responsiveness(page) {
  return page.evaluate(async () => {
    const timerStart = performance.now();
    const timerDelay = await new Promise(resolve => setTimeout(() => resolve(performance.now() - timerStart), 75));
    const rafStart = performance.now();
    const rafDelay = await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - rafStart))));
    return { timerDelay, rafDelay, readyState: document.readyState };
  });
}

await Promise.all([
  pages.dm.goto(base + '/pantalla_dm.html', { waitUntil: 'domcontentloaded', timeout: 30000 }),
  pages.onGame.goto(base + '/hoja_de_DM.html', { waitUntil: 'domcontentloaded', timeout: 30000 }),
]);
await Promise.all([pages.dm.waitForTimeout(5000), pages.onGame.waitForTimeout(5000)]);

// Reproduce the Firebase callback visible in the reported crash. The legacy
// checkbox is absent, so a correct implementation must simply ignore it.
await pages.dm.evaluate(() => window.__mockFirebase.set('campaña/estado_mundo/mesa_crafteo_activa', true));
await pages.onGame.evaluate(() => window.__mockFirebase.set('campaña/estado_mundo/mesa_crafteo_activa', true));
await Promise.all([pages.dm.waitForTimeout(500), pages.onGame.waitForTimeout(500)]);

// Exercise navigation controls after synchronization. These clicks are local to
// the mock Firebase environment and cannot touch production data.
const navSelectors = ['[data-tab]:visible', '.tab-btn:visible', '.dm-tab:visible'];
for (const selector of navSelectors) {
  const locator = pages.dm.locator(selector);
  const count = Math.min(await locator.count(), 8);
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    try {
      if (await item.isVisible()) {
        const id = await item.getAttribute('id');
        if (id === 'btn-modo-director') continue;
        await item.click({ timeout: 1000 });
        await pages.dm.waitForTimeout(80);
      }
    } catch (_) {}
  }
}

// Send one more synchronized state change after clicks.
await pages.dm.evaluate(() => window.__mockFirebase.set('campaña/estado_mundo/mesa_crafteo_activa', false));
await pages.onGame.evaluate(() => window.__mockFirebase.set('campaña/estado_mundo/mesa_crafteo_activa', false));
await Promise.all([pages.dm.waitForTimeout(500), pages.onGame.waitForTimeout(500)]);

const result = {
  dmErrors: errors.dm,
  onGameErrors: errors.onGame,
  dm: await responsiveness(pages.dm),
  onGame: await responsiveness(pages.onGame),
  dmUrl: pages.dm.url(),
  onGameUrl: pages.onGame.url(),
};
console.log(JSON.stringify(result, null, 2));

const frozen = [result.dm, result.onGame].some(metric => metric.timerDelay > 1500 || metric.rafDelay > 1500);
const relevantErrors = [...errors.dm, ...errors.onGame].filter(Boolean);
await browser.close();

if (relevantErrors.length || frozen) process.exit(1);
