(function (global) {
  "use strict";

  if (global.LuminousHpHealingCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousHpHealingCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "healing_hp";
  const CURRENCY = "AHN";
  const TIERS = Object.freeze(["I", "II", "III", "IV", "V"]);
  const SOURCE_CAPS = Object.freeze({ generic: 30, workshop: 60, k_corp: 100 });
  const USE_TIMINGS = Object.freeze(["action", "quick_action", "off_combat"]);

  function item(id, name, sourceLine, tier, actionCost, priceAhn, flat, maxHpPercent, capMaxHpPercent, options = {}) {
    const healing = {
      mode: options.full === true ? "full" : "hybrid",
      flat,
      maxHpPercent,
      capMaxHpPercent,
    };
    if (options.regen) {
      healing.regen = {
        turns: options.regen[0],
        tick: "turn_start",
        flatPerTurn: options.regen[1],
        maxHpPercentPerTurn: options.regen[2],
      };
    }
    if (options.extra) healing.extra = options.extra;
    return Object.freeze({
      id,
      name,
      family: FAMILY,
      iconFamily: FAMILY,
      category: "consumable",
      itemType: "consumable",
      sourceLine,
      tier,
      purchasable: true,
      currency: CURRENCY,
      priceAhn,
      stackable: true,
      runtime: {
        actionCost,
        targetMode: "self",
        consumeQty: 1,
        healing,
      },
    });
  }

  const ITEMS = Object.freeze([
    item("hp_generic_pocket_recovery_patch", "Pocket Recovery Patch", "generic", "I", "action", 2000, 2, 3, 30),
    item("hp_generic_snap_heal_ampoule", "Snap-Heal Ampoule", "generic", "I", "quick_action", 3500, 1, 4, 30),
    item("hp_generic_slowburn_strip", "Slowburn Strip", "generic", "I", "action", 5500, 1, 2, 30, {"regen":[2,1,1]}),
    item("hp_generic_civilian_recovery_pack", "Civilian Recovery Pack", "generic", "I", "off_combat", 6500, 4, 5, 30),
    item("hp_generic_rapid_recovery_gel", "Rapid Recovery Gel", "generic", "II", "action", 9000, 6, 5, 30),
    item("hp_generic_fixer_quickshot", "Fixer Quickshot", "generic", "II", "quick_action", 13000, 4, 5, 30),
    item("hp_generic_sustained_recovery_dose", "Sustained Recovery Dose", "generic", "II", "action", 18000, 3, 3, 30, {"regen":[2,2,1.5]}),
    item("hp_generic_recovery_meal_no_4", "Recovery Meal No. 4", "generic", "II", "off_combat", 20000, 10, 5, 30),
    item("hp_generic_combat_recovery_foam", "Combat Recovery Foam", "generic", "III", "action", 30000, 12, 6, 30),
    item("hp_generic_fast_acting_restore", "Fast-Acting Restore", "generic", "III", "quick_action", 43000, 8, 7, 30),
    item("hp_generic_longlife_recovery_ampoule", "Longlife Recovery Ampoule", "generic", "III", "action", 58000, 6, 4, 30, {"regen":[2,5,2]}),
    item("hp_generic_fixer_rest_kit", "Fixer Rest Kit", "generic", "III", "off_combat", 62000, 18, 7, 30),
    item("hp_generic_heavy_recovery_dose", "Heavy Recovery Dose", "generic", "IV", "action", 85000, 20, 8, 30),
    item("hp_generic_redline_quickdose", "Redline Quickdose", "generic", "IV", "quick_action", 120000, 14, 9, 30),
    item("hp_generic_extended_recovery_compound", "Extended Recovery Compound", "generic", "IV", "action", 155000, 10, 5, 30, {"regen":[2,7,2.5]}),
    item("hp_generic_premium_recovery_case", "Premium Recovery Case", "generic", "IV", "off_combat", 170000, 28, 8, 30),
    item("hp_generic_emergency_restoration_dose", "Emergency Restoration Dose", "generic", "V", "action", 220000, 28, 9, 30),
    item("hp_generic_last_line_quickdose", "Last-Line Quickdose", "generic", "V", "quick_action", 310000, 20, 10, 30),
    item("hp_generic_sustained_restoration_compound", "Sustained Restoration Compound", "generic", "V", "action", 390000, 14, 6, 30, {"regen":[2,9,3]}),
    item("hp_generic_executive_recovery_case", "Executive Recovery Case", "generic", "V", "off_combat", 350000, 38, 10, 30),
    item("hp_workshop_mender_cartridge", "Mender Cartridge", "workshop", "I", "action", 22000, 4, 8, 60),
    item("hp_workshop_flash_stitch_capsule", "Flash-Stitch Capsule", "workshop", "I", "quick_action", 34000, 3, 8, 60),
    item("hp_workshop_pulse_weave_gel", "Pulse-Weave Gel", "workshop", "I", "action", 48000, 2, 5, 60, {"regen":[2,1,2]}),
    item("hp_workshop_workshop_recovery_cell", "Workshop Recovery Cell", "workshop", "I", "off_combat", 52000, 8, 10, 60),
    item("hp_workshop_red_thread_injector", "Red Thread Injector", "workshop", "II", "action", 72000, 8, 12, 60),
    item("hp_workshop_snap_mender", "Snap-Mender", "workshop", "II", "quick_action", 105000, 5, 12, 60),
    item("hp_workshop_living_suture_compound", "Living Suture Compound", "workshop", "II", "action", 135000, 5, 7, 60, {"regen":[2,3,3]}),
    item("hp_workshop_workshop_recovery_core", "Workshop Recovery Core", "workshop", "II", "off_combat", 150000, 14, 15, 60),
    item("hp_workshop_trauma_reversal_cartridge", "Trauma Reversal Cartridge", "workshop", "III", "action", 210000, 15, 17, 60),
    item("hp_workshop_combat_loom_injector", "Combat Loom Injector", "workshop", "III", "quick_action", 290000, 10, 18, 60),
    item("hp_workshop_self_weaving_compound", "Self-Weaving Compound", "workshop", "III", "action", 360000, 8, 10, 60, {"regen":[2,5,4]}),
    item("hp_workshop_restoration_frame", "Restoration Frame", "workshop", "III", "off_combat", 390000, 22, 22, 60, {"extra":{"removePhysicalDot":1}}),
    item("hp_workshop_reconstruction_cartridge", "Reconstruction Cartridge", "workshop", "IV", "action", 520000, 24, 24, 60),
    item("hp_workshop_emergency_reweaver", "Emergency Reweaver", "workshop", "IV", "quick_action", 700000, 17, 25, 60),
    item("hp_workshop_persistent_reconstruction_gel", "Persistent Reconstruction Gel", "workshop", "IV", "action", 850000, 12, 13, 60, {"regen":[2,8,5]}),
    item("hp_workshop_full_body_recovery_cell", "Full-Body Recovery Cell", "workshop", "IV", "off_combat", 900000, 32, 28, 60, {"extra":{"removePhysicalDot":1}}),
    item("hp_workshop_masterwork_restoration_core", "Masterwork Restoration Core", "workshop", "V", "action", 1150000, 35, 30, 60),
    item("hp_workshop_zero_lag_reconstructor", "Zero-Lag Reconstructor", "workshop", "V", "quick_action", 1500000, 25, 32, 60),
    item("hp_workshop_autonomous_recovery_lattice", "Autonomous Recovery Lattice", "workshop", "V", "action", 1850000, 18, 18, 60, {"regen":[2,10,7]}),
    item("hp_workshop_workshop_phoenix_cell", "Workshop Phoenix Cell", "workshop", "V", "off_combat", 1900000, 50, 35, 60, {"extra":{"removePhysicalDot":1}}),
    item("hp_k_corp_k_corp_green_ampule_c", "K Corp Green Ampule — C", "k_corp", "I", "action", 80000, 8, 15, 100),
    item("hp_k_corp_k_corp_snap_ampule_c", "K Corp Snap Ampule — C", "k_corp", "I", "quick_action", 120000, 5, 15, 100),
    item("hp_k_corp_green_sustained_dose_c", "Green Sustained Dose — C", "k_corp", "I", "action", 165000, 4, 8, 100, {"regen":[2,3,4]}),
    item("hp_k_corp_k_corp_recovery_vial_c", "K Corp Recovery Vial — C", "k_corp", "I", "off_combat", 175000, 15, 20, 100),
    item("hp_k_corp_k_corp_green_ampule_b", "K Corp Green Ampule — B", "k_corp", "II", "action", 240000, 15, 23, 100),
    item("hp_k_corp_k_corp_combat_ampule_b", "K Corp Combat Ampule — B", "k_corp", "II", "quick_action", 340000, 10, 23, 100),
    item("hp_k_corp_sustained_green_dose_b", "Sustained Green Dose — B", "k_corp", "II", "action", 430000, 7, 12, 100, {"regen":[2,5,6]}),
    item("hp_k_corp_k_corp_recovery_vial_b", "K Corp Recovery Vial — B", "k_corp", "II", "off_combat", 460000, 25, 28, 100),
    item("hp_k_corp_k_corp_green_ampule_a", "K Corp Green Ampule — A", "k_corp", "III", "action", 650000, 25, 32, 100),
    item("hp_k_corp_k_corp_combat_ampule_a", "K Corp Combat Ampule — A", "k_corp", "III", "quick_action", 850000, 18, 33, 100),
    item("hp_k_corp_persistent_green_ampule", "Persistent Green Ampule", "k_corp", "III", "action", 1050000, 12, 17, 100, {"regen":[2,8,8]}),
    item("hp_k_corp_k_corp_restoration_case", "K Corp Restoration Case", "k_corp", "III", "off_combat", 1100000, 40, 38, 100, {"extra":{"removePhysicalDot":1}}),
    item("hp_k_corp_k_corp_high_density_ampule", "K Corp High-Density Ampule", "k_corp", "IV", "action", 1500000, 40, 42, 100),
    item("hp_k_corp_k_corp_emergency_green", "K Corp Emergency Green", "k_corp", "IV", "quick_action", 1950000, 30, 43, 100),
    item("hp_k_corp_continuous_regeneration_ampule", "Continuous Regeneration Ampule", "k_corp", "IV", "action", 2400000, 18, 22, 100, {"regen":[2,12,11]}),
    item("hp_k_corp_k_corp_restoration_pack", "K Corp Restoration Pack", "k_corp", "IV", "off_combat", 2500000, 55, 48, 85, {"extra":{"removePhysicalDot":2}}),
    item("hp_k_corp_k_corp_prime_ampule", "K Corp Prime Ampule", "k_corp", "V", "action", 3300000, 60, 55, 90),
    item("hp_k_corp_k_corp_emergency_prime", "K Corp Emergency Prime", "k_corp", "V", "quick_action", 4200000, 45, 55, 90),
    item("hp_k_corp_k_corp_persistent_prime", "K Corp Persistent Prime", "k_corp", "V", "action", 5000000, 25, 30, 100, {"regen":[2,15,15]}),
    item("hp_k_corp_k_corp_full_restoration_ampule", "K Corp Full Restoration Ampule", "k_corp", "V", "off_combat", 6500000, 0, 100, 100, {"full":true}),
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function get(id) {
    const key = String(id || "").trim();
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const sourceLine = String(options.sourceLine || "").trim();
    const tier = String(options.tier || "").trim().toUpperCase();
    const timing = String(options.useTiming || "").trim().toLowerCase();
    return ITEMS
      .filter((entry) => !sourceLine || entry.sourceLine === sourceLine)
      .filter((entry) => !tier || entry.tier === tier)
      .filter((entry) => !timing || entry.runtime.actionCost === timing)
      .map(clone);
  }

  function healingBreakdown(itemOrId, maxHp, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    const hp = Number(maxHp);
    if (!entry || !Number.isFinite(hp) || hp <= 0) return null;
    const healing = entry.runtime?.healing || {};
    const capPercent = Math.max(0, Number(healing.capMaxHpPercent || 0));
    const cap = hp * (capPercent / 100);

    if (healing.mode === "full") {
      const total = Math.min(hp, cap || hp);
      return { immediate: total, regen: 0, total, cap, capPercent, turnsApplied: 0 };
    }

    const immediateRaw = Math.max(0, Number(healing.flat || 0) + hp * (Number(healing.maxHpPercent || 0) / 100));
    const profile = healing.regen || null;
    const availableTurns = Math.max(0, Math.trunc(Number(profile?.turns || 0)));
    const requestedTurns = options.regenTurns == null
      ? availableTurns
      : Math.max(0, Math.trunc(Number(options.regenTurns || 0)));
    const turnsApplied = Math.min(availableTurns, requestedTurns);
    const regenPerTurn = profile
      ? Math.max(0, Number(profile.flatPerTurn || 0) + hp * (Number(profile.maxHpPercentPerTurn || 0) / 100))
      : 0;
    const immediate = Math.min(immediateRaw, cap || hp);
    const total = Math.min(immediateRaw + regenPerTurn * turnsApplied, cap || hp);
    return { immediate, regen: Math.max(0, total - immediate), total, cap, capPercent, turnsApplied };
  }

  function canUse(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : itemOrId;
    if (!entry) return { allowed: false, reason: "unknown_item" };
    const timing = entry.runtime?.actionCost;
    if (timing === "off_combat" && options.inCombat === true) {
      return { allowed: false, reason: "off_combat_only", timing };
    }
    return { allowed: true, reason: null, timing };
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
    const sourceCap = SOURCE_CAPS[entry?.sourceLine];
    if (!sourceCap) errors.push("invalid_source_line");
    const healing = entry?.runtime?.healing;
    if (!healing) errors.push("missing_healing");
    if (healing && Number(healing.capMaxHpPercent) > Number(sourceCap || 0)) errors.push("source_cap_exceeded");
    if (healing?.regen) {
      if (!Number.isInteger(healing.regen.turns) || healing.regen.turns <= 0) errors.push("invalid_regen_turns");
      if (healing.regen.tick !== "turn_start") errors.push("invalid_regen_tick");
    }
    return { valid: errors.length === 0, errors };
  }

  function validateCatalog() {
    const errors = [];
    const ids = new Set();
    ITEMS.forEach((entry) => {
      const check = validateItem(entry);
      if (!check.valid) errors.push({ id: entry.id, errors: check.errors });
      if (ids.has(entry.id)) errors.push({ id: entry.id, errors: ["duplicate_id"] });
      ids.add(entry.id);
    });
    return { valid: errors.length === 0, errors, count: ITEMS.length };
  }

  function registerIntoContentRegistry(options = {}) {
    const registry = options.registry || global.LuminousContentRegistry;
    if (!registry?.registerCatalog) return [];
    return registry.registerCatalog("item", ITEMS, {
      source: options.source || "hp_healing_catalog",
      nameAliases: options.nameAliases === true,
      allowSameDefinition: options.allowSameDefinition !== false,
    });
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    TIERS,
    SOURCE_CAPS,
    USE_TIMINGS,
    ITEMS,
    get,
    list,
    healingBreakdown,
    canUse,
    validateItem,
    validateCatalog,
    registerIntoContentRegistry,
  });

  global.LuminousHpHealingCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
