import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
await import('../js/status-library.js');
await import('../js/deckEngine.js');
await import('../js/skill-catalog-player-signature.js');

const catalog = globalThis.LuminousPlayerSignatureSkillCatalog;
const deck = globalThis.LuminousDeckEngine;
assert.ok(catalog);
assert.ok(deck);

const s1 = catalog.get('pierre_sukseong');
const s2 = catalog.get('pierre_mise_en_place');
const s3 = catalog.get('pierre_maridaje');
const evolved = catalog.get('pierre_maridaje_perfecto');

assert.deepEqual(
  [s1.tier, s1.basePower, s1.coinPower, s1.coinAmount, s1.skillAmount, s1.sinAffinity, s1.metadata.rawMaxPower],
  [1, 4, 4, 2, 3, 'sloth', 12],
);
assert.deepEqual(
  [s2.tier, s2.basePower, s2.coinPower, s2.coinAmount, s2.skillAmount, s2.sinAffinity, s2.metadata.rawMaxPower],
  [2, 4, 4, 3, 2, 'pride', 16],
);
assert.deepEqual(
  [s3.tier, s3.basePower, s3.coinPower, s3.coinAmount, s3.skillAmount, s3.sinAffinity, s3.metadata.rawMaxPower],
  [3, 3, 4, 4, 1, 'gluttony', 19],
);
assert.deepEqual(
  [evolved.basePower, evolved.coinPower, evolved.coinAmount, evolved.sinAffinity, evolved.metadata.rawMaxPower],
  [8, 3, 5, 'gluttony', 23],
);
assert.equal(evolved.inDeck, false);
assert.equal(evolved.availability.type, 'off_deck');

const pierreDeck = deck.buildDeckDefinition([s1, s2, s3], { capacity: 6, requireFull: true });
assert.equal(pierreDeck.cardCount, 6);
assert.deepEqual(
  Object.fromEntries([s1.id, s2.id, s3.id].map((id) => [id, pierreDeck.cards.filter((card) => card.skillId === id).length])),
  { pierre_sukseong: 3, pierre_mise_en_place: 2, pierre_maridaje: 1 },
);
const withEvolution = deck.buildDeckDefinition([s1, s2, s3, evolved], { capacity: 6, requireFull: true });
assert.deepEqual(withEvolution.excludedSkillIds, ['pierre_maridaje_perfecto']);
assert.equal(withEvolution.cardCount, 6);

globalThis.CombatEngine = {
  triggerEvent() { return null; },
  triggerEncounterStart() { return 'COMBAT_ACTIVE'; },
  resolveClash(unitA, skillA, unitB, skillB) { return { skillA: skillA.id, skillB: skillB.id }; },
  resolveUnilateralWithCounter(attacker, skill) { return { skillId: skill.id }; },
  calculateCoinDamage() { return 100; },
};

await import('../js/player-skill-runtime-pierre.js');
const runtime = globalThis.LuminousPierrePlayerSkillRuntime;
assert.ok(runtime);
assert.equal(globalThis.CombatEngine.__pierrePlayerSkillRuntime074, true);

const pierre = {
  hp: 100,
  characterBuild: { signatureSkillCharacterId: 'pierre_careme_kikunae' },
  statusEffects: {},
};
const target = { hp: 100, statusEffects: {} };

runtime.handleSkillTrigger('[On Hit]', { attacker: pierre, defender: target, skill: s1, currentCoin: s1.coins[0] });
assert.equal(target.statusEffects.rupture.potency, 2);

runtime.handleSkillTrigger('[Heads Hit]', { attacker: pierre, defender: target, skill: s1, currentCoin: s1.coins[1] });
assert.equal(target.statusEffects.rupture.count, 1);
assert.equal(pierre.statusEffects.haste.count, 1);

runtime.handleSkillTrigger('[Heads Hit]', { attacker: pierre, defender: target, skill: s2, currentCoin: s2.coins[0] });
assert.equal(pierre.statusEffects.poise.count, 2);
runtime.handleSkillTrigger('[On Hit]', { attacker: pierre, defender: target, skill: s2, currentCoin: s2.coins[1] });
assert.equal(target.statusEffects.bleed.potency, 2);
runtime.handleSkillTrigger('[Heads Hit]', { attacker: pierre, defender: target, skill: s2, currentCoin: s2.coins[2] });
assert.equal(target.statusEffects.bleed.count, 1);
runtime.handleSkillTrigger('[On Crit]', { attacker: pierre, defender: target, skill: s2, currentCoin: s2.coins[2] });
assert.equal(pierre.statusEffects.poise.potency, 1);

runtime.resetEncounter(pierre);
assert.equal(runtime.chefPassionReady(pierre), false);
globalThis.CombatEngine.triggerEvent('[On Use]', { attacker: pierre, defender: target, skill: s1 }, [target]);
assert.deepEqual(runtime.usedSins(pierre), ['sloth']);
assert.equal(runtime.chefPassionReady(pierre), false);
globalThis.CombatEngine.triggerEvent('[On Use]', { attacker: pierre, defender: target, skill: s2 }, [target]);
assert.equal(runtime.chefPassionReady(pierre), true);
assert.deepEqual(new Set(runtime.usedSins(pierre)), new Set(['sloth', 'pride']));

const evolvedSkill = runtime.evolveSkillForUnit(pierre, s3);
assert.equal(evolvedSkill.id, 'pierre_maridaje_perfecto');
assert.equal(evolvedSkill.metadata.evolvedFromSkillId, 'pierre_maridaje');

const unilateral = globalThis.CombatEngine.resolveUnilateralWithCounter(pierre, s3, target, null, {});
assert.equal(unilateral.skillId, 'pierre_maridaje_perfecto');

const normalBleedDamage = globalThis.CombatEngine.calculateCoinDamage(
  pierre,
  { statusEffects: { bleed: { potency: 1, count: 1 } } },
  s3,
  10,
  false,
  0,
  { skill: s3, currentCoin: s3.coins[1] },
);
assert.equal(normalBleedDamage, 110);

const normalBothDamage = globalThis.CombatEngine.calculateCoinDamage(
  pierre,
  { statusEffects: { bleed: { potency: 1 }, rupture: { potency: 1 } } },
  s3,
  10,
  false,
  0,
  { skill: s3, currentCoin: s3.coins[3] },
);
assert.equal(normalBothDamage, 110);

const evolvedHeadsContext = { skill: evolved, currentCoin: evolved.coins[0], __pierreCurrentCoinHeads: true };
assert.equal(
  globalThis.CombatEngine.calculateCoinDamage(
    pierre,
    { statusEffects: { bleed: { potency: 1 } } },
    evolved,
    10,
    false,
    0,
    evolvedHeadsContext,
  ),
  110,
);
assert.equal(
  globalThis.CombatEngine.calculateCoinDamage(
    pierre,
    { statusEffects: { bleed: { potency: 1 } } },
    evolved,
    10,
    false,
    0,
    { ...evolvedHeadsContext, __pierreCurrentCoinHeads: false },
  ),
  100,
);

const evolvedBothTarget = { statusEffects: { bleed: { potency: 1, count: 1 }, rupture: { potency: 1, count: 1 } } };
assert.equal(
  globalThis.CombatEngine.calculateCoinDamage(
    pierre,
    evolvedBothTarget,
    evolved,
    10,
    false,
    0,
    { skill: evolved, currentCoin: evolved.coins[4], __pierreCurrentCoinHeads: false },
  ),
  120,
);
runtime.handleSkillTrigger('[On Hit]', { attacker: pierre, defender: evolvedBothTarget, skill: evolved, currentCoin: evolved.coins[2] });
runtime.handleSkillTrigger('[On Hit]', { attacker: pierre, defender: evolvedBothTarget, skill: evolved, currentCoin: evolved.coins[3] });
assert.equal(evolvedBothTarget.statusEffects.bleed.count, 2);
assert.equal(evolvedBothTarget.statusEffects.rupture.count, 2);

globalThis.CombatEngine.triggerEncounterStart([pierre]);
assert.deepEqual(runtime.usedSins(pierre), []);
assert.equal(runtime.chefPassionReady(pierre), false);

console.log('Pierre signature skills smoke: OK');
