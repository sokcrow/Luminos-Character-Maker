(function(global) {
  "use strict";
  if(global.LuminousEnchanterFirebaseTransaction) return;

  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const wallet=user=>{
    const raw=user?.finance?.currentBalance ?? user?.ahn;
    return Number.isFinite(Number(raw)) ? Math.max(0,Math.trunc(Number(raw))) : null;
  };
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const txIdentifier=value=>{
    const id=String(value || "").trim();
    return id && id.length<=160 && !/[.#$\[\]/]/.test(id) ? id : null;
  };
  const itemExists=(state,id)=>Object.values(state?.inventario_activo || {}).concat(Object.values(state?.inventario_stash || {}))
    .some(item=>String(item?.instanceId || item?.id || "")===id);

  /**
   * Performs one atomic Firebase RTDB transaction at the Player subtree.
   * Transaction callback is pure/retry-safe. Payment, material snapshots,
   * Item outcome, provenance, and receipts share one backend commit point.
   * Stock belonging to a different shop subtree must not be spent here.
   */
  async function commitPlayerEnchanterService({db,playerId,before,after,result,shopId,
    providerMaterialsBefore=[],providerMaterialsAfter=[],persistence}={}) {
    if(!db?.ref || !playerId || !persistence?.serializeInventoryState)
      return {committed:false,reason:"atomic_persistence_unavailable"};
    const transactionId=txIdentifier(result?.transactionId);
    const itemInstanceId=String(result?.itemInstanceId || "");
    if(!transactionId || !itemInstanceId || result?.committed!==true)
      return {committed:false,reason:"invalid_service_receipt"};
    if(!same(providerMaterialsBefore,providerMaterialsAfter))
      return {committed:false,reason:"provider_stock_requires_server_atomic_commit"};

    const initial=persistence.serializeInventoryState(before || {});
    const next=persistence.serializeInventoryState(after || {});
    const startingWallet=wallet(before);
    const afterWallet=wallet(after);
    const charge=Math.max(0,Math.trunc(Number(result?.chargedAhn)||0));
    if(startingWallet===null || afterWallet!==startingWallet-charge)
      return {committed:false,reason:"invalid_wallet_delta"};
    const receipt=next.enchanterTransactions?.[transactionId];
    if(!receipt || receipt.committed!==true || !itemExists(next,itemInstanceId) || !itemExists(initial,itemInstanceId))
      return {committed:false,reason:"receipt_or_target_item_mismatch"};

    const base=`campaña/jugadores/${playerId}`;
    let newTransactionKey=null;
    let legacyTransactionKey=null;
    try {
      if(charge>0){
        newTransactionKey=db.ref(`${base}/finance/transactionHistory`).push?.().key;
        legacyTransactionKey=db.ref(`${base}/transacciones`).push?.().key;
      }
    }catch(error) {
      return {committed:false,reason:"atomic_database_error",error:String(error?.message||error)};
    }
    if(charge>0 && (!newTransactionKey || !legacyTransactionKey))
      return {committed:false,reason:"transaction_history_id_unavailable"};

    const tracked=["inventario_activo","inventario_stash","equipmentRefs",
      "attunedItemInstanceIds","itemMagicKnowledge","enchantmentCompendium","enchanterJobs"];
    const currentValue=player=>persistence.serializeInventoryState(player || {});
    const log={
      monto:-charge,
      concepto:`Servicio de Enchanter: ${String(result.service || "Arcano")}`,
      timestamp:Number(result.timestamp)||Date.now(),
      unread:true,
      shopId:shopId||null,
      enchanterTransactionId:transactionId,
    };
    let rejectReason="concurrent_player_change";
    let response;
    try{
      response=await db.ref(base).transaction(current=>{
        if(!current || typeof current!=="object"){
          rejectReason="player_not_found";return;
        }
        if(current.enchanterTransactions?.[transactionId]){
          rejectReason="duplicate_transaction";return;
        }
        if(wallet(current)!==startingWallet){
          rejectReason="wallet_changed";return;
        }
        const live=currentValue(current);
        // Compare the entire player-owned inventory and magic knowledge, not
        // just a stale item pointer. A concurrent consumption/transfer is a
        // conflict, never a reason to overwrite the other client's state.
        if(tracked.some(k=>!same(live[k],initial[k]))){
          rejectReason="inventory_or_knowledge_changed";return;
        }
        const player=clone(current);
        player.inventario_activo=clone(next.inventario_activo);
        player.inventario_stash=clone(next.inventario_stash);
        player.itemInventorySchemaVersion=persistence.schemaVersion || next.schemaVersion || 1;
        player.itemEquipmentRefs=clone(next.equipmentRefs);
        player.attunedItemInstanceIds=clone(next.attunedItemInstanceIds);
        player.itemMagicKnowledge=clone(next.itemMagicKnowledge);
        player.enchantmentCompendium=clone(next.enchantmentCompendium);
        player.enchanterTransactions={
          ...(player.enchanterTransactions || {}),
          [transactionId]:clone(receipt),
        };
        player.enchanterJobs=clone(next.enchanterJobs || {});
        player.ahn=afterWallet;
        player.finance={...(player.finance||{}),currentBalance:afterWallet};
        if(charge>0){
          player.finance.transactionHistory={
            ...(player.finance.transactionHistory || {}),[newTransactionKey]:clone(log),
          };
          player.transacciones={...(player.transacciones || {}),[legacyTransactionKey]:clone(log)};
        }
        return player;
      },undefined,false);
    }catch(error){
      return {committed:false,reason:"atomic_database_error",error:String(error?.message||error)};
    }
    if(!response?.committed)
      return {committed:false,reason:rejectReason};
    const saved=response.snapshot?.val?.();
    if(!saved?.enchanterTransactions?.[transactionId])
      return {committed:false,reason:"atomic_receipt_not_confirmed"};
    return {committed:true,transactionId,balance:afterWallet,snapshot:saved};
  }

  const api=Object.freeze({version:1,commitPlayerEnchanterService});
  global.LuminousEnchanterFirebaseTransaction=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
