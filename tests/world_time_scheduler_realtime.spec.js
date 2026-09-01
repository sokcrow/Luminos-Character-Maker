const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const runtime = read("js/world-time-scheduler-runtime.js");
const core = read("js/world-time-scheduler-core.js");
const engine = read("js/scene-time-engine.js");
const rules = read("database.rules.json");

test.describe("World Time Scheduler Realtime contract", () => {
  test("uses the canonical calendar and a request queue instead of a second clock", () => {
    expect(runtime).toContain('const CALENDAR_ROOT = "campaña/calendario"');
    expect(runtime).toContain('const SCHEDULER_ROOT = `${CALENDAR_ROOT}/world_scheduler`');
    expect(runtime).toContain('const REQUEST_ROOT = "campaña/tiempo/world_scheduler_requests/events"');
    expect(runtime).not.toContain("world_clock");
    expect(runtime).not.toContain("globalClockRoot");
  });

  test("only the DM consumer mutates the calendar and does so transactionally", () => {
    expect(runtime).toContain('if (!isDm()) return;');
    expect(runtime).toContain('db.ref(CALENDAR_ROOT).transaction((calendar) =>');
    expect(runtime).toContain('Core.applyCommandToCalendar(calendar, request).calendar');
    expect(runtime).not.toContain('db.ref(CALENDAR_ROOT).set(');
    expect(runtime).not.toContain('db.ref(CALENDAR_ROOT).update(');
  });

  test("authorization validates requesterUid rather than trusting the DM consumer", () => {
    expect(runtime).toContain('const requesterUid = String(request?.requesterUid || "")');
    expect(runtime).toContain('if (requesterUid === DM_UID) return true;');
    expect(runtime).toContain('ownedPlayerIds(playerSnapshot.val(), requesterUid)');
    expect(runtime).not.toContain('if (isDm()) return true;\n    const uid = String(request?.requesterUid');
  });

  test("players write requests only and rules bind request id plus requester uid", () => {
    expect(runtime).toContain('db.ref(`${REQUEST_ROOT}/${command.commandId}`).set(command)');
    expect(runtime).toContain('command.requesterUid = currentUid()');
    expect(rules).toContain('"world_scheduler_requests"');
    expect(rules).toContain("newData.child('requesterUid').val() === auth.uid");
    expect(rules).toContain("newData.child('commandId').val() === $requestId");
    expect(rules).toContain('"calendario": {');
    expect(rules).toContain("auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'");
  });

  test("runtime does not tick or write once per second", () => {
    expect(runtime).not.toContain("setInterval(");
    expect(runtime).not.toContain("requestAnimationFrame(");
    expect(runtime).toContain('db.ref(`${CALENDAR_ROOT}/timestamp`).on("value"');
    expect(runtime).toContain('db.ref(SCHEDULER_ROOT).on("value"');
    expect(core).toContain('endsAtWorldTs: finite(worldMs) + durationSeconds * 1000');
    expect(core).toContain('type: "activity_complete"');
  });

  test("DM reconciliation is demand-driven and guarded against overlapping transactions", () => {
    expect(runtime).toContain("state.reconciling");
    expect(runtime).toContain("if (!isDm() || state.reconciling) return;");
    expect(runtime).toContain('type: "reconcile"');
    expect(runtime).toContain("state.reconciling = false");
  });

  test("request is removed only after authorization and calendar transaction", () => {
    const transactionIndex = runtime.indexOf("db.ref(CALENDAR_ROOT).transaction");
    const removeIndex = runtime.indexOf("await requestRef.remove();", transactionIndex);
    expect(transactionIndex).toBeGreaterThanOrEqual(0);
    expect(removeIndex).toBeGreaterThan(transactionIndex);
  });

  test("scene-time bootstrap loads scheduler core before scheduler runtime", () => {
    const coreIndex = engine.indexOf("js/world-time-scheduler-core.js");
    const runtimeIndex = engine.indexOf("js/world-time-scheduler-runtime.js");
    expect(coreIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeIndex).toBeGreaterThan(coreIndex);
    expect(engine).toContain("js/scene-time-runtime.js");
  });

  test("scheduler state is bounded instead of keeping unbounded request history", () => {
    expect(core).toContain("processedCommandLimit: 256");
    expect(core).toContain("historyLimit: 128");
    expect(core).toContain("terminalGroupLimit: 64");
    expect(core).toContain("prune(state)");
  });
});
