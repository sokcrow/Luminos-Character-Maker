import assert from 'node:assert/strict';

await import('../js/combat-action-schema.js');
const schema = globalThis.LuminousCombatAction;
await import('../js/combat-action-adapters.js');
const adapters = globalThis.LuminousCombatActionAdapters;
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
const queue = globalThis.LuminousCombatActionQueue;
await import('../js/team-action-economy.js');
const economy = globalThis.LuminousTeamActionEconomy;
await import('../js/combat-action-resolver.js');
await import('../js/combat-runtime-integration.js');
const runtimeApi = globalThis.LuminousCombatRuntimeIntegration;

const engine = {
  calculateFinalPower(skill, heads) { return Number(skill.basePower || 0) + Number(heads || 0); },
  resolveUnilateralWithCounter(attacker, skill, defender) {
    defender.hp = Math.max(0, Number(defender.hp ?? 20) - 1);
    return { damageTaken:1 };
  },
  resolveStandardClash() { return { winner:'A', clashLogs:[], mitigationPenalty:0 }; },
  resolveSpell() { return { isSuccess:false }; },
  getCoinProbability() { return 50; },
};

// Runtime owns the default one-Quick-per-side budget when no TeamActionEconomy encounter exists.
const quickUser = {id:'quick_user',faction:'allies',speed:8,hp:20};
const quickEnemy = {id:'quick_enemy',faction:'enemies',speed:4,hp:20};
const quickRuntime = runtimeApi.createRuntime({units:[quickUser,quickEnemy],random:()=>0.5});
runtimeApi.beginTurn(quickRuntime);
const makeQuick = (id) => schema.createCombatAction({
  actorId:'quick_user',source:{type:'trait',id},economy:{cost:'quick_action'},
  phase:{selectedAt:'planning_phase_player',executesAt:'planning_phase_player'},
  targeting:{mode:'single',allegiance:'enemy',mainTargetId:'quick_enemy',targetIds:['quick_enemy']},
  resolution:{type:'unopposed'},metadata:{sourceDefinition:{id,basePower:1,coinAmount:1,coins:[{}]}},
});
const q1 = runtimeApi.registerAction(quickRuntime,makeQuick('q1'),{context:{engine}});
const q2 = runtimeApi.registerAction(quickRuntime,makeQuick('q2'),{context:{engine}});
assert.equal(q1.result.resolved,true);
assert.equal(q2.result.resolved,false);
assert.equal(q2.result.reason,'team_quick_action_spent');
assert.equal(quickRuntime.teamResources.allies.quickActionRemaining,0);

// Prepared Reactions use the runtime's one-Reaction-per-Unit budget and resolve only once.
const reactor = {id:'reactor',faction:'allies',speed:7,hp:20,activeSlots:1};
const reactionEnemy = {id:'reaction_enemy',faction:'enemies',speed:3,hp:20};
const reactionRuntime = runtimeApi.createRuntime({units:[reactor,reactionEnemy],random:()=>0.5});
runtimeApi.beginTurn(reactionRuntime);
const prepared = adapters.compileReactionToCombatAction(reactor,{id:'watch',sourceType:'trait'},{mode:'prepared',trigger:{type:'before_action'}});
assert.equal(runtimeApi.registerAction(reactionRuntime,prepared).registered,true);
const hit = adapters.compileSkillToCombatAction(reactor,{id:'hit',isClashable:false,coinAmount:1,coins:[{}]},{actionSlotId:'reactor_slot_0',targetId:'reaction_enemy'});
assert.equal(runtimeApi.registerAction(reactionRuntime,hit).registered,true);
runtimeApi.playerPlanningReady(reactionRuntime);
runtimeApi.aiPlanningReady(reactionRuntime);
runtimeApi.beginCombatPhase(reactionRuntime);
assert.equal(runtimeApi.resolveCombatPhase(reactionRuntime,{engine}).completed,true);
assert.equal(reactionRuntime.actionMap[prepared.id].state,'resolved');
assert.equal(reactionRuntime.reactionRemaining.reactor,0);
assert.equal(reactionRuntime.history.filter(entry=>entry.type==='reactions_resolved').length,1);

// Retreat without Backup removes the Unit from encounter.active for exactly the following round,
// does not redistribute it as a Backup swap, and restores the same profile for the next round after that.
const runner = {id:'runner',faction:'allies',speed:9,hp:20,initialActionSlots:1,maxActionSlots:2};
const guard = {id:'guard',faction:'enemies',speed:3,hp:20,initialActionSlots:1,maxActionSlots:1};
const encounter = economy.createEncounter({allies:[runner],enemies:[guard],enemiesOptions:{roundGrowthEnabled:false}});
const retreatRuntime = runtimeApi.createRuntime({units:[runner,guard],encounter,random:()=>0.5});
runtimeApi.beginTurn(retreatRuntime);
const retreat = adapters.compileUniversalAction(runner,'retreat',{actionSlotId:'runner_slot_0'});
assert.equal(runtimeApi.registerAction(retreatRuntime,retreat).registered,true);
runtimeApi.playerPlanningReady(retreatRuntime);
runtimeApi.aiPlanningReady(retreatRuntime);
runtimeApi.beginCombatPhase(retreatRuntime);
assert.equal(runtimeApi.resolveCombatPhase(retreatRuntime,{engine}).completed,true);
assert.equal(runtimeApi.resolveTurnEnd(retreatRuntime,{engine}).completed,true);
assert.equal(runner.combatAbsentThroughRound,2);
assert.ok(!encounter.allies.active.some(profile=>profile.id==='runner'));
assert.equal(retreatRuntime.retreatReserve.length,1);

const round2 = runtimeApi.nextRound(retreatRuntime);
assert.equal(round2.round,2);
assert.equal(runtimeApi.isUnitActive(retreatRuntime,runner),false);
assert.ok(!encounter.allies.active.some(profile=>profile.id==='runner'));
assert.equal(retreatRuntime.speedSnapshot[queue.speedSourceKey('runner',null)],undefined);

runtimeApi.playerPlanningReady(retreatRuntime);
runtimeApi.aiPlanningReady(retreatRuntime);
runtimeApi.beginCombatPhase(retreatRuntime);
assert.equal(runtimeApi.resolveCombatPhase(retreatRuntime,{engine}).completed,true);
assert.equal(runtimeApi.resolveTurnEnd(retreatRuntime,{engine}).completed,true);
const round3 = runtimeApi.nextRound(retreatRuntime);
assert.equal(round3.round,3);
assert.equal(runtimeApi.isUnitActive(retreatRuntime,runner),true);
assert.ok(encounter.allies.active.some(profile=>profile.id==='runner'));
assert.ok(retreatRuntime.speedSnapshot[queue.speedSourceKey('runner',null)]);
assert.equal(retreatRuntime.retreatReserve.length,0);

console.log('combat-runtime-rules smoke: ok');
