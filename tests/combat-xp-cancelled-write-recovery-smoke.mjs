import assert from 'node:assert/strict';
await import('../js/combat-xp-runtime.js');
const xp=globalThis.LuminousCombatXpRuntime;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function fake(encounter,failures){
 const data={campaña:{combate:encounter,jugadores:{p:{xp:0}}}}, attempts=[];
 const read=path=>path.split('/').reduce((v,key)=>v?.[key],data)??null;
 const set=(path,val)=>{const keys=path.split('/'),last=keys.pop();let obj=data;for(const key of keys)obj=obj[key]||={};obj[last]=clone(val);};
 const ref=path=>({once:async()=>({val:()=>clone(read(path))}),on:(_type,fn)=>fn({val:()=>clone(read(path))}),off:()=>{},
  transaction:async update=>{attempts.push(path);
   if(path==='campaña/jugadores/p'&&failures.remaining-->0)throw Error('set');
   const next=update(clone(read(path))),committed=next!==undefined;
   if(committed)set(path,next);
   return {committed,snapshot:{val:()=>clone(read(path))}};
  }});
 return {ref,read,attempts};
}
const encounter={estado:{phase:'ENDING',encounterId:'set-retry',fixedEncounterXp:100,ending:{result:'victory'}},participants:{p:true}};
const db=fake(encounter,{remaining:2});
const result=await xp.awardVictoryXp({db,encounter});
assert.equal(db.read('campaña/jugadores/p/xp'),100);
assert.equal(db.attempts.filter(p=>p==='campaña/jugadores/p').length,3);
assert.equal(result.awards[0].awarded,true);
const second=await xp.awardVictoryXp({db,encounter});
assert.equal(second.awards[0].awarded,false);
assert.equal(db.read('campaña/jugadores/p/xp'),100);
const blocked=fake({...encounter,estado:{...encounter.estado,encounterId:'set-exhausted'}},{remaining:4});
await assert.rejects(()=>xp.awardVictoryXp({db:blocked,encounter:{...encounter,estado:{...encounter.estado,encounterId:'set-exhausted'}}}),error=>
 error.message==='ENCOUNTER_XP_TRANSACTION_INTERRUPTED'&&error.encounterXpStage==='payout');
assert.equal(blocked.read('campaña/jugadores/p/xp'),0);
console.log('XP RTDB cancelled transaction retry and no duplicate payout: OK');
