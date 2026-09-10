import assert from 'node:assert/strict';

await import('../js/combat-action-schema.js');
const schema = globalThis.LuminousCombatAction;
await import('../js/combat-action-adapters.js');
const adapters = globalThis.LuminousCombatActionAdapters;
await import('../js/individual-goap-combat-ai.js');
const goap = globalThis.LuminousIndividualGoapCombatAI;

if (!schema || !adapters || !goap) throw new Error('GOAP Grapple planning modules were not initialized.');

const aiPlanner = {
  id: 'ai_grappler',
  faction: 'enemies',
  hp: 20,
  maxHp: 20,
  scores: { str: 14, dex: 12, int: 10, wis: 10 },
};
const weakAttack = {
  sourceType: 'skill',
  definition: { id: 'light_poke', basePower: 1, coinPower: 0, coinAmount: 1, isClashable: false },
  estimate: { damage: 1, safety: 0, advantage: 0, risk: 0, resourceCost: 0 },
};

const hiddenStrongTarget = { id: 'player_strong_hidden', faction: 'allies', scores: { str: 20, dex: 18 }, proficiencies: { skills: { athletics: 'expertise', acrobatics: 'expertise' } } };
const hiddenWeakTarget = { id: 'player_weak_hidden', faction: 'allies', scores: { str: 6, dex: 6 }, proficiencies: { skills: {} } };

const strongHiddenPlan = goap.planTurn({
  actor: aiPlanner,
  sources: [weakAttack],
  targets: [hiddenStrongTarget],
  targetId: hiddenStrongTarget.id,
  slotIds: ['ai_grappler_slot_0', 'ai_grappler_slot_1'],
  goal: goap.GOALS.GAIN_ADVANTAGE,
  allowEscape: false,
});
const weakHiddenPlan = goap.planTurn({
  actor: aiPlanner,
  sources: [weakAttack],
  targets: [hiddenWeakTarget],
  targetId: hiddenWeakTarget.id,
  slotIds: ['ai_grappler_slot_0', 'ai_grappler_slot_1'],
  goal: goap.GOALS.GAIN_ADVANTAGE,
  allowEscape: false,
});

assert.equal(strongHiddenPlan.planned, true);
assert.equal(weakHiddenPlan.planned, true);
assert.deepEqual(
  strongHiddenPlan.sequence.map((entry) => entry.sourceId),
  weakHiddenPlan.sequence.map((entry) => entry.sourceId),
  'GOAP must not change Grapple preference by reading hidden target STR/DEX/proficiencies',
);
assert.equal(strongHiddenPlan.sequence.filter((entry) => entry.sourceId === 'grapple').length, 1, 'Grapple may be planned at most once per turn');
assert.equal(strongHiddenPlan.actions.filter((action) => action.source.id === 'grapple').length, 1);
assert.equal(strongHiddenPlan.actions.find((action) => action.source.id === 'grapple')?.targeting.mainTargetId, hiddenStrongTarget.id);
assert.equal(strongHiddenPlan.resourceSpent['turn_action:grapple'], 1);

// Runtime resolution is intentionally allowed to read the real sheets.
globalThis.LuminousStatusEngine = {
  applyStatus(unit, id, input = {}) {
    unit.statusEffects ||= {};
    const entry = { id, count: input.count ?? 1, sourceUnitId: input.sourceUnitId ?? null, data: { ...(input.data || {}) } };
    unit.statusEffects[id] = entry;
    return entry;
  },
  hasStatus(unit, id) { return Boolean(unit?.statusEffects?.[id]); },
  getStatus(unit, id) { return unit?.statusEffects?.[id] || null; },
  removeStatus(unit, id) {
    const existed = Boolean(unit?.statusEffects?.[id]);
    if (unit?.statusEffects) delete unit.statusEffects[id];
    return { removed: existed };
  },
};

await import('../js/core-condition-runtime.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
const resolver = globalThis.LuminousCombatActionResolver;
if (!globalThis.LuminousConditionRuntime || !resolver) throw new Error('Grapple runtime modules were not initialized.');

const engine = {
  getCoinProbability(sp) { return 50 + Math.max(-45, Math.min(45, Number(sp || 0))); },
  getDndModifier(score) { return Math.floor((Number(score) - 10) / 2); },
  calculateDndBonus(unit, statUsed, skillUsed) {
    const score = unit?.dndStats?.[statUsed] ?? 10;
    const modifier = this.getDndModifier(score);
    const profs = unit?.dndStats?.proficiencies || [];
    return modifier + (skillUsed && profs.includes(skillUsed) ? Number(unit.dndStats.proficiencyBonus || 0) : 0);
  },
};

function runtimeUnit(id, faction, { str = 10, dex = 10, athletics = false, acrobatics = false, proficiencyBonus = 2, sp = 0 } = {}) {
  const proficiencies = [];
  if (athletics) proficiencies.push('athletics');
  if (acrobatics) proficiencies.push('acrobatics');
  return { id, faction, hp: 20, maxHp: 20, sp, dndStats: { str, dex, proficiencyBonus, proficiencies }, statusEffects: {} };
}

const ai = runtimeUnit('enemy_ai', 'enemies', { str: 16, dex: 10, athletics: true, sp: 45 });
const player = runtimeUnit('player', 'allies', { str: 8, dex: 14, acrobatics: true, sp: 45 });
const aiGrapple = adapters.compileUniversalAction(ai, 'grapple', { targetId: player.id, isAi: true, actionSlotId: 'enemy_ai_slot_0' });
const aiResult = resolver.resolveCombatAction(aiGrapple, { phase: 'combat_phase', units: [ai, player], engine, random: () => 0 });

assert.equal(aiResult.resolved, true);
assert.equal(aiResult.resolution.type, 'contest');
assert.equal(aiResult.resolution.result.applied, true);
assert.equal(aiResult.resolution.result.result.attackerWon, true);
assert.equal(aiResult.resolution.result.result.defenderChoice.skillId, 'acrobatics', 'defender must use the better allowed Athletics/STR or Acrobatics/DEX response');
assert.ok(ai.statusEffects.grappling);
assert.ok(player.statusEffects.grappled);

// The exact same resolver path works when the player initiates Grapple against AI.
const player2 = runtimeUnit('player2', 'allies', { str: 18, dex: 10, athletics: true, sp: 45 });
const ai2 = runtimeUnit('enemy_ai2', 'enemies', { str: 8, dex: 12, acrobatics: false, sp: 45 });
const playerGrapple = adapters.compileUniversalAction(player2, 'grapple', { targetId: ai2.id, actionSlotId: 'player2_slot_0' });
const playerResult = resolver.resolveCombatAction(playerGrapple, { phase: 'combat_phase', units: [player2, ai2], engine, random: () => 0 });
assert.equal(playerResult.resolved, true);
assert.equal(playerResult.resolution.result.applied, true);
assert.ok(player2.statusEffects.grappling);
assert.ok(ai2.statusEffects.grappled);

// A resisted Grapple is still a resolved contest, but applies no Grapple statuses.
const weakAi = runtimeUnit('weak_ai', 'enemies', { str: 6, dex: 8, sp: 45 });
const strongPlayer = runtimeUnit('strong_player', 'allies', { str: 18, dex: 18, athletics: true, acrobatics: true, sp: 45 });
const resistedAction = adapters.compileUniversalAction(weakAi, 'grapple', { targetId: strongPlayer.id, isAi: true, actionSlotId: 'weak_ai_slot_0' });
const resisted = resolver.resolveCombatAction(resistedAction, { phase: 'combat_phase', units: [weakAi, strongPlayer], engine, random: () => 0 });
assert.equal(resisted.resolved, true);
assert.equal(resisted.resolution.result.applied, false);
assert.equal(resisted.resolution.result.resisted, true);
assert.equal(Boolean(weakAi.statusEffects.grappling), false);
assert.equal(Boolean(strongPlayer.statusEffects.grappled), false);

// Missing authoritative opposed-check machinery must never masquerade as a resolved Grapple.
const pendingA = runtimeUnit('pending_a', 'enemies');
const pendingB = runtimeUnit('pending_b', 'allies');
const pendingAction = adapters.compileUniversalAction(pendingA, 'grapple', { targetId: pendingB.id, isAi: true, actionSlotId: 'pending_a_slot_0' });
const previousEngine = globalThis.CombatEngine;
delete globalThis.CombatEngine;
const pending = resolver.resolveCombatAction(pendingAction, { phase: 'combat_phase', units: [pendingA, pendingB] });
if (previousEngine !== undefined) globalThis.CombatEngine = previousEngine;
assert.equal(pending.resolved, false);
assert.equal(pending.pending, true);
assert.equal(pending.reason, 'opposed_check_resolver_required');
assert.equal(pending.action.state, 'locked');

console.log('individual GOAP Grapple integration smoke: ok');
