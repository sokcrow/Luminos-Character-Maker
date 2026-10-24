import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=file=>fs.readFileSync(file,'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
const initial=()=>({estado:{phase:'PRE_COMBAT_PLANNING',round:1,encounterId:'test'},combatants:{'player:p1':{
  id:'player:p1',canonicalPlayerKey:'p1',canonicalOwnerUid:'owner-uid',isPlayer:true,playerId:'p1',controlled:'remote',
  faction:'ally',hp:40,maxHp:100,sp:0,battleActive:true,classes:[{classId:'barbarian',levels:1}],actionSlots:1,
}},independentIntents:{p1:{}},independentReceipts:{},authority:{}});
const intent={schemaVersion:1,encounterId:'test',playerId:'p1',schedulerUid:'owner-uid',unitId:'player:p1',round:1,sourceId:'rage',sourceType:'trait',cost:'quick_action',targetId:'player:p1',createdAt:1};
function shared(){return {raw:initial(),writes:0,reject:false,conflict:null};}
function setup(database){
  const units=clone(database.raw.combatants),errors=[];
  const db={ref(path=''){return {on(){},off(){},async once(){
    const parts=path.split('/').slice(2);let value=database.raw;for(const key of parts)value=value?.[key];return {val:()=>clone(value??null)};
  }}}};
  const context=vm.createContext({console:{log(){},warn(){},error(...args){errors.push(args)}},Math:Object.create(Math),Date,Promise,Map,Set,WeakMap,WeakSet,Uint32Array,JSON,
    addEventListener(){},setTimeout(){return 1},clearTimeout(){},LuminousCombatLiveAdapter073:{state:{role:'dm',isAuthority:true,round:1,encounterId:'test',combatState:'PRE_COMBAT_PLANNING',user:{},uid:'dm-uid',db,
      players:{p1:{classes:[{classId:'barbarian',levels:1}]}},combatants:units}},
    LuminousCombat073:{combatants:()=>units,kit:()=>({actions:[]}),render(){}},
    LuminousCombatSession:{async updateRoot(_db,update){
      if(database.reject)throw new Error('write rejected');
      if(database.conflict){database.conflict(database.raw);database.conflict=null;}
      const next=update(clone(database.raw));if(!next)return {committed:false};database.raw=next;database.writes++;return {committed:true};
    }}});
  context.window=context;
  for(const file of ['status-library','status-engine','trait-engine','trait-catalog-core','archetype-engine','archetype-trait-catalog','universal-action-economy','combat-event-runtime','unit-independent-actions','combat-v073-authority','combat-v073-remote-intents'])vm.runInContext(read(`js/${file}.js`),context,{filename:file});
  context.LuminousClassRuntimeBootstrap={async boot(){return {ok:true}}};
  return {context,units,remote:context.LuminousCombatRemoteIntents073,authority:context.LuminousCombatAuthority073,errors};
}
const database=shared();database.raw.independentIntents.p1.once=clone(intent);
const first=setup(database);
assert.equal(await first.remote.processIndependentIntents(database.raw.independentIntents),true);
assert.equal(database.raw.combatants['player:p1'].quickActionRemaining,0);assert.equal(first.units['player:p1'].statusEffects.rage.count,1);
assert.equal(database.raw.independentReceipts.p1.once.applied,true);assert.equal(database.writes,1);
await first.remote.processIndependentIntents(database.raw.independentIntents);assert.equal(database.writes,1,'A duplicate receipt cannot execute again');
const failed=shared();failed.raw.independentIntents.p1.once=clone(intent);failed.reject=true;
const failure=setup(failed),before=JSON.stringify(failure.units);
await assert.rejects(failure.remote.processIndependentIntents(failed.raw.independentIntents),/write rejected/);
assert.equal(JSON.stringify(failure.units),before,'Write rejection leaves the real roster, uses and budget untouched');
assert.equal(failed.raw.independentReceipts.p1?.once,undefined);
failed.reject=false;assert.equal(await failure.remote.processIndependentIntents(failed.raw.independentIntents),true,'Retry executes after failed persistence');
const competing=shared();competing.raw.independentIntents.p1.once=clone(intent);const a=setup(competing),b=setup(competing);
await Promise.all([a.remote.processIndependentIntents(competing.raw.independentIntents),b.remote.processIndependentIntents(competing.raw.independentIntents)]);
assert.equal(competing.writes,1,'Two DM tabs atomically claim one receipt with the effect');
const race=shared();race.raw.independentIntents.p1.once=clone(intent);race.conflict=raw=>{raw.combatants['player:p1'].hp=7};const racing=setup(race);
await racing.remote.processIndependentIntents(race.raw.independentIntents);assert.equal(race.raw.combatants['player:p1'].hp,7,'A concurrent update is re-read instead of being overwritten');
for(const [name,patch]of [['unearned',{sourceId:'rogue_only_unearned'}],['spoof',{schedulerUid:'someone_else'}],['invalid_target',{targetId:'missing'}],['wrong_cost',{cost:'free_action'}],['old_encounter',{encounterId:'previous'}]]){
  const bad=shared();bad.raw.independentIntents.p1[name]={...intent,...patch};const isolated=setup(bad);await isolated.remote.processIndependentIntents(bad.raw.independentIntents);
  assert.equal(bad.raw.independentReceipts.p1[name].applied,false,name);assert.equal(isolated.units['player:p1'].quickActionRemaining,undefined,'Rejected intent has no speculative spend');
}
const rejected=shared();rejected.raw.independentIntents.p1.once=clone(intent);rejected.raw.authority.current={phase:'sealed',round:1};
await setup(rejected).remote.processIndependentIntents(rejected.raw.independentIntents);assert.equal(rejected.raw.independentReceipts.p1.once.applied,false,'A sealed turn rejects a late selection');
const rules=JSON.parse(read('database.rules.json')).rules.campaña;
for(const combat of [rules.combate,rules.encuentros.$encounterId.state.campaña.combate]){
  assert.ok(combat.independentIntents.$playerId.$intentId['.write'].includes('!data.exists()'));
  assert.ok(combat.independentIntents.$playerId.$intentId['.write'].includes('readyPlayers'));
  assert.equal(combat.independentIntents.$playerId.$intentId.$other['.validate'],'false');
  assert.ok(combat.combatants['.write'].includes('dm_uid'));
}
console.log('Authoritative independent intents: real rules/catalog/controller, atomic receipt, failed write retry, concurrent DM tabs, state conflict, ownership/targets/cost, scoped rules and sealed rejection passed.');
const sessionContext=vm.createContext({});sessionContext.window=sessionContext;
vm.runInContext(read('js/combat-session-lifecycle.js'),sessionContext);
const next=sessionContext.LuminousCombatSession.nextEncounter({estado:{phase:'ENDED',active:false},independentIntents:{p1:{old:intent}},independentReceipts:{p1:{old:{applied:true}}}},{id:'new',uid:'dm',time:1});
assert.equal(next.independentIntents,null);assert.equal(next.independentReceipts,null,'A fresh encounter cannot reuse a previous pending action/receipt');
