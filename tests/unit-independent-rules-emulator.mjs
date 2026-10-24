/* Run under the existing Auth/RTDB emulators; no production connection. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST||'127.0.0.1:9199';
const dbHost=process.env.FIREBASE_DATABASE_EMULATOR_HOST||'127.0.0.1:9100';
assert.match(authHost,/^(127\.0\.0\.1|localhost):\d+$/);assert.match(dbHost,/^(127\.0\.0\.1|localhost):\d+$/);
const namespace='demo-combat-results-default-rtdb';
async function account(name){
  const email=`independent-${name}-${Date.now()}@example.test`;
  const response=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'temporary-password',returnSecureToken:true})});
  assert.equal(response.ok,true,'Emulator account creation');return {...await response.json(),email};
}
const [host,player,globalDm,outsider]=await Promise.all(['host','player','global-dm','outsider'].map(account));
async function write(path,value,token){
  return fetch(`http://${dbHost}/${path.split('/').map(encodeURIComponent).join('/')}.json?ns=${namespace}${token==='owner'?'':`&auth=${encodeURIComponent(token)}`}`,{
    method:'PUT',headers:{'Content-Type':'application/json',...(token==='owner'?{Authorization:'Bearer owner'}:{})},body:JSON.stringify(value)
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
await denied(`${base}/independentReceipts/hero/no-auth`,{applied:true},{idToken:''},'REST harness cannot write without authentication');
await allowed(`${base}/independentReceipts/hero/valid`,{applied:true},host,'Host member can confirm a receipt');
const outsiderRoot='campaña/encuentros/room/state/campaña';
await write(`${outsiderRoot}/jugadores/outsider`,{uid:outsider.localId},'owner');
await write(`${base}/combatants/player:outsider`,{canonicalPlayerKey:'outsider',canonicalOwnerUid:outsider.localId,isPlayer:true},'owner');
await denied(`${base}/independentIntents/outsider/linked`,{...intent,playerId:'outsider',schedulerUid:outsider.localId,unitId:'player:outsider',targetId:'player:outsider'},outsider,'Linked ownership without encounter membership is insufficient');
console.log('Auth/RTDB emulators: isolated member submission, immutable intent, host receipt, global-DM/player forgery denial and nonmember ownership denial passed.');


// Exercise the actual production root transaction and encounter namespace
// adapter with authenticated SDK clients. Direct receipt writes alone do not
// revalidate the player-owned intent retained elsewhere in the root snapshot.
for(const key of ['HTTP_PROXY','http_proxy','HTTPS_PROXY','https_proxy'])delete process.env[key];
const require=createRequire(import.meta.url),firebase=require('firebase/app');require('firebase/auth');require('firebase/database');
const apps=[],timeout=setTimeout(()=>{console.error('Independent root transaction emulator timed out');process.exit(1);},90000);
const project='demo-combat-results';
async function sdkClient(user,name){
  const app=firebase.initializeApp({apiKey:'fake',projectId:project,databaseURL:`http://${dbHost}/?ns=${namespace}`},`independent-root-${name}`);apps.push(app);
  app.auth().useEmulator(`http://${authHost}`,{disableWarnings:true});
  const [address,port]=dbHost.split(':');app.database().useEmulator(address,Number(port));
  await app.auth().signInWithEmailAndPassword(user.email,'temporary-password');
  return app.database();
}
function productionBrowser(db,search=''){
  const database=()=>db;database.ServerValue=firebase.database.ServerValue;
  const browser={location:{search},firebase:{database},Math:Object.create(Math),console,addEventListener(){},setTimeout(){return 1},clearTimeout(){}};
  const context=vm.createContext({window:browser,URLSearchParams});
  for(const file of ['combat-context','combat-participants','combat-session-lifecycle'])vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),context,{filename:file});
  return {db:browser.firebase.database(),session:browser.LuminousCombatSession,browser,context};
}
async function independentClient(scope){
  const {browser,context,db}=scope;
  const raw=(await db.ref('campaña/combate').once('value')).val(),players=(await db.ref('campaña/jugadores').once('value')).val(),units=JSON.parse(JSON.stringify(raw.combatants));
  browser.LuminousCombatLiveAdapter073={state:{role:'dm',isAuthority:true,round:2,encounterId:raw.estado.encounterId,db,players,combatants:units}};
  browser.LuminousCombat073={combatants:()=>units,kit:()=>({actions:[]}),render(){}};
  for(const file of ['status-library','status-engine','trait-engine','trait-catalog-core','archetype-engine','archetype-trait-catalog','universal-action-economy','item-runtime-engine','combat-event-runtime','unit-independent-actions','combat-v073-authority','combat-v073-remote-intents'])vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),context,{filename:file});
  browser.LuminousClassRuntimeBootstrap={async boot(){return {ok:true}}};
  return browser.LuminousCombatRemoteIntents073;
}
try{
  const hostDb=await sdkClient(host,'host'),globalDb=await sdkClient(globalDm,'global');
  const isolated=productionBrowser(hostDb,'?encounter=room'),campaignSession=productionBrowser(globalDb);
  const globalPlayer='global-hero',globalUnit=`player:${globalPlayer}`;
  await write(`campaña/jugadores/${globalPlayer}`,{uid:player.localId},'owner');
  await write(`campaña/combate/combatants/${globalUnit}`,{id:globalUnit,battleActive:true,isPlayer:true,canonicalPlayerKey:globalPlayer,canonicalOwnerUid:player.localId,quickActionRemaining:1},'owner');
  const globalIntent={...intent,encounterId:'global',playerId:globalPlayer,unitId:globalUnit,targetId:globalUnit};
  await allowed(`campaña/combate/independentIntents/${globalPlayer}/root`,globalIntent,player,'Campaign player publishes a separate root-transaction intent');
  await allowed(`${base}/independentIntents/hero/root`,intent,player,'Isolated player publishes a separate root-transaction intent');
  // Mark deployed participants explicitly so the real canSeal gate sees them.
  await write(`${base}/combatants/player:hero/battleActive`,true,'owner');
  for(const [label,{db,session},owner,unitId,expected]of [
    ['isolated',isolated,'hero','player:hero',intent],
    ['campaign',campaignSession,globalPlayer,globalUnit,globalIntent]
  ]){
    const ref=db.ref('campaña/combate');
    await db.ref(`campaña/combate/readyPlayers/${owner}`).set({ready:true,round:1,unitId,schedulerUid:player.localId,plannedSlots:0});
    const before=(await ref.once('value')).val(),seal={round:1,plans:{[owner]:{}}};
    assert.equal(session.canSeal(before,seal),false,`${label}: outstanding intent blocks sealing`);
    const confirm=raw=>{
      if(!raw?.independentIntents?.[owner]?.root||raw.independentReceipts?.[owner]?.root)return;
      const next=JSON.parse(JSON.stringify(raw)),unit=next.combatants[unitId];
      unit.statusEffects ||= {};unit.statusEffects.rage={count:(unit.statusEffects.rage?.count||0)+1};unit.quickActionRemaining=0;
      next.independentReceipts ||= {};next.independentReceipts[owner] ||= {};
      next.independentReceipts[owner].root={applied:true,result:{used:true,sourceId:'rage',cost:'quick_action'}};
      return next;
    };
    const confirmation=await session.updateRoot(db,confirm);
    assert.equal(confirmation.committed,true,`${label}: DM root transaction retains the other UID's intent`);
    const after=confirmation.snapshot.val();
    assert.deepEqual(after.independentIntents[owner].root,expected,`${label}: original intent identity is preserved`);
    assert.equal(after.combatants[unitId].quickActionRemaining,0);assert.equal(after.combatants[unitId].statusEffects.rage.count,1);
    assert.equal(after.independentReceipts[owner].root.applied,true);
    assert.equal((await session.updateRoot(db,confirm)).committed,false,`${label}: receipt prevents duplicate effect`);
    assert.equal(session.canSeal(after,seal),true,`${label}: confirmed intent releases READY/sealing`);
    const sealed=await session.updateRoot(db,raw=>session.canSeal(raw,seal)?{...raw,estado:{...raw.estado,phase:'COMBAT_SEALED'},authority:{current:{phase:'sealed',round:1}}}:undefined);
    assert.equal(sealed.committed,true,`${label}: actual root sealing write also preserves the player intent`);
    await assert.rejects(session.updateRoot(db,raw=>{
      const next=JSON.parse(JSON.stringify(raw));next.independentIntents[owner].root.sourceId='forged';return next;
    }),/permission.denied/i,`${label}: root authority cannot rewrite an existing source identity`);
    // Run the actual Item intent handler against authenticated SDK writes,
    // including a crash between the combat journal and canonical inventory.
    const physical=label==='isolated'?base:'campaña/combate',playerPath=physical.replace(/\/combate$/,'')+`/jugadores/${owner}`;
    const item={instanceId:'Potion-A',category:'consumable',quantity:2,runtime:{actionCost:'quick_action',hpRestore:10}};
    await write(`${physical}/estado`,{phase:'PRE_COMBAT_PLANNING',round:2,encounterId:expected.encounterId},'owner');
    await write(`${physical}/authority`,{},'owner');
    await write(`${physical}/readyPlayers`,{},'owner');
    await write(`${physical}/combatants/${unitId}`,{id:unitId,battleActive:true,isPlayer:true,canonicalPlayerKey:owner,canonicalOwnerUid:player.localId,hp:40,maxHp:100,actionSlots:1},'owner');
    await write(`${playerPath}/inventario_activo`,{'Potion-A':item},'owner');
    const itemIntent={...expected,round:2,sourceId:'Potion-A',sourceType:'item',createdAt:2};
    await allowed(`${physical}/independentIntents/${owner}/item`,itemIntent,player,`${label}: player submits Quick Item`);
    const scope=label==='isolated'?isolated:campaignSession,remote=await independentClient(scope);
    const actualSession=scope.browser.LuminousCombatSession;
    scope.browser.LuminousCombatSession={...actualSession,async updatePath(){throw Error('inventory connection lost');}};
    const pending={[owner]:{item:itemIntent}};
    await assert.rejects(remote.processIndependentIntents(pending),/inventory connection lost/);
    const staged=(await ref.once('value')).val();
    assert.equal(staged.independentReceipts[owner].item.applied,false);assert.equal(staged.independentReceipts[owner].item.pendingInventory,true);
    assert.equal(session.canSeal(staged,{round:2,plans:{}}),false,`${label}: no seal before inventory persistence`);
    scope.browser.LuminousCombatSession=actualSession;
    await remote.processIndependentIntents(pending);
    await remote.processIndependentIntents(pending);
    const delivered=(await ref.once('value')).val(),savedPlayer=(await db.ref(`campaña/jugadores/${owner}`).once('value')).val();
    assert.equal(savedPlayer.inventario_activo['Potion-A'].quantity,1,`${label}: canonical item consumed once`);
    assert.equal(delivered.combatants[unitId].hp,50,`${label}: healing not replayed after reconnect`);
    assert.equal(delivered.independentReceipts[owner].item.applied,true);assert.equal(delivered.independentReceipts[owner].item.pendingInventory,false);
  }
  const foreign=productionBrowser(globalDb,'?encounter=room');
  await assert.rejects(foreign.session.updateRoot(foreign.db,raw=>({...raw,unauthorized:true})),/permission.denied/i,'Global DM cannot transact the isolated root');
  console.log('Real root transactions: player intent retained, effect + receipt committed once, READY/seal released, identity rewrite denied, and global-DM isolation enforced in both namespaces.');
}finally{
  clearTimeout(timeout);
  await Promise.allSettled(apps.map(app=>app.delete()));
}
