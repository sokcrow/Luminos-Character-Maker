(function(global){
  'use strict';
  if(global.LuminousDmOnGameCombatViewer)return;

  const state={frame:null,module:null,status:null,timer:null,observer:null,last:null,version:'1.0.0'};
  const BATTLE_SRC='Battle-viewer.html?dm_on_game=821';

  function active(){
    return Boolean(state.module?.classList?.contains?.('active-module'));
  }

  function ensureStatus(){
    if(state.status?.isConnected)return state.status;
    const host=global.document?.querySelector?.('.status-container');
    if(!host)return null;
    let node=global.document.getElementById('dm-on-game-combat-status');
    if(!node){
      node=global.document.createElement('span');
      node.id='dm-on-game-combat-status';
      node.style.cssText="font:700 10px 'Share Tech Mono',monospace;color:#e6c56c;letter-spacing:.05em;white-space:nowrap";
      node.textContent='COMBAT DM · ESPERANDO';
      host.appendChild(node);
    }
    state.status=node;
    return node;
  }

  function setStatus(text,tone='wait'){
    const node=ensureStatus();if(!node)return;
    node.textContent=text;
    node.style.color=tone==='ok'?'#7aff9b':tone==='error'?'#ff6575':'#e6c56c';
  }

  function ensureFrameLoaded(){
    if(!state.frame||!active())return false;
    const src=state.frame.getAttribute('src')||'';
    if(!src||src==='about:blank'){
      state.frame.src=BATTLE_SRC;
      setStatus('COMBAT DM · CARGANDO BATTLE');
    }
    return true;
  }

  function visible(child,node,field){
    if(!node)return false;
    try{
      if(node.tagName==='IMG'&&(!node.complete||Number(node.naturalWidth||0)<=0||Number(node.naturalHeight||0)<=0))return false;
      const rect=node.getBoundingClientRect();
      if(rect.width<=2||rect.height<=2)return false;
      const fieldRect=field?.getBoundingClientRect?.();
      if(fieldRect&&(rect.right<=fieldRect.left||rect.left>=fieldRect.right||rect.bottom<=fieldRect.top||rect.top>=fieldRect.bottom))return false;
      let current=node;
      for(let depth=0;current&&depth<10;depth+=1,current=current.parentElement){
        const style=child.getComputedStyle(current);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)===0||current.hidden)return false;
        if(current===field)break;
      }
      return true;
    }catch(_){return false}
  }

  function force(child,game){
    if(!child||!game)return false;
    try{
      child.LuminousCombatDmObserver073?.enforceDmView?.();
      child.LuminousCombatDmObserver073?.ensureVisualSurface?.();
      game.classList?.remove?.('player-blinded','webgl2-background-ready','intro-running');
      game.style.visibility='visible';
      game.style.opacity='1';
      game.dataset.dmVisualMode='dom-base-webgl-vfx';
      const transition=child.document?.getElementById?.('turn-transition');
      if(transition){
        transition.classList?.remove?.('active');
        transition.style.pointerEvents='none';
        transition.style.opacity='0';
        transition.style.visibility='hidden';
      }
      game.querySelectorAll?.('.sprite-container')?.forEach?.(node=>{
        node.hidden=false;node.style.visibility='visible';node.style.opacity='1';
      });
      game.querySelectorAll?.('.sprite-img')?.forEach?.(node=>{
        node.hidden=false;node.classList?.remove?.('webgl2-texture-backed');node.style.visibility='visible';node.style.opacity='1';
      });
      child.LuminousCombat073?.camera?.('full',false);
      child.LuminousWebGL2Renderer?.requestRender?.(500);
      return true;
    }catch(error){
      console.error('[DM ON GAME Combat] recovery failed',error);
      return false;
    }
  }

  function inspect(){
    if(!active()){
      setStatus('COMBAT DM · EN PAUSA');
      return false;
    }
    ensureFrameLoaded();
    let child,doc;
    try{child=state.frame?.contentWindow;doc=state.frame?.contentDocument||child?.document}catch(_){return false}
    if(!child||!doc)return false;

    const bootstrap=child.LuminousCombatBootstrapState||null;
    if(bootstrap?.error){
      setStatus(`COMBAT DM · BOOT ERROR · ${bootstrap.error}`,'error');
      state.last={ok:false,reason:'bootstrap',bootstrap:{...bootstrap}};
      return false;
    }

    const game=doc.getElementById('game-container');
    const field=doc.getElementById('battlefield');
    if(!game||!field){
      setStatus(`COMBAT DM · ${String(bootstrap?.stage||'CARGANDO').toUpperCase()}`);
      return false;
    }

    const role=child.LuminousCombatLiveAdapter073?.state?.role||game.dataset.viewerRole||'';
    if(role!=='dm'){
      setStatus(`COMBAT DM · IDENTIDAD ${role||'PENDIENTE'}`,'error');
      state.last={ok:false,reason:'role',role};
      return false;
    }

    force(child,game);

    const combatants=Object.values(child.LuminousCombat073?.combatants?.()||{}).filter(unit=>unit?.battleActive!==false&&!unit?.isBackup);
    let sprites=Array.from(game.querySelectorAll('.sprite-img'));
    let visibleCount=sprites.filter(node=>visible(child,node,field)).length;

    if(combatants.length&&visibleCount<combatants.length){
      try{child.LuminousCombat073?.render?.()}catch(error){
        console.error('[DM ON GAME Combat] render recovery failed',error);
      }
      force(child,game);
      sprites=Array.from(game.querySelectorAll('.sprite-img'));
      visibleCount=sprites.filter(node=>visible(child,node,field)).length;
    }

    const fieldRect=field.getBoundingClientRect();
    const transition=doc.getElementById('turn-transition');
    const transitionStyle=transition?child.getComputedStyle(transition):null;
    const blocked=Boolean(
      game.classList.contains('intro-running')||
      (transition?.classList?.contains('active')&&transitionStyle?.display!=='none'&&transitionStyle?.visibility!=='hidden'&&Number(transitionStyle?.opacity||1)!==0)
    );
    const measurable=fieldRect.width>100&&fieldRect.height>100;
    const ok=Boolean(measurable&&!blocked&&(combatants.length===0||visibleCount>=combatants.length));
    state.last={ok,role,combatants:combatants.length,sprites:sprites.length,visibleCount,blocked,width:fieldRect.width,height:fieldRect.height,bootstrapStage:bootstrap?.stage||''};
    state.frame.dataset.dmCombatVisual=ok?'ready':'recovering';
    if(ok)setStatus(`COMBAT DM · ${visibleCount}/${combatants.length} VISIBLE`,'ok');
    else setStatus(`COMBAT DM · RECUPERANDO ${visibleCount}/${combatants.length}`,'error');
    return ok;
  }

  function start(){
    state.module=global.document?.getElementById?.('modulo-combate')||null;
    state.frame=global.document?.getElementById?.('dm-combat-view')||null;
    if(!state.module||!state.frame)return false;
    state.frame.dataset.src=BATTLE_SRC;
    ensureStatus();
    state.frame.addEventListener('load',()=>{global.setTimeout(inspect,0);global.setTimeout(inspect,250);global.setTimeout(inspect,900)});
    state.observer=new MutationObserver(()=>{if(active()){ensureFrameLoaded();global.setTimeout(inspect,0)}});
    state.observer.observe(state.module,{attributes:true,attributeFilter:['class']});
    global.addEventListener('resize',()=>global.setTimeout(inspect,50));
    state.timer=global.setInterval(inspect,750);
    if(active()){ensureFrameLoaded();inspect()}
    return true;
  }

  global.LuminousDmOnGameCombatViewer=Object.freeze({version:state.version,state,start,inspect,force,ensureFrameLoaded});
  if(global.document?.readyState==='loading')global.document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})(window);
