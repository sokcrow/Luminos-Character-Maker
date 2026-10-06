(function (global) {
  "use strict";

  const existingContract = global.LuminousUnitLootProfileContract;
  if (existingContract?.VERSION === 1 && typeof existingContract.validateUnit === "function") {
    if (typeof module !== "undefined" && module.exports) module.exports = existingContract;
    return;
  }

  const VERSION = 1;

  const BODY_KINDS = Object.freeze([
    "organic",
    "construct",
    "mineral",
    "plant",
    "ooze",
    "synthetic",
    "ethereal",
    "mixed",
  ]);

  const BODY_SIZE_CLASSES = Object.freeze(["tiny", "small", "medium", "large", "huge", "gargantuan"]);

  const BODY_MATERIALS = Object.freeze([
    "flesh",
    "blood",
    "bone",
    "hide",
    "pelt",
    "scale",
    "chitin",
    "shell",
    "feather",
    "fiber",
    "metal",
    "mechanical",
    "stone",
    "mineral",
    "wood",
    "plant",
    "ooze",
    "gel",
    "crystal",
    "synthetic",
    "ethereal",
  ]);

  const RARITIES = Object.freeze([
    "impossible",
    "very_rare",
    "rare",
    "uncommon",
    "common",
    "likely",
    "guaranteed",
  ]);

  const CARRIED_CATEGORIES = Object.freeze([
    "currency",
    "food",
    "medicine",
    "consumable",
    "tool",
    "valuable",
    "document",
    "personal_item",
    "ammunition",
    "material",
    "technology",
    "luxury",
  ]);

  const RESOURCE_MATERIAL_COMPATIBILITY = Object.freeze({
    meat: Object.freeze(["flesh"]),
    hide_pelt: Object.freeze(["hide", "pelt", "scale", "chitin", "shell"]),
    hard_parts: Object.freeze(["bone", "scale", "chitin", "shell", "crystal", "metal", "mechanical", "stone", "mineral", "synthetic"]),
    hard_cover_modular: Object.freeze(["metal", "mechanical", "stone", "mineral", "crystal", "synthetic"]),
    hard_cover_structural: Object.freeze(["metal", "mechanical", "stone", "mineral", "wood", "crystal", "synthetic"]),
    feather_raw: Object.freeze(["feather"]),
    raw_fiber: Object.freeze(["fiber", "plant", "wood"]),
    organ_internal: Object.freeze(["flesh", "synthetic"]),
    organ_sensory: Object.freeze(["flesh", "synthetic"]),
    organ_brain: Object.freeze(["flesh", "synthetic"]),
    organ_gland: Object.freeze(["flesh", "synthetic"]),
    blood_ichor: Object.freeze(["blood", "ooze", "gel", "synthetic"]),
    venom_secretion: Object.freeze(["flesh", "synthetic"]),
    ooze_gel: Object.freeze(["ooze", "gel"]),
  });

  const BODY_KIND_DEFAULT_ALLOWED = Object.freeze({
    organic: Object.freeze(["meat", "hide_pelt", "hard_parts", "feather_raw", "raw_fiber", "organ_internal", "organ_sensory", "organ_brain", "organ_gland", "blood_ichor", "venom_secretion"]),
    construct: Object.freeze(["hard_parts", "hard_cover_modular", "hard_cover_structural", "raw_fiber"]),
    mineral: Object.freeze(["hard_parts", "hard_cover_modular", "hard_cover_structural"]),
    plant: Object.freeze(["raw_fiber", "hard_cover_structural"]),
    ooze: Object.freeze(["blood_ichor", "ooze_gel"]),
    synthetic: Object.freeze(["hard_parts", "hard_cover_modular", "hard_cover_structural", "organ_internal", "organ_sensory", "organ_brain", "organ_gland", "blood_ichor", "venom_secretion"]),
    ethereal: Object.freeze([]),
    mixed: Object.freeze(Object.keys(RESOURCE_MATERIAL_COMPATIBILITY)),
  });

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function uniqueIds(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean)));
  }

  function nonNegativeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  }

  function normalizeYield(raw = {}) {
    const min = nonNegativeNumber(raw.min ?? raw.minimum, 0);
    const max = Math.max(min, nonNegativeNumber(raw.max ?? raw.maximum, min));
    return Object.freeze({ min, max });
  }

  function knownIntegrityFamilies(harvestEngine = global.LuminousItemHarvestIntegrityEngine) {
    const fromEngine = harvestEngine?.RESOURCE_PROFILES;
    return new Set(fromEngine && typeof fromEngine === "object"
      ? Object.keys(fromEngine).map(normalizeId)
      : Object.keys(RESOURCE_MATERIAL_COMPATIBILITY));
  }

  function resourceCompatibility(resource = {}, materials = []) {
    const family = normalizeId(resource.integrityFamily ?? resource.family);
    const sourceMaterial = normalizeId(resource.sourceMaterial ?? resource.material);
    const bodyMaterials = new Set(uniqueIds(materials));
    const compatible = RESOURCE_MATERIAL_COMPATIBILITY[family] || [];
    if (sourceMaterial) {
      return bodyMaterials.has(sourceMaterial) && compatible.includes(sourceMaterial);
    }
    return compatible.some((material) => bodyMaterials.has(material));
  }

  function validateBodyProfile(profile = {}, options = {}) {
    const errors = [];
    const warnings = [];
    const kind = normalizeId(profile.kind ?? profile.bodyKind);
    const materials = uniqueIds(profile.materials);
    const sizeClass = normalizeId(profile.sizeClass ?? profile.bodySize ?? profile.size);
    const harvestEngine = options.harvestEngine ?? global.LuminousItemHarvestIntegrityEngine;
    const families = knownIntegrityFamilies(harvestEngine);

    if (!BODY_KINDS.includes(kind)) errors.push(`UNKNOWN_BODY_KIND:${kind || "missing"}`);
    if (sizeClass && !BODY_SIZE_CLASSES.includes(sizeClass)) errors.push(`UNKNOWN_BODY_SIZE_CLASS:${sizeClass}`);
    if (!materials.length && kind !== "ethereal") errors.push("BODY_MATERIALS_REQUIRED");
    for (const material of materials) {
      if (!BODY_MATERIALS.includes(material)) errors.push(`UNKNOWN_BODY_MATERIAL:${material}`);
    }

    const resources = Array.isArray(profile.resources) ? profile.resources : [];
    for (const [index, resource] of resources.entries()) {
      const family = normalizeId(resource?.integrityFamily ?? resource?.family);
      if (!family) {
        errors.push(`BODY_RESOURCE_FAMILY_REQUIRED:${index}`);
        continue;
      }
      if (!families.has(family)) errors.push(`UNKNOWN_HARVEST_INTEGRITY_FAMILY:${family}`);
      if (!resourceCompatibility(resource, materials)) {
        errors.push(`BODY_RESOURCE_MATERIAL_INCOMPATIBLE:${family}:${normalizeId(resource?.sourceMaterial ?? resource?.material) || "unspecified"}`);
      }
      const kindAllowed = BODY_KIND_DEFAULT_ALLOWED[kind] || [];
      if (!kindAllowed.includes(family)) errors.push(`BODY_RESOURCE_KIND_INCOMPATIBLE:${kind}:${family}`);
      const yieldRange = normalizeYield(resource?.yield || resource || {});
      if (yieldRange.max < yieldRange.min) errors.push(`BODY_RESOURCE_YIELD_INVALID:${family}`);
    }

    if (kind === "ethereal" && resources.length) errors.push("ETHEREAL_BODY_CANNOT_DECLARE_PHYSICAL_RESOURCES");

    const edible = profile.edible === true;
    if (edible && !materials.includes("flesh") && !materials.includes("plant") && !materials.includes("ooze") && !materials.includes("gel")) {
      errors.push("EDIBLE_BODY_REQUIRES_EDIBLE_MATERIAL");
    }

    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), warnings: Object.freeze(warnings) });
  }

  function normalizeBodyProfile(profile = {}) {
    const normalized = {
      version: VERSION,
      kind: normalizeId(profile.kind ?? profile.bodyKind),
      sizeClass: normalizeId(profile.sizeClass ?? profile.bodySize ?? profile.size),
      materials: uniqueIds(profile.materials),
      edible: profile.edible === true,
      resources: (Array.isArray(profile.resources) ? profile.resources : []).map((resource) => ({
        id: normalizeId(resource.id ?? resource.resourceId ?? resource.integrityFamily ?? resource.family),
        integrityFamily: normalizeId(resource.integrityFamily ?? resource.family),
        sourceMaterial: normalizeId(resource.sourceMaterial ?? resource.material),
        yield: resource.yield != null || resource.min != null || resource.max != null
          ? normalizeYield(resource.yield || resource)
          : null,
        ...(resource.notes ? { notes: String(resource.notes) } : {}),
      })),
      ...(profile.notes ? { notes: String(profile.notes) } : {}),
    };
    return Object.freeze(normalized);
  }

  function validateLootProfile(profile = {}) {
    const errors = [];
    const carried = Array.isArray(profile.carried) ? profile.carried : [];
    const impossibleCategories = uniqueIds(profile.impossibleCategories);

    for (const [index, entry] of carried.entries()) {
      const category = normalizeId(entry?.category);
      const rarity = normalizeId(entry?.rarity ?? "common");
      const chance = entry?.chance == null ? null : Number(entry.chance);
      const min = entry?.min == null ? (entry?.quantity == null ? 1 : Number(entry.quantity)) : Number(entry.min);
      const max = entry?.max == null ? (entry?.quantity == null ? min : Number(entry.quantity)) : Number(entry.max);
      if (!CARRIED_CATEGORIES.includes(category)) errors.push(`UNKNOWN_CARRIED_CATEGORY:${index}:${category || "missing"}`);
      if (!RARITIES.includes(rarity)) errors.push(`UNKNOWN_LOOT_RARITY:${index}:${rarity || "missing"}`);
      if (chance != null && (!Number.isFinite(chance) || chance < 0 || chance > 1)) errors.push(`LOOT_CHANCE_OUT_OF_RANGE:${index}`);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) errors.push(`LOOT_QUANTITY_RANGE_INVALID:${index}`);
      if (rarity === "impossible" && !impossibleCategories.includes(category)) {
        errors.push(`IMPOSSIBLE_CARRIED_CATEGORY_NOT_DECLARED:${category}`);
      }
      if (impossibleCategories.includes(category) && rarity !== "impossible") {
        errors.push(`IMPOSSIBLE_CATEGORY_HAS_NONZERO_ENTRY:${category}`);
      }
    }

    for (const category of impossibleCategories) {
      if (!CARRIED_CATEGORIES.includes(category)) errors.push(`UNKNOWN_IMPOSSIBLE_CATEGORY:${category}`);
    }

    const currency = profile.currency;
    if (currency != null) {
      const min = nonNegativeNumber(currency.min, 0);
      const max = nonNegativeNumber(currency.max, min);
      if (max < min) errors.push("LOOT_CURRENCY_RANGE_INVALID");
      if (!normalizeId(currency.currencyId ?? currency.id)) errors.push("LOOT_CURRENCY_ID_REQUIRED");
    }

    const equipment = profile.equipment || {};
    const equipmentSource = normalizeId(equipment.source ?? "unit_loadout");
    if (!["unit_loadout", "none", "authored"].includes(equipmentSource)) {
      errors.push(`UNKNOWN_EQUIPMENT_SOURCE:${equipmentSource}`);
    }

    const harvest = profile.harvest || {};
    const harvestSource = normalizeId(harvest.source ?? "body_profile");
    if (!["body_profile", "none", "authored"].includes(harvestSource)) {
      errors.push(`UNKNOWN_HARVEST_SOURCE:${harvestSource}`);
    }

    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function normalizeLootProfile(profile = {}) {
    return Object.freeze({
      version: VERSION,
      carried: Object.freeze((Array.isArray(profile.carried) ? profile.carried : []).map((entry) => {
        const min = Math.max(0, Number(entry.min ?? entry.quantity ?? 1) || 0);
        const max = Math.max(min, Number(entry.max ?? entry.quantity ?? min) || min);
        const chance = entry.chance == null ? null : Math.max(0, Math.min(1, Number(entry.chance) || 0));
        return Object.freeze({
          itemId: normalizeId(entry.itemId ?? entry.definitionId ?? entry.id),
          category: normalizeId(entry.category),
          rarity: normalizeId(entry.rarity ?? "common"),
          min,
          max,
          chance,
          ...(entry.ammoId ? { ammoId: normalizeId(entry.ammoId) } : {}),
          ...(entry.reconcilePostCombatAmmo === true ? { reconcilePostCombatAmmo: true } : {}),
          ...(entry.tags ? { tags: Object.freeze(uniqueIds(entry.tags)) } : {}),
        });
      })),
      equipment: Object.freeze({
        source: normalizeId(profile.equipment?.source ?? "unit_loadout"),
      }),
      currency: profile.currency == null ? null : Object.freeze({
        currencyId: normalizeId(profile.currency.currencyId ?? profile.currency.id),
        min: nonNegativeNumber(profile.currency.min, 0),
        max: Math.max(nonNegativeNumber(profile.currency.min, 0), nonNegativeNumber(profile.currency.max, profile.currency.min ?? 0)),
        zeroAllowed: profile.currency.zeroAllowed !== false,
      }),
      harvest: Object.freeze({
        source: normalizeId(profile.harvest?.source ?? "body_profile"),
      }),
      impossibleCategories: Object.freeze(uniqueIds(profile.impossibleCategories)),
      ...(profile.notes ? { notes: String(profile.notes) } : {}),
    });
  }

  function createProfiles({ bodyProfile = {}, lootProfile = {} } = {}, options = {}) {
    const body = normalizeBodyProfile(bodyProfile);
    const loot = normalizeLootProfile(lootProfile);
    const bodyValidation = validateBodyProfile(body, options);
    const lootValidation = validateLootProfile(loot);
    const errors = [...bodyValidation.errors, ...lootValidation.errors];
    if (errors.length) throw new Error(`INVALID_UNIT_LOOT_PROFILE:${errors.join("|")}`);
    return Object.freeze({ bodyProfile: body, lootProfile: loot });
  }

  function validateUnit(unit = {}, options = {}) {
    const bodyValidation = validateBodyProfile(unit.bodyProfile || {}, options);
    const lootValidation = validateLootProfile(unit.lootProfile || {});
    const errors = [...bodyValidation.errors, ...lootValidation.errors];
    return Object.freeze({
      valid: errors.length === 0,
      unitId: normalizeId(unit.id),
      errors: Object.freeze(errors),
      body: bodyValidation,
      loot: lootValidation,
    });
  }

  const API = Object.freeze({
    VERSION,
    BODY_KINDS,
    BODY_SIZE_CLASSES,
    BODY_MATERIALS,
    RARITIES,
    CARRIED_CATEGORIES,
    RESOURCE_MATERIAL_COMPATIBILITY,
    BODY_KIND_DEFAULT_ALLOWED,
    normalizeId,
    normalizeYield,
    knownIntegrityFamilies,
    resourceCompatibility,
    validateBodyProfile,
    normalizeBodyProfile,
    validateLootProfile,
    normalizeLootProfile,
    createProfiles,
    validateUnit,
    clone,
  });

  global.LuminousUnitLootProfileContract = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
