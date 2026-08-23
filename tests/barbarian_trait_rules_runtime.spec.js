const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const catalog = require("../js/trait-catalog-core.js");
const modifiers = require("../js/universal-modifier-engine.js");

function barbarian(level = 100) {
  return {
    id: "barbarian_runtime_test",
    level,
    classes: [{ classId: "barbarian", levels: level }],
    stats: {
      fuerza: 20,
      constitucion: 18,
      destreza: 14,
      inteligencia: 10,
      sabiduria: 12,
      carisma: 10,
    },
    combatStats: {
      offensiveLevel: 90,
      defensiveLevel: 60,
      minSpeed: 2,
      maxSpeed: 6,
    },
  };
}

test("Armorless Defense resolves Defensive Level universally and removes its Stagger Threshold only once", () => {
  const character = barbarian(100);
  character.staggerThresholds = [70, 40];
  const trait = catalog.getDefinition("armorless_defense");
  const state = engine.createState();

  const firstSnapshot = modifiers.resolveCharacterSnapshot({
    unit: character,
    character,
    traits: [trait],
    context: "combat",
  });
  const secondSnapshot = modifiers.resolveCharacterSnapshot({
    unit: character,
    character,
    traits: [trait],
    context: "combat",
  });
  expect(firstSnapshot.defensiveLevel).toBe(64);
  expect(secondSnapshot.defensiveLevel).toBe(64);
  expect(character.combatStats.defensiveLevel).toBe(60);

  engine.dispatchTrait(trait, "passive", {
    context: "combat",
    character,
    self: character,
    equipment: { armorEquipped: false },
  }, state);
  expect(character.staggerThresholds).toEqual([70]);

  engine.dispatchTrait(trait, "passive", {
    context: "combat",
    character,
    self: character,
    equipment: { armorEquipped: false },
  }, state);
  expect(character.staggerThresholds).toEqual([70]);
});

test("Wild Instincts grants STR Mod Haste Count once at Encounter Start", () => {
  const character = barbarian(100);
  const trait = catalog.getDefinition("wild_instincts");
  const state = engine.createState();

  engine.dispatchCombatEvent("encounter_start", { character, self: character, traits: [trait], state });
  expect(state.statuses.haste).toMatchObject({ id: "haste", potency: 0, count: 5 });
});

test("Reckless Attack is once per Turn, turns the next Skill Red and Gain applies Fragile to Self", () => {
  const character = barbarian(100);
  const trait = catalog.getDefinition("reckless_attack");
  const state = engine.createState();
  const runtime = {
    context: "combat",
    character,
    self: character,
    actionEconomy: { quick_action: 1 },
  };

  const activated = engine.activateTrait(trait, runtime, state);
  expect(activated.available).toBe(true);
  expect(activated.maximum).toBe(1);
  expect(state.statuses.reckless_attack_armed).toBeTruthy();

  const skill = {
    coinPower: 3,
    coinAmount: 3,
    coins: [
      { type: "standard", status: "active" },
      { type: "unbreakable", status: "active" },
      { type: "standard", status: "active" },
    ],
  };
  engine.dispatchCombatEvent("before_skill", { character, self: character, skill, traits: [trait], state });
  expect(skill.coins.every((coin) => coin.type === "unbreakable")).toBe(true);
  expect(skill.coinPower).toBe(4);

  engine.dispatchCombatEvent("on_hit", { character, self: character, skill, traits: [trait], state });
  expect(state.statuses.fragile).toMatchObject({ id: "fragile", count: 1 });
  expect(character.traitStatuses?.fragile).toBeUndefined();

  engine.dispatchCombatEvent("attack_end", { character, self: character, skill, traits: [trait], state });
  expect(state.statuses.reckless_attack_armed).toBeUndefined();

  const blocked = engine.canActivateTrait(trait, { ...runtime, actionEconomy: { quick_action: 1 } }, state);
  expect(blocked.available).toBe(false);
  expect(blocked.remaining).toBe(0);

  engine.dispatchCombatEvent("turn_start", { character, self: character, traits: [trait], state });
  const ready = engine.canActivateTrait(trait, { ...runtime, actionEconomy: { quick_action: 1 } }, state);
  expect(ready.available).toBe(true);
  expect(ready.remaining).toBe(1);
});

test("Additional Attack reuses the last Coin only once per eligible Skill", () => {
  const character = barbarian(100);
  const trait = catalog.getDefinition("additional_attack");
  const state = engine.createState();
  const skill = {
    isMelee: true,
    coinAmount: 2,
    coins: [
      { type: "standard", status: "active", marker: 1 },
      { type: "standard", status: "active", marker: 2 },
    ],
  };

  engine.dispatchCombatEvent("before_skill", { character, self: character, skill, traits: [trait], state });
  expect(skill.coinAmount).toBe(3);
  expect(skill.coins).toHaveLength(3);
  expect(skill.coins[2]).toMatchObject({ marker: 2 });

  engine.dispatchCombatEvent("before_skill", { character, self: character, skill, traits: [trait], state });
  expect(skill.coinAmount).toBe(3);
  expect(skill.coins).toHaveLength(3);

  const fourCoinSkill = {
    isMelee: true,
    coinAmount: 4,
    coins: Array.from({ length: 4 }, () => ({ type: "standard", status: "active" })),
  };
  engine.dispatchCombatEvent("before_skill", { character, self: character, skill: fourCoinSkill, traits: [trait], state });
  expect(fourCoinSkill.coins).toHaveLength(4);
});

test("Unstoppable Rage raises Threshold after every trigger and only Long Rest resets it", () => {
  const character = barbarian(100);
  const trait = catalog.getDefinition("unstoppable_rage");
  const state = engine.createState({ statuses: { rage: { id: "rage", count: 1 } } });
  const self = { hp: 0, maxHp: 300 };
  const thresholds = [];

  const pass = engine.dispatchCombatEvent("hp_zero", {
    character,
    self,
    traits: [trait],
    state,
    DefensiveLevel: 60,
    resolveCheck: ({ abilityId, threshold }) => {
      expect(abilityId).toBe("con");
      thresholds.push(threshold);
      return { passed: true };
    },
  });
  expect(thresholds).toEqual([10]);
  expect(self.hp).toBe(60);
  expect(state.counters.unstoppable_rage_threshold.value).toBe(15);
  expect(pass.outcomes.some((outcome) => outcome.type === "rule_check" && outcome.passed === true)).toBe(true);

  self.hp = 0;
  engine.dispatchCombatEvent("hp_zero", {
    character,
    self,
    traits: [trait],
    state,
    DefensiveLevel: 60,
    resolveCheck: ({ threshold }) => {
      thresholds.push(threshold);
      return { passed: false };
    },
  });
  expect(thresholds).toEqual([10, 15]);
  expect(self.hp).toBe(0);
  expect(state.counters.unstoppable_rage_threshold.value).toBe(20);

  engine.dispatchCombatEvent("short_rest", { character, self, traits: [trait], state });
  expect(state.counters.unstoppable_rage_threshold.value).toBe(20);

  engine.dispatchCombatEvent("long_rest", { character, self, traits: [trait], state });
  expect(state.counters.unstoppable_rage_threshold.value).toBe(10);
});

test("Persistent Rage blocks effect-driven Rage removal", () => {
  const character = barbarian(100);
  const persistent = catalog.getDefinition("persistent_rage");
  const state = engine.createState({ statuses: { rage: { id: "rage", count: 1 } } });

  engine.dispatchCombatEvent("turn_start", { character, self: character, traits: [persistent], state });
  expect(state.protectedStatuses.rage).toBeTruthy();

  const remover = {
    id: "remove_rage_test",
    name: "Remove Rage Test",
    contexts: ["combat"],
    activation: { type: "automatic", actionCost: "none" },
    effects: [{
      id: "remove_rage",
      trigger: "turn_end",
      operations: [{ type: "remove_status", statusId: "rage" }],
    }],
  };
  const result = engine.dispatchCombatEvent("turn_end", { character, self: character, traits: [remover], state });
  expect(state.statuses.rage).toBeTruthy();
  expect(result.outcomes.find((outcome) => outcome.type === "remove_status")).toMatchObject({ removed: false, protected: true });
});

test("Unstoppable Strength exposes re-toss count on a failed Strength Check Coin", () => {
  const character = barbarian(100);
  const trait = catalog.getDefinition("unstoppable_strength");
  const state = engine.createState();
  const runtime = {
    context: "theatre",
    character,
    self: character,
    check: { abilityId: "str" },
  };

  const result = engine.dispatchTrait(trait, "check_coin_fail", runtime, state);
  expect(runtime.check.reTossLastCoin).toBe(2);
  expect(result.outcomes[0]).toMatchObject({ type: "rule_coin", action: "retoss_last", count: 2 });
});

test("Primordial Champion grants +4 STR/CON once and sets both caps to 24", () => {
  const character = barbarian(100);
  const trait = catalog.getDefinition("primordial_champion");
  const state = engine.createState();
  const runtime = { context: "combat", character, self: character };

  engine.dispatchTrait(trait, "passive", runtime, state);
  expect(character.stats.fuerza).toBe(24);
  expect(character.stats.constitucion).toBe(22);
  expect(character.statCaps).toMatchObject({ strength: 24, constitution: 24 });

  engine.dispatchTrait(trait, "passive", runtime, state);
  expect(character.stats.fuerza).toBe(24);
  expect(character.stats.constitucion).toBe(22);
});