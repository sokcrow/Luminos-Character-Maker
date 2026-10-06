(function (global) {
  "use strict";

  if (global.LuminousLootSocialProfileContract) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootSocialProfileContract;
    return;
  }

  const VERSION = 1;

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const economy = () => global.LuminousItemEconomyStandard || safeRequire("./item-economy-standard.js");
  const creatureTypes = () => global.LuminousCreatureTypeCatalog || safeRequire("./creature-type-catalog.js");

  const ROLE_IDS = Object.freeze([
    "civilian",
    "worker",
    "miner",
    "cook",
    "merchant",
    "doctor",
    "medic",
    "soldier",
    "security",
    "fixer",
    "executive",
    "researcher",
    "hunter",
    "scavenger",
    "cultist",
    "smuggler",
    "commander",
  ]);

  const ROLE_PROFILES = Object.freeze({
    civilian: Object.freeze({
      id: "civilian",
      carriedCategoryWeights: Object.freeze({ food: 1.1, personal_item: 1.4, currency: 1.0, medicine: 0.6, document: 0.8 }),
      guaranteedEquipmentTags: Object.freeze([]),
    }),
    worker: Object.freeze({
      id: "worker",
      carriedCategoryWeights: Object.freeze({ food: 1.2, tool: 1.5, personal_item: 1.0, material: 1.1, currency: 0.8 }),
      guaranteedEquipmentTags: Object.freeze(["work_tool"]),
    }),
    miner: Object.freeze({
      id: "miner",
      carriedCategoryWeights: Object.freeze({ tool: 1.8, material: 1.5, food: 1.1, medicine: 0.6, currency: 0.7 }),
      guaranteedEquipmentTags: Object.freeze(["mining_tool"]),
    }),
    cook: Object.freeze({
      id: "cook",
      carriedCategoryWeights: Object.freeze({ food: 1.8, tool: 1.4, consumable: 1.1, personal_item: 0.9 }),
      guaranteedEquipmentTags: Object.freeze(["cooking_tool"]),
    }),
    merchant: Object.freeze({
      id: "merchant",
      carriedCategoryWeights: Object.freeze({ currency: 1.5, valuable: 1.4, document: 1.4, consumable: 1.2, material: 1.1 }),
      guaranteedEquipmentTags: Object.freeze(["trade_goods"]),
    }),
    doctor: Object.freeze({
      id: "doctor",
      carriedCategoryWeights: Object.freeze({ medicine: 2.0, tool: 1.6, document: 1.2, technology: 1.1, currency: 0.8 }),
      guaranteedEquipmentTags: Object.freeze(["medical_tool"]),
    }),
    medic: Object.freeze({
      id: "medic",
      carriedCategoryWeights: Object.freeze({ medicine: 2.0, consumable: 1.5, tool: 1.3, food: 0.7 }),
      guaranteedEquipmentTags: Object.freeze(["medical_kit"]),
    }),
    soldier: Object.freeze({
      id: "soldier",
      carriedCategoryWeights: Object.freeze({ ammunition: 1.8, medicine: 1.1, food: 1.0, tool: 0.8, currency: 0.5 }),
      guaranteedEquipmentTags: Object.freeze(["weapon_loadout"]),
    }),
    security: Object.freeze({
      id: "security",
      carriedCategoryWeights: Object.freeze({ ammunition: 1.6, technology: 1.2, medicine: 1.0, document: 0.7, currency: 0.5 }),
      guaranteedEquipmentTags: Object.freeze(["weapon_loadout", "security_gear"]),
    }),
    fixer: Object.freeze({
      id: "fixer",
      carriedCategoryWeights: Object.freeze({ ammunition: 1.3, medicine: 1.2, tool: 1.2, technology: 1.1, currency: 0.9 }),
      guaranteedEquipmentTags: Object.freeze(["combat_loadout"]),
    }),
    executive: Object.freeze({
      id: "executive",
      carriedCategoryWeights: Object.freeze({ valuable: 1.8, technology: 1.6, document: 1.4, luxury: 1.8, currency: 1.2 }),
      guaranteedEquipmentTags: Object.freeze(["executive_device"]),
    }),
    researcher: Object.freeze({
      id: "researcher",
      carriedCategoryWeights: Object.freeze({ technology: 1.8, document: 1.7, tool: 1.4, medicine: 0.8, material: 1.0 }),
      guaranteedEquipmentTags: Object.freeze(["research_tool"]),
    }),
    hunter: Object.freeze({
      id: "hunter",
      carriedCategoryWeights: Object.freeze({ ammunition: 1.6, food: 1.2, tool: 1.3, material: 1.0, medicine: 0.7 }),
      guaranteedEquipmentTags: Object.freeze(["hunting_loadout"]),
    }),
    scavenger: Object.freeze({
      id: "scavenger",
      carriedCategoryWeights: Object.freeze({ material: 2.0, tool: 1.4, food: 0.8, valuable: 1.1, currency: 0.3, technology: 0.8 }),
      guaranteedEquipmentTags: Object.freeze(["salvage_tool"]),
      valuableLowCashAllowed: true,
    }),
    cultist: Object.freeze({
      id: "cultist",
      carriedCategoryWeights: Object.freeze({ personal_item: 1.5, document: 1.3, tool: 0.8, medicine: 0.6, currency: 0.4 }),
      guaranteedEquipmentTags: Object.freeze([]),
    }),
    smuggler: Object.freeze({
      id: "smuggler",
      carriedCategoryWeights: Object.freeze({ valuable: 1.6, consumable: 1.4, material: 1.3, technology: 1.2, currency: 1.0, document: 0.6 }),
      guaranteedEquipmentTags: Object.freeze(["concealment_container"]),
    }),
    commander: Object.freeze({
      id: "commander",
      carriedCategoryWeights: Object.freeze({ document: 1.4, technology: 1.2, medicine: 1.0, currency: 0.8, valuable: 1.0 }),
      guaranteedEquipmentTags: Object.freeze(["command_loadout"]),
    }),
  });

  const WEALTH_BIASES = Object.freeze({
    backstreets_extreme_poverty: Object.freeze({ valueMultiplier: 0.30, qualityBias: -2, currencyWeight: 0.25, luxuryWeight: 0.00, technologyWeight: 0.35, reusedChance: 0.90 }),
    backstreets_very_poor: Object.freeze({ valueMultiplier: 0.45, qualityBias: -2, currencyWeight: 0.40, luxuryWeight: 0.05, technologyWeight: 0.45, reusedChance: 0.75 }),
    backstreets_low: Object.freeze({ valueMultiplier: 0.65, qualityBias: -1, currencyWeight: 0.60, luxuryWeight: 0.10, technologyWeight: 0.60, reusedChance: 0.55 }),
    backstreets_stable_low: Object.freeze({ valueMultiplier: 0.85, qualityBias: -1, currencyWeight: 0.80, luxuryWeight: 0.20, technologyWeight: 0.75, reusedChance: 0.35 }),
    backstreets_middle: Object.freeze({ valueMultiplier: 1.00, qualityBias: 0, currencyWeight: 1.00, luxuryWeight: 0.40, technologyWeight: 0.90, reusedChance: 0.20 }),
    backstreets_high: Object.freeze({ valueMultiplier: 1.25, qualityBias: 0, currencyWeight: 1.15, luxuryWeight: 0.70, technologyWeight: 1.05, reusedChance: 0.12 }),
    nest_low: Object.freeze({ valueMultiplier: 1.35, qualityBias: 0, currencyWeight: 1.10, luxuryWeight: 0.65, technologyWeight: 1.15, reusedChance: 0.10 }),
    nest_middle: Object.freeze({ valueMultiplier: 1.65, qualityBias: 1, currencyWeight: 1.25, luxuryWeight: 0.90, technologyWeight: 1.30, reusedChance: 0.06 }),
    nest_upper_middle: Object.freeze({ valueMultiplier: 2.00, qualityBias: 1, currencyWeight: 1.35, luxuryWeight: 1.15, technologyWeight: 1.45, reusedChance: 0.04 }),
    nest_high: Object.freeze({ valueMultiplier: 2.60, qualityBias: 2, currencyWeight: 1.50, luxuryWeight: 1.50, technologyWeight: 1.70, reusedChance: 0.02 }),
    nest_very_rich: Object.freeze({ valueMultiplier: 3.50, qualityBias: 2, currencyWeight: 1.70, luxuryWeight: 2.00, technologyWeight: 2.00, reusedChance: 0.01 }),
    city_elite: Object.freeze({ valueMultiplier: 5.00, qualityBias: 3, currencyWeight: 2.00, luxuryWeight: 2.50, technologyWeight: 2.50, reusedChance: 0.00 }),
  });

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function uniqueIds(values) {
    const source = Array.isArray(values) ? values : values == null ? [] : [values];
    return [...new Set(source.map(normalizeId).filter(Boolean))];
  }
  function canonicalSalaryBandIds() {
    return Object.freeze((economy()?.SALARY_BANDS || []).map((band) => normalizeId(band.id)));
  }
  function salaryBand(bandId) {
    const id = normalizeId(bandId);
    return economy()?.salaryBand?.(id) || economy()?.SALARY_BANDS?.find?.((band) => normalizeId(band.id) === id) || null;
  }
  function isHumanoidEligible(unit = {}) {
    const catalog = creatureTypes();
    try {
      const profile = catalog?.profileForUnit?.(unit, { required: false });
      if (profile) return normalizeId(profile.creatureType) === "humanoid";
    } catch (_) {}
    return normalizeId(unit.creatureType ?? unit.metadata?.creatureType) === "humanoid";
  }

  function normalizeWealthProfile(profile = {}) {
    const bandId = normalizeId(profile.bandId ?? profile.wealthBandId ?? profile.id);
    const band = salaryBand(bandId);
    return Object.freeze({
      bandId,
      economicScope: normalizeId(band?.scope),
      monthlyIncomeRangeAhn: band ? Object.freeze({ min: Number(band.minAhn || 0), max: band.maxAhn == null ? null : Number(band.maxAhn) }) : null,
      lootBias: Object.freeze(clone(WEALTH_BIASES[bandId] || {})),
      source: normalizeId(profile.source || "authored"),
      carriedCashSeparate: true,
    });
  }

  function validateWealthProfile(profile = {}) {
    const errors = [];
    const bandId = normalizeId(profile.bandId ?? profile.wealthBandId ?? profile.id);
    if (!bandId) errors.push("WEALTH_BAND_REQUIRED");
    if (bandId && !salaryBand(bandId)) errors.push(`UNKNOWN_WEALTH_BAND:${bandId}`);
    if (bandId && !WEALTH_BIASES[bandId]) errors.push(`WEALTH_BIAS_MISSING:${bandId}`);
    if (Object.prototype.hasOwnProperty.call(profile, "cash") || Object.prototype.hasOwnProperty.call(profile, "carriedCash") || Object.prototype.hasOwnProperty.call(profile, "currencyAmount")) {
      errors.push("WEALTH_PROFILE_MUST_NOT_STORE_CARRIED_CASH");
    }
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function normalizeRoleProfile(profile = {}) {
    const roles = uniqueIds(profile.roles ?? profile.roleIds ?? profile.role);
    return Object.freeze({
      roles: Object.freeze(roles),
      source: normalizeId(profile.source || "authored"),
    });
  }

  function validateRoleProfile(profile = {}) {
    const errors = [];
    const roles = uniqueIds(profile.roles ?? profile.roleIds ?? profile.role);
    if (!roles.length) errors.push("LOOT_ROLE_REQUIRED");
    for (const roleId of roles) {
      if (!ROLE_PROFILES[roleId]) errors.push(`UNKNOWN_LOOT_ROLE:${roleId}`);
    }
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function roleProfile(roleId) {
    const id = normalizeId(roleId);
    return ROLE_PROFILES[id] ? Object.freeze(clone(ROLE_PROFILES[id])) : null;
  }

  function mergeRoleModifiers(roleIds = []) {
    const roles = uniqueIds(roleIds);
    const categoryWeights = {};
    const guaranteedEquipmentTags = new Set();
    let valuableLowCashAllowed = false;
    for (const roleId of roles) {
      const profile = ROLE_PROFILES[roleId];
      if (!profile) continue;
      for (const [category, weight] of Object.entries(profile.carriedCategoryWeights || {})) {
        categoryWeights[category] = (categoryWeights[category] ?? 1) * Number(weight || 0);
      }
      for (const tag of profile.guaranteedEquipmentTags || []) guaranteedEquipmentTags.add(normalizeId(tag));
      if (profile.valuableLowCashAllowed === true) valuableLowCashAllowed = true;
    }
    return Object.freeze({
      roles: Object.freeze(roles),
      carriedCategoryWeights: Object.freeze(categoryWeights),
      guaranteedEquipmentTags: Object.freeze([...guaranteedEquipmentTags]),
      valuableLowCashAllowed,
    });
  }

  function wealthCategoryWeights(wealthProfile = {}) {
    const normalized = normalizeWealthProfile(wealthProfile);
    const bias = normalized.lootBias || {};
    return Object.freeze({
      currency: Number(bias.currencyWeight ?? 1),
      luxury: Number(bias.luxuryWeight ?? 1),
      technology: Number(bias.technologyWeight ?? 1),
    });
  }

  function resolveSocialLootModifiers(unit = {}, options = {}) {
    const wealthProfile = normalizeWealthProfile(options.wealthProfile || unit.wealthProfile || {});
    const role = normalizeRoleProfile(options.roleProfile || unit.roleProfile || {});
    const wealthValidation = validateWealthProfile(options.wealthProfile || unit.wealthProfile || {});
    const roleValidation = validateRoleProfile(options.roleProfile || unit.roleProfile || {});
    const errors = [...wealthValidation.errors, ...roleValidation.errors];
    if (errors.length) return Object.freeze({ valid: false, errors: Object.freeze(errors) });

    const roles = mergeRoleModifiers(role.roles);
    const categoryWeights = { ...roles.carriedCategoryWeights };
    for (const [category, weight] of Object.entries(wealthCategoryWeights(wealthProfile))) {
      categoryWeights[category] = (categoryWeights[category] ?? 1) * weight;
    }

    return Object.freeze({
      valid: true,
      errors: Object.freeze([]),
      wealthProfile,
      roleProfile: role,
      monthlyIncomeReferenceAhn: wealthProfile.monthlyIncomeRangeAhn,
      carriedCash: null,
      carriedCashGeneratedSeparately: true,
      itemValueMultiplier: Number(wealthProfile.lootBias?.valueMultiplier ?? 1),
      qualityBias: Number(wealthProfile.lootBias?.qualityBias ?? 0),
      reusedChance: Number(wealthProfile.lootBias?.reusedChance ?? 0),
      carriedCategoryWeights: Object.freeze(categoryWeights),
      guaranteedEquipmentTags: roles.guaranteedEquipmentTags,
      valuableLowCashAllowed: roles.valuableLowCashAllowed,
    });
  }

  function validateUnitSocialProfile(unit = {}, options = {}) {
    const errors = [];
    const eligible = options.requireForHumanoid !== false && isHumanoidEligible(unit);
    if (eligible && !unit.wealthProfile) errors.push("HUMANOID_WEALTH_PROFILE_REQUIRED");
    if (eligible && !unit.roleProfile) errors.push("HUMANOID_ROLE_PROFILE_REQUIRED");
    if (unit.wealthProfile) errors.push(...validateWealthProfile(unit.wealthProfile).errors);
    if (unit.roleProfile) errors.push(...validateRoleProfile(unit.roleProfile).errors);
    return Object.freeze({
      valid: errors.length === 0,
      eligibleForWealth: eligible,
      unitId: normalizeId(unit.id),
      errors: Object.freeze(errors),
    });
  }

  const API = Object.freeze({
    VERSION,
    ROLE_IDS,
    ROLE_PROFILES,
    WEALTH_BIASES,
    normalizeId,
    uniqueIds,
    canonicalSalaryBandIds,
    salaryBand,
    isHumanoidEligible,
    normalizeWealthProfile,
    validateWealthProfile,
    normalizeRoleProfile,
    validateRoleProfile,
    roleProfile,
    mergeRoleModifiers,
    wealthCategoryWeights,
    resolveSocialLootModifiers,
    validateUnitSocialProfile,
  });

  global.LuminousLootSocialProfileContract = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
