const assert = require('node:assert/strict');

async function main() {
  delete global.LuminousContentRegistry;
  delete global.LuminousItemIconRegistry;
  delete global.LuminousItemCatalogV10Chunks;
  delete global.LuminousItemCatalogV10Ready;
  delete global.LuminousItemCatalog;
  delete global.LuminousItemRuntime;
  delete global.LuminousItemInventoryRuntime;
  delete global.LuminousItemCatalogInventoryBridge;

  require('../js/content-registry.js');
  require('../js/item-icon-registry.js');
  await require('../js/item-catalog-v10-data.js');
  const catalog = require('../js/item-catalog-runtime.js');
  require('../js/item-runtime-engine.js');
  require('../js/item-inventory-runtime.js');
  require('../js/item-catalog-inventory-bridge.js');

  const inventory = global.LuminousItemInventoryRuntime;
  const runtime = global.LuminousItemRuntime;
  const icons = global.LuminousItemIconRegistry;

  const stats = catalog.stats();
  assert.equal(stats.baseDefinitions, 560, 'V10 must register exactly 560 base definitions');
  assert.equal(stats.total, 560, 'V10 total must remain 560 before Firebase overrides');
  assert.deepEqual(stats.categories, {
    accessory_chassis: 10,
    ammo: 40,
    armor_chassis: 10,
    consumable: 60,
    food_drink: 122,
    ingredient: 90,
    material: 75,
    module: 60,
    tool: 20,
    trade_good: 20,
    weapon_chassis: 53,
  });

  const all = catalog.list();
  assert.equal(all.reduce((sum, definition) => sum + (definition.functions || []).length, 0), 1548, 'all authored ITEM_FUNCTIONS rows must be integrated');
  assert.equal(all.filter((definition) => !definition.iconGroup || !icons.has(definition.iconGroup)).length, 0, 'every V10 definition must resolve a valid icon group');
  assert.equal(all.filter((definition) => !definition.icon).length, 0, 'every V10 definition must resolve an icon URL');

  const medkit = catalog.get('item:consumable_basic_medkit');
  assert.equal(medkit.displayName, 'Basic Medkit');
  assert.equal(medkit.iconGroup, 'healing_hp');
  assert.equal(medkit.icon, 'https://imgur.com/GcnX53v.png');
  assert.equal(medkit.runtime.effects.hpRestore, 10);
  assert.equal(medkit.tipo_categoria, 'consumable');
  assert.ok(medkit.functions.some((fn) => String(fn.type).toUpperCase() === 'USE'));

  const stimulant = catalog.get('item:consumable_stimulant_ampoule');
  assert.equal(stimulant.iconGroup, 'healing_sp');
  assert.equal(stimulant.runtime.effects.spRestore, 8);

  const knife = catalog.get('item:weapon_chassis_knife');
  const pistol = catalog.get('item:weapon_chassis_pistol');
  const heavyArmor = catalog.get('item:armor_chassis_heavy_armor');
  assert.equal(knife.iconGroup, 'weapon_melee');
  assert.equal(pistol.iconGroup, 'weapon_ranged');
  assert.equal(heavyArmor.iconGroup, 'armor_heavy');
  assert.equal(knife.tipo_categoria, 'weapon');
  assert.equal(heavyArmor.tipo_categoria, 'armor');

  const instance = inventory.createItemInstance('item:consumable_basic_medkit', { quantity: 1, currentOwnerId: 'player:test' });
  assert.equal(instance.definitionId, 'item:consumable_basic_medkit');
  const resolved = inventory.resolveItem(instance);
  assert.equal(resolved.displayName, 'Basic Medkit');
  assert.equal(resolved.iconGroup, 'healing_hp');
  assert.equal(resolved.icon, 'https://imgur.com/GcnX53v.png');
  assert.equal(runtime.hasFunction(resolved, 'use'), true);

  const weaponInstance = inventory.createItemInstance('item:weapon_chassis_knife', { quantity: 1 });
  const resolvedWeapon = inventory.resolveItem(weaponInstance);
  const schema = runtime.equipmentSchema(resolvedWeapon);
  assert.equal(schema.category, 'weapon');
  assert.equal(schema.handCost, 1);

  const unit = { inventario_activo: {}, inventario_stash: {} };
  const added = inventory.addItemInstance(unit, 'item:consumable_basic_medkit', 'active', { quantity: 1, currentOwnerId: 'player:test' });
  assert.equal(added.added, true);
  assert.equal(Object.keys(unit.inventario_activo).length, 1);
  const stored = Object.values(unit.inventario_activo)[0];
  assert.equal(stored.definitionId, 'item:consumable_basic_medkit');
  assert.equal(inventory.resolveItem(stored).displayName, 'Basic Medkit');

  catalog.setOverride('item:consumable_basic_medkit', {
    canonicalId: 'item:consumable_basic_medkit',
    displayName: 'Basic Medkit // DM Override',
    iconGroup: 'medical_supply',
    basePriceAhn: 12345,
  });
  const overridden = inventory.resolveItem(stored);
  assert.equal(overridden.displayName, 'Basic Medkit // DM Override');
  assert.equal(overridden.iconGroup, 'medical_supply');
  assert.equal(overridden.price, 12345);

  console.log('Item Catalog V10 smoke: OK');
  console.log(JSON.stringify({ definitions: stats.baseDefinitions, functions: 1548, categories: stats.categories }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
