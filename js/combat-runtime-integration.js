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

  function isUnitActive(runtime, unit = {}) {
    if (!unit || !entityId(unit)) return false;
    if (unit.defeated === true || unit.dead === true || unit.removed === true || unit.escaped === true) return false;
    const absentThrough = Number(unit.combatAbsentThroughRound ?? unit.absentThroughRound ?? -1);
    return !Number.isFinite(absentThrough) || runtime.round > absentThrough;
  }

  function activeUnits(runtime) {
    return runtime.units.filter((unit) => isUnitActive(runtime, unit));
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

  function runtimeTargetAvailable(runtime, target, context = {}) {
    if (!isUnitActive(runtime, target)) return false;
    if (typeof context.isTargetAvailable === "function") return context.isTargetAvailable(target, runtime) !== false;
    return queueApi.isTargetAvailable(target);
  }

  function resolverContext(runtime, context = {}, phase = runtime.phase, extra = {}) {
    return {
      ...context,
      ...extra,
      phase,
      units: activeUnits(runtime),
      encounter: runtime.encounter,
      teamEconomy: context.teamEconomy || teamEconomy,
      actionMap: runtime.actionMap,
      random: runtime.random,
      coinwiseResolution: context.coinwiseResolution !== false,
      combatActionQueue: context.combatActionQueue || queueApi,
      isTargetAvailable: (target) => runtimeTargetAvailable(runtime, target, context),
    };
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
      for (const unit of activeUnits(runtime)) options.onTurnStart({ unit, runtime });
    }

    runtime.speedSnapshot = queueApi.snapshotSpeedSources(activeUnits(runtime), { random: runtime.random });
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

  function availableSlotCount(runtime, actorId) {
    if (runtime.encounter && teamEconomy?.profileForUnit) {
      const found = teamEconomy.profileForUnit(runtime.encounter, actorId);
      if (found?.profile) return Math.max(0, Number(found.profile.usableActionSlots ?? found.profile.currentActionSlots ?? 0));
    }
    const unit = unitById(runtime, actorId);
    if (!unit) return 0;
    const values = [unit.actionSlotState?.usable, unit.activeSlots, unit.currentActionSlots, unit.actionSlotState?.current];
    const found = values.map(Number).find(Number.isFinite);
    return found == null ? Infinity : Math.max(0, found);
  }

  function validateActionSlot(runtime, action) {
    if (action.economy.cost !== schema.ECONOMY_COSTS.ACTION) return { valid: true };
    if (!action.actionSlotId) return { valid: false, reason: "action_slot_required" };
    const duplicate = runtime.actions.find((entry) =>
      entry.actorId === action.actorId &&
      entry.economy.cost === schema.ECONOMY_COSTS.ACTION &&
      entry.actionSlotId === action.actionSlotId &&
      !terminal(entry)
    );
    if (duplicate) return { valid: false, reason: "action_slot_already_used", conflictingActionId: duplicate.id };
    const used = runtime.actions.filter((entry) => entry.actorId === action.actorId && entry.economy.cost === schema.ECONOMY_COSTS.ACTION && !terminal(entry)).length;
    const available = availableSlotCount(runtime, action.actorId);
    if (Number.isFinite(available) && used >= available) return { valid: false, reason: "no_usable_action_slots", available, used };
    return { valid: true, available, used };
  }

  function registerAction(runtime, input = {}, options = {}) {
    const action = schema.normalizeCombatAction(input);
    const validation = schema.validateCombatAction(action);
    if (!validation.valid) return { registered: false, reason: "invalid_action", errors: validation.errors, action };
    const normalized = validation.action;
    const actor = unitById(runtime, normalized.actorId);
    if (!actor) return { registered: false, reason: "actor_missing", action: normalized };
    if (!isUnitActive(runtime, actor)) return { registered: false, reason: "actor_inactive", action: normalized };
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
      const result = resolver.resolveCombatAction(normalized, resolverContext(runtime, options.context || {}, runtime.phase));
      runtime.actionMap[normalized.id] = result.action || normalized;
      asArray(result.resolvedActionIds).forEach((id) => runtime.resolvedActionIds.add(String(id)));
      record(runtime, "quick_action", { actionId: normalized.id, resolved: result.resolved, reason: result.reason || null });
      return { registered: Boolean(result.resolved), immediate: true, action: result.action || normalized, result };
    }

    const slotGate = validateActionSlot(runtime, normalized);
    if (!slotGate.valid) return { registered: false, ...slotGate, action: normalized };

    runtime.actions.push(normalized);
    runtime.actionMap[normalized.id] = normalized;
    record(runtime, "action_registered", { actionId: normalized.id, actorId: normalized.actorId, side, actionSlotId: normalized.actionSlotId });
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
    if (typeof options.aiPlanner === "function") aiActions = asArray(options.aiPlanner({ runtime, units: activeUnits(runtime), actions: runtime.actions }));
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
      units: activeUnits(runtime),
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

  function beginCombatPhase(runtime, context = {}) {
    if (!runtime.playerReady || !runtime.aiReady) return { started: false, reason: "planning_not_ready" };
    if (runtime.phase !== schema.PHASES.COMBAT_START) return { started: false, reason: "combat_start_required", phase: runtime.phase };
    runtime.queue = previewQueue(runtime);
    record(runtime, "combat_start", { queue: runtime.queue.entries.map((entry) => entry.actionId) });
    if (typeof context.onCombatStart === "function") context.onCombatStart({ runtime, queue: runtime.queue });
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
    for (const unit of activeUnits(runtime)) {
      const blocked = isStaggered(unit) || (typeof context.isActionBlocked === "function" && context.isActionBlocked({ unit, runtime }) === true);
      if (!blocked) continue;
      const reason = isStaggered(unit) ? { type: "stagger" } : { type: "action_blocked" };
      cancelled.push(...cancelActorPending(runtime, entityId(unit), reason));
    }
    return cancelled;
  }

  function applyRetarget(runtime, action, context = {}) {
    const status = queueApi.retargetStatus(action, activeUnits(runtime), { isAvailable: (target) => runtimeTargetAvailable(runtime, target, context) });
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
      const result = resolver.resolveCombatAction(reaction, resolverContext(runtime, context, schema.PHASES.COMBAT_PHASE));
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
        const result = resolver.resolveCombatAction(reaction, resolverContext(runtime, context, schema.PHASES.COMBAT_PHASE));
        syncResultActions(runtime, result);
        results.push({ mode: "adaptive", actionId: reaction.id, result });
      }
    }

    if (results.length) record(runtime, "reactions_resolved", { eventType: event.type || null, actionIds: results.map((entry) => entry.actionId) });
    return results;
  }

  function grappleSucceeded(action, result = {}) {
    if (action.source?.type !== "universal" || normalizeId(action.source?.id) !== "grapple") return false;
    const payload = result.resolution?.result ?? result.result ?? {};
    if (payload === true) return true;
    if (payload?.success === true || payload?.succeeded === true || payload?.attackerWon === true || payload?.grappled === true) return true;
    const winner = normalizeId(payload?.winner || payload?.result);
    return ["attacker", "a", "success", "win", "won"].includes(winner);
  }

  function applyGrappleOutcome(runtime, action, result = {}) {
    if (!grappleSucceeded(action, result)) return null;
    const targetId = String(action.targeting?.mainTargetId || action.targeting?.targetIds?.[0] || "");
    if (!targetId) return null;
    const cancelledActionIds = cancelActorPending(runtime, targetId, { type: "grapple" });
    const locks = [];
    if (runtime.encounter && teamEconomy?.lockUnitSlots) {
      locks.push(teamEconomy.lockUnitSlots(runtime.encounter, action.actorId, 1, "grapple"));
      locks.push(teamEconomy.lockUnitSlots(runtime.encounter, targetId, 1, "grapple"));
    }
    record(runtime, "grapple_applied", { actorId: action.actorId, targetId, cancelledActionIds });
    return { targetId, cancelledActionIds, locks };
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

    const result = resolver.resolveCombatAction(action, resolverContext(runtime, context, schema.PHASES.COMBAT_PHASE, { opposingAction }));
    syncResultActions(runtime, result);
    const grapple = applyGrappleOutcome(runtime, result.action || action, result);
    applyBlockingStates(runtime, context);
    triggerReactions(runtime, { type: "after_action", actionId: action.id, actorId: action.actorId, result }, context);
    record(runtime, "action_resolved", { actionId: action.id, resolved: result.resolved, reason: result.reason || null, type: result.type || result.resolution?.type || action.resolution.type });
    return grapple ? { ...result, grapple } : result;
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
    record(runtime, "combat_end", { resolvedActionIds: [...runtime.resolvedActionIds] });
    if (typeof context.onCombatEnd === "function") context.onCombatEnd({ runtime, results });
    return { completed: true, phase: runtime.phase, results };
  }

  function teamForUnit(runtime, unit) {
    if (!runtime.encounter || !teamEconomy?.teamForSide) return null;
    return teamEconomy.teamForSide(runtime.encounter, queueApi.sideOf(unit));
  }

  function replaceRuntimeUnit(runtime, outgoing, incoming) {
    const index = runtime.units.indexOf(outgoing);
    if (index >= 0) runtime.units.splice(index, 1, incoming);
    else runtime.units.push(incoming);
  }

  function defaultRetreat(runtime, actor, effect = {}) {
    const side = queueApi.sideOf(actor);
    const team = teamForUnit(runtime, actor);
    if (team && teamEconomy?.profileForUnit) {
      const found = teamEconomy.profileForUnit(runtime.encounter, actor);
      if (team.backups?.length) {
        const backupProfile = team.backups.shift();
        const incomingUnit = backupProfile.unit;
        const incoming = teamEconomy.inheritReplacementSlots
          ? teamEconomy.inheritReplacementSlots(runtime.encounter, side, actor, incomingUnit, { cap: effect.inheritActionSlotsCap || 2 })
          : backupProfile;
        const activeIndex = team.active.indexOf(found.profile);
        if (activeIndex >= 0) team.active.splice(activeIndex, 1, incoming);
        found.profile.statusLockedSlots = 0;
        found.profile.usableActionSlots = 0;
        team.backups.push(found.profile);
        replaceRuntimeUnit(runtime, actor, incomingUnit);
        teamEconomy.syncEncounter?.(runtime.encounter);
        return { retreated: true, replaced: true, outgoingUnitId: entityId(actor), incomingUnitId: entityId(incomingUnit), inheritedSlots: incoming.currentActionSlots };
      }
    }

    actor.combatAbsentThroughRound = runtime.round + 1;
    return { retreated: true, replaced: false, absentThroughRound: actor.combatAbsentThroughRound };
  }

  function defaultEscape(runtime, actor) {
    actor.escaped = true;
    actor.eligibleForXp = false;
    const team = teamForUnit(runtime, actor);
    if (team && teamEconomy?.profileForUnit) {
      const found = teamEconomy.profileForUnit(runtime.encounter, actor);
      if (found?.profile) {
        const index = team.active.indexOf(found.profile);
        if (index >= 0) team.active.splice(index, 1);
        teamEconomy.registerVacatedSlots?.(runtime.encounter, team.side, found.profile.currentActionSlots || 1, { hasBackup: team.backups?.length > 0 });
        teamEconomy.syncEncounter?.(runtime.encounter);
      }
    }
    return { escaped: true, unitId: entityId(actor), eligibleForXp: false };
  }

  function turnEndEffectHandlers(runtime, context = {}) {
    return {
      ...(context.effectHandlers || {}),
      retreat: context.effectHandlers?.retreat || (({ actor, effect }) => defaultRetreat(runtime, actor, effect)),
      escape: context.effectHandlers?.escape || (({ actor }) => defaultEscape(runtime, actor)),
    };
  }

  function resolveTurnEnd(runtime, context = {}) {
    if (runtime.phase !== schema.PHASES.COMBAT_END && runtime.phase !== schema.PHASES.ON_TURN_END) return { completed: false, reason: "combat_end_required" };
    setPhase(runtime, schema.PHASES.ON_TURN_END);
    const results = [];
    const turnEndActions = runtime.actions.filter((action) => action.phase.executesAt === schema.PHASES.ON_TURN_END && !terminal(action));
    const ordered = [...turnEndActions].sort((a, b) => {
      const aPart = queueApi.partIdOf(a);
      const bPart = queueApi.partIdOf(b);
      const aSource = runtime.speedSnapshot?.[queueApi.speedSourceKey(a.actorId, aPart)];
      const bSource = runtime.speedSnapshot?.[queueApi.speedSourceKey(b.actorId, bPart)];
      return (Number(bSource?.speed || 0) - Number(aSource?.speed || 0)) || (Number(aSource?.tieRoll || 0) - Number(bSource?.tieRoll || 0));
    });

    const effectHandlers = turnEndEffectHandlers(runtime, context);
    for (const action of ordered) {
      const unit = unitById(runtime, action.actorId);
      const blocked = !unit || !isUnitActive(runtime, unit) || isStaggered(unit) || (typeof context.isTurnEndBlocked === "function" && context.isTurnEndBlocked({ action, unit, runtime }) === true);
      if (blocked) {
        action.state = "cancelled";
        action.cancelReason = { type: !unit ? "actor_missing" : (isStaggered(unit) ? "stagger" : "turn_end_blocked") };
        runtime.actionMap[action.id] = action;
        runtime.resolvedActionIds.add(action.id);
        results.push({ actionId: action.id, resolved: false, cancelled: true, reason: action.cancelReason.type });
        continue;
      }
      const result = resolver.resolveCombatAction(action, resolverContext(runtime, { ...context, effectHandlers }, schema.PHASES.ON_TURN_END));
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
    activeUnits,
    isUnitActive,
    beginTurn,
    availableSlotCount,
    validateActionSlot,
    registerAction,
    playerPlanningReady,
    aiPlanningReady,
    previewQueue,
    linkClash,
    beginCombatPhase,
    cancelActorPending,
    triggerReactions,
    applyGrappleOutcome,
    resolveQueueEntry,
    resolveCombatPhase,
    defaultRetreat,
    defaultEscape,
    resolveTurnEnd,
    nextRound,
  });

  global.LuminousCombatRuntimeIntegration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
