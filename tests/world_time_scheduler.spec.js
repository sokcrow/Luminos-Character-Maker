const { test, expect } = require("@playwright/test");
const SceneTime = require("../js/scene-time-core.js");
const Scheduler = require("../js/world-time-scheduler-core.js");

function calendar(timestamp = "2026-08-30T12:00:00.000Z") {
  return {
    timestamp,
    año: 2026,
    mes: 8,
    dia: 30,
    hora: 12,
    minuto: 0,
    segundo: 0,
    scene_time: { schemaVersion: 1, rooms: {} },
  };
}

function apply(base, command) {
  return Scheduler.applyCommandToCalendar(base, command);
}

function start(base, id, members, durationSeconds, extra = {}) {
  return apply(base, {
    commandId: `start_${id}`,
    type: "start_activity",
    groupId: id,
    memberIds: members,
    durationSeconds,
    activityType: extra.activityType || "travel",
    payload: extra.payload ?? { route: "test" },
    priority: extra.priority,
  });
}

test.describe("World Time Scheduler", () => {
  test("eight separated players create eight activities and only eight queued events", () => {
    let state = calendar();
    for (let i = 1; i <= 8; i += 1) state = start(state, `g${i}`, [`p${i}`], 3600 + i).calendar;
    const scheduler = Scheduler.schedulerStateFrom(state);
    expect(Object.keys(scheduler.groups)).toHaveLength(8);
    expect(Object.keys(scheduler.events)).toHaveLength(8);
    expect(Object.values(scheduler.groups).every((group) => group.status === "active")).toBe(true);
  });

  test("a 24 hour activity still creates one event instead of per-second realtime ticks", () => {
    const state = start(calendar(), "sleep", ["p1"], 24 * 60 * 60).calendar;
    const scheduler = Scheduler.schedulerStateFrom(state);
    expect(Object.keys(scheduler.events)).toHaveLength(1);
    expect(scheduler.groups.sleep.durationSeconds).toBe(86400);
    expect(scheduler.groups.sleep.endsAtWorldTs - scheduler.groups.sleep.startedAtWorldTs).toBe(86400000);
  });

  test("a player cannot belong to two active activity groups", () => {
    let state = start(calendar(), "a", ["p1", "p2"], 60).calendar;
    const duplicate = start(state, "b", ["p2"], 10);
    expect(duplicate.result).toBe("member_busy");
    expect(Scheduler.schedulerStateFrom(duplicate.calendar).groups.b).toBeUndefined();
  });

  test("commands are idempotent and do not duplicate events", () => {
    const command = { commandId: "same", type: "start_activity", groupId: "bus", memberIds: ["p1"], durationSeconds: 120, activityType: "bus" };
    const first = apply(calendar(), command);
    const second = apply(first.calendar, command);
    expect(second.duplicate).toBe(true);
    expect(Object.keys(Scheduler.schedulerStateFrom(second.calendar).events)).toHaveLength(1);
  });

  test("split and join preserve the same absolute activity finish", () => {
    let state = start(calendar(), "party", ["p1", "p2", "p3"], 600, { activityType: "walk", payload: { route: "K-road" } }).calendar;
    const originalEnd = Scheduler.schedulerStateFrom(state).groups.party.endsAtWorldTs;
    state = apply(state, { commandId: "split", type: "split_group", groupId: "party", newGroupId: "scout", memberIds: ["p3"] }).calendar;
    let scheduler = Scheduler.schedulerStateFrom(state);
    expect(scheduler.groups.party.memberIds).toEqual(["p1", "p2"]);
    expect(scheduler.groups.scout.memberIds).toEqual(["p3"]);
    expect(scheduler.groups.scout.endsAtWorldTs).toBe(originalEnd);
    expect(Object.keys(scheduler.events)).toHaveLength(2);

    state = apply(state, { commandId: "join", type: "join_groups", targetGroupId: "party", sourceGroupId: "scout" }).calendar;
    scheduler = Scheduler.schedulerStateFrom(state);
    expect(scheduler.groups.party.memberIds).toEqual(["p1", "p2", "p3"]);
    expect(scheduler.groups.scout.status).toBe("merged");
    expect(Object.keys(scheduler.events)).toHaveLength(1);
  });

  test("advance to next event moves the canonical calendar and resolves the earliest group", () => {
    let state = start(calendar(), "slow", ["p1"], 20).calendar;
    state = start(state, "fast", ["p2"], 5).calendar;
    const before = SceneTime.calendarWorldMs(state);
    const result = apply(state, { commandId: "next", type: "advance_to_next_event" });
    expect(result.deltaSeconds).toBe(5);
    expect(SceneTime.calendarWorldMs(result.calendar) - before).toBe(5000);
    const scheduler = Scheduler.schedulerStateFrom(result.calendar);
    expect(scheduler.groups.fast.status).toBe("completed");
    expect(scheduler.groups.slow.status).toBe("active");
  });

  test("scheduler global advance consumes active Scene Time actions in every room", () => {
    let state = calendar();
    state = SceneTime.applyEventToCalendar(state, {
      eventId: "room_a_action",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "a", mensaje: "A", actionDurationSeconds: 12 },
    }, "room-a").calendar;
    state = SceneTime.applyEventToCalendar(state, {
      eventId: "room_b_action",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "b", mensaje: "B", actionDurationSeconds: 18 },
    }, "room-b").calendar;
    state = start(state, "trip", ["p1"], 6).calendar;
    state = apply(state, { commandId: "advance_trip", type: "advance_to_next_event" }).calendar;
    expect(SceneTime.roomStateFrom(state, "room-a").actions.a.remainingSeconds).toBe(6);
    expect(SceneTime.roomStateFrom(state, "room-b").actions.b.remainingSeconds).toBe(12);
  });

  test("normal Scene Time can cross an activity end and lazy reconcile records the real due timestamp without rewinding", () => {
    let state = start(calendar(), "shop", ["p1"], 5).calendar;
    const due = Scheduler.schedulerStateFrom(state).groups.shop.endsAtWorldTs;
    state = SceneTime.applyEventToCalendar(state, { eventId: "speech", type: "advance", seconds: 6 }, "room-a").calendar;
    const worldAfterSpeech = SceneTime.calendarWorldMs(state);
    expect(worldAfterSpeech).toBe(due + 1000);
    const reconciled = apply(state, { commandId: "reconcile_shop", type: "reconcile" });
    const group = Scheduler.schedulerStateFrom(reconciled.calendar).groups.shop;
    expect(group.status).toBe("completed");
    expect(group.completedAtWorldTs).toBe(due);
    expect(group.processedAtWorldTs).toBe(worldAfterSpeech);
    expect(SceneTime.calendarWorldMs(reconciled.calendar)).toBe(worldAfterSpeech);
  });

  test("cancel removes the queued completion and never rewinds time", () => {
    let state = start(calendar(), "cancel-me", ["p1"], 600).calendar;
    const before = SceneTime.calendarWorldMs(state);
    const cancelled = apply(state, { commandId: "cancel", type: "cancel_activity", groupId: "cancel-me" });
    const scheduler = Scheduler.schedulerStateFrom(cancelled.calendar);
    expect(scheduler.groups["cancel-me"].status).toBe("cancelled");
    expect(Object.keys(scheduler.events)).toHaveLength(0);
    expect(SceneTime.calendarWorldMs(cancelled.calendar)).toBe(before);
  });

  test("same timestamp events use stable priority then sequence ordering", () => {
    let state = start(calendar(), "later-priority", ["p1"], 30, { priority: 80 }).calendar;
    state = start(state, "first-priority", ["p2"], 30, { priority: 10 }).calendar;
    const ordered = Scheduler.orderedEvents(Scheduler.schedulerStateFrom(state));
    expect(ordered.map((event) => event.groupId)).toEqual(["first-priority", "later-priority"]);
  });

  test("processed command and history collections remain bounded", () => {
    let state = calendar();
    for (let i = 0; i < 400; i += 1) {
      state = apply(state, { commandId: `noop_${i}`, type: "reconcile" }).calendar;
    }
    const scheduler = Scheduler.schedulerStateFrom(state);
    expect(Object.keys(scheduler.processedCommands).length).toBeLessThanOrEqual(Scheduler.CONFIG.processedCommandLimit);
    expect(Object.keys(scheduler.history).length).toBeLessThanOrEqual(Scheduler.CONFIG.historyLimit);
  });
});
