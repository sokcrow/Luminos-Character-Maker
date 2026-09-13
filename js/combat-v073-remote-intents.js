(function (global) {
  'use strict';
  if (global.LuminousCombatRemoteIntents073) return;

  const ROOT = 'campaña/combate/plannedActions';
  const clean = (value) => String(value ?? '').trim();
  const norm = (value) => clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const state = { started:false, ref:null, handler:null, rawPlans:{}, retryTimer:null };
  function adapter(){ return global.LuminousCombatLiveAdapter073 || null; }
  function adapterState(){ return adapter()?.state || null; }
  function runtime(){ return global.LuminousCombat073 || null; }
  function combatantForPersistedPlan(raw={}){
    const data=runtime()?.combatants?.()||{}, explicit=clean(raw.unitId); if(explicit&&data[explicit])return data[explicit];
    const playerId=clean(raw.scheduledBy); if(!playerId)return null;
    return Object.values(data).find(unit=>clean(unit?.canonicalPlayerKey||unit?.ownerPlayerId||unit?.playerId||unit?.characterLink?.playerId)===playerId)||null;
  }
  function inferTargetSide(unit,raw={}){
    const explicit=clean(raw.targetSide); if(explicit)return explicit;
    const target=runtime()?.combatants?.()?.[clean(raw.targetId)]; if(!unit||!target)return '';
    return unit.faction===target.faction?'ally':'enemy';
  }
  function runtimePlan(raw={},slotIndex=0,unit=null){
    const kind=norm(raw.kind||'skill');
    const common={sourceSlotIndex:Number.isInteger(Number(raw.sourceSlotIndex))?Number(raw.sourceSlotIndex):slotIndex,targetId:clean(raw.targetId)||null,targetSlotIndex:raw.targetSlotIndex==null?null:Math.max(0,Number(raw.targetSlotIndex)||0),additionalTargets:Array.isArray(raw.additionalTargets)?clone(raw.additionalTargets):[]};
    const targetSide=inferTargetSide(unit,raw), skills=adapterState()?.skills||{};
    if(kind==='skill'||kind==='defense'){
      const skillId=clean(raw.skillId), source=skillId&&skills[skillId]?adapter()?.normalizeSkill?.(skillId,skills[skillId]):null;
      const data={...(source||{}),kind,skillId,id:skillId||clean(raw.actionName),name:clean(raw.actionName||source?.name||skillId)}; if(targetSide)data.targetSide=targetSide;
      return {...common,type:kind==='defense'?'defense':'deck',data};
    }
    if(kind==='spell'){const spellId=clean(raw.spellId);return {...common,type:'spells',data:{kind:'spell',spellId,id:spellId,name:clean(raw.actionName||spellId),targetSide:targetSide||'enemy',slotLevel:Number(raw.slotLevel)||0,overcast:Boolean(raw.overcast)}};}
    if(kind==='item'){const itemId=clean(raw.itemId),itemType=clean(raw.itemType)||(targetSide==='ally'?'hp_healing':'offensive');return {...common,type:'items',data:{kind:'item',itemId,id:itemId,name:clean(raw.actionName||itemId),itemType,targetSide}};}
    if(kind==='global'){const actionKey=clean(raw.actionKey);return {...common,type:'global',data:{kind:'global',actionKey,id:actionKey,name:clean(raw.actionName||actionKey),targetSide}};}
    if(kind==='trait'){const traitId=clean(raw.traitId);return {...common,type:'traits',data:{kind:'trait',traitId,id:traitId,name:clean(raw.actionName||traitId),targetSide}};}
    return {...common,type:'auto',data:{kind,id:clean(raw.actionName||raw.skillId||raw.itemId||raw.actionKey),targetSide}};
  }
  function apply(){
    const combat=runtime(),s=adapterState(); if(!combat?.combatants||!s)return false; const data=combat.combatants();
    Object.values(data).forEach(unit=>{if(unit?.controlled==='remote')unit.autoPlans=[];});
    for(const ownerRows of Object.values(state.rawPlans||{})){if(!ownerRows||typeof ownerRows!=='object')continue;for(const [slotKey,raw] of Object.entries(ownerRows)){if(!raw||typeof raw!=='object')continue;if(Number(raw.round)&&Number(raw.round)!==Number(s.round))continue;const unit=combatantForPersistedPlan(raw);if(!unit||unit.controlled!=='remote')continue;const slotIndex=Math.max(0,Number(raw.sourceSlotIndex??slotKey)||0);unit.autoPlans=Array.isArray(unit.autoPlans)?unit.autoPlans:[];unit.autoPlans[slotIndex]=runtimePlan(raw,slotIndex,unit);}}
    combat.render?.(); global.LuminousWebGL2Renderer?.requestRender?.(80); return true;
  }
  function bind(){const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.ref)return true;state.ref=s.db.ref(ROOT);state.handler=snapshot=>{state.rawPlans=snapshot.val()||{};apply();};state.ref.on('value',state.handler,error=>console.error('[Combat073 RemoteIntents]',error));return true;}
  function start(){if(state.started)return true;state.started=true;const attempt=()=>{if(bind())return true;state.retryTimer=global.setTimeout(attempt,250);return false;};attempt();return true;}
  function stop(){if(state.retryTimer)global.clearTimeout(state.retryTimer);state.retryTimer=null;if(state.ref&&state.handler)state.ref.off('value',state.handler);state.ref=null;state.handler=null;state.started=false;}
  global.addEventListener('luminous:combat073-hydrated',apply);
  global.addEventListener('luminous:combat073-runtime-ready',apply);
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatRemoteIntents073=Object.freeze({version:'0.7.3-remote-intents.1',state,start,stop,bind,apply,runtimePlan,inferTargetSide});
  start();
})(window);
