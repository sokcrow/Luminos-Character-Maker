'use strict';

const assert = require('assert');
require('../js/status-library.js');
require('../js/status-engine.js');
const ammo = require('../js/universal-ranged-ammo-runtime.js');
const goblinRuntime = require('../js/goblin-unit-runtime.js');
const units = require('../js/unit-catalog-goblin.js');

const ids = units.list().map((unit) => unit.id);
assert.deepStrictEqual(ids.sort(), ['goblin', 'goblin_boss']);

const goblin = units.resolve('goblin', { level: 60, rank: 'normal', initializeEncounter: true });
assert.deepStrictEqual(goblin.scores, { str: 8, dex: 15, con: 10, int: 10, wis: 9, cha: 8 });
assert.strictEqual(goblin.maxHp, Math.floor(7 + 60 * 0.21));
assert(goblin.traitIds.includes('goblin_fury_of_small'));
assert(goblin.traitIds.includes('goblin_nimble_escape'));
assert(goblin.traitIds.includes('ammo_arrows'));
assert.strictEqual(ammo.ammoCount(goblin, 'arrows'), 10);
assert.strictEqual(goblin.mechanics.weaponLoadout[0].weaponId, 'scimitar');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].weaponId, 'shortbow');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].ammoType, 'arrows');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].onHitStatusId, 'pierced');
assert.strictEqual(goblin.mechanics.weaponLoadout[1].onHitStatusCount, null);
assert.strictEqual(goblin.metadata.weaponSkillsPendingCanonicalCatalog, true);
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
assert.strictEqual(boss.mechanics.weaponLoadout[1].weaponId, 'javelin');
assert.strictEqual(boss.mechanics.weaponLoadout[1].ammoType, 'javelin');
assert.strictEqual(boss.mechanics.weaponLoadout[1].onHitStatusId, 'pierced');
assert.strictEqual(goblinRuntime.reuseTimes(boss), 5);

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

const ally = { id: 'ally-goblin', species: 'goblin', faction: 'enemy', hp: 10, deploymentState: 'field' };
const backup = { id: 'backup-goblin', species: 'goblin', faction: 'enemy', hp: 10, deploymentState: 'backup' };
assert.strictEqual(goblinRuntime.selectRedirectTarget(boss, [boss, backup, ally]), ally);
boss.__goblinRedirectUsedThisTurn = true;
assert.strictEqual(goblinRuntime.selectRedirectTarget(boss, [boss, ally]), null);
goblinRuntime.onTurnStart(boss);
assert.strictEqual(goblinRuntime.selectRedirectTarget(boss, [boss, ally]), ally);

console.log('Goblin Unit Library smoke OK');
