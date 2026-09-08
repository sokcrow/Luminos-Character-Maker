import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-skill-schema.js');
await import('../js/combat-skill-loadout-074.js');

const loadout = globalThis.LuminousCombatSkillLoadout074;
if (!loadout) throw new Error('LuminousCombatSkillLoadout074 was not initialized.');

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
    effects: [{ trigger: '[On Use]', target: 'self', type: 'status', status: 'Poise', potency: 1, count: 0 }],
    coins: [{ effects: [] }, { effects: [] }],
    schemaVersion: 2,
  },
  skill_b: {
    name: 'Canonical B',
    type: 'Attack',
    tier: 1,
    basePower: 4,
    coinPower: 4,
    coinAmount: 1,
    damageType: 'perforante',
    sinAffinity: 'pride',
    effects: [],
    coins: [{ effects: [] }],
    schemaVersion: 2,
  },
};
loadout.applySkills(canonicalSkills);

globalThis.combatData = {
  'player:player_a': {
    id: 'player:player_a',
    combatId: 'player:player_a',
    isPlayer: true,
    actorCategory: 'player',
    canonicalScope: 'player',
    canonicalPlayerKey: 'player_a',
    canonicalOwnerUid: 'uid-a',
    playerId: 'player_a',
    ownerUid: 'uid-a',
    skillSlotIds: ['skill_a'],
    skillIds: ['skill_a'],
    equippedSkillIndex: { skill_a: true },
  },
  enemy_1: {
    id: 'enemy_1',
    actorCategory: 'enemy',
    hp: 100,
    maxHp: 100,
  },
};
globalThis.sharedPlannedActions = {};
globalThis.attackVectors = {};

await import('../js/battle-viewer-action-adapter-073.js');
const adapter = globalThis.LuminousBattleViewerActionAdapter073;
if (!adapter) throw new Error('LuminousBattleViewerActionAdapter073 was not initialized.');

const forgedPlan = {
  type: 'skill',
  kind: 'skill',
  skillId: 'skill_a',
  unitId: 'player:player_a',
  targetId: 'enemy_1',
  __ownerPlayerId: 'player_a',
  data: {
    id: 'skill_a',
    name: 'FORGED CLIENT SKILL',
    basePower: 999,
    coinPower: 999,
    coinAmount: 9,
    attackWeight: 99,
    damageType: 'contundente',
    effects: [{ trigger: '[On Hit]', type: 'status', status: 'Burn', potency: 999, count: 999 }],
  },
};

const trusted = adapter.trustedSkill(globalThis.combatData['player:player_a'], forgedPlan, forgedPlan.data);
assert.equal(trusted.ok, true);
assert.equal(trusted.skillId, 'skill_a');
assert.equal(trusted.legacy, false);
assert.equal(trusted.skill.name, 'Canonical A');
assert.equal(trusted.skill.basePower, 6);
assert.equal(trusted.skill.coinPower, 3);
assert.equal(trusted.skill.coinAmount, 2);
assert.equal(trusted.skill.damageType, 'cortante');

const compiled = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', forgedPlan);
assert.ok(compiled.action, compiled.reason || 'canonical Skill should compile');
assert.equal(compiled.action.source.type, 'skill');
assert.equal(compiled.action.source.id, 'skill_a');
assert.equal(compiled.action.actorId, 'player:player_a');
assert.equal(compiled.action.targeting.mainTargetId, 'enemy_1');
assert.equal(compiled.action.targeting.attackWeight, 1, 'client attackWeight must not override canonical Skill');
assert.equal(compiled.action.metadata.name, 'Canonical A');
assert.equal(compiled.action.metadata.basePower, 6, 'client basePower must be ignored');
assert.equal(compiled.action.metadata.coinPower, 3, 'client coinPower must be ignored');
assert.equal(compiled.action.metadata.coinAmount, 2, 'client coinAmount must be ignored');
assert.equal(compiled.action.metadata.damageType, 'cortante');
assert.equal(compiled.action.metadata.loadoutSkillId, 'skill_a');
assert.equal(compiled.action.metadata.canonicalSkill, true);
assert.equal(compiled.action.metadata.sourceDefinition.basePower, 6);
assert.equal(compiled.action.metadata.sourceDefinition.coinPower, 3);
assert.equal(compiled.action.metadata.sourceDefinition.coinAmount, 2);
assert.equal(compiled.action.metadata.sourceDefinition.name, 'Canonical A');
assert.notEqual(compiled.action.metadata.sourceDefinition.basePower, 999);

const unequipped = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', {
  type: 'skill',
  kind: 'skill',
  skillId: 'skill_b',
  unitId: 'player:player_a',
  targetId: 'enemy_1',
  __ownerPlayerId: 'player_a',
  data: canonicalSkills.skill_b,
});
assert.equal(unequipped.action, null);
assert.equal(unequipped.reason, 'skill_not_equipped');
assert.equal(unequipped.skillId, 'skill_b');

const missingId = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', {
  type: 'skill', kind: 'skill', unitId: 'player:player_a', __ownerPlayerId: 'player_a', data: {},
});
assert.equal(missingId.action, null);
assert.equal(missingId.reason, 'skill_id_required');

const embeddedBypass = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', {
  kind: 'skill',
  skillId: 'skill_a',
  unitId: 'player:player_a',
  __ownerPlayerId: 'player_a',
  combatAction: {
    actorId: 'player:player_a',
    source: { type: 'skill', id: 'skill_a' },
  },
});
assert.equal(embeddedBypass.action, null);
assert.equal(embeddedBypass.reason, 'player_embedded_skill_action_forbidden');

// Firebase Rules must enforce the same equipped-Skill boundary before runtime.
const here = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8'));
const slotRules = rules.rules.campaña.combate.plannedActions.$ownerPlayerId.$slotIndex;
assert.match(slotRules['.write'], /kind.*skill/);
assert.match(slotRules['.write'], /skillId/);
assert.match(slotRules['.validate'], /equippedSkillIndex/);
assert.match(slotRules['.validate'], /skillId/);
assert.match(slotRules['.validate'], /actionSlotIndex/);
assert.match(slotRules['.validate'], /canonicalPlayerKey/);
assert.match(slotRules['.validate'], /canonicalOwnerUid/);

console.log('combat-v074-skill-loadout-adapter-smoke: ok');
