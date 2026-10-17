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
  assert.equal(catalog.RECIPES.length, 151, `expected 151 recipes after removing redundant fruit fallbacks and adding donut variants, got ${catalog.RECIPES.length}`);

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
    assert.ok(recipe.referencePriceAhn == null || recipe.referencePriceAhn >= 0, `invalid referencePriceAhn on ${recipe.id}`);
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
    "butter_cookie","chocolate_chip_cookie","oatmeal_cookie","almond_cookie","coffee_cookie",
    "muffin","blueberry_muffin","chocolate_muffin","banana_muffin","apple_muffin","strawberry_muffin","lemon_muffin","coconut_muffin",
    "donut","glazed_donut","sugar_donut","chocolate_donut","cinnamon_donut","jam_filled_donut","cream_filled_donut","chocolate_filled_donut",
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
  assert.equal(catalog.get("chocolate_cake").ingredients.some((row)=>row.requirement === "chocolate"), true);
  assert.equal(catalog.get("chocolate_cake").ingredients.some((row)=>row.requirement === "cacao"), false);
  assert.equal(catalog.get("chocolate_cookie").ingredients.some((row)=>row.requirement === "chocolate"), true);
  assert.equal(catalog.get("chocolate_chip_cookie").ingredients.some((row)=>row.requirement === "chocolate_chips"), true);
  assert.equal(catalog.get("coffee_cake").ingredients.some((row)=>row.requirement === "coffee_bean"), true);
  assert.equal(catalog.get("pineapple_cake").iconFamily, "pineapple_cake");
  assert.equal(catalog.get("butter_cookie").iconFamily, "butter_cookie");
  assert.equal(catalog.get("butter_cookie").referencePriceAhn, 7200);
  assert.equal(catalog.get("almond_cookie").referencePriceAhn, 10000);
  assert.equal(catalog.get("coffee_cookie").ingredients.some((row)=>row.requirement === "coffee_bean"), true);
  assert.equal(catalog.get("honey_cookie").ingredients.some((row)=>row.requirement === "honey"), true);
  assert.equal(catalog.get("muffin").iconFamily, "muffin");
  const muffinMother = catalog.get("muffin").ingredients.map((row)=>[row.requirement,row.role,row.quantity]);
  for (const [id, extra] of [
    ["blueberry_muffin","blueberry"],
    ["chocolate_muffin","chocolate"],
    ["banana_muffin","banana"],
    ["apple_muffin","apple"],
    ["strawberry_muffin","strawberry"],
    ["lemon_muffin","lemon"],
    ["coconut_muffin","coconut"],
  ]) {
    const variant = catalog.get(id);
    assert.equal(variant.iconFamily, id, id);
    const baseRows = variant.ingredients
      .filter((row)=>row.requirement !== extra)
      .map((row)=>[row.requirement,row.role,row.quantity]);
    assert.deepEqual(baseRows, muffinMother, id + " must preserve the muffin mother recipe");
    assert.equal(variant.ingredients.some((row)=>row.requirement === extra && row.role === "major"), true, id + " must add its defining ingredient");
  }

  for (const removed of ["fruit_pie","berry_pie","fruit_tart"]) {
    assert.equal(catalog.get(removed), null, removed + " is redundant after canonical fruit variants");
  }

  const donutMother = catalog.get("donut").ingredients.map((row)=>[row.requirement,row.role,row.quantity]);
  for (const [id, extra, quantity] of [
    ["glazed_donut","syrup",1],
    ["sugar_donut","sweetener",1],
    ["chocolate_donut","chocolate",1],
    ["cinnamon_donut","cinnamon",1],
    ["jam_filled_donut","fruit",1],
    ["cream_filled_donut","cream",1],
    ["chocolate_filled_donut","chocolate",2],
  ]) {
    const variant = catalog.get(id);
    assert.equal(variant.iconFamily, id, id);
    assert.deepEqual(
      variant.ingredients.slice(0, donutMother.length).map((row)=>[row.requirement,row.role,row.quantity]),
      donutMother,
      id + " must preserve the donut mother recipe"
    );
    const added = variant.ingredients[donutMother.length];
    assert.equal(added.requirement, extra, id + " defining ingredient");
    assert.equal(added.quantity, quantity, id + " defining ingredient quantity");
  }

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
