import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const loadedOwnership = require('../js/battle-viewer-ownership-074.js');
const ownership = loadedOwnership?.version === '0.7.4' ? loadedOwnership : globalThis.LuminousBattleViewerOwnership074;

assert.equal(ownership.version, '0.7.4');
assert.equal(ownership.canonicalCombatantIdForPlayer('player_a'), 'player:player_a');

const playerIds = ['player_a', 'player_b', 'player_c', 'player_d', 'player_e', 'player_f', 'player_g', 'player_h'];
const players = Object.fromEntries(playerIds.map((id, index) => [id, {
  uid: `uid-${String.fromCharCode(97 + index)}`,
  actorId: `actor-${String.fromCharCode(97 + index)}`,
  name: id,
}]));
const combatants = Object.fromEntries(playerIds.map((id, index) => {
  const suffix = String.fromCharCode(97 + index);
  const slots = (index % 4) + 1;
  return [`player:${id}`, {
    id: `player:${id}`,
    unitId: `player:${id}`,
    combatId: `player:${id}`,
    actorCategory: 'player',
    isPlayer: true,
    canonicalScope: 'player',
    playerId: id,
    ownerPlayerId: id,
    ownerUid: `uid-${suffix}`,
    canonicalPlayerKey: id,
    canonicalOwnerUid: `uid-${suffix}`,
    actionSlots: slots,
    activeSlots: slots,
    actionSlotIndex: Object.fromEntries(Array.from({ length: slots }, (_, slot) => [String(slot), true])),
  }];
}));
combatants.enemy_1 = { id: 'enemy_1', actorCategory: 'enemy', name: 'Enemy' };

// Eight simultaneous Players must resolve to eight different canonical combatants and only their own slots.
for (let index = 0; index < playerIds.length; index += 1) {
  const playerId = playerIds[index];
  const uid = players[playerId].uid;
  const unit = combatants[`player:${playerId}`];
  const lastOwnedSlot = unit.activeSlots - 1;
  const resolved = ownership.resolveCombatantForPlanOwner(playerId, combatants, players);
  assert.equal(resolved.ok, true, `${playerId} should resolve`);
  assert.equal(resolved.unitId, `player:${playerId}`);
  assert.equal(resolved.ownerUid, uid);
  assert.equal(ownership.canControlCombatant({ authUid: uid, ownerPlayerId: playerId, unit, players }).ok, true);
  assert.equal(ownership.isAuthorizedActionSlot(unit, lastOwnedSlot), true);
  assert.equal(ownership.isAuthorizedActionSlot(unit, unit.activeSlots), false);

  const ownSlotPlan = {
    unitId: `player:${playerId}`,
    slotIndex: lastOwnedSlot,
    kind: 'trait',
    traitId: 'attack',
    status: 'planned',
    scheduledBy: playerId,
    schedulerUid: uid,
  };
  assert.equal(ownership.authorizePlanWrite({ authUid: uid, ownerPlayerId: playerId, action: ownSlotPlan, combatants, players }).ok, true);
  assert.equal(ownership.authorizePlanWrite({
    authUid: uid,
    ownerPlayerId: playerId,
    action: { ...ownSlotPlan, slotIndex: unit.activeSlots },
    combatants,
    players,
  }).reason, 'ACTION_SLOT_NOT_OWNED');
}

const resolvedA = ownership.resolveCombatantForPlanOwner('player_a', combatants, players);
assert.equal(resolvedA.ok, true);
assert.equal(resolvedA.unitId, 'player:player_a');
assert.equal(resolvedA.ownerUid, 'uid-a');

assert.equal(ownership.canControlCombatant({ authUid: 'uid-a', ownerPlayerId: 'player_a', unit: combatants['player:player_a'], players }).ok, true);
assert.equal(ownership.canControlCombatant({ authUid: 'uid-a', ownerPlayerId: 'player_b', unit: combatants['player:player_b'], players }).reason, 'AUTH_UID_MISMATCH');
assert.equal(ownership.canControlCombatant({ authUid: 'uid-a', ownerPlayerId: 'player_a', unit: combatants.enemy_1, players }).reason, 'NOT_PLAYER_COMBATANT');
assert.equal(ownership.canControlCombatant({ authUid: ownership.FALLBACK_DM_UID, ownerPlayerId: 'player_b', unit: combatants['player:player_b'], players }).role, 'dm');
assert.equal(ownership.canControlCombatant({ authUid: ownership.FALLBACK_DM_UID, unit: combatants.enemy_1, players }).ok, true);

const ownPlan = {
  unitId: 'player:player_a', slotIndex: 0, kind: 'trait', traitId: 'attack',
  status: 'planned', scheduledBy: 'player_a', schedulerUid: 'uid-a',
};
assert.equal(ownership.validatePlanIntegrity({ ownerPlayerId: 'player_a', action: ownPlan, combatants, players }).ok, true);
assert.equal(ownership.authorizePlanWrite({ authUid: 'uid-a', ownerPlayerId: 'player_a', action: ownPlan, combatants, players }).ok, true);
assert.equal(ownership.validatePlanIntegrity({ ownerPlayerId: 'player_a', action: { ...ownPlan, slotIndex: 1 }, combatants, players }).reason, 'ACTION_SLOT_NOT_OWNED');
assert.equal(ownership.validatePlanIntegrity({ ownerPlayerId: 'player_a', slotIndex: 0, action: { ...ownPlan, slotIndex: undefined }, combatants, players }).ok, true);
assert.equal(ownership.validatePlanIntegrity({ ownerPlayerId: 'player_a', action: { ...ownPlan, slotIndex: undefined }, combatants, players }).reason, 'ACTION_SLOT_REQUIRED');

const forgedUnit = { ...ownPlan, unitId: 'player:player_b' };
assert.equal(ownership.validatePlanIntegrity({ ownerPlayerId: 'player_a', action: forgedUnit, combatants, players }).reason, 'SOURCE_UNIT_MISMATCH');
assert.equal(ownership.authorizePlanWrite({ authUid: 'uid-a', ownerPlayerId: 'player_a', action: forgedUnit, combatants, players }).ok, false);

const forgedScheduler = { ...ownPlan, schedulerUid: 'uid-b' };
assert.equal(ownership.authorizePlanWrite({ authUid: 'uid-a', ownerPlayerId: 'player_a', action: forgedScheduler, combatants, players }).reason, 'SCHEDULER_UID_MISMATCH');

const forgedOwner = { ...ownPlan, scheduledBy: 'player_b' };
assert.equal(ownership.authorizePlanWrite({ authUid: 'uid-a', ownerPlayerId: 'player_a', action: forgedOwner, combatants, players }).reason, 'SCHEDULED_BY_MISMATCH');

const prematureResolve = { ...ownPlan, status: 'resolving' };
assert.equal(ownership.authorizePlanWrite({ authUid: 'uid-a', ownerPlayerId: 'player_a', action: prematureResolve, combatants, players }).reason, 'PLAYER_STATUS_FORBIDDEN');
assert.equal(ownership.authorizePlanWrite({ authUid: ownership.FALLBACK_DM_UID, ownerPlayerId: 'player_a', action: prematureResolve, combatants, players }).role, 'dm');

const mismatchedUidCombatants = {
  ...combatants,
  'player:player_a': { ...combatants['player:player_a'], canonicalOwnerUid: 'uid-b', ownerUid: 'uid-b' },
};
assert.equal(ownership.resolveCombatantForPlanOwner('player_a', mismatchedUidCombatants, players).reason, 'OWNER_UID_MISMATCH');

const legacyOnly = {
  legacy_a: { actorCategory: 'player', isPlayer: true, ownerPlayerId: 'player_a', ownerUid: 'uid-a', canonicalOwnerUid: 'uid-a' },
};
assert.equal(ownership.resolveCombatantForPlanOwner('player_a', legacyOnly, players).legacy, true);
assert.equal(ownership.resolveCombatantForPlanOwner('player_a', legacyOnly, players, { allowLegacy: false }).reason, 'COMBATANT_NOT_FOUND');

const ambiguousLegacy = {
  legacy_a1: { actorCategory: 'player', isPlayer: true, ownerPlayerId: 'player_a', canonicalOwnerUid: 'uid-a' },
  legacy_a2: { actorCategory: 'player', isPlayer: true, ownerPlayerId: 'player_a', canonicalOwnerUid: 'uid-a' },
};
assert.equal(ownership.resolveCombatantForPlanOwner('player_a', ambiguousLegacy, players).reason, 'AMBIGUOUS_COMBATANT');

// Static guard: Firebase Rules must enforce the same canonical ownership + slot boundary.
const here = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8'));
const slotRules = rules.rules.campaña.combate.plannedActions.$ownerPlayerId.$slotIndex;
assert.equal(typeof slotRules['.write'], 'string');
assert.match(slotRules['.write'], /status.*planned/);
assert.match(slotRules['.write'], /!newData\.exists\(\)/);
assert.equal(typeof slotRules['.validate'], 'string');
assert.match(slotRules['.validate'], /canonicalPlayerKey/);
assert.match(slotRules['.validate'], /canonicalOwnerUid/);
assert.match(slotRules['.validate'], /schedulerUid/);
assert.match(slotRules['.validate'], /unitId/);
assert.match(slotRules['.validate'], /actionSlotIndex/);
assert.match(slotRules['.validate'], /\$slotIndex/);

console.log('combat-v074-ownership-smoke: ok');
