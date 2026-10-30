import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const calls=[],frames=new Map();let serial=0;
const units={a:{id:'a',hp:100,maxHp:100,sp:0,actionSlots:1,statusEffects:{}},b:{id:'b',hp:100,maxHp:100,sp:0,actionSlots:1,statusEffects:{}}};
const tokens=Object.fromEntries(Object.keys(units).map(id=>[id,{querySelectorAll:()=>[],querySelector:selector=>selector==='.floating-sp-group'?{set textContent(value){calls.push(['sp',id,value])}}:null}]));
const c=vm.createContext({console,Math,JSON,Map,Set,Promise,
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),
  combatData:units,LuminousCombatSteps:{version:'test'},addEventListener(){},setTimeout(){return 1},clearTimeout(){},
  LuminousCombatLiveAdapter073:{state:{role:'player'}},LuminousCombat073:{combatants:()=>units,render:()=>calls.push(['fullRender'])},
  LuminousCombatStage073:{refresh:()=>calls.push(['stageAll']),refreshUnit:u=>calls.push(['stage',u.id])},
  LuminousCombatHudMotion073:{refresh:()=>calls.push(['hudAll']),scheduleStatusLayout:()=>calls.push(['layout'])},
  syncCombatantVitalNumber:id=>calls.push(['hp',id,units[id].hp]),combatantHpPct:u=>u.hp/u.maxHp*100,setHpLinePct(){},
  renderStatusEffects:id=>calls.push(['status',id]),syncConditionVisuals:()=>calls.push(['conditions']),syncUnitActionState:id=>calls.push(['actionState',id]),renderCombatantShield:id=>calls.push(['shield',id]),
  $:id=>id==='battlefield'?{offsetHeight:900}:tokens[id.replace(/^token-/,'')],
  combatStepRuntime:()=>({present:async()=>calls.push(['present'])}),unitSlots:()=>[],
});c.window=c;
vm.runInContext(fs.readFileSync('js/combat-v073-authority.js','utf8'),c);
const html=fs.readFileSync('combat/source/combat-v073-live.html','utf8');
vm.runInContext(html.slice(html.indexOf('const playbackVisualChanges='),html.indexOf('window.LuminousCombat073=Object.freeze({')),c);
const a=c.LuminousCombatAuthority073,view=c.LuminousCombatStepRuntime;
function apply(snapshot){const changes=[];const result=a.applySnapshot(snapshot,{deferRender:true,changes});view.queuePlaybackRefresh(changes);return {result,changes};}
assert.equal(apply({a:{hp:90,actionSlots:1}}).result,true);
apply({a:{hp:80,sp:3,actionSlots:1}});apply({b:{statusEffects:{burn:{potency:2,count:1}},actionSlots:1}});
assert.equal(units.a.hp,80,'Every authoritative mutation applies immediately');assert.equal(calls.length,0,'No intermediate whole-roster paints');assert.equal(frames.size,1,'One pending visual refresh for the burst');
await view.present('actionStart',[]);
assert.equal(frames.size,0);assert.deepEqual(calls.filter(x=>x[0]==='hp'),[['hp','a',80]]);assert.deepEqual(calls.filter(x=>x[0]==='status'),[['status','b']]);assert.equal(calls.at(-1)[0],'present','Canonical vitals/status paint before the next cue');assert.equal(calls.some(x=>['fullRender','hudAll','stageAll'].includes(x[0])),false);
calls.length=0;assert.equal(apply({a:{hp:80,sp:3,actionSlots:1}}).result,false);assert.equal(frames.size,0);assert.equal(calls.length,0,'Duplicate state does no visual work');
apply({a:{combatDeck:{rngState:42},actionSlots:1}});view.flushPlaybackRefresh();assert.equal(calls.length,0,'Nonvisual ledger/deck changes do not rebuild HUD');
apply({b:{x:25,shieldPools:{guard:8},actionSlots:1}});view.flushPlaybackRefresh();assert.ok(calls.some(x=>x[0]==='shield'&&x[1]==='b'));assert.ok(calls.some(x=>x[0]==='stage'&&x[1]==='b'));assert.equal(calls.some(x=>x[0]==='hp'&&x[1]==='a'),false,'Unchanged peer is untouched');
calls.length=0;apply({a:{hp:75,actionSlots:1}});view.cancelPlaybackRefresh();assert.equal(frames.size,0,'Teardown cancels queued paint');assert.equal(units.a.hp,75,'Cancelling paint never rolls back state');
a.applySnapshot({a:{hp:70,actionSlots:1}});assert.ok(calls.some(x=>x[0]==='fullRender'),'Recovery/default API keeps its full refresh contract');
console.log('Playback dirty rendering: canonical state immediate, burst coalesced, targeted HP/status/shield/stage, pre-cue flush, identical-state no-op, teardown and recovery pass.');
