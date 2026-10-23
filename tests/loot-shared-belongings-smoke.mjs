import assert from 'node:assert/strict';

globalThis.window = globalThis;
for (const file of ['item-runtime-engine', 'item-inventory-runtime', 'item-catalog-weapons',
  'item-economy-standard', 'creature-type-catalog', 'loot-social-profile-contract', 'loot-encounter-context', 'loot-instance-runtime',
  'loot-check-runtime', 'loot-postcombat-runtime', 'unit-catalog-kobold-tier1']) {
  await import(`../js/${file}.js`);
}
const loot = LuminousLootInstanceRuntime, post = LuminousLootPostCombatRuntime;
const actor = {id:'searcher', scores:{int:30}, proficiencyBonus:6,
  proficiencies:{skills:{investigation:'expertise'}}};
const expected = {kobold_dagger:'dagger', kobold_sling:'sling', winged_kobold:'dagger',
  dragonheart_kobold:'spear', scale_sorcerer_kobold:'dagger'};
for (const [id, weapon] of Object.entries(expected)) {
  const unit = LuminousKoboldUnitCatalog.get(id);
  const options = {encounterId:'weapon-truth', unitInstanceId:`enemy:${id}`};
  const frozen = loot.lockLootInstance(loot.generateLootInstance(unit, options), {unit});
  const state = post.createInteractionState(frozen);
  assert.equal(state.carried.length, 1, `${id} always carries its actual weapon regardless of tier/wealth`);
  assert.equal(state.carried[0].definitionId, weapon);
  assert.deepEqual(post.corpseBelongings(state), [{kind:'unknown',revealed:false}]);
  const revealed = post.performAction(state, actor, 'search', {rng:()=>0});
  assert.equal(revealed.result.recovery.items.length, 0);
  assert.equal(revealed.state.carried[0].remaining, 1);
  const taken = post.performAction(revealed.state, {id:'other-player'}, 'collect',
    {targetItemId:revealed.state.carried[0].instanceId});
  assert.equal(taken.result.recovery.items[0].definitionId, weapon);
  assert.equal(post.corpseBelongings(taken.state).length, 0);
  assert.throws(()=>post.performAction(taken.state, actor, 'collect',
    {targetItemId:state.carried[0].instanceId}), /ya fue recogida/);

  // Previously saved canonical units without a loadout get the same authored
  // weapon; explicit empty runtime equipment must never refill lost equipment.
  delete unit.mechanics.weaponLoadout;
  assert.equal(loot.generateLootInstance(unit, options).equipment.items[0].definitionId, weapon);
  unit.equipmentInstances = [];
  assert.equal(loot.generateLootInstance(unit, options).equipment.items.length, 0);
}

const unit = LuminousKoboldUnitCatalog.get('kobold_dagger');
const weapon = LuminousItemInventoryRuntime.createItemInstance(LuminousWeaponCatalog.get('dagger'),
  {instanceId:'worn-dagger',condition:7,conditionMax:30,qualityTier:2});
unit.equipmentInstances = [weapon, {...weapon,instanceId:'destroyed-dagger',destroyed:true}];
unit.npcBelongings = {version:1};
unit.inventario_activo = {[weapon.instanceId]:weapon};
unit.carriedCurrency = {currencyId:'ahn',amount:70};
const options = {encounterId:'worn-weapon',unitInstanceId:'enemy:worn'};
const frozen = loot.lockLootInstance(loot.generateLootInstance(unit, options), {unit});
let state = post.createInteractionState(frozen);
assert.equal(state.carried.length, 1, 'same instance in bag and equipment is only lootable once');
assert.equal(state.carried[0].item.condition, 7);
assert.equal(state.carried[0].item.qualityTier, 2);
assert.equal(post.corpseBelongings(state).length, 2, 'money also occupies a hidden slot');
assert.throws(()=>post.performAction(state, actor, 'collect', {targetCurrency:true}), /revelar/);
const hiddenPocket = post.applyResolvedAction(state, {id:'thief'}, 'pickpocket',
  {success:true,total:30,margin:20});
assert.ok(post.corpseBelongings(hiddenPocket.state).every(slot=>!slot.revealed),
  'Sustraer never reveals the remaining inventory');
assert.equal(hiddenPocket.result.recovery.items.length + Number(!!hiddenPocket.result.recovery.currency), 1);
assert.throws(()=>post.applyResolvedAction(hiddenPocket.state, {id:'thief'}, 'pickpocket',
  {success:true,total:30,margin:20}, {targetItemId:'invented-target'}), /ALREADY_USED/);
state = post.performAction(state, actor, 'search', {rng:()=>0}).state;
assert.equal(state.currency.remaining, 70);
state = post.performAction(state, {id:'other-player'}, 'collect', {targetItemId:'worn-dagger'}).state;
assert.equal(state.currency.remaining, 70, 'a player may leave all the money for someone else');
assert.deepEqual(post.corpseBelongings(state), [{kind:'currency',revealed:true,currencyId:'ahn',amount:70}]);
state = post.performAction(state, actor, 'collect', {targetCurrency:true}).state;
assert.equal(post.corpseBelongings(state).length, 0);
console.log('Shared discovery, chosen collection, hidden random draw and guaranteed enemy equipment passed.');
