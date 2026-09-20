const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  for (const key of [
    "LuminousItemQualityEngine","LuminousItemAffinityEngine","LuminousCulinaryAffinityCatalog",
    "LuminousItemProcessingRecipeData","LuminousItemProcessingEngine","LuminousPlantProduceCatalog",
    "LuminousMeatCatalog","LuminousCulinaryStaplesCatalog","LuminousCookingRecipeCatalog",
    "LuminousCookingRecipeResolver"
  ]) delete globalThis[key];

  for (const file of [
    "../js/item-quality-engine.js",
    "../js/item-affinity-engine.js",
    "../js/item-culinary-affinity-data.js",
    "../js/item-processing-recipe-data.js",
    "../js/item-processing-engine.js",
    "../js/item-catalog-plant-produce.js",
    "../js/item-catalog-meat.js",
    "../js/item-catalog-culinary-staples.js",
    "../js/item-economy-standard.js",
    "../js/item-cooking-recipe-catalog.js",
    "../js/item-cooking-recipe-resolver.js"
  ]) await import(pathToFileURL(path.resolve(__dirname, file)).href);

  const plants = globalThis.LuminousPlantProduceCatalog;
  const meat = globalThis.LuminousMeatCatalog;
  const staples = globalThis.LuminousCulinaryStaplesCatalog;
  const processing = globalThis.LuminousItemProcessingEngine;
  const catalog = globalThis.LuminousCookingRecipeCatalog;
  const resolver = globalThis.LuminousCookingRecipeResolver;

  assert.ok(resolver);
  assert.equal(resolver.VERSION, 1);
  assert.equal(catalog.RECIPES.length, 90);

  const stack = (catalogApi, id, quantity, sourceInstanceId) => ({
    ...catalogApi.get(id),
    ...catalogApi.createIngredientStack?.(id, { quantity, sourceInstanceId, affinityRoll:0 }),
  });
  const meatStack = (id, quantity, sourceInstanceId) => ({
    ...meat.get(id),
    ...meat.createHarvestStack(id, { quantity, sourceInstanceId, affinityRoll:0 }),
  });

  const flour = processing.createProcessedItem(stack(plants, "wheat", 4, "wheat-a"), "grind", { templateId:"flour", batches:2 });
  const milk = stack(staples, "milk", 2, "milk-a");
  const dough = processing.createProcessedItem([flour, { ...milk, quantity:1 }], "knead", { templateId:"dough" });
  const sauce = processing.createProcessedItem([
    stack(plants, "tomato", 1, "tomato-a"),
    stack(plants, "onion", 1, "onion-a"),
  ], "simmer", { templateId:"sauce_base" });

  const culture = stack(plants, "fermentation_fungus", 1, "culture-a");
  const cheese = processing.createProcessedItem([
    stack(staples, "milk", 2, "milk-cheese"),
    culture,
  ], "ferment", { templateId:"cheese" });

  const flatbread = {
    itemId:"finished_flatbread_a",
    recipeId:"flatbread",
    family:"food",
    category:"food",
    quantity:2,
    unitProductionValueAhn:9000,
  };

  const burgerInventory = [
    flatbread,
    meatStack("meat_wolf", 1, "wolf-a"),
    stack(plants, "carrot", 1, "carrot-a"),
    { ...sauce, quantity:1 },
  ];
  const burger = resolver.resolveRecipe("burger", burgerInventory);
  assert.equal(burger.valid, true);
  assert.equal(burger.recipeInputs.length, 4);
  assert.deepEqual(burger.recipeInputs.map((x)=>x.recipeRole), ["core","major","minor","seasoning"]);
  assert.equal(burger.consumptionPlan.reduce((s,x)=>s+x.units,0), 4);

  const pizza = resolver.resolveRecipe("pizza_margherita", [
    { ...dough, quantity:1 },
    { ...sauce, quantity:1 },
    { ...cheese, quantity:1 },
    stack(plants, "basil", 1, "basil-a"),
  ]);
  assert.equal(pizza.valid, true);
  assert.deepEqual(pizza.assignments.map((x)=>x.requirement), ["dough","sauce_base","cheese","herb"]);

  const noodles = processing.createProcessedItem({ ...dough, quantity:1 }, "cut", { templateId:"noodles" });
  const stock = processing.createProcessedItem([
    meatStack("meat_wolf", 1, "wolf-stock"),
    stack(plants, "carrot", 1, "carrot-stock"),
    stack(plants, "onion", 1, "onion-stock"),
  ], "simmer", { templateId:"stock" });

  const ramen = resolver.resolveRecipe("ramen", [
    { ...noodles, quantity:1 },
    { ...stock, quantity:1 },
    meatStack("meat_wolf", 1, "wolf-ramen"),
    stack(plants, "carrot", 1, "carrot-ramen"),
    stack(plants, "black_pepper", 1, "pepper-ramen"),
  ]);
  assert.equal(ramen.valid, true);

  const miso = processing.createProcessedItem([
    stack(plants, "soybean", 2, "soy-miso"),
    stack(plants, "fermentation_fungus", 1, "culture-miso"),
  ], "ferment", { templateId:"miso_paste" });
  const misoSoup = resolver.resolveRecipe("miso_soup", [
    { ...stock, quantity:1 },
    { ...miso, quantity:1 },
    stack(staples, "seaweed", 1, "seaweed-a"),
  ]);
  assert.equal(misoSoup.valid, true);

  const noCheese = resolver.resolveRecipe("cheeseburger", burgerInventory);
  assert.equal(noCheese.valid, false);
  assert.ok(noCheese.missing.some((row)=>row.requirement === "cheese"));

  const scarcity = resolver.resolveRecipe("japanese_curry", [
    stack(plants, "rice", 1, "rice-a"),
    stack(plants, "carrot", 2, "carrot-scarce"),
    { ...sauce, quantity:1 },
  ]);
  assert.equal(scarcity.valid, false);
  assert.ok(scarcity.missing.some((row)=>row.requirement === "meat_or_vegetable"));
  const carrotUsed = scarcity.consumptionPlan
    .filter((row)=>row.inventoryIndex === 1)
    .reduce((sum,row)=>sum+row.units,0);
  assert.ok(carrotUsed <= 2, "resolver must never consume more units than inventory contains");

  const avianMatch = resolver.matchRequirement("avian_meat", meatStack("meat_avian",1,"avian-a"));
  assert.equal(avianMatch.matches, true);

  const sweetenerMatch = resolver.matchRequirement("sweetener", stack(staples,"honey",1,"honey-a"));
  assert.equal(sweetenerMatch.matches, true);

  const craftable = resolver.craftableRecipes(burgerInventory);
  assert.ok(craftable.some((entry)=>entry.recipeId === "burger"));

  for (const recipe of catalog.RECIPES) {
    for (const requirement of recipe.ingredients) {
      const key = requirement.requirement;
      assert.ok(key && typeof key === "string");
    }
  }

  console.log("Cooking Recipe Resolver smoke: OK (semantic aliases, inventory reservation and recipe-role inputs)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
