(function(global){
  'use strict';
  if(global.LuminousDmCombatLiveViewer)return;

  const state={mounted:false,host:null,panel:null,frame:null,status:null,observer:null,tabButton:null,retryTimers:[],loaded:false,loading:false,visualFallback:false,lastProbe:null,lastBootstrap:null,encounterModal:null,encounterBusy:false,returningToTheatre:false,endFailure:null};
  const BATTLE_SRC='Battle-viewer.html?v=20261102-dm-end-recovery-2';

  function combatTab(){return global.document?.getElementById?.('tab-combate')||null}
  function setStatus(text,bad=false){
    // A fresh observer update must not erase the last closing failure.
    if(state.endFailure&&!bad)return;
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

  function endFailureDetails(error, stageOverride){
    const raw=String(error?.message||'');
    const code=String(error?.code||'').toLowerCase();
    const stage=stageOverride||error?.encounterEndStage||'unknown';
    const committed=error?.encounterEndCommitted===true||stage==='theatre';
    const steps={
      loading:'Cargar el combate',state:'Consultar el encuentro',claim:'Iniciar el cierre',
      sanity:'Guardar el estado de los personajes',loot:'Preparar el botín',
      experience:'Repartir experiencia',result:'Confirmar el resultado',theatre:'Regresar a Teatro',
      unknown:'Finalizar el encuentro'
    };
    let reason='',action=committed?'Usa «VOLVER A TEATRO». No vuelvas a repartir recompensas.':'Intenta finalizar de nuevo: los efectos confirmados no se repiten.';
    if(raw==='RESULT_NOT_CONFIRMED'){
      reason='El encuentro todavía no tiene un resultado final confirmado.';
      action='Finaliza el encuentro antes de regresar a Teatro.';
    }else if(code.includes('permission')||raw==='DM_ONLY'){
      reason='No tienes autorización para guardar este paso del combate.';
      action='Usa la cuenta del DM y comprueba los permisos de la campaña.';
    }else if(code.includes('network')||code.includes('unavailable')||code.includes('disconnected')||
      /^(NETWORK_UNAVAILABLE|DISCONNECTED|DATABASE_NOT_READY)$/.test(raw)){
      reason='Se perdió la conexión con la campaña al guardar este paso.';
      action=committed?'Recupera la conexión y pulsa «VOLVER A TEATRO».':'Comprueba tu conexión y vuelve a intentar el cierre.';
    }else if(raw.startsWith('Espera a que termine la ronda')){
      reason='Todavía hay una ronda en ejecución o pendiente de confirmación.';
      action='Termina la ronda antes de finalizar el combate.';
    }else if(raw.startsWith('Ya se está finalizando')){
      reason='Otro cierre de este mismo encuentro sigue en proceso.';
      action='No cambies el resultado; reintenta cuando termine el cierre anterior.';
    }else if(raw==='LOOT_LIVE_POSTCOMBAT_RUNTIME_REQUIRED'||raw.startsWith('LOOT_LIVE_DEPENDENCY_FAILED:')||
      raw==='LOOT_LIVE_RUNTIME_DEPENDENCIES_INCOMPLETE'){
      reason='El sistema de botín no terminó de cargar.';
      action='Recarga el visor si es necesario y vuelve a intentar el cierre.';
    }else if(raw.startsWith('LOOT_')){
      reason='El botín no pudo guardarse completamente.';
      action='Reintenta: los cadáveres y objetos ya registrados se conservarán.';
    }else if(raw.startsWith('ENCOUNTER_XP_PARTICIPANT_NOT_FOUND')){
      reason='Falta una ficha de participante necesaria para entregar la experiencia.';
      action='Recupera la ficha faltante antes de intentar repartir XP otra vez.';
    }else if(raw.startsWith('ENCOUNTER_XP_RECEIPT_MISMATCH')){
      reason='Una recompensa guardada no coincide con el reparto de experiencia del encuentro.';
      action='No modifiques la XP manualmente. Es necesario revisar las recompensas ya guardadas.';
    }else if(raw.startsWith('ENCOUNTER_XP_RECEIPTS_REQUIRED')||raw.startsWith('ENCOUNTER_XP_AWARD_NOT_COMMITTED')){
      reason='No se pudieron verificar todas las recompensas de experiencia.';
      action='Reintenta el cierre: la XP ya confirmada no se vuelve a entregar.';
    }else if(raw.startsWith('ENCOUNTER_XP_')){
      reason='El reparto de experiencia no pudo completarse.';
      action='Reintenta el cierre sin modificar la experiencia de los personajes.';
    }else if(raw==='DM_ONLY'||raw.includes('no está listo')||raw==='DOCUMENT_HEAD_REQUIRED'){
      reason='El visor de combate todavía no está listo para terminar el encuentro.';
      action='Recarga el visor de combate y vuelve a intentarlo.';
    }else if(raw==='El encuentro cambió antes de confirmar el resultado.'){
      reason='El encuentro cambió mientras se intentaba guardar el resultado.';
      action='Comprueba que nadie esté ejecutando otra ronda y reintenta.';
    }else if(stage==='sanity'){
      reason='No se pudo guardar la cordura final de todos los personajes.';
    }else if(stage==='loot'){
      reason='No se pudo completar la preparación del botín.';
    }else if(stage==='experience'){
      reason='No se pudo confirmar la experiencia de los participantes.';
    }else if(stage==='result'){
      reason='El resultado final todavía no quedó confirmado.';
    }else if(stage==='claim'){
      reason='No se pudo iniciar el cierre del encuentro.';
    }else if(stage==='theatre'){
      reason='El resultado ya se guardó, pero no se pudo cambiar a Teatro.';
    }else if(stage==='loading'){
      reason='El visor todavía no terminó de cargar.';
      action='Usa «RECARGAR» en la barra de combate y vuelve a intentarlo.';
    }else if(stage==='state'){
      reason='No se pudo consultar el estado actual del encuentro.';
      action='Comprueba la conexión y vuelve a pulsar «END ENCOUNTER».';
    }else{
      reason=String(error?.userMessage||'').trim();
      if(!reason||reason.startsWith('No se pudo finalizar el encuentro.')||reason.startsWith('No se pudo completar la acción.'))
        reason='La operación se interrumpió sin una causa identificable.';
      action='Inténtalo otra vez. Si persiste, reporta la etapa indicada; no modifiques las recompensas.';
    }
    return {title:committed?'El resultado ya está guardado':'No se pudo finalizar el combate',
      step:steps[stage]||steps.unknown,reason,action,committed};
  }
  function clearEndFailure(){
    state.endFailure=null;
    const panel=global.document?.getElementById?.('dm-combat-end-feedback');
    if(panel){panel.hidden=true;panel.style.display='none'}
  }
  function showEndFailure(error,stageOverride){
    const details=endFailureDetails(error,stageOverride);
    state.endFailure=details;
    const modal=ensureEncounterModal();
    const panel=global.document?.getElementById?.('dm-combat-end-feedback');
    const doc=global.document;
    for(const [key,value] of Object.entries({title:details.title,step:'Etapa: '+details.step,
      reason:'Motivo: '+details.reason,action:'Qué hacer: '+details.action})){
      const node=doc?.getElementById?.('dm-combat-end-feedback-'+key);
      if(node)node.textContent=value;
    }
    if(panel){panel.hidden=false;panel.style.display='block'}
    if(modal){modal.hidden=false;modal.style.display='flex'}
    const short=details.committed?'Resultado guardado · No se pudo regresar a Teatro':'Cierre fallido · '+details.step;
    setStatus(short,true);
    return details;
  }

  function setReturnPending(pending){
    state.returningToTheatre=Boolean(pending);
    const button=global.document?.getElementById?.('dm-combat-end-encounter');
    if(button)button.textContent=state.returningToTheatre?'VOLVER A TEATRO':'END ENCOUNTER';
    for(const id of ['dm-combat-end-victory','dm-combat-end-defeat']){
      const choice=global.document?.getElementById?.(id);
      if(choice)choice.hidden=state.returningToTheatre;
    }
    const retry=global.document?.getElementById?.('dm-combat-end-retry-theatre');
    if(retry)retry.hidden=!state.returningToTheatre;
  }
  async function completeTheatreReturn(){
    try{
      const db=global.firebase?.database?.();
      if(!db?.ref)throw Error('DATABASE_NOT_READY');
      // Never bypass award or result receipts: only an ENDED encounter
      // can use the lightweight transition without running payouts.
      const result=(await db.ref('campaña/combate/estado').once('value')).val();
      if(result?.phase!=='ENDED'||result?.active!==false)throw Error('RESULT_NOT_CONFIRMED');
      await db.ref('campaña/estado_mundo/instancia_activa').set('teatro');
      setReturnPending(false);
      clearEndFailure();
      setStatus('RESULTADO CONFIRMADO · REGRESANDO A TEATRO');
      const modal=state.encounterModal;
      if(modal){modal.hidden=true;modal.style.display='none'}
      return true;
    }catch(error){
      console.error('[DM Combat Live Viewer] Theatre return failed',error);
      if(error?.message==='RESULT_NOT_CONFIRMED'){
        setReturnPending(false);
        showEndFailure(error,'result');
      }else{
        setReturnPending(true);
        showEndFailure(error,'theatre');
      }
      return false;
    }
  }
  async function returnToTheatre(){
    if(state.encounterBusy)return false;
    setEncounterBusy(true);
    try{return await completeTheatreReturn()}finally{setEncounterBusy(false)}
  }
  async function openEncounterOrReturn(){
    if(state.encounterBusy)return false;
    if(state.returningToTheatre)return returnToTheatre();
    try{
      const db=global.firebase?.database?.();
      if(db?.ref){
        const result=(await db.ref('campaña/combate/estado').once('value')).val();
        if(result?.phase==='ENDED'&&result?.active===false){
          setReturnPending(true);
          return returnToTheatre();
        }
      }
    }catch(error){
      console.error('[DM Combat Live Viewer] Encounter state read failed',error);
      showEndFailure(error,'state');
      return false;
    }
    clearEndFailure();
    return openEncounterModal();
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
    modal.style.cssText='position:fixed;inset:0;z-index:2147482500;display:none;align-items:center;justify-content:center;padding:12px max(12px,env(safe-area-inset-right)) 12px max(12px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);overflow-y:auto;';
    modal.innerHTML=`
      <section style="width:min(560px,100%);max-height:calc(100dvh - 24px);overflow-y:auto;margin:auto;background:#0b0908;border:1px solid #8d6b38;box-shadow:0 22px 70px rgba(0,0,0,.75);padding:clamp(12px,3vw,22px);box-sizing:border-box;color:#eee;font-family:system-ui,sans-serif">
        <div style="font-size:11px;letter-spacing:.18em;color:#a28a63;margin-bottom:6px">COMBAT CONTROL</div>
        <h2 id="dm-combat-end-title" style="margin:0 0 10px;color:#e2bd70;font-size:28px;letter-spacing:.05em">END ENCOUNTER</h2>
        <p style="margin:0;color:#c8c0b2;line-height:1.5;font-size:14px">Elige cómo termina el combate. Esto cerrará el Encounter para todos los jugadores, mostrará el resultado y enviará la sesión a Theater.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px">
          <button id="dm-combat-end-victory" type="button" style="min-height:54px;border:1px solid #6d9b61;background:#142014;color:#d6f1cf;font-weight:800;font-size:16px;letter-spacing:.08em;cursor:pointer">VICTORY</button>
          <button id="dm-combat-end-defeat" type="button" style="min-height:54px;border:1px solid #a94c42;background:#24100e;color:#ffd0ca;font-weight:800;font-size:16px;letter-spacing:.08em;cursor:pointer">DEFEAT</button>
        </div>
        <button id="dm-combat-end-retry-theatre" type="button" hidden style="width:100%;margin-top:12px;min-height:48px;border:1px solid #6d9b61;background:#142014;color:#d6f1cf;font-weight:800;font-size:15px;cursor:pointer">VOLVER A TEATRO</button>
        <button id="dm-combat-end-cancel" type="button" style="width:100%;margin-top:12px;min-height:44px;border:1px solid #4b4337;background:#12100d;color:#bbb;cursor:pointer">CERRAR</button>
      </section>`;
    doc.body.appendChild(modal);
    const feedback=doc.createElement('div');
    feedback.id='dm-combat-end-feedback';
    feedback.hidden=true;
    feedback.setAttribute?.('role','alert');
    feedback.setAttribute?.('aria-live','assertive');
    feedback.style.cssText='display:none;margin-top:16px;padding:14px;box-sizing:border-box;border:1px solid #b96d63;border-left:4px solid #d68e82;background:#241412;color:#ffe6e1;line-height:1.4;overflow-wrap:anywhere;';
    const slots=[
      ['title','font-weight:800;font-size:16px;margin-bottom:9px;'],
      ['step','font-size:13px;margin-top:7px;'],
      ['reason','font-size:14px;margin-top:7px;'],
      ['action','font-size:14px;margin-top:7px;color:#f5d8a0;']
    ];
    for(const [slot,style] of slots){
      const part=doc.createElement('div');
      part.id='dm-combat-end-feedback-'+slot;
      part.style.cssText=style;
      feedback.appendChild(part);
    }
    const section=modal.querySelector?.('section')||modal;
    section.appendChild(feedback);
    state.encounterModal=modal;
    const victory=doc.getElementById?.('dm-combat-end-victory');
    const defeat=doc.getElementById?.('dm-combat-end-defeat');
    const cancel=doc.getElementById?.('dm-combat-end-cancel');
    if(victory&&!victory.dataset.bound){victory.dataset.bound='true';victory.addEventListener('click',()=>finishEncounterFromUi('victory'))}
    if(defeat&&!defeat.dataset.bound){defeat.dataset.bound='true';defeat.addEventListener('click',()=>finishEncounterFromUi('defeat'))}
    if(cancel&&!cancel.dataset.bound){cancel.dataset.bound='true';cancel.addEventListener('click',closeEncounterModal)}
    const theatre=doc.getElementById?.('dm-combat-end-retry-theatre');
    if(theatre&&!theatre.dataset.bound){theatre.dataset.bound='true';theatre.addEventListener('click',returnToTheatre)}
    modal.addEventListener?.('click',event=>{if(event?.target===modal)closeEncounterModal()});
    return modal;
  }

  function openEncounterModal(){
    ensureLoaded();
    const modal=ensureEncounterModal();
    if(!modal)return false;
    modal.hidden=false;
    modal.style.display='flex';
    const focusId=state.returningToTheatre?'dm-combat-end-retry-theatre':'dm-combat-end-victory';
    global.document?.getElementById?.(focusId)?.focus?.();
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
      showEndFailure(new Error('VISOR_CARGANDO'),'loading');
      scheduleNudges();
      return false;
    }
    clearEndFailure();
    closeEncounterModal();
    setEncounterBusy(true);
    try{
      setStatus(normalized==='victory'?'CERRANDO ENCOUNTER · VICTORY…':'CERRANDO ENCOUNTER · DEFEAT…');
      await api.finishEncounter(normalized,{confirm:false});
      const modal=state.encounterModal||global.document?.getElementById?.('dm-combat-end-modal');
      if(modal){modal.hidden=true;modal.style.display='none'}
      clearEndFailure();
      return true;
    }catch(error){
      console.error('[DM Combat Live Viewer] Encounter end failed',error);
      if(error?.encounterEndCommitted){
        setReturnPending(true);
        setStatus('RESULTADO GUARDADO · VOLVIENDO A TEATRO…');
        return await completeTheatreReturn();
      }
      showEndFailure(error);
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
      panel.innerHTML=`<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:9px 12px;background:#0d0b09;border-bottom:1px solid #4d4029;color:#ddb765;font:700 12px system-ui;letter-spacing:.06em"><span style="flex:1;min-width:90px">BATTLE LIVE · DM</span><span id="dm-combat-live-status" style="color:#c7b98f;font-weight:600;letter-spacing:0;flex:2 1 170px;min-width:0;overflow-wrap:anywhere;line-height:1.3">ABRE COMBATE PARA CARGAR BATTLE</span><button id="dm-combat-end-encounter" type="button" style="border:1px solid #a94c42;background:#24100e;color:#ffd0ca;min-height:44px;padding:8px 11px;cursor:pointer;font-weight:800;letter-spacing:.06em">END ENCOUNTER</button><button id="dm-combat-live-reload" type="button" style="border:1px solid #77613b;background:#18130c;color:#e4c981;min-height:44px;padding:8px 9px;cursor:pointer">RECARGAR</button></div><iframe id="dm-combat-live-frame" title="Battle Viewer DM" src="about:blank" data-battle-src="Battle-viewer.html?v=20261102-dm-end-recovery-2" style="display:block;width:100%;height:clamp(560px,72vh,900px);min-height:560px;border:0;background:#050010;visibility:visible" allow="autoplay"></iframe>`;
      host.insertBefore(panel,host.firstChild);
    }
    state.panel=panel;state.frame=global.document.getElementById('dm-combat-live-frame');state.status=global.document.getElementById('dm-combat-live-status');
    const reloadButton=global.document.getElementById('dm-combat-live-reload');
    if(reloadButton&&!reloadButton.dataset.bound){reloadButton.dataset.bound='true';reloadButton.addEventListener('click',reload)}
    const endEncounterButton=global.document.getElementById('dm-combat-end-encounter');
    if(endEncounterButton&&!endEncounterButton.dataset.bound){endEncounterButton.dataset.bound='true';endEncounterButton.addEventListener('click',openEncounterOrReturn)}
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
  global.LuminousDmCombatLiveViewer=Object.freeze({version:'1.5.0-encounter-controls',state,start,mount,ensureLoaded,bootstrapState,visibleNode,childSurface,forceDomFallback,nudgeBattle,scheduleNudges,reload,isVisible,encounterApi,ensureEncounterModal,openEncounterModal,closeEncounterModal,finishEncounterFromUi,returnToTheatre,openEncounterOrReturn});
  start();
})(window);
