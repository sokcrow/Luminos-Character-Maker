const { test, expect } = require("@playwright/test");
const studio = require("../js/dm-trait-library-studio.js");

const validTrait = (id) => ({
  id,
  name: "Danger Senses",
  source: { type: "class", id: "barbarian" },
  contexts: ["theatre"],
  activation: { type: "passive" },
  effects: [{
    trigger: "before_check",
    conditions: [{ path: "check.abilityId", operator: "eq", value: "dex" }],
    operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
  }],
});

test("Firebase-safe Trait IDs accept normal rule identifiers", () => {
  for (const id of ["rage", "danger_senses", "devil-trigger", "trait 01"]) {
    expect(studio.validateFirebaseKey(id).valid).toBe(true);
  }
});

test("Firebase-invalid path characters are rejected before persistence", () => {
  for (const character of [".", "#", "$", "[", "]", "/"]) {
    const result = studio.validateFirebaseKey(`rage${character}burst`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Firebase key cannot contain");
  }
});

test("persistence validation rejects a mechanically valid Trait with slash in its ID", () => {
  const result = studio.validateDefinitionForPersistence(validTrait("danger/senses"));
  expect(result.valid).toBe(false);
  expect(result.errors.join(" ")).toContain("not Firebase-safe");
});

test("persistence validation keeps a mechanically valid Firebase-safe Trait valid", () => {
  const result = studio.validateDefinitionForPersistence(validTrait("danger_senses"));
  expect(result.valid).toBe(true);
  expect(result.trait.id).toBe("danger_senses");
});
