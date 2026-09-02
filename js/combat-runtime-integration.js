(function (global) {
  "use strict";

  const schema = global.LuminousCombatAction || (typeof require === "function" ? require("./combat-action-schema.js") : null);
  const queueApi = global.LuminousCombatActionQueue || (typeof require === "function" ? require("./combat-action-queue.js") : null);
  const resolver = global.LuminousCombatActionResolver || (typeof require === "function" ? require("./combat-action-resolver.js") : null);
  const teamEconomy = global.LuminousTeamActionEconomy || (typeof require === "function" ? (() => { try { return require("./team-action-economy.js"); } catch (_) { return null; } })() : null);
  if (!schema || !queueApi || !resolver) return;

  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function entityId(entity = {}) {
    return queueApi.entityId(entity);
  }

  function unitById(runtime, id) {
    const wanted = String(id ?? "");
    return runtime.units.find((unit) => entityId(unit) === wanted) || null;
  }

  function isStaggered(unit = {}) {
    if (unit.isStaggered === true || unit.staggered === true) return true;
    const statuses = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(statuses)) {
      return statuses.some((entry) => {
        const id = normalizeId(entry?.id || entry);
        return id === "stagger" || id === "staggered";
      });
    }
    return Boolean(statuses.stagger || statuses.staggered);
  }

  function terminal(action = {}) {
    return action.state === "resolved" || action.state === "cancelled";
  }

  function createRuntime(config = {}) {
    const units = asArray(config.units).filter(Boolean);
    return {
      id: String(config.id || `combat_runtime_${Date.now()}`),
      round: Math.max(1, Number(config.round || config.encounter?.round || 1)),
      phase: schema.PHASES.ON_TURN_START,
      units,
      encounter: config.encounter || null,
      random: typeof config.random === "function" ? config.random : Math.random,
      speedSnapshot: null,
      actions: [],
      actionMap: {},
      preparedReactions: [],
      queue: null,
      resolvedActionIds: new Set(),
      playerReady: false,
      aiReady: false,
      history: [],
    };
  }

  function record(runtime, type, payload = {}) {
    const entry = { round: runtime.round, phase: runtime.phase, type, ...payload };
    runtime.history.push(entry);
    return entry;
  }

  function setPhase(runtime, phase) {
    runtime.phase = schema.normalizePhase(phase, phase);
    return runtime.phase;
  }

  function beginTurn(runtime, options = {}) {
    setPhase(runtime, schema.PHASES.ON_TURN_START);
    runtime.playerReady = false;
    runtime.aiReady = false;
    runtime.queue = null;
    runtime.resolvedActionIds = new Set();
    runtime.actions = [];
    runtime.actionMap = {};
    runtime.preparedReactions = [];

    if (typeof options.onTurnStart === "function") {
      for (const unit of runtime.units) options.onTurnStart({ unit, runtime });
    }

    runtime.speedSnapshot = queueApi.snapshotSpeedSources(runtime.units, { random: runtime.random });
    record(runtime, "speed_snapshot", { speedSnapshot: runtime.speedSnapshot });
    setPhase(runtime, schema.PHASES.PLANNING_PHASE_PLAYER);
    if (runtime.encounter) runtime.encounter.phase = teamEconomy?.PHASES?.PLANNING_PLAYER || "planning_player";
    return runtime.speedSnapshot;
  }

  function sideForAction(runtime, action) {
    const unit = unitById(runtime, action.actorId);
    return unit ? queueApi.sideOf(unit) : queueApi.SIDE_A;
  }

  function planningPhaseForSide(side) {
    return side === queueApi.SIDE_B ? schema.PHASES.PLANNING_PHASE_AI : schema.PHASES.PLANNING_PHASE_PLAYER;
  }

  function registerAction(runtime, input = {}, options = {}) {
    const action = schema.normalizeCombatAction(input);
    const validation = schema.validateCombatAction(action);
    if (!validation.valid) return { registered: false, reason: "invalid_action", errors: validation.errors, action };
    const normalized = validation.action;
    const side = sideForAction(runtime, normalized);
    const expectedPlanning = planningPhaseForSide(side);

    if (normalized.economy.cost !== schema.ECONOMY_COSTS.REACTION && runtime.phase !== expectedPlanning) {
      return { registered: false, reason: "wrong_planning_phase", expectedPhase: expectedPlanning, actualPhase: runtime.phase, action: normalized };
    }

    if (normalized.economy.cost === schema.ECONOMY_COSTS.REACTION && normalizeId(normalized.reaction?.mode) === "prepared") {
      if (runtime.phase !== expectedPlanning) return { registered: false, reason: "prepared_reaction_planning_only", action: normalized };
      normalized.state = "locked";
      runtime.preparedReactions.push(normalized);
      runtime.actionMap[normalized.id] = normalized;
      record(runtime, "prepared_reaction", { actionId: normalized.id, actorId: normalized.actorId });
      return { registered: true, preparedReaction: true, action: normalized };
    }

    if (normalized.economy.cost === schema.ECONOMY_COSTS.QUICK_ACTION) {
      normalized.phase.selectedAt = runtime.phase;
      normalized.phase.executesAt = runtime.phase;
      const result = resolver.resolveCombatAction(normalized, {
        ...options.context,
        phase: runtime.phase,
        units: runtime.units,
        encounter: runtime.encounter,
        teamEconomy: options.context?.teamEconomy || teamEconomy,
        actionMap: runtime.actionMap,
        random: runtime.random,
      });
      runtime.actionMap[normalized.id] = result.action || normalized;
      asArray(result.resolvedActionIds).forEach((id) => runtime.resolvedActionIds.add(String(id)));
      record(runtime, "quick_action", { actionId: normalized.id, resolved: result.resolved, reason: result.reason || null });
      return { registered: Boolean(result.resolved), immediate: true, action: result.action || normalized, result };
    }

    runtime.actions.push(normalized);
    runtime.actionMap[normalized.id] = normalized;
    record(runtime, "action_registered", { actionId: normalized.id, actorId: normalized.actorId, side });
    return { registered: true, action: normalized };
  }

  function lockActionsForSide(runtime, side) {
    const locked = [];
    for (const action of runtime.actions) {
      if (sideForAction(runtime, action) !== side || terminal(action)) continue;
      if (action.state === "planned") action.state = "locked";
      locked.push(action.id);
    }
    return locked;
  }

  function playerPlanningReady(runtime, options = {}) {
    if (runtime.phase !== schema.PHASES.PLANNING_PHASE_PLAYER) return { ready: false, reason: "not_player_planning" };
    const lockedActionIds = lockActionsForSide(runtime, queueApi.SIDE_A);
    runtime.playerReady = true;
    if (runtime.encounter && teamEconomy?.playerReady) teamEconomy.playerReady(runtime.encounter);
    setPhase(runtime, schema.PHASES.PLANNING_PHASE_AI);
    record(runtime, "player_ready", { lockedActionIds });

    let aiActions = [];
    if (typeof options.aiPlanner === "function") aiActions = asArray(options.aiPlanner({ runtime, units: runtime.units, actions: runtime.actions }));
    const registeredAi = aiActions.map((action) => registerAction(runtime, action, { context: options.context })).filter((entry) => entry.registered);
    return { ready: true, phase: runtime.phase, lockedActionIds, registeredAi };
  }

  function aiPlanningReady(runtime) {
    if (runtime.phase !== schema.PHASES.PLANNING_PHASE_AI) return { ready: false, reason: "not_ai_planning" };
    const lockedActionIds = lockActionsForSide(runtime, queueApi.SIDE_B);
    runtime.aiReady = true;
    if (runtime.encounter && teamEconomy?.aiReady) teamEconomy.aiReady(runtime.encounter);
    setPhase(runtime, schema.PHASES.COMBAT_START);
    record(runtime, "ai_ready", { lockedActionIds });
    return { ready: true, phase: runtime.phase, lockedActionIds };
  }

  function previewQueue(runtime) {
    return queueApi.buildRoundOrder({
      units: runtime.units,
      actions: runtime.actions.filter((action) => action.economy.cost !== schema.ECONOMY_COSTS.REACTION),
      speedSnapshot: runtime.speedSnapshot,
      random: runtime.random,
    });
  }

  function unlinkClash(runtime, action) {
    const otherId = action?.metadata?.opposingActionId;
    if (!otherId) return;
    const other = runtime.actionMap[otherId];
    if (other?.metadata?.opposingActionId === action.id) delete other.metadata.opposingActionId;
    if (other?.metadata?.clashedByActionId === action.id) delete other.metadata.clashedByActionId;
    delete action.metadata.opposingActionId;
  }

  function linkClash(runtime, interceptorActionId, targetActionId) {
    const interceptor = runtime.actionMap[String(interceptorActionId)];
    const target = runtime.actionMap[String(targetActionId)];
    if (!interceptor || !target) return { linked: false, reason: "action_missing" };
    if (interceptor.resolution.type !== "clash" || target.resolution.type !== "clash") return { linked: false, reason: "clash_action_required" };

    const preview = previewQueue(runtime);
    const interceptorEntry = preview.getEntry(interceptor.id);
    const targetEntry = preview.getEntry(target.id);
    if (!interceptorEntry || !targetEntry) return { linked: false, reason: "queue_entry_missing" };
    if (interceptorEntry.side === targetEntry.side) return { linked: false, reason: "opposing_side_required" };
    if (!queueApi.canForceClash({ interceptorEntry, targetEntry })) {
      return { linked: false, reason: "insufficient_speed_to_force_clash", interceptorSpeed: interceptorEntry.speed, targetSpeed: targetEntry.speed };
    }

    unlinkClash(runtime, interceptor);
    unlinkClash(runtime, target);
    interceptor.metadata = { ...(interceptor.metadata || {}), opposingActionId: target.id };
    target.metadata = { ...(target.metadata || {}), opposingActionId: interceptor.id, clashedByActionId: interceptor.id };
    record(runtime, "clash_linked", { interceptorActionId: interceptor.id, targetActionId: target.id });
    return { linked: true, interceptorActionId: interceptor.id, targetActionId: target.id };
  }

  function beginCombatPhase(runtime) {
    if (!runtime.playerReady || !runtime.aiReady) return { started: false, reason: "planning_not_ready" };
    if (runtime.phase !== schema.PHASES.COMBAT_START) return { started: false, reason: "combat_start_required", phase: runtime.phase };
    runtime.queue = previewQueue(runtime);
    setPhase(runtime, schema.PHASES.COMBAT_PHASE);
    record(runtime, "combat_phase_started", { queue: runtime.queue.entries.map((entry) => entry.actionId) });
    return { started: true, phase: runtime.phase, queue: runtime.queue };
  }

  function syncResultActions(runtime, result = {}) {
    const updates = [];
    for (const action of asArray(result.actions).concat(result.action ? [result.action] : [])) {
      if (!action?.id) continue;
      runtime.actionMap[action.id] = action;
      const index = runtime.actions.findIndex((entry) => entry.id === action.id);
      if (index >= 0) runtime.actions[index] = action;
      if (runtime.queue) {
        const entry = runtime.queue.getEntry(action.id);
        if (entry) entry.action = action;
      }
      updates.push(action.id);
    }
    asArray(result.resolvedActionIds).forEach((id) => runtime.resolvedActionIds.add(String(id)));
    return updates;
  }

  function cancelActorPending(runtime, actorId, reason = { type: "stagger" }, options = {}) {
    if (!runtime.queue) return [];
    const cancelled = queueApi.cancelActorActions(runtime.queue, actorId, reason, options);
    for (const id of cancelled) {
      const entry = runtime.queue.getEntry(id);
      if (entry) runtime.actionMap[id] = entry.action;
      runtime.resolvedActionIds.add(String(id));
    }
    if (cancelled.length) record(runtime, "actions_cancelled", { actorId: String(actorId), actionIds: cancelled, reason });
    return cancelled;
  }

  function applyBlockingStates(runtime, context = {}) {
    const cancelled = [];
    for (const unit of runtime.units) {
      const blocked = isStaggered(unit) || (typeof context.isActionBlocked === "function" && context.isActionBlocked({ unit, runtime }) === true);
      if (!blocked) continue;
      const reason = isStaggered(unit) ? { type: "stagger" } : { type: "action_blocked" };
      cancelled.push(...cancelActorPending(runtime, entityId(unit), reason));
    }
    return cancelled;
  }

  function applyRetarget(runtime, action, context = {}) {
    const status = queueApi.retargetStatus(action, runtime.units, { isAvailable: context.isTargetAvailable });
    if (status.executable) return { ready: true, action };
    if (!status.requiresRetarget) {
      action.state = "cancelled";
      action.cancelReason = { type: status.reason || "target_unavailable" };
      runtime.resolvedActionIds.add(action.id);
      return { ready: false, cancelled: true, reason: status.reason || "target_unavailable", action };
    }

    if (typeof context.chooseRetarget !== "function") {
      return { ready: false, pending: true, reason: "retarget_required", candidates: status.candidates, action };
    }
    const targetId = context.chooseRetarget({ action, candidates: status.candidates, runtime });
    if (!targetId || !status.candidates.includes(String(targetId))) {
      return { ready: false, pending: true, reason: "retarget_required", candidates: status.candidates, action };
    }
    const previous = asArray(action.targeting.targetIds).map(String).filter((id) => id !== String(action.targeting.mainTargetId || ""));
    action.targeting.mainTargetId = String(targetId);
    action.targeting.targetIds = [String(targetId), ...previous.filter((id) => id !== String(targetId))].slice(0, Math.max(1, Number(action.targeting.attackWeight || 1)));
    record(runtime, "action_retargeted", { actionId: action.id, targetId: String(targetId) });
    return { ready: true, retargeted: true, action };
  }

  function defaultTriggerMatch(trigger, event) {
    if (!trigger || !event) return false;
    const triggerType = normalizeId(trigger.type || trigger.event || trigger.trigger);
    const eventType = normalizeId(event.type || event.event);
    if (!triggerType || !eventType) return false;
    return triggerType === eventType;
  }

  function triggerReactions(runtime, event = {}, context = {}) {
    if (runtime.phase !== schema.PHASES.COMBAT_PHASE) return [];
    const results = [];
    const matcher = typeof context.reactionTriggerMatcher === "function" ? context.reactionTriggerMatcher : defaultTriggerMatch;

    for (const reaction of runtime.preparedReactions) {
      if (terminal(reaction) || !matcher(reaction.reaction?.trigger, event, reaction, runtime)) continue;
      const result = resolver.resolveCombatAction(reaction, {
        ...context,
        phase: schema.PHASES.COMBAT_PHASE,
        units: runtime.units,
        encounter: runtime.encounter,
        actionMap: runtime.actionMap,
        random: runtime.random,
      });
      syncResultActions(runtime, result);
      results.push({ mode: "prepared", actionId: reaction.id, result });
    }

    if (typeof context.getAdaptiveReactions === "function") {
      const adaptive = asArray(context.getAdaptiveReactions({ event, runtime }));
      for (const raw of adaptive) {
        const reaction = schema.normalizeCombatAction(raw);
        reaction.economy.cost = schema.ECONOMY_COSTS.REACTION;
        reaction.phase.selectedAt = schema.PHASES.COMBAT_PHASE;
        reaction.phase.executesAt = schema.PHASES.COMBAT_PHASE;
        reaction.reaction = { ...(reaction.reaction || {}), mode: "adaptive" };
        runtime.actionMap[reaction.id] = reaction;
        const result = resolver.resolveCombatAction(reaction, {
          ...context,
          phase: schema.PHASES.COMBAT_PHASE,
          units: runtime.units,
          encounter: runtime.encounter,
          actionMap: runtime.actionMap,
          random: runtime.random,
        });
        syncResultActions(runtime, result);
        results.push({ mode: "adaptive", actionId: reaction.id, result });
      }
    }

    if (results.length) record(runtime, "reactions_resolved", { eventType: event.type || null, actionIds: results.map((entry) => entry.actionId) });
    return results;
  }

  function resolveQueueEntry(runtime, entry, context = {}) {
    let action = runtime.actionMap[entry.actionId] || entry.action;
    if (!action || terminal(action) || runtime.resolvedActionIds.has(action.id)) return { skipped: true, reason: "already_terminal", action };

    applyBlockingStates(runtime, context);
    action = runtime.actionMap[entry.actionId] || entry.action;
    if (terminal(action) || runtime.resolvedActionIds.has(action.id)) return { skipped: true, reason: "cancelled_before_resolution", action };

    const retarget = applyRetarget(runtime, action, context);
    if (!retarget.ready) return retarget;

    const opposingId = action.metadata?.opposingActionId;
    const opposingAction = opposingId ? runtime.actionMap[opposingId] || null : null;
    triggerReactions(runtime, { type: "before_action", actionId: action.id, actorId: action.actorId }, context);

    const result = resolver.resolveCombatAction(action, {
      ...context,
      phase: schema.PHASES.COMBAT_PHASE,
      units: runtime.units,
      encounter: runtime.encounter,
      actionMap: runtime.actionMap,
      opposingAction,
      random: runtime.random,
    });
    syncResultActions(runtime, result);
    applyBlockingStates(runtime, context);
    triggerReactions(runtime, { type: "after_action", actionId: action.id, actorId: action.actorId, result }, context);
    record(runtime, "action_resolved", { actionId: action.id, resolved: result.resolved, reason: result.reason || null, type: result.type || result.resolution?.type || action.resolution.type });
    return result;
  }

  function resolveCombatPhase(runtime, context = {}) {
    if (runtime.phase !== schema.PHASES.COMBAT_PHASE || !runtime.queue) return { completed: false, reason: "combat_phase_required" };
    const results = [];
    for (const entry of runtime.queue.entries) {
      const result = resolveQueueEntry(runtime, entry, context);
      results.push({ actionId: entry.actionId, result });
      if (result?.pending && result.reason === "retarget_required") {
        return { completed: false, pending: true, reason: "retarget_required", actionId: entry.actionId, candidates: result.candidates, results };
      }
    }
    setPhase(runtime, schema.PHASES.COMBAT_END);
    record(runtime, "combat_phase_complete", { resolvedActionIds: [...runtime.resolvedActionIds] });
    return { completed: true, phase: runtime.phase, results };
  }

  function resolveTurnEnd(runtime, context = {}) {
    if (runtime.phase !== schema.PHASES.COMBAT_END && runtime.phase !== schema.PHASES.ON_TURN_END) return { completed: false, reason: "combat_end_required" };
    setPhase(runtime, schema.PHASES.ON_TURN_END);
    const results = [];
    const turnEndActions = runtime.actions.filter((action) => action.phase.executesAt === schema.PHASES.ON_TURN_END && !terminal(action));
    const ordered = [...turnEndActions].sort((a, b) => {
      const aPart = queueApi.partIdOf(a);
      const bPart = queueApi.partIdOf(b);
      const aSpeed = runtime.speedSnapshot?.[queueApi.speedSourceKey(a.actorId, aPart)]?.speed ?? 0;
      const bSpeed = runtime.speedSnapshot?.[queueApi.speedSourceKey(b.actorId, bPart)]?.speed ?? 0;
      return bSpeed - aSpeed;
    });

    for (const action of ordered) {
      const unit = unitById(runtime, action.actorId);
      const blocked = !unit || isStaggered(unit) || (typeof context.isTurnEndBlocked === "function" && context.isTurnEndBlocked({ action, unit, runtime }) === true);
      if (blocked) {
        action.state = "cancelled";
        action.cancelReason = { type: !unit ? "actor_missing" : (isStaggered(unit) ? "stagger" : "turn_end_blocked") };
        runtime.actionMap[action.id] = action;
        runtime.resolvedActionIds.add(action.id);
        results.push({ actionId: action.id, resolved: false, cancelled: true, reason: action.cancelReason.type });
        continue;
      }
      const result = resolver.resolveCombatAction(action, {
        ...context,
        phase: schema.PHASES.ON_TURN_END,
        units: runtime.units,
        encounter: runtime.encounter,
        actionMap: runtime.actionMap,
        random: runtime.random,
      });
      syncResultActions(runtime, result);
      results.push({ actionId: action.id, ...result });
    }
    record(runtime, "turn_end_complete", { actionIds: results.map((entry) => entry.actionId) });
    return { completed: true, phase: runtime.phase, results };
  }

  function nextRound(runtime, options = {}) {
    if (runtime.phase !== schema.PHASES.ON_TURN_END) return { started: false, reason: "turn_end_required" };
    runtime.round += 1;
    if (runtime.encounter && teamEconomy?.beginNextRound) {
      teamEconomy.beginNextRound(runtime.encounter);
      runtime.round = runtime.encounter.round;
    }
    beginTurn(runtime, options);
    return { started: true, round: runtime.round, phase: runtime.phase, speedSnapshot: runtime.speedSnapshot };
  }

  const api = Object.freeze({
    createRuntime,
    beginTurn,
    registerAction,
    playerPlanningReady,
    aiPlanningReady,
    previewQueue,
    linkClash,
    beginCombatPhase,
    cancelActorPending,
    triggerReactions,
    resolveQueueEntry,
    resolveCombatPhase,
    resolveTurnEnd,
    nextRound,
  });

  global.LuminousCombatRuntimeIntegration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
