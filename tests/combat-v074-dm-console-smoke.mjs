import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

globalThis.LuminousStatusEngine = {
  applyStatus(unit, id, input = {}) {
    unit.statusEffects ||= {};
    unit.statusEffects[id] = { id, count: Number(input.count ?? 1), potency: Number(input.potency ?? 0), data: { ...(input.data || {}) }, sourceUnitId: input.sourceUnitId || null };
    return unit.statusEffects[id];
  },
  removeStatus(unit, id) {
    const removed = Boolean(unit.statusEffects?.[id]);
    if (removed) delete unit.statusEffects[id];
    return { removed };
  },
};

globalThis.LuminousConditionRuntime = {
  DEFINITIONS: { restrained: { name: 'Restrained' }, paralyzed: { name: 'Paralyzed' } },
  getDefinition(id) { return this.DEFINITIONS[id] || null; },
  applyCondition(unit, id, input = {}) { return globalThis.LuminousStatusEngine.applyStatus(unit, id, input); },
  thresholdModifier(unit, context = {}) { return context.kind === 'save' ? 1 : 0; },
  automaticCheckFailure(unit, context = {}) { return unit.autoFail && context.kind === 'save' ? { failed: true, reason: 'test_auto_fail' } : { failed: false }; },
  turnStart(unit) { unit.started = true; return { started: true }; },
  turnEnd(unit) { unit.ended = true; return { ended: true }; },
  loseConcentration(unit) { unit.concentration = null; return { lost: true }; },
};

globalThis.LuminousElementalStatusRuntime = {
  STATUS_DEFINITIONS: { poison: { name: 'Poison' } },
  poisonCheckThresholdPenalty(unit) { return Math.floor(Number(unit.statusEffects?.poison?.potency || 0) / 2) * 2; },
  onTurnStart(unit) { unit.elementalStarted = true; return { ok: true }; },
  onTurnEnd(unit) {
    const poison = unit.statusEffects?.poison;
    if (poison) poison.count = Math.floor(Number(poison.count || 0) / 2);
    return { poison: poison?.count ?? 0 };
  },
  onRest(unit, type) { unit.lastRest = type; return { type }; },
  onEncounterEnd(unit) { unit.encounterEnded = true; return { ok: true }; },
  onHealingReceived() { return null; },
};

globalThis.CombatEngine = {
  applyDamage(unit, amount) { unit.hp = Math.max(0, Number(unit.hp || 0) - Math.floor(Number(amount || 0))); return { damageTaken: Math.floor(Number(amount || 0)) }; },
};

globalThis.LuminousFixedDamageRuntime = {
  applyFixedDamage(unit, amount) { return globalThis.CombatEngine.applyDamage(unit, amount); },
};

const DM = require('../js/battle-viewer-dm-console-074.js');
assert.equal(DM.version, '0.7.4');

const player = {
  level: 40,
  stats: { fuerza: 16, destreza: 14, constitucion: 12, inteligencia: 10, sabiduria: 8, carisma: 18 },
  abilityProficiency: { str: 'proficient', dex: 'none' },
  skillProficiency: { athletics: 'expertise' },
};
assert.equal(DM.effectiveAbilityScore(player, 'str'), 16);
assert.equal(DM.abilityModifier(16), 3);
assert.equal(DM.proficiencyBonus(40), 2);
assert.equal(DM.saveTotal(player, 'str'), 5);
assert.equal(DM.skillTotal(player, 'athletics'), 7);

const unit = { id: 'unit-a', ownerPlayerId: 'player-a', hp: 100, maxHp: 100, sp: 10, statusEffects: { poison: { potency: 4, count: 10 } } };
const linked = DM.playerForUnit(unit, { 'player-a': { ...player, name: 'Tester' } });
assert.equal(linked.id, 'player-a');

const rolls = [0.1, 0.2, 0.9, 0.4, 0.99];
let index = 0;
const check = DM.rollCheck(unit, player, { kind: 'skill', abilityId: 'str', skillId: 'athletics', threshold: 10 }, () => rolls[index++]);
assert.equal(check.headsChance, 60);
assert.equal(check.heads, 3);
assert.equal(check.base, 7);
assert.equal(check.thresholdPenalty, 4);
assert.equal(check.threshold, 14);
assert.equal(check.total, 19);
assert.equal(check.passed, true);

unit.autoFail = true;
const autoFail = DM.rollCheck(unit, player, { kind: 'save', abilityId: 'dex', threshold: 2 }, () => 0);
assert.equal(autoFail.automaticFailure, true);
assert.equal(autoFail.passed, false);
unit.autoFail = false;

DM.applyStatusToUnit(unit, 'restrained', { count: 3, potency: 0, sourceType: 'normal' });
assert.equal(unit.statusEffects.restrained.count, 3);
DM.removeStatusFromUnit(unit, 'restrained', { force: true });
assert.equal(Boolean(unit.statusEffects.restrained), false);

DM.applyDamageToUnit(unit, 12);
assert.equal(unit.hp, 88);
DM.healUnit(unit, 5);
assert.equal(unit.hp, 93);

const encounter = { 'unit-a': unit };
DM.runTurnStart(encounter, 'unit-a');
assert.equal(unit.started, true);
assert.equal(unit.elementalStarted, true);
DM.runTurnEnd(encounter, 'unit-a');
assert.equal(unit.ended, true);
assert.equal(unit.statusEffects.poison.count, 5);
DM.runRest(encounter, 'unit-a', 'short_rest');
assert.equal(unit.lastRest, 'short_rest');
DM.runEncounterEnd(encounter, 'unit-a');
assert.equal(unit.encounterEnded, true);

const firebaseSafe = DM.sanitizeForFirebase({ a: 1, fn() {}, nested: { b: 2, skip: undefined } });
assert.deepEqual(firebaseSafe, { a: 1, nested: { b: 2 } });

globalThis.LuminousBattleViewerRuntime073 = { version: '0.7.3', forecastClash() { return null; } };
const R074 = require('../js/battle-viewer-runtime-074.js');
assert.equal(R074.version, '0.7.4');
assert.equal(R074.rulesVersion, '0.7.3');
assert.equal(R074.dmConsole.version, '0.7.4');

console.log('combat-v074-dm-console-smoke: ok');
