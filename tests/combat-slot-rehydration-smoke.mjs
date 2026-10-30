import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('combat/source/combat-v073-live.html', 'utf8');
const functions = ['spawnCombatant', 'createActionSlotElement', 'grantActionSlotToUnit', 'selectSlot']
  .map(name => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    return source.slice(start, source.indexOf('\nfunction ', start + 1));
  }).join('\n');

// Exercise the real spawn/grant/select functions with a small DOM adapter.
// A reconstructed unit starts with two slots, then earns its third locally.
let slots = [];
const node = () => ({ style: {}, dataset: {}, onclick: null,
  classList: { toggle() {}, add() {}, remove() {} } });
const host = { appendChild: slot => slots.push(slot) };
const field = { appendChild: token => {
  for (const match of token.innerHTML.matchAll(/class="action-slot-wrapper" id="([^"]+)" data-slot-index="(\d+)" data-owner-id="([^"]+)"/g)) {
    slots.push({ ...node(), id: match[1], dataset: { slotIndex: match[2], ownerId: match[3] } });
  }
} };
const context = {
  combatData: {}, round: 3, PLAYER_ID: 'solo', TEST_COMBAT_LEVEL: 1,
  selectedSlotIndex: 0, roundRunning: false, planReady: false,
  navState: 'root', activeMenu: null, plannedActions: [],
  document: { createElement: node },
  $: id => id === 'battlefield' ? field : id.startsWith('ui-panel-') ? { querySelector: () => host } : null,
  unitSlots: id => slots.filter(slot => slot.dataset.ownerId === id),
  generateHeptagonPoints: () => ({ full: '', front: '', frontPoints: [] }),
  staggerThresholdMarkup: () => '', staggerGlassMarkup: () => '',
  unitActionBlocked: () => false,
};
context.window = context;
context.playerSlots = () => context.unitSlots(context.PLAYER_ID);
for (const name of ['applyStaggerGlassStage', 'syncUnitVisibility', 'renderCombatantShield',
  'syncUnitActionState', 'syncConditionVisuals', 'hideClashForecast', 'setPlayerMenuZoom', 'setStatus']) {
  context[name] = () => {};
}
vm.createContext(context);
vm.runInContext(functions, context);
const spawn = (id = 'solo', count = 2) => context.spawnCombatant({ id, hp: 100, maxHp: 100,
  actionSlots: count, faction: 'ally', controlled: id === 'solo' ? 'player' : 'remote' });
const click = index => {
  const slot = context.playerSlots()[index];
  assert.equal(typeof slot.onclick, 'function', `Slot ${index + 1} has input after reconstruction`);
  slot.onclick();
};

spawn();
context.grantActionSlotToUnit('solo');
for (const index of [0, 1, 2, 1, 0, 2]) {
  click(index);
  assert.equal(context.selectedSlotIndex, index);
}
// Repeated hydration must reconnect all slots, including the middle one.
slots = [];
spawn('solo', 3);
click(1);
assert.equal(context.selectedSlotIndex, 1);
context.planReady = true;
click(2);
assert.equal(context.selectedSlotIndex, 1, 'READY still locks selection');
context.planReady = false;
context.roundRunning = true;
click(0);
assert.equal(context.selectedSlotIndex, 1, 'running turn still locks selection');
context.roundRunning = false;
context.unitActionBlocked = () => true;
click(2);
assert.equal(context.selectedSlotIndex, 1, 'incapacitated unit still locks selection');
context.unitActionBlocked = () => false;
spawn('other', 3);
assert.ok(context.unitSlots('other').every(slot => slot.onclick === null), 'other units are not selectable');
context.PLAYER_ID = 'other';
slots.find(slot => slot.dataset.ownerId === 'solo').onclick();
assert.equal(context.selectedSlotIndex, 1, 'stale owned token cannot select a different player slot');
console.log('combat slot rehydration smoke: ok');
