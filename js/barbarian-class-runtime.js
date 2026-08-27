(function (global) {
  "use strict";

  if (global.LuminousBarbarianClassRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBarbarianClassRuntime;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");

  function isGuardSkill(skill = {}) {
    if (!skill || typeof skill !== "object") return false;
    const subtype = normalizeId(skill.defenseSubtype || skill.defense_subtype || skill.type);
    return subtype === "guard" || subtype === "clashableguard";
  }

  function installCombatBridge(engine = global.CombatEngine) {
    if (!engine) return false;
    if (engine.__barbarianClassLevelGuardPatched) return true;

    // Armorless Defense no longer modifies Guard Power or Guard Shield.
    // Keep this compatibility marker/API so older loaders and tests can call the bridge safely.
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
