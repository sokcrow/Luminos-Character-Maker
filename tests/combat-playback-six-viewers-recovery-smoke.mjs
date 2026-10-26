import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Six separate JavaScript clients exercising the actual shipped playback modules.
// This is a transport regression, NOT six real authenticated browsers.
const playbackSource = fs.readFileSync('js/combat-v073-playback.js', 'utf8');
const syncSource = fs.readFileSync('js/combat-v073-playback-sync.js', 'utf8');
const combatants = { ally: { hp: 77 } };
let authoritySnapshot = null;

function viewer(index, { finalRepair = false, repeatCancel = false } = {}) {
  const retries = [];
  let reads = 0;
  let handler = null;
  const events = [], applied = [], visual = [], finished = [], warnings = [], errors = [];
  const c = vm.createContext({
    Math, Date, JSON, Map, Set, WeakMap, Promise,
    setTimeout(fn, delay) {
      if (repeatCancel && [350, 1000, 2500].includes(delay)) { retries.push(delay); return setTimeout(fn, 1); }
      return setTimeout(fn, finalRepair && delay === 10000 ? 25 : delay); },
    clearTimeout, addEventListener() {},
    console: {
      log() {},
      warn(...parts) { warnings.push(parts.map(String).join(' ')); },
      error(...parts) { errors.push(parts.map(String).join(' ')); },
    },
  });
  c.window = c;
  vm.runInContext(playbackSource, c);
  const baseProtocol = c.LuminousCombatPlayback;
  c.LuminousCombatPlayback = {
    ...baseProtocol,
    createConsumer(options) { return baseProtocol.createConsumer({ ...options, visualTimeoutMs: 35, batchGapTimeoutMs: 35 }); },
  };
  const ref = path => ({
    orderByKey() { return this; },
    startAt() { return this; },
    on(type, fn, cancel) { if (type === 'child_added') { handler = fn;
      if (repeatCancel && reads < 5) queueMicrotask(() => cancel(new Error('listener cancelled')));
    } },
    off(type, fn) { if (type === 'child_added' && handler === fn) handler = null; },
    async once() { reads++; return { val: () => authoritySnapshot }; },
  });
  c.LuminousCombatLiveAdapter073 = {
    state: { role: 'player', hydratedOnce: true, db: { ref }, user: { getIdToken: async () => 'token' } },
    scheduleHydrate() {},
  };
  c.LuminousCombat073 = { combatants: () => combatants };
  c.LuminousCombatStepRuntime = {
    lockPlanning() {}, beginPlayback() {},
    refreshPlayback() { if (index === 3 && !visual.length) throw Error('HUD renderer failed'); },
    acceptEvent(event) { events.push(event.sequence); },
    async present(cue, args) {
      visual.push(args[0]);
      if (index === 0 && args[0] === 'Clash 1') throw Error('bad sprite');
      if (index === 1 && args[0] === 'Clash 1') return new Promise(() => {});
    },
    finishPlayback(round) { finished.push(round); },
  };
  vm.runInContext(syncSource, c);
  const sync = c.LuminousCombatPlaybackSync;
  sync.state.authority = {
    ROOT: { current: 'campaña/combate/authority/current' },
    state: { current: null, runningLocal: false },
    applySnapshot(snapshot) { applied.push(JSON.parse(JSON.stringify(snapshot))); },
  };
  return {
    c, sync, events, applied, visual, finished, warnings, errors, retries,
    restoreSubscription() { repeatCancel = false; },
    deliver(payload) { assert.ok(handler, 'viewer has an active batch subscription'); handler({ val: () => payload }); },
    async idle() { await sync.state.consumer.idle(); },
    close() { sync.stop(); },
  };
}

const clients = Array.from({ length: 6 }, (_, i) => viewer(i));
const engine = clients[0].c.LuminousCombatPlayback.engineVersion;
const round = {
  id: 'six-clash-generation', round: 1, phase: 'running', initialStateJson: '{}',
  playback: { schemaVersion: 1, engineVersion: engine },
};
const batch = (seq, hp, type = 'presentation') => ({
  seq, generation: round.id, schemaVersion: 1, engineVersion: engine,
  updatedAt: Date.now(),
  payload: JSON.stringify({
    seq, eventCursor: seq, type, nextRound: 2,
    events: [{ sequence: seq, type: 'Presentation', cue: 'clashOutcome',
      args: ['Clash ' + seq], changes: [{ unitId: 'ally', after: { hp } }] }],
    combatants: { ally: { hp } },
  }),
});
authoritySnapshot = {
  ...round,
  checkpoint: { seq: 2, eventCursor: 2, combatants: { ally: { hp: 90 } },
    stateJson: JSON.stringify({ ally: { hp: 90 } }), rngCursor: 0 },
};
await Promise.all(clients.map(client => client.sync.observe(round)));
for (const client of clients) client.deliver(batch(1, 95));
await Promise.all(clients.map(client => client.idle()));

// This is the sequence fault existing smoke tests missed: one spectator gets
// a malformed batch while the other five continue normally.
const corrupted = batch(2, 90);
const invalid = { ...corrupted, payload: JSON.stringify({
  ...JSON.parse(corrupted.payload), events: [{
    sequence: 99, type: 'Presentation', cue: 'clashOutcome', args: ['corrupted'] }],
}) };
clients.forEach((client, i) => client.deliver(i === 2 ? invalid : corrupted));
await Promise.all(clients.map(client => client.idle()));
assert.equal(clients[2].sync.state.consumer.cursor(), 1, 'sequence error stops corrupted consumer');
await new Promise(resolve => setTimeout(resolve, 450));
assert.equal(clients[2].sync.state.consumer.cursor(), 2, 'viewer automatically resumes at DM checkpoint');
for (const client of clients) client.deliver(batch(3, 77, 'round_complete'));
await Promise.all(clients.map(client => client.idle()));
for (const [index, client] of clients.entries()) {
  assert.equal(client.sync.state.consumer.cursor(), 3, 'viewer ' + index + ' finishes');
  assert.deepEqual(client.finished, [2], 'viewer ' + index + ' exits playback once');
  assert.equal(client.applied.at(-1).ally.hp, 77, 'viewer ' + index + ' has authoritative HP');
  assert.equal(client.sync.state.authority.state.runningLocal, false);
}
assert.ok(clients[0].warnings.some(line => line.includes('bad sprite')), 'visual throw is reported but not fatal');
assert.ok(clients[1].warnings.some(line => line.includes('PLAYBACK_VISUAL_TIMEOUT')), 'hung visual is skipped');
assert.ok(clients[2].errors.some(line => line.includes('PLAYBACK_EVENT_GAP')), 'hard protocol errors are still detected');
assert.ok(clients[3].warnings.some(line => line.includes('HUD renderer failed')), 'HUD refresh errors are visual-only');
assert.deepEqual(clients[4].events, [1, 2, 3], 'healthy client receives every event');
assert.deepEqual(clients[5].events, [1, 2, 3], 'second healthy client receives every event');
clients.forEach(client => client.close());

// Regression: a dropped batch must trigger checkpoint recovery, not wait forever.
const gapClient = viewer(7);
await gapClient.sync.observe(round);
gapClient.deliver(batch(1, 95));
await gapClient.idle();
gapClient.deliver(batch(3, 77, 'round_complete'));
await gapClient.idle();
await new Promise(resolve => setTimeout(resolve, 460));
assert.equal(gapClient.sync.state.consumer.cursor(), 2, 'missing batch triggers checkpoint recovery');
gapClient.deliver(batch(3, 77, 'round_complete'));
await gapClient.idle();
assert.deepEqual(gapClient.finished, [2]);
assert.equal(gapClient.applied.at(-1).ally.hp, 77);
assert.ok(gapClient.errors.some(line => line.includes('PLAYBACK_BATCH_GAP')));
gapClient.close();

// Normal reordering within the grace period should not cause a recovery.
const reorderedClient = viewer(8);
await reorderedClient.sync.observe(round);
reorderedClient.deliver(batch(1, 95));
await reorderedClient.idle();
reorderedClient.deliver(batch(3, 77, 'round_complete'));
reorderedClient.deliver(batch(2, 90));
await reorderedClient.idle();
assert.equal(reorderedClient.sync.state.consumer.cursor(), 3);
assert.deepEqual(reorderedClient.errors, []);
reorderedClient.close();

// A lost terminal batch must not strand the player after the DM has completed.
const finalClient = viewer(6, { finalRepair: true });
await finalClient.sync.observe(round);
finalClient.sync.state.authority.state.current = authoritySnapshot;
await finalClient.sync.observe({ ...authoritySnapshot, phase: 'complete' });
await new Promise(resolve => setTimeout(resolve, 75));
assert.deepEqual(finalClient.finished, [2], 'terminal checkpoint repairs a missing final batch');
assert.equal(finalClient.applied.at(-1).ally.hp, 90);
assert.equal(finalClient.sync.state.authority.state.runningLocal, false);
finalClient.close();

// A visual error must not permanently poison the authoritative presentation clock.
const clock = clients[0].c.LuminousCombatPlayback.createPresentationClock({ now: () => 0 });
let nextRendered = false;
await clock.run('clashOutcome', { playAt: 0 }, async () => { throw Error('visual fail'); });
await clock.run('clashOutcome', { playAt: 0 }, async () => { nextRendered = true; });
await clock.drain();
assert.equal(nextRendered, true);
clock.stop();
console.log('Six independent playback clients: thrown/hung visuals, invalid sequence rejoin, missing final batch and clock recovery passed.');

const cancelled = viewer(9, { repeatCancel: true });
await cancelled.sync.observe(round);
await new Promise(resolve => setTimeout(resolve, 100));
assert.deepEqual(cancelled.retries, [350, 1000, 2500], 'same-round retries are bounded and back off');
assert.equal(cancelled.sync.state.viewerRecoveryAttempts, 3);
cancelled.restoreSubscription();
await cancelled.sync.observe({ ...round, id: 'next-generation' });
assert.equal(cancelled.sync.state.viewerRecoveryAttempts, 0, 'a new round gets a fresh retry budget');
cancelled.close();
console.log('Repeated subscription cancellation: bounded backoff and new-generation reset passed.');
