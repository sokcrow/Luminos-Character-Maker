"use strict";

const assert=require("node:assert/strict");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-persistence-runtime.js");
require("../js/item-magic-runtime.js");

const Engine=globalThis.LuminousItemEnchantmentEngine;
const Magic=globalThis.LuminousItemMagicRuntime;
const Inventory=globalThis.LuminousItemInventoryRuntime;
const Persistence=globalThis.LuminousItemPersistenceRuntime;

const result=Engine.applyEnchantment({
  instanceId:"mapped_sword",definitionId:"mapped_sword",itemType:"weapon",category:"weapon",
  tier:5,condition:100,conditionMax:100,
},"flamebound",1);
assert.equal(result.applied,true);
const sword=JSON.parse(JSON.stringify(result.item));
sword.magic.chargeMapping={maxCharges:5,magicalDurabilityPerCharge:10};
Magic.setMagicalDurability(sword,50,50);
assert.deepEqual(Inventory.getCharges(sword),{current:5,max:5});
assert.equal(sword.chargesCurrent,5);

const spent=Inventory.spendCharges(sword,2);
assert.equal(spent.spent,true);
assert.equal(Magic.magicalDurabilityState(sword).current,30);
assert.deepEqual(Inventory.getCharges(sword),{current:3,max:5});
assert.equal(sword.chargesCurrent,3);
assert.equal(sword.chargesMax,5);

const wrongReset=Inventory.restoreCharges(sword,10);
assert.equal(wrongReset.restored,false,"legacy UI cannot refill Enchanter charge mapping");
assert.equal(sword.chargesCurrent,3);
const withoutRule=Inventory.processRecharge(sword,"long_rest");
assert.equal(withoutRule.recharged,false,"no generic recharge can reset an authored Enchanter Item");
assert.equal(sword.chargesCurrent,3);

sword.magic.magicalRecharge={trigger:"long_rest",amount:10};
const wrongTrigger=Inventory.processRecharge(sword,"turn_start");
assert.equal(wrongTrigger.recharged,false);
assert.equal(Magic.magicalDurabilityState(sword).current,30);
const restored=Inventory.processRecharge(sword,"long_rest");
assert.equal(restored.recharged,true);
assert.equal(Magic.magicalDurabilityState(sword).current,40);
assert.equal(sword.chargesCurrent,4);

const unit={inventario_activo:{mapped_sword:sword},inventario_stash:{}};
const snapshot=Persistence.serializeInventoryState(unit);
assert.equal(snapshot.inventario_activo.mapped_sword.chargesCurrent,4);
assert.equal(snapshot.inventario_activo.mapped_sword.chargesMax,5);
assert.equal(snapshot.inventario_activo.mapped_sword.magic.magicalDurability.current,40);

snapshot.inventario_activo.mapped_sword.chargesCurrent=5;
snapshot.inventario_activo.mapped_sword.charges=5;
const hydrated=Persistence.deserializeInventoryState(snapshot);
const rehydrated=hydrated.inventario_activo.mapped_sword;
assert.equal(Magic.magicalDurabilityState(rehydrated).current,40);
assert.equal(Inventory.getCharges(rehydrated).current,4);
assert.equal(rehydrated.chargesCurrent,4,"hydration corrects stale UI mirror from authoritative MD");

const legacy={instanceId:"legacy_cell",chargesCurrent:2,chargesMax:4};
assert.deepEqual(Inventory.getCharges(legacy),{current:2,max:4},
  "unmapped native/legacy Items preserve their existing Charge battery");

const invalid=JSON.parse(JSON.stringify(sword));
invalid.magic.chargeMapping={maxCharges:5};
assert.equal(Magic.enchantmentChargeState(invalid).valid,false);
assert.equal(Inventory.spendCharges(invalid,1).spent,false);
assert.equal(Magic.magicalDurabilityState(invalid).current,40);
console.log("Enchanter per-Item Charge projection, MD authority and no-reset persistence smoke: OK");
