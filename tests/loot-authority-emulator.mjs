import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);

globalThis.window = globalThis;

await import("../js/item-runtime-engine.js");
await import("../js/item-inventory-runtime.js");
await import("../js/item-quality-engine.js");
await import("../js/item-size-lineage-engine.js");
await import("../js/item-culinary-affinity-data.js");
await import("../js/item-affinity-engine.js");
await import("../js/item-processing-engine.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/item-economy-standard.js");
await import("../js/creature-type-catalog.js");
await import("../js/loot-social-profile-contract.js");
await import("../js/loot-encounter-context.js");
await import("../js/corpse-harvest-runtime.js");
await import("../js/loot-ammo-reconciliation.js");
await import("../js/item-catalog-meat.js");
await import("../js/item-catalog-hide-pelt.js");
await import("../js/item-catalog-hard-parts.js");
await import("../js/item-catalog-organ-gland.js");
await import("../js/item-catalog-blood-ichor.js");
await import("../js/item-catalog-venom-secretion.js");
await import("../js/item-catalog-ooze-gel.js");
await import("../js/item-catalog-scale-shell-chitin.js");
await import("../js/item-catalog-feather-raw-fiber.js");
await import("../js/item-catalog-salvage-raw.js");
await import("../js/loot-instance-runtime.js");
await import("../js/loot-check-runtime.js");
await import("../js/loot-knowledge-runtime.js");
await import("../js/loot-postcombat-runtime.js");
await import("../js/loot-recovery-delivery-runtime.js");
await import("../js/loot-live-postcombat-runtime.js");
await import("../js/combat-participants.js");
await import("../js/combat-deployment-runtime.js");
await import("../js/combat-session-lifecycle.js");


delete globalThis.window;
// The legacy SDK ignores NO_PROXY for emulator WebSockets. This test only connects to loopback.
for(const key of ['HTTP_PROXY','http_proxy','HTTPS_PROXY','https_proxy'])delete process.env[key];
const timeout=setTimeout(()=>{console.error('Local loot authority test timed out');process.exit(1);},90000);
const firebase=require('firebase/app');require('firebase/auth');require('firebase/database');
globalThis.firebase=firebase;
const live=LuminousLootLivePostCombatRuntime,project='demo-combat-results',ns=project+'-default-rtdb';
async function client(name){const app=firebase.initializeApp({apiKey:'fake',projectId:project,databaseURL:'https://'+ns+'.firebaseio.com'},name);app.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});app.database().useEmulator('127.0.0.1',9100);await app.auth().createUserWithEmailAndPassword(name+Date.now()+'@example.test','temporary-password');return {app,uid:app.auth().currentUser.uid,db:app.database()};}
const dm=await client('authority'),player=await client('[DEFAULT]'),rival=await client('outsider');
const unit={id:'wolf',libraryUnitId:'wolf',name:'Wolf',species:'wolf',creatureType:'beast',hp:0,maxHp:12,faction:'enemy',defeated:true,
 bodyProfile:{version:1,kind:'organic',sizeClass:'medium',materials:['flesh','blood','bone','pelt'],edible:true,resources:[{id:'meat',integrityFamily:'meat',sourceMaterial:'flesh',itemId:'meat_wolf',catalogFamily:'meat',culinary:true,knownUses:['cooking'],yield:{min:1,max:1}}]},
 lootProfile:{version:1,carried:[],equipment:{source:'none'},currency:{currencyId:'ahn',min:100,max:100},harvest:{source:'body_profile'},impossibleCategories:[]}};
const actor={uid:player.uid,id:'hunter',scores:{wis:30,int:30},proficiencyBonus:6,proficiencies:{skills:{survival:'expertise',investigation:'expertise'}},ahn:10,finance:{currentBalance:10},inventario_activo:{},inventario_stash:{},inventoryRules:{activeSlotLimit:20,stashSlotLimit:80}};
const seed={config:{dm_uid:dm.uid},jugadores:{hunter:actor,outsider:{uid:rival.uid}},base_datos_unidades:{wolf:unit},combate:{estado:{encounterId:'authority-test',phase:'ENDED',result:'victory'},defeated:{wolf:unit}}};
const response=await fetch('http://127.0.0.1:9100/'+encodeURIComponent('campaña')+'.json?ns='+ns,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(seed)});assert.equal(response.ok,true);
try{
 const finalized=await live.finalizeEncounterLoot({db:dm.db,encounterId:'authority-test',participants:{hunter:true},result:'victory'});assert.equal(finalized.finalized.length,1);
 const lootInstanceId=finalized.finalized[0].lootInstanceId;
 assert.equal(await live.checkPlayerLootAccess({db:player.db,playerId:'hunter',lootInstanceId}),true,
   'a linked victory participant must pass before the coin roll');
 await assert.rejects(live.checkPlayerLootAccess({db:player.db,playerId:'outsider',lootInstanceId}),
   /no está vinculada/i,'another account must not loot a different player character');
 await dm.db.ref('campaña/jugadores/nonparticipant').set({uid:player.uid,name:'No entró al combate'});
 await assert.rejects(live.checkPlayerLootAccess({db:player.db,playerId:'nonparticipant',lootInstanceId}),
   /no aparece entre los participantes/i,'linked but absent characters must not loot');
 assert.match((await import('node:fs')).readFileSync('hoja_de_DM.html','utf8'),
   /js\/loot-live-postcombat-runtime\.js\?v=20261021-loot-authority-theatre-1/,
   'real DM Theatre dashboard must retain Loot authority after Combat iframe closes');
 assert.equal(await live.installAuthority({db:dm.db,uid:dm.uid}),true);
 const options={db:player.db,playerId:'hunter',lootInstanceId,actionId:'harvest',targetResourceId:'meat',checkResult:{heads:5}};
 const result=await live.requestAction(options);assert.equal(result.committed,true);assert.equal(result.delivery.delivered,true);
 const saved=(await dm.db.ref('campaña/jugadores/hunter').once('value')).val();assert.equal(Object.values(saved.inventario_activo).filter(i=>i.definitionId==='meat_wolf').reduce((n,i)=>n+i.quantity,0),1);
 const retry=await live.requestAction(options);assert.equal(retry.delivery.delivered,true);assert.equal(Object.keys((await dm.db.ref('campaña/jugadores/hunter/lootRecoveryReceipts').once('value')).val()).length,1);
 const search=await live.requestAction({...options,actionId:'search',targetResourceId:''});assert.equal(search.delivery.delivered,true);assert.equal((await dm.db.ref('campaña/jugadores/hunter/ahn').once('value')).val(),110);
 await assert.rejects(rival.db.ref('campaña/loot_postcombat/'+lootInstanceId+'/revision').set(99),/permission_denied/i);
 await assert.rejects(rival.db.ref('campaña/loot_requests/outsider/forbidden').set({uid:rival.uid,playerId:'outsider',lootInstanceId,actionId:'harvest',checkHeads:5,status:'pending',createdAt:Date.now()}),/permission_denied/i);
 console.log('Authenticated loot authority: archived corpse, inventory, currency, retry receipts and outsider denial passed.');
 const session=LuminousCombatSession;
 await session.start({db:dm.db,uid:dm.uid});
 const units=Array.from({length:10},(_,i)=>({...unit,id:'enemy'+i,combatId:'enemy'+i,hp:12,defeated:false,isPlayer:false}));
 units.push({id:'player:hunter',isPlayer:true,canonicalPlayerKey:'hunter',hp:1300,maxHp:1300,faction:'ally',uid:player.uid});
 await session.deploy({db:dm.db,units});
 let combat=(await dm.db.ref('campaña/combate').once('value')).val();
 assert.equal(Object.values(combat.combatants).filter(u=>u.faction==='enemy').length,8);assert.equal(Object.keys(combat.reserves).length,2);
 const reserveIds=Object.keys(combat.reserves).sort((a,b)=>combat.reserves[a].backupQueueOrder-combat.reserves[b].backupQueueOrder);
 globalThis.LuminousCombatLiveAdapter073={state:{role:'dm',db:dm.db,round:1,combatants:combat.combatants},hydrateNow(){}};
 globalThis.LuminousCombat073={combatants:()=>LuminousCombatLiveAdapter073.state.combatants};
 await import('../js/combat-v073-deployment-bridge.js');
 const bridge=LuminousCombatDeploymentBridge073;bridge.setReserveCache(combat.reserves);
 try{
  for(let i=0;i<2;i++){
   const killed=Object.values(LuminousCombatLiveAdapter073.state.combatants).find(u=>u.faction==='enemy'&&!reserveIds.includes(u.id));killed.hp=0;
   const transition=bridge.reconcileDefeatedRuntime({round:i+1});assert.equal(transition.transitions[0].replacement.key,reserveIds[i]);
   await bridge.state.writeChain;combat=(await dm.db.ref('campaña/combate').once('value')).val();assert.equal(Object.keys(combat.defeated).length,i+1);assert.equal(Object.values(combat.combatants).filter(u=>u.faction==='enemy').length,8);
  }
 }finally{bridge.stop();}
 const firstId=combat.estado.encounterId;
 await dm.db.ref('campaña/combate/estado/round').set(29);
 // A mid-fight Theatre interlude must resume the same encounter, including
 // when authority is sealed (the old start() incorrectly refused this).
 await dm.db.ref('campaña/combate/authority/current/phase').set('sealed');
 await dm.db.ref('campaña/estado_mundo/instancia_activa').set('combat_theatre');
 const beforeInterlude=(await dm.db.ref('campaña/combate').once('value')).val();
 await session.start({db:dm.db,uid:dm.uid});
 const afterInterlude=(await dm.db.ref('campaña/combate').once('value')).val();
 assert.equal((await dm.db.ref('campaña/estado_mundo/instancia_activa').once('value')).val(),'combate');
 assert.deepEqual(afterInterlude,beforeInterlude,'return to Combat must not reset a sealed turn or wave reserves');
 await dm.db.ref('campaña/combate/authority/current').remove();
 const closing=await session.claimEnd({db:dm.db,uid:dm.uid,result:'victory'});
 const waveLoot=await live.finalizeEncounterLoot({db:dm.db,encounterId:firstId,participants:closing.participants,result:'victory'});assert.equal(waveLoot.finalized.length,2);
 await session.commitEnd({db:dm.db,uid:dm.uid,result:'victory',token:closing.estado.ending.token});
 assert.equal((await dm.db.ref('campaña/combate/estado/round').once('value')).val(),1);
 const secondLootId=waveLoot.finalized[0].lootInstanceId;
 await dm.db.ref('campaña/jugadores/hunter/inventoryRules').set({activeSlotLimit:0,stashSlotLimit:0});
 const full=await live.requestAction({...options,lootInstanceId:secondLootId});assert.equal(full.delivery.delivered,false);
 const interaction=(await dm.db.ref('campaña/loot_postcombat/'+secondLootId).once('value')).val();
 const deliveryId=interaction.pendingDeliveries[0].id;
 const claimOptions={...options,lootInstanceId:secondLootId,actionId:'claim',deliveryId};
 const stillFull=await live.requestAction(claimOptions);assert.equal(stillFull.delivered,false);
 await dm.db.ref('campaña/jugadores/hunter/inventoryRules').set({activeSlotLimit:20,stashSlotLimit:80});
 const resumed=await live.requestAction(claimOptions);assert.equal(resumed.delivered,true);
 const receiptCount=Object.keys((await dm.db.ref('campaña/jugadores/hunter/lootRecoveryReceipts').once('value')).val()).length;
 await live.requestAction(claimOptions);assert.equal(Object.keys((await dm.db.ref('campaña/jugadores/hunter/lootRecoveryReceipts').once('value')).val()).length,receiptCount);
 await session.start({db:dm.db,uid:dm.uid});
 combat=(await dm.db.ref('campaña/combate').once('value')).val();assert.notEqual(combat.estado.encounterId,firstId);assert.equal(combat.estado.round,1);
 for(const key of ['combatants','reserves','defeated','departed','participants','authority','playback','readyPlayers','plannedActions'])assert.equal(combat[key]||null,null);
 assert.equal((await dm.db.ref('campaña/loot_encounters/'+firstId+'/meta/corpseCount').once('value')).val(),2);
 for(const result of ['defeat','cancelled']){
  const claimed=await session.claimEnd({db:dm.db,uid:dm.uid,result});
  await session.commitEnd({db:dm.db,uid:dm.uid,result,token:claimed.estado.ending.token});
  await session.start({db:dm.db,uid:dm.uid});assert.equal((await dm.db.ref('campaña/combate/estado/round').once('value')).val(),1);
 }
 console.log('Authenticated encounters: 8 field + 2 FIFO reserves, archived wave loot, capacity resume, round-one rollover, defeat and cancellation passed.');
}catch(error){console.log('REQUEST_DIAGNOSTIC',JSON.stringify((await dm.db.ref('campaña/loot_requests').once('value')).val()));throw error;}
finally{clearTimeout(timeout);live.stopAuthority(dm.db);for(const c of [dm,player,rival])c.db.goOffline();await Promise.all([dm,player,rival].map(c=>c.app.delete()));}

// Firebase 8 retains auth refresh handles after deleting its test apps.
process.exit(0);
