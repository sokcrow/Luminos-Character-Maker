(function(global){
  'use strict';
  if(global.LuminousCombatRuntimeHotfix073)return;

  const state={started:false,active:null,parentObserver:null,pollTimer:null,queueOriginal:null,dmFallbackTimer:null};
  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function authority(){return global.LuminousCombatAuthority073||null;}
  function remote(){return global.LuminousCombatRemoteIntents073||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function isPlayer(){return adapterState()?.role==='player';}
  function isDm(){return adapterState()?.role==='dm';}

  function readViewActive(){
    if(isDm())return true;
    if(global.document?.hidden)return false;
    try{
      if(global.LuminousWebGL2Renderer?.surfaceActive?.()===false)return false;
    }catch(_){}
    try{
      const frameEl=global.frameElement;
      if(!frameEl||global.parent===global)return true;
      const rect=frameEl.getBoundingClientRect?.()||{width:0,height:0};
      if(rect.width<2||rect.height<2)return false;
      let node=frameEl;
      while(node&&node.nodeType===1){
        const style=global.parent?.getComputedStyle?.(node);
        if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse'||style?.opacity==='0')return false;
        if(node.hidden===true||node.getAttribute?.('aria-hidden')==='true')return false;
        node=node.parentElement;
      }
      return true;
    }catch(_){return !global.document?.hidden;}
  }

  function emitLifecycle(active,reason='visibility'){
    try{
      global.dispatchEvent(new CustomEvent('luminous:combat073-view-lifecycle',{detail:{version:'0.7.3-runtime-hotfix.1',active:Boolean(active),role:adapterState()?.role||null,reason}}));
    }catch(_){}
  }

  function clearAdapterRealtime(){
    const s=adapterState();
    if(!s||!isPlayer())return false;
    if(Array.isArray(s.unsubscribers))s.unsubscribers.splice(0).forEach(unsubscribe=>{try{unsubscribe?.();}catch(_){}});
    if(s.hydrateTimer){global.clearTimeout?.(s.hydrateTimer);s.hydrateTimer=null;}
    s.firebaseReady=false;
    return true;
  }

  function phaseAndRound(raw){
    if(raw&&typeof raw==='object')return{phase:clean(raw.phase||raw.state||raw.status||'PRE_COMBAT_PLANNING')||'PRE_COMBAT_PLANNING',round:Math.max(1,Math.trunc(finite(raw.round??raw.turn,1)))};
    return{phase:clean(raw||'PRE_COMBAT_PLANNING')||'PRE_COMBAT_PLANNING',round:1};
  }

  function subscribeAdapter(path,assign){
    const s=adapterState();if(!s?.db?.ref)return false;
    const ref=s.db.ref(path),handler=snapshot=>{assign(snapshot.val());adapter()?.scheduleHydrate?.();};
    ref.on('value',handler);
    s.unsubscribers=Array.isArray(s.unsubscribers)?s.unsubscribers:[];
    s.unsubscribers.push(()=>ref.off('value',handler));
    return true;
  }

  function resumeAdapterRealtime(){
    const bridge=adapter(),s=adapterState();
    if(!bridge||!s?.db?.ref||!s.user||!isPlayer())return false;
    if(s.firebaseReady)return true;
    s.firebaseReady=true;
    subscribeAdapter(bridge.ROOTS.players,value=>{s.players=value&&typeof value==='object'?value:{};});
    subscribeAdapter(bridge.ROOTS.combatants,value=>{s.combatants=value&&typeof value==='object'?value:{};});
    subscribeAdapter(bridge.ROOTS.skills,value=>{s.skills=value&&typeof value==='object'?value:{};});
    subscribeAdapter(bridge.ROOTS.state,value=>{const parsed=phaseAndRound(value);s.combatState=parsed.phase;s.round=parsed.round;});
    s.db.ref(bridge.ROOTS.dmUid).once('value').then(snapshot=>{const uid=clean(snapshot.val());if(uid)s.dmUid=uid;bridge.scheduleHydrate?.();}).catch(()=>{});
    s.lastSignature='';
    bridge.scheduleHydrate?.();
    return true;
  }

  function suspendPlayerBridges(){
    if(!isPlayer())return false;
    clearAdapterRealtime();
    try{authority()?.stop?.();}catch(error){console.warn('[Combat073 Hotfix] authority suspend failed',error);}
    try{remote()?.stop?.();}catch(error){console.warn('[Combat073 Hotfix] remote intent suspend failed',error);}
    return true;
  }

  function resumePlayerBridges(){
    if(!isPlayer())return false;
    resumeAdapterRealtime();
    try{remote()?.start?.();}catch(error){console.warn('[Combat073 Hotfix] remote intent resume failed',error);}
    try{authority()?.start?.();}catch(error){console.warn('[Combat073 Hotfix] authority resume failed',error);}
    return true;
  }

  function syncLifecycle(reason='visibility'){
    if(!isPlayer()){
      if(isDm()&&state.active!==true){state.active=true;emitLifecycle(true,'dm-authority');}
      return true;
    }
    const next=readViewActive();
    if(next===state.active){
      if(next&&!adapterState()?.firebaseReady)resumePlayerBridges();
      else if(!next&&(adapterState()?.firebaseReady||authority()?.state?.started||remote()?.state?.started))suspendPlayerBridges();
      return next;
    }
    state.active=next;
    if(next)resumePlayerBridges();else suspendPlayerBridges();
    emitLifecycle(next,reason);
    return next;
  }

  function bindParentVisibility(){
    if(state.parentObserver)return true;
    try{
      const frameEl=global.frameElement;
      if(!frameEl||global.parent===global||!global.parent?.MutationObserver)return false;
      state.parentObserver=new global.parent.MutationObserver(()=>syncLifecycle('parent-visibility'));
      let node=frameEl;
      while(node&&node.nodeType===1){state.parentObserver.observe(node,{attributes:true,attributeFilter:['class','style','aria-hidden','hidden']});node=node.parentElement;}
      return true;
    }catch(_){return false;}
  }

  function planRowsToArray(rows,unit){
    const converter=remote()?.runtimePlan;if(typeof converter!=='function')return[];
    const plans=[];
    Object.entries(rows||{}).forEach(([slot,raw])=>{if(!raw)return;const index=Math.max(0,Number(raw?.sourceSlotIndex??slot)||0);plans[index]=converter(raw,index,unit);});
    return plans;
  }

  function applyAuthorityAiPlans(){
    const s=adapterState(),auth=authority(),combat=runtime();
    const current=auth?.state?.current||{};
    if(!s||!combat?.combatants||Number(current.round)!==Number(s.round)||!['sealed','running'].includes(norm(current.phase)))return false;
    const units=combat.combatants();
    Object.values(units).forEach(unit=>{if(unit?.controlled==='ai')unit.autoPlans=[];});
    for(const [unitId,rows] of Object.entries(current.aiPlans||{})){
      const unit=units[unitId];if(unit?.controlled!=='ai')continue;
      unit.autoPlans=planRowsToArray(rows,unit);
    }
    return true;
  }

  function patchExecutionQueue(){
    const original=global.buildExecutionQueue;
    if(typeof original!=='function')return false;
    if(original.__luminousRuntimeHotfix073)return true;
    state.queueOriginal=original;
    const wrapped=function(...args){applyAuthorityAiPlans();return original.apply(this,args);};
    wrapped.__luminousRuntimeHotfix073=true;
    if(original.__luminousAuthorityQueue)wrapped.__luminousAuthorityQueue=true;
    if(original.__luminousAuthorityQueueOriginal)wrapped.__luminousAuthorityQueueOriginal=original.__luminousAuthorityQueueOriginal;
    global.buildExecutionQueue=wrapped;
    return true;
  }

  function forceDmDomFallback(reason='visual-recovery'){
    if(!isDm())return false;
    const game=global.document?.getElementById?.('game-container');
    if(!game)return false;
    game.classList?.remove?.('player-blinded','webgl2-background-ready');
    game.style.visibility='visible';game.style.opacity='1';
    game.querySelectorAll?.('.sprite-img.webgl2-texture-backed')?.forEach?.(img=>img.classList.remove('webgl2-texture-backed'));
    game.dataset.dmVisualFallback='dom';game.dataset.dmVisualFallbackReason=reason;
    try{runtime()?.render?.();}catch(_){}
    global.LuminousWebGL2Renderer?.requestRender?.(180);
    return true;
  }

  function dmVisualHealth(){
    if(!isDm())return{ok:true,reason:'not-dm'};
    const game=global.document?.getElementById?.('game-container');
    if(!game)return{ok:false,reason:'missing-game'};
    const units=Object.values(runtime()?.combatants?.()||{}).filter(unit=>unit?.battleActive!==false&&!unit?.isBackup);
    if(!units.length)return{ok:true,reason:'no-combatants'};
    const tokens=Array.from(game.querySelectorAll?.('.sprite-container')||[]);
    const images=Array.from(game.querySelectorAll?.('.sprite-img')||[]);
    const surfaceActive=global.LuminousWebGL2Renderer?.surfaceActive?.();
    const rendererReady=game.classList?.contains?.('webgl2-renderer-ready');
    const backgroundReady=game.classList?.contains?.('webgl2-background-ready');
    if(surfaceActive===false)return{ok:false,reason:'surface-inactive'};
    if(tokens.length<units.length||images.length<units.length)return{ok:false,reason:'missing-dom-tokens'};
    if(rendererReady&&!backgroundReady)return{ok:false,reason:'background-not-ready'};
    return{ok:true,reason:'healthy'};
  }

  function scheduleDmRecovery(){
    if(!isDm())return false;
    if(state.dmFallbackTimer)global.clearTimeout?.(state.dmFallbackTimer);
    state.dmFallbackTimer=global.setTimeout?.(()=>{
      state.dmFallbackTimer=null;
      const health=dmVisualHealth();
      if(!health.ok)forceDmDomFallback(health.reason);
    },700)||null;
    return true;
  }

  function onHydrated(){
    patchExecutionQueue();
    applyAuthorityAiPlans();
    syncLifecycle('hydrate');
    scheduleDmRecovery();
  }

  function start(){
    if(state.started)return true;
    state.started=true;state.active=null;
    patchExecutionQueue();bindParentVisibility();
    global.document?.addEventListener?.('visibilitychange',()=>syncLifecycle('document-visibility'));
    global.addEventListener?.('pageshow',()=>syncLifecycle('pageshow'));
    global.addEventListener?.('focus',()=>syncLifecycle('focus'));
    global.addEventListener?.('resize',()=>{syncLifecycle('resize');scheduleDmRecovery();},{passive:true});
    global.addEventListener?.('luminous:combat073-hydrated',onHydrated);
    global.addEventListener?.('luminous:combat073-runtime-ready',()=>{patchExecutionQueue();syncLifecycle('runtime-ready');scheduleDmRecovery();});
    state.pollTimer=global.setInterval?.(()=>syncLifecycle('poll'),1000)||null;
    global.setTimeout?.(()=>{syncLifecycle('boot');scheduleDmRecovery();},0);
    return true;
  }

  function stop(){
    state.parentObserver?.disconnect?.();state.parentObserver=null;
    if(state.pollTimer)global.clearInterval?.(state.pollTimer);state.pollTimer=null;
    if(state.dmFallbackTimer)global.clearTimeout?.(state.dmFallbackTimer);state.dmFallbackTimer=null;
    state.started=false;
  }

  global.addEventListener?.('beforeunload',stop,{once:true});
  global.LuminousCombatRuntimeHotfix073=Object.freeze({version:'0.7.3-runtime-hotfix.1',state,start,stop,readViewActive,syncLifecycle,clearAdapterRealtime,resumeAdapterRealtime,applyAuthorityAiPlans,patchExecutionQueue,dmVisualHealth,forceDmDomFallback,scheduleDmRecovery});
  start();
})(window);
