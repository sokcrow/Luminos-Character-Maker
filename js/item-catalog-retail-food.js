(function (global) {
  "use strict";

  if (global.LuminousRetailFoodCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRetailFoodCatalog;
    return;
  }

  const VERSION = 1;
  const CATALOG_ID = "retail_food";
  const FAMILY = "food";
  const CURRENCY = "AHN";
  const PRICE_MULTIPLIER = 1.25;
  const EFFECT_MULTIPLIER = 0.50;
  const AVAILABILITY_MULTIPLIER = 2.00;
  const CULINARY_SYSTEM = "retail_food_v1";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function roundTo10(value) {
    return Math.round((Number(value) || 0) / 10) * 10;
  }

  const ROWS = Object.freeze([
    Object.freeze({ id:"butter_cookie_retail_pack", name:"Butter Cookie Retail Pack", bakeryRecipeId:"butter_cookie", bakeryReferencePriceAhn:7200, iconFamily:"butter_cookie_retail_pack" }),
    Object.freeze({ id:"sugar_cookie_retail_pack", name:"Sugar Cookie Retail Pack", bakeryRecipeId:"sugar_cookie", bakeryReferencePriceAhn:6400, iconFamily:"sugar_cookie_retail_pack" }),
    Object.freeze({ id:"chocolate_chip_cookie_retail_pack", name:"Chocolate Chip Cookie Retail Pack", bakeryRecipeId:"chocolate_chip_cookie", bakeryReferencePriceAhn:8800, iconFamily:"chocolate_chip_cookie_retail_pack" }),
    Object.freeze({ id:"chocolate_cookie_retail_pack", name:"Chocolate Cookie Retail Pack", bakeryRecipeId:"chocolate_cookie", bakeryReferencePriceAhn:9200, iconFamily:"chocolate_cookie_retail_pack" }),
    Object.freeze({ id:"oatmeal_cookie_retail_pack", name:"Oatmeal Cookie Retail Pack", bakeryRecipeId:"oatmeal_cookie", bakeryReferencePriceAhn:7200, iconFamily:"oatmeal_cookie_retail_pack" }),
    Object.freeze({ id:"ginger_cookie_retail_pack", name:"Ginger Cookie Retail Pack", bakeryRecipeId:"ginger_cookie", bakeryReferencePriceAhn:8000, iconFamily:"ginger_cookie_retail_pack" }),
    Object.freeze({ id:"shortbread_cookie_retail_pack", name:"Shortbread Cookie Retail Pack", bakeryRecipeId:"shortbread_cookie", bakeryReferencePriceAhn:6800, iconFamily:"food_snack", iconStatus:"family_fallback" }),
    Object.freeze({ id:"almond_cookie_retail_pack", name:"Almond Cookie Retail Pack", bakeryRecipeId:"almond_cookie", bakeryReferencePriceAhn:10000, iconFamily:"almond_cookie_retail_pack" }),
    Object.freeze({ id:"coconut_cookie_retail_pack", name:"Coconut Cookie Retail Pack", bakeryRecipeId:"coconut_cookie", bakeryReferencePriceAhn:8800, iconFamily:"coconut_cookie_retail_pack" }),
    Object.freeze({ id:"jam_cookie_retail_pack", name:"Jam Cookie Retail Pack", bakeryRecipeId:"jam_cookie", bakeryReferencePriceAhn:8400, iconFamily:"jam_cookie_retail_pack" }),
    Object.freeze({ id:"honey_cookie_retail_pack", name:"Honey Cookie Retail Pack", bakeryRecipeId:"honey_cookie", bakeryReferencePriceAhn:9200, iconFamily:"honey_cookie_retail_pack" }),
    Object.freeze({ id:"coffee_cookie_retail_pack", name:"Coffee Cookie Retail Pack", bakeryRecipeId:"coffee_cookie", bakeryReferencePriceAhn:9600, iconFamily:"coffee_cookie_retail_pack" }),
  ]);

  function definition(row = {}) {
    const bakeryReferencePriceAhn = Math.max(0, Math.round(Number(row.bakeryReferencePriceAhn) || 0));
    return Object.freeze({
      id: row.id,
      name: row.name,
      family: FAMILY,
      catalogId: CATALOG_ID,
      iconFamily: row.iconFamily || "food_snack",
      iconStatus: row.iconStatus || "dedicated",
      category: "food",
      itemType: "consumable",
      sourceLine: "retail_industrial_food",
      currency: CURRENCY,
      retailPack: true,
      retailKind: "cookie_pack",
      bakeryRecipeId: row.bakeryRecipeId,
      recipeId: null,
      hasRecipe: false,
      craftable: false,
      industrial: true,
      productionModel: "mass_production",
      bakeryReferencePriceAhn,
      retailPriceMultiplier: PRICE_MULTIPLIER,
      priceAhn: roundTo10(bakeryReferencePriceAhn * PRICE_MULTIPLIER),
      effectMultiplier: EFFECT_MULTIPLIER,
      availabilityMultiplier: AVAILABILITY_MULTIPLIER,
      availabilityChannel: "retail",
      freshnessModel: "shelf_stable",
      shelfLifeClass: "long",
      culinarySystem: CULINARY_SYSTEM,
      defaultHungerSlotsRestored: 1,
      stackable: true,
      stackPolicy: "identical_retail_cookie_pack",
      tags: Object.freeze(["food","cookie","retail","industrial","packaged","shelf_stable"]),
    });
  }

  const ITEMS = Object.freeze(ROWS.map(definition));

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function get(id) {
    const key = normalizeId(id);
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const kind = normalizeId(options.kind || options.retailKind);
    const iconStatus = normalizeId(options.iconStatus);
    return ITEMS
      .filter((entry) => !kind || entry.retailKind === kind)
      .filter((entry) => !iconStatus || entry.iconStatus === iconStatus)
      .map(clone);
  }

  function createPack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const quantity = Math.max(1, Math.trunc(Number(options.quantity ?? 1) || 1));
    return {
      itemId: entry.id,
      definitionId: entry.id,
      displayName: entry.name,
      name: entry.name,
      family: FAMILY,
      catalogId: CATALOG_ID,
      iconFamily: entry.iconFamily,
      iconStatus: entry.iconStatus,
      category: entry.category,
      itemType: entry.itemType,
      sourceLine: entry.sourceLine,
      quantity,
      stackPolicy: entry.stackPolicy,
      retailPack: true,
      retailKind: entry.retailKind,
      bakeryRecipeId: entry.bakeryRecipeId,
      recipeId: null,
      hasRecipe: false,
      craftable: false,
      industrial: true,
      productionModel: entry.productionModel,
      effectMultiplier: entry.effectMultiplier,
      availabilityMultiplier: entry.availabilityMultiplier,
      availabilityChannel: entry.availabilityChannel,
      freshnessModel: entry.freshnessModel,
      shelfLifeClass: entry.shelfLifeClass,
      culinarySystem: entry.culinarySystem,
      unitValueAhn: entry.priceAhn,
      totalValueAhn: entry.priceAhn * quantity,
      currency: CURRENCY,
      tags: clone(entry.tags),
    };
  }

  const API = Object.freeze({
    VERSION,
    CATALOG_ID,
    FAMILY,
    CURRENCY,
    PRICE_MULTIPLIER,
    EFFECT_MULTIPLIER,
    AVAILABILITY_MULTIPLIER,
    CULINARY_SYSTEM,
    ITEMS,
    RETAIL_COOKIES: ITEMS,
    normalizeId,
    get,
    list,
    createPack,
    createRetailCookiePack: createPack,
    listRetailCookieDefinitions: list,
  });

  global.LuminousRetailFoodCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
