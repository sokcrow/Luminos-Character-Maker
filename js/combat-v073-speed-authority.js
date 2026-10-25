(function(global){
  'use strict';
  if(global.LuminousCombatSpeedAuthority073)return;

  const ROOT='campaña/combate';
  const clean=v=>String(v??'').trim();
  const finite=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;
  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v&&typeof v==='object'?{...v}:v}};
  const state={db:null,round:1,roundReady:false,role:null,combatants:{},started:false,rolling:false,unsubs:[],lastSpeedSignature:'',refreshTimer:null,legacyPatched:false,originalRollTurnSpeeds:null,originalRollUnitSpeed:null,lastFormationRound:0};

  function adapter(){return global.LuminousCombatLiveAdapter073||null}
  function adapterState(){return adapter()?.state||null}
  function isDm(){return (adapterState()?.role==='dm'||adapterState()?.isAuthority===true)}

  function hasUsableRange(range){
    return Array.isArray(range)&&range.length>=2&&
      Number.isFinite(Number(range[0]))&&Number.isFinite(Number(range[1]))&&
      Number(range[0])>=1&&Number(range[1])>=2&&Number(range[1])>=Number(range[0]);
  }

  function rangeFor(unit={}){
    const movementRange=global.LuminousMovementSpeedRuntime?.rangeForEntity?.(unit)||null;
    const authoredRange=hasUsableRange(unit.speedRange)?unit.speedRange:null;
    const legacyBounds=[unit.speedMin,unit.speedMax];
    const bounds=movementRange?[movementRange.min,movementRange.max]:
      authoredRange||(hasUsableRange(legacyBounds)?legacyBounds:[1,6]);
    const min=Math.max(1,Math.trunc(Number(bounds[0])));
    const max=Math.max(2,min,Math.min(999,Math.trunc(Number(bounds[1]))));
    return[min,max];
  }

  function legacyOneSpeedRoll(unit={},round=state.round){
    // Old Player combatants could be rolled with [1,1] because the packed
    // engine defaulted missing speedRange to [1,1]. Repair only that case:
    // valid explicit ranges and real movement profiles retain their rolls.
    return Math.trunc(finite(unit.speedRollTurn,0)||0)===round&&
      finite(unit.speed,null)===1&&finite(unit.speedBaseRoll,0)<=1&&
      !hasUsableRange(unit.speedRange)&&
      !global.LuminousMovementSpeedRuntime?.rangeForEntity?.(unit);
  }

  function rollFor(unit={}){
    // The packed runtime owns the exact turn-start Speed modifiers
    // (Exhaustion, Chill, Haste, Bind, forced Speed=1, etc.).
    // Always supply its complete roll range before calling it: without one,
    // the packed engine silently treats every Player as a [1,1] roll.
    const [min,max]=rangeFor(unit);
    const rangeMetadata={speedRange:[min,max],speedMin:min,speedMax:max};
    const original=state.originalRollUnitSpeed;
    if(typeof original==='function'){
      const draft=clone(unit)||{};
      Object.assign(draft,rangeMetadata);
      // A legacy [1,1] roll may already be stamped with this round. The
      // detached draft must actually roll again, never return that old 1.
      draft.speedRollTurn=0;
      const derivedRange=global.LuminousMovementSpeedRuntime?.rangeForEntity?.(draft)||null;
      if(derivedRange)draft.speedProfileMode=derivedRange.mode;
      try{
        const result=original(draft,state.round);
        const rawSpeed=finite(draft.speed,finite(result,null));
        const speed=rawSpeed==null?null:Math.max(1,rawSpeed);
        const base=Math.max(1,finite(draft.speedBaseRoll,speed));
        const tie=finite(draft.speedTie,null);
        if(speed!=null&&base!=null&&tie!=null){
          return{
            ...rangeMetadata,
            speed,
            speedBaseRoll:base,
            speedRollTurn:state.round,
            speedTie:tie,
            speedRolledAt:global.firebase.database.ServerValue.TIMESTAMP
          };
        }
      }catch(error){
        console.error('[Combat073 SpeedAuthority] original Speed rule evaluation failed',error);
      }
    }
    const baseRoll=min+Math.floor(Math.random()*(max-min+1));
    const speed=typeof global.speedForBaseRoll==='function'
      ?Math.max(1,finite(global.speedForBaseRoll(unit,state.round,baseRoll),baseRoll)):baseRoll;
    return{...rangeMetadata,speed,speedBaseRoll:baseRoll,speedRollTurn:state.round,speedTie:Math.random(),speedRolledAt:global.firebase.database.ServerValue.TIMESTAMP};
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
      const rawSpeed=finite(canonical.speed,null);
      const speed=rawSpeed==null?null:Math.max(1,rawSpeed);
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

  function canonicalRoundComplete(round=state.round){
    const expected=Math.max(1,Math.trunc(finite(round,state.round)||state.round||1));
    const rows=Object.values(state.combatants||{}).filter(unit=>unit&&unit.battleActive!==false&&!unit.incapacitated);
    if(!rows.length)return false;
    return rows.every(unit=>{
      const rolledTurn=Math.trunc(finite(unit.speedRollTurn,0)||0);
      const speed=finite(unit.speed,null);
      return rolledTurn===expected&&speed!=null&&speed>=1&&finite(unit.speedTie,null)!=null;
    });
  }

  function applyRoundSideEffectsOnce(round=state.round){
    const expected=Math.max(1,Math.trunc(finite(round,state.round)||state.round||1));
    if(!state.roundReady||state.lastFormationRound===expected||!canonicalRoundComplete(expected))return false;
    try{global.layoutSpeedFormation?.()}catch(error){console.error('[Combat073 SpeedAuthority] formation refresh failed',error)}
    try{global.syncAllUnitVisibility?.()}catch(error){console.error('[Combat073 SpeedAuthority] visibility refresh failed',error)}
    state.lastFormationRound=expected;
    return true;
  }

  function patchLegacySpeedRollers(){
    if(state.legacyPatched)return true;
    const originalTurn=typeof global.rollTurnSpeeds==='function'?global.rollTurnSpeeds:null;
    const originalUnit=typeof global.rollUnitSpeed==='function'?global.rollUnitSpeed:null;
    if(!originalTurn&&!originalUnit)return false;
    state.originalRollTurnSpeeds=state.originalRollTurnSpeeds||originalTurn;
    state.originalRollUnitSpeed=state.originalRollUnitSpeed||originalUnit;

    global.rollTurnSpeeds=function authoritativeSpeedSync(round){
      const expected=round??state.round;
      syncRuntimeSpeedsFromCanonical(expected);
      applyRoundSideEffectsOnce(expected);
      return runtimeCombatants();
    };
    global.rollTurnSpeeds.__luminousCanonicalSpeed=true;
    global.rollTurnSpeeds.__luminousOriginal=state.originalRollTurnSpeeds;

    global.rollUnitSpeed=function authoritativeUnitSpeed(unit){
      const id=clean(unit?.id||unit?.combatId);
      const canonical=canonicalRowFor(id,unit||{});
      const expected=Math.max(1,Math.trunc(finite(state.round,1)||1));
      if(canonical&&Math.trunc(finite(canonical.speedRollTurn,0)||0)===expected&&finite(canonical.speed,null)!=null){
        unit.speed=Math.max(1,finite(canonical.speed,unit?.speed??1));
        unit.speedBaseRoll=Math.max(1,finite(canonical.speedBaseRoll,unit.speed));
        unit.speedRollTurn=expected;
        unit.speedTie=finite(canonical.speedTie,unit.speedTie??0);
        return unit.speed;
      }
      return Math.max(1,finite(unit?.speed,1));
    };
    global.rollUnitSpeed.__luminousCanonicalSpeed=true;
    global.rollUnitSpeed.__luminousOriginal=state.originalRollUnitSpeed;
    state.legacyPatched=true;
    return true;
  }

  function refreshRuntimeSpeedView(){
    const a=adapter();
    if(!state.roundReady||!a?.state?.hydratedOnce)return false;
    syncRuntimeSpeedsFromCanonical();
    applyRoundSideEffectsOnce();
    try{global.LuminousCombat073?.render?.()}catch(error){console.error('[Combat073 SpeedAuthority] render refresh failed',error)}
    try{global.LuminousWebGL2Renderer?.requestRender?.(80)}catch(_){}
    return true;
  }

  function forceRuntimeRefresh(){
    if(!state.roundReady)return false;
    const sig=speedSignature();
    if(sig===state.lastSpeedSignature)return false;
    state.lastSpeedSignature=sig;
    // Encounter-start modifiers can change canonical Speed after planning's
    // initial formation. A changed snapshot must lay out that order once again.
    state.lastFormationRound=0;
    if(state.refreshTimer)global.clearTimeout(state.refreshTimer);
    state.refreshTimer=global.setTimeout(()=>{
      state.refreshTimer=null;
      refreshRuntimeSpeedView();
    },80);
    return true;
  }

  async function ensureRoundSpeeds(options={}){
    if(state.rollPromise)return state.rollPromise;
    const authority=global.LuminousCombatAuthority073?.state;
    if(!state.roundReady||!state.db?.ref||!isDm()||(!options.preparing&&(authority?.preparingRound||authority?.runningLocal)))return false;
    state.rolling=true;
    const expectedRound=state.round;
    state.rollPromise=(async()=>{try{
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
          if(rolledTurn===expectedRound&&speed!=null&&speed>=1&&tie!=null&&!legacyOneSpeedRoll(unit,expectedRound))continue;
          next[key]={...unit,...rollFor(unit)};
          changed=true;
        }
        return changed?next:undefined;
      },undefined,false);
      return Boolean(result?.committed);
    }finally{state.rolling=false}})();
    try{return await state.rollPromise;}finally{state.rollPromise=null;}
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
      const previousRound=state.round;
      state.round=parseRound(snap.val());
      state.roundReady=true;
      if(state.round!==previousRound&&state.lastFormationRound===state.round)state.lastFormationRound=0;
      patchLegacySpeedRollers();
      forceRuntimeRefresh();
      ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] round roll failed',error));
    });
    subscribe(`${ROOT}/combatants`,snap=>{
      state.combatants=snap.val()||{};
      patchLegacySpeedRollers();
      if(state.roundReady)forceRuntimeRefresh();
      if(state.roundReady)ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] roll failed',error));
    });
    return true;
  }

  function stop(){
    state.unsubs.splice(0).forEach(fn=>{try{fn()}catch(_){}});
    if(state.refreshTimer)global.clearTimeout(state.refreshTimer);
    state.refreshTimer=null;state.started=false;state.db=null;state.roundReady=false;state.lastFormationRound=0;
  }

  let tries=0;const timer=global.setInterval(()=>{tries++;if(start()||tries>120)global.clearInterval(timer)},250);
  global.addEventListener('luminous:combat073-runtime-ready',()=>{patchLegacySpeedRollers();refreshRuntimeSpeedView();});
  global.addEventListener('luminous:combat073-hydrated',()=>{
    patchLegacySpeedRollers();
    // Hydration rebuilds runtime combatants from canonical snapshots. Re-apply
    // the already-rolled Speed formation even within the same round so unrelated
    // live updates (for example Player Active Inventory) cannot restore stale x/y.
    if(state.roundReady)state.lastFormationRound=0;
    refreshRuntimeSpeedView();
    // Round completion can arrive while the authority still owns its final
    // write. Hydration after it releases that lock must resume planning rolls.
    ensureRoundSpeeds().catch(error=>console.error('[Combat073 SpeedAuthority] planning roll failed',error));
  });
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatSpeedAuthority073=Object.freeze({state,start,stop,rangeFor,rollFor,speedSignature,runtimeCombatants,canonicalRowFor,syncRuntimeSpeedsFromCanonical,canonicalRoundComplete,applyRoundSideEffectsOnce,refreshRuntimeSpeedView,patchLegacySpeedRollers,ensureRoundSpeeds,forceRuntimeRefresh});
})(window);
