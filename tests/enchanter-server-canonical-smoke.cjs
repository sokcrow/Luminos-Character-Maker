"use strict";
const assert=require("node:assert/strict");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-magic-knowledge-runtime.js");
require("../js/item-enchantment-compendium-runtime.js");
require("../js/item-enchanter-service-runtime.js");
const {commitEnchanterAtomic}=require("../functions/enchanter-atomic.cjs");
const clone=value=>JSON.parse(JSON.stringify(value));
const S=globalThis.LuminousItemEnchanterServiceRuntime;
const E=globalThis.LuminousItemEnchantmentEngine;
const Shop={serviceEnabled:(shop,service)=>shop.enchanterProvider.services.includes(service),
  isPlayerAllowed:()=>true};
const player={uid:"auth_owner",ahn:2000000,finance:{currentBalance:2000000},
  inventario_activo:{sword:{instanceId:"sword",definitionId:"sword",
    itemType:"weapon",category:"weapon",tier:5,condition:100,conditionMax:100,
    enchantmentBaseValueAhn:500000}},
  inventario_stash:{},enchanterTransactions:{},enchanterJobs:{}};
const shop={nombre:"Arcane Forge",enchanterProvider:{id:"master_enchanter",
  maxRank:3,knownEnchantments:["flamebound"],services:["enchant"],reliability:1,
  durationHoursByRank:{"1":8},
  providerMaterials:[{instanceId:"catalyst",definitionId:"enchanted_dust",
    quantity:2,unitValueAhn:5000,useTags:["enchantment_material"]}]}};
const state={campaña:{jugadores:{hero:player},tiendas:{forge:shop},
  calendario:{timestamp:1710000000000}}};
const db={ref(path){
  assert.equal(path,"campaña");
  return {async transaction(fn){
    const next=fn(clone(state.campaña));
    if(next===undefined)return {committed:false,snapshot:{val:()=>clone(state.campaña)}};
    state.campaña=clone(next);
    return {committed:true,snapshot:{val:()=>clone(state.campaña)}};
  }};
}};
const params={database:db,authUid:"auth_owner",Services:S,Engine:E,Shop};
(async()=>{
  const initialBalance=player.ahn;
  const initialTime=state.campaña.calendario.timestamp;
  const intent={playerId:"hero",shopId:"forge",itemInstanceId:"sword",
    service:"enchant",definitionId:"flamebound",rank:1};
  const started=await commitEnchanterAtomic({...params,
    request:{...intent,transactionId:"canonical_timed"}});
  assert.equal(started.committed,true,started.reason);
  assert.equal(started.receipt?.started,true);
  const afterStart=state.campaña.jugadores.hero;
  assert.equal(afterStart.ahn,initialBalance-755000,
    "canonical Rank I service cost is calculated on server, not by the Player");
  assert.equal(afterStart.inventario_activo.sword,undefined,
    "Item is physically held by Enchanter until job completes");
  assert.equal(afterStart.enchanterJobs.canonical_timed.status,"in_service");
  assert.equal(state.campaña.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,1,
    "provider ritual stock is debited in the same Firebase transaction");
  const early=await commitEnchanterAtomic({...params,
    request:{...intent,transactionId:"canonical_timed:delivery",
      operation:"pickup",jobId:"canonical_timed"}});
  assert.equal(early.committed,false);
  assert.equal(early.reason,"service_not_ready");
  state.campaña.calendario.timestamp=initialTime+8*3600000;
  const completed=await commitEnchanterAtomic({...params,
    request:{...intent,transactionId:"canonical_timed:delivery",
      operation:"pickup",jobId:"canonical_timed"}});
  assert.equal(completed.committed,true,completed.reason);
  assert.equal(completed.receipt?.delivered,true);
  assert.equal(state.campaña.jugadores.hero.ahn,initialBalance-755000);
  assert.equal(state.campaña.jugadores.hero.enchanterJobs.canonical_timed.status,"completed");
  assert.equal(state.campaña.jugadores.hero.inventario_activo.sword.magic.enchantments[0].definitionId,
    "flamebound");
  assert.equal(state.campaña.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,1);
  const duplicate=await commitEnchanterAtomic({...params,
    request:{...intent,transactionId:"canonical_timed:delivery",
      operation:"pickup",jobId:"canonical_timed"}});
  assert.equal(duplicate.reason,"duplicate_transaction",
    "canonical pickup must be idempotent across browser reconnects");
  // Removal uses the same privileged transaction as application. No client
  // may bypass cost, choose a second Item Instance or repay a processed receipt.
  const provider=state.campaña.tiendas.forge.enchanterProvider;
  provider.services.push("remove_rewrite");
  provider.servicePriceAhn={remove_rewrite:12500};
  state.campaña.jugadores.hero.inventario_stash.spare={
    instanceId:"spare",definitionId:"sword",itemType:"weapon",category:"weapon",tier:5,
  };
  const removeRequest={...intent,service:"remove_rewrite",procedure:"direct_remove",
    transactionId:"canonical_remove",definitionId:"flamebound"};
  const originalBalance=state.campaña.jugadores.hero.ahn;
  const originalStock=provider.providerMaterials[0].quantity;
  state.campaña.jugadores.hero.ahn=0;
  state.campaña.jugadores.hero.finance.currentBalance=0;
  const beforeFailure=clone(state.campaña);
  const failRemoval=await commitEnchanterAtomic({...params,request:removeRequest});
  assert.equal(failRemoval.committed,false);
  assert.equal(failRemoval.reason,"insufficient_ahn");
  assert.deepEqual(state.campaña,beforeFailure,
    "failed removal must preserve currency, Enchantment and vendor stock");
  state.campaña.jugadores.hero.ahn=originalBalance;
  state.campaña.jugadores.hero.finance.currentBalance=originalBalance;
  const removed=await commitEnchanterAtomic({...params,request:removeRequest});
  assert.equal(removed.committed,true,removed.reason);
  assert.equal(state.campaña.jugadores.hero.inventario_activo.sword.magic.enchantments.length,0);
  assert.equal(state.campaña.jugadores.hero.inventario_stash.spare.instanceId,"spare",
    "removal must not mutate another Item Instance");
  assert.ok(state.campaña.jugadores.hero.ahn<originalBalance);
  assert.equal(state.campaña.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,
    originalStock,"removal does not silently consume enchantment catalysts");
  const afterRemoval=clone(state.campaña);
  const replayRemoval=await commitEnchanterAtomic({...params,request:removeRequest});
  assert.equal(replayRemoval.reason,"duplicate_transaction");
  assert.deepEqual(state.campaña,afterRemoval,"removal replay must not double charge");
  const wrongInstance=await commitEnchanterAtomic({...params,
    request:{...removeRequest,transactionId:"wrong_item",itemInstanceId:"spare"}});
  assert.equal(wrongInstance.committed,false);
  assert.equal(state.campaña.jugadores.hero.inventario_stash.spare.magic,undefined);
  console.log("Enchanter canonical Firebase server timed quote, stock, escrow, pickup and removal: OK");
})().catch(err=>{console.error(err);process.exitCode=1;});
