import assert from 'node:assert/strict';

await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/unit-catalog-kobold-tier1.js');

const skills = globalThis.LuminousKoboldTier1SkillCatalog;
const units = globalThis.LuminousKoboldUnitCatalog;
if (!skills || !units) throw new Error('Kobold catalogs did not initialize.');

assert.equal(units.list().length, 2);
assert.equal(skills.list().length, 6);

const dagger = units.get('kobold_dagger');
const sling = units.get('kobold_sling');
assert.equal(dagger.visual.spriteUrl, 'https://imgur.com/2BBvM2s.png');
assert.equal(sling.visual.spriteUrl, 'https://imgur.com/ndB257N.png');
assert.deepEqual(dagger.scores, { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 });
assert.equal(dagger.proficiencies.savingThrows.dex, 'proficient');
assert.equal(dagger.proficiencies.skills.stealth, 'proficient');
assert.deepEqual(dagger.staggerThresholds, [75, 50, 25]);
assert.equal(dagger.traits[0].id, 'kobold_pack_tactics');
assert.equal(dagger.traits[0].clashPower, 1);
assert.equal(dagger.mechanics.actionSlots, 1);
assert.equal(dagger.mechanics.maxSlotsLimit, 1);
assert.equal(dagger.mechanics.sp, 0);

for (const skill of skills.list()) {
  const power = skills.finalPower(skill);
  assert.ok(power >= 10 && power <= 12, `${skill.id} Tier 1 final power must be 10-12, got ${power}`);
}
assert.equal(skills.finalPower('kobold_dagger_jab'), 11);
assert.equal(skills.finalPower('kobold_desperate_stab'), 10);
assert.equal(skills.finalPower('kobold_sling_shot'), 10);
assert.equal(skills.finalPower('kobold_rapid_pebble'), 10);

const normalDagger1 = units.resolve('kobold_dagger', { baseLevel: 1, rank: 'normal' });
const normalDagger3 = units.resolve('kobold_dagger', { baseLevel: 3, rank: 'normal' });
const captainDagger2 = units.resolve('kobold_dagger', { baseLevel: 2, rank: 'captain' });
const leaderDagger3 = units.resolve('kobold_dagger', { baseLevel: 3, rank: 'leader' });
assert.equal(normalDagger1.mechanics.hp, 25);
assert.equal(normalDagger3.mechanics.hp, 27);
assert.equal(captainDagger2.effectiveLevel, 4);
assert.equal(captainDagger2.mechanics.hp, 35);
assert.equal(captainDagger2.mechanics.speed, '3-6');
assert.equal(leaderDagger3.effectiveLevel, 9);
assert.equal(leaderDagger3.mechanics.hp, 49);
assert.equal(leaderDagger3.mechanics.speed, '4-7');

const captainSling = units.resolve('kobold_sling', { baseLevel: 1, rank: 'captain' });
const leaderSling = units.resolve('kobold_sling', { baseLevel: 1, rank: 'leader' });
assert.equal(captainSling.mechanics.speed, '2-5');
assert.equal(leaderSling.mechanics.speed, '3-6');

const normalJab = units.resolveSkill('kobold_dagger_jab', 'normal');
const captainJab = units.resolveSkill('kobold_dagger_jab', 'captain');
const leaderJab = units.resolveSkill('kobold_dagger_jab', 'leader');
assert.equal(normalJab.coins[0].effects[0].status, 'bleed');
assert.equal(normalJab.coins[0].effects[0].count, 2);
assert.equal(captainJab.coins[0].effects[0].count, 3);
assert.equal(leaderJab.coins[0].effects[0].count, 4);
assert.equal(skills.finalPower(leaderJab), 12);

const normalRapid = units.resolveSkill('kobold_rapid_pebble', 'normal');
const captainRapid = units.resolveSkill('kobold_rapid_pebble', 'captain');
const leaderRapid = units.resolveSkill('kobold_rapid_pebble', 'leader');
assert.equal(normalRapid.coins[1].effects[0].status, 'tremor');
assert.equal(normalRapid.coins[1].effects[0].count, 3);
assert.equal(captainRapid.coins[1].effects[0].count, 4);
assert.equal(leaderRapid.coins[1].effects[0].count, 5);
assert.equal(skills.finalPower(leaderRapid), 11);

assert.deepEqual(Object.keys(units.firebasePayload()).sort(), ['kobold_dagger', 'kobold_sling']);
assert.equal(Object.keys(units.firebaseSkillPayload()).length, 6);
assert.throws(() => units.resolve('kobold_dagger', { baseLevel: 4, rank: 'normal' }), /BASE_LEVEL_OUT_OF_RANGE/);
assert.throws(() => units.resolve('kobold_dagger', { baseLevel: 1, rank: 'elite' }), /UNKNOWN_UNIT_RANK/);

console.log('kobold unit library smoke: ok');
