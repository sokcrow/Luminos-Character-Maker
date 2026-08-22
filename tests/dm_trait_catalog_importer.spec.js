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

test("empty Trait Library imports all known core definitions and confirmed Grants", () => {
  const plan = importer.buildImportPlan({}, [], helpers);
  expect(plan.valid).toBe(true);
  expect(plan.errors).toEqual([]);
  expect(plan.definitionWrites.map((entry) => entry.id).sort()).toEqual(Object.keys(catalog.DEFINITIONS).sort());
  expect(plan.grantWrites.map((entry) => entry.id).sort()).toEqual(catalog.GRANTS.map((entry) => entry.id).sort());
  expect(plan.definitionWrites).toHaveLength(5);
  expect(plan.grantWrites).toHaveLength(1);
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

test("core import deduplicates confirmed Grants by semantic identity even with another Firebase push id", () => {
  const existingGrants = [{
    id: "firebase_random_key",
    sourceType: "lineage",
    sourceId: "devil_lineage",
    traitId: "devil_body",
  }];
  const plan = importer.buildImportPlan({}, existingGrants, helpers);
  expect(plan.valid).toBe(true);
  expect(plan.grantWrites.some((entry) => entry.grant.traitId === "devil_body")).toBe(false);
  expect(plan.grantWrites).toHaveLength(0);
});

test("import reads persisted Firebase state directly before building its plan", async () => {
  const reads = [];
  const persistedDefinitions = {
    rage: { id: "rage", name: "Rage - Existing DM Version" },
  };
  const persistedGrants = {
    custom_push_id: {
      sourceType: "lineage",
      sourceId: "devil_lineage",
      traitId: "devil_body",
    },
  };
  const database = {
    ref(refPath) {
      return {
        async once(eventName) {
          reads.push([refPath, eventName]);
          const value = refPath === importer.DEFINITIONS_ROOT ? persistedDefinitions : persistedGrants;
          return { val: () => value };
        },
      };
    },
  };

  const persisted = await importer.readPersistedTraitState(database);
  expect(reads).toEqual([
    ["campaña/config/traits/definitions", "value"],
    ["campaña/config/traits/grants", "value"],
  ]);
  expect(persisted.definitions.rage.name).toBe("Rage - Existing DM Version");
  expect(persisted.grants).toEqual([{ id: "custom_push_id", ...persistedGrants.custom_push_id }]);

  const plan = importer.buildImportPlan(persisted.definitions, persisted.grants, helpers);
  expect(plan.definitionWrites.some((entry) => entry.id === "rage")).toBe(false);
  expect(plan.grantWrites.some((entry) => entry.grant.traitId === "devil_body")).toBe(false);
});

test("core Grant ids are Firebase-safe and deterministic", () => {
  catalog.GRANTS.forEach((grant) => {
    expect(studio.validateFirebaseKey(grant.id).valid).toBe(true);
    expect(importer.grantIdentity(grant)).toBe(studio.grantIdentity(grant));
  });
  expect(new Set(catalog.GRANTS.map((grant) => grant.id)).size).toBe(catalog.GRANTS.length);
});

test("DM loader gates the catalog stack on Trait Engine load and orders catalog before studio/importer", () => {
  const utils = read("js/utils.js");
  expect(utils).toContain("engine.addEventListener('load', ensureTraitStack, { once: true })");
  expect(utils).toContain("window.LuminousTraitEngine");

  const stackStart = utils.indexOf("const ensureTraitStack = () =>");
  const catalogIndex = utils.indexOf("js/trait-catalog-core.js", stackStart);
  const studioIndex = utils.indexOf("js/dm-trait-library-studio.js", stackStart);
  const importerIndex = utils.indexOf("js/dm-trait-catalog-importer.js", stackStart);

  expect(stackStart).toBeGreaterThan(-1);
  expect(catalogIndex).toBeGreaterThan(stackStart);
  expect(studioIndex).toBeGreaterThan(catalogIndex);
  expect(importerIndex).toBeGreaterThan(studioIndex);
});
