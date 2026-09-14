(function (global) {
  "use strict";

  if (global.LuminousOrganGlandCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousOrganGlandCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "organ_gland";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_PART_SIZE = "medium";

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

  function item(id, name, materialNoun, iconFamily, standardMediumValueAhn, harvestIntegrityFamily, transplantMode, medicalValue, tags = []) {
    const medicalRange = Array.isArray(medicalValue)
      ? Object.freeze({ minAhn: medicalValue[0], maxAhn: medicalValue[1] ?? null })
      : null;
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
      standardMediumValueAhn,
      measure: "piece",
      pieceBased: true,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "anatomical_part_size",
      creatureSizeDoesNotImplyPartSize: true,
      stackable: true,
      stackPolicy: "identical_anatomical_identity_part_size_quality_lineage",
      supportsRenewableHarvest: false,
      harvestIntegrityFamily,
      transplantMode,
      transplantMedicalStandardMediumValueAhn: typeof medicalValue === "number" ? medicalValue : null,
      transplantMedicalRangeAhn: medicalRange,
      medicalGradeRequires: Object.freeze(["transplant_eligible", "intact", "preserved", "compatible"]),
      tags: Object.freeze(["ingredient", "organic", "raw_harvest", "anatomical_part", ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("heart", "Heart", "Heart", "organ_internal", 7000, "organ_internal", "standard", 60000, ["organ", "circulatory"]),
    item("liver", "Liver", "Liver", "organ_internal", 5000, "organ_internal", "standard", 40000, ["organ", "digestive", "metabolic"]),
    item("kidney", "Kidney", "Kidney", "organ_internal", 3000, "organ_internal", "standard", 20000, ["organ", "renal"]),
    item("lung", "Lung", "Lung", "organ_internal", 3500, "organ_internal", "standard", 30000, ["organ", "respiratory"]),
    item("stomach", "Stomach / Digestive Organ", "Stomach", "organ_internal", 3000, "organ_internal", "standard", 10000, ["organ", "digestive"]),
    item("eye", "Eye / Sensory Organ", "Eye", "organ_sensory", 2500, "organ_sensory", "standard", 15000, ["organ", "sensory"]),
    item("brain", "Brain", "Brain", "organ_brain", 9000, "organ_brain", "none", null, ["organ", "neural"]),
    item("gland", "Gland", "Gland", "organ_gland", 8000, "organ_gland", "conditional", [10000, 40000], ["organ", "gland", "producer"]),
    item("sac_bladder", "Sac / Bladder", "Sac / Bladder", "organ_gland", 5000, "organ_gland", "conditional", [8000, 20000], ["organ", "sac", "container"]),
    item("exotic_organ", "Exotic Organ", "Exotic Organ", "organ_gland", 15000, "organ_gland", "conditional", [50000, null], ["organ", "exotic"]),
  ]);

  function get(id) {
    const key = normalizeId(id);
    const aliases = {
      sensory_organ: "eye",
      digestive_organ: "stomach",
      sac: "sac_bladder",
      bladder: "sac_bladder",
      exotic: "exotic_organ",
    };
    const resolved = aliases[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const tag = normalizeId(options.tag);
    const transplantMode = normalizeId(options.transplantMode);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .filter((entry) => !transplantMode || entry.transplantMode === transplantMode)
      .map(clone);
  }

  function canonicalSize(value) {
    const engine = sizeEngine();
    return engine?.canonicalSize ? engine.canonicalSize(value || DEFAULT_PART_SIZE) : normalizeId(value || DEFAULT_PART_SIZE);
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const sEngine = sizeEngine();
    const qEngine = qualityEngine();
    const partSize = canonicalSize(options.partSize || options.size || DEFAULT_PART_SIZE);
    const sized = sEngine?.scaleValue
      ? sEngine.scaleValue(entry.standardMediumValueAhn, partSize, { rounding: "round" })
      : Number(entry.standardMediumValueAhn) || 0;
    return qEngine?.applyValue ? qEngine.applyValue(sized, quality, { rounding: "round" }) : Math.round(sized);
  }

  function medicalValueRangeForQuality(itemOrId, quality = DEFAULT_QUALITY, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry || entry.transplantMode === "none") return null;
    const sEngine = sizeEngine();
    const qEngine = qualityEngine();
    const partSize = canonicalSize(options.partSize || options.size || DEFAULT_PART_SIZE);
    let minBase = entry.transplantMedicalStandardMediumValueAhn;
    let maxBase = entry.transplantMedicalStandardMediumValueAhn;
    if (entry.transplantMedicalRangeAhn) {
      minBase = entry.transplantMedicalRangeAhn.minAhn;
      maxBase = entry.transplantMedicalRangeAhn.maxAhn;
    }
    if (options.medicalBaseValueAhn != null) {
      minBase = Number(options.medicalBaseValueAhn);
      maxBase = Number(options.medicalBaseValueAhn);
    }
    if (!Number.isFinite(Number(minBase))) return null;
    const scale = (value) => {
      if (value == null || !Number.isFinite(Number(value))) return null;
      const sized = sEngine?.scaleValue ? sEngine.scaleValue(Number(value), partSize, { rounding: "round" }) : Number(value);
      return qEngine?.applyValue ? qEngine.applyValue(sized, quality, { rounding: "round" }) : Math.round(sized);
    };
    return Object.freeze({ minAhn: scale(minBase), maxAhn: scale(maxBase) });
  }

  function createAnatomyProfile(input = {}) {
    const parts = {};
    for (const [rawIdentity, rawSpec] of Object.entries(input.parts || {})) {
      const source = typeof rawSpec === "number" ? { maxCount: rawSpec } : (rawSpec || {});
      const anatomicalIdentity = normalizeId(rawIdentity);
      const itemId = normalizeId(source.itemId || source.materialId || anatomicalIdentity);
      const entry = get(itemId);
      if (!entry) continue;
      const rawMax = source.maxCount ?? source.maxYield ?? source.count;
      const maxCount = Number.isFinite(Number(rawMax)) ? Math.max(0, Math.trunc(Number(rawMax))) : null;
      parts[anatomicalIdentity] = Object.freeze({
        anatomicalIdentity,
        itemId: entry.id,
        maxCount,
        partSize: source.partSize ? canonicalSize(source.partSize) : null,
        transplantable: source.transplantable == null ? null : source.transplantable === true,
        tags: Object.freeze(Array.isArray(source.tags) ? source.tags.map(normalizeId).filter(Boolean) : []),
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

  function findAnatomySpecs(profile, itemOrId, anatomicalIdentity = null) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return [];
    const identity = normalizeId(anatomicalIdentity);
    if (identity && profile?.parts?.[identity]) {
      const spec = profile.parts[identity];
      return spec.itemId === entry.id ? [spec] : [];
    }
    return Object.values(profile?.parts || {}).filter((spec) => spec.itemId === entry.id);
  }

  function maxYieldFor(profile, itemOrId, options = {}) {
    const specs = findAnatomySpecs(profile, itemOrId, options.anatomicalIdentity);
    if (!specs.length) return null;
    if (specs.some((spec) => spec.maxCount == null)) return null;
    return specs.reduce((sum, spec) => sum + spec.maxCount, 0);
  }

  function recoverableYieldFor(profile, itemOrId, requestedYield, options = {}) {
    const requested = Math.max(0, Math.trunc(Number(requestedYield) || 0));
    const anatomyMax = maxYieldFor(profile, itemOrId, options);
    const integrityRaw = options.integrityRecoverableMax ?? options.recoverableMax;
    const integrityMax = Number.isFinite(Number(integrityRaw)) ? Math.max(0, Math.trunc(Number(integrityRaw))) : null;
    let result = anatomyMax == null ? requested : Math.min(requested, anatomyMax);
    if (integrityMax != null) result = Math.min(result, integrityMax);
    return result;
  }

  function createHarvestPart(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id : String(options.quality || DEFAULT_QUALITY);
    const identity = normalizeId(options.anatomicalIdentity || entry.id);
    const spec = findAnatomySpecs(options.anatomyProfile, entry, identity)[0] || null;
    const partSize = canonicalSize(options.partSize || options.size || spec?.partSize || DEFAULT_PART_SIZE);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const requested = options.quantity ?? 1;
    const quantity = options.anatomyProfile
      ? recoverableYieldFor(options.anatomyProfile, entry, requested, { ...options, anatomicalIdentity: identity })
      : Math.max(0, Math.trunc(Number(requested) || 0));
    const unitValueAhn = unitValueForQuality(entry, quality, { partSize });
    const anatomicalLabel = String(options.anatomicalLabel || entry.materialNoun).trim();
    const sizeLabel = sEngine?.getSize ? sEngine.getSize(partSize).label : partSize;
    return {
      itemId: entry.id,
      family: FAMILY,
      measure: "piece",
      quantity,
      anatomicalIdentity: identity,
      anatomicalLabel,
      partSize,
      creatureSize: options.creatureSize || options.anatomyProfile?.creatureSize || null,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName: `${lineage.lineageName} ${anatomicalLabel}`.replace(/\s+/g, " ").trim(),
      displayName: `${sizeLabel} ${lineage.lineageName} ${anatomicalLabel}`.replace(/\s+/g, " ").trim(),
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * quantity),
      harvestIntegrityFamily: entry.harvestIntegrityFamily,
      transplantMode: entry.transplantMode,
      transplantableByAnatomy: spec?.transplantable,
      transplantMedicalValueRangeAhn: medicalValueRangeForQuality(entry, quality, { partSize }),
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_PART_SIZE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    medicalValueRangeForQuality,
    createAnatomyProfile,
    findAnatomySpecs,
    maxYieldFor,
    recoverableYieldFor,
    createHarvestPart,
  });

  global.LuminousOrganGlandCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
