(function (global) {
  "use strict";

  if (global.LuminousFeatherRawFiberCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFeatherRawFiberCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "feather_raw_fiber";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_PART_SIZE = "medium";
  const AHN_ECONOMY_SCALE = 100;

  const FEATHER_YIELD_BY_CREATURE_SIZE = Object.freeze({
    tiny: 40,
    small: 100,
    medium: 250,
    large: 600,
    huge: 1400,
    gargantuan: 3000,
  });

  const FLIGHT_FEATHER_YIELD_BY_CREATURE_SIZE = Object.freeze({
    tiny: 6,
    small: 12,
    medium: 24,
    large: 48,
    huge: 96,
    gargantuan: 192,
  });

  const FIBER_UNITS_BY_CREATURE_SIZE = Object.freeze({
    tiny: 4,
    small: 8,
    medium: 16,
    large: 32,
    huge: 64,
    gargantuan: 128,
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

  function item(id, name, materialNoun, iconFamily, standardUnitValueAhn, measure, harvestIntegrityFamily, tags = []) {
    const pieceBased = measure === "piece";
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
      standardUnitValueAhn: Math.round(standardUnitValueAhn * AHN_ECONOMY_SCALE),
      measure,
      pieceBased,
      fiberUnitBased: measure === "fiber_unit",
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: pieceBased ? "anatomical_part_size" : "standardized_fiber_unit",
      creatureSizeDoesNotImplyPartSize: pieceBased,
      stackable: true,
      stackPolicy: pieceBased ? "identical_part_size_quality_lineage" : "identical_quality_lineage",
      supportsRenewableHarvest: true,
      harvestIntegrityFamily,
      tags: Object.freeze(["ingredient", "organic", "raw_harvest", ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("feather", "Feather", "Feather", "feather_raw", 5, "piece", "feather_raw", ["feather", "fletching_material"]),
    item("flight_feather", "Flight Feather", "Flight Feather", "feather_raw", 20, "piece", "feather_raw", ["feather", "flight_feather", "fletching_material", "premium_fletching"]),
    item("down", "Down", "Down", "feather_raw", 20, "fiber_unit", "raw_fiber", ["down", "padding", "insulation"]),
    item("wool", "Wool", "Wool", "animal_fiber_raw", 25, "fiber_unit", "raw_fiber", ["wool", "tailoring_input", "shearable"]),
    item("animal_hair", "Animal Hair / Raw Fiber", "Animal Hair", "animal_fiber_raw", 15, "fiber_unit", "raw_fiber", ["hair", "fiber", "tailoring_input", "shearable"]),
    item("raw_silk", "Raw Silk", "Raw Silk", "silk_raw", 60, "fiber_unit", "raw_fiber", ["silk", "tailoring_input"]),
    item("exotic_raw_fiber", "Exotic Raw Fiber", "Exotic Raw Fiber", "silk_raw", 100, "fiber_unit", "raw_fiber", ["exotic", "fiber", "tailoring_input"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const measure = normalizeId(options.measure);
    const tag = normalizeId(options.tag);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !measure || entry.measure === measure)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .map(clone);
  }

  function canonicalSize(value) {
    const engine = sizeEngine();
    return engine?.canonicalSize ? engine.canonicalSize(value || DEFAULT_PART_SIZE) : normalizeId(value || DEFAULT_PART_SIZE);
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    let base = Number(entry.standardUnitValueAhn) || 0;
    if (entry.pieceBased) {
      const engine = sizeEngine();
      if (engine?.scaleValue) base = engine.scaleValue(base, options.partSize || options.size || DEFAULT_PART_SIZE, { rounding: "round" });
    }
    const qEngine = qualityEngine();
    return qEngine?.applyValue ? qEngine.applyValue(base, quality, { rounding: "round" }) : Math.round(base);
  }

  function fallbackYieldMax(itemOrId, creatureSize = "medium") {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const size = canonicalSize(creatureSize);
    if (entry.id === "feather") return FEATHER_YIELD_BY_CREATURE_SIZE[size] ?? null;
    if (entry.id === "flight_feather") return FLIGHT_FEATHER_YIELD_BY_CREATURE_SIZE[size] ?? null;
    if (entry.fiberUnitBased) return FIBER_UNITS_BY_CREATURE_SIZE[size] ?? null;
    return null;
  }

  function createAnatomyProfile(input = {}) {
    const parts = {};
    for (const [rawId, rawSpec] of Object.entries(input.parts || {})) {
      const id = normalizeId(rawId);
      const entry = get(id);
      if (!entry) continue;
      const source = typeof rawSpec === "number" ? { maxYield: rawSpec } : (rawSpec || {});
      const rawMax = source.maxYield ?? source.maxCount ?? source.maxFiberUnits ?? source.count ?? source.fiberUnits;
      const maxYield = Number.isFinite(Number(rawMax)) ? Math.max(0, Math.trunc(Number(rawMax))) : null;
      const regrowthPerDay = Number(source.regrowthPerDay);
      parts[id] = Object.freeze({
        id,
        maxYield,
        partSize: source.partSize ? canonicalSize(source.partSize) : null,
        renewable: source.renewable === true,
        renewalAction: source.renewalAction ? normalizeId(source.renewalAction) : null,
        regrowthPerDay: Number.isFinite(regrowthPerDay) && regrowthPerDay >= 0 ? regrowthPerDay : null,
      });
    }
    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "anatomy"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      creatureSize: input.creatureSize || null,
      parts: Object.freeze(parts),
    });
  }

  function maxYieldFor(profile, itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const explicit = profile?.parts?.[entry.id]?.maxYield;
    if (Number.isFinite(Number(explicit))) return Math.max(0, Math.trunc(Number(explicit)));
    return fallbackYieldMax(entry, profile?.creatureSize || options.creatureSize || "medium");
  }

  function recoverableYieldFor(profile, itemOrId, requestedYield, options = {}) {
    const requested = Math.max(0, Math.trunc(Number(requestedYield) || 0));
    const anatomyMax = maxYieldFor(profile, itemOrId, options);
    const integrityMaxRaw = options.integrityRecoverableMax ?? options.recoverableMax;
    const integrityMax = Number.isFinite(Number(integrityMaxRaw)) ? Math.max(0, Math.trunc(Number(integrityMaxRaw))) : null;
    let result = anatomyMax == null ? requested : Math.min(requested, anatomyMax);
    if (integrityMax != null) result = Math.min(result, integrityMax);
    return result;
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id : String(options.quality || DEFAULT_QUALITY);
    const profilePart = options.anatomyProfile?.parts?.[entry.id];
    const partSize = entry.pieceBased ? canonicalSize(options.partSize || options.size || profilePart?.partSize || DEFAULT_PART_SIZE) : null;
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const requested = options.quantity ?? options.fiberUnits ?? 1;
    const amount = options.anatomyProfile
      ? recoverableYieldFor(options.anatomyProfile, entry, requested, options)
      : Math.max(0, Math.trunc(Number(requested) || 0));
    const unitValueAhn = unitValueForQuality(entry, quality, { partSize });
    const materialName = `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
    const sizeLabel = entry.pieceBased && sEngine?.getSize ? sEngine.getSize(partSize).label : null;
    return {
      itemId: entry.id,
      family: FAMILY,
      measure: entry.measure,
      quantity: entry.pieceBased ? amount : 1,
      fiberUnits: entry.fiberUnitBased ? amount : null,
      remainingFiberUnits: entry.fiberUnitBased ? amount : null,
      partSize,
      creatureSize: options.creatureSize || options.anatomyProfile?.creatureSize || null,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: entry.pieceBased ? `${sizeLabel || partSize} ${materialName}`.trim() : materialName,
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * amount),
      harvestIntegrityFamily: entry.harvestIntegrityFamily,
      renewable: profilePart?.renewable === true,
      renewalAction: profilePart?.renewalAction || null,
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function createRenewableState(profile, itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    const spec = entry ? profile?.parts?.[entry.id] : null;
    if (!entry || spec?.renewable !== true) return null;
    const capacity = maxYieldFor(profile, entry, options);
    if (capacity == null) return null;
    const currentRaw = options.currentYield ?? options.current ?? capacity;
    const current = Math.max(0, Math.min(capacity, Math.trunc(Number(currentRaw) || 0)));
    return {
      itemId: entry.id,
      measure: entry.measure,
      capacity,
      current,
      renewalAction: spec.renewalAction || (entry.id === "wool" || entry.id === "animal_hair" ? "shear" : "collect"),
      regrowthPerDay: spec.regrowthPerDay,
    };
  }

  function collectRenewable(state, requestedYield) {
    if (!state) return null;
    const requested = Math.max(0, Math.trunc(Number(requestedYield) || 0));
    const collected = Math.min(requested, Math.max(0, Number(state.current) || 0));
    return {
      collected,
      nextState: { ...state, current: Math.max(0, (Number(state.current) || 0) - collected) },
    };
  }

  function regrowRenewable(state, days = 1) {
    if (!state) return null;
    const rate = Number(state.regrowthPerDay);
    if (!Number.isFinite(rate) || rate <= 0) return { ...state };
    const elapsed = Math.max(0, Number(days) || 0);
    return { ...state, current: Math.min(state.capacity, (Number(state.current) || 0) + rate * elapsed) };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_PART_SIZE,
    AHN_ECONOMY_SCALE,
    FEATHER_YIELD_BY_CREATURE_SIZE,
    FLIGHT_FEATHER_YIELD_BY_CREATURE_SIZE,
    FIBER_UNITS_BY_CREATURE_SIZE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    fallbackYieldMax,
    createAnatomyProfile,
    maxYieldFor,
    recoverableYieldFor,
    createHarvestStack,
    createRenewableState,
    collectRenewable,
    regrowRenewable,
  });

  global.LuminousFeatherRawFiberCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
