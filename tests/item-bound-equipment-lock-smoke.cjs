"use strict";

const assert = require("assert");

require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-equipment-bridge.js");

const Magic = globalThis.LuminousItemMagicRuntime;
const Bridge = globalThis.LuminousItemEquipmentBridge;

assert.ok(Magic && Bridge);
assert.strictEqual(Bridge.version,3);

const bound = {
  instanceId:"bound_equipped_weapon",
  definitionId:"bound_equipped_weapon",
  itemType:"weapon",
  category:"weapon",
  equipment:{kind:"weapon",handCost:1},
  equipped:true,
  equippedSlot:"mainHand",
  magic:{
    enabled:true,
    enchantments:[
      {definitionId:"flamebound",rank:2,source:"direct",properties:["bind"]}
    ]
  }
};

assert.strictEqual(Magic.isBoundItem(bound),true);

const unit={
  id:"bound_unit",
  equipment:{mainHand:bound,accessories:[]},
  inventario_activo:{bound_equipped_weapon:bound},
};

const blocked=Bridge.unequipSlot(unit,"mainHand");
assert.strictEqual(blocked.unequipped,false);
assert.strictEqual(blocked.reason,"bound_item_unequip_locked");
assert.strictEqual(unit.equipment.mainHand,bound);
assert.strictEqual(bound.equipped,true);

const replacement={
  instanceId:"replacement_weapon",
  definitionId:"replacement_weapon",
  itemType:"weapon",
  category:"weapon",
  equipment:{kind:"weapon",handCost:1},
};
const replaceBlocked=Bridge.equipTo(unit,replacement,"mainHand");
assert.strictEqual(replaceBlocked.equipped,false);
assert.strictEqual(replaceBlocked.reason,"bound_item_unequip_locked");
assert.strictEqual(unit.equipment.mainHand,bound);

const forced=Bridge.unequipSlot(unit,"mainHand",{force:true});
assert.strictEqual(forced.unequipped,true);
assert.strictEqual(unit.equipment.mainHand,undefined);
assert.strictEqual(bound.equipped,false);

console.log("Bound Item equipment lock smoke: OK");
