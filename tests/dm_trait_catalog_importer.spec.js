const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const studio = require("../js/dm-trait-library-studio.js");
const catalog = require("../js/trait-catalog-core.js");
const importer = require("../js/dm-trait-catalog-importer.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const helpers = {
  validateDefinitionForPersistence: studio.validateDefinitionForPersistence,
  validateGrant: studio.validateGrant,
  validateFirebaseKey: studio.validateFirebaseKey,
};

test("empty Trait Library imports all known core definitions and Grants", () => {
  const plan = importer.buildImportPlan({}, [], helpers);
  expect(plan.valid).toBe(true);
  expect(plan.errors).toEqual([]);
  expect(plan.definitionWrites.map((entry) => entry.id).sort()).toEqual(Object.keys(catalog.DEFINITIONS).sort());
  expect(plan.grantWrites.map((entry) => entry.id).sort()).toEqual(catalog.GRANTS.map((entry) => entry.id).sort());
  expect(plan.definitionWrites).toHaveLength(5);
  expect(plan.grantWrites).toHaveLength(3);
});

test("core import never overwrites an existing DM Trait definition", () => {
  const existing = {
    rage: {
      id: "rage",
      name: "Rage - DM Custom",
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "quick_action" },
      effects: [{ trigger: "on_use", operations: [{ type: "apply_status", statusId: "rage" }] }],
    },
  };
  const plan = importer.buildImportPlan(existing, [], helpers);
  expect(plan.valid).toBe(true);
  expect(plan.definitionWrites.some((entry) => entry.id === "rage")).toBe(false);
  expect(plan.skippedDefinitions).toBe(1);
});

test("core import deduplicates Grants by semantic identity even with another Firebase push id", () => {
  const existingGrants = [{
    id: "firebase_random_key",
    sourceType: "class",
    sourceId: "barbarian",
    atLevel: 2,
    traitId: "rage",
  }];
  const plan = importer.buildImportPlan({}, existingGrants, helpers);
  expect(plan.valid).toBe(true);
  expect(plan.grantWrites.some((entry) => entry.grant.traitId === "rage")).toBe(false);
  expect(plan.grantWrites).toHaveLength(2);
});

test("core Grant ids are Firebase-safe and deterministic", () => {
  catalog.GRANTS.forEach((grant) => {
    expect(studio.validateFirebaseKey(grant.id).valid).toBe(true);
    expect(importer.grantIdentity(grant)).toBe(studio.grantIdentity(grant));
  });
  expect(new Set(catalog.GRANTS.map((grant) => grant.id)).size).toBe(catalog.GRANTS.length);
});

test("DM loader orders Trait Engine before catalog, studio and importer", () => {
  const utils = read("js/utils.js");
  const engine = utils.indexOf("js/trait-engine.js");
  const catalogIndex = utils.indexOf("js/trait-catalog-core.js");
  const studioIndex = utils.indexOf("js/dm-trait-library-studio.js");
  const importerIndex = utils.indexOf("js/dm-trait-catalog-importer.js");

  expect(engine).toBeGreaterThan(-1);
  expect(catalogIndex).toBeGreaterThan(-1);
  expect(studioIndex).toBeGreaterThan(-1);
  expect(importerIndex).toBeGreaterThan(-1);
  expect(catalogIndex).toBeLessThan(studioIndex);
  expect(studioIndex).toBeLessThan(importerIndex);
});
