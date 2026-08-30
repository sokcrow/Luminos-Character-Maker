(function (global) {
  "use strict";

  if (global.LuminousWorldTimeScheduler) return;
  const Core = global.LuminousWorldTimeSchedulerCore;
  const firebase = global.firebase;
  if (!Core || !firebase?.database) return;

  const db = firebase.database();
  const CALENDAR_ROOT = "campaña/calendario";
  const SCHEDULER_ROOT = `${CALENDAR_ROOT}/world_scheduler`;
  const REQUEST_ROOT = "campaña/tiempo/world_scheduler_requests/events";
  const PLAYER_ROOT = "campaña/jugadores";
  const DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const state = {
    timestamp: null,
    scheduler: Core.blankState(),
    reconciling: false,
    started: false,
  };

  const currentUid = () => firebase.auth?.().currentUser?.uid || null;
  const isDm = () => currentUid() === DM_UID || document.body?.classList.contains("on-game-dashboard") || document.body?.classList.contains("dm-dashboard");
  const makeId = (prefix = "sched") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const safeMemberIds = (value) => Core.normalizeMembers(value);

  function submitCommand(rawCommand) {
    const command = { ...(rawCommand || {}) };
    command.commandId = command.commandId || command.eventId || makeId(command.type || "sched");
    command.requesterUid = currentUid();
    command.requestedAt = firebase.database.ServerValue.TIMESTAMP;
    return db.ref(`${REQUEST_ROOT}/${command.commandId}`).set(command).then(() => command.commandId);
  }

  function ownedPlayerIds(players, uid) {
    if (!uid || !players || typeof players !== "object") return [];
    const owned = [];
    for (const [playerId, player] of Object.entries(players)) {
      if (!player || typeof player !== "object") continue;
      const ownerUid = player.uid || player.userUid || player.ownerUid || player.firebaseUid || player.authUid;
      if (ownerUid === uid) owned.push(String(playerId));
    }
    return owned;
  }

  async function authorized(request) {
    const requesterUid = String(request?.requesterUid || "");
    if (!requesterUid) return false;
    if (requesterUid === DM_UID) return true;

    const playerSnapshot = await db.ref(PLAYER_ROOT).once("value");
    const owned = new Set(ownedPlayerIds(playerSnapshot.val(), requesterUid));
    if (!owned.size) return false;

    if (request.type === "start_activity") {
      const members = safeMemberIds(request.memberIds);
      return members.length > 0 && members.every((memberId) => owned.has(memberId));
    }

    if (request.type === "cancel_activity") {
      const group = state.scheduler?.groups?.[String(request.groupId || request.activityGroupId || "")];
      const members = safeMemberIds(group?.memberIds);
      return members.length > 0 && members.every((memberId) => owned.has(memberId));
    }

    return false;
  }

  async function consumeRequest(snapshot) {
    if (!isDm()) return;
    const request = snapshot?.val?.() || null;
    const requestRef = snapshot?.ref;
    if (!request || !requestRef) return;

    try {
      if (!(await authorized(request))) {
        await requestRef.remove();
        return;
      }
      await db.ref(CALENDAR_ROOT).transaction((calendar) => {
        if (!calendar) return calendar;
        return Core.applyCommandToCalendar(calendar, request).calendar;
      });
      await requestRef.remove();
    } catch (error) {
      console.error("[Luminous] World Time scheduler request failed:", error);
    }
  }

  function timestampToMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : null;
  }

  function earliestDueEvent() {
    const events = Core.orderedEvents(state.scheduler || Core.blankState());
    return events[0] || null;
  }

  async function maybeReconcile() {
    if (!isDm() || state.reconciling) return;
    const worldMs = timestampToMs(state.timestamp);
    const due = earliestDueEvent();
    if (!Number.isFinite(worldMs) || !due || Number(due.dueAtWorldTs) > worldMs) return;

    state.reconciling = true;
    const commandId = `reconcile_${String(due.eventId || "due")}_${Math.floor(worldMs)}`;
    try {
      await db.ref(CALENDAR_ROOT).transaction((calendar) => {
        if (!calendar) return calendar;
        return Core.applyCommandToCalendar(calendar, { type: "reconcile", commandId }).calendar;
      });
    } catch (error) {
      console.error("[Luminous] World Time scheduler reconcile failed:", error);
    } finally {
      state.reconciling = false;
    }
  }

  function bindRealtime() {
    if (state.started) return;
    state.started = true;

    db.ref(`${CALENDAR_ROOT}/timestamp`).on("value", (snapshot) => {
      state.timestamp = snapshot.val();
      void maybeReconcile();
    });

    db.ref(SCHEDULER_ROOT).on("value", (snapshot) => {
      state.scheduler = Core.normalizeState(snapshot.val());
      void maybeReconcile();
    });

    if (isDm()) db.ref(REQUEST_ROOT).on("child_added", consumeRequest);
  }

  function getSnapshot() {
    return {
      timestamp: state.timestamp,
      scheduler: JSON.parse(JSON.stringify(state.scheduler || Core.blankState())),
    };
  }

  const api = Object.freeze({
    submitCommand,
    startActivity: (input) => submitCommand({ type: "start_activity", ...(input || {}) }),
    cancelActivity: (groupId) => submitCommand({ type: "cancel_activity", groupId }),
    splitGroup: (input) => submitCommand({ type: "split_group", ...(input || {}) }),
    joinGroups: (input) => submitCommand({ type: "join_groups", ...(input || {}) }),
    advanceToNextEvent: () => submitCommand({ type: "advance_to_next_event" }),
    getSnapshot,
    roots: Object.freeze({ CALENDAR_ROOT, SCHEDULER_ROOT, REQUEST_ROOT, PLAYER_ROOT }),
  });

  global.LuminousWorldTimeScheduler = api;
  bindRealtime();
})(window);
