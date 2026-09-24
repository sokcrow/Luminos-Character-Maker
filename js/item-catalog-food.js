(function (global) {
  "use strict";

  if (global.LuminousFoodCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFoodCatalog;
    return;
  }

  const VERSION = 3;
  const FAMILY = "food";
  const CURRENCY = "AHN";
  const ECONOMY_STANDARD = "salary_v1";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_SIZE = "medium";
  const SIMPLE_COOKING_VALUE_MULTIPLIER = 1.10;
  const SHOP_RETAIL_MULTIPLIER = 1.35;
  const RETAIL_COOKIE_PRICE_MULTIPLIER = 1.25;
  const RETAIL_COOKIE_EFFECT_MULTIPLIER = 0.50;
  const RETAIL_COOKIE_AVAILABILITY_MULTIPLIER = 2.00;
  const RATION_HUNGER = 100;
  const COOKING_SYSTEM = "cooking_v1";
  const LEGACY_HUNGER_SYSTEM = "size_daily_hunger_compatibility_only";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  }

  function sizeEngine() {
    return global.LuminousItemSizeLineageEngine || safeRequire("./item-size-lineage-engine.js");
  }

  function meatCatalog() {
    return global.LuminousMeatCatalog || safeRequire("./item-catalog-meat.js");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function roundTo10(value) {
    return Math.round((Number(value) || 0) / 10) * 10;
  }

  const RETAIL_COOKIE_ROWS = Object.freeze([
    Object.freeze({ id:"butter_cookie_retail_pack", name:"Butter Cookie Retail Pack", bakeryRecipeId:"butter_cookie", bakeryReferencePriceAhn:7200, iconFamily:"butter_cookie_retail_pack" }),
    Object.freeze({ id:"sugar_cookie_retail_pack", name:"Sugar Cookie Retail Pack", bakeryRecipeId:"sugar_cookie", bakeryReferencePriceAhn:6400, iconFamily:"sugar_cookie_retail_pack" }),
    Object.freeze({ id:"chocolate_chip_cookie_retail_pack", name:"Chocolate Chip Cookie Retail Pack", bakeryRecipeId:"chocolate_chip_cookie", bakeryReferencePriceAhn:8800, iconFamily:"chocolate_chip_cookie_retail_pack" }),
    Object.freeze({ id:"chocolate_cookie_retail_pack", name:"Chocolate Cookie Retail Pack", bakeryRecipeId:"chocolate_cookie", bakeryReferencePriceAhn:9200, iconFamily:"chocolate_cookie_retail_pack" }),
    Object.freeze({ id:"oatmeal_cookie_retail_pack", name:"Oatmeal Cookie Retail Pack", bakeryRecipeId:"oatmeal_cookie", bakeryReferencePriceAhn:7200, iconFamily:"oatmeal_cookie_retail_pack" }),
    Object.freeze({ id:"ginger_cookie_retail_pack", name:"Ginger Cookie Retail Pack", bakeryRecipeId:"ginger_cookie", bakeryReferencePriceAhn:8000, iconFamily:"ginger_cookie_retail_pack" }),
    Object.freeze({ id:"shortbread_cookie_retail_pack", name:"Shortbread Cookie Retail Pack", bakeryRecipeId:"shortbread_cookie", bakeryReferencePriceAhn:6800, iconFamily:"food_snack" }),
    Object.freeze({ id:"almond_cookie_retail_pack", name:"Almond Cookie Retail Pack", bakeryRecipeId:"almond_cookie", bakeryReferencePriceAhn:10000, iconFamily:"almond_cookie_retail_pack" }),
    Object.freeze({ id:"coconut_cookie_retail_pack", name:"Coconut Cookie Retail Pack", bakeryRecipeId:"coconut_cookie", bakeryReferencePriceAhn:8800, iconFamily:"coconut_cookie_retail_pack" }),
    Object.freeze({ id:"jam_cookie_retail_pack", name:"Jam Cookie Retail Pack", bakeryRecipeId:"jam_cookie", bakeryReferencePriceAhn:8400, iconFamily:"jam_cookie_retail_pack" }),
    Object.freeze({ id:"honey_cookie_retail_pack", name:"Honey Cookie Retail Pack", bakeryRecipeId:"honey_cookie", bakeryReferencePriceAhn:9200, iconFamily:"honey_cookie_retail_pack" }),
    Object.freeze({ id:"coffee_cookie_retail_pack", name:"Coffee Cookie Retail Pack", bakeryRecipeId:"coffee_cookie", bakeryReferencePriceAhn:9600, iconFamily:"coffee_cookie_retail_pack" }),
  ]);

  function retailCookieDefinition(row = {}) {
    const bakeryReferencePriceAhn = Math.max(0, Math.round(Number(row.bakeryReferencePriceAhn) || 0));
    return Object.freeze({
      id: row.id, name: row.name, family: FAMILY, iconFamily: row.iconFamily || "food_snack",
      category: "food", itemType: "consumable", sourceLine: "retail_industrial_food", currency: CURRENCY,
      bakeryRecipeId: row.bakeryRecipeId, recipeId: null, hasRecipe: false, craftable: false, industrial: true,
      productionModel: "mass_production", bakeryReferencePriceAhn,
      retailPriceMultiplier: RETAIL_COOKIE_PRICE_MULTIPLIER,
      priceAhn: roundTo10(bakeryReferencePriceAhn * RETAIL_COOKIE_PRICE_MULTIPLIER),
      effectMultiplier: RETAIL_COOKIE_EFFECT_MULTIPLIER,
      availabilityMultiplier: RETAIL_COOKIE_AVAILABILITY_MULTIPLIER,
      availabilityChannel: "retail", freshnessModel: "shelf_stable", shelfLifeClass: "long",
      culinarySystem: "retail_food_v1", defaultHungerSlotsRestored: 1, stackable: true,
      stackPolicy: "identical_retail_cookie_pack",
      tags: Object.freeze(["food","cookie","retail","industrial","packaged","shelf_stable"]),
    });
  }

  const RETAIL_COOKIES = Object.freeze(RETAIL_COOKIE_ROWS.map(retailCookieDefinition));

  function listRetailCookieDefinitions() { return RETAIL_COOKIES.map(clone); }

  function createRetailCookiePack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string"
      ? RETAIL_COOKIES.find((row) => row.id === String(itemOrId || "").trim())
      : itemOrId;
    if (!entry) return null;
    const quantity = Math.max(1, Math.trunc(Number(options.quantity ?? 1) || 1));
    return {
      itemId: entry.id, definitionId: entry.id, displayName: entry.name, name: entry.name,
      family: FAMILY, iconFamily: entry.iconFamily, category: entry.category, itemType: entry.itemType,
      sourceLine: entry.sourceLine, quantity, stackPolicy: entry.stackPolicy,
      bakeryRecipeId: entry.bakeryRecipeId, recipeId: null, hasRecipe: false, industrial: true,
      productionModel: entry.productionModel, effectMultiplier: entry.effectMultiplier,
      availabilityMultiplier: entry.availabilityMultiplier, availabilityChannel: entry.availabilityChannel,
      freshnessModel: entry.freshnessModel, shelfLifeClass: entry.shelfLifeClass,
      unitValueAhn: entry.priceAhn, totalValueAhn: entry.priceAhn * quantity, currency: CURRENCY,
      tags: clone(entry.tags),
    };
  }

  function rawMeat(itemOrId) {
    const catalog = meatCatalog();
    if (!catalog) return null;
    if (typeof itemOrId === "string") return catalog.get(itemOrId);
    return clone(itemOrId);
  }

  function cookedName(raw, lineageName) {
    const lineage = String(lineageName || raw?.lineageName || "").trim();
    if (/ Meat$/i.test(raw?.name || "")) return `Cooked ${lineage || raw.name.replace(/ Meat$/i, "")} Meat`;
    if (raw?.name === "Venison" && (!lineage || lineage === "Venison")) return "Cooked Venison";
    return `Cooked ${lineage || raw?.name || "Meat"}`.replace(/\s+/g, " ").trim();
  }

  function simpleCookedDefinition(itemOrId) {
    const raw = rawMeat(itemOrId);
    if (!raw) return null;
    const suffix = String(raw.id || "").replace(/^meat_/, "");
    const cookedBaseValueAhn = Math.round(raw.priceAhn * SIMPLE_COOKING_VALUE_MULTIPLIER);
    const priceAhn = roundTo10(cookedBaseValueAhn * SHOP_RETAIL_MULTIPLIER);
    return {
      id: `food_cooked_${suffix}`,
      name: cookedName(raw, raw.lineageName),
      family: FAMILY,
      iconFamily: "food",
      category: "food",
      itemType: "consumable",
      sourceLine: "simple_cooking",
      currency: CURRENCY,
      rawItemId: raw.id,
      lineageId: raw.lineageId,
      lineageName: raw.lineageName,
      cookedBaseValueAhn,
      priceAhn,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "universal_physical",
      culinarySystem: COOKING_SYSTEM,
      hungerSystem: LEGACY_HUNGER_SYSTEM,
      defaultHungerSlotsRestored: 1,
      stackable: true,
      stackPolicy: "identical_item_quality_size_lineage_affinity",
      culinaryAffinities: clone(raw.culinaryAffinities || {}),
      culinaryAffinityProfileId: raw.culinaryAffinityProfileId || null,
      tags: ["food", "cooked", "meat", "simple_cooking"],
    };
  }

  function listSimpleCookedDefinitions() {
    const catalog = meatCatalog();
    return catalog?.ITEMS ? catalog.ITEMS.map(simpleCookedDefinition).filter(Boolean) : [];
  }

  function get(id) {
    const key = String(id || "").trim();
    const found = listSimpleCookedDefinitions().find((entry) => entry.id === key)
      || RETAIL_COOKIES.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function priceForSizeAndQuality(itemOrId, size = DEFAULT_SIZE, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const sEngine = sizeEngine();
    const qEngine = qualityEngine();
    const sized = sEngine?.scaleValue
      ? sEngine.scaleValue(entry.priceAhn, size, { rounding: "round" })
      : Math.round(Number(entry.priceAhn) || 0);
    return qEngine?.applyValue ? qEngine.applyValue(sized, quality, { rounding: "round" }) : sized;
  }

  function createSimpleCookedFood(meatStack, options = {}) {
    const raw = rawMeat(meatStack?.itemId || options.rawItemId);
    if (!raw) return null;
    const definition = simpleCookedDefinition(raw);
    const sEngine = sizeEngine();
    const qEngine = qualityEngine();
    const size = sEngine?.canonicalSize ? sEngine.canonicalSize(options.size || meatStack?.size || DEFAULT_SIZE) : String(options.size || meatStack?.size || DEFAULT_SIZE);
    const quality = qEngine?.getQuality
      ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id
      : String(options.quality || DEFAULT_QUALITY);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({
          lineageId: options.lineageId || meatStack?.lineageId || raw.lineageId,
          lineageName: options.lineageName || meatStack?.lineageName || raw.lineageName,
        }, raw.lineageName)
      : { lineageId: raw.lineageId, lineageName: raw.lineageName };
    const hunger = sEngine?.hungerForSize ? sEngine.hungerForSize(size) : RATION_HUNGER;
    const sizeMultiplier = sEngine?.getSize ? sEngine.getSize(size).multiplier : 1;
    const qualityEffectMultiplier = qEngine?.getQuality ? qEngine.getQuality(quality).effectMultiplier : 1;
    return {
      itemId: definition.id,
      family: FAMILY,
      quantity: Math.max(1, Math.trunc(Number(options.quantity || meatStack?.quantity || 1))),
      size,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      displayName: cookedName(raw, lineage.lineageName),
      culinarySystem: COOKING_SYSTEM,
      hungerSlotsRestored: 1,
      hungerPerUnit: hunger,
      rationEquivalentPerUnit: hunger / RATION_HUNGER,
      secondaryEffectMultiplier: sizeMultiplier * qualityEffectMultiplier,
      unitValueAhn: priceForSizeAndQuality(definition, size, quality),
      rawItemId: raw.id,
      stackPolicy: definition.stackPolicy,
      sourceInstanceId: meatStack?.sourceInstanceId || null,
      culinaryProperties: clone(meatStack?.culinaryProperties || []),
      affinityTarget: meatStack?.affinityTarget || meatStack?.culinaryProperties?.[0]?.target || null,
      affinityBranch: meatStack?.affinityBranch || meatStack?.culinaryProperties?.[0]?.affinityBranch || null,
      inputQuality: meatStack?.quality || null,
      originCreatureType: meatStack?.originCreatureType || null,
      originCreatureId: meatStack?.originCreatureId || null,
      originRaceId: meatStack?.originRaceId || null,
      originSubtypeId: meatStack?.originSubtypeId || null,
      sourceEntityId: meatStack?.sourceEntityId || null,
    };
  }

  function rationEquivalentForFoodStack(foodStack) {
    if (!foodStack) return 0;
    const quantity = Math.max(0, Number(foodStack.quantity ?? 1) || 0);
    const hunger = Math.max(0, Number(foodStack.hungerPerUnit) || 0);
    return (quantity * hunger) / RATION_HUNGER;
  }

  function buildRationSummary(foodStacks, options = {}) {
    const stacks = (Array.isArray(foodStacks) ? foodStacks : [foodStacks]).filter(Boolean);
    const sEngine = sizeEngine();
    const totalHunger = stacks.reduce((sum, stack) => sum + (Math.max(0, Number(stack.quantity ?? 1) || 0) * Math.max(0, Number(stack.hungerPerUnit) || 0)), 0);
    const dominant = sEngine?.resolveDominantLineage
      ? sEngine.resolveDominantLineage(stacks.map((stack) => ({ ...stack, family: "meat", namingAmount: (Number(stack.quantity ?? 1) || 1) * (sEngine.getSize(stack.size || DEFAULT_SIZE).multiplier) })), { eligibleFamilies: ["meat"] })
      : null;
    const lineageName = dominant?.lineageName || options.lineageName || "Mixed";
    return {
      hunger: totalHunger,
      rationEquivalent: totalHunger / RATION_HUNGER,
      fullRations: Math.floor(totalHunger / RATION_HUNGER),
      remainderHunger: totalHunger % RATION_HUNGER,
      lineageId: dominant?.lineageId || "mixed",
      lineageName,
      displayName: `${lineageName === "Mixed" ? "Mixed Meat" : lineageName} Ration`,
    };
  }

  function dailyHungerForCreatureSize(size = DEFAULT_SIZE) {
    const engine = sizeEngine();
    return engine?.hungerForSize ? engine.hungerForSize(size) : RATION_HUNGER;
  }

  function hungerPercent(currentHunger, size = DEFAULT_SIZE) {
    const engine = sizeEngine();
    return engine?.hungerPercent ? engine.hungerPercent(currentHunger, size) : Math.max(0, Math.min(100, Number(currentHunger) || 0));
  }

  const API = Object.freeze({
    VERSION,
    ECONOMY_STANDARD,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_SIZE,
    SIMPLE_COOKING_VALUE_MULTIPLIER,
    SHOP_RETAIL_MULTIPLIER,
    RETAIL_COOKIE_PRICE_MULTIPLIER,
    RETAIL_COOKIE_EFFECT_MULTIPLIER,
    RETAIL_COOKIE_AVAILABILITY_MULTIPLIER,
    RETAIL_COOKIES,
    RATION_HUNGER,
    COOKING_SYSTEM,
    LEGACY_HUNGER_SYSTEM,
    roundTo10,
    simpleCookedDefinition,
    listSimpleCookedDefinitions,
    listRetailCookieDefinitions,
    createRetailCookiePack,
    get,
    priceForSizeAndQuality,
    createSimpleCookedFood,
    rationEquivalentForFoodStack,
    buildRationSummary,
    dailyHungerForCreatureSize,
    hungerPercent,
  });

  global.LuminousFoodCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
