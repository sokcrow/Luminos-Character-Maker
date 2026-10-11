"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {commitEnchanterAtomic}=require("./enchanter-atomic.cjs");
if(!admin.apps.length)admin.initializeApp();
for(const path of [
  "../js/item-quality-engine.js",
  "../js/item-catalog-ore-ingot-gem.js",
  "../js/item-catalog-enchantments.js",
  "../js/item-enchantment-engine.js",
  "../js/item-runtime-engine.js",
  "../js/item-inventory-runtime.js",
  "../js/item-magic-runtime.js",
  "../js/item-magic-knowledge-runtime.js",
  "../js/item-enchantment-compendium-runtime.js",
  "../js/item-enchanter-service-runtime.js",
  "../js/shop-runtime.js",
])require(path);
const Services=globalThis.LuminousItemEnchanterServiceRuntime;
const Engine=globalThis.LuminousItemEnchantmentEngine;
const Shop=globalThis.LuminousShopRuntime;

exports.commitEnchanterService=onCall({
  region:"us-central1",
  memory:"1GiB",
  timeoutSeconds:120,
  maxInstances:5,
},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","Inicia sesión para usar este servicio.");
  const result=await commitEnchanterAtomic({
    database:admin.database(),authUid:request.auth.uid,request:request.data,
    Services,Engine,Shop,
  });
  if(!result.committed){
    // No privileged campaign/Shop snapshot is ever attached to client errors.
    throw new HttpsError("failed-precondition",
      String(result.reason||"service_rejected"));
  }
  return {committed:true,transactionId:result.transactionId,
    balance:result.balance,player:result.player,receipt:result.receipt};
});
