import assert from 'node:assert/strict';

await import('../js/unit-rank-runtime.js');
const rank = globalThis.LuminousUnitRankRuntime;
if (!rank) throw new Error('LuminousUnitRankRuntime was not initialized.');

assert.equal(rank.RANKS.normal.levelMultiplier, 1);
assert.equal(rank.RANKS.captain.levelMultiplier, 2);
assert.equal(rank.RANKS.leader.levelMultiplier, 3);
assert.equal(rank.RANKS.captain.turnEndSpRecovery, 5);
assert.equal(rank.RANKS.leader.turnEndSpRecovery, 10);
assert.equal(rank.RANKS.captain.maxSpeedBonus, 1);
assert.equal(rank.RANKS.leader.minSpeedBonus, 1);
assert.equal(rank.RANKS.leader.maxSpeedBonus, 2);
assert.equal(rank.RANKS.leader.applyBonus, 2);
assert.equal(rank.RANKS.leader.basePowerBonus, 1);

assert.equal(rank.effectiveLevel(3, 'captain'), 6);
assert.equal(rank.effectiveLevel(3, 'leader'), 9);

const field = [
  { id: 'enemy_normal', faction: 'enemy', rank: 'normal', hp: 10, maxHp: 10, sp: 0 },
  { id: 'enemy_captain', faction: 'enemy', rank: 'captain', hp: 10, maxHp: 10, sp: 0 },
  { id: 'enemy_leader', faction: 'enemy', rank: 'leader', hp: 10, maxHp: 10, sp: 0 },
  { id: 'ally_player', faction: 'ally', hp: 10, maxHp: 10, sp: 7 },
];
const command = rank.commandProfile(field.filter(unit => unit.faction === 'enemy'));
assert.equal(command.rank, 'leader');
assert.equal(command.commandLevel, 2);
assert.equal(command.turnEndSpRecovery, 10);

const recovery = rank.applyTurnEndSpRecovery(field);
assert.equal(field[0].sp, 10);
assert.equal(field[1].sp, 10);
assert.equal(field[2].sp, 10);
assert.equal(field[3].sp, 7);
assert.equal(recovery.recoveries.filter(entry => entry.faction === 'enemy').length, 3);
assert.equal(recovery.factions.enemy.turnEndSpRecovery, 10);

field[2].hp = 0;
field[0].sp = field[1].sp = 0;
const captainRecovery = rank.applyTurnEndSpRecovery(field);
assert.equal(captainRecovery.factions.enemy.rank, 'captain');
assert.equal(field[0].sp, 5);
assert.equal(field[1].sp, 5);
assert.equal(field[2].sp, 10);

const capped = [
  { id: 'captain', faction: 'enemy', rank: 'captain', hp: 10, maxHp: 10, sp: 8, maxSp: 10 },
  { id: 'trooper', faction: 'enemy', hp: 10, maxHp: 10, sp: 9, maxSp: 10 },
];
rank.applyTurnEndSpRecovery(capped);
assert.equal(capped[0].sp, 10);
assert.equal(capped[1].sp, 10);

const combatDataNormal = {
  e1: { id: 'e1', faction: 'enemy', rank: 'normal', hp: 10, maxHp: 10 },
  e2: { id: 'e2', faction: 'enemy', rank: 'normal', hp: 10, maxHp: 10 },
  a1: { id: 'a1', faction: 'ally', hp: 100, maxHp: 100, speed: 3, actionSlots: 1 },
  a2: { id: 'a2', faction: 'ally', hp: 20, maxHp: 100, speed: 8, actionSlots: 2 },
};
const attackSlots = [{ id: 'e1_slot_0' }, { id: 'e2_slot_0' }];
const targetSlots = [{ id: 'a1_slot_0' }, { id: 'a2_slot_0' }, { id: 'a2_slot_1' }];
const normalTargets = {};
const rolls = [0, 0.99];
let rollIndex = 0;
const normalPlan = rank.assignTargetSlots({
  attackSlots,
  targetSlots,
  combatData: combatDataNormal,
  slotTargets: normalTargets,
  random: () => rolls[rollIndex++],
});
assert.equal(normalPlan.command.rank, 'normal');
assert.equal(normalTargets.e1_slot_0, 'a1_slot_0');
assert.equal(normalTargets.e2_slot_0, 'a2_slot_1');

const combatDataCaptain = JSON.parse(JSON.stringify(combatDataNormal));
combatDataCaptain.e1.rank = 'captain';
const captainTargets = {};
const captainPlan = rank.assignTargetSlots({ attackSlots, targetSlots, combatData: combatDataCaptain, slotTargets: captainTargets });
assert.equal(captainPlan.command.rank, 'captain');
assert.deepEqual(new Set(Object.values(captainTargets).map(id => id.split('_slot_')[0])), new Set(['a2']));

const leaderData = {
  e1: { id: 'e1', faction: 'enemy', rank: 'leader', hp: 10, maxHp: 10 },
  e2: { id: 'e2', faction: 'enemy', rank: 'normal', hp: 10, maxHp: 10 },
  a1: { id: 'a1', faction: 'ally', hp: 50, maxHp: 100, speed: 2, actionSlots: 1 },
  a2: { id: 'a2', faction: 'ally', hp: 50, maxHp: 100, speed: 9, actionSlots: 2 },
};
const leaderTargetSlots = [{ id: 'a1_slot_0' }, { id: 'a2_slot_0' }, { id: 'a2_slot_1' }];
const leaderTargets = {};
const leaderPlan = rank.assignTargetSlots({ attackSlots, targetSlots: leaderTargetSlots, combatData: leaderData, slotTargets: leaderTargets });
assert.equal(leaderPlan.command.rank, 'leader');
assert.deepEqual(new Set(Object.values(leaderTargets).map(id => id.split('_slot_')[0])), new Set(['a2']));

const encounter = {
  allies: { active: [{ unit: { id: 'ally', faction: 'ally', rank: 'normal', hp: 10, sp: 0 } }], backups: [{ unit: { id: 'ally_leader_backup', faction: 'ally', rank: 'leader', hp: 10, sp: 0 } }] },
  enemies: { active: [{ unit: { id: 'enemy', faction: 'enemy', rank: 'captain', hp: 10, sp: 0 } }], backups: [{ unit: { id: 'enemy_leader_backup', faction: 'enemy', rank: 'leader', hp: 10, sp: 0 } }] },
};
const encounterCommand = rank.encounterCommandContext(encounter);
assert.equal(encounterCommand.allies.rank, 'normal');
assert.equal(encounterCommand.enemies.rank, 'captain');

console.log('universal unit rank command smoke: OK');
