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
const allocator = globalThis.LuminousEnemyActionSlotAllocator;
const economy = globalThis.LuminousActionEconomy;

if (!kobolds || !goblins || !allocator || !economy) throw new Error('Canonical slot test dependencies were not initialized.');

const dagger = kobolds.resolve('kobold_dagger', { level: 2, initializeEncounter: true });
const sling = kobolds.resolve('kobold_sling', { level: 2, initializeEncounter: true });
const winged = kobolds.resolve('winged_kobold', { level: 3, initializeEncounter: true });

dagger.resolvedSpeed = 6;
sling.resolvedSpeed = 5;
winged.resolvedSpeed = 4;

const originalDaggerSkillSlots = dagger.action_slots.slice();
const koboldAllocation = allocator.allocateEnemySlots([dagger, sling, winged]);
const koboldRows = Object.fromEntries(koboldAllocation.rows.map((row) => [row.unitId, row]));

assert.equal(koboldAllocation.allocated, true);
assert.equal(koboldAllocation.totalSlots, 5);
assert.equal(koboldRows.kobold_dagger.maxSlots, 2);
assert.equal(koboldRows.kobold_sling.maxSlots, 2);
assert.equal(koboldRows.winged_kobold.maxSlots, 2);
assert.equal(koboldRows.kobold_dagger.slots, 2);
assert.equal(koboldRows.kobold_sling.slots, 2);
assert.equal(koboldRows.winged_kobold.slots, 1);
assert.deepEqual(dagger.action_slots, originalDaggerSkillSlots, 'legacy Skill references must not be overwritten by runtime slot allocation');
assert.equal(dagger.actionSlots, 2);
assert.equal(economy.actionSlotMaximum(dagger), 2);

const target = { id: 'player_1' };
const planned = allocator.allocateAndPlan([dagger, sling, winged], {
  targets: [target],
  speedByUnitId: { kobold_dagger: 6, kobold_sling: 5, winged_kobold: 4 },
});
const plans = Object.fromEntries(planned.plans.map((entry) => [entry.unitId, entry]));
assert.equal(plans.kobold_dagger.slots, 2);
assert.equal(plans.kobold_dagger.plan.actions.length, 2);
assert.equal(plans.kobold_sling.slots, 2);
assert.equal(plans.kobold_sling.plan.actions.length, 2);
assert.equal(plans.winged_kobold.slots, 1);
assert.equal(plans.winged_kobold.plan.actions.length, 1);

// Goblins still have pending canonical weapon Skills, but slot allocation is independent
// from kit resolution and therefore can already honor their per-Unit slot caps.
const goblin = goblins.resolve('goblin', { level: 3, initializeEncounter: true });
const boss = goblins.resolve('goblin_boss', { level: 5, initializeEncounter: true });
const goblinAllocation = allocator.allocateEnemySlots([goblin, boss], {
  speedByUnitId: { goblin: 5, goblin_boss: 4 },
  apply: false,
});
const goblinRows = Object.fromEntries(goblinAllocation.rows.map((row) => [row.unitId, row]));
assert.equal(goblinRows.goblin.maxSlots, 2);
assert.equal(goblinRows.goblin.slots, 2);
assert.equal(goblinRows.goblin_boss.maxSlots, 3);
assert.equal(goblinRows.goblin_boss.slots, 3);
assert.equal(goblinAllocation.totalSlots, 5);

console.log('canonical Unit Action Slot allocation smoke: ok');
