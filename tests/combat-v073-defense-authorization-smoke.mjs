import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/combat-v073-dm-setup.js', import.meta.url), 'utf8');
const sandbox = {
  console,
  setInterval: () => 1, // Do not start Firebase/UI bootstrap in this unit test.
  addEventListener: () => {},
  LuminousCombatSkillLoadout074: {
    hasSkillLoadout: () => true,
    skillSlotIdsFor: () => ['strike_1', 'strike_2'],
    grantedSkillIdsFor: () => ['class_guard']
  },
  LuminousEquipmentEffects: {
    grantedSkillIds: () => ['shield_counter']
  }
};
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'combat-v073-dm-setup.js' });

const dmSetup = sandbox.LuminousCombatDmSetup073;
assert.ok(dmSetup?.buildPlayer, 'DM combatant deployment must be available');
const player = dmSetup.buildPlayer('player_a', {
  uid: 'player_uid', name: 'Player A', actionSlots: 2,
  skillSlotIds: ['strike_1', 'strike_2']
});
const permitted = player.equippedSkillIndex;
for (const skillId of ['strike_1', 'strike_2', 'Evade', 'Guard', 'Counter', 'class_guard', 'shield_counter']) {
  assert.equal(permitted[skillId], true, `DM deployment must authorize ${skillId}`);
}
assert.equal(permitted.unowned_skill, undefined, 'Do not authorize arbitrary Skills');
assert.equal(player.actionSlotIndex[0], true);
assert.equal(player.actionSlotIndex[1], true);
assert.deepEqual(Array.from(player.skillSlotIds), ['strike_1', 'strike_2'], 'Defenses/grants must not inflate the 3/2/1 Deck slots');
assert.deepEqual(Array.from(player.skillIds), ['strike_1', 'strike_2'], 'Defenses/grants must not change Deck order');
assert.equal(player.canonicalPlayerKey, 'player_a');
assert.equal(player.canonicalOwnerUid, 'player_uid');

// Existing deployments must be repaired by the DM, not by unauthorized player writes.
assert.match(source, /syncFieldsFromBuiltPlayer\(current, buildPlayer\(playerId, player\)\)/);
assert.match(source, /'equippedSkillIndex'/);
const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
const planned = rules.rules.campaña.combate.plannedActions.$ownerPlayerId.$slotIndex;
assert.match(planned['.validate'], /equippedSkillIndex/);
assert.match(planned['.validate'], /actionSlotIndex/);
assert.match(planned['.validate'], /canonicalOwnerUid/);
console.log('combat-v073-defense-authorization-smoke: ok');
