import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/spell-catalog-core.js');
await import('../js/role-spell-catalog-core.js');
await import('../js/spell-loadout-core.js');
await import('../js/dm-player-loadout-core.js');
const core = globalThis.LuminousDmPlayerLoadoutCore;
assert.ok(core);

const skills = {
  skill_t1: { id: 'skill_t1', name: 'Tier One', tier: 1, sinAffinity: 'wrath' },
  skill_t2: { id: 'skill_t2', name: 'Tier Two', tier: 2, sinAffinity: 'pride' },
  skill_t3: { id: 'skill_t3', name: 'Tier Three', tier: 3, sinAffinity: 'gluttony' },
};

const validDeck = core.validateDeck({
  tier1: 'skill_t1',
  tier2: 'skill_t2',
  tier3: 'skill_t3',
}, skills);
assert.equal(validDeck.valid, true);
assert.deepEqual(validDeck.skillSlotIds, [
  'skill_t1', 'skill_t1', 'skill_t1',
  'skill_t2', 'skill_t2',
  'skill_t3',
]);
assert.deepEqual(validDeck.skillIds, ['skill_t1', 'skill_t2', 'skill_t3']);
assert.deepEqual(validDeck.equippedSkillIndex, {
  skill_t1: true,
  skill_t2: true,
  skill_t3: true,
});

const wrongTier = core.validateDeck({
  tier1: 'skill_t2',
  tier2: 'skill_t1',
  tier3: 'skill_t3',
}, skills);
assert.equal(wrongTier.valid, false);
assert.match(wrongTier.errors.join(' '), /Tier 2, no Tier 1/);

const presetCatalog = {
  DEFINITIONS: {
    preset_a_1: {
      id: 'preset_a_1', name: 'One', tier: 1, inDeck: true,
      metadata: { ownerCharacterId: 'test_build', ownerCharacterName: 'Test Build', deckCopies: 3 },
    },
    preset_a_2: {
      id: 'preset_a_2', name: 'Two', tier: 2, inDeck: true,
      metadata: { ownerCharacterId: 'test_build', ownerCharacterName: 'Test Build', deckCopies: 2 },
    },
    preset_a_3: {
      id: 'preset_a_3', name: 'Three', tier: 3, inDeck: true,
      metadata: { ownerCharacterId: 'test_build', ownerCharacterName: 'Test Build', deckCopies: 1 },
    },
    evolved: {
      id: 'evolved', name: 'Evolved', tier: 3, inDeck: false,
      metadata: { ownerCharacterId: 'test_build', evolvedSignatureSkill: true, deckCopies: 0 },
    },
  },
};
const presets = core.signaturePresets(presetCatalog);
assert.equal(presets.length, 1);
assert.equal(presets[0].id, 'test_build');
assert.equal(presets[0].label, 'Test Build');
assert.deepEqual(presets[0].deck, {
  tier1: 'preset_a_1',
  tier2: 'preset_a_2',
  tier3: 'preset_a_3',
});

const player = {
  level: 20,
  characterBuild: {
    classes: [
      { classId: 'monk', levels: 10 },
      { classId: 'wizard', levels: 10 },
    ],
  },
};
assert.equal(core.spellCompatibleWithPlayer({ id: 'legal', classIds: ['wizard'] }, player), true);
assert.equal(core.spellCompatibleWithPlayer({ id: 'illegal', classIds: ['bard'] }, player), false);
assert.equal(core.spellCompatibleWithPlayer({ id: 'special' }, player), true);

const builtDeck = core.buildSkillDeckUpdates({
  tier1: 'skill_t1', tier2: 'skill_t2', tier3: 'skill_t3',
}, skills);
assert.equal(builtDeck.valid, true);
assert.equal(builtDeck.updates['characterBuild/skillLoadoutSource'], 'dm_loadout_manager');
assert.deepEqual(builtDeck.updates.skillSlotIds, validDeck.skillSlotIds);
assert.deepEqual(builtDeck.updates['characterBuild/skillDeck'], {
  tier1: 'skill_t1',
  tier2: 'skill_t2',
  tier3: 'skill_t3',
  schemaVersion: 1,
});

const spellUpdates = core.buildSpellUpdates(
  ['fire_bolt', 'shield', 'fire_bolt'],
  ['message', 'message'],
);
assert.deepEqual(spellUpdates.spellSelections, ['fire_bolt', 'message', 'shield']);
assert.deepEqual(spellUpdates.roleSpellSelections, ['message']);
assert.deepEqual(spellUpdates['characterBuild/spellSelectionIndex'], {
  fire_bolt: true,
  message: true,
  shield: true,
});
assert.equal(spellUpdates['characterBuild/spellLoadoutSource'], 'dm_loadout_manager');

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = fs.readFileSync(path.join(here, '..', 'js', 'dm-player-dnd-studio.js'), 'utf8');
const tabs = fs.readFileSync(path.join(here, '..', 'js', 'dm-player-dnd-studio-tabs.js'), 'utf8');
const manager = fs.readFileSync(path.join(here, '..', 'js', 'dm-player-loadout-manager.js'), 'utf8');
const skillLoadout = fs.readFileSync(path.join(here, '..', 'js', 'combat-skill-loadout-074.js'), 'utf8');
const playerEntry = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-player-entry-074.js'), 'utf8');

assert.match(studio, /dm-player-dnd-studio-tabs\.js/);
assert.match(studio, /dm-player-loadout-manager\.js/);
assert.match(tabs, /EXPERIENCIA/);
assert.match(tabs, /CLASE \/ BUILD/);
assert.match(tabs, /STATS \/ SKILLS/);
assert.match(tabs, /COMBATE/);
assert.match(tabs, /LOADOUT/);
assert.match(tabs, /id = "dm-player-loadout-host"|loadoutHost\.id = "dm-player-loadout-host"/);
assert.match(manager, /GUARDAR DECK/);
assert.match(manager, /GUARDAR SPELLS/);
assert.match(manager, /campaña\/base_datos_skills/);
assert.match(manager, /campaña\/base_datos_unidades/);
assert.match(skillLoadout, /characterBuild\?\.skillDeck/);
assert.match(playerEntry, /hasPlayerManagedSkillLoadout/);
assert.match(playerEntry, /playerSkillSlots\.length \? raw : sourceUnit/);

// Active Encounter snapshots must be updated independently from Player/Unit records.
const deployed = {
  'player:alice': { isPlayer: true, canonicalPlayerKey: 'alice', canonicalOwnerUid: 'uid-a' },
  enemy_1: { category: 'enemy', playerId: 'alice' },
  'player:bob': { isPlayer: true, canonicalPlayerKey: 'bob', canonicalOwnerUid: 'uid-b' },
};
assert.deepEqual(core.activeCombatantForPlayer('alice', deployed, 'uid-a'), {
  ok: true, reason: null, key: 'player:alice',
});
assert.equal(core.activeCombatantForPlayer('alice', deployed, 'wrong-uid').reason, 'NOT_DEPLOYED');
assert.equal(core.activeCombatantForPlayer('alice', {}, 'uid-a').reason, 'NOT_DEPLOYED');
assert.equal(core.activeCombatantForPlayer('alice', {
  a: { isPlayer: true, playerId: 'alice' },
  b: { isPlayer: true, ownerPlayerId: 'alice' },
}).reason, 'AMBIGUOUS_ACTIVE_COMBATANTS');
assert.match(manager, /syncDeployedCombatantUpdates\(unitUpdates, selection\)/);
assert.match(manager, /syncDeployedCombatantUpdates\(updates, selection\)/);
assert.match(manager, /campaña\/combate\/combatants/);
assert.doesNotMatch(manager, /COMBATE USARÁ EL LOADOUT CANÓNICO/);

const writes = [];
const deckFeedback = { textContent: "" };
const spellFeedback = { textContent: "" };
const deckFields = {
  "dm-loadout-tier-1": { value: "skill_t1" },
  "dm-loadout-tier-2": { value: "skill_t2" },
  "dm-loadout-tier-3": { value: "skill_t3" },
  "dm-loadout-deck-feedback": deckFeedback,
  "dm-loadout-spell-feedback": spellFeedback,
  "dm-loadout-save-deck": { disabled: false },
  "dm-loadout-save-spells": { disabled: false },
};
let deployedCombatants = {
  "player:alice": { isPlayer: true, canonicalPlayerKey: "alice", canonicalOwnerUid: "uid-a", skillIds: [] },
  "player:bob": { isPlayer: true, canonicalPlayerKey: "bob", canonicalOwnerUid: "uid-b", skillIds: [] },
  enemy: { category: "enemy", skillIds: ["claw"] },
};
const fakeDb = {
  ref(refPath) {
    return {
      async update(updates) { writes.push({ path: refPath, updates: structuredClone(updates) }); },
      async once() { return { val() { return structuredClone(deployedCombatants); } }; },
    };
  },
};
const sandboxWindow = {
  document: {
    readyState: "loading",
    addEventListener() {},
    getElementById(id) { return deckFields[id] || null; },
  },
  LuminousDmPlayerLoadoutCore: core,
  LuminousSpellLoadout: globalThis.LuminousSpellLoadout,
  LuminousCombatSkillLoadout074: {
    resolvePlayerUnit() { return { ok: true, unitId: "unit-alice" }; },
  },
  addEventListener() {},
  console,
};
runInNewContext(manager, { window: sandboxWindow });
const liveManager = sandboxWindow.LuminousDmPlayerLoadoutManager;
assert.ok(liveManager, "Real DM manager should be initialized without UI boot");
liveManager.state.db = fakeDb;
liveManager.state.playerId = "alice";
liveManager.state.player = { uid: "uid-a" };
liveManager.state.skills = skills;
liveManager.state.units = { "unit-alice": { isPlayer: true } };
assert.equal(await liveManager.saveDeck(), true);
assert.deepEqual(writes.map((write) => write.path), [
  "campaña/jugadores/alice", "campaña/base_datos_unidades/unit-alice",
  "campaña/combate/combatants/player:alice",
], "Save Deck must update the deployed Player, not just the Player/Unit Library");
assert.deepEqual(writes[2].updates.skillSlotIds, validDeck.skillSlotIds);
assert.deepEqual(writes[2].updates.equippedSkillIndex, validDeck.equippedSkillIndex);
assert.ok(!writes.some((write) => write.path.includes("player:bob") || write.path.endsWith("/enemy")));
assert.equal(deckFeedback.textContent, "SKILLS ACTUALIZADAS EN EL COMBATE");

writes.length = 0;
liveManager.state.selectedSpellIds = new Set(["shield", "message"]);
assert.equal(await liveManager.saveSpells(), true);
assert.deepEqual(writes.map((write) => write.path), [
  "campaña/jugadores/alice", "campaña/base_datos_unidades/unit-alice",
  "campaña/combate/combatants/player:alice",
]);
assert.equal(writes[2].updates["characterBuild/spellLoadoutSource"], "dm_loadout_manager");
assert.equal(spellFeedback.textContent, "SPELLS ACTUALIZADOS EN EL COMBATE");

writes.length = 0;
deployedCombatants = {};
assert.equal(await liveManager.saveDeck(), true, "Pre-deployment saves remain supported");
assert.deepEqual(writes.map((write) => write.path), [
  "campaña/jugadores/alice", "campaña/base_datos_unidades/unit-alice",
], "Build editor must not create phantom Combatants while no Encounter exists");
assert.match(deckFeedback.textContent, /PRÓXIMO COMBATE/);

// Changing the selected character during asynchronous Firebase writes must
// not redirect the remainder of a Save Deck to someone else's Unit/Combatant.
writes.length = 0;
deployedCombatants = {
  "player:alice": { isPlayer: true, canonicalPlayerKey: "alice", canonicalOwnerUid: "uid-a" },
  "player:bob": { isPlayer: true, canonicalPlayerKey: "bob", canonicalOwnerUid: "uid-b" },
};
liveManager.state.playerId = "alice";
liveManager.state.player = { uid: "uid-a" };
const previousUpdate = fakeDb.ref.bind(fakeDb);
fakeDb.ref = function(path) {
  const ref = previousUpdate(path);
  if (path === "campaña/jugadores/alice") {
    const oldUpdate = ref.update;
    ref.update = async function(value) {
      await oldUpdate(value);
      liveManager.state.playerId = "bob";
      liveManager.state.player = { uid: "uid-b" };
    };
  }
  return ref;
};
assert.equal(await liveManager.saveDeck(), true);
assert.deepEqual(writes.map((write) => write.path), [
  "campaña/jugadores/alice", "campaña/base_datos_unidades/unit-alice",
  "campaña/combate/combatants/player:alice",
], "Mid-save selection changes must never redirect Skills into another Player");
assert.equal(deckFeedback.textContent, "SKILLS ACTUALIZADAS EN EL COMBATE");

console.log('dm-player-loadout-manager-smoke: ok');
