const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const studio = require("../js/dm-trait-library-studio.js");
require("../js/trait-catalog-core.js");
const importer = require("../js/dm-trait-catalog-importer.js");
const catalog = global.LuminousTraitCatalogCore;
const racialCatalog = global.LuminousRacialTraitCatalog;
const archetypeCatalog = global.LuminousArchetypeTraitCatalog;

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const helpers = {
  validateDefinitionForPersistence: studio.validateDefinitionForPersistence,
  validateGrant: studio.validateGrant,
  validateFirebaseKey: studio.validateFirebaseKey,
};

const barbarianGrantCount = () => catalog.GRANTS.filter((grant) => grant.sourceType === "class" && grant.sourceId === "barbarian").length;
const allBuiltInDefinitions = () => Object.fromEntries(
  Object.values(importer.collectCatalog().definitions).map(({ id, definition }) => [id, definition]),
);

test("empty Trait Library imports every built-in definition and only generic Grants", () => {
  const plan = importer.buildImportPlan({}, [], helpers);
  const collected = importer.collectCatalog();

  expect(plan.valid).toBe(true);
  expect(plan.errors).toEqual([]);
  expect(plan.providerKeys).toEqual(expect.arrayContaining(["core", "racial", "archetype"]));
  expect(plan.definitionWrites.map((entry) => entry.id).sort()).toEqual(Object.keys(collected.definitions).sort());
  expect(plan.grantWrites.map((entry) => entry.id).sort()).toEqual(collected.grants.map((entry) => entry.id).sort());
  expect(plan.definitionWrites).toHaveLength(Object.keys(collected.definitions).length);
  expect(plan.grantWrites).toHaveLength(collected.grants.length);
  expect(barbarianGrantCount()).toBe(12);

  const definitionIds = new Set(plan.definitionWrites.map((entry) => entry.id));
  expect(definitionIds.has("bardic_inspiration")).toBe(true);
  expect(definitionIds.has("yuan_ti_magic_resistance")).toBe(true);
  expect(definitionIds.has("psychic_blade")).toBe(true);

  expect(plan.grantWrites.some((entry) => entry.grant.sourceType === "race")).toBe(false);
  expect(plan.grantWrites.some((entry) => entry.grant.sourceType === "archetype")).toBe(false);
  expect(plan.grantWrites.some((entry) => entry.grant.traitId === "bardic_inspiration")).toBe(true);
});

test("catalog providers expose the specialized catalogs without importing their automatic Grants", () => {
  expect(racialCatalog?.allDefinitions?.().yuan_ti_magic_resistance).toBeTruthy();
  expect(archetypeCatalog?.allDefinitions?.().psychic_blade).toBeTruthy();

  const collected = importer.collectCatalog();
  expect(collected.definitions.yuan_ti_magic_resistance.catalogSource).toBe("racial");
  expect(collected.definitions.psychic_blade.catalogSource).toBe("archetype");
  expect(collected.grants.every((entry) => entry.catalogSource === "core")).toBe(true);
});

test("core import never overwrites an existing DM Trait definition without catalog ownership", () => {
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
  expect(plan.skippedDefinitions).toBeGreaterThanOrEqual(1);
});

test("managed core definitions upgrade when their catalogVersion is older", () => {
  const oldManagedRage = {
    ...catalog.getDefinition("rage"),
    name: "Rage v1",
    catalogVersion: 1,
    createdAt: 111,
    updatedAt: 111,
  };
  const plan = importer.buildImportPlan({ rage: oldManagedRage }, [], helpers);
  const rageWrite = plan.definitionWrites.find((entry) => entry.id === "rage");
  expect(plan.valid).toBe(true);
  expect(rageWrite).toMatchObject({ id: "rage", replace: true, catalogSource: "core" });

  const mutation = importer.buildAtomicImportMutation({ definitions: { rage: oldManagedRage }, grants: {} }, helpers, 222);
  expect(mutation.next.definitions.rage.name).toBe("Rage");
  expect(mutation.next.definitions.rage.catalogSource).toBe("core");
  expect(mutation.next.definitions.rage.catalogVersion).toBe(catalog.CATALOG_VERSION);
  expect(mutation.next.definitions.rage.createdAt).toBe(111);
  expect(mutation.next.definitions.rage.updatedAt).toBe(222);
});

test("managed specialized definitions refresh on content changes without leaking specialized Grants", () => {
  const racial = importer.collectCatalog().definitions.yuan_ti_magic_resistance;
  const stale = {
    ...racial.definition,
    description: "STALE RACIAL COPY",
    catalogSource: "racial",
    catalogVersion: racial.catalogVersion,
    createdAt: 333,
    updatedAt: 333,
  };

  const mutation = importer.buildAtomicImportMutation({ definitions: { yuan_ti_magic_resistance: stale }, grants: {} }, helpers, 444);
  expect(mutation.valid).toBe(true);
  expect(mutation.next.definitions.yuan_ti_magic_resistance.description).toBe(racial.definition.description);
  expect(mutation.next.definitions.yuan_ti_magic_resistance.catalogSource).toBe("racial");
  expect(mutation.next.definitions.yuan_ti_magic_resistance.createdAt).toBe(333);
  expect(mutation.plan.grantWrites.some((entry) => entry.grant.sourceType === "race")).toBe(false);
});

test("custom definition with a built-in archetype id remains DM-owned", () => {
  const custom = {
    id: "psychic_blade",
    name: "Psychic Blade - DM Custom",
    description: "Custom definition.",
    contexts: ["combat"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
    rules: [],
  };
  const plan = importer.buildImportPlan({ psychic_blade: custom }, [], helpers);
  expect(plan.valid).toBe(true);
  expect(plan.definitionWrites.some((entry) => entry.id === "psychic_blade")).toBe(false);
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
  expect(plan.grantWrites).toHaveLength(catalog.GRANTS.length - 1);
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
  expect(mutation.plan.grantWrites).toHaveLength(catalog.GRANTS.length - 1);
  expect(mutation.next.definitions.rage.name).toBe("Rage - Concurrent DM Version");
  expect(mutation.next.grants.custom_push_id.traitId).toBe("devil_body");
  expect(mutation.next.unrelated).toEqual({ keep: true });
  expect(mutation.next.definitions.danger_senses.createdAt).toBe(1234);
  expect(mutation.next.definitions.yuan_ti_magic_resistance.catalogSource).toBe("racial");
  expect(mutation.next.definitions.psychic_blade.catalogSource).toBe("archetype");
  expect(mutation.next.grants.core_class_barbarian_l100_primordial_champion.atLevel).toBe(100);
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
  expect(result.grantWrites).toHaveLength(catalog.GRANTS.length - 1);
  expect(committedTree.definitions.rage.name).toBe("Rage - Saved During Import");
  expect(committedTree.grants.another_dm_grant.traitId).toBe("devil_body");
  expect(Object.keys(committedTree.definitions)).toEqual(expect.arrayContaining([
    "additional_attack",
    "armorless_defense",
    "bardic_inspiration",
    "danger_senses",
    "devil_body",
    "devil_trigger",
    "psychic_blade",
    "rage",
    "yuan_ti_magic_resistance",
  ]));
});

test("no-op cache is server-confirmed and retries when the server lost a catalog definition", async () => {
  const completeTree = {
    definitions: allBuiltInDefinitions(),
    grants: Object.fromEntries(catalog.allGrants().map(({ id, ...grant }) => [id, grant])),
  };
  const serverTree = JSON.parse(JSON.stringify(completeTree));
  delete serverTree.definitions.rage;

  let attempts = 0;
  let committedTree = null;
  const database = {
    ref(refPath) {
      expect(refPath).toBe(importer.TRAITS_ROOT);
      return {
        async transaction(update) {
          attempts += 1;
          const cachedCandidate = update(completeTree);
          expect(cachedCandidate).toEqual(completeTree);

          attempts += 1;
          committedTree = update(serverTree);
          return { committed: true, snapshot: { val: () => committedTree } };
        },
      };
    },
  };

  const result = await importer.runAtomicImport(database, helpers, 9012);
  expect(attempts).toBe(2);
  expect(result.committed).toBe(true);
  expect(result.definitionWrites.map((entry) => entry.id)).toEqual(["rage"]);
  expect(result.grantWrites).toHaveLength(0);
  expect(committedTree.definitions.rage.name).toBe("Rage");
  expect(committedTree.definitions.rage.catalogSource).toBe("core");
  expect(committedTree.definitions.rage.createdAt).toBe(9012);
});

test("generic catalog Grant ids are Firebase-safe and deterministic", () => {
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
