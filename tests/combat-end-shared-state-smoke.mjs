import assert from 'node:assert/strict';
await import('../js/combat-participants.js');
await import('../js/combat-session-lifecycle.js');
const session=globalThis.LuminousCombatSession;
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
function fake(initial){
 let data=clone(initial);
 return {get current(){return clone(data)},
   ref(path){
     const read=()=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
     return {once:async()=>({val:()=>clone(read())}),
       on:(_type,handler)=>handler({val:()=>clone(read())}),off:()=>{},
       transaction:async update=>{
         const prev=clone(read()),next=update(prev);
         if(next===undefined)return {committed:false,snapshot:{val:()=>clone(prev)}};
         if(path==='campaña/combate')data={...data,campaña:{...data.campaña,combate:clone(next)}};
         else throw Error('Unexpected path '+path);
         return {committed:true,snapshot:{val:()=>clone(next)}};
       }};
   }
 };
}
function combat({phase='PRE_COMBAT_PLANNING',roundPhase='complete',ending,endedBy,result}={}){
 return {campaña:{combate:{estado:{phase,active:phase!=='ENDED',encounterId:'shared-case',ending,endedBy,result},
 authority:{current:{phase:roundPhase}},combatants:{hero:{isPlayer:true,playerId:'p',faction:'ally'}}}}};
}
const dm='dm',token='token-original';
const pending=fake(combat({phase:'ENDING',roundPhase:'running',ending:{uid:dm,result:'victory',token,startedAt:1,failed:true}}));
let effectCalls=0;
const recovered=await session.claimEnd({db:pending,uid:dm,result:'victory',applyEffects:()=>{effectCalls++;}});
assert.equal(recovered.estado.ending.token,token,'retains original closure receipt identity');
assert.equal(effectCalls,0,'retry must not reapply encounter-end effects');
await assert.rejects(()=>session.claimEnd({db:pending,uid:dm,result:'defeat'}),e=>e.message==='ENCOUNTER_END_VICTORY_RECOVERY_REQUIRED');
assert.match(session.endErrorMessage({message:'ENCOUNTER_END_VICTORY_RECOVERY_REQUIRED'}),/VICTORY/);
assert.equal(pending.current.campaña.combate.estado.phase,'ENDING');

const finished=fake(combat({phase:'ENDED',roundPhase:'running',endedBy:dm,result:'victory'}));
const ended=await session.claimEnd({db:finished,uid:dm,result:'victory',applyEffects:()=>{effectCalls++;}});
assert.equal(ended.estado.phase,'ENDED');
assert.equal(effectCalls,0);
await assert.rejects(()=>session.claimEnd({db:finished,uid:dm,result:'defeat'}),e=>e.message==='ENCOUNTER_END_ALREADY_CONFIRMED');

for(const roundPhase of ['running','sealed']){
 const blocked=fake(combat({roundPhase}));
 await assert.rejects(()=>session.claimEnd({db:blocked,uid:dm,result:'defeat',applyEffects:()=>{effectCalls++;}}),e=>e.message==='ENCOUNTER_END_ROUND_IN_PROGRESS');
 assert.equal(blocked.current.campaña.combate.estado.phase,'PRE_COMBAT_PLANNING');
}
assert.equal(effectCalls,0,'blocked attempts never apply effects');

const normalDefeat=fake(combat());
const claimed=await session.claimEnd({db:normalDefeat,uid:dm,result:'defeat',applyEffects:()=>{effectCalls++;}});
assert.equal(claimed.estado.phase,'ENDING');
assert.equal(effectCalls,1);
const result=await session.commitEnd({db:normalDefeat,uid:dm,result:'defeat',token:claimed.estado.ending.token});
assert.equal(result.phase,'ENDED');
assert.equal(result.result,'defeat');
assert.equal(normalDefeat.current.campaña.combate.estado.active,false);
console.log('Shared encounter end: pending Victory, Defeat, stale authority, in-flight turn: PASS');
