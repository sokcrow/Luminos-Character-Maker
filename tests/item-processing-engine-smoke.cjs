const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousCookingEngine;
  delete globalThis.LuminousItemAffinityEngine;
  delete globalThis.LuminousCulinaryAffinityCatalog;
  delete globalThis.LuminousItemProcessingRecipeData;
  delete globalThis.LuminousItemProcessingEngine;
  delete globalThis.LuminousPlantProduceCatalog;
  delete globalThis.LuminousMeatCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-cooking-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-affinity-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-culinary-affinity-data.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-processing-recipe-data.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-processing-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-plant-produce.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-meat.js')).href);

  const cooking = globalThis.LuminousCookingEngine;
  const processingData = globalThis.LuminousItemProcessingRecipeData;
  const processing = globalThis.LuminousItemProcessingEngine;
  const plants = globalThis.LuminousPlantProduceCatalog;
  const meat = globalThis.LuminousMeatCatalog;

  assert.ok(cooking);
  assert.ok(processingData);
  assert.ok(processing);
  assert.ok(plants);
  assert.ok(meat);
  assert.equal(processing.VERSION, 1);
  assert.equal(processing.PROCESSED_FAMILY, 'processed_food');
  assert.equal(Object.keys(processing.METHODS).length, 28);
  assert.equal(processingData.VERSION, 1);
  assert.ok(processingData.TEMPLATES.length >= 31);
  for (const methodId of Object.keys(processing.METHODS)) {
    assert.ok(processingData.listForMethod(methodId).length > 0, `missing economic template for ${methodId}`);
  }

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
    quantity: 4,
    quality: 'standard',
    sourceInstanceId: 'wheat-a',
    affinityRoll: 0,
  });
  const flour = processing.createProcessedItem({ ...wheat, ...wheatStack }, 'grind', {
    batches: 2,
  });
  assert.equal(flour.created, true);
  assert.equal(flour.itemId, 'processed_flour');
  assert.equal(flour.name, 'Flour');
  assert.equal(flour.processedForm, 'flour');
  assert.equal(flour.processedStabilizationHint, 0);
  assert.equal(flour.quantity, 2);
  assert.equal(flour.processingTemplateId, 'flour');
  assert.equal(flour.productionMultiplier, 1.10);
  assert.equal(flour.batchProductionValueAhn, 1980);
  assert.equal(flour.totalProductionValueAhn, 3960);
  assert.equal(flour.unitProductionValueAhn, 1980);
  assert.equal(flour.outputMode, 'canonical');
  assert.deepEqual(flour.sourceItemIds, ['wheat']);
  assert.equal(flour.culinaryProperties.length, 1);
  assert.equal(flour.culinaryProperties[0].sourceInstanceId, 'wheat-a');

  const water = {
    itemId: 'water',
    name: 'Water',
    processingTags: ['liquid', 'water'],
    quantity: 1,
    unitProductionValueAhn: 50,
  };
  const doughCheck = processing.canProcess([flour, water], 'knead');
  assert.equal(doughCheck.allowed, true);
  const dough = processing.createProcessedItem([flour, water], 'knead');
  assert.equal(dough.itemId, 'processed_dough');
  assert.equal(dough.processedForm, 'dough');
  assert.equal(dough.processedStabilizationHint, 2);
  assert.equal(dough.quantity, 2);
  assert.equal(dough.processingTemplateId, 'dough');
  assert.equal(dough.batchProductionValueAhn, 4612);
  assert.equal(dough.unitProductionValueAhn, 2306);
  assert.equal(dough.culinaryProperties.length, 1);
  assert.equal(dough.culinaryProperties[0].sourceInstanceId, 'wheat-a');
  assert.equal(processing.availableMethodIds(dough).includes('bake'), true);

  const appleStack = plants.createIngredientStack('apple', {
    quantity: 4,
    sourceInstanceId: 'apple-a',
    affinityRoll: 0,
  });
  const appleJuice = processing.createProcessedItem({ ...apple, ...appleStack }, 'juice', { batches: 2 });
  assert.equal(appleJuice.created, true);
  assert.equal(appleJuice.processedForm, 'juice');
  assert.equal(appleJuice.outputMode, 'procedural');
  assert.equal(appleJuice.name, 'Apple Juice');
  assert.equal(appleJuice.quantity, 2);
  assert.equal(appleJuice.processingTemplateId, 'juice');
  assert.equal(appleJuice.batchProductionValueAhn, 3960);
  assert.equal(appleJuice.unitProductionValueAhn, 3960);
  assert.equal(appleJuice.tasteDelta, 1);
  assert.equal(appleJuice.culinaryProperties[0].sourceInstanceId, 'apple-a');

  const syrup = processing.createProcessedItem(appleJuice, 'reduce');
  assert.equal(syrup.created, true);
  assert.equal(syrup.itemId, 'processed_syrup');
  assert.equal(syrup.processedForm, 'syrup');
  assert.equal(syrup.processedStabilizationHint, 2);
  assert.equal(syrup.processingTemplateId, 'syrup');
  assert.equal(syrup.batchProductionValueAhn, 9504);
  assert.equal(syrup.unitProductionValueAhn, 9504);
  assert.equal(syrup.tasteDelta, 1);
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
  const onionDef = plants.get('onion');
  const onionStack = plants.createIngredientStack('onion', {
    sourceInstanceId: 'onion-a',
    affinityRoll: 0,
  });
  const stock = processing.createProcessedItem([
    { ...wolfDef, ...wolfStack, quantity: 1 },
    { ...carrotDef, ...carrotStack, quantity: 1 },
    { ...onionDef, ...onionStack, quantity: 1 },
  ], 'simmer');
  assert.equal(stock.created, true);
  assert.equal(stock.itemId, 'processed_stock');
  assert.equal(stock.processedForm, 'stock');
  assert.equal(stock.outputMode, 'canonical');
  assert.equal(stock.quantity, 2);
  assert.equal(stock.processingTemplateId, 'stock');
  assert.equal(stock.batchProductionValueAhn, 23805);
  assert.equal(stock.unitProductionValueAhn, 11903);
  assert.equal(stock.culinaryProperties.length, 3);
  assert.deepEqual(
    new Set(stock.culinaryProperties.map((entry) => entry.sourceInstanceId)),
    new Set(['wolf-a', 'carrot-a', 'onion-a'])
  );

  const duplicateSourceStock = processing.createProcessedItem([
    { ...wolfDef, ...wolfStack, quantity: 1 },
    { ...carrotDef, ...carrotStack, quantity: 1 },
    { ...carrotDef, ...carrotStack, quantity: 1 },
  ], 'simmer');
  assert.equal(duplicateSourceStock.culinaryProperties.length, 2);

  const insufficientJuice = processing.createProcessedItem(
    { ...apple, ...plants.createIngredientStack('apple', { quantity: 1, sourceInstanceId: 'apple-single', affinityRoll: 0 }) },
    'juice'
  );
  assert.equal(insufficientJuice.created, false);
  assert.equal(insufficientJuice.reason, 'no_matching_processing_template_or_quantity');

  const oilInput = {
    itemId: 'processed_oil',
    name: 'Oil',
    processedForm: 'oil',
    processingTags: ['oil', 'liquid'],
    quantity: 1,
    unitProductionValueAhn: 500,
  };
  const friedWolf = processing.createProcessedItem([
    { ...wolfDef, ...wolfStack, quantity: 1 },
    oilInput,
  ], 'deep_fry');
  assert.equal(friedWolf.created, true);
  assert.equal(friedWolf.processingTemplateId, 'deep_fry');
  assert.equal(friedWolf.consumptionPlan.length, 2);
  assert.equal(friedWolf.batchProductionValueAhn, 21275);

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
