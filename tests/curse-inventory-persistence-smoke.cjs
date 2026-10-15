"use strict";
const assert=require("node:assert/strict");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/curse-catalog.js");
require("../js/curse-runtime.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-magic-runtime.js");
require("../js/item-equipment-bridge.js");
require("../js/item-persistence-runtime.js");
const Inventory=globalThis.LuminousItemInventoryRuntime;
const Curse=globalThis.LuminousCurseRuntime;
const Magic=globalThis.LuminousItemMagicRuntime;
const Persistence=globalThis.LuminousItemPersistenceRuntime;
const clone=x=>JSON.parse(JSON.stringify(x));

const consumable={instanceId:"normal_vial",definitionId:"vial",category:"consumable",
  itemType:"consumable",quantity:1,condition:100,conditionMax:100,qualityTier:2};
const cursedVial=Curse.applyItem({...consumable,instanceId:"cursed_vial"},"cursed_binding",{
  instanceId:"curse_on_vial",
}).item;
assert.equal(Curse.hasCurse(cursedVial),true);
assert.equal(Inventory.stackLimit(cursedVial,"stash"),1);
assert.equal(Inventory.canStack(consumable,cursedVial),false);
assert.equal(Inventory.canStack(cursedVial,clone(cursedVial)),false);
const unit={inventario_activo:{normal_vial:clone(consumable)},inventario_stash:{}};
const inserted=Inventory.insertItem(unit,cursedVial,"active");
assert.equal(inserted.inserted,true);
assert.equal(Object.values(unit.inventario_activo).length,2,"Curse cannot merge with an ordinary stack");
assert.equal(Object.values(unit.inventario_activo).filter(item=>Curse.hasCurse(item)).length,1);
const moved=Inventory.moveToStash(unit,"cursed_vial",null);
assert.equal(moved.moved,true);
assert.equal(Curse.instances(unit.inventario_stash.cursed_vial).length,1);
assert.equal(unit.inventario_stash.cursed_vial.curseInstances[0].instanceId,"curse_on_vial");

const saved=Persistence.serializeInventoryState(unit);
const restored={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
assert.equal(Persistence.applyInventoryState(restored,saved).applied,true);
assert.equal(Curse.hasCurse(restored.inventario_stash.cursed_vial),true);
assert.equal(Curse.instances(restored.inventario_stash.cursed_vial)[0].instanceId,"curse_on_vial");
assert.equal(restored.inventario_stash.cursed_vial.magic,null,
  "canonical Item serialization represents absent normal magic as null");
assert.equal(restored.inventario_stash.cursed_vial.condition,100);
assert.equal(Curse.instances(restored.inventario_stash.cursed_vial).length,1,
  "rehydration must not reapply or duplicate a Curse");

const carried=Curse.transferItem(restored.inventario_stash.cursed_vial,
  {...consumable,instanceId:"recipient_vial"},"curse_on_vial");
assert.equal(carried.transferred,true);
assert.equal(Curse.instances(carried.source).length,0);
assert.equal(Curse.instances(carried.destination).length,1);
const transferUnit={inventario_activo:{
  old_vial:carried.source,
  recipient_vial:carried.destination,
},inventario_stash:{}};
const transferredSnapshot=Persistence.serializeInventoryState(transferUnit);
const loadedTransfer={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
assert.equal(Persistence.applyInventoryState(loadedTransfer,transferredSnapshot).applied,true);
assert.equal(Object.values(loadedTransfer.inventario_activo)
  .reduce((total,item)=>total+Curse.instances(item).length,0),1,
  "Curse may exist only once across a transfer and inventory reload");
assert.equal(Curse.instances(loadedTransfer.inventario_activo.recipient_vial)[0].targetInstanceId,
  "recipient_vial");
assert.equal(Curse.instances(loadedTransfer.inventario_activo.old_vial).length,0);

const sword={instanceId:"equipped_curse",definitionId:"sword",category:"weapon",
  itemType:"weapon",quantity:1,equipped:true};
const cursedSword=Curse.applyItem(sword,"cursed_binding",{instanceId:"curse_lock"}).item;
const equippedUnit={inventario_activo:{equipped_curse:cursedSword},
  inventario_stash:{},equipment:{mainHand:cursedSword,accessories:[]}};
const blocked=Inventory.moveToStash(equippedUnit,"equipped_curse",null);
assert.equal(blocked.moved,false);
assert.equal(blocked.reason,"curse_item_unequip_locked");
assert.equal(equippedUnit.inventario_stash.equipped_curse,undefined);
assert.equal(equippedUnit.equipment.mainHand.instanceId,"equipped_curse");
const sealed=Curse.resolveItem(cursedSword,"curse_lock","seal");
assert.equal(sealed.changed,true);
equippedUnit.inventario_activo.equipped_curse=sealed.item;
equippedUnit.equipment.mainHand=sealed.item;
assert.equal(Inventory.moveToStash(equippedUnit,"equipped_curse",null).moved,true,
  "Seal suspends the equipment lock without removing the Curse");
assert.equal(Curse.hasCurse(equippedUnit.inventario_stash.equipped_curse),true);

const enchanterBound={instanceId:"ench_bound",definitionId:"sword",category:"weapon",
  itemType:"weapon",quantity:1,equipped:true,magic:{enabled:true,enchantments:[
    {definitionId:"flamebound",source:"direct",rank:1,properties:["bind"]},
  ]}};
const boundUnit={inventario_activo:{ench_bound:enchanterBound},inventario_stash:{},
  equipment:{mainHand:enchanterBound,accessories:[]}};
assert.equal(Magic.isBoundItem(enchanterBound),true);
const boundMove=Inventory.moveToStash(boundUnit,"ench_bound",null);
assert.equal(boundMove.moved,false);
assert.equal(boundMove.reason,"bound_item_unequip_locked");

console.log("Curse inventory identity, stack isolation, stash and Firebase serialization: OK");
