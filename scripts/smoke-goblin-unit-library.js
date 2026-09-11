import assert from 'node:assert/strict';

await import('../js/status-library.js');
await import('../js/status-engine.js');
await import('../js/combat-skill-schema.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/goblin-unit-runtime.js');
await import('../js/skill-catalog-goblin-tier1.js');
await import('../js/unit-rank-runtime.js');
await import('../js/unit-catalog-goblin.js');

const schema = globalThis.CombatSkillSchema;
const ammo = globalThis.LuminousUniversalRangedAmmoRuntime;
const goblinRuntime = globalThis.LuminousGoblinUnitRuntime;
const skills = globalThis.LuminousGoblinTier1SkillCatalog;
const units = globalThis.LuminousGoblinUnitCatalog;

if (!schema || !ammo || !goblinRuntime || !skills || !units) {
  throw new Error('Goblin Unit Library smoke dependencies were not initialized.');
}

const ids = units.list().map((unit) => unit.id);
assert.deepStrictEqual(ids.sort(), ['goblin', 'goblin_boss']);
assert.deepStrictEqual(skills.list().map((skill) => skill.id).sort(), ['goblin_javelin_throw', 'goblin_scimitar_slash', 'goblin_shortbow_shot']);
skills.list().forEach((skill) => {
  const validation = schema.validateCombatSkill(skill);
  assert.strictEqual(validation.valid, true, `${skill.id}: ${validation.errors.join(' · ')}`);
  assert.strictEqual(skill.isClashable, true);
  assert.strictEqual(skill.isUnclashable, false);
});

const scimitar = skills.get('goblin_scimitar_slash');
assert.strictEqual(scimitar.coinAmount, 2, 'Scimitar must remain Multi Attack eligible for Goblin Boss');
assert.strictEqual(scimitar.skillRange, 1);

const shortbow = skills.get('goblin_shortbow_shot');
assert.deepStrictEqual(shortbow.resourceCosts, [{ owner: 'source', type: 'ammunition', id: 'arrows', amount: 1, timing: 'on_user' }]);
assert(shortbow.coins[0].effects.some((effect) => effect.status === 'pierced' && effect.count === 1));
assert.strictEqual(shortbow.metadata.goblinRuntimeManagedStatusEffects, true);

const javelin = skills.get('goblin_javelin_throw');
assert.deepStrictEqual(javelin.resourceCosts, [{ owner: 'source', type: 'ammunition', id: 'javelin', amount: 1, timing: 'on_user' }]);
assert(javelin.coins[0].effects.some((effect) => effect.status === 'pierced' && effect.count === 1));
assert.strictEqual(javelin.metadata.goblinRuntimeManagedStatusEffects, true);

const goblin = units.resolve('goblin', { level: 60, rank: 'normal', initializeEncounter: true });
assert.deepStrictEqual(goblin.scores, { str: 8, dex: 15, con: 10, int: 10, wis: 9, cha: 8 });
assert.strictEqual(goblin.maxHp, Math.floor(7 + 60 * 0.21));
assert(goblin.traitIds.includes('goblin_fury_of_small'));
assert(goblin.traitIds.includes('goblin_nimble_escape'));
assert(goblin.traitIds.includes('ammo_arrows'));
assert.strictEqual(ammo.ammoCount(goblin, 'arrows'), 10);
assert.deepStrictEqual(goblin.action_slots, ['goblin_scimitar_slash', 'goblin_shortbow_shot']);
assert.deepStrictEqual(goblin.resolvedSkills.map((skill) => skill.id), goblin.action_slots);
assert.strictEqual(goblin.mechanics.weaponLoadout[0].weaponId, 'scimitar');
assert.strictEqual(goblin.mechanics.weaponLoadout[0].skillId, 'goblin_scimitar_slash');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].weaponId, 'shortbow');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].skillId, 'goblin_shortbow_shot');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].ammoType, 'arrows');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].onHitStatusId, 'pierced');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].onHitStatusCount, 1);
assert.strictEqual(goblin.metadata.weaponSkillsPendingCanonicalCatalog, false);
assert.deepStrictEqual(goblin.mechanics.build, ['pierced', 'bind', 'bleed']);
assert.strictEqual(goblin.metadata.spritePending, true);

const boss = units.resolve('goblin_boss', { level: 60, rank: 'captain', initializeEncounter: true });
assert.deepStrictEqual(boss.scores, { str: 10, dex: 16, con: 12, int: 11, wis: 10, cha: 12 });
assert.strictEqual(boss.effectiveLevel, 120);
assert.strictEqual(boss.maxHp, Math.floor(21 + 120 * 0.24));
assert.deepStrictEqual(boss.allowedRanks, ['captain']);
assert.throws(() => units.resolve('goblin_boss', { level: 60, rank: 'normal' }), /UNIT_RANK_NOT_ALLOWED/);
assert(boss.traitIds.includes('goblin_multi_attack'));
assert(boss.traitIds.includes('goblin_redirect_attack'));
assert(boss.traitIds.includes('ammo_javelin'));
assert.strictEqual(ammo.ammoCount(boss, 'javelin'), 6);
assert.deepStrictEqual(boss.action_slots, ['goblin_scimitar_slash', 'goblin_javelin_throw']);
assert.deepStrictEqual(boss.resolvedSkills.map((skill) => skill.id), boss.action_slots);
assert.strictEqual(boss.mechanics.weaponLoadout[1].weaponId, 'javelin');
assert.strictEqual(boss.mechanics.weaponLoadout[1].skillId, 'goblin_javelin_throw');
assert.strictEqual(boss.mechanics.weaponLoadout[1].ammoType, 'javelin');
assert.strictEqual(boss.mechanics.weaponLoadout[1].onHitStatusId, 'pierced');
assert.strictEqual(boss.mechanics.weaponLoadout[1].onHitStatusCount, 1);
assert.strictEqual(goblinRuntime.reuseTimes(boss), 5);
assert.strictEqual(goblinRuntime.skillCoinCount(boss.resolvedSkills[0]), 2);

const fiveCoinMelee = {
  id: 'test-melee', name: 'Test Melee', skillRange: 1, coinAmount: 5, coinPower: 3, basePower: 4,
  coins: Array.from({ length: 5 }, (_, index) => ({ index, status: 'active', effects: [] })),
};
const prepared = goblinRuntime.prepareMultiAttackSkill(boss, fiveCoinMelee);
assert.strictEqual(prepared.coinAmount, 5);
assert.strictEqual(prepared.coins.length, 5);
prepared.coins.forEach((coin) => assert(coin.effects.some((effect) => effect.type === 'percentage_damage' && effect.potency === 5)));

const fiveCoinRanged = { ...fiveCoinMelee, skillRange: 6, coins: fiveCoinMelee.coins.map((coin) => ({ ...coin, effects: [] })) };
const rangedPrepared = goblinRuntime.prepareMultiAttackSkill(boss, fiveCoinRanged);
rangedPrepared.coins.forEach((coin) => assert.strictEqual(coin.effects.length, 0));

const piercedTarget = { id: 'pierced-target', hp: 30, maxHp: 30, statusEffects: {} };
assert.deepStrictEqual(ammo.applyPierced(piercedTarget, 2), { before: 0, after: 2, bindGain: 0, bleedCountGain: 0 });
const threshold = ammo.applyPierced(piercedTarget, 2);
assert.strictEqual(threshold.before, 2);
assert.strictEqual(threshold.after, 4);
assert.strictEqual(threshold.bindGain, 1);
assert.strictEqual(threshold.bleedCountGain, 1);
assert.strictEqual(ammo.statusCount(piercedTarget, 'bind'), 1);
assert.strictEqual(ammo.statusCount(piercedTarget, 'bleed'), 1);

const ally = { id: 'ally-goblin', species: 'goblin', faction: 'enemy', hp: 10, deploymentState: 'field' };
const backup = { id: 'backup-goblin', species: 'goblin', faction: 'enemy', hp: 10, deploymentState: 'backup' };
assert.strictEqual(goblinRuntime.selectRedirectTarget(boss, [boss, backup, ally]), ally);
boss.__goblinRedirectUsedThisTurn = true;
assert.strictEqual(goblinRuntime.selectRedirectTarget(boss, [boss, ally]), null);
goblinRuntime.onTurnStart(boss);
assert.strictEqual(goblinRuntime.selectRedirectTarget(boss, [boss, ally]), ally);

console.log('Goblin Unit Library smoke OK');