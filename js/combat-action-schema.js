(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;

  const PHASES = Object.freeze({
    ON_TURN_START: "on_turn_start",
    PLANNING_PHASE_PLAYER: "planning_phase_player",
    PLANNING_PHASE_AI: "planning_phase_ai",
    COMBAT_START: "combat_start",
    COMBAT_PHASE: "combat_phase",
    COMBAT_END: "combat_end",
    ON_TURN_END: "on_turn_end",
  });

  const ECONOMY_COSTS = Object.freeze({
    ACTION: "action",
    QUICK_ACTION: "quick_action",
    REACTION: "reaction",
  });

  const SOURCE_TYPES = Object.freeze(["skill", "spell", "trait", "universal", "item"]);
  const RESOLUTION_TYPES = Object.freeze(["clash", "unopposed", "save", "check", "contest", "automatic"]);
  const TARGET_MODES = Object.freeze(["self", "single", "multi", "aoe", "indiscriminate"]);
  const TARGET_ALLEGIANCE = Object.freeze(["self", "ally", "enemy", "neutral"]);
  const ACTION_STATES = Object.freeze(["planned", "locked", "resolving", "resolved", "cancelled"]);

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function normalizePhase(value, fallback = PHASES.COMBAT_PHASE) {
    const id = normalizeId(value);
    const aliases = {
      on_turn_start: PHASES.ON_TURN_START,
      turn_start: PHASES.ON_TURN_START,
      round_start: PHASES.ON_TURN_START,
      planning_phase_player: PHASES.PLANNING_PHASE_PLAYER,
      planning_player: PHASES.PLANNING_PHASE_PLAYER,
      player_planning: PHASES.PLANNING_PHASE_PLAYER,
      planning: PHASES.PLANNING_PHASE_PLAYER,
      planning_phase_ai: PHASES.PLANNING_PHASE_AI,
      playing_phase_ai: PHASES.PLANNING_PHASE_AI,
      planning_ai: PHASES.PLANNING_PHASE_AI,
      ai_planning: PHASES.PLANNING_PHASE_AI,
      combat_start: PHASES.COMBAT_START,
      combat_phase: PHASES.COMBAT_PHASE,
      combat: PHASES.COMBAT_PHASE,
      combat_end: PHASES.COMBAT_END,
      on_turn_end: PHASES.ON_TURN_END,
      turn_end: PHASES.ON_TURN_END,
      round_end: PHASES.ON_TURN_END,
    };
    return aliases[id] || fallback;
  }

  function normalizeEconomyCost(value) {
    const id = normalizeId(value || ECONOMY_COSTS.ACTION);
    return Object.values(ECONOMY_COSTS).includes(id) ? id : ECONOMY_COSTS.ACTION;
  }

  function normalizeSource(source = {}) {
    const type = normalizeId(source.type || source.sourceType || "universal");
    return {
      type: SOURCE_TYPES.includes(type) ? type : "universal",
      id: String(source.id ?? source.sourceId ?? "").trim(),
      definitionId: source.definitionId == null ? null : String(source.definitionId),
    };
  }

  function normalizeTargeting(targeting = {}) {
    const rawMode = normalizeId(targeting.mode || targeting.targetingMode || targeting.targetingType || "single");
    const rawAllegiance = normalizeId(targeting.allegiance || targeting.targetAllegiance || "enemy");
    const isIndiscriminate = targeting.indiscriminate === true || rawMode === "indiscriminate";
    const mode = isIndiscriminate ? "indiscriminate" : (TARGET_MODES.includes(rawMode) ? rawMode : "single");
    const allegiance = TARGET_ALLEGIANCE.includes(rawAllegiance) ? rawAllegiance : (mode === "self" ? "self" : "enemy");
    const mainTargetId = targeting.mainTargetId ?? targeting.targetId ?? null;
    const targetIds = asArray(targeting.targetIds).map(String).filter(Boolean);
    if (mainTargetId != null && !targetIds.includes(String(mainTargetId))) targetIds.unshift(String(mainTargetId));
    return {
      allegiance,
      mode,
      mainTargetId: mainTargetId == null ? null : String(mainTargetId),
      targetIds,
      attackWeight: Math.max(1, finiteInt(targeting.attackWeight ?? targeting.atkWeight, 1)),
      indiscriminate: isIndiscriminate,
      criteria: targeting.criteria && typeof targeting.criteria === "object" ? clone(targeting.criteria) : null,
    };
  }

  function normalizeResolution(resolution = {}) {
    const type = normalizeId(resolution.type || "automatic");
    const normalized = {
      ...clone(resolution),
      type: RESOLUTION_TYPES.includes(type) ? type : "automatic",
    };
    if (normalized.type === "save") {
      normalized.save = {
        abilityId: normalizeId(resolution.save?.abilityId || resolution.abilityId || resolution.stat),
        dc: finiteNumber(resolution.save?.dc ?? resolution.dc, 0),
        onSuccess: normalizeId(resolution.save?.onSuccess || resolution.onSuccess || "negates") || "negates",
      };
    }
    if (normalized.type === "check") {
      normalized.check = {
        stat: normalizeId(resolution.check?.stat || resolution.stat),
        skill: normalizeId(resolution.check?.skill || resolution.skill),
        threshold: finiteNumber(resolution.check?.threshold ?? resolution.threshold, 0),
      };
    }
    if (normalized.type === "contest") {
      normalized.contest = {
        attacker: clone(resolution.contest?.attacker || resolution.attacker || {}),
        defender: clone(resolution.contest?.defender || resolution.defender || {}),
        tieRule: normalizeId(resolution.contest?.tieRule || resolution.tieRule || "defender_wins") || "defender_wins",
      };
    }
    return normalized;
  }

  function normalizeResourceCost(resource = {}) {
    const type = normalizeId(resource.type || resource.resourceType);
    return {
      owner: normalizeId(resource.owner || "source") || "source",
      type,
      id: resource.id == null ? null : String(resource.id),
      amount: Math.max(0, finiteNumber(resource.amount ?? resource.value, 1)),
      metadata: resource.metadata && typeof resource.metadata === "object" ? clone(resource.metadata) : null,
    };
  }

  function createCombatAction(input = {}) {
    const actorId = String(input.actorId ?? input.actor?.id ?? input.actor?.unitId ?? "").trim();
    const actionSlotId = input.actionSlotId == null ? null : String(input.actionSlotId);
    const source = normalizeSource(input.source || input);
    const selectedAt = normalizePhase(input.phase?.selectedAt ?? input.selectedAt,
      input.isAi === true ? PHASES.PLANNING_PHASE_AI : PHASES.PLANNING_PHASE_PLAYER);
    const executesAt = normalizePhase(input.phase?.executesAt ?? input.executesAt, PHASES.COMBAT_PHASE);
    const action = {
      id: String(input.id || `${actorId || "unit"}_${source.type}_${normalizeId(source.id || "action")}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      schemaVersion: SCHEMA_VERSION,
      source,
      actorId,
      actionSlotId,
      economy: { cost: normalizeEconomyCost(input.economy?.cost ?? input.cost) },
      phase: { selectedAt, executesAt },
      targeting: normalizeTargeting(input.targeting || {}),
      resolution: normalizeResolution(input.resolution || {}),
      resources: asArray(input.resources).map(normalizeResourceCost).filter((entry) => entry.type),
      modifiers: asArray(input.modifiers).map(clone),
      effects: asArray(input.effects).map(clone),
      reaction: input.reaction && typeof input.reaction === "object" ? clone(input.reaction) : null,
      metadata: input.metadata && typeof input.metadata === "object" ? clone(input.metadata) : {},
      state: ACTION_STATES.includes(normalizeId(input.state)) ? normalizeId(input.state) : "planned",
      cancelReason: input.cancelReason ? clone(input.cancelReason) : null,
    };
    return action;
  }

  function normalizeCombatAction(input = {}) {
    return createCombatAction(input);
  }

  function validateCombatAction(input = {}) {
    const action = normalizeCombatAction(input);
    const errors = [];
    if (!action.actorId) errors.push("actorId_required");
    if (!action.source.id) errors.push("source_id_required");
    if (!SOURCE_TYPES.includes(action.source.type)) errors.push("invalid_source_type");
    if (!RESOLUTION_TYPES.includes(action.resolution.type)) errors.push("invalid_resolution_type");
    if (!Object.values(ECONOMY_COSTS).includes(action.economy.cost)) errors.push("invalid_economy_cost");
    if (!Object.values(PHASES).includes(action.phase.selectedAt) || !Object.values(PHASES).includes(action.phase.executesAt)) errors.push("invalid_phase");
    if (action.economy.cost === ECONOMY_COSTS.QUICK_ACTION && ![PHASES.PLANNING_PHASE_PLAYER, PHASES.PLANNING_PHASE_AI].includes(action.phase.executesAt)) {
      errors.push("quick_action_must_execute_in_planning");
    }
    if (action.economy.cost === ECONOMY_COSTS.REACTION && action.phase.executesAt !== PHASES.COMBAT_PHASE) errors.push("reaction_must_execute_in_combat_phase");
    if (action.resolution.type === "save" && !action.resolution.save?.abilityId) errors.push("save_ability_required");
    return { valid: errors.length === 0, errors, action };
  }

  function canReceiveHelp(input = {}) {
    const action = normalizeCombatAction(input);
    return action.resolution.type === "clash" || action.resolution.type === "check";
  }

  function applyHelpModifier(input = {}, options = {}) {
    const action = normalizeCombatAction(input);
    if (!canReceiveHelp(action)) return { applied: false, reason: "action_not_help_eligible", action };
    if (action.state === "cancelled" || action.state === "resolved") return { applied: false, reason: "action_not_pending", action };
    const existing = action.modifiers.some((modifier) => normalizeId(modifier?.source || modifier?.type) === "help_final_power");
    if (existing) return { applied: false, reason: "help_already_applied", action };
    action.modifiers.push({
      source: "help_final_power",
      type: "final_power",
      amount: finiteNumber(options.amount, 1),
      fromActorId: options.fromActorId || null,
      teamUse: true,
    });
    return { applied: true, action };
  }

  function setActionState(input = {}, nextState) {
    const action = normalizeCombatAction(input);
    const state = normalizeId(nextState);
    if (!ACTION_STATES.includes(state)) return { changed: false, reason: "invalid_state", action };
    if (action.state === "cancelled" || action.state === "resolved") return { changed: false, reason: "terminal_state", action };
    action.state = state;
    if (state !== "cancelled") action.cancelReason = null;
    return { changed: true, action };
  }

  function cancelCombatAction(input = {}, reason = {}) {
    const action = normalizeCombatAction(input);
    if (["resolved", "cancelled"].includes(action.state)) return { cancelled: false, reason: "terminal_state", action };
    action.state = "cancelled";
    action.cancelReason = typeof reason === "string" ? { type: normalizeId(reason) || "cancelled" } : clone(reason || { type: "cancelled" });
    return { cancelled: true, action };
  }

  function cancelPendingActions(actions = [], actorId, reason = { type: "stagger" }) {
    const id = String(actorId ?? "");
    return asArray(actions).map((raw) => {
      const action = normalizeCombatAction(raw);
      if (action.actorId !== id || ["resolved", "cancelled"].includes(action.state)) return action;
      return cancelCombatAction(action, reason).action;
    });
  }

  function validateResourcesContract(resources = []) {
    const errors = [];
    const normalized = asArray(resources).map(normalizeResourceCost);
    normalized.forEach((resource, index) => {
      if (!resource.type) errors.push(`resource_${index}_type_required`);
      if (resource.amount < 0) errors.push(`resource_${index}_amount_invalid`);
    });
    return { valid: errors.length === 0, errors, resources: normalized };
  }

  function targetIdOf(unit = {}) {
    return String(unit.id ?? unit.unitId ?? unit.characterId ?? "").trim();
  }

  function resolveTargetSelection(actionInput = {}, candidates = [], options = {}) {
    const action = normalizeCombatAction(actionInput);
    const targeting = action.targeting;
    const weight = Math.max(1, targeting.attackWeight);
    const list = asArray(candidates).filter(Boolean);
    const byId = new Map(list.map((unit) => [targetIdOf(unit), unit]).filter(([id]) => id));
    let mainTargetId = targeting.mainTargetId;
    let chosen = [];

    if (targeting.mode === "self") {
      return { action, mainTargetId: action.actorId, targetIds: [action.actorId] };
    }

    const candidateIds = list.map(targetIdOf).filter(Boolean);
    const random = typeof options.random === "function" ? options.random : Math.random;
    const randomPick = (pool) => pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : null;

    if (targeting.indiscriminate || targeting.mode === "indiscriminate") {
      mainTargetId = randomPick(candidateIds);
      const remaining = candidateIds.filter((id) => id !== mainTargetId);
      chosen = mainTargetId ? [mainTargetId] : [];
      while (chosen.length < weight && remaining.length) {
        const id = randomPick(remaining);
        chosen.push(id);
        remaining.splice(remaining.indexOf(id), 1);
      }
    } else {
      if (!mainTargetId || !byId.has(String(mainTargetId))) mainTargetId = targeting.targetIds.find((id) => byId.has(String(id))) || candidateIds[0] || null;
      chosen = mainTargetId ? [String(mainTargetId)] : [];
      for (const id of targeting.targetIds) {
        const value = String(id);
        if (chosen.length >= weight) break;
        if (byId.has(value) && !chosen.includes(value)) chosen.push(value);
      }
      for (const id of candidateIds) {
        if (chosen.length >= weight) break;
        if (!chosen.includes(id) && ["multi", "aoe"].includes(targeting.mode)) chosen.push(id);
      }
    }

    action.targeting.mainTargetId = mainTargetId == null ? null : String(mainTargetId);
    action.targeting.targetIds = chosen.slice(0, weight);
    return { action, mainTargetId: action.targeting.mainTargetId, targetIds: [...action.targeting.targetIds] };
  }

  function resolveAoeOutcome(actionInput = {}, mainClashWon) {
    const action = normalizeCombatAction(actionInput);
    const targets = [...action.targeting.targetIds];
    if (action.resolution.type === "save") {
      return { allowed: true, mode: "independent_saves", targetIds: targets };
    }
    if (["aoe", "multi", "indiscriminate"].includes(action.targeting.mode) && action.resolution.type === "clash") {
      return mainClashWon
        ? { allowed: true, mode: "direct_secondary_hits", targetIds: targets }
        : { allowed: false, mode: "main_clash_lost", targetIds: [] };
    }
    return { allowed: true, mode: "normal", targetIds: targets };
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    PHASES,
    ECONOMY_COSTS,
    SOURCE_TYPES,
    RESOLUTION_TYPES,
    TARGET_MODES,
    TARGET_ALLEGIANCE,
    ACTION_STATES,
    normalizePhase,
    normalizeResourceCost,
    createCombatAction,
    normalizeCombatAction,
    validateCombatAction,
    canReceiveHelp,
    applyHelpModifier,
    setActionState,
    cancelCombatAction,
    cancelPendingActions,
    validateResourcesContract,
    resolveTargetSelection,
    resolveAoeOutcome,
  });

  global.LuminousCombatAction = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
