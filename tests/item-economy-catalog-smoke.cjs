const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const globals = [
    "LuminousItemQualityEngine","LuminousItemSizeLineageEngine","LuminousCulinaryAffinityCatalog",
    "LuminousItemAffinityEngine","LuminousItemProcessingRecipeData","LuminousItemProcessingEngine",
    "LuminousPlantProduceCatalog","LuminousMeatCatalog","LuminousFoodCatalog","LuminousHidePeltCatalog",
    "LuminousHardPartsCatalog","LuminousScaleShellChitinCatalog","LuminousFeatherRawFiberCatalog",
    "LuminousBloodIchorCatalog","LuminousOrganGlandCatalog","LuminousVenomSecretionCatalog",
    "LuminousOozeGelCatalog","LuminousEssenceCoreCatalog","LuminousOreIngotGemCatalog",
    "LuminousToolCatalog","LuminousWeaponCatalog","LuminousHpHealingCatalog","LuminousSpHealingCatalog",
    "LuminousHybridHealingCatalog","LuminousStatusCureCatalog","LuminousMedicalSupplyCatalog"
  ];
  for (const key of globals) delete globalThis[key];

  const imports = [
    "../js/item-quality-engine.js",
    "../js/item-size-lineage-engine.js",
    "../js/item-affinity-engine.js",
    "../js/item-culinary-affinity-data.js",
    "../js/item-processing-recipe-data.js",
    "../js/item-processing-engine.js",
    "../js/item-catalog-plant-produce.js",
    "../js/item-catalog-meat.js",
    "../js/item-catalog-food.js",
    "../js/item-catalog-hide-pelt.js",
    "../js/item-catalog-hard-parts.js",
    "../js/item-catalog-scale-shell-chitin.js",
    "../js/item-catalog-feather-raw-fiber.js",
    "../js/item-catalog-blood-ichor.js",
    "../js/item-catalog-organ-gland.js",
    "../js/item-catalog-venom-secretion.js",
    "../js/item-catalog-ooze-gel.js",
    "../js/item-catalog-essence-core.js",
    "../js/item-catalog-ore-ingot-gem.js",
    "../js/item-catalog-tools.js",
    "../js/item-catalog-weapons.js",
    "../js/item-catalog-hp-healing.js",
    "../js/item-catalog-sp-healing.js",
    "../js/item-catalog-hybrid-healing.js",
    "../js/item-catalog-status-cure.js",
    "../js/item-catalog-medical-supply.js"
  ];
  for (const relative of imports) {
    await import(pathToFileURL(path.resolve(__dirname, relative)).href);
  }

  const plant = globalThis.LuminousPlantProduceCatalog;
  const meat = globalThis.LuminousMeatCatalog;
  const food = globalThis.LuminousFoodCatalog;
  const hide = globalThis.LuminousHidePeltCatalog;
  const hard = globalThis.LuminousHardPartsCatalog;
  const cover = globalThis.LuminousScaleShellChitinCatalog;
  const fiber = globalThis.LuminousFeatherRawFiberCatalog;
  const blood = globalThis.LuminousBloodIchorCatalog;
  const organ = globalThis.LuminousOrganGlandCatalog;
  const venom = globalThis.LuminousVenomSecretionCatalog;
  const ooze = globalThis.LuminousOozeGelCatalog;
  const essence = globalThis.LuminousEssenceCoreCatalog;
  const ore = globalThis.LuminousOreIngotGemCatalog;
  const tools = globalThis.LuminousToolCatalog;
  const weapons = globalThis.LuminousWeaponCatalog;
  const hp = globalThis.LuminousHpHealingCatalog;
  const sp = globalThis.LuminousSpHealingCatalog;
  const hybrid = globalThis.LuminousHybridHealingCatalog;
  const cure = globalThis.LuminousStatusCureCatalog;
  const medical = globalThis.LuminousMedicalSupplyCatalog;

  for (const catalog of [plant,meat,food,hide,hard,cover,fiber,blood,organ,venom,ooze,essence,ore,tools,weapons,hp,sp,hybrid,cure,medical]) {
    assert.ok(catalog);
  }

  // Culinary raw anchors.
  assert.equal(plant.get("wheat").standardUnitValueAhn, 900);
  assert.equal(plant.get("apple").standardUnitValueAhn, 1800);
  assert.equal(plant.get("orange").standardUnitValueAhn, 2400);
  assert.equal(plant.get("rare_spice").standardUnitValueAhn, 18000);
  assert.equal(plant.get("exotic_medicinal_herb").standardUnitValueAhn, 45000);

  assert.equal(meat.get("meat_rodent").priceAhn, 6000);
  assert.equal(meat.get("meat_wolf").priceAhn, 18000);
  assert.equal(meat.get("meat_bovine").priceAhn, 14000);
  assert.equal(meat.get("meat_draconic").priceAhn, 75000);

  const cookedWolf = food.get("food_cooked_wolf");
  assert.equal(cookedWolf.cookedBaseValueAhn, 19800);
  assert.equal(cookedWolf.priceAhn, 26730);

  // Harvest / biomaterial anchors.
  assert.equal(hide.get("hide_mammal").mediumStandardValueAhn, 32000);
  assert.equal(hide.get("hide_draconic").mediumStandardValueAhn, 100000);
  assert.equal(hard.get("hard_bone").mediumStandardValueAhn, 12000);
  assert.equal(hard.get("hard_exotic").mediumStandardValueAhn, 44000);
  assert.equal(cover.get("scale").mediumStandardValueAhn, 6000);
  assert.equal(cover.get("shell").mediumStandardValueAhn, 36000);
  assert.equal(cover.get("exotic_armor_plate").mediumStandardValueAhn, 52000);
  assert.equal(fiber.get("feather").standardUnitValueAhn, 500);
  assert.equal(fiber.get("raw_silk").standardUnitValueAhn, 6000);
  assert.equal(fiber.get("exotic_raw_fiber").standardUnitValueAhn, 10000);
  assert.equal(blood.get("blood").standardUnitValueAhn, 2500);
  assert.equal(blood.get("draconic_blood").standardUnitValueAhn, 12500);
  assert.equal(organ.get("heart").standardMediumValueAhn, 35000);
  assert.equal(organ.get("heart").transplantMedicalStandardMediumValueAhn, 600000);
  assert.equal(venom.get("venom").standardUnitValueAhn, 15000);
  assert.equal(venom.get("exotic_secretion").standardUnitValueAhn, 25000);
  assert.equal(ooze.get("slime").standardUnitValueAhn, 1500);
  assert.equal(ooze.get("exotic_ooze").standardUnitValueAhn, 17500);
  assert.equal(essence.get("elemental_essence").standardUnitValueAhn, 30000);
  assert.equal(essence.get("mana_energy_core").standardMediumValueAhn, 225000);

  // Industrial/material anchors.
  assert.equal(ore.get("industrial_stone").standardUnitValueAhn, 10000);
  assert.equal(ore.get("iron_ore").standardUnitValueAhn, 30000);
  assert.equal(ore.get("iron").standardUnitValueAhn, 50000);
  assert.equal(ore.get("hardened_steel").standardUnitValueAhn, 225000);
  assert.equal(ore.get("exotic_alloy").standardUnitValueAhn, 1625000);

  assert.equal(tools.get("cooks_utensils").standardValueAhn, 60000);
  assert.equal(tools.get("smiths_tools").standardValueAhn, 140000);
  assert.equal(tools.get("surgical_tools").standardValueAhn, 240000);

  assert.equal(weapons.get("club").standardChassisValueAhn, 60000);
  assert.equal(weapons.get("dagger").standardChassisValueAhn, 175000);
  assert.equal(weapons.get("longsword").standardChassisValueAhn, 500000);
  assert.equal(weapons.get("heavy_crossbow").standardChassisValueAhn, 1200000);

  // Medical / technology anchors.
  assert.equal(hp.list({ sourceLine:"generic" })[0].priceAhn, 10000);
  assert.equal(hp.list({ sourceLine:"workshop" })[0].priceAhn, 66000);
  assert.equal(hp.list({ sourceLine:"k_corp" })[0].priceAhn, 160000);

  assert.equal(sp.list({ sourceLine:"generic" })[0].priceAhn, 10800);
  assert.equal(sp.list({ sourceLine:"m_corp" })[0].priceAhn, 48000);
  assert.equal(sp.list({ sourceLine:"l_corp" })[0].priceAhn, 135000);

  assert.equal(hybrid.list({ sourceLine:"generic" })[0].priceAhn, 17500);
  assert.equal(hybrid.list({ sourceLine:"workshop" })[0].priceAhn, 96000);
  assert.equal(hybrid.list({ sourceLine:"premium_synthesis" })[0].priceAhn, 240000);

  assert.equal(cure.list({ sourceLine:"generic" })[0].priceAhn, 12500);
  assert.equal(cure.list({ sourceLine:"workshop" })[0].priceAhn, 90000);
  assert.equal(cure.list({ sourceLine:"specialist" })[0].priceAhn, 200000);

  assert.equal(medical.list({ sourceLine:"generic" })[0].priceAhn, 10800);
  assert.equal(medical.list({ sourceLine:"workshop" })[0].priceAhn, 84000);
  assert.equal(medical.list({ sourceLine:"specialist" })[0].priceAhn, 220000);

  console.log("Economy Catalog Rebase smoke: OK (culinary, biomaterial, industrial, tools, weapons and medicine anchors)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
