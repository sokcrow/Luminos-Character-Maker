import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const refs = new Map();
const timers = new Map();
let timerId = 0, onAuth, refreshed = 0;
const db = { ref(path) {
  if (!refs.has(path)) refs.set(path, { calls: 0, handler: null, cancel: null,
    on(event, handler, cancel) { this.calls++; this.handler = handler; this.cancel = cancel; },
    off(event, handler) { if (this.handler === handler) this.handler = null; },
    once: async () => ({ val: () => 'dm' }),
  });
  return refs.get(path);
} };
const auth = { onAuthStateChanged(callback) { onAuth = callback; } };
const window = { console, document: { getElementById: () => null }, addEventListener() {},
  setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
  clearTimeout(id) { timers.delete(id); },
  firebase: { apps: [{}], initializeApp() {}, auth: () => auth, database: () => db },
};
vm.runInNewContext(fs.readFileSync(new URL('../js/combat-v073-live-adapter.js', import.meta.url), 'utf8'), { window });
const adapter = window.LuminousCombatLiveAdapter073;
onAuth({ uid: 'a', async getIdToken() { refreshed++; return 'emulator-token'; } });
const field = refs.get(adapter.ROOTS.combatants);
field.cancel({ code: 'PERMISSION_DENIED' });
for (let i = 0; i < 5; i++) await Promise.resolve();
assert.equal(refreshed, 1);
const retry = [...timers.entries()].find(([, row]) => row.ms === 250);
assert.ok(retry, 'a cancelled authenticated listen schedules one retry');
timers.delete(retry[0]); retry[1].callback();
assert.equal(field.calls, 2);
field.handler({ val: () => ({ 'player:a': { id: 'player:a' } }) });
assert.ok(adapter.state.combatants['player:a'], 'the recovered listen delivers the field');
field.cancel({ code: 'PERMISSION_DENIED' });
for (let i = 0; i < 5; i++) await Promise.resolve();
assert.equal(refreshed, 1, 'permanent denial must not create a retry loop');
assert.equal([...timers.values()].filter(row => row.ms === 250).length, 0);

refs.get(adapter.ROOTS.players).cancel({ code: 'PERMISSION_DENIED' });
for (let i = 0; i < 5; i++) await Promise.resolve();
adapter.stop();
assert.equal(timers.size, 0, 'closing or hiding Combat cancels pending recovery');
assert.equal(field.handler, null);
console.log('Combat cancelled Auth listener recovery: one retry, data delivery and cleanup passed');
