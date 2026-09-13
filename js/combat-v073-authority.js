(function(global){
  'use strict';
  if(global.LuminousCombatAuthority073)return;

  const ROOT=Object.freeze({
    current:'campaña/combate/authority/current',
    state:'campaña/combate/estado',
    combatants:'campaña/combate/combatants',
    ready:'campaña/combate/readyPlayers',
    targets:'campaña/combate/targetIntents',
    privatePlans:'combat_private/plans',
    acks:'campaña/combate/authorityAcks'
  });
  const nativeRandom=global.Math.random.bind(global.Math);
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[\s-]+/g,'_');
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const state={
    started:false,current:{},seed:0,cursor:0,rngState:0,
    authorityRef:null,authorityHandler:null,readyRef:null,readyHandler:null,
    retryTimer:null,autoStartTimer:null,checkpointTimer:null,pendingCheckpointType:'',
    lastCheckpointSeq:0,writeChain:Promise.resolve(),hooks:new Map(),localActionSeq:0,localDigests:new Map(),pendingRemoteCheckpoints:new Map(),actionInProgress:false,
    originalStartRound:null,originalBuildQueue:null,originalCoinEngine:null,
    runningLocal:false,remoteStart:false,autoStartedRound:0
  };

  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function isDm(){return adapterState()?.role==='dm';}
  function isPlayer(){return adapterState()?.role==='player';}
  function serverTime(){return global.firebase?.database?.ServerValue?.TIMESTAMP||Date.now();}
  function setStatus(text){try{const node=global.document?.getElementById?.('status');if(node)node.textContent=text;}catch(_){}}

  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      const out={};Object.keys(value).sort().forEach(key=>{if(value[key]!==undefined)out[key]=stable(value[key]);});return out;
    }
    return value;
  }
  function digest(value){
    const text=JSON.stringify(stable(value));let h=2166136261;
    for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return(h>>>0).toString(16).padStart(8,'0');
  }
  function makeSeed(round){
    const array=new Uint32Array(1);try{global.crypto?.getRandomValues?.(array);}catch(_){}
    return(array[0]||((Date.now()^Math.floor(nativeRandom()*0xffffffff))>>>0)^((Number(round)||1)*2654435761))>>>0;
  }
  function randomRaw(){
    state.rngState=(state.rngState+0x6D2B79F5)>>>0;let t=state.rngState;
    t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
    const value=((t^(t>>>14))>>>0)/4294967296;state.cursor+=1;return value;
  }
  function resetRandom(seed,cursor=0){
    state.seed=(Number(seed)||1)>>>0;state.rngState=state.seed;state.cursor=0;
    for(let i=0;i<Math.max(0,Math.trunc(Number(cursor)||0));i+=1)randomRaw();
    return state.seed;
  }
  function random(){
    const phase=norm(state.current?.phase);
    return state.seed&&['sealed','running'].includes(phase)?randomRaw():nativeRandom();
  }
  function withAuthorityRandom(callback){
    if(!state.seed||!['sealed','running'].includes(norm(state.current?.phase)))return callback();
    const previous=global.Math.random;global.Math.random=random;
    try{return callback();}finally{global.Math.random=previous;}
  }

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
      escaped:unit.escaped===true,damageTakenThisRound:Math.max(0,finite(unit.damageTakenThisRound,0)),
      quickActionRemaining:finite(unit.quickActionRemaining,unit.quickActionsRemaining??1),reactionRemaining:finite(unit.reactionRemaining,unit.reactionsRemaining??1)
    };
  }
  function snapshotRuntime(){
    const out={};Object.entries(runtime()?.combatants?.()||{}).forEach(([id,unit])=>{out[id]=compactUnit(unit||{});});return out;
  }
  function checkpointDigest(snapshot=snapshotRuntime(),round=state.current?.round||adapterState()?.round||0){return digest({round:Number(round)||0,cursor:state.cursor,combatants:snapshot});}

  function serializeRuntimePlan(plan={},unitId,slotIndex=0){
    const bridge=global.LuminousCombatPlanSync073,kind=bridge?.kindOf?.(plan)||'skill',data=clone(plan.data||{});let id='';
    if(kind==='spell')id=clean(data.spellId||data.id||data.key);
    else if(kind==='trait')id=clean(data.traitId||data.id||data.key);
    else if(kind==='item')id=clean(data.itemId||data.id||data.key||data.name);
    else if(kind==='global')id=clean(data.actionKey||data.id||data.key||data.name);
    else id=clean(data.skillId||data.id||data.key||data.name);
    const out={
      schemaVersion:3,engineVersion:'0.7.3-live-authority',kind,unitId,scheduledBy:canonicalPlayerId(runtime()?.combatants?.()?.[unitId]||{})||unitId,
      schedulerUid:adapterState()?.uid||'',status:'authority_public',round:Number(adapterState()?.round)||1,
      sourceSlotIndex:Number.isInteger(plan.sourceSlotIndex)?plan.sourceSlotIndex:slotIndex,targetId:clean(plan.targetId)||null,
      targetSlotIndex:plan.targetSlotIndex==null?null:Math.max(0,Number(plan.targetSlotIndex)||0),actionData:data
    };
    const targetSide=clean(data.targetSide||data.targetRule||plan.targetSide||plan.targetRule);if(targetSide)out.targetSide=targetSide;
    if(Array.isArray(plan.additionalTargets)&&plan.additionalTargets.length)out.additionalTargets=clone(plan.additionalTargets);
    out.actionName=clean(data.name||data.nombre||data.label||id);
    if(kind==='spell'){out.spellId=id;out.spellSelectionKey=clean(data.spellSelectionKey||data.selectionKey||id);out.classId=clean(data.classId||data.class||'unknown');out.slotLevel=Math.max(0,Math.min(9,Math.trunc(finite(data.slotLevel??data.level,0))));out.overcast=Boolean(data.overcast);}
    else if(kind==='trait')out.traitId=id;
    else if(kind==='item'){out.itemId=id;const itemType=clean(data.itemType||data.item_type||data.type);if(itemType)out.itemType=itemType;}
    else if(kind==='global')out.actionKey=id;
    else out.skillId=id;
    return out;
  }
  function collectAiPlans(){
    const out={};
    Object.entries(runtime()?.combatants?.()||{}).forEach(([id,unit])=>{
      if(unit?.controlled!=='ai'||!Array.isArray(unit.autoPlans))return;
      const rows={};unit.autoPlans.forEach((plan,index)=>{if(plan)rows[index]=serializeRuntimePlan(plan,id,index);});if(Object.keys(rows).length)out[id]=rows;
    });
    return out;
  }
  function activePlayerIds(){
    return [...new Set(Object.values(adapterState()?.combatants||{}).filter(unit=>unit?.isPlayer===true&&unit.battleActive!==false&&!unit.isBackup).map(canonicalPlayerId).filter(Boolean))];
  }
  async function read(path){
    const s=adapterState();if(!s?.db?.ref)throw new Error('COMBAT_DB_UNAVAILABLE');const snap=await s.db.ref(path).once('value');return snap.val();
  }
  function readyComplete(ready,plans,round){
    const missing=[];
    activePlayerIds().forEach(playerId=>{
      const row=ready?.[playerId],rows=plans?.[playerId]||{},planned=Math.max(0,Math.trunc(Number(row?.plannedSlots)||0));
      if(!row?.ready||Number(row.round)!==Number(round))missing.push(`${playerId}:READY`);
      else if(Object.keys(rows).filter(key=>rows[key]).length<planned)missing.push(`${playerId}:PLAN`);
    });
    return{complete:missing.length===0,missing};
  }
  async function sealRound(){
    const s=adapterState();if(!s?.db?.ref||!isDm())throw new Error('DM_AUTHORITY_REQUIRED');const round=Math.max(1,Math.trunc(Number(s.round)||1));
    const [ready,plans]=await Promise.all([read(ROOT.ready),read(`${ROOT.privatePlans}/${round}`)]),check=readyComplete(ready||{},plans||{},round);
    if(!check.complete)throw new Error(`ROUND_NOT_READY:${check.missing.join(',')}`);
    const seed=makeSeed(round),payload={schemaVersion:1,engineVersion:'0.7.3-authority.2',round,phase:'sealed',seed,authorityUid:s.uid,plans:clone(plans||{}),aiPlans:collectAiPlans(),createdAt:serverTime(),checkpoint:null};
    const updates={};updates[ROOT.current]=payload;updates[ROOT.state]={phase:'COMBAT_SEALED',round,authorityUid:s.uid,seed,updatedAt:serverTime()};
    await s.db.ref().update(updates);state.current={...payload,createdAt:Date.now()};resetRandom(seed,0);applyAuthority(payload);return payload;
  }

  function planRowsToArray(rows,unit){
    const converter=global.LuminousCombatRemoteIntents073?.runtimePlan;if(!converter)return[];const plans=[];
    Object.entries(rows||{}).forEach(([slot,raw])=>{const index=Math.max(0,Number(raw?.sourceSlotIndex??slot)||0);plans[index]=converter(raw,index,unit);});return plans;
  }
  function replaceLocalPlans(plans){
    const list=runtime()?.plans?.();if(!Array.isArray(list))return false;list.splice(0,list.length,...plans);global.renderAllPlannedSlots?.();return true;
  }
  function applyAuthority(data=state.current){
    const s=adapterState(),combat=runtime();if(!combat?.combatants||!s||Number(data?.round)!==Number(s.round))return false;
    const units=combat.combatants();
    if(s.role==='player'&&s.playerId&&data.plans?.[s.playerId]){
      const own=Object.values(units).find(unit=>unit?.controlled==='player'||canonicalPlayerId(unit)===s.playerId);replaceLocalPlans(planRowsToArray(data.plans[s.playerId],own));
    }else if(s.role==='dm')replaceLocalPlans([]);
    for(const ownerRows of Object.values(data.plans||{})){
      const sample=Object.values(ownerRows||{})[0];if(!sample)continue;
      const unit=sample.unitId&&units[sample.unitId]?units[sample.unitId]:Object.values(units).find(row=>canonicalPlayerId(row)===clean(sample.scheduledBy));
      if(!unit||unit.controlled!=='remote')continue;unit.autoPlans=planRowsToArray(ownerRows,unit);
    }
    for(const [unitId,rows] of Object.entries(data.aiPlans||{})){const unit=units[unitId];if(unit?.controlled==='ai')unit.autoPlans=planRowsToArray(rows,unit);}
    combat.render?.();global.LuminousWebGL2Renderer?.requestRender?.(80);return true;
  }
  function applySnapshot(snapshot={}){
    const combat=runtime(),units=combat?.combatants?.()||{};let changed=false;
    for(const [id,canonical] of Object.entries(snapshot||{})){
      const unit=units[id];if(!unit)continue;
      for(const [key,value] of Object.entries(canonical||{})){
        if(key==='actionSlots'||key==='activeSlots')continue;
        if(JSON.stringify(unit[key])!==JSON.stringify(value)){unit[key]=clone(value);changed=true;}
      }
      const count=Math.max(1,Math.trunc(Number(canonical.actionSlots||canonical.activeSlots)||1));
      if(Number(unit.actionSlots)!==count){global.setUnitActionSlotCount?.(id,count);unit.actionSlots=count;unit.activeSlots=count;changed=true;}
    }
    if(changed){combat.render?.();global.LuminousWebGL2Renderer?.requestRender?.(120);}return changed;
  }
  function reconcileCheckpoint(seq){
    const row=state.pendingRemoteCheckpoints.get(seq);if(!row)return false;
    const localDigest=state.localDigests.get(seq);if(!localDigest)return false;
    state.pendingRemoteCheckpoints.delete(seq);state.lastCheckpointSeq=Math.max(state.lastCheckpointSeq,seq);
    if(row.digest===localDigest)return true;
    console.warn('[Combat073 Authority] deterministic mismatch',{round:row.round,seq,expected:row.digest,actual:localDigest});
    if(seq===state.localActionSeq&&!state.actionInProgress){
      if(Number.isFinite(Number(row.rngCursor)))resetRandom(state.current.seed,Number(row.rngCursor));
      applySnapshot(row.combatants||{});
      state.localDigests.set(seq,row.digest||checkpointDigest(row.combatants||{},row.round));
      try{global.dispatchEvent(new CustomEvent('luminous:combat073-authority-correction',{detail:{round:row.round,seq,type:row.type||'action',expected:row.digest||'',actual:localDigest}}));}catch(_){}
    }
    return false;
  }
  function receiveCheckpoint(row){
    const seq=Math.max(0,Number(row?.seq)||0);if(!seq||Number(row.round)!==Number(adapterState()?.round)||isDm())return;
    state.pendingRemoteCheckpoints.set(seq,clone(row));reconcileCheckpoint(seq);
  }
  function publishActionCheckpoint(type='action'){
    if(!isDm()||norm(state.current?.phase)!=='running')return false;const s=adapterState();if(!s?.db?.ref)return false;
    const seq=state.localActionSeq,snapshot=snapshotRuntime(),row={round:Number(state.current.round)||Number(s.round)||1,seq,type,rngCursor:state.cursor,digest:checkpointDigest(snapshot,state.current.round),combatants:snapshot,updatedAt:serverTime()};
    state.lastCheckpointSeq=Math.max(state.lastCheckpointSeq,seq);state.current.checkpoint=row;
    state.writeChain=state.writeChain.then(()=>s.db.ref(`${ROOT.current}/checkpoint`).set(row)).catch(error=>console.error('[Combat073 Authority checkpoint]',error));return row;
  }
  function queueCheckpoint(type='state'){return publishActionCheckpoint(type);}

  function wrapSyncMechanic(name,{checkpoint=true,deterministic=true}={}){
    const original=global[name];if(typeof original!=='function'||original.__luminousAuthorityWrapped)return false;
    const wrapped=function(...args){const result=deterministic?withAuthorityRandom(()=>original.apply(this,args)):original.apply(this,args);if(checkpoint)queueCheckpoint(name);return result;};
    wrapped.__luminousAuthorityWrapped=true;wrapped.__luminousAuthorityOriginal=original;global[name]=wrapped;state.hooks.set(name,original);
    if(global.LuminousCombatHUD?.[name]===original)global.LuminousCombatHUD[name]=wrapped;return true;
  }
  function wrapAsyncMechanic(name,{checkpoint=true}={}){
    const original=global[name];if(typeof original!=='function'||original.__luminousAuthorityWrapped)return false;
    const wrapped=async function(...args){const result=await original.apply(this,args);if(checkpoint)queueCheckpoint(name);return result;};
    wrapped.__luminousAuthorityWrapped=true;wrapped.__luminousAuthorityOriginal=original;global[name]=wrapped;state.hooks.set(name,original);return true;
  }
  function patchCoinEngine(){
    const engine=global.LuminousCoinEngine;if(!engine?.runAnimatedRoll)return false;if(engine.__luminousAuthorityCoinEngine)return true;
    state.originalCoinEngine=state.originalCoinEngine||engine;
    const wrapped=Object.freeze({...engine,__luminousAuthorityCoinEngine:true,
      rollSide:(headsChance,rng)=>engine.rollSide(headsChance,rng||random),
      runAnimatedRoll:options=>engine.runAnimatedRoll({...options,rng:options?.rng||random})
    });
    global.LuminousCoinEngine=wrapped;return true;
  }
  function patchExecutionQueue(){
    const original=global.buildExecutionQueue;if(typeof original!=='function')return false;if(original.__luminousAuthorityQueue)return true;
    state.originalBuildQueue=state.originalBuildQueue||original;
    const wrapped=function(){
      const queue=original(),data=runtime()?.combatants?.()||{},existing=new Set(queue.map(entry=>`${entry.ownerId}:${entry.localIndex}`));
      Object.values(data).forEach(unit=>{
        if(unit?.controlled!=='remote'||!Array.isArray(unit.autoPlans))return;
        const slots=global.unitSlots?.(unit.id)||[];
        unit.autoPlans.forEach((plan,index)=>{
          if(!plan||existing.has(`${unit.id}:${index}`))return;
          queue.push({ownerId:unit.id,ownerName:unit.name,slot:slots[index]||null,localIndex:index,worldX:Number(unit.x)||0,plan,controller:'remote'});
        });
      });
      queue.forEach(entry=>{const unit=data[entry.ownerId];entry.speed=Number(unit?.speed)||0;entry.tieSeed=Number(unit?.speedTie)||0;});
      queue.sort((a,b)=>{const speedDelta=b.speed-a.speed;if(speedDelta)return speedDelta;if(a.ownerId===b.ownerId)return a.localIndex-b.localIndex;return a.tieSeed-b.tieSeed;});return queue;
    };
    wrapped.__luminousAuthorityQueue=true;wrapped.__luminousAuthorityOriginal=original;global.buildExecutionQueue=wrapped;return true;
  }
  function patchExecuteQueueEntry(){
    const original=global.executeQueueEntry;if(typeof original!=='function')return false;if(original.__luminousAuthorityQueueEntry)return true;
    const wrapped=async function(entry,...rest){
      const adjusted=entry?.controller==='remote'&&entry?.plan?.type==='items'?{...entry,controller:'player'}:entry;
      state.actionInProgress=true;
      try{return await original.call(this,adjusted,...rest);}
      finally{
        state.actionInProgress=false;state.localActionSeq+=1;
        const snapshot=snapshotRuntime(),localDigest=checkpointDigest(snapshot,state.current.round);state.localDigests.set(state.localActionSeq,localDigest);
        if(isDm())publishActionCheckpoint(`queue_entry:${adjusted?.ownerId||'unknown'}:${adjusted?.localIndex??0}`);
        else reconcileCheckpoint(state.localActionSeq);
      }
    };
    wrapped.__luminousAuthorityQueueEntry=true;wrapped.__luminousAuthorityOriginal=original;global.executeQueueEntry=wrapped;return true;
  }

  function installHooks(){
    patchCoinEngine();patchExecutionQueue();patchExecuteQueueEntry();
    ['processConditionTurnStart','rollCriticalHit','randomIntInclusive','rollUnitSpeed','rollPower4Save','rollAbilitySkillCheck','smartTargetScore','assignTargetIntents','autoActionScore','shuffle'].forEach(name=>wrapSyncMechanic(name,{checkpoint:false,deterministic:true}));
    ['damageCombatant','healCombatant','damageCombatantSP','healCombatantSP','applyCombatStatus','removeCombatStatus','consumeStatusCount','setUnitActionSlotCount','rollTurnSpeeds'].forEach(name=>wrapSyncMechanic(name,{checkpoint:false,deterministic:true}));
    ['resolveSkillClash','resolveUnopposedCoinAction','resolveSaveOnlySpell'].forEach(name=>wrapAsyncMechanic(name,{checkpoint:false}));
    patchStartRound();return true;
  }

  function armReady(){
    const button=global.document?.getElementById?.('ready');if(button?.getAttribute('aria-pressed')==='true')return true;
    if(typeof global.setPlanReady==='function'){global.setPlanReady();return button?.getAttribute('aria-pressed')==='true';}
    return false;
  }
  async function setRunning(current){
    const s=adapterState(),startedAt=serverTime(),updates={};updates[`${ROOT.current}/phase`]='running';updates[`${ROOT.current}/startedAt`]=startedAt;updates[ROOT.state]={phase:'COMBAT',round:Number(current.round)||Number(s.round)||1,authorityUid:s.uid,seed:current.seed,updatedAt:serverTime()};
    await s.db.ref().update(updates);state.current={...current,phase:'running',startedAt:Date.now(),checkpoint:null};state.lastCheckpointSeq=0;state.localActionSeq=0;state.localDigests.clear();state.pendingRemoteCheckpoints.clear();resetRandom(current.seed,0);return state.current;
  }
  function domRound(fallback){const node=global.document?.getElementById?.('round'),value=Math.trunc(Number(node?.textContent));return Number.isFinite(value)&&value>0?value:fallback;}
  async function writePlayerAck(round){
    const s=adapterState();if(!isPlayer()||!s?.playerId||!s.db?.ref)return false;
    await s.db.ref(`${ROOT.acks}/${round}/${s.playerId}`).set({round,playerId:s.playerId,uid:s.uid,digest:checkpointDigest(snapshotRuntime(),round),rngCursor:state.cursor,completedAt:serverTime()});return true;
  }
  async function waitForPlayerAcks(round,timeoutMs=5000){
    const s=adapterState(),ids=activePlayerIds();if(!isDm()||!s?.db?.ref||!ids.length)return true;
    const ref=s.db.ref(`${ROOT.acks}/${round}`),started=Date.now();
    return new Promise(resolve=>{
      let done=false,timer=null;
      const finish=value=>{if(done)return;done=true;if(timer)global.clearTimeout(timer);ref.off('value',handler);resolve(value);};
      const handler=snapshot=>{const rows=snapshot.val()||{};if(ids.every(id=>rows?.[id]?.round===round))finish(true);else if(Date.now()-started>=timeoutMs)finish(false);};
      ref.on('value',handler);timer=global.setTimeout(()=>finish(false),timeoutMs);
    });
  }
  async function requestStartRound(){
    if(state.runningLocal)return false;const s=adapterState(),original=state.originalStartRound;if(!s?.db?.ref||typeof original!=='function')return false;
    if(isPlayer()&&!state.remoteStart){setStatus('COMBAT · esperando resolución autoritativa del DM');return false;}
    state.runningLocal=true;
    try{
      let current=state.current;
      if(isDm()){
        if(Number(current?.round)!==Number(s.round)||!['sealed','running'].includes(norm(current?.phase)))current=await sealRound();
        if(norm(current.phase)!=='running')current=await setRunning(current);
      }else{
        state.remoteStart=false;if(Number(current?.round)!==Number(s.round)||norm(current?.phase)!=='running')return false;resetRandom(current.seed,Number(current?.checkpoint?.rngCursor)||0);
      }
      applyAuthority(current);armReady();
      const completedRound=Number(current.round)||Number(s.round)||1;
      await original();
      if(isPlayer())await writePlayerAck(completedRound).catch(error=>console.error('[Combat073 Authority ack]',error));
      if(isDm()){
        await state.writeChain;await waitForPlayerAcks(completedRound,5000);await afterRound({completedRound,nextRound:domRound(completedRound+1)});
      }
      return true;
    }catch(error){console.error('[Combat073 Authority start]',error);setStatus(`COMBAT AUTHORITY · ${error?.message||error}`);return false;}
    finally{state.runningLocal=false;}
  }
  function patchStartRound(){
    const hud=global.LuminousCombatHUD,original=state.originalStartRound||hud?.startRound||global.startRound;if(typeof original!=='function')return false;
    state.originalStartRound=original.__luminousAuthorityStartOriginal||original;
    requestStartRound.__luminousAuthorityStart=true;requestStartRound.__luminousAuthorityStartOriginal=state.originalStartRound;
    global.startRound=requestStartRound;if(hud)hud.startRound=requestStartRound;const button=global.document?.getElementById?.('start-round');if(button)button.onclick=requestStartRound;return true;
  }

  function combatantFirebaseUpdates(snapshot){
    const updates={};for(const [id,row] of Object.entries(snapshot||{})){for(const [key,value] of Object.entries(row||{}))updates[`${ROOT.combatants}/${id}/${key}`]=value;updates[`${ROOT.combatants}/${id}/actionSlotIndex`]=Object.fromEntries(Array.from({length:Math.max(1,Number(row.actionSlots)||1)},(_,i)=>[String(i),true]));}return updates;
  }
  async function afterRound({completedRound,nextRound}={}){
    if(!isDm())return false;const s=adapterState();if(!s?.db?.ref)return false;
    const done=Math.max(1,Number(completedRound)||Number(state.current.round)||1),next=Math.max(done+1,Number(nextRound)||done+1),snapshot=snapshotRuntime(),row={round:done,seq:state.lastCheckpointSeq+1,type:'round_complete',rngCursor:state.cursor,digest:checkpointDigest(snapshot,done),combatants:snapshot,updatedAt:serverTime()};
    const updates=combatantFirebaseUpdates(snapshot);updates[`${ROOT.current}/phase`]='complete';updates[`${ROOT.current}/resultDigest`]=row.digest;updates[`${ROOT.current}/checkpoint`]=row;updates[ROOT.state]={phase:'PRE_COMBAT_PLANNING',round:next,authorityUid:s.uid,updatedAt:serverTime()};updates[ROOT.ready]=null;updates[ROOT.targets]=null;updates[`${ROOT.privatePlans}/${done}`]=null;updates[`${ROOT.acks}/${done}`]=null;
    await s.db.ref().update(updates);state.current={...state.current,phase:'complete',resultDigest:row.digest,checkpoint:row};state.lastCheckpointSeq=row.seq;return row;
  }

  function allReadySnapshot(rows={}){
    const round=Number(adapterState()?.round)||1,ids=activePlayerIds();return ids.length>0&&ids.every(id=>rows?.[id]?.ready===true&&Number(rows[id].round)===round);
  }
  function maybeAutoStart(rows={}){
    if(!isDm()||state.runningLocal||!allReadySnapshot(rows))return false;
    const phase=norm(adapterState()?.combatState);if(!['pre_combat_planning','planning'].includes(phase))return false;
    if(state.autoStartTimer)return true;
    state.autoStartTimer=global.setTimeout(async()=>{state.autoStartTimer=null;const latest=await read(ROOT.ready).catch(()=>({}));if(!allReadySnapshot(latest||{}))return;await requestStartRound();},120);return true;
  }
  function onAuthority(snapshot){
    const data=snapshot.val()||{},previousSeed=state.current?.seed,previousRound=state.current?.round;state.current=data;
    if(data.seed&&Number(data.round)===Number(adapterState()?.round)&&(!state.runningLocal)&&(data.seed!==previousSeed||data.round!==previousRound))resetRandom(data.seed,0);
    applyAuthority(data);if(data.checkpoint)receiveCheckpoint(data.checkpoint);
    if(isPlayer()&&norm(data.phase)==='running'&&Number(data.round)===Number(adapterState()?.round)&&state.autoStartedRound!==Number(data.round)){
      state.autoStartedRound=Number(data.round);
      if(Number(data.checkpoint?.seq)>0){applySnapshot(data.checkpoint.combatants||{});resetRandom(data.seed,Number(data.checkpoint.rngCursor)||0);setStatus('COMBAT · sincronizado a combate en curso');}
      else{state.remoteStart=true;global.setTimeout(requestStartRound,80);}
    }
  }
  function bind(){
    const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.authorityRef)return true;
    state.authorityRef=s.db.ref(ROOT.current);state.authorityHandler=onAuthority;state.authorityRef.on('value',state.authorityHandler,error=>console.error('[Combat073 Authority]',error));
    state.readyRef=s.db.ref(ROOT.ready);state.readyHandler=snapshot=>maybeAutoStart(snapshot.val()||{});state.readyRef.on('value',state.readyHandler,error=>console.error('[Combat073 Authority ready]',error));return true;
  }
  function start(){
    if(state.started)return true;state.started=true;installHooks();
    const attempt=()=>{installHooks();if(bind())return true;state.retryTimer=global.setTimeout(attempt,200);return false;};attempt();return true;
  }
  function stop(){
    if(state.retryTimer)global.clearTimeout(state.retryTimer);if(state.autoStartTimer)global.clearTimeout(state.autoStartTimer);if(state.checkpointTimer)global.clearTimeout(state.checkpointTimer);
    if(state.authorityRef&&state.authorityHandler)state.authorityRef.off('value',state.authorityHandler);if(state.readyRef&&state.readyHandler)state.readyRef.off('value',state.readyHandler);
    state.authorityRef=state.authorityHandler=state.readyRef=state.readyHandler=null;state.started=false;
  }

  global.addEventListener('luminous:combat073-runtime-ready',()=>{installHooks();applyAuthority();});
  global.addEventListener('luminous:combat073-hydrated',()=>{installHooks();applyAuthority();});
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatAuthority073=Object.freeze({
    version:'0.7.3-authority.2',ROOT,state,start,stop,isDm,isPlayer,random,resetRandom,withAuthorityRandom,snapshotRuntime,digest,checkpointDigest,
    queueCheckpoint,sealRound,applyAuthority,applySnapshot,afterRound,installHooks,requestStartRound,serializeRuntimePlan,readyComplete,allReadySnapshot
  });
  start();
})(window);
