(function (global) {
  "use strict";

  if (global.LuminousFoodCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFoodCatalog;
    return;
  }

  const VERSION = 2;
  const FAMILY = "food";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_SIZE = "medium";
  const SIMPLE_COOKING_VALUE_MULTIPLIER = 1.25;
  const SHOP_RETAIL_MULTIPLIER = 1.25;
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
    const found = listSimpleCookedDefinitions().find((entry) => entry.id === key);
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
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_SIZE,
    SIMPLE_COOKING_VALUE_MULTIPLIER,
    SHOP_RETAIL_MULTIPLIER,
    RATION_HUNGER,
    COOKING_SYSTEM,
    LEGACY_HUNGER_SYSTEM,
    roundTo10,
    simpleCookedDefinition,
    listSimpleCookedDefinitions,
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
