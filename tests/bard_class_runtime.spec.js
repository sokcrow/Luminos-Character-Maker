const { test, expect } = require("@playwright/test");

require("../js/trait-engine.js");
require("../js/status-engine.js");
require("../js/trait-catalog-core.js");
const bardRuntime = require("../js/bard-class-runtime.js");

bardRuntime.install();

const engine = global.LuminousTraitEngine;
const catalog = global.LuminousTraitCatalogCore;

const BARD_PROGRESS = [
  [1, "bardic_inspiration"],
  [1, "spellcasting"],
  [10, "jack_of_all_trades"],
  [10, "resting_song"],
  [15, "expertise"],
  [25, "font_of_inspiration"],
  [30, "countercharm"],
  [100, "superior_inspiration"],
];

function bardCharacter(level, charisma = 18) {
  return {
    id: `bard_${level}`,
    level,
    classes: [{ classId: "bard", levels: level }],
    stats: { carisma: charisma },
    abilityProficiency: {},
  };
}

function bardTraits(character) {
  return engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions())
    .filter((trait) => bardRuntime.sourceClassId(trait) === "bard");
}

test("Bard catalog extends the core Class Trait catalog and validates", () => {
  const validation = catalog.validateAll(engine);
  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);
  expect(catalog.CATALOG_VERSION).toBeGreaterThanOrEqual(4);

  const grants = catalog.allGrants().filter((grant) => grant.sourceType === "class" && grant.sourceId === "bard");
  expect(grants.map((grant) => [grant.atLevel, grant.traitId])).toEqual(BARD_PROGRESS);
  expect(grants.every((grant) => grant.multiclassPolicy === "allowed")).toBe(true);
});

test("Bard grants resolve only from Bard Class Level", () => {
  const multiclass = {
    id: "bard_multiclass",
    level: 100,
    classes: [
      { classId: "bard", levels: 10 },
      { classId: "fighter", levels: 90 },
    ],
    stats: { carisma: 18 },
  };
  const traits = bardTraits(multiclass).map((trait) => bardRuntime.traitBaseId(trait));
  expect(traits).toEqual([
    "bardic_inspiration",
    "spellcasting",
    "jack_of_all_trades",
    "resting_song",
  ]);

  const capstone = bardTraits(bardCharacter(100)).map((trait) => bardRuntime.traitBaseId(trait));
  expect(capstone).toEqual(BARD_PROGRESS.map(([, traitId]) => traitId));
});

test("Bardic Inspiration uses CHA, Bard Class Level, Font max-use bonus and explicit consumption", () => {
  const character = bardCharacter(25, 18);
  const trait = catalog.getDefinition("bardic_inspiration");
  const target = { id: "ally", faction: "player" };
  const state = engine.createState();
  const runtime = {
    context: "combat",
    character,
    self: { id: "bard_unit", faction: "player" },
    target,
    actionEconomy: { quick_action: 1 },
  };

  const activated = engine.activateTrait(trait, runtime, state);
  expect(activated.available).toBe(true);
  expect(activated.maximum).toBe(5);
  expect(activated.remaining).toBe(4);
  expect(runtime.actionEconomy.quick_action).toBe(0);
  expect(target.traitStatuses.bardic_inspiration).toMatchObject({ count: 1, potency: 3 });

  const untouchedCheck = { finalPower: 0 };
  const untouched = bardRuntime.consumeBardicInspiration(target, { check: untouchedCheck });
  expect(untouched.consumed).toBe(false);
  expect(untouchedCheck.finalPower).toBe(0);
  expect(target.traitStatuses.bardic_inspiration).toBeTruthy();

  const check = { finalPower: 0, useBardicInspiration: true };
  const consumed = bardRuntime.consumeBardicInspiration(target, { check });
  expect(consumed).toMatchObject({ consumed: true, power: 3, kind: "check" });
  expect(check.finalPower).toBe(3);
  expect(target.traitStatuses.bardic_inspiration).toBeUndefined();
  expect(target.statusEffects?.bardic_inspiration).toBeUndefined();
});

test("Jack of All Trades gives half Proficiency Power only without Proficiency and rolls an On Hit status", () => {
  const character = bardCharacter(40);
  character.level = 40;
  const jack = catalog.getDefinition("jack_of_all_trades");

  const untrained = engine.resolveTheatreCheck({
    character,
    traits: [jack],
    check: { kind: "ability", abilityId: "dex", finalPower: 0 },
  });
  expect(untrained.check.finalPower).toBe(1);
  expect(untrained.check.jackOfAllTradesAbilityPower).toBe(1);

  character.abilityProficiency.dex = "proficient";
  const trained = engine.resolveTheatreCheck({
    character,
    traits: [jack],
    check: { kind: "ability", abilityId: "dex", finalPower: 0 },
  });
  expect(trained.check.finalPower).toBe(0);

  const target = { id: "enemy", faction: "enemy" };
  engine.dispatchCombatEvent("on_hit", {
    character,
    self: { id: "bard_unit", faction: "player" },
    target,
    traits: [jack],
    random: () => 0,
  });
  expect(target.statusEffects.burn).toMatchObject({ count: 1, potency: 1 });
});

test("Resting Song heals present Allies and Font refills Bardic Inspiration on Short Rest", () => {
  const character = bardCharacter(40);
  character.faction = "player";
  character.currentHp = 20;
  character.maxHp = 100;
  const ally = { id: "ally", faction: "player", currentHp: 50, maxHp: 100 };
  const enemy = { id: "enemy", faction: "enemy", currentHp: 50, maxHp: 100 };
  const traits = bardTraits(character);
  const state = engine.createState();
  state.usages.bardic_inspiration = { used: 4, reset: "long_rest" };

  const result = engine.dispatchTraits(traits, "short_rest", {
    context: "any",
    character,
    self: character,
    allies: [ally],
    units: [character, ally, enemy],
  }, state);

  expect(ally.currentHp).toBe(60);
  expect(character.currentHp).toBe(20);
  expect(enemy.currentHp).toBe(50);
  expect(state.usages.bardic_inspiration.used).toBe(0);
  expect(result.outcomes.some((entry) => entry.type === "bard_resting_song")).toBe(true);
  expect(result.outcomes.some((entry) => entry.type === "bard_font_of_inspiration")).toBe(true);
});

test("Expertise is one reusable Trait with independent source-Class instances and level-50 expansion", () => {
  const character = {
    id: "bard_rogue",
    level: 70,
    classes: [
      { classId: "bard", levels: 50 },
      { classId: "rogue", levels: 20 },
    ],
  };
  const rogueGrant = {
    id: "test_class_rogue_expertise",
    sourceType: "class",
    sourceId: "rogue",
    source: { className: "Rogue", atLevel: 1, requiredClassLevel: 1 },
    atLevel: 1,
    traitId: "expertise",
    grantType: "trait",
    multiclassPolicy: "allowed",
  };
  const grants = [...catalog.allGrants(), rogueGrant];
  const instances = engine.resolveTraitGrants(character, grants, catalog.allDefinitions())
    .filter((trait) => bardRuntime.traitBaseId(trait) === "expertise");

  expect(instances).toHaveLength(2);
  expect(instances.map((trait) => trait.name)).toEqual(["Expertise", "Expertise"]);
  expect(instances.map((trait) => trait.id).sort()).toEqual([
    "expertise__class__bard",
    "expertise__class__rogue",
  ]);

  const bardExpertise = instances.find((trait) => bardRuntime.sourceClassId(trait) === "bard");
  const rogueExpertise = instances.find((trait) => bardRuntime.sourceClassId(trait) === "rogue");
  expect(bardExpertise.description).toContain("When Bard gets to lvl 50");
  expect(rogueExpertise.description).toContain("When Rogue gets to lvl 50");
  expect(bardRuntime.expertiseChoiceCount(bardExpertise, character)).toBe(4);
  expect(bardRuntime.expertiseChoiceCount(rogueExpertise, character)).toBe(2);

  const applied = bardRuntime.applyExpertiseChoices(character, bardExpertise, ["str", "dex", "int", "cha"]);
  expect(applied.success).toBe(true);
  expect(character.abilityProficiency).toMatchObject({ str: "expertise", dex: "expertise", int: "expertise", cha: "expertise" });
});

test("Countercharm applies Count 2 to deployed Allies, reduces matching Threshold saves by 4 and decays at Turn End", () => {
  const character = bardCharacter(30);
  const bardUnit = { id: "bard", faction: "player", hp: 100 };
  const allyA = { id: "ally_a", faction: "player", hp: 100 };
  const allyB = { id: "ally_b", faction: "player", hp: 100 };
  const enemy = { id: "enemy", faction: "enemy", hp: 100 };
  const trait = catalog.getDefinition("countercharm");
  const state = engine.createState();
  const runtime = {
    context: "combat",
    character,
    self: bardUnit,
    units: [bardUnit, allyA, allyB, enemy],
    executePlannedAction: true,
    actionEconomy: { action: 1 },
  };

  const activated = engine.activateTrait(trait, runtime, state);
  expect(activated.available).toBe(true);
  expect(allyA.statusEffects.countercharm.count).toBe(2);
  expect(allyB.statusEffects.countercharm.count).toBe(2);
  expect(bardUnit.statusEffects?.countercharm).toBeUndefined();
  expect(enemy.statusEffects?.countercharm).toBeUndefined();

  const saveRuntime = {
    context: "theatre",
    character: allyA,
    self: allyA,
    check: { kind: "save", saveAgainst: "frightened", difficulty: 16 },
  };
  engine.dispatchTraits([], "before_check", saveRuntime, engine.createState());
  expect(saveRuntime.check.difficulty).toBe(12);

  const otherRuntime = {
    context: "theatre",
    character: allyA,
    self: allyA,
    check: { kind: "save", saveAgainst: "poisoned", difficulty: 16 },
  };
  engine.dispatchTraits([], "before_check", otherRuntime, engine.createState());
  expect(otherRuntime.check.difficulty).toBe(16);

  engine.dispatchCombatEvent("turn_end", { character, self: bardUnit, units: runtime.units, traits: [], state });
  expect(allyA.statusEffects.countercharm.count).toBe(1);
  expect(allyB.statusEffects.countercharm.count).toBe(1);
  engine.dispatchCombatEvent("turn_end", { character, self: bardUnit, units: runtime.units, traits: [], state });
  expect(allyA.statusEffects.countercharm).toBeUndefined();
  expect(allyB.statusEffects.countercharm).toBeUndefined();
});

test("Superior Inspiration recovers half Max Bardic Inspiration Uses rounded up only when empty", () => {
  const character = bardCharacter(100, 18);
  const traits = bardTraits(character);
  const state = engine.createState();
  state.usages.bardic_inspiration = { used: 5, reset: "long_rest" };

  const first = engine.dispatchCombatEvent("encounter_start", {
    character,
    self: character,
    traits,
    state,
  });
  expect(state.usages.bardic_inspiration.used).toBe(2);
  expect(first.outcomes.some((entry) => entry.type === "bard_superior_inspiration" && entry.recovered === 3)).toBe(true);

  state.usages.bardic_inspiration.used = 4;
  const second = engine.dispatchCombatEvent("encounter_start", {
    character,
    self: character,
    traits,
    state,
  });
  expect(state.usages.bardic_inspiration.used).toBe(4);
  expect(second.outcomes.some((entry) => entry.type === "bard_superior_inspiration")).toBe(false);
});
