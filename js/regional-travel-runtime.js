(function (global) {
  "use strict";

  if (global.LuminousRegionalTravel) return;
  const Core = global.LuminousRegionalTravelCore;
  const Scheduler = global.LuminousWorldTimeScheduler;
  const firebase = global.firebase;
  if (!Core || !Scheduler || !firebase?.database) return;

  const db = firebase.database();
  const PLAYER_ROOT = "campaña/jugadores";
  const DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const applyingArrivals = new Set();
  const currentUid = () => firebase.auth?.().currentUser?.uid || null;
  const isDm = () => currentUid() === DM_UID || document.body?.classList.contains("on-game-dashboard") || document.body?.classList.contains("dm-dashboard");
  const makeId = (prefix = "travel") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  function startTravel(input = {}) {
    const result = Core.createTravelPlan(input);
    if (!result.valid) return Promise.reject(Object.assign(new Error(result.reason || "INVALID_REGIONAL_TRAVEL"), { travelValidation: result }));
    const command = Core.toSchedulerCommand(result.plan, input.commandId || makeId("regional_travel"));
    return Scheduler.startActivity(command).then((commandId) => ({ commandId, plan: result.plan }));
  }

  function cancelTravel(groupId) { return Scheduler.cancelActivity(groupId); }

  function planFromGroup(group) {
    if (!group || group.activity?.type !== "regional_travel") return null;
    const result = Core.createTravelPlan({
      ...(group.activity?.payload || {}),
      groupId: group.groupId,
      memberIds: group.memberIds,
    });
    return result.valid && result.plan.durationSeconds === Number(group.durationSeconds) ? result.plan : null;
  }

  async function applyArrival(group) {
    if (!isDm() || group?.status !== "completed") return false;
    const plan = planFromGroup(group);
    if (!plan) return false;
    const arrivalId = `regional_arrival_${group.groupId}_${Number(group.revision) || 1}`;
    if (applyingArrivals.has(arrivalId)) return false;
    applyingArrivals.add(arrivalId);
    try {
      const snapshot = await db.ref(PLAYER_ROOT).once("value");
      const players = snapshot.val() || {};
      const members = Core.normalizeMembers(group.memberIds);
      if (!members.length) return false;
      const alreadyApplied = members.every((playerId) => players[playerId]?.worldPosition?.travelArrivalId === arrivalId);
      if (alreadyApplied) return false;

      const worldPosition = Core.destinationWorldPosition(plan, arrivalId, group.completedAtWorldTs || group.processedAtWorldTs || 0);
      const updates = {};
      for (const playerId of members) updates[`${PLAYER_ROOT}/${playerId}/worldPosition`] = worldPosition;
      await db.ref().update(updates);
      global.dispatchEvent?.(new CustomEvent("luminous:regional-travel-arrival", { detail: { arrivalId, groupId: group.groupId, memberIds: members, worldPosition } }));
      return true;
    } catch (error) {
      console.error("[Luminous] Regional travel arrival failed:", error);
      return false;
    } finally {
      applyingArrivals.delete(arrivalId);
    }
  }

  function reconcileCompleted(snapshot) {
    if (!isDm()) return;
    const groups = snapshot?.scheduler?.groups || {};
    for (const group of Object.values(groups)) {
      if (group?.status === "completed" && group.activity?.type === "regional_travel") void applyArrival(group);
    }
  }

  function onSchedulerUpdated(event) { reconcileCompleted(event?.detail || Scheduler.getSnapshot()); }
  global.addEventListener?.("luminous:world-scheduler-updated", onSchedulerUpdated);
  queueMicrotask(() => reconcileCompleted(Scheduler.getSnapshot()));

  const api = Object.freeze({
    core: Core,
    startTravel,
    cancelTravel,
    planFromGroup,
    applyArrival,
    reconcileCompleted,
    stop: () => global.removeEventListener?.("luminous:world-scheduler-updated", onSchedulerUpdated),
  });
  global.LuminousRegionalTravel = api;
})(window);
