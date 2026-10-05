const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousShopRuntime;
  delete globalThis.LuminousShopStandardPresets;

  await import(pathToFileURL(path.resolve(__dirname, "../js/shop-runtime.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/shop-standard-presets.js")).href);

  const shops = globalThis.LuminousShopRuntime;
  const presets = globalThis.LuminousShopStandardPresets;

  assert.ok(shops);
  assert.ok(presets);
  assert.equal(presets.VERSION, 2);

  const list = presets.list();
  assert.equal(list.length, 24);
  assert.equal(new Set(list.map((preset) => preset.id)).size, list.length);
  assert.equal(new Set(list.map((preset) => preset.name)).size, list.length);

  const requiredTypes = new Set(Object.keys(shops.SHOP_TYPES));
  const coveredTypes = new Set();

  for (const preset of list) {
    assert.ok(preset.id);
    assert.ok(preset.name);
    assert.ok(Array.isArray(preset.testFocus) && preset.testFocus.length > 0);
    assert.ok(preset.shop);
    assert.ok(shops.SHOP_TYPES[preset.shop.shop_type], preset.id + " uses an unknown shop type");
    assert.ok(preset.shop.shop_tier >= 1 && preset.shop.shop_tier <= shops.MAX_TIER);
    assert.ok(preset.shop.mod_venta > 0);
    coveredTypes.add(preset.shop.shop_type);
    requiredTypes.delete(preset.shop.shop_type);

    const services = shops.servicesForShop(preset.shop);
    if (preset.shop.services?.repair?.enabled) {
      assert.ok(services.includes("repair"), preset.id + " must expose repair");
    }

    const loyaltyProgram = shops.loyaltyProgram(preset.shop);
    const authoredLoyalty =
      preset.shop.loyalty_program ||
      preset.shop.chain?.loyalty_program ||
      preset.shop.chain?.loyaltyProgram;
    if (authoredLoyalty?.enabled) {
      assert.ok(loyaltyProgram, preset.id + " loyalty should normalize");
      assert.ok(loyaltyProgram.paidPurchasesRequired >= 1);
    }

    for (const promotion of shops.shopPromotions(preset.shop)) {
      assert.ok(promotion.id, preset.id + " promotion must keep an id");
      assert.ok(
        Object.values(shops.PROMOTION_TYPES).includes(promotion.type),
        preset.id + " promotion must normalize to a supported type",
      );
    }
  }

  assert.equal(requiredTypes.size, 0, "standard presets must cover every SHOP_TYPE");
  assert.equal(
    coveredTypes.size,
    Object.keys(shops.SHOP_TYPES).length,
    "coverage count must match the runtime taxonomy",
  );

  const quickStop = presets.get("quickstop_chain").shop;
  const quickStopTransit = presets.get("quickstop_transit").shop;
  const quickStopWithoutPromotion = {
    ...quickStop,
    chain: { ...quickStop.chain, promotions: [] },
  };
  const convenienceItem = {
    id: "test_food",
    family: "food",
    productionValueAhn: 1000,
    tier: "I",
  };
  assert.ok(
    shops.purchasePrice(convenienceItem, quickStop) <
      shops.purchasePrice(convenienceItem, quickStopWithoutPromotion),
    "QuickStop chain promotion must reduce the purchase price",
  );
  assert.equal(shops.shopChain(quickStop).id, shops.shopChain(quickStopTransit).id);
  assert.equal(
    shops.loyaltyProgram(quickStop).id,
    shops.loyaltyProgram(quickStopTransit).id,
    "QuickStop branches must share loyalty program id",
  );

  const sanaClinic = presets.get("sanacorp_clinic").shop;
  const sanaPharmacy = presets.get("sanacorp_pharmacy").shop;
  const sanaNight = presets.get("sanacorp_night_clinic").shop;
  assert.equal(shops.shopChain(sanaClinic).id, "sanacorp");
  assert.equal(shops.shopChain(sanaClinic).id, shops.shopChain(sanaPharmacy).id);
  assert.equal(shops.shopChain(sanaClinic).id, shops.shopChain(sanaNight).id);
  assert.equal(shops.loyaltyProgram(sanaClinic).id, shops.loyaltyProgram(sanaPharmacy).id);
  assert.equal(shops.loyaltyProgram(sanaClinic).id, shops.loyaltyProgram(sanaNight).id);

  const boltBeam = presets.get("boltbeam_hardware").shop;
  const boltBeamIndustrial = presets.get("boltbeam_industrial").shop;
  assert.equal(shops.shopChain(boltBeam).id, shops.shopChain(boltBeamIndustrial).id);
  assert.equal(shops.loyaltyProgram(boltBeam).id, shops.loyaltyProgram(boltBeamIndustrial).id);
  assert.equal(shops.serviceEnabled(boltBeam, "repair"), true);
  assert.equal(shops.serviceEnabled(boltBeamIndustrial, "repair"), true);

  const canteenDay = presets.get("canteen_standard").shop;
  const canteenNight = presets.get("canteen_night").shop;
  assert.equal(shops.shopChain(canteenDay).id, shops.shopChain(canteenNight).id);
  assert.equal(shops.loyaltyProgram(canteenDay).id, shops.loyaltyProgram(canteenNight).id);

  const workshop = presets.get("district_workshop").shop;
  const repairQuote = shops.repairBreakdown(
    {
      id: "test_damaged_tool",
      productionValueAhn: 5000,
      tier: "I",
      condition: 50,
      conditionMax: 100,
      repairMaterialValuePerPointAhn: 25,
    },
    workshop,
    { points: 10 },
  );
  assert.equal(repairQuote.available, true, "Workshop preset must make repair available");
  assert.equal(repairQuote.reason, "available");
  assert.equal(repairQuote.priceAhn, 420);

  const syntheticCatalog = {
    food: convenienceItem,
    retail: { id: "retail", family: "retail_food", productionValueAhn: 1000, tier: "I" },
    staples: { id: "staples", family: "culinary_staples", productionValueAhn: 1000, tier: "I" },
    produce: { id: "produce", family: "plant_produce", productionValueAhn: 1000, tier: "I" },
    meat: { id: "meat", family: "meat", productionValueAhn: 1000, tier: "I" },
    medical: { id: "medical", family: "medical_supply", productionValueAhn: 1000, tier: "I" },
    healing: { id: "healing", family: "healing_hp", productionValueAhn: 1000, tier: "I" },
    cure: { id: "cure", family: "status_cure", productionValueAhn: 1000, tier: "I" },
    tools: { id: "tools", family: "tools", productionValueAhn: 1000, tier: "I" },
    components: { id: "components", family: "craft_components", productionValueAhn: 1000, tier: "I" },
    chemical: { id: "chemical", family: "chemical_raw", productionValueAhn: 1000, tier: "I" },
    weapons: { id: "weapons", family: "weapons", productionValueAhn: 1000, tier: "I" },
    ammo: { id: "ammo", family: "firearm_ammunition", productionValueAhn: 1000, tier: "I" },
    jewelry: { id: "jewelry", family: "jewelry_valuables", productionValueAhn: 1000, tier: "I" },
    ores: { id: "ores", family: "ore_ingot_gem", productionValueAhn: 1000, tier: "I" },
    electronics: { id: "electronics", family: "electronic_parts", productionValueAhn: 1000, tier: "I" },
    precision: { id: "precision", family: "corp_wing_precision_component", productionValueAhn: 1000, tier: "III" },
    hides: { id: "hides", family: "hide_pelt", productionValueAhn: 1000, tier: "I" },
    essence: { id: "essence", family: "essence_core", productionValueAhn: 1000, tier: "IV" },
    venom: { id: "venom", family: "venom_secretion", productionValueAhn: 1000, tier: "IV" },
  };

  for (const preset of list) {
    const generated = shops.generateCatalog(
      syntheticCatalog,
      {
        ...preset.shop,
        jugadores_presentes: { Tester: true },
      },
    );
    assert.ok(
      Object.keys(generated).length > 0,
      preset.id + " must generate at least one item from the synthetic coverage catalog",
    );
  }

  const cloneA = presets.get("quickstop_chain");
  const cloneB = presets.get("quickstop_chain");
  cloneA.shop.nombre = "MUTATED";
  assert.notEqual(cloneA.shop.nombre, cloneB.shop.nombre, "get() must return isolated clones");

  console.log(
    "Standard Shop Presets smoke: OK (24 presets, all 20 shop types, branches, services, loyalty and promotions)",
  );
})();
