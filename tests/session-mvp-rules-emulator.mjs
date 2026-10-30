import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const firebase=require('firebase/app');require('firebase/auth');require('firebase/database');
await import('../js/session-mvp-runtime.js');
await import('../js/combat-mvp-runtime.js');
await import('../js/combat-xp-runtime.js');
await import('../js/combat-participants.js');
await import('../js/combat-session-lifecycle.js');
const api=globalThis.LuminousSessionMvpRuntime,project='demo-combat-results',ns=project+'-default-rtdb';
const clients=[];
async function client(name){
 const app=firebase.initializeApp({apiKey:'fake',projectId:project,databaseURL:'http://127.0.0.1:9100/?ns='+ns},name);
 app.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});app.database().useEmulator('127.0.0.1',9100);
 await app.auth().createUserWithEmailAndPassword(name+Date.now()+'@example.test','temporary-password');
 const c={app,db:app.database(),uid:app.auth().currentUser.uid};clients.push(c);return c;
}
const denied=promise=>assert.rejects(promise,/permission_denied|PERMISSION_DENIED/i);
try{
 const dm=await client('mvp-dm'),a=await client('mvp-a'),b=await client('mvp-b'),outsider=await client('mvp-outsider');
 const seed={config:{dm_uid:dm.uid},jugadores:{a:{uid:a.uid,level:10,xp:0},a2:{uid:a.uid,xp:0},b:{uid:b.uid,level:5,xp:0}}};
 const response=await fetch('http://127.0.0.1:9100/'+encodeURIComponent('campaña')+'.json?ns='+ns,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(seed)});assert.equal(response.ok,true);
 let state=await api.start({db:dm.db,uid:dm.uid});
 const path=api.BALLOTS+'/'+state.id;
 await denied(a.db.ref(path+'/'+a.uid).set('a'));
 await denied(a.db.ref(path+'/'+b.uid).set('a'));
 await denied(outsider.db.ref(path+'/'+outsider.uid).set('a'));
 await api.vote({db:a.db,uid:a.uid,voterId:'a',candidateId:'b'});
 assert.equal((await a.db.ref(path+'/'+a.uid).once('value')).val(),'b');
 await denied(a.db.ref(path+'/'+a.uid).set('b'));
 await denied(a.db.ref(path+'/'+a.uid).remove());
 await denied(b.db.ref(path+'/'+a.uid).once('value'));
 await denied(a.db.ref(path).once('value'));
 assert.equal((await dm.db.ref(path).once('value')).val()[a.uid],'b');
 assert.equal((await b.db.ref('campaña').once('value')).val().mvp_sesion.actual.votes,undefined);
 await api.vote({db:b.db,uid:b.uid,voterId:'b',candidateId:'a'});
 state=await api.close({db:dm.db,uid:dm.uid});assert.equal(state.phase,'coins');
 await denied(a.db.ref(path+'/'+a.uid).set('a'));
 await denied(a.db.ref(api.PATH+'/coinClicks/b').set(1));
 await denied(a.db.ref(api.PATH+'/coinClicks/a').set(2));
 await api.clickCoin({db:a.db,uid:a.uid,voterId:'a'});
 await denied(a.db.ref(api.PATH+'/coinClicks/a').set(1));
 await api.cancel({db:dm.db,uid:dm.uid});
 await denied(b.db.ref(api.PATH+'/coinClicks/b').set(1));
 state=await api.start({db:dm.db,uid:dm.uid});
 await api.vote({db:a.db,uid:a.uid,voterId:'a',candidateId:'b'});
 await api.close({db:dm.db,uid:dm.uid});
 await api.award({db:dm.db,uid:dm.uid});await api.award({db:dm.db,uid:dm.uid});
 assert.equal((await dm.db.ref('campaña/jugadores/b/xp').once('value')).val(),100);
 // Exercise actual RTDB removal of empty arrays, not only the memory adapter.
 await dm.db.ref('campaña/base_datos_npcs/n').set({xp:0});
 for(const kind of ['npc','player','none']){
  const fight={estado:{phase:'ENDING',encounterId:'emulator-'+kind,fixedEncounterXp:100,ending:{result:'victory',uid:dm.uid,token:'seal'}},combatants:kind==='none'?{}:{unit:kind==='npc'?{npcId:'n',faction:'ally'}:{isPlayer:true,playerId:'a',faction:'ally'}}};
  await dm.db.ref('campaña/combate').set(fight);
  const award=await globalThis.LuminousCombatXpRuntime.awardVictoryXp({db:dm.db,encounter:fight});
  assert.ok(Array.isArray(award.participantIds));assert.ok(Array.isArray(award.npcIds));
  const ended=await globalThis.LuminousCombatSession.commitEnd({db:dm.db,uid:dm.uid,result:'victory',token:'seal',xpAward:award});
  assert.equal(ended.phase,'ENDED',kind+'-only encounter');
  const raw=(await dm.db.ref('campaña/combate').once('value')).val();
  const again=await globalThis.LuminousCombatXpRuntime.awardVictoryXp({db:dm.db,encounter:raw});
  assert.ok(again.awards.every(row=>!row.awarded));
 }
 console.log('Firebase MVP: private ballots, cache-safe session closure, coins, idempotent session rewards, NPC/player/empty encounter payouts passed.');
}finally{await Promise.all(clients.map(c=>c.app.delete()));}
