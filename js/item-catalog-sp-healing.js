(function (global) {
  "use strict";

  if (global.LuminousSpHealingCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSpHealingCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "healing_sp";
  const CURRENCY = "AHN";
  const DEFAULT_MAX_SP = 45;
  const TIERS = Object.freeze(["I", "II", "III", "IV", "V"]);
  const USE_TIMINGS = Object.freeze(["action", "quick_action", "off_combat"]);
  const SOURCE_LIMITS = Object.freeze({
    generic: Object.freeze({ quickAction: 5, combat: 6, offCombat: 10 }),
    workshop: Object.freeze({ quickAction: 7, combat: 10, offCombat: 15 }),
    k_corp: Object.freeze({ quickAction: 10, combat: 15, offCombat: 20 }),
  });

  function item(id, name, sourceLine, tier, actionCost, priceAhn, spRestore, options = {}) {
    const spHealing = { immediate: spRestore, maxSp: DEFAULT_MAX_SP };
    if (options.regen) {
      spHealing.regen = {
        turns: options.regen[0],
        tick: "turn_start",
        spPerTurn: options.regen[1],
      };
    }
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
        effects: { spRestore },
        spHealing,
      },
    });
  }

  const ITEMS = Object.freeze([
    item("sp_generic_pocket_focus_tablets", "Pocket Focus Tablets", "generic", "I", "action", 1800, 2),
    item("sp_generic_snap_calm_mint", "Snap-Calm Mint", "generic", "I", "quick_action", 2800, 1),
    item("sp_generic_slowbreath_strip", "Slowbreath Strip", "generic", "I", "action", 4500, 1, { regen: [2, 1] }),
    item("sp_generic_civilian_composure_tea", "Civilian Composure Tea", "generic", "I", "off_combat", 6000, 4),
    item("sp_generic_clearhead_tonic", "Clearhead Tonic", "generic", "II", "action", 8500, 3),
    item("sp_generic_fixer_focus_chew", "Fixer Focus Chew", "generic", "II", "quick_action", 12000, 2),
    item("sp_generic_sustained_nerve_patch", "Sustained Nerve Patch", "generic", "II", "action", 16500, 2, { regen: [2, 1] }),
    item("sp_generic_quiet_room_recovery_kit", "Quiet-Room Recovery Kit", "generic", "II", "off_combat", 19000, 5),
    item("sp_generic_combat_clarity_dose", "Combat Clarity Dose", "generic", "III", "action", 28000, 4),
    item("sp_generic_fast_acting_focus_shot", "Fast-Acting Focus Shot", "generic", "III", "quick_action", 40000, 3),
    item("sp_generic_longform_composure_ampoule", "Longform Composure Ampoule", "generic", "III", "action", 54000, 3, { regen: [2, 1] }),
    item("sp_generic_fixer_decompression_kit", "Fixer Decompression Kit", "generic", "III", "off_combat", 60000, 6),
    item("sp_generic_heavy_nerve_stabilizer", "Heavy Nerve Stabilizer", "generic", "IV", "action", 80000, 5),
    item("sp_generic_redline_clarity_shot", "Redline Clarity Shot", "generic", "IV", "quick_action", 115000, 4),
    item("sp_generic_extended_focus_compound", "Extended Focus Compound", "generic", "IV", "action", 145000, 4, { regen: [2, 1] }),
    item("sp_generic_premium_decompression_case", "Premium Decompression Case", "generic", "IV", "off_combat", 165000, 8),
    item("sp_generic_emergency_composure_dose", "Emergency Composure Dose", "generic", "V", "action", 210000, 6),
    item("sp_generic_last_line_focus_shot", "Last-Line Focus Shot", "generic", "V", "quick_action", 300000, 5),
    item("sp_generic_sustained_lucidity_compound", "Sustained Lucidity Compound", "generic", "V", "action", 340000, 4, { regen: [2, 1] }),
    item("sp_generic_executive_sanity_case", "Executive Sanity Case", "generic", "V", "off_combat", 380000, 10),

    item("sp_workshop_resonance_stabilizer_cartridge", "Resonance Stabilizer Cartridge", "workshop", "I", "action", 24000, 3),
    item("sp_workshop_flash_focus_capsule", "Flash-Focus Capsule", "workshop", "I", "quick_action", 36000, 2),
    item("sp_workshop_thought_weave_gel", "Thought-Weave Gel", "workshop", "I", "action", 50000, 2, { regen: [2, 1] }),
    item("sp_workshop_decompression_cell", "Workshop Decompression Cell", "workshop", "I", "off_combat", 56000, 5),
    item("sp_workshop_synapse_alignment_injector", "Synapse Alignment Injector", "workshop", "II", "action", 78000, 5),
    item("sp_workshop_snap_lucidity_capsule", "Snap Lucidity Capsule", "workshop", "II", "quick_action", 110000, 3),
    item("sp_workshop_persistent_focus_lattice", "Persistent Focus Lattice", "workshop", "II", "action", 145000, 4, { regen: [2, 1] }),
    item("sp_workshop_quiet_core", "Workshop Quiet Core", "workshop", "II", "off_combat", 160000, 7),
    item("sp_workshop_cognitive_reversal_cartridge", "Cognitive Reversal Cartridge", "workshop", "III", "action", 220000, 7),
    item("sp_workshop_combat_mnemonic_injector", "Combat Mnemonic Injector", "workshop", "III", "quick_action", 300000, 5),
    item("sp_workshop_self_correcting_nerve_gel", "Self-Correcting Nerve Gel", "workshop", "III", "action", 370000, 6, { regen: [2, 1] }),
    item("sp_workshop_cognition_reset_frame", "Cognition Reset Frame", "workshop", "III", "off_combat", 410000, 10),
    item("sp_workshop_high_fidelity_stabilizer", "High-Fidelity Stabilizer", "workshop", "IV", "action", 540000, 9),
    item("sp_workshop_zero_lag_focus_injector", "Zero-Lag Focus Injector", "workshop", "IV", "quick_action", 720000, 6),
    item("sp_workshop_persistent_lucidity_mesh", "Persistent Lucidity Mesh", "workshop", "IV", "action", 880000, 6, { regen: [2, 2] }),
    item("sp_workshop_full_spectrum_quiet_cell", "Full-Spectrum Quiet Cell", "workshop", "IV", "off_combat", 940000, 12),
    item("sp_workshop_masterwork_composure_core", "Masterwork Composure Core", "workshop", "V", "action", 1200000, 10),
    item("sp_workshop_zero_noise_cognition_injector", "Zero-Noise Cognition Injector", "workshop", "V", "quick_action", 1550000, 7),
    item("sp_workshop_autonomous_focus_lattice", "Autonomous Focus Lattice", "workshop", "V", "action", 1800000, 6, { regen: [2, 2] }),
    item("sp_workshop_serenity_cell", "Workshop Serenity Cell", "workshop", "V", "off_combat", 2050000, 15),

    item("sp_k_corp_neural_balance_ampule_c", "K Corp Neural Balance Ampule — C", "k_corp", "I", "action", 90000, 4),
    item("sp_k_corp_snap_balance_c", "K Corp Snap Balance — C", "k_corp", "I", "quick_action", 130000, 3),
    item("sp_k_corp_green_composure_dose_c", "Green Composure Dose — C", "k_corp", "I", "action", 175000, 3, { regen: [2, 1] }),
    item("sp_k_corp_composure_vial_c", "K Corp Composure Vial — C", "k_corp", "I", "off_combat", 190000, 6),
    item("sp_k_corp_neural_balance_ampule_b", "K Corp Neural Balance Ampule — B", "k_corp", "II", "action", 260000, 6),
    item("sp_k_corp_combat_balance_b", "K Corp Combat Balance — B", "k_corp", "II", "quick_action", 360000, 4),
    item("sp_k_corp_sustained_composure_b", "Sustained Composure — B", "k_corp", "II", "action", 470000, 5, { regen: [2, 1] }),
    item("sp_k_corp_composure_vial_b", "K Corp Composure Vial — B", "k_corp", "II", "off_combat", 500000, 9),
    item("sp_k_corp_neural_balance_ampule_a", "K Corp Neural Balance Ampule — A", "k_corp", "III", "action", 700000, 9),
    item("sp_k_corp_combat_balance_a", "K Corp Combat Balance — A", "k_corp", "III", "quick_action", 900000, 6),
    item("sp_k_corp_persistent_green_focus", "Persistent Green Focus", "k_corp", "III", "action", 1100000, 8, { regen: [2, 1] }),
    item("sp_k_corp_neural_recovery_case", "K Corp Neural Recovery Case", "k_corp", "III", "off_combat", 1180000, 12),
    item("sp_k_corp_high_density_neural_ampule", "K Corp High-Density Neural Ampule", "k_corp", "IV", "action", 1600000, 12),
    item("sp_k_corp_emergency_balance", "K Corp Emergency Balance", "k_corp", "IV", "quick_action", 2050000, 8),
    item("sp_k_corp_continuous_stabilization_ampule", "Continuous Stabilization Ampule", "k_corp", "IV", "action", 2500000, 9, { regen: [2, 2] }),
    item("sp_k_corp_neural_decompression_pack", "K Corp Neural Decompression Pack", "k_corp", "IV", "off_combat", 2650000, 16),
    item("sp_k_corp_prime_neural_ampule", "K Corp Prime Neural Ampule", "k_corp", "V", "action", 3500000, 15),
    item("sp_k_corp_emergency_prime_focus", "K Corp Emergency Prime Focus", "k_corp", "V", "quick_action", 4400000, 10),
    item("sp_k_corp_persistent_prime_balance", "K Corp Persistent Prime Balance", "k_corp", "V", "action", 5200000, 11, { regen: [2, 2] }),
    item("sp_k_corp_executive_reset_ampule", "K Corp Executive Reset Ampule", "k_corp", "V", "off_combat", 6200000, 20),
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

  function ceilingFor(entry) {
    const limits = SOURCE_LIMITS[entry?.sourceLine];
    if (!limits) return 0;
    if (entry?.runtime?.actionCost === "off_combat") return limits.offCombat;
    if (entry?.runtime?.actionCost === "quick_action") return limits.quickAction;
    return limits.combat;
  }

  function profileTotal(entry, regenTurns = null) {
    const profile = entry?.runtime?.spHealing || {};
    const immediate = Math.max(0, Number(profile.immediate || 0));
    const availableTurns = Math.max(0, Math.trunc(Number(profile.regen?.turns || 0)));
    const requestedTurns = regenTurns == null ? availableTurns : Math.max(0, Math.trunc(Number(regenTurns || 0)));
    const turnsApplied = Math.min(availableTurns, requestedTurns);
    const regenPerTurn = Math.max(0, Number(profile.regen?.spPerTurn || 0));
    return { immediate, regen: regenPerTurn * turnsApplied, total: immediate + regenPerTurn * turnsApplied, turnsApplied };
  }

  function restorationBreakdown(itemOrId, currentSp = 0, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    const current = Number(currentSp);
    const maxSp = Number(options.maxSp ?? DEFAULT_MAX_SP);
    if (!entry || !Number.isFinite(current) || !Number.isFinite(maxSp) || maxSp <= 0) return null;
    const raw = profileTotal(entry, options.regenTurns);
    const lineLimit = ceilingFor(entry);
    const missing = Math.max(0, maxSp - current);
    const immediate = Math.min(raw.immediate, lineLimit, missing);
    const total = Math.min(raw.total, lineLimit, missing);
    const regen = Math.max(0, total - immediate);
    const after = Math.min(maxSp, current + total);
    return { immediate, regen, total, rawTotal: raw.total, lineLimit, currentSp: current, maxSp, after, turnsApplied: raw.turnsApplied };
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
    if (!SOURCE_LIMITS[entry?.sourceLine]) errors.push("invalid_source_line");
    const profile = entry?.runtime?.spHealing;
    if (!profile) errors.push("missing_sp_healing");
    if (Number(profile?.maxSp) !== DEFAULT_MAX_SP) errors.push("invalid_default_max_sp");
    if (Number(entry?.runtime?.effects?.spRestore) !== Number(profile?.immediate)) errors.push("runtime_sp_restore_mismatch");
    if (profile?.regen) {
      if (!Number.isInteger(profile.regen.turns) || profile.regen.turns <= 0) errors.push("invalid_regen_turns");
      if (profile.regen.tick !== "turn_start") errors.push("invalid_regen_tick");
      if (!(Number(profile.regen.spPerTurn) > 0)) errors.push("invalid_regen_value");
    }
    const total = profileTotal(entry).total;
    const limit = ceilingFor(entry);
    if (total > limit) errors.push("source_restore_limit_exceeded");
    if (total >= DEFAULT_MAX_SP) errors.push("full_sp_restore_forbidden");
    return { valid: errors.length === 0, errors, total, limit };
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
      source: options.source || "sp_healing_catalog",
      nameAliases: options.nameAliases === true,
      allowSameDefinition: options.allowSameDefinition !== false,
    });
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_MAX_SP,
    TIERS,
    USE_TIMINGS,
    SOURCE_LIMITS,
    ITEMS,
    get,
    list,
    ceilingFor,
    restorationBreakdown,
    canUse,
    validateItem,
    validateCatalog,
    registerIntoContentRegistry,
  });

  global.LuminousSpHealingCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
