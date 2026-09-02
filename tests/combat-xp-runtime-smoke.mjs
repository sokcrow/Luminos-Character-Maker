import '../js/combat-xp-runtime.js';

const xp = globalThis.LuminousCombatXpRuntime;
if (!xp) throw new Error('LuminousCombatXpRuntime was not initialized.');

const smoke = xp.runSmokeTest();
if (!smoke.passed) {
  console.error('[CombatXP] Smoke test failed:', smoke.checks);
  process.exitCode = 1;
  throw new Error('Combat XP smoke test failed.');
}

const overridden = xp.applyXpMetadata({ id: 'elite', hp: 0 }, {
  rating: 2,
  xpValue: 999,
  xpPolicy: 'normal'
});
const normalizedOverride = xp.normalizeUnitXp(overridden);
if (!normalizedOverride.threat.overridden || normalizedOverride.xpValue !== 999) {
  throw new Error('Manual XP override was not preserved.');
}

const unresolved = xp.resolveEncounterXp({
  enemies: [xp.applyXpMetadata({ id: 'enemy', hp: 0 }, { rating: 3 })],
  participants: [{ id: 'p1' }],
  fixedEncounterXp: 500,
  bonusXp: 100,
  encounterResolved: false
});
if (unresolved.totalXp !== 0) {
  throw new Error('Unresolved encounters must not award XP.');
}

const threeWay = xp.resolveEncounterXp({
  enemies: [xp.applyXpMetadata({ id: 'enemy', hp: 0 }, { rating: 1 })],
  participants: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
  encounterResolved: true
});
if (threeWay.totalXp !== 200 || threeWay.xpPerParticipant !== 66 || threeWay.remainderXp !== 2) {
  throw new Error('Party XP split/remainder is incorrect.');
}

console.log('[CombatXP] Smoke test passed.');
console.log(smoke.checks);
