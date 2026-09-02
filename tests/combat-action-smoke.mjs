import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const schema = require('../js/combat-action-schema.js');
const adapters = require('../js/combat-action-adapters.js');

const actor = { id: 'a1' };
const skill = {
  id: 's1', name: 'Wide Slash', basePower: 4, coinPower: 3, coinAmount: 2,
  attackWeight: 3, isClashable: true, isIndiscriminate: false,
};
const action = adapters.compileSkillToCombatAction(actor, skill, { actionSlotId: 'a1_slot_0', targetId: 'e1', targetIds: ['e1','e2','e3'] });
assert.equal(action.economy.cost, 'action');
assert.equal(action.resolution.type, 'clash');
assert.equal(action.targeting.attackWeight, 3);
assert.equal(schema.canReceiveHelp(action), true);
const helped = schema.applyHelpModifier(action, { fromActorId: 'a2' });
assert.equal(helped.applied, true);
assert.equal(helped.action.modifiers.at(-1).amount, 1);

const saveSpell = { id: 'fire_wave', slotLevel: 3, targetType: 'area', attackWeight: 4, saveAbility: 'dexterity' };
const spellAction = adapters.compileSpellToCombatAction(actor, saveSpell, { saveDC: 15, classId: 'wizard', targetIds: ['e1','e2','e3','e4'] });
assert.equal(spellAction.resolution.type, 'save');
assert.equal(schema.canReceiveHelp(spellAction), false);
assert.equal(spellAction.resources[0].type, 'spell_slot');
assert.equal(spellAction.resources[0].metadata.slotLevel, 3);

const retreat = adapters.compileUniversalAction(actor, 'retreat');
assert.equal(retreat.phase.executesAt, 'on_turn_end');
assert.equal(retreat.effects[0].inheritActionSlotsCap, 2);
assert.equal(retreat.effects[0].healHp, false);

const escape = adapters.compileUniversalAction(actor, 'escape');
assert.equal(escape.effects[0].deniesXp, true);
const cancelled = schema.cancelCombatAction(escape, { type: 'stagger' });
assert.equal(cancelled.action.state, 'cancelled');
assert.equal(cancelled.action.cancelReason.type, 'stagger');

const preparedReaction = adapters.compileReactionToCombatAction(actor, { id: 'counter', sourceType: 'trait', uses: 1 }, { mode: 'prepared', trigger: { type: 'on_targeted' } });
assert.equal(preparedReaction.economy.cost, 'reaction');
assert.equal(preparedReaction.phase.selectedAt, 'planning_phase_player');
assert.equal(preparedReaction.phase.executesAt, 'combat_phase');
assert.equal(preparedReaction.reaction.mode, 'prepared');
assert.equal(preparedReaction.resources[0].type, 'trait_use');

const indiscriminate = adapters.compileSkillToCombatAction(actor, { id:'wild', attackWeight:3, isIndiscriminate:true, isClashable:true });
const selection = schema.resolveTargetSelection(indiscriminate, [{id:'e1'},{id:'e2'},{id:'e3'},{id:'e4'}], { random: () => 0 });
assert.deepEqual(selection.targetIds, ['e1','e2','e3']);

const aoeOutcomeWin = schema.resolveAoeOutcome(action, true);
assert.equal(aoeOutcomeWin.mode, 'direct_secondary_hits');
const aoeOutcomeLose = schema.resolveAoeOutcome(action, false);
assert.equal(aoeOutcomeLose.allowed, false);
const saveOutcome = schema.resolveAoeOutcome(spellAction, false);
assert.equal(saveOutcome.mode, 'independent_saves');

console.log('combat-action smoke: ok');
