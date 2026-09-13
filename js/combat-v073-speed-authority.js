(function(global){
  'use strict';
  if(global.LuminousCombatSpeedAuthority073)return;

  const ROOT='campaña/combate';
  const clean=v=>String(v??'').trim();
  const finite=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;
  const state={db:null,round:1,role:null,combatants:{},started:false,rolling:false,unsubs:[],lastSpeedSignature:''};

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

  function forceRuntimeRefresh(){
    const a=adapter();
    if(!a?.state||!a?.hydrateNow)return;
    const sig=speedSignature();
    if(sig===state.lastSpeedSignature)return;
    state.lastSpeedSignature=sig;
    a.state.lastSignature='';
    try{a.hydrateNow()}catch(error){console.error('[Combat073 SpeedAuthority] hydrate failed',error)}
  }

  async function ensureRoundSpeeds(){
    if(state.rolling||!state.db?.ref||!isDm())return false;
    state.rolling=true;
    try{
      const entries=Object.entries(state.combatants||{});
      for(const [key] of entries){
        const ref=state.db.ref(`${ROOT}/combatants/${key}`);
        await ref.transaction(current=>{
          if(!current||typeof current!=='object')return;
          const rolledTurn=Math.trunc(finite(current.speedRollTurn,0)||0);
          const speed=finite(current.speed,null);
          const tie=finite(current.speedTie,null);
          if(rolledTurn===state.round&&speed!=null&&tie!=null)return;
          return{...current,...rollFor(current)};
        },undefined,false);
      }
      return true;
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
    state.started=true;state.db=s.db;state.role=s.role;state.round=Math.max(1,Math.trunc(finite(s.round,1)||1));
    subscribe(`${ROOT}/combatants`,snap=>{
      state.combatants=snap.val()||{};
      forceRuntimeRefresh();
      ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] roll failed',error));
    });
    subscribe(`${ROOT}/estado`,snap=>{
      state.round=parseRound(snap.val());
      ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] round roll failed',error));
    });
    return true;
  }

  function stop(){state.unsubs.splice(0).forEach(fn=>{try{fn()}catch(_){}});state.started=false;state.db=null}

  let tries=0;const timer=global.setInterval(()=>{tries++;if(start()||tries>120)global.clearInterval(timer)},250);
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatSpeedAuthority073=Object.freeze({state,start,stop,rangeFor,rollFor,speedSignature,ensureRoundSpeeds,forceRuntimeRefresh});
})(window);
