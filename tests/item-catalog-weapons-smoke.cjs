const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousWeaponCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapons.js')).href);
  const catalog = globalThis.LuminousWeaponCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'weapons');
  assert.equal(catalog.PRICING_MODEL, 'chassis_reference_plus_materials_and_upgrades');
  assert.equal(catalog.PRICE_REFERENCE_SCOPE, 'chassis_only');
  assert.equal(catalog.MATERIAL_DURABILITY_STATUS, 'pending_material_table');
  assert.equal(catalog.ITEMS.length, 37);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 37);

  assert.deepEqual(catalog.QUALITY_ORDER, ['ruined', 'poor', 'standard', 'fine', 'exceptional']);
  assert.equal(catalog.damageMultiplierForQuality('ruined'), 0.60);
  assert.equal(catalog.damageMultiplierForQuality('poor'), 0.80);
  assert.equal(catalog.damageMultiplierForQuality('standard'), 1.00);
  assert.equal(catalog.damageMultiplierForQuality('fine'), 1.20);
  assert.equal(catalog.damageMultiplierForQuality('exceptional'), 1.40);

  assert.equal(catalog.chassisValueForQuality('longsword', 'ruined'), 20000);
  assert.equal(catalog.chassisValueForQuality('longsword', 'poor'), 55000);
  assert.equal(catalog.chassisValueForQuality('longsword', 'standard'), 100000);
  assert.equal(catalog.chassisValueForQuality('longsword', 'fine'), 165000);
  assert.equal(catalog.chassisValueForQuality('longsword', 'exceptional'), 250000);
  assert.equal(catalog.chassisValueForQuality('heavy_crossbow', 'exceptional'), 600000);

  assert.equal(catalog.get('dagger').standardChassisValueAhn, 35000);
  assert.equal(catalog.get('greatsword').standardChassisValueAhn, 160000);
  assert.equal(catalog.get('greatsword').equipment.handCost, 2);
  assert.equal(catalog.get('longsword').equipment.handCost, 1);
  assert.equal(catalog.get('longbow').iconFamily, 'weapon_bow');
  assert.equal(catalog.get('war_pick').iconFamily, 'weapon_pick');

  assert.equal(catalog.maxDurability('longsword', 1, 'standard'), 50);
  assert.equal(catalog.maxDurability('longsword', 1, 'fine'), 63);
  assert.equal(catalog.maxDurability('longsword', 1.4, 'exceptional'), 105);
  assert.equal(catalog.maxDurability('greatsword', 1, 'standard'), 65);
  assert.equal(catalog.maxDurability('maul', 1, 'standard'), 80);

  const fineBreak = catalog.resolveDurabilityBreak('longsword', { quality: 'fine', currentDurability: 0, materialDurabilityModifier: 1 });
  assert.equal(fineBreak.degraded, true);
  assert.equal(fineBreak.quality, 'standard');
  assert.equal(fineBreak.currentDurability, 50);
  assert.equal(fineBreak.destroyed, false);

  const poorBreak = catalog.resolveDurabilityBreak('dagger', { quality: 'poor', currentDurability: 0, materialDurabilityModifier: 1 });
  assert.equal(poorBreak.quality, 'ruined');
  assert.equal(poorBreak.improvised, true);
  assert.equal(poorBreak.destroyed, false);

  const ruinedBreak = catalog.resolveDurabilityBreak('dagger', { quality: 'ruined', currentDurability: 0, materialDurabilityModifier: 1 });
  assert.equal(ruinedBreak.destroyed, true);
  assert.equal(ruinedBreak.quality, 'ruined');

  const repaired = catalog.repairState('greatsword', { quality: 'poor', currentDurability: 2, materialDurabilityModifier: 1 });
  assert.equal(repaired.quality, 'poor');
  assert.equal(repaired.currentDurability, 49);
  assert.equal(repaired.maxDurability, 49);

  const daggerRecipe = catalog.getRecipe('dagger');
  assert.equal(daggerRecipe.recipeProfile, 'small_blade');
  assert.equal(daggerRecipe.requiredToolType, 'smithing_tools');
  assert.equal(daggerRecipe.semanticCheck, 'smithing');
  assert.equal(daggerRecipe.baseThreshold, 18);
  assert.equal(daggerRecipe.assemblyMultiplier, 1.30);
  assert.deepEqual(daggerRecipe.inputTags, ['refined_weapon_material', 'structural_handle']);
  assert.equal(daggerRecipe.exactMaterialQuantitiesStatus, 'deferred_material_binding');

  const heavyCrossbowRecipe = catalog.getRecipe('heavy_crossbow');
  assert.equal(heavyCrossbowRecipe.recipeProfile, 'reinforced_crossbow');
  assert.equal(heavyCrossbowRecipe.requiredToolType, 'technical_tools');
  assert.equal(heavyCrossbowRecipe.baseThreshold, 22);
  assert.equal(heavyCrossbowRecipe.assemblyMultiplier, 1.65);
  assert.ok(heavyCrossbowRecipe.inputTags.includes('mechanical_assembly'));

  const expectedIconFamilies = [
    'weapon_blunt', 'weapon_dagger', 'weapon_axe', 'weapon_hammer', 'weapon_staff', 'weapon_spear',
    'weapon_crossbow', 'weapon_bow', 'weapon_sling', 'weapon_polearm', 'weapon_sword', 'weapon_pick',
    'weapon_whip', 'weapon_blowgun', 'weapon_net'
  ];
  for (const iconFamily of expectedIconFamilies) assert.ok(catalog.list({ iconFamily }).length >= 1, iconFamily);

  for (const item of catalog.ITEMS) {
    assert.equal(item.category, 'weapon');
    assert.equal(item.itemType, 'weapon');
    assert.equal(item.qualitySystem, 'weapon');
    assert.equal(item.priceReferenceScope, 'chassis_only');
    assert.ok(item.standardChassisValueAhn > 0);
    assert.ok(item.baseDurability > 0);
    assert.ok([1, 2].includes(item.handCost));
    assert.ok(item.iconFamily.startsWith('weapon_'));
    assert.ok(item.recipe);
    assert.equal(item.recipe.outputQuality, 'craft_check');
    assert.equal(item.recipe.improvisedThresholdDelta, 3);
    assert.ok([18, 22].includes(item.recipe.baseThreshold));
  }

  console.log('Weapon catalog smoke: OK (37 chassis + semantic recipes + weapon quality/durability)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
