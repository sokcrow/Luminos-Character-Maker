import assert from 'node:assert/strict';
await import('../js/unit-universal-action-policy.js');
const policy = globalThis.LuminousUnitUniversalActionPolicy;
assert.ok(policy, 'unit policy must load without browser or Firebase');
const {check,useInstant,snapshot}=policy;
const reserve=(...args)=>policy.reserve(...args);
const transition=(method,unit,options)=>policy[method](unit,{reservationId:unit[policy.STORE]?.reserved?.[options.phase]?.reservationId,...options});
const commit=(unit,options)=>transition('commit',unit,options),cancel=(unit,options)=>transition('cancel',unit,options);
const at = (round, slotId, other = {}) => ({round,slotId,...(other.targetId?{targetActionSlotId:`${other.targetId}_slot_0`}:{}),...other});

// Controller-agnostic: three Slots do not grant multiple Universal Actions
// in Combat Phase or Turn End. Different phases may coexist.
const npc = { id: 'npc-kobold-3', controlled: 'ai', actionSlots: 3 };
assert.equal(reserve(npc, 'calm', at(1, '0')).ok, true);
assert.equal(reserve(npc, 'liberate_strength', at(1, '1')).reason, 'universal_phase_reserved');
assert.equal(reserve(npc, 'grapple', at(1, '2')).reason, 'universal_phase_reserved');
assert.equal(reserve(npc, 'escape', at(1, '2')).ok, true);
assert.equal(commit(npc, { round: 1, phase: 'combat_phase', slotId: '0' }).ok, true);
assert.equal(reserve(npc, 'liberate', at(1, '1')).reason, 'universal_phase_spent');
assert.equal(commit(npc, { round: 1, phase: 'on_turn_end', slotId: '2' }).ok, true);
assert.equal(reserve(npc, 'retreat', at(1, '1')).reason, 'universal_phase_spent');
assert.equal(commit(npc, { round: 1, phase: 'on_turn_end', slotId: '2' }).reason, 'reservation_missing');
assert.equal(check(npc, 'calm', at(2, '0')).ok, true);
assert.equal(check(npc, 'calm', at(1, '0')).reason, 'stale_round');

// Player and AI use precisely the same Unit ledger and transitions.
const player = { id: 'player-ally', controlled: 'player', actionSlots: 3 };
assert.equal(reserve(player, 'help', at(3, '2', { targetId: 'friend-1' })).ok, true);
assert.equal(reserve(player, 'help', at(3, '1', { targetId: 'friend-2' })).reason, 'universal_phase_reserved');
assert.equal(cancel(player, { round: 3, phase: 'combat_phase', slotId: '1' }).reason, 'slot_mismatch');
assert.equal(cancel(player, { round: 3, phase: 'combat_phase', slotId: '2' }).ok, true);
assert.equal(reserve(player, 'help', at(3, '1', { targetId: 'friend-2' })).ok, true);
assert.equal(commit(player, { round: 3, phase: 'combat_phase', slotId: '1' }).ok, true);
assert.equal(check(player, 'help', at(3, '0', { targetId: 'friend-1' })).reason, 'universal_action_spent');
assert.equal(useInstant(player, 'analyse', { round: 3 }).ok, true);
assert.equal(useInstant(player, 'analyse', { round: 3 }).reason, 'universal_action_spent');
assert.equal(useInstant(player, 'find', { round: 3 }).ok, true);
assert.equal(useInstant(player, 'grapple', at(3, '0')).reason, 'universal_phase_spent');
assert.deepEqual(snapshot(player, { round: 3 }).ledger.helpTargets, ['friend-2']);
const restoredUnit = JSON.parse(JSON.stringify(player));
assert.equal(check(restoredUnit, 'help', at(3, '0', { targetId: 'friend-3' })).reason, 'universal_action_spent');

// Mastermind Quick Help requires a canonical Trait and a DIFFERENT ally.
const mind = { id: 'rogue-mastermind', controlled: 'ai', actionSlots: 3 };
const quickOptions = { round: 1, variant: 'mastermind_quick', targetActionSlotId:'target_slot_0',targetId: 'ally-a' };
assert.equal(useInstant(mind, 'help', quickOptions).reason, 'mastermind_trait_required');
globalThis.LuminousMastermindArchetypeRuntime = { hasMastermindLevel: (unit, level) => unit.id === mind.id && level === 15 };
assert.equal(reserve(mind, 'help', at(1, '0', { targetId: 'ally-a' })).ok, true);
assert.equal(useInstant(mind, 'help', quickOptions).reason, 'help_target_already_assisted');
assert.equal(commit(mind, { round: 1, phase: 'combat_phase', slotId: '0' }).ok, true);
assert.equal(useInstant(mind, 'help', quickOptions).reason, 'help_target_already_assisted');
const quick = useInstant(mind, 'help', { round: 1, variant: 'mastermind_quick', targetActionSlotId:'target_slot_0',targetId: 'ally-b' });
assert.equal(quick.ok, true);
assert.equal(quick.requiresExternalQuickBudget, true);
assert.equal(useInstant(mind, 'help', { round: 1, variant: 'mastermind_quick', targetActionSlotId:'target_slot_0',targetId: 'ally-c' }).reason, 'mastermind_quick_help_spent');

// Fail closed on invalid action, round and missing Slot.
assert.equal(check({}, 'unknown', { round: 1 }).reason, 'unknown_universal_action');
assert.equal(check({}, 'calm', { round: 0, slotId: 1 }).reason, 'round_required');
assert.equal(reserve({}, 'escape', { round: 1 }).reason, 'action_slot_required');
console.log('Unit Universal Action phase policy: smoke passed');

for(const controlled of ['player','ai']){
 const unit={id:controlled,controlled,actionSlots:3};
 const old=policy.reserve(unit,'help',{round:1,slotId:'0',intentId:'old',targetId:'friend',targetHelpActionSlotId:'friend_slot_2',targetActionId:'attack-v1'}).reservation;
 assert.equal(policy.cancel(unit,{round:1,...old}).ok,true);
 const next=policy.reserve(unit,'calm',{round:1,slotId:'0',intentId:'new'}).reservation;
 for(const method of ['commit','cancel'])assert.equal(policy[method](unit,{round:1,...old}).reason,'reservation_mismatch');
 assert.equal(policy.commit(unit,{round:1,...next}).ok,true);assert.equal(policy.commit(unit,{round:1,...next}).ok,false);
 const restored={id:controlled,universalActionPhaseLedger:{round:2,spent:{analyse:true}}};assert.equal(policy.reserve(restored,'calm',{round:2,slotId:'0'}).ok,true);assert.equal(policy.check(restored,'analyse',{round:2}).reason,'universal_action_spent');
 const helped={id:controlled},exact=policy.reserve(helped,'help',{round:1,slotId:'0',targetId:'friend',targetActionSlotId:'friend_slot_2',targetActionId:'attack-v2'}).reservation;
 const copy=JSON.parse(JSON.stringify(helped));assert.equal(policy.snapshot(copy,{round:1}).ledger.reserved.combat_phase.targetActionSlotId,'friend_slot_2');assert.equal(policy.commit(copy,{round:1,...exact}).committed.targetActionId,'attack-v2');
}
console.log('Codex regression reproductions passed for Player and IA');
