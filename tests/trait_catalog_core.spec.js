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

const BARBARIAN_PROGRESS = [
  [1, "armorless_defense"],
  [1, "rage"],
  [10, "reckless_attack"],
  [10, "danger_senses"],
  [25, "additional_attack"],
  [25, "fast_movement"],
  [35, "wild_instincts"],
  [45, "brutal_critical"],
  [55, "unstoppable_rage"],
  [75, "persistent_rage"],
  [90, "unstoppable_strength"],
  [100, "primordial_champion"],
];

test("core Trait catalog validates every declarative definition and rule contract", () => {
  const validation = catalog.validateAll(engine);
  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);
  expect(catalog.CATALOG_VERSION).toBe(2);
  expect(Object.keys(catalog.DEFINITIONS).sort()).toEqual([
    "additional_attack",
    "armorless_defense",
    "brutal_critical",
    "danger_senses",
    "devil_body",
    "devil_trigger",
    "fast_movement",
    "green_eyed_heir",
    "persistent_rage",
    "primordial_champion",
    "rage",
    "reckless_attack",
    "unstoppable_rage",
    "unstoppable_strength",
    "wild_instincts",
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

test("Barbarian automatic Grants match the confirmed class progression", () => {
  const grants = catalog.allGrants().filter((grant) => grant.sourceType === "class" && grant.sourceId === "barbarian");
  expect(grants.map((grant) => [grant.atLevel, grant.traitId])).toEqual(BARBARIAN_PROGRESS);
});

test("Barbarian class Traits resolve automatically by Barbarian ClassLevel", () => {
  const granted = engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions());
  expect(granted.map((trait) => trait.id)).toEqual([
    "armorless_defense",
    "rage",
    "reckless_attack",
    "danger_senses",
    "devil_body",
  ]);

  const level100 = {
    ...character,
    level: 100,
    lineageId: null,
    classes: [{ classId: "barbarian", levels: 100 }],
  };
  const capstoneTraits = engine.resolveTraitGrants(level100, catalog.allGrants(), catalog.allDefinitions());
  expect(capstoneTraits.map((trait) => trait.id)).toEqual(BARBARIAN_PROGRESS.map(([, traitId]) => traitId));
});

test("new rule vocabulary preserves Gain=Self and class-specific scope contracts", () => {
  expect(catalog.validateRules({
    id: "bad_gain",
    rules: [{ type: "status", action: "gain", target: "target", statusId: "fragile" }],
  }).valid).toBe(false);

  const reckless = catalog.getDefinition("reckless_attack");
  expect(reckless.activation).toMatchObject({
    type: "manual",
    actionCost: "quick_action",
    uses: { formula: "1", reset: "turn" },
  });
  expect(reckless.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "coin", action: "set_type", scope: "next_skill" }),
    expect.objectContaining({ type: "status", action: "gain", target: "self", statusId: "fragile" }),
  ]));

  const additional = catalog.getDefinition("additional_attack");
  expect(additional.rules[0]).toMatchObject({ type: "coin", action: "reuse_last", count: 1, scope: "once_per_skill" });
});

test("Unstoppable Rage escalation is persistent until Long Rest", () => {
  const trait = catalog.getDefinition("unstoppable_rage");
  const checkRule = trait.rules.find((rule) => rule.type === "check");
  const counterRule = trait.rules.find((rule) => rule.type === "counter");

  expect(checkRule).toMatchObject({
    trigger: "hp_zero",
    abilityId: "con",
    threshold: { stateKey: "unstoppable_rage_threshold", initial: 10 },
    whileStatus: "rage",
  });
  expect(counterRule).toMatchObject({
    stateKey: "unstoppable_rage_threshold",
    initial: 10,
    mode: "add",
    value: 5,
    reset: "long_rest",
  });
});

test("catalog accessors return copies instead of mutable canonical objects", () => {
  const first = catalog.getDefinition("rage");
  first.name = "MUTATED";
  first.effects[0].operations[0].statusId = "other";
  first.rules[0].statusId = "other";

  const second = catalog.getDefinition("rage");
  expect(second.name).toBe("Rage");
  expect(second.effects[0].operations[0].statusId).toBe("rage");
  expect(second.rules[0].statusId).toBe("rage");
});

test("exported canonical definitions and Grants are deeply frozen", () => {
  const operation = catalog.DEFINITIONS.rage.effects[0].operations[0];
  expect(Object.isFrozen(catalog.DEFINITIONS)).toBe(true);
  expect(Object.isFrozen(catalog.DEFINITIONS.rage)).toBe(true);
  expect(Object.isFrozen(catalog.DEFINITIONS.rage.effects)).toBe(true);
  expect(Object.isFrozen(catalog.DEFINITIONS.rage.rules)).toBe(true);
  expect(Object.isFrozen(catalog.DEFINITIONS.rage.effects[0])).toBe(true);
  expect(Object.isFrozen(operation)).toBe(true);
  expect(Object.isFrozen(catalog.GRANTS)).toBe(true);
  expect(Object.isFrozen(catalog.GRANTS[0])).toBe(true);

  const before = operation.statusId;
  try {
    operation.statusId = "corrupted";
    catalog.DEFINITIONS.rage.effects.push({ id: "corrupted" });
  } catch (_) {
    // Strict-mode consumers may throw; non-strict consumers silently fail.
  }

  expect(catalog.DEFINITIONS.rage.effects[0].operations[0].statusId).toBe(before);
  expect(catalog.DEFINITIONS.rage.effects).toHaveLength(1);
  expect(catalog.getDefinition("rage").effects[0].operations[0].statusId).toBe("rage");
});
