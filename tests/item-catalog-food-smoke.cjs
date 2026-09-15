const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousMeatCatalog;
  delete globalThis.LuminousFoodCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-meat.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-food.js')).href);

  const meat = globalThis.LuminousMeatCatalog;
  const food = globalThis.LuminousFoodCatalog;
  assert.ok(meat);
  assert.ok(food);
  assert.equal(food.VERSION, 1);
  assert.equal(food.FAMILY, 'food');
  assert.equal(food.RATION_HUNGER, 100);
  assert.equal(food.listSimpleCookedDefinitions().length, 39);

  const wolf = food.get('food_cooked_wolf');
  assert.equal(wolf.name, 'Cooked Wolf Meat');
  assert.equal(wolf.rawItemId, 'meat_wolf');
  assert.equal(wolf.cookedBaseValueAhn, 2250);
  assert.equal(wolf.priceAhn, 2810);

  const shark = food.get('food_cooked_shark');
  assert.equal(shark.name, 'Cooked Shark Meat');
  assert.equal(shark.cookedBaseValueAhn, 3000);
  assert.equal(shark.priceAhn, 3750);

  const venison = food.get('food_cooked_venison');
  assert.equal(venison.name, 'Cooked Venison');

  const wolfStack = meat.createHarvestStack('meat_wolf', {
    size: 'medium',
    quality: 'fine',
    lineageId: 'wolf',
    lineageName: 'Wolf',
    originCreatureId: 'wolf',
  });
  const cookedWolf = food.createSimpleCookedFood(wolfStack, { quality: 'standard' });
  assert.equal(cookedWolf.displayName, 'Cooked Wolf Meat');
  assert.equal(cookedWolf.size, 'medium');
  assert.equal(cookedWolf.hungerPerUnit, 100);
  assert.equal(cookedWolf.rationEquivalentPerUnit, 1);
  assert.equal(cookedWolf.inputQuality, 'fine');
  assert.equal(cookedWolf.quality, 'standard');
  assert.equal(cookedWolf.unitValueAhn, 2810);

  const hugeWolf = food.createSimpleCookedFood(wolfStack, { size: 'huge', quality: 'exceptional' });
  assert.equal(hugeWolf.hungerPerUnit, 400);
  assert.equal(hugeWolf.rationEquivalentPerUnit, 4);
  assert.equal(hugeWolf.secondaryEffectMultiplier, 6);
  assert.equal(hugeWolf.unitValueAhn, 22480);

  assert.equal(food.dailyHungerForCreatureSize('tiny'), 25);
  assert.equal(food.dailyHungerForCreatureSize('small'), 50);
  assert.equal(food.dailyHungerForCreatureSize('medium'), 100);
  assert.equal(food.dailyHungerForCreatureSize('large'), 200);
  assert.equal(food.dailyHungerForCreatureSize('huge'), 400);
  assert.equal(food.dailyHungerForCreatureSize('gargantuan'), 800);
  assert.equal(food.hungerPercent(50, 'medium'), 50);
  assert.equal(food.hungerPercent(200, 'huge'), 50);

  const hugeSharkRaw = meat.createHarvestStack('meat_shark', { size: 'huge', quality: 'standard' });
  const hugeSharkFood = food.createSimpleCookedFood(hugeSharkRaw, { quality: 'standard' });
  const sharkRations = food.buildRationSummary(hugeSharkFood);
  assert.equal(sharkRations.hunger, 400);
  assert.equal(sharkRations.rationEquivalent, 4);
  assert.equal(sharkRations.fullRations, 4);
  assert.equal(sharkRations.remainderHunger, 0);
  assert.equal(sharkRations.displayName, 'Shark Ration');

  const boarFood = food.createSimpleCookedFood(meat.createHarvestStack('meat_boar', { size: 'medium' }), { quantity: 1 });
  const wolfFood3 = { ...cookedWolf, quantity: 3 };
  const dominant = food.buildRationSummary([wolfFood3, boarFood]);
  assert.equal(dominant.displayName, 'Wolf Ration');
  assert.equal(dominant.rationEquivalent, 4);

  const mixed = food.buildRationSummary([{ ...cookedWolf, quantity: 2 }, { ...boarFood, quantity: 2 }]);
  assert.equal(mixed.lineageId, 'mixed');
  assert.equal(mixed.displayName, 'Mixed Meat Ration');

  console.log('Food catalog smoke: OK (39 cooked meats + ration contract + recalibrated Ahn values)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});