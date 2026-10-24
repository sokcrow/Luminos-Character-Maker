import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { freezeBenchmarkSpeeds, hasVisibleCombatCoin } from './helpers/combat-performance-workload.mjs';
await import('../js/combat-v073-steps.js');

// The real unilateral resolver emits hitCoin without emitting powerCoin.
// Reproduce the old false-negative without timers or a browser fixture.
const units = { player: { hp: 100 }, enemy: { hp: 100 } }, cues = [];
const entry = { ownerId: 'enemy', localIndex: 0, plan: { targetId: 'player', data: { basePower: 2, coinPower: 1, coinAmount: 1 } } };
const rules = {
  data: plan => ({ ...plan.data, finalPowerBonus: 0 }), unit: id => units[id],
  statusAttackPowerModifier: () => 0, targetFinalPowerVulnerabilityBonus: () => 0,
  isUnitTargetable: unit => unit.hp > 0, rollSide: () => 'head', coinHeadsChanceForUnit: () => 50,
  triggerBleedOnCoinFlip() {}, consumeParalysisOnHead: () => false, coinSrc: () => '',
  resolveEvadeAgainstCoin: async () => null,
  damageCombatant(id, power) { units[id].hp -= power; return { finalDamage: power }; },
  triggerGettingHitStatuses() {}, applySkillStatusEffects() {}, triggerCounterAfterHit: async () => {},
};
const runtime = globalThis.LuminousCombatSteps.create({ rules, onPresentation: cue => cues.push({ cue }) });
await runtime.hits(entry, 'player', 1);
assert.equal(units.player.hp, 97);
assert.equal(cues.some(row => row.cue === 'powerCoin'), false, 'The old predicate rejects a real, animated unilateral hit');
assert.ok(cues.some(row => row.cue === 'hitCoin'));
assert.equal(hasVisibleCombatCoin(cues), true);
assert.equal(hasVisibleCombatCoin([{ cue: 'powerCoin' }]), true);
assert.equal(hasVisibleCombatCoin([{ cue: 'actionStart' }, { cue: 'hitMotion' }]), false, 'Startup or motion alone cannot satisfy the Coin assertion');
assert.equal(hasVisibleCombatCoin([]), false);

// Run the production queue builder against deliberately shuffled fixture maps.
const live = fs.readFileSync(new URL('../combat/source/combat-v073-live.html', import.meta.url), 'utf8');
const source = live.slice(live.indexOf('function buildExecutionQueue('), live.indexOf('const TIMELINE_SPEED_STEP_MS'));
function fixture(ids) { return Object.fromEntries(ids.map(id => [id, { id, name: id, actionSlots: 1 }])); }
const ids = ['player:p1', 'kobold', ...Array.from({ length: 7 }, (_, i) => 'kobold' + (i + 1))];
const baseline = freezeBenchmarkSpeeds(fixture(ids), 'player:p1', 'kobold');
const candidate = freezeBenchmarkSpeeds(fixture([...ids].reverse()), 'player:p1', 'kobold');
assert.deepEqual(candidate, baseline, 'Both versions receive identical canonical rolls and tie-breaks regardless of insertion order');
for (const combatData of [baseline, candidate]) {
  const context = { combatData, PLAYER_ID: 'player:p1', AUTO_UNIT_IDS: Object.keys(combatData).filter(id => id !== 'player:p1'),
    plannedActions: [{ ...entry.plan, targetId: 'kobold', clashChoice: 'clash', clashConfirmed: true }], playerSlots: () => [{}], unitSlots: () => [{}] };
  for (const unit of Object.values(combatData)) if (unit.id !== 'player:p1') unit.autoPlans = [{ ...entry.plan, targetId: 'player:p1' }];
  vm.runInNewContext(source + '\nqueue = buildExecutionQueue();', context);
  assert.deepEqual(Array.from(context.queue, row => row.ownerId), ids, 'The chosen Clash precedes the seven other attacks in the real queue');
  assert.ok(Object.values(combatData).every(unit => unit.speedRollTurn === 1 && unit.speedBaseRoll === unit.speed));
}
assert.throws(() => freezeBenchmarkSpeeds({}, 'player', 'enemy'), /participants/);
console.log('Combat benchmark: actual unilateral Coins accepted, empty/non-Coin playback rejected, frozen rolls and real queue order match across baseline/candidate.');
