"use strict";
// Small reproducible campaign-root contention regression, NOT a production
// throughput benchmark. Requires isolated RTDB/Auth emulators only.
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const {commitEnchanterAtomic}=require("../functions/enchanter-atomic.cjs");
for(const path of [
  "../js/item-quality-engine.js","../js/item-catalog-ore-ingot-gem.js",
  "../js/item-catalog-enchantments.js","../js/item-enchantment-engine.js",
  "../js/item-runtime-engine.js","../js/item-inventory-runtime.js",
  "../js/item-magic-runtime.js","../js/item-magic-knowledge-runtime.js",
  "../js/item-enchantment-compendium-runtime.js","../js/item-enchanter-service-runtime.js",
  "../js/shop-runtime.js",
])require(path);
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const auth=process.env.FIREBASE_AUTH_EMULATOR_HOST;
const project="demo-enchanter-atomic";
if(!host||!auth||/[.]googleapis[.]com/.test(host+auth)){
  console.error("Enchanter contention regression requires only isolated Auth/RTDB emulators");
  process.exitCode=1;
}else{
  (async()=>{
    const app=admin.initializeApp({
      projectId:project,
      databaseURL:`http://${host}?ns=${project}-default-rtdb`,
    },"enchanter-contention");
    const db=app.database();
    const players={};
    const ITEM_COUNT=6;
    for(let i=0;i<ITEM_COUNT;i++){
      const id="race_"+i;
      players[id]={
        uid:"owner_"+i,ahn:2000000,finance:{currentBalance:2000000},
        inventario_activo:{[id]:{
          instanceId:id,definitionId:"sword",itemType:"weapon",category:"weapon",
          tier:5,condition:100,conditionMax:100,enchantmentBaseValueAhn:500000,
        }},
        inventario_stash:{},enchanterTransactions:{},
      };
    }
    // Additional campaign data increases the transaction's read/write size.
    // Its actual size/latency is logged instead of incorrectly certified as
    // representative of the user's live multi-year campaign.
    const extras=Object.fromEntries(Array.from({length:160},(_,i)=>[
      "fixture_"+i,{memo:"~".repeat(640),flags:{active:false,source:"load_fixture"}},
    ]));
    const initial={jugadores:players,otros_sistemas:extras,
      calendario:{timestamp:1710000000000},
      tiendas:{forge:{
        nombre:"Enchanter Forge",services:{enchant:true},
        enchanterProvider:{id:"npc",maxRank:3,reliability:1,
          services:["enchant"],knownEnchantments:["flamebound"],
          providerMaterials:[{instanceId:"dust",definitionId:"enchanted_dust",
            quantity:ITEM_COUNT,unitValueAhn:5000,useTags:["enchantment_material"]}],
        },
      }},
    };
    const start=Date.now();
    try{
      await db.ref("campaña").set(initial);
      const Service=globalThis.LuminousItemEnchanterServiceRuntime;
      const Engine=globalThis.LuminousItemEnchantmentEngine;
      const Shop=globalThis.LuminousShopRuntime;
      const timed=async i=>{
        const id="race_"+i;
        const t=Date.now();
        const result=await commitEnchanterAtomic({
          database:db,authUid:"owner_"+i,
          request:{playerId:id,shopId:"forge",transactionId:"load_"+i,
            itemInstanceId:id,service:"enchant",definitionId:"flamebound",rank:1},
          Services:Service,Engine,Shop,
        });
        return {...result,elapsedMs:Date.now()-t};
      };
      const results=await Promise.all(Array.from({length:ITEM_COUNT},(_,i)=>timed(i)));
      for(const x of results)assert.equal(x.committed,true,JSON.stringify({reason:x.reason,ms:x.elapsedMs}));
      const after=(await db.ref("campaña").get()).val();
      assert.equal(after.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,0);
      for(let i=0;i<ITEM_COUNT;i++){
        const id="race_"+i;
        assert.equal(after.jugadores[id].ahn,2000000-755000);
        assert.ok(after.jugadores[id].enchanterTransactions["load_"+i]?.committed);
        assert.equal(after.jugadores[id].inventario_activo[id].magic.enchantments[0].definitionId,"flamebound");
      }
      assert.deepEqual(after.otros_sistemas,extras,
        "campaign transaction may not corrupt unrelated systems during contention");
      const duration=Date.now()-start;
      const bytes=Buffer.byteLength(JSON.stringify(initial));
      const timings=results.map(r=>r.elapsedMs).sort((a,b)=>a-b);
      console.log(JSON.stringify({scenario:"enchanter_isolated_campaign_root_contention",
        concurrentCheckouts:ITEM_COUNT,additionalCampaignBytes:bytes,
        elapsedMs:duration,p50Ms:timings[Math.floor(timings.length/2)],
        maxMs:timings[timings.length-1],
        limitation:"isolated smoke only; no production latency SLA asserted"}));
    }finally{
      await db.ref("campaña").remove();
      await app.delete();
    }
  })().catch(error=>{console.error(error);process.exitCode=1});
}
