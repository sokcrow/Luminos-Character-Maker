import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../js/combat-mvp-runtime.js');
await import('../js/combat-xp-runtime.js');
await import('../js/combat-participants.js');
await import('../js/combat-session-lifecycle.js');
const mvp=globalThis.LuminousCombatMvpRuntime,xp=globalThis.LuminousCombatXpRuntime,lifecycle=globalThis.LuminousCombatSession;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
// Emulate RTDB wire semantics and its uncached first transaction callback.
function memory(initial,{firebase=false}={}){
 const data=copy(initial),retained=new Map();let failPath='';
 function wire(v){
   if(v==null)return null;
   if(typeof v!=='object')return v;
   const entries=Object.entries(v).map(([k,x])=>[k,wire(x)]).filter(([,x])=>x!==null);
   if(!entries.length)return null;
   return Array.isArray(v)?entries.reduce((a,[k,x])=>{a[k]=x;return a;},[]):Object.fromEntries(entries);
 }
 const read=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
 const write=(path,value)=>{const parts=path.split('/'),last=parts.pop();let node=data;for(const key of parts)node=node[key]||={};const stored=firebase?wire(value):copy(value);if(stored===null)delete node[last];else node[last]=stored;};
 const ref=path=>({once:async()=>({val:()=>copy(read(path))}),on:(_event,fn)=>{retained.set(path,(retained.get(path)||0)+1);fn({val:()=>copy(read(path))});},off(){retained.set(path,Math.max(0,(retained.get(path)||0)-1));},set:async value=>write(path,value),transaction:async fn=>{
   if(path===failPath){failPath='';throw Error('DISCONNECTED');}
   if(firebase&&!retained.get(path)&&fn(null)===undefined)return {committed:false,snapshot:{val:()=>copy(read(path))}};
   const next=fn(copy(read(path))),committed=next!==undefined;if(committed)write(path,next);
   return {committed,snapshot:{val:()=>copy(read(path))}};
 }});
 return {ref,read,write,retained,failAt:path=>failPath=path};
}
globalThis.LuminousCombatAuthority073={isDm:()=>true};
mvp.resetMetrics();
mvp.recordEvent({round:1,sequence:1,type:'RoundSealed'});
mvp.recordEvent({round:1,sequence:2,type:'ShieldApplied',ownerId:'guard',amount:25});
mvp.recordEvent({round:1,sequence:3,type:'EvadeResolved',ownerId:'guard',evaded:true});
mvp.recordEvent({round:1,sequence:4,type:'HitEvaded',ownerId:'attacker',unitId:'guard'});
assert.equal(mvp.snapshotMetrics().guard.protection,26);
assert.equal(mvp.snapshotMetrics().attacker?.protection||0,0);
const saved=mvp.checkpoint();mvp.resetMetrics();mvp.restore(saved);
mvp.recordEvent({round:1,sequence:2,type:'ShieldApplied',ownerId:'guard',amount:25});
assert.equal(mvp.snapshotMetrics().guard.protection,26,'replayed event must not score twice');
const encounter={estado:{phase:'ENDING',encounterId:'mixed',fixedEncounterXp:200,ending:{result:'victory',uid:'dm',token:'seal'}},combatants:{player:{isPlayer:true,playerId:'p',faction:'ally'},guard:{npcId:'n',faction:'ally'}},combatMetrics:{guard:{protection:26,healing:10},player:{damage:3}}};
const db=memory({'campaña':{config:{dm_uid:'dm'},combate:encounter,jugadores:{p:{uid:'u1',xp:0}},base_datos_npcs:{n:{xp:0}}}});
db.failAt('campaña/base_datos_npcs/n');
await assert.rejects(()=>xp.awardVictoryXp({db,encounter}),/DISCONNECTED/);
assert.equal(db.read('campaña/jugadores/p/xp'),100);
const changed=copy(encounter);changed.combatMetrics={player:{damage:999}};changed.estado.fixedEncounterXp=999;
const recovered=await xp.awardVictoryXp({db,encounter:changed});
assert.equal(recovered.mvp.id,'npc:n','stored winner survives reconnection');
assert.equal(recovered.totalXp,200,'stored amount survives recalculation');
assert.equal(db.read('campaña/jugadores/p/xp'),100);
assert.equal(db.read('campaña/base_datos_npcs/n/xp'),115);
const ended=await lifecycle.commitEnd({db,uid:'dm',result:'victory',token:'seal',xpAward:recovered,combatMetrics:changed.combatMetrics});
assert.equal(ended.phase,'ENDED');assert.equal(ended.mvp.id,'npc:n');assert.equal(ended.rewardRows.length,2);
assert.equal(ended.rewardRows.find(row=>row.id==='npc:n').bonusXp,15);
const repeat=await xp.awardVictoryXp({db,encounter:db.read('campaña/combate')});
assert.ok(repeat.awards.every(row=>!row.awarded));
const next=lifecycle.nextEncounter(db.read('campaña/combate'),{id:'new',uid:'dm',time:1});
assert.equal(next.mvpCheckpoint,null);assert.equal(next.xpPlans,null);
// Session end-to-end: distinct accounts, private ballot location, no self vote,
// empty close, repeated award and a multi-round tie with disconnected candidates.
let uuid=0,random=[0,0,0,1];
const sandbox={crypto:{randomUUID:()=>String(++uuid),getRandomValues:a=>{a[0]=random.shift()??0;}},console};
vm.runInNewContext(fs.readFileSync(new URL('../js/session-mvp-runtime.js',import.meta.url),'utf8'),sandbox);
const session=sandbox.LuminousSessionMvpRuntime;
const sdb=memory({'campaña':{config:{dm_uid:'dm'},jugadores:{a:{uid:'u1',level:10,xp:0},a2:{uid:'u1',level:4,xp:0},b:{uid:'u2',level:5,xp:0}}}},{firebase:true});
let current=await session.start({db:sdb,uid:'dm'});
assert.deepEqual(Object.keys(current.candidates),['a','b']);
await assert.rejects(()=>session.vote({db:sdb,uid:'u1',voterId:'a',candidateId:'a'}),/INVALID_VOTE/);
await session.vote({db:sdb,uid:'u1',voterId:'a',candidateId:'b',sessionId:current.id});
await assert.rejects(()=>session.vote({db:sdb,uid:'u1',voterId:'a',candidateId:'b'}),/ALREADY_VOTED/);
assert.equal(sdb.read(session.PATH+'/votes'),null,'no public ballots');
await session.vote({db:sdb,uid:'u2',voterId:'b',candidateId:'a'});
current=await session.close({db:sdb,uid:'dm'});assert.equal(current.phase,'coins');
await assert.rejects(()=>session.resolveCoins({db:sdb,uid:'dm'}),/COINS_PENDING/);
current=await session.resolveCoins({db:sdb,uid:'dm',includeAbsent:true});assert.equal(current.phase,'coins');assert.equal(current.coinRound,2);
current=await session.resolveCoins({db:sdb,uid:'dm',includeAbsent:true});assert.equal(current.phase,'awarding');assert.equal(current.winnerId,'a');
await session.award({db:sdb,uid:'dm'});await session.award({db:sdb,uid:'dm'});
assert.equal(sdb.read('campaña/jugadores/a/xp'),200);
await session.start({db:sdb,uid:'dm'});current=await session.close({db:sdb,uid:'dm'});assert.equal(current.phase,'cancelled');
await session.start({db:sdb,uid:'dm'});await session.cancel({db:sdb,uid:'dm'});assert.equal(sdb.read(session.PATH+'/phase'),'cancelled');
await assert.rejects(()=>session.start({db:sdb,uid:'u1'}),/DM_ONLY/);
console.log('MVP recovery: mixed NPC closure, frozen partial payouts, metrics replay, private ballots, unique accounts, cancellation and coin rounds passed.');

// Firebase omits empty player/NPC/recipient arrays and null MVPs in durable plans.
for(const kind of ['npc','player','none']){
 const id='wire-'+kind;
 const unit=kind==='npc'?{npcId:'n',faction:'ally'}:{isPlayer:true,playerId:'p',faction:'ally'};
 const fight={estado:{phase:'ENDING',encounterId:id,fixedEncounterXp:100,ending:{result:'victory',uid:'dm',token:'seal'}},combatants:kind==='none'?{}:{unit}};
 const wireDb=memory({'campaña':{combate:fight,jugadores:{p:{uid:'u1',xp:0}},base_datos_npcs:{n:{xp:0}}}},{firebase:true});
 const first=await xp.awardVictoryXp({db:wireDb,encounter:fight});
 assert.ok(Array.isArray(first.participantIds));assert.ok(Array.isArray(first.npcIds));assert.ok(Array.isArray(first.missingCr));
 assert.equal(first.participantCount,kind==='none'?0:1);
 const ended=await lifecycle.commitEnd({db:wireDb,uid:'dm',result:'victory',token:'seal',xpAward:first});
 assert.equal(ended.phase,'ENDED',kind+' only encounter closes with Firebase-serialized plan');
 const again=await xp.awardVictoryXp({db:wireDb,encounter:wireDb.read('campaña/combate')});
 assert.ok(again.awards.every(row=>!row.awarded));
 assert.ok([...wireDb.retained.values()].every(n=>n===0),'payout listeners are released');
}
assert.ok([...sdb.retained.values()].every(n=>n===0),'session listeners are released');
console.log('Firebase regressions: uncached session transactions and NPC/player/empty payouts passed.');
