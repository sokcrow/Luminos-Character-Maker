import assert from 'node:assert/strict';

await import('../js/deckEngine.js');
const deck = globalThis.LuminousDeckEngine;
if (!deck) throw new Error('LuminousDeckEngine was not initialized.');

const skills = [
  { id:'skill_a', name:'Skill A', tier:1 },
  { id:'skill_b', name:'Skill B', tier:'I' },
  { id:'skill_c', name:'Skill C', tier:2 },
  { id:'skill_d', name:'Skill D', tier:'II' },
  { id:'skill_e', name:'Skill E', tier:3 },
  { id:'skill_f', name:'Skill F', tier:'III' },
];

// Canonical 12-card build: Tier I = 3 copies, Tier II = 2, Tier III = 1.
const definition = deck.buildDeckDefinition(skills);
assert.equal(definition.capacity, 12);
assert.equal(definition.cardCount, 12);
assert.equal(definition.uniqueSkillCount, 6);
assert.equal(definition.combatReady, true);
const counts = Object.fromEntries(skills.map((skill) => [skill.id, definition.cards.filter((card) => card.skillId === skill.id).length]));
assert.deepEqual(counts, {
  skill_a:3,
  skill_b:3,
  skill_c:2,
  skill_d:2,
  skill_e:1,
  skill_f:1,
});

// Granted / Off-Deck / Defensive Skills never enter the canonical Deck.
const nonDeck = [
  { id:'granted', tier:1, availability:{type:'granted'} },
  { id:'off_deck', tier:1, availability:{type:'off_deck'} },
  { id:'guard', tier:1, availability:{type:'defensive'} },
];
const preview = deck.buildDeckDefinition([...skills, ...nonDeck], { requireFull:false, capacity:20 });
assert.deepEqual(preview.excludedSkillIds, ['granted','off_deck','guard']);
assert.equal(preview.cardCount, 12);

// Each Action Slot owns an independent real deck and always starts with two cards.
// random=0 makes Fisher-Yates rotate the source list, yielding duplicate Skill A
// in the opening hand; duplicates are intentionally legal.
const unit = { id:'u1' };
deck.initDeck(unit, skills);
const first = deck.onTurnStart(unit, { round:1, slotCount:2, random:()=>0 });
assert.equal(first.createdSlotIds.length, 2);
assert.equal(deck.getSlotHand(unit,'u1_slot_0').length, 2);
assert.equal(deck.getSlotHand(unit,'u1_slot_1').length, 2);
assert.deepEqual(deck.getSlotHand(unit,'u1_slot_0').map((card)=>card.skillId), ['skill_a','skill_a']);
assert.deepEqual(deck.getSlotHand(unit,'u1_slot_1').map((card)=>card.skillId), ['skill_a','skill_a']);
assert.equal(deck.snapshot(unit).slots.u1_slot_0.drawPileRemaining, 10);
assert.equal(deck.snapshot(unit).slots.u1_slot_1.drawPileRemaining, 10);

// Slot 1 consuming cards never consumes Slot 2's independent draw pile.
const slot0Round1 = deck.getSlotHand(unit,'u1_slot_0');
const slot1Round1 = deck.getSlotHand(unit,'u1_slot_1');
assert.equal(deck.markCardUsed(unit,'u1_slot_0',slot0Round1[1].drawId).used, true);
const second = deck.onTurnStart(unit, { round:2, slotCount:2, random:()=>0 });
assert.equal(second.rotated.length, 2);
const slot0Round2 = deck.getSlotHand(unit,'u1_slot_0');
const slot1Round2 = deck.getSlotHand(unit,'u1_slot_1');

// Using the newest card accelerates that Slot by two cards.
assert.ok(!slot0Round2.some((card)=>card.drawId === slot0Round1[0].drawId));
assert.ok(!slot0Round2.some((card)=>card.drawId === slot0Round1[1].drawId));
assert.equal(deck.snapshot(unit).slots.u1_slot_0.drawPileRemaining, 8);

// A Slot with no used Deck Skill ages exactly one card; its newest survives.
assert.equal(slot1Round2[0].drawId, slot1Round1[1].drawId);
assert.ok(!slot1Round2.some((card)=>card.drawId === slot1Round1[0].drawId));
assert.equal(deck.snapshot(unit).slots.u1_slot_1.drawPileRemaining, 9);

// Planning a card does not make it used. If the CombatAction is cancelled before
// execution, the selected newest card survives the normal Turn Start cycle.
const plannedCard = slot1Round2[1];
const plannedAction = { id:'planned', actionSlotId:null, metadata:{} };
deck.bindActionToCard(plannedAction, unit, 'u1_slot_1', plannedCard.drawId);
assert.equal(plannedAction.metadata.deckCard.drawId, plannedCard.drawId);
deck.onTurnStart(unit, { round:3, slotCount:2, random:()=>0 });
const slot1Round3 = deck.getSlotHand(unit,'u1_slot_1');
assert.equal(slot1Round3[0].drawId, plannedCard.drawId);

// Once execution starts, markActionUsed makes the card used even if the Skill is
// later interrupted. A used newest card plus normal ageing rotates two cards.
const executingAction = { id:'executing', actionSlotId:null, metadata:{} };
deck.bindActionToCard(executingAction, unit, 'u1_slot_1', slot1Round3[1].drawId);
assert.equal(deck.markActionUsed(unit, executingAction).used, true);
const usedNewestId = slot1Round3[1].drawId;
deck.onTurnStart(unit, { round:4, slotCount:2, random:()=>0 });
assert.ok(!deck.getSlotHand(unit,'u1_slot_1').some((card)=>card.drawId === usedNewestId));

// Losing a Slot destroys its hand. A regained Slot is new and immediately has two cards.
const lostHandIds = deck.getSlotHand(unit,'u1_slot_1').map((card)=>card.drawId);
const loss = deck.onTurnStart(unit, { round:5, slotCount:1, random:()=>0 });
assert.deepEqual(loss.removedSlotIds, ['u1_slot_1']);
assert.equal(deck.getSlot(unit,'u1_slot_1'), null);
const gain = deck.onTurnStart(unit, { round:6, slotCount:2, random:()=>0 });
assert.deepEqual(gain.createdSlotIds, ['u1_slot_1']);
const gainedHand = deck.getSlotHand(unit,'u1_slot_1');
assert.equal(gainedHand.length, 2);
assert.ok(gainedHand.every((card)=>!lostHandIds.includes(card.drawId)));

// When a Slot reaches the end of its private 12-card deck, it reshuffles a fresh
// 12-card sequence. Hands never become empty.
for (let round = 7; round <= 22; round++) {
  deck.onTurnStart(unit, { round, slotCount:2, random:()=>0 });
  assert.equal(deck.getSlotHand(unit,'u1_slot_0').length, 2);
  assert.equal(deck.getSlotHand(unit,'u1_slot_1').length, 2);
}
assert.ok(deck.getSlot(unit,'u1_slot_0').cycle >= 2);
assert.ok(deck.getSlot(unit,'u1_slot_1').cycle >= 2);

// Re-running ON_TURN_START for the same round is idempotent.
const beforeRepeat = deck.getSlotHand(unit,'u1_slot_0').map((card)=>card.drawId);
deck.onTurnStart(unit, { round:22, slotCount:2, random:()=>0 });
assert.deepEqual(deck.getSlotHand(unit,'u1_slot_0').map((card)=>card.drawId), beforeRepeat);

console.log('combat deck engine smoke passed');
