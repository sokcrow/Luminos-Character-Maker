(function(global){
  'use strict';
  if(global.LuminousCombatDmObserver073)return;

  const state={patched:false,roleObserver:null,roleTimer:null,facingObserver:null,facingFrame:0};

  function adapterState(){return global.LuminousCombatLiveAdapter073?.state||null}
  function host(){return global.document?.getElementById?.('game-container')||null}
  function isDm(){return adapterState()?.role==='dm'||host()?.dataset?.viewerRole==='dm'}
  function runtimeCombatants(){return global.LuminousCombat073?.combatants?.()||{}}
  function clean(value){return String(value??'').trim().toLowerCase()}

  function clearObserverRestrictions(){
    if(!isDm())return false;
    const game=host();
    if(!game)return false;
    game.classList.remove('player-blinded');
    game.querySelectorAll('.sprite-container').forEach(token=>{
      token.classList.remove('invisible-hidden','invisible-detected','blindness-self','blindness-enemy','blindness-other');
    });
    return true;
  }

  function ensureVisualSurface(){
    if(!isDm())return false;
    const game=host();if(!game)return false;
    game.style.visibility='visible';
    game.style.opacity='1';
    const renderer=global.LuminousWebGL2Renderer;
    const surfaceActive=renderer?.surfaceActive?.();
    if(surfaceActive===false){
      game.classList.remove('webgl2-background-ready');
      game.querySelectorAll('.sprite-img.webgl2-texture-backed').forEach(img=>img.classList.remove('webgl2-texture-backed'));
      game.dataset.dmVisualFallback='dom';
      try{global.LuminousCombat073?.render?.()}catch(_){}
    }else if(game.dataset.dmVisualFallback==='dom'){
      delete game.dataset.dmVisualFallback;
    }
    renderer?.requestRender?.(260);
    return true;
  }

  function sourceFacing(unit={}){
    const value=clean(unit.spriteFacing||unit.sourceFacing||unit.combatVisual?.facing||unit.visual?.facing||unit.metadata?.spriteFacing);
    return value==='left'||value==='right'?value:'right';
  }

  function desiredFacing(unit={},token=null){
    const faction=clean(unit.faction||unit.faccion||unit.category||unit.actorCategory)||(token?.classList?.contains('enemy')?'enemy':'ally');
    return faction==='enemy'||faction==='enemigo'||faction==='hostile'?'left':'right';
  }

  function ensureFacingStyle(){
    const doc=global.document;if(!doc)return false;
    let style=doc.getElementById('combat073-limbus-facing-style');
    if(style)return true;
    style=doc.createElement('style');style.id='combat073-limbus-facing-style';
    style.textContent=`
      #game-container .sprite-container.luminous-flip-x .sprite-img{transform:scaleX(-1)!important;transform-origin:center center!important}
      #game-container .sprite-container.luminous-no-flip-x .sprite-img{transform:scaleX(1)!important;transform-origin:center center!important}
    `;
    doc.head?.appendChild(style);return true;
  }

  function applyLimbusFacing(){
    ensureFacingStyle();
    const game=host();if(!game)return false;
    const units=runtimeCombatants();
    game.querySelectorAll('.sprite-container').forEach(token=>{
      const tokenId=String(token.id||'').replace(/^token-/,'');
      const unit=units[tokenId]||{};
      const source=sourceFacing(unit),desired=desiredFacing(unit,token),flip=source!==desired;
      token.dataset.luminousSourceFacing=source;
      token.dataset.luminousBattleFacing=desired;
      token.classList.toggle('luminous-flip-x',flip);
      token.classList.toggle('luminous-no-flip-x',!flip);
    });
    global.LuminousWebGL2Renderer?.requestRender?.(120);
    return true;
  }

  function scheduleFacing(){
    if(state.facingFrame)return;
    state.facingFrame=global.requestAnimationFrame?.(()=>{state.facingFrame=0;applyLimbusFacing()})||0;
    if(!state.facingFrame)applyLimbusFacing();
  }

  function observeFacing(){
    const field=global.document?.getElementById?.('battlefield');
    if(!field||state.facingObserver||typeof MutationObserver!=='function')return Boolean(field);
    state.facingObserver=new MutationObserver(records=>{
      if(records.some(record=>record.type==='childList'))scheduleFacing();
    });
    state.facingObserver.observe(field,{childList:true,subtree:true});
    scheduleFacing();
    return true;
  }

  function tuneRenderer(){
    const renderer=global.LuminousWebGL2Renderer;
    if(!renderer?.setEnabled)return false;
    if(isDm()){
      if(renderer.isEnabled?.()===false)renderer.setEnabled(true);
      renderer.requestRender?.(220);
    }
    return true;
  }

  function enforceDmView(){
    if(!isDm())return false;
    clearObserverRestrictions();
    try{global.LuminousCombat073?.camera?.('full',false)}catch(error){console.error('[Combat073 DM Observer] camera failed',error)}
    tuneRenderer();
    ensureVisualSurface();
    applyLimbusFacing();
    const game=host();
    if(game)game.dataset.dmObserverMode='true';
    return true;
  }

  function wrapGlobalFunction(name,factory){
    const original=global[name];
    if(typeof original!=='function'||original.__luminousDmObserverWrapped)return false;
    const wrapped=factory(original);
    wrapped.__luminousDmObserverWrapped=true;
    wrapped.__luminousDmObserverOriginal=original;
    global[name]=wrapped;
    return true;
  }

  function patchRuntime(){
    if(state.patched)return true;
    const cameraPatched=wrapGlobalFunction('setCameraFocus',original=>function(mode='player',enabled=true){
      if(isDm())return original('full',false);
      return original(mode,enabled);
    });
    const blindPatched=wrapGlobalFunction('syncBlindnessVisual',original=>function(){
      if(isDm())return clearObserverRestrictions();
      return original();
    });
    const invisiblePatched=wrapGlobalFunction('syncInvisibilityVisuals',original=>function(){
      if(isDm())return clearObserverRestrictions();
      return original();
    });
    state.patched=cameraPatched&&blindPatched&&invisiblePatched;
    return state.patched;
  }

  function observeRole(){
    const game=host();
    if(!game||state.roleObserver)return Boolean(game);
    state.roleObserver=new MutationObserver(records=>{
      if(records.some(record=>record.type==='attributes'&&record.attributeName==='data-viewer-role')){
        scheduleFacing();
        if(isDm())global.requestAnimationFrame(enforceDmView);
      }
    });
    state.roleObserver.observe(game,{attributes:true,attributeFilter:['data-viewer-role']});
    return true;
  }

  function start(){
    patchRuntime();observeRole();observeFacing();scheduleFacing();if(isDm())enforceDmView();
    if(state.roleTimer)return true;
    let tries=0;
    state.roleTimer=global.setInterval(()=>{
      tries+=1;patchRuntime();observeRole();observeFacing();scheduleFacing();
      const role=adapterState()?.role||host()?.dataset?.viewerRole||'';
      if(role==='dm')enforceDmView();
      if(role||tries>=120){global.clearInterval(state.roleTimer);state.roleTimer=null}
    },100);
    return true;
  }

  function stop(){
    state.roleObserver?.disconnect?.();state.roleObserver=null;
    state.facingObserver?.disconnect?.();state.facingObserver=null;
    if(state.facingFrame)global.cancelAnimationFrame?.(state.facingFrame);state.facingFrame=0;
    if(state.roleTimer)global.clearInterval(state.roleTimer);state.roleTimer=null;
  }

  global.addEventListener('resize',()=>{scheduleFacing();if(isDm())global.requestAnimationFrame(enforceDmView)});
  global.addEventListener('luminous:combat073-runtime-ready',()=>{patchRuntime();observeFacing();scheduleFacing();if(isDm())enforceDmView()});
  global.addEventListener('luminous:combat073-hydrated',()=>{observeFacing();scheduleFacing();if(isDm())enforceDmView()});
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatDmObserver073=Object.freeze({state,start,stop,isDm,enforceDmView,clearObserverRestrictions,ensureVisualSurface,tuneRenderer,patchRuntime,sourceFacing,desiredFacing,applyLimbusFacing});
  start();
})(window);
