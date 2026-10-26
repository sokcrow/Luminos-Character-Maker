import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
await import('../js/status-library.js');
await import('../js/status-engine.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/skill-catalog-player-signature.js');

const catalog = globalThis.LuminousPlayerSignatureSkillCatalog;
const ammo = globalThis.LuminousUniversalRangedAmmoRuntime;
assert.ok(catalog);
assert.ok(ammo);

const id = (name) => `agatha_${name}`;
const highTime = catalog.get(id('onryo_high_time'));
const propShredder = catalog.get(id('onryo_prop_shredder'));
const helmBreaker = catalog.get(id('onryo_helm_breaker'));
const roundTrip = catalog.get(id('onryo_round_trip'));
const stinger = catalog.get(id('onryo_stinger'));
const millionStab = catalog.get(id('onryo_million_stab'));
const drive = catalog.get(id('onryo_drive'));
const aerialRave = catalog.get(id('onryo_aerial_rave'));
const danceMacabre = catalog.get(id('onryo_dance_macabre'));
const overdrive = catalog.get(id('onryo_overdrive'));
const twosomeTime = catalog.get(id('ignovus_twosome_time'));
const chargedShot = catalog.get(id('ignovus_charged_shot'));
const honeycombFire = catalog.get(id('ignovus_honeycomb_fire'));
const rainStorm = catalog.get(id('ignovus_rain_storm'));

assert.deepEqual(
  [highTime.tier, highTime.basePower, highTime.coinPower, highTime.coinAmount, highTime.sinAffinity, highTime.metadata.slotId, highTime.metadata.rawMaxPower],
  [1, 6, 6, 1, 'pride', '1', 12],
);
assert.deepEqual(
  [roundTrip.tier, roundTrip.basePower, roundTrip.coinPower, roundTrip.coinAmount, roundTrip.sinAffinity, roundTrip.metadata.slotId, roundTrip.metadata.rawMaxPower],
  [1, 7, 4, 2, 'envy', '3-1', 15],
);
assert.deepEqual(
  [drive.tier, drive.basePower, drive.coinPower, drive.coinAmount, drive.metadata.slotId, drive.metadata.rawMaxPower],
  [2, 7, 10, 1, '5-1', 17],
);
assert.deepEqual(
  [danceMacabre.tier, danceMacabre.basePower, danceMacabre.coinPower, danceMacabre.coinAmount, danceMacabre.metadata.slotId, danceMacabre.metadata.rawMaxPower],
  [3, 5, 2, 5, '6-1', 15],
);
assert.deepEqual(
  [overdrive.basePower, overdrive.coinPower, overdrive.coinAmount, overdrive.metadata.slotId, overdrive.metadata.rawMaxPower],
  [8, 6, 3, '6-2', 26],
);
assert.equal(overdrive.inDeck, false);
assert.equal(rainStorm.inDeck, false);
assert.equal(overdrive.availability.type, 'off_deck');
assert.equal(rainStorm.availability.type, 'off_deck');

assert.equal(helmBreaker.coins[0].type, 'unbreakable');
assert.equal(drive.coins[0].type, 'unbreakable');
assert.equal(chargedShot.coins[0].type, 'unbreakable');
assert.equal(millionStab.coinAmount, 4, 'Million Stab keeps the declared 4 Coins');
assert.match(millionStab.metadata.mechanics.unresolvedSourceEffectLabel, /no fifth Coin/i);
assert.equal(honeycombFire.coinAmount, 4);
assert.deepEqual(honeycombFire.metadata.mechanics.coin4OnHit, {});

const onryoDeckIds = [
  highTime, propShredder, helmBreaker, roundTrip, stinger, millionStab, drive, aerialRave, danceMacabre,
].map((skill) => skill.id);
assert.equal(onryoDeckIds.length, 9);
assert.equal(new Set(onryoDeckIds).size, 9);
assert.ok(onryoDeckIds.every((skillId) => catalog.get(skillId).metadata.deckCopies === 1));
const ignovusDeckIds = [twosomeTime, chargedShot, honeycombFire].map((skill) => skill.id);
assert.equal(ignovusDeckIds.length, 3);
assert.equal(new Set(ignovusDeckIds).size, 3);
assert.ok(ignovusDeckIds.every((skillId) => catalog.get(skillId).metadata.deckCopies === 1));

globalThis.CombatEngine = {
  triggerEvent() { return null; },
  triggerEncounterStart() { return 'COMBAT_ACTIVE'; },
  resolveClash(unitA, skillA, unitB, skillB) { return { skillA, skillB }; },
  resolveUnilateralWithCounter(attacker, skill, defender, counterSkill) { return { attacker, skill, defender, counterSkill }; },
  applyPassiveModifiers() { return {}; },
  calculateFinalPower(skill, heads) {
    const headCount = Array.isArray(heads) ? heads.filter(Boolean).length : Number(heads || 0);
    return Number(skill.basePower || 0) + (headCount * Number(skill.coinPower || 0));
  },
  calculateCoinDamage() { return 100; },
  getOffensiveLevel() { return 40; },
  modifyNextStaggerThreshold(unit, amount) {
    unit.staggerRaised = Number(unit.staggerRaised || 0) + Number(amount || 0);
  },
  applyDamage(unit, amount) {
    unit.hp = Math.max(0, Number(unit.hp || 0) - Number(amount || 0));
    return { hp: unit.hp };
  },
};

await import('../js/player-skill-runtime-agatha.js');
const runtime = globalThis.LuminousAgathaPlayerSkillRuntime;
assert.ok(runtime);
assert.equal(globalThis.CombatEngine.__agathaPlayerSkillRuntime074, true);

const agatha = {
  characterId: 'agatha',
  hp: 100,
  maxHp: 100,
  speed: 8,
  level: 20,
  stats: { fuerza: 18, destreza: 16 },
  statusEffects: {},
  characterBuild: { skillDeck: { tier1: 'legacy_1', tier2: 'legacy_2', tier3: 'legacy_3' } },
};
const target = { hp: 100, maxHp: 100, speed: 5, statusEffects: {}, staggerThresholds: [70, 40] };

assert.equal(runtime.resetEncounter(agatha, () => 0), 'onryo');
assert.equal(runtime.currentWeapon(agatha), 'onryo');
assert.deepEqual(agatha.skillSlotIds, runtime.WEAPON_ARTS.onryo.skillIds);
assert.equal(agatha.skillSlotIds.length, 9);

let rotation = runtime.recordWeaponSkillUse(agatha, highTime, () => 0);
assert.equal(rotation.changed, false);
rotation = runtime.recordWeaponSkillUse(agatha, propShredder, () => 0);
assert.equal(rotation.changed, true);
assert.equal(runtime.currentWeapon(agatha), 'ignovus');
assert.deepEqual(agatha.skillSlotIds, runtime.WEAPON_ARTS.ignovus.skillIds);
assert.equal(agatha.skillSlotIds.length, 3);

globalThis.LuminousStatusEngine.applyStatus(agatha, 'poise', { mode: 'set', potency: 15, count: 4 });
assert.equal(runtime.evolveSkillForUnit(agatha, target, danceMacabre).id, overdrive.id);

globalThis.LuminousStatusEngine.applyStatus(agatha, 'poise', { mode: 'set', potency: 7, count: 4 });
globalThis.LuminousStatusEngine.applyStatus(target, 'burn', { mode: 'set', potency: 10, count: 3 });
assert.equal(runtime.evolveSkillForUnit(agatha, target, honeycombFire).id, rainStorm.id);

const power = runtime.dynamicPower(agatha, highTime, globalThis.CombatEngine);
assert.equal(power.basePower, 7);
assert.equal(power.coinPower, 8);

globalThis.LuminousStatusEngine.applyStatus(agatha, 'poise', { mode: 'set', potency: 0, count: 0 });
runtime.handleSkillTrigger('[On Use]', { attacker: agatha, defender: target, skill: highTime }, () => 0);
assert.equal(runtime.statusPotency(agatha, 'poise'), 3);
runtime.handleSkillTrigger('[On Hit]', { attacker: agatha, defender: target, skill: highTime, currentCoin: highTime.coins[0] });
assert.equal(runtime.statusCount(agatha, 'poise'), 2);
assert.equal(target.delayed_effects.length, 1);
target.delayed_effects[0].effect.execute();
assert.equal(runtime.statusCount(target, 'bind'), 2);

target.statusEffects = {};
runtime.handleSkillTrigger('[On Hit]', { attacker: agatha, defender: target, skill: propShredder, currentCoin: propShredder.coins[0] });
runtime.handleSkillTrigger('[On Hit]', { attacker: agatha, defender: target, skill: propShredder, currentCoin: propShredder.coins[1] });
runtime.handleSkillTrigger('[On Hit]', { attacker: agatha, defender: target, skill: propShredder, currentCoin: propShredder.coins[2] });
assert.equal(runtime.statusPotency(target, 'bleed'), 3);

target.statusEffects = { tremor: { id: 'tremor', potency: 4, count: 2 } };
runtime.handleSkillTrigger('[On Hit without Cracking]', { attacker: agatha, defender: target, currentTarget: target, skill: helmBreaker, currentCoin: helmBreaker.coins[0], engine: globalThis.CombatEngine });
assert.equal(target.staggerRaised, 4);
assert.equal(runtime.statusCount(target, 'tremor'), 1);

ammo.setAmmo(agatha, 'bullets', 10);
target.statusEffects = {};
runtime.handleSkillTrigger('[On Hit]', { attacker: agatha, defender: target, skill: twosomeTime, currentCoin: twosomeTime.coins[0] });
assert.equal(ammo.ammoCount(agatha, 'bullets'), 9);
assert.equal(runtime.statusPotency(target, 'burn'), 1);
runtime.handleSkillTrigger('[On Hit]', { attacker: agatha, defender: target, skill: twosomeTime, currentCoin: twosomeTime.coins[1] });
assert.equal(ammo.ammoCount(agatha, 'bullets'), 8);
assert.equal(runtime.statusCount(target, 'burn'), 2);

target.statusEffects = { bleed: { id: 'bleed', potency: 10, count: 1 } };
assert.equal(runtime.damageMultiplier(agatha, target, millionStab, false, { skill: millionStab, currentCoin: millionStab.coins[3] }), 1.25);
assert.equal(runtime.damageMultiplier(agatha, target, overdrive, false, { skill: overdrive, currentCoin: overdrive.coins[2] }), 1.5);
assert.equal(runtime.damageMultiplier(agatha, target, drive, false, { skill: drive, currentCoin: drive.coins[0] }), 1.7);

console.log('Agatha signature skills smoke: OK');
