import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

const firebaseMock = `(() => {
  const DM_UID = '${DM_UID}';
  const root = {
    campaña: {
      config: { dm_uid: DM_UID },
      jugadores: { Hero: { uid: 'player-uid', actorId: 'actor_hero', character_name: 'Hero' } },
      actores: { actor_hero: { id: 'actor_hero', nombre: 'Hero', icono: 'hero.png', hp: 100, maxHp: 100, actionSlots: 1 } },
      base_datos_unidades: { bandit: { id: 'bandit', nombre: 'Bandit', icono: 'bandit.png', hp: 40, maxHp: 40, speed: 3, actionSlots: 1, faction: 'enemy' } },
      base_datos_skills: {},
      combate: {
        estado: 'COMBAT_ACTIVE',
        active: true,
        combatants: {
          legacy_hooligan: { id: 'legacy_hooligan', name: 'Hooligan Legacy', faction: 'enemy', hp: 145, maxHp: 145, speed: 4, actionSlots: 1, x: 70, y: 45, img: 'legacy.png' }
        },
        settings: {}, slotTargets: {}, plannedActions: {}
      }
    }
  };
  const listeners = new Map();
  let pushCounter = 0;
  const parts = (path) => String(path || '').split('/').filter(Boolean);
  const get = (path) => parts(path).reduce((node, key) => node && typeof node === 'object' ? node[key] : undefined, root);
  const set = (path, value) => {
    const keys = parts(path);
    if (!keys.length) return;
    let node = root;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!node[keys[i]] || typeof node[keys[i]] !== 'object') node[keys[i]] = {};
      node = node[keys[i]];
    }
    const key = keys[keys.length - 1];
    if (value === null || value === undefined) delete node[key]; else node[key] = value;
  };
  const merge = (path, patch) => {
    for (const [key, value] of Object.entries(patch || {})) set(path ? path + '/' + key : key, value);
  };
  const snap = (path) => {
    const value = get(path);
    const key = parts(path).at(-1) || null;
    return { key, val: () => value === undefined ? null : structuredClone(value), exists: () => value !== undefined && value !== null,
      child: (name) => snap(path ? path + '/' + name : name),
      forEach: (cb) => { if (!value || typeof value !== 'object') return false; for (const k of Object.keys(value)) if (cb(snap(path + '/' + k)) === true) return true; return false; }
    };
  };
  const notifyAll = () => { for (const [path, callbacks] of listeners) for (const cb of [...callbacks]) queueMicrotask(() => cb(snap(path))); };
  class Ref {
    constructor(path) { this.path = String(path || '').replace(/^\\/+|\\/+$/g, ''); this.key = parts(this.path).at(-1) || null; }
    child(name) { return new Ref(this.path ? this.path + '/' + name : name); }
    on(event, cb) { if (event !== 'value') return cb; if (!listeners.has(this.path)) listeners.set(this.path, new Set()); listeners.get(this.path).add(cb); queueMicrotask(() => cb(snap(this.path))); return cb; }
    off(event, cb) { if (event !== 'value') return; if (!cb) listeners.delete(this.path); else listeners.get(this.path)?.delete(cb); }
    once() { return Promise.resolve(snap(this.path)); }
    set(value) { set(this.path, structuredClone(value)); notifyAll(); return Promise.resolve(); }
    update(value) { merge(this.path, structuredClone(value)); notifyAll(); return Promise.resolve(); }
    remove() { set(this.path, null); notifyAll(); return Promise.resolve(); }
    push(value) { const child = new Ref(this.path + '/mock_' + (++pushCounter)); if (arguments.length) { child.set(value); } return child; }
    transaction(fn) { const next = fn(structuredClone(get(this.path) ?? null)); if (next === undefined) return Promise.resolve({ committed: false, snapshot: snap(this.path) }); set(this.path, next); notifyAll(); return Promise.resolve({ committed: true, snapshot: snap(this.path) }); }
    orderByChild() { return this; } orderByKey() { return this; } equalTo() { return this; } startAt() { return this; } endAt() { return this; } limitToFirst() { return this; } limitToLast() { return this; }
  }
  const auth = { currentUser: { uid: DM_UID, email: 'dm@test.local' }, onAuthStateChanged(cb) { setTimeout(() => cb(this.currentUser), 0); return () => {}; }, signOut() { return Promise.resolve(); } };
  const db = { ref: (path) => new Ref(path) };
  const firebase = { apps: [{}], initializeApp() { return {}; }, app() { return {}; }, auth() { return auth; }, database() { return db; } };
  firebase.auth.GoogleAuthProvider = class {};
  firebase.database.ServerValue = { TIMESTAMP: Date.now() };
  window.firebase = firebase;
  window.__mockDb = { get: (path) => structuredClone(get(path) ?? null), set: (path, value) => { set(path, structuredClone(value)); notifyAll(); } };
})();`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript({ content: firebaseMock });
await context.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '// mocked' }));
await context.route(/https:\/\/fonts\.googleapis\.com\/.*/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e?.stack || e)));
page.on('dialog', d => d.dismiss().catch(() => {}));
page.setDefaultTimeout(5000);

console.log('phase: load stale legacy encounter');
await page.goto(base + '/Battle-viewer.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2500);

let result = await page.evaluate(() => ({
  tokens: document.querySelectorAll('#battlefield .sprite-container').length,
  bodyHasHooligan: document.body.innerText.includes('Hooligan'),
  executeDisabled: document.getElementById('btn-execute-clash')?.disabled,
  actorLibrary: Boolean(window.LuminousActorLibrary),
  encounterSession: Boolean(window.LuminousBattleViewerEncounterSession074),
  encounterSetup: Boolean(window.LuminousBattleViewerEncounterSetup074),
  playerEntry: Boolean(window.LuminousBattleViewerPlayerEntry074),
  setupCard: Boolean(document.getElementById('dm074-encounter-setup')),
  dmDashboard: Boolean(document.getElementById('dm-dashboard')),
  log: document.getElementById('combat-log-terminal')?.innerText || ''
}));
console.log(JSON.stringify(result, null, 2));
if (result.tokens !== 0 || result.bodyHasHooligan || result.executeDisabled !== true) throw new Error('LEGACY_COMBATANT_VISIBLE_BEFORE_START');
if (!result.actorLibrary || !result.encounterSession || !result.encounterSetup || !result.playerEntry || !result.setupCard || !result.dmDashboard) throw new Error('DM_ENCOUNTER_RUNTIME_NOT_MOUNTED');

console.log('phase: stage unit');
await page.selectOption('#dm074-encounter-unit-select', { index: 1 });
await page.click('#dm074-encounter-unit-enemy');
await page.waitForTimeout(250);
let draft = await page.evaluate(() => window.__mockDb.get('campaña/combate/encounterDraft/combatants'));
let liveBefore = await page.evaluate(() => window.__mockDb.get('campaña/combate/combatants'));
if (!draft || Object.keys(draft).length !== 1) throw new Error('UNIT_NOT_STAGED');
if (!liveBefore?.legacy_hooligan) throw new Error('STAGING_MUTATED_LIVE_ROSTER');
if (await page.locator('#battlefield .sprite-container').count() !== 0) throw new Error('STAGED_UNIT_RENDERED_BEFORE_START');

console.log('phase: start encounter');
await page.click('#dm074-encounter-start');
await page.waitForTimeout(400);
const dbState = await page.evaluate(() => ({
  id: window.__mockDb.get('campaña/combate/activeEncounterId'),
  state: window.__mockDb.get('campaña/combate/estado'),
  live: window.__mockDb.get('campaña/combate/combatants'),
  draft: window.__mockDb.get('campaña/combate/encounterDraft'),
}));
const liveEntries = Object.values(dbState.live || {});
if (!dbState.id || dbState.state !== 'PRE_COMBAT_PLANNING') throw new Error('ENCOUNTER_NOT_STARTED');
if (liveEntries.length !== 1 || liveEntries[0].name !== 'Bandit' || liveEntries[0].encounterId !== dbState.id) throw new Error('LIVE_ROSTER_NOT_REPLACED_FROM_DRAFT');
if (dbState.draft != null) throw new Error('DRAFT_NOT_CLEARED_AFTER_START');

result = await page.evaluate(() => ({
  tokens: document.querySelectorAll('#battlefield .sprite-container').length,
  names: [...document.querySelectorAll('#battlefield .name-plate')].map(n => n.textContent.trim()),
  executeDisabled: document.getElementById('btn-execute-clash')?.disabled,
  bodyHasHooligan: document.body.innerText.includes('Hooligan'),
}));
console.log(JSON.stringify(result, null, 2));
if (result.tokens !== 1 || result.names[0] !== 'Bandit' || result.executeDisabled !== false || result.bodyHasHooligan) throw new Error('STARTED_ENCOUNTER_RENDER_INVALID');
if (errors.length) throw new Error('PAGE_ERRORS: ' + errors.join('\n---\n'));

console.log('SUCCESS: stale combat hidden; draft staged; START ENCOUNTER materialized only current roster');
await browser.close();
