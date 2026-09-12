(function (global) {
  "use strict";

  if (global.LuminousMedicalSupplyCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMedicalSupplyCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "medical_supply";
  const CURRENCY = "AHN";
  const TIERS = Object.freeze(["I", "II", "III", "IV", "V"]);
  const USE_TIMINGS = Object.freeze(["action", "quick_action", "off_combat"]);
  const ARCHETYPE_TIMINGS = Object.freeze(["action", "quick_action", "action", "off_combat"]);
  const SEVERITY_RANK = Object.freeze({ light: 1, moderate: 2, severe: 3 });

  const SOURCE_PROFILES = Object.freeze({
    generic: Object.freeze({ label: "Generic Medical", owner: null, technology: "field medicine and conventional trauma care" }),
    workshop: Object.freeze({ label: "Workshop Medical", owner: null, technology: "precision surgery, orthopedic support and accelerated recovery" }),
    specialist: Object.freeze({ label: "Specialist Medical", owner: null, technology: "high-grade intensive trauma reconstruction and recovery" }),
  });

  const INJURY_GROUPS = Object.freeze({
    wounds: Object.freeze(["combat_bruising", "cut_hand", "accumulated_trauma", "deep_wound"]),
    joints: Object.freeze(["sprained_wrist", "sprained_ankle", "dislocated_shoulder", "damaged_knee"]),
    concussion: Object.freeze(["minor_concussion", "moderate_concussion"]),
    thoracic: Object.freeze(["cracked_ribs", "damaged_lung"]),
    sensory: Object.freeze(["damaged_eye"]),
    severe_body: Object.freeze(["severe_trauma", "broken_arm", "broken_leg", "damaged_lung", "damaged_eye"]),
  });

  const LIGHT_MODERATE = Object.freeze([
    "combat_bruising", "cut_hand", "sprained_wrist", "sprained_ankle", "minor_concussion",
    "accumulated_trauma", "deep_wound", "dislocated_shoulder", "cracked_ribs", "damaged_knee", "moderate_concussion",
  ]);
  const NON_STRUCTURAL = Object.freeze([...LIGHT_MODERATE, "severe_trauma", "broken_arm", "broken_leg", "damaged_lung", "damaged_eye"]);
  const STRUCTURAL_EXCLUSIONS = Object.freeze(["missing_eye", "missing_hand", "missing_arm", "missing_foot", "missing_leg", "missing_organ"]);

  const TARGETS = Object.freeze({
    generic: Object.freeze([
      Object.freeze([...INJURY_GROUPS.wounds]),
      Object.freeze([...INJURY_GROUPS.joints]),
      Object.freeze([...INJURY_GROUPS.concussion]),
      LIGHT_MODERATE,
    ]),
    workshop: Object.freeze([
      Object.freeze([...INJURY_GROUPS.wounds, "severe_trauma"]),
      Object.freeze([...INJURY_GROUPS.joints, "broken_arm", "broken_leg"]),
      Object.freeze([...INJURY_GROUPS.concussion, ...INJURY_GROUPS.thoracic, ...INJURY_GROUPS.sensory]),
      NON_STRUCTURAL,
    ]),
    specialist: Object.freeze([
      Object.freeze([...INJURY_GROUPS.wounds, "severe_trauma", "cracked_ribs", "damaged_lung"]),
      Object.freeze([...INJURY_GROUPS.joints, "broken_arm", "broken_leg"]),
      Object.freeze([...INJURY_GROUPS.concussion, "damaged_eye", "damaged_lung", "cracked_ribs"]),
      NON_STRUCTURAL,
    ]),
  });

  const ALLOWED_SEVERITIES = Object.freeze({
    generic: Object.freeze(["light", "moderate"]),
    workshop: Object.freeze(["light", "moderate", "severe"]),
    specialist: Object.freeze(["light", "moderate", "severe"]),
  });

  const NAMES = Object.freeze({
    generic: Object.freeze([
      Object.freeze(["Sterile Field Dressing", "Joint Support Wrap", "Concussion Cold Pack", "Basic Recovery Kit"]),
      Object.freeze(["Reinforced Wound Dressing", "Fixer Joint Brace", "Neuro Rest Pack", "Field Treatment Case"]),
      Object.freeze(["Trauma Closure Dressing", "Combat Support Brace", "Concussion Care Module", "Extended Recovery Case"]),
      Object.freeze(["Heavy Trauma Dressing", "Rapid Joint Stabilizer", "Neuro Recovery Pack", "Advanced Field Treatment Case"]),
      Object.freeze(["Critical Trauma Dressing", "Master Joint Support Rig", "Advanced Concussion Recovery Pack", "Executive Recovery Case"]),
    ]),
    workshop: Object.freeze([
      Object.freeze(["Precision Closure Patch", "Snap-Set Brace", "Cranial Stabilization Pad", "Workshop Treatment Cell"]),
      Object.freeze(["Micro-Suture Mesh", "Quick-Set Orthopedic Brace", "Neuro-Thoracic Support Pack", "Workshop Recovery Core"]),
      Object.freeze(["Deep Trauma Closure System", "Combat Orthopedic Rig", "Thoracic-Neural Stabilizer", "Workshop Surgical Case"]),
      Object.freeze(["Reconstruction Suture Lattice", "Emergency Bone-Set Rig", "Advanced Thoracic Recovery Frame", "Workshop Trauma Frame"]),
      Object.freeze(["Masterwork Tissue Closure", "Zero-Lag Orthopedic Frame", "Masterwork Neuro-Thoracic System", "Workshop Intensive Recovery Case"]),
    ]),
    specialist: Object.freeze([
      Object.freeze(["Specialist Trauma Matrix — D", "Orthopedic Recovery Frame — D", "Neuro-Sensory Recovery Pack — D", "Specialist Recovery Case — D"]),
      Object.freeze(["Specialist Trauma Matrix — C", "Orthopedic Recovery Frame — C", "Neuro-Sensory Recovery Pack — C", "Specialist Recovery Case — C"]),
      Object.freeze(["Specialist Trauma Matrix — B", "Orthopedic Recovery Frame — B", "Neuro-Sensory Recovery Pack — B", "Specialist Recovery Case — B"]),
      Object.freeze(["Specialist Trauma Matrix — A", "Orthopedic Recovery Frame — A", "Neuro-Sensory Recovery Pack — A", "Specialist Recovery Case — A"]),
      Object.freeze(["Specialist Trauma Matrix — EX", "Orthopedic Recovery Frame — EX", "Neuro-Sensory Recovery Pack — EX", "Specialist Recovery Case — EX"]),
    ]),
  });

  const PRICES = Object.freeze({
    generic: Object.freeze([
      Object.freeze([1800, 2600, 3200, 5500]),
      Object.freeze([7500, 10500, 13000, 18000]),
      Object.freeze([24000, 34000, 42000, 56000]),
      Object.freeze([70000, 95000, 120000, 155000]),
      Object.freeze([180000, 240000, 280000, 340000]),
    ]),
    workshop: Object.freeze([
      Object.freeze([28000, 42000, 52000, 65000]),
      Object.freeze([85000, 120000, 150000, 185000]),
      Object.freeze([240000, 330000, 410000, 480000]),
      Object.freeze([580000, 760000, 900000, 1050000]),
      Object.freeze([1350000, 1750000, 2050000, 2400000]),
    ]),
    specialist: Object.freeze([
      Object.freeze([110000, 150000, 180000, 220000]),
      Object.freeze([300000, 390000, 480000, 560000]),
      Object.freeze([760000, 980000, 1180000, 1350000]),
      Object.freeze([1750000, 2200000, 2600000, 3000000]),
      Object.freeze([3900000, 4800000, 5600000, 7800000]),
    ]),
  });

  const TREATMENTS = Object.freeze({
    generic: Object.freeze([
      Object.freeze([{ reduceHours:2 }, { reduceHours:2 }, { reduceHours:2 }, { reducePercent:10 }]),
      Object.freeze([{ reduceHours:4 }, { reduceHours:4 }, { reduceHours:4 }, { reducePercent:15 }]),
      Object.freeze([{ reduceHours:6 }, { reduceHours:6 }, { reduceHours:6 }, { reducePercent:20 }]),
      Object.freeze([{ reduceHours:10 }, { reduceHours:10 }, { reduceHours:10 }, { reducePercent:30 }]),
      Object.freeze([{ reduceHours:16 }, { reduceHours:16 }, { reduceHours:16 }, { reducePercent:40 }]),
    ]),
    workshop: Object.freeze([
      Object.freeze([{ reducePercent:20 }, { reducePercent:15 }, { reducePercent:20 }, { reducePercent:25 }]),
      Object.freeze([{ reducePercent:30 }, { reducePercent:25 }, { reducePercent:30 }, { reducePercent:35 }]),
      Object.freeze([{ reducePercent:40 }, { reducePercent:35 }, { reducePercent:40 }, { reducePercent:45 }]),
      Object.freeze([{ reducePercent:50 }, { reducePercent:45 }, { reducePercent:50 }, { reducePercent:60 }]),
      Object.freeze([{ reducePercent:65 }, { reducePercent:55 }, { reducePercent:65 }, { reducePercent:75 }]),
    ]),
    specialist: Object.freeze([
      Object.freeze([{ reducePercent:30 }, { reducePercent:25 }, { reducePercent:30 }, { reducePercent:40 }]),
      Object.freeze([{ reducePercent:40 }, { reducePercent:35 }, { reducePercent:40 }, { reducePercent:50 }]),
      Object.freeze([{ reducePercent:50 }, { reducePercent:45 }, { reducePercent:50 }, { reducePercent:60 }]),
      Object.freeze([{ reducePercent:65 }, { reducePercent:55 }, { reducePercent:65 }, { reducePercent:75 }]),
      Object.freeze([{ cure:true }, { reducePercent:75 }, { cure:true }, { cure:true }]),
    ]),
  });

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function slug(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function item(id, name, sourceLine, tier, actionCost, priceAhn, targets, treatment) {
    const injuryTreatment = Object.freeze({
      method: "medical_supply",
      allowedSeverities: ALLOWED_SEVERITIES[sourceLine],
      targetCatalogIds: Object.freeze([...targets]),
      allowStructural: false,
      ...treatment,
    });
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
      runtime: Object.freeze({
        handler: "medical_supply",
        actionCost,
        targetMode: "self",
        consumeQty: 1,
        injuryTreatment,
      }),
    });
  }

  const ITEMS = Object.freeze(Object.keys(SOURCE_PROFILES).flatMap((sourceLine) =>
    TIERS.flatMap((tier, tierIndex) =>
      NAMES[sourceLine][tierIndex].map((name, archetypeIndex) => item(
        `medical_${sourceLine}_${slug(name)}`,
        name,
        sourceLine,
        tier,
        ARCHETYPE_TIMINGS[archetypeIndex],
        PRICES[sourceLine][tierIndex][archetypeIndex],
        TARGETS[sourceLine][archetypeIndex],
        TREATMENTS[sourceLine][tierIndex][archetypeIndex]
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
    const injuryId = normalizeId(options.injuryId);
    return ITEMS
      .filter((entry) => !sourceLine || entry.sourceLine === sourceLine)
      .filter((entry) => !tier || entry.tier === tier)
      .filter((entry) => !timing || entry.runtime.actionCost === timing)
      .filter((entry) => !injuryId || entry.runtime.injuryTreatment.targetCatalogIds.includes(injuryId))
      .map(clone);
  }

  function canUse(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : itemOrId;
    if (!entry) return { allowed: false, reason: "unknown_item" };
    if (entry.runtime?.actionCost === "off_combat" && options.inCombat === true) {
      return { allowed: false, reason: "off_combat_only" };
    }
    return { allowed: true, reason: null };
  }

  function resolveInjury(unit, injuryRef, injuryEngine) {
    if (!unit || !injuryEngine) return null;
    const wanted = normalizeId(typeof injuryRef === "object" ? (injuryRef.instanceId || injuryRef.catalogId || injuryRef.id) : injuryRef);
    if (!wanted) return null;
    return (injuryEngine.activeInjuries?.(unit) || []).find((injury) =>
      normalizeId(injury.instanceId) === wanted || normalizeId(injury.catalogId || injury.id) === wanted
    ) || null;
  }

  function canTreatInjury(itemOrId, unit, injuryRef, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : itemOrId;
    if (!entry) return { allowed: false, reason: "unknown_item" };
    const useGate = canUse(entry, options);
    if (!useGate.allowed) return useGate;
    const injuryEngine = options.injuryEngine || global.LuminousInjuryEngine || safeRequire("./injury-engine.js");
    if (!injuryEngine) return { allowed: false, reason: "injury_engine_unavailable" };
    const injury = resolveInjury(unit, injuryRef, injuryEngine);
    if (!injury) return { allowed: false, reason: "injury_not_found" };
    const treatment = entry.runtime?.injuryTreatment || {};
    if (injury.structural === true && treatment.allowStructural !== true) {
      return { allowed: false, reason: "structural_injury_not_treatable", injury: clone(injury) };
    }
    const severity = normalizeId(injury.severity);
    if (!treatment.allowedSeverities?.includes(severity)) {
      return { allowed: false, reason: "severity_not_supported", injury: clone(injury) };
    }
    const catalogId = normalizeId(injury.catalogId || injury.id);
    if (Array.isArray(treatment.targetCatalogIds) && treatment.targetCatalogIds.length && !treatment.targetCatalogIds.includes(catalogId)) {
      return { allowed: false, reason: "injury_type_not_supported", injury: clone(injury) };
    }
    return { allowed: true, reason: null, injury: clone(injury), treatment: clone(treatment) };
  }

  function applyTreatment(itemOrId, unit, injuryRef, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    const gate = canTreatInjury(entry, unit, injuryRef, options);
    if (!gate.allowed) return { applied: false, ...gate, item: entry };
    const injuryEngine = options.injuryEngine || global.LuminousInjuryEngine || safeRequire("./injury-engine.js");
    const result = injuryEngine.treatInjury(unit, gate.injury.instanceId, gate.treatment);
    return { applied: result?.treated === true, item: entry, injury: gate.injury, treatment: gate.treatment, result };
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
    if (entry?.runtime?.handler !== "medical_supply") errors.push("invalid_handler");
    const treatment = entry?.runtime?.injuryTreatment;
    if (!treatment) errors.push("missing_injury_treatment");
    if (treatment?.allowStructural !== false) errors.push("structural_treatment_not_allowed");
    if (!Array.isArray(treatment?.targetCatalogIds) || !treatment.targetCatalogIds.length) errors.push("missing_targets");
    if (!Array.isArray(treatment?.allowedSeverities) || !treatment.allowedSeverities.length) errors.push("missing_severities");
    const hasEffect = treatment?.cure === true || Number(treatment?.reduceHours || 0) > 0 || Number(treatment?.reducePercent || 0) > 0;
    if (!hasEffect) errors.push("missing_treatment_effect");
    if (entry.runtime?.effects?.hpRestore || entry.runtime?.effects?.spRestore || entry.runtime?.effects?.removeStatuses) errors.push("medical_supply_must_not_duplicate_healing_or_cure");
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
      source: options.source || "medical_supply_catalog",
      nameAliases: options.nameAliases === true,
      allowSameDefinition: options.allowSameDefinition !== false,
    });
  }

  function installItemRuntimeBridge(options = {}) {
    const current = options.itemRuntime || global.LuminousItemRuntime;
    if (!current) return false;
    if (current.__luminousMedicalSupplyBridge === true) return true;
    const normalize = current.normalizeId || normalizeId;
    const previousUseItem = current.useItem?.bind(current);

    function bridgedUseItem(user, itemInput, useOptions = {}) {
      const storedItem = current.findItem?.(user, itemInput) || itemInput;
      const hydrated = current.resolveItem?.(storedItem, useOptions) || current.hydrateItemInstance?.(storedItem, useOptions) || storedItem;
      if (normalize(hydrated?.runtime?.handler) !== "medical_supply") {
        return previousUseItem ? previousUseItem(user, itemInput, useOptions) : { used: false, reason: "base_item_runtime_unavailable" };
      }
      const phase = normalize(useOptions.phase || "other");
      const inCombat = ["planning", "combat"].includes(phase);
      const gate = canTreatInjury(hydrated, useOptions.target || user, useOptions.injuryRef || useOptions.injury, { ...useOptions, inCombat });
      if (!gate.allowed) return { used: false, reason: gate.reason, item: storedItem, injury: gate.injury || null };
      return previousUseItem ? previousUseItem(user, itemInput, useOptions) : { used: false, reason: "base_item_runtime_unavailable" };
    }

    global.LuminousItemRuntime = Object.freeze({
      ...current,
      useItem: bridgedUseItem,
      __luminousMedicalSupplyBridge: true,
      __luminousMedicalSupplyBase: current,
    });
    return true;
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    TIERS,
    USE_TIMINGS,
    SOURCE_PROFILES,
    INJURY_GROUPS,
    LIGHT_MODERATE,
    NON_STRUCTURAL,
    STRUCTURAL_EXCLUSIONS,
    ITEMS,
    get,
    list,
    canUse,
    canTreatInjury,
    applyTreatment,
    validateItem,
    validateCatalog,
    registerIntoContentRegistry,
    installItemRuntimeBridge,
  });

  global.LuminousMedicalSupplyCatalog = API;
  const bridgeInstalled = installItemRuntimeBridge();
  if (!bridgeInstalled && global.addEventListener) global.addEventListener("load", () => installItemRuntimeBridge(), { once: true });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
