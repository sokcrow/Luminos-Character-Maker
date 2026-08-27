const { test, expect } = require("@playwright/test");
const path = require("node:path");

require(path.join(__dirname, "..", "js", "class-milestone-engine.js"));
const patch = require(path.join(__dirname, "..", "js", "milestone-revert-patch.js"));

test("la firma detecta si el milestone cambió después de la confirmación", () => {
  const confirmed = { type: "stats", allocation: { fuerza: 2 }, selectedAt: 100 };
  const same = { type: "stats", allocation: { strength: 2 }, selectedAt: 100 };
  const changedAllocation = { type: "stats", allocation: { destreza: 2 }, selectedAt: 101 };
  const changedTrait = { type: "trait", traitId: "jackpot", selectedAt: 101 };

  expect(patch.sameMilestoneChoice(confirmed, same)).toBe(true);
  expect(patch.sameMilestoneChoice(confirmed, changedAllocation)).toBe(false);
  expect(patch.sameMilestoneChoice(confirmed, changedTrait)).toBe(false);
});

test("la comparación de Trait incluye identidad y selectedAt", () => {
  expect(patch.sameMilestoneChoice(
    { type: "trait", traitId: "jackpot", selectedAt: 200 },
    { type: "general_trait", generalTraitId: "JACKPOT", selectedAt: 200 },
  )).toBe(true);
  expect(patch.sameMilestoneChoice(
    { type: "trait", traitId: "jackpot", selectedAt: 200 },
    { type: "trait", traitId: "alert", selectedAt: 200 },
  )).toBe(false);
});
