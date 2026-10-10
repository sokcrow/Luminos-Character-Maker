"use strict";
const assert=require("node:assert/strict");
const Atomic=require("../js/item-enchanter-firebase-transaction.js");

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
  itemEquipmentRefs:{},
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

  const unavailable=await request({ref(){throw Error("NETWORK ERROR");}});
  assert.equal(unavailable.committed,false);
  assert.equal(unavailable.reason,"atomic_database_error");
  console.log("Enchanter atomic Firebase payment/material/item/removal/duplicate smoke: OK");
})().catch(error=>{console.error(error);process.exitCode=1;});
