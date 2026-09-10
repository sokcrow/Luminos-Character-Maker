import assert from 'node:assert/strict';

await import('../js/status-engine.js');
await import('../js/status-library.js');
await import('../js/universal-action-economy.js');
await import('../js/unit-rank-runtime.js');
await import('../js/skill-catalog-wolf.js');
await import('../js/wolf-unit-runtime.js');
await import('../js/unit-catalog-wolf.js');

const skills = globalThis.LuminousWolfSkillCatalog;
const runtime = globalThis.LuminousWolfUnitRuntime;
const units = globalThis.LuminousWolfUnitCatalog;
const statuses = globalThis.LuminousStatusEngine;
const economy = globalThis.LuminousActionEconomy;
if (!skills || !runtime || !units || !statuses || !economy) throw new Error('Wolf batch runtimes did not initialize.');

assert.deepEqual(Object.keys(units.firebasePayload()).sort(), ['dire_wolf', 'wolf']);
assert.equal(skills.list().length, 8);

const wolf = units.get('wolf');
const dire = units.get('dire_wolf');
assert.equal(wolf.hpBase, 11);
assert.deepEqual(wolf.naturalWorldLevel, { min: 2, max: 4 });
assert.equal(wolf.visual.spriteUrl, 'https://imgur.com/W6efoaJ.png');
assert.deepEqual(wolf.allowedRanks, ['normal', 'captain']);
assert.ok(wolf.traitIds.includes('pack_tactics'));
assert.ok(wolf.traitIds.includes('wolf_meaning'));
assert.ok(wolf.traitIds.includes('hunting_howling'));
assert.equal(wolf.mechanics.huntingHowling.requiredRank, 'captain');
assert.equal(wolf.mechanics.huntingHowling.backupAmount, 3);
assert.equal(wolf.mechanics.huntingHowling.backupOncePerEncounter, true);

assert.equal(dire.hpBase, 37);
assert.deepEqual(dire.naturalWorldLevel, { min: 5, max: 5 });
assert.equal(dire.visual.spriteUrl, 'https://imgur.com/sqbDc2B.png');
assert.deepEqual(dire.allowedRanks, ['normal', 'leader']);
assert.equal(dire.mechanics.huntingHowling.requiredRank, 'leader');

const bite = skills.get('wolf_bite');
assert.equal(bite.basePower, 6);
assert.equal(bite.coinPower, 5);
assert.equal(bite.coinAmount, 1);
assert.equal(bite.damageType, 'perforante');
assert.equal(bite.coins[0].effects[0].status, 'bleed');
assert.equal(bite.coins[0].effects[1].status, 'sinking');
assert.deepEqual(bite.coins[0].effects[1].condition, { target: 'target', stat: 'bleed', component: 'count', operator: '>=', value: 3 });

const gnaw = skills.get('wolf_gnaw');
assert.equal(gnaw.coins[1].effects[0].status, 'sinking');
assert.equal(gnaw.coins[1].effects[1].condition.component, 'count');
assert.equal(gnaw.coins[1].effects[1].condition.stat, 'sinking');

const breakPrey = skills.get('dire_wolf_break_the_prey');
assert.equal(breakPrey.tier, 2);
assert.equal(breakPrey.basePower + breakPrey.coinPower * breakPrey.coinAmount, 18);
assert.equal(breakPrey.metadata.wolfFinalPowerIf.bonus, 1);
assert.equal(breakPrey.metadata.wolfFinalPowerIf.all.length, 2);

const target = { id: 'target', hp: 50, maxHp: 50, sp: 0, statusEffects: {} };
statuses.applyStatus(target, 'bleed', { mode: 'set', potency: 1, count: 1 });
runtime.applyManagedSkillEffects('[On Hit]', { attacker: { id: 'wolf_a' }, defender: target, currentTarget: target, skill: bite, currentCoin: bite.coins[0] }, [target]);
assert.equal(statuses.getStatus(target, 'bleed').count, 3);
assert.equal(statuses.getStatus(target, 'bleed').potency, 2);
assert.equal(statuses.getStatus(target, 'sinking').count, 2, 'Bite should cross the 3+ Bleed Count threshold on the same hit.');

statuses.applyStatus(target, 'bleed', { mode: 'set', potency: 2, count: 4 });
statuses.applyStatus(target, 'sinking', { mode: 'set', potency: 2, count: 4 });
const prepared = runtime.prepareConditionalSkill(breakPrey, target);
assert.equal(prepared.metadata.wolfConditionalFinalPowerActive, true);
assert.equal(prepared.metadata.wolfConditionalFinalPowerBonus, 1);

assert.equal(runtime.canTarget({ sp: -1 }, wolf).allowed, false);
assert.equal(runtime.canTarget({ sp: 0 }, wolf).allowed, true);
assert.equal(runtime.canTarget({ sp: -10 }, { id: 'goblin', species: 'goblin' }).allowed, true);

const normalWolf = units.resolve('wolf', { level: 2, rank: 'normal' });
const captain = units.resolve('wolf', { level: 2, rank: 'captain' });
const allyWolf = units.resolve('wolf', { level: 2, rank: 'normal' });
const leader = units.resolve('dire_wolf', { level: 5, rank: 'leader' });
normalWolf.sp = 0;
captain.sp = -5;
allyWolf.sp = -10;
leader.sp = 0;
assert.equal(runtime.canUseHuntingHowling(normalWolf, { phase: 'planning' }).allowed, false);

economy.beginPlanning(captain);
const encounterState = {};
const reserves = {};
const howl1 = runtime.useHuntingHowling(captain, { phase: 'planning', deployedUnits: [captain, allyWolf], encounterState, reserves });
assert.equal(howl1.used, true);
assert.equal(captain.sp, 0);
assert.equal(allyWolf.sp, -5);
assert.equal(statuses.getStatus(captain, 'attack_power_up').count, 1);
assert.equal(statuses.getStatus(allyWolf, 'attack_power_up').count, 1);
assert.equal(Object.keys(reserves).length, 3);
assert.ok(Object.values(reserves).every((entry) => entry.catalogId === 'wolf' && entry.isBackup === true && entry.rank === 'normal'));

// New turn: Howling remains usable, but the encounter cannot create another +3 backups.
economy.beginPlanning(captain);
const howl2 = runtime.useHuntingHowling(captain, { phase: 'planning', deployedUnits: [captain, allyWolf], encounterState, reserves });
assert.equal(howl2.used, true);
assert.equal(howl2.backup.alreadyUsed, true);
assert.equal(Object.keys(reserves).length, 3);

// Dire Wolf gains the same Quick Action only at Leader rank.
economy.beginPlanning(leader);
assert.equal(runtime.canUseHuntingHowling(leader, { phase: 'planning' }).allowed, true);

console.log('wolf unit library smoke: ok');
