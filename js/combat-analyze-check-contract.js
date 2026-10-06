(function (global) {
  "use strict";

  if (global.LuminousCombatAnalyzeCheckContract) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCombatAnalyzeCheckContract;
    return;
  }

  const VERSION = 1;
  const ACTION_IDS = Object.freeze(["analyze", "analyse"]);

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function numberOr(value, fallback = null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  function isAnalyzeAction(value) { return ACTION_IDS.includes(normalizeId(value)); }

  function rangerBypass(actor = {}, target = {}) {
    const runtime = global.LuminousRangerClassRuntime;
    if (!runtime?.resolveAnalyse) return null;
    const result = runtime.resolveAnalyse(actor, target) || {};
    if (result.bypassCheck !== true && result.automaticSuccess !== true) return null;
    return Object.freeze({
      bypass: true,
      automaticSuccess: true,
      source: "ranger_favored_enemy",
      sourceTraitId: result.sourceTraitId || "favored_enemy",
      raw: result,
    });
  }

  function battleMasterBypass(actor = {}, context = {}) {
    const provided = context.knowYourEnemyRequest || context.analyseFeatureUnlock || null;
    let request = provided;
    const runtime = global.LuminousBattleMasterArchetypeRuntime;
    if (!request && runtime?.knowYourEnemyRequest) {
      request = runtime.knowYourEnemyRequest(
        actor,
        context.turnNumber ?? context.turn ?? context.currentTurn,
        context.observedEnemyType ?? context.enemyType ?? null,
      );
    }
    if (!request || request.bypassAnalyseCheck !== true) return null;
    return Object.freeze({
      bypass: true,
      automaticSuccess: true,
      source: "battle_master_know_your_enemy",
      sourceTraitId: request.sourceTraitId || "know_your_enemy",
      unlockFeatures: Number(request.unlockFeatures || 1),
      advanceObservationLevel: request.advanceObservationLevel === true,
      useExistingObservationTarget: request.useExistingObservationTarget !== false,
      raw: request,
    });
  }

  function resolveBypass(actor = {}, target = {}, context = {}) {
    return rangerBypass(actor, target) || battleMasterBypass(actor, context) || null;
  }

  function genericCheck(options = {}) {
    const threshold = numberOr(options.threshold ?? options.dc, null);
    return Object.freeze({
      type: "check",
      check: Object.freeze({
        stat: "wis",
        skill: "perception",
        threshold,
      }),
      automaticSuccess: false,
      bypassCheck: false,
      source: "generic_analyze",
    });
  }

  function resolveAnalyzeContract(actor = {}, target = {}, options = {}) {
    const bypass = resolveBypass(actor, target, options);
    if (bypass) {
      return Object.freeze({
        type: "automatic",
        automaticSuccess: true,
        bypassCheck: true,
        source: bypass.source,
        sourceTraitId: bypass.sourceTraitId,
        bypass,
      });
    }
    return genericCheck(options);
  }

  const API = Object.freeze({
    VERSION,
    ACTION_IDS,
    normalizeId,
    isAnalyzeAction,
    rangerBypass,
    battleMasterBypass,
    resolveBypass,
    genericCheck,
    resolveAnalyzeContract,
  });

  global.LuminousCombatAnalyzeCheckContract = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
