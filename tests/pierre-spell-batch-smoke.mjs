import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

globalThis.STATUS_REGISTRY = {};
delete globalThis.LuminousStatusEngine;
delete globalThis.LuminousElementalStatusRuntime;
delete globalThis.LuminousPierreSpellBatchRuntime;

const combatCatalog = require('../js/spell-catalog-core.js');
const roleCatalog = require('../js/role-spell-catalog-core.js');
const batch = globalThis.LuminousPierreSpellBatchRuntime || require('../js/spell-batch-pierre-runtime.js');

const addedCombatIds = [
  'mind_sliver', 'chill_touch', 'absorb_elements', 'shield', 'thunderwave',
  'dissonant_whispers', 'animal_friendship', 'crown_of_madness', 'suggestion'
];
for (const id of addedCombatIds) assert.ok(combatCatalog[id], `missing combat spell ${id}`);
assert.deepEqual(Object.keys(roleCatalog).sort(), ['message', 'thaumaturgy']);
assert.deepEqual(roleCatalog.message.contexts, ['theater']);
assert.deepEqual(roleCatalog.thaumaturgy.contexts, ['theater']);

assert.equal(combatCatalog.mind_sliver.basePower, 4);
assert.equal(combatCatalog.mind_sliver.coinPower, 5);
assert.equal(combatCatalog.thunderwave.coinType, 'unbreakable');
assert.equal(combatCatalog.thunderwave.attackWeight, 4);
assert.equal(combatCatalog.dissonant_whispers.coinType, 'unbreakable');
assert.equal(combatCatalog.crown_of_madness.upcast, undefined);
assert.equal(batch.STATUS_DEFINITIONS.mind_sliver.maxCount, 3);
assert.equal(batch.STATUS_DEFINITIONS.elemental_absorption.icon, 'https://imgur.com/N6HONrV.png');
assert.equal(batch.STATUS_DEFINITIONS.crown_of_madness.icon, 'https://imgur.com/fIGa7J3.png');

const engine = {
  triggerEvent() { return null; },
  resolveSpell(spell, target) {
    const dc = Number(spell.saveDC || 0);
    const savePower = Number(target.__testSavePower ?? 12);
    return { dc, savePower, isSuccess: savePower >= dc, winner: savePower >= dc ? 'Target' : 'Caster' };
  },
  triggerPhase() { return null; },
  applyDamage(unit, damage) {
    const amount = Math.max(0, Number(damage) || 0);
    unit.hp = Math.max(0, Number(unit.hp || 0) - amount);
    return { damageTaken: amount };
  },
  modifyNextStaggerThreshold(unit, amount) {
    unit.nextStaggerThreshold = Number(unit.nextStaggerThreshold || 0) + Number(amount || 0);
  },
  getCoinProbability() { return 50; },
};
globalThis.CombatEngine = engine;
batch.install();

const caster = { id: 'caster', sp: 0 };

const sliverTarget = { id: 'sliver-target', hp: 100, sp: 0, statusEffects: {}, __testSavePower: 12 };
for (let i = 0; i < 4; i++) engine.triggerEvent('[On Hit]', { skill: { id: 'mind_sliver', spellMod: 5 }, currentTarget: sliverTarget, unitAttacker: caster });
assert.equal(sliverTarget.statusEffects.mind_sliver.count, 3);
const save = engine.resolveSpell({ id: 'test_save', statUsed: 'wis', saveDC: 11 }, sliverTarget, []);
assert.equal(save.savePower, 10);
assert.equal(save.isSuccess, false);
assert.equal(save.mindSliverFinalPowerPenalty, -2);
assert.equal(sliverTarget.statusEffects.mind_sliver.count, 2);

const decayTarget = { id: 'decay-target', hp: 100, maxHp: 100, statusEffects: {} };
engine.triggerEvent('[On Hit]', { skill: { id: 'chill_touch', spellMod: 5 }, currentTarget: decayTarget, unitAttacker: caster });
assert.equal(decayTarget.statusEffects.decay.count, 2);

const thunderTarget = { id: 'thunder-target', hp: 100, statusEffects: {}, nextStaggerThreshold: 20 };
const thunderSkill = { id: 'thunderwave', slotLevel: 1, skillRange: 2 };
engine.triggerEvent('[On Hit]', { skill: thunderSkill, currentTarget: thunderTarget, unitAttacker: caster });
assert.equal(thunderTarget.statusEffects.tremor.potency, 3);
assert.equal(thunderTarget.statusEffects.tremor.count, 3);
engine.triggerEvent('[On Hit without Cracking]', { skill: thunderSkill, currentTarget: thunderTarget, unitAttacker: caster });
assert.equal(thunderTarget.statusEffects.tremor.potency, 6);
assert.equal(thunderTarget.statusEffects.tremor.count, 5, 'burst consumes one Count after the repeat');
assert.equal(thunderTarget.nextStaggerThreshold, 26);

const whisperTarget = { id: 'whisper-target', hp: 100, sp: -11, statusEffects: {}, actionQueue: [{ id: 'x' }] };
const whisperSkill = { id: 'dissonant_whispers', slotLevel: 1, skillRange: 2 };
engine.triggerEvent('[On Hit]', { skill: whisperSkill, currentTarget: whisperTarget, unitAttacker: caster });
assert.equal(whisperTarget.statusEffects.sinking.potency, 5);
assert.equal(whisperTarget.statusEffects.sinking.count, 5);
engine.triggerEvent('[On Hit without Cracking]', { skill: whisperSkill, currentTarget: whisperTarget, unitAttacker: caster });
assert.ok(whisperTarget.__luminousForcedRetreatAtTurnEnd);
engine.triggerPhase('[Turn End]', [whisperTarget]);
assert.equal(whisperTarget.lifeState, 'retreated');
assert.equal(whisperTarget.isRetreated, true);
assert.deepEqual(whisperTarget.actionQueue, []);

const absorber = { id: 'absorber', hp: 100, statusEffects: {} };
assert.deepEqual(batch.prepareAbsorbElements(absorber, 'fire', 3), { ok: true, element: 'fire', count: 3 });
engine.applyDamage(absorber, 20, 'directo', false, { element: 'fire' });
assert.equal(absorber.hp, 90);
assert.equal(absorber.statusEffects.elemental_absorption.count, 3);
const meleeTarget = { id: 'melee-target', hp: 100, statusEffects: {} };
engine.triggerEvent('[On Hit]', { skill: { id: 'melee_test', skillRange: 1 }, currentTarget: meleeTarget, unitAttacker: absorber });
assert.equal(meleeTarget.statusEffects.burn.potency, 3);
assert.equal(meleeTarget.statusEffects.burn.count, 3);
assert.equal(absorber.statusEffects.elemental_absorption, undefined);

const shielded = { id: 'shielded', hp: 100, shield: 7, statusEffects: {} };
assert.equal(batch.grantShield(shielded, 2), 40);
assert.equal(shielded.shield, 47);
engine.triggerPhase('[Turn End]', [shielded]);
assert.equal(shielded.shield, 7);

const crownTarget = { id: 'crown-target', hp: 100, sp: 0, statusEffects: {}, __testSavePower: 15 };
batch.applyStatus(crownTarget, 'crown_of_madness', { count: 10, mode: 'set', data: { saveDC: 12, saveAbility: 'wis' } });
engine.triggerPhase('[Turn End]', [crownTarget]);
assert.equal(crownTarget.statusEffects.crown_of_madness, undefined);

globalThis.LuminousBattleViewerActionAdapter073 = {
  __spellAdapter074: true,
  compilePlan(_slotId, _targetId, plan = {}) {
    const definition = structuredClone(plan.data || {});
    return {
      action: {
        actorId: 'caster', source: { type: 'spell', id: definition.id },
        economy: { cost: 'action' }, resolution: { type: definition.save ? 'save' : 'clash' },
        modifiers: [], effects: [], metadata: { slotLevel: plan.slotLevel ?? definition.level, sourceDefinition: definition, viewerPlan: structuredClone(plan) }
      },
      plan
    };
  }
};
batch.patchSpellAdapter();
let adapter = globalThis.LuminousBattleViewerActionAdapter073;
const tw = adapter.compilePlan('s1', null, { data: structuredClone(combatCatalog.thunderwave), slotLevel: 3 });
assert.equal(tw.action.modifiers[0].amount, 2);
const sh = adapter.compilePlan('s1', null, { data: structuredClone(combatCatalog.shield), slotLevel: 2 });
assert.equal(sh.action.economy.cost, 'reaction');
assert.equal(sh.action.resolution.type, 'automatic');
assert.equal(sh.action.effects.some((e) => e.type === 'pierre_shield' && e.castLevel === 2), true);
const sgBad = adapter.compilePlan('s1', null, { data: structuredClone(combatCatalog.suggestion), slotLevel: 2 });
assert.equal(sgBad.action, null);
assert.equal(sgBad.reason, 'spell_choice_required');
const sg = adapter.compilePlan('s1', null, { data: structuredClone(combatCatalog.suggestion), slotLevel: 2, choice: { command: 'retreat' } });
assert.equal(sg.action.metadata.sourceDefinition.selectedSuggestionCommand, 'retreat');

console.log('Pierre spell batch smoke: OK');
