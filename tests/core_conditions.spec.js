const { test, expect } = require('@playwright/test');

const statusEngine = require('../js/status-engine.js');
const conditionRuntime = global.LuminousConditionRuntime;
const exhaustionEngine = global.LuminousExhaustionEngine;
require('../js/universal-modifier-engine.js');
conditionRuntime.install();
const actionEconomy = require('../js/universal-action-economy.js');
const speedRuntime = require('../js/universal-speed-runtime.js');

function unit(id, overrides = {}) {
  return {
    id,
    name: id,
    hp: 100,
    maxHp: 100,
    speed: 5,
    combatStats: { minSpeed: 3, maxSpeed: 6, offensiveLevel: 1, defensiveLevel: 1 },
    statusEffects: {},
    ...overrides,
  };
}

test('registers only the approved core Conditions', () => {
  const expected = [
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated',
    'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained',
  ];
  expect(Object.keys(conditionRuntime.DEFINITIONS).sort()).toEqual(expected.sort());
  expect(conditionRuntime.DEFINITIONS.stunned).toBeUndefined();
  expect(conditionRuntime.DEFINITIONS.unconscious).toBeUndefined();
  expect(conditionRuntime.DEFINITIONS.exhaustion).toBeUndefined();
});

test('Frightened starts at Count 5 and applies -3 Clash, -6 against Unit A', () => {
  const victim = unit('victim');
  const source = unit('source');
  const other = unit('other');
  const applied = statusEngine.applyStatus(victim, 'frightened', { sourceUnitId: 'source', data: { spellDC: 14 } });
  expect(applied.count).toBe(5);

  const modifiers = global.LuminousUniversalModifiers;
  const normal = modifiers.resolveCharacterSnapshot({ unit: victim, character: victim, target: other, traits: [] });
  const versusSource = modifiers.resolveCharacterSnapshot({ unit: victim, character: victim, target: source, traits: [] });
  expect(normal.modifiers.clash_power).toBe(-3);
  expect(versusSource.modifiers.clash_power).toBe(-6);
  expect(conditionRuntime.canTarget(victim, source, { type: 'attack' }).allowed).toBe(false);
});

test('core numeric Conditions feed the universal modifier engine', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'blinded');
  statusEngine.applyStatus(actor, 'invisible');
  statusEngine.applyStatus(actor, 'prone');
  const snapshot = global.LuminousUniversalModifiers.resolveCharacterSnapshot({ unit: actor, character: actor, traits: [] });
  expect(snapshot.modifiers.clash_power).toBe(-5);
  expect(snapshot.modifiers.final_power).toBe(5);
  expect(snapshot.modifiers.defense_power).toBe(5);
  expect(snapshot.modifiers.evade_power).toBe(-15);
  expect(snapshot.modifiers.counter_power).toBe(-15);
});

test('Prone and Restrained grant +2 Final Power to Skills targeting the Unit', () => {
  const attacker = unit('attacker');
  const target = unit('target');
  statusEngine.applyStatus(target, 'restrained');
  const snapshot = global.LuminousUniversalModifiers.resolveCharacterSnapshot({ unit: attacker, character: attacker, target, traits: [] });
  expect(snapshot.modifiers.final_power).toBe(2);
});

test('Condition Threshold modifiers use the approved Check rules', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'blinded');
  expect(conditionRuntime.thresholdModifier(actor, { kind: 'skill', abilityId: 'wis', skillId: 'perception' })).toBe(99);

  statusEngine.applyStatus(actor, 'deafened');
  expect(conditionRuntime.thresholdModifier(actor, { kind: 'skill', abilityId: 'wis', skillId: 'perception', senses: ['hearing'] })).toBe(198);

  const poisoned = unit('poisoned');
  statusEngine.applyStatus(poisoned, 'poisoned');
  expect(conditionRuntime.thresholdModifier(poisoned, { kind: 'ability', abilityId: 'str' })).toBe(2);
  expect(conditionRuntime.thresholdModifier(poisoned, { kind: 'save', abilityId: 'con' })).toBe(0);

  const restrained = unit('restrained');
  statusEngine.applyStatus(restrained, 'restrained');
  expect(conditionRuntime.thresholdModifier(restrained, { kind: 'save', abilityId: 'dex' })).toBe(3);
  expect(conditionRuntime.thresholdModifier(restrained, { kind: 'save', abilityId: 'wis' })).toBe(0);
});

test('Charmed lowers Unit A CHA Threshold and blocks harmful targeting of the charmer', () => {
  const source = unit('source');
  const charmed = unit('charmed');
  statusEngine.applyStatus(charmed, 'charmed', { sourceUnitId: 'source' });
  expect(conditionRuntime.thresholdModifier(source, { kind: 'skill', abilityId: 'cha', skillId: 'persuasion' }, { target: charmed })).toBe(-3);
  expect(conditionRuntime.canTarget(charmed, source, { type: 'attack' }).allowed).toBe(false);
  expect(conditionRuntime.canTarget(charmed, source, { type: 'Normal' }).allowed).toBe(false);
  expect(conditionRuntime.canTarget(charmed, source, { type: 'skill', harmful: false }).allowed).toBe(true);
});

test('Invisible blocks CombatEngine attackWeight 3 or less and allows Weight 4+', () => {
  const attacker = unit('attacker');
  const target = unit('target');
  statusEngine.applyStatus(target, 'invisible');
  expect(conditionRuntime.canTarget(attacker, target, { type: 'attack', attackWeight: 3 }).allowed).toBe(false);
  expect(conditionRuntime.canTarget(attacker, target, { type: 'attack', attackWeight: 4 }).allowed).toBe(true);
  expect(conditionRuntime.canTarget(attacker, target, { type: 'attack', weight: 4 }).allowed).toBe(true);
});

test('Paralyzed, Petrified and Incapacitated gate the action economy', () => {
  const paralyzed = unit('paralyzed');
  statusEngine.applyStatus(paralyzed, 'paralyzed');
  expect(actionEconomy.availability(paralyzed, 'action', { phase: 'planning' }).available).toBe(false);
  expect(actionEconomy.availability(paralyzed, 'quick_action', { phase: 'planning' }).available).toBe(false);
  expect(actionEconomy.availability(paralyzed, 'reaction', { phase: 'combat' }).available).toBe(false);

  const incapacitated = unit('incapacitated');
  statusEngine.applyStatus(incapacitated, 'incapacitated');
  expect(actionEconomy.canUseUniversalAction(incapacitated, 'grapple', { phase: 'planning' }).available).toBe(false);
});

test('fixed-speed Conditions resolve Speed to 1', () => {
  for (const id of ['paralyzed', 'petrified', 'prone', 'restrained']) {
    const actor = unit(id);
    statusEngine.applyStatus(actor, id);
    expect(speedRuntime.effectiveSpeed(actor)).toBe(1);
  }
});

test('Petrified gains Protection at Turn Start, rejects Poisoned, and poison deals zero', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'petrified');
  expect(statusEngine.applyStatus(actor, 'poisoned')).toBeNull();
  conditionRuntime.turnStart(actor);
  expect(statusEngine.getStatus(actor, 'protection').count).toBe(5);
  expect(conditionRuntime.poisonDamageMultiplier(actor)).toBe(0);
});

test('Poisoned makes poison deal +50 percent damage', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'poisoned');
  expect(conditionRuntime.poisonDamageMultiplier(actor)).toBe(1.5);
});

test('Prone removes itself on Turn Start', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'prone');
  conditionRuntime.turnStart(actor);
  expect(statusEngine.hasStatus(actor, 'prone')).toBe(false);
});

test('Frightened loses Count only on a resolved failed Turn End save', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'frightened', { sourceUnitId: 'source', data: { spellDC: 15 } });
  conditionRuntime.turnEnd(actor, { resolveCheck: () => ({ pending: true, reason: 'missing_threshold' }) });
  expect(statusEngine.getStatus(actor, 'frightened').count).toBe(5);
  conditionRuntime.turnEnd(actor, { resolveCheck: () => ({ passed: false }) });
  expect(statusEngine.getStatus(actor, 'frightened').count).toBe(4);
  statusEngine.applyStatus(actor, 'frightened', { mode: 'set', count: 0, sourceUnitId: 'source' });
  conditionRuntime.turnStart(actor);
  expect(actor.lifeState).toBe('retreated');
});

test('Turn End saves remove Blinded, Charmed, Deafened and Poisoned on pass', () => {
  const actor = unit('actor');
  for (const id of ['blinded', 'charmed', 'deafened', 'poisoned']) statusEngine.applyStatus(actor, id, { sourceUnitId: 'source', data: { spellDC: 13 } });
  conditionRuntime.turnEnd(actor, { resolveCheck: () => ({ passed: true }) });
  for (const id of ['blinded', 'charmed', 'deafened', 'poisoned']) expect(statusEngine.hasStatus(actor, id)).toBe(false);
});

test('Variant trigger removal only removes the configured trigger Status', () => {
  const actor = unit('actor');
  statusEngine.applyStatus(actor, 'invisible', { data: { removeTrigger: 'attack' } });
  expect(conditionRuntime.resolveTrigger(actor, 'spell_cast')).toEqual([]);
  expect(conditionRuntime.resolveTrigger(actor, 'attack')).toEqual(['invisible']);
});

test('Grapple applies linked Grappled to both Units, blocks Unit B Actions and breaks when Unit A acts', () => {
  const grappler = unit('a');
  const held = unit('b');
  const result = conditionRuntime.grapple(grappler, held, { unitATotal: 15, unitBTotal: 10 });
  expect(result.applied).toBe(true);
  expect(statusEngine.getStatus(grappler, 'grappled').data.role).toBe('grappler');
  expect(statusEngine.getStatus(held, 'grappled').data.role).toBe('held');
  expect(speedRuntime.effectiveSpeed(grappler)).toBe(1);
  expect(speedRuntime.effectiveSpeed(held)).toBe(1);
  expect(actionEconomy.availability(held, 'action', { phase: 'planning' }).available).toBe(false);

  conditionRuntime.onActionUsed(grappler, { combatants: [grappler, held] });
  expect(statusEngine.hasStatus(grappler, 'grappled')).toBe(false);
  expect(statusEngine.hasStatus(held, 'grappled')).toBe(false);
});

test('Exhaustion remains outside the Status store', () => {
  const actor = unit('actor');
  exhaustionEngine.setLevel(actor, 2);
  expect(exhaustionEngine.getLevel(actor)).toBe(2);
  expect(statusEngine.hasStatus(actor, 'exhaustion')).toBe(false);
});
