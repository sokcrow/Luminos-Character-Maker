(function(global){
  'use strict';
  if(global.LuminousCombatDmObserver073)return;

  const state={patched:false,rendererDisabled:false,roleObserver:null,roleTimer:null};

  function adapterState(){return global.LuminousCombatLiveAdapter073?.state||null}
  function host(){return global.document?.getElementById?.('game-container')||null}
  function isDm(){return adapterState()?.role==='dm'||host()?.dataset?.viewerRole==='dm'}

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

  function tuneRenderer(){
    const renderer=global.LuminousWebGL2Renderer;
    if(!renderer?.setEnabled)return false;
    if(isDm()){
      if(renderer.isEnabled?.()!==false)renderer.setEnabled(false);
      state.rendererDisabled=true;
    }else if(state.rendererDisabled){
      renderer.setEnabled(true);
      state.rendererDisabled=false;
    }
    return true;
  }

  function enforceDmView(){
    if(!isDm())return false;
    clearObserverRestrictions();
    try{global.LuminousCombat073?.camera?.('full',false)}catch(error){console.error('[Combat073 DM Observer] camera failed',error)}
    tuneRenderer();
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
        if(isDm())global.requestAnimationFrame(enforceDmView);
        else tuneRenderer();
      }
    });
    state.roleObserver.observe(game,{attributes:true,attributeFilter:['data-viewer-role']});
    return true;
  }

  function start(){
    patchRuntime();
    observeRole();
    if(isDm())enforceDmView();
    if(state.roleTimer)return true;
    let tries=0;
    state.roleTimer=global.setInterval(()=>{
      tries+=1;
      patchRuntime();
      observeRole();
      const role=adapterState()?.role||host()?.dataset?.viewerRole||'';
      if(role==='dm')enforceDmView();
      if(role||tries>=120){global.clearInterval(state.roleTimer);state.roleTimer=null}
    },100);
    return true;
  }

  function stop(){
    state.roleObserver?.disconnect?.();state.roleObserver=null;
    if(state.roleTimer)global.clearInterval(state.roleTimer);
    state.roleTimer=null;
  }

  global.addEventListener('resize',()=>{if(isDm())global.requestAnimationFrame(enforceDmView)});
  global.addEventListener('luminous:combat073-runtime-ready',()=>{patchRuntime();if(isDm())enforceDmView()});
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatDmObserver073=Object.freeze({state,start,stop,isDm,enforceDmView,clearObserverRestrictions,tuneRenderer,patchRuntime});
  start();
})(window);
