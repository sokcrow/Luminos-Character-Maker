import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context={};vm.runInNewContext(fs.readFileSync('js/combat-session-lifecycle.js','utf8'),context);
const api=context.LuminousCombatSession,plain=value=>JSON.parse(JSON.stringify(value));
const options={id:'new',uid:'dm',time:100};
const ended={estado:{encounterId:'old',phase:'ENDED',active:false},combatants:{old:{hp:3}},authority:{current:{phase:'complete'}},playback:{current:{batches:{old:{}}}},plannedActions:{a:{old:{}}},readyPlayers:{a:{ready:true}},encounterLoot:{old:{items:['sword']}}};
const next=api.nextEncounter(ended,options);
assert.equal(next.estado.encounterId,'new');for(const key of ['combatants','reserves','departed','authority','playback','plannedActions','readyPlayers'])assert.equal(next[key],null);
assert.deepEqual(plain(next.encounterLoot),ended.encounterLoot);assert.equal(ended.combatants.old.hp,3);
assert.equal(api.nextEncounter(next,options),undefined);
const oldWithoutIdentity={estado:{phase:'PRE_COMBAT_PLANNING'},combatants:{a:{hp:43}},plannedActions:{a:{}}};
assert.deepEqual(plain(api.nextEncounter(oldWithoutIdentity,options).combatants),oldWithoutIdentity.combatants);
for(const phase of ['running','sealed']){
  const running={...ended,authority:{current:{phase}}};
  assert.equal(api.nextEncounter(running,options),undefined);assert.equal(api.nextEnd(running,{...options,result:'victory'}),undefined);assert.equal(api.nextPresentation(running,'simple'),undefined);
}
const planning={estado:{phase:'PRE_COMBAT_PLANNING',round:2},combatants:{a:{hp:43}},authority:{current:{phase:'complete',checkpoint:{seq:4}}}};
const simple=api.nextPresentation(planning,'simple');assert.equal(simple.estado.presentation,'simple');assert.deepEqual(plain(simple.combatants),planning.combatants);assert.deepEqual(plain(simple.authority),planning.authority);
assert.equal(api.nextPresentation({...planning,plannedActions:{a:{0:{}}}},'simple'),undefined);assert.equal(api.nextPresentation({...planning,readyPlayers:{a:{ready:true}}},'simple'),undefined);
const finished=api.nextEnd(planning,{...options,result:'victory'});assert.equal(finished.estado.active,false);assert.equal(finished.estado.result,'victory');assert.deepEqual(plain(finished.combatants),planning.combatants);
// A transaction rejected due to an in-flight round must never change instance.
let writes=0;const db={ref:()=>({on:(_event,listener)=>listener(),off(){},transaction:async()=>({committed:false,snapshot:{val:()=>({authority:{current:{phase:'running'}}})}}),set:async()=>writes++})};
await assert.rejects(api.start({db,uid:'dm'}),/termine la ronda/);await assert.rejects(api.end({db,uid:'dm',result:'victory'}),/termine la ronda/);assert.equal(writes,0);
console.log('Phase 6: idempotent encounter entry, canonical reset, safe round boundaries and preserved vitals/loot passed');
