import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
delete globalThis.LuminousStatusEngine;
delete globalThis.LuminousWeaponCantripBatchRuntime;
delete globalThis.LuminousSpellCatalog;

await import('../js/spell-catalog-core.js');
await import('../js/spell-batch-weapon-cantrips-runtime.js');

const catalog = globalThis.LuminousSpellCatalog;
const batch = globalThis.LuminousWeaponCantripBatchRuntime;

for (const id of ['booming_blade', 'green_flame_blade', 'shillelagh']) {
  assert.ok(catalog[id], `missing cantrip ${id}`);
  assert.equal(catalog[id].cantrip, true);
  assert.equal(catalog[id].castingTime, 'quick_action');
}
assert.equal(batch.STATUS_DEFINITIONS.booming.icon, 'https://imgur.com/42ESliW.png');
assert.equal(batch.STATUS_DEFINITIONS.shillelagh.icon, 'https://imgur.com/OtAgwTp.png');

const engine = {
  triggerEvent() { return null; },
  resolveStandardClash() { return { winner: 'A', clashLogs: [{ round: 1 }] }; },
  triggerPhase() { return null; },
  calculateCoinDamage() { return 100; },
  applyDamage(unit, damage) {
    unit.hp = Math.max(0, Number(unit.hp || 0) - Math.max(0, Number(damage) || 0));
    return { damageTaken: damage };
  },
  modifyNextStaggerThreshold(unit, amount) {
    unit.nextStaggerThreshold = Number(unit.nextStaggerThreshold || 0) + Number(amount || 0);
  }
};
globalThis.CombatEngine = engine;
batch.install();

const caster = { id: 'caster', level: 30, dndStats: { wis: 20 }, statusEffects: {} };
const target = { id: 'target', hp: 100, statusEffects: {}, nextStaggerThreshold: 0 };
const other = { id: 'other', hp: 100, statusEffects: {} };

batch.prepareCantrip(caster, 'booming_blade');
engine.triggerEvent('[On Hit]', { engine, unitAttacker: caster, currentTarget: target, defender: target, skill: { id: 'melee', skillRange: 1 } }, [target]);
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
assert.equal(target.statusEffects.tremor.count, 1);

const flameCaster = { id: 'flame-caster', level: 30, statusEffects: {} };
const primary = { id: 'primary', hp: 100, statusEffects: {} };
const secondary = { id: 'secondary', hp: 100, statusEffects: {} };
const flameSkill = { id: 'slash', type: 'Normal', skillRange: 1, atkWeight: 1, attackWeight: 1, targeting_type: 'Focused Attack' };
batch.prepareCantrip(flameCaster, 'green_flame_blade');
const flameContext = { engine, unitAttacker: flameCaster, attacker: flameCaster, defender: primary, currentTarget: primary, skill: flameSkill, targetsHit: [primary, secondary], damageDealt: 100 };
engine.triggerEvent('[Before Attack]', flameContext, [primary]);
assert.equal(flameSkill.atkWeight, 2);
assert.equal(flameSkill.attackWeight, 2);
assert.equal(flameSkill.targeting_type, 'AoE');
engine.triggerEvent('[On Hit]', flameContext, [primary]);
assert.equal(primary.statusEffects.burn.potency, 3);
assert.equal(secondary.statusEffects.burn.potency, 3);
assert.equal(secondary.hp, 73);
engine.triggerEvent('[Attack End]', flameContext, [primary]);
assert.equal(flameSkill.atkWeight, 1);
assert.equal(flameSkill.attackWeight, 1);
assert.equal(flameSkill.targeting_type, 'Focused Attack');

const shCaster = { id: 'sh-caster', level: 30, dndStats: { wis: 20 }, statusEffects: {} };
batch.prepareCantrip(shCaster, 'shillelagh');
assert.equal(shCaster.statusEffects.shillelagh.count, 10);
assert.equal(batch.shillelaghDamagePercent(shCaster), 10);
assert.equal(engine.calculateCoinDamage(shCaster, target, { id: 'club', type: 'Normal', skillRange: 1 }, 10, false, 0, {}), 110);
assert.equal(engine.calculateCoinDamage(shCaster, target, { id: 'bow', type: 'Normal', skillRange: 2 }, 10, false, 0, {}), 100);
engine.triggerPhase('[Turn End]', [shCaster]);
assert.equal(shCaster.statusEffects.shillelagh.count, 9);

console.log('Weapon cantrip batch smoke: OK');
