const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousShopRuntime;
  await import(pathToFileURL(path.resolve(__dirname, "../js/shop-runtime.js")).href);

  const shops = globalThis.LuminousShopRuntime;
  assert.ok(shops);
  assert.equal(shops.VERSION, 1);
  assert.equal(shops.BASE_PURCHASE_MARKUP, 1.40);

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

  // Tier gates availability and stock scales with assigned players.
  assert.equal(shops.stockForItem({ tier: "IV" }, assigned), 0);
  assert.equal(shops.stockForItem({ tier: "III" }, assigned), 3);
  assert.equal(shops.stockForItem({ tier: "I" }, assigned), 8);

  const rebalanced = shops.applyAutomaticStock(
    { tier: "I", productionValueAhn: 100000, stock_maximo: 8, stock_actual: 5 },
    { ...assigned, jugadores_presentes: { Pierre: true, Agatha: true, Angelo: true } },
    { preserveSold: true }
  );
  assert.equal(rebalanced.stock_maximo, 11);
  assert.equal(rebalanced.stock_actual, 8);
  assert.equal(rebalanced.shop_stock_auto, true);

  console.log("Shop Runtime smoke: OK (types, tiers, +40% pricing, access and automatic shared stock)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
