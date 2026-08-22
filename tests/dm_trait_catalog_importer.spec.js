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

test("atomic mutation preserves concurrent custom definitions and semantic Grants", () => {
  const currentTree = {
    definitions: {
      rage: { id: "rage", name: "Rage - Concurrent DM Version" },
    },
    grants: {
      custom_push_id: {
        sourceType: "lineage",
        sourceId: "devil_lineage",
        traitId: "devil_body",
      },
    },
    unrelated: { keep: true },
  };

  const mutation = importer.buildAtomicImportMutation(currentTree, helpers, 1234);
  expect(mutation.valid).toBe(true);
  expect(mutation.changed).toBe(true);
  expect(mutation.plan.definitionWrites.some((entry) => entry.id === "rage")).toBe(false);
  expect(mutation.plan.grantWrites).toHaveLength(0);
  expect(mutation.next.definitions.rage.name).toBe("Rage - Concurrent DM Version");
  expect(mutation.next.grants.custom_push_id.traitId).toBe("devil_body");
  expect(mutation.next.unrelated).toEqual({ keep: true });
  expect(mutation.next.definitions.danger_senses.createdAt).toBe(1234);
});

test("Firebase transaction retry replans against a concurrent DM write before commit", async () => {
  const concurrentTree = {
    definitions: {
      rage: { id: "rage", name: "Rage - Saved During Import" },
    },
    grants: {
      another_dm_grant: {
        sourceType: "lineage",
        sourceId: "devil_lineage",
        traitId: "devil_body",
      },
    },
  };

  let attempts = 0;
  let committedTree = null;
  const database = {
    ref(refPath) {
      expect(refPath).toBe(importer.TRAITS_ROOT);
      return {
        async transaction(update) {
          attempts += 1;
          const staleCandidate = update({ definitions: {}, grants: {} });
          expect(staleCandidate.definitions.rage.name).toBe("Rage");

          attempts += 1;
          committedTree = update(concurrentTree);
          return { committed: true, snapshot: { val: () => committedTree } };
        },
      };
    },
  };

  const result = await importer.runAtomicImport(database, helpers, 5678);
  expect(attempts).toBe(2);
  expect(result.committed).toBe(true);
  expect(result.definitionWrites.some((entry) => entry.id === "rage")).toBe(false);
  expect(result.grantWrites).toHaveLength(0);
  expect(committedTree.definitions.rage.name).toBe("Rage - Saved During Import");
  expect(committedTree.grants.another_dm_grant.traitId).toBe("devil_body");
  expect(Object.keys(committedTree.definitions)).toEqual(expect.arrayContaining([
    "danger_senses",
    "devil_body",
    "devil_trigger",
    "green_eyed_heir",
    "rage",
  ]));
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
