import assert from 'node:assert/strict';

await import('../js/universal-action-economy.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/unit-action-economy-catalog.js');
await import('../js/enemy-action-slot-allocator.js');
await import('../js/battle-viewer-enemy-planning-074.js');

const economy = globalThis.LuminousActionEconomy;
const schema = globalThis.LuminousCombatAction;
const bridge = globalThis.LuminousBattleViewerEnemyPlanning074;

if (!economy || !schema || !bridge) throw new Error('Battle Viewer enemy Planning dependencies were not initialized.');

const strike = {
  id: 'viewer_ai_strike',
  sourceType: 'skill',
  type: 'Attack',
  basePower: 6,
  coinPower: 4,
  coinAmount: 1,
  attackWeight: 1,
  damageType: 'perforante',
  sinAffinity: 'sinless',
  targetingType: 'Focused Attack',
  isDefense: false,
  isClashable: false,
  isUnclashable: true,
  resourceCosts: [],
  effects: [],
  coins: [{ index: 0, type: 'normal', status: 'active', effects: [] }],
};

function enemy(id, speed, profileId = 'kobold_dagger', skill = strike) {
  return {
    id,
    canonicalUnitId: profileId,
    faction: 'enemy',
    hp: 20,
    maxHp: 20,
    speed,
    scores: { int: 10, wis: 9 },
    resolvedSkills: [skill],
  };
}

// The real Viewer phase handler begins ActionEconomy Planning first. The bridge must
// allocate/plan enemies afterwards without touching player slot counts or starting a second turn.
{
  const player = { id: 'player_live', faction: 'ally', isPlayer: true, hp: 50, maxHp: 50, speed: 7, actionSlots: 4 };
  const fast = enemy('encounter_kobold_fast', 8);
  const second = enemy('encounter_kobold_second', 6);
  const slow = enemy('encounter_kobold_slow', 4);
  const dead = { ...enemy('encounter_kobold_dead', 20), hp: 0 };
  const units = [player, fast, second, slow, dead];

  units.forEach((unit) => economy.beginPlanning(unit));
  const playerBefore = economy.snapshot(player, { phase: 'planning' });
  const enemyTurnsBefore = Object.fromEntries([fast, second, slow].map((unit) => [unit.id, economy.snapshot(unit, { phase: 'planning' }).turn]));

  const attackVectors = {};
  const slotTargets = {
    player_live_slot_0: 'encounter_kobold_fast_slot_0',
    encounter_kobold_fast_slot_9: 'player_live_slot_0',
  };
  const rendered = [];
  const result = bridge.runViewerPlanning({
    units,
    attackVectors,
    slotTargets,
    renderSlots: (unit, row) => rendered.push([unit.id, row.slots]),
  });

  assert.equal(result.applied, true);
  assert.equal(result.entriesApplied.length, 5);
  assert.equal(result.result.allocation.totalSlots, 5);
  const rows = Object.fromEntries(result.result.allocation.rows.map((row) => [row.unitId, row]));
  assert.equal(rows.encounter_kobold_fast.slots, 2);
  assert.equal(rows.encounter_kobold_second.slots, 2);
  assert.equal(rows.encounter_kobold_slow.slots, 1);
  assert.equal(rows.encounter_kobold_dead, undefined, 'dead enemies must not receive Viewer slots');
  assert.deepEqual(rows.encounter_kobold_fast.slotIds, ['encounter_kobold_fast_slot_0', 'encounter_kobold_fast_slot_1']);
  assert.deepEqual(result.result.allocation.bonusRecipients, ['encounter_kobold_fast', 'encounter_kobold_second']);

  assert.equal(player.actionSlots, 4, 'enemy Planning must never rewrite player Action Slots');
  assert.equal(economy.snapshot(player, { phase: 'planning' }).turn, playerBefore.turn, 'enemy Planning must never begin another player turn');
  assert.equal(economy.snapshot(player, { phase: 'planning' }).actionSlots, 4);
  for (const unit of [fast, second, slow]) {
    assert.equal(economy.snapshot(unit, { phase: 'planning' }).turn, enemyTurnsBefore[unit.id], 'bridge must not call beginPlanning twice for enemies');
  }

  assert.deepEqual(rendered, [
    ['encounter_kobold_fast', 2],
    ['encounter_kobold_second', 2],
    ['encounter_kobold_slow', 1],
  ]);
  assert.equal(Object.keys(attackVectors).length, 5);
  for (const [slotId, vector] of Object.entries(attackVectors)) {
    assert.equal(vector.__luminousEnemyGoap074, true);
    assert.equal(vector.target, 'player_live_slot_0');
    assert.equal(vector.combatAction.actionSlotId, slotId);
    assert.equal(vector.combatAction.actorId, slotId.slice(0, slotId.lastIndexOf('_slot_')));
    assert.equal(vector.combatAction.phase.selectedAt, schema.PHASES.PLANNING_PHASE_AI);
    assert.equal(schema.validateCombatAction(vector.combatAction).valid, true);
  }

  assert.equal(slotTargets.encounter_kobold_fast_slot_9, undefined, 'stale enemy slot targets must be pruned locally');
  assert.equal(slotTargets.player_live_slot_0, 'encounter_kobold_fast_slot_0', 'player targeting state must remain untouched');
}

// Defense decisions are routed through the Viewer defense plan contract instead of being
// sent to CombatActionResolver as unilateral attacks.
{
  const defense = {
    id: 'viewer_ai_evade',
    sourceType: 'skill',
    type: 'Defense',
    isDefense: true,
    defenseSubtype: 'Evade',
    basePower: 5,
    coinPower: 5,
    coinAmount: 1,
    targetingType: 'Focused Attack',
    isClashable: true,
    isUnclashable: false,
    resourceCosts: [],
    effects: [],
    coins: [{ index: 0, type: 'normal', status: 'active', effects: [] }],
  };
  const player = { id: 'defense_target', faction: 'ally', isPlayer: true, hp: 40, maxHp: 40, actionSlots: 3 };
  const defender = enemy('defense_enemy', 5, 'kobold_dagger', defense);
  economy.beginPlanning(player);
  economy.beginPlanning(defender);
  const attackVectors = {};
  const result = bridge.runViewerPlanning({ units: [player, defender], attackVectors, slotTargets: {}, renderSlots: () => {} });
  assert.equal(result.applied, true);
  const vector = attackVectors.defense_enemy_slot_0;
  assert.ok(vector, 'defense slot should be represented in Viewer Planning');
  assert.equal(vector.combatAction, undefined, 'defense must not be injected as a unilateral embedded attack');
  assert.equal(vector.plan.type, 'defense');
  assert.equal(vector.plan.data.isDefense, true);
}

// Escape remains a turn-end action. Planning stores it as deferred rather than injecting
// a wrong-phase action into the combat timeline.
{
  const player = { id: 'escape_target', faction: 'ally', isPlayer: true, hp: 40, maxHp: 40, actionSlots: 2 };
  const cautious = enemy('cautious_enemy', 7);
  cautious.hp = 2;
  cautious.maxHp = 20;
  cautious.scores = { int: 10, wis: 18 };
  economy.beginPlanning(player);
  economy.beginPlanning(cautious);
  const attackVectors = {};
  const result = bridge.runViewerPlanning({ units: [player, cautious], attackVectors, slotTargets: {}, renderSlots: () => {} });
  assert.equal(result.applied, true);
  assert.equal(Object.keys(attackVectors).length, 0, 'turn-end Escape must not enter the combat-phase vector registry');
  assert.equal(result.deferred.length, 1);
  assert.equal(result.deferred[0].action.source.id, 'escape');
  assert.equal(result.deferred[0].action.phase.executesAt, schema.PHASES.ON_TURN_END);
  assert.equal(cautious.__luminousEnemyDeferredActions074.length, 1);
}

// Real hook contract: the existing Viewer sync owns beginPlanning for everyone; the bridge
// runs after it. Player and enemy turn counters must each increment exactly once, and the
// canonical v0.7.3 timeline must win even if a legacy inline function was declared later.
{
  const player = { id: 'hook_player', faction: 'ally', isPlayer: true, hp: 50, maxHp: 50, speed: 6, actionSlots: 5 };
  const fast = enemy('hook_fast', 8);
  const slow = enemy('hook_slow', 4);
  globalThis.combatData = { hook_player: player, hook_fast: fast, hook_slow: slow };
  globalThis.attackVectors = {};
  globalThis.slotTargets = {};
  let originalCalls = 0;
  globalThis.syncCombatEnginePhase = function viewerPhaseSync(rawState) {
    originalCalls += 1;
    if (String(rawState).toUpperCase() === 'PRE_COMBAT_PLANNING') Object.values(globalThis.combatData).forEach((unit) => economy.beginPlanning(unit));
    return String(rawState).toUpperCase();
  };
  const canonicalTimeline = function canonicalTimeline() {};
  globalThis.LuminousBattleViewerRuntime073 = { executeCombatTimeline: canonicalTimeline };
  globalThis.executeCombatTimeline = function legacyInlineTimeline() {};

  bridge.state.installed = false;
  assert.equal(bridge.installPhaseHook(), true);
  assert.equal(globalThis.executeCombatTimeline, canonicalTimeline, 'canonical timeline authority must be restored when the phase hook installs');
  assert.equal(globalThis.__luminousCombatTimelineAuthority, 'v0.7.3-combat-action-runtime');
  globalThis.syncCombatEnginePhase('PRE_COMBAT_PLANNING');

  assert.equal(originalCalls, 1);
  assert.equal(economy.snapshot(player, { phase: 'planning' }).turn, 1);
  assert.equal(economy.snapshot(fast, { phase: 'planning' }).turn, 1);
  assert.equal(economy.snapshot(slow, { phase: 'planning' }).turn, 1);
  assert.equal(player.actionSlots, 5);
  assert.equal(Object.keys(globalThis.attackVectors).length, 4, 'two 1-2 enemies should expose four GOAP vectors');
}

console.log('Battle Viewer enemy Planning 0.7.4 smoke: ok');
