const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const modifiers = require("../js/universal-modifier-engine.js");
const catalog = require("../js/racial-trait-catalog.js");

test("racial Trait catalog validates every declarative definition", () => {
  const result = catalog.validateAll(engine);
  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
  expect(Object.keys(catalog.DEFINITIONS).length).toBeGreaterThan(20);
});

test("race and subtype grants resolve automatically without leaking other subtypes", () => {
  const juggernaut = catalog.resolveTraitGrants({
    level: 30,
    raceId: "warforged",
    raceSubtypeId: "juggernaut",
  });
  const skirmisher = catalog.resolveTraitGrants({
    level: 30,
    raceId: "warforged",
    raceSubtypeId: "skirmisher",
  });

  expect(juggernaut.map((trait) => trait.id)).toEqual(["warforged_reinforced_body"]);
  expect(skirmisher.map((trait) => trait.id)).toEqual(["warforged_lone_reconnaissance"]);
  expect(juggernaut[0].source).toMatchObject({ type: "race", id: "warforged", subtypeId: "juggernaut" });
});

test("Lupae automatically receives shared Pack Tactics instead of a race-only duplicate", () => {
  const granted = catalog.resolveTraitGrants({ level: 20, raceId: "lupae" });
  expect(granted.map((trait) => trait.id)).toEqual([
    "keen_hearing_and_smell",
    "pack_tactics",
    "lupae_canis_toughness",
  ]);
  expect(catalog.getDefinition("pack_tactics").source).toMatchObject({ type: "special", id: "shared" });
});

test("Moonfae cycle grants are isolated by raceSubtypeId", () => {
  const crescent = catalog.resolveTraitGrants({
    characterBuild: { raceId: "moonfae", raceSubtypeId: "crescent_moon", calculatedAtLevel: 30 },
  });
  const full = catalog.resolveTraitGrants({
    characterBuild: { raceId: "moonfae", raceSubtypeId: "full_moon", calculatedAtLevel: 30 },
  });

  expect(crescent.map((trait) => trait.id)).toEqual([
    "keen_hearing",
    "moonfae_crescent_speed",
    "moonfae_agile_escape",
    "moonfae_natural_talent",
  ]);
  expect(full.map((trait) => trait.id)).toEqual([
    "keen_hearing",
    "moonfae_intimidating_presence",
    "moonfae_lunge",
  ]);
});

test("Yuan-ti eye colors grant the correct Sin affinity and Pale Eyes get no Sin bonus", () => {
  const green = catalog.resolveTraitGrants({ level: 80, raceId: "yuan_ti_pureblood", raceSubtypeId: "green_eyes" });
  const pale = catalog.resolveTraitGrants({ level: 80, raceId: "yuan_ti_pureblood", raceSubtypeId: "pale_eyes" });

  expect(green.map((trait) => trait.id)).toEqual([
    "yuan_ti_magic_resistance",
    "yuan_ti_gluttony_affinity",
    "yuan_ti_voracious_impulse",
  ]);
  expect(pale.map((trait) => trait.id)).toEqual(["yuan_ti_magic_resistance"]);
  expect(pale.some((trait) => trait.id.includes("affinity"))).toBe(false);
});

test("Voracious Impulse heals (5 + CHA Mod)% Max HP on kill", () => {
  const trait = catalog.getDefinition("yuan_ti_voracious_impulse");
  const character = {
    level: 40,
    stats: { carisma: 16 },
  };
  const self = { currentHp: 40, maxHp: 100 };
  const result = engine.dispatchCombatEvent("on_kill", {
    character,
    self,
    traits: [trait],
  });

  expect(self.currentHp).toBe(48);
  expect(result.outcomes[0]).toMatchObject({ type: "heal_hp", amount: 8, after: 48 });
});

test("Feline Reflexes resolves Max Speed and Evade Final Power from Proficiency", () => {
  const trait = catalog.getDefinition("feline_reflexes");
  const character = {
    level: 60,
    proficiency: 4,
    combatStats: { minSpeed: 3, maxSpeed: 6 },
  };
  const snapshot = modifiers.resolveCharacterSnapshot({
    character,
    unit: character,
    traits: [trait],
    skill: { type: "evade", isDefense: true },
    context: "combat",
  });

  expect(snapshot.maxSpeed).toBe(8);
  expect(snapshot.modifiers.final_power).toBe(4);
});

test("Keen Hearing uses the global Advantage conversion of Threshold -4", () => {
  const trait = catalog.getDefinition("keen_hearing");
  const result = engine.resolveTheatreCheck({
    character: { level: 20 },
    traits: [trait],
    check: { skillId: "perception", senses: ["hearing"], difficulty: 16 },
  });

  expect(result.check.difficulty).toBe(12);
});

test("mobility capabilities unlock the shared Retreat families", () => {
  const undaeWar = catalog.resolveCapabilities({ raceId: "undae", raceSubtypeId: "war" });
  const elnae = catalog.resolveCapabilities({ raceId: "elnae" });
  const blueDragon = catalog.resolveCapabilities({ raceId: "half_dragon", raceSubtypeId: "blue" });

  expect(undaeWar.map((entry) => entry.capabilityId)).toEqual(["amphibious", "swim_speed"]);
  expect(elnae.map((entry) => entry.capabilityId)).toEqual(["flight"]);
  expect(blueDragon.map((entry) => entry.capabilityId)).toEqual(["burrow"]);

  expect(catalog.RETREATS.burrowed).toMatchObject({
    capabilityId: "burrow",
    nonStackableGroup: "retreat_bonus",
    comebackStatus: { statusId: "protection", count: 3 },
    encounterBonus: { channel: "defensive_level", value: 1 },
  });
  expect(catalog.RETREATS.sink).toMatchObject({
    capabilityId: "swim_speed",
    nonStackableGroup: "retreat_bonus",
    comebackStatus: { statusId: "defense_power_up", count: 3 },
  });
  expect(catalog.RETREATS.fly).toMatchObject({
    capabilityId: "flight",
    nonStackableGroup: "retreat_bonus",
    comebackStatus: { statusId: "haste", count: 3 },
  });
  expect(catalog.RETREATS.fly.encounterBonus).toEqual([
    { channel: "min_speed", value: 2 },
    { channel: "max_speed", value: 2 },
  ]);
});
