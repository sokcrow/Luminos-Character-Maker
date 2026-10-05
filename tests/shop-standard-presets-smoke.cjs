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
  assert.equal(presets.VERSION, 1);

  const list = presets.list();
  assert.equal(list.length, 8);
  assert.equal(new Set(list.map((preset) => preset.id)).size, list.length);

  const requiredTypes = new Set([
    "general",
    "convenience",
    "pharmacy",
    "workshop",
    "arms_dealer",
    "restaurant",
    "wholesaler",
    "black_market",
  ]);

  for (const preset of list) {
    assert.ok(preset.id);
    assert.ok(preset.name);
    assert.ok(Array.isArray(preset.testFocus) && preset.testFocus.length > 0);
    assert.ok(preset.shop);
    assert.ok(shops.SHOP_TYPES[preset.shop.shop_type], preset.id + " uses an unknown shop type");
    assert.ok(preset.shop.shop_tier >= 1 && preset.shop.shop_tier <= shops.MAX_TIER);
    assert.ok(preset.shop.mod_venta > 0);
    requiredTypes.delete(preset.shop.shop_type);

    const services = shops.servicesForShop(preset.shop);
    if (preset.shop.services?.repair?.enabled) {
      assert.ok(services.includes("repair"), preset.id + " must expose repair");
    }

    const loyalty = shops.loyaltyProgram(preset.shop);
    const authoredLoyalty = preset.shop.loyalty_program || preset.shop.chain?.loyalty_program;
    if (authoredLoyalty?.enabled) {
      assert.ok(loyalty, preset.id + " loyalty should normalize");
      assert.ok(loyalty.paidPurchasesRequired >= 1);
    }

    for (const promotion of shops.shopPromotions(preset.shop)) {
      assert.ok(promotion.id, preset.id + " promotion must keep an id");
      assert.ok(
        Object.values(shops.PROMOTION_TYPES).includes(promotion.type),
        preset.id + " promotion must normalize to a supported type",
      );
    }
  }

  assert.equal(requiredTypes.size, 0, "standard presets must cover all intended shop profiles");

  const quickStop = presets.get("quickstop_chain").shop;
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
    medical: { id: "medical", family: "medical_supply", productionValueAhn: 1000, tier: "I" },
    healing: { id: "healing", family: "healing_hp", productionValueAhn: 1000, tier: "I" },
    tools: { id: "tools", family: "tools", productionValueAhn: 1000, tier: "I" },
    components: { id: "components", family: "craft_components", productionValueAhn: 1000, tier: "I" },
    weapons: { id: "weapons", family: "weapons", productionValueAhn: 1000, tier: "I" },
    retail: { id: "retail", family: "retail_food", productionValueAhn: 1000, tier: "I" },
    essence: { id: "essence", family: "essence_core", productionValueAhn: 1000, tier: "IV" },
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

  console.log("Standard Shop Presets smoke: OK (8 presets, types, services, loyalty and promotions)");
})();
