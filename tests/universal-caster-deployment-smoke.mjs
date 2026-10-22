import assert from 'node:assert/strict';

// Generic spell integration: a custom Unit must not need a species-specific patch.
globalThis.window = globalThis;
await import('../js/content-registry.js');
await import('../js/content-registry-bootstrap.js');
await import('../js/spell-catalog-core.js');
await import('../js/spellcasting-runtime.js');
await import('../js/spellcasting-basic-rules-runtime.js');
await import('../js/combat-spell-loadout-074.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/unit-combat-instantiator.js');
await import('../js/universal-library-runtime.js');
await import('../js/combat-deployment-runtime.js');

const loadout = globalThis.LuminousCombatSpellLoadout074;
const casting = globalThis.LuminousSpellcastingRuntime;
const ai = globalThis.LuminousUnitAiKitAdapter;
const instantiator = globalThis.LuminousUnitCombatInstantiator;
const library = globalThis.LuminousUniversalLibrary;
const deploy = globalThis.LuminousCombatDeploymentRuntime;
assert.ok(loadout && casting?.canSpendSpellSlot && ai && instantiator && library && deploy);

const customMage = {
  id: 'forest_shaman', name: 'Forest Shaman', actorCategory: 'enemy',
  scores: { wis: 16, cha: 9 }, hp: 25, maxHp: 25,
  action_slots: ['forest_staff', 'spell:fire_bolt', 'spell:charm_person'],
  mechanics: {
    skills: ['forest_staff', 'spell:fire_bolt', 'spell:charm_person'],
    spellcasting: { ability: 'wisdom', spellSlots: { 1: 2 } },
  },
};
const migrated = library.unitWithLoadout(customMage);
assert.deepEqual(migrated.skillIds, ['forest_staff']);
assert.deepEqual(migrated.spellIds, ['fire_bolt', 'charm_person']);
assert.deepEqual(migrated.mechanics.skills, ['forest_staff']);

const summoned = instantiator.instantiate('forest_shaman', migrated, { faction: 'enemy', serial: 'test' });
assert.deepEqual(summoned.skillIds, ['forest_staff']);
assert.deepEqual(summoned.spellIds, ['fire_bolt', 'charm_person']);
assert.equal(loadout.canCastSpells(summoned), true);
assert.equal(loadout.resolveSpellForCombatant(summoned, 'fire_bolt').classId, 'innate');
assert.equal(loadout.resolveSpellForCombatant(summoned, 'charm_person').ok, true);
assert.equal(loadout.resolveSpellForCombatant(summoned, 'scorching_ray').reason, 'SPELL_NOT_SELECTED');
const slot = casting.canSpendSpellSlot(summoned, 'innate', 1);
assert.equal(slot.available, true, 'Custom NPC spell-slot table is authoritative');
assert.equal(slot.levelPool.maximum, 2);
assert.equal(casting.resolveSpellcasting(summoned, 'innate').spellMod, 3, 'NPC score is used for spellcasting');

// Combat AI reads trusted canonical definitions instead of treating Spells as Coin Skills.
const kit = ai.buildKit(summoned);
assert.ok(kit.sources.some(entry => entry.sourceType === 'spell' && entry.definition.id === 'fire_bolt'));
assert.ok(kit.sources.some(entry => entry.sourceType === 'spell' && entry.definition.id === 'charm_person'));
assert.equal(kit.sources.some(entry => entry.sourceType === 'spell' && entry.definition.id === 'scorching_ray'), false);

// The GOAP planner must actually emit a canonical Spell combat action, not just show a Spell in the Unit's data.
const cantripOnly = { ...summoned, spellIds: ['fire_bolt'], action_slots: [], skillIds: [], skillSlotIds: [],
  mechanics: { ...summoned.mechanics, skills: [] } };
const planned = ai.planUnitTurn({ actor: cantripOnly, targetIds: ['player:spell_dummy'], availableSlots: 1 });
assert.equal(planned.planned, true, 'A custom caster must be able to plan a combat turn');
assert.ok(planned.actions.some(action => action.source?.type === 'spell' && action.source?.id === 'fire_bolt'),
  'NPC casting must compile an executable Spell action');

assert.equal(casting.spendSpellSlot(summoned, 'innate', 1).spent, 1);
const backup = deploy.markBackup(summoned, { queueOrder: 1 });
const returned = deploy.markField(backup, { round: 2 });
assert.equal(casting.canSpendSpellSlot(returned, 'innate', 1).levelPool.available, 1, 'BACKUP return must not refill spell slots');
assert.deepEqual(returned.spellIds, ['fire_bolt', 'charm_person']);

const classedMage = {
  id: 'different_npc_wizard', actorCategory: 'enemy', classId: 'wizard',
  spellIds: ['fire_bolt', 'charm_person'], scores: { int: 18 },
  mechanics: { spellcasting: { ability: 'intelligence', spellSlots: { 1: 3 } } },
};
assert.equal(loadout.resolveSpellForCombatant(classedMage, 'charm_person').classId, 'wizard');
assert.equal(casting.canSpendSpellSlot(classedMage, 'wizard', 1).levelPool.maximum, 3);
assert.equal(loadout.resolveSpellForCombatant({ ...classedMage, classId: 'cleric' }, 'charm_person').ok, false, 'Class restrictions still apply');

const missing = loadout.hydrateSpellSelections({
  ...classedMage, spellIds: ['fire_bolt', 'missing_spell_test'],
});
assert.deepEqual(missing.missingIds, ['missing_spell_test']);
assert.equal(missing.ready, false);
assert.equal(missing.hasErrors, true);

// Player builds keep their own authority, including an intentionally empty selection.
const player = {
  isPlayer: true, actorCategory: 'player', classId: 'wizard',
  characterBuild: { spellSelections: [] }, action_slots: ['spell:fire_bolt'],
};
assert.deepEqual(loadout.rawSpellIdsFor(player), []);
assert.equal(loadout.resolveSpellForCombatant(player, 'fire_bolt').reason, 'SPELL_NOT_SELECTED');

const interval = globalThis.setInterval;
const addListener = globalThis.addEventListener;
globalThis.setInterval = () => 0;
globalThis.addEventListener = () => {};
await import('../js/combat-v073-dm-setup.js');
globalThis.setInterval = interval;
globalThis.addEventListener = addListener;
const dm = globalThis.LuminousCombatDmSetup073;
dm.state.players = {
  p1: { id: 'p1', uid: 'uid-p1', classId: 'wizard', characterBuild: { spellSelections: ['fire_bolt'] } },
  p2: { id: 'p2', uid: 'uid-p2', classId: 'wizard', characterBuild: { spellSelections: [] } },
};
dm.state.units = {};
dm.state.actors = {};
assert.deepEqual(dm.buildPlayer('p1', dm.state.players.p1).spellIds, ['fire_bolt']);
assert.deepEqual(dm.buildPlayer('p2', dm.state.players.p2).spellIds, []);

// The alternative DM 0.7.4 entry must use the same canonical FIELD/BACKUP authority.
await import('../js/battle-viewer-encounter-setup-074.js');
const setup = globalThis.LuminousBattleViewerEncounterSetup074;
let received = null;
globalThis.LuminousCombatSession = { deploy: async (args) => { received = args; return args.units; } };
const roster = await setup.deployLibraryUnit({
  scope: 'units', sourceId: 'forest_shaman', actorId: 'forest_shaman', name: 'Forest Shaman',
  raw: customMage,
}, 'enemy', 1, { db: { ref() {} } });
assert.equal(roster.length, 1);
assert.equal(received.units.length, 1);
assert.deepEqual(roster[0].spellIds, ['fire_bolt', 'charm_person']);
assert.deepEqual(roster[0].skillIds, ['forest_staff']);

console.log('Universal PC/NPC/innate Spell FIELD+BACKUP integration OK');
