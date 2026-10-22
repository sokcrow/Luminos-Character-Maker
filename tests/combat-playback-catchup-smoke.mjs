import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let now = 100000, handler, finished = 0;
const played = [], applied = [], events = [];
const c = vm.createContext({ console, Date: { now: () => now }, Math, JSON, Map, Set, WeakMap, Promise, addEventListener() {} });
c.window = c;
vm.runInContext(fs.readFileSync('js/combat-v073-playback.js', 'utf8'), c);
const ref = { orderByKey() { return this; }, startAt() { return this; }, on(kind, fn) { handler = fn; }, off() {} };
c.LuminousCombatLiveAdapter073 = { state: { role: 'player', hydratedOnce: true, db: { ref: () => ref } } };
c.LuminousCombat073 = { combatants: () => ({ ally: { hp: 100 } }) };
c.LuminousCombatStepRuntime = { beginPlayback() {}, acceptEvent(e) { events.push(e.sequence); }, refreshPlayback() {},
  finishPlayback() { finished++; }, async present(cue, args) { played.push(args[0]); if (args[0] === 'long-clash') now += 20000; } };
vm.runInContext(fs.readFileSync('js/combat-v073-playback-sync.js', 'utf8'), c);
const sync = c.LuminousCombatPlaybackSync;
sync.state.authority = { state: {}, applySnapshot(snapshot) { applied.push(snapshot); } };
await sync.observe({ id: 'round', phase: 'running', round: 1, playback: { schemaVersion: 1, engineVersion: c.LuminousCombatPlayback.engineVersion } });
const batch = (seq, updatedAt, labels, type = 'presentation', startEvent = seq) => ({ generation: 'round', schemaVersion: 1,
  engineVersion: c.LuminousCombatPlayback.engineVersion, seq, updatedAt, payload: JSON.stringify({ seq, type, eventCursor: startEvent + labels.length - 1,
    combatants: { ally: { hp: 100 - seq } }, nextRound: 2,
    events: labels.map((label, i) => ({ sequence: startEvent + i, type: 'Presentation', cue: 'hold', args: [label] })) }) });
async function deliver(value) { handler({ val: () => value }); await sync.state.consumer.idle(); }
now = 200000;
await deliver(batch(1, 101000, ['expired']));
assert.deepEqual(played, [], '99-second backlog after a round began must skip old animation');
assert.equal(events.length, 1, 'stale visuals still consume authoritative events');
assert.equal(applied.at(-1).ally.hp, 99);
await deliver(batch(2, now, ['long-clash', 'same-batch'], 'presentation', 2));
assert.deepEqual(played, ['long-clash', 'same-batch'], 'a fresh batch must not expire halfway through its own Clash');
await deliver(batch(3, now - 10000, ['new-backlog'], 'presentation', 4));
assert.equal(played.length, 2, 'new batches re-evaluate the clock after a long animation');
await deliver(batch(4, now, ['caught-up'], 'round_complete', 5));
assert.equal(played.at(-1), 'caught-up');
assert.equal(applied.at(-1).ally.hp, 96);
assert.equal(sync.state.consumer.cursor(), 4);
assert.equal(finished, 1);
assert.equal(sync.state.authority.state.runningLocal, false);
// Server clock offset participates in each new batch's age decision.
sync.state.serverOffset = 60000;
assert.equal(sync.createPresentationGate()({ updatedAt: now }), false);
assert.equal(sync.createPresentationGate()({ updatedAt: now + 60000 }), true);
console.log('Playback catch-up: mid-round backlog, stable Clash batches, state preservation, recovery, finish and server-clock offset passed.');
