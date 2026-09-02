(function (global) {
  "use strict";

  const BRIDGE_FLAG = "__luminousCombatActionPowerBridge";

  function installCombatActionPowerBridge(engine) {
    const target = engine || global.CombatEngine;
    if (!target || typeof target.calculateFinalPower !== "function") return { installed: false, reason: "combat_engine_unavailable" };
    if (target[BRIDGE_FLAG]) return { installed: true, alreadyInstalled: true, engine: target };

    const original = target.calculateFinalPower;
    target.calculateFinalPower = function (skill, headsFlipped, unit) {
      const value = original.call(this, skill, headsFlipped, unit);
      const bonus = Number(skill?.__combatActionFinalPowerBonus || 0);
      return Number.isFinite(bonus) ? value + bonus : value;
    };
    Object.defineProperty(target, BRIDGE_FLAG, {
      value: { originalCalculateFinalPower: original },
      configurable: true,
      enumerable: false,
    });
    return { installed: true, alreadyInstalled: false, engine: target };
  }

  function uninstallCombatActionPowerBridge(engine) {
    const target = engine || global.CombatEngine;
    const state = target?.[BRIDGE_FLAG];
    if (!target || !state?.originalCalculateFinalPower) return false;
    target.calculateFinalPower = state.originalCalculateFinalPower;
    try { delete target[BRIDGE_FLAG]; } catch (_) {}
    return true;
  }

  const api = Object.freeze({ installCombatActionPowerBridge, uninstallCombatActionPowerBridge });
  global.LuminousCombatActionEngineBridge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
