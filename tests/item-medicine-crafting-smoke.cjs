const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const load = async (file) => import(pathToFileURL(path.resolve(__dirname, "../js", file)).href);
  for (const key of [
    "LuminousItemQualityEngine","LuminousPlantProduceCatalog","LuminousVenomSecretionCatalog",
    "LuminousOozeGelCatalog","LuminousMedicinalRawCatalog","LuminousMedicinalProcessedCatalog",
    "LuminousMedicineRecipeCatalog","LuminousMedicineCraftingEngine"
  ]) delete globalThis[key];

  await load("item-quality-engine.js");
  await load("item-catalog-plant-produce.js");
  await load("item-catalog-venom-secretion.js");
  await load("item-catalog-ooze-gel.js");
  await load("item-catalog-medicinal-raw.js");
  await load("item-catalog-medicinal-processed.js");
  await load("item-medicine-recipe-catalog.js");
  await load("item-medicine-crafting-engine.js");

  const raw = globalThis.LuminousMedicinalRawCatalog;
  const processed = globalThis.LuminousMedicinalProcessedCatalog;
  const recipes = globalThis.LuminousMedicineRecipeCatalog;
  const engine = globalThis.LuminousMedicineCraftingEngine;
  const plants = globalThis.LuminousPlantProduceCatalog;
  const venom = globalThis.LuminousVenomSecretionCatalog;
  const ooze = globalThis.LuminousOozeGelCatalog;

  assert.equal(raw.VERSION, 1);
  assert.equal(raw.ITEMS.length, 46);
  assert.equal(raw.validateCatalog().valid, true);
  assert.equal(processed.ITEMS.length, 10);
  assert.equal(processed.validateCatalog().valid, true);
  assert.equal(Object.keys(recipes.RECIPES).length, 18);
  assert.equal(recipes.PENDING_ICON_FORMS.length, 3);
  assert.equal(recipes.validateCatalog().valid, true);
  assert.equal(engine.validateEngine().valid, true);

  assert.equal(plants.get("medicinal_herb").iconFamily, "herb_healing");
  assert.equal(plants.get("bitterroot").iconFamily, "herb_antidote");
  assert.equal(plants.get("calming_herb").iconFamily, "herb_calming");
  assert.equal(plants.get("nightshade").iconFamily, "herb_toxic");
  assert.equal(plants.get("medicinal_mushroom").iconFamily, "fungus_medicinal");
  assert.equal(plants.get("toxic_mushroom").iconFamily, "fungus_toxic");

  const herb = { ...plants.get("medicinal_herb"), quantity:2 };
  const water = { ...raw.get("purified_water"), quantity:1 };
  const extract = engine.craftProcessed("medicinal_extract", [herb, water], { checkTotal:22 });
  assert.equal(extract.crafted, true);
  assert.equal(extract.output.id, "medicinal_extract");
  assert.equal(extract.output.quality, "fine");
  assert.equal(extract.output.craft.threshold, 18);

  const tox = { ...venom.get("venom"), quantity:1 };
  const solvent = { ...raw.get("medical_alcohol"), quantity:1 };
  const stabilizer = { ...raw.get("stabilizer_reagent"), quantity:1 };
  const toxinExtract = engine.craftProcessed("toxin_extract", [tox, solvent, stabilizer], { checkTotal:22 });
  assert.equal(toxinExtract.crafted, true);
  assert.equal(toxinExtract.output.iconFamily, "toxin_extract");
  assert.equal(toxinExtract.output.craft.threshold, 22);

  const regen = { ...ooze.get("regenerative_gel"), quantity:1 };
  assert.equal(engine.tagSet(regen).has("regenerative_reagent"), true);

  const tabletBinder = { ...raw.get("tablet_binder"), quantity:1 };
  const powder = {
    ...processed.get("pharmaceutical_powder"), quantity:1, productionValueAhn:5000,
    tags:[...(processed.get("pharmaceutical_powder").tags||[])]
  };
  const tablet = engine.craftForm("medicine_tablet", [powder, tabletBinder], { checkTotal:18, outputName:"Test Tablet" });
  assert.equal(tablet.crafted, true);
  assert.equal(tablet.output.iconFamily, "medicine_tablet");
  assert.equal(tablet.output.quality, "standard");

  const improvised = engine.thresholdFor(processed.getProcess("medicinal_extract"), { improvised:true });
  assert.equal(improvised, 21);
  const exotic = engine.thresholdFor(processed.getProcess("toxin_extract"), { exotic:true });
  assert.equal(exotic, 28);

  console.log("Medicine crafting smoke: OK (46 raw, 10 processed, 18 finished-form chassis, beast + chemical toxin bridge)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
