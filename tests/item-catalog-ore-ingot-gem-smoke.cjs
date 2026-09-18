const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousOreIngotGemCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ore-ingot-gem.js')).href);

  const catalog = globalThis.LuminousOreIngotGemCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'ore_ingot_gem');
  assert.equal(catalog.MATERIAL_UNIT, 'material_unit');
  assert.equal(catalog.MATERIAL_UNIT_ABBREVIATION, 'MU');

  assert.equal(catalog.RAW_MINERALS.length, 31);
  assert.equal(catalog.REFINED_METALS.length, 25);
  assert.equal(catalog.ALLOYS.length, 16);
  assert.equal(catalog.ROUGH_GEMS.length, 12);
  assert.equal(catalog.CUT_GEMS.length, 12);
  assert.equal(catalog.ITEMS.length, 96);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 96);

  assert.equal(catalog.get('industrial_stone').standardUnitValueAhn, 4000);
  assert.equal(catalog.get('iron_ore').standardUnitValueAhn, 12000);
  assert.equal(catalog.get('titanium_ore').standardUnitValueAhn, 75000);
  assert.equal(catalog.get('rare_earth_concentrate').standardUnitValueAhn, 100000);
  assert.equal(catalog.get('exotic_industrial_mineral').standardUnitValueAhn, 300000);

  assert.equal(catalog.get('iron').standardUnitValueAhn, 20000);
  assert.equal(catalog.get('titanium').standardUnitValueAhn, 120000);
  assert.equal(catalog.get('titanium_alloy').standardUnitValueAhn, 185000);
  assert.equal(catalog.get('hardened_steel').standardUnitValueAhn, 90000);
  assert.equal(catalog.get('hardened_weapon_steel').id, 'hardened_steel');
  assert.equal(catalog.get('armor_steel').id, 'hardened_steel');
  assert.equal(catalog.get('exotic_alloy').standardUnitValueAhn, 650000);

  assert.equal(catalog.get('iron_ore').iconFamily, 'ore_raw');
  assert.equal(catalog.get('iron').iconFamily, 'metal_ingot');
  assert.equal(catalog.get('rough_ruby').iconFamily, 'gem_rough');
  assert.equal(catalog.get('ruby').iconFamily, 'gem_cut');

  assert.equal(catalog.get('rough_ruby').standardUnitValueAhn, 15000);
  assert.equal(catalog.get('ruby').standardUnitValueAhn, 40000);
  assert.equal(catalog.get('rough_diamond').standardUnitValueAhn, 35000);
  assert.equal(catalog.get('diamond').standardUnitValueAhn, 100000);
  assert.equal(catalog.get('rough_starstone_exotic_gem').standardUnitValueAhn, 60000);
  assert.equal(catalog.get('starstone_exotic_gem').standardUnitValueAhn, 180000);

  assert.deepEqual(catalog.get('ruby').resonanceTags, ['fire', 'heat']);
  assert.deepEqual(catalog.get('sapphire').resonanceTags, ['cold', 'ice']);
  assert.deepEqual(catalog.get('topaz').resonanceTags, ['lightning', 'energy']);
  assert.deepEqual(catalog.get('opal').resonanceTags, ['prismatic']);

  assert.equal(catalog.get('bauxite').id, 'bauxite_aluminum_ore');
  assert.equal(catalog.get('graphite').id, 'graphite_carbon_mineral');
  assert.equal(catalog.get('starstone').id, 'starstone_exotic_gem');
  assert.equal(catalog.get('rough_starstone').id, 'rough_starstone_exotic_gem');

  assert.equal(catalog.unitValueForQuality('diamond', 'exceptional'), 200000);
  assert.equal(catalog.unitValueForQuality('starstone', 'exceptional'), 360000);
  assert.equal(catalog.unitValueForQuality('iron_ore', 'fine'), 18000);

  assert.equal(catalog.canSourceFromCreatureBody('iron_ore'), true);
  assert.equal(catalog.canSourceFromCreatureBody('rough_ruby'), true);
  assert.equal(catalog.canSourceFromCreatureBody('iron'), false);
  assert.equal(catalog.canSourceFromCreatureBody('ruby'), false);
  assert.equal(catalog.CREATURE_MINERAL_HARVEST_RULE.replacesBiologicalFamilies, true);
  assert.equal(catalog.CREATURE_MINERAL_HARVEST_RULE.additiveOnlyWhenSourceActuallyHasBothAnatomies, true);
  assert.equal(catalog.CREATURE_MINERAL_HARVEST_RULE.preservesLineage, true);
  assert.equal(catalog.CREATURE_MINERAL_HARVEST_RULE.naturalGemsAreRoughByDefault, true);

  const golemOre = catalog.createCreatureHarvestStack('iron_ore', {
    materialUnits: 3,
    quality: 'fine',
    lineageId: 'stone_golem',
    lineageName: 'Stone Golem',
  });
  assert.ok(golemOre);
  assert.equal(golemOre.origin, 'creature_body');
  assert.equal(golemOre.quantity, 3);
  assert.equal(golemOre.materialUnits, 3);
  assert.equal(golemOre.lineageId, 'stone_golem');
  assert.equal(golemOre.displayName, 'Stone Golem Iron Ore');
  assert.equal(golemOre.unitValueAhn, 18000);
  assert.equal(golemOre.totalValueAhn, 54000);

  const roughGem = catalog.createCreatureHarvestStack('rough_ruby', {
    quantity: 1,
    lineageId: 'crystal_beast',
    lineageName: 'Crystal Beast',
  });
  assert.ok(roughGem);
  assert.equal(roughGem.origin, 'creature_body');
  assert.equal(roughGem.displayName, 'Crystal Beast Ruby');
  assert.equal(catalog.createCreatureHarvestStack('ruby', { quantity: 1 }), null);

  console.log(`Ore/Ingot/Gem catalog smoke: OK (${catalog.ITEMS.length} materials)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
