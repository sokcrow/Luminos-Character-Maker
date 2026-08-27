const { test, expect } = require("@playwright/test");
const sceneTime = require("../js/scene-time-engine.js");

function calendar(timestamp = "2026-08-27T12:00:00.000Z") {
  return { timestamp, año: 2026, mes: 8, dia: 27, hora: 12, minuto: 0, segundo: 0 };
}

function apply(base, event, room = "default") {
  return sceneTime.applyEventToCalendar(base, { eventId: event.eventId || `evt_${Math.random()}`, ...event }, room);
}

test.describe("Scene Time v1 contract #584", () => {
  test("pensamiento costs exactly 1 second", () => {
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "pensamiento", mensaje: "Texto larguísimo" })).toBe(1);
  });

  test("DM narration costs exactly 2 seconds regardless of length", () => {
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "narracion", mensaje: "x".repeat(2000) })).toBe(2);
  });

  test("explicit narration time jump overrides the 2 second narration abstraction", () => {
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "narracion", mensaje: "Pasan veinte minutos", sceneTimeSeconds: 1200 })).toBe(1200);
  });

  test("dialogue is estimated at 2.5 words per second with a 2 second minimum", () => {
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "dialogo", mensaje: "Sí." })).toBe(2);
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "dialogo", mensaje: "uno dos tres cuatro cinco seis siete ocho nueve diez" })).toBe(4);
  });

  test("OOC and system messages cost zero", () => {
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "ooc", mensaje: "meta" })).toBe(0);
    expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: "sistema", mensaje: "sync" })).toBe(0);
  });

  test("Theatre interventions do not advance time while combat owns the clock", () => {
    for (const type of ["dialogo", "pensamiento", "narracion", "actuar"]) {
      expect(sceneTime.interventionDurationSeconds({ tipo_dialogo: type, mensaje: "hola" }, "combat")).toBe(0);
    }
  });

  test("action buckets are deterministic and normal defaults to 3 seconds", () => {
    expect(sceneTime.actionDurationSeconds({ tipo_dialogo: "actuar", mensaje: "Asiento" })).toBe(3);
    expect(sceneTime.actionDurationSeconds({ actionBucket: "instant" })).toBe(2);
    expect(sceneTime.actionDurationSeconds({ actionBucket: "complete" })).toBe(6);
    expect(sceneTime.actionDurationSeconds({ actionDurationSeconds: 12 })).toBe(12);
  });

  test("message limits are guardrails, not duration calculators", () => {
    expect(sceneTime.validateMessageLength({ tipo_dialogo: "dialogo", mensaje: "a".repeat(280) }).valid).toBe(true);
    expect(sceneTime.validateMessageLength({ tipo_dialogo: "dialogo", mensaje: "a".repeat(281) }).valid).toBe(false);
    expect(sceneTime.validateMessageLength({ tipo_dialogo: "actuar", mensaje: "a".repeat(201) }).valid).toBe(false);
    expect(sceneTime.validateMessageLength({ tipo_dialogo: "dialogo", mensaje: "a".repeat(101) }, "combat").valid).toBe(false);
  });

  test("starting ACTUAR creates an Action Instance without advancing World Time", () => {
    const before = calendar();
    const result = apply(before, {
      eventId: "act_1",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "/em empuja la caja" },
    });
    expect(result.deltaSeconds).toBe(0);
    expect(sceneTime.calendarWorldMs(result.calendar)).toBe(sceneTime.calendarWorldMs(before));
    const action = sceneTime.roomStateFrom(result.calendar, "default").actions.lanae;
    expect(action.status).toBe("active");
    expect(action.remainingSeconds).toBe(3);
    expect(action.description).toBe("empuja la caja");
  });

  test("an actor cannot start a second physical action while blocked", () => {
    const first = apply(calendar(), {
      eventId: "act_lock_1",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "primera", actionDurationSeconds: 6 },
    });
    const second = apply(first.calendar, {
      eventId: "act_lock_2",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "segunda" },
    });
    expect(second.result).toBe("actor_locked");
    expect(sceneTime.roomStateFrom(second.calendar, "default").actions.lanae.description).toBe("primera");
  });

  test("dialogue advances World Time and consumes an active action concurrently", () => {
    const started = apply(calendar(), {
      eventId: "act_concurrent",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "mueve la caja", actionDurationSeconds: 6 },
    });
    const spoken = apply(started.calendar, {
      eventId: "speech_concurrent",
      type: "intervention",
      message: { tipo_dialogo: "dialogo", actorId: "lanae", mensaje: "uno dos tres cuatro cinco seis siete ocho nueve diez" },
    });
    expect(spoken.deltaSeconds).toBe(4);
    expect(sceneTime.roomStateFrom(spoken.calendar, "default").actions.lanae.remainingSeconds).toBe(2);
  });

  test("simultaneous actors use MAX semantics because one world delta decrements all timers", () => {
    let state = apply(calendar(), {
      eventId: "a_start",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "a", mensaje: "A", actionDurationSeconds: 10 },
    }).calendar;
    state = apply(state, {
      eventId: "b_start",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "b", mensaje: "B", actionDurationSeconds: 4 },
    }).calendar;
    const next = apply(state, { eventId: "advance4", type: "advance", seconds: 4 });
    const actions = sceneTime.roomStateFrom(next.calendar, "default").actions;
    expect(actions.a.remainingSeconds).toBe(6);
    expect(actions.b.remainingSeconds).toBe(0);
    expect(actions.b.status).toBe("resolved");
    expect(next.deltaSeconds).toBe(4);
  });

  test("advance-to-next-event uses the smallest active remaining timer", () => {
    const actions = {
      a: { status: "active", remainingSeconds: 10 },
      b: { status: "active", remainingSeconds: 4 },
      c: { status: "resolution_pending", remainingSeconds: 0 },
    };
    expect(sceneTime.nextEventDelta(actions)).toBe(4);
  });

  test("a completed action with an after-check becomes resolution_pending", () => {
    let state = apply(calendar(), {
      eventId: "check_action",
      type: "intervention",
      message: {
        tipo_dialogo: "actuar",
        actorId: "lanae",
        mensaje: "empuja caja",
        actionDurationSeconds: 3,
        check: { required: true, timing: "after", allowed: ["str", "athletics"], dc: 14 },
      },
    }).calendar;
    state = apply(state, { eventId: "advance_check", type: "advance", seconds: 3 }).calendar;
    const action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.status).toBe("resolution_pending");
    expect(action.remainingSeconds).toBe(0);
    expect(action.check.allowed).toEqual([
      { kind: "ability", abilityId: "str", skillId: null },
      { kind: "skill", abilityId: "str", skillId: "athletics" },
    ]);
  });

  test("a before-check blocks timer consumption until it succeeds", () => {
    let state = apply(calendar(), {
      eventId: "before_check_action",
      type: "intervention",
      message: {
        tipo_dialogo: "actuar",
        actorId: "lanae",
        mensaje: "levanta compuerta",
        actionDurationSeconds: 6,
        check: { required: true, timing: "before", allowed: ["str"], dc: 16 },
      },
    }).calendar;
    state = apply(state, { eventId: "advance_while_before", type: "advance", seconds: 5 }).calendar;
    let action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.status).toBe("check_before_pending");
    expect(action.remainingSeconds).toBe(6);
    state = apply(state, { eventId: "resolve_before", type: "action_control", actorId: "lanae", command: "resolve_check", success: true }).calendar;
    action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.status).toBe("active");
  });

  test("failed checks do not refund already consumed time", () => {
    let state = apply(calendar(), {
      eventId: "fail_action",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "caja", actionDurationSeconds: 6, check: { required: true, allowed: ["athletics"], dc: 15 } },
    }).calendar;
    state = apply(state, { eventId: "spend6", type: "advance", seconds: 6 }).calendar;
    state = apply(state, { eventId: "fail_check", type: "action_control", actorId: "lanae", command: "resolve_check", success: false, total: 9 }).calendar;
    const action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.status).toBe("failed");
    expect(action.consumedSeconds).toBe(6);
    expect(action.remainingSeconds).toBe(0);
  });

  test("cancel/interruption/impossible keep consumed time instead of rewinding the calendar", () => {
    for (const command of ["cancel", "interrupt", "impossible"]) {
      let state = apply(calendar(), {
        eventId: `start_${command}`,
        type: "intervention",
        message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "tarea", actionDurationSeconds: 10 },
      }).calendar;
      state = apply(state, { eventId: `consume_${command}`, type: "advance", seconds: 4 }).calendar;
      const worldBeforeControl = sceneTime.calendarWorldMs(state);
      state = apply(state, { eventId: `control_${command}`, type: "action_control", actorId: "lanae", command }).calendar;
      const action = sceneTime.roomStateFrom(state, "default").actions.lanae;
      expect(action.consumedSeconds).toBe(4);
      expect(sceneTime.calendarWorldMs(state)).toBe(worldBeforeControl);
    }
  });

  test("event ids make calendar advancement idempotent", () => {
    const first = apply(calendar(), { eventId: "same_event", type: "advance", seconds: 6 });
    const second = apply(first.calendar, { eventId: "same_event", type: "advance", seconds: 6 });
    expect(first.deltaSeconds).toBe(6);
    expect(second.duplicate).toBe(true);
    expect(second.deltaSeconds).toBe(0);
    expect(sceneTime.calendarWorldMs(second.calendar) - sceneTime.calendarWorldMs(calendar())).toBe(6000);
  });

  test("ten completed combat rounds equal exactly one minute", () => {
    let state = calendar();
    for (let round = 1; round <= 10; round += 1) {
      state = apply(state, { eventId: `round_${round}`, type: "combat_round" }).calendar;
    }
    expect(sceneTime.calendarWorldMs(state) - sceneTime.calendarWorldMs(calendar())).toBe(60_000);
  });

  test("combat rounds decrement continuing Scene Time actions using the same six seconds", () => {
    let state = apply(calendar(), {
      eventId: "long_action",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "acción larga", actionDurationSeconds: 12 },
    }).calendar;
    state = apply(state, { eventId: "combat_mode", type: "set_mode", mode: "combat" }).calendar;
    state = apply(state, { eventId: "round_one", type: "combat_round" }).calendar;
    let action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.remainingSeconds).toBe(6);
    state = apply(state, { eventId: "round_two", type: "combat_round" }).calendar;
    action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.remainingSeconds).toBe(0);
    expect(action.status).toBe("resolved");
  });

  test("calendar precision keeps seconds and normalizes minute rollover", () => {
    const result = apply(calendar("2026-08-27T12:59:58.000Z"), { eventId: "rollover", type: "advance", seconds: 6 });
    expect(new Date(sceneTime.calendarWorldMs(result.calendar)).toISOString()).toBe("2026-08-27T13:00:04.000Z");
    expect(result.calendar.hora).toBe(13);
    expect(result.calendar.minuto).toBe(0);
    expect(result.calendar.segundo).toBe(4);
  });

  test("identity for ACTUAR is viewer-scoped", () => {
    expect(sceneTime.visibleActionIdentity({ canonicalName: "Lanae", isDm: true })).toBe("Lanae");
    expect(sceneTime.visibleActionIdentity({ canonicalName: "Lanae", isOwnActor: true })).toBe("Lanae");
    expect(sceneTime.visibleActionIdentity({ canonicalName: "Lanae", known: true })).toBe("Lanae");
    expect(sceneTime.visibleActionIdentity({ canonicalName: "Lanae" })).toBe("???");
  });

  test("ACTUAR formatter can repair legacy ??? without changing action copy", () => {
    expect(sceneTime.replaceActionIdentity("(??? empuja la caja)", "Lanae")).toBe("(Lanae empuja la caja)");
    expect(sceneTime.replaceActionIdentity("(Lanae empuja la caja)", "???")).toBe("(??? empuja la caja)");
  });

  test("STR and Athletics normalize to canonical check identifiers", () => {
    expect(sceneTime.canonicalAllowedCheckOption("str")).toEqual({ kind: "ability", abilityId: "str", skillId: null });
    expect(sceneTime.canonicalAllowedCheckOption("athletics")).toEqual({ kind: "skill", abilityId: "str", skillId: "athletics" });
  });

  test("DM duration override changes remaining time without erasing time already spent", () => {
    let state = apply(calendar(), {
      eventId: "duration_override_start",
      type: "intervention",
      message: { tipo_dialogo: "actuar", actorId: "lanae", mensaje: "caja", actionDurationSeconds: 10 },
    }).calendar;
    state = apply(state, { eventId: "duration_override_spend", type: "advance", seconds: 4 }).calendar;
    state = apply(state, { eventId: "duration_override_set", type: "action_control", actorId: "lanae", command: "set_duration", durationSeconds: 12 }).calendar;
    const action = sceneTime.roomStateFrom(state, "default").actions.lanae;
    expect(action.durationSeconds).toBe(12);
    expect(action.consumedSeconds).toBe(4);
    expect(action.remainingSeconds).toBe(8);
  });

  test("ACTUAR identity replacement does not leak multi-word canonical names", () => {
    expect(sceneTime.replaceActionIdentity("(Lanae de Rossa empuja la caja)", "???", "Lanae de Rossa")).toBe("(??? empuja la caja)");
  });

  test("processed event history is bounded while preserving recent idempotency", () => {
    let state = calendar();
    for (let i = 0; i < sceneTime.CONFIG.processedEventLimit + 10; i += 1) {
      state = apply(state, { eventId: `bounded_${i}`, type: "advance", seconds: 1 }).calendar;
    }
    const room = sceneTime.roomStateFrom(state, "default");
    expect(Object.keys(room.processedEvents).length).toBeLessThanOrEqual(sceneTime.CONFIG.processedEventLimit);
    const duplicate = apply(state, { eventId: `bounded_${sceneTime.CONFIG.processedEventLimit + 9}`, type: "advance", seconds: 1 });
    expect(duplicate.duplicate).toBe(true);
  });
});
