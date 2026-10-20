(function(global){
  'use strict';
  if(global.LuminousCombatRemoteIntents073)return;

  const READY_ROOT='campaña/combate/readyPlayers';
  const PLANS_ROOT='campaña/combate/plannedActions',AI_ROOT='campaña/combate/planningAi';
  const AUTH_ROOT='campaña/combate/authority/current';
  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const state={started:false,readyRef:null,readyHandler:null,authRef:null,authHandler:null,rawTargets:{},ready:{},plans:{},planningAi:{},authority:{},extraSubs:[],publishingAi:false,restoreOwn:false,readyLoaded:false,plansLoaded:false,aiTimer:null,aiAttempts:0,retryTimer:null,renderTimer:null};
  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function combatantForPersistedPlan(raw={}){
    const data=runtime()?.combatants?.()||{},explicit=clean(raw.unitId);if(explicit&&data[explicit])return data[explicit];
    const playerId=clean(raw.scheduledBy);if(!playerId)return null;
    return Object.values(data).find(unit=>clean(unit?.canonicalPlayerKey||unit?.ownerPlayerId||unit?.playerId||unit?.characterLink?.playerId)===playerId)||null;
  }
  function inferTargetSide(unit,raw={}){const explicit=clean(raw.targetSide);if(explicit)return explicit;const target=runtime()?.combatants?.()?.[clean(raw.targetId)];if(!unit||!target)return'';return unit.faction===target.faction?'ally':'enemy';}
  function commonPlan(raw={},slotIndex=0){return{...Object.fromEntries(['drawId','clashChoice','clashOrder','clashConfirmed'].filter(key=>raw[key]!=null).map(key=>[key,clone(raw[key])])),sourceSlotIndex:Number.isInteger(Number(raw.sourceSlotIndex))?Number(raw.sourceSlotIndex):slotIndex,targetId:clean(raw.targetId)||null,targetSlotIndex:raw.targetSlotIndex==null?null:Math.max(0,Number(raw.targetSlotIndex)||0),additionalTargets:Array.isArray(raw.additionalTargets)?clone(raw.additionalTargets):[]};}
  function intentPlan(raw={},slotIndex=0,unit=null){const targetSide=inferTargetSide(unit,raw);return{...commonPlan(raw,slotIndex),type:'intent',data:{kind:'target_intent',id:'target_intent',name:'TARGET',targetSide}};}
  function runtimePlan(raw={},slotIndex=0,unit=null){
    const kind=norm(raw.kind||'skill'),common=commonPlan(raw,slotIndex),targetSide=inferTargetSide(unit,raw),skills=adapterState()?.skills||{},embedded=clone(raw.actionData||{});
    if(kind==='skill'||kind==='defense'){
      const skillId=clean(raw.skillId),source=Object.keys(embedded).length?embedded:(skillId&&skills[skillId]?adapter()?.normalizeSkill?.(skillId,skills[skillId]):null);
      const data={...(source||{}),kind,skillId,id:skillId||clean(source?.id||raw.actionName),name:clean(raw.actionName||source?.name||skillId)};if(targetSide)data.targetSide=targetSide;return{...common,type:kind==='defense'?'defense':raw.planType==='deck'||raw.drawId?'deck':raw.planType==='auto'?'auto':'granted',data};
    }
    if(kind==='spell'){
      const spellId=clean(raw.spellId),data={...embedded,kind:'spell',spellId,id:spellId||clean(embedded.id),name:clean(raw.actionName||embedded.name||spellId),targetSide:targetSide||embedded.targetSide||'enemy',slotLevel:Number(raw.slotLevel??embedded.slotLevel)||0,overcast:Boolean(raw.overcast??embedded.overcast)};return{...common,type:'spells',data};
    }
    if(kind==='item'){
      const itemId=clean(raw.itemId),itemType=clean(raw.itemType||embedded.itemType||embedded.item_type)||(targetSide==='ally'?'hp_healing':'offensive'),data={...embedded,kind:'item',itemId,id:itemId||clean(embedded.id),name:clean(raw.actionName||embedded.name||itemId),itemType,targetSide:targetSide||embedded.targetSide};return{...common,type:'items',data};
    }
    if(kind==='global'){
      const actionKey=clean(raw.actionKey),data={...embedded,kind:'global',actionKey,id:actionKey||clean(embedded.id),name:clean(raw.actionName||embedded.name||actionKey),targetSide:targetSide||embedded.targetSide};return{...common,type:'global',data};
    }
    if(kind==='trait'){
      const traitId=clean(raw.traitId),data={...embedded,kind:'trait',traitId,id:traitId||clean(embedded.id),name:clean(raw.actionName||embedded.name||traitId),targetSide:targetSide||embedded.targetSide};return{...common,type:'traits',data};
    }
    return{...common,type:'auto',data:{...embedded,kind,id:clean(embedded.id||raw.actionName||raw.skillId||raw.itemId||raw.actionKey),targetSide:targetSide||embedded.targetSide}};
  }
  function rowsFromReady(ready={}){
    const out={};
    for(const [owner,row] of Object.entries(ready||{})){
      const targets=row?.targetIntents;if(!targets||typeof targets!=='object')continue;
      out[owner]={};
      for(const [slot,target] of Object.entries(targets))if(target&&typeof target==='object')out[owner][slot]={...clone(target),scheduledBy:clean(target.scheduledBy||owner),unitId:clean(target.unitId||row.unitId),round:Number(target.round||row.round)||0};
    }
    return out;
  }
  function canRenderNow() {
    const combat=runtime(),s=adapterState();
    if (!combat?.render || !s?.hydratedOnce) return false;
    const focusId=clean(combat.playerId?.()||"");
    if (!focusId || !global.document?.getElementById) return true;
    return Boolean(global.document.getElementById(`sprite-${focusId}`));
  }
  function scheduleRender(){
    if(state.renderTimer)return true;
    state.renderTimer=global.setTimeout(()=>{
      state.renderTimer=null;
      const combat=runtime();
      if(!canRenderNow())return;
      combat.render?.();
      renderPlanLabels();
      global.LuminousWebGL2Renderer?.requestRender?.(80);
    },0);
    return true;
  }
  function applyRows(rows,fullPlans){
    const combat=runtime(),s=adapterState();if(!combat?.combatants||!s)return false;const data=combat.combatants();
    Object.values(data).forEach(unit=>{if(unit?.controlled==='remote')unit.autoPlans=[];});
    for(const ownerRows of Object.values(rows||{})){
      if(!ownerRows||typeof ownerRows!=='object')continue;
      for(const [slotKey,raw] of Object.entries(ownerRows)){
        if(!raw||typeof raw!=='object'||Number(raw.round)&&Number(raw.round)!==Number(s.round))continue;
        const unit=combatantForPersistedPlan(raw);if(!unit||unit.controlled!=='remote')continue;
        const slotIndex=Math.max(0,Number(raw.sourceSlotIndex??slotKey)||0);unit.autoPlans=Array.isArray(unit.autoPlans)?unit.autoPlans:[];unit.autoPlans[slotIndex]=fullPlans?runtimePlan(raw,slotIndex,unit):intentPlan(raw,slotIndex,unit);
      }
    }
    scheduleRender();return true;
  }
  function aiSignature(){
    const s=adapterState();
    return JSON.stringify([s?.encounterId||'',Number(s?.round)||1,Object.values(runtime()?.combatants?.()||{})
      .filter(unit=>unit.controlled==='ai').map(unit=>[unit.id,unit.actionSlots,runtime()?.kit?.(unit.id)?.actions||[]])]);
  }
  function applyPlanningAi(){
    const s=adapterState();if(!s||state.planningAi.signature!==aiSignature())return false;
    for(const [id,rows]of Object.entries(state.planningAi.plans||{})){
      const unit=runtime()?.combatants?.()?.[id];if(unit?.controlled!=='ai')continue;
      unit.autoPlans=[];
      for(const [index,raw]of Object.entries(rows||{}))unit.autoPlans[Number(index)]=runtimePlan(raw,Number(index),unit);
    }
    return true;
  }
  function retryPlanningAi(){
    if(state.aiTimer||++state.aiAttempts>120)return;
    state.aiTimer=global.setTimeout(()=>{state.aiTimer=null;publishPlanningAi();},250);
  }
  async function publishPlanningAi(){
    const s=adapterState(),authority=state.authority;
    if(s?.role!=='dm'||!s.hydratedOnce||state.publishingAi||!['planning','pre_combat_planning'].includes(norm(s.combatState))||
       (Number(authority?.round)===Number(s.round)&&['sealed','running'].includes(norm(authority?.phase))))return false;
    if(applyPlanningAi())return true;
    // Wait until the authored skills are loaded; do not publish placeholder kits.
    const bridge=global.LuminousCombatLiveAdapter073;
    for(const unit of Object.values(s.combatants||{}))if(bridge?.skillIdsFor?.(unit).some(id=>!s.skills?.[id])){retryPlanningAi();return false;}
    const serialize=global.LuminousCombatAuthority073?.serializeRuntimePlan;if(!serialize){retryPlanningAi();return false;}
    const plans={};
    for(const unit of Object.values(runtime()?.combatants?.()||{}))if(unit.controlled==='ai'){
      plans[unit.id]={};(unit.autoPlans||[]).forEach((plan,index)=>{if(plan)plans[unit.id][index]=serialize(plan,unit.id,index);});
    }
    const row={round:Number(s.round)||1,signature:aiSignature(),plans};state.publishingAi=true;
    try{await s.db.ref(AI_ROOT).set(row);state.planningAi=row;apply();return true;}
    catch(error){console.error('[Combat073 Planning AI]',error);return false;}
    finally{state.publishingAi=false;}
  }
  function renderPlanLabels(){
    const s=adapterState(),doc=global.document,combat=runtime();if(!doc?.createElement||!combat)return;
    for(const unit of Object.values(combat.combatants?.()||{})){
      const own=unit.controlled==='player',owner=global.LuminousCombatLiveAdapter073?.canonicalPlayerId?.(unit);
      const ready=own?combat.uiState?.().ready:state.ready?.[owner]?.ready===true&&Number(state.ready[owner].round)===Number(s?.round);
      const known=s?.role==='dm'||(unit.controlled==='ai'&&global.observationKnown?.(unit,'action'))||ready;
      for(const [index,slot]of [...(global.unitSlots?.(unit.id)||[])].entries()){
        const plan=global.plannedActionAt?.(unit.id,index);
        const visible=known&&plan&&plan.type!=='intent'&&!combat.uiState?.().running;
        let label=slot.querySelector('.slot-intent-label');
        if(!visible){label?.remove();if(slot.hasAttribute('data-public-plan')){slot.removeAttribute('aria-label');slot.removeAttribute('title');}slot.removeAttribute('data-public-plan');continue;}
        if(!label){label=doc.createElement('span');label.className='slot-intent-label';slot.appendChild(label);}
        const target=combat.combatants?.()?.[plan.targetId];
        const clash=plan.clashConfirmed===true&&global.isClashIntent?.(unit.id,index,plan);
        const text=`${ready?'✓ ':''}${plan.data?.name||'Acción'}${target?` · ${clash?'CLASH ↔':'→'} ${target.name} (${Number(plan.targetSlotIndex)+1})`:''}`;
        if(label.textContent!==text)label.textContent=text;
        slot.dataset.publicPlan='true';label.style.setProperty('--intent-row',index);
        slot.setAttribute('aria-label',text);slot.setAttribute('title',text);
      }
    }
  }
  function restoreOwnPlanning(){
    const s=adapterState();if(!state.restoreOwn||s?.role!=='player'||!state.readyLoaded||!state.plansLoaded)return;
    state.restoreOwn=false;
    const row=state.ready[s.playerId];if(row?.ready!==true||Number(row.round)!==Number(s.round))return;
    const unit=Object.values(runtime()?.combatants?.()||{}).find(unit=>unit.controlled==='player'),plans=[];
    for(const [index,raw]of Object.entries(state.plans[s.playerId]||{}))if(Number(raw.round)===Number(s.round))plans[Number(index)]=runtimePlan(raw,Number(index),unit);
    runtime()?.restorePlanning?.(plans,true);
  }
  function apply(){
    const s=adapterState(),phase=norm(state.authority?.phase),round=Number(state.authority?.round)||0,full=round===Number(s?.round)&&['sealed','running'].includes(phase);
    if(full)return applyRows(state.authority?.plans||{},true);
    restoreOwnPlanning();
    applyPlanningAi();
    applyRows(state.rawTargets,false);
    const committed={};
    for(const [owner,row]of Object.entries(state.ready))if(row?.ready===true&&Number(row.round)===Number(s?.round))committed[owner]=state.plans[owner]||{};
    // Targets remain a preview until the owner explicitly marks READY.
    for(const rows of Object.values(committed))for(const [index,raw]of Object.entries(rows)){
      const unit=combatantForPersistedPlan(raw);if(unit?.controlled!=='remote'||Number(raw.round)!==Number(s?.round))continue;
      unit.autoPlans[Number(raw.sourceSlotIndex??index)]=runtimePlan(raw,Number(index),unit);
    }
    scheduleRender();return true;
  }
  function bind(){
    const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.readyRef||state.authRef)return true;
    state.readyRef=s.db.ref(READY_ROOT);state.readyHandler=snapshot=>{state.ready=snapshot.val()||{};state.readyLoaded=true;state.rawTargets=rowsFromReady(state.ready);apply();};state.readyRef.on('value',state.readyHandler,error=>console.error('[Combat073 TargetIntents]',error));
    state.authRef=s.db.ref(AUTH_ROOT);state.authHandler=snapshot=>{state.authority=snapshot.val()||{};apply();};state.authRef.on('value',state.authHandler,error=>console.error('[Combat073 AuthorityPlans]',error));
    for(const [path,key]of [[PLANS_ROOT,'plans'],[AI_ROOT,'planningAi']]){
      const ref=s.db.ref(path),handler=snapshot=>{state[key]=snapshot.val()||{};if(key==='plans')state.plansLoaded=true;apply();};
      ref.on('value',handler,error=>console.error('[Combat073 Shared plans]',error));state.extraSubs.push(()=>ref.off('value',handler));
    }
    return true;
  }
  function onHydrated(){state.aiAttempts=0;state.restoreOwn=true;apply();publishPlanningAi();}
  function start(){if(state.started)return true;state.started=true;const attempt=()=>{if(bind())return true;state.retryTimer=global.setTimeout(attempt,250);return false;};attempt();return true;}
  function stop(){if(state.aiTimer)global.clearTimeout(state.aiTimer);state.aiTimer=null;state.extraSubs.splice(0).forEach(off=>off());if(state.retryTimer)global.clearTimeout(state.retryTimer);if(state.renderTimer)global.clearTimeout(state.renderTimer);state.retryTimer=state.renderTimer=null;if(state.readyRef&&state.readyHandler)state.readyRef.off('value',state.readyHandler);if(state.authRef&&state.authHandler)state.authRef.off('value',state.authHandler);state.readyRef=state.readyHandler=state.authRef=state.authHandler=null;state.started=false;}
  global.addEventListener('luminous:combat073-hydrated',onHydrated);global.addEventListener('luminous:combat073-runtime-ready',apply);global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatRemoteIntents073=Object.freeze({version:'0.7.3-remote-intents.5-ready-plans',READY_ROOT,AUTH_ROOT,state,start,stop,bind,apply,applyRows,canRenderNow,scheduleRender,rowsFromReady,runtimePlan,intentPlan,inferTargetSide,publishPlanningAi,applyPlanningAi,renderPlanLabels});
  global.addEventListener('luminous:combat073-plan-ready-change',scheduleRender);
  start();
})(window);
