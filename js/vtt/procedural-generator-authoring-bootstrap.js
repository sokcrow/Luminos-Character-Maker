import './procedural-preview-renderer-patch.js';

const TOOLBAR_ID='vtt-procedural-generator-toolbar';
const PANEL_ID='vtt-procedural-zone-panel';
const STYLE_ID='vtt-procedural-generator-style';
const MIX_FIELDS=Object.freeze({shop:'shop',apartment:'apartment_building',workshop:'workshop',warehouse:'warehouse'});
const clean=v=>String(v??'').trim();
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData||!runtime.bridge?.isDm)return null;
  if(window.LuminousVttProceduralGeneratorAuthoringRuntime?.stop)return window.LuminousVttProceduralGeneratorAuthoringRuntime;
  const procedural=runtime.procedural;if(!procedural)return null;

  mapData.proceduralEditor||={previewPlan:null,previewOptions:{showChunks:true,showParcels:true,showRooms:true,showTopology:true,showLabels:true}};
  mapData.proceduralEditor.previewGenerationError??=null;
  let toolbar=null,panel=null,lastPlan=null,stopped=false,reroll=0,panelOpen=false,busy=false,generationRevision=0;
  const stopPreviewRenderer=window.LuminousVttProceduralPreviewRenderer?.install?.(runtime.engine.renderer,mapData)||(()=>{});
  const enabled=()=>mapData.dmEditMode?.active===true;

  function notify(message,type='info'){runtime.controller?.notify?.(message,type);}
  function invalidate(){runtime.engine.renderer?.invalidate?.();runtime.engine.invalidate?.();}
  function by(sel){return panel?.querySelector(sel)||null;}
  function number(sel,fallback=0){const n=Number(by(sel)?.value);return Number.isFinite(n)?n:fallback;}
  function selectedSize(){return Math.max(1,Math.min(3,Math.trunc(number('[data-proc-size]',3))));}
  function baseSeed(){return clean(by('[data-proc-seed]')?.value)||`${mapData.id||mapData.mapId||'map'}:zone`;}
  function seed(){const base=baseSeed();return reroll?`${base}:reroll:${reroll}`:base;}
  function selectedProfileId(){return by('[data-proc-profile]')?.value||'mixed_urban';}
  function customBuildingMix(){
    const mix={};let total=0;
    for(const[name,key]of Object.entries(MIX_FIELDS)){mix[key]=clamp(number(`[data-proc-mix="${name}"]`,0),0,100)/100;total+=mix[key];}
    if(total<=0)return procedural.buildingMix?.(selectedProfileId())||{shop:.3,apartment_building:.35,workshop:.2,warehouse:.15};
    for(const key of Object.values(MIX_FIELDS))mix[key]/=total;
    return mix;
  }
  function customProfile(){
    const base=procedural.profile(selectedProfileId());
    return{...base,
      density:clamp(number('[data-proc-density]',base.density*100)/100,0,1),
      attachBias:clamp(number('[data-proc-attach]',base.attachBias*100)/100,0,1),
      alleyBias:clamp(number('[data-proc-alley]',base.alleyBias*100)/100,0,1),
      serviceAccessBias:clamp(number('[data-proc-service]',base.serviceAccessBias*100)/100,0,1),
      secondaryRoadChance:clamp(number('[data-proc-secondary]',base.secondaryRoadChance*100)/100,0,1),
      buildingMix:customBuildingMix(),
    };
  }
  function values(){
    const size=selectedSize();
    return{seed:seed(),profile:customProfile(),chunkCols:size,chunkRows:size,minBuildings:size===1?1:size===2?3:4};
  }

  function clearPreview({invalidateGeneration=true,clearError=true}={}){
    if(invalidateGeneration)generationRevision+=1;
    lastPlan=null;mapData.proceduralEditor.previewPlan=null;
    if(clearError)mapData.proceduralEditor.previewGenerationError=null;
    invalidate();
  }

  function randomSeed(){
    const bytes=new Uint32Array(2);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);else{bytes[0]=Date.now();bytes[1]=Math.floor(Math.random()*0xffffffff);}
    const next=`${mapData.id||mapData.mapId||'map'}:${bytes[0].toString(36)}${bytes[1].toString(36)}`;const input=by('[data-proc-seed]');if(input)input.value=next;reroll=0;clearPreview();syncUi();return next;
  }

  function writeBuildingMix(mix={}){
    const entries=Object.entries(MIX_FIELDS),values={};let assigned=0;
    for(let i=0;i<entries.length;i++){
      const[name,key]=entries[i],value=i===entries.length-1?Math.max(0,100-assigned):Math.max(0,Math.round((Number(mix[key])||0)*100));values[name]=value;assigned+=value;
    }
    const correction=100-Object.values(values).reduce((sum,value)=>sum+value,0);values[entries[entries.length-1][0]]+=correction;
    for(const[name]of entries){const input=by(`[data-proc-mix="${name}"]`);if(input)input.value=values[name];}
  }

  function rebalanceBuildingMix(changedName){
    const names=Object.keys(MIX_FIELDS),target=clamp(Math.round(number(`[data-proc-mix="${changedName}"]`,0)),0,100),others=names.filter(name=>name!==changedName),remaining=100-target,current=others.map(name=>Math.max(0,number(`[data-proc-mix="${name}"]`,0))),sum=current.reduce((a,b)=>a+b,0),next={};
    next[changedName]=target;
    let assigned=target;
    for(let i=0;i<others.length;i++){
      const name=others[i],value=i===others.length-1?Math.max(0,100-assigned):Math.max(0,Math.round(sum>0?(current[i]/sum)*remaining:remaining/others.length));next[name]=value;assigned+=value;
    }
    next[others[others.length-1]]+=100-Object.values(next).reduce((a,b)=>a+b,0);
    for(const name of names){const input=by(`[data-proc-mix="${name}"]`);if(input)input.value=clamp(next[name],0,100);}
  }

  function setProfileControls(profileId=selectedProfileId()){
    const p=procedural.profile(profileId),pairs=[['density','density'],['attach','attachBias'],['alley','alleyBias'],['service','serviceAccessBias'],['secondary','secondaryRoadChance']];
    for(const[name,key]of pairs){const input=by(`[data-proc-${name}]`),readout=by(`[data-proc-${name}-value]`);if(input)input.value=Math.round((Number(p[key])||0)*100);if(readout)readout.textContent=`${input?.value||0}%`;}
    writeBuildingMix(procedural.buildingMix?.(profileId)||{});
    clearPreview();syncUi();
  }

  function setBusy(next,label='GENERATING'){busy=Boolean(next);const spinner=by('[data-proc-busy]');if(spinner){spinner.hidden=!busy;spinner.textContent=busy?label:'';}syncUi();}
  function updatePreviewOptions(){
    const o=mapData.proceduralEditor.previewOptions||{};
    for(const key of ['showChunks','showParcels','showRooms','showTopology','showLabels']){const input=by(`[data-proc-view="${key}"]`);if(input)o[key]=input.checked;}
    mapData.proceduralEditor.previewOptions=o;invalidate();
  }

  function generationChanged({resetReroll=true}={}){if(resetReroll)reroll=0;clearPreview();syncUi();}
  function fitPreview(){
    const plan=lastPlan,camera=runtime.engine.camera;if(!plan||!camera)return false;const size=Number(plan.mapData?.grid?.size)||70,width=(Number(plan.zone?.cols)||120)*size,height=(Number(plan.zone?.rows)||120)*size,canvas=runtime.engine.canvas,pad=64;
    if(!canvas||!Number.isFinite(Number(canvas.width))||!Number.isFinite(Number(canvas.height)))return false;
    const target=Math.min((canvas.width-pad*2)/Math.max(1,width),(canvas.height-pad*2)/Math.max(1,height));camera.zoom=Math.max(camera.minZoom||.1,Math.min(camera.maxZoom||5,target));camera.centerOnWorldPoint?.({x:width/2,y:height/2});invalidate();return true;
  }
  function generationErrorMessage(error){
    const first=error?.failures?.[0]?.errors?.[0];
    return clean(first?.code||first?.message||error?.message)||'PROCEDURAL_GENERATION_FAILED';
  }

  async function preview({fit=true}={}){
    if(busy)return null;
    const requestRevision=generationRevision;
    setBusy(true,'GENERATING');
    let generated=null;
    try{
      generated=await(procedural.previewAsync?procedural.previewAsync(values()):Promise.resolve(procedural.preview(values())));
      if(requestRevision!==generationRevision)return null;
      lastPlan=generated;mapData.proceduralEditor.previewPlan=generated;mapData.proceduralEditor.previewGenerationError=null;reroll=Math.max(0,reroll);
    }catch(error){
      if(requestRevision!==generationRevision)return null;
      const message=generationErrorMessage(error);clearPreview({invalidateGeneration:false,clearError:false});mapData.proceduralEditor.previewGenerationError=message;
      console.error('VTT PROCEDURAL PREVIEW GENERATION FAILED:',error);notify(message,'warning');return null;
    }finally{
      setBusy(false);syncUi();
    }
    if(!generated||requestRevision!==generationRevision)return null;
    if(fit){
      try{if(!fitPreview())notify('Preview válido; no se pudo encuadrar automáticamente.','warning');}
      catch(error){console.warn('VTT procedural preview camera fit failed:',error);notify('Preview válido; ENCUADRAR falló, pero la zona puede crearse.','warning');}
    }
    notify(`Preview válido · ${generated.validation.summary.buildings} edificios · ${generated.signature}`,'success');syncUi();return generated;
  }

  function rerollPreview(){reroll+=1;return preview();}
  function sceneHasContent(){return['topology','walls','worldObjects','horizontalPlanes','structures','verticalPortals'].some(k=>(mapData[k]||[]).length>0)||(mapData.semantics?.buildings||[]).length>0;}
  function createZone(){
    if(!lastPlan?.validation?.valid||busy)return null;
    if(sceneHasContent()&&!window.confirm('CREAR ZONA reemplazará la geometría y semántica actual. Los tokens de jugador se conservarán. ¿Continuar?'))return null;
    try{procedural.apply(lastPlan,{replaceScene:true});mapData.proceduralEditor.previewPlan=null;notify(`Zona creada · ${lastPlan.signature}`,'success');panelOpen=false;syncUi();return lastPlan;}
    catch(error){notify(error?.message||'PROCEDURAL_APPLY_FAILED','warning');return null;}
  }

  function openPanel(){if(!enabled())return false;panelOpen=true;syncUi();return true;}
  function closePanel(){panelOpen=false;clearPreview();syncUi();return true;}

  function metric(label,value){return`<div class="proc-metric"><span>${label}</span><strong>${value}</strong></div>`;}
  function syncUi(){
    if(!toolbar||!panel)return;toolbar.hidden=!enabled();if(!enabled())panelOpen=false;panel.hidden=!panelOpen;
    const launch=toolbar.querySelector('[data-proc-open]');if(launch)launch.setAttribute('aria-expanded',panelOpen?'true':'false');
    const apply=by('[data-proc-apply]'),rerollButton=by('[data-proc-reroll]'),previewButton=by('[data-proc-preview]');if(apply)apply.disabled=busy||!lastPlan?.validation?.valid;if(rerollButton)rerollButton.disabled=busy;if(previewButton)previewButton.disabled=busy;
    for(const name of ['density','attach','alley','service','secondary']){const input=by(`[data-proc-${name}]`),out=by(`[data-proc-${name}-value]`);if(input&&out)out.textContent=`${input.value}%`;}
    let mixTotal=0;for(const name of Object.keys(MIX_FIELDS)){const input=by(`[data-proc-mix="${name}"]`),out=by(`[data-proc-mix-value="${name}"]`);if(input&&out){out.textContent=`${input.value}%`;mixTotal+=Number(input.value)||0;}}const mixTotalOut=by('[data-proc-mix-total]');if(mixTotalOut)mixTotalOut.textContent=`${mixTotal}%`;
    const status=by('[data-proc-status]'),metrics=by('[data-proc-metrics]'),signature=by('[data-proc-signature]'),warning=by('[data-proc-replace-warning]'),generationError=mapData.proceduralEditor?.previewGenerationError;
    if(warning)warning.hidden=!sceneHasContent();
    if(!lastPlan){if(status){status.textContent=generationError?'ERROR':'SIN PREVIEW';status.dataset.state=generationError?'invalid':'idle';}if(metrics)metrics.innerHTML=metric('ZONE',`${selectedSize()}×${selectedSize()} CHUNKS`)+metric('CELDAS',`${selectedSize()*40}×${selectedSize()*40}`)+metric('ESTADO',generationError?'ERROR':'—');if(signature)signature.textContent=generationError?`PREVIEW FALLÓ · ${generationError} · usa REROLL o cambia la configuración.`:'Genera un preview para validar la zona.';}
    else{const v=lastPlan.validation,f=lastPlan.fabric,z=lastPlan.zone;if(status){status.textContent=v.valid?'VALIDADO':'INVÁLIDO';status.dataset.state=v.valid?'valid':'invalid';}if(metrics)metrics.innerHTML=metric('ZONE',`${z.chunkCols}×${z.chunkRows} CHUNKS`)+metric('CELDAS',`${z.cols}×${z.rows}`)+metric('EDIFICIOS',v.summary.buildings)+metric('CALLES',f.streets.length)+metric('PARCELAS',f.parcels.length)+metric('CALLEJONES',f.alleys.length);if(signature)signature.textContent=`SEED ${lastPlan.seed} · SIG ${lastPlan.signature} · ATTEMPT ${lastPlan.attempt}`;}
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${TOOLBAR_ID}{border-color:#d7b151!important}#${TOOLBAR_ID} [data-proc-open]{border-color:#d7b151;color:#f3d982;background:linear-gradient(180deg,#18150c,#0d0c08)}
#${PANEL_ID}{position:fixed;right:210px;top:12px;bottom:12px;z-index:37200;width:390px;box-sizing:border-box;display:flex;flex-direction:column;background:rgba(7,9,11,.985);border:1px solid #d7b151;box-shadow:-8px 8px 0 rgba(0,0,0,.62);color:#e7e9eb;font:11px/1.35 monospace;pointer-events:auto}#${PANEL_ID}[hidden]{display:none}
#${PANEL_ID} *{box-sizing:border-box}#${PANEL_ID} .proc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #4b452e;background:#0d0f12}#${PANEL_ID} .proc-head strong{font-size:14px;letter-spacing:.14em;color:#f0ca59}#${PANEL_ID} .proc-head small{display:block;color:#7e8790;margin-top:2px;letter-spacing:.08em}#${PANEL_ID} .proc-close{width:32px;height:32px;border:1px solid #555;background:#101216;color:#ddd;font:18px monospace;cursor:pointer}
#${PANEL_ID} .proc-scroll{overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}#${PANEL_ID} .proc-section{border:1px solid #30363d;background:#0b0e11;padding:10px}#${PANEL_ID} .proc-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;color:#d7b151;font-weight:700;letter-spacing:.12em}#${PANEL_ID} label{display:grid;gap:4px;margin:7px 0;color:#aeb6bd}#${PANEL_ID} input[type=text],#${PANEL_ID} select{width:100%;border:1px solid #515960;background:#080a0c;color:#f2f2f2;padding:8px;font:11px monospace;outline:none}#${PANEL_ID} input:focus,#${PANEL_ID} select:focus{border-color:#d7b151;box-shadow:0 0 0 1px #d7b15133}
#${PANEL_ID} .proc-seed-row{display:grid;grid-template-columns:1fr auto;gap:6px}#${PANEL_ID} .proc-mini{border:1px solid #555;background:#11151a;color:#d9dee2;padding:0 10px;cursor:pointer;font:10px monospace}#${PANEL_ID} .proc-slider{display:grid;grid-template-columns:112px 1fr 38px;align-items:center;gap:8px;margin:8px 0}#${PANEL_ID} input[type=range]{width:100%;accent-color:#d7b151}#${PANEL_ID} .proc-value{text-align:right;color:#f0ca59}
#${PANEL_ID} .proc-view-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}#${PANEL_ID} .proc-check{display:flex;align-items:center;gap:6px;margin:0;padding:6px;border:1px solid #262c31;background:#0d1013;color:#c5ccd2}#${PANEL_ID} .proc-status{padding:7px 9px;border:1px solid #555;letter-spacing:.12em;font-weight:700}#${PANEL_ID} .proc-status[data-state=valid]{border-color:#4fa875;color:#79e7a8;background:#0b1911}#${PANEL_ID} .proc-status[data-state=invalid]{border-color:#a84f4f;color:#ff8b8b;background:#1b0c0c}#${PANEL_ID} .proc-metrics{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}#${PANEL_ID} .proc-metric{display:flex;justify-content:space-between;gap:8px;border:1px solid #272d32;padding:6px;background:#090b0d}#${PANEL_ID} .proc-metric span{color:#77818a}#${PANEL_ID} .proc-metric strong{color:#e5e8ea}#${PANEL_ID} .proc-signature{margin-top:8px;color:#7f8992;word-break:break-all}#${PANEL_ID} .proc-warning{border:1px solid #8e6d2a;background:#1b1608;color:#f0ca59;padding:8px;margin-top:8px}
#${PANEL_ID} .proc-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}#${PANEL_ID} .proc-action{min-height:38px;border:1px solid #545d65;background:#12161a;color:#e7eaed;font:700 10px monospace;letter-spacing:.08em;cursor:pointer}#${PANEL_ID} .proc-action:hover:not(:disabled){border-color:#d7b151;color:#f0ca59}#${PANEL_ID} .proc-action:disabled{opacity:.35;cursor:not-allowed}#${PANEL_ID} .proc-create{grid-column:1/-1;border-color:#d7b151;background:linear-gradient(180deg,#2a2412,#151107);color:#f0ca59;font-size:12px}#${PANEL_ID} .proc-busy{color:#f0ca59;text-align:center;padding:5px;letter-spacing:.1em}
@media(max-width:900px){#${PANEL_ID}{right:12px;width:min(390px,calc(100vw - 24px))}}
`;document.head.appendChild(style);
  }

  function ensureUi(){
    injectStyles();toolbar=document.createElement('div');toolbar.id=TOOLBAR_ID;toolbar.className='vtt-toolbar';toolbar.hidden=true;toolbar.innerHTML=`<span class="vtt-toolbar-title">MAP CREATOR</span><button type="button" class="brutalist-button" data-proc-open aria-expanded="false" aria-controls="${PANEL_ID}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg><span>CREAR ZONA</span></button>`;
    (document.getElementById('vtt-edit-sidebar')||document.getElementById('vtt-ui-container')||document.body).appendChild(toolbar);

    panel=document.createElement('aside');panel.id=PANEL_ID;panel.hidden=true;panel.setAttribute('aria-label','Creador procedural de zonas');
    const profileOptions=procedural.profiles().map(p=>`<option value="${p.id}">${p.label||p.id}</option>`).join('');
    panel.innerHTML=`<div class="proc-head"><div><strong>ZONE CREATOR</strong><small>PROCEDURAL MAP AUTHORING</small></div><button type="button" class="proc-close" data-proc-close aria-label="Cerrar">×</button></div><div class="proc-scroll">
      <section class="proc-section"><div class="proc-section-title"><span>01 · ZONA</span><span data-proc-status class="proc-status" data-state="idle">SIN PREVIEW</span></div><label>TIPO DE ZONA<select data-proc-profile>${profileOptions}</select></label><label>TAMAÑO<select data-proc-size><option value="1">1×1 CHUNK · 40×40</option><option value="2">2×2 CHUNKS · 80×80</option><option value="3" selected>3×3 CHUNKS · 120×120</option></select></label><label>SEED<div class="proc-seed-row"><input data-proc-seed type="text" value="${mapData.id||mapData.mapId||'map'}:zone"><button type="button" class="proc-mini" data-proc-random>RANDOM</button></div></label></section>
      <section class="proc-section"><div class="proc-section-title"><span>02 · URBAN FABRIC</span><button type="button" class="proc-mini" data-proc-reset>RESET PROFILE</button></div><div class="proc-slider"><span>DENSIDAD</span><input data-proc-density type="range" min="20" max="100" step="1"><strong class="proc-value" data-proc-density-value></strong></div><div class="proc-slider"><span>EDIF. PEGADOS</span><input data-proc-attach type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-attach-value></strong></div><div class="proc-slider"><span>CALLEJONES</span><input data-proc-alley type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-alley-value></strong></div><div class="proc-slider"><span>SERVICIO</span><input data-proc-service type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-service-value></strong></div><div class="proc-slider"><span>VÍAS SEC.</span><input data-proc-secondary type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-secondary-value></strong></div></section>
      <section class="proc-section"><div class="proc-section-title"><span>03 · BUILDING MIX</span><strong class="proc-value" data-proc-mix-total>100%</strong></div><div class="proc-slider"><span>TIENDAS</span><input data-proc-mix="shop" type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-mix-value="shop"></strong></div><div class="proc-slider"><span>APARTAMENTOS</span><input data-proc-mix="apartment" type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-mix-value="apartment"></strong></div><div class="proc-slider"><span>TALLERES</span><input data-proc-mix="workshop" type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-mix-value="workshop"></strong></div><div class="proc-slider"><span>ALMACENES</span><input data-proc-mix="warehouse" type="range" min="0" max="100" step="1"><strong class="proc-value" data-proc-mix-value="warehouse"></strong></div><small>El mix es un objetivo. La geometría mínima de cada parcela puede descartar arquetipos demasiado grandes.</small></section>
      <section class="proc-section"><div class="proc-section-title"><span>04 · PREVIEW</span><button type="button" class="proc-mini" data-proc-fit>ENCUADRAR</button></div><div class="proc-view-grid"><label class="proc-check"><input type="checkbox" data-proc-view="showChunks" checked> CHUNKS</label><label class="proc-check"><input type="checkbox" data-proc-view="showParcels" checked> PARCELAS</label><label class="proc-check"><input type="checkbox" data-proc-view="showRooms" checked> INTERIORES</label><label class="proc-check"><input type="checkbox" data-proc-view="showTopology" checked> MUROS/PUERTAS</label><label class="proc-check"><input type="checkbox" data-proc-view="showLabels" checked> LABELS</label></div><div class="proc-metrics" data-proc-metrics></div><div class="proc-signature" data-proc-signature></div><div class="proc-warning" data-proc-replace-warning hidden>CREAR ZONA reemplazará la geometría/semántica actual. Los tokens de jugador se conservan.</div></section>
      <section class="proc-section"><div class="proc-section-title"><span>05 · ACCIONES</span><span data-proc-busy class="proc-busy" hidden></span></div><div class="proc-actions"><button type="button" class="proc-action" data-proc-preview>GENERAR PREVIEW</button><button type="button" class="proc-action" data-proc-reroll>REROLL</button><button type="button" class="proc-action" data-proc-cancel>CANCELAR PREVIEW</button><button type="button" class="proc-action" data-proc-fit>ENCUADRAR</button><button type="button" class="proc-action proc-create" data-proc-apply disabled>CREAR ZONA</button></div></section>
    </div>`;document.body.appendChild(panel);

    toolbar.querySelector('[data-proc-open]')?.addEventListener('click',()=>panelOpen?closePanel():openPanel());
    by('[data-proc-close]')?.addEventListener('click',closePanel);
    by('[data-proc-profile]')?.addEventListener('change',e=>setProfileControls(e.target.value));
    by('[data-proc-size]')?.addEventListener('change',()=>generationChanged());
    by('[data-proc-seed]')?.addEventListener('input',()=>generationChanged());
    by('[data-proc-random]')?.addEventListener('click',randomSeed);
    by('[data-proc-reset]')?.addEventListener('click',()=>setProfileControls());
    by('[data-proc-preview]')?.addEventListener('click',()=>{reroll=0;void preview();});
    by('[data-proc-reroll]')?.addEventListener('click',()=>{void rerollPreview();});
    by('[data-proc-cancel]')?.addEventListener('click',()=>{clearPreview();syncUi();});
    panel.querySelectorAll('[data-proc-fit]').forEach(b=>b.addEventListener('click',fitPreview));
    by('[data-proc-apply]')?.addEventListener('click',createZone);
    panel.querySelectorAll('[data-proc-view]').forEach(input=>input.addEventListener('change',updatePreviewOptions));
    panel.querySelectorAll('[data-proc-mix]').forEach(input=>input.addEventListener('input',event=>rebalanceBuildingMix(event.target.dataset.procMix)));
    panel.querySelectorAll('input[type=range]').forEach(input=>input.addEventListener('input',()=>generationChanged()));
    setProfileControls('mixed_urban');
  }

  ensureUi();const timer=window.setInterval(syncUi,300);syncUi();
  const api=Object.freeze({open:openPanel,close:closePanel,preview,createZone,apply:createZone,reroll:rerollPreview,randomSeed,fitPreview,clearPreview,getLastPlan:()=>lastPlan,syncUi,stop(){if(stopped)return;stopped=true;window.clearInterval(timer);clearPreview();stopPreviewRenderer();toolbar?.remove();panel?.remove();document.getElementById(STYLE_ID)?.remove();}});
  window.LuminousVttProceduralGeneratorAuthoringRuntime=api;return api;
}

function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine&&runtime?.procedural){start({runtime,mapData:runtime.engine.mapData});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();