const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousCookingEngine;
  delete globalThis.LuminousItemAffinityEngine;
  delete globalThis.LuminousCulinaryAffinityCatalog;
  delete globalThis.LuminousItemProcessingEngine;
  delete globalThis.LuminousPlantProduceCatalog;
  delete globalThis.LuminousMeatCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-cooking-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-affinity-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-culinary-affinity-data.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-processing-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-plant-produce.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-meat.js')).href);

  const cooking = globalThis.LuminousCookingEngine;
  const processing = globalThis.LuminousItemProcessingEngine;
  const plants = globalThis.LuminousPlantProduceCatalog;
  const meat = globalThis.LuminousMeatCatalog;

  assert.ok(cooking);
  assert.ok(processing);
  assert.ok(plants);
  assert.ok(meat);
  assert.equal(processing.VERSION, 1);
  assert.equal(processing.PROCESSED_FAMILY, 'processed_food');
  assert.equal(Object.keys(processing.METHODS).length, 28);

  const thValidation = processing.validateMethodThAgainstCooking();
  assert.equal(thValidation.checked, true);
  assert.equal(thValidation.valid, true);
  assert.deepEqual(thValidation.mismatches, []);

  for (const item of [...plants.ITEMS, ...meat.ITEMS]) {
    const methods = processing.availableMethodIds(item);
    assert.ok(methods.length > 0, `no processing methods for ${item.id}`);
    for (const methodId of methods) {
      assert.ok(processing.METHODS[methodId], `unknown method ${methodId} on ${item.id}`);
    }
  }

  const apple = plants.get('apple');
  const appleMethods = processing.availableMethodIds(apple);
  for (const expected of ['cut', 'chop', 'crush', 'mash', 'juice', 'dry', 'pickle', 'ferment', 'bake']) {
    assert.equal(appleMethods.includes(expected), true, `apple missing ${expected}`);
  }

  const wheat = plants.get('wheat');
  assert.equal(processing.availableMethodIds(wheat).includes('grind'), true);

  const wheatStack = plants.createIngredientStack('wheat', {
    quantity: 2,
    quality: 'standard',
    sourceInstanceId: 'wheat-a',
    affinityRoll: 0,
  });
  const flour = processing.createProcessedItem({ ...wheat, ...wheatStack }, 'grind', {
    outputQuantity: 2,
  });
  assert.equal(flour.created, true);
  assert.equal(flour.itemId, 'processed_flour');
  assert.equal(flour.name, 'Flour');
  assert.equal(flour.processedForm, 'flour');
  assert.equal(flour.processedStabilizationHint, 0);
  assert.equal(flour.outputMode, 'canonical');
  assert.deepEqual(flour.sourceItemIds, ['wheat']);
  assert.equal(flour.culinaryProperties.length, 1);
  assert.equal(flour.culinaryProperties[0].sourceInstanceId, 'wheat-a');

  const water = {
    itemId: 'water',
    name: 'Water',
    processingTags: ['liquid', 'water'],
    quantity: 1,
  };
  const doughCheck = processing.canProcess([flour, water], 'knead');
  assert.equal(doughCheck.allowed, true);
  const dough = processing.createProcessedItem([flour, water], 'knead');
  assert.equal(dough.itemId, 'processed_dough');
  assert.equal(dough.processedForm, 'dough');
  assert.equal(dough.processedStabilizationHint, 2);
  assert.equal(dough.culinaryProperties.length, 1);
  assert.equal(dough.culinaryProperties[0].sourceInstanceId, 'wheat-a');
  assert.equal(processing.availableMethodIds(dough).includes('bake'), true);

  const appleStack = plants.createIngredientStack('apple', {
    sourceInstanceId: 'apple-a',
    affinityRoll: 0,
  });
  const appleJuice = processing.createProcessedItem({ ...apple, ...appleStack }, 'juice');
  assert.equal(appleJuice.created, true);
  assert.equal(appleJuice.processedForm, 'juice');
  assert.equal(appleJuice.outputMode, 'procedural');
  assert.equal(appleJuice.name, 'Apple Juice');
  assert.equal(appleJuice.culinaryProperties[0].sourceInstanceId, 'apple-a');

  const syrup = processing.createProcessedItem(appleJuice, 'reduce');
  assert.equal(syrup.created, true);
  assert.equal(syrup.itemId, 'processed_syrup');
  assert.equal(syrup.processedForm, 'syrup');
  assert.equal(syrup.processedStabilizationHint, 2);
  assert.equal(syrup.culinaryProperties.length, 1);
  assert.equal(syrup.culinaryProperties[0].sourceInstanceId, 'apple-a');

  const wolfDef = meat.get('meat_wolf');
  const wolfStack = meat.createHarvestStack('meat_wolf', {
    quantity: 2,
    sourceInstanceId: 'wolf-a',
    affinityRoll: 0,
  });
  const smokedWolf = processing.createProcessedItem({ ...wolfDef, ...wolfStack }, 'smoke');
  assert.equal(smokedWolf.created, true);
  assert.equal(smokedWolf.name, 'Smoked Wolf Meat');
  assert.equal(smokedWolf.processedForm, 'smoked');
  assert.equal(smokedWolf.processedStabilizationHint, 2);
  assert.equal(smokedWolf.culinaryProperties[0].sourceInstanceId, 'wolf-a');

  const carrotDef = plants.get('carrot');
  const carrotStack = plants.createIngredientStack('carrot', {
    sourceInstanceId: 'carrot-a',
    affinityRoll: 0,
  });
  const stock = processing.createProcessedItem([
    { ...wolfDef, ...wolfStack },
    { ...carrotDef, ...carrotStack },
  ], 'simmer');
  assert.equal(stock.created, true);
  assert.equal(stock.itemId, 'processed_stock');
  assert.equal(stock.processedForm, 'stock');
  assert.equal(stock.outputMode, 'canonical');
  assert.equal(stock.culinaryProperties.length, 2);
  assert.deepEqual(
    new Set(stock.culinaryProperties.map((entry) => entry.sourceInstanceId)),
    new Set(['wolf-a', 'carrot-a'])
  );

  const sameWolfAgain = processing.createProcessedItem([
    { ...wolfDef, ...wolfStack },
    { ...wolfDef, ...wolfStack },
  ], 'simmer');
  assert.equal(sameWolfAgain.culinaryProperties.length, 1);

  const processRecipe = processing.buildProcessingRecipe({ ...wheat, ...wheatStack }, 'grind', {
    ability: 'dex',
  });
  assert.equal(processRecipe.valid, true);
  assert.equal(processRecipe.method.baseTh, 9);
  assert.equal(processRecipe.recipe.method, 'mixing');
  assert.ok(processRecipe.th.recipeTh >= 8 && processRecipe.th.recipeTh <= 24);

  const denied = {
    ...apple,
    processingMethodsDenied: ['ferment', 'dry'],
  };
  const deniedMethods = processing.availableMethodIds(denied);
  assert.equal(deniedMethods.includes('ferment'), false);
  assert.equal(deniedMethods.includes('dry'), false);
  assert.equal(deniedMethods.includes('cut'), true);

  assert.equal(processing.canProcess(apple, 'distill').allowed, false);
  assert.equal(processing.canProcess([flour], 'knead').allowed, false);

  console.log('Item Processing V1 smoke: OK (115-item eligibility, procedural/canonical outputs, TH and provenance)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
