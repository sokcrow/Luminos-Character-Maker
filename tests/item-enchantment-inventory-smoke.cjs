"use strict";

const assert = require("assert");

require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-persistence-runtime.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");

const Inventory = globalThis.LuminousItemInventoryRuntime;
const Persistence = globalThis.LuminousItemPersistenceRuntime;
const Enchantments = globalThis.LuminousItemEnchantmentEngine;

assert.ok(Inventory && Persistence && Enchantments);

const base = {
  schemaVersion: Inventory.schemaVersion,
  instanceId: "enchanted_blade_1",
  definitionId: "test_enchanted_blade",
  itemType: "weapon",
  category: "weapon",
  tier: 5,
  stackable: true,
  quantity: 1,
  conditionMax: 100,
  condition: 91,
  magic: {
    enabled: true,
    enchantmentSlots: { max: 3, used: 2 },
    enchantments: [
      { definitionId:"flamebound", rank:2, source:"direct", properties:[], anchorId:null, dormant:false, disabled:false },
    ],
    magicalDurability: { max: 80, current: 61 },
  },
};

const serialized = Inventory.serializeItemInstance(base);
assert.deepStrictEqual(serialized.magic, base.magic, "compact Item Instance must preserve canonical magic state");

const deserialized = Inventory.deserializeItemInstance(serialized);
assert.deepStrictEqual(deserialized.magic, base.magic, "deserialize must preserve canonical magic state");

const hydrated = Inventory.hydrateItemInstance(serialized);
assert.deepStrictEqual(hydrated.magic, base.magic, "hydrate must preserve canonical magic state");

const same = {
  ...JSON.parse(JSON.stringify(base)),
  instanceId: "enchanted_blade_2",
};
assert.strictEqual(Inventory.canStack(base, same), true, "identical magical state may share stack identity when the Item is otherwise stackable");

const differentRank = JSON.parse(JSON.stringify(same));
differentRank.magic.enchantments[0].rank = 1;
differentRank.magic.enchantmentSlots.used = 1;
assert.strictEqual(Inventory.canStack(base, differentRank), false, "different Enchantment Rank must break stack identity");

const differentDurability = JSON.parse(JSON.stringify(same));
differentDurability.magic.magicalDurability.current = 60;
assert.strictEqual(Inventory.canStack(base, differentDurability), false, "different Magical Durability must break stack identity");

const differentProperty = JSON.parse(JSON.stringify(same));
differentProperty.magic.enchantments[0].properties = ["curse"];
assert.strictEqual(Inventory.canStack(base, differentProperty), false, "different Curse/Bind state must break stack identity");

const unit = {
  inventario_activo: { [base.instanceId]: JSON.parse(JSON.stringify(base)) },
  inventario_stash: {},
  equipment: { mainHand: JSON.parse(JSON.stringify(base)), accessories: [] },
  attunedItemInstanceIds: [base.instanceId],
};

const snapshot = Persistence.serializeInventoryState(unit);
assert.deepStrictEqual(snapshot.inventario_activo[base.instanceId].magic, base.magic, "inventory snapshot must include magic state");

const restored = Persistence.deserializeInventoryState(snapshot);
assert.deepStrictEqual(restored.inventario_activo[base.instanceId].magic, base.magic, "inventory restore must keep magic state");

const target = { inventario_activo:{}, inventario_stash:{}, equipment:{accessories:[]} };
const applied = Persistence.applyInventoryState(target, snapshot);
assert.strictEqual(applied.applied, true);
assert.deepStrictEqual(target.inventario_activo[base.instanceId].magic, base.magic, "save/load application must retain Enchantments and Magical Durability");
assert.deepStrictEqual(target.attunedItemInstanceIds, [base.instanceId], "Attunement instance reference must survive alongside magic state");

const movable = JSON.parse(JSON.stringify(base));
movable.instanceId = "enchanted_blade_move";
const owner = {
  inventario_activo: { [movable.instanceId]: movable },
  inventario_stash: {},
};
const moved = Inventory.moveToStash(owner, movable.instanceId, 1);
assert.strictEqual(moved.moved, true);
const movedItem = owner.inventario_stash[movable.instanceId];
assert.ok(movedItem);
assert.deepStrictEqual(movedItem.magic, base.magic, "active -> stash transfer must retain magic state");

const appliedByEngine = Enchantments.applyEnchantment(
  { definitionId:"engine_blade", itemType:"weapon", tier:3, stackable:false },
  "flamebound",
  1
);
assert.strictEqual(appliedByEngine.applied, true);
const engineSerialized = Inventory.serializeItemInstance({
  ...appliedByEngine.item,
  instanceId:"engine_blade_instance",
  definitionId:"engine_blade",
});
assert.deepStrictEqual(engineSerialized.magic.enchantments, appliedByEngine.item.magic.enchantments, "engine-created Enchantment refs must serialize unchanged");

console.log("Enchantment inventory persistence smoke: OK");
