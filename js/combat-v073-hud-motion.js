/* Product HUD and generic motion; never executes game rules or writes Firebase. */
(function(global){
  'use strict';
  if(global.LuminousCombatHudMotion073)return;
  const state={mounted:false,sides:new Map(),animations:new Map(),generation:null,lastSequence:0,savedPresentation:null};
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
    return /spell/.test(clean(entry?.plan?.type||d.kind).toLowerCase())?'cast':'attack';
  }
  function side(entry,count,power){
    if(!entry?.ownerId)return null;
    let row=state.sides.get(entry.ownerId);
    if(!row){row={id:entry.ownerId,skill:entry.plan?.data?.name||'Habilidad',count:0,power:null,coins:[]};state.sides.set(entry.ownerId,row);}
    if(count!=null)row.count=Math.max(0,Number(count)||0);
    if(power!=null)row.power=Number(power)||0;
    return row;
  }
  function paintAction(){
    const container=byId('combat-action-sides');if(!container)return;container.replaceChildren();
    for(const row of [...state.sides.values()].slice(-2)){
      const readable=canRead(row.id),node=doc.createElement('div');node.className='combat-action-side';
      const title=doc.createElement('strong');title.textContent=readable?`${name(row.id)} · ${row.skill}`:'Acción de un combatiente oculto';node.appendChild(title);
      const results=doc.createElement('div');results.className='combat-action-coins';
      if(readable){
        const power=doc.createElement('b');power.textContent=row.power==null?'—':String(row.power);results.appendChild(power);
        for(let i=0;i<Math.min(8,row.count);i++){
          const coin=doc.createElement('span'),result=row.coins[i];coin.className=`combat-result-coin ${result||'pending'}`;
          coin.textContent=result==='head'?'●':result==='tail'?'○':'◇';coin.setAttribute('aria-label',`Coin ${i+1}: ${result==='head'?'Heads':result==='tail'?'Tails':'pendiente'}`);results.appendChild(coin);
        }
        if(row.count>8){const more=doc.createElement('span');more.textContent=`+${row.count-8}`;results.appendChild(more);}
      }
      node.appendChild(results);container.appendChild(node);
    }
    const panel=byId('combat-action-readout');if(panel)panel.hidden=!ui().running||state.sides.size===0;
  }
  function cue(cue,args=[]){
    const [a,b,c,d]=args;
    if(cue==='actionStart'){state.sides.clear();side(a,a?.plan?.data?.coinAmount);text('combat-action-result','Resolviendo habilidad');pose(a?.ownerId,entryPose(a));}
    else if(cue==='clashStart'){state.sides.clear();side(a,c);side(b,d);text('combat-action-result','Choque de habilidades');pose(a?.ownerId,'attack');pose(b?.ownerId,'attack');}
    else if(cue==='powerStart'){const row=side(a,b,c);if(row)row.coins=[];pose(a?.ownerId,entryPose(a));}
    else if(cue==='powerCoin'){const row=side(a,d,c);if(row)row.coins[b.index]=b.side;}
    else if(cue==='hitsStart'){state.sides.clear();side(a,b);text('combat-action-result','Resolviendo habilidad');}
    else if(cue==='hitStart'){side(a,b);pose(a?.ownerId,entryPose(a));}
    else if(cue==='hitCoin'){const row=side(a,b,args[4]);if(row)row.coins=d.map(coin=>coin.side);}
    else if(cue==='hitMotion'){pose(a?.ownerId,entryPose(a));pose(b,'hit');}
    else if(cue==='guardEnd')pose(a?.ownerId,'guard');
    else if(cue==='evadeEnd')pose(a?.ownerId,'evade');
    else if(cue==='clashEnd'){pose(a?.ownerId,stablePose(a?.ownerId),{transient:false});pose(b?.ownerId,stablePose(b?.ownerId),{transient:false});}
    paintAction();
  }
  function event(event){
    const generation=event.roundId||`${event.encounterId||''}:${event.round}`;
    if(generation!==state.generation){state.generation=generation;state.lastSequence=0;state.sides.clear();clearMotion();}
    if(Number(event.sequence)<=state.lastSequence)return;
    state.lastSequence=Number(event.sequence)||0;
    if(event.type==='CoinRolled'){const row=side({ownerId:event.ownerId});if(row){row.count=Math.max(row.count,Number(event.coinIndex)+1);row.coins[event.coinIndex]=event.side;}}
    else if(event.type==='HitResolved'){const row=side({ownerId:event.ownerId});if(row)row.power=event.power;}
    else if(event.type==='ClashRoundResolved'){
      text('combat-action-result',[...state.sides.values()].every(row=>canRead(row.id))?(event.winner==='tie'?'Empate':`Choque ${event.clashCount} · ${event.powerA} contra ${event.powerB}`):'Choque en curso');
    }else if(event.type==='CoinBroken')text('combat-action-result',`Coin perdida · quedan ${event.remaining}`);
    else if(event.type==='HitEvaded')text('combat-action-result','Ataque evadido');
    else if(event.type==='ShieldApplied')text('combat-action-result','Guardia preparada');
    else if(event.type==='ActionCancelled')text('combat-action-result','Acción interrumpida');
    else if(event.type==='UnitStaggered'||event.type==='UnitDefeated')pose(event.unitId,event.type==='UnitDefeated'?'defeated':'stagger',{transient:false});
    else if(event.type==='QueueEntryFinished'||event.type==='RoundFinished'){clearMotion();for(const unit of Object.values(units()))pose(unit.id,stablePose(unit.id),{transient:false});}
    refresh();paintAction();
  }
  function refresh(){
    if(!state.mounted)return;
    const host=byId('game-container'),value=ui(),unit=units()[runtime()?.playerId?.()],role=global.LuminousCombatLiveAdapter073?.state?.role;
    const small=compact();if(host.classList.contains('compact-combat-hud')!==small)host.classList.toggle('compact-combat-hud',small);
    const own=byId('combat-own-status');if(own)own.hidden=role==='dm'||!unit;
    if(unit){
      text('combat-own-name',unit.name);text('combat-own-vitals',`HP ${Math.round(unit.hp)} / ${Math.round(unit.maxHp)} · SP ${Math.round(unit.sp)}`);
      text('combat-own-speed',`Speed ${unit.speed||0}${Number(unit.staggerStage)>0?' · Stagger':''}`);
      const hp=byId('combat-own-hp');if(hp){hp.max=Math.max(1,Number(unit.maxHp)||1);hp.value=Math.max(0,Number(unit.hp)||0);}
      const slots=byId('combat-own-slots'),count=Math.max(1,Number(unit.actionSlots)||1);
      if(slots&&slots.children.length!==count){slots.replaceChildren();for(let i=0;i<count;i++){const button=doc.createElement('button');button.type='button';button.textContent=String(i+1);button.setAttribute('aria-label',`Seleccionar Action Slot ${i+1}`);button.onclick=()=>global.selectSlot?.(i);slots.appendChild(button);}}
      [...(slots?.children||[])].forEach((button,index)=>{button.disabled=Boolean(value.running||value.ready);button.setAttribute('aria-pressed',String(index===value.selectedSlot));});
    }
    const targets=byId('combat-target-list');
    if(targets){
      targets.hidden=!small||!value.targeting||Boolean(value.running);
      if(!targets.hidden){
        const choices=[...doc.querySelectorAll('.action-slot-wrapper.target-valid')];
        const key=choices.map(slot=>slot.id).join('|');
        if(targets.dataset.choices!==key){targets.dataset.choices=key;targets.replaceChildren();
          for(const slot of choices){const id=slot.dataset.ownerId,button=doc.createElement('button');button.type='button';button.dataset.targetOwner=id;
            button.textContent=`${name(id)} · Slot ${Number(slot.dataset.slotIndex)+1}`;
            button.onclick=()=>{global.choosePlayerTarget?.(slot);refresh();};targets.appendChild(button);}
        }
      }else targets.dataset.choices='';
    }
    const network=byId('status')?.textContent||'';
    text('combat-own-effects',Object.values(unit?.statusEffects||{}).slice(0,3).map(effect=>`${effect.name||'Efecto'}${effect.count!=null?' '+effect.count:''}`).join(' · '));
    const phase=/reconect/i.test(network)?'Reconectando…':/esperando al dm/i.test(network)?'Esperando al DM':value.running?'Resolviendo turno':value.ready?'Listo · esperando al grupo':value.targeting?'Elige un objetivo':value.view?'Vista del campo':'Planifica tus acciones';
    text('combat-phase-label',role==='dm'&&!value.running?'Diriges el encuentro':phase);
    if(!value.running){state.sides.clear();const readout=byId('combat-action-readout');if(readout)readout.hidden=true;}
  }
  function layoutCommands(){refresh();return compact();}
  function layoutCategory({surface,body,back,accent}){
    if(!compact())return false;
    const top=global.innerHeight<=500?54:166,left=10,width=Math.max(240,global.innerWidth-20),height=Math.max(140,global.innerHeight-top-12);
    surface.style.left=`${left}px`;surface.style.top=`${top}px`;surface.style.width=`${width}px`;surface.style.maxHeight=`${height}px`;
    if(body)body.style.maxHeight=`${Math.max(80,height-94)}px`;
    back.style.left=`${left}px`;back.style.top=`${Math.max(6,top-44)}px`;back.style.setProperty('--accent',accent);return true;
  }
  function applyPreference(){
    const surface=global.LuminousCombatStepRuntime;if(!surface?.setPresentationEnabled)return;
    if(reduced()){if(state.savedPresentation===null)state.savedPresentation=surface.presentationEnabled();surface.setPresentationEnabled(false);clearMotion();}
    else if(state.savedPresentation!==null){surface.setPresentationEnabled(state.savedPresentation);state.savedPresentation=null;}
    refresh();
  }
  function mount(){
    if(state.mounted||!byId('game-container'))return;state.mounted=true;
    const host=byId('game-container');host.classList.add('combat-product-hud');
    const info=doc.createElement('section');info.id='combat-own-status';info.setAttribute('aria-label','Estado de tu personaje');
    info.innerHTML='<div class="combat-own-heading"><strong id="combat-own-name"></strong><span id="combat-own-speed"></span></div><span id="combat-own-vitals"></span><progress id="combat-own-hp" aria-label="Puntos de vida"></progress><div id="combat-own-slots" aria-label="Action Slots"></div><div id="combat-own-effects"></div>';host.appendChild(info);
    const phase=doc.createElement('div');phase.id='combat-phase-label';phase.setAttribute('role','status');host.appendChild(phase);
    const targets=doc.createElement('div');targets.id='combat-target-list';targets.hidden=true;targets.setAttribute('aria-label','Objetivos disponibles');host.appendChild(targets);
    const action=doc.createElement('section');action.id='combat-action-readout';action.hidden=true;action.setAttribute('aria-label','Resolución de la habilidad');action.innerHTML='<div id="combat-action-result" role="status"></div><div id="combat-action-sides"></div>';host.appendChild(action);
    global.addEventListener('resize',refresh);global.addEventListener('luminous:combat073-hydrated',()=>{clearMotion();refresh();});
    global.addEventListener('luminous:combat073-runtime-ready',applyPreference);
    global.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',applyPreference);
    for(const name of ['luminous:combat073-plan-change','luminous:combat073-plan-ready-change'])global.addEventListener(name,refresh);
    if(global.MutationObserver&&byId('status'))new global.MutationObserver(refresh).observe(byId('status'),{childList:true,characterData:true,subtree:true});
    refresh();
  }
  global.LuminousCombatHudMotion073=Object.freeze({state,compact,reduced,entryPose,canRead,event,cue,refresh,layoutCommands,layoutCategory,clearMotion,mount});
  mount();
})(window);
