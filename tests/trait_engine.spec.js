const { test, expect } = require("@playwright/test");
const traits = require("../js/trait-engine.js");

const character = {
  id: "dante",
  level: 30,
  classes: [
    { classId: "barbarian", levels: 20 },
    { classId: "fighter", levels: 10 },
  ],
  stats: {
    fuerza: 18,
    destreza: 14,
    constitucion: 16,
    inteligencia: 10,
    sabiduria: 12,
    carisma: 16,
  },
  combatStats: {
    offensiveLevel: 34,
    defensiveLevel: 32,
    hp_actual: 80,
    hp_max: 100,
    sp_actual: 10,
    sp_max: 45,
  },
  raceId: "tiefling",
  backgroundId: "chef",
};

const dangerSenses = {
  id: "danger_senses",
  name: "Danger Senses",
  source: { type: "class", id: "barbarian" },
  contexts: ["theatre"],
  activation: { type: "passive" },
  effects: [{
    trigger: "before_check",
    conditions: [{ path: "check.abilityId", operator: "eq", value: "dex" }],
    operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
  }],
};

const rage = {
  id: "rage",
  name: "Rage",
  source: { type: "class", id: "barbarian" },
  contexts: ["combat"],
  activation: {
    type: "manual",
    actionCost: "quick_action",
    uses: { formula: "floor(ClassLevel / 7)", reset: "long_rest" },
    conditions: [{ statusId: "rage", operator: "falsy" }],
  },
  effects: [{
    trigger: "on_use",
    operations: [{ type: "apply_status", statusId: "rage", duration: "until_removed" }],
  }],
};

const devilBody = {
  id: "devil_body",
  name: "Devil Body",
  source: { type: "lineage", id: "devil_lineage" },
  contexts: ["combat"],
  activation: { type: "automatic" },
  effects: [{
    trigger: "turn_start",
    operations: [{ type: "heal_hp", path: "self.currentHp", maxPath: "self.maxHp", formula: "floor(DefensiveLevel / 2)" }],
  }],
};

test("formula engine soporta Level y ClassLevel sin ejecutar JS arbitrario", () => {
  const variables = traits.buildVariables(character, {}, rage);
  expect(variables.Level).toBe(30);
  expect(variables.ClassLevel).toBe(20);
  expect(variables.StrengthMod).toBe(4);
  expect(traits.evaluateFormula("1 + floor(ClassLevel / 7)", variables)).toBe(3);
  expect(traits.evaluateFormula("clamp(Level / 10, 1, 3)", variables)).toBe(3);
  expect(() => traits.evaluateFormula("constructor.constructor('return 1')()", variables)).toThrow();
});

test("multiclase conserva nivel total y nivel de la clase fuente por separado", () => {
  expect(traits.getClassLevel(character, "barbarian")).toBe(20);
  expect(traits.getClassLevel(character, "fighter")).toBe(10);
  expect(traits.buildVariables(character, {}, { source: { type: "class", id: "fighter" } }).ClassLevel).toBe(10);
});

test("Rol/Theatre aplica Traits pasivos solamente a la tirada que cumple condiciones", () => {
  const dex = traits.resolveTheatreCheck({
    character,
    traits: [dangerSenses],
    check: { kind: "skill", abilityId: "dex", skillId: "acrobatics", difficulty: 16 },
  });
  const wis = traits.resolveTheatreCheck({
    character,
    traits: [dangerSenses],
    check: { kind: "skill", abilityId: "wis", skillId: "perception", difficulty: 16 },
  });

  expect(dex.check.difficulty).toBe(12);
  expect(dex.outcomes).toHaveLength(1);
  expect(wis.check.difficulty).toBe(16);
  expect(wis.outcomes).toHaveLength(0);
});

test("Rol puede apilar bonificadores de habilidad y Final Power como operaciones independientes", () => {
  const greenEyedHeir = {
    id: "green_eyed_heir",
    name: "Green Eyed Heir",
    contexts: ["theatre"],
    effects: [{
      trigger: "before_check",
      conditions: [{ path: "check.skillId", operator: "in", value: ["insight", "perception"] }],
      operations: [{ type: "modify", path: "check.finalPower", mode: "add", value: 2 }],
    }],
  };
  const result = traits.resolveTheatreCheck({
    character,
    traits: [greenEyedHeir],
    check: { abilityId: "wis", skillId: "perception", finalPower: 0 },
  });
  expect(result.check.finalPower).toBe(2);
});

test("Traits automáticos de combate reaccionan al Turn Start y escalan con DefensiveLevel", () => {
  const self = { currentHp: 70, maxHp: 100 };
  const state = traits.createState();
  const result = traits.dispatchCombatEvent("turn_start", {
    character,
    self,
    traits: [devilBody],
    state,
    DefensiveLevel: 32,
  });
  expect(self.currentHp).toBe(86);
  expect(result.outcomes[0]).toMatchObject({ type: "heal_hp", amount: 16 });
});

test("Trait manual consume Quick Action, respeta usos por ClassLevel y aplica Status", () => {
  const state = traits.createState();
  const runtime = {
    context: "combat",
    character,
    self: character,
    actionEconomy: { quick_action: 1 },
  };
  const first = traits.activateTrait(rage, runtime, state);
  expect(first.available).toBe(true);
  expect(first.maximum).toBe(2);
  expect(first.remaining).toBe(1);
  expect(runtime.actionEconomy.quick_action).toBe(0);
  expect(state.statuses.rage).toMatchObject({ sourceTraitId: "rage" });

  const again = traits.canActivateTrait(rage, { ...runtime, actionEconomy: { quick_action: 1 } }, state);
  expect(again.available).toBe(false);
  expect(again.reasons.join(" ")).toContain("conditions");
});

test("Trait Tray API devuelve solamente decisiones del jugador y explica por qué están bloqueadas", () => {
  const state = traits.createState();
  const actions = traits.listAvailableTraitActions([dangerSenses, devilBody, rage], {
    context: "combat",
    character,
    actionEconomy: { quick_action: 0 },
  }, state);

  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ traitId: "rage", available: false, actionCost: "quick_action", maximum: 2, remaining: 2 });
  expect(actions[0].reasons.join(" ")).toContain("quick_action");
});

test("Resources permiten gain/spend/consume_all y guardar el valor consumido para umbrales", () => {
  const devilTrigger = {
    id: "devil_trigger",
    name: "Devil Trigger",
    contexts: ["combat"],
    activation: { type: "manual", actionCost: "none" },
    effects: [
      {
        id: "consume",
        trigger: "on_use",
        operations: [{ type: "resource", resourceId: "devil_gauge", mode: "consume_all", storeAs: "ConsumedGauge" }],
      },
      {
        id: "threshold_7",
        trigger: "on_use",
        conditions: [{ formula: "ConsumedGauge", operator: "gte", value: 7 }],
        operations: [{ type: "modify", path: "self.damagePercent", mode: "add", formula: "OffensiveLevel" }],
      },
    ],
  };
  const state = traits.createState({ resources: { devil_gauge: { value: 8, min: 0, max: 10 } } });
  const self = { damagePercent: 0 };
  const result = traits.activateTrait(devilTrigger, { context: "combat", character, self, OffensiveLevel: 34 }, state);

  expect(result.available).toBe(true);
  expect(state.resources.devil_gauge.value).toBe(0);
  expect(self.damagePercent).toBe(34);
  expect(result.outcomes.map((entry) => entry.effectId)).toEqual(["consume", "threshold_7"]);
});

test("reset de usos devuelve Traits limitados al scope configurado", () => {
  const state = traits.createState();
  const runtime = { context: "combat", character, actionEconomy: { quick_action: 1 } };
  const result = traits.activateTrait(rage, runtime, state);
  expect(result.remaining).toBe(1);
  delete state.statuses.rage;
  traits.resetUsage(state, "long_rest");
  const ready = traits.canActivateTrait(rage, { ...runtime, actionEconomy: { quick_action: 1 } }, state);
  expect(ready.remaining).toBe(2);
});

test("Class/Race/Background grants se resuelven sin duplicar definiciones de Traits", () => {
  const catalog = {
    rage,
    mountain_born: { id: "mountain_born", name: "Mountain Born" },
    chef_passion: { id: "chef_passion", name: "Chef's Passion" },
  };
  const grants = [
    { sourceType: "class", sourceId: "barbarian", atLevel: 15, traitId: "rage" },
    { sourceType: "class", sourceId: "fighter", atLevel: 20, traitId: "mountain_born" },
    { sourceType: "background", sourceId: "chef", traitId: "chef_passion" },
  ];
  const granted = traits.resolveTraitGrants(character, grants, catalog);
  expect(granted.map((trait) => trait.id)).toEqual(["rage", "chef_passion"]);
  expect(granted[0].source).toMatchObject({ type: "class", id: "barbarian", classId: "barbarian" });
});

test("validator rechaza operaciones incompletas y mantiene el schema declarativo", () => {
  const invalid = traits.validateTrait({ name: "Broken", effects: [{ trigger: "on_hit", operations: [{ type: "modify" }] }] });
  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toContain("requires a target path");

  const valid = traits.validateTrait(rage);
  expect(valid.valid).toBe(true);
  expect(valid.trait.schemaVersion).toBe(1);
});
