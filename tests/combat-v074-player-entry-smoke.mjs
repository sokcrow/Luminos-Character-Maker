import assert from 'node:assert/strict';

await import('../js/combat-skill-schema.js');
await import('../js/skill-catalog-player-signature.js');
await import('../js/combat-skill-loadout-074.js');
await import('../js/spell-catalog-core.js');
await import('../js/role-spell-catalog-core.js');
await import('../js/vtt/actor-library.js');
const actorLibrary = globalThis.LuminousVttActorLibrary;
if (!actorLibrary) throw new Error('LuminousVttActorLibrary was not initialized.');

await import('../js/battle-viewer-player-entry-074.js');
const playerEntry = globalThis.LuminousBattleViewerPlayerEntry074;
if (!playerEntry) throw new Error('LuminousBattleViewerPlayerEntry074 was not initialized.');

assert.equal(playerEntry.version, '0.7.4');
assert.equal(playerEntry.ROOTS.players, 'campaña/jugadores');
assert.equal(playerEntry.ROOTS.actors, 'campaña/actores');
assert.equal(playerEntry.ROOTS.units, 'campaña/base_datos_unidades');
assert.equal(playerEntry.ROOTS.skills, 'campaña/base_datos_skills');
assert.equal(playerEntry.ROOTS.combatants, 'campaña/combate/combatants');
assert.deepEqual(playerEntry.buildActionSlotIndex(1), { 0: true });
assert.deepEqual(playerEntry.buildActionSlotIndex(4), { 0: true, 1: true, 2: true, 3: true });

const players = {
  player_1: {
    uid: 'uid-player-1',
    actorId: 'actor_jeske',
    characterName: 'Jeske Player Record',
  },
};
const actors = {
  actor_jeske: {
    id: 'actor_jeske',
    characterName: 'Jeske',
    icono: 'https://example.test/jeske.png',
    maxHp: 120,
    hp: 93,
    sp: 15,
    actionSlots: 2,
    stats: { fuerza: 14, destreza: 18 },
  },
};
const units = {
  unit_jeske: {
    id: 'unit_jeske',
    isPlayer: true,
    name: 'Jeske Combat Unit',
    linkedPlayerUID: 'uid-player-1',
    action_slots: ['skill_a', 'skill_b', 'skill_a'],
  },
};
const skills = {
  skill_a: {
    name: 'Canonical Skill A', type: 'Attack', tier: 1,
    basePower: 6, coinPower: 3, coinAmount: 2,
    damageType: 'cortante', sinAffinity: 'wrath', effects: [], coins: [{ effects: [] }, { effects: [] }], schemaVersion: 2,
  },
  skill_b: {
    name: 'Canonical Skill B', type: 'Attack', tier: 1,
    basePower: 5, coinPower: 4, coinAmount: 1,
    damageType: 'perforante', sinAffinity: 'pride', effects: [], coins: [{ effects: [] }], schemaVersion: 2,
  },
};

const [actor] = playerEntry.normalizePlayerActors(players, actors);
assert.ok(actor);
assert.equal(actor.scope, 'players');
assert.equal(actor.category, 'player');
assert.equal(actor.playerId, 'player_1');
assert.equal(actor.ownerUid, 'uid-player-1');
assert.equal(actor.linkedActorId, 'actor_jeske');
assert.equal(actor.icono, 'https://example.test/jeske.png');

const unitResolution = playerEntry.resolvePlayerUnit(actor, units);
assert.equal(unitResolution.ok, true);
assert.equal(unitResolution.unitId, 'unit_jeske');

const combatant = playerEntry.buildPlayerCombatant(actor, { now: 123456, units, skills, unitResolution });
assert.equal(combatant.id, 'player:player_1');
assert.equal(combatant.combatId, 'player:player_1');
assert.equal(combatant.name, 'Jeske Player Record');
assert.equal(combatant.actorCategory, 'player');
assert.equal(combatant.isPlayer, true);
assert.equal(combatant.playerId, 'player_1');
assert.equal(combatant.ownerPlayerId, 'player_1');
assert.equal(combatant.ownerUid, 'uid-player-1');
assert.equal(combatant.actorId, 'actor_jeske');
assert.deepEqual(combatant.actorRef, { scope: 'players', id: 'player_1' });
assert.deepEqual(combatant.unitRef, { scope: 'units', id: 'unit_jeske' });
assert.equal(combatant.canonicalScope, 'player');
assert.equal(combatant.canonicalPlayerKey, 'player_1');
assert.equal(combatant.canonicalOwnerUid, 'uid-player-1');
assert.deepEqual(combatant.characterLink, {
  mode: 'player',
  uid: 'uid-player-1',
  playerId: 'player_1',
  actorId: 'actor_jeske',
});
assert.equal(combatant.dynamicActorToken, false);
assert.equal(combatant.icono, 'https://example.test/jeske.png');
assert.equal(combatant.maxHp, 120);
assert.equal(combatant.hp, 93);
assert.equal(combatant.sp, 15);
assert.equal(combatant.actionSlots, 2);
assert.equal(combatant.activeSlots, 2);
assert.deepEqual(combatant.actionSlotIndex, { 0: true, 1: true });
assert.deepEqual(combatant.skillSlotIds, ['skill_a', 'skill_b', 'skill_a']);
assert.deepEqual(combatant.skillIds, ['skill_a', 'skill_b']);
assert.deepEqual(combatant.equippedSkillIndex, { skill_a: true, skill_b: true });
assert.equal(combatant.skillLoadoutState, 'ready');
assert.deepEqual(combatant.skillLoadoutMissingIds, []);
assert.deepEqual(combatant.skillLoadoutInvalidIds, []);
assert.equal(Object.hasOwn(combatant, 'skillsById'), false, 'full Skill definitions must not be persisted on combatants');
assert.equal(Object.hasOwn(combatant, 'skills'), false, 'full Skill definitions must remain ephemeral');
assert.equal(combatant.enteredCombatAt, 123456);
assert.equal(combatant.entrySource, 'dm_player_entry_074');

const noUnitCombatant = playerEntry.buildPlayerCombatant(actor, { now: 123457, units: {}, skills });
assert.equal(noUnitCombatant.skillLoadoutState, 'unit_not_found');
assert.deepEqual(noUnitCombatant.skillSlotIds, []);
assert.deepEqual(noUnitCombatant.skillIds, []);
assert.deepEqual(noUnitCombatant.equippedSkillIndex, {});
assert.equal(noUnitCombatant.unitRef, undefined);

assert.equal(playerEntry.playerAlreadyInCombat(actor, {}), null);
const existing = playerEntry.playerAlreadyInCombat(actor, {
  legacy_key: {
    name: 'Jeske',
    playerId: 'player_1',
    actorId: 'actor_jeske',
    ownerUid: 'uid-player-1',
  },
});
assert.ok(existing);
assert.equal(existing.key, 'legacy_key');

const entries = playerEntry.playerEntries(players, actors, {
  'player:player_1': combatant,
}, units, skills);
assert.equal(entries.length, 1);
assert.equal(entries[0].linked, true);
assert.equal(entries[0].existing.key, 'player:player_1');
assert.equal(entries[0].unitResolution.unitId, 'unit_jeske');
assert.equal(entries[0].loadout.ready, true);
assert.deepEqual(entries[0].loadout.skillIds, ['skill_a', 'skill_b']);

const unlinkedPlayer = actorLibrary.normalizePlayerActor('player_2', { uid: 'uid-player-2', characterName: 'No Actor' }, {});
assert.equal(unlinkedPlayer.linkedActorId, null);
assert.throws(() => playerEntry.buildPlayerCombatant(unlinkedPlayer), /PLAYER_ACTOR_LINK_REQUIRED/);

const writes = [];
const fakeDb = {
  ref(path) {
    return {
      async transaction(updater) {
        const next = updater(null);
        writes.push({ path, next });
        return { committed: true, snapshot: { val: () => next } };
      },
    };
  },
};
const addResult = await playerEntry.addPlayerActor(actor, { db: fakeDb, combatants: {}, units, skills, now: 999 });
assert.equal(addResult.added, true);
assert.equal(addResult.key, 'player:player_1');
assert.equal(writes.length, 1);
assert.equal(writes[0].path, 'campaña/combate/combatants/player:player_1');
assert.equal(writes[0].next.ownerUid, 'uid-player-1');
assert.equal(writes[0].next.actorId, 'actor_jeske');
assert.equal(writes[0].next.enteredCombatAt, 999);
assert.deepEqual(writes[0].next.actionSlotIndex, { 0: true, 1: true });
assert.deepEqual(writes[0].next.unitRef, { scope: 'units', id: 'unit_jeske' });
assert.deepEqual(writes[0].next.skillSlotIds, ['skill_a', 'skill_b', 'skill_a']);
assert.deepEqual(writes[0].next.skillIds, ['skill_a', 'skill_b']);
assert.deepEqual(writes[0].next.equippedSkillIndex, { skill_a: true, skill_b: true });
assert.equal(Object.hasOwn(writes[0].next, 'skillsById'), false);

const duplicateResult = await playerEntry.addPlayerActor(actor, {
  db: fakeDb,
  combatants: { existing: combatant },
  units,
  skills,
});
assert.equal(duplicateResult.added, false);
assert.equal(duplicateResult.reason, 'already_in_combat');
assert.equal(writes.length, 1, 'duplicate detection must avoid a second Firebase write');

const ambiguousResult = await playerEntry.addPlayerActor(actor, {
  db: fakeDb,
  combatants: {},
  skills,
  units: {
    unit_a: { isPlayer: true, linkedPlayerUID: 'uid-player-1', action_slots: ['skill_a'] },
    unit_b: { isPlayer: true, linkedPlayerUID: 'uid-player-1', action_slots: ['skill_b'] },
  },
});
assert.equal(ambiguousResult.added, false);
assert.equal(ambiguousResult.reason, 'ambiguous_player_unit');
assert.equal(writes.length, 1, 'ambiguous Unit linkage must not write a combatant');


const combatSpellCatalog = globalThis.LuminousSpellCatalog;
const roleSpellCatalog = globalThis.LuminousRoleSpellCatalog;

const calipsysLoadout = playerEntry.knownSpellLoadoutForActor({ playerId: 'Calipsys', name: 'Calipsys', raw: {} });
assert.ok(calipsysLoadout);
assert.equal(calipsysLoadout.id, 'calipsys');
assert.deepEqual(calipsysLoadout.combatSpellIds, [
  'fire_bolt', 'absorb_elements', 'thunderwave', 'calm_emotions', 'mirror_image',
]);
assert.equal(calipsysLoadout.spellCastOverrides.calm_emotions.abilityId, 'cha');

const pierreLoadout = playerEntry.knownSpellLoadoutForActor({
  playerId: 'pierre',
  name: 'Pierre Carême Kikunae - wizza',
  raw: {},
});
assert.ok(pierreLoadout);
assert.equal(pierreLoadout.id, 'pierre_careme_kikunae');
assert.deepEqual(pierreLoadout.roleSpellIds, ['message', 'thaumaturgy']);

const angeloLoadout = playerEntry.knownSpellLoadoutForActor({ playerId: 'angelo', name: 'Angelo V.', raw: {} });
assert.ok(angeloLoadout);
assert.equal(angeloLoadout.id, 'angelo_v');
assert.equal(angeloLoadout.spellCastOverrides.mirror_image.classId, 'bard');

for (const loadout of playerEntry.KNOWN_PLAYER_SPELL_LOADOUTS) {
  for (const spellId of loadout.combatSpellIds) assert.ok(combatSpellCatalog[spellId], `known Player combat spell must be canonical: ${loadout.id}/${spellId}`);
  for (const spellId of loadout.roleSpellIds) assert.ok(roleSpellCatalog[spellId], `known Player role spell must be canonical: ${loadout.id}/${spellId}`);
}

const placeholderRecord = {
  spellIds: ['placeholder_spell'],
  spellSelections: ['placeholder_spell'],
  spellSelectionIndex: { placeholder_spell: true },
  characterBuild: {
    spellIds: ['placeholder_spell'],
    spellSelections: ['placeholder_spell'],
    spellSelectionIndex: { placeholder_spell: true },
  },
};
const cleanedCalipsys = playerEntry.applyKnownSpellLoadoutToRecord(placeholderRecord, calipsysLoadout);
assert.equal(cleanedCalipsys.spellIds.includes('placeholder_spell'), false);
assert.equal(cleanedCalipsys.spellSelections.includes('placeholder_spell'), false);
assert.equal(cleanedCalipsys.characterBuild.spellSelections.includes('placeholder_spell'), false);
assert.deepEqual(cleanedCalipsys.characterBuild.spellSelections, calipsysLoadout.combatSpellIds);
assert.deepEqual(cleanedCalipsys.characterBuild.roleSpellSelections, []);

const spellSyncWrites = [];
const spellSyncDb = {
  ref(path) {
    return {
      async update(patch) {
        spellSyncWrites.push({ path, patch });
      },
    };
  },
};
const pierreActor = {
  category: 'player',
  playerId: 'Pierre Carême Kikunae',
  sourceId: 'Pierre Carême Kikunae',
  name: 'Pierre Carême Kikunae - wizza',
  raw: { characterBuild: { spellSelections: ['old_placeholder'] } },
};
const pierreSync = await playerEntry.syncKnownPlayerSpellLoadout(pierreActor, {
  db: spellSyncDb,
  players: { 'Pierre Carême Kikunae': pierreActor.raw },
  combatants: {},
});
assert.equal(pierreSync.matched, true);
assert.equal(pierreSync.synced, true);
assert.equal(spellSyncWrites.length, 1);
assert.equal(spellSyncWrites[0].path, 'campaña/jugadores/Pierre Carême Kikunae');
assert.deepEqual(spellSyncWrites[0].patch['characterBuild/spellSelections'], pierreLoadout.combatSpellIds);
assert.equal(spellSyncWrites[0].patch['characterBuild/spellSelections'].includes('old_placeholder'), false);


const angeloSignature = playerEntry.knownSkillLoadoutForActor({ playerId: 'angelo', name: 'Angelo V.', raw: {} });
assert.ok(angeloSignature);
assert.equal(angeloSignature.id, 'angelo_v');
assert.deepEqual(angeloSignature.skillSlotIds, [
  'angelo_steps_to_perfection',
  'angelo_blood_art',
  'angelo_my_masterpiece',
]);

const angeloActor = {
  category: 'player',
  playerId: 'angelo',
  sourceId: 'angelo',
  ownerUid: 'uid-angelo',
  linkedActorId: 'actor_angelo',
  actorId: 'actor_angelo',
  name: 'Angelo V.',
  raw: { uid: 'uid-angelo', characterName: 'Angelo V.' },
};
const angeloUnits = {
  unit_angelo: {
    id: 'unit_angelo',
    isPlayer: true,
    linkedPlayerUID: 'uid-angelo',
    action_slots: ['legacy_skill'],
  },
};
const angeloSkills = {
  legacy_skill: {
    name: 'Legacy Skill', type: 'Attack', tier: 1,
    basePower: 4, coinPower: 4, coinAmount: 1,
    effects: [], coins: [{ effects: [] }], schemaVersion: 2,
  },
};
const angeloCombatant = playerEntry.buildPlayerCombatant(angeloActor, {
  now: 555,
  units: angeloUnits,
  skills: angeloSkills,
});
assert.deepEqual(angeloCombatant.skillSlotIds.slice(0, 3), angeloSignature.skillSlotIds);
assert.equal(angeloCombatant.skillSlotIds.includes('legacy_skill'), true, 'signature injection must preserve existing Unit skills');
for (const id of angeloSignature.skillSlotIds) assert.equal(angeloCombatant.equippedSkillIndex[id], true);

const signatureCatalog = globalThis.LuminousPlayerSignatureSkillCatalog;
for (const id of angeloSignature.skillSlotIds) assert.ok(signatureCatalog.get(id), `missing canonical Angelo skill ${id}`);

const signatureSyncWrites = [];
const signatureSyncDb = {
  ref(path) {
    return {
      async update(patch) { signatureSyncWrites.push({ path, patch }); },
    };
  },
};
const existingAngelo = {
  'player:angelo': {
    ...angeloCombatant,
    skillSlotIds: ['legacy_skill'],
    skillIds: ['legacy_skill'],
    equippedSkillIndex: { legacy_skill: true },
  },
};
const signatureSync = await playerEntry.syncKnownPlayerSkillLoadout(angeloActor, {
  db: signatureSyncDb,
  combatants: existingAngelo,
});
assert.equal(signatureSync.matched, true);
assert.equal(signatureSync.synced, true);
assert.equal(signatureSyncWrites.length, 1);
assert.equal(signatureSyncWrites[0].path, 'campaña/combate/combatants/player:angelo');
assert.deepEqual(signatureSyncWrites[0].patch.skillSlotIds.slice(0, 3), angeloSignature.skillSlotIds);
assert.equal(signatureSyncWrites[0].patch.equippedSkillIndex.angelo_my_masterpiece, true);

console.log('combat-v074-player-entry-smoke: ok');
