(function (global) {
  "use strict";

  if (global.LuminousEssenceCoreCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEssenceCoreCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "essence_core";
  const CURRENCY = "AHN";
  const AHN_ECONOMY_SCALE = 3;
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_CORE_SIZE = "medium";

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

  function essence(id, name, standardUnitValueAhn, reagentTags = [], tags = []) {
    return Object.freeze({
      id,
      name,
      materialNoun: name,
      form: "essence",
      family: FAMILY,
      iconFamily: "essence_raw",
      category: "ingredient",
      itemType: "material",
      sourceLine: "special_harvest",
      purchasable: true,
      currency: CURRENCY,
      standardUnitValueAhn: Math.round(standardUnitValueAhn * AHN_ECONOMY_SCALE),
      measure: "essence_unit",
      essenceUnitBased: true,
      pieceBased: false,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: null,
      stackable: true,
      stackPolicy: "identical_essence_type_quality_lineage",
      rawCraftingReagent: true,
      requiresDeclaredSourceProfile: true,
      universalYieldFallback: null,
      reagentTags: Object.freeze(reagentTags.map(normalizeId).filter(Boolean)),
      tags: Object.freeze(["ingredient", "magical", "raw_harvest", "essence", ...tags.map(normalizeId).filter(Boolean)]),
    });
  }

  function core(id, name, standardMediumValueAhn, reagentTags = [], tags = []) {
    return Object.freeze({
      id,
      name,
      materialNoun: name,
      form: "core",
      family: FAMILY,
      iconFamily: "energy_core",
      category: "ingredient",
      itemType: "material",
      sourceLine: "special_harvest",
      purchasable: true,
      currency: CURRENCY,
      standardMediumValueAhn: Math.round(standardMediumValueAhn * AHN_ECONOMY_SCALE),
      measure: "piece",
      essenceUnitBased: false,
      pieceBased: true,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "core_part_size",
      stackable: true,
      stackPolicy: "identical_core_identity_part_size_quality_lineage",
      rawCraftingReagent: true,
      requiresDeclaredSourceProfile: true,
      universalYieldFallback: null,
      reagentTags: Object.freeze(reagentTags.map(normalizeId).filter(Boolean)),
      tags: Object.freeze(["ingredient", "magical", "raw_harvest", "core", "power_source", ...tags.map(normalizeId).filter(Boolean)]),
    });
  }

  const ITEMS = Object.freeze([
    essence("elemental_essence", "Elemental Essence", 10000,
      ["elemental_reagent", "elemental_coating_input", "elemental_ammo_input", "energy_conversion_reagent"],
      ["elemental"]),
    essence("arcane_essence", "Arcane Essence", 12000,
      ["arcane_reagent", "enchantment_reagent", "arcane_catalyst", "magical_processing_reagent"],
      ["arcane"]),
    essence("necrotic_essence", "Necrotic Essence", 14000,
      ["necrotic_reagent", "decay_reagent", "abnormal_process_input"],
      ["necrotic"]),
    essence("spirit_essence", "Spirit Essence", 15000,
      ["spirit_reagent", "ritual_reagent", "binding_reagent"],
      ["spirit"]),
    essence("radiant_essence", "Radiant Essence", 16000,
      ["radiant_reagent", "purification_reagent", "special_energy_reagent"],
      ["radiant"]),
    essence("psionic_essence", "Psionic Essence", 18000,
      ["psionic_reagent", "neural_interface_reagent", "mental_device_reagent", "augmentation_reagent"],
      ["psionic"]),
    core("mana_energy_core", "Mana / Energy Core", 75000,
      ["magical_power_source", "device_core", "weapon_core", "module_core"],
      ["mana", "energy"]),
    core("exotic_core", "Exotic Core", 150000,
      ["exotic_power_source", "abnormal_core", "corp_crafting_core", "high_tier_reagent"],
      ["exotic", "abnormal"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const aliases = {
      elemental: "elemental_essence",
      arcane: "arcane_essence",
      necrotic: "necrotic_essence",
      spirit: "spirit_essence",
      radiant: "radiant_essence",
      psionic: "psionic_essence",
      mana_core: "mana_energy_core",
      energy_core: "mana_energy_core",
      core: "mana_energy_core",
      exotic: "exotic_core",
    };
    const resolved = aliases[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const form = normalizeId(options.form);
    const tag = normalizeId(options.tag);
    const reagentTag = normalizeId(options.reagentTag);
    return ITEMS
      .filter((entry) => !form || entry.form === form)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .filter((entry) => !reagentTag || entry.reagentTags.includes(reagentTag))
      .map(clone);
  }

  function canonicalSize(value) {
    const engine = sizeEngine();
    return engine?.canonicalSize ? engine.canonicalSize(value || DEFAULT_CORE_SIZE) : normalizeId(value || DEFAULT_CORE_SIZE);
  }

  function qualityInfo(quality = DEFAULT_QUALITY) {
    const engine = qualityEngine();
    if (engine?.getQuality) return engine.getQuality(quality);
    return { id: normalizeId(quality || DEFAULT_QUALITY), effectMultiplier: 1, valueMultiplier: 1 };
  }

  function potencyMultiplierForQuality(quality = DEFAULT_QUALITY) {
    return Number(qualityInfo(quality)?.effectMultiplier) || 1;
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    let baseValue;
    if (entry.form === "core") {
      const sEngine = sizeEngine();
      const partSize = canonicalSize(options.partSize || options.size || DEFAULT_CORE_SIZE);
      baseValue = sEngine?.scaleValue
        ? sEngine.scaleValue(entry.standardMediumValueAhn, partSize, { rounding: "round" })
        : Number(entry.standardMediumValueAhn) || 0;
    } else {
      baseValue = Number(entry.standardUnitValueAhn) || 0;
    }
    return qEngine?.applyValue
      ? qEngine.applyValue(baseValue, quality, { rounding: "round" })
      : Math.round(baseValue);
  }

  function createSourceProfile(input = {}) {
    const essence = {};
    for (const [rawId, rawMax] of Object.entries(input.essence || input.essences || {})) {
      const item = get(rawId);
      if (!item || item.form !== "essence") continue;
      const maxEU = Number(rawMax?.maxEU ?? rawMax?.maxYield ?? rawMax);
      if (!Number.isFinite(maxEU) || maxEU < 0) continue;
      essence[item.id] = Object.freeze({ itemId: item.id, maxEU });
    }

    const cores = {};
    for (const [rawIdentity, rawSpec] of Object.entries(input.cores || {})) {
      const spec = typeof rawSpec === "number" ? { maxCount: rawSpec } : (rawSpec || {});
      const item = get(spec.itemId || spec.materialId || rawIdentity);
      if (!item || item.form !== "core") continue;
      const rawMax = spec.maxCount ?? spec.maxYield ?? spec.count;
      const maxCount = Number.isFinite(Number(rawMax)) ? Math.max(0, Math.trunc(Number(rawMax))) : null;
      const identity = normalizeId(rawIdentity);
      cores[identity] = Object.freeze({
        anatomicalIdentity: identity,
        itemId: item.id,
        maxCount,
        partSize: canonicalSize(spec.partSize || DEFAULT_CORE_SIZE),
      });
    }

    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "special_source"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      essence: Object.freeze(essence),
      cores: Object.freeze(cores),
    });
  }

  function declaredEssenceMaxEU(profile, itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry || entry.form !== "essence") return null;
    return profile?.essence?.[entry.id]?.maxEU ?? null;
  }

  function findCoreSpecs(profile, itemOrId, anatomicalIdentity = null) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry || entry.form !== "core") return [];
    const identity = normalizeId(anatomicalIdentity);
    if (identity && profile?.cores?.[identity]) {
      const spec = profile.cores[identity];
      return spec.itemId === entry.id ? [spec] : [];
    }
    return Object.values(profile?.cores || {}).filter((spec) => spec.itemId === entry.id);
  }

  function declaredCoreMaxCount(profile, itemOrId, options = {}) {
    const specs = findCoreSpecs(profile, itemOrId, options.anatomicalIdentity);
    if (!specs.length) return null;
    if (specs.some((spec) => spec.maxCount == null)) return null;
    return specs.reduce((sum, spec) => sum + spec.maxCount, 0);
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id : normalizeId(options.quality || DEFAULT_QUALITY);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId || options.sourceProfile?.lineageId, lineageName: options.lineageName || options.sourceProfile?.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };

    if (entry.form === "essence") {
      const requested = Math.max(0, Number(options.essenceUnits ?? options.quantity ?? 0) || 0);
      const declaredMax = options.sourceProfile ? declaredEssenceMaxEU(options.sourceProfile, entry) : null;
      if (options.sourceProfile && declaredMax == null) return null;
      const recoverableRaw = options.integrityRecoverableMax ?? options.recoverableMaxEU ?? requested;
      const recoverableMax = Math.max(0, Number(recoverableRaw) || 0);
      const essenceUnits = Math.min(requested, recoverableMax, declaredMax == null ? requested : declaredMax);
      const unitValueAhn = unitValueForQuality(entry, quality);
      const materialName = `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
      return {
        itemId: entry.id,
        family: FAMILY,
        form: "essence",
        measure: "essence_unit",
        essenceUnits,
        remainingEssenceUnits: essenceUnits,
        quality,
        potencyMultiplier: potencyMultiplierForQuality(quality),
        lineageId: lineage.lineageId,
        lineageName: lineage.lineageName,
        materialName,
        displayName: materialName,
        unitValueAhn,
        totalValueAhn: Math.round(unitValueAhn * essenceUnits),
        rawCraftingReagent: true,
        reagentTags: clone(entry.reagentTags),
        sourceProfileSnapshot: clone(options.sourceProfile || null),
      };
    }

    const identity = normalizeId(options.anatomicalIdentity || entry.id);
    const specs = options.sourceProfile ? findCoreSpecs(options.sourceProfile, entry, identity) : [];
    if (options.sourceProfile && !specs.length) return null;
    const spec = specs[0] || null;
    const partSize = canonicalSize(options.partSize || spec?.partSize || DEFAULT_CORE_SIZE);
    const requested = Math.max(0, Math.trunc(Number(options.quantity ?? 1) || 0));
    const declaredMax = options.sourceProfile ? declaredCoreMaxCount(options.sourceProfile, entry, { anatomicalIdentity: identity }) : null;
    const recoverableRaw = options.integrityRecoverableMax ?? options.recoverableMax ?? requested;
    const recoverableMax = Math.max(0, Math.trunc(Number(recoverableRaw) || 0));
    const quantity = Math.min(requested, recoverableMax, declaredMax == null ? requested : declaredMax);
    const unitValueAhn = unitValueForQuality(entry, quality, { partSize });
    const sizeLabel = sEngine?.getSize ? sEngine.getSize(partSize).label : partSize;
    const materialName = `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim();
    return {
      itemId: entry.id,
      family: FAMILY,
      form: "core",
      measure: "piece",
      quantity,
      remainingQuantity: quantity,
      anatomicalIdentity: identity,
      partSize,
      quality,
      potencyMultiplier: potencyMultiplierForQuality(quality),
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: `${sizeLabel} ${materialName}`.replace(/\s+/g, " ").trim(),
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * quantity),
      rawCraftingReagent: true,
      reagentTags: clone(entry.reagentTags),
      sourceProfileSnapshot: clone(options.sourceProfile || null),
    };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_CORE_SIZE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    potencyMultiplierForQuality,
    createSourceProfile,
    declaredEssenceMaxEU,
    findCoreSpecs,
    declaredCoreMaxCount,
    createHarvestStack,
  });

  global.LuminousEssenceCoreCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
