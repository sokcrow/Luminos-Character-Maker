(function(global){
  'use strict';
  if(global.LuminousDmCombatLiveViewer)return;

  const state={mounted:false,host:null,panel:null,frame:null,status:null,observer:null,tabButton:null,retryTimers:[],loaded:false,loading:false,visualFallback:false};
  const BATTLE_SRC='Battle-viewer.html';

  function combatTab(){return global.document?.getElementById?.('tab-combate')||null}
  function setStatus(text,bad=false){
    const node=state.status||global.document?.getElementById?.('dm-combat-live-status');
    if(!node)return;
    node.textContent=text;
    node.style.color=bad?'#ff7b6b':'#9fd6a8';
  }
  function isVisible(){
    const host=state.host||combatTab();
    if(!host)return false;
    try{const style=global.getComputedStyle?.(host),rect=host.getBoundingClientRect();return style?.display!=='none'&&style?.visibility!=='hidden'&&rect.width>2&&rect.height>2}catch(_){return true}
  }
  function clearRetries(){state.retryTimers.splice(0).forEach(id=>global.clearTimeout(id))}

  function ensureLoaded(){
    const frame=state.frame;
    if(!frame||!isVisible())return false;
    const current=String(frame.getAttribute?.('src')||frame.src||'');
    if(current&&current!=='about:blank'&&current.includes('Battle-viewer.html'))return true;
    if(state.loading)return true;
    state.loading=true;
    setStatus('ABRIENDO BATTLE VISIBLE…');
    frame.src=BATTLE_SRC;
    return true;
  }

  function childSurface(){
    const child=state.frame?.contentWindow;if(!child)return null;
    try{
      const game=child.document?.getElementById?.('game-container')||null;
      const field=child.document?.getElementById?.('battlefield')||null;
      const gameRect=game?.getBoundingClientRect?.()||{width:0,height:0};
      const fieldRect=field?.getBoundingClientRect?.()||{width:0,height:0};
      const renderer=child.LuminousWebGL2Renderer||null;
      const surfaceActive=renderer?.surfaceActive?.();
      const role=child.LuminousCombatLiveAdapter073?.state?.role||game?.dataset?.viewerRole||'';
      return {child,game,field,renderer,role,gameRect,fieldRect,surfaceActive,ready:Boolean(game&&field&&gameRect.width>100&&gameRect.height>100&&fieldRect.width>100&&fieldRect.height>100&&surfaceActive!==false)};
    }catch(_){return null}
  }

  function forceDomFallback(surface){
    if(!surface?.game)return false;
    const game=surface.game;
    game.classList?.remove?.('player-blinded','webgl2-background-ready');
    game.style.visibility='visible';
    game.style.opacity='1';
    game.querySelectorAll?.('.sprite-img.webgl2-texture-backed')?.forEach?.(img=>img.classList.remove('webgl2-texture-backed'));
    game.dataset.dmVisualFallback='dom';
    surface.child.LuminousCombat073?.render?.();
    surface.child.LuminousWebGL2Renderer?.requestRender?.(220);
    state.visualFallback=true;
    return true;
  }

  function pulseSurface(surface){
    if(!state.frame||!surface||surface.surfaceActive!==false)return false;
    state.frame.style.visibility='hidden';
    global.requestAnimationFrame?.(()=>{
      if(!state.frame)return;
      state.frame.style.visibility='visible';
      try{surface.child.dispatchEvent?.(new surface.child.Event('resize'));surface.child.LuminousWebGL2Renderer?.requestRender?.(260)}catch(_){}
    });
    return true;
  }

  function nudgeBattle(options={}){
    if(!isVisible()){setStatus('BATTLE EN PAUSA · abre la pestaña Combate');return false}
    ensureLoaded();
    const frame=state.frame;if(!frame?.contentWindow)return false;
    try{
      const child=frame.contentWindow;
      child.LuminousWebGL2Renderer?.setEnabled?.(true);
      child.LuminousCombatDmObserver073?.enforceDmView?.();
      child.LuminousCombatDmObserver073?.ensureVisualSurface?.();
      child.LuminousWebGL2Renderer?.requestRender?.(260);
      child.dispatchEvent?.(new child.Event('resize'));
      let surface=childSurface();
      if(surface?.surfaceActive===false)pulseSurface(surface);
      if(options.allowFallback&&surface&&!surface.ready){forceDomFallback(surface);surface=childSurface()||surface}
      if(surface?.ready){
        setStatus(state.visualFallback?'BATTLE VISIBLE · DOM FALLBACK':'BATTLE VISIBLE · DM OBSERVER');
        return true;
      }
      if(surface?.role==='dm')setStatus('DM AUTENTICADO · esperando superficie visual…');
      else if(surface?.role)setStatus(`BATTLE CARGADO · ROL ${String(surface.role).toUpperCase()} · esperando superficie…`);
      else setStatus('BATTLE CARGADO · esperando autenticación DM…');
      return false;
    }catch(error){
      console.error('[DM Combat Live Viewer] visual wake failed',error);
      setStatus('BATTLE CARGADO · fallo al despertar superficie visual',true);
      return false;
    }
  }

  function scheduleNudges(){
    if(!isVisible())return false;
    ensureLoaded();clearRetries();
    const delays=[0,100,350,800,1600,3200,6000];
    delays.forEach((delay,index)=>state.retryTimers.push(global.setTimeout(()=>{if(isVisible())nudgeBattle({allowFallback:index===delays.length-1})},delay)));
    return true;
  }

  function reload(){
    if(!state.frame)return false;
    clearRetries();state.loaded=false;state.loading=false;state.visualFallback=false;
    setStatus('RECARGANDO BATTLE VISIBLE…');
    state.frame.src='about:blank';
    global.setTimeout(()=>{if(isVisible()){state.loading=false;ensureLoaded()}},0);
    return true;
  }

  function mount(){
    if(state.mounted)return true;
    const host=combatTab();if(!host)return false;state.host=host;
    let panel=global.document.getElementById('dm-combat-live-battle');
    if(!panel){
      panel=global.document.createElement('section');panel.id='dm-combat-live-battle';panel.dataset.canonicalBattleViewer='true';
      panel.style.cssText='width:min(1600px,calc(100% - 24px));max-width:1600px;align-self:center;box-sizing:border-box;margin:20px auto 24px;border:1px solid #7c6338;background:#050507;box-shadow:0 12px 30px rgba(0,0,0,.55);overflow:hidden;';
      panel.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#0d0b09;border-bottom:1px solid #4d4029;color:#ddb765;font:700 12px system-ui;letter-spacing:.08em"><span style="flex:1">BATTLE LIVE · DM OBSERVER</span><span id="dm-combat-live-status" style="color:#c7b98f;font-weight:600;letter-spacing:0">ABRE COMBATE PARA CARGAR BATTLE</span><button id="dm-combat-live-reload" type="button" style="border:1px solid #77613b;background:#18130c;color:#e4c981;padding:5px 9px;cursor:pointer">RECARGAR</button></div><iframe id="dm-combat-live-frame" title="Battle Viewer DM" src="about:blank" data-battle-src="Battle-viewer.html" style="display:block;width:100%;height:clamp(560px,72vh,900px);min-height:560px;border:0;background:#050010;visibility:visible" allow="autoplay"></iframe>`;
      host.insertBefore(panel,host.firstChild);
    }
    state.panel=panel;state.frame=global.document.getElementById('dm-combat-live-frame');state.status=global.document.getElementById('dm-combat-live-status');
    const reloadButton=global.document.getElementById('dm-combat-live-reload');
    if(reloadButton&&!reloadButton.dataset.bound){reloadButton.dataset.bound='true';reloadButton.addEventListener('click',reload)}
    if(state.frame&&!state.frame.dataset.dmLiveBound){
      state.frame.dataset.dmLiveBound='true';
      state.frame.addEventListener('load',()=>{
        const current=String(state.frame?.getAttribute?.('src')||state.frame?.src||'');
        if(!current||current==='about:blank')return;
        state.loading=false;state.loaded=true;setStatus('BATTLE CARGADO · verificando superficie visual…');scheduleNudges();
      });
      state.frame.addEventListener('error',()=>{state.loading=false;setStatus('BATTLE NO PUDO CARGAR',true)});
    }
    state.tabButton=global.document.querySelector('[data-tab="tab-combate"]');
    if(state.tabButton&&!state.tabButton.dataset.dmLiveBound){
      state.tabButton.dataset.dmLiveBound='true';
      state.tabButton.addEventListener('click',()=>global.setTimeout(()=>{ensureLoaded();scheduleNudges()},0));
    }
    if(global.MutationObserver){
      state.observer=new global.MutationObserver(()=>{if(isVisible()){ensureLoaded();scheduleNudges()}});
      state.observer.observe(host,{attributes:true,attributeFilter:['class','style','aria-hidden']});
    }
    global.addEventListener('resize',()=>{if(isVisible())scheduleNudges()},{passive:true});
    global.addEventListener('focus',()=>{if(isVisible())scheduleNudges()});
    state.mounted=true;
    if(isVisible()){ensureLoaded();scheduleNudges()}
    return true;
  }
  function start(){if(mount())return true;if(global.document?.readyState==='loading')global.document.addEventListener('DOMContentLoaded',mount,{once:true});else global.setTimeout(mount,0);return false}
  function stop(){clearRetries();state.observer?.disconnect?.();state.observer=null}

  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousDmCombatLiveViewer=Object.freeze({version:'1.1.0',state,start,mount,ensureLoaded,childSurface,forceDomFallback,nudgeBattle,scheduleNudges,reload,isVisible});
  start();
})(window);
