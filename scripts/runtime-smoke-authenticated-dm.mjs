import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';

const firebaseMock = `(() => {
  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const state = new Map();
  const listeners = new Map();
  let pushCounter = 0;

  function keyOf(path) {
    const parts = String(path || '').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }
  function snapshot(path, value) {
    return {
      key: keyOf(path), val: () => value,
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
  function notify(path, value) {
    state.set(path, value);
    const callbacks = listeners.get(path);
    if (callbacks) for (const callback of [...callbacks]) queueMicrotask(() => callback(snapshot(path, value)));
  }
  class Ref {
    constructor(path) { this.path = String(path || '').replace(/^\\/+|\\/+$/g, ''); this.key = keyOf(this.path); }
    child(name) { return new Ref(this.path ? this.path + '/' + name : String(name)); }
    on(event, callback) {
      if (event !== 'value' || typeof callback !== 'function') return callback;
      if (!listeners.has(this.path)) listeners.set(this.path, new Set());
      listeners.get(this.path).add(callback);
      // Deliberately do NOT invoke the initial value callback. This test isolates
      // whether the freeze comes from initializeDMApp itself or from one of the
      // Firebase value callbacks it registers.
      return callback;
    }
    off(event, callback) {
      if (event !== 'value') return;
      if (!callback) listeners.delete(this.path); else listeners.get(this.path)?.delete(callback);
    }
    once() { return Promise.resolve(snapshot(this.path, state.has(this.path) ? state.get(this.path) : null)); }
    set(value) { notify(this.path, value); return Promise.resolve(); }
    update(value) {
      const current = state.get(this.path);
      const merged = value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(current && typeof current === 'object' ? current : {}), ...value } : value;
      notify(this.path, merged); return Promise.resolve();
    }
    remove() { notify(this.path, null); return Promise.resolve(); }
    push(value) {
      const child = new Ref(this.path + '/mock_' + (++pushCounter));
      if (arguments.length) return child.set(value).then(() => ({ key: child.key }));
      return child;
    }
    transaction(updater, onComplete) {
      const current = state.has(this.path) ? state.get(this.path) : null;
      const next = updater(current); notify(this.path, next);
      const snap = snapshot(this.path, next);
      onComplete && onComplete(null, true, snap);
      return Promise.resolve({ committed: true, snapshot: snap });
    }
    orderByChild() { return this; } orderByKey() { return this; } equalTo() { return this; }
    startAt() { return this; } endAt() { return this; } limitToFirst() { return this; } limitToLast() { return this; }
  }
  const auth = {
    currentUser: { uid: DM_UID, email: 'dm-smoke@local.test' },
    onAuthStateChanged(callback) { setTimeout(() => callback(this.currentUser), 0); return () => {}; },
    signOut() { return Promise.resolve(); }
  };
  const db = { ref: (path) => new Ref(path), goOnline() {}, goOffline() {} };
  const firebase = { apps: [{}], initializeApp() { return {}; }, auth() { return auth; }, database() { return db; } };
  firebase.auth.GoogleAuthProvider = class GoogleAuthProvider {};
  firebase.database.ServerValue = { TIMESTAMP: Date.now() };
  window.firebase = firebase;
  window.__mockFirebase = {
    fire(path, value) { notify(String(path).replace(/^\\/+|\\/+$/g, ''), value); },
    paths() { return [...listeners.keys()].sort(); }
  };
})();`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript({ content: firebaseMock });
await context.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/, async route => {
  await route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Firebase mocked' });
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error?.stack || error)));
page.on('dialog', dialog => dialog.dismiss().catch(() => {}));

console.log('phase: navigate');
await page.goto(base + '/pantalla_dm.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log('phase: authenticated-init-no-callbacks');
await page.waitForTimeout(4000);

console.log('phase: inspect');
const result = await page.evaluate(async () => {
  const start = performance.now();
  const timerDelay = await new Promise(resolve => setTimeout(() => resolve(performance.now() - start), 75));
  return {
    timerDelay,
    readyState: document.readyState,
    listenerPaths: window.__mockFirebase.paths(),
    toggleExists: !!document.getElementById('toggle-mesa-crafteo')
  };
});
console.log(JSON.stringify({ ...result, errors }, null, 2));
await browser.close();
if (errors.length || result.timerDelay > 1500) process.exit(1);
