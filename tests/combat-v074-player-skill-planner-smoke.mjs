import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-skill-schema.js');
await import('../js/combat-skill-loadout-074.js');
await import('../js/battle-viewer-ownership-074.js');
await import('../js/battle-viewer-player-skill-planner-074.js');

const loadout = globalThis.LuminousCombatSkillLoadout074;
const planner = globalThis.LuminousBattleViewerPlayerSkillPlanner074;
if (!loadout || !planner) throw new Error('0.7.4 Skill loadout/planner modules were not initialized.');

const canonicalSkills = {
  skill_a: {
    name: 'Canonical A',
    type: 'Attack',
    tier: 1,
    basePower: 6,
    coinPower: 3,
    coinAmount: 2,
    damageType: 'cortante',
    sinAffinity: 'wrath',
    attackWeight: 1,
    effects: [],
    coins: [{ effects: [] }, { effects: [] }],
    schemaVersion: 2,
  },
  skill_b: {
    name: 'Canonical B',
    type: 'Attack',
    tier: 1,
    basePower: 5,
    coinPower: 4,
    coinAmount: 1,
    damageType: 'perforante',
    sinAffinity: 'pride',
    attackWeight: 1,
    effects: [],
    coins: [{ effects: [] }],
    schemaVersion: 2,
  },
};
loadout.applySkills(canonicalSkills);

const players = {
  player_a: { uid: 'uid-a', nombre: 'Player A' },
  player_b: { uid: 'uid-b', nombre: 'Player B' },
};
const combatants = {
  'player:player_a': {
    id: 'player:player_a',
    combatId: 'player:player_a',
    isPlayer: true,
    actorCategory: 'player',
    canonicalScope: 'player',
    canonicalPlayerKey: 'player_a',
    canonicalOwnerUid: 'uid-a',
    playerId: 'player_a',
    ownerPlayerId: 'player_a',
    ownerUid: 'uid-a',
    actionSlots: 2,
    activeSlots: 2,
    actionSlotIndex: { 0: true, 1: true },
    skillSlotIds: ['skill_a'],
    skillIds: ['skill_a'],
    equippedSkillIndex: { skill_a: true },
  },
  'player:player_b': {
    id: 'player:player_b',
    combatId: 'player:player_b',
    isPlayer: true,
    actorCategory: 'player',
    canonicalScope: 'player',
    canonicalPlayerKey: 'player_b',
    canonicalOwnerUid: 'uid-b',
    playerId: 'player_b',
    ownerPlayerId: 'player_b',
    ownerUid: 'uid-b',
    actionSlots: 1,
    activeSlots: 1,
    actionSlotIndex: { 0: true },
    skillSlotIds: ['skill_b'],
    skillIds: ['skill_b'],
    equippedSkillIndex: { skill_b: true },
  },
  enemy_1: {
    id: 'enemy_1',
    actorCategory: 'enemy',
    category: 'enemy',
    hp: 100,
    maxHp: 100,
    actionSlots: 1,
  },
};

planner.applyPlayers(players);
planner.applyCombatants(combatants);
planner.applyPlans({});
planner.applyCombatState('PRE_COMBAT_PLANNING');
planner.state.auth = { currentUser: { uid: 'uid-a' } };

globalThis.combatData = combatants;
globalThis.sharedPlannedActions = {};
globalThis.attackVectors = {};

const writes = {};
const fakeDb = {
  ref(refPath) {
    return {
      async set(value) { writes[refPath] = structuredClone(value); },
      async remove() { delete writes[refPath]; },
    };
  },
};
planner.state.db = fakeDb;

// The Player selects only an equipped Skill.
assert.equal(planner.selectSkill('skill_a').ok, true);
assert.equal(planner.state.selectedSkillId, 'skill_a');
assert.equal(planner.selectSkill('skill_b').ok, false);
assert.equal(planner.selectSkill('skill_b').reason, 'SKILL_NOT_EQUIPPED');
assert.equal(planner.selectSkill('skill_a').ok, true);

// Wrong Unit / wrong Player Action Slot must fail before Firebase.
const foreignSlot = planner.buildSkillPlan({
  authUid: 'uid-a',
  ownerPlayerId: 'player_a',
  slotId: 'player:player_b_slot_0',
  skillId: 'skill_a',
  targetId: 'enemy_1',
});
assert.equal(foreignSlot.ok, false);
assert.equal(foreignSlot.reason, 'ACTION_SLOT_NOT_OWNED');

// Install the real targeting producer hook: select Skill -> drag own Action Slot -> choose target.
let matrixOpened = null;
globalThis.openTargetingMatrix = (attackerSlotId, targetSlotId) => {
  matrixOpened = { attackerSlotId, targetSlotId };
  return true;
};
globalThis.selectMatrixCell = () => true;
assert.equal(planner.installTargetingHook(), true);

globalThis.openTargetingMatrix('player:player_a_slot_0', 'enemy_1_slot_0');
assert.deepEqual(matrixOpened, { attackerSlotId: 'player:player_a_slot_0', targetSlotId: 'enemy_1_slot_0' });
globalThis.selectMatrixCell(1, 0);
await new Promise((resolve) => setTimeout(resolve, 10));

const planPath = 'campaña/combate/plannedActions/player_a/0';
const payload = writes[planPath];
assert.ok(payload, 'targeting hook should write the compact Skill plan to Firebase');
assert.deepEqual(Object.keys(payload).sort(), [
  'kind', 'scheduledBy', 'schedulerUid', 'skillId', 'status', 'targetId', 'unitId',
].sort());
assert.deepEqual(payload, {
  unitId: 'player:player_a',
  kind: 'skill',
  skillId: 'skill_a',
  targetId: 'enemy_1',
  status: 'planned',
  scheduledBy: 'player_a',
  schedulerUid: 'uid-a',
});
assert.equal('data' in payload, false);
assert.equal('basePower' in payload, false);
assert.equal('coinPower' in payload, false);
assert.equal('coinAmount' in payload, false);
assert.equal('effects' in payload, false);

// Feed exactly that Firebase payload to the Battle Viewer adapter.
globalThis.sharedPlannedActions = {
  player_a: { 0: payload },
};
await import('../js/battle-viewer-action-adapter-073.js');
const adapter = globalThis.LuminousBattleViewerActionAdapter073;
if (!adapter) throw new Error('Battle Viewer action adapter was not initialized.');

const compiled = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0');
assert.ok(compiled.action, compiled.reason || 'compact Skill plan should compile');
assert.equal(compiled.action.source.type, 'skill');
assert.equal(compiled.action.source.id, 'skill_a');
assert.equal(compiled.action.actorId, 'player:player_a');
assert.equal(compiled.action.targeting.mainTargetId, 'enemy_1');
assert.equal(compiled.action.metadata.canonicalSkill, true);
assert.equal(compiled.action.metadata.loadoutSkillId, 'skill_a');
assert.equal(compiled.action.metadata.sourceDefinition.name, 'Canonical A');
assert.equal(compiled.action.metadata.sourceDefinition.basePower, 6);
assert.equal(compiled.action.metadata.sourceDefinition.coinPower, 3);
assert.equal(compiled.action.metadata.sourceDefinition.coinAmount, 2);

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

console.log('combat-v074-player-skill-planner-smoke: ok');