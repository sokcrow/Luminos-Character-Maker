const assert = require('assert');

require('../js/item-catalog-weapon-components.js');
require('../js/item-catalog-ranged-weapon-components.js');
require('../js/item-weapon-composition-engine.js');
const Composition = require('../js/item-ranged-weapon-composition-engine.js');
const Upgrades = require('../js/item-catalog-ranged-weapon-upgrades.js');
const Engine = require('../js/item-ranged-weapon-upgrade-engine.js');

assert.ok(Upgrades.UPGRADES.length >= 50, 'expected broad ranged upgrade coverage');
for (const upgrade of Upgrades.UPGRADES) {
  if (upgrade.scope === 'launcher') {
    assert.strictEqual(upgrade.damagePercent, 0, `${upgrade.id} launcher upgrade grants damage`);
    assert.strictEqual(upgrade.ammoPowerPercent, 0, `${upgrade.id} launcher upgrade grants ammo power`);
  }
}

const arrow = Composition.resolveAmmo('arrow');
const head = arrow.components.find((x) => x.componentId === 'projectile_head');
const shaft = arrow.components.find((x) => x.componentId === 'projectile_shaft');
const fletching = arrow.components.find((x) => x.componentId === 'fletching');
assert.strictEqual(Engine.componentUpgradeCapacity(head).slots, 2, 'iron head should have 2 slots');
assert.strictEqual(Engine.componentUpgradeCapacity(shaft).slots, 1, 'wood shaft should have 1 slot');
assert.strictEqual(Engine.componentUpgradeCapacity(fletching).slots, 1, 'textile fletching should have 1 slot');

assert.strictEqual(Engine.validateLoadout(head, ['ammo_honed_point','ammo_barbed_point']).valid, true);
const over = Engine.validateLoadout(head, ['ammo_needle_point','ammo_barbed_point']);
assert.strictEqual(over.valid, false);
assert.strictEqual(over.reason, 'upgrade_slots_exceeded');
const conflict = Engine.validateLoadout(head, ['ammo_honed_point','ammo_needle_point']);
assert.strictEqual(conflict.valid, false);
assert.strictEqual(conflict.reason, 'upgrade_group_conflict');

const bleedSkill = {damageType:'pierce',statusApplications:[{statusId:'bleed',potency:3}],modifiers:{}};
const bleedApplied = Engine.applyUpgradeToSkill(bleedSkill,'ammo_barbed_point','projectile_head');
assert.strictEqual(bleedApplied.skill.statusApplications[0].potency, 4);
const noBleed = Engine.applyUpgradeToSkill({damageType:'pierce',statusApplications:[],modifiers:{}},'ammo_barbed_point','projectile_head');
assert.deepStrictEqual(noBleed.skill.statusApplications, []);

const honed = Engine.applyUpgradeToSkill({damageType:'pierce',statusApplications:[],modifiers:{}},'ammo_honed_point','projectile_head');
assert.strictEqual(honed.skill.modifiers.damagePercent, 10);
const wrongType = Engine.applyUpgradeToSkill({damageType:'slash',statusApplications:[],modifiers:{}},'ammo_honed_point','projectile_head');
assert.strictEqual(wrongType.skill.modifiers.damagePercent, undefined);

const grade = Engine.applyAmmoGrade({modifiers:{}},'masterwork',true);
assert.strictEqual(grade.modifiers.ammoPowerPercent, 15);
const ineligible = Engine.applyAmmoGrade({modifiers:{}},'masterwork',false);
assert.strictEqual(ineligible.modifiers.ammoPowerPercent, undefined);

const bow = Composition.referenceBuild('shortbow');
const stave = bow.components.find((x) => x.componentId === 'bow_stave_short');
const tuned = Engine.applyUpgradeToSkill({damageType:'pierce',modifiers:{}},'bow_tuned_limbs','bow_stave_short');
assert.strictEqual(tuned.skill.modifiers.controlPercent, 10);
assert.strictEqual(tuned.skill.modifiers.clashPercent, 10);
assert.strictEqual(tuned.skill.modifiers.damagePercent, undefined);
assert.strictEqual(Engine.validateLoadout(stave,['bow_tuned_limbs']).valid,true);

const heavyAmmoLoadouts = [{componentId:'projectile_shaft',upgradeIds:['ammo_heavy_shaft']}];
const noTuning = Engine.resolveLauncherAmmoCompatibility([],heavyAmmoLoadouts);
assert.strictEqual(noTuning.appliedPenaltyPercent,10);
const tunedLauncher = [{componentId:'bow_stave_short',upgradeIds:['bow_heavy_tension_tuning']}];
const tunedCompat = Engine.resolveLauncherAmmoCompatibility(tunedLauncher,heavyAmmoLoadouts);
assert.strictEqual(tunedCompat.appliedPenaltyPercent,0);

const combined = Engine.applyRangedLoadoutToSkill({damageType:'pierce',statusApplications:[{statusId:'rupture',potency:2}],modifiers:{}},{
  launcherLoadouts:tunedLauncher,
  ammoLoadouts:[{componentId:'projectile_head',upgradeIds:['ammo_honed_point','ammo_breaker_point']}],
  ammoGrade:'precision',
  ammoGradeEligible:true,
});
assert.strictEqual(combined.modifiers.damagePercent,10);
assert.strictEqual(combined.modifiers.ammoPowerPercent,5);
assert.strictEqual(combined.statusApplications[0].potency,3);

const net = Composition.referenceBuild('net');
const mesh = net.components.find((x) => x.componentId === 'net_mesh');
assert.strictEqual(Engine.validateLoadout(mesh,['net_tight_mesh']).valid,true);

assert.strictEqual(Engine.canInstallUpgrade({currentDurability:50,maxDurability:100}),false);
assert.strictEqual(Engine.canInstallUpgrade({currentDurability:51,maxDurability:100}),true);
const floor = Engine.modifiedComponentDurability(25,['ammo_needle_point','ammo_razor_broadhead','ammo_deep_penetrator']);
assert.strictEqual(floor.durability,10,'40% durability floor should apply');

console.log('Ranged weapon upgrade smoke passed.');