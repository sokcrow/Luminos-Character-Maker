const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("milestone Stat validation uses raw form values before the transaction", () => {
  const source = read("js/dm-player-class-milestones.js");

  expect(source).toContain("const submittedRawStats = currentFormStatRawValues();");
  expect(source).toContain("api.validateChoice(proposed, submittedRawStats)");
  expect(source).not.toContain("api.validateChoice(proposed, submittedFormStats)");
});

test("decimal allocated Stats are rejected by the milestone engine", () => {
  const milestones = require("../js/class-milestone-engine.js");
  const invalid = milestones.validateChoice(
    { type: "stats", allocation: { fuerza: 2 } },
    { fuerza: "18.5" },
  );

  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toContain("entero válido");
});

test("Theatre overrides are merged before before_check traits dispatch", () => {
  const source = read("js/player-trait-runtime.js");

  expect(source).toContain("const merged = { ...(check || {}), ...(runtimeInput?.check || {}) };");
  expect(source).toContain("const preparedCheck = normalizeTheatreCheckInput(check, runtimeInput);");
  expect(source).toContain("check: preparedCheck");
  expect(source).not.toContain("Object.assign(result.check, runtimeInput?.check || {})");
});

test("Theatre lifecycle bridge applies passive traits on the real player roll path", () => {
  const source = read("js/player-trait-runtime.js");

  expect(source).toContain("function installTheatreBridge()");
  expect(source).toContain('target = event.target?.closest?.(".player-dnd-roll")');
  expect(source).toContain("abilityId: panel?.dataset?.activeStat || null");
  expect(source).toContain("skillId: target.dataset?.skillId || null");
  expect(source).toContain("const resolved = resolveTheatreCheck(enrichedCheck);");
  expect(source).toContain("originalArmCheck(resolved.check);");
});

test("combat lifecycle dispatches automatic Trait triggers", () => {
  const source = read("js/player-trait-runtime.js");

  expect(source).toContain("function installCombatBridge()");
  expect(source).toContain('dispatchCombatEvent("encounter_start"');
  expect(source).toContain('phaseTag === "[Round Start]"');
  expect(source).toContain('dispatchCombatEvent("turn_start"');
  expect(source).toContain('phaseTag === "[Round End]"');
  expect(source).toContain('dispatchCombatEvent("turn_end"');
  expect(source).toContain('"[Before Attack]": { trigger: "before_attack", timing: "before" }');
  expect(source).toContain('"[On Hit]": { trigger: "on_hit", timing: "after" }');
  expect(source).toContain("engine.triggerEvent = function (tag, context, targetsHit = [])");
});
