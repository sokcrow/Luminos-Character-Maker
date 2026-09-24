const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  for (const key of [
    "LuminousItemQualityEngine","LuminousItemAffinityEngine","LuminousCulinaryAffinityCatalog",
    "LuminousItemProcessingRecipeData","LuminousItemProcessingEngine","LuminousPlantProduceCatalog",
    "LuminousMeatCatalog","LuminousCulinaryStaplesCatalog"
  ]) delete globalThis[key];

  for (const file of [
    "../js/item-quality-engine.js",
    "../js/item-affinity-engine.js",
    "../js/item-culinary-affinity-data.js",
    "../js/item-processing-recipe-data.js",
    "../js/item-processing-engine.js",
    "../js/item-catalog-plant-produce.js",
    "../js/item-catalog-meat.js",
    "../js/item-catalog-culinary-staples.js"
  ]) await import(pathToFileURL(path.resolve(__dirname, file)).href);

  const processing = globalThis.LuminousItemProcessingEngine;
  const data = globalThis.LuminousItemProcessingRecipeData;
  const plants = globalThis.LuminousPlantProduceCatalog;
  const meat = globalThis.LuminousMeatCatalog;
  const staples = globalThis.LuminousCulinaryStaplesCatalog;

  for (const id of ["cream","cheese","miso_paste","batter","coating","corn_flour","corn_dough","pasta","noodles","wrapper","ground_meat"]) {
    assert.ok(data.get(id), `missing template ${id}`);
  }

  const milk = staples.createIngredientStack("milk", { quantity:4, sourceInstanceId:"milk-a", affinityRoll:0 });
  const cream = staples.processIngredient(milk, "press");
  assert.equal(cream.itemId, "processed_cream");
  assert.equal(cream.batchProductionValueAhn, 4840);

  const cultureDef = staples.get("yeast");
  const cultureStack = staples.createIngredientStack("yeast", { quantity:2, sourceInstanceId:"culture-a", affinityRoll:0 });
  const culture = { ...cultureDef, ...cultureStack };

  const cheese = processing.createProcessedItem([
    { ...staples.get("milk"), ...staples.createIngredientStack("milk", { quantity:2, sourceInstanceId:"milk-cheese", affinityRoll:0 }) },
    { ...culture, quantity:1 },
  ], "ferment", { templateId:"cheese" });
  assert.equal(cheese.created, true);
  assert.equal(cheese.itemId, "processed_cheese");
  assert.equal(cheese.processedForm, "cheese");
  assert.equal(cheese.batchProductionValueAhn, 11500);

  const soybean = {
    ...plants.get("soybean"),
    ...plants.createIngredientStack("soybean", { quantity:2, sourceInstanceId:"soy-a", affinityRoll:0 }),
  };
  const miso = processing.createProcessedItem([soybean, { ...culture, quantity:1 }], "ferment", { templateId:"miso_paste" });
  assert.equal(miso.created, true);
  assert.equal(miso.itemId, "processed_miso_paste");
  assert.equal(miso.batchProductionValueAhn, 10500);

  const corn = {
    ...plants.get("corn"),
    ...plants.createIngredientStack("corn", { quantity:4, sourceInstanceId:"corn-a", affinityRoll:0 }),
  };
  const cornFlour = processing.createProcessedItem(corn, "grind", { templateId:"corn_flour", batches:2 });
  assert.equal(cornFlour.itemId, "processed_corn_flour");
  assert.equal(cornFlour.quantity, 2);
  assert.equal(cornFlour.unitProductionValueAhn, 2376);

  const egg = {
    ...staples.get("egg"),
    ...staples.createIngredientStack("egg", { quantity:3, sourceInstanceId:"egg-a", affinityRoll:0 }),
  };
  const cornDough = processing.createProcessedItem([cornFlour, { ...egg, quantity:1 }], "knead", { templateId:"corn_dough" });
  assert.equal(cornDough.itemId, "processed_corn_dough");
  assert.equal(cornDough.quantity, 2);
  assert.equal(cornDough.batchProductionValueAhn, 7535);

  const wheat = {
    ...plants.get("wheat"),
    ...plants.createIngredientStack("wheat", { quantity:4, sourceInstanceId:"wheat-a", affinityRoll:0 }),
  };
  const flour = processing.createProcessedItem(wheat, "grind", { templateId:"flour", batches:2 });
  assert.equal(flour.itemId, "processed_flour");
  assert.equal(flour.quantity, 2);
  assert.equal(flour.unitProductionValueAhn, 1980);

  const pasta = processing.createProcessedItem([flour, { ...egg, quantity:1 }], "knead", { templateId:"pasta" });
  assert.equal(pasta.itemId, "processed_pasta");
  assert.equal(pasta.quantity, 2);
  assert.equal(pasta.batchProductionValueAhn, 6624);
  assert.equal(pasta.unitProductionValueAhn, 3312);

  const milkBinder = {
    ...staples.get("milk"),
    ...staples.createIngredientStack("milk", { quantity:1, sourceInstanceId:"milk-dough", affinityRoll:0 }),
  };
  const dough = processing.createProcessedItem([flour, milkBinder], "knead", { templateId:"dough" });
  assert.equal(dough.itemId, "processed_dough");
  assert.equal(dough.quantity, 2);

  const noodles = processing.createProcessedItem({ ...dough, quantity:1 }, "cut", { templateId:"noodles" });
  assert.equal(noodles.itemId, "processed_noodles");
  assert.equal(noodles.quantity, 2);

  const wrapper = processing.createProcessedItem({ ...dough, quantity:1 }, "cut", { templateId:"wrapper" });
  assert.equal(wrapper.itemId, "processed_wrapper");
  assert.equal(wrapper.quantity, 2);

  const batter = processing.createProcessedItem([{ ...flour, quantity:1 }, { ...egg, quantity:1 }], "simple_mix", { templateId:"batter" });
  assert.equal(batter.itemId, "processed_batter");
  assert.equal(batter.quantity, 2);
  assert.equal(batter.batchProductionValueAhn, 4082);

  const pepper = {
    ...plants.get("black_pepper"),
    ...plants.createIngredientStack("black_pepper", { quantity:1, sourceInstanceId:"pepper-a", affinityRoll:0 }),
  };
  const coating = processing.createProcessedItem([{ ...flour, quantity:1 }, pepper], "simple_mix", { templateId:"coating" });
  assert.equal(coating.itemId, "processed_coating");
  assert.equal(coating.quantity, 2);
  assert.equal(coating.batchProductionValueAhn, 6674);

  const wolf = meat.createHarvestStack("meat_wolf", { quantity:1, sourceInstanceId:"wolf-a", affinityRoll:0 });
  const ground = meat.processIngredient(wolf, "grind", { templateId:"ground_meat" });
  assert.equal(ground.itemId, "processed_ground_meat");
  assert.equal(ground.processedForm, "ground_meat");
  assert.equal(ground.unitProductionValueAhn, 18900);

  const invalidTemplate = processing.createProcessedItem({ ...wheat, quantity:2 }, "grind", { templateId:"ground_meat" });
  assert.equal(invalidTemplate.created, false);
  assert.equal(invalidTemplate.reason, "requested_processing_template_did_not_match");

  console.log("Culinary Intermediates smoke: OK (dairy, dough, pasta/noodles, coating, miso and ground meat)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
