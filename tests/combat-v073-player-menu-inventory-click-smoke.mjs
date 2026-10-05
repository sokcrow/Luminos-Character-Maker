import assert from 'node:assert/strict';

globalThis.window = globalThis;

function fakeElement(tag = 'div') {
  const node = {
    tagName: String(tag).toUpperCase(),
    children: [],
    dataset: {},
    attributes: {},
    style: { display: '', setProperty() {} },
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return node;
}

const categoryBody = fakeElement('div');
const spellIcon = fakeElement('img');
spellIcon.getAttribute = (name) => name === 'src' ? 'Assets/Images/Buttons/Spells.png' : null;
const spellButton = fakeElement('button');
spellButton.querySelector = (selector) => selector === 'img' ? spellIcon : null;
spellButton.textContent = 'SPELLS';

const doc = {
  body: fakeElement('body'),
  head: fakeElement('head'),
  createElement: fakeElement,
  getElementById(id) {
    if (id === 'category-body') return categoryBody;
    return null;
  },
  querySelectorAll() { return [spellButton]; },
};

globalThis.document = undefined;
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = () => 0;
await import('../js/combat-v073-economy-menu.js');
globalThis.setTimeout = nativeSetTimeout;
globalThis.document = doc;

globalThis.PLAYER_ID = 'player:p1';
globalThis.selectedSlotIndex = 0;
globalThis.activeMenu = 'items';
globalThis.combatData = {
  'player:p1': {
    id: 'player:p1',
    isPlayer: true,
    controlled: 'player',
    classes: [{ classId: 'fighter', levels: 10 }],
    inventario_activo: {
      med_live_1: {
        instanceId: 'med_live_1',
        definitionId: 'hp_generic_pocket_recovery_patch',
        name: 'Pocket Recovery Patch',
        category: 'consumable',
        iconFamily: 'medicine_patch',
        quantity: 2,
        runtime: { actionCost: 'action', targetMode: 'self', effects: { hpRestore: 5 } },
      },
      camp_kit: {
        instanceId: 'camp_kit',
        definitionId: 'hp_generic_civilian_recovery_pack',
        name: 'Civilian Recovery Pack',
        category: 'consumable',
        quantity: 1,
        runtime: { actionCost: 'off_combat', targetMode: 'self', effects: { hpRestore: 10 } },
      },
      empty_stack: {
        instanceId: 'empty_stack',
        definitionId: 'empty',
        name: 'Empty Stack',
        category: 'consumable',
        quantity: 0,
        runtime: { actionCost: 'action' },
      },
    },
  },
};

globalThis.LuminousSpellcastingRuntime = {
  getClassSpellcastingProfile(classId) {
    return classId === 'wizard' ? { spellcastingStartLimbusLevel: 1 } : null;
  },
};

globalThis.LuminousItemRuntime = {
  quantityOf(item) { return Number(item.quantity || 0); },
  actionCostFor(item) { return item.runtime?.actionCost || 'action'; },
  hasFunction(item, name) { return name === 'use' && item.category === 'consumable'; },
};

globalThis.LuminousItemIconRegistry = {
  resolveIcon(id, options = {}) {
    if (id === 'medicine_patch') return 'Assets/Icons/items/consumable/medicine_patch.png';
    if (id === 'generic_item' && options.fallback === false) return 'Assets/Icons/items/fallback/generic_item.png';
    return '';
  },
};

const menu = globalThis.LuminousCombatEconomyMenu073;
assert.ok(menu, 'economy menu must initialize');

globalThis.UNIT_KITS = {
  'player:p1': {
    actions: [
      { id: 'slash_without_kind', name: 'Slash Without Kind', type: 'Slash' },
      { id: 'guard_without_kind', name: 'Guard Without Kind', type: 'Guard', isDefense: true },
    ],
  },
};
assert.deepEqual(
  menu.liveActions('skill').map((row) => row.id),
  ['slash_without_kind'],
  'a canonical attack whose type is its damage type must still appear in Skills'
);

const rows = menu.itemRowsForPlayer();
assert.equal(rows.length, 1, 'Combat Items must contain only usable, non-empty, combat-legal Active Inventory entries');
assert.equal(rows[0].instanceId, 'med_live_1');
assert.equal(rows[0].inventoryContainer, 'inventario_activo');
const rowsAgain = menu.itemRowsForPlayer();
assert.equal(rowsAgain[0], rows[0], 'the same inventory instance must reuse a stable row object so legacy reservations cannot double-book a quantity-1 stack');

const aliasRows = menu.itemRowsForPlayer({ activeInventory: {
  alias_item: {
    instanceId: 'alias_item',
    name: 'Alias Item',
    category: 'consumable',
    quantity: 1,
    runtime: { actionCost: 'action', effects: { hpRestore: 1 } },
  },
} });
assert.deepEqual(aliasRows.map((row) => row.instanceId), ['alias_item'], 'activeInventory aliases must populate the Items menu');

let selected = null;
menu.state.originals.selectAction = (value) => { selected = value; return value; };
menu.renderItems();
assert.equal(categoryBody.children.length, 1, 'Items renderer must create one active-inventory list');
const itemList = categoryBody.children[0];
assert.equal(itemList.children.length, 1, 'Items renderer must create one clickable row for the valid stack');
const itemButton = itemList.children[0];
assert.equal(itemButton.dataset.itemInstanceId, 'med_live_1');
assert.match(
  itemButton.innerHTML,
  /Assets\/Icons\/items\/consumable\/medicine_patch\.png/,
  'Combat Item rows must render the canonical small icon for the item iconFamily'
);
assert.equal(
  menu.itemIconUrl(rows[0]),
  'Assets/Icons/items/consumable/medicine_patch.png',
  'Combat Item icon resolution must use the repository-local item icon registry'
);
assert.equal(typeof itemButton.onclick, 'function', 'Item row must have a click handler');
itemButton.onclick();
assert.ok(selected, 'clicking an Item row must reach selection');
assert.equal(selected.type, 'item', 'a concrete inventory row must enter the legacy action-detail selector as a singular item');
assert.equal(selected.data.instanceId, 'med_live_1');
assert.equal(selected.data.definitionId, 'hp_generic_pocket_recovery_patch');

selected = null;
menu.selectAction({ type: 'items', slotIndex: 0, data: rows[0] });
assert.ok(selected, 'legacy plural item selections must still reach the action-detail selector');
assert.equal(selected.type, 'item', 'legacy plural item selections must normalize before crossing into the packed selector');

menu.state.originals.planTargetRule = (source) => source.itemType === 'hp_healing' ? 'self' : 'enemy';
assert.equal(
  menu.planTargetRuleCompat(rows[0]),
  'self',
  'canonical self-target Items must route through the legacy self-target rule instead of enemy targeting'
);

const persistedWrites = [];
globalThis.LuminousCombatLiveAdapter073 = {
  state: {
    playerId: 'p1',
    db: {
      ref() {
        return {
          async update(updates) { persistedWrites.push(updates); },
        };
      },
    },
  },
};
globalThis.LuminousItemPersistenceRuntime = {
  serializeInventoryState(unit) {
    return {
      schemaVersion: 3,
      inventario_activo: JSON.parse(JSON.stringify(unit.inventario_activo || {})),
      inventario_stash: {},
      equipmentRefs: {},
      attunedItemInstanceIds: [],
    };
  },
};
globalThis.LuminousPlayerVitalsRealtimeBridge = {
  firebaseUpdatesForSnapshot(snapshot) {
    const unit = Object.values(snapshot)[0];
    return {
      'campaña/jugadores/p1/hp': unit.hp ?? 0,
      'campaña/jugadores/p1/sp': unit.sp ?? 0,
    };
  },
};
globalThis.combatData['player:p1'].canonicalPlayerKey = 'p1';
globalThis.combatData['player:p1'].hp = 44;
globalThis.combatData['player:p1'].sp = 12;
globalThis.combatData['player:p1'].inventario_activo.med_live_1.quantity = 1;
const persisted = await menu.persistQuickItemState(globalThis.combatData['player:p1']);
assert.equal(persisted.saved, true, 'Quick Item state must persist immediately');
assert.equal(persistedWrites.length, 1);
assert.equal(persistedWrites[0]['campaña/jugadores/p1/inventario_activo'].med_live_1.quantity, 1);
assert.equal(persistedWrites[0]['campaña/combate/combatants/player:p1/inventario_activo'].med_live_1.quantity, 1);
assert.equal(persistedWrites[0]['campaña/jugadores/p1/hp'], 44);
assert.equal(persistedWrites[0]['campaña/jugadores/p1/sp'], 12);
globalThis.combatData['player:p1'].inventario_activo.med_live_1.quantity = 2;

globalThis.permanent = {
  global: [{ id: 'help', actionKey: 'help', kind: 'global', name: 'Help', description: 'Assist an ally.', economyCost: 'action' }],
  spells: [],
};
globalThis.activeMenu = 'global';
categoryBody.children = [];
selected = null;
menu.renderCleanList();
assert.equal(categoryBody.children.length, 2, 'Actions renderer must build the canonical action list and description');
const actionList = categoryBody.children[0];
assert.equal(actionList.children.length, 1);
const actionButton = actionList.children[0];
assert.equal(typeof actionButton.onclick, 'function', 'Action row must have a click handler');
actionButton.onclick();
assert.ok(selected, 'clicking an Action row must reach selection');
assert.equal(selected.type, 'global');
assert.equal(selected.data.actionKey, 'help');

globalThis.activeMenu = 'items';
assert.equal(menu.syncSpellMenuVisibility(), false, 'fighter must be treated as non-caster');
assert.equal(spellButton.hidden, true, 'non-caster must not see the Spells command');
assert.equal(spellButton.disabled, true, 'hidden Spells command must not be clickable');

globalThis.combatData['player:p1'].classes = [{ classId: 'wizard', levels: 10 }];
assert.equal(menu.syncSpellMenuVisibility(), true, 'wizard must be treated as caster');
assert.equal(spellButton.hidden, false, 'caster must see the Spells command');
assert.equal(spellButton.disabled, false, 'caster Spells command must be clickable');

await import('../js/battle-viewer-runtime-073-timeline.js');
const timeline = globalThis.LuminousBattleViewerTimeline073;
assert.ok(timeline?.genericItemEffect, 'timeline must expose canonical item resolution for smoke coverage');

const liveItem = globalThis.combatData['player:p1'].inventario_activo.med_live_1;
const plannedCopy = JSON.parse(JSON.stringify(liveItem));
plannedCopy.quantity = 99;
let runtimeReceived = null;
globalThis.LuminousItemRuntime.useItem = (actor, item, options) => {
  runtimeReceived = { actor, item, options };
  item.quantity = Math.max(0, Number(item.quantity || 0) - 1);
  return { used: true, consumed: true, consumption: { before: 2, after: 1, amount: 1 } };
};

const resolved = timeline.genericItemEffect({
  actor: globalThis.combatData['player:p1'],
  targets: [globalThis.combatData['player:p1']],
  effect: { item: plannedCopy, plan: { type: 'items' } },
});
assert.equal(resolved.handled, true);
assert.equal(runtimeReceived.item, liveItem, 'Combat resolution must pass the live Active Inventory instance to LuminousItemRuntime');
assert.equal(liveItem.quantity, 1, 'live Active Inventory quantity must be consumed');
assert.equal(plannedCopy.quantity, 99, 'the detached plan copy must never be consumed');

console.log('combat v0.7.3 player menu/inventory click smoke: ok');
