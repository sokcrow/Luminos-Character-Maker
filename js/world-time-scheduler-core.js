(function (root, factory) {
  "use strict";
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./scene-time-core.js"));
  } else {
    root.LuminousWorldTimeSchedulerCore = factory(root.LuminousSceneTimeCore);
  }
})(typeof window !== "undefined" ? window : globalThis, function (SceneTime) {
  "use strict";

  if (!SceneTime) throw new Error("LuminousSceneTimeCore is required");

  const CONFIG = Object.freeze({
    schemaVersion: 1,
    processedCommandLimit: 256,
    historyLimit: 128,
    terminalGroupLimit: 64,
    maxMembersPerGroup: 8,
  });

  const clone = (value) => SceneTime.clone ? SceneTime.clone(value) : JSON.parse(JSON.stringify(value ?? null));
  const safeKey = (value) => String(value ?? "").trim().replace(/[.#$\[\]/]/g, "_").slice(0, 160);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positiveInt = (value, fallback = 0) => Math.max(0, Math.floor(finite(value, fallback)));

  function normalizeMembers(value) {
    const seen = new Set();
    const members = [];
    for (const raw of Array.isArray(value) ? value : []) {
      const memberId = safeKey(raw);
      if (!memberId || seen.has(memberId)) continue;
      seen.add(memberId);
      members.push(memberId);
      if (members.length >= CONFIG.maxMembersPerGroup) break;
    }
    return members;
  }

  function blankState() {
    return {
      schemaVersion: CONFIG.schemaVersion,
      sequence: 0,
      groups: {},
      events: {},
      processedCommands: {},
      history: {},
      lastEvent: null,
    };
  }

  function normalizeState(raw) {
    const source = raw && typeof raw === "object" ? clone(raw) : {};
    return {
      schemaVersion: CONFIG.schemaVersion,
      sequence: positiveInt(source.sequence),
      groups: source.groups && typeof source.groups === "object" ? source.groups : {},
      events: source.events && typeof source.events === "object" ? source.events : {},
      processedCommands: source.processedCommands && typeof source.processedCommands === "object" ? source.processedCommands : {},
      history: source.history && typeof source.history === "object" ? source.history : {},
      lastEvent: source.lastEvent || null,
    };
  }

  function schedulerStateFrom(calendar) {
    return normalizeState(calendar?.world_scheduler);
  }

  function nextSequence(state) {
    state.sequence = positiveInt(state.sequence) + 1;
    return state.sequence;
  }

  function orderedEvents(state, predicate) {
    return Object.values(state.events || {})
      .filter((event) => event && event.status === "queued" && (!predicate || predicate(event)))
      .sort((a, b) =>
        finite(a.dueAtWorldTs) - finite(b.dueAtWorldTs) ||
        positiveInt(a.priority, 50) - positiveInt(b.priority, 50) ||
        positiveInt(a.sequence) - positiveInt(b.sequence) ||
        String(a.eventId || "").localeCompare(String(b.eventId || ""))
      );
  }

  function nextScheduledEvent(state, worldMs = -Infinity) {
    return orderedEvents(state, (event) => finite(event.dueAtWorldTs) >= finite(worldMs))[0] || null;
  }

  function memberBusyGroup(state, memberId, exceptGroupId = null) {
    return Object.values(state.groups || {}).find((group) =>
      group && group.status === "active" && group.groupId !== exceptGroupId && Array.isArray(group.memberIds) && group.memberIds.includes(memberId)
    ) || null;
  }

  function trimObjectBySequence(object, limit, keepPredicate) {
    const entries = Object.entries(object || {});
    if (entries.length <= limit) return object;
    const removable = entries
      .filter(([, value]) => !keepPredicate || !keepPredicate(value))
      .sort((a, b) => positiveInt(a[1]?.sequence) - positiveInt(b[1]?.sequence));
    let extra = entries.length - limit;
    for (const [key] of removable) {
      if (extra <= 0) break;
      delete object[key];
      extra -= 1;
    }
    return object;
  }

  function prune(state) {
    trimObjectBySequence(state.processedCommands, CONFIG.processedCommandLimit);
    trimObjectBySequence(state.history, CONFIG.historyLimit);
    const terminals = Object.entries(state.groups)
      .filter(([, group]) => group && group.status !== "active")
      .sort((a, b) => positiveInt(a[1]?.updatedSequence) - positiveInt(b[1]?.updatedSequence));
    while (terminals.length > CONFIG.terminalGroupLimit) {
      const [key] = terminals.shift();
      delete state.groups[key];
    }
    return state;
  }

  function recordHistory(state, entry) {
    const sequence = nextSequence(state);
    const key = `h_${sequence}`;
    state.history[key] = { ...clone(entry), sequence };
    state.lastEvent = clone(state.history[key]);
    prune(state);
  }

  function recordCommand(state, commandId, result, worldMs) {
    if (!commandId) return;
    const sequence = nextSequence(state);
    state.processedCommands[safeKey(commandId)] = { sequence, result, worldTs: finite(worldMs) };
    prune(state);
  }

  function activityEventId(group) {
    return safeKey(`activity_${group.groupId}_${positiveInt(group.revision, 1)}`);
  }

  function queueCompletion(state, group, priority = 50) {
    const eventId = activityEventId(group);
    const sequence = nextSequence(state);
    state.events[eventId] = {
      eventId,
      type: "activity_complete",
      groupId: group.groupId,
      groupRevision: group.revision,
      dueAtWorldTs: group.endsAtWorldTs,
      priority: positiveInt(priority, 50),
      sequence,
      status: "queued",
    };
    group.eventId = eventId;
    return state.events[eventId];
  }

  function deleteGroupEvent(state, group) {
    if (group?.eventId && state.events[group.eventId]) delete state.events[group.eventId];
  }

  function reconcileDueState(state, worldMs) {
    const due = orderedEvents(state, (event) => finite(event.dueAtWorldTs) <= finite(worldMs));
    const completed = [];
    for (const event of due) {
      const group = state.groups[event.groupId];
      if (event.type === "activity_complete" && group && group.status === "active" && positiveInt(group.revision) === positiveInt(event.groupRevision)) {
        group.status = "completed";
        group.completedAtWorldTs = finite(event.dueAtWorldTs);
        group.processedAtWorldTs = finite(worldMs);
        group.remainingSeconds = 0;
        group.updatedSequence = nextSequence(state);
        completed.push(group.groupId);
        recordHistory(state, {
          type: "activity_complete",
          eventId: event.eventId,
          groupId: group.groupId,
          dueAtWorldTs: finite(event.dueAtWorldTs),
          processedAtWorldTs: finite(worldMs),
        });
      }
      delete state.events[event.eventId];
    }
    prune(state);
    return completed;
  }

  function advanceSceneRooms(calendar, deltaSeconds) {
    const seconds = Math.max(0, finite(deltaSeconds));
    if (!seconds) return calendar;
    const rooms = calendar?.scene_time?.rooms;
    if (!rooms || typeof rooms !== "object" || typeof SceneTime.advanceActions !== "function") return calendar;
    for (const roomKey of Object.keys(rooms)) {
      const room = rooms[roomKey];
      if (!room || typeof room !== "object") continue;
      room.actions = SceneTime.advanceActions(room.actions || {}, seconds);
      room.lastGlobalAdvance = { seconds, source: "world_scheduler" };
    }
    return calendar;
  }

  function commandResult(calendar, state, result, commandId, deltaSeconds = 0, extra = {}) {
    calendar.world_scheduler = prune(state);
    return { calendar, scheduler: clone(calendar.world_scheduler), result, commandId, deltaSeconds, ...extra };
  }

  function startActivity(calendar, state, command, worldMs) {
    const groupId = safeKey(command.groupId || command.activityGroupId);
    const memberIds = normalizeMembers(command.memberIds);
    const durationSeconds = positiveInt(command.durationSeconds);
    if (!groupId || !memberIds.length) return { result: "invalid_group" };
    if (!Number.isFinite(Number(command.durationSeconds)) || Number(command.durationSeconds) < 0) return { result: "invalid_duration" };
    if (state.groups[groupId]?.status === "active") return { result: "group_busy" };
    for (const memberId of memberIds) {
      const busy = memberBusyGroup(state, memberId);
      if (busy) return { result: "member_busy", busyGroupId: busy.groupId, memberId };
    }

    const previousRevision = positiveInt(state.groups[groupId]?.revision);
    const group = {
      groupId,
      memberIds,
      status: "active",
      revision: previousRevision + 1,
      activity: {
        type: safeKey(command.activityType || command.activity?.type || "activity") || "activity",
        payload: clone(command.payload ?? command.activity?.payload ?? null),
      },
      startedAtWorldTs: finite(worldMs),
      endsAtWorldTs: finite(worldMs) + durationSeconds * 1000,
      durationSeconds,
      remainingSeconds: durationSeconds,
      createdSequence: nextSequence(state),
      updatedSequence: state.sequence,
    };
    state.groups[groupId] = group;
    queueCompletion(state, group, command.priority);
    recordHistory(state, { type: "activity_started", groupId, worldTs: finite(worldMs), endsAtWorldTs: group.endsAtWorldTs });
    return { result: "activity_started", groupId };
  }

  function cancelActivity(state, command, worldMs) {
    const groupId = safeKey(command.groupId || command.activityGroupId);
    const group = state.groups[groupId];
    if (!group || group.status !== "active") return { result: "group_not_active" };
    deleteGroupEvent(state, group);
    group.status = "cancelled";
    group.cancelledAtWorldTs = finite(worldMs);
    group.remainingSeconds = Math.max(0, Math.ceil((finite(group.endsAtWorldTs) - finite(worldMs)) / 1000));
    group.updatedSequence = nextSequence(state);
    recordHistory(state, { type: "activity_cancelled", groupId, worldTs: finite(worldMs) });
    return { result: "activity_cancelled", groupId };
  }

  function splitGroup(state, command, worldMs) {
    const sourceId = safeKey(command.groupId || command.sourceGroupId);
    const newGroupId = safeKey(command.newGroupId);
    const source = state.groups[sourceId];
    const moving = normalizeMembers(command.memberIds);
    if (!source || source.status !== "active" || !newGroupId || state.groups[newGroupId]?.status === "active") return { result: "invalid_split" };
    if (!moving.length || moving.length >= source.memberIds.length || moving.some((memberId) => !source.memberIds.includes(memberId))) return { result: "invalid_split_members" };

    source.memberIds = source.memberIds.filter((memberId) => !moving.includes(memberId));
    source.updatedSequence = nextSequence(state);
    const group = {
      ...clone(source),
      groupId: newGroupId,
      memberIds: moving,
      revision: 1,
      createdSequence: nextSequence(state),
      updatedSequence: state.sequence,
      eventId: null,
      splitFrom: sourceId,
    };
    state.groups[newGroupId] = group;
    queueCompletion(state, group, state.events[source.eventId]?.priority ?? 50);
    recordHistory(state, { type: "group_split", sourceGroupId: sourceId, newGroupId, memberIds: moving, worldTs: finite(worldMs) });
    return { result: "group_split", sourceGroupId: sourceId, newGroupId };
  }

  function compatibleForJoin(a, b) {
    if (!a || !b || a.status !== "active" || b.status !== "active") return false;
    if (finite(a.endsAtWorldTs) !== finite(b.endsAtWorldTs)) return false;
    if (String(a.activity?.type || "") !== String(b.activity?.type || "")) return false;
    return JSON.stringify(a.activity?.payload ?? null) === JSON.stringify(b.activity?.payload ?? null);
  }

  function joinGroups(state, command, worldMs) {
    const targetId = safeKey(command.targetGroupId || command.groupId);
    const sourceId = safeKey(command.sourceGroupId);
    const target = state.groups[targetId];
    const source = state.groups[sourceId];
    if (!targetId || !sourceId || targetId === sourceId || !compatibleForJoin(target, source)) return { result: "incompatible_groups" };
    const combined = normalizeMembers([...(target.memberIds || []), ...(source.memberIds || [])]);
    if (combined.length !== (target.memberIds || []).length + (source.memberIds || []).length) return { result: "duplicate_member" };

    target.memberIds = combined;
    target.updatedSequence = nextSequence(state);
    deleteGroupEvent(state, source);
    source.status = "merged";
    source.mergedInto = targetId;
    source.updatedSequence = nextSequence(state);
    recordHistory(state, { type: "groups_joined", targetGroupId: targetId, sourceGroupId: sourceId, worldTs: finite(worldMs) });
    return { result: "groups_joined", targetGroupId: targetId, sourceGroupId: sourceId };
  }

  function applyCommandToCalendar(baseCalendar, rawCommand) {
    let calendar = clone(baseCalendar || {});
    const command = clone(rawCommand || {});
    const commandId = safeKey(command.commandId || command.eventId || `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const state = schedulerStateFrom(calendar);
    const worldMs = SceneTime.calendarWorldMs(calendar);

    if (state.processedCommands[commandId]) {
      return commandResult(calendar, state, state.processedCommands[commandId].result, commandId, 0, { duplicate: true });
    }

    reconcileDueState(state, worldMs);
    let outcome = { result: "unsupported_command" };
    let deltaSeconds = 0;

    if (command.type === "start_activity") outcome = startActivity(calendar, state, command, worldMs);
    else if (command.type === "cancel_activity") outcome = cancelActivity(state, command, worldMs);
    else if (command.type === "split_group") outcome = splitGroup(state, command, worldMs);
    else if (command.type === "join_groups") outcome = joinGroups(state, command, worldMs);
    else if (command.type === "reconcile") {
      const completedGroupIds = reconcileDueState(state, worldMs);
      outcome = { result: completedGroupIds.length ? "reconciled" : "nothing_due", completedGroupIds };
    } else if (command.type === "advance_to_next_event") {
      const next = nextScheduledEvent(state, worldMs);
      if (!next) outcome = { result: "no_scheduled_event" };
      else {
        const targetMs = Math.max(worldMs, finite(next.dueAtWorldTs));
        deltaSeconds = Math.max(0, (targetMs - worldMs) / 1000);
        advanceSceneRooms(calendar, deltaSeconds);
        calendar = SceneTime.writeCalendarWorldMs(calendar, targetMs);
        const completedGroupIds = reconcileDueState(state, targetMs);
        outcome = { result: "advanced_to_next_event", completedGroupIds, targetWorldTs: targetMs };
      }
    } else if (command.type === "advance_to") {
      const targetMs = finite(command.worldTs, worldMs);
      if (targetMs < worldMs) outcome = { result: "cannot_rewind" };
      else {
        deltaSeconds = (targetMs - worldMs) / 1000;
        advanceSceneRooms(calendar, deltaSeconds);
        calendar = SceneTime.writeCalendarWorldMs(calendar, targetMs);
        const completedGroupIds = reconcileDueState(state, targetMs);
        outcome = { result: "advanced_to", completedGroupIds, targetWorldTs: targetMs };
      }
    }

    recordCommand(state, commandId, outcome.result, SceneTime.calendarWorldMs(calendar));
    return commandResult(calendar, state, outcome.result, commandId, deltaSeconds, outcome);
  }

  function dueEventSummary(calendar) {
    const state = schedulerStateFrom(calendar);
    const worldMs = SceneTime.calendarWorldMs(calendar);
    const due = orderedEvents(state, (event) => finite(event.dueAtWorldTs) <= worldMs);
    return { worldMs, dueCount: due.length, firstDue: due[0] || null, nextEvent: nextScheduledEvent(state, worldMs) };
  }

  return Object.freeze({
    CONFIG,
    blankState,
    normalizeState,
    schedulerStateFrom,
    orderedEvents,
    nextScheduledEvent,
    reconcileDueState,
    advanceSceneRooms,
    applyCommandToCalendar,
    dueEventSummary,
    normalizeMembers,
  });
});
