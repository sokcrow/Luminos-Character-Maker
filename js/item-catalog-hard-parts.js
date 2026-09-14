(function (global) {
  "use strict";

  if (global.LuminousHardPartsCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousHardPartsCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "hard_parts";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_PART_SIZE = "medium";
  const DRACONIC_VALUE_MULTIPLIER = 3;
  const AHN_ECONOMY_SCALE = 10;

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

  function harvestEngine() {
    return global.LuminousItemHarvestIntegrityEngine || safeRequire("./item-harvest-integrity-engine.js");
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
      sizeSystem: "anatomical_part_size",
      creatureSizeDoesNotImplyPartSize: true,
      discreteAnatomicalPart: true,
      stackable: true,
      stackPolicy: "identical_anatomical_parts_only",
      primitiveHardMaterial: true,
      tags: Object.freeze(["ingredient", "organic", "hard_part", "primitive_hard_material", ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("hard_bone", "Bone", "Bone", "hard_bone", 600, ["bone"]),
    item("hard_beak", "Beak", "Beak", "hard_bone", 900, ["beak"]),
    item("hard_claw", "Claw", "Claw", "hard_claw", 1000, ["claw"]),
    item("hard_talon", "Talon", "Talon", "hard_claw", 1000, ["talon"]),
    item("hard_fang", "Fang", "Fang", "hard_claw", 1200, ["fang"]),
    item("hard_horn", "Horn", "Horn", "hard_horn", 1500, ["horn"]),
    item("hard_antler", "Antler", "Antler", "hard_horn", 1500, ["antler"]),
    item("hard_tusk", "Tusk", "Tusk", "hard_horn", 1800, ["tusk", "ivory"]),
    item("hard_ivory", "Ivory", "Ivory", "hard_horn", 1800, ["ivory"]),
    item("hard_exotic", "Exotic Hard Part", "Hard Part", "hard_bone", 2200, ["exotic"]),
  ]);

  const ANATOMICAL_PARTS = Object.freeze({
    bone: Object.freeze({ id: "bone", itemId: "hard_bone", label: "Bone", form: null }),
    skull: Object.freeze({ id: "skull", itemId: "hard_bone", label: "Skull", form: "flat", countFromHeads: true }),
    femur: Object.freeze({ id: "femur", itemId: "hard_bone", label: "Femur", form: "long" }),
    humerus: Object.freeze({ id: "humerus", itemId: "hard_bone", label: "Humerus", form: "long" }),
    rib: Object.freeze({ id: "rib", itemId: "hard_bone", label: "Rib", form: "small" }),
    vertebra: Object.freeze({ id: "vertebra", itemId: "hard_bone", label: "Vertebra", form: "small" }),
    small_bone: Object.freeze({ id: "small_bone", itemId: "hard_bone", label: "Small Bone", form: "small" }),
    bone_fragment: Object.freeze({ id: "bone_fragment", itemId: "hard_bone", label: "Bone Fragment", form: "fragment" }),
    beak: Object.freeze({ id: "beak", itemId: "hard_beak", label: "Beak", form: "pointed", countFromHeads: true }),
    claw: Object.freeze({ id: "claw", itemId: "hard_claw", label: "Claw", form: "pointed" }),
    talon: Object.freeze({ id: "talon", itemId: "hard_talon", label: "Talon", form: "pointed" }),
    fang: Object.freeze({ id: "fang", itemId: "hard_fang", label: "Fang", form: "pointed" }),
    horn: Object.freeze({ id: "horn", itemId: "hard_horn", label: "Horn", form: "pointed" }),
    antler: Object.freeze({ id: "antler", itemId: "hard_antler", label: "Antler", form: "branched" }),
    tusk: Object.freeze({ id: "tusk", itemId: "hard_tusk", label: "Tusk", form: "pointed" }),
    ivory: Object.freeze({ id: "ivory", itemId: "hard_ivory", label: "Ivory", form: "solid" }),
    exotic_hard_part: Object.freeze({ id: "exotic_hard_part", itemId: "hard_exotic", label: "Hard Part", form: null }),
  });

  const MEDIUM_PRIMITIVE_RECIPES = Object.freeze({
    bone_club: Object.freeze({
      id: "bone_club",
      parts: Object.freeze([Object.freeze({ materialIds: Object.freeze(["hard_bone"]), minSize: "medium", forms: Object.freeze(["long"]), quantity: 1 })]),
    }),
    bone_javelin: Object.freeze({
      id: "bone_javelin",
      parts: Object.freeze([Object.freeze({ materialIds: Object.freeze(["hard_bone"]), minSize: "medium", forms: Object.freeze(["long"]), quantity: 1 })]),
    }),
    bone_dart: Object.freeze({
      id: "bone_dart",
      parts: Object.freeze([Object.freeze({ materialIds: Object.freeze(["hard_bone", "hard_fang", "hard_claw", "hard_talon"]), minSize: "tiny", quantity: 1 })]),
    }),
    bone_needle: Object.freeze({
      id: "bone_needle",
      parts: Object.freeze([Object.freeze({ materialIds: Object.freeze(["hard_bone"]), minSize: "tiny", forms: Object.freeze(["small", "fragment"]), quantity: 1 })]),
    }),
    primitive_shield: Object.freeze({
      id: "primitive_shield",
      parts: Object.freeze([Object.freeze({ materialIds: Object.freeze(["hard_bone"]), minSize: "medium", forms: Object.freeze(["long", "flat"]), quantity: 2 })]),
      hideUnits: 4,
    }),
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

  function anatomicalPart(value) {
    return ANATOMICAL_PARTS[normalizeId(value)] || null;
  }

  function resolveItemForPart(itemOrId, anatomicalPartId) {
    const anatomy = anatomicalPart(anatomicalPartId);
    if (anatomy?.itemId) return get(anatomy.itemId);
    return typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
  }

  function isDraconic(options = {}) {
    const creatureType = normalizeId(options.originCreatureType);
    const tags = new Set((options.lineageTags || []).map(normalizeId));
    return options.draconic === true || creatureType === "dragon" || tags.has("draconic");
  }

  function lineageValueMultiplier(options = {}) {
    const explicit = Number(options.lineageValueMultiplier);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return isDraconic(options) ? DRACONIC_VALUE_MULTIPLIER : 1;
  }

  function baseValueForPartSize(itemOrId, partSize = DEFAULT_PART_SIZE) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const engine = sizeEngine();
    if (!engine?.scaleValue) return Math.round(Number(entry.mediumStandardValueAhn) || 0);
    return engine.scaleValue(entry.mediumStandardValueAhn, partSize, { rounding: "round" });
  }

  function priceForSizeAndQuality(itemOrId, partSize = DEFAULT_PART_SIZE, quality = DEFAULT_QUALITY, options = {}) {
    const base = baseValueForPartSize(itemOrId, partSize);
    if (base == null) return null;
    const qEngine = qualityEngine();
    const qualityValue = qEngine?.applyValue ? qEngine.applyValue(base, quality, { rounding: "round" }) : Math.round(base);
    return Math.round(qualityValue * lineageValueMultiplier(options));
  }

  function createAnatomyProfile(input = {}) {
    const parts = {};
    for (const [rawId, rawSpec] of Object.entries(input.parts || {})) {
      const id = normalizeId(rawId);
      if (!id) continue;
      const source = typeof rawSpec === "number" ? { maxCount: rawSpec } : (rawSpec || {});
      const maxCount = Math.max(0, Math.trunc(Number(source.maxCount ?? source.count ?? 0) || 0));
      parts[id] = Object.freeze({
        id,
        maxCount,
        partSize: source.partSize ? String(source.partSize) : null,
        form: source.form ? normalizeId(source.form) : null,
      });
    }
    return Object.freeze({
      id: normalizeId(input.id || input.lineageId || "anatomy"),
      lineageId: normalizeId(input.lineageId || input.id || "generic"),
      lineageName: String(input.lineageName || input.name || "Generic").trim(),
      heads: Math.max(1, Math.trunc(Number(input.heads || 1))),
      creatureSize: input.creatureSize || null,
      parts: Object.freeze(parts),
    });
  }

  function maxCountForPart(profile, anatomicalPartId) {
    const id = normalizeId(anatomicalPartId);
    const explicit = profile?.parts?.[id]?.maxCount;
    if (Number.isFinite(Number(explicit))) return Math.max(0, Math.trunc(Number(explicit)));
    const anatomy = anatomicalPart(id);
    if (anatomy?.countFromHeads) return Math.max(1, Math.trunc(Number(profile?.heads || 1)));
    return null;
  }

  function clampYieldToAnatomy(profile, anatomicalPartId, requestedQuantity = 1) {
    const requested = Math.max(0, Math.trunc(Number(requestedQuantity) || 0));
    const max = maxCountForPart(profile, anatomicalPartId);
    return max == null ? requested : Math.min(requested, max);
  }

  function createHarvestPart(itemOrId, options = {}) {
    const anatomy = anatomicalPart(options.anatomicalPart || options.part || "") || null;
    const entry = resolveItemForPart(itemOrId, anatomy?.id);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality
      ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id
      : String(options.quality || DEFAULT_QUALITY);
    const profilePart = options.anatomyProfile?.parts?.[anatomy?.id || ""];
    const rawSize = options.partSize || options.size || profilePart?.partSize || DEFAULT_PART_SIZE;
    const partSize = sEngine?.canonicalSize ? sEngine.canonicalSize(rawSize) : String(rawSize);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: options.lineageId || entry.id, lineageName: options.lineageName || entry.name };
    const quantity = options.anatomyProfile && anatomy
      ? clampYieldToAnatomy(options.anatomyProfile, anatomy.id, options.quantity ?? 1)
      : Math.max(1, Math.trunc(Number(options.quantity || 1)));
    const partLabel = anatomy?.label || entry.materialNoun;
    const form = normalizeId(options.form || profilePart?.form || anatomy?.form || "") || null;
    const multiplier = lineageValueMultiplier(options);
    const materialName = `${lineage.lineageName} ${partLabel}`.replace(/\s+/g, " ").trim();
    const sizeLabel = sEngine?.getSize ? sEngine.getSize(partSize).label : partSize;
    return {
      itemId: entry.id,
      family: FAMILY,
      quantity,
      size: partSize,
      partSize,
      creatureSize: options.creatureSize || options.anatomyProfile?.creatureSize || null,
      anatomicalPart: anatomy?.id || normalizeId(options.anatomicalPart || entry.materialNoun),
      anatomicalLabel: partLabel,
      form,
      quality,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      materialName,
      displayName: `${sizeLabel} ${materialName}`.trim(),
      unitValueAhn: priceForSizeAndQuality(entry, partSize, quality, { ...options, lineageValueMultiplier: multiplier }),
      lineageValueMultiplier: multiplier,
      primitiveHardMaterial: true,
      canMergeForLargerPart: false,
      harvestIntegrityFamily: FAMILY,
      integritySnapshot: clone(options.integritySnapshot || null),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function sizeAtLeast(actual, minimum) {
    const engine = sizeEngine();
    const order = engine?.SIZE_ORDER || ["tiny", "small", "medium", "large", "huge", "gargantuan"];
    const actualId = engine?.canonicalSize ? engine.canonicalSize(actual) : normalizeId(actual);
    const minimumId = engine?.canonicalSize ? engine.canonicalSize(minimum) : normalizeId(minimum);
    return order.indexOf(actualId) >= order.indexOf(minimumId);
  }

  function canDownsizePart(sourceSize, targetSize) {
    return sizeAtLeast(sourceSize, targetSize);
  }

  function canMergePartsForLargerSize() {
    return false;
  }

  function canSatisfyRequirement(part, requirement = {}) {
    if (!part) return false;
    const materialIds = Array.isArray(requirement.materialIds) ? requirement.materialIds : [requirement.materialId].filter(Boolean);
    if (materialIds.length && !materialIds.includes(part.itemId)) return false;
    if (requirement.minSize && !sizeAtLeast(part.partSize || part.size, requirement.minSize)) return false;
    const forms = Array.isArray(requirement.forms) ? requirement.forms.map(normalizeId) : [];
    if (forms.length && !forms.includes(normalizeId(part.form))) return false;
    return true;
  }

  function partsSatisfyRequirement(parts, requirement = {}) {
    const needed = Math.max(1, Math.trunc(Number(requirement.quantity || 1)));
    let available = 0;
    for (const part of Array.isArray(parts) ? parts : []) {
      if (!canSatisfyRequirement(part, requirement)) continue;
      available += Math.max(1, Math.trunc(Number(part.quantity || 1)));
      if (available >= needed) return true;
    }
    return false;
  }

  function recipeSatisfied(recipeId, parts = [], hideUnits = 0) {
    const recipe = MEDIUM_PRIMITIVE_RECIPES[normalizeId(recipeId)];
    if (!recipe) return false;
    if (Number(recipe.hideUnits || 0) > Number(hideUnits || 0)) return false;
    return recipe.parts.every((requirement) => partsSatisfyRequirement(parts, requirement));
  }

  function harvestCondition(record) {
    const engine = harvestEngine();
    return engine?.harvestCondition ? engine.harvestCondition(record, FAMILY) : null;
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_PART_SIZE,
    DRACONIC_VALUE_MULTIPLIER,
    AHN_ECONOMY_SCALE,
    ITEMS,
    ANATOMICAL_PARTS,
    MEDIUM_PRIMITIVE_RECIPES,
    get,
    list,
    anatomicalPart,
    resolveItemForPart,
    isDraconic,
    lineageValueMultiplier,
    baseValueForPartSize,
    priceForSizeAndQuality,
    createAnatomyProfile,
    maxCountForPart,
    clampYieldToAnatomy,
    createHarvestPart,
    sizeAtLeast,
    canDownsizePart,
    canMergePartsForLargerSize,
    canSatisfyRequirement,
    partsSatisfyRequirement,
    recipeSatisfied,
    harvestCondition,
  });

  global.LuminousHardPartsCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
