import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
await import('../js/status-library.js');
await import('../js/deckEngine.js');
await import('../js/skill-catalog-player-signature.js');

const catalog = globalThis.LuminousPlayerSignatureSkillCatalog;
assert.ok(catalog);
assert.deepEqual(catalog.RANDOM_STATUS_POOL, ['burn', 'rupture', 'sinking', 'tremor', 'bleed']);

const s1 = catalog.get('angelo_steps_to_perfection');
const s2 = catalog.get('angelo_blood_art');
const s3 = catalog.get('angelo_my_masterpiece');

assert.deepEqual([s1.tier, s1.basePower, s1.coinPower, s1.coinAmount, s1.skillAmount, s1.metadata.rawMaxPower], [1, 2, 3, 3, 3, 11]);
assert.deepEqual([s2.tier, s2.basePower, s2.coinPower, s2.coinAmount, s2.skillAmount, s2.metadata.rawMaxPower], [2, 8, 8, 1, 2, 16]);
assert.deepEqual([s3.tier, s3.basePower, s3.coinPower, s3.coinAmount, s3.skillAmount, s3.metadata.rawMaxPower], [3, 3, 4, 4, 1, 19]);

const deck = globalThis.LuminousDeckEngine;
const angeloDeck = deck.buildDeckDefinition([s1, s2, s3], { capacity: 6, requireFull: true });
assert.equal(angeloDeck.cardCount, 6);
assert.deepEqual(
  Object.fromEntries([s1.id, s2.id, s3.id].map((id) => [id, angeloDeck.cards.filter((card) => card.skillId === id).length])),
  { angelo_steps_to_perfection: 3, angelo_blood_art: 2, angelo_my_masterpiece: 1 },
);
assert.deepEqual(
  [3 / 6, 2 / 6, 1 / 6],
  [0.5, 1 / 3, 1 / 6],
);
assert.equal(s2.metadata.mechanics.reuse.baseChance, 0.40);
assert.equal(s2.metadata.mechanics.reuse.chancePerNegativeStatusType, 0.20);
assert.equal(s2.metadata.mechanics.reuse.maxReuses, 2);
assert.equal(s3.metadata.mechanics.coin4Damage.maxDamagePercent, 125);

let unilateralCalls = 0;
globalThis.CombatEngine = {
  triggerEvent() { return null; },
  applyPassiveModifiers() { return {}; },
  resolveClash(unitA, skillA, unitB, skillB) {
    return {
      a: this.applyPassiveModifiers(unitA, { skill: skillA }).clash_power || 0,
      b: this.applyPassiveModifiers(unitB, { skill: skillB }).clash_power || 0,
    };
  },
  calculateCoinDamage() { return 100; },
  resolveUnilateralWithCounter(attacker, skill, defender) {
    unilateralCalls += 1;
    this.triggerEvent('[On Hit]', {
      attacker,
      unitAttacker: attacker,
      defender,
      currentTarget: defender,
      skill,
      currentCoin: skill.coins?.[0] || null,
    }, [defender]);
    return { attackLogs: [{ call: unilateralCalls }], pendingActions: [], damageTaken: 10 };
  },
};

await import('../js/player-skill-runtime-angelo.js');
const runtime = globalThis.LuminousAngeloPlayerSkillRuntime;
assert.ok(runtime);
assert.equal(globalThis.CombatEngine.__angeloPlayerSkillRuntime074, true);

const headsTarget = { statusEffects: {} };
runtime.handleSkillTrigger('[Heads]', { skill: s1, currentCoin: s1.coins[0], currentTarget: headsTarget }, () => 0);
assert.equal(headsTarget.statusEffects.burn.count, 2);

runtime.handleSkillTrigger('[On Hit]', { skill: s1, currentCoin: s1.coins[2], currentTarget: headsTarget }, () => 0);
assert.equal(headsTarget.statusEffects.bleed.potency, 2);

const artTarget = {
  hp: 100,
  statusEffects: {
    burn: { count: 1, potency: 0 },
    rupture: { count: 1, potency: 0 },
  },
};
runtime.handleSkillTrigger('[On Hit]', { skill: s2, currentCoin: s2.coins[0], currentTarget: artTarget }, () => 0.60);
assert.equal(artTarget.statusEffects.bleed.count, 1);
assert.equal(artTarget.statusEffects.tremor.count, 3);
assert.equal(runtime.negativeStatusTypeCount(artTarget) >= 3, true);
assert.equal(runtime.bloodArtReuseChance(artTarget), 0.8);

const clashTarget = { statusEffects: { bleed: { potency: 6, count: 6 } } };
assert.equal(runtime.angeloClashBonus(s1, clashTarget), 1);
assert.equal(runtime.angeloClashBonus(s2, clashTarget), 4);
assert.equal(runtime.angeloClashBonus(s3, clashTarget), 4);

const clash = globalThis.CombatEngine.resolveClash(
  { statusEffects: {} }, s2,
  clashTarget, { id: 'other_skill', coins: [{ index: 0, status: 'active' }] },
);
assert.equal(clash.a, 4);
assert.equal(clash.b, 0);

const masterpieceTarget = {
  statusEffects: {
    burn: { count: 1 }, rupture: { count: 1 }, sinking: { count: 1 }, tremor: { count: 1 }, bleed: { count: 1 },
  },
};
const masterpieceDamage = globalThis.CombatEngine.calculateCoinDamage(
  {}, masterpieceTarget, s3, 10, false, 0, { skill: s3, currentCoin: s3.coins[3] },
);
assert.equal(masterpieceDamage, 225);

const oldRandom = Math.random;
Math.random = () => 0;
try {
  unilateralCalls = 0;
  const reuseTarget = { hp: 100, statusEffects: { burn: { count: 1 }, rupture: { count: 1 } } };
  const reuseResult = globalThis.CombatEngine.resolveUnilateralWithCounter({}, s2, reuseTarget, null, {});
  assert.equal(unilateralCalls, 3, 'Blood Art should perform the original hit plus at most 2 reuses');
  assert.equal(reuseResult.angeloBloodArtReuses, 2);
  assert.equal(reuseResult.attackLogs.length, 3);
} finally {
  Math.random = oldRandom;
}

console.log('Angelo signature skills smoke: OK');
