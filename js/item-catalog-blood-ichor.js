(function (global) {
  "use strict";

  if (global.LuminousBloodIchorCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBloodIchorCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "blood_ichor";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";

  const BLOOD_UNITS_BY_CREATURE_SIZE = Object.freeze({
    tiny: 2,
    small: 4,
    medium: 8,
    large: 16,
    huge: 32,
    gargantuan: 64,
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

  function item(id, name, materialNoun, iconFamily, standardUnitValueAhn, tags = []) {
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
      standardUnitValueAhn,
      measure: "blood_unit",
      bloodUnitBased: true,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "standardized_blood_unit",
      stackable: true,
      stackPolicy: "identical_quality_lineage_fluid_type",
      supportsRenewableHarvest: true,
      harvestIntegrityFamily: "blood_ichor",
      tags: Object.freeze(["ingredient", "organic", "raw_harvest", "body_fluid", ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("blood", "Blood", "Blood", "blood", 500, ["blood"]),
    item("humanoid_blood", "Humanoid Blood", "Blood", "blood", 800, ["blood", "humanoid", "transfusion_candidate"]),
    item("hemolymph", "Hemolymph", "Hemolymph", "hemolymph", 700, ["hemolymph", "arthropod_fluid"]),
    item("ichor", "Ichor", "Ichor", "ichor", 1500, ["ichor", "unusual_fluid"]),
    item("draconic_blood", "Draconic Blood", "Blood", "blood", 2500, ["blood", "draconic", "rare"]),
    item("exotic_blood_fluid", "Exotic Blood / Fluid", "Exotic Fluid", "ichor", 3000, ["exotic", "unusual_fluid"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const aliases = {
      humanoid: "humanoid_blood",
      dragon_blood: "draconic_blood",
      exotic_blood: "exotic_blood_fluid",
      exotic_fluid: "exotic_blood_fluid",
    };
    const resolved = aliases[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const tag = normalizeId(options.tag);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .map(clone);
  }

  function canonicalSize(value) {
    const engine = sizeEngine();
    return engine?.canonicalSize ? engine.canonicalSize(value || "medium") : normalizeId(value || "medium");
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    return qEngine?.applyValue
      ? qEngine.applyValue(entry.standardUnitValueAhn, quality, { rounding: "round" })
      : Math.round(Number(entry.standardUnitValueAhn) || 0);
  }

  function fallbackBloodUnits(creatureSize = "medium") {
    return BLOOD_UNITS_BY_CREATURE_SIZE[canonicalSize(creatureSize)] ?? null;
  }

  function createPhysiologyProfile(input = {}) {
    const fluidItemId = get(input.fluidItemId || input.itemId || input.fluidType || "blood")?.id || "blood";
    const explicitMax = Number(input.maxBloodUnits ?? input.maxBU);
    const modifier = Number(input.bloodPoolModifier ?? input.poolModifier ?? 1);
    const safeDraw = Number(input.safeDrawMaxBU ?? input.safeDrawMax ?? 0);
    const regrowth = Number(input.regrowthPerDay);
    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "physiology"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      creatureSize: canonicalSize(input.creatureSize || "medium"),
      fluidItemId,
      maxBloodUnits: Number.isFinite(explicitMax) && explicitMax >= 0 ? explicitMax : null,
      bloodPoolModifier: Number.isFinite(modifier) && modifier >= 0 ? modifier : 1,
      renewableDraw: input.renewableDraw === true || input.bloodDraw === true,
      drawAction: normalizeId(input.drawAction || "blood_draw"),
      safeDrawMaxBU: Number.isFinite(safeDraw) && safeDraw >= 0 ? safeDraw : 0,
      regrowthPerDay: Number.isFinite(regrowth) && regrowth >= 0 ? regrowth : null,
    });
  }

  function maxBloodUnitsFor(profile, itemOrId = null, options = {}) {
    const entry = get(itemOrId || profile?.fluidItemId || "blood");
    if (!entry) return null;
    if (profile?.fluidItemId && entry.id !== profile.fluidItemId && options.allowFluidOverride !== true) return 0;
    if (profile?.maxBloodUnits != null && Number.isFinite(Number(profile.maxBloodUnits))) {
      return Math.max(0, Number(profile.maxBloodUnits));
    }
    const base = fallbackBloodUnits(profile?.creatureSize || options.creatureSize || "medium");
    if (base == null) return null;
    const modifier = Number.isFinite(Number(profile?.bloodPoolModifier)) ? Number(profile.bloodPoolModifier) : 1;
    return Math.max(0, base * modifier);
  }

  function createBloodPool(profile, options = {}) {
    const itemId = get(options.itemId || profile?.fluidItemId || "blood")?.id || "blood";
    const maxBloodUnits = maxBloodUnitsFor(profile, itemId, options);
    if (maxBloodUnits == null) return null;
    const currentRaw = options.currentBloodUnits ?? options.currentBU ?? maxBloodUnits;
    const currentBloodUnits = Math.max(0, Math.min(maxBloodUnits, Number(currentRaw) || 0));
    const recoverableRaw = options.recoverableBloodUnits ?? options.recoverableBU ?? currentBloodUnits;
    const recoverableBloodUnits = Math.max(0, Math.min(currentBloodUnits, Number(recoverableRaw) || 0));
    return {
      itemId,
      maxBloodUnits,
      currentBloodUnits,
      recoverableBloodUnits,
      renewableDraw: profile?.renewableDraw === true,
      drawAction: profile?.drawAction || "blood_draw",
      safeDrawMaxBU: Math.max(0, Number(profile?.safeDrawMaxBU) || 0),
      regrowthPerDay: Number.isFinite(Number(profile?.regrowthPerDay)) ? Number(profile.regrowthPerDay) : null,
    };
  }

  function applyBloodLoss(pool, lostBU, options = {}) {
    if (!pool) return null;
    const lost = Math.max(0, Number(lostBU) || 0);
    const currentBloodUnits = Math.max(0, (Number(pool.currentBloodUnits) || 0) - lost);
    const contamination = Math.max(0, Number(options.contaminatedBU) || 0);
    const recoverableBloodUnits = Math.max(0, Math.min(currentBloodUnits, (Number(pool.recoverableBloodUnits) || 0) - lost - contamination));
    return { ...pool, currentBloodUnits, recoverableBloodUnits };
  }

  function contaminateBlood(pool, contaminatedBU) {
    if (!pool) return null;
    const amount = Math.max(0, Number(contaminatedBU) || 0);
    return {
      ...pool,
      recoverableBloodUnits: Math.max(0, (Number(pool.recoverableBloodUnits) || 0) - amount),
    };
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id : String(options.quality || DEFAULT_QUALITY);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const pool = options.pool || (options.physiologyProfile ? createBloodPool(options.physiologyProfile, { itemId: entry.id }) : null);
    const requested = Math.max(0, Number(options.bloodUnits ?? options.quantity ?? 0) || 0);
    const recoverableMax = pool ? Math.max(0, Number(pool.recoverableBloodUnits) || 0) : requested;
    const integrityRaw = options.integrityRecoverableMax ?? options.recoverableMax;
    const integrityMax = Number.isFinite(Number(integrityRaw)) ? Math.max(0, Number(integrityRaw)) : null;
    let bloodUnits = Math.min(requested, recoverableMax);
    if (integrityMax != null) bloodUnits = Math.min(bloodUnits, integrityMax);
    const unitValueAhn = unitValueForQuality(entry, quality);
    return {
      itemId: entry.id,
      family: FAMILY,
      measure: "blood_unit",
      bloodUnits,
      remainingBloodUnits: bloodUnits,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName: `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim(),
      displayName: `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim(),
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * bloodUnits),
      harvestIntegrityFamily: entry.harvestIntegrityFamily,
      physiologySnapshot: clone(options.physiologyProfile || null),
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function drawBlood(profile, pool, requestedBU, options = {}) {
    if (!profile || !pool || profile.renewableDraw !== true) return null;
    const requested = Math.max(0, Number(requestedBU) || 0);
    const safeCap = options.ignoreSafeLimit === true ? requested : Math.max(0, Number(profile.safeDrawMaxBU) || 0);
    const drawn = Math.min(requested, safeCap, Math.max(0, Number(pool.currentBloodUnits) || 0));
    return {
      drawn,
      nextPool: {
        ...pool,
        currentBloodUnits: Math.max(0, (Number(pool.currentBloodUnits) || 0) - drawn),
        recoverableBloodUnits: Math.max(0, Math.min((Number(pool.recoverableBloodUnits) || 0), (Number(pool.currentBloodUnits) || 0) - drawn)),
      },
      action: profile.drawAction || "blood_draw",
    };
  }

  function regrowBlood(pool, days = 1) {
    if (!pool) return null;
    const rate = Number(pool.regrowthPerDay);
    if (!Number.isFinite(rate) || rate <= 0) return { ...pool };
    const elapsed = Math.max(0, Number(days) || 0);
    const currentBloodUnits = Math.min(pool.maxBloodUnits, (Number(pool.currentBloodUnits) || 0) + rate * elapsed);
    return {
      ...pool,
      currentBloodUnits,
      recoverableBloodUnits: Math.min(currentBloodUnits, Math.max(Number(pool.recoverableBloodUnits) || 0, currentBloodUnits)),
    };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    BLOOD_UNITS_BY_CREATURE_SIZE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    fallbackBloodUnits,
    createPhysiologyProfile,
    maxBloodUnitsFor,
    createBloodPool,
    applyBloodLoss,
    contaminateBlood,
    createHarvestStack,
    drawBlood,
    regrowBlood,
  });

  global.LuminousBloodIchorCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
