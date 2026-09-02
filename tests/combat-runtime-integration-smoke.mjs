import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const schema = require('../js/combat-action-schema.js');
globalThis.LuminousCombatAction = schema;
const adapters = require('../js/combat-action-adapters.js');
globalThis.LuminousCombatActionAdapters = adapters;
const bridge = require('../js/combat-action-engine-bridge.js');
globalThis.LuminousCombatActionEngineBridge = bridge;
const queue = require('../js/combat-action-queue.js');
globalThis.LuminousCombatActionQueue = queue;
const resolver = require('../js/combat-action-resolver.js');
globalThis.LuminousCombatActionResolver = resolver;
const runtimeApi = require('../js/combat-runtime-integration.js');

let clashCalls = 0;
let attackCalls = 0;
const engine = {
  calculateFinalPower(skill, heads) { return Number(skill.basePower || 0) + Number(heads || 0); },
  resolveStandardClash() {
    clashCalls++;
    return { winner:'A', clashLogs:[{}], mitigationPenalty:0 };
  },
  resolveUnilateralWithCounter(attacker, skill, defender, counter, options) {
    attackCalls++;
    defender.hp = Math.max(0, Number(defender.hp ?? 20) - 4);
    if (defender.id === 'e1') defender.isStaggered = true;
    return { damageTaken:4, options };
  },
  resolveSpell() { return { isSuccess:false }; },
  getCoinProbability() { return 50; },
};

const p1 = { id:'p1', faction:'allies', speed:8, hp:20, sp:0 };
const p2 = { id:'p2', faction:'allies', speed:5, hp:20, sp:0 };
const e1 = { id:'e1', faction:'enemies', speed:7, hp:20, sp:0 };
const e2 = { id:'e2', faction:'enemies', speed:4, hp:20, sp:0 };
const units = [p1,p2,e1,e2];
let randomIndex = 0;
const randomValues = [0.3,0.8,0.2,0.6,0.4,0.7,0.1,0.9];
const runtime = runtimeApi.createRuntime({ units, random:()=>randomValues[randomIndex++ % randomValues.length] });

runtimeApi.beginTurn(runtime);
assert.equal(runtime.phase, schema.PHASES.PLANNING_PHASE_PLAYER);
assert.equal(runtime.speedSnapshot[queue.speedSourceKey('p1',null)].speed, 8);

// Speed is frozen at ON_TURN_START; later mutation cannot change this round's order.
p1.speed = 1;

let quickUses = 0;
const quick = schema.createCombatAction({
  actorId:'p2', source:{type:'trait',id:'quick_ping'},
  economy:{cost:'quick_action'},
  phase:{selectedAt:'planning_phase_player',executesAt:'planning_phase_player'},
  targeting:{mode:'single',allegiance:'enemy',mainTargetId:'e2',targetIds:['e2']},
  resolution:{type:'unopposed'},
  metadata:{sourceDefinition:{id:'quick_ping',basePower:2,coinAmount:1,coins:[{}]}},
});
const quickResult = runtimeApi.registerAction(runtime, quick, { context:{ engine, consumeQuickAction:()=>{ quickUses++; return {consumed:true}; } } });
assert.equal(quickResult.immediate, true);
assert.equal(quickResult.result.resolved, true);
assert.equal(quickUses, 1);

const p1a1 = adapters.compileSkillToCombatAction(p1, {
  id:'p1_slash', basePower:4, coinPower:2, coinAmount:1, isClashable:true,
  resourceCosts:[{type:'trait_use',id:'p1_cost',amount:1}],
}, { actionSlotId:'p1_slot_0', targetId:'e1' });
const p1a2 = adapters.compileSkillToCombatAction(p1, {
  id:'p1_follow', basePower:3, coinPower:1, coinAmount:1, isClashable:true,
}, { actionSlotId:'p1_slot_1', targetId:'e2' });
const p2a1 = adapters.compileSkillToCombatAction(p2, {
  id:'p2_intercept', basePower:3, coinPower:1, coinAmount:1, isClashable:true,
}, { actionSlotId:'p2_slot_0', targetId:'e1' });
const retreat = adapters.compileUniversalAction(p2, 'retreat', { actionSlotId:'p2_slot_1' });

assert.equal(runtimeApi.registerAction(runtime,p1a1).registered,true);
assert.equal(runtimeApi.registerAction(runtime,p1a2).registered,true);
assert.equal(runtimeApi.registerAction(runtime,p2a1).registered,true);
assert.equal(runtimeApi.registerAction(runtime,retreat).registered,true);

runtimeApi.playerPlanningReady(runtime);
assert.equal(runtime.phase, schema.PHASES.PLANNING_PHASE_AI);

const e1a1 = adapters.compileSkillToCombatAction(e1, {
  id:'e1_hit', basePower:3, coinPower:1, coinAmount:1, isClashable:true,
  resourceCosts:[{type:'trait_use',id:'e1_cost',amount:1}],
}, { actionSlotId:'e1_slot_0', targetId:'p1', isAi:true });
const e1a2 = adapters.compileSkillToCombatAction(e1, {
  id:'e1_second', basePower:3, coinPower:1, coinAmount:1, isClashable:true,
}, { actionSlotId:'e1_slot_1', targetId:'p2', isAi:true });
const e2a1 = adapters.compileSkillToCombatAction(e2, {
  id:'e2_hit', basePower:2, coinPower:1, coinAmount:1, isClashable:true,
}, { actionSlotId:'e2_slot_0', targetId:'p2', isAi:true });
assert.equal(runtimeApi.registerAction(runtime,e1a1).registered,true);
assert.equal(runtimeApi.registerAction(runtime,e1a2).registered,true);
assert.equal(runtimeApi.registerAction(runtime,e2a1).registered,true);

// p2 is not e1a1's target and is slower (5 < 7), so it cannot steal the clash.
const denied = runtimeApi.linkClash(runtime,p2a1.id,e1a1.id);
assert.equal(denied.linked,false);
assert.equal(denied.reason,'insufficient_speed_to_force_clash');

// p1 is the declared target, so it can clash regardless of speed; its frozen speed remains 8 anyway.
const linked = runtimeApi.linkClash(runtime,p1a1.id,e1a1.id);
assert.equal(linked.linked,true);

runtimeApi.aiPlanningReady(runtime);
assert.equal(runtime.phase, schema.PHASES.COMBAT_START);
const started = runtimeApi.beginCombatPhase(runtime);
assert.equal(started.started,true);
assert.equal(runtime.phase,schema.PHASES.COMBAT_PHASE);
assert.equal(runtime.queue.getSpeed('p1'),8);
assert.equal(runtime.queue.entries[0].actorId,'p1');

const resourceLog = [];
const resourceHandlers = {
  trait_use:{
    validate:()=>({available:true}),
    consume:({resource})=>{resourceLog.push(resource.id);return {consumed:true};},
  },
};
const combat = runtimeApi.resolveCombatPhase(runtime,{ engine, resourceHandlers });
assert.equal(combat.completed,true);
assert.equal(runtime.phase,schema.PHASES.COMBAT_END);
assert.equal(clashCalls,1);
assert.ok(resourceLog.includes('p1_cost'));
assert.ok(resourceLog.includes('e1_cost'));
assert.equal(runtime.actionMap[e1a2.id].state,'cancelled');
assert.equal(runtime.actionMap[e1a2.id].cancelReason.type,'stagger');
assert.ok(runtime.resolvedActionIds.has(e1a2.id));

let retreated = false;
const end = runtimeApi.resolveTurnEnd(runtime,{
  engine,
  effectHandlers:{ retreat:()=>{retreated=true;return {swapped:true};} },
});
assert.equal(end.completed,true);
assert.equal(runtime.phase,schema.PHASES.ON_TURN_END);
assert.equal(retreated,true);

const next = runtimeApi.nextRound(runtime);
assert.equal(next.started,true);
assert.equal(runtime.round,2);
assert.equal(runtime.phase,schema.PHASES.PLANNING_PHASE_PLAYER);
assert.equal(runtime.speedSnapshot[queue.speedSourceKey('p1',null)].speed,1);

console.log('combat-runtime-integration smoke: ok');
