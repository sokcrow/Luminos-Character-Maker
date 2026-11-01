(function (global) {
  "use strict";
  const doc = global.document, core = global.LuminousSocialLinkCore;
  if (!doc || !core || global.LuminousSocialLinkHud) return;
  const state = {playerId:"",uid:"",profiles:{},progress:{},selected:"",tab:"history",loading:true,error:"",generation:0,off:[],context:null};
  const modal = doc.createElement("section");
  modal.id = "vinculos-modal"; modal.className = "hud-modal social-link-modal";
  modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-labelledby","sl-title"); modal.setAttribute("aria-hidden","true");
  modal.innerHTML = `<div class="sl-window"><header class="sl-header"><div><span class="sl-kicker">Personas · Historias · Recuerdos</span><h2 id="sl-title">Vínculos</h2></div><button type="button" name="act_hud_close" class="sl-close" aria-label="Cerrar vínculos">Cerrar <span aria-hidden="true">×</span></button></header><div id="sl-body" class="sl-body"></div></div>`;
  doc.body.append(modal);
  const node = (tag, className, text) => { const el=doc.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el; };
  const roman = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X"];
  function rows() {
    return Object.entries(state.profiles).map(([id,profile]) => ({id,view:core.playerView(profile)}))
      .filter(row=>row.view).sort((a,b)=>a.view.name.localeCompare(b.view.name));
  }
  function portrait(view, className) {
    const frame=node("div",className);const fallback=node("span","sl-initial",view.name.slice(0,1).toUpperCase());frame.append(fallback);
    if(view.portrait){const img=node("img");img.src=view.portrait;img.alt="";img.addEventListener("error",()=>img.remove(),{once:true});frame.append(img);}
    return frame;
  }
  function render() {
    const host=doc.getElementById("sl-body");host.replaceChildren();
    if(state.error||state.loading||!state.playerId){
      const message=node("div","sl-empty",state.error||(!state.playerId?"Esperando conexión con tu personaje…":"Cargando tus vínculos…"));message.setAttribute("role","status");
      if(state.error){const retry=node("button","sl-retry","Volver a cargar");retry.type="button";retry.onclick=()=>sync(state.context?.data||{},state.context?.playerId,true);message.append(retry);}
      host.append(message);return;
    }
    const list=rows();
    if(!list.length){const empty=node("div","sl-empty","Todavía no tienes vínculos desbloqueados. Los personajes aparecerán aquí cuando se revele su relación contigo.");empty.setAttribute("role","status");host.append(empty);return;}
    if(!list.some(row=>row.id===state.selected))state.selected=list[0].id;
    const roster=node("nav","sl-roster");roster.setAttribute("aria-label","Tus vínculos conocidos");
    list.forEach(({id,view})=>{const b=node("button","sl-person"+(id===state.selected?" is-selected":""));b.type="button";b.setAttribute("aria-pressed",String(id===state.selected));
      b.append(portrait(view,"sl-thumb"));const copy=node("span","sl-person-copy");copy.append(node("strong","",view.name),node("small","",view.arcana?"Arcano · "+view.arcana:(view.combatant?"Combatiente":"No combatiente")));b.append(copy,node("span","sl-person-rank",roman[view.rank]));
      b.onclick=()=>{state.selected=id;render();host.querySelector('.sl-person[aria-pressed="true"]')?.focus();};roster.append(b);});
    const view=list.find(row=>row.id===state.selected).view;
    const detail=node("article","sl-detail");detail.append(portrait(view,"sl-portrait"));
    const title=node("div","sl-nameplate");title.append(node("span","sl-kicker",view.title|| (view.combatant?"Combatiente":"No combatiente")),node("h3","",view.name));if(view.arcana)title.append(node("p","sl-arcana","Arcano · "+view.arcana));detail.append(title);
    const progress=node("section","sl-progress");progress.setAttribute("aria-label","Progreso del vínculo");
    const heading=node("div","sl-progress-heading");heading.append(node("span","","Rango "+roman[view.rank]+" / X"),node("span","",view.threshold==null?"Vínculo máximo":view.affinity+" / "+view.threshold+" de afinidad"));progress.append(heading);
    const meter=node("div","sl-meter");meter.setAttribute("role","progressbar");meter.setAttribute("aria-label","Afinidad hacia el siguiente rango");meter.setAttribute("aria-valuemin","0");meter.setAttribute("aria-valuemax",String(view.threshold||1));meter.setAttribute("aria-valuenow",String(view.threshold==null?1:Math.min(view.threshold,Math.max(0,view.affinity))));
    const fill=node("div");fill.style.width=(view.threshold==null?100:Math.min(100,Math.max(0,view.affinity/view.threshold*100)))+"%";meter.append(fill);progress.append(meter);
    if(view.threshold!=null&&view.affinity>=view.threshold)progress.append(node("p","sl-ready","Afinidad suficiente para el siguiente rango."));detail.append(progress);
    const tabs=node("nav","sl-tabs");tabs.setAttribute("role","tablist");tabs.setAttribute("aria-label","Información del vínculo");
    [["history","Historia compartida"],["benefits","Beneficios"]].forEach(([id,label])=>{const b=node("button","",label);b.type="button";b.id="sl-tab-"+id;b.setAttribute("role","tab");b.setAttribute("aria-controls","sl-panel");b.setAttribute("aria-selected",String(state.tab===id));b.tabIndex=state.tab===id?0:-1;
      b.onclick=()=>{state.tab=id;render();doc.getElementById(b.id)?.focus();};b.onkeydown=e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();state.tab=e.key==="Home"?"history":e.key==="End"?"benefits":state.tab==="history"?"benefits":"history";render();doc.getElementById("sl-tab-"+state.tab)?.focus();};tabs.append(b);});detail.append(tabs);
    const panel=node("section","sl-panel");panel.id="sl-panel";panel.setAttribute("role","tabpanel");panel.setAttribute("aria-labelledby","sl-tab-"+state.tab);
    if(state.tab==="history"){
      if(view.description)panel.append(node("p","sl-description",view.description));
      if(view.story)panel.append(node("p","sl-story",view.story));
      if(view.memories.length){const memories=node("ol","sl-memories");view.memories.forEach(memory=>memories.append(node("li","",memory)));panel.append(memories);}
      if(!view.description&&!view.story&&!view.memories.length)panel.append(node("p","sl-muted","Todavía no hay recuerdos publicados de esta relación."));
    }else{
      if(view.benefits.length)view.benefits.forEach(text=>{const card=node("details","sl-benefit");const [name,...rest]=text.split(" — ");card.append(node("summary","",name));card.append(node("p","",rest.join(" — ")||text));panel.append(card);});
      else panel.append(node("p","sl-muted","Todavía no hay beneficios revelados para este vínculo."));
    }
    detail.append(panel);host.append(roster,detail);
  }
  function stop() {state.generation++;state.off.splice(0).forEach(off=>off());state.playerId="";state.uid="";state.profiles={};state.progress={};state.selected="";state.error="";state.loading=true;}
  function sync(data={},playerId,force=false) {
    const uid=global.firebase?.auth?.().currentUser?.uid;
    if(!uid||!playerId||data.uid!==uid){stop();state.context=null;render();return;}
    try{core.safeKey(playerId);}catch(_){stop();render();return;}
    state.context={data,playerId};
    if(!force&&state.playerId===playerId&&state.uid===uid)return;
    stop();state.playerId=playerId;state.uid=uid;render();
    const generation=state.generation,seen=new Set();
    [[core.PUBLIC_ROOT,"profiles"]].forEach(([root,key])=>{
      const ref=global.firebase.database().ref(`${root}/${playerId}`);
      const handler=snapshot=>{if(generation!==state.generation)return;state[key]=snapshot.val()||{};seen.add(key);state.loading=seen.size<1;render();};
      ref.on("value",handler,()=>{if(generation!==state.generation)return;state.loading=false;state.error="No se pudieron cargar tus vínculos. Vuelve a intentarlo cuando haya conexión.";render();});
      state.off.push(()=>ref.off("value",handler));
    });
  }
  let returnFocus=null,wasOpen=false;
  new MutationObserver(()=>{const open=modal.classList.contains("active");if(open&&!wasOpen){returnFocus=doc.activeElement;modal.querySelector(".sl-close").focus();}else if(!open&&wasOpen)returnFocus?.focus?.();wasOpen=open;}).observe(modal,{attributes:true,attributeFilter:["class"]});
  modal.addEventListener("click",e=>{if(e.target===modal)global.LuminousPlayerHudNavigation?.closeAll();});
  modal.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();global.LuminousPlayerHudNavigation?.closeAll();return;}if(e.key!=="Tab")return;
    const nodes=[...modal.querySelectorAll('button:not([disabled]),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&el.tabIndex>=0),first=nodes[0],last=nodes.at(-1);
    if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first?.focus();}
  });
  global.addEventListener("luminous:player-data",event=>sync(event.detail?.data||{},event.detail?.playerId));
  global.firebase?.auth?.().onAuthStateChanged(user=>{
    if(!user||state.uid&&state.uid!==user.uid){stop();state.context=null;render();}
    if(user&&global.datosJugador?.uid===user.uid&&!state.playerId){let id;try{id=global.localStorage.getItem("playerId");}catch(_){}if(id)sync(global.datosJugador,id);}
  });
  if(global.datosJugador?.uid){let id;try{id=global.localStorage.getItem("playerId");}catch(_){}if(id)sync(global.datosJugador,id);}
  render();global.LuminousSocialLinkHud=Object.freeze({sync});
})(window);
