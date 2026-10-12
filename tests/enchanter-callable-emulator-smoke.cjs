"use strict";
// Real v2 HTTPS callable endpoint smoke. Never points at a deployed Firebase
// project: emulators:exec must inject Auth + RTDB + Functions emulator hosts.
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const auth=process.env.FIREBASE_AUTH_EMULATOR_HOST;
const database=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const functions=process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST;
const project="demo-enchanter-atomic";
const namespace=project+"-default-rtdb";
if(!auth||!database||!functions||/[.]googleapis[.]com/.test(auth+database+functions)){
  console.error("Refusing to test a deployed endpoint: all three Firebase emulators are required");
  process.exitCode=1;
}else{
  (async()=>{
    const app=admin.initializeApp({
      projectId:project,
      databaseURL:`http://${database}?ns=${namespace}`,
    },"enchanter-callable-emulator");
    const db=app.database();
    const endpoint=`http://${functions}/${project}/us-central1/commitEnchanterService`;
    const register=async label=>{
      const response=await fetch(`http://${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:label+"@example.test",password:"test_password_only",returnSecureToken:true}),
      });
      const payload=await response.json();
      assert.equal(response.status,200,JSON.stringify(payload));
      return {uid:payload.localId,token:payload.idToken};
    };
    const call=async(data,token)=>{
      const result=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
        body:JSON.stringify({data}),
      });
      const body=await result.json();
      return {status:result.status,body};
    };
    try{
      const owner=await register("callable_owner");
      const stranger=await register("callable_stranger");
      const sword=id=>({
        instanceId:id,definitionId:"sword",itemType:"weapon",category:"weapon",
        tier:5,condition:100,conditionMax:100,enchantmentBaseValueAhn:500000,
      });
      await db.ref("campaña").set({
        config:{dm_uid:"not_a_test_uid"},
        jugadores:{hero:{uid:owner.uid,ahn:3000000,
          finance:{currentBalance:3000000},
          inventario_activo:{sword_1:sword("sword_1"),sword_2:sword("sword_2")},
          inventario_stash:{},enchanterTransactions:{}}},
        tiendas:{forge:{
          nombre:"Arcane Forge",services:{enchant:true,remove_rewrite:true},
          enchanterProvider:{id:"npc",name:"Enchanter",maxRank:3,
            knownEnchantments:["flamebound"],services:["enchant","remove_rewrite"],
            reliability:1,servicePriceAhn:{remove_rewrite:12500},
            providerMaterials:[{instanceId:"catalyst",definitionId:"enchanted_dust",
              quantity:1,unitValueAhn:5000,useTags:["enchantment_material"]}],
          },
        }},
      });
      const intent=(id,transactionId)=>({
        playerId:"hero",shopId:"forge",service:"enchant",
        definitionId:"flamebound",rank:1,itemInstanceId:id,transactionId,
      });
      const unauth=await call(intent("sword_1","not_signed_in"));
      assert.equal(unauth.status,401,"callable rejects absent Firebase identity");
      assert.equal(unauth.body.error?.status,"UNAUTHENTICATED");
      const theft=await call(intent("sword_1","stolen"),stranger.token);
      assert.equal(theft.status,400,"other owner must receive a precondition error");
      assert.equal(theft.body.error?.status,"FAILED_PRECONDITION",JSON.stringify(theft));
      assert.equal(theft.body.error?.message,"player_not_authorized",
        "authenticated callable must actually reach the correct player and Shop database");
      const walletBefore=(await db.ref("campaña/jugadores/hero").get()).val();
      assert.equal(walletBefore.ahn,3000000);
      // Two browser sessions, one authenticated identity, the same receipt ID.
      const [a,b]=await Promise.all([
        call(intent("sword_1","callable_01"),owner.token),
        call(intent("sword_1","callable_01"),owner.token),
      ]);
      const successes=[a,b].filter(x=>x.status===200&&x.body.result?.committed===true);
      assert.equal(successes.length,1,
        "one transaction ID must yield one charged callable receipt: "+JSON.stringify({a,b}));
      const replay=[a,b].find(x=>x.status!==200);
      assert.equal(replay?.body?.error?.status,"FAILED_PRECONDITION");
      const after=(await db.ref("campaña").get()).val();
      assert.equal(after.jugadores.hero.ahn,3000000-755000);
      assert.equal(after.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,0);
      assert.equal(after.jugadores.hero.inventario_activo.sword_1.magic.enchantments[0].definitionId,
        "flamebound");
      assert.ok(after.jugadores.hero.enchanterTransactions.callable_01?.committed);
      assert.equal(after.jugadores.hero.inventario_activo.sword_2.magic,undefined);
      // A rejected service must never debit the wallet, spend a reagent, or
      // mutate a second Item when finite Shop stock has run out.
      const rejected=await call(intent("sword_2","out_of_stock"),owner.token);
      assert.equal(rejected.body.error?.status,"FAILED_PRECONDITION");
      assert.deepEqual((await db.ref("campaña").get()).val(),after);
      const removal=await call({
        playerId:"hero",shopId:"forge",service:"remove_rewrite",
        procedure:"direct_remove",definitionId:"flamebound",
        itemInstanceId:"sword_1",transactionId:"callable_remove",
      },owner.token);
      assert.equal(removal.status,200,JSON.stringify(removal.body));
      assert.equal(removal.body.result?.committed,true);
      const removed=(await db.ref("campaña").get()).val();
      assert.equal(removed.jugadores.hero.inventario_activo.sword_1.magic?.enchantments?.length||0,0,
        "removal may prune the empty Enchantments array instead of persisting []");
      assert.equal(removed.tiendas.forge.enchanterProvider.providerMaterials[0].quantity,0);
      assert.ok(removed.jugadores.hero.ahn<after.jugadores.hero.ahn);
      console.log("Enchanter real Functions v2 callable: Auth, ownership, replay, finite stock, rollback, removal OK");
    }finally{
      await db.ref("campaña").remove();
      await app.delete();
    }
  })().catch(error=>{console.error(error);process.exitCode=1});
}
