"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {commitEnchanterAtomic}=require("./enchanter-atomic.cjs");
if(!admin.apps.length){
  // Functions Emulator may omit databaseURL from FIREBASE_CONFIG. Resolve
  // its isolated namespace explicitly; never construct a guessed production
  // database URL. The normal deployed path keeps Admin SDK discovery intact.
  const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  if(host){
    let config={};
    try{config=JSON.parse(process.env.FIREBASE_CONFIG||"{}")}catch(_){}
    const projectId=process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT||config.projectId;
    if(!projectId)throw new Error("enchanter_emulator_project_id_unavailable");
    admin.initializeApp({
      projectId,
      databaseURL:`http://${host}?ns=${projectId}-default-rtdb`,
    });
  }else admin.initializeApp();
}
for(const path of [
  "./vendor/js/item-quality-engine.js",
  "./vendor/js/item-catalog-ore-ingot-gem.js",
  "./vendor/js/item-catalog-enchantments.js",
  "./vendor/js/item-enchantment-engine.js",
  "./vendor/js/item-runtime-engine.js",
  "./vendor/js/item-inventory-runtime.js",
  "./vendor/js/item-magic-runtime.js",
  "./vendor/js/item-magic-knowledge-runtime.js",
  "./vendor/js/item-enchantment-compendium-runtime.js",
  "./vendor/js/item-enchanter-service-runtime.js",
  "./vendor/js/shop-runtime.js",
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
  // Two-sided release gate: a deployed Function must stay inert until the
  // economy write rules and load testing have been approved. Client-only
  // flags cannot authorize monetary actions on the privileged server.
  if(process.env.LUMINOUS_ENCHANTER_SERVER_ENABLED!=="true")
    throw new HttpsError("failed-precondition","enchanter_server_not_enabled");
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
    balance:result.balance,player:result.player,receipt:result.receipt,
    providerMaterials:result.providerMaterials};
});
