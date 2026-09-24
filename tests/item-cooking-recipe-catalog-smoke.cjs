const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousItemEconomyStandard;
  delete globalThis.LuminousCookingEngine;
  delete globalThis.LuminousCookingRecipeCatalog;

  await import(pathToFileURL(path.resolve(__dirname, "../js/item-economy-standard.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-cooking-engine.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-cooking-recipe-catalog.js")).href);

  const economy = globalThis.LuminousItemEconomyStandard;
  const cooking = globalThis.LuminousCookingEngine;
  const catalog = globalThis.LuminousCookingRecipeCatalog;

  assert.ok(economy);
  assert.ok(cooking);
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.RECIPES.length, 128, `expected 128 recipes after pie/cake variants, got ${catalog.RECIPES.length}`);

  const ids = new Set();
  const cuisines = new Set();
  for (const recipe of catalog.RECIPES) {
    assert.ok(recipe.id);
    assert.equal(ids.has(recipe.id), false, `duplicate recipe id ${recipe.id}`);
    ids.add(recipe.id);
    cuisines.add(recipe.cuisine);

    assert.ok(cooking.methodBaseTh(recipe.method) != null, `unknown method ${recipe.method} on ${recipe.id}`);
    assert.ok(["dex","int","wis"].includes(recipe.ability), `invalid ability on ${recipe.id}`);
    assert.ok(recipe.creationMultiplier >= 1.05 && recipe.creationMultiplier <= 1.35, `bad creation multiplier on ${recipe.id}`);
    assert.ok(economy.DISH_LABOR_SHARE[recipe.laborClass] != null, `bad labor class on ${recipe.id}`);
    assert.ok(economy.FOOD_PRICE_BANDS[recipe.priceClass], `bad price class on ${recipe.id}`);
    assert.ok(economy.VENUE_MULTIPLIER[recipe.defaultVenue], `bad venue on ${recipe.id}`);
    assert.ok(recipe.ingredients.length > 0, `recipe without ingredients ${recipe.id}`);
    assert.ok(recipe.iconFamily == null || typeof recipe.iconFamily === "string", `invalid iconFamily on ${recipe.id}`);
    for (const row of recipe.ingredients) {
      assert.ok(row.requirement);
      assert.ok(row.quantity >= 1);
      assert.ok(["core","major","minor","seasoning","garnish"].includes(row.role));
    }
  }

  for (const cuisine of ["bakery","american","japanese","italian","mexican","east_asian","south_asian","city_survival"]) {
    assert.ok(cuisines.has(cuisine), `missing cuisine ${cuisine}`);
  }

  for (const id of [
    "apple_pie","pear_pie","banana_cream_pie","dragon_fruit_tart","apple_cake","chocolate_cake","chestnut_cake",
    "burger","fried_chicken","ramen","sushi_roll","tonkatsu",
    "pizza_margherita","pasta_bolognese","lasagna","tiramisu",
    "tacos","tamales","fried_rice","curry","ration_block"
  ]) {
    assert.ok(catalog.get(id), `missing canonical recipe ${id}`);
  }

  assert.equal(catalog.get("white_bread").iconFamily, "white_bread");
  assert.equal(catalog.get("apple_pie").iconFamily, "apple_pie");
  assert.equal(catalog.get("pear_pie").ingredients.some((row)=>row.requirement === "pear"), true);
  assert.equal(catalog.get("banana_cream_pie").ingredients.some((row)=>row.requirement === "cream"), true);
  assert.equal(catalog.get("chocolate_cake").ingredients.some((row)=>row.requirement === "cacao"), true);
  assert.equal(catalog.get("coffee_cake").ingredients.some((row)=>row.requirement === "coffee_bean"), true);
  assert.equal(catalog.get("pineapple_cake").iconFamily, "pineapple_cake");

  const burger = catalog.resolveReferencePricing("burger", [
    { itemId:"bread", quantity:1, unitProductionValueAhn:3500 },
    { itemId:"meat", quantity:1, unitProductionValueAhn:9000 },
    { itemId:"vegetable", quantity:1, unitProductionValueAhn:1500 },
    { itemId:"sauce", quantity:1, unitProductionValueAhn:4500 },
  ], { stars:3, venue:"restaurant_standard" });
  assert.equal(burger.inputProductionValueAhn, 18500);
  assert.equal(burger.createdProductionValueAhn, 25280);
  assert.equal(burger.realizedProductionValueAhn, 25280);
  assert.equal(burger.retailReferencePriceAhn, 44240);
  assert.equal(burger.referenceMonthlyWageAhn, 1000000);

  const premiumBurger = catalog.resolveReferencePricing("burger", [
    { quantity:1, unitProductionValueAhn:3500 },
    { quantity:1, unitProductionValueAhn:9000 },
    { quantity:1, unitProductionValueAhn:1500 },
    { quantity:1, unitProductionValueAhn:4500 },
  ], { stars:5, venue:"restaurant_good" });
  assert.equal(premiumBurger.realizedProductionValueAhn, 37920);
  assert.equal(premiumBurger.retailReferencePriceAhn, 75840);

  const ration = catalog.resolveReferencePricing("ration_block", [
    { quantity:1, unitProductionValueAhn:500 },
  ], { stars:3, venue:"grocery_prepared" });
  assert.equal(ration.createdProductionValueAhn, 1530);
  assert.equal(ration.retailReferencePriceAhn, 1840);
  assert.ok(ration.retailReferencePriceAhn >= economy.FOOD_PRICE_BANDS.survival.minAhn);
  assert.ok(ration.retailReferencePriceAhn <= economy.FOOD_PRICE_BANDS.survival.maxAhn);

  console.log(`Cooking Recipe Catalog smoke: OK (${catalog.RECIPES.length} multicultural recipes + salary-anchored pricing)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
