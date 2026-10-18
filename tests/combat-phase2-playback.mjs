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
await consumer.receive({...three,updatedAt:999});assert.equal(completed,1,'a retried timestamp is not a different result');
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
// The shipped recovery snapshot keeps queue consumption, reactive defenses and
// Grapple state, while replacing element handles with the receiving tab's DOM.
{
  const source=fs.readFileSync(new URL('../combat/source/combat-v073-live.html',import.meta.url),'utf8');
  const start=source.indexOf('window.LuminousCombatStepRuntime=Object.freeze({');
  const facade=source.slice(start,source.indexOf('window.LuminousCombat073=Object.freeze',start));
  const node={nodeType:1},liveSlot={nodeType:1},entry={ownerId:'a',localIndex:0,slot:node,plan:{data:{slot:'offHand'}},_onUseStatusApplied:true};
  const win={LuminousCombatSteps:{version:'test'}};
  const c={window:win,combatData:{a:{hp:80,reactiveDefense:{evade:{entry}}}},activeGrapples:[{id:'grapple',active:true}],grappleSerial:4,unitSlots:()=>[liveSlot]};
  vm.createContext(c);vm.runInContext(facade,c);
  const saved=win.LuminousCombatStepRuntime.captureExecution([entry],new Set(['a:0']));
  assert.doesNotMatch(JSON.stringify(saved),/nodeType/);
  assert.equal(saved.queue[0].plan.data.slot,'offHand');
  const queue=[{ownerId:'a',localIndex:0,plan:{}}],keys=new Set();c.combatData.a.hp=1;c.activeGrapples=[];
  win.LuminousCombatStepRuntime.restoreExecution(queue,keys,saved);
  assert.equal(c.combatData.a.hp,80);assert.equal(queue[0].slot,liveSlot);assert.equal(queue[0]._onUseStatusApplied,true);
  assert.equal(c.combatData.a.reactiveDefense.evade.entry.slot,liveSlot);assert.ok(keys.has('a:0'));
  assert.equal(c.activeGrapples[0].id,'grapple');assert.equal(c.grappleSerial,4);
}
console.log('Phase 2: ordered/duplicate/late delivery, checkpoint resume, fail-closed schema and presentation-only replay passed');
