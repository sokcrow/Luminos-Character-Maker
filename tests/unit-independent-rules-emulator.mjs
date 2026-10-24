/* Run under the existing Auth/RTDB emulators; no production connection. */
import assert from 'node:assert/strict';
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST||'127.0.0.1:9199';
const dbHost=process.env.FIREBASE_DATABASE_EMULATOR_HOST||'127.0.0.1:9100';
assert.match(authHost,/^(127\.0\.0\.1|localhost):\d+$/);assert.match(dbHost,/^(127\.0\.0\.1|localhost):\d+$/);
const namespace='demo-combat-results-default-rtdb';
async function account(name){
  const response=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`independent-${name}-${Date.now()}@example.test`,password:'temporary-password',returnSecureToken:true})});
  assert.equal(response.ok,true,'Emulator account creation');return response.json();
}
const [host,player,globalDm,outsider]=await Promise.all(['host','player','global-dm','outsider'].map(account));
async function write(path,value,token){
  return fetch(`http://${dbHost}/${path.split('/').map(encodeURIComponent).join('/')}.json?ns=${namespace}`,{
    method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(value)
  });
}
const encounter={hostUid:host.localId,members:{[host.localId]:true,[player.localId]:true},state:{campaña:{config:{dm_uid:host.localId},jugadores:{hero:{uid:player.localId}},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,encounterId:'isolated'},combatants:{'player:hero':{canonicalPlayerKey:'hero',canonicalOwnerUid:player.localId,isPlayer:true}}}}}};
const campaign={config:{dm_uid:globalDm.localId},jugadores:{hero:{uid:outsider.localId}},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,encounterId:'global'}},encuentros:{room:encounter}};
assert.equal((await write('campaña',campaign,'owner')).ok,true);
const base='campaña/encuentros/room/state/campaña/combate',intent={schemaVersion:1,encounterId:'isolated',playerId:'hero',schedulerUid:player.localId,unitId:'player:hero',sourceId:'rage',sourceType:'trait',cost:'quick_action',round:1,targetId:'player:hero',createdAt:1};
async function allowed(path,value,user,message){const response=await write(path,value,user.idToken);assert.equal(response.ok,true,`${message}: ${response.status} ${await response.text()}`);}
async function denied(path,value,user,message){const response=await write(path,value,user.idToken);assert.equal(response.ok,false,message);assert.match(await response.text(),/permission.denied/i,message);}
await allowed(`${base}/independentIntents/hero/valid`,intent,player,'Isolated member may submit even with contradictory global data');
await denied(`${base}/independentIntents/hero/valid`,{...intent,createdAt:2},player,'Owner cannot replace an immutable intent');
await denied(`${base}/independentIntents/hero/wrong-encounter`,{...intent,encounterId:'global'},player,'Global encounter identity cannot satisfy isolated validation');
await denied(`${base}/independentIntents/hero/global-dm`,{...intent,schedulerUid:globalDm.localId},globalDm,'Global DM cannot inject isolated intents');
await denied(`${base}/independentReceipts/hero/valid`,{applied:true},globalDm,'Global DM cannot forge isolated receipts');
await denied(`${base}/independentReceipts/hero/valid`,{applied:true},player,'Player cannot forge receipts');
await allowed(`${base}/independentReceipts/hero/valid`,{applied:true},host,'Host member can confirm a receipt');
const outsiderRoot='campaña/encuentros/room/state/campaña';
await write(`${outsiderRoot}/jugadores/outsider`,{uid:outsider.localId},'owner');
await write(`${base}/combatants/player:outsider`,{canonicalPlayerKey:'outsider',canonicalOwnerUid:outsider.localId,isPlayer:true},'owner');
await denied(`${base}/independentIntents/outsider/linked`,{...intent,playerId:'outsider',schedulerUid:outsider.localId,unitId:'player:outsider',targetId:'player:outsider'},outsider,'Linked ownership without encounter membership is insufficient');
console.log('Auth/RTDB emulators: isolated member submission, immutable intent, host receipt, global-DM/player forgery denial and nonmember ownership denial passed.');
