import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const plan={type:'deck',drawId:'draw-2',clashChoice:'force',clashConfirmed:true,targetId:'enemy',targetSlotIndex:0,data:{id:'s',skillId:'s',kind:'skill',name:'Cut'}};
const storage=new Map(),data={ready:{ready:false,round:1},plans:{}};
function syncClient(paused=false,round=1){
 const events={},ui={round,ready:false},restored=[],uid='uid',playerId='p',unit={id:'player:p',isPlayer:true,canonicalPlayerKey:'p'};
 const s={uid,playerId,role:'player',encounterId:'enc',round,combatState:'PRE_COMBAT_PLANNING',hydratedOnce:true,firebaseReady:true,combatants:{'player:p':unit}};
 s.db={ref(path){return{once:()=>paused&&path.includes('/plannedActions/')?new Promise(()=>{}):Promise.resolve({val:()=>path.includes('/plannedActions/')?data.plans:data.ready}),update:async rows=>{for(const [path,value]of Object.entries(rows)){if(path.includes('/readyPlayers/'))data.ready=value;else if(path.includes('/plannedActions/'))data.plans[path.split('/').at(-1)]=value;}}};}};
 const w={Math,console,document:null,crypto:{randomUUID:()=>`intent-${storage.size}-${Date.now()}`},firebase:{database:{ServerValue:{TIMESTAMP:1}}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},LuminousCombatLiveAdapter073:{state:s},LuminousCombat073:{uiState:()=>ui,restorePlanning:(plans,ready)=>{restored.push(plans);ui.ready=ready;}},addEventListener:(n,f)=>{events[n]=f;},removeEventListener(){},setTimeout(){}};w.window=w;
 vm.runInNewContext(fs.readFileSync(process.env.QA_BASELINE?'.qa-sdk/plan-sync-baseline.js':'js/combat-v073-plan-sync.js','utf8'),w);
 return{w,events,s,ui,restored};
}
const interrupted=syncClient(true);interrupted.events['luminous:combat073-plan-ready-change']({detail:{round:1,ready:true,plans:[plan]}});
assert.equal(storage.size,1,'READY must survive closure before the first network read completes');await flush();assert.equal(data.ready.ready,false);
const returned=syncClient();returned.events['luminous:combat073-hydrated']();await flush();
assert.equal(data.ready.ready,true);assert.equal(data.plans[0].drawId,'draw-2');assert.equal(data.plans[0].clashConfirmed,true);assert.equal(returned.ui.ready,true);assert.equal(storage.size,0);
// An acknowledged newer choice from another tab/device wins over the old outbox.
const stale=syncClient(true);stale.events['luminous:combat073-plan-ready-change']({detail:{round:1,ready:true,plans:[plan]}});data.ready={ready:false,round:1,clientIntentId:'newer-device-choice'};
const newer=syncClient();newer.events['luminous:combat073-hydrated']();await flush();assert.equal(data.ready.ready,false);assert.equal(storage.size,0);
const oldRound=syncClient(true);oldRound.events['luminous:combat073-plan-ready-change']({detail:{round:1,ready:true,plans:[plan]}});const nextRound=syncClient(false,2);nextRound.events['luminous:combat073-hydrated']();await flush();assert.equal(storage.size,0);assert.equal(data.ready.ready,false);
console.log('READY outbox: immediate exit, reentry, card/Clash identity, newer choice and round expiry PASS');
function listenerClient(module,denied=false){
 const events={},timers=[],refs={},restored=[],row={round:1,ready:true,plannedSlots:1},unit={id:'player:p',canonicalPlayerKey:'p',isPlayer:true,controlled:'player',autoPlans:[]};let tokens=0;
 const s={role:null,round:1,combatState:'PRE_COMBAT_PLANNING',playerId:'p',uid:'uid',hydratedOnce:true,user:{getIdToken:async()=>{tokens++;}},combatants:{'player:p':unit},skills:{}};
 s.db={ref(path){return refs[path]??=( {calls:0,on(_type,handler,error){this.handler=handler;this.calls++;if(denied&&this.calls===1){error({code:'PERMISSION_DENIED'});return;}handler({val:()=>path.endsWith('readyPlayers')?{p:row}:path.endsWith('plannedActions')?{}:{}});},off(){},once:async()=>({val:()=>({p:row})})});}};
 const w={Math,console,document:null,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},addEventListener:(n,f)=>{events[n]=f;},LuminousCombatLiveAdapter073:{state:s},LuminousCombat073:{combatants:()=>({'player:p':unit}),uiState:()=>({round:1,ready:false}),restorePlanning:(plans)=>restored.push(plans)}};w.window=w;
 vm.runInNewContext(fs.readFileSync(module,'utf8'),w);return{w,s,events,timers,refs,restored,get tokens(){return tokens;}};
}
const dm=listenerClient('js/combat-v073-authority.js');assert.equal(dm.timers.some(x=>x.ms===120),false);dm.s.role='dm';dm.events['luminous:combat073-hydrated']();assert.equal(dm.timers.filter(x=>x.ms===120).length,1,'DM must reconsider an already received READY snapshot after identity/hydration');
const remote=listenerClient('js/combat-v073-remote-intents.js',true);remote.s.role='player';await flush();assert.ok(remote.tokens>=2);for(const job of remote.timers.filter(x=>x.ms===250))job.fn();await flush();const api=remote.w.LuminousCombatRemoteIntents073;assert.equal(api.state.readyLoaded,true);assert.equal(api.state.plansLoaded,true);assert.equal(remote.restored.length,0,'Incomplete plan snapshot must not consume the restore request');
remote.refs['campaña/combate/plannedActions'].handler({val:()=>({p:{0:{round:1,unitId:'player:p',skillId:'s',drawId:'draw-2',kind:'skill',actionData:plan.data}}})});assert.equal(remote.restored.length,1);assert.equal(remote.restored[0][0].drawId,'draw-2');
console.log('READY listeners: Auth retry, complete-plan restoration and DM late hydration PASS');
