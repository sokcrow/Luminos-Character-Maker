const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousShopRuntime;
  await import(pathToFileURL(path.resolve(__dirname, "../js/shop-runtime.js")).href);

  const shops = globalThis.LuminousShopRuntime;
  assert.ok(shops);
  assert.equal(shops.VERSION, 4);
  assert.equal(shops.BASE_PURCHASE_MARKUP, 1.40);
  assert.equal(shops.BASE_SELLBACK_MULTIPLIER, 0.80);

  assert.deepEqual(Object.keys(shops.SHOP_TYPES), [
    "general",
    "provisions",
    "clinic",
    "workshop",
    "arms_dealer",
    "specialist",
    "black_market",
  ]);

  assert.equal(shops.tierNumber("IV"), 4);
  assert.equal(shops.tierNumber(10), 10);
  assert.equal(shops.tierRoman(7), "VII");

  const assigned = {
    shop_type: "general",
    shop_tier: 3,
    mod_venta: 100,
    jugadores_presentes: { Pierre: true, Agatha: true, Angelo: false },
  };
  assert.equal(shops.playerCount(assigned), 2);
  assert.equal(shops.isPlayerAllowed(assigned, "Pierre"), true);
  assert.equal(shops.isPlayerAllowed(assigned, "Angelo"), false);

  // Buying always starts at +40% over the item's intrinsic/production value.
  assert.equal(
    shops.purchasePrice({ productionValueAhn: 100000, tier: "I" }, {
      shop_type: "general",
      shop_tier: 1,
      mod_venta: 100,
    }),
    140000
  );

  // Placeholder zero fields must never shadow a real value authored by the
  // Item family. This is the regression that previously produced free Shops.
  const zeroPlaceholderMaterial = {
    family: "craft_components",
    category: "material",
    tier: "I",
    price: 0,
    costo: 0,
    valorBase: 0,
    mediumStandardValueAhn: 32000,
  };
  assert.equal(shops.baseValueAhn(zeroPlaceholderMaterial), 32000);
  assert.deepEqual(
    shops.resolveBaseValueAhn(zeroPlaceholderMaterial),
    { resolved: true, field: "mediumStandardValueAhn", value: 32000 },
  );
  assert.equal(
    shops.purchasePrice(zeroPlaceholderMaterial, {
      shop_type: "general",
      shop_tier: 1,
      mod_venta: 100,
    }),
    44800,
  );

  assert.equal(
    shops.baseValueAhn({ price: 0, costo: 0, standardValueAhn: 140000 }),
    140000,
    "standardValueAhn must be a canonical Shop price source",
  );

  const unresolved = {
    family: "food",
    category: "food",
    tier: "I",
    price: 0,
    costo: 0,
    valorBase: 0,
  };
  const unresolvedAvailability = shops.itemAvailability(unresolved, {
    shop_type: "provisions",
    shop_tier: 1,
  });
  assert.equal(unresolvedAvailability.available, false);
  assert.equal(unresolvedAvailability.reason, "unpriced");
  assert.equal(unresolvedAvailability.priceEligible, false);
  assert.equal(shops.purchasePrice(unresolved, { shop_type: "provisions", shop_tier: 1 }), null);
  assert.equal(shops.sellPrice(unresolved, { shop_type: "provisions", shop_tier: 1 }), null);
  assert.equal(shops.stockForItem(unresolved, { shop_type: "provisions", shop_tier: 1 }), 0);

  // Shop tier affects market price; item tier no longer gets a second ad-hoc +25%.
  assert.equal(
    shops.purchasePrice({ productionValueAhn: 100000, tier: "V" }, {
      shop_type: "general",
      shop_tier: 5,
      mod_venta: 100,
    }),
    162400
  );

  assert.equal(
    shops.purchasePrice({ productionValueAhn: 100000, tier: "III" }, {
      shop_type: "clinic",
      shop_tier: 3,
      mod_venta: 100,
    }),
    158760
  );

  // Selling is always 20% below intrinsic value. Shop type, Tier and
  // local purchase modifiers do not alter the sellback value.
  assert.equal(
    shops.sellPrice({ productionValueAhn: 100000, tier: "X" }, {
      shop_type: "black_market",
      shop_tier: 10,
      mod_venta: 400,
    }),
    80000
  );
  assert.equal(
    shops.sellPrice({ valorBase: 250000, tier: "I" }, {
      shop_type: "general",
      shop_tier: 1,
      mod_venta: 25,
    }),
    200000
  );

  // Shop Type now gates catalog eligibility before Tier/stock are evaluated.
  const food = { family: "food", category: "food", itemType: "consumable", tier: "I", productionValueAhn: 100000 };
  const weapon = { family: "weapons", category: "weapon", itemType: "weapon", tier: "I", productionValueAhn: 100000 };
  const medicine = { family: "healing_hp", category: "consumable", itemType: "consumable", tier: "I", productionValueAhn: 100000 };
  const component = { family: "craft_components", category: "ingredient", itemType: "component", tier: "I", productionValueAhn: 100000 };

  assert.equal(shops.itemEligibleForShopType(food, { shop_type: "provisions" }), true);
  assert.equal(shops.itemEligibleForShopType(weapon, { shop_type: "provisions" }), false);
  assert.equal(shops.itemEligibleForShopType(medicine, { shop_type: "clinic" }), true);
  assert.equal(shops.itemEligibleForShopType(component, { shop_type: "workshop" }), true);
  assert.equal(shops.itemEligibleForShopType(weapon, { shop_type: "arms_dealer" }), true);

  // Tier still gates availability and stock scales with assigned players.
  assert.equal(shops.stockForItem({ ...food, tier: "IV" }, assigned), 0);
  assert.equal(shops.stockForItem({ ...food, tier: "III" }, assigned), 3);
  assert.equal(shops.stockForItem(food, assigned), 8);
  assert.equal(shops.stockForItem(weapon, assigned), 0);

  const generated = shops.generateCatalog(
    { food, weapon, medicine, component, unresolved },
    { ...assigned, shop_type: "clinic" },
  );
  assert.deepEqual(Object.keys(generated), ["medicine"]);
  assert.equal(generated.medicine.stock_actual > 0, true);
  assert.equal(generated.medicine.shop_stock_auto, true);

  const rebalanced = shops.applyAutomaticStock(
    { ...food, stock_maximo: 8, stock_actual: 5 },
    { ...assigned, jugadores_presentes: { Pierre: true, Agatha: true, Angelo: true } },
    { preserveSold: true }
  );
  assert.equal(rebalanced.stock_maximo, 11);
  assert.equal(rebalanced.stock_actual, 8);
  assert.equal(rebalanced.shop_stock_auto, true);

  console.log("Shop Runtime smoke: OK (type catalogs, tiers, +40% buy, -20% sellback, access and automatic shared stock)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
