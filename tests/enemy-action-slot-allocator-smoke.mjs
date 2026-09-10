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

{
  const units = [enemy('fast', 8, 3), enemy('second', 6, 3), enemy('slow', 4, 3)];
  const result = allocator.allocateEnemySlots(units, { apply: false, roundId: 'round_1' });
  const rows = rowMap(result);
  assert.equal(result.allocated, true);
  assert.equal(result.roundId, 'round_1');
  assert.equal(result.teamSlotCap, 12);
  assert.deepEqual(result.bonusRecipients, ['fast', 'second']);
  assert.equal(rows.fast.slots, 3);
  assert.equal(rows.second.slots, 3);
  assert.equal(rows.slow.slots, 1);
  assert.equal(rows.fast.speedSource, 'speed');
  assert.deepEqual(rows.fast.slotIds, ['fast_slot_0', 'fast_slot_1', 'fast_slot_2']);
  assert.equal(result.totalSlots, 7);
  assert.equal(result.unusedSlots, 5);
}

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

{
  const units = Array.from({ length: 10 }, (_, index) => enemy(`u${index + 1}`, 20 - index, 3));
  const result = allocator.allocateEnemySlots(units, { apply: false });
  const rows = rowMap(result);
  assert.equal(result.totalSlots, 12);
  assert.equal(rows.u1.slots, 2);
  assert.equal(rows.u2.slots, 2);
  for (let index = 3; index <= 10; index += 1) assert.equal(rows[`u${index}`].slots, 1);
}

{
  const units = Array.from({ length: 13 }, (_, index) => enemy(`overflow_${index}`, index + 1, 2));
  const result = allocator.allocateEnemySlots(units, { apply: false });
  assert.equal(result.allocated, false);
  assert.equal(result.reason, 'minimum_slots_exceed_team_cap');
  assert.equal(result.minimumTotal, 13);
}

{
  const duplicateA = enemy('duplicate', 8, 2);
  const duplicateB = enemy('duplicate', 7, 2);
  duplicateA.actionSlots = 99;
  const duplicate = allocator.allocateEnemySlots([duplicateA, duplicateB]);
  assert.equal(duplicate.allocated, false);
  assert.equal(duplicate.reason, 'duplicate_enemy_unit_id');
  assert.equal(duplicateA.actionSlots, 99, 'failed allocation must be atomic and leave Units untouched');

  const missing = enemy('', 6, 2);
  delete missing.id;
  const missingResult = allocator.allocateEnemySlots([missing]);
  assert.equal(missingResult.allocated, false);
  assert.equal(missingResult.reason, 'enemy_unit_id_required');
}

{
  const units = [enemy('tie_a', 5, 2), enemy('tie_b', 5, 2), enemy('tie_c', 5, 2)];
  const result = allocator.allocateEnemySlots(units, { apply: false });
  assert.deepEqual(result.bonusRecipients, ['tie_a', 'tie_b']);
  assert.equal(rowMap(result).tie_c.slots, 1);
  assert.equal(result.tieBreak, 'deployment_order_then_unit_id');
}

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

{
  const first = enemy('speed_override_a', 2, 2);
  const second = enemy('speed_override_b', 9, 2);
  const third = enemy('speed_override_c', 8, 2);
  const result = allocator.allocateEnemySlots([first, second, third], {
    apply: false,
    speedByUnitId: { speed_override_a: 12, speed_override_b: 4, speed_override_c: 3 },
  });
  assert.deepEqual(result.bonusRecipients, ['speed_override_a', 'speed_override_b']);
  assert.equal(rowMap(result).speed_override_a.speedSource, 'round_override');
}

{
  const hostile = enemy('hostile', 5, 2);
  const dead = { ...enemy('dead_enemy', 20, 3), hp: 0 };
  const ally = { ...enemy('ally', 30, 3), faction: 'ally' };
  const result = allocator.allocateEnemySlots([hostile, dead, ally], { apply: false });
  assert.deepEqual(result.rows.map((row) => row.unitId), ['hostile']);
  assert.equal(result.activeEnemyCount, 1);
  assert.equal(result.inactiveEnemyCount, 1);
}

assert.deepEqual(catalog.get('kobold_dagger'), { id: 'kobold_dagger', minSlots: 1, maxSlots: 2 });
assert.deepEqual(catalog.get('kobold_sling'), { id: 'kobold_sling', minSlots: 1, maxSlots: 2 });
assert.deepEqual(catalog.get('dragonheart_kobold'), { id: 'dragonheart_kobold', minSlots: 1, maxSlots: 3 });
assert.deepEqual(catalog.get('goblin'), { id: 'goblin', minSlots: 1, maxSlots: 2 });
assert.deepEqual(catalog.get('goblin_boss'), { id: 'goblin_boss', minSlots: 1, maxSlots: 3 });
{
  const instance = enemy('encounter_42_unit_7', 8, 1);
  delete instance.actionEconomy;
  const stamped = catalog.applyToUnit(instance, 'kobold_dagger');
  assert.equal(stamped.applied, true);
  assert.equal(instance.actionEconomy.profileId, 'kobold_dagger');
  assert.equal(catalog.canonicalUnitId(instance), 'kobold_dagger');
  assert.equal(allocator.profileFor(instance).maxSlots, 2);
}

{
  const first = enemy('apply_fast', 7, 3);
  const second = enemy('apply_slow', 4, 3);
  first.slots = [{ id: 'old', slotWeight: 2, isTargetedThisRound: true }];
  const result = allocator.allocateEnemySlots([first, second], { roundId: 'r77' });
  assert.equal(result.allocated, true);
  assert.equal(first.actionSlots, 3);
  assert.equal(first.activeSlots, 3);
  assert.equal(second.actionSlots, 3);
  assert.equal(economy.actionSlotMaximum(first), 3);
  assert.equal(economy.actionSlotMaximum(second), 3);
  assert.equal(first.actionSlotAllocation.roundId, 'r77');
  assert.equal(first.slots[0].slotWeight, 2);
  assert.equal(first.slots[0].isTargetedThisRound, false);
  const snap = economy.beginPlanning(first);
  assert.equal(snap.actionSlots, 3);
  assert.equal(snap.action, 3);
  assert.equal(first.slots.length, 3);
}

// Planning round uses a non-mutating allocation preflight before touching live Unit state.
{
  const first = enemy('preflight_fast', 8, 2);
  const second = enemy('preflight_slow', 4, 2);
  first.actionSlots = 7;
  const preview = allocator.allocateEnemySlots([first, second], { apply: false, roundId: 'preview' });
  assert.equal(preview.allocated, true);
  assert.equal(first.actionSlots, 7);
  const round = allocator.beginEnemyPlanningRound([first, second], { roundId: 'commit' });
  assert.equal(round.planningReady, true);
  assert.equal(first.actionSlots, 2);
  assert.equal(first.actionSlotAllocation.roundId, 'commit');
  assert.equal(round.planning[0].snapshot.actionSlots, 2);
}

{
  const skill = {
    id: 'allocator_test_strike', sourceType: 'skill', type: 'Attack', basePower: 5, coinPower: 2, coinAmount: 1,
    attackWeight: 1, damageType: 'slash', sinAffinity: 'sinless', targetingType: 'Focused Attack',
    isDefense: false, isClashable: false, isUnclashable: true, resourceCosts: [], effects: [],
    coins: [{ index: 0, type: 'normal', status: 'active', effects: [] }],
  };
  const first = { ...enemy('planner_fast', 8, 2), combatSkills: [skill] };
  const second = { ...enemy('planner_second', 6, 2), combatSkills: [skill] };
  const third = { ...enemy('planner_slow', 4, 2), combatSkills: [skill] };
  const result = allocator.allocateAndPlan([first, second, third], { targetIds: ['player_1'], roundId: 'planning_round' });
  assert.equal(result.planningReady, true);
  assert.equal(result.allocation.totalSlots, 5);
  const plans = Object.fromEntries(result.plans.map((entry) => [entry.unitId, entry]));
  assert.equal(plans.planner_fast.slots, 2);
  assert.equal(plans.planner_fast.plan.actions.length, 2);
  assert.deepEqual(plans.planner_fast.slotIds, ['planner_fast_slot_0', 'planner_fast_slot_1']);
  assert.deepEqual(plans.planner_fast.plan.sequence.map((entry) => entry.slotId), plans.planner_fast.slotIds);
  assert.equal(plans.planner_second.plan.actions.length, 2);
  assert.equal(plans.planner_slow.plan.actions.length, 1);
}

console.log('enemy Action Slot allocator smoke: ok');
