import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  applyCondition(unit, id, input = {}) {
    return globalThis.LuminousStatusEngine.applyStatus(unit, id, {
      ...input,
      data: {
        ...(input.data || {}),
        sourceType: input.sourceType || 'normal',
        removalMode: input.removalMode || 'trigger',
        concentrationId: input.concentrationId || null,
      },
    });
  },
  thresholdModifier(unit, context = {}) { return context.kind === 'save' ? 1 : 0; },
  automaticCheckFailure(unit, context = {}) { return unit.autoFail && context.kind === 'save' ? { failed: true, reason: 'test_auto_fail' } : { failed: false }; },
  turnStart(unit) { unit.started = true; return { started: true }; },
  turnEnd(unit) { unit.ended = true; return { ended: true }; },
  onEncounterEnd(unit) { unit.conditionEncounterEnded = true; return { ok: true }; },
  startConcentration(unit, options = {}) {
    unit.concentration = { id: options.concentrationId || 'conc-test', active: true, source: options.source || null };
    return unit.concentration;
  },
  getConcentration(unit) { return unit.concentration?.active ? unit.concentration : null; },
  loseConcentration(unit, options = {}) {
    const id = unit.concentration?.id;
    if (!unit.concentration?.active) return { lost: false, removed: [] };
    unit.concentration.active = false;
    const removed = [];
    for (const other of options.units || []) {
      for (const [statusId, entry] of Object.entries(other.statusEffects || {})) {
        if (entry?.data?.concentrationId === id) {
          delete other.statusEffects[statusId];
          removed.push(statusId);
        }
      }
    }
    return { lost: true, removed };
  },
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
const Magic = require('../js/battle-viewer-dm-console-074-magic.js');
const dmApi = DM?.version === '0.7.4' ? DM : globalThis.LuminousBattleViewerDmConsole074;
const magicApi = Magic?.version === '0.7.4' ? Magic : globalThis.LuminousBattleViewerDmMagic074;
assert.equal(dmApi.version, '0.7.4');
assert.equal(magicApi.version, '0.7.4');

const player = {
  level: 40,
  stats: { fuerza: 16, destreza: 14, constitucion: 12, inteligencia: 10, sabiduria: 8, carisma: 18 },
  abilityProficiency: { str: 'proficient', dex: 'none' },
  skillProficiency: { athletics: 'expertise' },
};
assert.equal(dmApi.effectiveAbilityScore(player, 'str'), 16);
assert.equal(dmApi.abilityModifier(16), 3);
assert.equal(dmApi.proficiencyBonus(40), 2);
assert.equal(dmApi.saveTotal(player, 'str'), 5);
assert.equal(dmApi.skillTotal(player, 'athletics'), 7);

const unit = { id: 'unit-a', ownerPlayerId: 'player-a', hp: 100, maxHp: 100, sp: 10, statusEffects: { poison: { potency: 4, count: 10 } } };
const linked = dmApi.playerForUnit(unit, { 'player-a': { ...player, name: 'Tester' } });
assert.equal(linked.id, 'player-a');

const rolls = [0.1, 0.2, 0.9, 0.4, 0.99];
let index = 0;
const check = dmApi.rollCheck(unit, player, { kind: 'skill', abilityId: 'str', skillId: 'athletics', threshold: 10 }, () => rolls[index++]);
assert.equal(check.headsChance, 60);
assert.equal(check.heads, 3);
assert.equal(check.base, 7);
assert.equal(check.thresholdPenalty, 4);
assert.equal(check.threshold, 14);
assert.equal(check.total, 19);
assert.equal(check.passed, true);

unit.autoFail = true;
const autoFail = dmApi.rollCheck(unit, player, { kind: 'save', abilityId: 'dex', threshold: 2 }, () => 0);
assert.equal(autoFail.automaticFailure, true);
assert.equal(autoFail.passed, false);
unit.autoFail = false;

dmApi.applyStatusToUnit(unit, 'restrained', { count: 3, potency: 0, sourceType: 'normal' });
assert.equal(unit.statusEffects.restrained.count, 3);
dmApi.removeStatusFromUnit(unit, 'restrained', { force: true });
assert.equal(Boolean(unit.statusEffects.restrained), false);

const magicEncounter = {
  caster: { id: 'caster', name: 'Caster', hp: 100, maxHp: 100, statusEffects: {} },
  target: { id: 'target', name: 'Target', hp: 100, maxHp: 100, statusEffects: {} },
};
const startedConc = magicApi.startConcentration(magicEncounter, 'caster', { concentrationId: 'conc-1' });
assert.equal(startedConc.concentration.id, 'conc-1');
const magicInput = magicApi.magicConditionInput(magicEncounter, 'caster', { count: 2, potency: 0 });
assert.equal(magicInput.sourceType, 'magic');
assert.equal(magicInput.sourceUnitId, 'caster');
assert.equal(magicInput.removalMode, 'concentration');
assert.equal(magicInput.concentrationId, 'conc-1');
dmApi.applyStatusToUnit(magicEncounter.target, 'restrained', magicInput);
assert.equal(magicEncounter.target.statusEffects.restrained.data.concentrationId, 'conc-1');
globalThis.LuminousConditionRuntime.loseConcentration(magicEncounter.caster, { units: Object.values(magicEncounter) });
assert.equal(Boolean(magicEncounter.target.statusEffects.restrained), false);

dmApi.applyDamageToUnit(unit, 12);
assert.equal(unit.hp, 88);
dmApi.healUnit(unit, 5);
assert.equal(unit.hp, 93);

const encounter = { 'unit-a': unit };
dmApi.runTurnStart(encounter, 'unit-a');
assert.equal(unit.started, true);
assert.equal(unit.elementalStarted, true);
dmApi.runTurnEnd(encounter, 'unit-a');
assert.equal(unit.ended, true);
assert.equal(unit.statusEffects.poison.count, 5);
dmApi.runRest(encounter, 'unit-a', 'short_rest');
assert.equal(unit.lastRest, 'short_rest');
dmApi.runEncounterEnd(encounter, 'unit-a');
assert.equal(unit.encounterEnded, true);
assert.equal(unit.conditionEncounterEnded, true);

const secondUnit = { id: 'unit-b', hp: 50, maxHp: 50, statusEffects: {} };
const allResult = dmApi.runEncounterEndAll({ 'unit-a': unit, 'unit-b': secondUnit });
assert.equal(allResult.count, 2);
assert.equal(secondUnit.encounterEnded, true);
assert.equal(secondUnit.conditionEncounterEnded, true);
assert.equal(dmApi.normalizeEncounterResult('win'), 'victory');
assert.equal(dmApi.normalizeEncounterResult('lose'), 'defeat');

const EncounterLifecycleModule = require('../js/combat-encounter-lifecycle.js');
const EncounterLifecycle = EncounterLifecycleModule?.version ? EncounterLifecycleModule : globalThis.LuminousCombatEncounterLifecycle;
assert.equal(EncounterLifecycle.version, '1.2.0');
assert.equal(EncounterLifecycle.normalizeResult('won'), 'victory');
assert.equal(EncounterLifecycle.normalizeResult('loss'), 'defeat');
assert.equal(EncounterLifecycle.isEncounterEnded({ phase: 'ENDED', result: 'victory' }), true);
assert.equal(EncounterLifecycle.RESULT_IMAGES.victory, 'Assets/Images/Combat/Victory_Battle_Result.png');
assert.equal(EncounterLifecycle.RESULT_IMAGES.defeat, 'Assets/Images/Combat/Defeat_Battle_Result.png');
assert.equal(Object.values(EncounterLifecycle.RESULT_IMAGES).some((url) => /^https?:/i.test(url)), false);
assert.equal(EncounterLifecycle.applyState({ phase: 'ENDED', active: false, result: 'victory', transition: 'blackout' }).transition, 'blackout');

const pngSignature = '89504e470d0a1a0a';
const victoryPng = fs.readFileSync(new URL('../Assets/Images/Combat/Victory_Battle_Result.png', import.meta.url));
const defeatPng = fs.readFileSync(new URL('../Assets/Images/Combat/Defeat_Battle_Result.png', import.meta.url));
assert.equal(victoryPng.subarray(0, 8).toString('hex'), pngSignature);
assert.equal(defeatPng.subarray(0, 8).toString('hex'), pngSignature);
assert.ok(victoryPng.length > 100000);
assert.ok(defeatPng.length > 100000);

const encounterWrites = [];
let encounterCombatants = {
  alpha: { id: 'alpha', hp: 20, maxHp: 20, statusEffects: {} },
  beta: { id: 'beta', hp: 20, maxHp: 20, statusEffects: {} },
};
const fakeDb = {
  ref(path) {
    if (path === dmApi.ROOTS.combatants) {
      return {
        async transaction(mutator) {
          encounterCombatants = mutator(encounterCombatants);
          return { committed: true, snapshot: { val: () => encounterCombatants } };
        },
      };
    }
    if (path === dmApi.ROOTS.audit) {
      return {
        push() {
          return { set: async (value) => { encounterWrites.push({ op: 'audit', path, value }); } };
        },
      };
    }
    return {
      async update(value) { encounterWrites.push({ op: 'update', path, value }); },
      async set(value) { encounterWrites.push({ op: 'set', path, value }); },
    };
  },
};
globalThis.document = {
  getElementById(id) {
    return id === 'battlefield' || id === 'combat-log-terminal' ? {} : null;
  },
};
dmApi._state.db = fakeDb;
const finished = await dmApi.finishEncounter('victory', { confirm: false, displayMs: 0, blackoutMs: 0 });
assert.equal(finished.result, 'victory');
assert.equal(finished.transition, 'blackout');
assert.equal(finished.nextInstance, 'teatro');
const rootUpdates = encounterWrites.filter((entry) => entry.op === 'update' && entry.path == null);
assert.equal(rootUpdates.length, 1);
assert.equal(rootUpdates[0].value[`${dmApi.ROOTS.state}/transition`], 'result');
assert.equal(rootUpdates[0].value[`${dmApi.ROOTS.state}/phase`], 'ENDED');
assert.equal(rootUpdates[0].value[`${dmApi.ROOTS.state}/active`], false);
assert.equal(rootUpdates[0].value[`${dmApi.ROOTS.state}/result`], 'victory');
const stateUpdates = encounterWrites.filter((entry) => entry.op === 'update' && entry.path === dmApi.ROOTS.state);
assert.equal(stateUpdates.length, 1);
assert.equal(stateUpdates[0].value.transition, 'blackout');
assert.ok(encounterWrites.some((entry) => entry.op === 'set' && entry.path === dmApi.ROOTS.instance && entry.value === 'teatro'));
assert.equal(encounterCombatants.alpha.encounterEnded, true);
assert.equal(encounterCombatants.beta.encounterEnded, true);

const firebaseSafe = dmApi.sanitizeForFirebase({ a: 1, fn() {}, nested: { b: 2, skip: undefined } });
assert.deepEqual(firebaseSafe, { a: 1, nested: { b: 2 } });

globalThis.LuminousBattleViewerRuntime073 = { version: '0.7.3', forecastClash() { return null; } };
await import('../js/status-rupture-runtime.js');
await import('../js/battle-viewer-runtime-074.js');
const R074 = globalThis.LuminousBattleViewerRuntime074;
assert.equal(R074.version, '0.7.4');
assert.equal(R074.rulesVersion, '0.7.3');
assert.equal(R074.dmConsole.version, '0.7.4');
assert.equal(R074.dmMagic.version, '0.7.4');
assert.equal(R074.ruptureStatus.version, '1.0.0');
assert.equal(R074.ruptureStatus.DEFINITION.mode, 'double');

console.log('combat-v074-dm-console-smoke: ok');
