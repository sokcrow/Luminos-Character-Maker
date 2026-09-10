import assert from 'node:assert/strict';

await import('../js/unit-action-economy-catalog.js');
await import('../js/universal-action-economy.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/enemy-action-slot-allocator.js');

const catalog = globalThis.LuminousUnitActionEconomyCatalog;
const economy = globalThis.LuminousActionEconomy;
const allocator = globalThis.LuminousEnemyActionSlotAllocator;

if (!catalog || !economy || !allocator) throw new Error('Action Slot allocator dependencies were not initialized.');

function enemy(id, speed, maxSlots = 3) {
  return {
    id,
    faction: 'enemy',
    hp: 10,
    maxHp: 10,
    speed,
    scores: { int: 10, wis: 9 },
    actionEconomy: { minSlots: 1, maxSlots },
  };
}

function rowMap(result) {
  return Object.fromEntries(result.rows.map((row) => [row.unitId, row]));
}

// 12 is a ceiling, not a quota. Only the two fastest Units may receive bonus slots.
{
  const units = [enemy('fast', 8, 3), enemy('second', 6, 3), enemy('slow', 4, 3)];
  const result = allocator.allocateEnemySlots(units, { apply: false });
  const rows = rowMap(result);
  assert.equal(result.allocated, true);
  assert.equal(result.teamSlotCap, 12);
  assert.deepEqual(result.bonusRecipients, ['fast', 'second']);
  assert.equal(rows.fast.slots, 3);
  assert.equal(rows.second.slots, 3);
  assert.equal(rows.slow.slots, 1);
  assert.equal(result.totalSlots, 7);
  assert.equal(result.unusedSlots, 5);
}

// Minion-style maxSlots 2 still stops below 12 when individual caps are reached.
{
  const units = [enemy('m1', 7, 2), enemy('m2', 5, 2), enemy('m3', 3, 2)];
  const result = allocator.allocateEnemySlots(units, { apply: false });
  const rows = rowMap(result);
  assert.equal(rows.m1.slots, 2);
  assert.equal(rows.m2.slots, 2);
  assert.equal(rows.m3.slots, 1);
  assert.equal(result.totalSlots, 5);
  assert.equal(result.unusedSlots, 7);
}

// Near the team ceiling, bonus slots are distributed round-robin to the two fastest.
{
  const units = Array.from({ length: 10 }, (_, index) => enemy(`u${index + 1}`, 20 - index, 3));
  const result = allocator.allocateEnemySlots(units, { apply: false });
  const rows = rowMap(result);
  assert.equal(result.totalSlots, 12);
  assert.equal(rows.u1.slots, 2);
  assert.equal(rows.u2.slots, 2);
  for (let index = 3; index <= 10; index += 1) assert.equal(rows[`u${index}`].slots, 1);
}

// Encounter deployment itself is invalid if guaranteed minimum slots exceed the team cap.
{
  const units = Array.from({ length: 13 }, (_, index) => enemy(`overflow_${index}`, index + 1, 2));
  const result = allocator.allocateEnemySlots(units, { apply: false });
  assert.equal(result.allocated, false);
  assert.equal(result.reason, 'minimum_slots_exceed_team_cap');
  assert.equal(result.minimumTotal, 13);
}

// Equal Speed uses stable deployment order as the deterministic tie-break.
{
  const units = [enemy('tie_a', 5, 2), enemy('tie_b', 5, 2), enemy('tie_c', 5, 2)];
  const result = allocator.allocateEnemySlots(units, { apply: false });
  assert.deepEqual(result.bonusRecipients, ['tie_a', 'tie_b']);
  assert.equal(rowMap(result).tie_c.slots, 1);
  assert.equal(result.tieBreak, 'deployment_order_then_unit_id');
}

// Missing round Speed never invents a value. The Unit keeps its guaranteed base slot only.
{
  const noSpeedA = enemy('no_speed_a', undefined, 2);
  delete noSpeedA.speed;
  const noSpeedB = enemy('no_speed_b', undefined, 2);
  delete noSpeedB.speed;
  const known = enemy('known_speed', 4, 2);
  const result = allocator.allocateEnemySlots([noSpeedA, known, noSpeedB], { apply: false });
  const rows = rowMap(result);
  assert.equal(rows.known_speed.slots, 2);
  assert.equal(rows.no_speed_a.slots, 1);
  assert.equal(rows.no_speed_b.slots, 1);
  assert.deepEqual(result.missingSpeed.sort(), ['no_speed_a', 'no_speed_b']);
}

// Allies are outside this allocator's authority.
{
  const hostile = enemy('hostile', 5, 2);
  const ally = { ...enemy('ally', 20, 3), faction: 'ally' };
  const result = allocator.allocateEnemySlots([hostile, ally], { apply: false });
  assert.deepEqual(result.rows.map((row) => row.unitId), ['hostile']);
}

// Canonical Unit profiles live in data, not in species/rank inference inside the allocator.
assert.deepEqual(catalog.get('kobold_dagger'), { id: 'kobold_dagger', minSlots: 1, maxSlots: 2 });
assert.deepEqual(catalog.get('kobold_sling'), { id: 'kobold_sling', minSlots: 1, maxSlots: 2 });
assert.deepEqual(catalog.get('dragonheart_kobold'), { id: 'dragonheart_kobold', minSlots: 1, maxSlots: 3 });
assert.deepEqual(catalog.get('goblin'), { id: 'goblin', minSlots: 1, maxSlots: 2 });
assert.deepEqual(catalog.get('goblin_boss'), { id: 'goblin_boss', minSlots: 1, maxSlots: 3 });

// Applying an allocation makes the existing universal Action Economy consume the allocated count.
{
  const first = enemy('apply_fast', 7, 3);
  const second = enemy('apply_slow', 4, 3);
  const result = allocator.allocateEnemySlots([first, second]);
  assert.equal(result.allocated, true);
  assert.equal(first.actionSlots, 3);
  assert.equal(first.activeSlots, 3);
  assert.equal(second.actionSlots, 3);
  assert.equal(economy.actionSlotMaximum(first), 3);
  assert.equal(economy.actionSlotMaximum(second), 3);
  const snap = economy.beginPlanning(first);
  assert.equal(snap.actionSlots, 3);
  assert.equal(snap.action, 3);
  assert.equal(first.slots.length, 3);
}

// End-to-end planner handoff: allocator count becomes GOAP availableSlots automatically.
{
  const skill = {
    id: 'allocator_test_strike',
    sourceType: 'skill',
    type: 'Attack',
    basePower: 5,
    coinPower: 2,
    coinAmount: 1,
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
  const first = { ...enemy('planner_fast', 8, 2), combatSkills: [skill] };
  const second = { ...enemy('planner_second', 6, 2), combatSkills: [skill] };
  const third = { ...enemy('planner_slow', 4, 2), combatSkills: [skill] };
  const result = allocator.allocateAndPlan([first, second, third], { targetIds: ['player_1'] });
  assert.equal(result.allocation.totalSlots, 5);
  const plans = Object.fromEntries(result.plans.map((entry) => [entry.unitId, entry]));
  assert.equal(plans.planner_fast.slots, 2);
  assert.equal(plans.planner_fast.plan.actions.length, 2);
  assert.equal(plans.planner_second.plan.actions.length, 2);
  assert.equal(plans.planner_slow.plan.actions.length, 1);
}

console.log('enemy Action Slot allocator smoke: ok');
