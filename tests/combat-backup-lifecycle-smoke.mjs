import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../js/combat-deployment-runtime.js');
const deployment = globalThis.LuminousCombatDeploymentRuntime;
assert.ok(deployment, 'deployment runtime must initialize');
assert.equal(deployment.FIELD_CAP_PER_SIDE, 8, 'FIELD cap is eight Units per side');

const writes = [];
const listeners = new Map();
const refFor = (path = '') => ({
  on(type, handler) { listeners.set(`${path}:${type}`, handler); },
  off(type, handler) { if (listeners.get(`${path}:${type}`) === handler) listeners.delete(`${path}:${type}`); },
  update(updates) { writes.push(JSON.parse(JSON.stringify(updates))); return Promise.resolve(); },
});
const db = { ref: (path = '') => refFor(path) };

const combatants = {};
for (let index = 1; index <= 8; index += 1) {
  combatants[`e${index}`] = {
    id: `e${index}`,
    combatId: `e${index}`,
    unitId: 'kobold_dagger',
    faction: 'enemy',
    actorCategory: 'enemy',
    battleActive: true,
    deploymentState: 'field',
    hp: 10,
    maxHp: 10,
    rank: 'normal',
    actionSlots: 3,
    currentActionSlots: 3,
    maxActionSlots: 3,
    inventory: index === 1 ? { items: [{ id: 'iron_dagger', quality: 2, durability: 7 }] } : undefined,
    equipment: index === 1 ? { mainHand: { id: 'iron_dagger', quality: 2 } } : undefined,
    threat: { rating: 1, xp: 200 },
  };
}

let runtimeUnits = {};
function hydrateRuntime() {
  runtimeUnits = Object.fromEntries(Object.entries(adapterState.combatants).map(([key, unit]) => [key, JSON.parse(JSON.stringify(unit))]));
  return true;
}
const adapterState = {
  role: 'dm',
  round: 3,
  db,
  combatants,
  lastSignature: '',
};
globalThis.LuminousCombatLiveAdapter073 = {
  state: adapterState,
  hydrateNow: hydrateRuntime,
};
globalThis.LuminousCombat073 = {
  combatants: () => runtimeUnits,
};
hydrateRuntime();

await import('../js/combat-v073-deployment-bridge.js');
const bridge = globalThis.LuminousCombatDeploymentBridge073;
assert.ok(bridge, 'live deployment bridge must initialize');

const reserves = {
  b1: deployment.markBackup({ id: 'b1', combatId: 'b1', unitId: 'wolf', faction: 'enemy', hp: 11, maxHp: 11, rank: 'normal', actionSlots: 1, maxActionSlots: 3 }, { queueOrder: 1, reason: 'encounter' }),
  b2: deployment.markBackup({ id: 'b2', combatId: 'b2', unitId: 'wolf', faction: 'enemy', hp: 11, maxHp: 11, rank: 'normal', actionSlots: 1, maxActionSlots: 3 }, { queueOrder: 2, reason: 'encounter' }),
  b3: deployment.markBackup({ id: 'b3', combatId: 'b3', unitId: 'wolf', faction: 'enemy', hp: 11, maxHp: 11, rank: 'captain', actionSlots: 1, maxActionSlots: 3 }, { queueOrder: 3, reason: 'encounter' }),
};
bridge.setReserveCache(reserves);

// Eight active enemies means the side is full. A reserve cannot enter without a vacancy.
assert.equal(deployment.fieldCount(adapterState.combatants, 'enemy'), 8);
assert.equal(bridge.promoteNextBackup('enemy').promoted, false);
assert.equal(bridge.promoteNextBackup('enemy').reason, 'field_cap_reached');

// Defeat archives the full record for future loot and replaces exactly that vacancy FIFO.
runtimeUnits.e1.hp = 0;
const firstDefeat = bridge.reconcileDefeatedRuntime({ source: 'test', round: 3 });
assert.equal(firstDefeat.changed, true);
assert.equal(firstDefeat.transitions.length, 1);
assert.equal(firstDefeat.transitions[0].key, 'e1');
assert.equal(firstDefeat.transitions[0].replacement.key, 'b1');
assert.equal(deployment.fieldCount(adapterState.combatants, 'enemy'), 8);
assert.ok(adapterState.combatants.b1, 'first FIFO backup must enter FIELD');
assert.equal(adapterState.combatants.e1, undefined, 'defeated Unit must leave FIELD');
const archivedE1 = firstDefeat.updates['campaña/combate/defeated/e1'];
assert.equal(archivedE1.lootEligible, true);
assert.equal(archivedE1.deploymentState, 'defeated');
assert.equal(archivedE1.inventory.items[0].id, 'iron_dagger', 'loot source inventory must survive defeat');
assert.equal(archivedE1.equipment.mainHand.quality, 2, 'equipment quality must survive defeat');
assert.equal(archivedE1.threat.xp, 200, 'XP/threat metadata must survive defeat');

// Retreat moves to the FRONT of BACKUP and deliberately does not fill its own vacancy.
const retreat = bridge.retreatUnit(runtimeUnits.b1);
assert.equal(retreat.changed, true);
assert.equal(retreat.promoted, false);
assert.equal(deployment.fieldCount(adapterState.combatants, 'enemy'), 7);
assert.equal(bridge.reserveEntries('enemy')[0].key, 'b1', 'retreated Unit must become first-in queue');
assert.equal(bridge.reserveEntries('enemy')[0].unit.retreated, true);

// The next real vacancy consumes that front entry, but the earlier Retreat vacancy remains open.
runtimeUnits.e2.hp = 0;
runtimeUnits.e2.currentActionSlots = 3;
const secondDefeat = bridge.reconcileDefeatedRuntime({ source: 'test', round: 3 });
assert.equal(secondDefeat.transitions[0].replacement.key, 'b1');
assert.equal(deployment.fieldCount(adapterState.combatants, 'enemy'), 7);
assert.equal(adapterState.combatants.b1.retreated, false, 'returning Unit is FIELD again');
assert.equal(adapterState.combatants.b1.replacementActionSlots, 2, 'replacement inherits at most two Action Slots');
assert.equal(adapterState.combatants.b1.replacementPendingPlanning, true, 'replacement waits for the next Planning');

// Summoned backups append to the back; they never jump directly into FIELD.
const summon = bridge.enqueueBackupUnit({
  id: 'wolf',
  unitId: 'wolf',
  catalogId: 'wolf',
  faction: 'enemy',
  hp: 11,
  maxHp: 11,
  rank: 'normal',
}, { key: 'howl_wolf_1', position: 'back', reason: 'hunting_howling' });
assert.equal(summon.added, true);
assert.equal(adapterState.combatants.howl_wolf_1, undefined);
assert.equal(bridge.reserveEntries('enemy').at(-1).key, 'howl_wolf_1');

// A Backup Captain gives half command support while waiting.
await import('../js/unit-rank-runtime.js');
const rank = globalThis.LuminousUnitRankRuntime;
const halfCommand = rank.commandSpRecoveryProfile(
  Object.values(adapterState.combatants),
  bridge.backupUnits('enemy'),
);
assert.equal(halfCommand.rank, 'captain');
assert.equal(halfCommand.sourceDeployment, 'backup');
assert.equal(halfCommand.turnEndSpRecovery, 2.5);

// Escape leaves the encounter, is not loot, and may consume the next queued replacement.
const escaped = bridge.escapeUnit(runtimeUnits.e3);
assert.equal(escaped.changed, true);
assert.equal(escaped.unit.lootEligible, false);
assert.equal(escaped.unit.xpPolicy, 'none');
assert.equal(escaped.replacement.key, 'b2');
assert.ok(escaped.updates['campaña/combate/departed/e3']);
assert.equal(escaped.updates['campaña/combate/defeated/e3'], undefined);
assert.equal(deployment.fieldCount(adapterState.combatants, 'enemy'), 7);

// The Captain enters on the following defeat and immediately regains full FIELD command.
runtimeUnits.e4.hp = 0;
const captainEntry = bridge.reconcileDefeatedRuntime({ source: 'test', round: 3 });
assert.equal(captainEntry.transitions[0].replacement.key, 'b3');
const fieldCommand = rank.commandProfile(Object.values(adapterState.combatants).filter((unit) => deployment.sideOf(unit) === 'enemy'));
assert.equal(fieldCommand.rank, 'captain');
assert.equal(fieldCommand.turnEndSpRecovery, 5);

// Performance contract: no deployment polling, reserves/defeated excluded before render/planning.
const bridgeSource = fs.readFileSync('js/combat-v073-deployment-bridge.js', 'utf8');
const liveAdapterSource = fs.readFileSync('js/combat-v073-live-adapter.js', 'utf8');
assert.equal(bridgeSource.includes('setInterval'), false, 'backup lifecycle must be event-driven, never per-Unit/per-frame polling');
assert.ok(liveAdapterSource.includes('if (!isFieldCombatant(raw)) continue;'), 'live adapter must hydrate FIELD only');

await import('../js/enemy-action-slot-allocator.js');
const allocator = globalThis.LuminousEnemyActionSlotAllocator;
assert.equal(allocator.isActive({ id: 'reserve', faction: 'enemy', hp: 10, isBackup: true, deploymentState: 'backup' }), false);
assert.equal(allocator.isActive({ id: 'field', faction: 'enemy', hp: 10, battleActive: true, deploymentState: 'field' }), true);

await bridge.state.writeChain;
assert.ok(writes.length > 0, 'DM authority must persist batched lifecycle transitions');
assert.ok(bridge.state.metrics.hydrates <= bridge.state.metrics.transitions, 'lifecycle must not rehydrate more often than it transitions');
assert.equal(bridge.state.metrics.batches >= 3, true);

console.log('combat backup lifecycle + FIELD performance smoke: ok');
