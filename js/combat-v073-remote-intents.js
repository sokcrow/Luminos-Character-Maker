(function(global){
  'use strict';
  if(global.LuminousCombatRemoteIntents073)return;

  const TARGET_ROOT='campaña/combate/targetIntents';
  const AUTH_ROOT='campaña/combate/authority/current';
  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const state={started:false,targetRef:null,targetHandler:null,authRef:null,authHandler:null,rawTargets:{},authority:{},retryTimer:null};
  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function combatantForPersistedPlan(raw={}){
    const data=runtime()?.combatants?.()||{},explicit=clean(raw.unitId);if(explicit&&data[explicit])return data[explicit];
    const playerId=clean(raw.scheduledBy);if(!playerId)return null;
    return Object.values(data).find(unit=>clean(unit?.canonicalPlayerKey||unit?.ownerPlayerId||unit?.playerId||unit?.characterLink?.playerId)===playerId)||null;
  }
  function inferTargetSide(unit,raw={}){const explicit=clean(raw.targetSide);if(explicit)return explicit;const target=runtime()?.combatants?.()?.[clean(raw.targetId)];if(!unit||!target)return'';return unit.faction===target.faction?'ally':'enemy';}
  function commonPlan(raw={},slotIndex=0){return{sourceSlotIndex:Number.isInteger(Number(raw.sourceSlotIndex))?Number(raw.sourceSlotIndex):slotIndex,targetId:clean(raw.targetId)||null,targetSlotIndex:raw.targetSlotIndex==null?null:Math.max(0,Number(raw.targetSlotIndex)||0),additionalTargets:Array.isArray(raw.additionalTargets)?clone(raw.additionalTargets):[]};}
  function intentPlan(raw={},slotIndex=0,unit=null){const targetSide=inferTargetSide(unit,raw);return{...commonPlan(raw,slotIndex),type:'intent',data:{kind:'target_intent',id:'target_intent',name:'TARGET',targetSide}};}
  function runtimePlan(raw={},slotIndex=0,unit=null){
    const kind=norm(raw.kind||'skill'),common=commonPlan(raw,slotIndex),targetSide=inferTargetSide(unit,raw),skills=adapterState()?.skills||{},embedded=clone(raw.actionData||{});
    if(kind==='skill'||kind==='defense'){
      const skillId=clean(raw.skillId),source=Object.keys(embedded).length?embedded:(skillId&&skills[skillId]?adapter()?.normalizeSkill?.(skillId,skills[skillId]):null);
      const data={...(source||{}),kind,skillId,id:skillId||clean(source?.id||raw.actionName),name:clean(raw.actionName||source?.name||skillId)};if(targetSide)data.targetSide=targetSide;return{...common,type:kind==='defense'?'defense':'deck',data};
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
    combat.render?.();global.LuminousWebGL2Renderer?.requestRender?.(80);return true;
  }
  function apply(){
    const s=adapterState(),phase=norm(state.authority?.phase),round=Number(state.authority?.round)||0,full=round===Number(s?.round)&&['sealed','running'].includes(phase);
    return applyRows(full?(state.authority?.plans||{}):state.rawTargets,full);
  }
  function bind(){
    const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.targetRef||state.authRef)return true;
    state.targetRef=s.db.ref(TARGET_ROOT);state.targetHandler=snapshot=>{state.rawTargets=snapshot.val()||{};apply();};state.targetRef.on('value',state.targetHandler,error=>console.error('[Combat073 TargetIntents]',error));
    state.authRef=s.db.ref(AUTH_ROOT);state.authHandler=snapshot=>{state.authority=snapshot.val()||{};apply();};state.authRef.on('value',state.authHandler,error=>console.error('[Combat073 AuthorityPlans]',error));return true;
  }
  function start(){if(state.started)return true;state.started=true;const attempt=()=>{if(bind())return true;state.retryTimer=global.setTimeout(attempt,250);return false;};attempt();return true;}
  function stop(){if(state.retryTimer)global.clearTimeout(state.retryTimer);state.retryTimer=null;if(state.targetRef&&state.targetHandler)state.targetRef.off('value',state.targetHandler);if(state.authRef&&state.authHandler)state.authRef.off('value',state.authHandler);state.targetRef=state.targetHandler=state.authRef=state.authHandler=null;state.started=false;}
  global.addEventListener('luminous:combat073-hydrated',apply);global.addEventListener('luminous:combat073-runtime-ready',apply);global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatRemoteIntents073=Object.freeze({version:'0.7.3-remote-intents.3-private',TARGET_ROOT,AUTH_ROOT,state,start,stop,bind,apply,applyRows,runtimePlan,intentPlan,inferTargetSide});
  start();
})(window);
