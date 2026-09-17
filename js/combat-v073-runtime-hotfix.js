(function(global){
  'use strict';
  if(global.LuminousCombatRuntimeHotfix073)return;

  const state={started:false,active:null,parentObserver:null,pollTimer:null,queueOriginal:null,targetIntentOriginal:null,dmFallbackTimer:null};
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
      global.dispatchEvent(new CustomEvent('luminous:combat073-view-lifecycle',{detail:{version:'0.7.3-runtime-hotfix.2',active:Boolean(active),role:adapterState()?.role||null,reason}}));
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

  function patchTargetIntents(){
    const original=global.assignTargetIntents;
    if(typeof original!=='function')return false;
    if(original.__luminousRuntimeHotfix073)return true;
    state.targetIntentOriginal=original;
    const wrapped=function(...args){
      applyAuthorityAiPlans();
      const result=original.apply(this,args);
      applyAuthorityAiPlans();
      return result;
    };
    wrapped.__luminousRuntimeHotfix073=true;
    if(original.__luminousAuthorityWrapped){
      wrapped.__luminousAuthorityWrapped=true;
      wrapped.__luminousAuthorityOriginal=original.__luminousAuthorityOriginal||original;
    }
    global.assignTargetIntents=wrapped;
    if(global.LuminousCombatHUD?.assignTargetIntents===original)global.LuminousCombatHUD.assignTargetIntents=wrapped;
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

  function webglHasVisualPixels(game){
    const canvases=Array.from(game?.querySelectorAll?.('canvas')||[]).filter(canvas=>(Number(canvas?.width)||0)>1&&(Number(canvas?.height)||0)>1);
    if(!canvases.length)return null;
    let inspected=false;
    for(const canvas of canvases){
      let gl=null;
      try{gl=canvas.getContext?.('webgl2')||canvas.getContext?.('webgl');}catch(_){}
      if(!gl?.readPixels)continue;
      inspected=true;
      const width=Math.max(2,Number(canvas.width)||2),height=Math.max(2,Number(canvas.height)||2),pixel=new Uint8Array(4);
      const points=[[Math.floor(width/2),Math.floor(height/2)],[1,1],[width-2,1],[1,height-2],[width-2,height-2]];
      try{
        for(const [x,y] of points){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(pixel[0]||pixel[1]||pixel[2]||pixel[3])return true;}
      }catch(_){return null;}
    }
    return inspected?false:null;
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
    const gpuPixels=rendererReady?webglHasVisualPixels(game):null;
    if(gpuPixels===false)return{ok:false,reason:'blank-webgl-canvas'};
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
    patchExecutionQueue();patchTargetIntents();
    applyAuthorityAiPlans();
    syncLifecycle('hydrate');
    scheduleDmRecovery();
  }

  function start(){
    if(state.started)return true;
    state.started=true;state.active=null;
    patchExecutionQueue();patchTargetIntents();bindParentVisibility();
    global.document?.addEventListener?.('visibilitychange',()=>syncLifecycle('document-visibility'));
    global.addEventListener?.('pageshow',()=>syncLifecycle('pageshow'));
    global.addEventListener?.('focus',()=>syncLifecycle('focus'));
    global.addEventListener?.('resize',()=>{syncLifecycle('resize');scheduleDmRecovery();},{passive:true});
    global.addEventListener?.('luminous:combat073-hydrated',onHydrated);
    global.addEventListener?.('luminous:combat073-runtime-ready',()=>{patchExecutionQueue();patchTargetIntents();syncLifecycle('runtime-ready');scheduleDmRecovery();});
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
  global.LuminousCombatRuntimeHotfix073=Object.freeze({version:'0.7.3-runtime-hotfix.2',state,start,stop,readViewActive,syncLifecycle,clearAdapterRealtime,resumeAdapterRealtime,applyAuthorityAiPlans,patchExecutionQueue,patchTargetIntents,webglHasVisualPixels,dmVisualHealth,forceDmDomFallback,scheduleDmRecovery});
  start();
})(window);
