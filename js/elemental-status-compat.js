(function (global) {
  "use strict";

  if (global.LuminousElementalStatusCompatibility) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const state = {
    units: [],
    lastCombatState: null,
    encounterEndedWhileActive: false,
  };

  function ensureStatusLibrary() {
    if (global.LuminousStatusLibrary) {
      global.LuminousStatusLibrary.install?.();
      global.LuminousStatusLibrary.installStatusEngineBridge?.();
      return true;
    }
    const doc = global.document;
    if (!doc || doc.getElementById("status-library-script")) return false;
    const script = doc.createElement("script");
    script.id = "status-library-script";
    script.src = "js/status-library.js";
    script.async = false;
    script.dataset.engine = "canonical-status-library";
    script.addEventListener("load", () => {
      global.LuminousStatusLibrary?.install?.();
      global.LuminousStatusLibrary?.installStatusEngineBridge?.();
    }, { once:true });
    doc.head?.appendChild(script);
    return true;
  }

  function protectionFor(unit, statusId, options = {}) {
    const id = global.LuminousStatusLibrary?.resolveId?.(statusId) || normalizeId(statusId);
    return options.protectedStatuses?.[id]
      || unit?.statusProtections?.[id]
      || unit?.protectedStatuses?.[id]
      || null;
  }

  function isRemovalBlocked(unit, statusId, options = {}) {
    const protection = protectionFor(unit, statusId, options);
    if (!protection || options.ignoreProtection) return { blocked: false, protection };
    const source = normalizeId(options.from || "effects");
    const protectionSource = normalizeId(protection?.from || protection?.source || "effects");
    const blocked = protectionSource === "all"
      || protectionSource === source
      || (protectionSource === "effects" && source !== "self");
    return { blocked, protection };
  }

  function patchStatusProtection() {
    const source = global.LuminousStatusEngine;
    if (!source?.__elementalStatusRuntimeBridge) return false;
    if (source.__elementalStatusProtectionCompat) return true;

    const wrapped = Object.freeze({
      ...source,
      __elementalStatusProtectionCompat: true,
      removeStatus(unit, statusId, options = {}) {
        const id = global.LuminousStatusLibrary?.resolveId?.(statusId) || normalizeId(statusId);
        const protectionCheck = isRemovalBlocked(unit, id, options);
        if (protectionCheck.blocked) {
          return {
            removed: false,
            protected: true,
            statusId: id,
            protection: protectionCheck.protection ? JSON.parse(JSON.stringify(protectionCheck.protection)) : null,
          };
        }
        return source.removeStatus(unit, id, options);
      },
    });

    global.LuminousStatusEngine = wrapped;
    global.LuminousStatusLibrary?.installStatusEngineBridge?.();
    return true;
  }

  function rememberUnits(allUnits) {
    if (Array.isArray(allUnits)) state.units = allUnits;
    return state.units;
  }

  function patchEncounterLifecycle() {
    const engine = global.CombatEngine;
    const runtime = global.LuminousElementalStatusRuntime;
    if (!engine || !runtime) return false;
    if (engine.__elementalEncounterCompat) return true;

    const originalStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalEnd = typeof engine.triggerEncounterEnd === "function" ? engine.triggerEncounterEnd : null;
    const originalPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;

    if (originalStart) {
      engine.triggerEncounterStart = function (allUnits = [], ...rest) {
        rememberUnits(allUnits);
        state.encounterEndedWhileActive = false;
        state.lastCombatState = "combat_active";
        return originalStart.call(this, allUnits, ...rest);
      };
    }

    if (originalPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        rememberUnits(allUnits);
        return originalPhase.call(this, phaseTag, allUnits, ...rest);
      };
    }

    if (originalEnd) {
      engine.triggerEncounterEnd = function (allUnits = state.units, ...rest) {
        rememberUnits(allUnits);
        const result = originalEnd.call(this, allUnits, ...rest);
        state.encounterEndedWhileActive = true;
        return result;
      };
    }

    Object.defineProperty(engine, "__elementalEncounterCompat", { value: true, configurable: true });
    state.lastCombatState = normalizeId(engine.currentState || state.lastCombatState);
    return true;
  }

  function observeEncounterState() {
    const engine = global.CombatEngine;
    const runtime = global.LuminousElementalStatusRuntime;
    if (!engine || !runtime) return false;

    const current = normalizeId(engine.currentState);
    const previous = normalizeId(state.lastCombatState);

    if (previous === "combat_active" && current && current !== "combat_active") {
      if (!state.encounterEndedWhileActive) runtime.onEncounterEnd(state.units);
      state.encounterEndedWhileActive = false;
    } else if (previous !== "combat_active" && current === "combat_active") {
      state.encounterEndedWhileActive = false;
    }

    if (current) state.lastCombatState = current;
    return true;
  }

  function ensureBattleViewer074() {
    const doc = global.document;
    if (!doc || !global.CombatEngine) return false;
    if (!doc.getElementById("battlefield") || !doc.getElementById("combat-log-terminal")) return false;
    if (global.LuminousBattleViewerRuntime074 || doc.getElementById("battle-viewer-runtime-074-script")) return true;
    const script = doc.createElement("script");
    script.id = "battle-viewer-runtime-074-script";
    script.src = "js/battle-viewer-runtime-074.js";
    script.async = false;
    script.dataset.engine = "battle-viewer-runtime-074";
    doc.head?.appendChild(script);
    return true;
  }

  function install() {
    ensureStatusLibrary();
    global.LuminousStatusLibrary?.install?.();
    global.LuminousStatusLibrary?.installStatusEngineBridge?.();
    patchStatusProtection();
    patchEncounterLifecycle();
    observeEncounterState();
    ensureBattleViewer074();
  }

  const api = Object.freeze({
    ensureStatusLibrary,
    protectionFor,
    isRemovalBlocked,
    patchStatusProtection,
    patchEncounterLifecycle,
    observeEncounterState,
    ensureBattleViewer074,
    install,
    state,
  });

  global.LuminousElementalStatusCompatibility = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, 250) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
