"use strict";
const assert=require("node:assert/strict");
const {commitEnchanterAtomic}=require("../functions/enchanter-atomic.cjs");
const clone=x=>JSON.parse(JSON.stringify(x));
function db(initial){
  const store={campaign:clone(initial),attempts:0};
  return {store,ref(path){
    assert.equal(path,"campaña","cross-Shop writes must use the shared ancestor");
    return {async transaction(callback){
      store.attempts++;
      const after=callback(clone(store.campaign));
      if(after===undefined)return {committed:false,snapshot:{val:()=>clone(store.campaign)}};
      store.campaign=clone(after);
      return {committed:true,snapshot:{val:()=>clone(store.campaign)}};
    }};
  }};
}
const campaign={
  jugadores:{hero:{uid:"player_uid",ahn:500,finance:{currentBalance:500},
    inventario_activo:{sword:{instanceId:"sword",itemType:"weapon",tier:5}},
    inventario_stash:{},enchanterTransactions:{}}},
  tiendas:{forge:{nombre:"Forge",enchanterProvider:{
    id:"npc",name:"Enchanter",maxRank:3,services:["enchant"],
    providerMaterials:[{instanceId:"dust",quantity:2}],
  }}},
};
const Shop={serviceEnabled(shop,id){return shop.enchanterProvider.services.includes(id)},
  isPlayerAllowed(){return true;}};
const Services={
  SERVICE_IDS:["enchant"],
  normalizeProviderProfile(p){return p;},
  quoteEnchantService(p,item,id,rank,params){
    if(id!=="flamebound"||rank!==1)return {quoted:false,reason:"invalid_enchantment"};
    if(!params.providerMaterials.some(m=>m.quantity>0))
      return {quoted:false,reason:"out_of_provider_stock"};
    return {quoted:true,service:"enchant",definitionId:id,rank,totalAhn:100,
      duration:{resolved:false,hours:0}};
  },
  commitServiceTransaction(player,item,quote,options){
    if(player.ahn<quote.totalAhn)return {committed:false,reason:"insufficient_ahn"};
    if(!options.providerMaterials[0]?.quantity)return {committed:false,reason:"insufficient_stock"};
    if(player.enchanterTransactions?.[options.transactionId])
      return {committed:false,reason:"duplicate_transaction"};
    player.ahn-=quote.totalAhn;
    player.finance.currentBalance=player.ahn;
    options.providerMaterials[0].quantity--;
    item.magic={enchantments:[{definitionId:quote.definitionId,rank:quote.rank}]};
    const receipt={committed:true,transactionId:options.transactionId,chargedAhn:100,
      service:"enchant",itemInstanceId:item.instanceId};
    player.enchanterTransactions[options.transactionId]=clone(receipt);
    return receipt;
  },
};
const Engine={canRemoveEnchantment(){return {allowed:false}}};
const request=(transactionId,overrides={})=>({
  playerId:"hero",shopId:"forge",transactionId,itemInstanceId:"sword",
  service:"enchant",definitionId:"flamebound",rank:1,
  ...overrides,
});
(async()=>{
  const duplicateIdentityDb=db({
    ...campaign,
    jugadores:{hero:{...campaign.jugadores.hero,
      inventario_stash:{duplicate_sword:{instanceId:"sword",itemType:"weapon",tier:5}},
    }},
  });
  const ambiguous=await commitEnchanterAtomic({
    database:duplicateIdentityDb,authUid:"player_uid",
    request:request("ambiguous"),Services,Shop,Engine,
  });
  assert.equal(ambiguous.committed,false);
  assert.equal(ambiguous.reason,"duplicate_item_instance_identity");
  assert.equal(duplicateIdentityDb.store.campaign.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,2,
    "ambiguous Item source cannot consume vendor stock");

  const a=db(campaign);
  const pay=args=>commitEnchanterAtomic({
    database:a,authUid:"player_uid",request:args,Services,Shop,Engine,
  });
  const unauthorized=await commitEnchanterAtomic({
    database:a,authUid:"other_uid",request:request("stolen"),Services,Shop,Engine,
  });
  assert.equal(unauthorized.committed,false);
  assert.equal(unauthorized.reason,"player_not_authorized");
  assert.deepEqual(a.store.campaign,campaign,"unauthorized service cannot change state");

  const injected=await pay(request("first",{totalAhn:0,
    providerMaterials:[{quantity:9999}],freeService:true,
    result:{committed:true,chargedAhn:0},npcRoll:1}));
  assert.equal(injected.committed,true);
  assert.equal(injected.balance,400,"the server always chooses the authoritative price");
  assert.equal(a.store.campaign.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,1);
  assert.equal(a.store.campaign.jugadores.hero.inventario_activo.sword.magic.enchantments[0].definitionId,
    "flamebound");
  assert.equal(a.store.campaign.jugadores.hero.finance.transactionHistory[
    Object.keys(a.store.campaign.jugadores.hero.finance.transactionHistory)[0]
  ].monto,-100);
  assert.equal(injected.player.uid,"player_uid");
  assert.equal(injected.player.enchanterTransactions.first.committed,true);

  const oldSnapshot=clone(a.store.campaign);
  const duplicate=await pay(request("first"));
  assert.equal(duplicate.committed,false);
  assert.equal(duplicate.reason,"duplicate_transaction");
  assert.deepEqual(a.store.campaign,oldSnapshot,"duplicate service cannot double charge");

  const second=await pay(request("second"));
  assert.equal(second.committed,true);
  assert.equal(second.balance,300);
  assert.equal(a.store.campaign.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,0);

  const stockSnapshot=clone(a.store.campaign);
  const noStock=await pay(request("third"));
  assert.equal(noStock.committed,false);
  assert.equal(noStock.reason,"out_of_provider_stock");
  assert.deepEqual(a.store.campaign,stockSnapshot,
    "an out-of-stock provider cannot charge or mutate the Item");

  const noMoneyDb=db({...campaign,jugadores:{
    hero:{...campaign.jugadores.hero,ahn:50,finance:{currentBalance:50}},
  }});
  const noMoney=await commitEnchanterAtomic({database:noMoneyDb,authUid:"player_uid",
    request:request("insufficient"),Services,Shop,Engine});
  assert.equal(noMoney.committed,false);
  assert.equal(noMoney.reason,"insufficient_ahn");
  assert.deepEqual(noMoneyDb.store.campaign.jugadores.hero.finance,{currentBalance:50});
  assert.equal(noMoneyDb.store.campaign.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,2);

  const timedServices={
    ...Services,
    quoteEnchantService(...args){
      return {...Services.quoteEnchantService(...args),
        duration:{resolved:true,hours:8}};
    },
    startDeferredServiceTransaction(player,item,quote,opts){
      const before=clone(item);
      const paid=Services.commitServiceTransaction(player,item,quote,opts);
      if(!paid.committed)return paid;
      const after=clone(item);
      delete player.inventario_activo.sword;
      player.enchanterJobs={
        [opts.transactionId]:{
          jobId:opts.transactionId,itemInstanceId:"sword",providerId:"npc",
          service:"enchant",status:"in_service",clockSource:"campaign",
          startedAt:opts.worldTimestamp,readyAt:opts.worldTimestamp+3600000,
          itemBefore:before,itemAfter:after,
        },
      };
      return {...paid,started:true,player:clone(player),
        providerMaterialsAfter:clone(opts.providerMaterials)};
    },
    completeDeferredServiceTransaction(player,jobId,opts){
      const job=player.enchanterJobs?.[jobId];
      if(!job || job.status!=="in_service")
        return {committed:false,reason:"service_job_not_pending"};
      if(opts.worldTimestamp<job.readyAt)
        return {committed:false,reason:"service_not_ready"};
      player.inventario_activo.sword=clone(job.itemAfter);
      job.status="completed";
      const receipt={committed:true,transactionId:jobId+":delivery",
        chargedAhn:0,service:"enchant",itemInstanceId:"sword"};
      player.enchanterTransactions[receipt.transactionId]=receipt;
      return {...receipt,delivered:true,player:clone(player)};
    },
  };
  const timedDb=db({...campaign,calendario:{timestamp:1710000000000}});
  const timedArgs=(intent)=>commitEnchanterAtomic({
    database:timedDb,authUid:"player_uid",request:intent,
    Services:timedServices,Shop,Engine,
  });
  const escrow=await timedArgs(request("timed_one"));
  assert.equal(escrow.committed,true);
  assert.equal(timedDb.store.campaign.jugadores.hero.inventario_activo.sword,undefined);
  assert.equal(timedDb.store.campaign.jugadores.hero.enchanterJobs.timed_one.status,"in_service");
  assert.equal(timedDb.store.campaign.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,1,
    "a timed intake must debit the vendor in the same atomic commit");
  const early=await timedArgs(request("timed_one:delivery",{
    operation:"pickup",jobId:"timed_one",
  }));
  assert.equal(early.committed,false);
  assert.equal(early.reason,"service_not_ready");
  assert.equal(timedDb.store.campaign.jugadores.hero.inventario_activo.sword,undefined);
  timedDb.store.campaign.calendario.timestamp=1710003600000;
  const delivered=await timedArgs(request("timed_one:delivery",{
    operation:"pickup",jobId:"timed_one",
  }));
  assert.equal(delivered.committed,true);
  assert.equal(delivered.balance,400,"pickup must never charge the Player twice");
  assert.equal(timedDb.store.campaign.jugadores.hero.enchanterJobs.timed_one.status,"completed");
  assert.equal(timedDb.store.campaign.jugadores.hero.inventario_activo.sword.magic.enchantments.length,1);
  const replayDelivery=await timedArgs(request("timed_one:delivery",{
    operation:"pickup",jobId:"timed_one",
  }));
  assert.equal(replayDelivery.reason,"duplicate_transaction");

  const rejectedPickup=await pay(request("fake:delivery",{
    operation:"pickup",jobId:"different",
  }));
  assert.equal(rejectedPickup.reason,"pickup_transaction_id_mismatch");

  const unknown=await pay(request("malformed",{service:"unknown"}));
  assert.equal(unknown.committed,false);
  assert.equal(unknown.reason,"unknown_service");
  console.log("Enchanter privileged atomic player/Shop stock, Auth, replay and rollback smoke: OK");
})().catch(error=>{console.error(error);process.exitCode=1;});
