const { test, expect } = require("@playwright/test");
const registry = require("../js/content-registry.js");
const bootstrap = require("../js/content-registry-bootstrap.js");
const buildRules = require("../js/character-build-rules.js");
const traitCatalog = require("../js/trait-catalog-core.js");
const archetypeCatalog = require("../js/archetype-trait-catalog.js");
const persistence = require("../js/character-persistence.js");
const firebasePersistence = require("../js/character-persistence-firebase.js");
const derived = require("../js/derived-stats-engine.js");

function registerCore() {
  registry.clear();
  bootstrap.resetBootstrapState();
  bootstrap.registerAvailableCore({ modules: { buildRules, traitCatalog, archetypeCatalog } });
}

function fakeRef(initial) {
  let value = JSON.parse(JSON.stringify(initial));
  return {
    once: async () => ({ val: () => JSON.parse(JSON.stringify(value)) }),
    set: async (next) => { value = JSON.parse(JSON.stringify(next)); },
    value: () => JSON.parse(JSON.stringify(value)),
  };
}

test.beforeEach(registerCore);

test("schema v1 Base Stats remain the source for Derived Stats after reload", () => {
  const prepared = persistence.prepareForSave({
    characterName: "Persistence + Derived",
    originId: "humano",
    clase: "Guerrero",
    level: 10,
    baseStats: {
      fuerza: 10,
      destreza: 10,
      constitucion: 10,
      inteligencia: 10,
      sabiduria: 10,
      carisma: 10,
    },
    // Compatibility cache from older surfaces must never become the canonical base.
    stats: {
      fuerza: 11,
      destreza: 11,
      constitucion: 11,
      inteligencia: 11,
      sabiduria: 11,
      carisma: 11,
    },
  }, { registry });

  expect(prepared.ok).toBe(true);
  expect(prepared.character.schemaVersion).toBe(1);
  expect(prepared.character.characterBuild.baseStats.fuerza).toBe(10);

  const reloaded = persistence.load(prepared.character, { registry });
  expect(reloaded.ok).toBe(true);
  const snapshot = derived.resolveCharacterStats(reloaded.character);
  expect(snapshot.baseStats.fuerza).toBe(10);
  expect(snapshot.effectiveStats.fuerza).toBe(11);
  expect(snapshot.effectiveStats.fuerza).not.toBe(12);
});

test("derived/runtime caches are removed while deterministic Derived Stats can be rebuilt", () => {
  const prepared = persistence.prepareForSave({
    characterName: "No Runtime Cache",
    originId: "humano",
    clase: "Bardo",
    level: 10,
    baseStats: { carisma: 14, constitucion: 12 },
    derivedStats: { offensiveLevel: 999, defensiveLevel: 999 },
    abilityMods: { cha: 99 },
    actionEconomy: { slots: 99 },
    encounterState: { active: true },
  }, { registry });

  expect(prepared.ok).toBe(true);
  expect(prepared.character.derivedStats).toBeUndefined();
  expect(prepared.character.abilityMods).toBeUndefined();
  expect(prepared.character.actionEconomy).toBeUndefined();
  expect(prepared.character.encounterState).toBeUndefined();

  const snapshot = derived.resolveCharacterStats(prepared.character);
  expect(snapshot.abilities.cha.modifier).toBe(derived.abilityModifier(snapshot.abilities.cha.score));
  expect(snapshot.offensiveLevel.total).not.toBe(999);
  expect(snapshot.defensiveLevel.total).not.toBe(999);
});

test("Firebase read-modify-save round trip preserves schema v1 and recomputes from changed Base Stats", async () => {
  const ref = fakeRef({
    characterName: "Round Trip",
    originId: "humano",
    clase: "Guerrero",
    level: 10,
    baseStats: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
  });

  const migrated = await firebasePersistence.migrateCharacterRef(ref, { registry });
  expect(migrated.ok).toBe(true);
  expect(ref.value().schemaVersion).toBe(1);

  const modified = await firebasePersistence.modifyAndSave(ref, (character) => {
    character.characterBuild.baseStats.fuerza = 14;
  }, { registry });
  expect(modified.ok).toBe(true);
  expect(modified.written).toBe(true);

  const loaded = await firebasePersistence.readCharacter(ref, { registry });
  expect(loaded.ok).toBe(true);
  expect(loaded.character.characterBuild.baseStats.fuerza).toBe(14);
  const snapshot = derived.resolveCharacterStats(loaded.character);
  expect(snapshot.baseStats.fuerza).toBe(14);
  expect(snapshot.effectiveStats.fuerza).toBe(15);
});

test("future schema is still protected even when Derived Stats v1 is present", async () => {
  const ref = fakeRef({ schemaVersion: 99, characterName: "Future", baseStats: { fuerza: 30 } });
  const result = await firebasePersistence.migrateCharacterRef(ref, { registry });
  expect(result.ok).toBe(false);
  expect(result.written).toBe(false);
  expect(result.diagnostics.errors[0].code).toBe("UNSUPPORTED_FUTURE_SCHEMA");
  expect(ref.value().schemaVersion).toBe(99);
});
