/* Local audiovisual director: results in, original vector/audio feedback out.
   No rules, RNG, database writes, global timer overrides or extra canvas. */
(function(global){
  'use strict';
  if(global.LuminousCombatAudiovisual073)return;
  const doc=global.document,byId=id=>doc?.getElementById(id),runtime=()=>global.LuminousCombat073;
  const defaults={sound:true,volume:.22,quality:'full',speed:1};
  const state={mounted:false,generation:null,lastSequence:0,entries:new Map(),featured:new Set(),nodes:new Set(),animations:new Set(),timers:new Set(),voices:new Set(),context:null,unlocked:false,cameraPriority:0,settings:{...defaults}};
  try{const saved=JSON.parse(global.localStorage?.getItem('luminos.combat.presentation.v1')||'null');if(saved)Object.assign(state.settings,saved);}catch(_){}
  function preferences(value={}){
    const s={...state.settings,...value};state.settings={sound:s.sound===true,volume:Math.max(0,Math.min(.6,Number(s.volume)||0)),quality:['full','low','off'].includes(s.quality)?s.quality:'full',speed:s.speed===2?2:1};
    try{global.localStorage?.setItem('luminos.combat.presentation.v1',JSON.stringify(state.settings));}catch(_){}
    byId('game-container')?.style.setProperty('--combat-playback-rate',String(state.settings.speed));
    if(!state.settings.sound||!state.settings.volume)stopVoices();
    if(state.settings.quality==='off')clearVisuals();
    return{...state.settings};
  }
  const duration=ms=>Math.max(0,Number(ms)||0)/state.settings.speed;
  const reduced=()=>Boolean(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const enabled=()=>!doc?.hidden&&global.LuminousCombatStepRuntime?.presentationEnabled?.()!==false;
  const moving=()=>enabled()&&!reduced()&&state.settings.quality!=='off';
  const readable=id=>Boolean(global.LuminousCombatHudMotion073?.canRead(id));
  const profile=entry=>global.LuminousCombatAnimationProfiles073?.resolve(entry)||{id:'slash',shape:'slash',color:'#e7c68c',accent:'#fff0c9',impact:260,travel:0,kick:0,priority:1,sound:'steel'};
  const entryKey=entry=>`${entry?.ownerId}:${entry?.localIndex??0}`;
  function later(callback,ms){const timer=global.setTimeout(()=>{state.timers.delete(timer);callback();},duration(ms));state.timers.add(timer);return timer;}
  function remove(node){node?.remove();state.nodes.delete(node);}
  function animate(node,frames,ms,finish=()=>remove(node)){
    if(typeof node?.animate!=='function'){finish();return null;}
    let a;try{a=node.animate(frames,{duration:duration(ms),easing:'ease-out',fill:'both'});}catch(_){finish();return null;}
    state.animations.add(a);a.onfinish=()=>{state.animations.delete(a);a.cancel();finish();};a.oncancel=()=>state.animations.delete(a);return a;
  }
  function clearVisuals(){
    for(const timer of state.timers)global.clearTimeout(timer);state.timers.clear();
    for(const a of [...state.animations])a.cancel();state.animations.clear();
    for(const node of [...state.nodes])remove(node);state.cameraPriority=0;
  }
  function stopVoices(){for(const voice of [...state.voices]){try{voice.osc.stop();}catch(_){}voice.osc.disconnect();voice.gain.disconnect();}state.voices.clear();}
  function closeAudio(){stopVoices();const context=state.context;state.context=null;state.unlocked=false;try{context?.close()?.catch(()=>{});}catch(_){} }
  function clear(){clearVisuals();stopVoices();state.entries.clear();state.featured.clear();}
  function unlock(event){
    if(!event?.isTrusted||!state.settings.sound||doc?.hidden)return;
    try{
      const Audio=global.AudioContext||global.webkitAudioContext;if(!Audio)return;
      if(!state.context||state.context.state==='closed')state.context=new Audio();
      const context=state.context;
      const ready=()=>{if(state.context===context&&context.state==='running')state.unlocked=true;};
      if(context.state==='suspended')context.resume().then(ready).catch(()=>{});else ready();
    }catch(_){closeAudio();}
  }
  const tones={steel:[880,160,.11,'triangle'],pierce:[1100,220,.1,'triangle'],thud:[140,42,.16,'sine'],magic:[360,960,.2,'sine'],fire:[240,62,.19,'sawtooth'],frost:[1350,600,.18,'sine'],heal:[440,880,.24,'sine'],guard:[620,320,.17,'triangle'],evade:[440,130,.09,'sine']};
  function sound(kind){
    const c=state.context;if(!enabled()||!state.unlocked||!state.settings.sound||!state.settings.volume||c?.state!=='running'||state.voices.size>=6)return false;
    let osc,gain,voice;
    try{
      const [from,to,length,type]=tones[kind]||tones.steel,now=c.currentTime,seconds=length/state.settings.speed;
      osc=c.createOscillator();gain=c.createGain();voice={osc,gain};osc.type=type;osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+seconds);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,state.settings.volume*.18),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+seconds);
      osc.connect(gain);gain.connect(c.destination);state.voices.add(voice);
      osc.onended=()=>{state.voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(now);osc.stop(now+seconds+.02);return true;
    }catch(_){if(voice)state.voices.delete(voice);try{osc?.disconnect();gain?.disconnect();}catch(_){}return false;}
  }
  function point(id){
    if(!readable(id))return null;
    const sprite=byId(`sprite-${id}`),host=byId('game-container');if(!sprite||!host)return null;
    const r=sprite.getBoundingClientRect(),h=host.getBoundingClientRect();
    if(r.width<1||r.height<1||r.right<h.left||r.left>h.right||r.bottom<h.top||r.top>h.bottom)return null;
    return{x:r.left+r.width*.5-h.left,y:r.top+r.height*.55-h.top};
  }
  const art={
    slash:'<path d="M16 112Q66 14 125 23Q73 53 16 112Z" fill="currentColor"/><path d="M25 112L116 30" stroke="var(--av-accent)" stroke-width="3"/>',
    pierce:'<path d="M8 70L108 57L134 70L108 83Z" fill="currentColor"/><path d="M29 70H130" stroke="var(--av-accent)" stroke-width="4"/>',
    burst:'<path d="M70 9L83 49L113 24L98 61L136 70L97 83L118 117L81 97L70 135L59 96L22 115L44 81L5 70L45 59L24 23L58 45Z" fill="currentColor"/><circle cx="70" cy="70" r="24" fill="var(--av-accent)"/>',
    flame:'<path d="M69 9Q99 38 88 56Q113 43 114 80Q112 116 70 129Q24 112 28 78Q25 52 50 36Q40 72 59 72Q78 61 69 9Z" fill="currentColor"/><path d="M70 72Q94 95 70 119Q48 100 70 72Z" fill="var(--av-accent)"/>',
    frost:'<g stroke="currentColor" stroke-width="5" fill="none"><path d="M70 12V128M20 41L120 99M20 99L120 41M50 25L70 42L90 25M50 115L70 98L90 115M26 61L45 56L40 36M100 104L95 84L114 79M26 79L45 84L40 104M100 36L95 56L114 61"/></g>',
    sigil:'<g stroke="currentColor" stroke-width="4" fill="none"><circle cx="70" cy="70" r="46"/><path d="M70 10L122 100H18ZM70 130L18 40H122Z"/><circle cx="70" cy="70" r="17" fill="var(--av-accent)" stroke="none"/></g>',
    guard:'<path d="M70 12L119 34L111 88L70 128L29 88L21 34Z" fill="none" stroke="currentColor" stroke-width="8"/><path d="M70 34V99M46 60H94" stroke="var(--av-accent)" stroke-width="4"/>',
    evade:'<g fill="none" stroke="currentColor" stroke-width="5"><path d="M16 50Q65 15 119 50M7 75Q65 40 130 75M18 100Q67 65 121 100"/></g>',
    heal:'<g fill="none" stroke="currentColor" stroke-width="4"><circle cx="70" cy="70" r="46"/><circle cx="70" cy="70" r="57" stroke-dasharray="8 9"/></g><path d="M61 39H79V61H101V79H79V101H61V79H39V61H61Z" fill="var(--av-accent)"/>'
  };
  function effect(p,kind=p.shape){
    const layer=byId('combat-av-layer'),limit=state.settings.quality==='low'?6:14;if(!layer||state.nodes.size>=limit)return null;
    const node=doc.createElement('div');node.className='combat-av-effect';node.dataset.profile=p.id;node.dataset.effect=kind;node.style.setProperty('--av-color',p.color);node.style.setProperty('--av-accent',p.accent);node.style.color=p.color;
    // Only local constant SVG markup is used; skill/unit text never enters HTML.
    node.innerHTML=`<svg viewBox="0 0 140 140" aria-hidden="true">${art[kind]||art.slash}</svg>`;layer.appendChild(node);state.nodes.add(node);return node;
  }
  function kick(p){
    const amount=state.settings.quality==='low'?0:Math.min(3,p.kick||0);if(!moving()||!amount||p.priority<state.cameraPriority)return;
    state.cameraPriority=p.priority;
    for(const node of [byId('battlefield'),byId('webgl2-dom-background'),byId('combat-stage-foreground')].filter(Boolean)){
      animate(node,[{translate:'0px 0px'},{translate:`${amount}px -1px`,offset:.3},{translate:`-${amount}px 1px`,offset:.6},{translate:'0px 0px'}],130,()=>{});
    }
    later(()=>{state.cameraPriority=0;},140);global.LuminousWebGL2Renderer?.requestRender?.(200);
  }
  function impact(entry,targetId,p=profile(entry),critical=false){
    if(!enabled()||!readable(entry?.ownerId)||!readable(targetId))return;
    const location=point(targetId);if(!location)return;
    sound(p.sound);if(!moving())return;
    const node=effect(p);if(!node)return;
    const size=node.offsetWidth||140,scale=critical?1.22:1;
    const base=`translate(${location.x-size/2}px,${location.y-size/2}px)`;
    node.dataset.marker='impact';animate(node,[{transform:`${base} scale(.58)`,opacity:0},{transform:`${base} scale(${scale})`,opacity:.95,offset:.25},{transform:`${base} scale(${scale*1.14})`,opacity:0}],p.impact);
    kick(critical?{...p,kick:3,priority:4}:p);
  }
  function hit(entry,targetId,result={}){
    if(!enabled()||!readable(entry?.ownerId)||!readable(targetId))return;
    const p=profile(entry),from=point(entry.ownerId),to=point(targetId);
    if(!from||!to)return;
    if(!moving()){impact(entry,targetId,p);return;}
    if(!p.travel){impact(entry,targetId,p,Boolean(result?.critical));return;}
    const node=effect(p,p.shape==='flame'?'flame':'pierce');if(!node){impact(entry,targetId,p);return;}
    node.classList.add('combat-av-projectile');node.dataset.marker='projectile';
    const angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
    animate(node,[{transform:`translate(${from.x-21}px,${from.y-11}px) rotate(${angle}deg) scale(.65)`,opacity:0},{transform:`translate(${from.x-21}px,${from.y-11}px) rotate(${angle}deg)`,opacity:1,offset:.12},{transform:`translate(${to.x-21}px,${to.y-11}px) rotate(${angle}deg)`,opacity:1}],p.travel,()=>{remove(node);impact(entry,targetId,p,Boolean(result?.critical));});
  }
  function feature(entry){
    const p=profile(entry),key=entryKey(entry);if(!moving()||!p.cutin||state.settings.quality!=='full'||state.featured.has(key)||!readable(entry.ownerId))return;
    state.featured.add(key);const layer=byId('combat-av-layer');if(!layer)return;
    const old=byId('combat-av-cutin');if(old)remove(old);
    const node=doc.createElement('div');node.id='combat-av-cutin';node.dataset.profile=p.id;node.textContent=entry.plan?.data?.name||'Habilidad';node.style.setProperty('--av-color',p.color);layer.appendChild(node);state.nodes.add(node);
    animate(node,[{transform:'translateX(26px)',opacity:0},{transform:'translateX(0)',opacity:1,offset:.15},{transform:'translateX(0)',opacity:1,offset:.75},{transform:'translateX(12px)',opacity:0}],640);
  }
  function cue(name,args=[]){
    const [a,b,c]=args;if(a?.ownerId&&a.plan)state.entries.set(entryKey(a),a);
    if(name==='actionStart')return;
    if(name==='powerStart'||name==='hitStart')feature(a);
    else if(name==='hitMotion')hit(a,b,c);
    else if(name==='healingMotion')impact(a,b,profile({plan:{data:{kind:'heal'}}}));
    else if(name==='spellResult'){feature(a);if(c?.success)impact(a,b,profile({plan:{data:{defenseType:'evade'}}}));else hit(a,b);}
    else if(name==='evadeEnd'&&b?.evaded)impact(a,a.ownerId,profile({plan:{data:{defenseType:'evade'}}}));
    else if(name==='guardEnd')impact(a,a.ownerId,profile({plan:{data:{defenseType:'guard'}}}));
    else if(name==='clashOutcome'&&b?.ownerId&&c!=='tie'&&readable(a?.ownerId)&&readable(b.ownerId)){const winner=c==='b'?b:a,loser=c==='b'?a:b;impact(winner,loser.ownerId,{...profile(winner),shape:'burst',sound:'steel',kick:1});}
  }
  function event(value){
    const generation=value.roundId||`${value.encounterId||''}:${value.round}`;
    if(generation!==state.generation){clear();state.generation=generation;state.lastSequence=0;}
    if(Number(value.sequence)<=state.lastSequence)return;state.lastSequence=Number(value.sequence)||0;
    // Retain entries even if presentation is skipped; events never replay a cue.
    if(value.type==='Presentation'&&value.args?.[0]?.ownerId){const entry=value.args[0];state.entries.set(entryKey(entry),entry);}
    if(value.type==='ActionCancelled')clearVisuals();
    else if(value.type==='RoundFinished')clear();
  }
  function mount(){
    const host=byId('game-container');if(state.mounted||!host)return;state.mounted=true;
    const layer=doc.createElement('div');layer.id='combat-av-layer';layer.setAttribute('aria-hidden','true');host.appendChild(layer);
    const settings=doc.createElement('details');settings.id='combat-av-settings';settings.innerHTML='<summary>Opciones</summary><label>Sonido<input id="combat-av-sound" type="checkbox"></label><label>Volumen<input id="combat-av-volume" type="range" min="0" max="60" step="1"></label><label>Efectos<select id="combat-av-quality"><option value="full">Completos</option><option value="low">Ligeros</option><option value="off">Desactivados</option></select></label><label>Reproducción<select id="combat-av-speed"><option value="1">Normal</option><option value="2">Rápida · ×2</option></select></label>';host.appendChild(settings);
    const controls={sound:byId('combat-av-sound'),volume:byId('combat-av-volume'),quality:byId('combat-av-quality'),speed:byId('combat-av-speed')};
    controls.sound.checked=state.settings.sound;controls.volume.value=Math.round(state.settings.volume*100);controls.quality.value=state.settings.quality;controls.speed.value=state.settings.speed;
    for(const [key,input]of Object.entries(controls))input.onchange=event=>{preferences({[key]:key==='sound'?input.checked:key==='volume'?Number(input.value)/100:key==='speed'?Number(input.value):input.value});unlock(event);};
    global.addEventListener('pointerdown',unlock,{passive:true});global.addEventListener('keydown',unlock,{passive:true});
    global.addEventListener('resize',clearVisuals);doc.addEventListener('visibilitychange',()=>{if(doc.hidden){clearVisuals();stopVoices();}});
    global.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',clearVisuals);
    global.addEventListener('luminous:combat073-hydrated',()=>{clear();const id=global.LuminousCombatLiveAdapter073?.state?.encounterId;if(state.encounter&&state.encounter!==id)closeAudio();state.encounter=id;});
    global.addEventListener('beforeunload',()=>{clear();closeAudio();});preferences();
  }
  global.LuminousCombatAudiovisual073=Object.freeze({version:1,state,preferences,duration,profile,cue,event,clear,mount});mount();
})(typeof window==='undefined'?globalThis:window);
