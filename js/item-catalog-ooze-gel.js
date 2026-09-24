(function (global) {
  "use strict";

  if (global.LuminousOozeGelCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousOozeGelCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "ooze_gel";
  const CURRENCY = "AHN";
  const AHN_ECONOMY_SCALE = 5;
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_CREATURE_SIZE = "medium";

  const OOZE_UNITS_BY_CREATURE_SIZE = Object.freeze({
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

  function item(id, name, materialNoun, standardUnitValueAhn, materialTags = [], tags = []) {
    return Object.freeze({
      id,
      name,
      materialNoun,
      family: FAMILY,
      iconFamily: "ooze_gel",
      category: "ingredient",
      itemType: "material",
      sourceLine: "harvest",
      purchasable: true,
      currency: CURRENCY,
      standardUnitValueAhn: Math.round(standardUnitValueAhn * AHN_ECONOMY_SCALE),
      measure: "ooze_unit",
      oozeUnitBased: true,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "creature_mass_fallback",
      stackable: true,
      stackPolicy: "identical_quality_lineage_ooze_type",
      supportsRenewableHarvest: true,
      harvestIntegrityFamily: FAMILY,
      rawCraftingReagent: true,
      materialTags: Object.freeze(materialTags.map(normalizeId).filter(Boolean)),
      tags: Object.freeze(["ingredient", "organic", "raw_harvest", "ooze", ...tags.map(normalizeId).filter(Boolean)]),
    });
  }

  const ITEMS = Object.freeze([
    item("slime", "Slime", "Slime", 300,
      ["binder", "lubricant", "carrier", "soft_organic_base"],
      ["slime"]),
    item("mucus", "Mucus", "Mucus", 250,
      ["sealant", "coating", "scent_base", "bait_medium"],
      ["mucus"]),
    item("gel", "Gel", "Gel", 500,
      ["stabilizer", "carrier", "cushioning_medium", "insulating_matrix"],
      ["gel"]),
    item("adhesive_ooze", "Adhesive Ooze", "Adhesive Ooze", 900,
      ["adhesive", "trap_compound", "binding_agent"],
      ["adhesive"]),
    item("regenerative_gel", "Regenerative Gel", "Regenerative Gel", 1800,
      ["medical_reagent", "bio_repair_medium", "growth_medium", "preservation_gel"],
      ["regenerative", "medical"]),
    item("conductive_gel", "Conductive Gel", "Conductive Gel", 2000,
      ["conductive_medium", "energy_interface", "signal_matrix", "cybernetic_reagent"],
      ["conductive", "technical"]),
    item("exotic_ooze", "Exotic Ooze", "Exotic Ooze", 3500,
      ["exotic_reagent", "abnormal_medium", "unstable_catalyst"],
      ["exotic", "abnormal"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const aliases = {
      ooze: "slime",
      raw_slime: "slime",
      adhesive: "adhesive_ooze",
      regenerative: "regenerative_gel",
      conductive: "conductive_gel",
      exotic: "exotic_ooze",
    };
    const resolved = aliases[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const tag = normalizeId(options.tag);
    const materialTag = normalizeId(options.materialTag);
    return ITEMS
      .filter((entry) => !tag || entry.tags.includes(tag))
      .filter((entry) => !materialTag || entry.materialTags.includes(materialTag))
      .map(clone);
  }

  function canonicalSize(value) {
    const engine = sizeEngine();
    return engine?.canonicalSize ? engine.canonicalSize(value || DEFAULT_CREATURE_SIZE) : normalizeId(value || DEFAULT_CREATURE_SIZE);
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    return qEngine?.applyValue
      ? qEngine.applyValue(entry.standardUnitValueAhn, quality, { rounding: "round" })
      : Math.round(Number(entry.standardUnitValueAhn) || 0);
  }

  function fallbackYieldMax(creatureSize = DEFAULT_CREATURE_SIZE) {
    return OOZE_UNITS_BY_CREATURE_SIZE[canonicalSize(creatureSize)] ?? null;
  }

  function createBodyProfile(input = {}) {
    const explicitMaxRaw = input.maxOU ?? input.capacityOU ?? input.maxOozeUnits;
    const explicitMax = explicitMaxRaw == null ? null : Number(explicitMaxRaw);
    const regrowthRaw = input.regrowthPerDay ?? input.productionPerDay;
    const regrowthPerDay = regrowthRaw == null ? null : Number(regrowthRaw);
    const collectionLimitRaw = input.collectionLimitOU ?? input.safeCollectMaxOU;
    const collectionLimitOU = collectionLimitRaw == null ? null : Number(collectionLimitRaw);
    const itemId = get(input.itemId || input.oozeItemId || input.oozeType || "slime")?.id || "slime";
    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "ooze_profile"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      creatureSize: canonicalSize(input.creatureSize || DEFAULT_CREATURE_SIZE),
      itemId,
      maxOU: Number.isFinite(explicitMax) && explicitMax >= 0 ? explicitMax : null,
      renewable: input.renewable === true || input.renewableHarvest === true,
      collectionAction: normalizeId(input.collectionAction || input.harvestAction || "collect_ooze"),
      collectionLimitOU: Number.isFinite(collectionLimitOU) && collectionLimitOU >= 0 ? collectionLimitOU : null,
      regrowthPerDay: Number.isFinite(regrowthPerDay) && regrowthPerDay >= 0 ? regrowthPerDay : null,
      specialProperties: Object.freeze((Array.isArray(input.specialProperties) ? input.specialProperties : []).map(normalizeId).filter(Boolean)),
    });
  }

  function maxOUForProfile(profile, options = {}) {
    if (profile?.maxOU != null && Number.isFinite(Number(profile.maxOU))) return Math.max(0, Number(profile.maxOU));
    return fallbackYieldMax(profile?.creatureSize || options.creatureSize || DEFAULT_CREATURE_SIZE);
  }

  function createOozePool(profile, options = {}) {
    if (!profile) return null;
    const itemId = get(options.itemId || profile.itemId || "slime")?.id || "slime";
    if (profile.itemId && itemId !== profile.itemId && options.allowItemOverride !== true) return null;
    const maxOU = maxOUForProfile(profile, options);
    if (maxOU == null) return null;
    const currentRaw = options.currentOU ?? maxOU;
    const currentOU = Math.max(0, Math.min(maxOU, Number(currentRaw) || 0));
    const recoverableRaw = options.recoverableOU ?? currentOU;
    const recoverableOU = Math.max(0, Math.min(currentOU, Number(recoverableRaw) || 0));
    return {
      itemId,
      maxOU,
      currentOU,
      recoverableOU,
      creatureSize: profile.creatureSize,
      renewable: profile.renewable === true,
      collectionAction: profile.collectionAction || "collect_ooze",
      collectionLimitOU: profile.collectionLimitOU,
      regrowthPerDay: profile.regrowthPerDay,
      specialProperties: clone(profile.specialProperties || []),
    };
  }

  function applyLoss(pool, lostOU, options = {}) {
    if (!pool) return null;
    const lost = Math.max(0, Number(lostOU) || 0);
    const currentOU = Math.max(0, (Number(pool.currentOU) || 0) - lost);
    const contaminated = Math.max(0, Number(options.contaminatedOU) || 0);
    const recoverableOU = Math.max(0, Math.min(
      currentOU,
      (Number(pool.recoverableOU) || 0) - lost - contaminated
    ));
    return { ...pool, currentOU, recoverableOU };
  }

  function contaminate(pool, contaminatedOU) {
    if (!pool) return null;
    const amount = Math.max(0, Number(contaminatedOU) || 0);
    return { ...pool, recoverableOU: Math.max(0, (Number(pool.recoverableOU) || 0) - amount) };
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id : normalizeId(options.quality || DEFAULT_QUALITY);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const pool = options.pool || (options.bodyProfile ? createOozePool(options.bodyProfile, { itemId: entry.id }) : null);
    const requested = Math.max(0, Number(options.oozeUnits ?? options.quantity ?? 0) || 0);
    const recoverableMax = pool ? Math.max(0, Number(pool.recoverableOU) || 0) : requested;
    const integrityRaw = options.integrityRecoverableMax ?? options.recoverableMax;
    const integrityMax = integrityRaw == null ? null : Math.max(0, Number(integrityRaw) || 0);
    let oozeUnits = Math.min(requested, recoverableMax);
    if (integrityMax != null) oozeUnits = Math.min(oozeUnits, integrityMax);
    const unitValueAhn = unitValueForQuality(entry, quality);
    const materialName = `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
    return {
      itemId: entry.id,
      family: FAMILY,
      measure: "ooze_unit",
      oozeUnits,
      remainingOozeUnits: oozeUnits,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: materialName,
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * oozeUnits),
      rawCraftingReagent: true,
      materialTags: clone(entry.materialTags),
      specialProperties: clone(pool?.specialProperties || options.specialProperties || []),
      harvestIntegrityFamily: FAMILY,
      bodyProfileSnapshot: clone(options.bodyProfile || null),
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function collectRenewable(profile, pool, requestedOU, options = {}) {
    if (!profile || !pool || profile.renewable !== true) return null;
    const requested = Math.max(0, Number(requestedOU) || 0);
    const configuredLimit = profile.collectionLimitOU;
    const limit = options.ignoreCollectionLimit === true || configuredLimit == null
      ? requested
      : Math.max(0, Number(configuredLimit) || 0);
    const collected = Math.min(requested, limit, Math.max(0, Number(pool.recoverableOU) || 0));
    const currentOU = Math.max(0, (Number(pool.currentOU) || 0) - collected);
    return {
      collected,
      action: profile.collectionAction || "collect_ooze",
      nextPool: {
        ...pool,
        currentOU,
        recoverableOU: Math.max(0, Math.min(currentOU, (Number(pool.recoverableOU) || 0) - collected)),
      },
    };
  }

  function regrow(pool, days = 1) {
    if (!pool || pool.renewable !== true) return pool ? { ...pool } : null;
    const rate = Number(pool.regrowthPerDay);
    if (!Number.isFinite(rate) || rate <= 0) return { ...pool };
    const elapsed = Math.max(0, Number(days) || 0);
    const added = rate * elapsed;
    const currentOU = Math.min(pool.maxOU, (Number(pool.currentOU) || 0) + added);
    const recoverableOU = Math.min(currentOU, (Number(pool.recoverableOU) || 0) + added);
    return { ...pool, currentOU, recoverableOU };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_CREATURE_SIZE,
    OOZE_UNITS_BY_CREATURE_SIZE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    fallbackYieldMax,
    createBodyProfile,
    maxOUForProfile,
    createOozePool,
    applyLoss,
    contaminate,
    createHarvestStack,
    collectRenewable,
    regrow,
  });

  global.LuminousOozeGelCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
