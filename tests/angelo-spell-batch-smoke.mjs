import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

globalThis.STATUS_REGISTRY = {};
delete globalThis.LuminousStatusEngine;
delete globalThis.LuminousElementalStatusRuntime;
delete globalThis.LuminousAngeloSpellBatchRuntime;

const combatCatalog = require('../js/spell-catalog-core.js');
const roleCatalog = require('../js/role-spell-catalog-core.js');
const batch = globalThis.LuminousAngeloSpellBatchRuntime || require('../js/spell-batch-angelo-runtime.js');

for (const id of ['vicious_mockery', 'silvery_barbs', 'calm_emotions', 'mirror_image', 'hold_person', 'hypnotic_pattern']) {
  assert.ok(combatCatalog[id], `missing combat spell ${id}`);
}
for (const id of ['mage_hand', 'prestidigitation', 'distort_value', 'comprehend_languages', 'speak_with_animals']) {
  assert.ok(roleCatalog[id], `missing role spell ${id}`);
  assert.deepEqual(roleCatalog[id].contexts, ['theater']);
}

assert.equal(combatCatalog.vicious_mockery.basePower, 6);
assert.equal(combatCatalog.vicious_mockery.coinPower, 5);
assert.equal(combatCatalog.mirror_image.mechanics.onUse.potency, 3);
assert.equal(combatCatalog.mirror_image.mechanics.onUse.count, 10);
assert.equal(combatCatalog.hypnotic_pattern.mechanics.statusMaxCount, 10);
assert.equal(combatCatalog.hypnotic_pattern.mechanics.targetingCoin.headsChance, 'caster_sp_formula');
assert.equal(combatCatalog.hold_person.upcast.additionalTargetsPerLevel, 1);

assert.equal(batch.STATUS_DEFINITIONS.mirror_image.icon, 'https://imgur.com/GGpUQv0.png');
assert.equal(batch.STATUS_DEFINITIONS.hypnotic_pattern.icon, 'https://imgur.com/MKPqZ8j.png');
assert.equal(batch.STATUS_DEFINITIONS.silvery_barbs_bad.icon, 'https://imgur.com/zDToyxB.png');
assert.equal(batch.STATUS_DEFINITIONS.silvery_barbs_good.icon, 'https://imgur.com/WLAtTRS.png');
assert.equal(batch.STATUS_DEFINITIONS.silvery_barbs_bad.maxCount, 1);
assert.equal(batch.STATUS_DEFINITIONS.silvery_barbs_good.maxCount, 1);

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
  getCoinProbability(sp) { return 50 + Number(sp || 0); },
};
globalThis.CombatEngine = engine;
batch.install();

const caster = { id: 'caster', level: 40, sp: 0, statusEffects: {}, team: 'ally', spellcastingState: { concentration: { active: null } } };
const target = { id: 'target', hp: 100, sp: 0, statusEffects: {}, team: 'enemy', __testSavePower: 12 };

engine.triggerEvent('[On Hit]', { skill: { id: 'vicious_mockery', characterLevel: 40 }, currentTarget: target, unitAttacker: caster });
assert.equal(target.statusEffects.sinking.potency, 3);
assert.equal(target.statusEffects.sinking.count, 3);
assert.equal(target.statusEffects.clash_power_down.count, 2);
engine.triggerEvent('[On Clash End]', { unitAttacker: target, currentTarget: caster, skill: { id: 'test' } });
assert.equal(target.statusEffects.clash_power_down, undefined);

batch.grantMirrorImage(caster);
assert.equal(caster.statusEffects.mirror_image.potency, 3);
assert.equal(caster.statusEffects.mirror_image.count, 10);
const beforeHitContext = { currentTarget: caster, skill: { id: 'test_attack' } };
engine.triggerEvent('[Before Getting Hit]', beforeHitContext);
assert.equal(caster.statusEffects.mirror_image.potency, 2);
assert.deepEqual(beforeHitContext.mirrorImageDefense, { type: 'evade', defensePowerBonus: 50, sourceStatus: 'mirror_image' });
engine.triggerPhase('[Turn End]', [caster]);
assert.equal(caster.statusEffects.mirror_image.count, 9);
engine.triggerPhase('[Encounter End]', [caster]);
assert.equal(caster.statusEffects.mirror_image, undefined);

const bad = { id: 'bad', statusEffects: {}, __testSavePower: 12 };
const good = { id: 'good', statusEffects: {}, __testSavePower: 12 };
assert.deepEqual(batch.applySilveryBarbs(bad, good), { ok: true });
let save = engine.resolveSpell({ id: 'test_save', saveDC: 11 }, bad, []);
assert.equal(save.savePower, 10);
assert.equal(save.isSuccess, false);
assert.equal(save.silveryBarbsFinalPowerModifier, -2);
assert.equal(bad.statusEffects.silvery_barbs_bad, undefined);
save = engine.resolveSpell({ id: 'test_save', saveDC: 13 }, good, []);
assert.equal(save.savePower, 14);
assert.equal(save.isSuccess, true);
assert.equal(save.silveryBarbsFinalPowerModifier, 2);
assert.equal(good.statusEffects.silvery_barbs_good, undefined);

const holdTarget = { id: 'hold', hp: 100, statusEffects: {}, __testSavePower: 8 };
engine.resolveSpell({ id: 'hold_person', saveDC: 12, sourceUnitId: 'caster' }, holdTarget, []);
assert.equal(holdTarget.statusEffects.paralyzed.count, 10);
assert.equal(holdTarget.statusEffects.paralyzed.data.concentrationSpellId, 'hold_person');
caster.spellcastingState.concentration.active = { spellId: 'hold_person' };
engine.triggerPhase('[Turn End]', [caster, holdTarget]);
assert.equal(holdTarget.statusEffects.paralyzed.count, 9);
holdTarget.__testSavePower = 15;
engine.triggerPhase('[Turn End]', [caster, holdTarget]);
assert.equal(holdTarget.statusEffects.paralyzed, undefined);

const hypnotized = { id: 'hypno', hp: 100, statusEffects: {}, __testSavePower: 8 };
caster.spellcastingState.concentration.active = { spellId: 'hypnotic_pattern' };
engine.resolveSpell({ id: 'hypnotic_pattern', saveDC: 12, sourceUnitId: 'caster' }, hypnotized, []);
assert.equal(hypnotized.statusEffects.hypnotic_pattern.count, 10);
engine.applyDamage(hypnotized, 1);
assert.equal(hypnotized.statusEffects.hypnotic_pattern, undefined);

batch.applyHypnoticPattern(hypnotized, 'caster');
engine.triggerEvent('[On Assist]', { currentTarget: hypnotized, unitAttacker: caster, skill: { id: 'assist' } });
assert.equal(hypnotized.statusEffects.hypnotic_pattern, undefined);

const heads = batch.resolveHypnoticTargets(caster, [target], [good], () => 0);
assert.equal(heads.heads, true);
assert.deepEqual(heads.targets, [target]);
const tails = batch.resolveHypnoticTargets(caster, [target], [good], () => 0.99);
assert.equal(tails.indiscriminate, true);
assert.equal(tails.targets.includes(target), true);
assert.equal(tails.targets.includes(good), true);
assert.equal(tails.targets.includes(caster), true);

const ally = { id: 'ally', team: 'ally', sp: -20, statusEffects: { charmed: { count: 2 }, frightened: { count: 2 } } };
const enemy = { id: 'enemy', team: 'enemy', sp: -20, statusEffects: { charmed: { count: 2 }, frightened: { count: 2 } }, __testSavePower: 8 };
caster.spellcastingState.concentration.active = { spellId: 'calm_emotions' };
batch.startCalmEmotions(caster, 12);
engine.triggerPhase('[Turn Start]', [caster, ally, enemy]);
assert.equal(ally.sp, 0);
assert.equal(ally.statusEffects.charmed, undefined);
assert.equal(ally.statusEffects.frightened, undefined);
assert.equal(enemy.sp, 0);
assert.equal(enemy.statusEffects.charmed, undefined);
assert.equal(enemy.statusEffects.frightened, undefined);

console.log('Angelo spell batch smoke: OK');
