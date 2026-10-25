import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/spell-catalog-core.js');
await import('../js/role-spell-catalog-core.js');
await import('../js/spell-loadout-core.js');
await import('../js/dm-player-loadout-core.js');
await import('../js/build-equipment-catalog.js');
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

// Existing item catalog is the single source for all six weapon/mode presets.
const authored = globalThis.LuminousBuildSkillCatalog.DEFINITIONS;
const gear = globalThis.LuminousBuildWeaponCatalog;
const equipmentPresets = core.equipmentDeckPresets(gear, authored);
assert.equal(equipmentPresets.length, 6, 'Jeske 2 + Calipsys 4 weapon Decks');
assert.deepEqual(equipmentPresets.map(p => p.id).sort(), [
  'equipment_calipsys_fourfold_gauntlets_bleed',
  'equipment_calipsys_fourfold_gauntlets_burn',
  'equipment_calipsys_fourfold_gauntlets_chill',
  'equipment_calipsys_fourfold_gauntlets_tremor',
  'equipment_jeske_poise_blade_sword',
  'equipment_jeske_poise_revolver_revolver',
].sort());
for (const preset of equipmentPresets) {
  const validity = core.validateDeck(preset.deck, authored);
  assert.equal(validity.valid, true, preset.id + ': ' + validity.errors.join(', '));
  assert.equal(validity.skillSlotIds.length, 6);
  assert.equal(gear.get(preset.definitionId).runtime.buildLoadouts.modes[preset.modeId].deck.tier1,
    preset.deck.tier1, 'Preset references authored weapon mode directly');
}
assert.equal(equipmentPresets.some(p => p.deck.tier1 === 'jeske_shield_bash'), false,
  'Off-deck Shield Bash cannot enter the weapon presets');
assert.equal(equipmentPresets.some(p => p.deck.tier1 === 'jeske_clashable_guard'), false);
assert.equal(core.equipmentDeckPresets(gear, {}).length, 6,
  'Preset definitions remain discoverable before skill library finishes loading');
assert.equal(core.equipmentDeckPresets(gear, {unrelated:{id:'unrelated',tier:1}}).length, 0,
  'Incomplete Skill catalogs cannot publish presets that fail validation');

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
const loadoutStyle = fs.readFileSync(path.join(here, '..', 'css', 'dm-player-loadout-manager.css'), 'utf8');
const skillLoadout = fs.readFileSync(path.join(here, '..', 'js', 'combat-skill-loadout-074.js'), 'utf8');
const playerEntry = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-player-entry-074.js'), 'utf8');

assert.match(studio, /dm-player-dnd-studio-tabs\.js/);
assert.match(studio, /dm-player-loadout-manager\.js/);
assert.ok(studio.includes('js/dm-player-loadout-manager.js?v=20261024-deck-presets-1'),
  'Studio must load the current preset manager, not a stale cached script');
assert.ok(studio.includes('js/dm-player-loadout-core.js?v=20261024-deck-presets-1'));
assert.match(loadoutStyle, /min-height:44px/, 'Mobile Deck controls remain touch-friendly');
assert.match(manager, /optgroup label="Armas y modos de combate"/);
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
  "dm-loadout-preset-select": { value: "" },
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
  LuminousPlayerSignatureSkillCatalog: presetCatalog,
  LuminousBuildWeaponCatalog: gear,
  LuminousBuildSkillCatalog: globalThis.LuminousBuildSkillCatalog,
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

// Test the actual DM manager interaction: dropdown -> Apply -> Tier I/II/III
// -> Save to the selected player + Unit + deployed Combatant (not any other player).
const visiblePresets = liveManager.presetEntries();
assert.equal(visiblePresets.filter(p => p.source === 'equipment').length, 6);
assert.equal(visiblePresets.filter(p => p.id === 'test_build').length, 1,
  'Existing character presets survive the equipment integration');
deckFields['dm-loadout-preset-select'].value = 'equipment_calipsys_fourfold_gauntlets_chill';
liveManager.applyPreset();
assert.equal(deckFields['dm-loadout-tier-1'].value, 'calipsys_chill_i');
assert.equal(deckFields['dm-loadout-tier-2'].value, 'calipsys_chill_ii');
assert.equal(deckFields['dm-loadout-tier-3'].value, 'calipsys_chill_iii');
assert.match(deckFeedback.textContent, /ARMA CARGADO/);
writes.length = 0;
liveManager.state.playerId = 'alice';
liveManager.state.player = { uid: 'uid-a', characterBuild: { learnedSkillIds: ['learned_before'] } };
assert.equal(await liveManager.saveDeck(), true);
assert.deepEqual(writes.map(w => w.path), [
  'campaña/jugadores/alice', 'campaña/base_datos_unidades/unit-alice',
  'campaña/combate/combatants/player:alice',
], 'Saving selected Build preset retains Player, Unit and Combatant synchronization');
assert.deepEqual(writes[0].updates.skillSlotIds, [
  'calipsys_chill_i','calipsys_chill_i','calipsys_chill_i',
  'calipsys_chill_ii','calipsys_chill_ii','calipsys_chill_iii',
]);
assert.equal(writes[0].updates['characterBuild/learnedSkillIds'], undefined,
  'Saving a Deck must not erase previously learned Skills');
assert.match(deckFeedback.textContent, /DECK BASE/);
assert.match(deckFeedback.textContent, /ARMA EQUIPADA/);
assert.ok(!writes.some(w => w.path.includes('player:bob') || w.path.endsWith('/enemy')));

console.log('dm-player-loadout-manager-smoke: ok');
