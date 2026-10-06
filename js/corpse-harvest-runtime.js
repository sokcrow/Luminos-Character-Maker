(function (global) {
  "use strict";

  if (global.LuminousCorpseHarvestRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCorpseHarvestRuntime;
    return;
  }

  const VERSION = 1;

  const SIZE_SCALE = Object.freeze({
    tiny: 0.25,
    small: 0.6,
    medium: 1,
    large: 2,
    huge: 4,
    gargantuan: 8,
  });

  const SPECIES_SIZE_DEFAULTS = Object.freeze({
    kobold: "small",
    goblin: "small",
    wolf: "medium",
    dire_wolf: "large",
  });

  const RESOURCE_BASE_YIELDS = Object.freeze({
    meat: Object.freeze({ min: 2, max: 4 }),
    hide_pelt: Object.freeze({ min: 1, max: 1 }),
    hard_parts: Object.freeze({ min: 1, max: 3 }),
    hard_cover_modular: Object.freeze({ min: 1, max: 4 }),
    hard_cover_structural: Object.freeze({ min: 1, max: 3 }),
    feather_raw: Object.freeze({ min: 1, max: 3 }),
    raw_fiber: Object.freeze({ min: 1, max: 3 }),
    organ_internal: Object.freeze({ min: 1, max: 2 }),
    organ_sensory: Object.freeze({ min: 1, max: 2 }),
    organ_brain: Object.freeze({ min: 1, max: 1 }),
    organ_gland: Object.freeze({ min: 0, max: 1 }),
    blood_ichor: Object.freeze({ min: 1, max: 3 }),
    venom_secretion: Object.freeze({ min: 0, max: 1 }),
    ooze_gel: Object.freeze({ min: 2, max: 4 }),
  });

  const CONTAMINATION_CHANNELS = Object.freeze(new Set([
    "contamination",
    "toxin",
    "necrotic",
    "mana_corruption",
  ]));

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function numberOr(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, numberOr(value, min))); }

  function sizeClassFor(unit = {}) {
    const explicit = normalizeId(unit.bodyProfile?.sizeClass ?? unit.bodySizeClass ?? unit.sizeClass);
    if (SIZE_SCALE[explicit]) return explicit;
    const rawSize = normalizeId(unit.size);
    if (SIZE_SCALE[rawSize]) return rawSize;
    const species = normalizeId(unit.species ?? unit.family ?? unit.id);
    return SPECIES_SIZE_DEFAULTS[species] || "medium";
  }

  function scaleYieldRange(range = {}, sizeClass = "medium") {
    const scale = SIZE_SCALE[normalizeId(sizeClass)] || 1;
    const rawMin = Math.max(0, numberOr(range.min, 0));
    const rawMax = Math.max(rawMin, numberOr(range.max, rawMin));
    const min = rawMin <= 0 ? 0 : Math.max(1, Math.floor(rawMin * scale));
    const max = rawMax <= 0 ? 0 : Math.max(min, Math.ceil(rawMax * scale));
    return Object.freeze({ min, max });
  }

  function baseYieldRange(unit = {}, resource = {}) {
    if (resource.yield && Number.isFinite(Number(resource.yield.min)) && Number.isFinite(Number(resource.yield.max))) {
      return Object.freeze({
        min: Math.max(0, numberOr(resource.yield.min, 0)),
        max: Math.max(numberOr(resource.yield.min, 0), numberOr(resource.yield.max, 0)),
        source: "profile_override",
      });
    }
    const family = normalizeId(resource.integrityFamily ?? resource.family);
    const base = RESOURCE_BASE_YIELDS[family] || { min: 0, max: 0 };
    const scaled = scaleYieldRange(base, sizeClassFor(unit));
    return Object.freeze({ ...scaled, source: "size_scaled_default" });
  }

  function maxHpFor(unit = {}, options = {}) {
    const values = [
      options.maxHp,
      unit.maxHp,
      unit.max_hp,
      unit.hpMax,
      unit.mechanics?.maxHp,
      unit.mechanics?.max_hp,
      unit.mechanics?.hp,
      unit.hpBase,
      unit.mechanics?.hpBase,
    ].map(Number).filter(Number.isFinite);
    const positive = values.find((value) => value > 0);
    return positive || 1;
  }

  function exposureTotal(condition = {}) {
    return Object.values(condition.exposures || {}).reduce((sum, value) => sum + Math.max(0, numberOr(value, 0)), 0);
  }

  function contaminationTotal(condition = {}) {
    return Object.entries(condition.exposures || {}).reduce((sum, [channel, value]) => {
      return sum + (CONTAMINATION_CHANNELS.has(normalizeId(channel)) ? Math.max(0, numberOr(value, 0)) : 0);
    }, 0);
  }

  function physicalDamage(condition = {}, primaryOnly = null) {
    return Object.values(condition.physical || {}).reduce((sum, entry) => {
      if (primaryOnly === true && entry?.primary !== true) return sum;
      if (primaryOnly === false && entry?.primary === true) return sum;
      return sum + Math.max(0, numberOr(entry?.damage, 0));
    }, 0);
  }

  function integrityForResource(unit = {}, resource = {}, damageRecord = null, options = {}) {
    const harvest = options.harvestEngine || global.LuminousItemHarvestIntegrityEngine;
    const family = normalizeId(resource.integrityFamily ?? resource.family);
    const condition = harvest?.harvestCondition?.(damageRecord, family);
    if (!condition) {
      return Object.freeze({
        family,
        integrityPercent: 100,
        status: "intact",
        contaminated: false,
        destroyed: false,
        condition: null,
        penalty: 0,
      });
    }

    const maxHp = maxHpFor(unit, options);
    const primary = physicalDamage(condition, true);
    const secondary = physicalDamage(condition, false);
    const direct = condition.directHitSensitive ? Math.max(0, numberOr(condition.totalDirectDamage, 0)) : 0;
    const exposures = exposureTotal(condition);

    const weightedDamage = primary + secondary * 0.5 + direct * 0.25 + exposures * 0.75;
    const penalty = clamp((weightedDamage / maxHp) * 100, 0, 100);
    const integrityPercent = Math.max(0, Math.round(100 - penalty));
    const contaminated = contaminationTotal(condition) > 0;
    const destroyed = integrityPercent <= 10;

    let status = "intact";
    if (destroyed) status = "destroyed";
    else if (contaminated) status = "contaminated";
    else if (integrityPercent < 80 || primary > 0 || secondary > 0) status = "damaged";

    return Object.freeze({
      family,
      integrityPercent,
      status,
      contaminated,
      destroyed,
      penalty,
      maxHp,
      primaryDamage: primary,
      secondaryDamage: secondary,
      directDamage: direct,
      exposure: exposures,
      condition,
    });
  }

  function recoverableYield(base = {}, integrity = {}) {
    if (integrity.destroyed) return Object.freeze({ min: 0, max: 0, quantityMultiplier: 0, qualityMultiplier: 0 });
    const quantityMultiplier = clamp(integrity.integrityPercent / 100, 0, 1);
    const contaminationPenalty = integrity.contaminated ? 0.5 : 1;
    const qualityMultiplier = clamp(quantityMultiplier * contaminationPenalty, 0, 1);
    const baseMin = Math.max(0, numberOr(base.min, 0));
    const baseMax = Math.max(baseMin, numberOr(base.max, baseMin));
    const min = baseMin <= 0 ? 0 : Math.floor(baseMin * quantityMultiplier);
    const rawMax = Math.floor(baseMax * quantityMultiplier);
    const max = quantityMultiplier > 0 && baseMax > 0 ? Math.max(min, Math.max(1, rawMax)) : 0;
    return Object.freeze({ min, max, quantityMultiplier, qualityMultiplier });
  }

  function resolveResource(unit = {}, resource = {}, damageRecord = null, options = {}) {
    const baseYield = baseYieldRange(unit, resource);
    const integrity = integrityForResource(unit, resource, damageRecord, options);
    const recoverable = recoverableYield(baseYield, integrity);
    return Object.freeze({
      id: normalizeId(resource.id ?? resource.integrityFamily ?? resource.family),
      integrityFamily: normalizeId(resource.integrityFamily ?? resource.family),
      sourceMaterial: normalizeId(resource.sourceMaterial ?? resource.material),
      itemId: normalizeId(resource.itemId ?? resource.definitionId),
      catalogFamily: normalizeId(resource.catalogFamily ?? resource.itemFamily ?? resource.integrityFamily ?? resource.family),
      anatomicalIdentity: normalizeId(resource.anatomicalIdentity ?? resource.anatomicalPart ?? resource.part),
      lineageId: normalizeId(resource.lineageId),
      lineageName: resource.lineageName ? String(resource.lineageName) : null,
      valuable: resource.valuable === true,
      culinary: resource.culinary === true,
      knownUses: Object.freeze((Array.isArray(resource.knownUses) ? resource.knownUses : []).map(normalizeId).filter(Boolean)),
      tags: Object.freeze((Array.isArray(resource.tags) ? resource.tags : []).map(normalizeId).filter(Boolean)),
      sizeClass: sizeClassFor(unit),
      baseYield,
      recoverableYield: recoverable,
      integrity,
    });
  }

  function resolveCorpseHarvest(unit = {}, damageRecord = null, options = {}) {
    const resources = Array.isArray(unit.bodyProfile?.resources) ? unit.bodyProfile.resources : [];
    const resolved = resources.map((resource) => resolveResource(unit, resource, damageRecord, options));
    return Object.freeze({
      version: VERSION,
      unitId: String(unit.id ?? unit.unitId ?? ""),
      sizeClass: sizeClassFor(unit),
      bodyKind: normalizeId(unit.bodyProfile?.kind),
      resources: Object.freeze(resolved),
      generatedFrom: Object.freeze({
        bodyProfileVersion: unit.bodyProfile?.version ?? null,
        damageRecordPresent: Boolean(damageRecord),
      }),
    });
  }

  const API = Object.freeze({
    VERSION,
    SIZE_SCALE,
    SPECIES_SIZE_DEFAULTS,
    RESOURCE_BASE_YIELDS,
    CONTAMINATION_CHANNELS,
    normalizeId,
    sizeClassFor,
    scaleYieldRange,
    baseYieldRange,
    maxHpFor,
    exposureTotal,
    contaminationTotal,
    physicalDamage,
    integrityForResource,
    recoverableYield,
    resolveResource,
    resolveCorpseHarvest,
    clone,
  });

  global.LuminousCorpseHarvestRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
