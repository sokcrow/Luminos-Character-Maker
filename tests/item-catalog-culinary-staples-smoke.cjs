const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  for (const key of [
    "LuminousItemQualityEngine","LuminousItemAffinityEngine","LuminousItemProcessingRecipeData",
    "LuminousItemProcessingEngine","LuminousCulinaryStaplesCatalog"
  ]) delete globalThis[key];

  for (const file of [
    "../js/item-quality-engine.js",
    "../js/item-affinity-engine.js",
    "../js/item-processing-recipe-data.js",
    "../js/item-processing-engine.js",
    "../js/item-catalog-culinary-staples.js"
  ]) await import(pathToFileURL(path.resolve(__dirname, file)).href);

  const catalog = globalThis.LuminousCulinaryStaplesCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, "culinary_staples");
  assert.equal(catalog.ITEMS.length, 13);

  for (const item of catalog.ITEMS) {
    assert.equal(Object.values(item.culinaryAffinities).reduce((a,b)=>a+b,0), 100, item.id);
    assert.equal(item.stackPolicy, "identical_item_quality_affinity");
    assert.equal(item.cookingReady, true);
    assert.ok(item.standardUnitValueAhn >= 500);
  }

  assert.equal(catalog.get("egg").standardUnitValueAhn, 1800);
  assert.equal(catalog.get("milk").standardUnitValueAhn, 2200);
  assert.equal(catalog.get("seaweed").standardUnitValueAhn, 1800);
  assert.equal(catalog.get("avocado").standardUnitValueAhn, 3200);
  assert.equal(catalog.get("honey").standardUnitValueAhn, 3800);
  assert.equal(catalog.get("sugar_cane").standardUnitValueAhn, 1400);
  assert.equal(catalog.get("recycled_protein").standardUnitValueAhn, 2500);
  assert.equal(catalog.get("water").standardUnitValueAhn, 500);
  assert.equal(catalog.get("salt").standardUnitValueAhn, 1200);
  assert.equal(catalog.get("yeast").standardUnitValueAhn, 1800);
  assert.equal(catalog.get("beeswax").standardUnitValueAhn, 2400);
  assert.equal(catalog.get("gelatin").standardUnitValueAhn, 2200);
  assert.equal(catalog.get("jellyfish").standardUnitValueAhn, 3500);

  assert.equal(catalog.get("egg").iconFamily, "egg");
  assert.equal(catalog.get("milk").iconFamily, "milk");
  assert.equal(catalog.get("seaweed").iconFamily, "seaweed");
  assert.equal(catalog.get("avocado").iconFamily, "avocado");
  assert.equal(catalog.get("honey").iconFamily, "honey");
  assert.equal(catalog.get("sugar_cane").iconFamily, "sugar_cane");
  assert.equal(catalog.get("water").iconFamily, "water");
  assert.equal(catalog.get("salt").iconFamily, "salt");
  assert.equal(catalog.get("yeast").iconFamily, "yeast");
  assert.equal(catalog.get("beeswax").iconFamily, "beeswax");
  assert.equal(catalog.get("gelatin").iconFamily, "gelatin");
  assert.equal(catalog.get("jellyfish").iconFamily, "jellyfish");
  assert.equal(catalog.get("recycled_protein").iconFamily, "recycled_protein");

  const egg = catalog.createIngredientStack("egg", { quantity:2, sourceInstanceId:"egg-a", affinityRoll:0 });
  assert.equal(egg.quantity, 2);
  assert.ok(Object.prototype.hasOwnProperty.call(catalog.get("egg").culinaryAffinities, egg.affinityTarget));
  assert.equal(egg.culinaryProperties[0].sourceInstanceId, "egg-a");
  assert.equal(egg.unitValueAhn, 1800);
  assert.equal(egg.totalValueAhn, 3600);

  const water = catalog.createIngredientStack("water", { quantity:2, sourceInstanceId:"water-a", affinityRoll:0 });
  assert.equal(water.quantity, 2);
  assert.equal(water.totalValueAhn, 1000);
  assert.equal(water.edibleRaw, true);
  assert.equal(catalog.get("salt").edibleRaw, false);
  assert.equal(catalog.get("jellyfish").edibleRaw, false);

  const waterMethods = catalog.processingMethodsFor("water").map((entry)=>entry.id);
  assert.ok(waterMethods.includes("boil"));
  assert.ok(waterMethods.includes("brew"));
  const jellyfishMethods = catalog.processingMethodsFor("jellyfish").map((entry)=>entry.id);
  assert.ok(jellyfishMethods.includes("cut"));
  assert.ok(jellyfishMethods.includes("steam"));

  const milkMethods = catalog.processingMethodsFor("milk").map((entry)=>entry.id);
  assert.ok(milkMethods.includes("press"));
  assert.ok(milkMethods.includes("ferment"));

  const seaweedMethods = catalog.processingMethodsFor("seaweed").map((entry)=>entry.id);
  assert.ok(seaweedMethods.includes("cut"));
  assert.ok(seaweedMethods.includes("dry"));

  const cream = catalog.processIngredient(catalog.createIngredientStack("milk", {
    quantity:2, sourceInstanceId:"milk-a", affinityRoll:0
  }), "press");
  assert.equal(cream.created, true);
  assert.equal(cream.itemId, "processed_cream");
  assert.equal(cream.processedForm, "cream");
  assert.equal(cream.quantity, 1);
  assert.equal(cream.unitProductionValueAhn, 4840);
  assert.equal(cream.culinaryProperties[0].sourceInstanceId, "milk-a");

  console.log("Culinary Staples smoke: OK (13 raw staples + affinities + Processing bridge)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
