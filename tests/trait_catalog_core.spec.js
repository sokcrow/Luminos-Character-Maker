const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const catalog = require("../js/trait-catalog-core.js");

const character = {
  id: "catalog_test_character",
  level: 30,
  classes: [
    { classId: "barbarian", levels: 20 },
    { classId: "fighter", levels: 10 },
  ],
  lineageId: "devil_lineage",
  combatStats: {
    offensiveLevel: 34,
    defensiveLevel: 32,
  },
};

test("core Trait catalog validates every declarative definition", () => {
  const validation = catalog.validateAll(engine);
  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);
  expect(Object.keys(catalog.DEFINITIONS).sort()).toEqual([
    "danger_senses",
    "devil_body",
    "devil_trigger",
    "green_eyed_heir",
    "rage",
  ]);
});

test("Danger Senses only reduces Dexterity check Difficulty", () => {
  const trait = catalog.getDefinition("danger_senses");
  const dex = engine.resolveTheatreCheck({
    character,
    traits: [trait],
    check: { abilityId: "dex", skillId: "acrobatics", difficulty: 16 },
  });
  const wis = engine.resolveTheatreCheck({
    character,
    traits: [trait],
    check: { abilityId: "wis", skillId: "perception", difficulty: 16 },
  });

  expect(dex.check.difficulty).toBe(12);
  expect(dex.outcomes).toHaveLength(1);
  expect(wis.check.difficulty).toBe(16);
  expect(wis.outcomes).toHaveLength(0);
});

test("Green Eyed Heir grants Final Power only to Insight and Perception", () => {
  const trait = catalog.getDefinition("green_eyed_heir");
  const perception = engine.resolveTheatreCheck({
    character,
    traits: [trait],
    check: { abilityId: "wis", skillId: "perception", finalPower: 0 },
  });
  const insight = engine.resolveTheatreCheck({
    character,
    traits: [trait],
    check: { abilityId: "wis", skillId: "insight", finalPower: 1 },
  });
  const survival = engine.resolveTheatreCheck({
    character,
    traits: [trait],
    check: { abilityId: "wis", skillId: "survival", finalPower: 0 },
  });

  expect(perception.check.finalPower).toBe(2);
  expect(insight.check.finalPower).toBe(3);
  expect(survival.check.finalPower).toBe(0);
});

test("Rage consumes Quick Action, scales uses by Barbarian ClassLevel and blocks reactivation while active", () => {
  const trait = catalog.getDefinition("rage");
  const state = engine.createState();
  const runtime = {
    context: "combat",
    character,
    self: {},
    actionEconomy: { quick_action: 1 },
  };

  const result = engine.activateTrait(trait, runtime, state);
  expect(result.available).toBe(true);
  expect(result.maximum).toBe(2);
  expect(result.remaining).toBe(1);
  expect(runtime.actionEconomy.quick_action).toBe(0);
  expect(state.statuses.rage).toMatchObject({ id: "rage", sourceTraitId: "rage" });

  const blocked = engine.canActivateTrait(trait, {
    context: "combat",
    character,
    self: {},
    actionEconomy: { quick_action: 1 },
  }, state);
  expect(blocked.available).toBe(false);
  expect(blocked.reasons.join(" ")).toContain("conditions");
});

test("Devil Body heals at Turn Start using DefensiveLevel and respects Max HP", () => {
  const trait = catalog.getDefinition("devil_body");
  const self = { currentHp: 90, maxHp: 100 };
  const result = engine.dispatchCombatEvent("turn_start", {
    character,
    self,
    traits: [trait],
    DefensiveLevel: 32,
  });

  expect(self.currentHp).toBe(100);
  expect(result.outcomes).toHaveLength(1);
  expect(result.outcomes[0]).toMatchObject({ type: "heal_hp", amount: 16, after: 100 });
});

test("Devil Trigger consumes all gauge and threshold 7 uses the consumed value", () => {
  const trait = catalog.getDefinition("devil_trigger");
  const state = engine.createState({
    resources: { devil_gauge: { value: 8, min: 0, max: 10 } },
  });
  const self = { damagePercent: 0 };
  const result = engine.activateTrait(trait, {
    context: "combat",
    character,
    self,
    OffensiveLevel: 34,
  }, state);

  expect(result.available).toBe(true);
  expect(state.resources.devil_gauge.value).toBe(0);
  expect(self.damagePercent).toBe(34);
  expect(result.outcomes.map((entry) => entry.effectId)).toEqual([
    "devil_trigger_consume_gauge",
    "devil_trigger_threshold_7",
  ]);
});

test("Devil Trigger below threshold consumes gauge without applying threshold bonus", () => {
  const trait = catalog.getDefinition("devil_trigger");
  const state = engine.createState({
    resources: { devil_gauge: { value: 6, min: 0, max: 10 } },
  });
  const self = { damagePercent: 0 };
  const result = engine.activateTrait(trait, {
    context: "combat",
    character,
    self,
    OffensiveLevel: 34,
  }, state);

  expect(state.resources.devil_gauge.value).toBe(0);
  expect(self.damagePercent).toBe(0);
  expect(result.outcomes.map((entry) => entry.effectId)).toEqual([
    "devil_trigger_consume_gauge",
  ]);
});

test("core catalog only auto-grants progression that is not guessed", () => {
  expect(catalog.allGrants()).toEqual([{
    id: "core_lineage_devil_lineage_devil_body",
    sourceType: "lineage",
    sourceId: "devil_lineage",
    traitId: "devil_body",
  }]);

  const granted = engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions());
  expect(granted.map((trait) => trait.id)).toEqual(["devil_body"]);
  expect(granted[0].source).toMatchObject({ type: "lineage", id: "devil_lineage" });
});

test("class Trait mechanics remain defined without inventing acquisition levels", () => {
  expect(catalog.getDefinition("danger_senses").source).toMatchObject({ type: "class", id: "barbarian" });
  expect(catalog.getDefinition("rage").source).toMatchObject({ type: "class", id: "barbarian" });
  expect(catalog.allGrants().some((grant) => grant.sourceType === "class")).toBe(false);
});

test("catalog accessors return copies instead of mutable canonical objects", () => {
  const first = catalog.getDefinition("rage");
  first.name = "MUTATED";
  first.effects[0].operations[0].statusId = "other";

  const second = catalog.getDefinition("rage");
  expect(second.name).toBe("Rage");
  expect(second.effects[0].operations[0].statusId).toBe("rage");
});
