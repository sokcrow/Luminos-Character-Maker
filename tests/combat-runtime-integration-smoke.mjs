import assert from 'node:assert/strict';

await import('../js/combat-action-schema.js');
const schema = globalThis.LuminousCombatAction;
await import('../js/combat-action-adapters.js');
const adapters = globalThis.LuminousCombatActionAdapters;
await import('../js/combat-action-engine-bridge.js');
const bridge = globalThis.LuminousCombatActionEngineBridge;
await import('../js/combat-action-queue.js');
const queue = globalThis.LuminousCombatActionQueue;
await import('../js/team-action-economy.js');
const economy = globalThis.LuminousTeamActionEconomy;
await import('../js/combat-action-resolver.js');
const resolver = globalThis.LuminousCombatActionResolver;
await import('../js/combat-runtime-integration.js');
const runtimeApi = globalThis.LuminousCombatRuntimeIntegration;
if (!schema || !adapters || !bridge || !queue || !economy || !resolver || !runtimeApi) throw new Error('Combat runtime modules were not initialized.');

let clashCalls = 0;
let attackCalls = 0;
const attackTargets = [];
const engine = {
  calculateFinalPower(skill, heads) { return Number(skill.basePower || 0) + Number(heads || 0); },
  resolveStandardClash() {
    clashCalls++;
    return { winner:'A', clashLogs:[{}], mitigationPenalty:0 };
  },
  resolveUnilateralWithCounter(attacker, skill, defender, counter, options) {
    attackCalls++;
    attackTargets.push(defender.id);
    defender.hp = Math.max(0, Number(defender.hp ?? 20) - 4);
    if (defender.id === 'e1') defender.isStaggered = true;
    return { damageTaken:4, options };
  },
  resolveSpell() { return { isSuccess:false }; },
  getCoinProbability() { return 50; },
};

// Full round: turn-start Speed snapshot, Quick Action, Planning, Clash, Stagger cancellation,
// Prepared Reaction, Combat hooks, Turn End and next-round Speed refresh.
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
const prepared = adapters.compileReactionToCombatAction(p2, { id:'prepared_watch', sourceType:'trait' }, { mode:'prepared', trigger:{type:'before_action'} });

assert.equal(runtimeApi.registerAction(runtime,p1a1).registered,true);
assert.equal(runtimeApi.registerAction(runtime,p1a2).registered,true);
assert.equal(runtimeApi.registerAction(runtime,p2a1).registered,true);
assert.equal(runtimeApi.registerAction(runtime,retreat).registered,true);
assert.equal(runtimeApi.registerAction(runtime,prepared).preparedReaction,true);

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

const denied = runtimeApi.linkClash(runtime,p2a1.id,e1a1.id);
assert.equal(denied.linked,false);
assert.equal(denied.reason,'insufficient_speed_to_force_clash');
const linked = runtimeApi.linkClash(runtime,p1a1.id,e1a1.id);
assert.equal(linked.linked,true);

runtimeApi.aiPlanningReady(runtime);
assert.equal(runtime.phase, schema.PHASES.COMBAT_START);
let combatStartHooks = 0;
let combatEndHooks = 0;
const started = runtimeApi.beginCombatPhase(runtime,{onCombatStart:()=>combatStartHooks++});
assert.equal(started.started,true);
assert.equal(combatStartHooks,1);
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
let reactionUses = 0;
const combat = runtimeApi.resolveCombatPhase(runtime,{
  engine,
  resourceHandlers,
  consumeReaction:()=>{reactionUses++;return {consumed:true};},
  onCombatEnd:()=>combatEndHooks++,
});
assert.equal(combat.completed,true);
assert.equal(runtime.phase,schema.PHASES.COMBAT_END);
assert.equal(combatEndHooks,1);
assert.equal(reactionUses,1);
assert.equal(runtime.actionMap[prepared.id].state,'resolved');
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

// Action Slot ownership: an Action requires a slot; the same slot cannot hold two Actions,
// and a Unit cannot plan more Actions than its usable slot count.
const slotUser = {id:'slot_user',faction:'allies',speed:5,hp:10,activeSlots:1};
const slotEnemy = {id:'slot_enemy',faction:'enemies',speed:4,hp:10};
const slotRuntime = runtimeApi.createRuntime({units:[slotUser,slotEnemy],random:()=>0.5});
runtimeApi.beginTurn(slotRuntime);
const noSlot = adapters.compileSkillToCombatAction(slotUser,{id:'no_slot',isClashable:false},{targetId:'slot_enemy'});
assert.equal(runtimeApi.registerAction(slotRuntime,noSlot).reason,'action_slot_required');
const slotOne = adapters.compileSkillToCombatAction(slotUser,{id:'slot_one',isClashable:false},{actionSlotId:'slot_user_slot_0',targetId:'slot_enemy'});
assert.equal(runtimeApi.registerAction(slotRuntime,slotOne).registered,true);
const duplicateSlot = adapters.compileSkillToCombatAction(slotUser,{id:'duplicate_slot',isClashable:false},{actionSlotId:'slot_user_slot_0',targetId:'slot_enemy'});
assert.equal(runtimeApi.registerAction(slotRuntime,duplicateSlot).reason,'action_slot_already_used');
const overCap = adapters.compileSkillToCombatAction(slotUser,{id:'over_cap',isClashable:false},{actionSlotId:'slot_user_slot_1',targetId:'slot_enemy'});
assert.equal(runtimeApi.registerAction(slotRuntime,overCap).reason,'no_usable_action_slots');

// Runtime automatically enables Coin-by-Coin Unfocused Volley resolution.
const volleyUser = {id:'volley_user',faction:'allies',speed:9,hp:20,activeSlots:1};
const volleyA = {id:'volley_a',faction:'enemies',speed:4,hp:20};
const volleyB = {id:'volley_b',faction:'enemies',speed:3,hp:20};
const volleyRuntime = runtimeApi.createRuntime({units:[volleyUser,volleyA,volleyB],random:()=>0});
runtimeApi.beginTurn(volleyRuntime);
const volleyAction = adapters.compileSkillToCombatAction(volleyUser,{
  id:'runtime_unfocused',basePower:2,coinPower:1,coinAmount:3,coins:[{},{},{}],targetingType:'Unfocused Volley',isClashable:false,
},{actionSlotId:'volley_user_slot_0',targetId:'volley_a'});
assert.equal(runtimeApi.registerAction(volleyRuntime,volleyAction).registered,true);
runtimeApi.playerPlanningReady(volleyRuntime);
runtimeApi.aiPlanningReady(volleyRuntime);
runtimeApi.beginCombatPhase(volleyRuntime);
const beforeVolleyLog = attackTargets.length;
const volleyResult = runtimeApi.resolveCombatPhase(volleyRuntime,{engine});
assert.equal(volleyResult.completed,true);
assert.deepEqual(attackTargets.slice(beforeVolleyLog),['volley_a','volley_b','volley_a']);

// Grapple success cancels all unresolved target Actions and locks exactly one slot on each participant.
const grappler = {id:'grappler',faction:'allies',speed:9,hp:20,initialActionSlots:1,maxActionSlots:2};
const victim = {id:'victim',faction:'enemies',speed:5,hp:20,initialActionSlots:2,maxActionSlots:2};
const grappleEncounter = economy.createEncounter({allies:[grappler],enemies:[victim],enemiesOptions:{roundGrowthEnabled:false}});
const grappleRuntime = runtimeApi.createRuntime({units:[grappler,victim],encounter:grappleEncounter,random:()=>0.5});
runtimeApi.beginTurn(grappleRuntime);
const grappleAction = adapters.compileUniversalAction(grappler,'grapple',{actionSlotId:'grappler_slot_0',targetId:'victim'});
assert.equal(runtimeApi.registerAction(grappleRuntime,grappleAction).registered,true);
runtimeApi.playerPlanningReady(grappleRuntime);
const victimAction1 = adapters.compileSkillToCombatAction(victim,{id:'victim_one',isClashable:false},{actionSlotId:'victim_slot_0',targetId:'grappler',isAi:true});
const victimAction2 = adapters.compileSkillToCombatAction(victim,{id:'victim_two',isClashable:false},{actionSlotId:'victim_slot_1',targetId:'grappler',isAi:true});
assert.equal(runtimeApi.registerAction(grappleRuntime,victimAction1).registered,true);
assert.equal(runtimeApi.registerAction(grappleRuntime,victimAction2).registered,true);
runtimeApi.aiPlanningReady(grappleRuntime);
runtimeApi.beginCombatPhase(grappleRuntime);
const grappleCombat = runtimeApi.resolveCombatPhase(grappleRuntime,{engine,contestResolver:()=>({success:true})});
assert.equal(grappleCombat.completed,true);
assert.equal(grappleRuntime.actionMap[victimAction1.id].state,'cancelled');
assert.equal(grappleRuntime.actionMap[victimAction2.id].state,'cancelled');
const grappleSnapshot = economy.snapshot(grappleEncounter);
assert.equal(grappleSnapshot.allies.active.find(x=>x.id==='grappler').statusLocked,1);
assert.equal(grappleSnapshot.enemies.active.find(x=>x.id==='victim').statusLocked,1);

// Retreat with a Backup swaps the active Unit at Turn End and inherits at most two slots.
const outgoing = {id:'outgoing',faction:'allies',speed:8,hp:20,initialActionSlots:2,currentActionSlots:2,maxActionSlots:3};
const backup = {id:'backup',faction:'allies',speed:6,hp:20,initialActionSlots:1,maxActionSlots:3};
const retreatEnemy = {id:'retreat_enemy',faction:'enemies',speed:3,hp:20,initialActionSlots:1,maxActionSlots:1};
const retreatEncounter = economy.createEncounter({allies:[outgoing],allyBackups:[backup],enemies:[retreatEnemy],enemiesOptions:{roundGrowthEnabled:false}});
const retreatRuntime = runtimeApi.createRuntime({units:[outgoing,retreatEnemy],encounter:retreatEncounter,random:()=>0.5});
runtimeApi.beginTurn(retreatRuntime);
const realRetreat = adapters.compileUniversalAction(outgoing,'retreat',{actionSlotId:'outgoing_slot_0'});
assert.equal(runtimeApi.registerAction(retreatRuntime,realRetreat).registered,true);
runtimeApi.playerPlanningReady(retreatRuntime);
runtimeApi.aiPlanningReady(retreatRuntime);
runtimeApi.beginCombatPhase(retreatRuntime);
assert.equal(runtimeApi.resolveCombatPhase(retreatRuntime,{engine}).completed,true);
const retreatEnd = runtimeApi.resolveTurnEnd(retreatRuntime,{engine});
assert.equal(retreatEnd.completed,true);
assert.ok(retreatRuntime.units.some(unit=>unit.id==='backup'));
assert.ok(!retreatRuntime.units.some(unit=>unit.id==='outgoing'));
assert.equal(retreatEncounter.allies.active[0].id,'backup');
assert.ok(retreatEncounter.allies.active[0].currentActionSlots<=2);
assert.ok(retreatEncounter.allies.backups.some(profile=>profile.id==='outgoing'));

// Escape permanently removes the Unit from active encounter play and makes it XP-ineligible.
const escaper = {id:'escaper',faction:'allies',speed:7,hp:20,initialActionSlots:1,maxActionSlots:1};
const escapeEnemy = {id:'escape_enemy',faction:'enemies',speed:2,hp:20,initialActionSlots:1,maxActionSlots:1};
const escapeEncounter = economy.createEncounter({allies:[escaper],enemies:[escapeEnemy],enemiesOptions:{roundGrowthEnabled:false}});
const escapeRuntime = runtimeApi.createRuntime({units:[escaper,escapeEnemy],encounter:escapeEncounter,random:()=>0.5});
runtimeApi.beginTurn(escapeRuntime);
const escapeAction = adapters.compileUniversalAction(escaper,'escape',{actionSlotId:'escaper_slot_0'});
assert.equal(runtimeApi.registerAction(escapeRuntime,escapeAction).registered,true);
runtimeApi.playerPlanningReady(escapeRuntime);
runtimeApi.aiPlanningReady(escapeRuntime);
runtimeApi.beginCombatPhase(escapeRuntime);
assert.equal(runtimeApi.resolveCombatPhase(escapeRuntime,{engine}).completed,true);
const escapeEnd = runtimeApi.resolveTurnEnd(escapeRuntime,{engine});
assert.equal(escapeEnd.completed,true);
assert.equal(escaper.escaped,true);
assert.equal(escaper.eligibleForXp,false);
assert.ok(!escapeEncounter.allies.active.some(profile=>profile.id==='escaper'));
assert.equal(runtimeApi.isUnitActive(escapeRuntime,escaper),false);

console.log('combat-runtime-integration smoke: ok');
