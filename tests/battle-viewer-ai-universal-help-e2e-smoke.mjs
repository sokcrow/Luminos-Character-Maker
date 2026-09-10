import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.window = globalThis;
globalThis.STATUS_REGISTRY = globalThis.STATUS_REGISTRY || {};
const engineSource = readFileSync(new URL('../js/combatEngine.js', import.meta.url), 'utf8');
vm.runInThisContext(engineSource, { filename: 'js/combatEngine.js' });

await import('../js/universal-action-economy.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/unit-ai-universal-actions.js');
await import('../js/unit-action-economy-catalog.js');
await import('../js/enemy-action-slot-allocator.js');
await import('../js/battle-viewer-action-adapter-073.js');
await import('../js/battle-viewer-runtime-073-timeline.js');
await import('../js/battle-viewer-enemy-planning-074.js');

const economy = globalThis.LuminousActionEconomy;
const goap = globalThis.LuminousIndividualGoapCombatAI;
const schema = globalThis.LuminousCombatAction;
const bridge = globalThis.LuminousBattleViewerEnemyPlanning074;
const timeline = globalThis.LuminousBattleViewerTimeline073;
if (!economy || !goap || !schema || !bridge || !timeline || !globalThis.CombatEngine) {
  throw new Error('Battle Viewer universal Help E2E dependencies were not initialized.');
}

function attackSkill(id, basePower, coinPower) {
  return {
    id,
    name: id,
    sourceType: 'skill',
    type: 'Attack',
    basePower,
    coinPower,
    coinAmount: 1,
    coinType: 'positive',
    attackWeight: 1,
    damageType: 'slash',
    sinAffinity: 'sinless',
    targetingType: 'Focused Attack',
    isDefense: false,
    isClashable: false,
    isUnclashable: true,
    resourceCosts: [],
    effects: [],
    coins: [{ index: 0, type: 'normal', status: 'active', effects: [] }],
  };
}

function aiUnit(id, speed, skill, intelligence = 14) {
  return {
    id,
    faction: 'enemy',
    faccion: 'enemy',
    hp: 30,
    maxHp: 30,
    sp: 0,
    speed,
    scores: { str: 8, int: intelligence, wis: 10 },
    resolvedSkills: [skill],
    actionSlots: 1,
    actionEconomy: { profileId: `${id}_test`, minSlots: 1, maxSlots: 1 },
    stats: {},
    statusEffects: {},
    shield: 0,
  };
}

const player = {
  id: 'real_player_target',
  faction: 'ally',
  faccion: 'ally',
  isPlayer: true,
  hp: 200,
  maxHp: 200,
  sp: 0,
  speed: 1,
  actionSlots: 1,
  stats: {},
  statusEffects: {},
  shield: 0,
  physRes: 1,
  sinRes: 1,
};

// The attacker commits first. The helper is deliberately slower and weak, so its GOAP can
// see only the already-committed allied action and prefer Help under GAIN_ADVANTAGE.
const attacker = aiUnit('ai_attacker', 2, attackSkill('strong_committed_strike', 10, 5), 12);
const helper = aiUnit('ai_helper', 1, attackSkill('weak_helper_strike', 1, 1), 16);
const units = [player, attacker, helper];
units.forEach((unit) => economy.beginPlanning(unit));

globalThis.combatData = Object.fromEntries(units.map((unit) => [unit.id, unit]));
globalThis.attackVectors = {};
globalThis.slotTargets = {};

const planning = bridge.runViewerPlanning({
  units,
  attackVectors: globalThis.attackVectors,
  slotTargets: globalThis.slotTargets,
  allocationOptions: { teamSlotCap: 2 },
  planOptions: {
    goal: goap.GOALS.GAIN_ADVANTAGE,
    allowEscape: false,
    allowGrapple: false,
    allowRetreat: false,
  },
  renderSlots: () => {},
});

assert.equal(planning.applied, true);
assert.equal(planning.result.allocation.totalSlots, 2);
assert.equal(planning.result.plans.length, 2);
const attackerPlan = planning.result.plans.find((entry) => entry.unitId === attacker.id)?.plan;
const helperPlan = planning.result.plans.find((entry) => entry.unitId === helper.id)?.plan;
assert.equal(attackerPlan.actions.length, 1);
assert.equal(attackerPlan.actions[0].source.id, 'strong_committed_strike');
assert.equal(helperPlan.actions.length, 1);
assert.equal(helperPlan.actions[0].source.id, 'help');
assert.equal(helperPlan.actions[0].effects[0].targetActionId, attackerPlan.actions[0].id);
assert.equal(helperPlan.actions[0].metadata.targetActionSlotId, 'ai_attacker_slot_0');
assert.equal(globalThis.attackVectors.ai_helper_slot_0.combatAction.source.id, 'help');
assert.equal(globalThis.attackVectors.ai_helper_slot_0.target, 'ai_attacker_slot_0');

const events = timeline.buildEvents();
assert.equal(events.length, 2);
const attackerEvent = events.find((event) => event.action?.source?.id === 'strong_committed_strike');
const helperEvent = events.find((event) => event.action?.source?.id === 'help');
assert.ok(attackerEvent && helperEvent);
assert.ok(attackerEvent.readyAt < helperEvent.readyAt, 'attacker starts faster so dependency ordering is actually exercised');
const deps = timeline.eventDependencies(events);
assert.equal(deps.get(attackerEvent.id).has(helperEvent.id), true, 'target attack must depend on its Help event');

const hpBefore = player.hp;
const results = await timeline.runTimeline(events);
const helpResult = results.find((row) => row.actionId === helperPlan.actions[0].id);
const attackResult = results.find((row) => row.actionId === attackerPlan.actions[0].id);
assert.equal(helpResult.resolved, true, helpResult.reason || 'Help should resolve through Viewer timeline');
assert.equal(helpResult.result.resolution.effects[0].applied, true, 'Help must find and modify the cross-event CombatAction');
assert.equal(attackResult.resolved, true, attackResult.reason || 'helped attack should resolve');
assert.ok(attackResult.event.action.modifiers.some((modifier) => modifier.type === 'final_power' && Number(modifier.amount) === 1), 'helped action should receive +1 Final Power before it resolves');
assert.ok(player.hp < hpBefore, `helped attack should still reach the real CombatEngine (${hpBefore} -> ${player.hp})`);

console.log('Battle Viewer AI Universal Help E2E smoke: ok');
