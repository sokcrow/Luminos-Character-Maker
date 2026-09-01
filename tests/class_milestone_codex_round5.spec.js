const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const milestones = require("../js/class-milestone-engine.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("allocated milestone Stats reject missing, blank and invalid submitted values", () => {
  const choice = { type: "stats", allocation: { fuerza: 2 } };

  expect(milestones.validateChoice(choice, {}).valid).toBe(false);
  expect(milestones.validateChoice(choice, { fuerza: "" }).valid).toBe(false);
  expect(milestones.validateChoice(choice, { fuerza: "abc" }).valid).toBe(false);
  expect(milestones.validateChoice(choice, { fuerza: 18 }).valid).toBe(true);
});

test("player runtime feeds resolved Grants and milestone Traits into the live Trait tray", () => {
  const source = read("js/player-trait-runtime.js");

  expect(source).toContain("traitEngine.resolveTraitGrants(");
  expect(source).toContain("milestones.resolveSelectedGeneralTraits(character, definitions)");
  expect(source).toContain("state.tray = trayApi.mount({");
  expect(source).toContain("getTraits: resolveTraits");
  expect(source).toContain("traitEngine.dispatchTraits(resolveTraits(), trigger");
  expect(source).toContain("traits: resolveTraits(),");
});

test("player character sheet loader includes the Trait runtime", () => {
  const source = read("js/utils.js");

  expect(source).toContain("function ensurePlayerTraitRuntimeAssets(doc)");
  expect(source).toContain("player-trait-runtime-script");
  expect(source).toContain("js/player-trait-runtime.js");
  expect(source).toContain("ensurePlayerTraitRuntimeAssets(document);");
});