const { test, expect } = require("@playwright/test");
const registry = require("../js/content-registry.js");
const bootstrap = require("../js/content-registry-bootstrap.js");
const buildRules = require("../js/character-build-rules.js");
const traitCatalog = require("../js/trait-catalog-core.js");
const archetypeCatalog = require("../js/archetype-trait-catalog.js");
const persistence = require("../js/character-persistence.js");
const firebasePersistence = require("../js/character-persistence-firebase.js");

function registerCore() {
  registry.clear();
  bootstrap.resetBootstrapState();
  bootstrap.registerAvailableCore({ modules: { buildRules, traitCatalog, archetypeCatalog } });
}

function fakeRef(initial) {
  let value = JSON.parse(JSON.stringify(initial));
  const writes = [];
  return {
    writes,
    once: async () => ({ val: () => JSON.parse(JSON.stringify(value)) }),
    set: async (next) => {
      value = JSON.parse(JSON.stringify(next));
      writes.push(JSON.parse(JSON.stringify(next)));
    },
    value: () => JSON.parse(JSON.stringify(value)),
  };
}

test.beforeEach(registerCore);

test("new prepared saves include schemaVersion 1 and canonical typed build IDs", () => {
  const result = persistence.prepareForSave({
    characterName: "Aster",
    originId: "humano",
    clase: "Bárbaro",
    baseStats: { fuerza: 10, destreza: 12 },
  }, { registry });

  expect(result.ok).toBe(true);
  expect(result.character.schemaVersion).toBe(1);
  expect(result.character.characterBuild.raceId).toBe("human");
  expect(result.character.characterBuild.classes).toEqual([{ classId: "barbarian", levels: 1 }]);
  expect(result.character.characterBuild.baseStats).toEqual({ fuerza: 10, destreza: 12 });
});

test("real legacy-shaped save migrates without losing identity, class, selections, stats or unknown user fields", () => {
  const legacy = {
    uid: "legacy-user",
    characterName: "Legacy One",
    originId: "goliat",
    backgroundId: "alta_cuna",
    clase: "Bardo",
    classLevel: 15,
    baseStats: { fuerza: 10, destreza: 14, carisma: 16 },
    traitSelections: ["rage"],
    humanPerks: [{ id: "bg_perk_legacy", nombre: "Contacto antiguo", desc: "Legacy free-form perk" }],
    finance: { currentBalance: 500 },
  };

  const result = persistence.load(legacy, { registry });
  expect(result.ok).toBe(true);
  expect(result.character.characterBuild.raceId).toBe("goliath");
  expect(result.character.characterBuild.classes).toEqual([{ classId: "bard", levels: 15 }]);
  expect(result.character.characterBuild.baseStats).toEqual(legacy.baseStats);
  expect(result.character.characterBuild.traitSelections).toEqual(["rage"]);
  expect(result.character.humanPerks).toEqual(legacy.humanPerks);
  expect(result.character.finance).toEqual(legacy.finance);
  expect(result.character.backgroundId).toBe("alta_cuna");
  expect(result.character.characterBuild.backgroundId).toBeNull();
  expect(result.diagnostics.warnings.some((entry) => entry.code === "UNRESOLVED_LEGACY_CONTENT_ID")).toBe(true);
});

test("migration is sequential and idempotent", () => {
  const legacy = { characterName: "Idem", originId: "centauro", clase: "Guerrero", baseStats: { fuerza: 11 } };
  const once = persistence.load(legacy, { registry });
  const twice = persistence.load(once.character, { registry });

  expect(once.ok).toBe(true);
  expect(twice.ok).toBe(true);
  expect(twice.character).toEqual(once.character);
});

test("save and reload do not apply racial bonuses or mutate base Stats", () => {
  const input = {
    schemaVersion: 1,
    characterBuild: {
      raceId: "human",
      raceSubtypeId: null,
      backgroundId: null,
      classes: [{ classId: "fighter", levels: 8 }],
      archetypes: [],
      baseStats: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
      racialStatChoices: ["str", "dex"],
      milestoneSelections: [],
      traitSelections: [],
      skillSelections: [],
      spellSelections: [],
    },
  };

  const saved = persistence.prepareForSave(input, { registry });
  const reloaded = persistence.load(saved.character, { registry });
  expect(saved.ok).toBe(true);
  expect(reloaded.ok).toBe(true);
  expect(reloaded.character.characterBuild.baseStats).toEqual(input.characterBuild.baseStats);
  expect(reloaded.character.characterBuild.racialStatChoices).toEqual(["str", "dex"]);
});

test("unknown canonical content ID produces a manageable diagnostic instead of silent coercion", () => {
  const result = persistence.load({
    schemaVersion: 1,
    characterBuild: {
      raceId: "not_a_real_race",
      raceSubtypeId: null,
      backgroundId: null,
      classes: [],
      archetypes: [],
      baseStats: {},
      racialStatChoices: [],
      milestoneSelections: [],
      traitSelections: [],
      skillSelections: [],
      spellSelections: [],
    },
  }, { registry });

  expect(result.ok).toBe(false);
  expect(result.character).toBeNull();
  expect(result.candidate.characterBuild.raceId).toBe("not_a_real_race");
  expect(result.diagnostics.errors).toContainEqual(expect.objectContaining({
    code: "UNKNOWN_CANONICAL_CONTENT_ID",
    path: "characterBuild.raceId",
  }));
});

test("verified legacy aliases resolve through the canonical Registry boundary", () => {
  const result = persistence.load({ originId: "yuanti_pura_sangre", clase: "Mago", baseStats: {} }, { registry });
  expect(result.ok).toBe(true);
  expect(result.character.characterBuild.raceId).toBe("yuan_ti_pureblood");
  expect(result.character.characterBuild.classes[0].classId).toBe("wizard");
});

test("temporary derived/runtime state is excluded from canonical save while unrelated user data survives", () => {
  const result = persistence.prepareForSave({
    characterName: "Runtime",
    originId: "humano",
    clase: "Monje",
    baseStats: { destreza: 12 },
    derivedStats: { offensiveLevel: 999 },
    abilityMods: { dex: 99 },
    actionEconomy: { actions: 0 },
    uiState: { tab: "combat" },
    finance: { currentBalance: 1234 },
  }, { registry });

  expect(result.ok).toBe(true);
  expect(result.character.derivedStats).toBeUndefined();
  expect(result.character.abilityMods).toBeUndefined();
  expect(result.character.actionEconomy).toBeUndefined();
  expect(result.character.uiState).toBeUndefined();
  expect(result.character.finance).toEqual({ currentBalance: 1234 });
});

test("failed migration preserves the untouched raw original and does not produce writable character", () => {
  const raw = { schemaVersion: 99, characterName: "Future", secretFutureField: { keep: true } };
  const result = persistence.load(raw, { registry });
  expect(result.ok).toBe(false);
  expect(result.character).toBeNull();
  expect(result.rawBackup).toEqual(raw);
  expect(result.diagnostics.errors[0].code).toBe("UNSUPPORTED_FUTURE_SCHEMA");
});

test("multiclass and Archetype selections preserve per-Class levels", () => {
  const input = {
    schemaVersion: 1,
    characterBuild: {
      raceId: "human",
      raceSubtypeId: null,
      backgroundId: null,
      classes: [
        { classId: "barbarian", levels: 20 },
        { classId: "bard", levels: 15 },
      ],
      archetypes: [
        { classId: "barbarian", archetypeId: "path_of_the_devil_lineage", selectedAtClassLevel: 15 },
        { classId: "bard", archetypeId: "college_of_whispers", selectedAtClassLevel: 15 },
      ],
      baseStats: {},
      racialStatChoices: [],
      milestoneSelections: [],
      traitSelections: [],
      skillSelections: [],
      spellSelections: [],
    },
  };

  const result = persistence.prepareForSave(input, { registry });
  expect(result.ok).toBe(true);
  expect(result.character.characterBuild.classes).toEqual([
    { classId: "barbarian", levels: 20 },
    { classId: "bard", levels: 15 },
  ]);
  expect(result.character.characterBuild.archetypes).toEqual(input.characterBuild.archetypes);
});

test("newer-than-client schema fails safely and Firebase adapter never overwrites it", async () => {
  const raw = { schemaVersion: 7, characterName: "Do Not Touch", futureData: { x: 1 } };
  const ref = fakeRef(raw);
  const result = await firebasePersistence.migrateCharacterRef(ref, { registry });

  expect(result.ok).toBe(false);
  expect(result.written).toBe(false);
  expect(ref.writes).toHaveLength(0);
  expect(ref.value()).toEqual(raw);
});

test("validated Firebase migration can write backup before canonical replacement", async () => {
  const raw = { characterName: "Backup", originId: "humano", clase: "Clérigo", baseStats: { sabiduria: 15 } };
  const ref = fakeRef(raw);
  const backupRef = fakeRef(null);
  const result = await firebasePersistence.migrateCharacterRef(ref, { registry, backupRef });

  expect(result.ok).toBe(true);
  expect(result.backupWritten).toBe(true);
  expect(result.written).toBe(true);
  expect(backupRef.value()).toEqual(raw);
  expect(ref.value().schemaVersion).toBe(1);
});
