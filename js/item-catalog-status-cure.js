(function (global) {
  "use strict";

  if (global.LuminousStatusCureCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousStatusCureCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "status_cure";
  const CURRENCY = "AHN";
  const TIERS = Object.freeze(["I", "II", "III", "IV", "V"]);
  const USE_TIMINGS = Object.freeze(["action", "quick_action", "off_combat"]);
  const ARCHETYPE_TIMINGS = Object.freeze(["action", "quick_action", "action", "off_combat"]);

  const SOURCE_PROFILES = Object.freeze({
    generic: Object.freeze({ label: "Generic Cure", owner: null, technology: "field medicine and common counteragents" }),
    workshop: Object.freeze({ label: "Workshop Countermeasure", owner: null, technology: "precision status suppression and engineered counteragents" }),
    specialist: Object.freeze({ label: "Specialist Counteragent", owner: null, technology: "high-grade multi-vector decontamination and status arrest" }),
  });

  // Only statuses whose canonical semantics can reasonably be reduced by a consumable live here.
  // Source/save-driven conditions such as Frozen, Petrified, Grappled, Restrained, Sleep and Exhaustion are intentionally excluded.
  const CURABLE_STATUS_PROFILES = Object.freeze({
    bleed: Object.freeze({ mode: "double", removeOnZeroCount: true }),
    burn: Object.freeze({ mode: "double", removeOnZeroCount: true }),
    poison: Object.freeze({ mode: "double", removeOnZeroCount: false }),
    shock: Object.freeze({ mode: "single", removeOnZeroCount: true }),
    corrosion: Object.freeze({ mode: "single", removeOnZeroCount: true }),
    chill: Object.freeze({ mode: "single", removeOnZeroCount: true }),
    paralyze: Object.freeze({ mode: "single", removeOnZeroCount: true }),
    rupture: Object.freeze({ mode: "double", removeOnZeroCount: true }),
    tremor: Object.freeze({ mode: "double", removeOnZeroCount: true }),
    sinking: Object.freeze({ mode: "double", removeOnZeroCount: true }),
    decay: Object.freeze({ mode: "single", removeOnZeroCount: true }),
    radiance: Object.freeze({ mode: "single", removeOnZeroCount: true }),
  });

  const NAMES = Object.freeze({
    generic: Object.freeze([
      Object.freeze(["Coagulant Bandage", "Cooling Mist", "Basic Antitoxin", "Field Recovery Kit"]),
      Object.freeze(["Hemostatic Foam", "Grounding Patch", "Cold Relief Pack", "Detox Field Case"]),
      Object.freeze(["Nerve Reset Injector", "Burn Neutralizer", "Advanced Antitoxin", "Multi-Ailment Field Case"]),
      Object.freeze(["Rapid Coagulation Seal", "Emergency Grounding Ampoule", "Deep Detox Compound", "Advanced Recovery Case"]),
      Object.freeze(["Field Stabilization Dose", "Last-Line Antitoxin", "Multi-System Counteragent", "Executive Field Cure Case"]),
    ]),
    workshop: Object.freeze([
      Object.freeze(["Microseal Coagulant", "Shock Sink Capsule", "Tremor Dampener Gel", "Workshop Cure Cell"]),
      Object.freeze(["Corrosion Wash", "Rupture Binding Patch", "Sinking Stabilizer", "Workshop Countermeasure Core"]),
      Object.freeze(["Deep Shock Grounder", "Tremor Reversal Capsule", "Corrosion Neutralizer", "Workshop Status Frame"]),
      Object.freeze(["Rupture Sealant", "Sinking Purge Compound", "Multi-State Suppression Matrix", "Full Countermeasure Cell"]),
      Object.freeze(["Masterwork Status Suppressor", "Zero-Lag Counteragent", "Autonomous Countermeasure Lattice", "Workshop Broad Countermeasure Cell"]),
    ]),
    specialist: Object.freeze([
      Object.freeze(["Radiance Dissipation Salve", "Decay Buffer Ampule", "Advanced Corrosion Binder", "Specialist Recovery Case"]),
      Object.freeze(["Deep Sinking Antagonist", "Rupture Neutralizer", "Persistent Poison Counteragent", "Specialist Purge Case"]),
      Object.freeze(["Radiance Sink Compound", "Decay Arrestor", "Multi-Vector Antagonist", "Specialist Decontamination Case"]),
      Object.freeze(["High-Purity Counteragent", "Emergency Anti-Decay Dose", "Full-Spectrum Status Suppressor", "Specialist Restoration Case"]),
      Object.freeze(["Prime Counteragent", "Zero-State Neutralizer", "Persistent Purge Compound", "Specialist Total Countermeasure Case"]),
    ]),
  });

  const PRICES = Object.freeze({
    generic: Object.freeze([
      Object.freeze([2500, 3500, 4500, 6500]),
      Object.freeze([9000, 13000, 18000, 22000]),
      Object.freeze([30000, 42000, 58000, 70000]),
      Object.freeze([90000, 120000, 160000, 190000]),
      Object.freeze([240000, 320000, 400000, 480000]),
    ]),
    workshop: Object.freeze([
      Object.freeze([30000, 45000, 55000, 70000]),
      Object.freeze([90000, 120000, 160000, 190000]),
      Object.freeze([250000, 330000, 430000, 480000]),
      Object.freeze([600000, 780000, 950000, 1100000]),
      Object.freeze([1350000, 1700000, 2100000, 2400000]),
    ]),
    specialist: Object.freeze([
      Object.freeze([100000, 140000, 190000, 230000]),
      Object.freeze([300000, 400000, 520000, 600000]),
      Object.freeze([800000, 1050000, 1350000, 1500000]),
      Object.freeze([1800000, 2300000, 2800000, 3200000]),
      Object.freeze([3900000, 4800000, 5800000, 6800000]),
    ]),
  });

  const a = (statusId, count, potency = 0) => Object.freeze({
    statusId,
    countDelta: -Math.abs(Number(count || 0)),
    potencyDelta: -Math.abs(Number(potency || 0)),
  });

  // Four archetypes per tier: Action, Quick Action, Action, Off Combat.
  const EFFECTS = Object.freeze({
    generic: Object.freeze([
      Object.freeze([[a("bleed", 3, 1)], [a("burn", 2, 1)], [a("poison", 4, 1)], [a("bleed", 2, 1), a("burn", 2, 1), a("poison", 3, 1)]]),
      Object.freeze([[a("bleed", 5, 1)], [a("shock", 3)], [a("chill", 6)], [a("poison", 6, 1), a("corrosion", 2)]]),
      Object.freeze([[a("paralyze", 3)], [a("burn", 4, 1)], [a("poison", 8, 2)], [a("bleed", 4, 1), a("burn", 4, 1), a("poison", 6, 1), a("shock", 3)]]),
      Object.freeze([[a("bleed", 8, 2)], [a("shock", 5)], [a("poison", 12, 2), a("corrosion", 3)], [a("bleed", 6, 2), a("burn", 6, 2), a("poison", 10, 2), a("chill", 8)]]),
      Object.freeze([[a("paralyze", 5), a("shock", 6)], [a("poison", 10, 2)], [a("bleed", 8, 2), a("burn", 8, 2), a("poison", 12, 3)], [a("bleed", 10, 3), a("burn", 10, 3), a("poison", 15, 3), a("shock", 8), a("chill", 12), a("paralyze", 5)]]),
    ]),
    workshop: Object.freeze([
      Object.freeze([[a("bleed", 4, 1)], [a("shock", 4)], [a("tremor", 4, 1)], [a("bleed", 4, 1), a("shock", 4), a("tremor", 3, 1)]]),
      Object.freeze([[a("corrosion", 4)], [a("rupture", 3, 1)], [a("sinking", 4, 1)], [a("rupture", 4, 1), a("sinking", 4, 1), a("corrosion", 3)]]),
      Object.freeze([[a("shock", 7)], [a("tremor", 5, 1)], [a("corrosion", 6)], [a("shock", 6), a("tremor", 6, 2), a("corrosion", 5), a("rupture", 5, 1)]]),
      Object.freeze([[a("rupture", 8, 2)], [a("sinking", 6, 2)], [a("rupture", 7, 2), a("tremor", 7, 2), a("sinking", 7, 2)], [a("rupture", 9, 3), a("tremor", 9, 3), a("sinking", 9, 3), a("corrosion", 7), a("shock", 8)]]),
      Object.freeze([[a("rupture", 10, 3), a("sinking", 10, 3)], [a("shock", 8), a("paralyze", 6)], [a("tremor", 12, 4), a("corrosion", 8)], [a("rupture", 12, 4), a("tremor", 12, 4), a("sinking", 12, 4), a("corrosion", 10), a("shock", 10), a("paralyze", 7)]]),
    ]),
    specialist: Object.freeze([
      Object.freeze([[a("radiance", 2)], [a("decay", 1)], [a("corrosion", 5)], [a("radiance", 2), a("decay", 1), a("corrosion", 4)]]),
      Object.freeze([[a("sinking", 6, 2)], [a("rupture", 5, 1)], [a("poison", 10, 3)], [a("sinking", 6, 2), a("rupture", 6, 2), a("poison", 8, 2)]]),
      Object.freeze([[a("radiance", 4)], [a("decay", 2)], [a("corrosion", 7), a("poison", 12, 3), a("shock", 7)], [a("radiance", 4), a("decay", 2), a("corrosion", 7), a("poison", 10, 3)]]),
      Object.freeze([[a("poison", 16, 4), a("corrosion", 9)], [a("decay", 3)], [a("rupture", 9, 3), a("sinking", 9, 3), a("tremor", 9, 3), a("radiance", 5)], [a("decay", 3), a("radiance", 5), a("corrosion", 9), a("poison", 14, 4), a("rupture", 8, 2), a("sinking", 8, 2)]]),
      Object.freeze([[a("poison", 20, 5), a("corrosion", 12), a("shock", 10)], [a("decay", 4), a("radiance", 6)], [a("rupture", 12, 4), a("tremor", 12, 4), a("sinking", 12, 4), a("poison", 18, 5)], [a("bleed", 12, 4), a("burn", 12, 4), a("poison", 22, 6), a("shock", 12), a("corrosion", 12), a("chill", 15), a("paralyze", 8), a("rupture", 14, 5), a("tremor", 14, 5), a("sinking", 14, 5), a("decay", 5), a("radiance", 8)]]),
    ]),
  });

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function item(id, name, sourceLine, tier, actionCost, priceAhn, adjustments) {
    const statusAdjustments = adjustments.map((entry) => Object.freeze({ ...entry }));
    return Object.freeze({
      id,
      name,
      family: FAMILY,
      iconFamily: FAMILY,
      category: "consumable",
      itemType: "consumable",
      sourceLine,
      sourceProfile: SOURCE_PROFILES[sourceLine],
      tier,
      purchasable: true,
      currency: CURRENCY,
      priceAhn,
      stackable: true,
      runtime: {
        actionCost,
        targetMode: "self",
        consumeQty: 1,
        handler: "status_cure",
        effects: { statusAdjustments },
        statusCure: { statusAdjustments },
      },
    });
  }

  const ITEMS = Object.freeze(Object.keys(SOURCE_PROFILES).flatMap((sourceLine) =>
    TIERS.flatMap((tier, tierIndex) =>
      NAMES[sourceLine][tierIndex].map((name, archetypeIndex) => item(
        `cure_${sourceLine}_${slug(name)}`,
        name,
        sourceLine,
        tier,
        ARCHETYPE_TIMINGS[archetypeIndex],
        PRICES[sourceLine][tierIndex][archetypeIndex],
        EFFECTS[sourceLine][tierIndex][archetypeIndex]
      ))
    )
  ));

  function get(id) {
    const key = String(id || "").trim();
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const sourceLine = String(options.sourceLine || "").trim();
    const tier = String(options.tier || "").trim().toUpperCase();
    const timing = String(options.useTiming || "").trim().toLowerCase();
    const statusId = String(options.statusId || "").trim().toLowerCase();
    return ITEMS
      .filter((entry) => !sourceLine || entry.sourceLine === sourceLine)
      .filter((entry) => !tier || entry.tier === tier)
      .filter((entry) => !timing || entry.runtime.actionCost === timing)
      .filter((entry) => !statusId || entry.runtime.statusCure.statusAdjustments.some((adjustment) => adjustment.statusId === statusId))
      .map(clone);
  }

  function canUse(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : itemOrId;
    if (!entry) return { allowed: false, reason: "unknown_item" };
    const timing = entry.runtime?.actionCost;
    if (timing === "off_combat" && options.inCombat === true) return { allowed: false, reason: "off_combat_only", timing };
    return { allowed: true, reason: null, timing };
  }

  function canonicalStatusId(statusId) {
    const raw = String(statusId || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return global.LuminousStatusLibrary?.resolveId?.(raw) || raw;
  }

  function adjustmentResult(target, adjustment, statusEngine) {
    const statusId = canonicalStatusId(adjustment.statusId);
    const profile = CURABLE_STATUS_PROFILES[statusId];
    if (!profile) return { statusId, changed: false, reason: "status_not_curable" };
    const current = statusEngine?.getStatus?.(target, statusId);
    if (!current) return { statusId, changed: false, reason: "status_not_present" };

    const before = { count: Math.max(0, Number(current.count || 0)), potency: Math.max(0, Number(current.potency || 0)) };
    const after = {
      count: Math.max(0, before.count + Number(adjustment.countDelta || 0)),
      potency: Math.max(0, before.potency + Number(adjustment.potencyDelta || 0)),
    };

    const shouldRemove = profile.mode === "single"
      ? after.count <= 0
      : (profile.removeOnZeroCount === true ? after.count <= 0 : (after.count <= 0 && after.potency <= 0));

    if (shouldRemove && statusEngine?.removeStatus) {
      const removal = statusEngine.removeStatus(target, statusId, { from: "item" });
      if (removal?.removed) return { statusId, changed: true, removed: true, before, after: { count: 0, potency: 0 }, removal };
      return { statusId, changed: false, removed: false, protected: Boolean(removal?.protected), before, after: before, removal };
    }

    if (!statusEngine?.applyStatus) return { statusId, changed: false, reason: "status_engine_unavailable", before, after: before };
    statusEngine.applyStatus(target, statusId, {
      mode: "set",
      count: after.count,
      potency: profile.mode === "double" ? after.potency : before.potency,
      duration: current.duration,
      sourceTraitId: current.sourceTraitId,
      sourceUnitId: current.sourceUnitId,
      data: current.data,
    });
    return {
      statusId,
      changed: after.count !== before.count || (profile.mode === "double" && after.potency !== before.potency),
      removed: false,
      before,
      after: { count: after.count, potency: profile.mode === "double" ? after.potency : before.potency },
    };
  }

  function applyCure(itemOrId, target, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry || !target) return { applied: false, reason: "missing_item_or_target", results: [] };
    const gate = canUse(entry, options);
    if (!gate.allowed) return { applied: false, reason: gate.reason, results: [] };
    const statusEngine = options.statusEngine || global.LuminousStatusEngine;
    if (!statusEngine?.getStatus || !statusEngine?.applyStatus || !statusEngine?.removeStatus) {
      return { applied: false, reason: "status_engine_unavailable", results: [] };
    }
    const adjustments = entry.runtime?.statusCure?.statusAdjustments || [];
    const results = adjustments.map((adjustment) => adjustmentResult(target, adjustment, statusEngine));
    return { applied: results.some((result) => result.changed), item: entry, target, results };
  }

  function validateItem(entry) {
    const errors = [];
    if (!entry?.id) errors.push("missing_id");
    if (entry?.family !== FAMILY || entry?.iconFamily !== FAMILY) errors.push("invalid_family");
    if (entry?.category !== "consumable") errors.push("invalid_category");
    if (!TIERS.includes(entry?.tier)) errors.push("invalid_tier");
    if (entry?.purchasable !== true) errors.push("not_purchasable");
    if (entry?.currency !== CURRENCY) errors.push("invalid_currency");
    if (!Number.isInteger(entry?.priceAhn) || entry.priceAhn <= 0) errors.push("invalid_price");
    if (!USE_TIMINGS.includes(entry?.runtime?.actionCost)) errors.push("invalid_use_timing");
    if (!SOURCE_PROFILES[entry?.sourceLine]) errors.push("invalid_source_line");
    if (entry?.runtime?.handler !== "status_cure") errors.push("invalid_handler");
    const adjustments = entry?.runtime?.statusCure?.statusAdjustments;
    if (!Array.isArray(adjustments) || adjustments.length === 0) errors.push("missing_status_adjustments");
    for (const adjustment of adjustments || []) {
      const statusId = canonicalStatusId(adjustment?.statusId);
      if (!CURABLE_STATUS_PROFILES[statusId]) errors.push(`unsupported_status:${statusId}`);
      const countDelta = Number(adjustment?.countDelta || 0);
      const potencyDelta = Number(adjustment?.potencyDelta || 0);
      if (countDelta > 0 || potencyDelta > 0) errors.push(`positive_cure_delta:${statusId}`);
      if (countDelta === 0 && potencyDelta === 0) errors.push(`zero_cure_delta:${statusId}`);
    }
    return { valid: errors.length === 0, errors };
  }

  function validateCatalog() {
    const errors = [];
    const ids = new Set();
    for (const entry of ITEMS) {
      const check = validateItem(entry);
      if (!check.valid) errors.push({ id: entry.id, errors: check.errors });
      if (ids.has(entry.id)) errors.push({ id: entry.id, errors: ["duplicate_id"] });
      ids.add(entry.id);
    }
    return { valid: errors.length === 0, errors, count: ITEMS.length };
  }

  function registerIntoContentRegistry(options = {}) {
    const registry = options.registry || global.LuminousContentRegistry;
    if (!registry?.registerCatalog) return [];
    return registry.registerCatalog("item", ITEMS, {
      source: options.source || "status_cure_catalog",
      nameAliases: options.nameAliases === true,
      allowSameDefinition: options.allowSameDefinition !== false,
    });
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    TIERS,
    USE_TIMINGS,
    SOURCE_PROFILES,
    CURABLE_STATUS_PROFILES,
    ITEMS,
    get,
    list,
    canUse,
    applyCure,
    validateItem,
    validateCatalog,
    registerIntoContentRegistry,
  });

  global.LuminousStatusCureCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
