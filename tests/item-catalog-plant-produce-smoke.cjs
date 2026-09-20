const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemAffinityEngine;
  delete globalThis.LuminousCulinaryAffinityCatalog;
  delete globalThis.LuminousItemProcessingRecipeData;
  delete globalThis.LuminousItemProcessingEngine;
  delete globalThis.LuminousPlantProduceCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-affinity-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-culinary-affinity-data.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-processing-recipe-data.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-processing-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-plant-produce.js')).href);

  const catalog = globalThis.LuminousPlantProduceCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'plant_produce');
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.equal(catalog.MEASURE, 'market_unit');
  assert.equal(catalog.RECIPES_IMPLEMENTED, false);
  assert.equal(catalog.ITEMS.length, 92);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 92);

  const groupCounts = Object.fromEntries(
    [...new Set(catalog.ITEMS.map((entry) => entry.group))]
      .map((group) => [group, catalog.list({ group }).length])
  );
  assert.deepEqual(groupCounts, {
    fruit: 18,
    vegetable: 16,
    grain_legume: 10,
    nut_seed: 11,
    spice: 10,
    culinary_herb: 8,
    medicinal_toxic_herb: 8,
    fungus: 7,
    botanical_extract: 4,
  });

  const approvedIcons = new Set([
    'fruit_raw',
    'vegetable_raw',
    'grain_seed_raw',
    'spice_herb_raw',
    'medicinal_herb_raw',
    'fungus_raw',
    'botanical_extract_raw',
  ]);

  for (const entry of catalog.ITEMS) {
    assert.equal(entry.family, 'plant_produce');
    assert.equal(entry.currency, 'AHN');
    assert.equal(entry.measure, 'market_unit');
    assert.equal(entry.qualitySystem, 'universal');
    assert.equal(entry.recipesImplemented, false);
    assert.equal(entry.gatheringModel, 'deferred');
    assert.ok(entry.standardUnitValueAhn > 0);
    assert.equal(approvedIcons.has(entry.iconFamily), true);
    assert.equal(Array.isArray(entry.recipeRoles), true);
    assert.equal(Array.isArray(entry.flavorTags), true);
    assert.equal(Array.isArray(entry.functionalTags), true);
    assert.equal(Array.isArray(entry.craftTags), true);
    assert.equal(globalThis.LuminousItemAffinityEngine.isCanonicalAffinityDistribution(entry), true);
    assert.equal(entry.stackPolicy, 'identical_item_quality_affinity');
  }

  assert.equal(catalog.get('apple').standardUnitValueAhn, 1800);
  assert.equal(catalog.get('tomato').standardUnitValueAhn, 1800);
  assert.equal(catalog.get('wheat').standardUnitValueAhn, 900);
  assert.equal(catalog.get('rare_spice').standardUnitValueAhn, 18000);
  assert.equal(catalog.get('nightshade').standardUnitValueAhn, 18000);
  assert.equal(catalog.get('exotic_medicinal_herb').standardUnitValueAhn, 45000);
  assert.equal(catalog.get('exotic_fungus').standardUnitValueAhn, 30000);
  assert.equal(catalog.get('exotic_botanical_extract').standardUnitValueAhn, 15000);
  assert.equal(catalog.get('pineapple').standardUnitValueAhn, 3600);
  assert.equal(catalog.get('sweet_potato').standardUnitValueAhn, 1800);
  assert.equal(catalog.get('truffle').standardUnitValueAhn, 30000);
  assert.equal(catalog.get('cacao').standardUnitValueAhn, 5400);
  assert.equal(catalog.get('coffee_bean').standardUnitValueAhn, 4200);

  assert.equal(catalog.get('tomato').iconFamily, 'vegetable_raw');
  assert.equal(catalog.get('almond').iconFamily, 'grain_seed_raw');
  assert.equal(catalog.get('rosemary').iconFamily, 'spice_herb_raw');
  assert.equal(catalog.get('nightshade').iconFamily, 'medicinal_herb_raw');
  assert.equal(catalog.get('common_mushroom').iconFamily, 'fungus_raw');
  assert.equal(catalog.get('resin').iconFamily, 'botanical_extract_raw');
  assert.equal(catalog.get('pineapple').iconFamily, 'fruit_raw');
  assert.equal(catalog.get('sweet_potato').iconFamily, 'vegetable_raw');
  assert.equal(catalog.get('tea_leaf').iconFamily, 'spice_herb_raw');
  assert.equal(catalog.get('truffle').iconFamily, 'fungus_raw');

  assert.equal(catalog.list({ recipeRole: 'protein' }).some((entry) => entry.id === 'beans'), true);
  assert.equal(catalog.list({ functionalTag: 'oil_source' }).some((entry) => entry.id === 'sesame_seed'), true);
  assert.equal(catalog.list({ functionalTag: 'fermentable' }).some((entry) => entry.id === 'grape'), true);
  assert.equal(catalog.list({ craftTag: 'medicine' }).some((entry) => entry.id === 'medicinal_herb'), true);
  assert.equal(catalog.list({ craftTag: 'poison' }).some((entry) => entry.id === 'nightshade'), true);
  assert.equal(catalog.list({ flavorTag: 'cooling' }).some((entry) => entry.id === 'mint'), true);
  assert.equal(catalog.list({ functionalTag: 'chocolate_source' }).some((entry) => entry.id === 'cacao'), true);
  assert.equal(catalog.list({ functionalTag: 'coffee_source' }).some((entry) => entry.id === 'coffee_bean'), true);
  assert.equal(catalog.processingMethodsFor('pineapple').some((entry) => entry.id === 'juice'), true);
  assert.equal(catalog.processingMethodsFor('coconut').some((entry) => entry.id === 'press'), true);
  assert.equal(catalog.processingMethodsFor('tea_leaf').some((entry) => entry.id === 'brew'), true);

  assert.equal(catalog.get('mushroom').id, 'common_mushroom');
  assert.equal(catalog.get('healing_herb').id, 'medicinal_herb');
  assert.equal(catalog.get('latex').id, 'plant_latex');

  assert.equal(catalog.unitValueForQuality('apple', 'standard'), 1800);
  assert.equal(catalog.unitValueForQuality('apple', 'exceptional'), 3600);

  const stack = catalog.createIngredientStack('potato', {
    quantity: 4,
    quality: 'fine',
    sourceInstanceId: 'potato-stack-a',
    affinityRoll: 0,
  });
  assert.equal(stack.quantity, 4);
  assert.equal(stack.quality, 'fine');
  assert.equal(stack.unitValueAhn, 1800);
  assert.equal(stack.totalValueAhn, 7200);
  assert.equal(stack.recipesImplemented, false);
  assert.equal(stack.sourceInstanceId, 'potato-stack-a');
  assert.equal(stack.affinityTarget, 'athletics');
  assert.equal(stack.affinityBranch, 'str');
  assert.equal(stack.culinaryProperties.length, 1);
  assert.equal(stack.stackPolicy, 'identical_item_quality_affinity');
  assert.equal(catalog.processingMethodsFor('apple').some((entry) => entry.id === 'juice'), true);
  const driedPotato = catalog.processIngredient(stack, 'dry');
  assert.equal(driedPotato.created, true);
  assert.equal(driedPotato.processedForm, 'dried');
  assert.equal(driedPotato.affinityTarget, stack.affinityTarget);

  console.log('Plant produce catalog smoke: OK (92 canonical ingredients, recipes deferred)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
