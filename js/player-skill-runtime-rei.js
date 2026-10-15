(function (global) {
  "use strict";

  if (global.LuminousReiPlayerSkillRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousReiPlayerSkillRuntime;
    return;
  }

  const IDS = Object.freeze({
    s1: "rei_twin_fang",
    s2: "rei_crimson_moon_sweep",
    s3: "rei_heaven_rending_execution",
  });
  const clashBonus = new WeakMap();
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function skillId(skill = {}) {
    return normalizeId(skill?.id || skill?.skillId || skill?.sourceId || skill?.libraryKey);
  }

  function ruptureStatus(unit = {}) {
    const effects = unit?.statusEffects || unit?.statuses || {};
    if (Array.isArray(effects)) return effects.find((entry) => normalizeId(entry?.id || entry?.status) === "rupture") || null;
    return effects.rupture || null;
  }

  function rupturePotency(unit = {}) {
    const status = ruptureStatus(unit);
    return typeof status === "number" ? Math.max(0, status) : Math.max(0, numberOr(status?.potency, 0));
  }

  function ruptureActive(unit = {}) {
    const status = ruptureStatus(unit);
    if (!status) return false;
    return typeof status === "number"
      ? status > 0
      : numberOr(status.potency, 0) > 0 && numberOr(status.count, 0) > 0;
  }

  function currentCoinIndex(context = {}) {
    const index = Number(context.currentCoin?.index);
    if (Number.isInteger(index) && index >= 0 && context.currentCoin) return index;
    const coins = context.skill?.coins || [];
    const found = coins.indexOf(context.currentCoin);
    return found >= 0 ? found : null;
  }

  function applyRupture(target, potency = 0, count = 0, sourceSkillId = "") {
    if (!target || (potency <= 0 && count <= 0)) return null;
    const input = {
      mode: "gain",
      potency: Math.max(0, numberOr(potency, 0)),
      count: Math.max(0, numberOr(count, 0)),
      data: { sourceSkillId, sourceCharacterId: "rei" },
    };
    if (typeof global.LuminousStatusEngine?.applyStatus === "function") {
      return global.LuminousStatusEngine.applyStatus(target, "rupture", input);
    }
    // Mirror existing player signature fallback when StatusEngine has not loaded.
    if (!target.statusEffects || typeof target.statusEffects !== "object" || Array.isArray(target.statusEffects)) target.statusEffects = {};
    const previous = target.statusEffects.rupture || {};
    const next = {
      ...previous, id: "rupture",
      potency: Math.max(0, numberOr(previous.potency, 0) + input.potency),
      count: Math.max(0, numberOr(previous.count, 0) + input.count),
      data: { ...(previous.data || {}), ...input.data },
    };
    target.statusEffects.rupture = next;
    return next;
  }

  // Signature definitions intentionally carry no declarative coin status effects;
  // this hook is their single status application path, preventing double stacks.
  function handleSkillTrigger(tag, context = {}) {
    if (tag !== "[On Hit]") return null;
    const id = skillId(context.skill || {});
    const coin = currentCoinIndex(context);
    const target = context.currentTarget || context.defender;
    if (!target || coin === null) return null;

    let potency = 0;
    let count = 0;
    if (id === IDS.s1) {
      if (coin === 0) potency = 2;
      if (coin === 1) count = 2;
    } else if (id === IDS.s2) {
      if (coin === 0) count = 1;
      if (coin === 1) potency = 2;
      if (coin === 2) count = 2;
    } else if (id === IDS.s3) {
      if (coin === 0) potency = 2;
      if (coin === 1) count = 3;
    }
    return applyRupture(target, potency, count, id);
  }

  function damageMultiplier(skill, target, context = {}) {
    if (skillId(skill) !== IDS.s3 || currentCoinIndex(context) !== 2) return 1;
    return rupturePotency(target) >= 5 ? 1.20 : 1;
  }

  function install(engine = global.CombatEngine) {
    if (!engine || engine.__reiPlayerSkillRuntime074) return Boolean(engine);
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalResolveClash = typeof engine.resolveClash === "function" ? engine.resolveClash : null;
    const originalPassiveMods = typeof engine.applyPassiveModifiers === "function" ? engine.applyPassiveModifiers : null;
    const originalCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        // Multi-target hits are dispatched separately by the combat resolver.
        handleSkillTrigger(tag, context || {});
        return result;
      };
    }
    if (originalResolveClash) {
      engine.resolveClash = function (unitA, skillA, unitB, skillB) {
        if (skillA && typeof skillA === "object" && skillId(skillA) === IDS.s3)
          clashBonus.set(skillA, ruptureActive(unitB) ? 1 : 0);
        if (skillB && typeof skillB === "object" && skillId(skillB) === IDS.s3)
          clashBonus.set(skillB, ruptureActive(unitA) ? 1 : 0);
        try {
          return originalResolveClash.apply(this, arguments);
        } finally {
          if (skillA && typeof skillA === "object") clashBonus.delete(skillA);
          if (skillB && typeof skillB === "object") clashBonus.delete(skillB);
        }
      };
    }
    if (originalPassiveMods) {
      engine.applyPassiveModifiers = function (unit, context = {}) {
        const base = originalPassiveMods.call(this, unit, context) || {};
        const bonus = context?.skill && typeof context.skill === "object" ? clashBonus.get(context.skill) || 0 : 0;
        return bonus ? { ...base, clash_power: numberOr(base.clash_power, 0) + bonus } : base;
      };
    }
    if (originalCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, power, critical, clashes, context = null) {
        const damage = originalCoinDamage.call(this, attacker, defender, skill, power, critical, clashes, context);
        const multiplier = damageMultiplier(skill, defender, context || {});
        return multiplier === 1 ? damage : Math.max(0, Math.floor(numberOr(damage, 0) * multiplier));
      };
    }

    Object.defineProperty(engine, "__reiPlayerSkillRuntime074", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({
    version: "0.7.4-rei-rupture-1",
    IDS, skillId, rupturePotency, ruptureActive,
    currentCoinIndex, applyRupture, handleSkillTrigger, damageMultiplier, install,
  });
  global.LuminousReiPlayerSkillRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  install();
})(typeof window !== "undefined" ? window : globalThis);
