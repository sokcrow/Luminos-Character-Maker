const assert=require("node:assert/strict");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/anatomy-equipment-engine.js");
require("../js/item-augmentation-runtime.js");
require("../js/item-equipment-bridge.js");
const core=require("../js/dm-character-gear-core.js");
const base=(removable=true)=>({id:"p1",inventario_activo:{
 knife:{instanceId:"knife1",category:"weapon",equipment:{kind:"weapon",handCost:1},quantity:1},
 great:{instanceId:"great1",category:"weapon",equipment:{kind:"weapon",handCost:2},quantity:1},
 eye:{instanceId:"eye1",category:"augmentation",quantity:1,stackable:false,runtime:{augmentation:{enabled:true,targetPartTypes:["eye"],removable}}}
},inventario_stash:{},itemEquipmentRefs:{}});
let player=base(),initial=JSON.stringify(player);
let result=core.apply(player,{type:"equip",key:"knife",slot:"mainHand"});
assert.equal(result.ok,true,result.reason);assert.equal(JSON.stringify(player),initial,"No mutate initial snapshot");
player=result.unit;assert.equal(player.itemEquipmentRefs.mainHand,"knife1");assert.ok(player.inventario_activo.knife);
result=core.apply(player,{type:"equip",key:"great",slot:"mainHand"});
assert.equal(result.ok,true,result.reason);player=result.unit;
assert.equal(player.itemEquipmentRefs.mainHand,"great1");
assert.equal(player.itemEquipmentRefs.offHand,"great1");
assert.equal(player.inventario_activo.knife.equipped,false);
result=core.apply(player,{type:"unequip",slot:"mainHand"});
assert.equal(result.ok,true,result.reason);player=result.unit;
assert.equal(player.itemEquipmentRefs.mainHand,null);assert.equal(player.itemEquipmentRefs.offHand,null);
assert.ok(player.inventario_activo.great);
assert.equal(core.apply(player,{type:"equip",key:"eye",slot:"armor"}).ok,false);
result=core.apply(player,{type:"install",key:"eye",source:"active",at:123});
assert.equal(result.ok,true,result.reason);player=result.unit;
assert.equal(player.inventario_activo.eye,undefined);
assert.equal(player.augmentations.length,1);
assert.equal(player.augmentations[0].installed,true);
assert.deepEqual(player.augmentations[0].installedBodyPartIds,["left_eye"]);
assert.equal(player.augmentations[0].installedAt,123);
assert.equal(core.apply(player,{type:"install",key:"eye"}).ok,false);
result=core.apply(player,{type:"remove",key:"eye1"});
assert.equal(result.ok,true,result.reason);player=result.unit;
assert.equal(player.augmentations.length,0);
assert.equal(Object.values(player.inventario_activo).filter(x=>x.instanceId==="eye1").length,1);
let bonded=base(false);
bonded=core.apply(bonded,{type:"install",key:"eye",at:11}).unit;
assert.equal(core.apply(bonded,{type:"remove",key:"eye1"}).ok,false);
assert.equal(bonded.augmentations.length,1);
let invalid=base();invalid.inventario_activo.eye.runtime.augmentation.targetPartTypes=["made_up_organ"];
assert.equal(core.apply(invalid,{type:"install",key:"eye"}).ok,false);
assert.ok(invalid.inventario_activo.eye);
let boundGear=core.apply(base(),{type:"equip",key:"knife",slot:"mainHand"}).unit;
const blocked=core.apply(boundGear,{type:"equip",key:"great",slot:"mainHand"},{
  magic:{isBoundItem:item=>item.instanceId==="knife1"}
});
assert.equal(blocked.ok,false,"Two-handed replacement cannot bypass a bound weapon");
assert.equal(boundGear.itemEquipmentRefs.mainHand,"knife1");
let accessory=base();
accessory.inventario_activo.ring={instanceId:"ring1",category:"accessory",quantity:1};
assert.equal(core.apply(accessory,{type:"equip",key:"ring",slot:"accessory1"}).ok,false,
  "Cannot leave a sparse accessory slot that RTDB refs cannot represent");
accessory.inventario_activo.ring.quantity=0;
assert.equal(core.apply(accessory,{type:"equip",key:"ring",slot:"accessory0"}).ok,false,
  "Empty stacks cannot be equipped");
let stashed=base();stashed.inventario_stash.eye=stashed.inventario_activo.eye;delete stashed.inventario_activo.eye;
result=core.apply(stashed,{type:"install",key:"eye",source:"stash"});
assert.equal(result.ok,true,result.reason);
assert.equal(result.unit.inventario_stash.eye,undefined);
assert.equal(result.unit.augmentations.length,1);
console.log("DM_GEAR_SMOKE_PASS");