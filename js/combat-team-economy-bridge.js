(function (global) {
  "use strict";

  if (global.LuminousCombatTeamEconomyBridge) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCombatTeamEconomyBridge;
    return;
  }

  function director() {
    if (global.LuminousTeamActionEconomy) return global.LuminousTeamActionEconomy;
    if (typeof require === "function") {
      try { return require("./team-action-economy.js"); } catch (_) {}
    }
    return null;
  }

  function allActiveUnits(encounter) {
    if (!encounter) return [];
    return [
      ...(encounter.allies?.active || []).map((profile) => profile.unit),
      ...(encounter.enemies?.active || []).map((profile) => profile.unit),
    ].filter(Boolean);
  }

  function install(engine = global.CombatEngine) {
    if (!engine || typeof engine !== "object") return { installed: false, reason: "combat_engine_unavailable" };
    if (engine.__luminousTeamEconomyInstalled) return { installed: true, engine };

    engine.createTeamEconomyEncounter = function createTeamEconomyEncounter(config = {}) {
      const api = director();
      if (!api) return null;
      const encounter = api.createEncounter(config);
      this.teamActionEncounter = encounter;
      this.currentState = "PRE_COMBAT_PLANNING";
      const unitEconomy = global.LuminousActionEconomy;
      if (unitEconomy) allActiveUnits(encounter).forEach((unit) => unitEconomy.beginPlanning?.(unit));
      return api.snapshot(encounter);
    };

    engine.getTeamEconomyEncounter = function getTeamEconomyEncounter() {
      return this.teamActionEncounter || null;
    };

    engine.getTeamEconomySnapshot = function getTeamEconomySnapshot() {
      const api = director();
      return api && this.teamActionEncounter ? api.snapshot(this.teamActionEncounter) : null;
    };

    engine.consumeTeamQuickAction = function consumeTeamQuickAction(side) {
      const api = director();
      if (!api || !this.teamActionEncounter) return { consumed: false, reason: "team_economy_unavailable" };
      return api.consumeQuickAction(this.teamActionEncounter, side);
    };

    engine.consumeTeamHelp = function consumeTeamHelp(side) {
      const api = director();
      if (!api || !this.teamActionEncounter) return { consumed: false, reason: "team_economy_unavailable" };
      return api.consumeHelp(this.teamActionEncounter, side);
    };

    engine.lockTeamActionSlots = function lockTeamActionSlots(unitOrId, count = 1, reason = "status") {
      const api = director();
      if (!api || !this.teamActionEncounter) return { locked: false, reason: "team_economy_unavailable" };
      return api.lockUnitSlots(this.teamActionEncounter, unitOrId, count, reason);
    };

    engine.unlockTeamActionSlots = function unlockTeamActionSlots(unitOrId, count = 1) {
      const api = director();
      if (!api || !this.teamActionEncounter) return false;
      return api.unlockUnitSlots(this.teamActionEncounter, unitOrId, count);
    };

    engine.queueTurnEndCombatAction = function queueTurnEndCombatAction(entry = {}) {
      const api = director();
      if (!api || !this.teamActionEncounter) return null;
      return api.queueTurnEndAction(this.teamActionEncounter, entry);
    };

    engine.cancelTurnEndCombatActionsForUnit = function cancelTurnEndCombatActionsForUnit(unitOrId, reason = "cancelled") {
      const api = director();
      if (!api || !this.teamActionEncounter) return 0;
      return api.cancelTurnEndActionsForUnit(this.teamActionEncounter, unitOrId, reason);
    };

    engine.markPlayerPlanningReady = function markPlayerPlanningReady(options = {}) {
      const api = director();
      if (!api || !this.teamActionEncounter) return { ready: false, reason: "team_economy_unavailable" };
      const result = api.playerReady(this.teamActionEncounter, { aiPlanner: options.aiPlanner });
      if (!result.ready) return result;

      const finishAi = (aiResult) => {
        if (options.autoStartCombat === false) return { ...result, aiResult };
        const aiReady = api.aiReady(this.teamActionEncounter);
        if (aiReady.ready) {
          this.currentState = "COMBAT_ACTIVE";
          const unitEconomy = global.LuminousActionEconomy;
          if (unitEconomy) allActiveUnits(this.teamActionEncounter).forEach((unit) => unitEconomy.beginCombat?.(unit));
        }
        return { ...result, aiResult, aiReady, phase: this.teamActionEncounter.phase };
      };

      if (result.aiResult && typeof result.aiResult.then === "function") return result.aiResult.then(finishAi);
      return finishAi(result.aiResult);
    };

    engine.markAiPlanningReady = function markAiPlanningReady() {
      const api = director();
      if (!api || !this.teamActionEncounter) return { ready: false, reason: "team_economy_unavailable" };
      const result = api.aiReady(this.teamActionEncounter);
      if (result.ready) {
        this.currentState = "COMBAT_ACTIVE";
        const unitEconomy = global.LuminousActionEconomy;
        if (unitEconomy) allActiveUnits(this.teamActionEncounter).forEach((unit) => unitEconomy.beginCombat?.(unit));
      }
      return result;
    };

    engine.beginTeamTurnEnd = function beginTeamTurnEnd() {
      const api = director();
      if (!api || !this.teamActionEncounter) return { started: false, reason: "team_economy_unavailable" };
      return api.beginTurnEnd(this.teamActionEncounter);
    };

    engine.endTeamRound = function endTeamRound(handlers = {}) {
      const api = director();
      if (!api || !this.teamActionEncounter) return { ended: false, reason: "team_economy_unavailable" };
      const result = api.endRound(this.teamActionEncounter, handlers);
      if (result.ended) {
        this.currentState = "PRE_COMBAT_PLANNING";
        const unitEconomy = global.LuminousActionEconomy;
        if (unitEconomy) allActiveUnits(this.teamActionEncounter).forEach((unit) => unitEconomy.beginPlanning?.(unit));
      }
      return result;
    };

    Object.defineProperty(engine, "__luminousTeamEconomyInstalled", { value: true, configurable: true, enumerable: false });
    return { installed: true, engine };
  }

  const api = Object.freeze({ director, allActiveUnits, install });
  global.LuminousCombatTeamEconomyBridge = api;
  if (global.CombatEngine) install(global.CombatEngine);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
