import assert from 'node:assert/strict';

globalThis.window = globalThis;
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = () => 0;
await import('../js/combat-v073-economy-menu.js');
globalThis.setTimeout = nativeSetTimeout;
await import('../js/fighter-maneuver-catalog.js');

function fakeElement(tag = 'div') {
  const classes = new Set();
  return {
    tagName: tag.toUpperCase(), children: [], dataset: {}, innerHTML: '',
    style: { setProperty() {} }, attributes: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    appendChild(node) { this.children.push(node); return node; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}
const body = fakeElement('div');
globalThis.document = {
  createElement: fakeElement,
  getElementById(id) { return id === 'category-body' ? body : null; },
};
globalThis.PLAYER_ID = 'player:test';
globalThis.combatData = {
  'player:test': {
    id: 'player:test', controlled: 'player',
    characterBuild: { maneuvers: { battle_master: ['trip_attack', 'brace', 'trip_attack'] } },
  },
};
globalThis.permanent = {
  global: [{ id: 'help', name: 'Help', actionKey: 'help', economyCost: 'action', description: 'Assist an ally.' }],
};
globalThis.activeMenu = 'global';
globalThis.navState = 'category';

const menu = globalThis.LuminousCombatEconomyMenu073;
assert.ok(menu);
assert.deepEqual(menu.learnedManeuverRowsForPlayer().map(row => row.id), ['trip_attack', 'brace'],
  'only the Fighter maneuvers learned in the canonical character build should appear');
assert.ok(menu.rowsFor('global', 'action').some(row => row.id === 'trip_attack'),
  'passive maneuvers should appear as reference-only entries under Actions');
assert.ok(menu.rowsFor('global', 'quick_action').some(row => row.id === 'brace'),
  'maneuvers with a canonical Quick Action cost should appear under Quick');
assert.ok(!menu.rowsFor('global', 'free_action').some(row => row.kind === 'maneuver'),
  'maneuvers must never be misfiled under Free by default');

menu.renderCleanList();
assert.equal(body.children.length, 1, 'descriptions should stay closed until a click');
const options = body.children[0].children;
assert.ok(options.every(button => !button.className.includes('focused')),
  'opening the menu must not highlight the top option');
let legacyConfirmed = 0;
menu.state.originals.selectAction = () => { legacyConfirmed++; };
const tripButton = options.find(button => button.innerHTML.includes('Trip Attack'));
assert.ok(tripButton, 'the learned maneuver needs a clickable row');
tripButton.onclick();
assert.match(body.innerHTML, /Maneuver/, 'clicking the maneuver should show its actual description');
assert.doesNotMatch(body.innerHTML, /id="economy-action-confirm"/,
  'reference-only passive maneuvers must not pretend to be executable');
assert.equal(legacyConfirmed, 0, 'a maneuver reference must not enter the Action Slot plan');

menu.state.tabByMenu.global = 'quick_action';
body.children = [];
body.innerHTML = '';
menu.renderCleanList();
const braceButton = body.children[0].children.find(button => button.innerHTML.includes('Brace'));
assert.ok(braceButton);
assert.ok(!braceButton.className.includes('focused'), 'Quick maneuvers must not auto-highlight');
braceButton.onclick();
assert.match(body.innerHTML, /Quick Action/, 'Quick maneuver detail must expose its canonical cost');
assert.equal(legacyConfirmed, 0, 'unimplemented Quick maneuver execution must fail closed');

console.log('combat action menu click-only + learned maneuvers smoke: ok');
