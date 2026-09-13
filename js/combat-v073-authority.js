(function(global){
  'use strict';
  if(global.LuminousCombatAuthority073)return;

  const ROOT=Object.freeze({
    current:'campaña/combate/authority/current',
    state:'campaña/combate/estado',
    combatants:'campaña/combate/combatants',
    ready:'campaña/combate/readyPlayers',
    targets:'campaña/combate/targetIntents',
    privatePlans:'combat_private/plans'
  });
  const nativeRandom=global.Math.random.bind(global.Math);
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[\s-]+/g,'_');
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const state={started:false,ref:null,handler:null,current:{},seed:0,cursor:0,rngState:0,remoteStart:false,autoStartedRound:0,lastCheckpointSeq:0,writeChain:Promise.resolve(),hooks:new Map(),retryTimer:null,checkpointTimer:null};

  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function isDm(){return adapterState()?.role==='dm';}
  function isPlayer(){return adapterState()?.role==='player';}
  function serverTime(){return global.firebase?.database?.ServerValue?.TIMESTAMP||Date.now();}
  function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const out={};Object.keys(value).sort().forEach(k=>{if(value[k]!==undefined)out[k]=stable(value[k]);});return out;}return value;}
  function digest(value){const text=JSON.stringify(stable(value));let h=2166136261;for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
  function makeSeed(round){const array=new Uint32Array(1);try{global.crypto?.getRandomValues?.(array);}catch(_){}return(array[0]||((Date.now()^(Math.floor(nativeRandom()*0xffffffff)))>>>0)^((Number(round)||1)*2654435761))>>>0;}
  function resetRandom(seed,cursor=0){state.seed=(Number(seed)||1)>>>0;state.rngState=state.seed;state.cursor=0;for(let i=0;i<Math.max(0,Math.trunc(cursor||0));i+=1)randomRaw();return state.seed;}
  function randomRaw(){state.rngState=(state.rngState+0x6D2B79F5)>>>0;let t=state.rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);const value=((t^(t>>>14))>>>0)/4294967296;state.cursor+=1;return value;}
  function random(){const phase=norm(state.current?.phase);return state.seed&&['sealed','running'].includes(phase)?randomRaw():nativeRandom();}

  function canonicalPlayerId(unit={}){return clean(unit.canonicalPlayerKey||unit.ownerPlayerId||unit.playerId||unit.characterLink?.playerId);}
  function compactUnit(unit={}){
    return{
      hp:Math.max(0,finite(unit.hp,0)),maxHp:Math.max(1,finite(unit.maxHp,1)),sp:finite(unit.sp,0),
      speed:finite(unit.speed,0),speedBaseRoll:finite(unit.speedBaseRoll,0),speedTie:finite(unit.speedTie,0),speedRollTurn:Math.max(0,Math.trunc(finite(unit.speedRollTurn,0))),
      actionSlots:Math.max(1,Math.trunc(finite(unit.actionSlots??unit.activeSlots,1))),activeSlots:Math.max(1,Math.trunc(finite(unit.activeSlots??unit.actionSlots,1))),
      statusEffects:clone(unit.statusEffects||{}),pendingStatusEffects:clone(unit.pendingStatusEffects||[]),
      battleActive:unit.battleActive!==false,isBackup:unit.isBackup===true,incapacitated:unit.incapacitated===true,
      staggerStage:Math.max(0,Math.trunc(finite(unit.staggerStage,0))),staggerActivatedRound:Math.max(0,Math.trunc(finite(unit.staggerActivatedRound,0))),staggerUntilRound:Math.max(0,Math.trunc(finite(unit.staggerUntilRound,0))),
      triggeredStaggerThresholds:clone(unit.triggeredStaggerThresholds||[]),shieldPools:clone(unit.shieldPools||{}),concentration:clone(unit.concentration||null),
      x:finite(unit.x,0),y:finite(unit.y,0),retreatPendingRound:Math.max(0,Math.trunc(finite(unit.retreatPendingRound,0))),escapePendingRound:Math.max(0,Math.trunc(finite(unit.escapePendingRound,0))),
      escaped:unit.escaped===true,damageTakenThisRound:Math.max(0,finite(unit.damageTakenThisRound,0)),quickActionRemaining:finite(unit.quickActionRemaining,unit.quickActionsRemaining??1),reactionRemaining:finite(unit.reactionRemaining,unit.reactionsRemaining??1)
    };
  }
  function snapshotRuntime(){const data=runtime()?.combatants?.()||{},out={};Object.entries(data).forEach(([id,unit])=>{out[id]=compactUnit(unit||{});});return out;}
  function checkpointDigest(snapshot=snapshotRuntime()){return digest({round:Number(adapterState()?.round)||0,cursor:state.cursor,combatants:snapshot});}
  function serializeRuntimePlan(plan={},unitId,slotIndex=0){
    const bridge=global.LuminousCombatPlanSync073,kind=bridge?.kindOf?.(plan)||'skill',data=plan.data||{};let id='';
    if(kind==='spell')id=clean(data.spellId||data.id||data.key);else if(kind==='trait')id=clean(data.traitId||data.id||data.key);else if(kind==='item')id=clean(data.itemId||data.id||data.key||data.name);else if(kind==='global')id=clean(data.actionKey||data.id||data.key||data.name);else id=clean(data.skillId||data.id||data.key||data.name);
    const out={schemaVersion:3,engineVersion:'0.7.3-live-authority',kind,unitId,scheduledBy:unitId,schedulerUid:adapterState()?.uid||'',status:'authority_public',round:Number(adapterState()?.round)||1,sourceSlotIndex:Number.isInteger(plan.sourceSlotIndex)?plan.sourceSlotIndex:slotIndex,targetId:clean(plan.targetId)||null,targetSlotIndex:plan.targetSlotIndex==null?null:Math.max(0,Number(plan.targetSlotIndex)||0};
    const targetSide=clean(data.targetSide||data.targetRule||plan.targetSide||plan.targetRule);if(targetSide)out.targetSide=targetSide;if(Array.isArray(plan.additionalTargets)&&plan.additionalTargets.length)out.additionalTargets=clone(plan.additionalTargets);
    out.actionName=clean(data.name||data.nombre||data.label||id);
    if(kind==='spell'){out.spellId=id;out.spellSelectionKey=clean(data.spellSelectionKey||data.selectionKey||id);out.classId=clean(data.classId||data.class||'unknown');out.slotLevel=Math.max(0,Math.min(9,Math.trunc(finite(data.slotLevel??data.level,0))));out.overcast=Boolean(data.overcast);}
    else if(kind==='trait')out.traitId=id;else if(kind==='item'){out.itemId=id;if(data.itemType||data.item_type||data.type)out.itemType=clean(data.itemType||data.item_type||data.type);}else if(kind==='global')out.actionKey=id;else out.skillId=id;return out;
  }
  function collectAiPlans(){
    const out={},data=runtime()?.combatants?.()||{};
    Object.entries(data).forEach(([id,unit])=>{if(unit?.controlled!=='ai'||!Array.isArray(unit.autoPlans))return;const rows={};unit.autoPlans.forEach((plan,index)=>{if(plan)rows[index]=serializeRuntimePlan(plan,id,index);});if(Object.keys(rows).length)out[id]=rows;});return out;
  }
  function activePlayerIds(){return Object.values(adapterState()?.combatants||{}).filter(unit=>unit?.isPlayer===true&&unit.battleActive!==false&&!unit.isBackup).map(canonicalPlayerId).filter(Boolean);}
  async function read(path){const s=adapterState();if(!s?.db?.ref)throw new Error('COMBAT_DB_UNAVAILABLE');const snap=await s.db.ref(path).once('value');return snap.val();}
  async function sealRound(){
    const s=adapterState();if(!s?.db?.ref||!isDm())throw new Error('DM_AUTHORITY_REQUIRED');const round=Math.max(1,Math.trunc(Number(s.round)||1));
    const [ready,plans]=await Promise.all([read(ROOT.ready),read(`${ROOT.privatePlans}/${round}`)]),missing=[];
    activePlayerIds().forEach(playerId=>{const row=ready?.[playerId];if(!row?.ready||Number(row.round)!==round)missing.push(playerId);});
    if(missing.length)throw new Error(`PLAYERS_NOT_READY:${missing.join(',')}`);
    const seed=makeSeed(round),payload={schemaVersion:1,engineVersion:'0.7.3-authority.1',round,phase:'sealed',seed,authorityUid:s.uid,plans:clone(plans||{}),aiPlans:collectAiPlans(),createdAt:serverTime(),checkpoint:null};
    await s.db.ref(ROOT.current).set(payload);state.current={...payload,createdAt:Date.now()};resetRandom(seed,0);applyAuthority(payload);return payload;
  }
  function planRowsToArray(rows,unit){
    const converter=global.LuminousCombatRemoteIntents073?.runtimePlan;if(!converter)return[];const plans=[];Object.entries(rows||{}).forEach(([slot,raw])=>{const index=Math.max(0,Number(raw?.sourceSlotIndex??slot)||0);plans[index]=converter(raw,index,unit);});return plans;
  }
  function applyAuthority(data=state.current){
    const s=adapterState(),combat=runtime();if(!combat?.combatants||!s||Number(data?.round)!==Number(s.round))return false;
    if(data.seed)resetRandom(data.seed,Number(data?.checkpoint?.rngCursor)||0);
    const units=combat.combatants();
    if(s.role==='player'&&s.playerId&&data.plans?.[s.playerId]){
      const own=Object.values(units).find(unit=>unit?.controlled==='player'||canonicalPlayerId(unit)===s.playerId),plans=planRowsToArray(data.plans[s.playerId],own);combat.setPlans?.(plans,true);
    }
    for(const ownerRows of Object.values(data.plans||{})){
      const sample=Object.values(ownerRows||{})[0];if(!sample)continue;const unit=sample.unitId&&units[sample.unitId]?units[sample.unitId]:Object.values(units).find(row=>canonicalPlayerId(row)===clean(sample.scheduledBy));
      if(!unit||unit.controlled!=='remote')continue;unit.autoPlans=planRowsToArray(ownerRows,unit);
    }
    for(const [unitId,rows] of Object.entries(data.aiPlans||{})){const unit=units[unitId];if(!unit||unit.controlled!=='ai')continue;unit.autoPlans=planRowsToArray(rows,unit);}
    combat.render?.();global.LuminousWebGL2Renderer?.requestRender?.(80);return true;
  }
  function applySnapshot(snapshot={}){
    const combat=runtime(),units=combat?.combatants?.()||{};let changed=false;
    for(const [id,canonical] of Object.entries(snapshot||{})){const unit=units[id];if(!unit)continue;for(const [key,value] of Object.entries(canonical||{})){if(key==='actionSlots'||key==='activeSlots')continue;if(JSON.stringify(unit[key])!==JSON.stringify(value)){unit[key]=clone(value);changed=true;}}
      const count=Math.max(1,Math.trunc(Number(canonical.actionSlots||canonical.activeSlots)||1));if(Number(unit.actionSlots)!==count){combat.setActionSlots?.(id,count);unit.actionSlots=count;unit.activeSlots=count;changed=true;}
    }
    if(changed){combat.render?.();global.LuminousWebGL2Renderer?.requestRender?.(120);}return changed;
  }
  function receiveCheckpoint(row){
    const seq=Math.max(0,Number(row?.seq)||0);if(!seq||seq<=state.lastCheckpointSeq)return;state.lastCheckpointSeq=seq;
    if(Number(row.round)!==Number(adapterState()?.round))return;
    const local=snapshotRuntime(),localDigest=checkpointDigest(local);if(row.digest&&localDigest===row.digest)return;
    if(Number.isFinite(Number(row.rngCursor)))resetRandom(state.current.seed,Number(row.rngCursor));applySnapshot(row.combatants||{});
    try{global.dispatchEvent(new CustomEvent('luminous:combat073-authority-correction',{detail:{round:row.round,seq,type:row.type||'checkpoint',expected:row.digest||'',actual:localDigest}}));}catch(_){}
  }
  function queueCheckpoint(type='state',extra={}){
    if(!isDm()||norm(state.current?.phase)!=='running')return false;
    const s=adapterState();if(!s?.db?.ref)return false;
    state.writeChain=state.writeChain.then(async()=>{const snapshot=snapshotRuntime(),seq=Math.max(Number(state.current?.checkpoint?.seq)||0,state.lastCheckpointSeq)+1,row={round:Number(s.round)||1,seq,type,rngCursor:state.cursor,digest:checkpointDigest(snapshot),combatants:snapshot,extra:clone(extra),updatedAt:serverTime()};state.lastCheckpointSeq=seq;state.current.checkpoint=row;await s.db.ref(`${ROOT.current}/checkpoint`).set(row);return row;}).catch(error=>console.error('[Combat073 Authority checkpoint]',error));return state.writeChain;
  }
  function wrapFunction(name,{async=false,type=name}={}){
    const original=global[name];if(typeof original!=='function'||original.__luminousAuthorityWrapped)return false;
    const wrapped=async?async function(...args){const result=await original.apply(this,args);queueCheckpoint(type);return result;}:function(...args){const result=original.apply(this,args);queueCheckpoint(type);return result;};
    wrapped.__luminousAuthorityWrapped=true;wrapped.__luminousAuthorityOriginal=original;global[name]=wrapped;state.hooks.set(name,original);return true;
  }
  function installHooks(){
    ['damageCombatant','healCombatant','damageCombatantSP','healCombatantSP','applyCombatStatus','removeCombatStatus','consumeStatusCount','setUnitActionSlotCount','rollTurnSpeeds'].forEach(name=>wrapFunction(name,{type:name}));
    ['resolveSkillClash','resolveUnopposedCoinAction','resolveSaveOnlySpell'].forEach(name=>wrapFunction(name,{async:true,type:name}));return true;
  }
  async function beforeStartRound(){
    const s=adapterState();if(!s?.db?.ref)return{allow:false};
    if(state.remoteStart){state.remoteStart=false;applyAuthority();return{allow:true,forceReady:true};}
    if(!isDm())return{allow:false,reason:'WAIT_FOR_DM_AUTHORITY'};
    let current=state.current;if(Number(current?.round)!==Number(s.round)||!['sealed','running'].includes(norm(current?.phase)))current=await sealRound();
    applyAuthority(current);resetRandom(current.seed,0);
    const update={...current,phase:'running',startedAt:serverTime(),checkpoint:null};await s.db.ref(ROOT.current).update({phase:'running',startedAt:update.startedAt,checkpoint:null});await s.db.ref(ROOT.state).set({phase:'COMBAT',round:Number(s.round)||1,authorityUid:s.uid,seed:current.seed,updatedAt:serverTime()});state.current={...current,phase:'running',checkpoint:null};state.lastCheckpointSeq=0;return{allow:true,forceReady:true};
  }
  function combatantFirebaseUpdates(snapshot){const updates={};for(const [id,row] of Object.entries(snapshot||{})){for(const [key,value] of Object.entries(row||{}))updates[`${ROOT.combatants}/${id}/${key}`]=value;updates[`${ROOT.combatants}/${id}/actionSlotIndex`]=Object.fromEntries(Array.from({length:Math.max(1,Number(row.actionSlots)||1)},(_,i)=>[String(i),true]));}return updates;}
  async function afterRound({completedRound,nextRound}={}){
    if(!isDm())return false;const s=adapterState();if(!s?.db?.ref)return false;const done=Math.max(1,Number(completedRound)||Math.max(1,(Number(s.round)||1)-1)),next=Math.max(done+1,Number(nextRound)||done+1),snapshot=snapshotRuntime(),row={round:done,seq:state.lastCheckpointSeq+1,type:'round_complete',rngCursor:state.cursor,digest:checkpointDigest(snapshot),combatants:snapshot,updatedAt:serverTime()};
    const updates=combatantFirebaseUpdates(snapshot);updates[`${ROOT.current}/phase`]='complete';updates[`${ROOT.current}/resultDigest`]=row.digest;updates[`${ROOT.current}/checkpoint`]=row;updates[ROOT.state]={phase:'PRE_COMBAT_PLANNING',round:next,authorityUid:s.uid,updatedAt:serverTime()};updates[ROOT.ready]=null;updates[ROOT.targets]=null;updates[`${ROOT.privatePlans}/${done}`]=null;
    await s.db.ref().update(updates);state.current={...state.current,phase:'complete',resultDigest:row.digest,checkpoint:row};state.lastCheckpointSeq=row.seq;return row;
  }
  function onAuthority(snapshot){
    const data=snapshot.val()||{};state.current=data;if(data.seed&&Number(data.round)===Number(adapterState()?.round))resetRandom(data.seed,Number(data.checkpoint?.rngCursor)||0);applyAuthority(data);if(data.checkpoint)receiveCheckpoint(data.checkpoint);
    if(isPlayer()&&norm(data.phase)==='running'&&Number(data.round)===Number(adapterState()?.round)&&state.autoStartedRound!==Number(data.round)){
      state.autoStartedRound=Number(data.round);state.remoteStart=true;global.setTimeout(()=>runtime()?.startRound?.(),90);
    }
  }
  function bind(){const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.ref)return true;state.ref=s.db.ref(ROOT.current);state.handler=onAuthority;state.ref.on('value',state.handler,error=>console.error('[Combat073 Authority]',error));return true;}
  function start(){if(state.started)return true;state.started=true;installHooks();const attempt=()=>{installHooks();if(bind())return true;state.retryTimer=global.setTimeout(attempt,200);return false;};attempt();return true;}
  function stop(){if(state.retryTimer)global.clearTimeout(state.retryTimer);if(state.ref&&state.handler)state.ref.off('value',state.handler);state.ref=state.handler=null;state.started=false;}
  global.addEventListener('luminous:combat073-runtime-ready',()=>{installHooks();applyAuthority();});global.addEventListener('luminous:combat073-hydrated',()=>{installHooks();applyAuthority();});global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatAuthority073=Object.freeze({version:'0.7.3-authority.1',ROOT,state,start,stop,isDm,isPlayer,random,resetRandom,snapshotRuntime,digest,checkpointDigest,queueCheckpoint,sealRound,applyAuthority,applySnapshot,beforeStartRound,afterRound,installHooks,serializeRuntimePlan});
  start();
})(window);
