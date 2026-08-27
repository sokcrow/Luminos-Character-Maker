const { test, expect } = require("@playwright/test");
const registry = require("../js/content-registry.js");
const bootstrap = require("../js/content-registry-bootstrap.js");
const buildRules = require("../js/character-build-rules.js");
const traitCatalog = require("../js/trait-catalog-core.js");
const archetypeCatalog = require("../js/archetype-trait-catalog.js");

test.beforeEach(() => {
  registry.clear();
  bootstrap.resetBootstrapState();
});

test("same visible name from different sources is safe when canonical IDs differ", () => {
  registry.register({ type: "trait", id: "source_a_echo", name: "Echo", sourceKey: "source-a" });
  registry.register({ type: "trait", id: "source_b_echo", name: "Echo", sourceKey: "source-b" });

  expect(registry.get("trait:source_a_echo").name).toBe("Echo");
  expect(registry.get("trait:source_b_echo").name).toBe("Echo");
  expect(registry.list({ type: "trait" }).map((entry) => entry.canonicalId)).toEqual([
    "trait:source_a_echo",
    "trait:source_b_echo",
  ]);
});

test("visible name and localization text never generate canonical identity", () => {
  registry.register({ type: "race", id: "human", name: "Humano", labelKey: "race.human.name" });
  const entry = registry.get("race", "human");

  expect(entry.canonicalId).toBe("race:human");
  expect(registry.canonicalId("race", "human")).toBe("race:human");
  expect(() => registry.register({ type: "race", name: "Human" })).toThrow(/canonical content id|definition/i);
});

test("explicit legacy alias resolves to one canonical ID", () => {
  registry.register({ type: "class", id: "bard", name: "Bardo" });
  registry.registerAlias("class", "Bard", "class:bard");
  registry.registerAlias("class", "Bardo Legacy", "bard");

  expect(registry.resolve("class", "Bard")).toBe("class:bard");
  expect(registry.resolve("class", "Bardo Legacy")).toBe("class:bard");
});

test("duplicate canonical ID is a visible collision", () => {
  registry.register({ type: "status", id: "bleed", name: "Bleed", sourceKey: "core" });
  expect(() => registry.register({ type: "status", id: "bleed", name: "Hemorrhage", sourceKey: "mod" }))
    .toThrow(/collision.*status:bleed/i);
});

test("cross references validate canonical Class IDs without using display names", () => {
  registry.register({ type: "class", id: "bard", name: "Bardo" });
  registry.register({
    type: "trait",
    id: "bardic_example",
    name: "Example",
    sourceKey: "test",
    definition: { id: "bardic_example", source: { type: "class", classId: "bard" } },
  });

  expect(registry.validateReference("bard", "class")).toMatchObject({ valid: true, canonicalId: "class:bard" });
  expect(registry.validateReference("wizard", "class")).toEqual({ valid: false, canonicalId: null, reason: "unknown_content_id" });
});

test("legacy Character values can normalize without changing the saved selection meaning", () => {
  registry.register({ type: "race", id: "human", name: "Humano" }, { nameAliases: true });
  expect(registry.resolve("race", "Humano")).toBe("race:human");
  expect(registry.resolve("race", "human")).toBe("race:human");
});

test("registration order and translated names do not change explicit IDs", () => {
  registry.register({ type: "race", id: "human", name: "Human" });
  registry.register({ type: "class", id: "bard", name: "Bard" });
  const first = registry.list().map((entry) => entry.canonicalId);

  registry.clear();
  registry.register({ type: "class", id: "bard", name: "Bardo" });
  registry.register({ type: "race", id: "human", name: "Humano" });
  const second = registry.list().map((entry) => entry.canonicalId);

  expect(second).toEqual(first);
  expect(second).toEqual(["class:bard", "race:human"]);
});

test("canonical IDs are Firebase-key safe under the v1 policy", () => {
  for (const id of [
    registry.canonicalId("class", "bard"),
    registry.canonicalId("race", "human"),
    registry.canonicalId("archetype", "bard:college_of_whispers"),
    registry.canonicalId("trait", "general_alert"),
  ]) expect(registry.isFirebaseSafeId(id)).toBe(true);

  for (const bad of ["race.human", "race/human", "race#human", "race[human]"]) {
    expect(registry.isFirebaseSafeId(bad)).toBe(false);
  }
  expect(registry.validateLocalId("human.name")).toMatchObject({ valid: false });
});

test("core Character, Trait and Archetype catalogs register behind one query layer", () => {
  bootstrap.registerAvailableCore({
    modules: {
      buildRules,
      traitCatalog,
      archetypeCatalog,
      languageCatalog: {
        DND_DEFAULTS: {
          common: { nombre: "Común", universal: true },
        },
      },
      skillCatalog: {
        DEFINITIONS: { athletics: { id: "athletics", name: "Athletics" } },
      },
      spellCatalog: {
        DEFINITIONS: { test_spell: { id: "test_spell", name: "Test Spell" } },
      },
    },
  });

  expect(registry.has("class", "barbarian")).toBe(true);
  expect(registry.has("race", "human")).toBe(true);
  expect(registry.has("background", "nest_heir")).toBe(true);
  expect(registry.has("archetype", "college_of_whispers")).toBe(true);
  expect(registry.has("trait", "rage")).toBe(true);
  expect(registry.has("trait", "psychic_blade")).toBe(true);
  expect(registry.has("language", "common")).toBe(true);
  expect(registry.has("skill", "athletics")).toBe(true);
  expect(registry.has("spell", "test_spell")).toBe(true);
  expect(registry.resolve("race", "Humano")).toBe("race:human");
});

test("same source bootstrap is idempotent but different sources still collide", () => {
  const modules = { buildRules, traitCatalog, archetypeCatalog };
  bootstrap.registerAvailableCore({ modules });
  const before = registry.list().length;
  bootstrap.registerAvailableCore({ modules });
  expect(registry.list().length).toBe(before);

  expect(() => bootstrap.registerGenericCatalog("trait", {
    rage: { id: "rage", name: "Different Rage" },
  }, "conflicting-mod" )).toThrow(/collision.*trait:rage/i);
});
