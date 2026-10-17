"use strict";
const assert=require("node:assert/strict");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/curse-catalog.js");
require("../js/curse-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/curse-enchanter-bridge.js");
require("../js/item-enchanter-service-runtime.js");
const {commitEnchanterAtomic,quoteForIntent}=require("../functions/enchanter-atomic.cjs");
const S=globalThis.LuminousItemEnchanterServiceRuntime;
const E=globalThis.LuminousItemEnchantmentEngine;
const clone=x=>JSON.parse(JSON.stringify(x));
const base={instanceId:"server_curse_sword",definitionId:"sword",itemType:"weapon",
  category:"weapon",tier:5,condition:60,conditionMax:60,quantity:1};
const refA=E.applyEnchantment(base,"flamebound",1,{properties:["curse"],applicationId:"curse_server_A"}).reference;
const refB=E.applyEnchantment(base,"frostbound",1,{properties:["curse"],applicationId:"curse_server_B"}).reference;
assert.ok(refA && refB);
const player={uid:"owner_authorized",ahn:1000000,finance:{currentBalance:1000000},
  inventario_activo:{server_curse_sword:{...base,magic:{enabled:true,enchantments:[refA,refB]}}},
  inventario_stash:{},enchanterTransactions:{},enchanterJobs:{}};
const shop={enchanterProvider:{id:"curse_specialist",maxRank:3,
  services:["remove_curse"],servicePriceAhn:{remove_curse:2400}}};
const campaign={jugadores:{hero:player},tiendas:{forge:shop},calendario:{timestamp:1710000000000}};
const db={ref(path){assert.equal(path,"campaña");return {async transaction(fn){
  const next=fn(clone(campaign));
  if(next===undefined)return {committed:false,snapshot:{val:()=>clone(campaign)}};
  for(const key of Object.keys(campaign))delete campaign[key];
  Object.assign(campaign,clone(next));
  return {committed:true,snapshot:{val:()=>clone(campaign)}};
}}}};
const Shop={serviceEnabled:(shop,service)=>shop.enchanterProvider.services.includes(service),isPlayerAllowed:()=>true};
const params={database:db,authUid:"owner_authorized",Services:S,Engine:E,Shop};
const bare={playerId:"hero",shopId:"forge",itemInstanceId:"server_curse_sword",service:"remove_curse"};
const provider=S.normalizeProviderProfile(shop.enchanterProvider);
const quote=quoteForIntent(S,E,provider,player.inventario_activo.server_curse_sword,{
  ...bare,curseTarget:{kind:"enchantment_curse",definitionId:"frostbound",applicationId:"curse_server_B"}
},{player:[],provider:[]});
assert.equal(quote.quoted,true);
assert.equal(quote.curseTarget.definitionId,"frostbound");

(async()=>{
const starting=clone(campaign);
const ambiguous=await commitEnchanterAtomic({...params,request:{...bare,transactionId:"ambiguous_trial"}});
assert.equal(ambiguous.committed,false);
assert.equal(ambiguous.reason,"curse_target_required");
assert.deepEqual(campaign,starting,"ambiguous removal must not mutate Player, wallet or Shop");

const correct=await commitEnchanterAtomic({...params,request:{
  ...bare,transactionId:"specific_frostbound",
  curseTarget:{kind:"enchantment_curse",definitionId:"frostbound",applicationId:"curse_server_B"}
}});
assert.equal(correct.committed,true,correct.reason);
const after=campaign.jugadores.hero;
assert.deepEqual(E.appliedEnchantments(after.inventario_activo.server_curse_sword).map(ref=>ref.properties),
  [["curse"],[]]);
assert.equal(after.ahn,starting.jugadores.hero.ahn-2400);
assert.equal(after.enchanterTransactions.specific_frostbound.committed,true);
const noReplay=await commitEnchanterAtomic({...params,request:{
  ...bare,transactionId:"specific_frostbound",
  curseTarget:{kind:"enchantment_curse",definitionId:"frostbound",applicationId:"curse_server_B"}
}});
assert.equal(noReplay.reason,"duplicate_transaction");
const bad=clone(campaign);
const wrong=await commitEnchanterAtomic({...params,request:{
  ...bare,transactionId:"stale_frostbound",
  curseTarget:{kind:"enchantment_curse",definitionId:"frostbound",applicationId:"curse_server_B"}
}});
assert.equal(wrong.committed,false);
assert.equal(wrong.reason,"curse_target_not_found");
assert.deepEqual(campaign,bad,"stale quote never consumes AHN");
console.log("Server-side Curse targeted quote, payment and replay safety: OK");
})().catch(error=>{console.error(error);process.exitCode=1;});
