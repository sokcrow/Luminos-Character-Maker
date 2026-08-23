(function (global) {
  "use strict";

  if (!global.document || global.LuminousCombatViewerRuntimeBridge) return;

  function viewerCombatData() {
    if (global.combatData && typeof global.combatData === "object") return global.combatData;
    try {
      if (typeof global.eval === "function") {
        const value = global.eval("typeof combatData !== 'undefined' ? combatData : null");
        if (value && typeof value === "object") return value;
      }
    } catch (_) {}
    return null;
  }

  function syncExistingCombatants() {
    const data = viewerCombatData();
    if (!data) return 0;
    const units = Object.values(data).filter(Boolean);
    const traits = global.LuminousTraitStandardizationRuntime;
    const speed = global.LuminousUniversalSpeedRuntime;
    units.forEach((unit) => {
      traits?.registerCombatUnit?.(unit);
      speed?.decorateSpeed?.(unit);
    });
    traits?.installViewerEncounterBridge?.();
    return units.length;
  }

  const api = Object.freeze({ viewerCombatData, syncExistingCombatants });
  global.LuminousCombatViewerRuntimeBridge = api;

  syncExistingCombatants();
  global.setInterval?.(syncExistingCombatants, 500);
})(window);
