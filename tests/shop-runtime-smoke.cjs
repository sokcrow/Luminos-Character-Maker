const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousShopRuntime;
  await import(pathToFileURL(path.resolve(__dirname, "../js/shop-runtime.js")).href);

  const shops = globalThis.LuminousShopRuntime;
  assert.ok(shops);
  assert.equal(shops.VERSION, 9);
  assert.equal(shops.BASE_PURCHASE_MARKUP, 1.40);
  assert.equal(shops.BASE_SELLBACK_MULTIPLIER, 0.80);

  assert.deepEqual(Object.keys(shops.SHOP_TYPES), [
    "general",
    "convenience",
    "supermarket",
    "wholesaler",
    "provisions",
    "restaurant",
    "butcher",
    "clinic",
    "pharmacy",
    "workshop",
    "hardware_store",
    "electronics",
    "arms_dealer",
    "jeweler",
    "pawnshop",
    "salvage",
    "corporate_outlet",
    "automated_vendor",
    "specialist",
    "black_market",
  ]);

  // Every declared Shop Type must have a real, non-fallback market profile and
  // a non-empty catalog rule. Adding a type without wiring its catalog must fail CI.
  for (const [shopTypeId, meta] of Object.entries(shops.SHOP_TYPES)) {
    assert.equal(meta.id, shopTypeId, shopTypeId + " must keep a stable canonical id");
    assert.equal(typeof meta.label, "string", shopTypeId + " must expose a player-facing label");
    assert.ok(meta.label.trim().length > 0, shopTypeId + " label must not be empty");
    assert.ok(Number.isFinite(meta.priceMultiplier) && meta.priceMultiplier > 0, shopTypeId + " price multiplier must be positive");
    assert.ok(Number.isFinite(meta.stockMultiplier) && meta.stockMultiplier > 0, shopTypeId + " stock multiplier must be positive");

    const rule = shops.catalogRuleForShop({ shop_type: shopTypeId });
    assert.ok(rule, shopTypeId + " must resolve a catalog rule");
    assert.ok(Array.isArray(rule.primary) && rule.primary.length > 0, shopTypeId + " must have primary catalog families");
    assert.ok(Array.isArray(rule.secondary), shopTypeId + " secondary catalog must be an array");
  }

  // Legacy Shop IDs are persistence contracts. Expanding the taxonomy must not
  // silently change the original seven profiles already stored in campaigns.
  const legacyProfiles = {
    general: [1.00, 1.25],
    provisions: [1.00, 1.50],
    clinic: [1.05, 1.00],
    workshop: [1.08, 0.85],
    arms_dealer: [1.12, 0.75],
    specialist: [1.18, 0.55],
    black_market: [1.25, 0.35],
  };
  for (const [id, [priceMultiplier, stockMultiplier]] of Object.entries(legacyProfiles)) {
    assert.equal(shops.SHOP_TYPES[id].priceMultiplier, priceMultiplier, id + " legacy price multiplier changed");
    assert.equal(shops.SHOP_TYPES[id].stockMultiplier, stockMultiplier, id + " legacy stock multiplier changed");
  }

  assert.equal(shops.shopTypeId({ shop_type: "not_a_real_shop" }), "general", "unknown legacy data must fall back safely");
  assert.notEqual(
    shops.catalogRuleForShop({ shop_type: "supermarket" }),
    shops.catalogRuleForShop({ shop_type: "general" }),
    "new Shop Types must not silently reuse the general catalog object",
  );

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

  // A global market event modifies purchase prices only for affected Shop Types.
  const marketEvent = shops.setMarketEvent({
    active: true,
    id: "field_test_market",
    revision: 101,
    title: "Variación de precios",
    modifiers: {
      general: -20,
      clinic: 25,
      workshop: 0,
    },
  });
  assert.equal(marketEvent.modifiers.general, -20);
  assert.equal(shops.marketEventPercent({ shop_type: "general" }), -20);
  assert.equal(shops.marketEventMultiplier({ shop_type: "general" }), 0.8);
  assert.equal(shops.marketEventPercent({ shop_type: "clinic" }), 25);
  assert.equal(shops.marketEventPercent({ shop_type: "workshop" }), 0);
  assert.equal(shops.marketEventPercent({ shop_type: "supermarket" }), 0, "unlisted sectors must remain unaffected");
  assert.equal(
    shops.purchasePrice({ productionValueAhn: 100000, tier: "I" }, {
      shop_type: "supermarket",
      shop_tier: 1,
      mod_venta: 100,
    }),
    134400,
    "an event targeting other sectors must not leak into supermarket pricing",
  );
  assert.equal(
    shops.purchasePrice({ productionValueAhn: 100000, tier: "I" }, {
      shop_type: "general",
      shop_tier: 1,
      mod_venta: 100,
    }),
    112000,
  );
  assert.equal(
    shops.purchasePrice({ productionValueAhn: 100000, tier: "I" }, {
      shop_type: "clinic",
      shop_tier: 1,
      mod_venta: 100,
    }),
    183750,
  );
  assert.equal(
    shops.sellPrice({ productionValueAhn: 100000, tier: "I" }, {
      shop_type: "clinic",
      shop_tier: 1,
      mod_venta: 100,
    }),
    80000,
    "market events must not change canonical sellback",
  );
  const eventStockedFood = shops.applyAutomaticStock(
    { family: "food", category: "food", tier: "I", productionValueAhn: 100000 },
    { shop_type: "general", shop_tier: 1, mod_venta: 100, jugadores_presentes: { Pierre: true } },
    { preserveSold: false },
  );
  assert.equal(
    eventStockedFood.shop_price_ahn,
    140000,
    "stored Shop list price must not persist a temporary Market Event",
  );
  assert.equal(
    shops.purchasePrice(eventStockedFood, { shop_type: "general", shop_tier: 1, mod_venta: 100 }),
    112000,
    "live purchase price must still apply the active Market Event",
  );
  shops.setMarketEvent(null);
  assert.equal(shops.marketEventPercent({ shop_type: "general" }), 0);

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

  // Generative definitions are materialized before entering a Shop catalog.
  globalThis.LuminousArmorComponentCatalog = {
    resolveReferenceComponent(id) {
      if (id !== "armor_plate") return null;
      return {
        valid: true,
        componentId: id,
        name: "Armor Plate",
        quality: "standard",
        composition: [{ materialId: "iron", quantity: 4 }],
        productionValueAhn: 156000,
      };
    },
  };
  const rawArmorPlate = {
    id: "armor_plate",
    definitionId: "armor_plate",
    family: "armor_components",
    category: "component",
    itemType: "armor_component",
    tier: "I",
    price: 0,
    costo: 0,
    valorBase: 0,
  };
  const materializedArmorPlate = shops.materializeReferenceItem(rawArmorPlate);
  assert.equal(materializedArmorPlate.productionValueAhn, 156000);
  assert.equal(materializedArmorPlate.costo, 156000);
  assert.equal(materializedArmorPlate.composition[0].materialId, "iron");

  const generatedWorkshop = shops.generateCatalog(
    { armor_plate: rawArmorPlate },
    {
      shop_type: "workshop",
      shop_tier: 1,
      mod_venta: 100,
      jugadores_presentes: { Pierre: true },
    },
  );
  assert.equal(generatedWorkshop.armor_plate.productionValueAhn, 156000);
  assert.equal(generatedWorkshop.armor_plate.shop_price_ahn, 235870);
  assert.equal(generatedWorkshop.armor_plate.composition[0].materialId, "iron");
  delete globalThis.LuminousArmorComponentCatalog;

  // Loot valuables already have canonical fixed variants. A Shop reference uses
  // the normal/gold variant rather than treating the chassis as a zero-Ahn item.
  globalThis.LuminousJewelryValuableCatalog = {
    DEFAULT_METAL_ID: "silver",
    create(id, options = {}) {
      if (id !== "goblet" || options.origin !== "loot") return { valid: false };
      const gems = options.variant === "gems";
      const value = gems ? 780000 : 420000;
      return {
        valid: true,
        id,
        definitionId: id,
        name: "Goblet",
        displayName: gems ? "Gem-Inlaid Goblet" : "Gold Goblet",
        kind: "valuable",
        category: "valuable",
        itemType: "valuable",
        valuableVariant: gems ? "gems" : "gold",
        variantSignature: id + ":" + (gems ? "gems" : "gold"),
        productionValueAhn: value,
        unitValueAhn: value,
        totalValueAhn: value,
      };
    },
  };
  const rawGoblet = {
    id: "goblet",
    family: "jewelry_valuables",
    kind: "valuable",
    category: "valuable",
    itemType: "valuable",
    lootOnly: true,
    tier: "I",
    variants: {
      gold: { standardValueAhn: 420000 },
      gems: { standardValueAhn: 780000 },
    },
  };
  assert.equal(shops.materializeReferenceItem(rawGoblet).productionValueAhn, 420000);
  assert.equal(
    shops.materializeReferenceItem(rawGoblet, { valuableVariant: "gems" }).productionValueAhn,
    780000,
  );
  delete globalThis.LuminousJewelryValuableCatalog;

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

  // Sellback always prices one owned unit, never the whole stack.
  const valuedStack = {
    productionValueAhn: 5000,
    unitValueAhn: 1000,
    totalValueAhn: 5000,
    quantity: 5,
    cantidad: 5,
    tier: "I",
  };
  assert.deepEqual(
    shops.resolveSellUnitValueAhn(valuedStack),
    { resolved: true, field: "unitValueAhn", value: 1000 },
  );
  assert.equal(
    shops.sellPrice(valuedStack, { shop_type: "general", shop_tier: 1 }),
    800,
  );

  const totalOnlyStack = {
    totalValueAhn: 5000,
    quantity: 5,
    cantidad: 5,
    tier: "I",
  };
  assert.deepEqual(
    shops.resolveSellUnitValueAhn(totalOnlyStack),
    { resolved: true, field: "totalValueAhn/quantity", value: 1000 },
  );
  assert.equal(
    shops.sellPrice(totalOnlyStack, { shop_type: "general", shop_tier: 1 }),
    800,
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

  // Modern/urban commerce profiles must have distinct catalog behavior.
  assert.equal(shops.itemEligibleForShopType(food, { shop_type: "supermarket" }), true);
  assert.equal(shops.itemEligibleForShopType(weapon, { shop_type: "supermarket" }), false);
  assert.equal(shops.itemEligibleForShopType(medicine, { shop_type: "pharmacy" }), true);
  assert.equal(shops.itemEligibleForShopType(component, { shop_type: "hardware_store" }), true);
  assert.equal(
    shops.itemEligibleForShopType(
      { id: "sensor_component", family: "craft_components", category: "component", tier: "I", productionValueAhn: 100000 },
      { shop_type: "electronics" },
    ),
    true,
  );
  assert.equal(
    shops.itemEligibleForShopType(
      { family: "jewelry_valuables", kind: "valuable", category: "valuable", tier: "I", productionValueAhn: 100000 },
      { shop_type: "jeweler" },
    ),
    true,
  );
  assert.equal(
    shops.purchasePrice(food, { shop_type: "supermarket", shop_tier: 1, mod_venta: 100 }),
    134400,
    "supermarket profile should use its lower high-volume multiplier",
  );
  assert.equal(
    shops.purchasePrice(food, { shop_type: "convenience", shop_tier: 1, mod_venta: 100 }),
    151200,
    "convenience profile should charge for immediate availability",
  );

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


  // Repair is a service economy, not a resale calculation:
  // (durability points repaired × material value per point) × 1.40.
  const damagedBlade = {
    family: "weapons",
    category: "weapon",
    durabilityCurrent: 60,
    durabilityMax: 100,
    repairMaterialValuePerPointAhn: 500,
  };
  assert.equal(shops.serviceEnabled({ shop_type: "workshop" }, "repair"), true);
  assert.equal(shops.serviceEnabled({ shop_type: "restaurant" }, "repair"), false);
  assert.equal(
    shops.serviceEnabled({ shop_type: "jeweler" }, "enchant"),
    false,
    "Enchanter services must not appear automatically without an authored provider/service profile",
  );
  assert.equal(
    shops.serviceEnabled({ shop_type: "jeweler", services: { enchant: { enabled: true } } }, "enchant"),
    true,
    "DM-authored Shops may explicitly expose Enchanter services through the common Shop service architecture",
  );
  assert.equal(
    shops.serviceEnabled({ shop_type: "workshop", services: { repair: { enabled: false } } }, "repair"),
    false,
    "DM must be able to disable a default service locally",
  );
  assert.equal(
    shops.serviceEnabled({ shop_type: "restaurant", services: { repair: { enabled: true } } }, "repair"),
    true,
    "DM must be able to add a service as a local exception",
  );
  const canonicalConditionItem = {
    condition: 72,
    conditionMax: 100,
    repairMaterialValuePerPointAhn: 500,
  };
  assert.deepEqual(
    shops.durabilityState(canonicalConditionItem),
    { resolved: true, current: 72, max: 100, missing: 28 },
    "Shop repair must understand canonical inventory condition/conditionMax",
  );

  const repair = shops.repairBreakdown(damagedBlade, { shop_type: "workshop" });
  assert.equal(repair.available, true);
  assert.equal(repair.missingDurability, 40);
  assert.equal(repair.materialSubtotalAhn, 20000);
  assert.equal(repair.serviceMarkup, 1.40);
  assert.equal(repair.priceAhn, 28000);
  assert.equal(
    shops.repairPrice(damagedBlade, { shop_type: "workshop" }, { points: 10 }),
    7000,
    "partial repairs must price only the requested missing durability",
  );

  const materialDrivenBlade = {
    family: "weapons",
    currentDurability: 80,
    maxDurability: 100,
    primaryComponentId: "long_blade",
    components: [
      {
        componentId: "long_blade",
        primaryMaterial: {
          materialId: "iron",
          materialName: "Iron",
          unitValueAhn: 22000,
          unitDurability: 40,
        },
      },
    ],
  };
  assert.deepEqual(
    shops.resolveRepairMaterialValueAhn(materialDrivenBlade),
    {
      resolved: true,
      field: "components.primaryMaterial",
      value: 550,
      materialId: "iron",
      materialName: "Iron",
      unitValueAhn: 22000,
      unitDurability: 40,
    },
    "repair must derive the material cost per durability point from the actual crafted material",
  );
  assert.equal(
    shops.repairPrice(materialDrivenBlade, { shop_type: "workshop" }),
    15400,
    "20 missing PD × ₳550 material/PD × 1.40 labor must equal ₳15,400",
  );

  // A chain can provide promotions and loyalty while a merchant NPC can add
  // relationship/frequent-customer benefits without changing intrinsic value.
  const livingShop = {
    shop_type: "general",
    shop_tier: 1,
    mod_venta: 100,
    chain: {
      id: "hamham",
      name: "HamHam",
      promotions: [
        {
          id: "food_week",
          type: "percent_discount",
          scope: "category",
          categories: ["food"],
          discount_percent: 20,
        },
      ],
      loyalty_program: {
        id: "hamham_card",
        name: "Tarjeta HamHam",
        paid_purchases_required: 9,
        reward_type: "free_next",
        categories: ["food"],
      },
    },
    merchant_npc: {
      enabled: true,
      id: "mika",
      name: "Mika",
      sprite: "mika.png",
      greeting: "Qué bueno verte.",
      frequent_customer_min_purchases: 10,
      frequent_customer_discount_percent: 5,
      relationship_discounts: {
        trusted: 10,
      },
    },
  };
  const promoFood = {
    id: "burger",
    family: "food",
    category: "food",
    tier: "I",
    productionValueAhn: 100000,
  };
  assert.equal(shops.shopChain(livingShop).id, "hamham");
  assert.equal(shops.merchantNpc(livingShop).name, "Mika");
  assert.equal(shops.merchantNpc(livingShop).greeting, "Qué bueno verte.");
  assert.equal(shops.loyaltyProgram(livingShop).paidPurchasesRequired, 9);

  const promotionOnly = shops.priceBreakdown(promoFood, livingShop);
  assert.equal(promotionOnly.listPriceAhn, 140000);
  assert.equal(promotionOnly.promotionDiscountPercent, 20);
  assert.equal(promotionOnly.priceAhn, 112000);

  const knownCustomer = shops.priceBreakdown(promoFood, livingShop, {
    context: {
      shopPurchaseCount: 12,
      relationshipTier: "trusted",
      loyaltyProgress: 4,
    },
  });
  assert.equal(knownCustomer.promotionDiscountPercent, 20);
  assert.equal(knownCustomer.merchantDiscountPercent, 15);
  assert.equal(knownCustomer.totalDiscountPercent, 35);
  assert.equal(knownCustomer.priceAhn, 91000);
  assert.equal(knownCustomer.loyaltyProgress, 4);

  const tenthPurchase = shops.priceBreakdown(promoFood, livingShop, {
    context: {
      loyaltyProgress: 9,
    },
  });
  assert.equal(tenthPurchase.priceResolved, true);
  assert.equal(tenthPurchase.loyaltyRewardApplied, true);
  assert.equal(tenthPurchase.priceAhn, 0, "the purchase after nine paid stamps must be free");
  assert.equal(
    shops.nextLoyaltyProgress(livingShop, { loyaltyProgress: 9 }, { item: promoFood, redeemed: true }),
    0,
  );
  assert.equal(
    shops.nextLoyaltyProgress(livingShop, { loyaltyProgress: 8 }, { item: promoFood }),
    9,
  );

  const repairCardShop = {
    shop_type: "workshop",
    services: { repair: { enabled: true } },
    loyalty_program: {
      id: "repair_card",
      name: "Tarjeta de Reparación",
      scope: "services",
      paid_purchases_required: 9,
      reward_type: "free_next",
      service_ids: ["repair"],
    },
  };
  const loyaltyRepair = shops.repairBreakdown(damagedBlade, repairCardShop, {
    points: 10,
    context: { loyaltyProgress: 9 },
  });
  assert.equal(loyaltyRepair.listPriceAhn, 7000);
  assert.equal(loyaltyRepair.loyaltyRewardApplied, true);
  assert.equal(loyaltyRepair.priceAhn, 0, "the 10th eligible repair must be free after 9 paid services");

  // Stored catalog list price must remain stable and must not bake temporary
  // promotions, merchant relationship or loyalty into the Item.
  const promotedStock = shops.applyAutomaticStock(
    promoFood,
    { ...livingShop, jugadores_presentes: { Pierre: true } },
    { preserveSold: false },
  );
  assert.equal(promotedStock.shop_price_ahn, 140000);

  const rewardShop = {
    shop_type: "restaurant",
    promotions: [
      {
        id: "burger_drink",
        type: "gift_after_purchase",
        scope: "item",
        item_ids: ["burger"],
        reward_item_id: "soft_drink",
        reward_quantity: 1,
      },
      {
        id: "two_burgers_fries",
        type: "buy_x_get_y",
        scope: "item",
        item_ids: ["burger"],
        buy_quantity: 2,
        reward_item_id: "fries",
      },
    ],
  };
  assert.deepEqual(
    shops.promotionRewardPlan(promoFood, rewardShop, {
      promotionProgress: { two_burgers_fries: 1 },
    }).map((reward) => reward.itemId),
    ["soft_drink", "fries"],
  );

  console.log("Shop Runtime smoke: OK (type catalogs, tiers, +40% buy, -20% sellback, access and automatic shared stock, repair, promotions, loyalty and NPC commerce)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
