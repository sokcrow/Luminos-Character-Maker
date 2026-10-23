import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Independent VM clients run the shipped transport, step engine and consumer.
// Only wall time/network delivery are simulated; no combat rule is replayed.
let wall = 100000, serial = 0;
const timers = new Map();
const timer = (fn, ms) => { const id = ++serial; timers.set(id, { at: wall + ms, fn }); return id; };
const clear = id => timers.delete(id);
const sleep = ms => new Promise(resolve => timer(resolve, ms));
const source = name => fs.readFileSync(`js/${name}.js`, 'utf8');
const clients = [];
function client({ role = 'player', skew = 0, latency = 0, stall = false } = {}) {
  const played = [], applied = [], consumed = [], errors = [];
  let handler, engine, stalled = false;
  const c = vm.createContext({ console, Date: { now: () => wall + skew }, Math, JSON, Map, WeakMap, Set, Promise,
    setTimeout: timer, clearTimeout: clear, addEventListener() {} });
  c.window = c;
  vm.runInContext(source('combat-v073-playback'), c);
  vm.runInContext(source('combat-v073-steps'), c);
  const ref = { orderByKey() { return this; }, startAt() { return this; }, on(_kind, fn) { handler = fn; }, off() {} };
  c.LuminousCombatLiveAdapter073 = { state: { role, hydratedOnce: true, db: { ref: () => ref } } };
  c.LuminousCombat073 = { combatants: () => ({ ally: { hp: 100 } }) };
  async function render(cue, args) {
    played.push({ cue, label: args[0], at: wall });
    const hold = cue === 'powerCoin' ? 300 : cue === 'clashOutcome' ? 400 : 0;
    if (stall && !stalled && cue === 'powerCoin') { stalled = true; await sleep(2200); }
    if (hold) await sleep(hold);
  }
  c.LuminousCombatStepRuntime = { capturePresentation(value) { engine.capturePresentation(value); },
    events: after => engine.events(after), beginPlayback() {}, refreshPlayback() {},
    acceptEvent(event) { consumed.push(event.sequence); }, finishPlayback() { consumed.push('finished'); }, present: render };
  vm.runInContext(source('combat-v073-playback-sync'), c);
  const sync = c.LuminousCombatPlaybackSync;
  sync.state.serverOffset = -skew;
  const authority = { state: {}, applySnapshot(value) { applied.push(JSON.parse(JSON.stringify(value))); } };
  sync.state.authority = authority;
  const data = { id: 'round', round: 1, phase: 'running', initialStateJson: '{}',
    playback: { session: sync.session, schemaVersion: 1, engineVersion: c.LuminousCombatPlayback.engineVersion, timelineVersion: 1 } };
  authority.state.current = data;
  let flushTimer = null;
  const flush = () => {
    flushTimer = null;
    const row = Object.values(sync.batchUpdates({ type: 'presentation', updatedAt: wall }))[0];
    for (const peer of clients) if (peer.role === 'player') {
      // Same event arrives at independent clocks over different connections.
      timer(() => peer.deliver(row), peer.latency + (row.seq % 2 ? 15 : 0));
    }
  };
  const publish = () => { if (flushTimer === null) flushTimer = timer(flush, 16); };
  engine = c.LuminousCombatSteps.create({ rules: {}, snapshot: () => ({ ally: { hp: 100 } }),
    schedulePresentation: () => sync.schedulePresentation(), presentScheduled: (event, draw) => sync.presentScheduled(event, draw),
    publish, presentation: Object.fromEntries(['powerStart', 'powerCoin', 'powerEnd', 'clashOutcome'].map(cue => [cue, (...args) => render(cue, args)])) });
  const peer = { role, latency, played, applied, consumed, errors, c, sync, engine,
    deliver(row) { handler({ val: () => row }); } };
  clients.push(peer);
  return { ...peer, async start() { if (role === 'dm') sync.beginUpdates(data); else await sync.observe(data); } };
}
const dm = client({ role: 'dm', skew: 180000 });
const pc = client({ skew: -90000, latency: 45 });
const phone = client({ skew: 360000, latency: 190 });
const slow = client({ skew: -120000, latency: 30, stall: true });
await Promise.all([dm, pc, phone, slow].map(peer => peer.start()));
let done = false;
const execution = (async () => {
  await dm.engine.show('powerStart', 'setup');
  for (let n = 0; n < 8; n++) {
    await Promise.all([dm.engine.show('powerCoin', `a${n}`, { index: n }), dm.engine.show('powerCoin', `b${n}`, { index: n })]);
    await dm.engine.show('clashOutcome', `exchange${n}`);
  }
  await dm.engine.show('powerEnd', 'cleanup');
  await dm.sync.drainPresentation();
  const row = Object.values(dm.sync.batchUpdates({ type: 'round_complete', updatedAt: wall, combatants: { ally: { hp: 77 } } }))[0];
  for (const peer of [pc, phone, slow]) timer(() => peer.deliver(row), peer.latency);
})();
execution.then(() => { done = true; });
for (let i = 0; i < 10000; i++) {
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
  if (!timers.size) { if (done) break; throw Error('Scheduled playback deadlocked'); }
  const [id, next] = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
  wall = next.at; timers.delete(id); next.fn();
}
await execution;
await Promise.all([pc, phone, slow].map(peer => peer.sync.state.consumer.idle()));
for (const peer of [pc, phone]) {
  assert.equal(peer.played.length, dm.played.length, 'healthy viewers see every cue');
  for (const cue of dm.played) {
    const received = peer.played.find(row => row.cue === cue.cue && row.label === cue.label);
    assert.ok(Math.abs(received.at - cue.at) <= 150, `${cue.label}: ${received.at - cue.at}ms skew must not accumulate across exchanges`);
  }
}
for (const peer of [pc, phone, slow]) {
  assert.equal(peer.applied.at(-1).ally.hp, 77);
  assert.equal(peer.consumed.at(-1), 'finished');
  assert.equal(peer.sync.state.authority.state.runningLocal, false);
}
assert.ok(slow.played.length < dm.played.length, 'a suspended viewer skips expired animations, but consumes their states');
assert.equal(slow.played.at(-1).label, 'cleanup', 'catch-up preserves final cleanup');
assert.ok(Math.abs(slow.played.at(-1).at - dm.played.at(-1).at) <= 100, 'slow viewer rejoins the live timeline');
assert.equal(dm.sync.canSchedule({ p: { playback: { schemaVersion: 1, engineVersion: dm.c.LuminousCombatPlayback.engineVersion } } }, ['p']), false, 'old viewers keep the legacy contract');
// Teardown cancels timers, including a future cue that has not appeared yet.
const clock = dm.c.LuminousCombatPlayback.createPresentationClock({ now: () => wall, setTimer: timer, clearTimer: clear });
let drew = false;
const pending = clock.run('powerCoin', clock.stamp(), () => { drew = true; });
clock.stop(); await pending;
assert.equal(drew, false); assert.equal(timers.size, 0);
assert.ok(dm.engine.events().every(event => event.type !== 'Presentation' || event.timing.schemaVersion === 1));
console.log('Shared clock: DM, PC and phone stay within 150ms over eight exchanges with 190ms delivery and clocks skewed by minutes; suspended viewer catches up, state converges, teardown cancels future cues.');
