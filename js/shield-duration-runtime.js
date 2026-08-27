(function (global) {
  "use strict";

  if (global.LuminousShieldDurationRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShieldDurationRuntime;
    return;
  }

  const SHIELD_TYPES = Object.freeze({
    EPHEMERAL: "ephemeral",
    ENCOUNTER: "encounter",
    PERSISTENT: "persistent",
  });
  const CONSUMPTION_ORDER = Object.freeze([
    SHIELD_TYPES.EPHEMERAL,
    SHIELD_TYPES.ENCOUNTER,
    SHIELD_TYPES.PERSISTENT,
  ]);

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeType = (value, fallback = SHIELD_TYPES.PERSISTENT) => {
    const type = String(value || "").trim().toLowerCase();
    return Object.values(SHIELD_TYPES).includes(type) ? type : fallback;
  };
  const totalPools = (pools = {}) => CONSUMPTION_ORDER.reduce((sum, type) => sum + Math.max(0, numberOr(pools[type], 0)), 0);

  function consumePoolsRaw(pools, amount) {
    let remaining = Math.max(0, numberOr(amount, 0));
    let consumed = 0;
    CONSUMPTION_ORDER.forEach((type) => {
      if (remaining <= 0) return;
      const available = Math.max(0, numberOr(pools[type], 0));
      const used = Math.min(available, remaining);
      pools[type] = available - used;
      remaining -= used;
      consumed += used;
    });
    return { consumed, remaining };
  }

  function ensurePools(unit = {}) {
    if (!unit || typeof unit !== "object") return { ephemeral: 0, encounter: 0, persistent: 0 };
    const raw = unit.shieldPools && typeof unit.shieldPools === "object" ? unit.shieldPools : {};
    const pools = {
      ephemeral: Math.max(0, numberOr(raw.ephemeral, 0)),
      encounter: Math.max(0, numberOr(raw.encounter, 0)),
      persistent: Math.max(0, numberOr(raw.persistent, 0)),
    };

    const tracked = totalPools(pools);
    const visible = Math.max(0, numberOr(unit.shield, tracked));
    if (visible > tracked) {
      // Backward compatibility: old or untyped Shield is the safest when preserved between encounters.
      pools.persistent += visible - tracked;
    } else if (visible < tracked) {
      // If legacy code reduced the aggregate directly, mirror that reduction into the typed pools.
      consumePoolsRaw(pools, tracked - visible);
    }

    unit.shieldPools = pools;
    unit.shield = totalPools(pools);
    return pools;
  }

  function syncShield(unit = {}) {
    const pools = ensurePools(unit);
    unit.shield = totalPools(pools);
    return unit.shield;
  }

  function gainShield(unit = {}, amount = 0, type = SHIELD_TYPES.PERSISTENT) {
    if (!unit || typeof unit !== "object") return 0;
    const pools = ensurePools(unit);
    const shieldType = normalizeType(type);
    const gain = Math.max(0, numberOr(amount, 0));
    pools[shieldType] += gain;
    unit.shield = totalPools(pools);
    return gain;
  }

  function consumeShield(unit = {}, amount = 0) {
    if (!unit || typeof unit !== "object") return { consumed: 0, remaining: Math.max(0, numberOr(amount, 0)), shield: 0 };
    const pools = ensurePools(unit);
    const result = consumePoolsRaw(pools, amount);
    unit.shield = totalPools(pools);
    return { ...result, shield: unit.shield };
  }

  function expireShield(unit = {}, type) {
    if (!unit || typeof unit !== "object") return 0;
    const pools = ensurePools(unit);
    const shieldType = normalizeType(type, null);
    if (!shieldType) return unit.shield;
    pools[shieldType] = 0;
    unit.shield = totalPools(pools);
    return unit.shield;
  }

  function shieldBreakdown(unit = {}) {
    const pools = ensurePools(unit);
    return Object.freeze({
      ephemeral: pools.ephemeral,
      encounter: pools.encounter,
      persistent: pools.persistent,
      total: unit.shield,
    });
  }

  function installCombatBridge(engine = global.CombatEngine) {
    if (!engine || typeof engine !== "object") return false;
    if (engine.__shieldDurationRuntimePatched) return true;

    const originalInitializeUnitData = engine.initializeUnitData;
    const originalResolveGuard = engine.resolveGuard;
    const originalApplyDamage = engine.applyDamage;
    const originalTriggerPhase = engine.triggerPhase;
    const originalTriggerEncounterStart = engine.triggerEncounterStart;

    if (typeof originalInitializeUnitData === "function") {
      engine.initializeUnitData = function (unit) {
        const result = originalInitializeUnitData.call(this, unit);
        ensurePools(unit);
        return result;
      };
    }

    if (typeof originalResolveGuard === "function") {
      engine.resolveGuard = function (unitDefender, guardSkill) {
        const pools = ensurePools(unitDefender);
        const before = totalPools(pools);
        const result = originalResolveGuard.call(this, unitDefender, guardSkill);
        const afterLegacy = Math.max(0, numberOr(unitDefender?.shield, before));
        const gained = Math.max(0, afterLegacy - before);
        pools.ephemeral += gained;
        unitDefender.shield = totalPools(pools);
        return result && typeof result === "object"
          ? { ...result, newShieldAmount: unitDefender.shield, shieldType: SHIELD_TYPES.EPHEMERAL }
          : result;
      };
    }

    if (typeof originalApplyDamage === "function") {
      engine.applyDamage = function (unit, damage, tipoDaño, isCritical, skillUsed) {
        const pools = ensurePools(unit);
        const before = totalPools(pools);
        const result = originalApplyDamage.call(this, unit, damage, tipoDaño, isCritical, skillUsed);
        const afterLegacy = Math.max(0, numberOr(unit?.shield, before));
        const absorbed = Math.max(0, before - afterLegacy);
        if (absorbed > 0) consumePoolsRaw(pools, absorbed);
        unit.shield = totalPools(pools);
        return result && typeof result === "object" ? { ...result, shield: unit.shield } : result;
      };
    }

    if (typeof originalTriggerPhase === "function") {
      engine.triggerPhase = function (phaseTag, allUnits) {
        if (Array.isArray(allUnits)) {
          if (phaseTag === "[Round Start]") {
            allUnits.forEach((unit) => expireShield(unit, SHIELD_TYPES.EPHEMERAL));
          } else if (phaseTag === "[Encounter End]") {
            allUnits.forEach((unit) => {
              expireShield(unit, SHIELD_TYPES.EPHEMERAL);
              expireShield(unit, SHIELD_TYPES.ENCOUNTER);
            });
          }
        }
        return originalTriggerPhase.call(this, phaseTag, allUnits);
      };
    }

    if (typeof originalTriggerEncounterStart === "function") {
      engine.triggerEncounterStart = function (allUnits) {
        if (Array.isArray(allUnits)) {
          allUnits.forEach((unit) => {
            // Safety cleanup for a previous encounter that ended without an explicit Encounter End hook.
            expireShield(unit, SHIELD_TYPES.EPHEMERAL);
            expireShield(unit, SHIELD_TYPES.ENCOUNTER);
          });
        }
        return originalTriggerEncounterStart.call(this, allUnits);
      };
    }

    engine.gainShield = gainShield;
    engine.consumeShield = consumeShield;
    engine.expireShield = expireShield;
    engine.shieldBreakdown = shieldBreakdown;

    Object.defineProperty(engine, "__shieldDurationRuntimePatched", {
      value: true,
      enumerable: false,
      configurable: true,
    });
    return true;
  }

  function boot() {
    if (installCombatBridge()) return;
    let attempts = 0;
    const timer = global.setInterval?.(() => {
      attempts += 1;
      if (installCombatBridge() || attempts >= 40) global.clearInterval?.(timer);
    }, 250);
  }

  const api = Object.freeze({
    SHIELD_TYPES,
    CONSUMPTION_ORDER,
    ensurePools,
    syncShield,
    gainShield,
    consumeShield,
    expireShield,
    shieldBreakdown,
    installCombatBridge,
  });

  global.LuminousShieldDurationRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") boot();
})(typeof window !== "undefined" ? window : globalThis);
