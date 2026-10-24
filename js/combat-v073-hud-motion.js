/* Original combat HUD geometry and generic motion; never executes game rules or writes Firebase. */
(function(global){
  'use strict';
  if(global.LuminousCombatHudMotion073)return;
  const state={mounted:false,animations:new Map(),generation:null,lastSequence:0,savedPresentation:null,statusFrame:null};
  const doc=global.document, byId=id=>doc?.getElementById(id), runtime=()=>global.LuminousCombat073;
  const units=()=>runtime()?.combatants?.()||{};
  const ui=()=>runtime()?.uiState?.()||{};
  const compact=()=>global.innerWidth<=950||global.innerHeight<=600;
  const reduced=()=>Boolean(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const motion=()=>!reduced()&&global.LuminousCombatStepRuntime?.presentationEnabled?.()!==false;
  const clean=value=>String(value??'');
  function text(id,value){const node=byId(id),next=clean(value);if(node&&node.textContent!==next)node.textContent=next;}
  function canRead(id){
    const host=byId('game-container'),token=byId(`token-${id}`);
    return Boolean(token&&!token.classList.contains('invisible-hidden')&&(!host?.classList.contains('player-blinded')||id===runtime()?.playerId?.()));
  }
  function name(id){return canRead(id)?units()[id]?.name||'Combatiente':'Combatiente oculto';}
  function clearMotion(){
    for(const animation of state.animations.values())animation.cancel();state.animations.clear();
    doc?.querySelectorAll('.sprite-img[data-combat-pose]').forEach(node=>node.removeAttribute('data-combat-pose'));
  }
  function stablePose(id){const unit=units()[id];return Number(unit?.hp)<=0?'defeated':Number(unit?.staggerStage)>0?'stagger':'idle';}
  function pose(id,value,{transient=true}={}){
    const img=byId(`sprite-${id}`);if(!img)return;
    state.animations.get(id)?.cancel();state.animations.delete(id);
    img.dataset.combatPose=value;
    global.LuminousWebGL2Renderer?.requestRender?.(450);
    if(!transient||!motion()||typeof img.animate!=='function')return;
    const shift=value==='evade'?'0px -16px':value==='hit'?'0px 6px':value==='guard'?'0px 2px':'0px -5px';
    const animation=img.animate([{translate:'0px 0px',scale:'1 1'},{translate:shift,scale:value==='hit'?'1.06 .92':'1 .96'},{translate:'0px 0px',scale:'1 1'}],{duration:value==='cast'?420:300,easing:'ease-out'});
    state.animations.set(id,animation);
    animation.onfinish=()=>{if(state.animations.get(id)!==animation)return;state.animations.delete(id);img.dataset.combatPose=stablePose(id);};
  }
  function entryPose(entry){
    const d=entry?.plan?.data||{},kind=clean(d.defenseType||d.defenseKind||d.name||entry?.plan?.type).toLowerCase();
    if(/evade|evas/.test(kind))return'evade';if(/guard|block/.test(kind))return'guard';if(/counter/.test(kind))return'counter';
    return /spell/.test(`${clean(entry?.plan?.type)} ${clean(d.kind)}`.toLowerCase())?'cast':'attack';
  }
  function cue(cue,args=[],options={}){
    if(options.quiet)return;
    const [a,b]=args;
    if(cue==='actionStart'||cue==='powerStart'||cue==='hitStart')pose(a?.ownerId,entryPose(a));
    else if(cue==='clashStart'){pose(a?.ownerId,'attack');pose(b?.ownerId,'attack');}
    else if(cue==='hitMotion'){pose(a?.ownerId,entryPose(a));pose(b,'hit');}
    else if(cue==='guardEnd')pose(a?.ownerId,'guard');
    else if(cue==='evadeEnd')pose(a?.ownerId,'evade');
    else if(cue==='clashEnd'){pose(a?.ownerId,stablePose(a?.ownerId),{transient:false});pose(b?.ownerId,stablePose(b?.ownerId),{transient:false});}
  }
  function event(event){
    const generation=event.roundId||`${event.encounterId||''}:${event.round}`;
    if(generation!==state.generation){state.generation=generation;state.lastSequence=0;clearMotion();}
    if(Number(event.sequence)<=state.lastSequence)return;
    state.lastSequence=Number(event.sequence)||0;
    if(event.type==='UnitStaggered'||event.type==='UnitDefeated')pose(event.unitId,event.type==='UnitDefeated'?'defeated':'stagger',{transient:false});
    else if(event.type==='QueueEntryFinished'||event.type==='RoundFinished'){clearMotion();for(const unit of Object.values(units()))pose(unit.id,stablePose(unit.id),{transient:false});}
    refresh();
  }
  // Reuse the live ribbon, heptagon and animated Coins. On small screens they
  // belong to screen space so camera zoom cannot crop or magnify the readout.
  function placeClashHud(entry,hud){
    const ownerId=entry?.ownerId;
    if(!hud||!ownerId)return;
    hud.dataset.ownerId=ownerId;
    const small=compact(),layer=byId('combat-mobile-clash-layer');
    const parent=small?layer:byId(`token-${ownerId}`)?.querySelector('.combatant');
    if(parent&&hud.parentNode!==parent)parent.appendChild(hud);
    hud.hidden=small&&!canRead(ownerId);
  }
  function layoutClashForecast(){
    const forecast=byId('clash-forecast');
    if(!forecast?.classList.contains('open'))return;
    const width=forecast.querySelector('.clash-forecast-skill-stage')?.clientWidth||130;
    forecast.style.setProperty('--forecast-scale',String(Math.min(1,width/260)));
  }
  function layoutClashHuds(){
    const layer=byId('combat-mobile-clash-layer'),host=byId('game-container');
    if(!layer||!host)return;
    layer.style.setProperty('--clash-mobile-scale',String(Math.min(1,(host.clientWidth-64)/520)));
    doc.querySelectorAll('.clash-float-hud[data-owner-id]').forEach(hud=>placeClashHud({ownerId:hud.dataset.ownerId},hud));
    layoutClashForecast();
  }
  function statusViewportOffset(rect,viewport,padding=8){
    const left=viewport.left+padding,top=viewport.top+padding,right=viewport.right-padding,bottom=viewport.bottom-padding;
    const x=rect.left<left?left-rect.left:rect.right>right?right-rect.right:0;
    const y=rect.top<top?top-rect.top:rect.bottom>bottom?bottom-rect.bottom:0;
    return {x,y};
  }
  function layoutStatusHud(){
    const id=runtime()?.playerId?.(),node=byId(`statuses-${id}`),viewport=byId('game-container');
    if(!node?.children?.length||!viewport||!canRead(id))return;
    const box=node.getBoundingClientRect(),bounds=viewport.getBoundingClientRect();
    if(!(box.width>0&&box.height>0&&node.offsetWidth>0&&node.offsetHeight>0))return;
    const scaleX=box.width/node.offsetWidth,scaleY=box.height/node.offsetHeight;
    // Status lives in the scaled battlefield. Convert screen corrections back
    // to that same local space without moving the sprite, camera or Unit.
    const oldX=parseFloat(node.style.getPropertyValue('--status-viewport-x'))||0,oldY=parseFloat(node.style.getPropertyValue('--status-viewport-y'))||0;
    const natural={left:box.left-oldX*scaleX,right:box.right-oldX*scaleX,top:box.top-oldY*scaleY,bottom:box.bottom-oldY*scaleY};
    const columns=Math.max(1,Math.min(4,node.children.length,Math.floor(((bounds.right-bounds.left-16)/scaleX+5)/63)));
    const grid=`repeat(${columns}, 58px)`;
    const resized=node.style.gridTemplateColumns!==grid||node.style.maxHeight!=='none';
    if(node.style.gridTemplateColumns!==grid)node.style.gridTemplateColumns=grid;
    if(node.style.maxHeight!=='none')node.style.maxHeight='none';
    const offset=statusViewportOffset(natural,bounds);
    for(const [key,value]of [['--status-viewport-x',offset.x/scaleX],['--status-viewport-y',offset.y/scaleY]]){
      const next=`${Math.round(value*1000)/1000}px`;if(node.style.getPropertyValue(key)!==next)node.style.setProperty(key,next);
    }
    return resized;
  }
  function scheduleStatusLayout(){
    if(state.statusFrame!==null||typeof global.requestAnimationFrame!=='function')return;
    state.statusFrame=global.requestAnimationFrame(()=>{
      state.statusFrame=null;const resized=layoutStatusHud();
      const moving=byId('battlefield')?.getAnimations?.().some(animation=>animation.playState==='running'&&animation.transitionProperty==='transform');
      if(moving||resized)scheduleStatusLayout();
    });
  }
  function refreshTargets(value=ui()) {
    const targets=byId('combat-target-list');
    if(!targets)return;
    targets.hidden=!value.targeting||Boolean(value.running);
    if(targets.hidden){targets.dataset.choices='';return;}
    const choices=[...doc.querySelectorAll('.action-slot-wrapper.target-valid')];
    const labels=choices.map(slot=>`${name(slot.dataset.ownerId)} · Slot ${Number(slot.dataset.slotIndex)+1}`);
    const key=JSON.stringify(choices.map((slot,index)=>[slot.id,labels[index]]));
    if(targets.dataset.choices===key)return;
    targets.dataset.choices=key;targets.replaceChildren();
    choices.forEach((slot,index)=>{
      const button=doc.createElement('button');button.type='button';
      button.dataset.targetOwner=slot.dataset.ownerId;
      button.dataset.targetSlot=slot.dataset.slotIndex;
      button.textContent=labels[index];
      // Resolve the current slot through the combat API; hydration can replace DOM nodes.
      button.onclick=()=>{runtime()?.chooseTarget?.(button.dataset.targetOwner,Number(button.dataset.targetSlot));refresh();};
      targets.appendChild(button);
    });
    if(!choices.length){
      const empty=doc.createElement('span');empty.textContent='No hay objetivos válidos para esta acción.';targets.appendChild(empty);
    }
  }
  function refresh(){
    if(!state.mounted)return;
    const host=byId('game-container'),value=ui(),role=global.LuminousCombatLiveAdapter073?.state?.role;
    const small=compact();if(host.classList.contains('compact-combat-hud')!==small)host.classList.toggle('compact-combat-hud',small);
    const categoryOpen=value.nav!=='root';if(host.classList.contains('hud-category-open')!==categoryOpen)host.classList.toggle('hud-category-open',categoryOpen);
    refreshTargets(value);
    const network=byId('status')?.textContent||'';
    const s=global.LuminousCombatLiveAdapter073?.state,ready=global.LuminousCombatAuthority073?.state.readyRows||{};
    const group=global.LuminousCombatParticipants?.progress(s?.combatants,ready,value.round);
    const waiting=group?.waiting||[],names=waiting.slice(0,2).join(', ')+(waiting.length>2?` y ${waiting.length-2} más`:'');
    let phase=/reconect/i.test(network)?'Reconectando…':value.running?'Resolviendo turno':value.targeting?'Elige un objetivo':value.view?'Vista del campo':'Planifica tus acciones';
    if(!value.running&&group?.total){
      const own=ready[s?.playerId];
      phase=`Listos ${group.ready}/${group.total} · ${names?`Falta: ${names}`:role==='dm'?'Iniciando turno…':'Esperando al DM'}`;
      if(role==='player'&&value.ready&&!(own?.ready===true&&Number(own.round)===Number(value.round)))phase='Guardando tu READY…';
      const delivery=global.LuminousCombatPlanSync073?.delivery;
      if(role==='player'&&Number(delivery?.round)===Number(value.round)){
        const retry=delivery.status==='error',button=byId('ready');
        if(retry){
          const error=clean(delivery.error).toUpperCase();
          phase=error.includes('PERMISSION_DENIED')?'Firebase rechazó tu selección · pulsa READY para reintentar':
            error==='READY_CONTEXT_UNAVAILABLE'?'El encuentro aún no permite confirmar · pulsa READY para reintentar':
            error==='READY_CONFIRMATION_TIMEOUT'?'Sin confirmación de conexión · pulsa READY para reintentar':
            'No se pudo guardar tu selección · pulsa READY para reintentar';
        }
        else if(delivery.status==='saving')phase='Guardando tu READY…';
        if(button&&value.ready)button.textContent=retry?'REINTENTAR READY':'CANCEL READY';
      }
    }
    text('combat-phase-label',phase);
    layoutClashHuds();scheduleStatusLayout();
  }
  function layoutCommands(){refresh();return false;}
  function layoutCategory({surface,body,back,accent}){
    if(!compact())return false;
    const top=global.innerHeight<=500?54:86,left=10,width=Math.max(240,global.innerWidth-20),height=Math.max(140,global.innerHeight-top-12);
    surface.style.left=`${left}px`;surface.style.top=`${top}px`;surface.style.width=`${width}px`;surface.style.maxHeight=`${height}px`;
    if(body)body.style.maxHeight=`${Math.max(80,height-94)}px`;
    back.style.left=`${left}px`;back.style.top=`${Math.max(6,top-44)}px`;back.style.setProperty('--accent',accent);return true;
  }
  function applyPreference(){
    const surface=global.LuminousCombatStepRuntime;if(!surface?.setPresentationEnabled)return;
    if(reduced()||global.LuminousCombatLiveAdapter073?.state.presentation==='simple'){if(state.savedPresentation===null)state.savedPresentation=surface.presentationEnabled();surface.setPresentationEnabled(false);clearMotion();}
    else if(state.savedPresentation!==null){surface.setPresentationEnabled(state.savedPresentation);state.savedPresentation=null;}
    refresh();
  }
  function mount(){
    if(state.mounted||!byId('game-container'))return;state.mounted=true;
    const host=byId('game-container');host.classList.add('combat-product-hud');
    const phase=doc.createElement('div');phase.id='combat-phase-label';phase.setAttribute('role','status');host.appendChild(phase);
    const targets=doc.createElement('div');targets.id='combat-target-list';targets.hidden=true;targets.setAttribute('aria-label','Objetivos disponibles');host.appendChild(targets);
    const layer=doc.createElement('div');layer.id='combat-mobile-clash-layer';host.appendChild(layer);
    global.addEventListener('resize',refresh);global.addEventListener('luminous:combat073-hydrated',()=>{layer.replaceChildren();clearMotion();applyPreference();});
    global.addEventListener('luminous:combat073-runtime-ready',applyPreference);
    global.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',applyPreference);
    for(const name of ['luminous:combat073-plan-change','luminous:combat073-plan-ready-change'])global.addEventListener(name,refresh);
    if(global.MutationObserver&&byId('status'))new global.MutationObserver(refresh).observe(byId('status'),{childList:true,characterData:true,subtree:true});
    refresh();
  }
  global.LuminousCombatHudMotion073=Object.freeze({state,compact,reduced,entryPose,canRead,event,cue,refresh,refreshTargets,layoutCommands,layoutCategory,placeClashHud,layoutClashForecast,statusViewportOffset,layoutStatusHud,scheduleStatusLayout,clearMotion,applyPreference,mount});
  mount();
})(window);
