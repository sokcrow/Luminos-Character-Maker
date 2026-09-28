const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousRangedWeaponComponentCatalog;
  delete globalThis.LuminousWeaponCompositionEngine;
  delete globalThis.LuminousRangedWeaponCompositionEngine;
  delete globalThis.LuminousRangedWeaponUpgradeCatalog;
  delete globalThis.LuminousRangedWeaponUpgradeEngine;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ranged-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-weapon-composition-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-ranged-weapon-composition-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ranged-weapon-upgrades.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-ranged-weapon-upgrade-engine.js')).href);

  const Composition = globalThis.LuminousRangedWeaponCompositionEngine;
  const Upgrades = globalThis.LuminousRangedWeaponUpgradeCatalog;
  const Engine = globalThis.LuminousRangedWeaponUpgradeEngine;

  assert.ok(Composition);
  assert.ok(Upgrades);
  assert.ok(Engine);
  assert.ok(Upgrades.UPGRADES.length >= 50, 'expected broad ranged upgrade coverage');
  for (const upgrade of Upgrades.UPGRADES) {
    if (upgrade.scope === 'launcher') {
      assert.equal(upgrade.damagePercent, 0, `${upgrade.id} launcher upgrade grants damage`);
      assert.equal(upgrade.ammoPowerPercent, 0, `${upgrade.id} launcher upgrade grants ammo power`);
    }
  }

  const arrow = Composition.resolveAmmo('arrow');
  const head = arrow.components.find((x) => x.componentId === 'projectile_head');
  const shaft = arrow.components.find((x) => x.componentId === 'projectile_shaft');
  const fletching = arrow.components.find((x) => x.componentId === 'fletching');
  assert.equal(Engine.componentUpgradeCapacity(head).slots, 2, 'iron head should have 2 slots');
  assert.equal(Engine.componentUpgradeCapacity(shaft).slots, 1, 'wood shaft should have 1 slot');
  assert.equal(Engine.componentUpgradeCapacity(fletching).slots, 1, 'textile fletching should have 1 slot');

  assert.equal(Engine.validateLoadout(head, ['ammo_honed_point','ammo_barbed_point']).valid, true);
  const over = Engine.validateLoadout(head, ['ammo_needle_point','ammo_barbed_point']);
  assert.equal(over.valid, false);
  assert.equal(over.reason, 'upgrade_slots_exceeded');
  const conflict = Engine.validateLoadout(head, ['ammo_honed_point','ammo_needle_point']);
  assert.equal(conflict.valid, false);
  assert.equal(conflict.reason, 'upgrade_group_conflict');

  const bleedSkill = {damageType:'pierce',statusApplications:[{statusId:'bleed',potency:3}],modifiers:{}};
  const bleedApplied = Engine.applyUpgradeToSkill(bleedSkill,'ammo_barbed_point','projectile_head');
  assert.equal(bleedApplied.skill.statusApplications[0].potency, 4);
  const noBleed = Engine.applyUpgradeToSkill({damageType:'pierce',statusApplications:[],modifiers:{}},'ammo_barbed_point','projectile_head');
  assert.deepEqual(noBleed.skill.statusApplications, []);

  const honed = Engine.applyUpgradeToSkill({damageType:'pierce',statusApplications:[],modifiers:{}},'ammo_honed_point','projectile_head');
  assert.equal(honed.skill.modifiers.damagePercent, 10);
  const wrongType = Engine.applyUpgradeToSkill({damageType:'slash',statusApplications:[],modifiers:{}},'ammo_honed_point','projectile_head');
  assert.equal(wrongType.skill.modifiers.damagePercent, undefined);

  const grade = Engine.applyAmmoGrade({modifiers:{}},'masterwork',true);
  assert.equal(grade.modifiers.ammoPowerPercent, 15);
  const ineligible = Engine.applyAmmoGrade({modifiers:{}},'masterwork',false);
  assert.equal(ineligible.modifiers.ammoPowerPercent, undefined);

  const bow = Composition.referenceBuild('shortbow');
  const stave = bow.components.find((x) => x.componentId === 'bow_stave_short');
  const tuned = Engine.applyUpgradeToSkill({damageType:'pierce',modifiers:{}},'bow_tuned_limbs','bow_stave_short');
  assert.equal(tuned.skill.modifiers.controlPercent, 10);
  assert.equal(tuned.skill.modifiers.clashPercent, 10);
  assert.equal(tuned.skill.modifiers.damagePercent, undefined);
  assert.equal(Engine.validateLoadout(stave,['bow_tuned_limbs']).valid,true);

  const heavyAmmoLoadouts = [{componentId:'projectile_shaft',upgradeIds:['ammo_heavy_shaft']}];
  const noTuning = Engine.resolveLauncherAmmoCompatibility([],heavyAmmoLoadouts);
  assert.equal(noTuning.appliedPenaltyPercent,10);
  const tunedLauncher = [{componentId:'bow_stave_short',upgradeIds:['bow_heavy_tension_tuning']}];
  const tunedCompat = Engine.resolveLauncherAmmoCompatibility(tunedLauncher,heavyAmmoLoadouts);
  assert.equal(tunedCompat.appliedPenaltyPercent,0);

  const combined = Engine.applyRangedLoadoutToSkill({damageType:'pierce',statusApplications:[{statusId:'rupture',potency:2}],modifiers:{}},{
    launcherLoadouts:tunedLauncher,
    ammoLoadouts:[{componentId:'projectile_head',upgradeIds:['ammo_honed_point','ammo_breaker_point']}],
    ammoGrade:'precision',
    ammoGradeEligible:true,
  });
  assert.equal(combined.modifiers.damagePercent,10);
  assert.equal(combined.modifiers.ammoPowerPercent,5);
  assert.equal(combined.statusApplications[0].potency,3);

  const net = Composition.referenceBuild('net');
  const mesh = net.components.find((x) => x.componentId === 'net_mesh');
  assert.equal(Engine.validateLoadout(mesh,['net_tight_mesh']).valid,true);

  assert.equal(Engine.canInstallUpgrade({currentDurability:50,maxDurability:100}),false);
  assert.equal(Engine.canInstallUpgrade({currentDurability:51,maxDurability:100}),true);
  const floor = Engine.modifiedComponentDurability(25,['ammo_needle_point','ammo_razor_broadhead','ammo_deep_penetrator']);
  assert.equal(floor.durability,10,'40% durability floor should apply');

  console.log('Ranged weapon upgrade smoke passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});