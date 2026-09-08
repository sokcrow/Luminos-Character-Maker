import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const calls = { clash: 0, unilateral: 0 };
globalThis.CombatEngine = {
  calculateFinalPower() { return 10; },
  getCoinProbability() { return 50; },
  resolveStandardClash(a, skillA, b, skillB) {
    calls.clash += 1;
    assert.equal(a.id, 'ally');
    assert.equal(b.id, 'enemy');
    assert.equal(skillA.name, 'Ally Cut');
    assert.equal(skillB.name, 'Enemy Cut');
    return { winner: 'A', clashLogs: [], mitigationPenalty: 0 };
  },
  resolveUnilateralWithCounter(attacker, skill, defender) {
    calls.unilateral += 1;
    return { attackerId: attacker.id, defenderId: defender.id, skill: skill.name, damage: 1 };
  },
};

globalThis.combatData = {
  ally: { id: 'ally', name: 'Ally', faction: 'ally', controlled: 'player', hp: 100, sp: 0, speed: 6 },
  enemy: { id: 'enemy', name: 'Enemy', faction: 'enemy', controlled: 'ai', hp: 100, sp: 0, speed: 4 },
};
globalThis.slotTargets = {
  ally_slot_0: 'enemy_slot_0',
  enemy_slot_0: 'ally_slot_0',
};
globalThis.attackVectors = {
  ally_slot_0: {
    target: 'enemy_slot_0',
    skill: { id: 'ally_cut', kind: 'skill', name: 'Ally Cut', basePower: 4, coinPower: 2, coinAmount: 1, damageType: 'Slash' },
  },
  enemy_slot_0: {
    target: 'ally_slot_0',
    skill: { id: 'enemy_cut', kind: 'skill', name: 'Enemy Cut', basePower: 3, coinPower: 2, coinAmount: 1, damageType: 'Slash' },
  },
};
globalThis.sharedPlannedActions = {};
globalThis.executeCombatTimeline = function legacyTimelineMustDisappear() {
  throw new Error('legacy timeline executed');
};
globalThis.__luminousLegacyExecuteCombatTimeline = globalThis.executeCombatTimeline;

const runtime = require('../js/battle-viewer-runtime-073.js');
assert.equal(runtime.authority, 'combat-action-runtime');
assert.equal(globalThis.__luminousCombatTimelineAuthority, 'v0.7.3-combat-action-runtime');
assert.equal(globalThis.__luminousLegacyExecuteCombatTimeline, undefined, 'legacy timeline backup must not survive installation');
assert.equal(globalThis.executeCombatTimeline, runtime.executeCombatTimeline, 'viewer must expose one timeline authority');
assert.ok(globalThis.LuminousCombatActionResolver?.resolveCombatAction, 'canonical CombatAction resolver must be loaded');
assert.ok(globalThis.LuminousCombatRuntimeIntegration?.resolveQueueEntry, 'canonical combat runtime must be loaded');
assert.ok(globalThis.LuminousBattleViewerActionAdapter073?.compilePlan, 'viewer plan adapter must be loaded');

const events = runtime.buildEvents();
assert.equal(events.length, 1);
assert.equal(events[0].type, 'clash');
assert.equal(events[0].action.source.type, 'skill');
assert.equal(events[0].action.actorId, 'ally');
assert.equal(events[0].opposingAction.actorId, 'enemy');

const results = await runtime.runTimeline(events);
assert.equal(results.length, 1);
assert.equal(results[0].resolved, true);
assert.equal(results[0].result.type, 'clash');
assert.equal(calls.clash, 1, 'CombatEngine clash should be reached through CombatAction resolver exactly once');
assert.equal(calls.unilateral, 1, 'winning Clash action should resolve its hit through the canonical resolver');

// selectedSkill was the legacy hidden fallback. A targeting vector without a planned
// CombatAction/plan must now fail loudly instead of inventing a Skill from the unit.
globalThis.combatData.ally.selectedSkill = { id: 'legacy_ghost', name: 'Legacy Ghost', basePower: 99, coinPower: 99, coinAmount: 1 };
globalThis.slotTargets = { ally_slot_0: 'enemy_slot_0' };
globalThis.attackVectors = { ally_slot_0: { target: 'enemy_slot_0' } };
const missing = runtime.buildEvents();
assert.equal(missing.length, 1);
assert.equal(missing[0].action, null);
const missingResult = await runtime.resolveEvent(missing[0]);
assert.equal(missingResult.resolved, false);
assert.equal(missingResult.reason, 'combat_action_missing');
assert.equal(calls.clash, 1);
assert.equal(calls.unilateral, 1);

console.log('combat v0.7.3 runtime authority smoke: ok');
