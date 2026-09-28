(function (global) {
  "use strict";

  if (global.LuminousVenomSecretionCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousVenomSecretionCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "venom_secretion";
  const CURRENCY = "AHN";
  const AHN_ECONOMY_SCALE = 5;
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_RESERVOIR_SIZE = "medium";

  const SECRETION_UNITS_BY_RESERVOIR_SIZE = Object.freeze({
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

  function item(id, name, materialNoun, iconFamily, standardUnitValueAhn, reagentTags = [], tags = []) {
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
      measure: "secretion_unit",
      secretionUnitBased: true,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "producer_reservoir_part_size",
      stackable: true,
      stackPolicy: "identical_quality_lineage_secretion_type",
      supportsRenewableHarvest: true,
      harvestIntegrityFamily: FAMILY,
      rawCraftingReagent: true,
      reagentTags: Object.freeze(reagentTags.map(normalizeId).filter(Boolean)),
      tags: Object.freeze(["ingredient", "organic", "raw_harvest", "secretion", ...tags.map(normalizeId).filter(Boolean)]),
    });
  }

  const ITEMS = Object.freeze([
    item("venom", "Venom", "Venom", "venom_raw", 3000,
      ["toxin_reagent", "injectable_toxin", "poison_input"],
      ["venom", "toxin"]),
    item("toxic_secretion", "Toxic Secretion", "Toxic Secretion", "venom_raw", 2500,
      ["toxin_reagent", "contact_toxin", "ingested_toxin", "poison_input"],
      ["toxin"]),
    item("acid_secretion", "Acid Secretion", "Acid Secretion", "acid_secretion", 2000,
      ["corrosive_reagent", "etchant", "processing_chemical", "coating_input"],
      ["acid", "corrosive"]),
    item("ink_secretion", "Ink Secretion", "Ink", "ink_secretion", 800,
      ["ink_reagent", "pigment", "formula_ink_input"],
      ["ink", "pigment"]),
    item("pheromone_scent", "Pheromone / Scent Secretion", "Pheromone", "bio_secretion", 1200,
      ["behavioral_reagent", "lure_reagent", "repellent_reagent", "tracking_reagent", "masking_scent_input"],
      ["pheromone", "scent"]),
    item("defensive_secretion", "Defensive Secretion", "Defensive Secretion", "bio_secretion", 1500,
      ["irritant_reagent", "repellent_reagent", "obscurant_reagent", "defensive_compound_input"],
      ["defensive", "irritant"]),
    item("exotic_secretion", "Exotic Secretion", "Exotic Secretion", "bio_secretion", 5000,
      ["exotic_reagent"],
      ["exotic"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const aliases = {
      raw_venom: "venom",
      toxin: "toxic_secretion",
      acid: "acid_secretion",
      ink: "ink_secretion",
      pheromone: "pheromone_scent",
      scent: "pheromone_scent",
      bio_secretion: "defensive_secretion",
      exotic: "exotic_secretion",
    };
    const resolved = aliases[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const tag = normalizeId(options.tag);
    const reagentTag = normalizeId(options.reagentTag);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .filter((entry) => !reagentTag || entry.reagentTags.includes(reagentTag))
      .map(clone);
  }

  function canonicalSize(value) {
    const engine = sizeEngine();
    return engine?.canonicalSize ? engine.canonicalSize(value || DEFAULT_RESERVOIR_SIZE) : normalizeId(value || DEFAULT_RESERVOIR_SIZE);
  }

  function qualityInfo(quality = DEFAULT_QUALITY) {
    const engine = qualityEngine();
    if (engine?.getQuality) return engine.getQuality(quality);
    return { id: normalizeId(quality || DEFAULT_QUALITY), effectMultiplier: 1, valueMultiplier: 1 };
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    return qEngine?.applyValue
      ? qEngine.applyValue(entry.standardUnitValueAhn, quality, { rounding: "round" })
      : Math.round(Number(entry.standardUnitValueAhn) || 0);
  }

  function potencyMultiplierForQuality(quality = DEFAULT_QUALITY) {
    return Number(qualityInfo(quality)?.effectMultiplier) || 1;
  }

  function fallbackCapacitySU(reservoirSize = DEFAULT_RESERVOIR_SIZE) {
    return SECRETION_UNITS_BY_RESERVOIR_SIZE[canonicalSize(reservoirSize)] ?? null;
  }

  function createProducerProfile(input = {}) {
    const secretionItemId = get(input.secretionItemId || input.itemId || input.secretionType || "venom")?.id || "venom";
    const explicitCapacityRaw = input.capacitySU ?? input.maxSecretionUnits ?? input.maxSU;
    const explicitCapacity = explicitCapacityRaw == null ? null : Number(explicitCapacityRaw);
    const regrowthRaw = input.regrowthPerDay ?? input.productionPerDay;
    const regrowthPerDay = regrowthRaw == null ? null : Number(regrowthRaw);
    const collectionLimitRaw = input.collectionLimitSU ?? input.safeCollectMaxSU;
    const collectionLimitSU = collectionLimitRaw == null ? null : Number(collectionLimitRaw);
    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "producer"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      creatureSize: input.creatureSize ? canonicalSize(input.creatureSize) : null,
      secretionItemId,
      producerOrganItemId: normalizeId(input.producerOrganItemId || input.organItemId || "gland"),
      producerAnatomicalIdentity: normalizeId(input.producerAnatomicalIdentity || input.anatomicalIdentity || "gland"),
      producerPartSize: canonicalSize(input.producerPartSize || input.partSize || DEFAULT_RESERVOIR_SIZE),
      capacitySU: Number.isFinite(explicitCapacity) && explicitCapacity >= 0 ? explicitCapacity : null,
      renewable: input.renewable === true || input.renewableHarvest === true,
      collectionAction: normalizeId(input.collectionAction || input.harvestAction || (secretionItemId === "venom" ? "milk_venom" : "collect_secretion")),
      collectionLimitSU: Number.isFinite(collectionLimitSU) && collectionLimitSU >= 0 ? collectionLimitSU : null,
      regrowthPerDay: Number.isFinite(regrowthPerDay) && regrowthPerDay >= 0 ? regrowthPerDay : null,
      specialProperties: Object.freeze((Array.isArray(input.specialProperties) ? input.specialProperties : []).map(normalizeId).filter(Boolean)),
      tags: Object.freeze((Array.isArray(input.tags) ? input.tags : []).map(normalizeId).filter(Boolean)),
    });
  }

  function capacityForProducer(profile, options = {}) {
    if (profile?.capacitySU != null && Number.isFinite(Number(profile.capacitySU))) {
      return Math.max(0, Number(profile.capacitySU));
    }
    return fallbackCapacitySU(profile?.producerPartSize || options.producerPartSize || DEFAULT_RESERVOIR_SIZE);
  }

  function createSecretionPool(profile, options = {}) {
    if (!profile) return null;
    const itemId = get(options.itemId || profile.secretionItemId || "venom")?.id || "venom";
    if (profile.secretionItemId && itemId !== profile.secretionItemId && options.allowSecretionOverride !== true) return null;
    const capacitySU = capacityForProducer(profile, options);
    if (capacitySU == null) return null;
    const storedRaw = options.currentStoredSU ?? options.currentSU ?? capacitySU;
    const currentStoredSU = Math.max(0, Math.min(capacitySU, Number(storedRaw) || 0));
    const recoverableRaw = options.recoverableSU ?? currentStoredSU;
    const recoverableSU = Math.max(0, Math.min(currentStoredSU, Number(recoverableRaw) || 0));
    return {
      itemId,
      capacitySU,
      currentStoredSU,
      recoverableSU,
      producerOrganItemId: profile.producerOrganItemId,
      producerAnatomicalIdentity: profile.producerAnatomicalIdentity,
      producerPartSize: profile.producerPartSize,
      renewable: profile.renewable === true,
      collectionAction: profile.collectionAction || "collect_secretion",
      collectionLimitSU: profile.collectionLimitSU,
      regrowthPerDay: profile.regrowthPerDay,
      specialProperties: clone(profile.specialProperties || []),
    };
  }

  function applyLeak(pool, lostSU, options = {}) {
    if (!pool) return null;
    const lost = Math.max(0, Number(lostSU) || 0);
    const currentStoredSU = Math.max(0, (Number(pool.currentStoredSU) || 0) - lost);
    const contaminated = Math.max(0, Number(options.contaminatedSU) || 0);
    const recoverableSU = Math.max(0, Math.min(
      currentStoredSU,
      (Number(pool.recoverableSU) || 0) - lost - contaminated
    ));
    return { ...pool, currentStoredSU, recoverableSU };
  }

  function contaminateSecretion(pool, contaminatedSU) {
    if (!pool) return null;
    const amount = Math.max(0, Number(contaminatedSU) || 0);
    return {
      ...pool,
      recoverableSU: Math.max(0, (Number(pool.recoverableSU) || 0) - amount),
    };
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
    const pool = options.pool || (options.producerProfile ? createSecretionPool(options.producerProfile, { itemId: entry.id }) : null);
    const requested = Math.max(0, Number(options.secretionUnits ?? options.quantity ?? 0) || 0);
    const recoverableMax = pool ? Math.max(0, Number(pool.recoverableSU) || 0) : requested;
    const integrityRaw = options.integrityRecoverableMax ?? options.recoverableMax;
    const integrityMax = integrityRaw == null ? null : Math.max(0, Number(integrityRaw) || 0);
    let secretionUnits = Math.min(requested, recoverableMax);
    if (integrityMax != null) secretionUnits = Math.min(secretionUnits, integrityMax);
    const unitValueAhn = unitValueForQuality(entry, quality);
    const materialName = `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
    const specialProperties = Array.from(new Set([
      ...(pool?.specialProperties || []),
      ...(Array.isArray(options.specialProperties) ? options.specialProperties.map(normalizeId).filter(Boolean) : []),
    ]));
    return {
      itemId: entry.id,
      family: FAMILY,
      measure: "secretion_unit",
      secretionUnits,
      remainingSecretionUnits: secretionUnits,
      quality,
      potencyMultiplier: potencyMultiplierForQuality(quality),
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: materialName,
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * secretionUnits),
      rawCraftingReagent: true,
      reagentTags: clone(entry.reagentTags),
      specialProperties,
      harvestIntegrityFamily: FAMILY,
      sourceGland: pool ? {
        organItemId: pool.producerOrganItemId,
        anatomicalIdentity: pool.producerAnatomicalIdentity,
        partSize: pool.producerPartSize,
      } : clone(options.sourceGland || null),
      producerProfileSnapshot: clone(options.producerProfile || null),
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function collectRenewable(profile, pool, requestedSU, options = {}) {
    if (!profile || !pool || profile.renewable !== true) return null;
    const requested = Math.max(0, Number(requestedSU) || 0);
    const configuredLimit = profile.collectionLimitSU;
    const limit = options.ignoreCollectionLimit === true || configuredLimit == null
      ? requested
      : Math.max(0, Number(configuredLimit) || 0);
    const collected = Math.min(requested, limit, Math.max(0, Number(pool.recoverableSU) || 0));
    const currentStoredSU = Math.max(0, (Number(pool.currentStoredSU) || 0) - collected);
    return {
      collected,
      action: profile.collectionAction || "collect_secretion",
      nextPool: {
        ...pool,
        currentStoredSU,
        recoverableSU: Math.max(0, Math.min(currentStoredSU, (Number(pool.recoverableSU) || 0) - collected)),
      },
    };
  }

  function regrowSecretion(pool, days = 1) {
    if (!pool || pool.renewable !== true) return pool ? { ...pool } : null;
    const rate = Number(pool.regrowthPerDay);
    if (!Number.isFinite(rate) || rate <= 0) return { ...pool };
    const elapsed = Math.max(0, Number(days) || 0);
    const currentStoredSU = Math.min(pool.capacitySU, (Number(pool.currentStoredSU) || 0) + rate * elapsed);
    return {
      ...pool,
      currentStoredSU,
      recoverableSU: Math.max(Number(pool.recoverableSU) || 0, currentStoredSU),
    };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_RESERVOIR_SIZE,
    SECRETION_UNITS_BY_RESERVOIR_SIZE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    potencyMultiplierForQuality,
    fallbackCapacitySU,
    createProducerProfile,
    capacityForProducer,
    createSecretionPool,
    applyLeak,
    contaminateSecretion,
    createHarvestStack,
    collectRenewable,
    regrowSecretion,
  });

  global.LuminousVenomSecretionCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
