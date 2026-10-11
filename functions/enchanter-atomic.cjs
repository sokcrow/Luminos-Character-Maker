"use strict";
// Privileged RTDB service contract. The browser cannot call this module or
// provide a trusted quote/Item result; only the Firebase callable can invoke it.
const crypto=require("node:crypto");
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const key=x=>{
  const text=String(x||"");
  return text && text.length<=160 && !/[.#$\[\]/]/.test(text) ? text : null;
};
const number=x=>Number.isFinite(Number(x))?Number(x):0;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
function itemLocation(player,id){
  for(const bucket of ["inventario_activo","inventario_stash"]){
    for(const [name,item] of Object.entries(player[bucket]||{})){
      if(item && String(item.instanceId||item.id||"")===id)return {bucket,name,item};
    }
  }
  return null;
}
function providerForShop(shop,shopId,service,Services,Shop){
  if(!Shop.serviceEnabled?.(shop,service))return null;
  const authored=shop.enchanterProvider || shop.enchanterProfile || shop.enchanter || {};
  const services=Services.SERVICE_IDS.filter(id=>Shop.serviceEnabled(shop,id)===true);
  if(!services.includes(service))return null;
  const provider=Services.normalizeProviderProfile({
    ...authored,
    id:authored.id||authored.providerId||`shop:${shopId}`,
    name:authored.name||authored.nombre||shop.nombre||"Enchanter",
    hostType:"shop",shopId,services,workshop:authored.workshop||shop.workshop||null,
  });
  const materialField=Array.isArray(authored.providerMaterials)?"providerMaterials":
    Array.isArray(authored.materials)?"materials":null;
  return {provider,materialField,materials:clone(materialField?authored[materialField]:[])};
}
function quoteForIntent(Services,Engine,provider,item,intent,materials){
  const playerMaterials=materials.player;
  const providerMaterials=materials.provider;
  const common={playerMaterials,providerMaterials};
  const service=String(intent.service||"").trim().toLowerCase();
  if(["enchant","bind","curse","mount_gem"].includes(service)){
    const gem=service==="mount_gem" ? playerMaterials.find(entry=>
      String(entry.instanceId||"")===String(intent.gemInstanceId||"")) : null;
    if(service==="mount_gem"&&!gem)return {quoted:false,reason:"gem_not_in_player_inventory"};
    return Services.quoteEnchantService(provider,item,intent.definitionId,intent.rank, {
      ...common,serviceId:service,gem,
    });
  }
  if(service==="strengthen")
    return Services.quoteStrengthenService(provider,item,intent.definitionId,intent.targetRank,common);
  if(service==="magical_repair")
    return Services.quoteMagicalRepair(provider,item,common);
  if(["identify","curse_analysis","remove_curse"].includes(service))
    return Services.quoteFixedService(provider,service,common);
  if(service==="extract_gem")
    return Services.quoteGemProcedure(provider,item,intent.anchorId,
      intent.procedure||"safe_extract",{...common,gemQualityAfter:intent.gemQualityAfter});
  if(service==="remove_rewrite"){
    const procedure=intent.procedure||"direct_remove";
    if(procedure==="direct_rewrite")
      return Services.quoteDirectRewriteService(provider,item,intent.definitionId,intent.nextDefinitionId,
        {...common,rank:intent.rank});
    if(["item_side_remove","rewrite","safe_extract"].includes(procedure))
      return Services.quoteGemProcedure(provider,item,intent.anchorId,procedure,
        {...common,nextDefinitionId:intent.nextDefinitionId,
          rank:intent.rank,gemQualityAfter:intent.gemQualityAfter});
    if(procedure!=="direct_remove")return {quoted:false,reason:"unsupported_rewrite_procedure"};
    const gate=Engine.canRemoveEnchantment(item,intent.definitionId);
    if(!gate.allowed)return {quoted:false,reason:gate.reason};
    const quote=Services.quoteFixedService(provider,"remove_rewrite",common);
    return quote.quoted ? {...quote,definitionId:intent.definitionId,procedure} : quote;
  }
  return {quoted:false,reason:"unsupported_enchanter_service"};
}
/**
 * One backend-only transaction across campaign/jugadores and campaign/tiendas.
 * This is intentionally NOT a browser ref('campaña') write: RTDB rules do not
 * allow players to atomically update those siblings. Do not split into .update
 * writes because that would reopen double-charge and stock races.
 */
async function commitEnchanterAtomic({database,authUid,request,Services,Engine,Shop}={}){
  const playerId=key(request?.playerId),shopId=key(request?.shopId);
  const transactionId=key(request?.transactionId);
  const itemId=key(request?.itemInstanceId),auth=String(authUid||"");
  const pickup=String(request?.operation||"")==="pickup";
  if(!database?.ref||!playerId||!shopId||!transactionId||!itemId||!auth)
    return {committed:false,reason:"invalid_authenticated_service_request"};
  if(!Services?.commitServiceTransaction||!Engine?.canRemoveEnchantment||!Shop?.serviceEnabled)
    return {committed:false,reason:"server_service_contract_unavailable"};
  if(!pickup&&!Services.SERVICE_IDS.includes(String(request?.service||"")))
    return {committed:false,reason:"unknown_service"};
  const now=Date.now();
  const roll=crypto.randomInt(0,1000000000)/1000000000;
  const logId="enchanter_"+crypto.randomUUID().replace(/-/g,"");
  let outcome=null,reason="transaction_conflict";
  let response;
  try{
    response=await database.ref("campaña").transaction(current=>{
      if(!current || typeof current!=="object"){reason="campaign_unavailable";return;}
      const player=current.jugadores?.[playerId],shop=current.tiendas?.[shopId];
      if(!player||!shop){reason="player_or_shop_not_found";return;}
      if(String(player.uid||"")!==auth){reason="player_not_authorized";return;}
      if(player.enchanterTransactions?.[transactionId]){
        reason="duplicate_transaction";return;
      }
      const next=clone(current);
      const owner=next.jugadores[playerId];
      const currentShop=next.tiendas[shopId];
      const job=pickup?owner.enchanterJobs?.[String(request.jobId||"")]:null;
      const service=pickup?job?.service:String(request.service||"");
      const pack=providerForShop(currentShop,shopId,service,Services,Shop);
      if(!pack){reason="provider_service_unavailable";return;}
      if(Shop.isPlayerAllowed && Shop.isPlayerAllowed(currentShop,
        String(owner.shopAccessKey||owner.nombre||owner.name||playerId))===false){
        reason="shop_access_denied";return;
      }
      const target=itemLocation(owner,itemId);
      if(!pickup&&!target){reason="item_not_in_inventory";return;}
      if(pickup && (!job||String(job.itemInstanceId)!==itemId||
          String(job.providerId||"")!==String(pack.provider.id))){
        reason="invalid_service_pickup";return;
      }
      const playerMaterials=[
        ...Object.values(owner.inventario_activo||{}),
        ...Object.values(owner.inventario_stash||{}),
      ].filter(entry=>entry&&String(entry.instanceId||"")!==itemId);
      const clock=next.calendario?.timestamp;
      const options={
        transactionId,provider:pack.provider,providerId:pack.provider.id,
        appliedBy:pack.provider.id,playerMaterials,
        providerMaterials:pack.materials,npcRoll:roll,
        startedAt:now,worldTimestamp:clock,
        // Never accept free services, arbitrary price adjustments, outcome rolls
        // or pre-mutated Item data from an untrusted client.
      };
      let result;
      if(pickup){
        result=Services.completeDeferredServiceTransaction(owner,request.jobId,{worldTimestamp:clock});
      }else{
        const quote=quoteForIntent(Services,Engine,pack.provider,target.item,request,{
          player:playerMaterials,provider:pack.materials,
        });
        if(!quote?.quoted){reason=quote?.reason||"service_quote_rejected";return;}
        if(quote.destroysItem===true && request.confirmDestruction!==true){
          reason="destructive_service_confirmation_required";return;
        }
        const params={...options,confirmDestruction:quote.destroysItem===true
          && request.confirmDestruction===true};
        if(quote.duration?.resolved===true && number(quote.duration.hours)>0){
          result=Services.startDeferredServiceTransaction(owner,target.item,quote,{
            ...params,serverAtomicShopCommit:true,
          });
        }else{
          result=Services.commitServiceTransaction(owner,target.item,quote,params);
        }
      }
      if(!result?.committed){reason=result?.reason||"service_not_committed";return;}
      if(result.player)next.jugadores[playerId]=clone(result.player);
      const charged=Number(result.chargedAhn)||0;
      const after=next.jugadores[playerId];
      if(pack.materialField){
        const modified=result.providerMaterialsAfter||pack.materials;
        if(!Array.isArray(modified)){reason="provider_stock_result_invalid";return;}
        const authored=after===undefined?null:
          currentShop.enchanterProvider||currentShop.enchanterProfile||currentShop.enchanter;
        if(!authored){reason="provider_profile_missing";return;}
        authored[pack.materialField]=clone(modified);
      }
      if(charged>0){
        const log={
          monto:-charged,concepto:"Servicio de Enchanter: "+service,
          timestamp:now,unread:true,shopId,
          enchanterTransactionId:transactionId,
        };
        after.finance=after.finance||{};
        after.finance.transactionHistory={
          ...(after.finance.transactionHistory||{}),[logId]:clone(log),
        };
        after.transacciones={...(after.transacciones||{}),[logId]:clone(log)};
      }
      // No network I/O, Date.now, RNG or side effects inside a retry callback.
      outcome={receipt:clone(result),balance:after.finance?.currentBalance ?? after.ahn,
        player:clone(after),providerMaterials:clone(pack.materials)};
      return next;
    },undefined,false);
  }catch(error){
    return {committed:false,reason:"server_atomic_transaction_failed",error:String(error?.message||error)};
  }
  if(!response?.committed||!outcome)
    return {committed:false,reason};
  const saved=response.snapshot?.val?.();
  if(!saved?.jugadores?.[playerId]?.enchanterTransactions?.[transactionId]){
    return {committed:false,reason:"server_receipt_not_confirmed"};
  }
  return {committed:true,transactionId,
    receipt:outcome.receipt,balance:outcome.balance,
    // Only expose the authenticated player's data; not campaign/shop internals.
    player:clone(saved.jugadores[playerId])};
}
module.exports={commitEnchanterAtomic,quoteForIntent,providerForShop,itemLocation};
