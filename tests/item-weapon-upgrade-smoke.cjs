const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousWeaponUpgradeCatalog;
  delete globalThis.LuminousWeaponUpgradeEngine;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapon-upgrades.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-weapon-upgrade-engine.js')).href);

  const catalog = globalThis.LuminousWeaponUpgradeCatalog;
  const engine = globalThis.LuminousWeaponUpgradeEngine;

  assert.ok(catalog);
  assert.ok(engine);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.UPGRADES.length, 65);
  assert.equal(engine.VERSION, 1);

  assert.equal(engine.slotsForMaterialDurability(8), 1);
  assert.equal(engine.slotsForMaterialDurability(19), 1);
  assert.equal(engine.slotsForMaterialDurability(20), 2);
  assert.equal(engine.slotsForMaterialDurability(34), 2);
  assert.equal(engine.slotsForMaterialDurability(35), 3);
  assert.equal(engine.slotsForMaterialDurability(100), 3);

  const ironBlade = {componentId:'long_blade',durability:50,composition:[{slot:'body',materialId:'iron',unitDurability:25}]};
  assert.equal(engine.componentUpgradeCapacity(ironBlade).slots, 2);
  assert.equal(engine.validateLoadout(ironBlade,['sharpened_edge','serrated_edge']).valid, true);
  assert.equal(engine.validateLoadout(ironBlade,['sharpened_edge','razor_edge']).reason, 'upgrade_group_conflict');
  assert.equal(engine.validateLoadout(ironBlade,['deep_serration','reinforced_blade']).reason, 'upgrade_slots_exceeded');

  const steelBlade = {componentId:'long_blade',durability:50,composition:[{slot:'body',materialId:'high_carbon_steel',unitDurability:35}]};
  assert.equal(engine.componentUpgradeCapacity(steelBlade).slots, 3);
  assert.equal(engine.validateLoadout(steelBlade,['razor_edge','serrated_edge','reinforced_blade']).valid, true);

  assert.equal(engine.modifiedComponentDurability(50,['razor_edge','reinforced_blade']).durability, 50);
  assert.equal(engine.modifiedComponentDurability(50,['razor_edge','deep_serration']).durability, 30);
  assert.equal(engine.modifiedComponentDurability(50,['razor_edge','deep_serration','needle_point']).durability, 20);
  assert.equal(engine.canInstallUpgrade({currentDurability:51,maxDurability:100}), true);
  assert.equal(engine.canInstallUpgrade({currentDurability:50,maxDurability:100}), false);

  const bleedSkill = {tags:['attack','physical'],damageType:'slash',usedComponentId:'long_blade',usedSurface:'edge',statusApplications:[{statusId:'bleed',potency:3,count:2}]};
  const serrated = engine.applyUpgradeToSkill(bleedSkill,'serrated_edge','long_blade').skill;
  assert.equal(serrated.statusApplications[0].potency, 4);
  assert.equal(serrated.statusApplications[0].count, 2);

  const countSkill = engine.applyUpgradeToSkill(bleedSkill,'retaining_teeth','long_blade').skill;
  assert.equal(countSkill.statusApplications[0].potency, 3);
  assert.equal(countSkill.statusApplications[0].count, 3);

  const noBleed = {tags:['attack','physical'],damageType:'slash',usedComponentId:'long_blade',usedSurface:'edge',statusApplications:[]};
  const noInjected = engine.applyUpgradeToSkill(noBleed,'serrated_edge','long_blade').skill;
  assert.deepEqual(noInjected.statusApplications, []);

  const countOnly = {tags:['attack','physical'],damageType:'slash',usedComponentId:'long_blade',usedSurface:'edge',statusApplications:[{statusId:'bleed',count:2}]};
  const noPotencyInjection = engine.applyUpgradeToSkill(countOnly,'serrated_edge','long_blade').skill;
  assert.equal(noPotencyInjection.statusApplications[0].potency, undefined);
  assert.equal(noPotencyInjection.statusApplications[0].count, 2);

  const slash = engine.applyUpgradeToSkill({tags:['attack'],damageType:'slash',usedComponentId:'long_blade',usedSurface:'edge'},'sharpened_edge','long_blade').skill;
  assert.equal(slash.modifiers.damagePercent, 10);

  assert.equal(engine.supportWearForSkill(1,['overweighted_head'],[]), 2);
  assert.equal(engine.supportWearForSkill(1,['overweighted_head'],['flexible_haft']), 1);

  console.log('Weapon upgrade engine smoke: OK (65 physical upgrades; material slots; durability; Skill payload Status amplification)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
