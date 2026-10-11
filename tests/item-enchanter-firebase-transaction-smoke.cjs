"use strict";
const assert=require("node:assert/strict");
require("../js/item-enchanter-firebase-transaction.js");
const Atomic=globalThis.LuminousEnchanterFirebaseTransaction;

const clone=x=>JSON.parse(JSON.stringify(x));
const persistence={
  schemaVersion:3,
  serializeInventoryState(unit={}) {
    return {
      schemaVersion:3,
      inventario_activo:clone(unit.inventario_activo || {}),
      inventario_stash:clone(unit.inventario_stash || {}),
      equipmentRefs:clone(unit.itemEquipmentRefs || {}),
      attunedItemInstanceIds:clone(unit.attunedItemInstanceIds || []),
      itemMagicKnowledge:clone(unit.itemMagicKnowledge || {}),
      enchantmentCompendium:clone(unit.enchantmentCompendium || {}),
      enchanterTransactions:clone(unit.enchanterTransactions || {}),
      enchanterJobs:clone(unit.enchanterJobs || {}),
    };
  },
};
function fakeDatabase(value) {
  const store={value:clone(value),requests:0,historyId:0};
  return {
    store,
    ref(path) {
      return {
        push() {return {key:"journal_"+(++store.historyId)};},
        async transaction(update) {
          store.requests++;
          const candidate=update(clone(store.value));
          if(candidate===undefined) return {committed:false,snapshot:{val:()=>clone(store.value)}};
          store.value=clone(candidate);
          return {committed:true,snapshot:{val:()=>clone(store.value)}};
        },
      };
    },
  };
}
const original={
  ahn:1000,
  finance:{currentBalance:1000,transactionHistory:{before:{monto:100}}},
  transacciones:{before:{monto:100}},
  inventario_activo:{
    sword:{instanceId:"sword",magic:{enchantments:[]}},
    ruby:{instanceId:"ruby",quantity:2},
  },
  inventario_stash:{},
  itemEquipmentRefs:{mainHand:"sword",offHand:null,armor:null,shield:null,accessoryIds:["ruby"]},
  attunedItemInstanceIds:[],
  itemMagicKnowledge:{},
  enchantmentCompendium:{},
  enchanterTransactions:{},
};
const paid=clone(original);
paid.ahn=900;
paid.finance.currentBalance=900;
paid.inventario_activo.sword.magic.enchantments=[{definitionId:"flamebound",rank:1}];
paid.inventario_activo.ruby.quantity=1;
paid.enchanterTransactions.tx_enchant={committed:true,chargedAhn:100};

const request=(db,before=original,after=paid,extra={})=>
  Atomic.commitPlayerEnchanterService({db,playerId:"player_test",
    before,after,persistence,shopId:"shop",
    providerMaterialsBefore:[],providerMaterialsAfter:[],
    result:{committed:true,transactionId:"tx_enchant",itemInstanceId:"sword",
      chargedAhn:100,service:"enchant",timestamp:1000},
    ...extra,
  });
(async()=>{
  const db=fakeDatabase(original);
  const saved=await request(db);
  assert.equal(saved.committed,true);
  assert.equal(db.store.requests,1);
  assert.equal(db.store.value.ahn,900);
  assert.equal(db.store.value.finance.currentBalance,900);
  assert.equal(db.store.value.itemEquipmentRefs.mainHand,"sword","Enchanter must not unequip the weapon");
  assert.deepStrictEqual(db.store.value.itemEquipmentRefs.accessoryIds,["ruby"]);
  assert.equal(db.store.value.inventario_activo.ruby.quantity,1);
  assert.equal(db.store.value.inventario_activo.sword.magic.enchantments.length,1);
  assert.equal(db.store.value.finance.transactionHistory.journal_1.monto,-100);
  assert.equal(db.store.value.transacciones.journal_2.monto,-100);
  assert.equal(db.store.value.enchanterTransactions.tx_enchant.committed,true);

  const replay=await request(db);
  assert.equal(replay.committed,false);
  assert.equal(replay.reason,"duplicate_transaction");
  assert.equal(db.store.value.ahn,900,"duplicate cannot double-charge a persisted payment");

  const competing=fakeDatabase(original);
  competing.store.value.finance.currentBalance=800;
  const noDoubleSpend=await request(competing);
  assert.equal(noDoubleSpend.committed,false);
  assert.equal(noDoubleSpend.reason,"wallet_changed");
  assert.equal(competing.store.value.ahn,1000);
  assert.equal(competing.store.value.inventario_activo.sword.magic.enchantments.length,0);

  const changedMaterials=fakeDatabase(original);
  changedMaterials.store.value.inventario_activo.ruby.quantity=0;
  const staleMaterial=await request(changedMaterials);
  assert.equal(staleMaterial.committed,false);
  assert.equal(staleMaterial.reason,"inventory_or_knowledge_changed");
  assert.equal(changedMaterials.store.value.ahn,1000);
  assert.equal(changedMaterials.store.value.inventario_activo.sword.magic.enchantments.length,0);

  const noVendorStock=await request(fakeDatabase(original),original,paid,{
    providerMaterialsBefore:[{instanceId:"vendor_gem",quantity:2}],
    providerMaterialsAfter:[{instanceId:"vendor_gem",quantity:1}],
  });
  assert.equal(noVendorStock.committed,false);
  assert.equal(noVendorStock.reason,"provider_stock_requires_server_atomic_commit");

  const wrongTarget=await request(fakeDatabase(original),original,paid,{
    result:{committed:true,transactionId:"tx_enchant",itemInstanceId:"other",chargedAhn:100},
  });
  assert.equal(wrongTarget.committed,false);
  assert.equal(wrongTarget.reason,"receipt_or_target_item_mismatch");

  const afterRemove=clone(paid);
  afterRemove.ahn=850;
  afterRemove.finance.currentBalance=850;
  afterRemove.inventario_activo.sword.magic.enchantments=[];
  afterRemove.enchanterTransactions.tx_remove={committed:true,chargedAhn:50};
  const removed=await request(fakeDatabase(paid),paid,afterRemove,{
    result:{committed:true,transactionId:"tx_remove",itemInstanceId:"sword",
      chargedAhn:50,service:"remove_rewrite",timestamp:2000},
  });
  assert.equal(removed.committed,true);
  assert.equal(removed.snapshot.ahn,850);
  assert.equal(removed.snapshot.inventario_activo.sword.magic.enchantments.length,0);

  // Regression: the production serializer must read Firebase itemEquipmentRefs
  // even when the snapshot has no hydrated equipment object.
  require("../js/item-persistence-runtime.js");
  const realPersistence=globalThis.LuminousItemPersistenceRuntime;
  const serialized=realPersistence.serializeInventoryState(original);
  assert.deepStrictEqual(serialized.equipmentRefs,original.itemEquipmentRefs);
  const withHydratedOverride=realPersistence.serializeInventoryState({
    ...original,equipment:{mainHand:null,offHand:"ruby"},
  });
  assert.equal(withHydratedOverride.equipmentRefs.mainHand,null,"Explicit unequip must win over persisted refs");
  assert.equal(withHydratedOverride.equipmentRefs.offHand,"ruby");
  assert.deepStrictEqual(withHydratedOverride.equipmentRefs.accessoryIds,["ruby"]);
  const persisted=await request(fakeDatabase(original),original,paid,{persistence:realPersistence});
  assert.equal(persisted.committed,true);
  assert.deepStrictEqual(persisted.snapshot.itemEquipmentRefs,original.itemEquipmentRefs);

  const equipmentRace=fakeDatabase(original);
  equipmentRace.store.value.itemEquipmentRefs.mainHand=null;
  const rejectedEquipment=await request(equipmentRace,original,paid,{persistence:realPersistence});
  assert.equal(rejectedEquipment.committed,false);
  assert.equal(rejectedEquipment.reason,"inventory_or_knowledge_changed");

  const unequipped=clone(original);
  unequipped.itemEquipmentRefs.mainHand=null;
  const scheduled=clone(unequipped);
  delete scheduled.inventario_activo.sword;
  scheduled.ahn=900;
  scheduled.finance.currentBalance=900;
  scheduled.enchanterJobs={tx_enchant:{jobId:"tx_enchant",status:"in_service",
    itemInstanceId:"sword",readyAt:1710028800000}};
  scheduled.enchanterTransactions={tx_enchant:{committed:true,status:"in_service",chargedAhn:100}};
  const timedDb=fakeDatabase(unequipped);
  const intake=await request(timedDb,unequipped,scheduled,{
    result:{committed:true,started:true,transactionId:"tx_enchant",
      itemInstanceId:"sword",chargedAhn:100,service:"enchant"},
  });
  assert.equal(intake.committed,true);
  assert.equal(timedDb.store.value.itemEquipmentRefs.mainHand,null);
  assert.equal(timedDb.store.value.inventario_activo.sword,undefined,
    "pending Item must never remain usable in persisted inventory");
  assert.equal(timedDb.store.value.enchanterJobs.tx_enchant.status,"in_service");
  const received=clone(scheduled);
  received.inventario_activo.sword=clone(original.inventario_activo.sword);
  received.inventario_activo.sword.magic.enchantments=[{definitionId:"flamebound",rank:1}];
  received.enchanterJobs.tx_enchant.status="completed";
  received.enchanterTransactions["tx_enchant:delivery"]={
    committed:true,chargedAhn:0,deliveryOf:"tx_enchant",
  };
  const pickup=await request(timedDb,scheduled,received,{
    result:{committed:true,delivered:true,deliveryOf:"tx_enchant",
      transactionId:"tx_enchant:delivery",itemInstanceId:"sword",
      chargedAhn:0,service:"enchant",timestamp:1710028800000},
  });
  assert.equal(pickup.committed,true);
  assert.equal(timedDb.store.value.ahn,900,"pickup must not charge a second time");
  assert.equal(timedDb.store.value.enchanterJobs.tx_enchant.status,"completed");
  assert.equal(timedDb.store.value.inventario_activo.sword.magic.enchantments.length,1);
  const duplicatePickup=await request(timedDb,scheduled,received,{
    result:{committed:true,delivered:true,deliveryOf:"tx_enchant",
      transactionId:"tx_enchant:delivery",itemInstanceId:"sword",
      chargedAhn:0,service:"enchant"},
  });
  assert.equal(duplicatePickup.committed,false);
  assert.equal(duplicatePickup.reason,"duplicate_transaction");

  const falselyEscrowed=await request(fakeDatabase(unequipped),unequipped,{
    ...scheduled,inventario_activo:clone(unequipped.inventario_activo),
  },{result:{committed:true,started:true,transactionId:"tx_enchant",
    itemInstanceId:"sword",chargedAhn:100,service:"enchant"}});
  assert.equal(falselyEscrowed.committed,false);
  assert.equal(falselyEscrowed.reason,"invalid_service_intake",
    "atomic persistence must reject any paid job that leaves the Item usable");
  const equippedIntake=await request(fakeDatabase(original),original,scheduled,{
    result:{committed:true,started:true,transactionId:"tx_enchant",
      itemInstanceId:"sword",chargedAhn:100,service:"enchant"}});
  assert.equal(equippedIntake.committed,false);
  assert.equal(equippedIntake.reason,"invalid_service_intake");

  const unavailable=await request({ref(){throw Error("NETWORK ERROR");}});
  assert.equal(unavailable.committed,false);
  assert.equal(unavailable.reason,"atomic_database_error");
  console.log("Enchanter atomic Firebase payment/material/item/removal/duplicate smoke: OK");
})().catch(error=>{console.error(error);process.exitCode=1;});
