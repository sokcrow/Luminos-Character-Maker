(function (global) {
  "use strict";

  if (global.LuminousScaleShellChitinCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousScaleShellChitinCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "scale_shell_chitin";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_PART_SIZE = "medium";
  const DRACONIC_VALUE_MULTIPLIER = 3;
  const DRACONIC_SCALE_YIELD_MULTIPLIER = 2;
  const CRAFT_VALUE_MULTIPLIER = 1.25;
  const RETAIL_VALUE_MULTIPLIER = 1.25;
  const AHN_ECONOMY_SCALE = 20;

  const MODULAR_YIELD_BY_CREATURE_SIZE = Object.freeze({
    tiny: 2,
    small: 4,
    medium: 8,
    large: 16,
    huge: 32,
    gargantuan: 64,
  });

  const SCUTE_YIELD_BY_CREATURE_SIZE = Object.freeze({
    tiny: 1,
    small: 2,
    medium: 4,
    large: 8,
    huge: 16,
    gargantuan: 32,
  });

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

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function item(id, name, materialNoun, iconFamily, mediumStandardValueAhn, physicalMode, harvestIntegrityFamily, tags = []) {
    const modular = physicalMode === "modular";
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
      sizeSystem: "anatomical_part_size",
      creatureSizeDoesNotImplyPartSize: true,
      physicalMode,
      modularCoverageMaterial: modular,
      discreteStructuralPart: !modular,
      stackable: true,
      stackPolicy: modular ? "identical_part_size_quality_lineage" : "identical_anatomical_parts_only",
      canAggregateCoverage: modular,
      canMergeForLargerPart: false,
      harvestIntegrityFamily,
      tags: Object.freeze(["ingredient", "organic", "hard_cover", physicalMode, ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("scale", "Scale", "Scale", "scale_reptile", 300, "modular", "hard_cover_modular", ["scale"]),
    item("scute", "Scute", "Scute", "scale_reptile", 500, "modular", "hard_cover_modular", ["scale", "scute"]),
    item("shell", "Shell", "Shell", "shell_carapace", 1800, "structural", "hard_cover_structural", ["shell"]),
    item("carapace", "Carapace", "Carapace", "shell_carapace", 2000, "structural", "hard_cover_structural", ["carapace"]),
    item("chitin", "Chitin", "Chitin", "chitin_plate", 450, "modular", "hard_cover_modular", ["chitin"]),
    item("exoskeleton_plate", "Exoskeleton Plate", "Exoskeleton Plate", "chitin_plate", 1500, "structural", "hard_cover_structural", ["chitin", "exoskeleton", "plate"]),
    item("exotic_armor_plate", "Exotic Armor Plate", "Armor Plate", "shell_carapace", 2600, "structural", "hard_cover_structural", ["exotic", "plate"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const tag = normalizeId(options.tag);
    const physicalMode = normalizeId(options.physicalMode);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .filter((entry) => !physicalMode || entry.physicalMode === physicalMode)
      .map(clone);
  }

  function isDraconic(options = {}) {
    const creatureType = normalizeId(options.originCreatureType);
    const tags = new Set((options.lineageTags || []).map(normalizeId));
    return options.draconic === true || creatureType === "dragon" || tags.has("draconic");
  }

  function lineageValueMultiplier(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return 1;
    const explicit = Number(options.lineageValueMultiplier);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return entry.id === "scale" && isDraconic(options) ? DRACONIC_VALUE_MULTIPLIER : 1;
  }

  function baseValueForPartSize(itemOrId, partSize = DEFAULT_PART_SIZE) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const engine = sizeEngine();
    if (!engine?.scaleValue) return Math.round(Number(entry.mediumStandardValueAhn) || 0);
    return engine.scaleValue(entry.mediumStandardValueAhn, partSize, { rounding: "round" });
  }

  function priceForSizeAndQuality(itemOrId, partSize = DEFAULT_PART_SIZE, quality = DEFAULT_QUALITY, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const base = baseValueForPartSize(entry, partSize);
    const qEngine = qualityEngine();
    const qualityValue = qEngine?.applyValue ? qEngine.applyValue(base, quality, { rounding: "round" }) : Math.round(base);
    return Math.round(qualityValue * lineageValueMultiplier(entry, options));
  }

  function fallbackYieldMax(itemOrId, creatureSize = "medium", options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const sEngine = sizeEngine();
    const size = sEngine?.canonicalSize ? sEngine.canonicalSize(creatureSize) : normalizeId(creatureSize || "medium");
    let base = null;
    if (entry.id === "scale" || entry.id === "chitin") base = MODULAR_YIELD_BY_CREATURE_SIZE[size];
    if (entry.id === "scute") base = SCUTE_YIELD_BY_CREATURE_SIZE[size];
    if (base == null || !Number.isFinite(Number(base))) return null;
    if (entry.id === "scale" && isDraconic(options)) return Math.trunc(base * DRACONIC_SCALE_YIELD_MULTIPLIER);
    return Math.trunc(base);
  }

  function createAnatomyProfile(input = {}) {
    const parts = {};
    for (const [rawId, rawSpec] of Object.entries(input.parts || {})) {
      const id = normalizeId(rawId);
      const entry = get(id);
      if (!id || !entry) continue;
      const source = typeof rawSpec === "number" ? { maxCount: rawSpec } : (rawSpec || {});
      parts[id] = Object.freeze({
        id,
        maxCount: Math.max(0, Math.trunc(Number(source.maxCount ?? source.count ?? 0) || 0)),
        partSize: source.partSize ? String(source.partSize) : null,
        sizeDistribution: clone(source.sizeDistribution || null),
      });
    }
    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "anatomy"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      creatureSize: input.creatureSize || null,
      draconic: input.draconic === true,
      parts: Object.freeze(parts),
    });
  }

  function maxYieldFor(profile, itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const explicit = profile?.parts?.[entry.id]?.maxCount;
    if (Number.isFinite(Number(explicit))) return Math.max(0, Math.trunc(Number(explicit)));
    return fallbackYieldMax(entry, profile?.creatureSize || options.creatureSize || "medium", {
      ...options,
      draconic: options.draconic === true || profile?.draconic === true,
    });
  }

  function clampYieldToAnatomy(profile, itemOrId, requestedQuantity = 1, options = {}) {
    const requested = Math.max(0, Math.trunc(Number(requestedQuantity) || 0));
    const max = maxYieldFor(profile, itemOrId, options);
    return max == null ? requested : Math.min(requested, max);
  }

  function createHarvestPart(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality
      ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id
      : String(options.quality || DEFAULT_QUALITY);
    const profilePart = options.anatomyProfile?.parts?.[entry.id];
    const rawSize = options.partSize || options.size || profilePart?.partSize || DEFAULT_PART_SIZE;
    const partSize = sEngine?.canonicalSize ? sEngine.canonicalSize(rawSize) : normalizeId(rawSize);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const quantity = options.anatomyProfile
      ? clampYieldToAnatomy(options.anatomyProfile, entry, options.quantity ?? 1, options)
      : Math.max(1, Math.trunc(Number(options.quantity || 1)));
    const multiplier = lineageValueMultiplier(entry, options);
    const materialName = `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
    const sizeLabel = sEngine?.getSize ? sEngine.getSize(partSize).label : partSize;
    return {
      itemId: entry.id,
      family: FAMILY,
      quantity,
      size: partSize,
      partSize,
      creatureSize: options.creatureSize || options.anatomyProfile?.creatureSize || null,
      physicalMode: entry.physicalMode,
      modularCoverageMaterial: entry.modularCoverageMaterial,
      discreteStructuralPart: entry.discreteStructuralPart,
      canAggregateCoverage: entry.canAggregateCoverage,
      canMergeForLargerPart: false,
      canDownsizeForSmallerUse: entry.discreteStructuralPart,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: `${sizeLabel} ${materialName}`.trim(),
      unitValueAhn: priceForSizeAndQuality(entry, partSize, quality, { ...options, lineageValueMultiplier: multiplier }),
      lineageValueMultiplier: multiplier,
      harvestIntegrityFamily: entry.harvestIntegrityFamily,
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function materialValue(materials = []) {
    return (Array.isArray(materials) ? materials : []).reduce((sum, material) => {
      if (!material) return sum;
      const quantity = Math.max(0, Number(material.quantity ?? 1) || 0);
      let unitValue = Number(material.unitValueAhn);
      if (!Number.isFinite(unitValue)) {
        unitValue = priceForSizeAndQuality(
          material.itemId || material.id,
          material.partSize || material.size || DEFAULT_PART_SIZE,
          material.quality || DEFAULT_QUALITY,
          material
        );
      }
      return sum + Math.max(0, Number(unitValue) || 0) * quantity;
    }, 0);
  }

  function craftBaseValue(materials = [], options = {}) {
    const multiplier = Number(options.multiplier ?? CRAFT_VALUE_MULTIPLIER);
    return Math.round(materialValue(materials) * (Number.isFinite(multiplier) ? multiplier : CRAFT_VALUE_MULTIPLIER));
  }

  function retailValueFromCraftBase(craftValueAhn, options = {}) {
    const multiplier = Number(options.multiplier ?? RETAIL_VALUE_MULTIPLIER);
    return Math.round(Math.max(0, Number(craftValueAhn) || 0) * (Number.isFinite(multiplier) ? multiplier : RETAIL_VALUE_MULTIPLIER));
  }

  function retailValue(materials = [], options = {}) {
    return retailValueFromCraftBase(craftBaseValue(materials, options.craft || {}), options.retail || {});
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_PART_SIZE,
    DRACONIC_VALUE_MULTIPLIER,
    DRACONIC_SCALE_YIELD_MULTIPLIER,
    CRAFT_VALUE_MULTIPLIER,
    RETAIL_VALUE_MULTIPLIER,
    AHN_ECONOMY_SCALE,
    MODULAR_YIELD_BY_CREATURE_SIZE,
    SCUTE_YIELD_BY_CREATURE_SIZE,
    ITEMS,
    get,
    list,
    isDraconic,
    lineageValueMultiplier,
    baseValueForPartSize,
    priceForSizeAndQuality,
    fallbackYieldMax,
    createAnatomyProfile,
    maxYieldFor,
    clampYieldToAnatomy,
    createHarvestPart,
    materialValue,
    craftBaseValue,
    retailValueFromCraftBase,
    retailValue,
  });

  global.LuminousScaleShellChitinCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
