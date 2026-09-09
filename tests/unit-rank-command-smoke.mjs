import assert from 'node:assert/strict';

await import('../js/unit-rank-runtime.js');
const rank = globalThis.LuminousUnitRankRuntime;
if (!rank) throw new Error('LuminousUnitRankRuntime was not initialized.');

assert.equal(rank.version, '1.1.0');
assert.equal(rank.BACKUP_COMMAND_SP_MULTIPLIER, 0.5);
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

// A dead Leader stops commanding; the living Captain takes over.
field[2].hp = 0;
field[0].sp = field[1].sp = 0;
const captainRecovery = rank.applyTurnEndSpRecovery(field);
assert.equal(captainRecovery.factions.enemy.rank, 'captain');
assert.equal(field[0].sp, 5);
assert.equal(field[1].sp, 5);
assert.equal(field[2].sp, 10);

// Respect a combatant's explicit SP cap when it exists.
const capped = [
  { id: 'captain', faction: 'enemy', rank: 'captain', hp: 10, maxHp: 10, sp: 8, maxSp: 10 },
  { id: 'trooper', faction: 'enemy', hp: 10, maxHp: 10, sp: 9, maxSp: 10 },
];
rank.applyTurnEndSpRecovery(capped);
assert.equal(capped[0].sp, 10);
assert.equal(capped[1].sp, 10);

// Normal Units preserve the legacy random enemy targeting behavior.
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

// Captain coordinates focus fire onto the most vulnerable target.
const combatDataCaptain = JSON.parse(JSON.stringify(combatDataNormal));
combatDataCaptain.e1.rank = 'captain';
const captainTargets = {};
const captainPlan = rank.assignTargetSlots({ attackSlots, targetSlots, combatData: combatDataCaptain, slotTargets: captainTargets });
assert.equal(captainPlan.command.rank, 'captain');
assert.deepEqual(new Set(Object.values(captainTargets).map(id => id.split('_slot_')[0])), new Set(['a2']));

// Leader keeps vulnerability first and resolves equal vulnerability by highest threat.
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

// AI command comes only from FIELD. Backup commanders instead provide half SP support.
const encounter = {
  allies: { active: [{ unit: { id: 'ally', faction: 'ally', rank: 'normal', hp: 10, sp: 0 } }], backups: [{ unit: { id: 'ally_leader_backup', faction: 'ally', rank: 'leader', hp: 10, sp: 0 } }] },
  enemies: { active: [{ unit: { id: 'enemy', faction: 'enemy', rank: 'captain', hp: 10, sp: 0 } }], backups: [{ unit: { id: 'enemy_leader_backup', faction: 'enemy', rank: 'leader', hp: 10, sp: 0 } }] },
};
const encounterCommand = rank.encounterCommandContext(encounter);
assert.equal(encounterCommand.allies.rank, 'normal');
assert.equal(encounterCommand.enemies.rank, 'captain');

const encounterRecovery = rank.applyEncounterTurnEndSpRecovery(encounter);
assert.equal(encounter.allies.active[0].unit.sp, 5, 'backup Leader grants half of +10 SP');
assert.equal(encounter.allies.backups[0].unit.sp, 0, 'backup Units do not receive the recovery');
assert.equal(encounterRecovery.factions.ally.rank, 'leader');
assert.equal(encounterRecovery.factions.ally.sourceDeployment, 'backup');
assert.equal(encounterRecovery.factions.ally.turnEndSpRecovery, 5);
assert.equal(encounter.enemies.active[0].unit.sp, 5, 'FIELD Captain ties backup Leader at 5 and wins by deployment priority');
assert.equal(encounterRecovery.factions.enemy.rank, 'captain');
assert.equal(encounterRecovery.factions.enemy.sourceDeployment, 'field');

const backupCaptainEncounter = {
  enemies: {
    active: [{ unit: { id: 'trooper', faction: 'enemy', rank: 'normal', hp: 10, sp: 0 } }],
    backups: [{ unit: { id: 'captain_backup', faction: 'enemy', rank: 'captain', hp: 10, sp: 0 } }],
  },
};
const backupCaptainRecovery = rank.applyEncounterTurnEndSpRecovery(backupCaptainEncounter);
assert.equal(backupCaptainEncounter.enemies.active[0].unit.sp, 2.5, 'backup Captain grants half of +5 SP');
assert.equal(backupCaptainEncounter.enemies.backups[0].unit.sp, 0);
assert.equal(backupCaptainRecovery.factions.enemy.turnEndSpRecovery, 2.5);
assert.equal(backupCaptainRecovery.factions.enemy.sourceDeployment, 'backup');

// Team Economy passes FIELD command context to the AI planner and resolves the best SP aura at Turn End.
await import('../js/team-action-economy.js');
globalThis.LuminousActionEconomy = {
  beginPlanning() {},
  beginCombat() {},
};
await import('../js/combat-team-economy-bridge.js');
const bridge = globalThis.LuminousCombatTeamEconomyBridge;
const engine = { currentState: 'COMBAT_ACTIVE' };
assert.equal(bridge.install(engine).installed, true);
const activeCaptain = { id: 'bridge_captain', faction: 'enemy', rank: 'captain', hp: 20, maxHp: 20, sp: 0, initialActionSlots: 1, maxActionSlots: 1 };
const activeTrooper = { id: 'bridge_trooper', faction: 'enemy', rank: 'normal', hp: 20, maxHp: 20, sp: 0, initialActionSlots: 1, maxActionSlots: 1 };
const backupLeader = { id: 'bridge_leader_backup', faction: 'enemy', rank: 'leader', hp: 20, maxHp: 20, sp: 0, initialActionSlots: 1, maxActionSlots: 1 };
const activeAlly = { id: 'bridge_ally', faction: 'ally', rank: 'normal', hp: 20, maxHp: 20, sp: 0, initialActionSlots: 1, maxActionSlots: 1 };
engine.createTeamEconomyEncounter({ allies: [activeAlly], enemies: [activeCaptain, activeTrooper], enemyBackups: [backupLeader] });
let plannerCommand = null;
const ready = engine.markPlayerPlanningReady({
  aiPlanner: (_encounter, commandContext) => {
    plannerCommand = commandContext;
    return { planned: true };
  },
});
assert.equal(ready.aiResult.planned, true);
assert.equal(plannerCommand.enemies.rank, 'captain');
assert.equal(plannerCommand.enemies.aiCoordination, 'focus_fire');
assert.equal(engine.getTeamCommandContext().enemies.rank, 'captain');
assert.equal(engine.beginTeamTurnEnd().started, true);
const ended = engine.endTeamRound();
assert.equal(ended.ended, true);
assert.equal(ended.commandRecovery.factions.enemy.rank, 'captain');
assert.equal(ended.commandRecovery.factions.enemy.sourceDeployment, 'field');
assert.equal(activeCaptain.sp, 5);
assert.equal(activeTrooper.sp, 5);
assert.equal(backupLeader.sp, 0);
assert.equal(activeAlly.sp, 0);

console.log('universal unit rank command smoke: OK');
