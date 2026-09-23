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
  assert.equal(catalog.VERSION, 3);
  assert.equal(catalog.FAMILY, 'ore_ingot_gem');
  assert.equal(catalog.MATERIAL_UNIT, 'material_unit');
  assert.equal(catalog.MATERIAL_UNIT_ABBREVIATION, 'MU');

  assert.equal(catalog.RAW_MINERALS.length, 32);
  assert.equal(catalog.REFINED_METALS.length, 26);
  assert.equal(catalog.ALLOYS.length, 16);
  assert.equal(catalog.ROUGH_GEMS.length, 12);
  assert.equal(catalog.CUT_GEMS.length, 12);
  assert.equal(catalog.ITEMS.length, 98);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 98);

  assert.equal(catalog.RAW_MINERAL_PRICING_MODEL, 'ahn_material_unit_tiered_v2');
  const rawV2 = {
    industrial_stone: ['mineral_industrial_stone', 10000],
    clay: ['mineral_clay', 12500],
    coal: ['mineral_coal', 17500],
    lead_ore: ['ore_lead', 25000],
    iron_ore: ['ore_iron', 30000],
    bauxite_aluminum_ore: ['ore_bauxite', 35000],
    zinc_ore: ['ore_zinc', 37500],
    tin_ore: ['ore_tin', 40000],
    copper_ore: ['ore_copper', 45000],
    graphite_carbon_mineral: ['mineral_graphite', 47500],
    manganese_ore: ['ore_manganese', 50000],
    obsidian: ['mineral_obsidian', 55000],
    quartz: ['mineral_quartz', 60000],
    nickel_ore: ['ore_nickel', 65000],
    chromium_ore: ['ore_chromium', 77500],
    lithium_ore: ['ore_lithium', 90000],
    molybdenum_ore: ['ore_molybdenum', 100000],
    vanadium_ore: ['ore_vanadium', 107500],
    cobalt_ore: ['ore_cobalt', 115000],
    silver_ore: ['ore_silver', 150000],
    tungsten_ore: ['ore_tungsten', 165000],
    titanium_ore: ['ore_titanium', 190000],
    niobium_ore: ['ore_niobium', 215000],
    gold_ore: ['ore_gold', 225000],
    tantalum_ore: ['ore_tantalum', 235000],
    rare_earth_concentrate: ['mineral_rare_earth', 275000],
    platinum_ore: ['ore_platinum', 300000],
    uranium_bearing_ore: ['ore_uranium', 350000],
    superconductive_mineral: ['mineral_superconductive', 500000],
    metamaterial_ore: ['ore_metamaterial', 625000],
    null_dampening_mineral: ['mineral_null_dampening', 800000],
    exotic_industrial_mineral: ['mineral_exotic_industrial', 1000000],
  };
  for (const [id, [iconFamily, valueAhn]] of Object.entries(rawV2)) {
    const item = catalog.get(id);
    assert.ok(item, id);
    assert.equal(item.iconFamily, iconFamily, id);
    assert.equal(item.standardUnitValueAhn, valueAhn, id);
    assert.equal(item.currency, 'AHN', id);
    assert.equal(item.measure, 'material_unit', id);
  }

  assert.equal(catalog.REFINED_PRICING_MODEL, 'source_raw_value_x_refinement_multiplier_v2');
  assert.equal(catalog.REFINEMENT_PROFILES.basic.multiplier, 1.50);
  assert.equal(catalog.REFINEMENT_PROFILES.specialized.multiplier, 1.60);
  assert.equal(catalog.REFINEMENT_PROFILES.advanced.multiplier, 1.70);
  assert.equal(catalog.REFINEMENT_PROFILES.corp.multiplier, 1.85);
  assert.equal(catalog.REFINEMENT_PROFILES.exotic.multiplier, 2.00);

  const refinedV2 = {
    lead: ['lead_ore', 'basic', 'ingot_lead', 37500],
    iron: ['iron_ore', 'basic', 'ingot_iron', 45000],
    aluminum: ['bauxite_aluminum_ore', 'basic', 'ingot_aluminum', 52500],
    zinc: ['zinc_ore', 'basic', 'ingot_zinc', 56250],
    tin: ['tin_ore', 'basic', 'ingot_tin', 60000],
    copper: ['copper_ore', 'basic', 'ingot_copper', 67500],
    manganese: ['manganese_ore', 'basic', 'ingot_manganese', 75000],
    nickel: ['nickel_ore', 'basic', 'ingot_nickel', 97500],
    chromium: ['chromium_ore', 'specialized', 'ingot_chromium', 124000],
    lithium: ['lithium_ore', 'specialized', 'ingot_lithium', 144000],
    molybdenum: ['molybdenum_ore', 'specialized', 'ingot_molybdenum', 160000],
    vanadium: ['vanadium_ore', 'specialized', 'ingot_vanadium', 172000],
    cobalt: ['cobalt_ore', 'specialized', 'ingot_cobalt', 184000],
    silver: ['silver_ore', 'specialized', 'ingot_silver', 240000],
    tungsten: ['tungsten_ore', 'specialized', 'ingot_tungsten', 264000],
    titanium: ['titanium_ore', 'specialized', 'ingot_titanium', 304000],
    gold: ['gold_ore', 'specialized', 'ingot_gold', 360000],
    niobium: ['niobium_ore', 'specialized', 'ingot_niobium', 344000],
    tantalum: ['tantalum_ore', 'specialized', 'ingot_tantalum', 376000],
    platinum: ['platinum_ore', 'specialized', 'ingot_platinum', 480000],
    rare_earth_refined_material: ['rare_earth_concentrate', 'advanced', 'material_rare_earth_refined', 467500],
    refined_uranium_material: ['uranium_bearing_ore', 'advanced', 'material_uranium_refined', 595000],
    superconductive_material: ['superconductive_mineral', 'corp', 'material_superconductive', 925000],
    refined_metamaterial: ['metamaterial_ore', 'corp', 'material_metamaterial_refined', 1156250],
    null_dampening_material: ['null_dampening_mineral', 'exotic', 'material_null_dampening', 1600000],
    exotic_refined_material: ['exotic_industrial_mineral', 'exotic', 'material_exotic_refined', 2000000],
  };
  for (const [id, [sourceRawId, profile, iconFamily, valueAhn]] of Object.entries(refinedV2)) {
    const item = catalog.get(id);
    const raw = catalog.get(sourceRawId);
    assert.ok(item, id);
    assert.ok(raw, sourceRawId);
    assert.equal(item.sourceRawId, sourceRawId, id);
    assert.equal(item.refinementProfile, profile, id);
    assert.equal(item.iconFamily, iconFamily, id);
    assert.equal(item.standardUnitValueAhn, valueAhn, id);
    assert.equal(item.standardUnitValueAhn, Math.round(raw.standardUnitValueAhn * item.refinementMultiplier), id);
    assert.ok(item.standardUnitValueAhn > raw.standardUnitValueAhn, id);
  }

  assert.equal(catalog.get('titanium_alloy').standardUnitValueAhn, 462500);
  assert.equal(catalog.get('hardened_steel').standardUnitValueAhn, 225000);
  assert.equal(catalog.get('hardened_weapon_steel').id, 'hardened_steel');
  assert.equal(catalog.get('armor_steel').id, 'hardened_steel');
  assert.equal(catalog.get('exotic_alloy').standardUnitValueAhn, 1625000);

  assert.equal(catalog.get('iron_ore').iconFamily, 'ore_iron');
  assert.equal(catalog.get('iron').iconFamily, 'ingot_iron');
  assert.equal(catalog.get('rough_ruby').iconFamily, 'gem_rough');
  assert.equal(catalog.get('ruby').iconFamily, 'gem_cut');

  assert.equal(catalog.get('rough_ruby').standardUnitValueAhn, 37500);
  assert.equal(catalog.get('ruby').standardUnitValueAhn, 100000);
  assert.equal(catalog.get('rough_diamond').standardUnitValueAhn, 87500);
  assert.equal(catalog.get('diamond').standardUnitValueAhn, 250000);
  assert.equal(catalog.get('rough_starstone_exotic_gem').standardUnitValueAhn, 150000);
  assert.equal(catalog.get('starstone_exotic_gem').standardUnitValueAhn, 450000);

  assert.deepEqual(catalog.get('ruby').resonanceTags, ['fire', 'heat']);
  assert.deepEqual(catalog.get('sapphire').resonanceTags, ['cold', 'ice']);
  assert.deepEqual(catalog.get('topaz').resonanceTags, ['lightning', 'energy']);
  assert.deepEqual(catalog.get('opal').resonanceTags, ['prismatic']);

  assert.equal(catalog.get('bauxite').id, 'bauxite_aluminum_ore');
  assert.equal(catalog.get('graphite').id, 'graphite_carbon_mineral');
  assert.equal(catalog.get('starstone').id, 'starstone_exotic_gem');
  assert.equal(catalog.get('raw_platinum').id, 'platinum_ore');
  assert.equal(catalog.get('platinum_ingot').id, 'platinum');
  assert.equal(catalog.get('refined_platinum').id, 'platinum');
  assert.equal(catalog.get('rough_starstone').id, 'rough_starstone_exotic_gem');

  assert.equal(catalog.unitValueForQuality('diamond', 'exceptional'), 500000);
  assert.equal(catalog.unitValueForQuality('starstone', 'exceptional'), 900000);
  assert.equal(catalog.unitValueForQuality('iron_ore', 'fine'), 45000);

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
  assert.equal(golemOre.unitValueAhn, 45000);
  assert.equal(golemOre.totalValueAhn, 135000);

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
