import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
delete globalThis.LuminousStatusEngine;
delete globalThis.LuminousWeaponCantripBatchRuntime;
delete globalThis.LuminousSpellCatalog;

await import('../js/spell-catalog-core.js');
await import('../js/spell-batch-weapon-cantrips-runtime.js');

const catalog = globalThis.LuminousSpellCatalog;
const batch = globalThis.LuminousWeaponCantripBatchRuntime;

for (const id of ['booming_blade', 'green_flame_blade', 'shillelagh', 'true_strike']) {
  assert.ok(catalog[id], `missing cantrip ${id}`);
  assert.equal(catalog[id].cantrip, true);
  assert.equal(catalog[id].castingTime, 'quick_action');
}
for (const id of ['booming_blade', 'green_flame_blade', 'true_strike']) {
  assert.ok(catalog[id].mechanics.slotEnchantment, `missing slot enchantment metadata for ${id}`);
  assert.equal(catalog[id].targetType, 'action_slot');
}
assert.equal(batch.STATUS_DEFINITIONS.booming.icon, 'Assets/Icons/status/cantrips/booming.png');
assert.equal(batch.STATUS_DEFINITIONS.shillelagh.icon, 'Assets/Icons/status/cantrips/shillelagh.png');

assert.equal(catalog.divine_smite.targetType, 'action_slot');
assert.equal(catalog.divine_smite.mechanics.slotEnchantment.id, 'divine_smite');

const engine = {
  triggerEvent() { return null; },
  resolveStandardClash() { return { winner: 'A', clashLogs: [{ round: 1 }] }; },
  triggerPhase() { return null; },
  calculateCoinDamage() { return 100; },
  applyDamage(unit, damage) {
    const amount = Math.max(0, Number(damage) || 0);
    unit.hp = Math.max(0, Number(unit.hp || 0) - amount);
    return { damageTaken: amount };
  },
  modifyNextStaggerThreshold(unit, amount) {
    unit.nextStaggerThreshold = Number(unit.nextStaggerThreshold || 0) + Number(amount || 0);
  }
};
globalThis.CombatEngine = engine;
globalThis.LuminousFixedDamageRuntime = {
  applyFixedDamage(unit, damage) {
    const amount = Math.max(0, Number(damage) || 0);
    unit.hp = Math.max(0, Number(unit.hp || 0) - amount);
    unit.__fixedDamageTaken = Number(unit.__fixedDamageTaken || 0) + amount;
    return { applied: true, damage: amount };
  }
};
batch.install();

const caster = { id: 'caster', level: 30, dndStats: { wis: 20 }, statusEffects: {} };
const target = { id: 'target', hp: 200, statusEffects: {}, nextStaggerThreshold: 0 };
const other = { id: 'other', hp: 200, statusEffects: {} };

const baseMelee = { id: 'slash', type: 'Normal', skillRange: 1, atkWeight: 1, attackWeight: 1 };
let action = { targeting: { mainTargetId: 'target', attackWeight: 1 }, metadata: { sourceDefinition: structuredClone(baseMelee) } };
let materialized = batch.materializeSlotEnchantments(caster, baseMelee, [{ spellId: 'booming_blade' }], action);
assert.equal(materialized.ok, true);
assert.equal(materialized.skill.__luminousSlotEnchantments[0].boomingCount, 6);

engine.triggerEvent('[On Hit]', {
  engine, unitAttacker: caster, currentTarget: target, defender: target,
  skill: materialized.skill, damageDealt: 100
}, [target]);
assert.equal(target.__luminousBoomingNextTurn.count, 6);
assert.equal(target.statusEffects.booming, undefined);
engine.triggerPhase('[Turn Start]', [target]);
assert.equal(target.statusEffects.booming.count, 6);
engine.resolveStandardClash(target, { id: 'a' }, other, { id: 'b' });
assert.equal(target.nextStaggerThreshold, 2);
assert.equal(target.statusEffects.booming.count, 5);
engine.triggerPhase('[Turn End]', [target]);
assert.equal(target.statusEffects.booming, undefined);
assert.equal(target.statusEffects.tremor.potency, 5);

action = { targeting: { mainTargetId: 'target', attackWeight: 1 }, metadata: { sourceDefinition: structuredClone(baseMelee) } };
materialized = batch.materializeSlotEnchantments(caster, baseMelee, [{ spellId: 'green_flame_blade' }], action);
assert.equal(materialized.ok, true);
assert.equal(action.targeting.attackWeight, 2);
assert.equal(materialized.skill.__luminousSlotEnchantments[0].secondaryDamagePct, 27);
assert.equal(materialized.skill.__luminousSlotEnchantments[0].burn, 3);
assert.equal(engine.calculateCoinDamage(caster, target, materialized.skill, 10, false, 0, {}), 100);
assert.equal(engine.calculateCoinDamage(caster, other, materialized.skill, 10, false, 0, {}), 27);
engine.triggerEvent('[On Hit]', { engine, unitAttacker: caster, currentTarget: other, defender: other, skill: materialized.skill, damageDealt: 27 }, [other]);
assert.equal(other.statusEffects.burn.potency, 3);

action = { targeting: { mainTargetId: 'target', attackWeight: 1 }, metadata: { sourceDefinition: structuredClone(baseMelee) } };
materialized = batch.materializeSlotEnchantments(caster, baseMelee, [{ spellId: 'true_strike' }], action);
assert.equal(materialized.ok, true);
assert.equal(materialized.skill.__luminousSlotEnchantments[0].damagePct, 5);
assert.equal(engine.calculateCoinDamage(caster, target, materialized.skill, 10, false, 0, {}), 105);
engine.triggerEvent('[On Hit]', { engine, unitAttacker: caster, currentTarget: target, defender: target, skill: materialized.skill, damageDealt: 105 }, [target]);
assert.equal(target.statusEffects.radiance.count, 1);

action = { targeting: { mainTargetId: 'target', attackWeight: 1 }, metadata: { sourceDefinition: structuredClone(baseMelee) } };
materialized = batch.materializeSlotEnchantments(caster, baseMelee, [{
  spellId: 'divine_smite',
  slotLevel: 3,
  classId: 'paladin',
  school: 'evocation',
  castingTime: 'quick_action',
  targetDrawId: 'draw_smite',
  targetSkillId: 'slash',
}], action);
assert.equal(materialized.ok, true);
assert.equal(materialized.skill.__luminousSlotEnchantments[0].id, 'divine_smite');
assert.equal(materialized.skill.__luminousSlotEnchantments[0].slotLevel, 3);
assert.equal(materialized.skill.__luminousSlotEnchantments[0].targetDrawId, 'draw_smite');
assert.equal(materialized.skill.__luminousSlotEnchantments[0].school, 'evocation');

const invalidGreen = batch.materializeSlotEnchantments(caster, { ...baseMelee, attackWeight: 2, atkWeight: 2 }, [{ spellId: 'green_flame_blade' }], null);
assert.equal(invalidGreen.ok, false);
assert.equal(invalidGreen.reason, 'green_flame_blade_requires_1_atk_weight');

const shCaster = { id: 'sh-caster', level: 30, dndStats: { wis: 20 }, statusEffects: {} };
assert.equal(batch.prepareCantrip(shCaster, 'shillelagh').ok, true);
assert.equal(shCaster.statusEffects.shillelagh.count, 10);
assert.equal(batch.shillelaghFixedPercent(shCaster), 12);
const shTarget = { id: 'sh-target', hp: 200, statusEffects: {} };
engine.triggerEvent('[On Hit]', { engine, unitAttacker: shCaster, currentTarget: shTarget, defender: shTarget, skill: baseMelee, damageDealt: 100 }, [shTarget]);
assert.equal(shTarget.__fixedDamageTaken, 12);
engine.triggerPhase('[Turn End]', [shCaster]);
assert.equal(shCaster.statusEffects.shillelagh.count, 9);

console.log('Weapon cantrip batch smoke: OK');
