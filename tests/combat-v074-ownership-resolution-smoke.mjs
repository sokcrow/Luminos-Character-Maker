import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loadedOwnership = require('../js/battle-viewer-ownership-074.js');
const ownership = loadedOwnership?.version === '0.7.4' ? loadedOwnership : globalThis.LuminousBattleViewerOwnership074;
assert.equal(ownership.version, '0.7.4');

let baseCalls = 0;
globalThis.CombatEngine = {
  resolveActionSlot(unit, slotIndex, context = {}) {
    baseCalls += 1;
    return {
      handled: true,
      planned: context.plannedAction || null,
      result: { available: true, unitId: unit.id, slotIndex },
    };
  },
};

assert.equal(ownership.install(), true);
assert.equal(ownership.install(), true, 'install must be idempotent');

const unitA = {
  id: 'player:player_a',
  unitId: 'player:player_a',
  combatId: 'player:player_a',
  actorCategory: 'player',
  isPlayer: true,
  activeSlots: 2,
  actionSlotIndex: { 0: true, 1: true },
};

const valid = globalThis.CombatEngine.resolveActionSlot(unitA, 1, {
  plannedAction: { unitId: 'player:player_a', kind: 'trait', traitId: 'attack' },
});
assert.equal(valid.result.available, true);
assert.equal(valid.result.slotIndex, 1);
assert.equal(baseCalls, 1);

const wrongUnit = globalThis.CombatEngine.resolveActionSlot(unitA, 0, {
  plannedAction: { unitId: 'player:player_b', kind: 'trait', traitId: 'attack' },
});
assert.equal(wrongUnit.handled, true);
assert.equal(wrongUnit.result.available, false);
assert.match(wrongUnit.result.reasons[0], /source Unit mismatch/i);
assert.equal(baseCalls, 1, 'forged Unit plans must never reach the underlying resolver');

const wrongSlot = globalThis.CombatEngine.resolveActionSlot(unitA, 2, {
  plannedAction: { unitId: 'player:player_a', kind: 'trait', traitId: 'attack' },
});
assert.equal(wrongSlot.handled, true);
assert.equal(wrongSlot.result.available, false);
assert.match(wrongSlot.result.reasons[0], /slot is not owned/i);
assert.equal(baseCalls, 1, 'foreign Action Slots must never reach the underlying resolver');

console.log('combat-v074-ownership-resolution-smoke: ok');
