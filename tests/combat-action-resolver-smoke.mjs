import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const schema = require('../js/combat-action-schema.js');
globalThis.LuminousCombatAction = schema;
const adapters = require('../js/combat-action-adapters.js');
globalThis.LuminousCombatActionAdapters = adapters;
const bridge = require('../js/combat-action-engine-bridge.js');
globalThis.LuminousCombatActionEngineBridge = bridge;
const resolver = require('../js/combat-action-resolver.js');

let clashCalls = 0;
let attackCalls = 0;
const engine = {
  calculateFinalPower(skill, heads) { return Number(skill.basePower || 0) + Number(heads || 0); },
  resolveStandardClash() { clashCalls++; return { winner: 'A', clashLogs: [{}, {}], mitigationPenalty: 0 }; },
  resolveUnilateralWithCounter(attacker, skill, defender, counter, options) {
    attackCalls++;
    defender.hp = (defender.hp ?? 20) - 3;
    return { damageTaken: 3, attackLogs: [{ target: defender.id }], options, bonus: skill.__combatActionFinalPowerBonus || 0 };
  },
  resolveSpell(spell, target, heads) { return { isSuccess: target.id === 'e2', dc: spell.saveDC, heads }; },
  getCoinProbability() { return 50; },
};

const a = { id:'a', faction:'allies', hp:20, sp:0 };
const b = { id:'b', faction:'enemies', hp:20, sp:0 };
const e2 = { id:'e2', faction:'enemies', hp:20, sp:0 };
const units = [a,b,e2];
const resourceLog = [];
const resourceHandlers = {
  trait_use: {
    validate: () => ({ available:true }),
    consume: ({resource}) => { resourceLog.push(resource.id); return { consumed:true }; },
  }
};
const common = { phase:'combat_phase', units, engine, resourceHandlers, random: () => 0 };

bridge.installCombatActionPowerBridge(engine);
assert.equal(engine.calculateFinalPower({basePower:4,__combatActionFinalPowerBonus:1}, 2), 7);

const actionA = adapters.compileSkillToCombatAction(a, { id:'slash', basePower:4, coinPower:2, coinAmount:1, attackWeight:2, isClashable:true, resourceCosts:[{type:'trait_use',id:'useA',amount:1}] }, { targetId:'b', targetIds:['b','e2'] });
const actionB = adapters.compileSkillToCombatAction(b, { id:'guard_hit', basePower:3, coinPower:2, coinAmount:1, isClashable:true, resourceCosts:[{type:'trait_use',id:'useB',amount:1}] }, { targetId:'a', isAi:true });
const clash = resolver.resolveCombatAction(actionA, { ...common, opposingAction: actionB });
assert.equal(clash.resolved, true);
assert.equal(clash.type, 'clash');
assert.equal(clash.winner, 'A');
assert.deepEqual(resourceLog.sort(), ['useA','useB']);
assert.equal(clashCalls, 1);
assert.equal(attackCalls, 2);
assert.deepEqual(clash.resolvedActionIds.sort(), [actionA.id, actionB.id].sort());

clashCalls = 0; attackCalls = 0;
b.isStaggered = true;
const staggerA = adapters.compileSkillToCombatAction(a, { id:'s2', basePower:4, coinAmount:1, attackWeight:1, isClashable:true }, { targetId:'b' });
const staggerB = adapters.compileSkillToCombatAction(b, { id:'s3', basePower:4, coinAmount:1, isClashable:true }, { targetId:'a', isAi:true });
const staggerResult = resolver.resolveCombatAction(staggerA, { ...common, opposingAction: staggerB });
assert.equal(staggerResult.resolved, true);
assert.equal(staggerResult.type, 'unopposed');
assert.equal(staggerResult.actions[1].state, 'cancelled');
assert.equal(clashCalls, 0);
assert.equal(attackCalls, 1);
b.isStaggered = false;

const save = adapters.compileSpellToCombatAction(a, { id:'wave', slotLevel:0, saveAbility:'dexterity', targetType:'area', attackWeight:2 }, { saveDC:14, targetIds:['b','e2'] });
const saveResult = resolver.resolveCombatAction(save, common);
assert.equal(saveResult.resolved, true);
assert.equal(saveResult.resolution.results.length, 2);
assert.equal(saveResult.resolution.results[0].result.isSuccess, false);
assert.equal(saveResult.resolution.results[1].result.isSuccess, true);
assert.equal(schema.canReceiveHelp(save), false);

const targetAction = adapters.compileSkillToCombatAction(a, { id:'helped', isClashable:true }, { targetId:'b' });
const help = adapters.compileUniversalAction({id:'ally2',faction:'allies'}, 'help', { targetUnitId:'a', targetActionId:targetAction.id, targetActionSlotId:'a_slot_0' });
let helpBudget = 1;
const actionMap = { [targetAction.id]: targetAction };
const helpResult = resolver.resolveCombatAction(help, {
  ...common,
  units:[...units,{id:'ally2',faction:'allies',hp:10}],
  actionMap,
  consumeHelp: () => helpBudget-- > 0 ? {consumed:true} : {consumed:false,reason:'team_help_spent'}
});
assert.equal(helpResult.resolved, true);
assert.equal(actionMap[targetAction.id].modifiers.at(-1).type, 'final_power');
assert.equal(actionMap[targetAction.id].modifiers.at(-1).amount, 1);

const retreat = adapters.compileUniversalAction(a, 'retreat');
const tooEarly = resolver.resolveCombatAction(retreat, common);
assert.equal(tooEarly.pending, true);
const retreatResult = resolver.resolveCombatAction(retreat, {
  ...common,
  phase:'on_turn_end',
  effectHandlers:{ retreat: ({effect}) => ({ swapped:true, cap:effect.inheritActionSlotsCap }) }
});
assert.equal(retreatResult.resolved, true);
assert.equal(retreatResult.resolution.effects[0].result.cap, 2);

const checkAction = schema.createCombatAction({ actorId:'a', source:{type:'universal',id:'improvise'}, phase:{executesAt:'combat_phase'}, targeting:{mode:'self',allegiance:'self'}, resolution:{type:'check',check:{stat:'strength',threshold:12}} });
const checkResult = resolver.resolveCombatAction(checkAction, { ...common, checkResolver:()=>({pass:true,total:14}) });
assert.equal(checkResult.resolved, true);
assert.equal(checkResult.resolution.result.pass, true);

// A clash that degrades to unopposed must still validate and consume the active action's resources.
attackCalls = 0;
let allowFallbackResource = false;
let fallbackConsumes = 0;
const guardedHandlers = {
  trait_use: {
    validate: () => ({ available: allowFallbackResource, reason: allowFallbackResource ? null : 'no_resource' }),
    consume: () => { fallbackConsumes++; return { consumed:true }; },
  },
};
const fallbackA = adapters.compileSkillToCombatAction(a, { id:'fallback_a', basePower:4, coinAmount:1, resourceCosts:[{type:'trait_use',id:'fallback_cost',amount:1}] }, { targetId:'b' });
const fallbackB = adapters.compileSkillToCombatAction(b, { id:'fallback_b', basePower:3, coinAmount:1 }, { targetId:'a', isAi:true });
fallbackB.state = 'cancelled';
const blockedFallback = resolver.resolveCombatAction(fallbackA, { ...common, resourceHandlers:guardedHandlers, opposingAction:fallbackB });
assert.equal(blockedFallback.resolved, false);
assert.equal(blockedFallback.reason, 'no_resource');
assert.equal(attackCalls, 0);
assert.equal(fallbackConsumes, 0);

allowFallbackResource = true;
const fallbackA2 = adapters.compileSkillToCombatAction(a, { id:'fallback_a2', basePower:4, coinAmount:1, resourceCosts:[{type:'trait_use',id:'fallback_cost_2',amount:1}] }, { targetId:'b' });
const allowedFallback = resolver.resolveCombatAction(fallbackA2, { ...common, resourceHandlers:guardedHandlers, opposingAction:fallbackB });
assert.equal(allowedFallback.resolved, true);
assert.equal(allowedFallback.type, 'unopposed');
assert.equal(fallbackConsumes, 1);
assert.equal(attackCalls, 1);

console.log('combat-action-resolver smoke: ok');
