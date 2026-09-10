import assert from 'node:assert/strict';

await import('../js/status-engine.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/unit-rank-runtime.js');
await import('../js/unit-combat-mechanics-runtime.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/unit-catalog-goblin.js');
await import('../js/unit-action-economy-catalog.js');
await import('../js/universal-action-economy.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/enemy-action-slot-allocator.js');

const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const profiles = globalThis.LuminousUnitActionEconomyCatalog;
const allocator = globalThis.LuminousEnemyActionSlotAllocator;
const economy = globalThis.LuminousActionEconomy;

if (!kobolds || !goblins || !profiles || !allocator || !economy) throw new Error('Canonical slot test dependencies were not initialized.');

function prepare(unit, runtimeId, speed, profileId = null) {
  unit.id = runtimeId;
  unit.faction = 'enemy';
  unit.faccion = 'enemy';
  unit.hp = Number(unit.hp ?? unit.mechanics?.hp ?? 10);
  unit.maxHp = Number(unit.maxHp ?? unit.mechanics?.maxHp ?? unit.hp);
  unit.resolvedSpeed = speed;
  if (profileId) {
    const stamped = profiles.applyToUnit(unit, profileId);
    assert.equal(stamped.applied, true);
  }
  return unit;
}

// Live encounter ids can be unique without losing the canonical Action Economy profile.
const dagger = prepare(kobolds.resolve('kobold_dagger', { level: 2, initializeEncounter: true }), 'encounter_7_kobold_a', 6, 'kobold_dagger');
const sling = prepare(kobolds.resolve('kobold_sling', { level: 2, initializeEncounter: true }), 'encounter_7_kobold_b', 5, 'kobold_sling');
const winged = prepare(kobolds.resolve('winged_kobold', { level: 3, initializeEncounter: true }), 'encounter_7_kobold_c', 4, 'winged_kobold');

const originalDaggerSkillSlots = dagger.action_slots.slice();
const koboldAllocation = allocator.allocateEnemySlots([dagger, sling, winged]);
const koboldRows = Object.fromEntries(koboldAllocation.rows.map((row) => [row.unitId, row]));

assert.equal(koboldAllocation.allocated, true);
assert.equal(koboldAllocation.totalSlots, 5);
assert.equal(koboldRows.encounter_7_kobold_a.profileId, 'kobold_dagger');
assert.equal(koboldRows.encounter_7_kobold_b.profileId, 'kobold_sling');
assert.equal(koboldRows.encounter_7_kobold_c.profileId, 'winged_kobold');
assert.equal(koboldRows.encounter_7_kobold_a.maxSlots, 2);
assert.equal(koboldRows.encounter_7_kobold_b.maxSlots, 2);
assert.equal(koboldRows.encounter_7_kobold_c.maxSlots, 2);
assert.equal(koboldRows.encounter_7_kobold_a.slots, 2);
assert.equal(koboldRows.encounter_7_kobold_b.slots, 2);
assert.equal(koboldRows.encounter_7_kobold_c.slots, 1);
assert.deepEqual(dagger.action_slots, originalDaggerSkillSlots, 'legacy Skill references must not be overwritten by runtime slot allocation');
assert.equal(dagger.actionSlots, 2);
assert.equal(economy.actionSlotMaximum(dagger), 2);

const target = { id: 'player_1' };
const planned = allocator.allocateAndPlan([dagger, sling, winged], {
  targets: [target],
  speedByUnitId: { encounter_7_kobold_a: 6, encounter_7_kobold_b: 5, encounter_7_kobold_c: 4 },
});
const plans = Object.fromEntries(planned.plans.map((entry) => [entry.unitId, entry]));
assert.equal(plans.encounter_7_kobold_a.slots, 2);
assert.equal(plans.encounter_7_kobold_a.plan.actions.length, 2);
assert.deepEqual(plans.encounter_7_kobold_a.plan.sequence.map((entry) => entry.slotId), ['encounter_7_kobold_a_slot_0', 'encounter_7_kobold_a_slot_1']);
assert.equal(plans.encounter_7_kobold_b.slots, 2);
assert.equal(plans.encounter_7_kobold_b.plan.actions.length, 2);
assert.equal(plans.encounter_7_kobold_c.slots, 1);
assert.equal(plans.encounter_7_kobold_c.plan.actions.length, 1);

// Goblins still have pending canonical weapon Skills, but slot allocation is independent from kit resolution.
const goblin = prepare(goblins.resolve('goblin', { level: 3, initializeEncounter: true }), 'encounter_9_goblin_a', 5, 'goblin');
const boss = prepare(goblins.resolve('goblin_boss', { level: 5, initializeEncounter: true }), 'encounter_9_goblin_boss', 4, 'goblin_boss');
const goblinAllocation = allocator.allocateEnemySlots([goblin, boss], { apply: false });
const goblinRows = Object.fromEntries(goblinAllocation.rows.map((row) => [row.unitId, row]));
assert.equal(goblinRows.encounter_9_goblin_a.profileId, 'goblin');
assert.equal(goblinRows.encounter_9_goblin_a.maxSlots, 2);
assert.equal(goblinRows.encounter_9_goblin_a.slots, 2);
assert.equal(goblinRows.encounter_9_goblin_boss.profileId, 'goblin_boss');
assert.equal(goblinRows.encounter_9_goblin_boss.maxSlots, 3);
assert.equal(goblinRows.encounter_9_goblin_boss.slots, 3);
assert.equal(goblinAllocation.totalSlots, 5);

console.log('canonical Unit Action Slot allocation smoke: ok');
