import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const loadedOwnership = require('../js/battle-viewer-ownership-074.js');
const ownership = loadedOwnership?.version === '0.7.4' ? loadedOwnership : globalThis.LuminousBattleViewerOwnership074;
const loadedLoadout = require('../js/combat-skill-loadout-074.js');
const loadout = loadedLoadout?.version === '0.7.4' ? loadedLoadout : globalThis.LuminousCombatSkillLoadout074;
const loadedPlanner = require('../js/battle-viewer-player-skill-planner-074.js');
const planner = loadedPlanner?.version === '0.7.4' ? loadedPlanner : globalThis.LuminousBattleViewerPlayerSkillPlanner074;

assert.equal(planner.version, '0.7.4');

const players = {
  player_a: { uid: 'uid-a', name: 'A' },
  player_b: { uid: 'uid-b', name: 'B' },
};
const combatants = {
  'player:player_a': {
    id: 'player:player_a', unitId: 'player:player_a', combatId: 'player:player_a',
    actorCategory: 'player', isPlayer: true, canonicalScope: 'player',
    playerId: 'player_a', ownerPlayerId: 'player_a', ownerUid: 'uid-a', canonicalPlayerKey: 'player_a', canonicalOwnerUid: 'uid-a',
    actionSlots: 2, activeSlots: 2, actionSlotIndex: { 0: true, 1: true },
    skillSlotIds: ['skill_a', 'skill_b'], skillIds: ['skill_a', 'skill_b'], equippedSkillIndex: { skill_a: true, skill_b: true },
  },
  'player:player_b': {
    id: 'player:player_b', unitId: 'player:player_b', combatId: 'player:player_b',
    actorCategory: 'player', isPlayer: true, canonicalScope: 'player',
    playerId: 'player_b', ownerPlayerId: 'player_b', ownerUid: 'uid-b', canonicalPlayerKey: 'player_b', canonicalOwnerUid: 'uid-b',
    actionSlots: 1, activeSlots: 1, actionSlotIndex: { 0: true },
    skillSlotIds: ['skill_c'], skillIds: ['skill_c'], equippedSkillIndex: { skill_c: true },
  },
  enemy_1: { id: 'enemy_1', actorCategory: 'enemy', name: 'Enemy' },
};

assert.equal(ownership.resolveCombatantForPlanOwner('player_a', combatants, players).ok, true);

const previousLibrary = globalThis.LuminousCombatSkillLoadout074?.state?.skillLibrary;
if (globalThis.LuminousCombatSkillLoadout074?.state) {
  globalThis.LuminousCombatSkillLoadout074.state.skillLibrary = {
    skill_a: { id: 'skill_a', name: 'Skill A' },
    skill_b: { id: 'skill_b', name: 'Skill B' },
    skill_c: { id: 'skill_c', name: 'Skill C' },
  };
}

planner.applyPlayers(players);
planner.applyCombatants(combatants);
planner.applyPlans({});
planner.applyCombatState('PRE_COMBAT_PLANNING');
planner.state.auth = { currentUser: { uid: 'uid-a' } };

const resolvedOwner = planner.resolveAuthenticatedPlayer();
assert.equal(resolvedOwner.ok, true);
assert.equal(resolvedOwner.playerId, 'player_a');
const resolvedCombatant = planner.resolveOwnedCombatant('player_a');
assert.equal(resolvedCombatant.ok, true);
assert.equal(resolvedCombatant.unitId, 'player:player_a');
assert.equal(planner.ownsCombatSlot('player_a', 'player:player_a_slot_0'), true);
assert.equal(planner.ownsCombatSlot('player_a', 'player:player_b_slot_0'), false);

const equipped = planner.equippedSkillsFor('player_a');
assert.deepEqual(equipped.map((row) => row.id), ['skill_a', 'skill_b']);

const valid = planner.buildSkillPlan({
  authUid: 'uid-a',
  ownerPlayerId: 'player_a',
  slotId: 'player:player_a_slot_0',
  skillId: 'skill_a',
  targetId: 'enemy_1',
});
assert.equal(valid.ok, true);
assert.equal(valid.slotIndex, 0);
assert.deepEqual(valid.payload, {
  unitId: 'player:player_a',
  kind: 'skill',
  skillId: 'skill_a',
  targetId: 'enemy_1',
  status: 'planned',
  scheduledBy: 'player_a',
  schedulerUid: 'uid-a',
});
assert.equal('data' in valid.payload, false);
assert.equal('skill' in valid.payload, false);
assert.equal('sourceDefinition' in valid.payload, false);
assert.equal('combatAction' in valid.payload, false);

assert.equal(planner.buildSkillPlan({ authUid: 'uid-a', ownerPlayerId: 'player_a', slotIndex: 0, skillId: 'skill_c', targetId: 'enemy_1' }).reason, 'SKILL_NOT_EQUIPPED');
assert.equal(planner.buildSkillPlan({ authUid: 'uid-a', ownerPlayerId: 'player_b', slotIndex: 0, skillId: 'skill_c', targetId: 'enemy_1' }).reason, 'AUTH_UID_MISMATCH');
assert.equal(planner.buildSkillPlan({ authUid: 'uid-a', ownerPlayerId: 'player_a', slotId: 'player:player_b_slot_0', skillId: 'skill_a', targetId: 'enemy_1' }).reason, 'ACTION_SLOT_NOT_OWNED');
assert.equal(planner.buildSkillPlan({ authUid: 'uid-a', ownerPlayerId: 'player_a', slotIndex: 5, skillId: 'skill_a', targetId: 'enemy_1' }).reason, 'ACTION_SLOT_NOT_OWNED');
assert.equal(planner.buildSkillPlan({ authUid: 'uid-a', ownerPlayerId: 'player_a', slotIndex: 0, skillId: 'skill_a', targetId: 'missing' }).reason, 'TARGET_NOT_FOUND');

const writes = {};
function makeSnapshot(value) { return { val: () => value }; }
const fakeDb = {
  ref(refPath) {
    return {
      async set(value) { writes[refPath] = JSON.parse(JSON.stringify(value)); },
      async remove() { delete writes[refPath]; },
      on() {}, off() {},
      once() { return Promise.resolve(makeSnapshot(writes[refPath])); },
    };
  },
};
planner.state.db = fakeDb;

const scheduled = await planner.scheduleSkill({
  authUid: 'uid-a',
  ownerPlayerId: 'player_a',
  slotId: 'player:player_a_slot_0',
  skillId: 'skill_a',
  targetId: 'enemy_1',
  db: fakeDb,
});
assert.equal(scheduled.ok, true);
assert.deepEqual(writes['campaña/combate/plannedActions/player_a/0'], valid.payload);

planner.applyPlans({ player_a: { 0: writes['campaña/combate/plannedActions/player_a/0'] } });
const forgedReservation = await planner.scheduleSkill({
  authUid: 'uid-b',
  ownerPlayerId: 'player_a',
  slotIndex: 0,
  skillId: 'skill_a',
  targetId: 'enemy_1',
  db: fakeDb,
});
assert.equal(forgedReservation.ok, false);
assert.equal(forgedReservation.reason, 'AUTH_UID_MISMATCH');

const cancelled = await planner.cancelSkillPlan(0, { ownerPlayerId: 'player_a', authUid: 'uid-a', db: fakeDb });
assert.equal(cancelled.ok, true);
assert.equal(writes['campaña/combate/plannedActions/player_a/0'], undefined);

// Targeting integration: selecting a Skill turns the existing Action Slot drag into a compact shared plan.
planner.applyPlans({});
planner.applyCombatState('PRE_COMBAT_PLANNING');
planner.state.auth = { currentUser: { uid: 'uid-a' } };
let baseOpenCalls = 0;
let baseSelectCalls = 0;
globalThis.openTargetingMatrix = () => { baseOpenCalls += 1; return 'opened'; };
globalThis.selectMatrixCell = () => { baseSelectCalls += 1; return 'selected'; };
planner.installTargetingHook();
assert.equal(planner.selectSkill('skill_a').ok, true);
assert.equal(globalThis.openTargetingMatrix('player:player_a_slot_1', 'enemy_1_slot_0'), 'opened');
assert.equal(globalThis.selectMatrixCell(), 'selected');
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(baseOpenCalls, 1);
assert.equal(baseSelectCalls, 1);
assert.deepEqual(writes['campaña/combate/plannedActions/player_a/1'], {
  unitId: 'player:player_a', kind: 'skill', skillId: 'skill_a', targetId: 'enemy_1', status: 'planned', scheduledBy: 'player_a', schedulerUid: 'uid-a',
});

// A Player cannot hijack another combatant's Action Slot while a Skill is selected.
assert.equal(globalThis.openTargetingMatrix('player:player_b_slot_0', 'enemy_1_slot_0'), false);
assert.equal(baseOpenCalls, 1);

// Planning phase is a hard producer boundary.
planner.applyCombatState('COMBAT_ACTIVE');
const lateWrite = await planner.scheduleSkill({
  authUid: 'uid-a',
  ownerPlayerId: 'player_a',
  slotId: 'player:player_a_slot_1',
  skillId: 'skill_a',
  targetId: 'enemy_1',
  db: fakeDb,
});
assert.equal(lateWrite.ok, false);
assert.equal(lateWrite.reason, 'NOT_IN_PLANNING');
assert.equal(writes['campaña/combate/plannedActions/player_a/1'], undefined);

// Runtime 0.7.4 must load the planner as a first-class module behind the Firebase role gate.
const here = path.dirname(fileURLToPath(import.meta.url));
const runtimeSource = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-runtime-074.js'), 'utf8');
assert.match(runtimeSource, /battle-viewer-player-skill-planner-074\.js/);
assert.match(runtimeSource, /battle-viewer-firebase-session-074\.js/);
assert.match(runtimeSource, /result\.role === "player"/);
assert.match(runtimeSource, /parts\.playerSkillPlanner\?\.init\?\.\(scoped\)/);

if (globalThis.LuminousCombatSkillLoadout074?.state) globalThis.LuminousCombatSkillLoadout074.state.skillLibrary = previousLibrary || {};
console.log('combat-v074-player-skill-planner-smoke: ok');