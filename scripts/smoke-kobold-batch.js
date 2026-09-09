'use strict';

const assert = require('assert');
const mechanics = require('../js/unit-combat-mechanics-runtime.js');
const skills = require('../js/skill-catalog-kobold-tier1.js');
const units = require('../js/unit-catalog-kobold-tier1.js');

const ids = units.list().map((unit) => unit.id);
['kobold_dagger', 'kobold_sling', 'winged_kobold', 'dragonheart_kobold', 'scale_sorcerer_kobold'].forEach((id) => assert(ids.includes(id), `missing ${id}`));

const winged = units.resolve('winged_kobold', { level: 60, rank: 'normal', initializeEncounter: true });
assert.strictEqual(winged.mechanics.maxHp, Math.floor(7 + 60 * 0.22));
assert.strictEqual(winged.mechanics.maxSpeed, 7);
assert.strictEqual(mechanics.isFlyingUnit(winged), true);
assert.strictEqual(mechanics.ammunitionCount(winged, 'rock'), 1);

const fallingRock = skills.get('winged_kobold_falling_rock');
assert.strictEqual(fallingRock.save.ability, 'dexterity');
assert.strictEqual(fallingRock.save.dc, 9);
assert.strictEqual(fallingRock.save.onSuccess, 'negates');
assert.strictEqual(fallingRock.save.onFailure, 'unopposed_attack');
assert.strictEqual(fallingRock.basePower, 3);
assert.strictEqual(fallingRock.coinPower, 3);
assert.strictEqual(fallingRock.damageType, 'contundente');
assert.strictEqual(fallingRock.resourceCosts[0].id, 'rock');

const spent = mechanics.consumeSkillAmmunition(winged, fallingRock);
assert.strictEqual(spent.ok, true);
assert.strictEqual(mechanics.ammunitionCount(winged, 'rock'), 0);
mechanics.onComeback(winged);
assert.strictEqual(mechanics.ammunitionCount(winged, 'rock'), 1);

const ground = { id: 'ground' };
const flying = { id: 'flying', mechanics: { flying: true } };
assert.strictEqual(mechanics.flyingTargetRule({ attacker: ground, target: flying, skill: { skillRange: 1 }, resolutionType: 'unopposed' }).allowed, false);
assert.strictEqual(mechanics.flyingTargetRule({ attacker: ground, target: flying, skill: { skillRange: 6 }, resolutionType: 'unopposed' }).allowed, true);
assert.strictEqual(mechanics.flyingClashDamageRule({ attacker: ground, defender: flying, attackerSkill: { skillRange: 1 }, defenderSkill: { skillRange: 6 } }).canDamage, false);
assert.strictEqual(mechanics.flyingClashDamageRule({ attacker: ground, defender: flying, attackerSkill: { skillRange: 1 }, defenderSkill: { skillRange: 1 } }).canDamage, true);

const dragonCaptain = units.resolve('dragonheart_kobold', { level: 60, rank: 'captain' });
assert.strictEqual(dragonCaptain.mechanics.maxHp, Math.floor(44 + 120 * 0.30));
assert.strictEqual(dragonCaptain.defensiveLevel, 123);
assert.throws(() => units.resolve('dragonheart_kobold', { level: 60, rank: 'normal' }), /UNIT_RANK_NOT_ALLOWED/);

const sorcererLeader = units.resolve('scale_sorcerer_kobold', { level: 60, rank: 'leader' });
assert.strictEqual(sorcererLeader.mechanics.maxHp, Math.floor(27 + 180 * 0.25));
assert.strictEqual(sorcererLeader.mechanics.spellcasting.spellSlots[1], 4);
assert.strictEqual(sorcererLeader.mechanics.spellcasting.spellSlots[2], 2);
assert.strictEqual(sorcererLeader.mechanics.sorceryPoints.encounterStart, 3);

console.log('Kobold batch smoke OK');
