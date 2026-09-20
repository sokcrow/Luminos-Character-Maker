(function (global) {
  "use strict";

  if (global.LuminousHidePeltCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousHidePeltCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "hide_pelt";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_SIZE = "medium";
  const AHN_ECONOMY_SCALE = 20;

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

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function item(id, name, materialNoun, iconFamily, mediumStandardValueAhn, tags = []) {
    return Object.freeze({
      id,
      name,
      materialNoun,
      family: FAMILY,
      iconFamily,
      category: "ingredient",
      itemType: "material",
      sourceLine: "harvest",
      purchasable: true,
      currency: CURRENCY,
      mediumStandardValueAhn: Math.round(mediumStandardValueAhn * AHN_ECONOMY_SCALE),
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "universal_physical",
      stackable: true,
      tags: Object.freeze(["ingredient", "organic", "hide", ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("hide_mammal", "Mammal Hide", "Hide", "hide_mammal", 1600, ["mammal"]),
    item("pelt_fur", "Fur Pelt", "Pelt", "pelt_fur", 1900, ["mammal", "fur"]),
    item("hide_humanoid", "Humanoid Hide", "Hide", "hide_mammal", 2000, ["humanoid"]),
    item("hide_avian", "Avian Hide", "Hide", "hide_mammal", 1200, ["avian"]),
    item("hide_reptilian", "Reptilian Hide", "Hide", "hide_reptile", 2200, ["reptile"]),
    item("skin_amphibian", "Amphibian Skin", "Skin", "hide_reptile", 1400, ["amphibian"]),
    item("skin_fish", "Fish Skin", "Skin", "hide_reptile", 1000, ["aquatic", "fish"]),
    item("hide_draconic", "Draconic Hide", "Hide", "hide_draconic", 5000, ["draconic"]),
    item("hide_exotic", "Exotic Hide", "Hide", "hide_mammal", 3200, ["exotic"]),
  ]);

  const MEDIUM_RECIPE_REQUIREMENTS = Object.freeze({
    leather_armor: 4,
    reinforced_studded_leather: 6,
    hide_armor: 8,
    light_leather_backing: 2,
    heavy_leather_backing: 4,
    shield_straps_facing: 2,
  });

  function get(id) {
    const key = String(id || "").trim();
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const tag = String(options.tag || "").trim().toLowerCase();
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .map(clone);
  }

  function baseValueForSize(itemOrId, size = DEFAULT_SIZE) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const engine = sizeEngine();
    if (!engine?.scaleValue) return Math.round(Number(entry.mediumStandardValueAhn) || 0);
    return engine.scaleValue(entry.mediumStandardValueAhn, size, { rounding: "round" });
  }

  function priceForSizeAndQuality(itemOrId, size = DEFAULT_SIZE, quality = DEFAULT_QUALITY) {
    const base = baseValueForSize(itemOrId, size);
    if (base == null) return null;
    const engine = qualityEngine();
    if (!engine?.applyValue) return Math.round(base);
    return engine.applyValue(base, quality, { rounding: "round" });
  }

  function inheritedMaterialName(entry, lineageName) {
    const lineage = String(lineageName || "").trim();
    if (!lineage) return entry.name;
    return `${lineage} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality
      ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id
      : String(options.quality || DEFAULT_QUALITY);
    const size = sEngine?.canonicalSize ? sEngine.canonicalSize(options.size || DEFAULT_SIZE) : String(options.size || DEFAULT_SIZE);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name.replace(/ (Hide|Pelt|Skin)$/i, ""))
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const hideUnits = sEngine?.hideUnitsForSize ? sEngine.hideUnitsForSize(size) : 4;
    const materialName = inheritedMaterialName(entry, lineage.lineageName);
    return {
      itemId: entry.id,
      family: FAMILY,
      quantity: Math.max(1, Math.trunc(Number(options.quantity || 1))),
      size,
      hideUnits,
      remainingUnits: hideUnits,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: `${sEngine?.getSize ? sEngine.getSize(size).label : size} ${materialName}`.trim(),
      unitValueAhn: priceForSizeAndQuality(entry, size, quality),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function recipeUnits(recipeId, craftedSize = DEFAULT_SIZE) {
    const base = MEDIUM_RECIPE_REQUIREMENTS[String(recipeId || "").trim()];
    if (base == null) return null;
    const engine = sizeEngine();
    if (!engine?.scaleValue) return base;
    return engine.scaleValue(base, craftedSize, { rounding: "ceil" });
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_SIZE,
    AHN_ECONOMY_SCALE,
    ITEMS,
    MEDIUM_RECIPE_REQUIREMENTS,
    get,
    list,
    baseValueForSize,
    priceForSizeAndQuality,
    createHarvestStack,
    recipeUnits,
  });

  global.LuminousHidePeltCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
