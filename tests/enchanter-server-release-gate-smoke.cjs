"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("functions/index.cjs","utf8");
let calls=0;
class HttpsError extends Error{
  constructor(code,message){super(message);this.code=code}
}
function initialize(enabled){
  const module={exports:{}};
  const Services={SERVICE_IDS:["enchant"]};
  const Engine={};
  const Shop={};
  const admin={apps:[],initializeApp(){this.apps.push({})},database(){return {ref(){}}}};
  const sandbox={
    module,exports:module.exports,
    process:{env:enabled?{LUMINOUS_ENCHANTER_SERVER_ENABLED:"true"}:{}},
    globalThis:{
      LuminousItemEnchanterServiceRuntime:Services,
      LuminousItemEnchantmentEngine:Engine,
      LuminousShopRuntime:Shop,
    },
    require(name){
      if(name==="firebase-functions/v2/https")
        return {onCall:(_options,handler)=>handler,HttpsError};
      if(name==="firebase-admin")return admin;
      if(name==="./enchanter-atomic.cjs")
        return {commitEnchanterAtomic:async ({authUid})=>{
          calls++;
          return {committed:true,transactionId:"release_gate_test",
            balance:99,player:{uid:authUid},receipt:{committed:true},providerMaterials:[]};
        }};
      if(name.startsWith("./vendor/js/"))return {};
      throw Error("Unknown callable dependency "+name);
    },
  };
  vm.runInNewContext(source,sandbox,{filename:"functions/index.cjs"});
  return module.exports.commitEnchanterService;
}
(async()=>{
  const disabled=initialize(false);
  await assert.rejects(
    disabled({auth:{uid:"test_owner"},data:{service:"enchant"}}),
    err=>err.code==="failed-precondition" && err.message==="enchanter_server_not_enabled",
  );
  assert.equal(calls,0,"deployment without explicit server release flag cannot commit anything");
  const enabled=initialize(true);
  await assert.rejects(enabled({data:{service:"enchant"}}),
    err=>err.code==="unauthenticated");
  assert.equal(calls,0,"enabled but unauthenticated calls cannot write");
  const result=await enabled({auth:{uid:"test_owner"},data:{service:"enchant"}});
  assert.equal(result.committed,true);
  assert.equal(result.player.uid,"test_owner");
  assert.equal(calls,1);
  console.log("Enchanter server launch guard: default-off, unauthorized denial, explicit opt-in OK");
})().catch(error=>{console.error(error);process.exitCode=1});
