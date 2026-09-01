const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("stat milestones preserve unsaved form values instead of replacing all six stats", () => {
  const source = read("js/dm-player-class-milestones.js");

  expect(source).toContain("const submittedRawStats = currentFormStatRawValues();");
  expect(source).toContain("const submittedSavedStats = api.normalizeStats(state.player?.stats || {});");
  expect(source).toContain("const formValidation = api.validateChoice(proposed, submittedRawStats);");
  expect(source).not.toContain("const submittedFormStats = currentFormStats();");
  expect(source).not.toContain("api.validateChoice(proposed, submittedFormStats)");
  expect(source).toContain("committedAllocation = applied.allocation;");
  expect(source).toContain("Object.entries(committedAllocation).forEach(([statKey, amount]) => {");
  expect(source).not.toContain("STAT_OPTIONS.forEach((stat) => {\n          const input = $(`dm-player-stat-${stat.code.toLowerCase()}`);\n          if (input && Number.isFinite(Number(resultingStats[stat.key]))) input.value = String(resultingStats[stat.key]);");
});

test("allocated stat reflection reconciles local edits without double-applying Firebase results", () => {
  const source = read("js/dm-player-class-milestones.js");

  expect(source).toContain("const changedBeforeSubmit = Number.isFinite(submittedValue) && submittedValue !== savedValue;");
  expect(source).toContain("const changedDuringApply = String(input.value) !== submittedRawStats[statKey];");
  expect(source).toContain("const alreadyReflectedByFirebase = !changedBeforeSubmit && Number.isFinite(committedValue) && currentValue === committedValue;");
  expect(source).toContain("if (alreadyReflectedByFirebase) return;");
  expect(source).toContain("if (changedBeforeSubmit)");
  expect(source).toContain("const mergedValue = submittedValue + Number(amount);");
  expect(source).toContain("mergedValue > api.MAX_STAT");
  expect(source).toContain("if (changedDuringApply)");
  expect(source).toContain("se conservó tu edición actual");
});
