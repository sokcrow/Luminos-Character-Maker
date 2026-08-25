(function (global) {
  "use strict";

  const ACTION_COSTS = Object.freeze({
    ACTION: "action",
    QUICK_ACTION: "quick_action",
    REACTION: "reaction",
  });

  const UNIVERSAL_ACTIONS = Object.freeze({
    GRAPPLE: "grapple",
  });

  const PHASES = Object.freeze({
    PLANNING: "planning",
    COMBAT: "combat",
    OTHER: "other",
  });

  const STATE_KEY = "__luminousActionEconomyState";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : fallback;

  function normalizePhase(value) {
    const id = normalizeId(value);
    if (["pre_combat_planning", "planning", "planning_phase", "before_combat", "before_combat_phase"].includes(id)) return PHASES.PLANNING;
    if (["combat_active", "combat", "combat_phase", "active"].includes(id)) return PHASES.COMBAT;
    return PHASES.OTHER;
  }

  function phaseFor(options = {}) {
    const explicit = options.phase ?? options.currentState ?? options.state;
    if (explicit != null) return normalizePhase(explicit);
    return normalizePhase(global.CombatEngine?.currentState);
  }

  function actionSlotMaximum(unit = {}) {
    const values = [unit.activeSlots, unit.actionSlots, unit.action_slots, unit.maxActionSlots];
    const found = values.map((value) => Number(value)).find((value) => Number.isFinite(value) && value > 0);
    return Math.max(1, Math.trunc(found || 1));
  }

  function ensureState(unit = {}) {
    if (!unit || typeof unit !== "object") return null;
    let state = unit[STATE_KEY];
    if (!state || typeof state !== "object") {
      state = {
        turn: 0,
        phase: PHASES.OTHER,
        quickActionRemaining: 1,
        reactionRemaining: 1,
        plannedActions: {},
      };
      try {
        Object.defineProperty(unit, STATE_KEY, { value: state, writable: true, configurable: true, enumerable: false });
      } catch (_) {
        unit[STATE_KEY] = state;
      }
    }
    const max = actionSlotMaximum(unit);
    Object.keys(state.plannedActions || {}).forEach((key) => {
      if (finiteInt(key, max) >= max) delete state.plannedActions[key];
    });
    return state;
  }

  function reservedSlotIndexes(options = {}, max = Number.POSITIVE_INFINITY) {
    const raw = options.reservedSlotIndexes ?? options.reservedSlots ?? [];
    const values = raw instanceof Set ? [...raw] : (Array.isArray(raw) ? raw : Object.keys(raw || {}).filter((key) => raw[key]));
    return new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value < max));
  }

  function snapshot(unit = {}, options = {}) {
    const state = ensureState(unit);
    const phase = phaseFor(options);
    if (!state) return { phase, action: 0, quick_action: 0, reaction: 0, actionSlots: 0, plannedActions: {} };
    state.phase = phase;
    const max = actionSlotMaximum(unit);
    const occupied = new Set(Object.keys(state.plannedActions || {}).map(Number));
    reservedSlotIndexes(options, max).forEach((index) => occupied.add(index));
    return {
      phase,
      action: phase === PHASES.PLANNING ? Math.max(0, max - occupied.size) : 0,
      quick_action: phase === PHASES.PLANNING ? finiteInt(state.quickActionRemaining, 0) : 0,
      reaction: phase === PHASES.COMBAT ? finiteInt(state.reactionRemaining, 0) : 0,
      actionSlots: max,
      plannedActions: { ...(state.plannedActions || {}) },
      turn: finiteInt(state.turn, 0),
    };
  }

  function availability(unit, cost, options = {}) {
    const id = normalizeId(cost);
    const conditionGate = global.LuminousConditionRuntime?.actionAvailability?.(unit, id, options);
    if (conditionGate?.available === false) return { available: false, reason: conditionGate.reason || "condition_blocks_action", remaining: 0, condition: true };
    const current = snapshot(unit, options);
    if (id === ACTION_COSTS.ACTION) {
      if (current.phase !== PHASES.PLANNING) return { available: false, reason: "action_requires_planning_phase", remaining: 0 };
      return { available: current.action > 0, reason: current.action > 0 ? null : "no_free_action_slot", remaining: current.action };
    }
    if (id === ACTION_COSTS.QUICK_ACTION) {
      if (current.phase !== PHASES.PLANNING) return { available: false, reason: "quick_action_before_combat_only", remaining: 0 };
      return { available: current.quick_action > 0, reason: current.quick_action > 0 ? null : "quick_action_spent", remaining: current.quick_action };
    }
    if (id === ACTION_COSTS.REACTION) {
      if (current.phase !== PHASES.COMBAT) return { available: false, reason: "reaction_combat_phase_only", remaining: 0 };
      return { available: current.reaction > 0, reason: current.reaction > 0 ? null : "reaction_spent", remaining: current.reaction };
    }
    return { available: true, reason: null, remaining: Number.POSITIVE_INFINITY };
  }

  function canUse(unit, cost, options = {}) {
    return availability(unit, cost, options).available;
  }

  function consume(unit, cost, options = {}) {
    const id = normalizeId(cost);
    const state = ensureState(unit);
    if (!state || !canUse(unit, id, options)) return false;
    if (id === ACTION_COSTS.QUICK_ACTION) {
      state.quickActionRemaining = Math.max(0, finiteInt(state.quickActionRemaining, 0) - 1);
      return true;
    }
    if (id === ACTION_COSTS.REACTION) {
      state.reactionRemaining = Math.max(0, finiteInt(state.reactionRemaining, 0) - 1);
      return true;
    }
    // Actions are never consumed as an immediate resource. They must be assigned to an Action Slot.
    return id !== ACTION_COSTS.ACTION;
  }

  function slotIdFor(unit, slotIndex) {
    const prefix = String(unit?.id || unit?.unitId || unit?.characterId || "unit");
    return `${prefix}_slot_${slotIndex}`;
  }

  function scheduleAction(unit, payload = {}, options = {}) {
    const state = ensureState(unit);
    const gate = availability(unit, ACTION_COSTS.ACTION, options);
    if (!state || !gate.available) return { scheduled: false, reason: gate.reason || "action_unavailable" };
    const max = actionSlotMaximum(unit);
    const requested = Number.isInteger(Number(options.slotIndex)) ? Number(options.slotIndex) : null;
    let slotIndex = requested;
    const reserved = reservedSlotIndexes(options, max);
    if (slotIndex == null) {
      slotIndex = Array.from({ length: max }, (_, index) => index).find((index) => !reserved.has(index) && !Object.prototype.hasOwnProperty.call(state.plannedActions, index));
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= max) return { scheduled: false, reason: "invalid_action_slot" };
    if (reserved.has(slotIndex)) return { scheduled: false, reason: "action_slot_reserved", slotIndex };
    if (Object.prototype.hasOwnProperty.call(state.plannedActions, slotIndex)) return { scheduled: false, reason: "action_slot_occupied", slotIndex };
    const entry = {
      kind: normalizeId(payload.kind || payload.type || "action") || "action",
      sourceId: payload.sourceId || payload.traitId || payload.skillId || payload.abilityId || null,
      traitId: payload.traitId || null,
      skillId: payload.skillId || null,
      abilityId: payload.abilityId || null,
      targetId: payload.targetId || payload.target?.id || null,
      data: payload.data && typeof payload.data === "object" ? { ...payload.data } : {},
    };
    state.plannedActions[slotIndex] = entry;
    return { scheduled: true, slotIndex, slotId: slotIdFor(unit, slotIndex), entry: { ...entry } };
  }

  function cancelAction(unit, slotIndex) {
    const state = ensureState(unit);
    if (!state || !Object.prototype.hasOwnProperty.call(state.plannedActions, slotIndex)) return false;
    delete state.plannedActions[slotIndex];
    return true;
  }

  function getPlannedAction(unit, slotIndex) {
    const state = ensureState(unit);
    const entry = state?.plannedActions?.[slotIndex];
    return entry ? { ...entry, data: { ...(entry.data || {}) } } : null;
  }

  function takePlannedAction(unit, slotIndex, options = {}) {
    if (phaseFor(options) !== PHASES.COMBAT) return null;
    const state = ensureState(unit);
    const entry = state?.plannedActions?.[slotIndex];
    if (!entry) return null;
    delete state.plannedActions[slotIndex];
    global.LuminousConditionRuntime?.onActionUsed?.(unit, options);
    return { ...entry, data: { ...(entry.data || {}) } };
  }

  function beginPlanning(unit) {
    const state = ensureState(unit);
    if (!state) return null;
    state.phase = PHASES.PLANNING;
    state.turn = finiteInt(state.turn, 0) + 1;
    state.quickActionRemaining = 1;
    state.reactionRemaining = 1;
    state.plannedActions = {};
    return snapshot(unit, { phase: PHASES.PLANNING });
  }

  function beginCombat(unit) {
    const state = ensureState(unit);
    if (!state) return null;
    state.phase = PHASES.COMBAT;
    return snapshot(unit, { phase: PHASES.COMBAT });
  }

  function resetTurnResources(unit) {
    const state = ensureState(unit);
    if (!state) return null;
    state.quickActionRemaining = 1;
    state.reactionRemaining = 1;
    return state;
  }

  function isCounterSkill(skill = {}) {
    const normalized = global.LuminousUniversalModifiers?.normalizeSkill?.(skill) || skill || {};
    const subtype = normalizeId(normalized.defenseSubtype || normalized.defense_subtype || normalized.type);
    return ["counter", "clashablecounter", "clashable_counter"].includes(subtype);
  }

  function consumeCounterReaction(unit, skill, options = {}) {
    if (!isCounterSkill(skill)) return true;
    return consume(unit, ACTION_COSTS.REACTION, options);
  }

  function canUseUniversalAction(unit, actionId, options = {}) {
    const id = normalizeId(actionId);
    if (!Object.values(UNIVERSAL_ACTIONS).includes(id)) return { available: false, reason: "unknown_universal_action", actionId: id };
    const conditionGate = global.LuminousConditionRuntime?.canUseUniversalAction?.(unit, { ...options, actionId: id, cost: ACTION_COSTS.ACTION });
    if (conditionGate?.available === false) return { ...conditionGate, actionId: id };
    const gate = availability(unit, ACTION_COSTS.ACTION, { ...options, universalAction: true });
    return { ...gate, actionId: id };
  }

  function performGrapple(unitA, unitB, options = {}) {
    const gate = canUseUniversalAction(unitA, UNIVERSAL_ACTIONS.GRAPPLE, options);
    if (!gate.available) return { applied: false, reason: gate.reason || "grapple_unavailable" };
    if (!global.LuminousConditionRuntime?.grapple) return { applied: false, reason: "condition_runtime_unavailable" };
    return global.LuminousConditionRuntime.grapple(unitA, unitB, options);
  }

  function runtimeFor(unit, options = {}) {
    const phase = phaseFor(options);
    const runtime = {
      unit,
      phase,
      canUse(cost) { return canUse(unit, cost, { ...options, phase }); },
      availability(cost) { return availability(unit, cost, { ...options, phase }); },
      consume(cost) { return consume(unit, cost, { ...options, phase }); },
      schedule(payload, scheduleOptions = {}) { return scheduleAction(unit, payload, { ...options, ...scheduleOptions, phase }); },
      canUseUniversalAction(actionId) { return canUseUniversalAction(unit, actionId, { ...options, phase }); },
    };
    Object.defineProperties(runtime, {
      action: { enumerable: true, get: () => snapshot(unit, { ...options, phase }).action },
      quick_action: { enumerable: true, get: () => snapshot(unit, { ...options, phase }).quick_action },
      reaction: { enumerable: true, get: () => snapshot(unit, { ...options, phase }).reaction },
      available: {
        enumerable: true,
        get: () => ({
          action: snapshot(unit, { ...options, phase }).action,
          quick_action: snapshot(unit, { ...options, phase }).quick_action,
          reaction: snapshot(unit, { ...options, phase }).reaction,
        }),
      },
    });
    return runtime;
  }

  const api = Object.freeze({
    ACTION_COSTS,
    UNIVERSAL_ACTIONS,
    PHASES,
    normalizePhase,
    phaseFor,
    actionSlotMaximum,
    reservedSlotIndexes,
    ensureState,
    snapshot,
    availability,
    canUse,
    consume,
    scheduleAction,
    cancelAction,
    getPlannedAction,
    takePlannedAction,
    beginPlanning,
    beginCombat,
    resetTurnResources,
    isCounterSkill,
    consumeCounterReaction,
    canUseUniversalAction,
    performGrapple,
    runtimeFor,
  });

  global.LuminousActionEconomy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
