import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { harness, unit } from './fixtures/combat-phase1-harness.mjs';
const context = { globalThis: null }; context.globalThis = context;
vm.runInNewContext(fs.readFileSync(new URL('../js/combat-v073-playback.js', import.meta.url), 'utf8'), context);
const api = context.LuminousCombatPlayback;
const json = value => JSON.parse(JSON.stringify(value));
const batch = (seq, events, extra = {}) => ({ schemaVersion: 1, engineVersion: api.engineVersion,
  generation: 'round-one', seq, payload: JSON.stringify({events,eventCursor:seq, combatants: { a: { hp: 100 - seq, statusEffects: {}, pendingStatusEffects: [], inventory: { arrows: 5 - seq } } }, ...extra}) });
let current, visuals = [], events = [], completed = 0, errors = [];
const options = { generation: 'round-one', apply: value => { current = json(value); },
  present: async (cue, args) => { visuals.push([cue, args]); }, finish: () => { completed++; },
  onEvent: event => events.push(event.sequence), onError: error => errors.push(error.message) };
const consumer = api.createConsumer(options);
const one = batch(1, [{ sequence: 1, type: 'Presentation', cue: 'hitMotion', args: ['resolved'], combatants: { a: { hp: 99 } } }]);
const two = batch(2, [{ sequence: 2, type: 'DamageApplied', unitId: 'a', before: 100, after: 98 }]);
const three = batch(3, [{ sequence: 3, type: 'RoundFinished' }], { type: 'round_complete' });
// Out-of-order + duplicated + concurrent delivery drains one ordered chain.
await consumer.receive(two); assert.equal(consumer.cursor(), 0);
await Promise.all([consumer.receive(one), consumer.receive(two), consumer.receive(three), consumer.receive(three)]);
assert.deepEqual(events, [1, 2, 3]); assert.equal(visuals.length, 1); assert.equal(completed, 1);
assert.deepEqual(current.a.statusEffects, {}); assert.deepEqual(current.a.pendingStatusEffects, []);
assert.equal(current.a.hp, 97); assert.equal(current.a.inventory.arrows, 2); assert.deepEqual(errors, []);
await consumer.receive({ ...three, generation: 'old-round' }); assert.equal(completed, 1);
// A reload starts after the committed checkpoint, skipping damage/costs/visuals.
events = []; visuals = []; completed = 0;
const resumed = api.createConsumer({ ...options, checkpoint: { seq: 2, eventCursor: 2 } });
await Promise.all([resumed.receive(one), resumed.receive(two), resumed.receive(three)]);
assert.deepEqual(events, [3]); assert.equal(visuals.length, 0); assert.equal(completed, 1);
// Corruption, incompatible schemas and gaps stop playback instead of resolving locally.
for (const invalid of [batch(1, [{ sequence: 2 }]), { ...one, schemaVersion: 2 }, { ...one, engineVersion: 'future' }]) {
  const faults = [], c = api.createConsumer({ ...options, onError: error => faults.push(error.message) });
  await c.receive(invalid); assert.equal(faults.length, 1); assert.equal(c.cursor(), 0);
}
const faults = [], conflict = api.createConsumer({ ...options, onError: error => faults.push(error.message) });
await conflict.receive(two); await conflict.receive({ ...two, payload: JSON.stringify({...JSON.parse(two.payload),combatants:{a:{hp:500}}}) });
assert.deepEqual(faults, ['PLAYBACK_BATCH_CONFLICT']);
// The real incremental resolver records serializable presentation commands while
// retaining its rules state, RNG order and damage exactly once.
const h = harness({ units: { a: unit('a'), b: unit('b') } });
h.steps.capturePresentation(true);
await h.steps.hits({ ownerId: 'a', localIndex: 0, slot: { nodeType: 1 }, plan: { type: 'skills', targetId: 'b', data: {
  basePower: 3, coinPower: 2, coinAmount: 2, damageType: 'slash', statusEffects: [] } } }, 'b', 2);
const recorded = h.steps.events();
assert.ok(recorded.some(event => event.type === 'Presentation'));
assert.doesNotMatch(JSON.stringify(recorded), /nodeType/);
const before = json(h.data), cursor = h.cursor();
for (const event of recorded.filter(e => e.type === 'Presentation')) await h.steps.present(event.cue, event.args);
assert.deepEqual(json(h.data), before); assert.equal(h.cursor(), cursor);
console.log('Phase 2: ordered/duplicate/late delivery, checkpoint resume, fail-closed schema and presentation-only replay passed');
