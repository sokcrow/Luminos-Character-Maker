(function (global) {
  "use strict";

  if (global.LuminousSpHealingCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSpHealingCatalog;
    return;
  }

  const VERSION = 2;
  const FAMILY = "healing_sp";
  const CURRENCY = "AHN";
  const DEFAULT_MAX_SP = 45;
  const TIERS = Object.freeze(["I", "II", "III", "IV", "V"]);
  const USE_TIMINGS = Object.freeze(["action", "quick_action", "off_combat"]);
  const SOURCE_LIMITS = Object.freeze({
    generic: Object.freeze({ quickAction: 5, combat: 6, offCombat: 10 }),
    m_corp: Object.freeze({ quickAction: 7, combat: 10, offCombat: 15 }),
    l_corp: Object.freeze({ quickAction: 10, combat: 15, offCombat: 20 }),
  });
  const SOURCE_PROFILES = Object.freeze({
    generic: Object.freeze({ label: "Generic", owner: null, material: null }),
    m_corp: Object.freeze({ label: "M Corp", owner: "M Corp", material: "Moonlight Stone" }),
    l_corp: Object.freeze({ label: "L Corp Enkephalin", owner: "L Corp", material: "Enkephalin" }),
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
    const sourceProfile = SOURCE_PROFILES[sourceLine] || SOURCE_PROFILES.generic;
    return Object.freeze({
      id,
      name,
      family: FAMILY,
      iconFamily: FAMILY,
      category: "consumable",
      itemType: "consumable",
      sourceLine,
      sourceProfile: {
        label: sourceProfile.label,
        owner: sourceProfile.owner,
        material: sourceProfile.material,
      },
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

    item("sp_m_corp_moonlight_shard_stabilizer", "Moonlight Shard Stabilizer", "m_corp", "I", "action", 24000, 3),
    item("sp_m_corp_flash_moonlight_chip", "Flash Moonlight Chip", "m_corp", "I", "quick_action", 36000, 2),
    item("sp_m_corp_low_grade_resonance_cartridge", "Low-Grade Moonlight Resonance Cartridge", "m_corp", "I", "action", 50000, 2, { regen: [2, 1] }),
    item("sp_m_corp_calm_cell", "M Corp Calm Cell", "m_corp", "I", "off_combat", 56000, 5),
    item("sp_m_corp_polished_moonlight_stabilizer", "Polished Moonlight Stabilizer", "m_corp", "II", "action", 78000, 5),
    item("sp_m_corp_snap_moonlight_capsule", "Snap Moonlight Capsule", "m_corp", "II", "quick_action", 110000, 3),
    item("sp_m_corp_resonant_moonlight_lattice", "Resonant Moonlight Lattice", "m_corp", "II", "action", 145000, 4, { regen: [2, 1] }),
    item("sp_m_corp_quiet_cell", "M Corp Quiet Cell", "m_corp", "II", "off_combat", 160000, 7),
    item("sp_m_corp_moonlight_resonance_cartridge", "Moonlight Resonance Cartridge", "m_corp", "III", "action", 220000, 7),
    item("sp_m_corp_combat_moonlight_capsule", "Combat Moonlight Capsule", "m_corp", "III", "quick_action", 300000, 5),
    item("sp_m_corp_self_tuning_moonlight_mesh", "Self-Tuning Moonlight Mesh", "m_corp", "III", "action", 370000, 6, { regen: [2, 1] }),
    item("sp_m_corp_decompression_frame", "M Corp Decompression Frame", "m_corp", "III", "off_combat", 410000, 10),
    item("sp_m_corp_high_purity_stabilizer", "High-Purity Moonlight Stabilizer", "m_corp", "IV", "action", 540000, 9),
    item("sp_m_corp_zero_lag_moonlight_capsule", "Zero-Lag Moonlight Capsule", "m_corp", "IV", "quick_action", 720000, 6),
    item("sp_m_corp_persistent_moonlight_matrix", "Persistent Moonlight Matrix", "m_corp", "IV", "action", 880000, 6, { regen: [2, 2] }),
    item("sp_m_corp_full_spectrum_moonlight_cell", "Full-Spectrum Moonlight Cell", "m_corp", "IV", "off_combat", 940000, 12),
    item("sp_m_corp_masterwork_moonlight_core", "Masterwork Moonlight Core", "m_corp", "V", "action", 1200000, 10),
    item("sp_m_corp_zero_noise_capsule", "M Corp Zero-Noise Capsule", "m_corp", "V", "quick_action", 1550000, 7),
    item("sp_m_corp_autonomous_moonlight_lattice", "Autonomous Moonlight Lattice", "m_corp", "V", "action", 1800000, 6, { regen: [2, 2] }),
    item("sp_m_corp_serenity_core", "M Corp Serenity Core", "m_corp", "V", "off_combat", 2050000, 15),

    item("sp_l_corp_diluted_enkephalin_ampule_d", "Diluted Enkephalin Ampule — D", "l_corp", "I", "action", 90000, 4),
    item("sp_l_corp_enkephalin_microdose_d", "Enkephalin Microdose — D", "l_corp", "I", "quick_action", 130000, 3),
    item("sp_l_corp_slow_release_enkephalin_d", "Slow-Release Enkephalin Compound — D", "l_corp", "I", "action", 175000, 3, { regen: [2, 1] }),
    item("sp_l_corp_recovery_flask_d", "L Corp Recovery Flask — D", "l_corp", "I", "off_combat", 190000, 6),
    item("sp_l_corp_stabilized_enkephalin_ampule_c", "Stabilized Enkephalin Ampule — C", "l_corp", "II", "action", 260000, 6),
    item("sp_l_corp_combat_enkephalin_dose_c", "Combat Enkephalin Dose — C", "l_corp", "II", "quick_action", 360000, 4),
    item("sp_l_corp_sustained_enkephalin_compound_c", "Sustained Enkephalin Compound — C", "l_corp", "II", "action", 470000, 5, { regen: [2, 1] }),
    item("sp_l_corp_composure_vial_c", "L Corp Composure Vial — C", "l_corp", "II", "off_combat", 500000, 9),
    item("sp_l_corp_refined_enkephalin_ampule_b", "Refined Enkephalin Ampule — B", "l_corp", "III", "action", 700000, 9),
    item("sp_l_corp_rapid_enkephalin_dose_b", "Rapid Enkephalin Dose — B", "l_corp", "III", "quick_action", 900000, 6),
    item("sp_l_corp_persistent_enkephalin_compound_b", "Persistent Enkephalin Compound — B", "l_corp", "III", "action", 1100000, 8, { regen: [2, 1] }),
    item("sp_l_corp_recovery_case_b", "L Corp Recovery Case — B", "l_corp", "III", "off_combat", 1180000, 12),
    item("sp_l_corp_high_purity_enkephalin_ampule_a", "High-Purity Enkephalin Ampule — A", "l_corp", "IV", "action", 1600000, 12),
    item("sp_l_corp_emergency_enkephalin_dose_a", "Emergency Enkephalin Dose — A", "l_corp", "IV", "quick_action", 2050000, 8),
    item("sp_l_corp_continuous_enkephalin_compound_a", "Continuous Enkephalin Compound — A", "l_corp", "IV", "action", 2500000, 9, { regen: [2, 2] }),
    item("sp_l_corp_decompression_pack_a", "L Corp Decompression Pack — A", "l_corp", "IV", "off_combat", 2650000, 16),
    item("sp_l_corp_concentrated_enkephalin_ampule_ex", "Concentrated Enkephalin Ampule — EX", "l_corp", "V", "action", 3500000, 15),
    item("sp_l_corp_emergency_enkephalin_concentrate_ex", "Emergency Enkephalin Concentrate — EX", "l_corp", "V", "quick_action", 4400000, 10),
    item("sp_l_corp_persistent_prime_enkephalin_ex", "Persistent Prime Enkephalin Compound — EX", "l_corp", "V", "action", 5200000, 11, { regen: [2, 2] }),
    item("sp_l_corp_executive_enkephalin_case_ex", "L Corp Executive Enkephalin Case — EX", "l_corp", "V", "off_combat", 6200000, 20),
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
    const expectedProfile = SOURCE_PROFILES[entry?.sourceLine];
    if (!expectedProfile) errors.push("missing_source_profile");
    if (expectedProfile && entry?.sourceProfile?.owner !== expectedProfile.owner) errors.push("invalid_source_owner");
    if (expectedProfile && entry?.sourceProfile?.material !== expectedProfile.material) errors.push("invalid_source_material");
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
    SOURCE_PROFILES,
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
