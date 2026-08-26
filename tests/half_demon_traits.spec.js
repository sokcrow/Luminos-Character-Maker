const { test, expect } = require("@playwright/test");

const traitEngine = require("../js/trait-engine.js");
require("../js/racial-trait-catalog.js");
require("../js/canonical-racial-traits.js");
const halfDemonCatalog = require("../js/half-demon-racial-traits.js");
const statusEngine = require("../js/status-engine.js");
const combatEngine = require("../js/combatEngine.js");
global.CombatEngine = combatEngine;
const runtime = require("../js/half-demon-combat-runtime.js");
runtime.installCombatBridge();

function halfDemon(overrides = {}) {
  return {
    id: `half-demon-${Math.random()}`,
    characterBuild: { raceId: "half_demon", calculatedAtLevel: 100 },
    hp: 100,
    maxHp: 100,
    shield: 0,
    statusEffects: {},
    passives: [],
    ...overrides,
  };
}

function human(overrides = {}) {
  return {
    id: `human-${Math.random()}`,
    characterBuild: { raceId: "human", calculatedAtLevel: 100 },
    hp: 100,
    maxHp: 100,
    shield: 0,
    statusEffects: {},
    passives: [],
    ...overrides,
  };
}

function combatContext(attacker, defender, damageDealt = 0) {
  const skill = { id: "test_skill", name: "Test Skill", type: "Attack", effects: [], coins: [] };
  return { attacker, defender, unitAttacker: attacker, unitDefender: defender, skill, damageDealt };
}

test("Half-Demon receives Devil Gauge and Devil Trigger as racial Traits", () => {
  const installed = global.LuminousHalfDemonRacialTraits.install();
  expect(installed).toBeTruthy();
  expect(installed.validateAll(traitEngine).valid).toBe(true);
  const ids = installed.resolveTraitGrants({ characterBuild: { raceId: "half_demon" } })
    .map((trait) => trait.id)
    .filter((id) => id.startsWith("half_demon_devil_"));
  expect(ids).toEqual(["half_demon_devil_gauge", "half_demon_devil_trigger"]);
});

test("Devil Gauge is a real Status Effect capped at 100", () => {
  const unit = halfDemon();
  expect(global.STATUS_REGISTRY.devil_gauge).toMatchObject({ name: "Devil Gauge", maxCount: 100 });
  runtime.setGauge(unit, 95);
  expect(statusEngine.getStatus(unit, "devil_gauge").count).toBe(95);
  runtime.changeGauge(unit, 20);
  expect(statusEngine.getStatus(unit, "devil_gauge").count).toBe(100);
  runtime.changeGauge(unit, -150);
  expect(runtime.gaugeValue(unit)).toBe(0);
  expect(statusEngine.getStatus(unit, "devil_gauge")).toBeNull();
});

test("combat Trait triggers change the live Devil Gauge Status", () => {
  const unit = halfDemon();
  const target = human();

  combatEngine.triggerEvent("[On Hit]", combatContext(unit, target, 10), [target]);
  expect(runtime.gaugeValue(unit)).toBe(2);

  combatEngine.triggerEvent("[On Evade]", combatContext(target, unit, 0), [target]);
  expect(runtime.gaugeValue(unit)).toBe(7);

  combatEngine.triggerEvent("[On Clash Win]", combatContext(unit, target, 0), [target]);
  expect(runtime.gaugeValue(unit)).toBe(17);

  combatEngine.triggerEvent("[On Clash Lose]", combatContext(unit, target, 0), [target]);
  expect(runtime.gaugeValue(unit)).toBe(7);
});

test("post-clash coin emissions do not award Clash Gauge twice", () => {
  const unit = halfDemon();
  const target = human();
  const context = { ...combatContext(unit, target, 0), currentCoin: { index: 0 } };
  combatEngine.triggerEvent("[On Clash Win]", context, [target]);
  expect(runtime.gaugeValue(unit)).toBe(0);
});

test("Getting Hit loses 5 Gauge but Status/DoT damage does not", () => {
  const unit = halfDemon({ hp: 100, maxHp: 100 });
  runtime.setGauge(unit, 50);

  combatEngine.applyDamage(unit, 1, "directo", false, null);
  expect(runtime.gaugeValue(unit)).toBe(45);

  combatEngine.applyDamage(unit, 1, "efecto_estado", false, null);
  expect(runtime.gaugeValue(unit)).toBe(45);
});

test("a non Half-Demon cannot gain or lose Devil Gauge from the racial runtime", () => {
  const unit = human();
  const target = halfDemon();
  combatEngine.triggerEvent("[On Hit]", combatContext(unit, target, 20), [target]);
  expect(runtime.gaugeValue(unit)).toBe(0);
  combatEngine.applyDamage(unit, 1, "directo", false, null);
  expect(runtime.gaugeValue(unit)).toBe(0);
});

test("Devil Trigger threshold modifiers activate at the intended Gauge ranks", () => {
  const unit = halfDemon();
  const base = { defense_power: 0, speed: 0, damage_dealt_multiplier: 0, clash_power: 0, final_power: 0 };

  runtime.setGauge(unit, 49);
  expect(runtime.applyThresholdModifiers(unit, base)).toEqual(base);

  runtime.setGauge(unit, 50);
  expect(runtime.applyThresholdModifiers(unit, base)).toMatchObject({ defense_power: 1, speed: 0, damage_dealt_multiplier: 0, clash_power: 0, final_power: 0 });

  runtime.setGauge(unit, 60);
  expect(runtime.applyThresholdModifiers(unit, base)).toMatchObject({ defense_power: 1, speed: 1 });

  runtime.setGauge(unit, 70);
  expect(runtime.applyThresholdModifiers(unit, base)).toMatchObject({ damage_dealt_multiplier: 1 });

  runtime.setGauge(unit, 80);
  expect(runtime.applyThresholdModifiers(unit, base)).toMatchObject({ clash_power: 1 });

  runtime.setGauge(unit, 90);
  expect(runtime.applyThresholdModifiers(unit, base)).toMatchObject({ final_power: 1 });

  runtime.setGauge(unit, 100);
  expect(runtime.applyThresholdModifiers(unit, base)).toMatchObject({
    defense_power: 1,
    speed: 1,
    damage_dealt_multiplier: 1,
    clash_power: 1,
    final_power: 1,
  });
});

test("the 70 Gauge rank is exactly +10% Damage in CombatEngine modifier units", () => {
  const unit = halfDemon();
  runtime.setGauge(unit, 70);
  const mods = combatEngine.applyPassiveModifiers(unit, {});
  expect(mods.damage_dealt_multiplier).toBe(1);
});

test("40+ Gauge grants 10% Max HP Shield at Round Start", () => {
  const unit = halfDemon({ maxHp: 200, hp: 200, shield: 3 });
  runtime.setGauge(unit, 40);
  runtime.handleRoundPhase("[Round Start]", [unit]);
  expect(unit.shield).toBe(23);
});

test("no direct damage dealt during the turn loses 20 Devil Gauge", () => {
  const unit = halfDemon();
  runtime.setGauge(unit, 50);
  runtime.handleRoundPhase("[Round End]", [unit]);
  expect(runtime.gaugeValue(unit)).toBe(30);
});

test("dealing direct On Hit damage prevents the inactivity Gauge loss", () => {
  const unit = halfDemon();
  const target = human();
  runtime.setGauge(unit, 50);
  combatEngine.triggerEvent("[On Hit]", combatContext(unit, target, 12), [target]);
  expect(runtime.gaugeValue(unit)).toBe(52);
  runtime.handleRoundPhase("[Round End]", [unit]);
  expect(runtime.gaugeValue(unit)).toBe(52);
});

test("at 100 Gauge On Hit heals 5% of Damage dealt", () => {
  const unit = halfDemon({ hp: 80, maxHp: 100 });
  const target = human();
  runtime.setGauge(unit, 98);
  combatEngine.triggerEvent("[On Hit]", combatContext(unit, target, 40), [target]);
  expect(runtime.gaugeValue(unit)).toBe(100);
  expect(unit.hp).toBe(82);
});
