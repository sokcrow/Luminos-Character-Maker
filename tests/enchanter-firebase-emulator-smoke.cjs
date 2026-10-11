"use strict";
// Run ONLY against Firebase emulators; this test creates real RTDB transactions
// and authenticated REST writes but never contacts a production project.
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const {commitEnchanterAtomic}=require("../functions/enchanter-atomic.cjs");
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
require("../js/shop-runtime.js");
const Services=globalThis.LuminousItemEnchanterServiceRuntime;
const Engine=globalThis.LuminousItemEnchantmentEngine;
const Shop=globalThis.LuminousShopRuntime;
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
const project="demo-enchanter-atomic";
const namespace=project+"-default-rtdb";
if(!host||!authHost||host.includes("googleapis.com")){
  console.error("Refusing to run Enchanter emulator test without local Auth + RTDB emulators");
  process.exitCode=1;
}else{
  (async()=>{
    const app=admin.initializeApp({
      projectId:project,
      databaseURL:`http://${host}?ns=${namespace}`,
    },"enchanter-emulator-smoke");
    const db=app.database();
    try {
      const register=async label=>{
        const response=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            email:label+"@example.test",password:"not_a_production_secret",
            returnSecureToken:true,
          }),
        });
        const data=await response.json();
        assert.ok(response.ok,JSON.stringify(data));
        return {uid:data.localId,token:data.idToken};
      };
      const user=await register("owner"),stranger=await register("stranger");
      const item=id=>({
        instanceId:id,definitionId:"sword",itemType:"weapon",category:"weapon",
        tier:5,condition:100,conditionMax:100,enchantmentBaseValueAhn:500000,
      });
      const initial={
        config:{dm_uid:"not_the_test_player"},
        jugadores:{hero:{
          uid:user.uid,ahn:4000000,finance:{currentBalance:4000000},
          inventario_activo:{sword_a:item("sword_a"),sword_b:item("sword_b")},
          inventario_stash:{},enchanterTransactions:{},
        }},
        tiendas:{forge:{
          nombre:"Arcane Forge",
          enchanterProvider:{id:"npc",name:"Enchanter",maxRank:3,
            knownEnchantments:["flamebound"],services:["enchant","remove_rewrite"],
            reliability:1,servicePriceAhn:{remove_rewrite:12500},
            providerMaterials:[{
              instanceId:"catalyst",definitionId:"enchanted_dust",quantity:1,
              unitValueAhn:5000,useTags:["enchantment_material"],
            }],
          },
        }},
      };
      await db.ref("campaña").set(initial);
      const endpoint=`http://${host}/campa%C3%B1a/tiendas/forge/enchanterProvider/providerMaterials.json?ns=${namespace}&auth=${encodeURIComponent(user.token)}`;
      const denied=await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json"},body:"[]"});
      assert.equal(denied.status,401,"ordinary Players must not edit Shop stock");
      const unauthenticated=await fetch(`http://${host}/campa%C3%B1a.json?ns=${namespace}`);
      assert.equal(unauthenticated.status,401,"RTDB rules must reject unauthed campaign reads");
      const intent=(id,tx)=>({
        playerId:"hero",shopId:"forge",transactionId:tx,itemInstanceId:id,
        service:"enchant",definitionId:"flamebound",rank:1,
      });
      const call=(request,uid=user.uid)=>commitEnchanterAtomic({
        database:db,authUid:uid,request,Services,Engine,Shop,
      });
      const stolen=await call(intent("sword_a","stolen"),stranger.uid);
      assert.equal(stolen.committed,false);
      assert.equal(stolen.reason,"player_not_authorized");

      const [first,second]=await Promise.all([
        call(intent("sword_a","first")),call(intent("sword_b","second")),
      ]);
      const successes=[first,second].filter(x=>x.committed);
      assert.equal(successes.length,1,"one finite catalyst cannot fund two concurrent Enchantments");
      const state=(await db.ref("campaña").get()).val();
      assert.equal(state.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,0);
      assert.equal(Object.keys(state.jugadores.hero.enchanterTransactions).length,1);
      assert.equal(state.jugadores.hero.ahn,4000000-755000);
      const successId=first.committed?"sword_a":"sword_b";
      const successTx=first.committed?"first":"second";
      assert.equal(state.jugadores.hero.inventario_activo[successId].magic.enchantments[0].definitionId,
        "flamebound");
      const replay=await call(intent(successId,successTx));
      assert.equal(replay.reason,"duplicate_transaction");
      const beforeRemoval=(await db.ref("campaña").get()).val();
      const removal=await call({
        playerId:"hero",shopId:"forge",transactionId:"remove",
        itemInstanceId:successId,service:"remove_rewrite",
        procedure:"direct_remove",definitionId:"flamebound",
      });
      assert.equal(removal.committed,true,removal.reason);
      const afterRemoval=(await db.ref("campaña").get()).val();
      assert.equal(afterRemoval.jugadores.hero.inventario_activo[successId].magic.enchantments?.length||0,0);
      assert.equal(afterRemoval.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,0,
        "removal never consumes an additional application catalyst");
      assert.ok(afterRemoval.jugadores.hero.ahn<beforeRemoval.jugadores.hero.ahn);
      const duplicateRemoval=await call({
        playerId:"hero",shopId:"forge",transactionId:"remove",
        itemInstanceId:successId,service:"remove_rewrite",
        procedure:"direct_remove",definitionId:"flamebound",
      });
      assert.equal(duplicateRemoval.reason,"duplicate_transaction");
      console.log("Enchanter real Firebase Auth/RTDB emulator: ownership, security rules, concurrent stock, rollback and removal OK");
    }finally{
      await db.ref("campaña").remove();
      await app.delete();
    }
  })().catch(error=>{console.error(error);process.exitCode=1});
}
