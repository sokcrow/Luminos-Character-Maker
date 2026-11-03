import assert from 'node:assert/strict';
await import('../js/combat-participants.js');
await import('../js/combat-session-lifecycle.js');
await import('../js/battle-viewer-dm-console-074.js');
const consoleApi=globalThis.LuminousBattleViewerDmConsole074;
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function fake(failCount=0,initial={xp:0,sp:80}){
 let actor=clone(initial),tries=0,watchers=0;
 const db={ref(path){
   assert.equal(path,'campaña/jugadores/p');
   return {on:(_event,handler)=>{watchers++;handler({val:()=>clone(actor)})},
     off:()=>{watchers--},once:async()=>({val:()=>clone(actor)}),
     transaction:async update=>{
       tries++;
       if(failCount-- > 0)throw Error('set');
       const next=update(clone(actor));
       if(next!==undefined)actor=clone(next);
       return {committed:next!==undefined,snapshot:{val:()=>clone(actor)}};
     }};
 }};
 return {db,get actor(){return clone(actor)},get tries(){return tries},get watchers(){return watchers}};
}
const encounter={estado:{encounterId:'sanity-shared'},
 participants:{p:true},combatants:{hero:{playerId:'p',isPlayer:true,sp:40,faction:'ally'}}};
const first=fake(2);
assert.equal(await consoleApi.persistPostCombatSanity(first.db,encounter),1);
assert.equal(first.actor.sp,40);
assert.equal(first.actor.lastPostCombatSanityEncounterId,'sanity-shared');
assert.equal(first.tries,3);
assert.equal(first.watchers,0);
await consoleApi.persistPostCombatSanity(first.db,encounter);
assert.equal(first.actor.sp,40);
assert.equal(first.watchers,0);
const missing=fake(0,null);
await assert.rejects(()=>consoleApi.persistPostCombatSanity(missing.db,encounter),/POST_COMBAT_SANITY_NOT_CONFIRMED/);
assert.equal(missing.watchers,0);
console.log('Shared Victory/Defeat sanity persistence: cancelled writes, receipts and absent records PASS');
