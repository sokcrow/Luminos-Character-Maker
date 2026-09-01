const { test, expect } = require('@playwright/test');

const statusEngine = require('../js/status-engine.js');
const exhaustion = global.LuminousExhaustionEngine;
const conditions = global.LuminousConditionRuntime;
require('../js/universal-modifier-engine.js');
conditions.install();
const speedRuntime = require('../js/universal-speed-runtime.js');

function unit(overrides = {}) {
  return {
    id: 'unit',
    hp: 100,
    maxHp: 100,
    speed: 5,
    combatStats: { minSpeed: 3, maxSpeed: 6, offensiveLevel: 1, defensiveLevel: 1 },
    statusEffects: {},
    ...overrides,
  };
}

test('Exhaustion is clamped from Level 0 to 6', () => {
  const actor = unit();
  exhaustion.setLevel(actor, -10);
  expect(exhaustion.getLevel(actor)).toBe(0);
  exhaustion.setLevel(actor, 99);
  expect(exhaustion.getLevel(actor)).toBe(6);
});

test('Level 1 raises Ability and Skill Check Threshold by 2', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 1);
  expect(exhaustion.thresholdModifier(actor, { kind: 'ability', abilityId: 'str' })).toBe(2);
  expect(exhaustion.thresholdModifier(actor, { kind: 'skill', abilityId: 'dex', skillId: 'stealth' })).toBe(2);
  expect(exhaustion.thresholdModifier(actor, { kind: 'save', abilityId: 'wis' })).toBe(0);
});

test('Level 2 reduces Max Speed by 2', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 2);
  expect(exhaustion.combatModifiers(actor).max_speed).toBe(-2);
  expect(speedRuntime.effectiveSpeed(actor)).toBe(4);
});

test('Level 3 raises Save Threshold by 2 and gives -2 Clash Power', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 3);
  expect(exhaustion.thresholdModifier(actor, { kind: 'save', abilityId: 'con' })).toBe(2);
  const snapshot = global.LuminousUniversalModifiers.resolveCharacterSnapshot({ unit: actor, character: actor, traits: [] });
  expect(snapshot.modifiers.clash_power).toBe(-2);
});

test('Level 4 halves Max HP and restores Max HP after recovery below Level 4', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 4);
  expect(actor.maxHp).toBe(50);
  expect(actor.hp).toBe(50);
  exhaustion.setLevel(actor, 3);
  expect(actor.maxHp).toBe(100);
  expect(actor.hp).toBe(50);
});

test('Level 5 fixes Speed to 1', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 5);
  expect(speedRuntime.effectiveSpeed(actor)).toBe(1);
});

test('Level 6 causes Death', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 6);
  expect(actor.lifeState).toBe('dead');
  expect(actor.isDead).toBe(true);
  expect(actor.hp).toBe(0);
});

test('Long Rest removes exactly 1 Exhaustion Level', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 3);
  exhaustion.onLongRest(actor, { at: 1234 });
  expect(exhaustion.getLevel(actor)).toBe(2);
  expect(actor.exhaustion.lastLongRestAt).toBe(1234);
});

test('missing the required daily Long Rest gains 1 Level only once per day key', () => {
  const actor = unit();
  const first = exhaustion.resolveDailyRestRequirement(actor, { dayKey: 'day-1', completedLongRest: false });
  const duplicate = exhaustion.resolveDailyRestRequirement(actor, { dayKey: 'day-1', completedLongRest: false });
  expect(first.gained).toBe(1);
  expect(exhaustion.getLevel(actor)).toBe(1);
  expect(duplicate.reason).toBe('already_resolved');
  expect(exhaustion.getLevel(actor)).toBe(1);
});

test('a completed valid Long Rest prevents daily Exhaustion', () => {
  const actor = unit();
  const result = exhaustion.resolveDailyRestRequirement(actor, { dayKey: 'day-1', completedLongRest: true });
  expect(result.gained).toBe(0);
  expect(exhaustion.getLevel(actor)).toBe(0);
});

test('racial Traits may ignore the normal Long Rest requirement explicitly', () => {
  const actor = unit({ traitDefinitions: [{ id: 'restless_race', mechanics: { longRestRequirement: 'ignore' } }] });
  const requirement = exhaustion.longRestRequirement(actor);
  expect(requirement.required).toBe(false);
  const result = exhaustion.resolveDailyRestRequirement(actor, { dayKey: 'day-1', completedLongRest: false });
  expect(result.gained).toBe(0);
});

test("Warforged Sentry's Rest changes Long Rest behavior but does not remove the Long Rest requirement", () => {
  const actor = unit({ traitDefinitions: [{ id: 'warforged_sentry_rest', mechanics: {} }] });
  expect(exhaustion.longRestRequirement(actor).required).toBe(true);
});

test('Exhaustion cannot be removed by Status Effect removal', () => {
  const actor = unit();
  exhaustion.setLevel(actor, 2);
  statusEngine.removeStatus(actor, 'exhaustion', { from: 'effects' });
  expect(exhaustion.getLevel(actor)).toBe(2);
});
