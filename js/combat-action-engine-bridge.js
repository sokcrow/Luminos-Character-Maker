(function (global) {
  "use strict";

  const BRIDGE_FLAG = "__luminousCombatActionPowerBridge";
  const NO_FLANK_FLAG = "__luminousLegacyFlankingRemoved";

  function removeLegacyFlanking(engine) {
    const target = engine || global.CombatEngine;
    if (!target) return { removed: false, reason: "combat_engine_unavailable" };
    if (target[NO_FLANK_FLAG]) return { removed: true, alreadyRemoved: true, engine: target };

    // v0.7.3 has no flanking mechanic. Keep tactical/grid position available for
    // movement and AoE geometry, but it must never modify Power or Damage.
    try { delete target.FLANKING_DAMAGE_MULTIPLIER; } catch (_) { target.FLANKING_DAMAGE_MULTIPLIER = undefined; }
    try { delete target.FLANKING_POWER_BONUS; } catch (_) { target.FLANKING_POWER_BONUS = undefined; }
    if (typeof target.evaluateFlanking === "function") target.evaluateFlanking = () => false;

    Object.defineProperty(target, NO_FLANK_FLAG, {
      value: true,
      configurable: false,
      enumerable: false,
    });
    return { removed: true, alreadyRemoved: false, engine: target };
  }

  function installCombatActionPowerBridge(engine) {
    const target = engine || global.CombatEngine;
    if (!target || typeof target.calculateFinalPower !== "function") return { installed: false, reason: "combat_engine_unavailable" };
    removeLegacyFlanking(target);
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
    // Flanking is intentionally not restored: it is not part of the v0.7.3 ruleset.
    return true;
  }

  const api = Object.freeze({ removeLegacyFlanking, installCombatActionPowerBridge, uninstallCombatActionPowerBridge });
  global.LuminousCombatActionEngineBridge = api;
  if (global.CombatEngine) removeLegacyFlanking(global.CombatEngine);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
