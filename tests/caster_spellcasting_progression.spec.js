const { test, expect } = require("@playwright/test");

const baseTraitEngine = require("../js/trait-engine.js");
global.LuminousTraitEngine = baseTraitEngine;

delete global.LuminousSpellcastingRuntime;
delete global.LuminousCasterSpellcastingTraitsRuntime;
delete global.LuminousTraitCatalogCore;
delete require.cache[require.resolve("../js/spellcasting-runtime.js")];
delete require.cache[require.resolve("../js/spellcasting-basic-rules-runtime.js")];
delete require.cache[require.resolve("../js/trait-catalog-core.js")];
delete require.cache[require.resolve("../js/caster-spellcasting-traits-runtime.js")];

require("../js/spellcasting-runtime.js");
const spellcasting = require("../js/spellcasting-basic-rules-runtime.js");
require("../js/trait-catalog-core.js");
const casterTraits = require("../js/caster-spellcasting-traits-runtime.js");

function characterWithClass(classId, levels, stats = {}) {
  return {
    id: `${classId}_pc`,
    level: levels,
    proficiency: 3,
    classes: [{ classId, levels }],
    stats: { inteligencia: 18, sabiduria: 16, carisma: 20, ...stats },
    currentSp: 50,
  };
}

test("Caster profiles define the Spellcasting Ability and progression for every caster Class", () => {
  expect(spellcasting.getClassSpellcastingProfile("artificer")).toMatchObject({ abilityId: "int", progression: "half", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("bard")).toMatchObject({ abilityId: "cha", progression: "full", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("cleric")).toMatchObject({ abilityId: "wis", progression: "full", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("druid")).toMatchObject({ abilityId: "wis", progression: "full", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("paladin")).toMatchObject({ abilityId: "cha", progression: "half", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("ranger")).toMatchObject({ abilityId: "wis", progression: "half", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("sorcerer")).toMatchObject({ abilityId: "cha", progression: "full", recovery: "long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("warlock")).toMatchObject({ abilityId: "cha", progression: "pact", recovery: "short_or_long_rest" });
  expect(spellcasting.getClassSpellcastingProfile("wizard")).toMatchObject({ abilityId: "int", progression: "full", recovery: "long_rest" });
});

test("Spanish Class aliases resolve to the canonical caster profile", () => {
  expect(spellcasting.canonicalSpellcastingClassId("hechicero")).toBe("sorcerer");
  expect(spellcasting.canonicalSpellcastingClassId("mago")).toBe("wizard");
  expect(spellcasting.canonicalSpellcastingClassId("brujo")).toBe("warlock");
  expect(spellcasting.getClassSpellcastingAbility("bardo")).toBe("cha");
});

test("Limbus Class Levels use D&D milestones while intermediate Levels keep the previous row", () => {
  expect(spellcasting.limbusClassLevelToDndLevel(1)).toBe(1);
  expect(spellcasting.limbusClassLevelToDndLevel(9)).toBe(1);
  expect(spellcasting.limbusClassLevelToDndLevel(10)).toBe(2);
  expect(spellcasting.limbusClassLevelToDndLevel(14)).toBe(2);
  expect(spellcasting.limbusClassLevelToDndLevel(15)).toBe(3);
  expect(spellcasting.limbusClassLevelToDndLevel(99)).toBe(19);
  expect(spellcasting.limbusClassLevelToDndLevel(100)).toBe(20);
});

test("Full Caster slots are derived automatically from Limbus Class Level", () => {
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("sorcerer", 1), "sorcerer")).toEqual({ 1: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("sorcerer", 10), "sorcerer")).toEqual({ 1: 3 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("sorcerer", 15), "sorcerer")).toEqual({ 1: 4, 2: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("sorcerer", 25), "sorcerer")).toEqual({ 1: 4, 2: 3, 3: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("sorcerer", 85), "sorcerer")).toEqual({
    1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1,
  });
});

test("Half Caster slots are derived automatically from Limbus Class Level", () => {
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("artificer", 1), "artificer")).toEqual({ 1: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("paladin", 25), "paladin")).toEqual({ 1: 4, 2: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("ranger", 45), "ranger")).toEqual({ 1: 4, 2: 3, 3: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("paladin", 85), "paladin")).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
});

test("Pact Caster slots keep one active Slot Level and scale count separately", () => {
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("warlock", 1), "warlock")).toEqual({ 1: 1 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("warlock", 15), "warlock")).toEqual({ 2: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("warlock", 45), "warlock")).toEqual({ 5: 2 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("warlock", 55), "warlock")).toEqual({ 5: 3 });
  expect(spellcasting.getClassSpellSlotTable(characterWithClass("warlock", 85), "warlock")).toEqual({ 5: 4 });
});

test("Automatic Spell Slots use source Class Level instead of total Character Level", () => {
  const multiclass = {
    level: 85,
    proficiency: 5,
    classes: [
      { classId: "sorcerer", levels: 15 },
      { classId: "fighter", levels: 70 },
    ],
    stats: { carisma: 20 },
  };
  expect(spellcasting.getClassSpellSlotTable(multiclass, "sorcerer")).toEqual({ 1: 4, 2: 2 });
});

test("Spellcasting Ability drives Spell Mod, Spell Attack and Spell Save DC", () => {
  const sorcerer = spellcasting.resolveSpellcasting(characterWithClass("sorcerer", 15), "sorcerer");
  const cleric = spellcasting.resolveSpellcasting(characterWithClass("cleric", 15), "cleric");
  const artificer = spellcasting.resolveSpellcasting(characterWithClass("artificer", 15), "artificer");

  expect(sorcerer).toMatchObject({ abilityId: "cha", spellMod: 5, spellAttack: 8, spellDC: 16 });
  expect(cleric).toMatchObject({ abilityId: "wis", spellMod: 3, spellAttack: 6, spellDC: 14 });
  expect(artificer).toMatchObject({ abilityId: "int", spellMod: 4, spellAttack: 7, spellDC: 15 });
});

test("Short Rest restores Pact Slots only; Long Rest restores all caster Slots", () => {
  const character = {
    level: 30,
    proficiency: 3,
    classes: [
      { classId: "sorcerer", levels: 15 },
      { classId: "warlock", levels: 15 },
    ],
    stats: { carisma: 18 },
  };

  expect(spellcasting.spendSpellSlot(character, "sorcerer", 2).spent).toBe(1);
  expect(spellcasting.spendSpellSlot(character, "warlock", 2).spent).toBe(1);

  spellcasting.restoreSpellSlots(character, null, "short_rest");
  expect(spellcasting.spellSlotPool(character, "sorcerer").levels[2].available).toBe(1);
  expect(spellcasting.spellSlotPool(character, "warlock").levels[2].available).toBe(2);

  spellcasting.restoreSpellSlots(character, null, "long_rest");
  expect(spellcasting.spellSlotPool(character, "sorcerer").levels[2].available).toBe(2);
});

test("Every caster receives a Level 1 Spellcasting Ability Trait without duplicating Bard's existing grant", () => {
  const catalog = global.LuminousTraitCatalogCore;
  const definitions = catalog.allDefinitions();
  const grants = catalog.allGrants();

  for (const classId of casterTraits.CASTER_CLASS_IDS) {
    const traitId = casterTraits.traitIdFor(classId);
    const definition = definitions[traitId];
    expect(definition).toBeTruthy();
    expect(definition.name).toBe("Spellcasting Ability");
    expect(definition.source.classId).toBe(classId);
    expect(definition.mechanics.abilityId).toBe(spellcasting.getClassSpellcastingProfile(classId).abilityId);
    expect(definition.mechanics.progression).toBe(spellcasting.getClassSpellcastingProfile(classId).progression);
    expect(definition.mechanics.automaticSlots).toBe(true);
  }

  const generatedBardGrants = casterTraits.CASTER_GRANTS.filter((grant) => grant.sourceId === "bard");
  expect(generatedBardGrants).toHaveLength(0);

  for (const classId of casterTraits.CASTER_CLASS_IDS.filter((id) => id !== "bard")) {
    const traitId = casterTraits.traitIdFor(classId);
    expect(grants.some((grant) => grant.sourceType === "class" && grant.sourceId === classId && grant.atLevel === 1 && grant.traitId === traitId)).toBe(true);
  }
});

test("Caster Spellcasting Trait catalog validates against the Trait Engine", () => {
  const validation = global.LuminousTraitCatalogCore.validateAll(baseTraitEngine);
  expect(validation.errors).toEqual([]);
  expect(validation.valid).toBe(true);
});
