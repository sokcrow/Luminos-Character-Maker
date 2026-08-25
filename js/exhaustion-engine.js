(function (global) {
  "use strict";

  if (global.LuminousExhaustionEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousExhaustionEngine;
    return;
  }

  const STATE_KEY = "exhaustion";
  const MAX_LEVEL = 6;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function ensureState(unit) {
    if (!unit || typeof unit !== "object") return null;
    const legacy = Number.isFinite(Number(unit[STATE_KEY])) ? Number(unit[STATE_KEY]) : null;
    if (!unit[STATE_KEY] || typeof unit[STATE_KEY] !== "object" || Array.isArray(unit[STATE_KEY])) {
      unit[STATE_KEY] = { level: legacy == null ? 0 : legacy, baseMaxHp: null, lastLongRestAt: null, lastDailyResolutionKey: null };
    }
    const state = unit[STATE_KEY];
    state.level = clamp(Math.trunc(numberOr(state.level, 0)), 0, MAX_LEVEL);
    if (!Object.prototype.hasOwnProperty.call(state, "baseMaxHp")) state.baseMaxHp = null;
    if (!Object.prototype.hasOwnProperty.call(state, "lastLongRestAt")) state.lastLongRestAt = null;
    if (!Object.prototype.hasOwnProperty.call(state, "lastDailyResolutionKey")) state.lastDailyResolutionKey = null;
    return state;
  }

  function getLevel(unit) {
    return ensureState(unit)?.level || 0;
  }

  function maxHpSlot(unit) {
    if (!unit || typeof unit !== "object") return null;
    const slots = [
      [unit, "maxHp"], [unit, "maxHP"], [unit, "hp_max"],
      [unit.combatStats, "hp_max"], [unit.combatStats, "maxHp"],
    ];
    return slots.find(([root, key]) => root && Number.isFinite(Number(root[key]))) || null;
  }

  function currentHpSlots(unit) {
    if (!unit || typeof unit !== "object") return [];
    return [
      [unit, "hp"], [unit, "currentHp"], [unit, "currentHP"], [unit, "hp_actual"],
      [unit.combatStats, "hp_actual"], [unit.combatStats, "currentHp"],
    ].filter(([root, key]) => root && Number.isFinite(Number(root[key])));
  }

  function syncMaxHp(unit) {
    const state = ensureState(unit);
    const slot = maxHpSlot(unit);
    if (!state || !slot) return null;
    const [root, key] = slot;
    const level = state.level;

    if (level >= 4) {
      if (!Number.isFinite(Number(state.baseMaxHp))) state.baseMaxHp = Math.max(0, Number(root[key]));
      const effective = Math.max(0, Math.floor(Number(state.baseMaxHp) * 0.5));
      root[key] = effective;
      currentHpSlots(unit).forEach(([hpRoot, hpKey]) => { hpRoot[hpKey] = Math.min(Number(hpRoot[hpKey]), effective); });
      return effective;
    }

    if (Number.isFinite(Number(state.baseMaxHp))) {
      root[key] = Math.max(0, Number(state.baseMaxHp));
      state.baseMaxHp = null;
    }
    return Math.max(0, numberOr(root[key], 0));
  }

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function resolveDeath(unit, options = {}) {
    if (getLevel(unit) < MAX_LEVEL) return null;
    const deathRuntime = global.LuminousDeathSaveRuntime;
    if (deathRuntime?.resolveDeath) return deathRuntime.resolveDeath(unit, { reason: "exhaustion_level_6", ...options });
    unit.hp = 0;
    unit.lifeState = "dead";
    unit.isDead = true;
    unit.isDowned = false;
    unit.isRetreated = false;
    unit.actionQueue = [];
    return { died: true, unit, reason: "exhaustion_level_6" };
  }

  function setLevel(unit, nextLevel, options = {}) {
    const state = ensureState(unit);
    if (!state) return { changed: false, level: 0, reason: "missing_unit" };
    const before = state.level;
    state.level = clamp(Math.trunc(numberOr(nextLevel, before)), 0, MAX_LEVEL);
    const maxHp = syncMaxHp(unit);
    const death = state.level >= MAX_LEVEL ? resolveDeath(unit, options) : null;
    const result = { changed: state.level !== before, before, level: state.level, maxHp, death, reason: options.reason || null };
    if (result.changed) emit("luminous:exhaustion-changed", { unit, ...result });
    return result;
  }

  function gainLevel(unit, amount = 1, options = {}) {
    return setLevel(unit, getLevel(unit) + Math.max(0, Math.trunc(numberOr(amount, 1))), options);
  }

  function removeLevel(unit, amount = 1, options = {}) {
    return setLevel(unit, getLevel(unit) - Math.max(0, Math.trunc(numberOr(amount, 1))), options);
  }

  function thresholdModifier(unit, check = {}) {
    const level = getLevel(unit);
    const kind = normalizeId(check.kind || check.checkType || check.type);
    let value = 0;
    if (level >= 1 && ["ability", "ability_check", "skill", "skill_check", "check"].includes(kind)) value += 2;
    if (level >= 3 && ["save", "saving_throw", "savingthrow"].includes(kind)) value += 2;
    return value;
  }

  function combatModifiers(unit) {
    const level = getLevel(unit);
    return {
      clash_power: level >= 3 ? -2 : 0,
      max_speed: level >= 2 ? -2 : 0,
    };
  }

  function fixedSpeed(unit) {
    return getLevel(unit) >= 5 ? 1 : null;
  }

  function traitsFor(unit, options = {}) {
    if (Array.isArray(options.traits)) return options.traits;
    if (Array.isArray(unit?.traitDefinitions)) return unit.traitDefinitions;
    if (Array.isArray(unit?.traits) && unit.traits.every((entry) => entry && typeof entry === "object")) return unit.traits;
    return global.LuminousPlayerTraitRuntime?.getTraits?.() || [];
  }

  function longRestRequirement(unit, options = {}) {
    if (typeof options.requiresLongRest === "boolean") return { required: options.requiresLongRest, source: "explicit" };
    const traits = traitsFor(unit, options);
    for (const trait of traits) {
      const mechanics = trait?.mechanics || {};
      const rest = trait?.rest || {};
      const value = mechanics.dailyLongRestRequirement ?? mechanics.longRestRequirement ?? rest.dailyLongRestRequirement ?? rest.longRest?.required;
      const normalized = normalizeId(value);
      if (value === false || ["none", "ignore", "ignored", "exempt"].includes(normalized) || mechanics.ignoreDailyLongRest === true) {
        return { required: false, source: normalizeId(trait?.id || trait?.name) || "racial_trait" };
      }
      if (value === true || ["required", "normal", "long_rest"].includes(normalized)) {
        return { required: true, source: normalizeId(trait?.id || trait?.name) || "racial_trait" };
      }
    }
    return { required: true, source: "default" };
  }

  function completedLongRest(unit, options = {}) {
    if (typeof options.completedLongRest === "boolean") return options.completedLongRest;
    if (options.completedAlternateRest === true) return true;
    const start = Number.isFinite(Number(options.dayStart)) ? Number(options.dayStart) : Number.NEGATIVE_INFINITY;
    const end = Number.isFinite(Number(options.dayEnd)) ? Number(options.dayEnd) : Number.POSITIVE_INFINITY;
    const history = unit?.restResources?.history;
    return Array.isArray(history) && history.some((entry) => normalizeId(entry?.type) === "long_rest" && numberOr(entry?.at, 0) >= start && numberOr(entry?.at, 0) <= end);
  }

  function resolveDailyRestRequirement(unit, options = {}) {
    const state = ensureState(unit);
    if (!state) return { resolved: false, gained: 0, reason: "missing_unit" };
    const dayKey = options.dayKey == null ? null : String(options.dayKey);
    if (dayKey && state.lastDailyResolutionKey === dayKey) return { resolved: false, gained: 0, reason: "already_resolved", level: state.level };

    const requirement = longRestRequirement(unit, options);
    const completed = completedLongRest(unit, options);
    if (dayKey) state.lastDailyResolutionKey = dayKey;
    if (!requirement.required || completed) {
      return { resolved: true, gained: 0, requirement, completedLongRest: completed, level: state.level };
    }
    const change = gainLevel(unit, 1, { reason: "missed_daily_long_rest" });
    return { resolved: true, gained: change.changed ? 1 : 0, requirement, completedLongRest: false, ...change };
  }

  function onLongRest(unit, options = {}) {
    const state = ensureState(unit);
    if (!state) return { changed: false, reason: "missing_unit" };
    state.lastLongRestAt = Number.isFinite(Number(options.at)) ? Number(options.at) : Date.now();
    return removeLevel(unit, 1, { reason: "long_rest" });
  }

  let restListenerBound = false;
  function bindRestListener() {
    if (restListenerBound || typeof global.addEventListener !== "function") return false;
    restListenerBound = true;
    global.addEventListener("luminous:rest-completed", (event) => {
      const detail = event?.detail || {};
      if (normalizeId(detail.type) !== "long_rest" || !detail.character) return;
      onLongRest(detail.character, { at: Date.now() });
    });
    return true;
  }

  const api = Object.freeze({
    STATE_KEY,
    MAX_LEVEL,
    ensureState,
    getLevel,
    setLevel,
    gainLevel,
    removeLevel,
    syncMaxHp,
    thresholdModifier,
    combatModifiers,
    fixedSpeed,
    longRestRequirement,
    completedLongRest,
    resolveDailyRestRequirement,
    onLongRest,
    bindRestListener,
  });

  global.LuminousExhaustionEngine = api;
  bindRestListener();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
