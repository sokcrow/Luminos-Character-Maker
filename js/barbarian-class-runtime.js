(function (global) {
  "use strict";

  if (global.LuminousBarbarianClassRuntime) return;

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");

  function isGuardSkill(skill = {}) {
    if (!skill || typeof skill !== "object") return false;
    const subtype = normalizeId(skill.defenseSubtype || skill.defense_subtype || skill.type);
    return subtype === "guard" || subtype === "clashableguard";
  }

  function guardState(unit = {}) {
    return unit?.guard && typeof unit.guard === "object" ? unit.guard : {};
  }

  function installCombatBridge(engine = global.CombatEngine) {
    if (!engine || engine.__barbarianClassLevelGuardPatched) return Boolean(engine);

    const originalCalculateFinalPower = engine.calculateFinalPower;
    const originalResolveGuard = engine.resolveGuard;
    if (typeof originalCalculateFinalPower !== "function" || typeof originalResolveGuard !== "function") return false;

    engine.calculateFinalPower = function (skill, headsFlipped, unit = null) {
      const result = originalCalculateFinalPower.call(this, skill, headsFlipped, unit);
      if (!unit || !isGuardSkill(skill)) return result;
      return result + numberOr(guardState(unit).powerBonus, 0);
    };

    engine.resolveGuard = function (unitDefender, guardSkill) {
      const shieldBefore = numberOr(unitDefender?.shield, 0);
      const result = originalResolveGuard.call(this, unitDefender, guardSkill);
      if (!result || !unitDefender) return result;

      const shieldPercent = Math.max(0, numberOr(guardState(unitDefender).shieldPercent, 0));
      if (shieldPercent <= 0) return result;

      const baseShieldGain = Math.max(0, numberOr(unitDefender.shield, shieldBefore) - shieldBefore);
      const shieldBonus = baseShieldGain * shieldPercent / 100;
      unitDefender.shield = numberOr(unitDefender.shield, shieldBefore) + shieldBonus;

      return {
        ...result,
        shieldPercentBonus: shieldPercent,
        shieldBonus,
        newShieldAmount: unitDefender.shield,
      };
    };

    Object.defineProperty(engine, "__barbarianClassLevelGuardPatched", {
      value: true,
      enumerable: false,
      configurable: true,
    });
    return true;
  }

  const api = Object.freeze({
    isGuardSkill,
    installCombatBridge,
  });

  global.LuminousBarbarianClassRuntime = api;
  installCombatBridge();

  if (typeof document !== "undefined" && !global.CombatEngine) {
    let attempts = 0;
    const timer = global.setInterval?.(() => {
      attempts += 1;
      if (installCombatBridge() || attempts >= 40) global.clearInterval?.(timer);
    }, 250);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
