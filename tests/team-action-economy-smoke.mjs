import assert from 'node:assert/strict';

await import('../js/team-action-economy.js');
const economy = globalThis.LuminousTeamActionEconomy;
if (!economy?.createEncounter) throw new Error('LuminousTeamActionEconomy was not initialized.');

globalThis.LuminousActionEconomy = {
  beginPlanning(unit) { unit.__planningCount = (unit.__planningCount || 0) + 1; },
  beginCombat(unit) { unit.__combatCount = (unit.__combatCount || 0) + 1; },
};

await import('../js/combat-team-economy-bridge.js');
const bridge = globalThis.LuminousCombatTeamEconomyBridge;

// Allied side: 12 total Actions, distributed by Speed; only the two fastest may reach 3.
const allies = Array.from({ length: 8 }, (_, index) => ({
  id: `ally_${index + 1}`,
  speed: 20 - index,
  initialActionSlots: 1,
  maxActionSlots: 3,
}));

// Special enemy: one Action Slot per opposing slot, but one fewer.
const boss = {
  id: 'boss',
  speed: 10,
  initialActionSlots: 3,
  maxActionSlots: 12,
  slotScaling: { type: 'opponent_relative', offset: -1 },
};

const encounter = economy.createEncounter({ allies, enemies: [boss] });
let snapshot = economy.snapshot(encounter);

assert.equal(snapshot.allies.allocated, 12);
assert.equal(snapshot.enemies.allocated, 11);
assert.equal(snapshot.allies.usable - snapshot.enemies.usable, 1);
assert.equal(snapshot.allies.active.filter((entry) => entry.current === 3).length, 2);
assert.equal(snapshot.allies.active.filter((entry) => entry.current > 3).length, 0);

// Quick Action and Help are team resources, not one per Unit.
assert.equal(economy.consumeQuickAction(encounter, 'allies').consumed, true);
assert.equal(economy.consumeQuickAction(encounter, 'allies').consumed, false);
assert.equal(economy.consumeQuickAction(encounter, 'enemies').consumed, true);
assert.equal(economy.consumeHelp(encounter, 'allies').consumed, true);
assert.equal(economy.consumeHelp(encounter, 'allies').consumed, false);

// Grapple/Stagger-style slot locks reduce usable Actions without redistributing them.
const lock = economy.lockUnitSlots(encounter, 'ally_1', 1, 'grapple');
assert.equal(lock.locked, true);
snapshot = economy.snapshot(encounter);
assert.equal(snapshot.allies.active.find((entry) => entry.id === 'ally_1').statusLocked, 1);

// Retreat/Escape-style effects can live in an On Turn End queue and be cancelled before resolution.
const queued = economy.queueTurnEndAction(encounter, { type: 'escape', unitId: 'ally_2' });
assert.ok(queued.id);
assert.equal(economy.cancelTurnEndActionsForUnit(encounter, 'ally_2', 'grappled'), 1);

// Planning lifecycle: Player Ready -> AI Planning -> Combat -> Turn End -> next Planning.
assert.equal(economy.playerReady(encounter).ready, true);
assert.equal(economy.aiReady(encounter).ready, true);
assert.equal(economy.beginTurnEnd(encounter).started, true);
const ended = economy.endRound(encounter, { escape: () => ({ escaped: true }) });
assert.equal(ended.ended, true);
assert.equal(encounter.round, 2);
assert.equal(encounter.phase, economy.PHASES.PLANNING_PLAYER);
assert.equal(encounter.allies.quickActionRemaining, 1);
assert.equal(encounter.allies.helpRemaining, 1);

// Enemy Action economy grows by at most +1 per round toward individual maxima.
const growthEncounter = economy.createEncounter({
  allies: [{ id: 'player', speed: 10, initialActionSlots: 1, maxActionSlots: 3 }],
  enemies: [
    { id: 'enemy_1', speed: 10, initialActionSlots: 1, maxActionSlots: 2 },
    { id: 'enemy_2', speed: 9, initialActionSlots: 1, maxActionSlots: 3 },
  ],
  enemiesOptions: { roundGrowthEnabled: true },
});
const beforeGrowth = economy.snapshot(growthEncounter).enemies.allocated;
economy.beginNextRound(growthEncounter);
const afterGrowth = economy.snapshot(growthEncounter).enemies.allocated;
assert.equal(afterGrowth, beforeGrowth + 1);

// Vacated slots are held while Backups exist; without Backups only one can be redistributed per round.
const redistributionTeam = economy.createTeam('allies', [
  { id: 'redistribution_unit', speed: 5, initialActionSlots: 1, currentActionSlots: 1, maxActionSlots: 3 },
], [], { roundGrowthEnabled: false });
const redistributionEncounter = {
  allies: redistributionTeam,
  enemies: economy.createTeam('enemies', [{ id: 'enemy', initialActionSlots: 1, maxActionSlots: 1 }], []),
  balanceTolerance: 1,
};
economy.registerVacatedSlots(redistributionEncounter, 'allies', 2, { hasBackup: false });
assert.equal(redistributionTeam.pendingRedistribution, 2);
const redistribution = economy.applyRoundGrowth(redistributionTeam);
assert.ok(redistribution.redistributed);
assert.equal(redistributionTeam.pendingRedistribution, 1);

// Retreat replacement inherits at most two Actions, never a third Action Slot.
const incoming = economy.inheritReplacementSlots(
  redistributionEncounter,
  'allies',
  'missing_outgoing',
  { id: 'backup', speed: 1, initialActionSlots: 1, maxActionSlots: 3 },
  { cap: 2, outgoingSlots: 3 },
);
assert.equal(incoming.currentActionSlots, 2);

// CombatEngine bridge exposes the lifecycle without replacing the legacy engine implementation.
const engine = { currentState: 'COMBAT_ACTIVE' };
assert.equal(bridge.install(engine).installed, true);
const bridgeSnapshot = engine.createTeamEconomyEncounter({
  allies: [
    { id: 'bridge_a', speed: 10, initialActionSlots: 1, maxActionSlots: 3 },
    { id: 'bridge_b', speed: 9, initialActionSlots: 1, maxActionSlots: 3 },
  ],
  enemies: [
    { id: 'bridge_boss', speed: 8, initialActionSlots: 3, maxActionSlots: 6, slotScaling: { type: 'opponent_relative', offset: -1 } },
  ],
});
assert.equal(engine.currentState, 'PRE_COMBAT_PLANNING');
assert.equal(bridgeSnapshot.phase, economy.PHASES.PLANNING_PLAYER);
assert.equal(engine.consumeTeamQuickAction('allies').consumed, true);
const ready = engine.markPlayerPlanningReady({ aiPlanner: () => ({ planned: true }) });
assert.equal(ready.aiResult.planned, true);
assert.equal(engine.currentState, 'COMBAT_ACTIVE');
engine.queueTurnEndCombatAction({ type: 'retreat', unitId: 'bridge_a' });
assert.equal(engine.beginTeamTurnEnd().started, true);
const bridgeEnd = engine.endTeamRound({ retreat: () => ({ rotated: true }) });
assert.equal(bridgeEnd.ended, true);
assert.equal(engine.currentState, 'PRE_COMBAT_PLANNING');
assert.equal(engine.getTeamEconomySnapshot().round, 2);

console.log('team-action-economy smoke: OK');
