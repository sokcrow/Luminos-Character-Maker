(function(global){
  'use strict';
  if(global.LuminousCombatSpeedAuthority073)return;

  const ROOT='campaña/combate';
  const clean=v=>String(v??'').trim();
  const finite=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;
  const state={db:null,round:1,roundReady:false,role:null,combatants:{},started:false,rolling:false,unsubs:[],lastSpeedSignature:'',refreshTimer:null,legacyPatched:false,originalRollTurnSpeeds:null,originalRollUnitSpeed:null};

  function adapter(){return global.LuminousCombatLiveAdapter073||null}
  function adapterState(){return adapter()?.state||null}
  function isDm(){return adapterState()?.role==='dm'}

  function rangeFor(unit={}){
    let min,max;
    if(Array.isArray(unit.speedRange)&&unit.speedRange.length>=2){
      min=finite(unit.speedRange[0],1);max=finite(unit.speedRange[1],6);
    }else{
      min=finite(unit.speedMin,1);max=finite(unit.speedMax,6);
    }
    min=Math.trunc(min??1);max=Math.trunc(max??6);
    if(max<min)[min,max]=[max,min];
    return[Math.max(-99,min),Math.min(999,max)];
  }

  function rollFor(unit={}){
    const [min,max]=rangeFor(unit);
    const speed=min+Math.floor(Math.random()*(max-min+1));
    return{speed,speedBaseRoll:speed,speedRollTurn:state.round,speedTie:Math.random(),speedRolledAt:global.firebase.database.ServerValue.TIMESTAMP};
  }

  function speedSignature(combatants=state.combatants){
    return JSON.stringify(Object.entries(combatants||{}).sort(([a],[b])=>a.localeCompare(b)).map(([id,u])=>[id,finite(u?.speed,null),finite(u?.speedBaseRoll,null),finite(u?.speedRollTurn,null),finite(u?.speedTie,null)]));
  }

  function runtimeCombatants(){
    return global.LuminousCombat073?.combatants?.() || global.combatData || {};
  }

  function canonicalRowFor(unitId, unit={}){
    const direct=state.combatants?.[unitId];
    if(direct)return direct;
    const wanted=clean(unit?.id||unit?.combatId||unitId);
    return Object.values(state.combatants||{}).find(row=>clean(row?.id||row?.combatId)===wanted)||null;
  }

  function syncRuntimeSpeedsFromCanonical(round=state.round){
    const expected=Math.max(1,Math.trunc(finite(round,state.round)||state.round||1));
    const runtimeRows=runtimeCombatants();
    let changed=0;
    for(const [unitId,unit] of Object.entries(runtimeRows||{})){
      if(!unit||typeof unit!=='object')continue;
      const canonical=canonicalRowFor(unitId,unit);
      if(!canonical)continue;
      const rolledTurn=Math.trunc(finite(canonical.speedRollTurn,0)||0);
      const speed=finite(canonical.speed,null);
      const tie=finite(canonical.speedTie,null);
      if(rolledTurn!==expected||speed==null||tie==null)continue;
      const before=[finite(unit.speed,null),finite(unit.speedBaseRoll,null),Math.trunc(finite(unit.speedRollTurn,0)||0),finite(unit.speedTie,null)];
      unit.speed=speed;
      unit.speedBaseRoll=finite(canonical.speedBaseRoll,speed);
      unit.speedRollTurn=rolledTurn;
      unit.speedTie=tie;
      if(canonical.speedRolledAt!==undefined)unit.speedRolledAt=canonical.speedRolledAt;
      const after=[finite(unit.speed,null),finite(unit.speedBaseRoll,null),Math.trunc(finite(unit.speedRollTurn,0)||0),finite(unit.speedTie,null)];
      if(JSON.stringify(before)!==JSON.stringify(after))changed++;
    }
    return changed;
  }

  function patchLegacySpeedRollers(){
    if(state.legacyPatched)return true;
    const originalTurn=typeof global.rollTurnSpeeds==='function'?global.rollTurnSpeeds:null;
    const originalUnit=typeof global.rollUnitSpeed==='function'?global.rollUnitSpeed:null;
    if(!originalTurn&&!originalUnit)return false;
    state.originalRollTurnSpeeds=state.originalRollTurnSpeeds||originalTurn;
    state.originalRollUnitSpeed=state.originalRollUnitSpeed||originalUnit;

    global.rollTurnSpeeds=function authoritativeSpeedSync(round){
      syncRuntimeSpeedsFromCanonical(round??state.round);
      // Preserve the original turn-start side effects without preserving its RNG:
      // canonical Speed determines order/formation, then the viewer lays units out
      // and refreshes visibility exactly once for the new turn.
      try{global.layoutSpeedFormation?.()}catch(error){console.error('[Combat073 SpeedAuthority] formation refresh failed',error)}
      try{global.syncAllUnitVisibility?.()}catch(error){console.error('[Combat073 SpeedAuthority] visibility refresh failed',error)}
      return runtimeCombatants();
    };
    global.rollTurnSpeeds.__luminousCanonicalSpeed=true;
    global.rollTurnSpeeds.__luminousOriginal=state.originalRollTurnSpeeds;

    global.rollUnitSpeed=function authoritativeUnitSpeed(unit){
      const id=clean(unit?.id||unit?.combatId);
      const canonical=canonicalRowFor(id,unit||{});
      const expected=Math.max(1,Math.trunc(finite(state.round,1)||1));
      if(canonical&&Math.trunc(finite(canonical.speedRollTurn,0)||0)===expected&&finite(canonical.speed,null)!=null){
        unit.speed=finite(canonical.speed,unit?.speed??0);
        unit.speedBaseRoll=finite(canonical.speedBaseRoll,unit.speed);
        unit.speedRollTurn=expected;
        unit.speedTie=finite(canonical.speedTie,unit.speedTie??0);
        return unit.speed;
      }
      return finite(unit?.speed,0);
    };
    global.rollUnitSpeed.__luminousCanonicalSpeed=true;
    global.rollUnitSpeed.__luminousOriginal=state.originalRollUnitSpeed;
    state.legacyPatched=true;
    return true;
  }

  function forceRuntimeRefresh(){
    const a=adapter();
    if(!a?.state||!a?.hydrateNow)return;
    const sig=speedSignature();
    if(sig===state.lastSpeedSignature)return;
    state.lastSpeedSignature=sig;
    if(state.refreshTimer)global.clearTimeout(state.refreshTimer);
    state.refreshTimer=global.setTimeout(()=>{
      state.refreshTimer=null;
      a.state.lastSignature='';
      try{a.hydrateNow()}catch(error){console.error('[Combat073 SpeedAuthority] hydrate failed',error)}
    },80);
  }

  async function ensureRoundSpeeds(){
    if(state.rolling||!state.roundReady||!state.db?.ref||!isDm())return false;
    state.rolling=true;
    try{
      const ref=state.db.ref(`${ROOT}/combatants`);
      const result=await ref.transaction(current=>{
        if(!current||typeof current!=='object')return;
        let changed=false;
        const next={...current};
        for(const [key,raw] of Object.entries(current)){
          const unit=raw&&typeof raw==='object'?raw:{};
          const rolledTurn=Math.trunc(finite(unit.speedRollTurn,0)||0);
          const speed=finite(unit.speed,null);
          const tie=finite(unit.speedTie,null);
          if(rolledTurn===state.round&&speed!=null&&tie!=null)continue;
          next[key]={...unit,...rollFor(unit)};
          changed=true;
        }
        return changed?next:undefined;
      },undefined,false);
      return Boolean(result?.committed);
    }finally{state.rolling=false}
  }

  function parseRound(value){
    if(value&&typeof value==='object')return Math.max(1,Math.trunc(finite(value.round??value.turn,1)||1));
    return Math.max(1,Math.trunc(finite(adapterState()?.round,1)||1));
  }

  function subscribe(path,handler){
    const ref=state.db.ref(path);ref.on('value',handler);state.unsubs.push(()=>ref.off('value',handler));
  }

  function start(){
    if(state.started)return true;
    const s=adapterState();
    if(!s?.db?.ref||!s.uid)return false;
    state.started=true;state.db=s.db;state.role=s.role;state.round=Math.max(1,Math.trunc(finite(s.round,1)||1));state.roundReady=false;
    patchLegacySpeedRollers();
    // Never author Speed until the canonical Combat round has arrived from Firebase.
    // A viewer may boot with adapter.round=1 while the encounter is actually on a later round.
    subscribe(`${ROOT}/estado`,snap=>{
      state.round=parseRound(snap.val());
      state.roundReady=true;
      patchLegacySpeedRollers();
      syncRuntimeSpeedsFromCanonical();
      ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] round roll failed',error));
    });
    subscribe(`${ROOT}/combatants`,snap=>{
      state.combatants=snap.val()||{};
      patchLegacySpeedRollers();
      syncRuntimeSpeedsFromCanonical();
      forceRuntimeRefresh();
      if(state.roundReady)ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] roll failed',error));
    });
    return true;
  }

  function stop(){
    state.unsubs.splice(0).forEach(fn=>{try{fn()}catch(_){}});
    if(state.refreshTimer)global.clearTimeout(state.refreshTimer);
    state.refreshTimer=null;state.started=false;state.db=null;state.roundReady=false;
  }

  let tries=0;const timer=global.setInterval(()=>{tries++;if(start()||tries>120)global.clearInterval(timer)},250);
  global.addEventListener('luminous:combat073-runtime-ready',()=>{patchLegacySpeedRollers();syncRuntimeSpeedsFromCanonical();});
  global.addEventListener('luminous:combat073-hydrated',()=>{patchLegacySpeedRollers();syncRuntimeSpeedsFromCanonical();});
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatSpeedAuthority073=Object.freeze({state,start,stop,rangeFor,rollFor,speedSignature,runtimeCombatants,canonicalRowFor,syncRuntimeSpeedsFromCanonical,patchLegacySpeedRollers,ensureRoundSpeeds,forceRuntimeRefresh});
})(window);
