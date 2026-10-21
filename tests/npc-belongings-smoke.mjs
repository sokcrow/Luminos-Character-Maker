import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

await import('../js/item-runtime-engine.js');
await import('../js/item-inventory-runtime.js');
await import('../js/item-catalog-hp-healing.js');
await import('../js/item-catalog-culinary-staples.js');
await import('../js/npc-belongings-runtime.js');
await import('./unit-ai-kit-adapter-smoke.mjs');
await import('./loot-instance-runtime-smoke.mjs');
await import('../js/unit-combat-instantiator.js');
const api = globalThis.LuminousNpcBelongings;
const base = (id = 'goblin-1') => ({ id, combatId: id, libraryUnitId: 'goblin', species: 'goblin', creatureType: 'humanoid',
  faction: 'enemy', scores: { int: 10, wis: 12 }, hp: 20, maxHp: 20, battleActive: true, actionSlots: 2,
  bodyProfile: { kind: 'organic', sizeClass: 'small', materials: ['flesh'], resources: [] },
  lootProfile: { carried: [], currency: null, equipment: { source: 'none' }, harvest: { source: 'body_profile' } } });
let itemTotal = 0, cashTotal = 0, distinctBags = new Set();
for (let index = 0; index < 500; index++) {
  const unit = api.initialize(base(`goblin-${index}`));
  const items = Object.values(unit.inventario_activo);
  assert.ok(items.every(item => api.safeCommonItem(item)), 'generated bags contain only capped common mundane definitions');
  assert.ok(items.every(item => item.tier === 'I' || item.definitionId === 'water' || item.definitionId === 'recycled_protein'));
  assert.ok(unit.carriedCurrency.amount <= 1500);
  itemTotal += items.length; cashTotal += unit.carriedCurrency.amount;
  distinctBags.add(items.map(item => item.definitionId).join('|'));
  assert.deepEqual(api.initialize(unit), unit, 'reinitialization must never reroll belongings');
  assert.deepEqual(api.initialize(base(`goblin-${index}`)), unit, 'same combat identity has deterministic belongings');
}
assert.ok(itemTotal > 0 && cashTotal > 0 && distinctBags.size > 2);
for (const [species, creatureType] of [['wolf', 'beast'], ['goblin', 'beast'], ['deer', 'animal']]) {
  const animal = api.initialize({ ...base(species), species, libraryUnitId: species, creatureType, scores: { int: 20, wis: 20 }, inventario_activo: { impossible: { quantity: 1 } } });
  assert.deepEqual(animal.inventario_activo, {}, 'animal exclusion must override intelligence and misleading species');
  assert.equal(animal.carriedCurrency.amount, 0);
}
const expensive = api.initialize({ ...base('expensive-roll'), level: 30,
  lootProfile: { carried: [{ itemId: 'hp_k_corp_k_corp_green_ampule_c', rarity: 'guaranteed' }, { itemId: 'hp_generic_emergency_restoration_dose', rarity: 'guaranteed' }] } }, { random: () => 0 });
assert.deepEqual(expensive.inventario_activo, {}, 'even guaranteed candidates cannot bypass the automatic common-item budget');
const noAnimalGear = api.initialize({ ...base('animal-gear'), creatureType: 'beast', weaponLoadout: [{ id: 'golden_sword', definitionId: 'golden_sword' }] });
const animalLoot = globalThis.LuminousLootInstanceRuntime.generateLootInstance(noAnimalGear, { encounterId: 'animal', unitId: 'animal', unitInstanceId: 'animal', corpseId: 'animal' });
assert.deepEqual(animalLoot.equipment.items, [], 'animals never roll equipped gear');
const player = { ...base('player'), isPlayer: true, inventario_activo: { owned: { quantity: 2 } } };
assert.equal(api.initialize(player), player, 'player inventories must not be touched');
const unit = api.initialize(base(), { random: () => 0 });
const medicine = Object.values(unit.inventario_activo).find(item => item.runtime?.healing);
assert.ok(medicine, 'a successful medical roll creates a real usable catalog instance');
assert.equal(api.selectItemPlan(unit, []), null, 'healthy units must not waste a consumable');
unit.hp = 3;
const self = api.selectItemPlan(unit, []);
assert.equal(self.targetId, unit.id);
assert.equal(self.type, 'items');
const dull = structuredClone(unit); dull.scores.int = 5;
assert.equal(api.selectItemPlan(dull, []), null, 'INT 5 cannot use an item');
dull.scores.int = 6;
assert.ok(api.selectItemPlan(dull, []), 'INT 6 may use a carried item');
const ally = { ...base('wounded-ally'), hp: 1 };
unit.hp = unit.maxHp;
assert.equal(api.selectItemPlan(unit, [ally]).targetId, ally.id);
unit.scores.wis = 9;
assert.equal(api.selectItemPlan(unit, [ally]), null, 'WIS below 10 does not choose ally administration');
assert.equal(api.useItem(unit, medicine, ally).used, false);
unit.scores.wis = 10;
const foe = { ...ally, faction: 'ally' };
assert.equal(api.selectItemPlan(unit, [foe]), null, 'healing must never target the opposing side');
assert.equal(api.useItem(unit, medicine, foe).used, false);

// Exercise the production GOAP compiler and its physical-dose reservation.
const kit = globalThis.LuminousUnitAiKitAdapter.buildKit(unit, { allies: [ally] });
assert.ok(kit.sources.some(source => source.sourceType === 'item'));
const goap = globalThis.LuminousUnitAiKitAdapter.planUnitTurn({ actor: unit, allies: [ally], targetIds: ['foe'], availableSlots: 4, allowEscape: false });
assert.equal(goap.actions.filter(action => action.source.type === 'item').length, 1);
assert.equal(goap.actions.find(action => action.source.type === 'item').targeting.mainTargetId, ally.id);
assert.equal(goap.actions.find(action => action.source.type === 'item').effects[0].type, 'viewer_item');

// Run the exact planner, target assignment and execution functions shipped in
// the packed live document. This catches the separate v0.7.3 path that a pure
// GOAP compiler test cannot cover.
const source = fs.readFileSync('combat/source/combat-v073-live.html', 'utf8');
const slice = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const slot = () => ({ classList: { add() {}, remove() {} }, querySelector() { return null; } });
const events = [], units = { [unit.id]: unit, [ally.id]: ally };
const context = vm.createContext({ window: { LuminousNpcBelongings: api, LuminousItemRuntime: globalThis.LuminousItemRuntime, LuminousCombatLiveMode: true },
  AUTO_UNIT_IDS: [unit.id], combatData: units, round: 1, timelineResolutionActive: true, COMBAT_PACE: { actionGap: 0 },
  activeGrappleForUnit: () => null, unitSlots: () => [slot(), slot()], unitActionBlocked: () => false,
  smartAutoPlanFor: () => ({ type: 'auto', data: { kind: 'skill' } }), defenseTypeOfPlan: () => null,
  syncActionSlotVisibility() {}, setSlotUnknown() {}, renderTargetArrows() {}, isUnitTargetable: u => u?.hp > 0,
  smartTargetForPlan: () => ({ targetId: 'opposing-player', targetSlotIndex: 0 }),
  entryKey: entry => `${entry.ownerId}:0`, combatStepRuntime: () => ({ emit: (...args) => events.push(args) }),
  setExecutingSlot() {}, setStatus() {}, wait: async () => {}, findClashPartner: () => null,
  isSaveOnlySpellPlan: () => false, isSkillOrSpellPlan: () => false, isGuardPlan: () => false,
  isEvadePlan: () => false, isCounterPlan: () => false,
  planTargetRule: () => 'ally', setCombatantHP() {}, setCombatantSP() {}, console });
vm.runInContext(slice('function prepareAutoPlans(){', 'function preparePlayerGrapplePlan(){'), context);
vm.runInContext(slice('function assignTargetIntents(){', 'function slotPoint('), context);
vm.runInContext(slice('async function executeQueueEntryRules(', 'async function startRound(){'), context);
vm.runInContext('prepareAutoPlans();assignTargetIntents();', context);
assert.equal(unit.autoPlans[0].targetId, ally.id, 'target-intent passes must retain the selected wounded ally');
assert.equal(unit.autoPlans[1].data.kind, 'skill', 'one item uses one action slot; remaining slots keep combat actions');
context.entry = { ownerId: unit.id, ownerName: 'Goblin', controller: 'ai', localIndex: 0, slot: slot(), plan: unit.autoPlans[0] };
await vm.runInContext('executeQueueEntryRules(entry,[],new Set())', context);
assert.ok(ally.hp > 1, 'the real live queue must heal the ally');
assert.equal(medicine.quantity, 0, 'the real live queue must consume the same carried dose');
assert.ok(events.some(([kind, , result]) => kind === 'ItemUseResolved' && result.used));
assert.equal(api.useItem(unit, medicine, ally).used, false, 'the same dose cannot be consumed twice');
assert.equal(api.selectItemPlan(unit, [ally]), null, 'empty stacks cannot be planned again');
assert.equal(Object.values(api.initialize(unit).inventario_activo).find(item => item.instanceId === medicine.instanceId).quantity, 0, 'reconnect must not refill a used stack');

const loot = globalThis.LuminousLootInstanceRuntime.generateLootInstance(unit, { encounterId: 'npc-loot', unitId: 'goblin', unitInstanceId: unit.id, corpseId: 'corpse-goblin' });
assert.equal(loot.carried.some(item => item.instanceId === medicine.instanceId), false, 'a consumed item must not reappear on the corpse');
assert.equal(loot.currency.amount, unit.carriedCurrency.amount);
assert.equal(loot.carried.length, Object.values(unit.inventario_activo).filter(item => item.quantity > 0).length);
const deployment = globalThis.LuminousUnitCombatInstantiator.instantiate('goblin', base('definition'), { combatId: 'deployment-goblin', random: () => 0 });
assert.equal(deployment.npcBelongings.version, 1, 'normal Unit deployment must initialize belongings');
assert.ok(Object.keys(deployment.inventario_activo).length);
console.log('NPC belongings: plausible generation, animal exclusion, INT/WIS, real live planner/queue, consumption, reconnect and remaining corpse loot passed.');
