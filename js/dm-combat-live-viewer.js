(function(global){
  'use strict';
  if(global.LuminousDmCombatLiveViewer)return;

  const state={mounted:false,host:null,panel:null,frame:null,status:null,observer:null,tabButton:null,retryTimers:[]};

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
    try{const style=global.getComputedStyle?.(host);return style?.display!=='none'&&style?.visibility!=='hidden'&&host.getBoundingClientRect().width>2&&host.getBoundingClientRect().height>2}catch(_){return true}
  }
  function clearRetries(){state.retryTimers.splice(0).forEach(id=>global.clearTimeout(id))}
  function nudgeBattle(){
    const frame=state.frame;
    if(!frame?.contentWindow)return false;
    try{
      const child=frame.contentWindow;
      child.LuminousWebGL2Renderer?.setEnabled?.(true);
      child.LuminousCombatDmObserver073?.enforceDmView?.();
      child.LuminousWebGL2Renderer?.requestRender?.();
      child.dispatchEvent?.(new child.Event('resize'));
      const role=child.LuminousCombatLiveAdapter073?.state?.role||child.document?.getElementById?.('game-container')?.dataset?.viewerRole||'';
      if(role==='dm')setStatus('BATTLE LIVE · DM OBSERVER');
      else if(role)setStatus(`BATTLE CARGADO · ROL ${String(role).toUpperCase()}`);
      else setStatus('BATTLE CARGADO · esperando autenticación DM…');
      return true;
    }catch(error){
      console.error('[DM Combat Live Viewer] redraw failed',error);
      setStatus('BATTLE CARGADO · no se pudo forzar redraw',true);
      return false;
    }
  }
  function scheduleNudges(){
    clearRetries();
    [0,120,400,1000,2200].forEach(delay=>state.retryTimers.push(global.setTimeout(()=>{if(isVisible())nudgeBattle()},delay)));
  }
  function reload(){
    if(!state.frame)return false;
    setStatus('RECARGANDO BATTLE…');
    const src=state.frame.getAttribute('src')||'Battle-viewer.html';
    state.frame.src='about:blank';
    global.setTimeout(()=>{if(state.frame)state.frame.src=src==='about:blank'?'Battle-viewer.html':src},0);
    return true;
  }
  function mount(){
    if(state.mounted)return true;
    const host=combatTab();
    if(!host)return false;
    state.host=host;

    let panel=global.document.getElementById('dm-combat-live-battle');
    if(!panel){
      panel=global.document.createElement('section');
      panel.id='dm-combat-live-battle';
      panel.dataset.canonicalBattleViewer='true';
      panel.style.cssText='margin:20px 0 24px;border:1px solid #7c6338;background:#050507;box-shadow:0 12px 30px rgba(0,0,0,.55);overflow:hidden;';
      panel.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#0d0b09;border-bottom:1px solid #4d4029;color:#ddb765;font:700 12px system-ui;letter-spacing:.08em"><span style="flex:1">BATTLE LIVE · DM OBSERVER</span><span id="dm-combat-live-status" style="color:#c7b98f;font-weight:600;letter-spacing:0">CARGANDO BATTLE…</span><button id="dm-combat-live-reload" type="button" style="border:1px solid #77613b;background:#18130c;color:#e4c981;padding:5px 9px;cursor:pointer">RECARGAR</button></div><iframe id="dm-combat-live-frame" title="Battle Viewer DM" src="Battle-viewer.html" loading="eager" style="display:block;width:100%;height:clamp(560px,72vh,900px);min-height:560px;border:0;background:#050010" allow="autoplay"></iframe>`;
      host.insertBefore(panel,host.firstChild);
    }
    state.panel=panel;
    state.frame=global.document.getElementById('dm-combat-live-frame');
    state.status=global.document.getElementById('dm-combat-live-status');
    const reloadButton=global.document.getElementById('dm-combat-live-reload');
    if(reloadButton&&!reloadButton.dataset.bound){reloadButton.dataset.bound='true';reloadButton.addEventListener('click',reload)}
    if(state.frame&&!state.frame.dataset.dmLiveBound){
      state.frame.dataset.dmLiveBound='true';
      state.frame.addEventListener('load',()=>{setStatus('BATTLE CARGADO · sincronizando DM…');scheduleNudges()});
      state.frame.addEventListener('error',()=>setStatus('BATTLE NO PUDO CARGAR',true));
    }

    state.tabButton=global.document.querySelector('[data-tab="tab-combate"]');
    if(state.tabButton&&!state.tabButton.dataset.dmLiveBound){
      state.tabButton.dataset.dmLiveBound='true';
      state.tabButton.addEventListener('click',()=>global.setTimeout(scheduleNudges,0));
    }
    if(global.MutationObserver){
      state.observer=new global.MutationObserver(()=>{if(isVisible())scheduleNudges()});
      state.observer.observe(host,{attributes:true,attributeFilter:['class','style','aria-hidden']});
    }
    global.addEventListener('resize',()=>{if(isVisible())nudgeBattle()},{passive:true});
    global.addEventListener('focus',()=>{if(isVisible())scheduleNudges()});
    state.mounted=true;
    if(isVisible())scheduleNudges();
    return true;
  }
  function start(){
    if(mount())return true;
    if(global.document?.readyState==='loading')global.document.addEventListener('DOMContentLoaded',mount,{once:true});
    else global.setTimeout(mount,0);
    return false;
  }
  function stop(){clearRetries();state.observer?.disconnect?.();state.observer=null}

  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousDmCombatLiveViewer=Object.freeze({version:'1.0.0',state,start,mount,nudgeBattle,scheduleNudges,reload,isVisible});
  start();
})(window);
