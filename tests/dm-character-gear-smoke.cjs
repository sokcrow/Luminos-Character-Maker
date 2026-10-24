const assert=require("node:assert/strict");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/anatomy-equipment-engine.js");
require("../js/item-augmentation-runtime.js");
require("../js/item-equipment-bridge.js");
require("../js/item-persistence-runtime.js");
require("../js/item-realtime-sync.js");
require("../js/dm-character-gear-core.js");
// Package uses ESM: require() runs the side effects but does not return module.exports.
const core=globalThis.LuminousDmCharacterGearCore;
const persistence=globalThis.LuminousItemPersistenceRuntime;
const bridge=globalThis.LuminousItemEquipmentBridge;
assert.equal(typeof core?.apply,"function","DM gear core must load in Node 22");
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
// The player should see the installed Augment and equipment from Firebase.
const dmEquipped=core.apply(base(),{type:"equip",key:"knife",slot:"mainHand"}).unit;
const dmInstalled=core.apply(dmEquipped,{type:"install",key:"eye",at:123}).unit;
const snapshotOf=(unit)=>({
  schemaVersion:persistence.schemaVersion,
  inventario_activo:unit.inventario_activo,
  inventario_stash:unit.inventario_stash,
  equipmentRefs:unit.itemEquipmentRefs,
  augmentations:unit.augmentations || [],
});
const playerHud={equipment:{
  mainHand:{instanceId:"old_weapon"},
  accessories:[{instanceId:"old_accessory"}],
}};
assert.equal(persistence.applyInventoryState(playerHud,snapshotOf(dmInstalled)).applied,true);
assert.equal(bridge.getSlotItem(playerHud,"mainHand")?.instanceId,"knife1");
assert.equal(bridge.equippedSlots(playerHud).augments.length,1);
assert.deepEqual(playerHud.equipment.accessories,[]);
const dmUnequipped=core.apply(dmInstalled,{type:"unequip",slot:"mainHand"}).unit;
const dmRemoved=core.apply(dmUnequipped,{type:"remove",key:"eye1"}).unit;
persistence.applyInventoryState(playerHud,snapshotOf(dmRemoved));
assert.equal(bridge.getSlotItem(playerHud,"mainHand"),null,"DM unequip clears live HUD");
assert.equal(bridge.equippedSlots(playerHud).augments.length,0,"DM removal clears live Augments");
assert.equal(persistence.serializeInventoryState(playerHud).equipmentRefs.mainHand,null,
  "Player save cannot re-equip removed weapon");

// Legacy anatomy keys must also hydrate without preserving stale aliases.
persistence.syncInstalledAugments(playerHud,{bodyAugmentations:dmInstalled.augmentations});
assert.equal(bridge.equippedSlots(playerHud).augments.length,1);
assert.equal(playerHud.augmentations,undefined);
persistence.syncInstalledAugments(playerHud,{}, {clearMissing:true});
assert.equal(bridge.equippedSlots(playerHud).augments.length,0);

(async()=>{
  const prefix="campaña/jugadores/p1";
  const values=new Map([
    [prefix+"/inventario_activo",dmInstalled.inventario_activo],
    [prefix+"/inventario_stash",dmInstalled.inventario_stash],
    [prefix+"/itemEquipmentRefs",dmInstalled.itemEquipmentRefs],
    [prefix+"/itemInventorySchemaVersion",persistence.schemaVersion],
    [prefix+"/augmentations",dmInstalled.augmentations],
  ]);
  const watchers=new Map();
  const snapshot=(path)=>({val:()=>values.get(path)??null});
  const db={ref(path){return {
    once:async()=>snapshot(path),
    on(event,handler){watchers.set(path,handler);handler(snapshot(path));},
    off(event,handler){if(watchers.get(path)===handler)watchers.delete(path);},
  }}};
  const loaded=await persistence.loadPlayerInventory(db,"p1");
  assert.equal(loaded.loaded,true);
  assert.equal(loaded.state.augmentations.length,1,"Reload keeps Augments");
  let received=null;
  const unsubscribe=persistence.subscribePlayerInventory(db,"p1",(state)=>{received=state});
  await Promise.resolve();
  assert.equal(received.augmentations.length,1,"Realtime subscription includes Augments");
  values.set(prefix+"/augmentations",[]);
  watchers.get(prefix+"/augmentations")(snapshot(prefix+"/augmentations"));
  await Promise.resolve();
  assert.deepEqual(received.augmentations,[],"Realtime removal propagates");
  unsubscribe();
  assert.equal(watchers.size,0,"Subscription cleanup includes anatomy listeners");

  // Default player HUD path uses RealtimeSync.bindPeer rather than the fallback.
  values.set(prefix+"/augmentations",dmInstalled.augmentations);
  const peer=globalThis.LuminousItemRealtimeSync.bindPeer({
    db,playerId:"p1",unit:{},watchStashAccess:false,
  });
  await Promise.resolve();
  assert.equal(bridge.equippedSlots(peer.unit).augments.length,1,"Peer receives DM Augment installation");
  assert.equal(bridge.getSlotItem(peer.unit,"mainHand")?.instanceId,"knife1");
  values.set(prefix+"/augmentations",[]);
  values.set(prefix+"/itemEquipmentRefs",{mainHand:null,offHand:null,armor:null,shield:null,accessoryIds:[]});
  watchers.get(prefix+"/augmentations")(snapshot(prefix+"/augmentations"));
  watchers.get(prefix+"/itemEquipmentRefs")(snapshot(prefix+"/itemEquipmentRefs"));
  await Promise.resolve();
  assert.equal(bridge.equippedSlots(peer.unit).augments.length,0,"Peer receives DM extraction");
  assert.equal(bridge.getSlotItem(peer.unit,"mainHand"),null,"Peer receives DM unequip");
  peer.dispose();
  assert.equal(watchers.size,0);
  console.log("DM_GEAR_SMOKE_PASS");
})().catch((error)=>{console.error(error);process.exitCode=1;});