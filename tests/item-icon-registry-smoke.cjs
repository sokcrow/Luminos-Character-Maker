const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-icon-registry.js')).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry);
  assert.equal(registry.VERSION, 12);
  assert.equal(registry.DEFAULT_GROUP, 'generic_item');
  assert.equal(Object.keys(registry.GROUPS).length, 87);
  assert.equal(registry.has('healing_hp'), true);
  assert.equal(registry.has('weapon_melee'), true);
  assert.equal(registry.has('trap'), false);
  assert.equal(registry.has('currency'), false);

  const groups = registry.list();
  assert.equal(new Set(groups.map((entry) => entry.id)).size, groups.length);
  for (const entry of groups) {
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.labelEs, 'string');
    assert.match(entry.icon, /^https:\/\/imgur\.com\/[A-Za-z0-9]+\.png$/);
  }

  assert.deepEqual(
    registry.list({ domain: 'equipment' }).map((entry) => entry.id),
    ['weapon_melee', 'weapon_ranged', 'shield', 'accessory', 'armor_light', 'armor_medium', 'armor_heavy']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => entry.id.startsWith('meat_')).map((entry) => entry.id),
    ['meat_mammal', 'meat_bird', 'meat_fish', 'meat_shellfish', 'meat_reptile', 'meat_draconic', 'meat_insectoid']
  );

  const mineralIconIds = ['ore_raw', 'metal_ingot', 'gem_rough', 'gem_cut'];
  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => mineralIconIds.includes(entry.id)).map((entry) => entry.id),
    mineralIconIds
  );

  const aliasExpectations = {
    'Light Armor': 'armor_light',
    'Melee Weapon': 'weapon_melee',
    food_meat: 'food',
    meat: 'meat_mammal',
    hide_leather: 'hide_mammal',
    bone_horn: 'hard_bone',
    fang: 'hard_claw',
    tusk: 'hard_horn',
    scale: 'scale_reptile',
    shell: 'shell_carapace',
    chitin: 'chitin_plate',
    feather: 'feather_raw',
    wool: 'animal_fiber_raw',
    raw_silk: 'silk_raw',
    ore: 'ore_raw',
    mineral: 'ore_raw',
    ore_mineral: 'ore_raw',
    ingot: 'metal_ingot',
    refined_metal: 'metal_ingot',
    alloy: 'metal_ingot',
    rough_gem: 'gem_rough',
    raw_gem: 'gem_rough',
    cut_gem: 'gem_cut',
    polished_gem: 'gem_cut',
    heart: 'organ_internal',
    eye: 'organ_sensory',
    brain: 'organ_brain',
    gland: 'organ_gland',
    humanoid_blood: 'blood',
    exotic_fluid: 'ichor',
    venom: 'venom_raw',
    toxic_secretion: 'venom_raw',
    acid: 'acid_secretion',
    ink: 'ink_secretion',
    pheromone: 'bio_secretion',
    slime: 'ooze_gel',
    conductive_gel: 'ooze_gel',
    arcane_essence: 'essence_raw',
    mana_core: 'energy_core',
    fruit: 'fruit_raw',
    vegetables: 'vegetable_raw',
    grain: 'grain_seed_raw',
    legume: 'grain_seed_raw',
    nut: 'grain_seed_raw',
    spice: 'spice_herb_raw',
    culinary_herb: 'spice_herb_raw',
    medicinal_herb: 'medicinal_herb_raw',
    toxic_herb: 'medicinal_herb_raw',
    mushroom: 'fungus_raw',
    sap: 'botanical_extract_raw',
    resin: 'botanical_extract_raw',
    botanical_extract: 'botanical_extract_raw',
  };
  for (const [alias, expected] of Object.entries(aliasExpectations)) {
    assert.equal(registry.canonicalGroupId(alias), expected);
  }

  const expectedIcons = {
    healing_hp: 'https://imgur.com/GcnX53v.png',
    food: 'https://imgur.com/uFmUpuD.png',
    meat_mammal: 'https://imgur.com/GQAGWzK.png',
    hide_mammal: 'https://imgur.com/nK6vQIR.png',
    hard_bone: 'https://imgur.com/HrqeZ0a.png',
    scale_reptile: 'https://imgur.com/cJz55WQ.png',
    feather_raw: 'https://imgur.com/EPkBtW0.png',
    organ_internal: 'https://imgur.com/rXlXbOG.png',
    blood: 'https://imgur.com/7a75QU2.png',
    venom_raw: 'https://imgur.com/8dBvLD5.png',
    ooze_gel: 'https://imgur.com/91cMoMg.png',
    essence_raw: 'https://imgur.com/Yay5U5o.png',
    energy_core: 'https://imgur.com/KBSJN7y.png',
    fruit_raw: 'https://imgur.com/JA0yMwM.png',
    vegetable_raw: 'https://imgur.com/QWUZK4g.png',
    grain_seed_raw: 'https://imgur.com/Z0TuVti.png',
    spice_herb_raw: 'https://imgur.com/zvEvhjc.png',
    medicinal_herb_raw: 'https://imgur.com/FY3Sda7.png',
    fungus_raw: 'https://imgur.com/YRTeaK5.png',
    botanical_extract_raw: 'https://imgur.com/818zarC.png',
    ore_raw: 'https://imgur.com/xR1qk05.png',
    metal_ingot: 'https://imgur.com/BNTZ6FI.png',
    gem_rough: 'https://imgur.com/18tq0PQ.png',
    gem_cut: 'https://imgur.com/sDAhiUI.png',
  };
  for (const [id, icon] of Object.entries(expectedIcons)) assert.equal(registry.resolveIcon(id), icon);
  assert.equal(registry.resolveIcon('ore_mineral'), 'https://imgur.com/xR1qk05.png');
  assert.equal(registry.get('missing-family').id, 'generic_item');
  assert.equal(registry.get('missing-family', { fallback: false }), null);

  delete globalThis.LuminousOreIngotGemCatalog;
  const catalog = require(path.resolve(__dirname, '../js/item-catalog-ore-ingot-gem.js'));
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'ore_ingot_gem');
  assert.equal(catalog.MATERIAL_UNIT_ABBREVIATION, 'MU');
  assert.equal(catalog.RAW_MINERALS.length, 31);
  assert.equal(catalog.REFINED_METALS.length, 25);
  assert.equal(catalog.ALLOYS.length, 17);
  assert.equal(catalog.ROUGH_GEMS.length, 12);
  assert.equal(catalog.CUT_GEMS.length, 12);
  assert.equal(catalog.ITEMS.length, 97);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 97);

  assert.equal(catalog.get('iron_ore').standardUnitValueAhn, 12000);
  assert.equal(catalog.get('titanium_ore').standardUnitValueAhn, 75000);
  assert.equal(catalog.get('exotic_industrial_mineral').standardUnitValueAhn, 300000);
  assert.equal(catalog.get('iron').standardUnitValueAhn, 20000);
  assert.equal(catalog.get('titanium_alloy').standardUnitValueAhn, 185000);
  assert.equal(catalog.get('exotic_alloy').standardUnitValueAhn, 650000);

  assert.equal(catalog.get('iron_ore').iconFamily, 'ore_raw');
  assert.equal(catalog.get('iron').iconFamily, 'metal_ingot');
  assert.equal(catalog.get('rough_ruby').iconFamily, 'gem_rough');
  assert.equal(catalog.get('ruby').iconFamily, 'gem_cut');
  assert.deepEqual(catalog.get('ruby').resonanceTags, ['fire', 'heat']);
  assert.deepEqual(catalog.get('topaz').resonanceTags, ['lightning', 'energy']);
  assert.equal(catalog.unitValueForQuality('diamond', 'exceptional'), 200000);
  assert.equal(catalog.unitValueForQuality('starstone', 'exceptional'), 360000);

  assert.equal(catalog.canSourceFromCreatureBody('iron_ore'), true);
  assert.equal(catalog.canSourceFromCreatureBody('rough_ruby'), true);
  assert.equal(catalog.canSourceFromCreatureBody('iron'), false);
  assert.equal(catalog.canSourceFromCreatureBody('ruby'), false);
  assert.equal(catalog.CREATURE_MINERAL_HARVEST_RULE.replacesBiologicalFamilies, true);
  assert.equal(catalog.CREATURE_MINERAL_HARVEST_RULE.naturalGemsAreRoughByDefault, true);

  const golemOre = catalog.createCreatureHarvestStack('iron_ore', {
    materialUnits: 3,
    quality: 'fine',
    lineageId: 'stone_golem',
    lineageName: 'Stone Golem',
  });
  assert.equal(golemOre.origin, 'creature_body');
  assert.equal(golemOre.quantity, 3);
  assert.equal(golemOre.lineageId, 'stone_golem');
  assert.equal(golemOre.displayName, 'Stone Golem Iron Ore');
  assert.equal(golemOre.unitValueAhn, 18000);
  assert.equal(golemOre.totalValueAhn, 54000);

  const roughGem = catalog.createCreatureHarvestStack('rough_ruby', {
    quantity: 1,
    lineageId: 'crystal_beast',
    lineageName: 'Crystal Beast',
  });
  assert.equal(roughGem.displayName, 'Crystal Beast Ruby');
  assert.equal(catalog.createCreatureHarvestStack('ruby', { quantity: 1 }), null);

  console.log(`Item icon registry + Ore/Ingot/Gem catalog smoke: OK (${groups.length} icon families, ${catalog.ITEMS.length} materials)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
