"use strict";

const assert = require("node:assert/strict");

require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-catalog-enchantments.js");
require("../js/curse-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-magic-knowledge-runtime.js");
require("../js/item-equipment-bridge.js");

const Curse = globalThis.LuminousCurseRuntime;
const Magic = globalThis.LuminousItemMagicRuntime;
const Knowledge = globalThis.LuminousItemMagicKnowledgeRuntime;
const Bridge = globalThis.LuminousItemEquipmentBridge;

assert.ok(Curse && Magic && Knowledge && Bridge);
const original = {
  instanceId:"v1_cursed_steel",
  definitionId:"training_sword",
  category:"weapon",
  itemType:"weapon",
  name:"Training Sword",
  equipped:true,
  equipment:{kind:"weapon",handCost:1},
};
assert.equal(Magic.isCursed(original),false);
const applied = Curse.applyItem(original, "cursed_binding", {instanceId:"curse_instance_v1"});
assert.equal(applied.applied,true);
assert.equal(original.curseInstances,undefined,"draft application must not mutate source Item");
assert.equal(applied.item.magic,undefined,"autonomous curse must not create Enchantment slots");
assert.equal(Magic.isCursed(applied.item),true);
assert.equal(Magic.isMagicItem(applied.item),true);
assert.equal(Magic.isBoundItem(applied.item),false,"autonomous Binding != Enchanter Bind");
assert.equal(Curse.itemUnequipLocked(applied.item),true);

const observer = {itemMagicKnowledge:{}};
const hidden = Knowledge.presentation(observer,applied.item,{syncPassive:false});
assert.equal(hidden.cursed,false,"unknown autonomous curses cannot leak to Player display");
assert.equal(Knowledge.detectCurse(observer,applied.item).detected,true);
assert.equal(Knowledge.identifyItem(observer,applied.item).cursedFlagged,true);
assert.equal(Knowledge.identifyItem(observer,applied.item).curseDetailsRevealed,false);
assert.equal(Knowledge.identifyCurse(observer,applied.item).identified,true);

const wearer = {equipment:{mainHand:applied.item,accessories:[]},inventario_activo:{v1_cursed_steel:applied.item}};
const blocked = Bridge.unequipSlot(wearer,"mainHand");
assert.equal(blocked.unequipped,false);
assert.equal(blocked.reason,"curse_item_unequip_locked");
assert.equal(wearer.equipment.mainHand,applied.item);
assert.equal(Curse.applyItem(applied.item,"cursed_binding").reason,"curse_intensity_limit_reached");
assert.equal(Curse.resolveItem(applied.item,"curse_instance_v1","remove").reason,"curse_resolution_not_allowed");

const suppressed = Curse.resolveItem(applied.item,"curse_instance_v1","suppress");
assert.equal(suppressed.changed,true);
assert.equal(Curse.itemUnequipLocked(suppressed.item),false);
assert.equal(Magic.isCursed(suppressed.item),true);
wearer.equipment.mainHand = suppressed.item;
assert.equal(Bridge.unequipSlot(wearer,"mainHand").unequipped,true);

const resumed = Curse.resolveItem(suppressed.item,"curse_instance_v1","resume");
assert.equal(Curse.itemUnequipLocked(resumed.item),true);
const sealed = Curse.resolveItem(resumed.item,"curse_instance_v1","seal");
assert.equal(sealed.changed,true);
assert.equal(Curse.itemUnequipLocked(sealed.item),false);
assert.equal(Magic.isCursed(sealed.item),true);
const unsealed = Curse.resolveItem(sealed.item,"curse_instance_v1","unseal");
assert.equal(Curse.itemUnequipLocked(unsealed.item),true);

const transfer = Curse.transferItem(unsealed.item,
  {...original,instanceId:"second_sword",equipped:false}, "curse_instance_v1");
assert.equal(transfer.transferred,true);
assert.equal(Magic.isCursed(transfer.source),false);
assert.equal(Magic.isCursed(transfer.destination),true);
assert.equal(Curse.itemUnequipLocked(transfer.destination),true);

const broken = Curse.resolveItem(unsealed.item,"curse_instance_v1","break");
assert.equal(broken.changed,true);
assert.equal(Magic.isCursed(broken.item),false);
assert.equal(Curse.instances(broken.item).length,0);
assert.equal(Curse.instances(broken.item,{includeResolved:true}).length,1);
assert.deepEqual(broken.item.magic,undefined,"normal enchantment state must remain unmodified");

console.log("Curse Item Runtime + Magic + Equip + Knowledge: OK");
