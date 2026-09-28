import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(file)=>fs.readFileSync(file,'utf8');
const source=read('js/combat-v073-runtime-hotfix.js');
const planSync=read('js/combat-v073-plan-sync.js');

assert.ok(planSync.includes("'js/combat-v073-runtime-hotfix.js'"),'plan sync bootstrap must load the runtime hotfix');
assert.ok(planSync.includes('s.firebaseReady===false'),'hidden Player Combat must reject residual plan-sync writes');
assert.ok(source.includes('patchTargetIntents'),'runtime hotfix must guard target-intent generation with sealed authority plans');
assert.ok(source.includes("reason:'blank-webgl-canvas'"),'DM visual recovery must detect active-but-blank WebGL output');

const calls={unsub:0,hydrate:0,authorityStop:0,authorityStart:0,remoteStop:0,remoteStart:0,render:0,requestRender:0,targetIntent:0};
const listeners=new Map();
const refs=new Map();
const makeRef=path=>({
  on(type,handler){refs.set(`${path}:${type}`,handler);},
  off(){},
  once(){return Promise.resolve({val:()=> 'dm-uid'});},
});
const db={ref:path=>makeRef(path||'')};
const adapterState={
  role:'player',round:3,user:{uid:'player-uid'},uid:'player-uid',playerId:'p1',db,firebaseReady:true,
  unsubscribers:[()=>{calls.unsub+=1;}],hydrateTimer:null,lastSignature:'cached',players:{},combatants:{},skills:{},combatState:'COMBAT',
};
const adapter={
  state:adapterState,
  ROOTS:{players:'players',combatants:'combatants',skills:'skills',state:'state',dmUid:'dmUid'},
  scheduleHydrate(){calls.hydrate+=1;},
};
const units={
  enemyA:{id:'enemyA',controlled:'ai',autoPlans:[{targetId:'wrong'}],battleActive:true},
  enemyB:{id:'enemyB',controlled:'ai',autoPlans:[{targetId:'stale'}],battleActive:true},
  player:{id:'player',controlled:'player',battleActive:true},
};
const authority={
  state:{started:true,current:{round:3,phase:'sealed',aiPlans:{enemyA:{0:{sourceSlotIndex:0,targetId:'player',kind:'skill',skillId:'bite',actionName:'Bite',actionData:{id:'bite'}}}}}},
  stop(){calls.authorityStop+=1;this.state.started=false;},
  start(){calls.authorityStart+=1;this.state.started=true;},
};
const remote={
  state:{started:true},
  runtimePlan(raw,index){return{sourceSlotIndex:index,targetId:raw.targetId,type:'deck',data:{id:raw.skillId||raw.actionData?.id}};},
  stop(){calls.remoteStop+=1;this.state.started=false;},
  start(){calls.remoteStart+=1;this.state.started=true;},
};
const game={
  dataset:{},style:{},
  classList:{values:new Set(['webgl2-renderer-ready','webgl2-background-ready']),remove(...names){for(const n of names)this.values.delete(n);},contains(name){return this.values.has(name);}},
  mode:'missing',
  querySelectorAll(selector){
    if(this.mode==='missing')return [];
    if(selector==='.sprite-container'||selector==='.sprite-img')return [{},{},{}];
    if(selector==='canvas')return [{
      width:640,height:360,
      getContext(){return{RGBA:6408,UNSIGNED_BYTE:5121,readPixels(_x,_y,_w,_h,_format,_type,pixel){pixel.fill(0);}};},
    }];
    if(selector==='.sprite-img.webgl2-texture-backed')return[{classList:{remove(){}}}];
    return[];
  },
};
const document={
  hidden:false,
  addEventListener(){},
  getElementById(id){return id==='game-container'?game:null;},
};
const window={
  document,parent:null,frameElement:null,console,
  LuminousCombatLiveAdapter073:adapter,
  LuminousCombatAuthority073:authority,
  LuminousCombatRemoteIntents073:remote,
  LuminousCombat073:{combatants:()=>units,render(){calls.render+=1;}},
  LuminousWebGL2Renderer:{surfaceActive:()=>true,requestRender(){calls.requestRender+=1;}},
  buildExecutionQueue(){return Object.values(units).flatMap(unit=>(unit.autoPlans||[]).filter(Boolean).map((plan,index)=>({ownerId:unit.id,localIndex:index,plan})));},
  assignTargetIntents(){calls.targetIntent+=1;units.enemyA.autoPlans=[{targetId:'client-replan'}];units.enemyB.autoPlans=[{targetId:'client-stale'}];return 'planned';},
  addEventListener(type,handler){listeners.set(type,handler);},
  dispatchEvent(){},
  setTimeout(fn){fn();return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
};
window.parent=window;window.window=window;
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
vm.runInNewContext(source,{window,CustomEvent,console},{filename:'combat-v073-runtime-hotfix.js'});

const hotfix=window.LuminousCombatRuntimeHotfix073;
assert.ok(hotfix,'hotfix API must install');
const queue=window.buildExecutionQueue();
assert.equal(queue.find(row=>row.ownerId==='enemyA')?.plan?.targetId,'player','sealed authority target must replace local enemy replan');
assert.equal(units.enemyB.autoPlans.length,0,'AI units omitted from authority payload must lose stale local plans');

assert.equal(window.assignTargetIntents(),'planned');
assert.equal(calls.targetIntent,1,'canonical target-intent generator should still execute');
assert.equal(units.enemyA.autoPlans[0]?.targetId,'player','target-intent generation must not overwrite the DM-sealed enemy target');
assert.equal(units.enemyB.autoPlans.length,0,'target-intent generation must not resurrect stale AI plans');

// Player hidden: stop RTDB/authority/remote work.
const startsBeforeHide={authority:calls.authorityStart,remote:calls.remoteStart};
document.hidden=true;
hotfix.syncLifecycle('test-hidden');
assert.equal(adapterState.firebaseReady,false,'hidden player viewer must suspend adapter realtime');
assert.equal(calls.unsub,1,'hidden player viewer must detach existing realtime listeners');
assert.equal(calls.authorityStop,1,'hidden player viewer must suspend authority listeners');
assert.equal(calls.remoteStop,1,'hidden player viewer must suspend remote intent listeners');

// Player visible again: restore listeners and hydrate current canonical state.
document.hidden=false;
hotfix.syncLifecycle('test-visible');
assert.equal(adapterState.firebaseReady,true,'visible player viewer must resume adapter realtime');
assert.ok(calls.authorityStart>startsBeforeHide.authority,'visible player viewer must resume authority listeners');
assert.ok(calls.remoteStart>startsBeforeHide.remote,'visible player viewer must resume remote intent listeners');
assert.equal(adapterState.lastSignature,'','resume must invalidate stale hydration signature');

// DM authority never suspends and visual health can recover both missing and blank surfaces.
adapterState.role='dm';
let health=hotfix.dmVisualHealth();
assert.equal(health.ok,false);
assert.equal(health.reason,'missing-dom-tokens');

game.mode='blank';
health=hotfix.dmVisualHealth();
assert.equal(health.ok,false,'an active canvas with no visible pixels must not be treated as healthy');
assert.equal(health.reason,'blank-webgl-canvas');
hotfix.forceDmDomFallback(health.reason);
assert.equal(game.dataset.dmVisualFallback,'dom');
assert.equal(game.dataset.dmVisualFallbackReason,'blank-webgl-canvas');
assert.ok(calls.render>0,'DOM fallback must re-render the canonical combat HUD');
assert.ok(calls.requestRender>0,'DOM fallback must invalidate WebGL/VFX surface too');

const stopsBeforeDm={authority:calls.authorityStop,remote:calls.remoteStop};
document.hidden=true;
hotfix.syncLifecycle('dm-hidden');
assert.deepEqual({authority:calls.authorityStop,remote:calls.remoteStop},stopsBeforeDm,'DM authority must stay subscribed even if its document visibility changes');

console.log('combat v0.7.3 runtime lifecycle/authority/fallback smoke: ok');
