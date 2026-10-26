(function (global) {
  "use strict";

  if (global.LuminousHalfDemonCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousHalfDemonCombatRuntime;
    return;
  }

  const STATUS_ID = "devil_gauge";
  const GAUGE_TRAIT_ID = "half_demon_devil_gauge";
  const TRIGGER_TRAIT_ID = "half_demon_devil_trigger";
  const MAX_GAUGE = 100;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clampGauge = (value) => Math.max(0, Math.min(MAX_GAUGE, Math.trunc(numberOr(value, 0))));

  let cachedStatusEngine = null;
  let cachedCombatEngine = null;

  function statusEngine() {
    cachedStatusEngine = global.LuminousStatusEngine || cachedStatusEngine;
    if (!cachedStatusEngine && typeof require === "function") {
      try { cachedStatusEngine = require("./status-engine.js"); } catch (_) {}
    }
    return cachedStatusEngine;
  }

  function combatEngine() {
    cachedCombatEngine = global.CombatEngine || cachedCombatEngine;
    if (!cachedCombatEngine && typeof require === "function") {
      try { cachedCombatEngine = require("./combatEngine.js"); } catch (_) {}
    }
    return cachedCombatEngine;
  }

  function ensureStatusDefinition() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    const existing = global.STATUS_REGISTRY[STATUS_ID] || {};
    global.STATUS_REGISTRY[STATUS_ID] = {
      ...existing,
      id: STATUS_ID,
      name: "Devil Gauge",
      type: "positive",
      mode: "single",
      maxCount: MAX_GAUGE,
      icon: existing.icon ?? null,
      rules: Array.isArray(existing.rules) ? existing.rules : [],
      description: "Half-Demon combat Style resource. Maximum 100 Devil Gauge.",
    };
    return global.STATUS_REGISTRY[STATUS_ID];
  }

  function trustedTrait(unit, traitId) {
    if (!unit || typeof unit !== "object") return null;
    const engine = combatEngine();
    if (typeof engine?.resolveTrustedTraitForUnit === "function") {
      return engine.resolveTrustedTraitForUnit(unit, traitId);
    }
    return null;
  }

  function hasGaugeTrait(unit) {
    return Boolean(trustedTrait(unit, GAUGE_TRAIT_ID));
  }

  function hasTriggerTrait(unit) {
    return Boolean(trustedTrait(unit, TRIGGER_TRAIT_ID));
  }

  function gaugeValue(unit) {
    const status = statusEngine()?.getStatus?.(unit, STATUS_ID);
    return clampGauge(status?.count ?? unit?.statusEffects?.[STATUS_ID]?.count ?? 0);
  }

  function setGauge(unit, value, sourceTraitId = GAUGE_TRAIT_ID) {
    if (!unit || typeof unit !== "object") return 0;
    ensureStatusDefinition();
    const engine = statusEngine();
    const next = clampGauge(value);
    if (!engine) return next;
    if (next <= 0) {
      engine.removeStatus?.(unit, STATUS_ID, { from: "self", ignoreProtection: true });
      return 0;
    }
    engine.applyStatus?.(unit, STATUS_ID, {
      mode: "set",
      count: next,
      potency: 0,
      duration: "until_removed",
      sourceTraitId,
      sourceUnitId: unit.id || unit.unitId || unit.characterId || null,
    });
    return gaugeValue(unit);
  }

  function changeGauge(unit, delta, sourceTraitId = GAUGE_TRAIT_ID) {
    if (!hasGaugeTrait(unit)) return gaugeValue(unit);
    return setGauge(unit, gaugeValue(unit) + numberOr(delta, 0), sourceTraitId);
  }

  function maxHp(unit) {
    return Math.max(0, numberOr(unit?.maxHp ?? unit?.hp_max ?? unit?.max_hp, 0));
  }

  function heal(unit, amount) {
    const maximum = maxHp(unit);
    const current = Math.max(0, numberOr(unit?.hp, 0));
    const gained = Math.max(0, Math.floor(numberOr(amount, 0)));
    if (!gained || !maximum) return 0;
    const next = Math.min(maximum, current + gained);
    unit.hp = next;
    return Math.max(0, next - current);
  }

  function gainShield(unit) {
    if (!hasTriggerTrait(unit) || gaugeValue(unit) < 40) return 0;
    const amount = Math.max(0, Math.floor(maxHp(unit) * 0.10));
    if (!amount) return 0;
    unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount;
    return amount;
  }

  function handleCombatTag(tag, context = {}) {
    const normalizedTag = String(tag || "").trim();
    if (normalizedTag === "[On Hit]") {
      const unit = context.attacker || context.unitAttacker || null;
      if (!hasGaugeTrait(unit)) return;
      const damageDealt = Math.max(0, numberOr(context.damageDealt, 0));
      changeGauge(unit, 2);
      if (damageDealt > 0) unit.__halfDemonDealtDamageThisTurn = true;
      if (hasTriggerTrait(unit) && gaugeValue(unit) >= 100 && damageDealt > 0) {
        heal(unit, damageDealt * 0.05);
      }
      return;
    }

    if (normalizedTag === "[On Evade]") {
      const unit = context.defender || null;
      changeGauge(unit, 5);
      return;
    }

    // CombatEngine also emits Clash Win/Lose while resolving post-clash coins.
    // currentCoin distinguishes those follow-up emissions from the single resolved Clash event.
    if (context.currentCoin) return;
    if (normalizedTag === "[On Clash Win]") changeGauge(context.attacker || null, 10);
    if (normalizedTag === "[On Clash Lose]") changeGauge(context.attacker || null, -10);
  }

  function applyThresholdModifiers(unit, modifiers = {}) {
    if (!hasTriggerTrait(unit)) return modifiers;
    const gauge = gaugeValue(unit);
    if (gauge < 50) return modifiers;
    const next = { ...(modifiers || {}) };
    next.defense_power = numberOr(next.defense_power, 0) + 1;
    if (gauge >= 60) next.speed = numberOr(next.speed, 0) + 1;
    if (gauge >= 70) next.damage_dealt_multiplier = numberOr(next.damage_dealt_multiplier, 0) + 1;
    if (gauge >= 80) next.clash_power = numberOr(next.clash_power, 0) + 1;
    if (gauge >= 90) next.final_power = numberOr(next.final_power, 0) + 1;
    return next;
  }

  function handleRoundPhase(phaseTag, allUnits = []) {
    const units = Array.isArray(allUnits) ? allUnits : [];
    if (phaseTag === "[Round Start]") {
      units.forEach((unit) => gainShield(unit));
      return;
    }
    if (phaseTag !== "[Round End]") return;
    units.forEach((unit) => {
      if (!hasGaugeTrait(unit)) return;
      if (unit.__halfDemonDealtDamageThisTurn !== true) changeGauge(unit, -20);
      unit.__halfDemonDealtDamageThisTurn = false;
    });
  }

  function installCombatBridge() {
    ensureStatusDefinition();
    const engine = combatEngine();
    if (!engine) return false;
    if (engine.__halfDemonCombatRuntimeInstalled) return true;

    if (typeof engine.triggerEvent === "function") {
      const source = engine.triggerEvent;
      const wrapped = function (tag, context, targetsHit) {
        const result = source.call(this, tag, context, targetsHit);
        handleCombatTag(tag, context || {});
        return result;
      };
      Object.defineProperty(wrapped, "__halfDemonCombatRuntime", { value: true });
      engine.triggerEvent = wrapped;
    }

    if (typeof engine.applyDamage === "function") {
      const source = engine.applyDamage;
      const wrapped = function (unit, damage, tipoDano = "directo", ...rest) {
        const result = source.call(this, unit, damage, tipoDano, ...rest);
        if (normalizeId(tipoDano) === "directo") changeGauge(unit, -5);
        return result;
      };
      Object.defineProperty(wrapped, "__halfDemonCombatRuntime", { value: true });
      engine.applyDamage = wrapped;
    }

    if (typeof engine.applyPassiveModifiers === "function") {
      const source = engine.applyPassiveModifiers;
      const wrapped = function (unit, contextOptions) {
        return applyThresholdModifiers(unit, source.call(this, unit, contextOptions) || {});
      };
      Object.defineProperty(wrapped, "__halfDemonCombatRuntime", { value: true });
      engine.applyPassiveModifiers = wrapped;
    }

    if (typeof engine.triggerPhase === "function") {
      const source = engine.triggerPhase;
      const wrapped = function (phaseTag, allUnits) {
        const result = source.call(this, phaseTag, allUnits);
        handleRoundPhase(phaseTag, allUnits);
        return result;
      };
      Object.defineProperty(wrapped, "__halfDemonCombatRuntime", { value: true });
      engine.triggerPhase = wrapped;
    }

    Object.defineProperty(engine, "__halfDemonCombatRuntimeInstalled", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({
    STATUS_ID,
    GAUGE_TRAIT_ID,
    TRIGGER_TRAIT_ID,
    MAX_GAUGE,
    ensureStatusDefinition,
    gaugeValue,
    setGauge,
    changeGauge,
    hasGaugeTrait,
    hasTriggerTrait,
    gainShield,
    applyThresholdModifiers,
    handleCombatTag,
    handleRoundPhase,
    installCombatBridge,
  });

  global.LuminousHalfDemonCombatRuntime = api;
  ensureStatusDefinition();
  installCombatBridge();

  if (global.document && typeof global.setInterval === "function") {
    const retry = global.setInterval(() => {
      if (installCombatBridge()) global.clearInterval(retry);
    }, 100);
    global.setTimeout(() => global.clearInterval(retry), 10000);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
