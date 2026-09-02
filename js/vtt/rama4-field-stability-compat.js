const clean=(value)=>String(value??'').trim();

function hostWindow(root=globalThis){
  if(!root)return null;
  try{if(root.parent&&root.parent!==root&&root.parent.document)return root.parent;}catch(_){}
  return root;
}

function hostFirebase(root=globalThis){
  const host=hostWindow(root);
  return host?.firebase||root?.firebase||null;
}

function actorIdForToken(token={}){return clean(token.actorId||token.characterLink?.actorId||token.actorRef?.id);}
function isPlayerToken(token={}){return token.canonicalScope==='player'||token.actorCategory==='player'||token.characterLink?.mode==='player'||String(token.id||'').startsWith('player:');}
function actorRecordById(actors={},actorId=''){
  const wanted=clean(actorId);if(!wanted)return null;
  if(actors&&typeof actors==='object'&&actors[wanted])return actors[wanted];
  for(const[key,value]of Object.entries(actors||{}))if(clean(value?.actorId||value?.id||key)===wanted)return value||null;
  return null;
}

/**
 * Rama 4 compatibility layer for the non-perception invariants established by
 * hotfix-rama3-field-stability. Perception ownership intentionally lives in
 * PerceptionSchedulerRuntime and is not patched here.
 */
export function installRama4FieldStabilityCompat(root=globalThis){
  if(root?.LuminousVttRama4FieldStabilityCompat?.__rama4)return root.LuminousVttRama4FieldStabilityCompat;

  const metrics={enginesPatched:0,rawDragFollowSuspends:0,traversalCameraDirtySuppressions:0,playerIconsHydrated:0};
  let stopped=false,currentEngine=null,detachEngine=null,pollTimer=null,actorRef=null,actorHandler=null,actors={},dragFollowState=null,hydrationQueued=false;
  const runtime=()=>root?.LuminousVttRuntime||null;

  function emitTokenDirty(engine,tokenId){
    const dirty=root?.LuminousVttSceneDirty;
    if(!dirty?.emit||!engine?.canvas)return false;
    return dirty.emit(engine.canvas,{reason:'token',render:true,vision:false,active:false,sourceEvent:'rama4-stability:actor-icon',tokenId:clean(tokenId)||null,meta:{appearance:true}});
  }

  function hydratePlayerIcons(engine=currentEngine){
    if(!engine||stopped)return 0;
    let changed=0;
    for(const token of engine.mapData?.tokens||[]){
      if(!isPlayerToken(token))continue;
      const actor=actorRecordById(actors,actorIdForToken(token));
      const icono=clean(actor?.icono);
      if(!icono||clean(token.icono)===icono)continue;
      token.icono=icono;token.tokenImage=icono;token.portrait=icono;
      engine.renderer?.syncTokenView?.(token.id);
      emitTokenDirty(engine,token.id);
      changed+=1;metrics.playerIconsHydrated+=1;
    }
    return changed;
  }

  function queueHydration(){
    if(hydrationQueued||stopped)return;
    hydrationQueued=true;
    const schedule=root?.queueMicrotask?.bind(root)||((fn)=>Promise.resolve().then(fn));
    schedule(()=>{hydrationQueued=false;hydratePlayerIcons();});
  }

  function ensureActorSubscription(){
    if(actorRef||stopped)return;
    let db=null;try{db=hostFirebase(root)?.database?.()||null;}catch(_){}
    if(!db?.ref)return;
    actorRef=db.ref('campaña/actores');
    actorHandler=(snapshot)=>{actors=snapshot?.val?.()||{};queueHydration();};
    actorRef.on?.('value',actorHandler);
  }

  function unpatchEngine(){
    if(typeof detachEngine==='function'){try{detachEngine();}catch(_){}}
    detachEngine=null;currentEngine=null;
  }

  function patchEngine(engine){
    if(!engine||engine===currentEngine||engine.__rama4FieldStabilityCompat)return engine;
    unpatchEngine();
    const canvas=engine.canvas,camera=engine.camera;
    const originalCameraNotify=typeof camera?.notifyVisualChange==='function'?camera.notifyVisualChange.bind(camera):null;
    if(camera&&originalCameraNotify){
      camera.notifyVisualChange=function rama4StableCameraNotify(kind,active=false,meta=null){
        if(kind==='center'&&engine.tokenMotion){metrics.traversalCameraDirtySuppressions+=1;return undefined;}
        return originalCameraNotify(kind,active,meta);
      };
    }
    const onSceneDirty=(event)=>{if(event?.detail?.reason==='token')queueHydration();};
    const onCanonicalSync=()=>queueHydration();
    canvas?.addEventListener?.('vtt:scene-dirty',onSceneDirty);
    canvas?.addEventListener?.('vtt:canonical-tokens-synced',onCanonicalSync);
    Object.defineProperty(engine,'__rama4FieldStabilityCompat',{configurable:true,value:true});
    currentEngine=engine;metrics.enginesPatched+=1;ensureActorSubscription();queueHydration();
    detachEngine=()=>{
      canvas?.removeEventListener?.('vtt:scene-dirty',onSceneDirty);
      canvas?.removeEventListener?.('vtt:canonical-tokens-synced',onCanonicalSync);
      if(camera?.notifyVisualChange?.name==='rama4StableCameraNotify'&&originalCameraNotify)camera.notifyVisualChange=originalCameraNotify;
      try{delete engine.__rama4FieldStabilityCompat;}catch(_){}
    };
    return engine;
  }

  function ensureEngine(){const engine=runtime()?.engine||null;if(engine&&engine!==currentEngine)patchEngine(engine);return engine;}

  function suspendRawDragFollow(){
    const engine=ensureEngine();if(!engine?.tokenDrag||dragFollowState)return false;
    dragFollowState={engine,enabled:Boolean(engine.cameraFollowActive)};
    if(dragFollowState.enabled){engine.cameraFollowActive=false;metrics.rawDragFollowSuspends+=1;}
    return true;
  }

  function restoreRawDragFollow(){
    const state=dragFollowState;dragFollowState=null;if(!state?.engine)return false;
    state.engine.cameraFollowActive=Boolean(state.enabled);return true;
  }

  const schedule=root?.queueMicrotask?.bind(root)||((fn)=>Promise.resolve().then(fn));
  const onMouseDown=()=>{ensureEngine();schedule(suspendRawDragFollow);};
  const onMouseUp=()=>restoreRawDragFollow();
  const onBlur=()=>restoreRawDragFollow();
  const onFocus=()=>ensureEngine();
  root?.addEventListener?.('mousedown',onMouseDown,false);
  root?.addEventListener?.('mouseup',onMouseUp,false);
  root?.addEventListener?.('blur',onBlur,false);
  root?.addEventListener?.('focus',onFocus,false);

  let attempts=0;
  const timerApi=root?.setInterval?.bind(root)||setInterval,clearTimerApi=root?.clearInterval?.bind(root)||clearInterval;
  pollTimer=timerApi(()=>{attempts+=1;ensureEngine();if(currentEngine||attempts>=120){clearTimerApi(pollTimer);pollTimer=null;}},50);

  const api=Object.freeze({
    __rama4:true,
    ensure:ensureEngine,
    hydratePlayerIcons:()=>hydratePlayerIcons(ensureEngine()),
    snapshot:()=>Object.freeze({...metrics,enginePatched:Boolean(currentEngine),rawDragFollowSuspended:Boolean(dragFollowState),actorRecords:Object.keys(actors||{}).length,perceptionOwner:'PerceptionSchedulerRuntime'}),
    stop(){
      if(stopped)return false;stopped=true;restoreRawDragFollow();
      if(pollTimer!=null)clearTimerApi(pollTimer);pollTimer=null;
      root?.removeEventListener?.('mousedown',onMouseDown,false);root?.removeEventListener?.('mouseup',onMouseUp,false);root?.removeEventListener?.('blur',onBlur,false);root?.removeEventListener?.('focus',onFocus,false);
      unpatchEngine();if(actorRef&&actorHandler)actorRef.off?.('value',actorHandler);actorRef=null;actorHandler=null;actors={};
      if(root.LuminousVttRama4FieldStabilityCompat===api)delete root.LuminousVttRama4FieldStabilityCompat;
      return true;
    },
  });
  root.LuminousVttRama4FieldStabilityCompat=api;
  return api;
}

if(typeof window!=='undefined')installRama4FieldStabilityCompat(window);
