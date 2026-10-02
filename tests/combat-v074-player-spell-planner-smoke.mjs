import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/content-registry.js');
await import('../js/content-registry-bootstrap.js');
await import('../js/spell-catalog-core.js');
const canonicalSpellCatalog = globalThis.LuminousSpellCatalog;
await import('../js/spellcasting-runtime.js');
await import('../js/spellcasting-basic-rules-runtime.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-spell-loadout-074.js');
await import('../js/deckEngine.js');
await import('../js/battle-viewer-ownership-074.js');

const registry = globalThis.LuminousContentRegistry;
const loadout = globalThis.LuminousCombatSpellLoadout074;
const spellcasting = globalThis.LuminousSpellcastingRuntime;
assert.ok(registry && loadout && spellcasting?.__basicRulesV1);

registry.clear({ type: 'spell' });
registry.register({
  type: 'spell',
  id: 'arc_bolt',
  name: 'Arc Bolt',
  sourceKey: 'test-spells',
  definition: {
    id: 'arc_bolt',
    name: 'Arc Bolt',
    kind: 'spell',
    level: 1,
    sourceClassId: 'sorcerer',
    basePower: 5,
    coinPower: 3,
    coinAmount: 2,
    damageType: 'force',
    concentration: true,
    effects: [{ type: 'test_spell_effect', amount: 2 }],
    upcast: { coinPowerPerLevel: 1 },
  },
});
registry.register({
  type: 'spell', id: 'other_spell', name: 'Other Spell', sourceKey: 'test-spells',
  definition: { id: 'other_spell', name: 'Other Spell', kind: 'spell', level: 1, sourceClassId: 'sorcerer', basePower: 3, coinPower: 2, coinAmount: 1 },
});
registry.register({
  type: 'spell', id: 'mode_spell', name: 'Mode Spell', sourceKey: 'test-spells',
  definition: {
    id: 'mode_spell', name: 'Mode Spell', kind: 'spell', level: 0, cantrip: true, sourceClassId: 'sorcerer',
    targetType: 'single', isUnclashable: true,
    mechanics: { requiresChoice: { key: 'mode', values: ['alpha','beta'] } },
  },
});
registry.register({
  type: 'spell', id: 'slot_smite', name: 'Slot Smite', sourceKey: 'test-spells',
  definition: {
    id: 'slot_smite', name: 'Slot Smite', kind: 'spell', level: 1, sourceClassId: 'sorcerer',
    school: 'evocation', targetType: 'action_slot', targetingType: 'action_slot', castingTime: 'quick_action',
    mechanics: { slotEnchantment: { id: 'slot_smite', requires: { meleeOrUnarmedAttackSkill: true } } },
  },
});

const actor = {
  id: 'player:player_a', combatId: 'player:player_a', isPlayer: true, actorCategory: 'player', canonicalScope: 'player',
  canonicalPlayerKey: 'player_a', canonicalOwnerUid: 'uid-a', playerId: 'player_a', ownerUid: 'uid-a',
  actionSlots: 1, activeSlots: 1, actionSlotIndex: { '0': true },
  characterBuild: { classes: [{ classId: 'sorcerer', levels: 3 }], spellSelections: ['arc_bolt','mode_spell','slot_smite'] },
  skillDeck: {
    slots: {
      'player:player_a_slot_0': {
        hand: [
          { drawId: 'draw_melee', skillId: 'slash', tier: 1, skill: { id: 'slash', name: 'Slash', type: 'Normal', skillRange: 1, attackWeight: 1, atkWeight: 1 } },
          { drawId: 'draw_ranged', skillId: 'shot', tier: 1, skill: { id: 'shot', name: 'Shot', type: 'Normal', skillRange: 5, attackWeight: 1, atkWeight: 1, isRanged: true } },
        ],
      },
    },
  },
  sp: 30,
};

assert.deepEqual(loadout.spellIdsFor(actor), ['arc_bolt', 'mode_spell', 'slot_smite']);
assert.equal(loadout.ownsSpell(actor, 'arc_bolt'), true);
assert.equal(loadout.ownsSpell(actor, 'other_spell'), false);
const trusted = loadout.resolveSpellForCombatant(actor, 'arc_bolt');
assert.equal(trusted.ok, true);
assert.equal(trusted.classId, 'sorcerer');
assert.equal(trusted.spell.name, 'Arc Bolt');
assert.equal(loadout.resolveSpellForCombatant(actor, 'other_spell').reason, 'SPELL_NOT_SELECTED');
assert.equal(loadout.resolveSpellDefinition('missing_spell').reason, 'SPELL_DEFINITION_NOT_FOUND');

// The adapter must compile the Registry definition, never client-forged Spell data.
globalThis.combatData = {
  'player:player_a': actor,
  enemy_1: { id: 'enemy_1', actorCategory: 'enemy', hp: 100, maxHp: 100 },
};
globalThis.sharedPlannedActions = {};
globalThis.attackVectors = {};
await import('../js/battle-viewer-action-adapter-073.js');
await import('../js/battle-viewer-spell-adapter-074.js');
const adapter = globalThis.LuminousBattleViewerActionAdapter073;
assert.equal(adapter.__spellAdapter074, true);

const forged = {
  kind: 'spell', type: 'spell', spellId: 'arc_bolt', classId: 'sorcerer', slotLevel: 2, overcast: false,
  unitId: 'player:player_a', targetId: 'enemy_1', __ownerPlayerId: 'player_a',
  data: { id: 'arc_bolt', name: 'FORGED SPELL', level: 9, basePower: 999, coinPower: 999, coinAmount: 9, effects: [{ type: 'forged' }] },
};
const compiled = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', forged);
assert.ok(compiled.action, compiled.reason || 'trusted Spell should compile');
assert.equal(compiled.action.source.type, 'spell');
assert.equal(compiled.action.source.id, 'arc_bolt');
assert.equal(compiled.action.metadata.canonicalSpell, true);
assert.equal(compiled.action.metadata.sourceDefinition.name, 'Arc Bolt');
assert.equal(compiled.action.metadata.sourceDefinition.basePower, 5);
assert.notEqual(compiled.action.metadata.sourceDefinition.basePower, 999);
assert.equal(compiled.action.resources.length, 1);
assert.equal(compiled.action.resources[0].type, 'spell_slot');
assert.equal(compiled.action.resources[0].id, 'sorcerer');
assert.equal(compiled.action.resources[0].metadata.slotLevel, 2);
assert.equal(compiled.action.effects[0].type, 'viewer_spell_cast');
assert.equal(compiled.action.metadata.sourceDefinition.coinPower, 4, 'Level 2 cast should apply one canonical Coin Power upcast level');


const modeCompiled = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', {
  kind:'spell', spellId:'mode_spell', classId:'sorcerer', slotLevel:0, unitId:'player:player_a',
  targetId:'enemy_1', spellChoice:{key:'mode',value:'beta'}, __ownerPlayerId:'player_a',
});
assert.ok(modeCompiled.action, modeCompiled.reason || 'mode Spell should compile');
assert.deepEqual(modeCompiled.action.metadata.spellChoice,{key:'mode',value:'beta'});

const notSelected = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', { kind: 'spell', spellId: 'other_spell', classId: 'sorcerer', targetId: 'enemy_1', __ownerPlayerId: 'player_a' });
assert.equal(notSelected.action, null);
assert.equal(notSelected.reason, 'spell_not_selected');

const embedded = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', {
  kind: 'spell', spellId: 'arc_bolt', classId: 'sorcerer', __ownerPlayerId: 'player_a',
  combatAction: { actorId: 'player:player_a', source: { type: 'spell', id: 'arc_bolt' }, resolution: { type: 'automatic' }, phase: {} },
});
assert.equal(embedded.action, null);
assert.equal(embedded.reason, 'embedded_spell_action_forbidden');

// Overcast is represented through the existing spell_slot resource channel and bridged to SP/Fixed Damage.
await import('../js/battle-viewer-spell-runtime-074.js');
const spellRuntime = globalThis.LuminousBattleViewerSpellRuntime074;
assert.ok(spellRuntime);
const overcastPlan = { ...forged, slotLevel: 1, overcast: true, data: { basePower: 999 } };
const overcastAction = adapter.compilePlan('player:player_a_slot_0', 'enemy_1_slot_0', overcastPlan).action;
assert.match(overcastAction.resources[0].id, /^__overcast__/);
const parsed = spellRuntime.parseResourceClassId(overcastAction.resources[0].id);
assert.equal(parsed.overcast, true);
assert.equal(parsed.classId, 'sorcerer');
const spBefore = actor.sp;
const overcastSpent = globalThis.LuminousSpellcastingRuntime.spendSpellSlot(actor, overcastAction.resources[0].id, 1);
assert.equal(overcastSpent.success, true);
assert.equal(overcastSpent.consumed, true);
assert.equal(actor.sp, spBefore - 15);

const castHook = spellRuntime.spellCastEffect({ action: overcastAction, actor, effect: overcastAction.effects[0], context: {} });
assert.equal(castHook.resolved, true);
assert.equal(castHook.spellId, 'arc_bolt');
assert.ok(castHook.concentration, 'concentration Spell should start Concentration');

// Player planner writes only selected Spell references and cast choices.
await import('../js/battle-viewer-player-spell-planner-074.js');
const planner = globalThis.LuminousBattleViewerPlayerSpellPlanner074;
planner.applyPlayers({ player_a: { uid: 'uid-a', characterBuild: { spellSelections: ['arc_bolt','mode_spell','slot_smite'] } } });
planner.applyCombatants(globalThis.combatData);
planner.applyCombatState('PRE_COMBAT_PLANNING');
const built = planner.buildSpellPlan({ authUid: 'uid-a', ownerPlayerId: 'player_a', slotIndex: 0, spellId: 'arc_bolt', classId: 'sorcerer', slotLevel: 1, overcast: true, targetId: 'enemy_1' });
assert.equal(built.ok, true, built.reason);
assert.deepEqual(built.payload, {
  unitId: 'player:player_a', kind: 'spell', spellId: 'arc_bolt', spellSelectionKey: '0', classId: 'sorcerer', slotLevel: 1, overcast: true,
  targetId: 'enemy_1', status: 'planned', scheduledBy: 'player_a', schedulerUid: 'uid-a',
});
assert.equal('data' in built.payload, false);
assert.equal('spell' in built.payload, false);
assert.equal(planner.buildSpellPlan({ authUid: 'uid-a', ownerPlayerId: 'player_a', slotIndex: 0, spellId: 'other_spell', classId: 'sorcerer', slotLevel: 1, overcast: true, targetId: 'enemy_1' }).reason, 'SPELL_NOT_SELECTED');


const missingModeChoice = planner.buildSpellPlan({ authUid:'uid-a', ownerPlayerId:'player_a', slotIndex:0, spellId:'mode_spell', classId:'sorcerer', targetId:'enemy_1' });
assert.equal(missingModeChoice.reason,'SPELL_CHOICE_REQUIRED');
const modeBuilt = planner.buildSpellPlan({ authUid:'uid-a', ownerPlayerId:'player_a', slotIndex:0, spellId:'mode_spell', classId:'sorcerer', targetId:'enemy_1', spellChoiceValue:'alpha' });
assert.equal(modeBuilt.ok,true,modeBuilt.reason);
assert.deepEqual(modeBuilt.payload.spellChoice,{key:'mode',value:'alpha'});

const slotSmiteDefinition = loadout.resolveSpellForCombatant(actor, 'slot_smite').spell;
const slotHand = planner.slotHandOptions(actor, 'player:player_a_slot_0', slotSmiteDefinition);
assert.deepEqual(slotHand.map((row) => row.__deckCard.skillId), ['slash'], 'slot enchantment must only expose valid attack Skills from that Slot Hand');
const slotSmiteBuilt = planner.buildSpellPlan({
  authUid:'uid-a', ownerPlayerId:'player_a', slotIndex:0, slotId:'player:player_a_slot_0',
  spellId:'slot_smite', classId:'sorcerer', slotLevel:2, targetId:'enemy_1',
  enchantmentSkillId:'slash', enchantmentDrawId:'draw_melee'
});
assert.equal(slotSmiteBuilt.ok, true, slotSmiteBuilt.reason);
assert.equal(slotSmiteBuilt.payload.enchantmentSkillId, 'slash');
assert.equal(slotSmiteBuilt.payload.enchantmentDrawId, 'draw_melee');
assert.equal(slotSmiteBuilt.enchantmentCard.deckCard.slotId, 'player:player_a_slot_0');
const invalidRangedEnchant = planner.buildSpellPlan({
  authUid:'uid-a', ownerPlayerId:'player_a', slotIndex:0, slotId:'player:player_a_slot_0',
  spellId:'slot_smite', classId:'sorcerer', slotLevel:1, targetId:'enemy_1',
  enchantmentSkillId:'shot', enchantmentDrawId:'draw_ranged'
});
assert.equal(invalidRangedEnchant.reason, 'SLOT_ENCHANTMENT_SKILL_NOT_IN_HAND');

// Character-sheet grants may explicitly override the casting class and ability
// without broadening the canonical Spell's class list for every character.
for (const spellId of ['calm_emotions', 'mirror_image']) {
  const definition = canonicalSpellCatalog[spellId];
  registry.register({ type: 'spell', id: spellId, name: definition.name, sourceKey: 'canonical-sheet-spells', definition });
}
const calipsys = {
  id: 'player:calipsys', combatId: 'player:calipsys', isPlayer: true, actorCategory: 'player', canonicalScope: 'player',
  canonicalPlayerKey: 'calipsys', canonicalOwnerUid: 'uid-calipsys', playerId: 'calipsys', ownerUid: 'uid-calipsys',
  actionSlots: 1, activeSlots: 1, actionSlotIndex: { '0': true },
  stats: { inteligencia: 18, carisma: 12 },
  proficiency: 3,
  characterBuild: {
    classes: [{ classId: 'artificer', levels: 35 }],
    spellSelections: ['calm_emotions', 'mirror_image'],
    spellCastOverrides: {
      calm_emotions: { classId: 'artificer', abilityId: 'cha', source: 'lanae' },
      mirror_image: { classId: 'artificer', source: 'armorer' },
    },
  },
};
globalThis.combatData['player:calipsys'] = calipsys;
const calmGrant = loadout.resolveSpellForCombatant(calipsys, 'calm_emotions');
assert.equal(calmGrant.ok, true, calmGrant.reason);
assert.equal(calmGrant.classId, 'artificer');
assert.equal(calmGrant.castOverride.abilityId, 'cha');
assert.equal(calmGrant.spell.castAbilityId, 'cha');
const mirrorGrant = loadout.resolveSpellForCombatant(calipsys, 'mirror_image');
assert.equal(mirrorGrant.ok, true, mirrorGrant.reason);
assert.equal(mirrorGrant.classId, 'artificer');

const calmCompiled = adapter.compilePlan('player:calipsys_slot_0', 'enemy_1_slot_0', {
  kind: 'spell', spellId: 'calm_emotions', classId: 'artificer', slotLevel: 2,
  unitId: 'player:calipsys', targetId: 'enemy_1', __ownerPlayerId: 'calipsys',
});
assert.ok(calmCompiled.action, calmCompiled.reason || 'Lanae Calm Emotions should compile through the explicit grant');
assert.equal(calmCompiled.action.metadata.sourceClassId, 'artificer');
assert.equal(calmCompiled.action.metadata.spellDC, 12, 'Calm Emotions must use Calipsys CHA override, not Artificer INT');
assert.equal(calmCompiled.action.resources[0].id, 'artificer');

// Firebase Rules verify the selection array entry, not only a client-provided spellId.
const here = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8'));
const slotRules = rules.rules.campaña.combate.plannedActions.$ownerPlayerId.$slotIndex;
assert.match(slotRules['.write'], /kind.*spell/);
assert.match(slotRules['.write'], /spellSelectionKey/);
assert.match(slotRules['.validate'], /spellSelections/);
assert.match(slotRules['.validate'], /spellSelectionKey/);
assert.match(slotRules['.validate'], /slotLevel/);
assert.match(slotRules['.validate'], /overcast/);

const runtimeSource = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-runtime-074.js'), 'utf8');
assert.match(runtimeSource, /combat-spell-loadout-074\.js/);
assert.match(runtimeSource, /battle-viewer-spell-adapter-074\.js/);
assert.match(runtimeSource, /battle-viewer-spell-runtime-074\.js/);
assert.match(runtimeSource, /battle-viewer-player-spell-planner-074\.js/);

console.log('combat-v074-player-spell-planner-smoke: ok');
