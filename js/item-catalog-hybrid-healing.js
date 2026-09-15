(function (global) {
  "use strict";

  if (global.LuminousHybridHealingCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousHybridHealingCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "healing_hybrid";
  const CURRENCY = "AHN";
  const DEFAULT_MAX_SP = 45;
  const TIERS = Object.freeze(["I", "II", "III", "IV", "V"]);
  const USE_TIMINGS = Object.freeze(["action", "quick_action", "off_combat"]);
  const ARCHETYPE_TIMINGS = Object.freeze(["action", "quick_action", "action", "off_combat"]);

  const SOURCE_CAPS = Object.freeze({
    generic: 12,
    workshop: 16,
    premium_synthesis: 18,
  });

  const SP_LIMITS = Object.freeze({
    generic: Object.freeze({ quickAction: 2, combat: 3, offCombat: 4 }),
    workshop: Object.freeze({ quickAction: 3, combat: 4, offCombat: 5 }),
    premium_synthesis: Object.freeze({ quickAction: 4, combat: 5, offCombat: 6 }),
  });

  const DEDICATED_REFERENCE_LIMITS = Object.freeze({
    generic: Object.freeze({ hpCapPercent: 30, spOffCombat: 10 }),
    workshop: Object.freeze({ hpCapPercent: 60, spOffCombat: 15 }),
    premium_synthesis: Object.freeze({ hpCapPercent: 100, spOffCombat: 20 }),
  });

  const SOURCE_PROFILES = Object.freeze({
    generic: Object.freeze({ label: "Generic Hybrid", owner: null, technology: "mixed recovery compound" }),
    workshop: Object.freeze({ label: "Workshop Hybrid", owner: null, technology: "workshop dual-recovery engineering" }),
    premium_synthesis: Object.freeze({ label: "Premium Synthesis", owner: null, technology: "high-grade dual-spectrum synthesis" }),
  });

  const NAMES = Object.freeze({
    generic: Object.freeze([
      Object.freeze(["Pocket Dual-Recovery Patch", "Snap Balance Inhaler", "Slow Balance Strip", "Civilian Dual Restore Pack"]),
      Object.freeze(["Fixer Dual Gel", "Snap Restore Inhaler", "Sustained Balance Patch", "Dual Recovery Case"]),
      Object.freeze(["Combat Balance Foam", "Rapid Dual Inhaler", "Longform Restore Compound", "Fixer Dual Recovery Case"]),
      Object.freeze(["Heavy Dual Recovery Dose", "Redline Balance Inhaler", "Extended Dual Compound", "Premium Dual Restore Case"]),
      Object.freeze(["Emergency Dual Restoration", "Last-Line Balance Inhaler", "Sustained Dual Restoration", "Executive Dual Recovery Case"]),
    ]),
    workshop: Object.freeze([
      Object.freeze(["Twin-Weave Cartridge", "Flash Balance Capsule", "Pulse-Weave Balance Compound", "Workshop Dual Cell"]),
      Object.freeze(["Red Thread Balance Injector", "Snap-Weave Capsule", "Living Balance Compound", "Workshop Dual Recovery Core"]),
      Object.freeze(["Trauma-Resonance Cartridge", "Combat Loom Balance Injector", "Self-Weaving Balance Gel", "Dual Restoration Frame"]),
      Object.freeze(["Reconstruction Balance Cartridge", "Emergency Dual Reweaver", "Persistent Balance Mesh", "Full-Spectrum Recovery Cell"]),
      Object.freeze(["Masterwork Dual Core", "Zero-Lag Balance Reconstructor", "Autonomous Dual Lattice", "Workshop Chimera Cell"]),
    ]),
    premium_synthesis: Object.freeze([
      Object.freeze(["Dual-Spectrum Ampule — D", "Snap Dual-Spectrum Aerosol — D", "Sustained Synthesis Compound — D", "Synthesis Recovery Case — D"]),
      Object.freeze(["Dual-Spectrum Ampule — C", "Snap Dual-Spectrum Aerosol — C", "Sustained Synthesis Compound — C", "Synthesis Recovery Case — C"]),
      Object.freeze(["Dual-Spectrum Ampule — B", "Snap Dual-Spectrum Aerosol — B", "Sustained Synthesis Compound — B", "Synthesis Recovery Case — B"]),
      Object.freeze(["Dual-Spectrum Ampule — A", "Snap Dual-Spectrum Aerosol — A", "Sustained Synthesis Compound — A", "Synthesis Recovery Case — A"]),
      Object.freeze(["Dual-Spectrum Ampule — EX", "Snap Dual-Spectrum Aerosol — EX", "Sustained Synthesis Compound — EX", "Synthesis Recovery Case — EX"]),
    ]),
  });

  const PRICES = Object.freeze({
    generic: Object.freeze([
      Object.freeze([3500, 5200, 7000, 8500]),
      Object.freeze([12000, 17000, 23000, 28000]),
      Object.freeze([42000, 60000, 75000, 82000]),
      Object.freeze([110000, 150000, 185000, 205000]),
      Object.freeze([270000, 350000, 410000, 450000]),
    ]),
    workshop: Object.freeze([
      Object.freeze([32000, 45000, 60000, 68000]),
      Object.freeze([95000, 130000, 165000, 185000]),
      Object.freeze([260000, 350000, 420000, 470000]),
      Object.freeze([620000, 800000, 950000, 1050000]),
      Object.freeze([1350000, 1700000, 2050000, 2250000]),
    ]),
    premium_synthesis: Object.freeze([
      Object.freeze([120000, 165000, 205000, 230000]),
      Object.freeze([330000, 430000, 540000, 600000]),
      Object.freeze([850000, 1100000, 1300000, 1450000]),
      Object.freeze([1900000, 2400000, 2850000, 3100000]),
      Object.freeze([4000000, 5000000, 5900000, 6500000]),
    ]),
  });

  // [hpFlat, hpMaxPercent, spRestore, optional hpRegen [turns, flatPerTurn, hpPercentPerTurn]]
  const RECOVERY = Object.freeze({
    generic: Object.freeze([
      Object.freeze([[1, 2, 1], [0, 2, 1], [0, 1, 1, [2, 1, 0.5]], [2, 3, 2]]),
      Object.freeze([[2, 3, 1], [1, 3, 1], [1, 2, 1, [2, 1, 1]], [4, 4, 2]]),
      Object.freeze([[4, 4, 2], [3, 4, 1], [2, 3, 2, [2, 2, 1]], [6, 5, 3]]),
      Object.freeze([[6, 5, 2], [4, 5, 2], [3, 3, 2, [2, 2, 1.5]], [8, 6, 3]]),
      Object.freeze([[8, 6, 3], [6, 6, 2], [4, 4, 3, [2, 3, 1.5]], [10, 7, 4]]),
    ]),
    workshop: Object.freeze([
      Object.freeze([[2, 3, 1], [1, 3, 1], [1, 2, 1, [2, 1, 1]], [4, 4, 2]]),
      Object.freeze([[4, 4, 2], [3, 4, 1], [2, 3, 2, [2, 2, 1]], [6, 5, 3]]),
      Object.freeze([[6, 5, 2], [4, 5, 2], [3, 4, 2, [2, 2, 1.5]], [8, 6, 4]]),
      Object.freeze([[8, 6, 3], [6, 6, 2], [4, 4, 3, [2, 3, 1.5]], [10, 8, 4]]),
      Object.freeze([[10, 7, 4], [8, 7, 3], [5, 5, 4, [2, 3, 2]], [12, 10, 5]]),
    ]),
    premium_synthesis: Object.freeze([
      Object.freeze([[3, 4, 2], [2, 4, 1], [1, 3, 2, [2, 1, 1]], [5, 5, 3]]),
      Object.freeze([[5, 5, 2], [3, 5, 2], [2, 4, 2, [2, 2, 1]], [7, 6, 3]]),
      Object.freeze([[7, 6, 3], [5, 6, 2], [3, 5, 3, [2, 2, 1.5]], [9, 7, 4]]),
      Object.freeze([[9, 7, 4], [7, 7, 3], [4, 5, 4, [2, 3, 2]], [11, 8, 5]]),
      Object.freeze([[12, 8, 5], [9, 8, 4], [5, 6, 5, [2, 4, 2]], [14, 11, 6]]),
    ]),
  });

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function item(id, name, sourceLine, tier, actionCost, priceAhn, hpFlat, hpMaxPercent, spRestore, hpRegen = null) {
    const hp = {
      flat: hpFlat,
      maxHpPercent: hpMaxPercent,
      capMaxHpPercent: SOURCE_CAPS[sourceLine],
    };
    if (hpRegen) {
      hp.regen = {
        turns: hpRegen[0],
        tick: "turn_start",
        flatPerTurn: hpRegen[1],
        maxHpPercentPerTurn: hpRegen[2],
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
        effects: { spRestore },
        hybridHealing: {
          hp,
          sp: { immediate: spRestore, maxSp: DEFAULT_MAX_SP },
        },
      },
    });
  }

  const ITEMS = Object.freeze(Object.keys(SOURCE_CAPS).flatMap((sourceLine) =>
    TIERS.flatMap((tier, tierIndex) =>
      NAMES[sourceLine][tierIndex].map((name, archetypeIndex) => {
        const recovery = RECOVERY[sourceLine][tierIndex][archetypeIndex];
        return item(
          `hybrid_${sourceLine}_${slug(name)}`,
          name,
          sourceLine,
          tier,
          ARCHETYPE_TIMINGS[archetypeIndex],
          PRICES[sourceLine][tierIndex][archetypeIndex],
          recovery[0],
          recovery[1],
          recovery[2],
          recovery[3] || null
        );
      })
    )
  ));

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

  function spCeilingFor(entry) {
    const limits = SP_LIMITS[entry?.sourceLine];
    if (!limits) return 0;
    if (entry?.runtime?.actionCost === "off_combat") return limits.offCombat;
    if (entry?.runtime?.actionCost === "quick_action") return limits.quickAction;
    return limits.combat;
  }

  function hpBreakdown(entry, maxHp, regenTurns = null) {
    const hp = entry?.runtime?.hybridHealing?.hp || {};
    const max = Number(maxHp);
    if (!Number.isFinite(max) || max <= 0) return null;
    const capPercent = Math.max(0, Number(hp.capMaxHpPercent || 0));
    const cap = max * (capPercent / 100);
    const immediateRaw = Math.max(0, Number(hp.flat || 0) + max * (Number(hp.maxHpPercent || 0) / 100));
    const availableTurns = Math.max(0, Math.trunc(Number(hp.regen?.turns || 0)));
    const requestedTurns = regenTurns == null ? availableTurns : Math.max(0, Math.trunc(Number(regenTurns || 0)));
    const turnsApplied = Math.min(availableTurns, requestedTurns);
    const regenPerTurn = hp.regen
      ? Math.max(0, Number(hp.regen.flatPerTurn || 0) + max * (Number(hp.regen.maxHpPercentPerTurn || 0) / 100))
      : 0;
    const immediate = Math.min(immediateRaw, cap);
    const total = Math.min(immediateRaw + regenPerTurn * turnsApplied, cap);
    return { immediate, regen: Math.max(0, total - immediate), total, cap, capPercent, turnsApplied };
  }

  function spBreakdown(entry, currentSp = 0, maxSp = DEFAULT_MAX_SP) {
    const sp = entry?.runtime?.hybridHealing?.sp || {};
    const current = Number(currentSp);
    const max = Number(maxSp);
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return null;
    const lineLimit = spCeilingFor(entry);
    const missing = Math.max(0, max - current);
    const total = Math.min(Math.max(0, Number(sp.immediate || 0)), lineLimit, missing);
    return { immediate: total, regen: 0, total, lineLimit, currentSp: current, maxSp: max, after: Math.min(max, current + total) };
  }

  function restorationBreakdown(itemOrId, maxHp, currentSp = 0, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const hp = hpBreakdown(entry, maxHp, options.hpRegenTurns);
    const sp = spBreakdown(entry, currentSp, options.maxSp ?? DEFAULT_MAX_SP);
    if (!hp || !sp) return null;
    return { hp, sp };
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
    if (!SOURCE_CAPS[entry?.sourceLine]) errors.push("invalid_source_line");

    const hybrid = entry?.runtime?.hybridHealing;
    if (!hybrid?.hp || !hybrid?.sp) errors.push("missing_hybrid_healing");
    if (Number(hybrid?.hp?.capMaxHpPercent) !== Number(SOURCE_CAPS[entry?.sourceLine])) errors.push("invalid_hp_cap");
    if (Number(hybrid?.sp?.maxSp) !== DEFAULT_MAX_SP) errors.push("invalid_default_max_sp");
    if (Number(entry?.runtime?.effects?.spRestore) !== Number(hybrid?.sp?.immediate)) errors.push("runtime_sp_restore_mismatch");

    const hpAt200 = hpBreakdown(entry, 200);
    const spAt0 = spBreakdown(entry, 0);
    if (!hpAt200 || hpAt200.total > 200 * (SOURCE_CAPS[entry?.sourceLine] / 100)) errors.push("hp_cap_exceeded");
    if (!spAt0 || spAt0.total > spCeilingFor(entry)) errors.push("sp_limit_exceeded");
    if (spAt0?.total >= DEFAULT_MAX_SP) errors.push("full_sp_restore_forbidden");

    const dedicated = DEDICATED_REFERENCE_LIMITS[entry?.sourceLine];
    if (dedicated && SOURCE_CAPS[entry.sourceLine] > dedicated.hpCapPercent / 2) errors.push("hp_not_diluted");
    if (dedicated && SP_LIMITS[entry.sourceLine].offCombat > dedicated.spOffCombat / 2) errors.push("sp_not_diluted");

    return {
      valid: errors.length === 0,
      errors,
      hpAt200: hpAt200?.total ?? null,
      hpCapPercent: SOURCE_CAPS[entry?.sourceLine] ?? 0,
      spTotal: spAt0?.total ?? null,
      spLimit: spCeilingFor(entry),
    };
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
      source: options.source || "hybrid_healing_catalog",
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
    SOURCE_CAPS,
    SP_LIMITS,
    DEDICATED_REFERENCE_LIMITS,
    SOURCE_PROFILES,
    ITEMS,
    get,
    list,
    spCeilingFor,
    restorationBreakdown,
    canUse,
    validateItem,
    validateCatalog,
    registerIntoContentRegistry,
  });

  global.LuminousHybridHealingCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
