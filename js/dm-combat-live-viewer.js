(function(global){
  'use strict';
  if(global.LuminousDmCombatLiveViewer)return;

  const state={mounted:false,host:null,panel:null,frame:null,status:null,observer:null,tabButton:null,retryTimers:[],loaded:false,loading:false,visualFallback:false,lastProbe:null,lastBootstrap:null,encounterModal:null,encounterBusy:false};
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

  function bootstrapState(){
    const child=state.frame?.contentWindow;
    if(!child)return null;
    try{
      const raw=child.LuminousCombatBootstrapState||null;
      if(!raw)return null;
      const result={stage:String(raw.stage||''),detail:String(raw.detail||''),error:raw.error?String(raw.error):null,updatedAt:Number(raw.updatedAt)||0};
      state.lastBootstrap=result;
      return result;
    }catch(_){return null}
  }

  function visibleNode(child,node){
    if(!node)return false;
    try{
      if(node.tagName==='IMG'&&(node.complete===false||Number(node.naturalWidth||0)<=0||Number(node.naturalHeight||0)<=0))return false;
      const field=child.document?.getElementById?.('battlefield')||null;
      const fieldRect=field?.getBoundingClientRect?.()||null;
      const rect=node.getBoundingClientRect?.()||{width:0,height:0,left:0,right:0,top:0,bottom:0};
      if(rect.width<=2||rect.height<=2)return false;
      if(fieldRect){
        const intersects=rect.right>fieldRect.left&&rect.left<fieldRect.right&&rect.bottom>fieldRect.top&&rect.top<fieldRect.bottom;
        if(!intersects)return false;
      }
      let current=node;
      for(let depth=0;current&&depth<10;depth+=1,current=current.parentElement){
        const style=child.getComputedStyle?.(current)||{};
        const opacity=Number(style.opacity??current.style?.opacity??1);
        if(style.display==='none'||style.visibility==='hidden'||opacity===0||current.hidden===true)return false;
        if(current===field)break;
      }
      return true;
    }catch(_){return false}
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
      const combatants=child.LuminousCombat073?.combatants?.()||{};
      const combatantCount=Array.isArray(combatants)?combatants.length:Object.keys(combatants||{}).length;
      const sprites=Array.from(game?.querySelectorAll?.('.sprite-img')||[]);
      const visibleSpriteCount=sprites.filter(node=>visibleNode(child,node)).length;
      const visualMode=String(game?.dataset?.dmVisualMode||game?.dataset?.dmVisualFallback||'');
      const measurable=Boolean(game&&field&&gameRect.width>100&&gameRect.height>100&&fieldRect.width>100&&fieldRect.height>100);
      const domBaseReady=Boolean(game&&visualMode==='dom-base-webgl-vfx'&&!game.classList?.contains?.('webgl2-background-ready'));
      const turnTransition=child.document?.getElementById?.('turn-transition')||null;
      const transitionStyle=turnTransition?child.getComputedStyle?.(turnTransition):null;
      const transitionBlocking=Boolean(turnTransition&&turnTransition.classList?.contains?.('active')&&transitionStyle?.display!=='none'&&transitionStyle?.visibility!=='hidden'&&Number(transitionStyle?.opacity??1)!==0);
      const introBlocking=Boolean(game?.classList?.contains?.('intro-running'));
      const spriteEvidence=combatantCount===0||visibleSpriteCount>=combatantCount;
      const bootstrap=bootstrapState();
      const hydrated=bootstrap?.stage==='hydrated'||Boolean(role&&game);
      const visualEvidence=Boolean(measurable&&role==='dm'&&hydrated&&domBaseReady&&spriteEvidence&&!transitionBlocking&&!introBlocking);
      const result={child,game,field,renderer,role,gameRect,fieldRect,surfaceActive,combatantCount,visibleSpriteCount,visualMode,measurable,domBaseReady,transitionBlocking,introBlocking,spriteEvidence,bootstrap,hydrated,visualEvidence,ready:visualEvidence};
      state.lastProbe=result;
      return result;
    }catch(_){return null}
  }

  function forceDomFallback(surface){
    if(!surface?.game)return false;
    const game=surface.game;
    try{surface.child.LuminousCombatDmObserver073?.ensureVisualSurface?.()}catch(_){}
    game.classList?.remove?.('player-blinded','webgl2-background-ready','intro-running');
    const turnTransition=surface.child.document?.getElementById?.('turn-transition');
    if(turnTransition){
      turnTransition.classList?.remove?.('active');
      turnTransition.style.pointerEvents='none';
      turnTransition.style.opacity='0';
      turnTransition.style.visibility='hidden';
    }
    game.style.visibility='visible';
    game.style.opacity='1';
    game.querySelectorAll?.('.sprite-img.webgl2-texture-backed')?.forEach?.(img=>img.classList.remove('webgl2-texture-backed'));
    game.querySelectorAll?.('.sprite-container')?.forEach?.(token=>{
      token.hidden=false;
      token.classList?.remove?.('invisible-hidden','invisible-detected','blindness-self','blindness-enemy','blindness-other');
      token.style.visibility='visible';token.style.opacity='1';
    });
    game.querySelectorAll?.('.sprite-img')?.forEach?.(img=>{img.hidden=false;img.style.visibility='visible';img.style.opacity='1'});
    game.dataset.dmVisualMode='dom-base-webgl-vfx';
    delete game.dataset.dmVisualFallback;
    surface.child.LuminousCombat073?.render?.();
    surface.child.LuminousWebGL2Renderer?.setEnabled?.(true);
    surface.child.LuminousWebGL2Renderer?.requestRender?.(260);
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

  function probeLabel(surface){
    if(!surface)return 'sin superficie';
    if(surface.combatantCount>0)return `${surface.combatantCount} combatientes hidratados · ${surface.visibleSpriteCount}/${surface.combatantCount} sprites visibles`;
    return surface.domBaseReady?'campo base visible · 0 combatientes':'campo base pendiente';
  }

  function bootstrapLabel(bootstrap){
    if(!bootstrap)return 'BOOT · esperando estado';
    if(bootstrap.error)return `BOOT ERROR · ${bootstrap.error}`;
    const detail=bootstrap.detail?` · ${bootstrap.detail}`:'';
    return `BOOT · ${String(bootstrap.stage||'unknown').toUpperCase()}${detail}`;
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
      const bootstrap=bootstrapState();
      if(bootstrap?.error){
        setStatus(bootstrapLabel(bootstrap),true);
        return false;
      }
      let surface=childSurface();
      if(!surface?.game){
        setStatus(bootstrapLabel(bootstrap));
        return false;
      }
      if(surface?.surfaceActive===false)pulseSurface(surface);
      if(options.allowFallback&&surface&&!surface.visualEvidence){forceDomFallback(surface);surface=childSurface()||surface}
      if(surface?.ready&&surface?.role==='dm'){
        setStatus(`BATTLE VISIBLE · DOM BASE + WEBGL VFX · ${probeLabel(surface)}`);
        return true;
      }
      if(surface?.role==='dm')setStatus(`DM AUTENTICADO · ${probeLabel(surface)} · corrigiendo superficie…`);
      else if(surface?.role)setStatus(`BATTLE CARGADO · ROL ${String(surface.role).toUpperCase()} · esperando superficie…`);
      else setStatus(`${bootstrapLabel(surface?.bootstrap||bootstrap)} · esperando autenticación DM…`);
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
    delays.forEach((delay,index)=>state.retryTimers.push(global.setTimeout(()=>{if(isVisible())nudgeBattle({allowFallback:index>=3})},delay)));
    return true;
  }

  function reload(){
    if(!state.frame)return false;
    clearRetries();state.loaded=false;state.loading=false;state.visualFallback=false;state.lastProbe=null;
    state.lastBootstrap=null;
    setStatus('RECARGANDO BATTLE VISIBLE…');
    state.frame.src='about:blank';
    global.setTimeout(()=>{if(isVisible()){state.loading=false;ensureLoaded()}},0);
    return true;
  }

  function encounterApi(){
    const child=state.frame?.contentWindow;
    try{
      const api=child?.LuminousBattleViewerDmConsole074||null;
      return api&&typeof api.finishEncounter==='function'?api:null;
    }catch(_){return null}
  }

  function setEncounterBusy(busy){
    state.encounterBusy=Boolean(busy);
    for(const id of ['dm-combat-end-victory','dm-combat-end-defeat','dm-combat-end-cancel']){
      const button=global.document?.getElementById?.(id);
      if(button)button.disabled=state.encounterBusy;
    }
    const endButton=global.document?.getElementById?.('dm-combat-end-encounter');
    if(endButton)endButton.disabled=state.encounterBusy;
  }

  function ensureEncounterModal(){
    if(state.encounterModal&&global.document?.getElementById?.('dm-combat-end-modal'))return state.encounterModal;
    const doc=global.document;if(!doc?.body)return null;
    const modal=doc.createElement('div');
    modal.id='dm-combat-end-modal';
    modal.hidden=true;
    modal.setAttribute?.('role','dialog');
    modal.setAttribute?.('aria-modal','true');
    modal.setAttribute?.('aria-labelledby','dm-combat-end-title');
    modal.style.cssText='position:fixed;inset:0;z-index:2147482500;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);';
    modal.innerHTML=`
      <section style="width:min(560px,calc(100vw - 32px));background:#0b0908;border:1px solid #8d6b38;box-shadow:0 22px 70px rgba(0,0,0,.75);padding:22px;box-sizing:border-box;color:#eee;font-family:system-ui,sans-serif">
        <div style="font-size:11px;letter-spacing:.18em;color:#a28a63;margin-bottom:6px">COMBAT CONTROL</div>
        <h2 id="dm-combat-end-title" style="margin:0 0 10px;color:#e2bd70;font-size:28px;letter-spacing:.05em">END ENCOUNTER</h2>
        <p style="margin:0;color:#c8c0b2;line-height:1.5;font-size:14px">Elige cómo termina el combate. Esto cerrará el Encounter para todos los jugadores, mostrará el resultado y enviará la sesión a Theater.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px">
          <button id="dm-combat-end-victory" type="button" style="min-height:54px;border:1px solid #6d9b61;background:#142014;color:#d6f1cf;font-weight:800;font-size:16px;letter-spacing:.08em;cursor:pointer">VICTORY</button>
          <button id="dm-combat-end-defeat" type="button" style="min-height:54px;border:1px solid #a94c42;background:#24100e;color:#ffd0ca;font-weight:800;font-size:16px;letter-spacing:.08em;cursor:pointer">DEFEAT</button>
        </div>
        <button id="dm-combat-end-cancel" type="button" style="width:100%;margin-top:12px;min-height:42px;border:1px solid #4b4337;background:#12100d;color:#bbb;cursor:pointer">CANCEL</button>
      </section>`;
    doc.body.appendChild(modal);
    state.encounterModal=modal;
    const victory=doc.getElementById?.('dm-combat-end-victory');
    const defeat=doc.getElementById?.('dm-combat-end-defeat');
    const cancel=doc.getElementById?.('dm-combat-end-cancel');
    if(victory&&!victory.dataset.bound){victory.dataset.bound='true';victory.addEventListener('click',()=>finishEncounterFromUi('victory'))}
    if(defeat&&!defeat.dataset.bound){defeat.dataset.bound='true';defeat.addEventListener('click',()=>finishEncounterFromUi('defeat'))}
    if(cancel&&!cancel.dataset.bound){cancel.dataset.bound='true';cancel.addEventListener('click',closeEncounterModal)}
    modal.addEventListener?.('click',event=>{if(event?.target===modal)closeEncounterModal()});
    return modal;
  }

  function openEncounterModal(){
    ensureLoaded();
    const modal=ensureEncounterModal();
    if(!modal)return false;
    modal.hidden=false;
    modal.style.display='flex';
    global.document?.getElementById?.('dm-combat-end-victory')?.focus?.();
    return true;
  }

  function closeEncounterModal(){
    const modal=state.encounterModal||global.document?.getElementById?.('dm-combat-end-modal');
    if(!modal||state.encounterBusy)return false;
    modal.hidden=true;
    modal.style.display='none';
    return true;
  }

  async function finishEncounterFromUi(result){
    if(state.encounterBusy)return false;
    const normalized=String(result||'').trim().toLowerCase();
    if(normalized!=='victory'&&normalized!=='defeat')return false;
    ensureLoaded();
    const api=encounterApi();
    if(!api){
      setStatus('COMBATE AÚN ESTÁ CARGANDO',true);
      scheduleNudges();
      return false;
    }
    setEncounterBusy(true);
    try{
      setStatus(normalized==='victory'?'CERRANDO ENCOUNTER · VICTORY…':'CERRANDO ENCOUNTER · DEFEAT…');
      await api.finishEncounter(normalized,{confirm:false});
      const modal=state.encounterModal||global.document?.getElementById?.('dm-combat-end-modal');
      if(modal){modal.hidden=true;modal.style.display='none'}
      return true;
    }catch(error){
      console.error('[DM Combat Live Viewer] Encounter end failed',error);
      setStatus('NO SE PUDO CERRAR EL ENCOUNTER',true);
      return false;
    }finally{
      setEncounterBusy(false);
    }
  }

  function mount(){
    if(state.mounted)return true;
    const host=combatTab();if(!host)return false;state.host=host;
    let panel=global.document.getElementById('dm-combat-live-battle');
    if(!panel){
      panel=global.document.createElement('section');panel.id='dm-combat-live-battle';panel.dataset.canonicalBattleViewer='true';
      panel.style.cssText='width:min(1600px,calc(100% - 24px));max-width:1600px;align-self:center;box-sizing:border-box;margin:20px auto 24px;border:1px solid #7c6338;background:#050507;box-shadow:0 12px 30px rgba(0,0,0,.55);overflow:hidden;';
      panel.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#0d0b09;border-bottom:1px solid #4d4029;color:#ddb765;font:700 12px system-ui;letter-spacing:.08em"><span style="flex:1">BATTLE LIVE · DM</span><span id="dm-combat-live-status" style="color:#c7b98f;font-weight:600;letter-spacing:0">ABRE COMBATE PARA CARGAR BATTLE</span><button id="dm-combat-end-encounter" type="button" style="border:1px solid #a94c42;background:#24100e;color:#ffd0ca;padding:6px 11px;cursor:pointer;font-weight:800;letter-spacing:.06em">END ENCOUNTER</button><button id="dm-combat-live-reload" type="button" style="border:1px solid #77613b;background:#18130c;color:#e4c981;padding:5px 9px;cursor:pointer">RECARGAR</button></div><iframe id="dm-combat-live-frame" title="Battle Viewer DM" src="about:blank" data-battle-src="Battle-viewer.html" style="display:block;width:100%;height:clamp(560px,72vh,900px);min-height:560px;border:0;background:#050010;visibility:visible" allow="autoplay"></iframe>`;
      host.insertBefore(panel,host.firstChild);
    }
    state.panel=panel;state.frame=global.document.getElementById('dm-combat-live-frame');state.status=global.document.getElementById('dm-combat-live-status');
    const reloadButton=global.document.getElementById('dm-combat-live-reload');
    if(reloadButton&&!reloadButton.dataset.bound){reloadButton.dataset.bound='true';reloadButton.addEventListener('click',reload)}
    const endEncounterButton=global.document.getElementById('dm-combat-end-encounter');
    if(endEncounterButton&&!endEncounterButton.dataset.bound){endEncounterButton.dataset.bound='true';endEncounterButton.addEventListener('click',openEncounterModal)}
    ensureEncounterModal();
    if(state.frame&&!state.frame.dataset.dmLiveBound){
      state.frame.dataset.dmLiveBound='true';
      state.frame.addEventListener('load',()=>{
        const current=String(state.frame?.getAttribute?.('src')||state.frame?.src||'');
        if(!current||current==='about:blank')return;
        state.loading=false;state.loaded=true;setStatus('BATTLE CARGADO · verificando evidencia visual…');scheduleNudges();
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
    global.addEventListener?.('message',event=>{
      if(event?.origin!==global.location?.origin||event?.data?.type!=='luminous:combat-bootstrap')return;
      state.lastBootstrap={stage:String(event.data.stage||''),detail:String(event.data.detail||''),error:event.data.error?String(event.data.error):null,updatedAt:Date.now()};
      if(isVisible()){
        if(state.lastBootstrap.error)setStatus(bootstrapLabel(state.lastBootstrap),true);
        else if(!childSurface()?.ready)setStatus(bootstrapLabel(state.lastBootstrap));
      }
    });
    state.mounted=true;
    if(isVisible()){ensureLoaded();scheduleNudges()}
    return true;
  }
  function start(){if(mount())return true;if(global.document?.readyState==='loading')global.document.addEventListener('DOMContentLoaded',mount,{once:true});else global.setTimeout(mount,0);return false}
  function stop(){clearRetries();state.observer?.disconnect?.();state.observer=null}

  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousDmCombatLiveViewer=Object.freeze({version:'1.5.0-encounter-controls',state,start,mount,ensureLoaded,bootstrapState,visibleNode,childSurface,forceDomFallback,nudgeBattle,scheduleNudges,reload,isVisible,encounterApi,ensureEncounterModal,openEncounterModal,closeEncounterModal,finishEncounterFromUi});
  start();
})(window);
