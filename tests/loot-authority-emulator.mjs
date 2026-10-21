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
 assert.equal(await live.installAuthority({db:dm.db,uid:dm.uid}),true);
 const options={db:player.db,playerId:'hunter',lootInstanceId,actionId:'harvest',targetResourceId:'meat',checkResult:{heads:5}};
 const result=await live.requestAction(options);assert.equal(result.committed,true);assert.equal(result.delivery.delivered,true);
 const saved=(await dm.db.ref('campaña/jugadores/hunter').once('value')).val();assert.equal(Object.values(saved.inventario_activo).filter(i=>i.definitionId==='meat_wolf').reduce((n,i)=>n+i.quantity,0),1);
 const retry=await live.requestAction(options);assert.equal(retry.delivery.delivered,true);assert.equal(Object.keys((await dm.db.ref('campaña/jugadores/hunter/lootRecoveryReceipts').once('value')).val()).length,1);
 const search=await live.requestAction({...options,actionId:'search',targetResourceId:''});assert.equal(search.delivery.delivered,true);assert.equal((await dm.db.ref('campaña/jugadores/hunter/ahn').once('value')).val(),110);
 await assert.rejects(rival.db.ref('campaña/loot_postcombat/'+lootInstanceId+'/revision').set(99),/permission_denied/i);
 await assert.rejects(rival.db.ref('campaña/loot_requests/outsider/forbidden').set({uid:rival.uid,playerId:'outsider',lootInstanceId,actionId:'harvest',checkHeads:5,status:'pending',createdAt:Date.now()}),/permission_denied/i);
 console.log('Authenticated loot authority: archived corpse, inventory, currency, retry receipts and outsider denial passed.');
}catch(error){console.log('REQUEST_DIAGNOSTIC',JSON.stringify((await dm.db.ref('campaña/loot_requests').once('value')).val()));throw error;}
finally{clearTimeout(timeout);live.stopAuthority(dm.db);for(const c of [dm,player,rival])c.db.goOffline();await Promise.all([dm,player,rival].map(c=>c.app.delete()));}
