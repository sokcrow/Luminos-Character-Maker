const LAUNCHER_ID='vtt-procedural-zone-launcher',PANEL_ID='vtt-procedural-zone-creator',STYLE_ID='vtt-procedural-zone-creator-style';
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const pct=value=>`${Math.round(Math.max(0,Math.min(1,Number(value)||0))*100)}%`;

function randomSeed(prefix='luminous-zone'){
  let suffix='';
  try{const data=new Uint32Array(2);crypto.getRandomValues(data);suffix=[...data].map(x=>x.toString(36)).join('-');}catch(_){suffix=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  return `${prefix}:${suffix}`;
}

function buildingFootprints(plan){
  const byId=new Map();
  for(const cell of plan?.generated?.surfaceCells||[]){
    if(!cell.buildingId)continue;
    const current=byId.get(cell.buildingId)||{id:cell.buildingId,minCol:cell.col,maxCol:cell.col,minRow:cell.row,maxRow:cell.row};
    current.minCol=Math.min(current.minCol,cell.col);current.maxCol=Math.max(current.maxCol,cell.col);current.minRow=Math.min(current.minRow,cell.row);current.maxRow=Math.max(current.maxRow,cell.row);byId.set(cell.buildingId,current);
  }
  return[...byId.values()];
}

function svgRect(g,cls,title=''){
  if(!g)return'';const x=Number(g.minCol)||0,y=Number(g.minRow)||0,w=Math.max(1,(Number(g.maxCol)||0)-x+1),h=Math.max(1,(Number(g.maxRow)||0)-y+1);
  return`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}">${title?`<title>${esc(title)}</title>`:''}</rect>`;
}

export function renderPreviewSvg(plan){
  if(!plan?.zone)return'<div class="proc-empty-preview">GENERA UN PREVIEW PARA INSPECCIONAR LA ZONA</div>';
  const zone=plan.zone,cols=Math.max(1,Number(zone.cols)||40),rows=Math.max(1,Number(zone.rows)||40),chunk=Math.max(1,Number(zone.chunkSize)||40);
  const grid=[];for(let x=chunk;x<cols;x+=chunk)grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${rows}"/>`);for(let y=chunk;y<rows;y+=chunk)grid.push(`<line x1="0" y1="${y}" x2="${cols}" y2="${y}"/>`);
  const parcels=(plan.fabric?.parcels||[]).map(p=>svgRect(p.geometry,'proc-svg-parcel',p.id)).join('');
  const streets=(plan.fabric?.streets||[]).filter(s=>s.kind!=='alley').map(s=>svgRect(s.geometry,'proc-svg-street',s.semanticId||s.id)).join('');
  const alleys=[...(plan.fabric?.streets||[]).filter(s=>s.kind==='alley'),...(plan.fabric?.alleys||[])].map(a=>svgRect(a.geometry,'proc-svg-alley',a.semanticId||a.id)).join('');
  const buildings=buildingFootprints(plan).map(b=>svgRect(b,'proc-svg-building',b.id)).join('');
  return`<svg class="proc-preview-svg" viewBox="0 0 ${cols} ${rows}" role="img" aria-label="Procedural zone preview"><rect class="proc-svg-ground" x="0" y="0" width="${cols}" height="${rows}"/>${parcels}${streets}${alleys}${buildings}<g class="proc-svg-chunks">${grid.join('')}</g></svg>`;
}

function validatorRows(plan){
  if(!plan?.validation)return'<div class="proc-validation-empty">SIN VALIDACIÓN</div>';
  const checks=plan.validation.checks||{},specs=[['boundary','BOUNDARY'],['semantic','SEMANTICS'],['buildings','BUILDINGS'],['archetypes','ARCHETYPES'],['navigation','NAVIGATION'],['physics','PHYSICS']];
  return specs.map(([key,label])=>{const check=checks[key],valid=check?.valid!==false;return`<div class="proc-check ${valid?'is-valid':'is-invalid'}"><span>${label}</span><strong>${valid?'PASS':'FAIL'}</strong></div>`;}).join('');
}

function summaryMarkup(plan){
  if(!plan)return'<div class="proc-summary-empty">NO HAY UN PLAN GENERADO</div>';
  const v=plan.validation||{},s=v.summary||{},f=plan.fabric||{},z=plan.zone||{};
  return`<div class="proc-summary-grid"><div><small>STATUS</small><strong class="${v.valid?'is-valid':'is-invalid'}">${v.valid?'VALID':'INVALID'}</strong></div><div><small>SIZE</small><strong>${z.cols||0}×${z.rows||0}</strong></div><div><small>BUILDINGS</small><strong>${s.buildings||0}</strong></div><div><small>STREETS</small><strong>${(f.streets||[]).length}</strong></div><div><small>PARCELS</small><strong>${(f.parcels||[]).length}</strong></div><div><small>ALLEYS</small><strong>${(f.alleys||[]).length}</strong></div></div><div class="proc-signature">SIGNATURE · ${esc(plan.signature||'—')}</div>`;
}

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData||!runtime.bridge?.isDm)return null;
  if(window.LuminousVttProceduralGeneratorAuthoringRuntime?.stop)return window.LuminousVttProceduralGeneratorAuthoringRuntime;
  const procedural=runtime.procedural;if(!procedural)return null;
  let launcher=null,panel=null,lastPlan=null,stopped=false,reroll=0,applyArmed=false,selectedChunks=3;
  const enabled=()=>mapData.dmEditMode?.active===true;
  const notify=(message,type='info')=>runtime.controller?.notify?.(message,type);
  const baseSeed=()=>panel?.querySelector('[data-proc-seed]')?.value?.trim()||`${mapData.id||mapData.mapId||'map'}:zone`;
  const currentProfile=()=>procedural.profiles().find(p=>p.id===(panel?.querySelector('[data-proc-profile]')?.value||'mixed_urban'))||procedural.profiles()[0]||{};

  function values(){const seed=baseSeed();return{seed:reroll?`${seed}:reroll:${reroll}`:seed,profileId:currentProfile().id||'mixed_urban',chunkCols:selectedChunks,chunkRows:selectedChunks};}
  function invalidate(){lastPlan=null;applyArmed=false;reroll=0;syncUi();}
  function open(){if(!enabled())return;panel.hidden=false;panel.setAttribute('aria-hidden','false');syncUi();panel.querySelector('[data-proc-profile]')?.focus?.();}
  function close(){panel.hidden=true;panel.setAttribute('aria-hidden','true');applyArmed=false;syncUi();}

  function preview(){
    applyArmed=false;
    try{lastPlan=procedural.preview(values());notify(`Zona procedural válida · ${lastPlan.validation.summary.buildings} buildings · ${lastPlan.signature}`,'success');}
    catch(error){lastPlan=null;const first=error?.failures?.[0]?.errors?.[0]?.code||error?.message||'PROCEDURAL_GENERATION_FAILED';notify(first,'warning');}
    syncUi();return lastPlan;
  }
  function rerollPreview(){reroll+=1;applyArmed=false;return preview();}
  function randomize(){const input=panel?.querySelector('[data-proc-seed]');if(input)input.value=randomSeed(`${mapData.id||mapData.mapId||'map'}:zone`);invalidate();}
  function apply(){
    if(!lastPlan?.validation?.valid)return null;
    if(!applyArmed){applyArmed=true;notify('Confirma APLICAR ZONA para reemplazar la geometría actual. Los tokens se conservarán.','warning');syncUi();return null;}
    try{procedural.apply(lastPlan,{replaceScene:true});notify(`Zona aplicada · ${lastPlan.signature}`,'success');applyArmed=false;close();return lastPlan;}
    catch(error){applyArmed=false;notify(error?.message||'PROCEDURAL_APPLY_FAILED','warning');syncUi();return null;}
  }

  function profileMarkup(){const p=currentProfile();return[['DENSITY',p.density],['ATTACHED',p.attachBias],['ALLEYS',p.alleyBias],['SERVICE',p.serviceAccessBias]].map(([label,value])=>`<div class="proc-meter"><div><span>${label}</span><strong>${pct(value)}</strong></div><div class="proc-meter-track"><i style="width:${pct(value)}"></i></div></div>`).join('')+`<div class="proc-profile-meta">ROAD ${p.primaryRoadWidth||'—'} / ${p.secondaryRoadWidth||'—'} TILES · PARCEL ${p.minParcel||'—'}–${p.maxParcel||'—'} · SETBACK ${p.setback||0}</div>`;}

  function syncUi(){
    if(!launcher||!panel)return;launcher.hidden=!enabled();if(!enabled())panel.hidden=true;
    launcher.querySelector('[data-proc-launch]')?.classList.toggle('is-active',!panel.hidden);
    panel.querySelectorAll('[data-proc-size]').forEach(btn=>{const active=Number(btn.dataset.procSize)===selectedChunks;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',active?'true':'false');});
    const profile=panel.querySelector('[data-proc-profile-summary]');if(profile)profile.innerHTML=profileMarkup();
    const previewNode=panel.querySelector('[data-proc-visual]');if(previewNode)previewNode.innerHTML=renderPreviewSvg(lastPlan);
    const summary=panel.querySelector('[data-proc-summary]');if(summary)summary.innerHTML=summaryMarkup(lastPlan);
    const validation=panel.querySelector('[data-proc-validation]');if(validation)validation.innerHTML=validatorRows(lastPlan);
    const applyButton=panel.querySelector('[data-proc-apply]');if(applyButton){applyButton.disabled=!lastPlan?.validation?.valid;applyButton.classList.toggle('is-armed',applyArmed);applyButton.textContent=applyArmed?'CONFIRMAR APLICACIÓN':'APLICAR ZONA';}
    const warning=panel.querySelector('[data-proc-apply-warning]');if(warning)warning.hidden=!applyArmed;
    const rerollButton=panel.querySelector('[data-proc-reroll]');if(rerollButton)rerollButton.disabled=!lastPlan;
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${LAUNCHER_ID}{display:flex;flex-direction:column;gap:5px}#${LAUNCHER_ID} [data-proc-launch]{min-height:44px}
#${PANEL_ID}{position:fixed;right:252px;top:18px;z-index:36500;width:min(520px,calc(100vw - 290px));max-height:calc(100vh - 36px);overflow:auto;background:#090b0d;border:1px solid #806d2d;box-shadow:-8px 8px 0 rgba(0,0,0,.65);color:#e7ebee;font:11px/1.35 monospace;box-sizing:border-box}#${PANEL_ID}[hidden]{display:none!important}
.proc-creator-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#0b0e11;border-bottom:1px solid #806d2d}.proc-creator-head h2{margin:0;font:700 14px/1 monospace;letter-spacing:.16em;color:#e6c861}.proc-close{width:32px;height:32px;background:#11161a;border:1px solid #59636c;color:#dce3e8;cursor:pointer}
.proc-creator-body{display:grid;grid-template-columns:minmax(180px,.85fr) minmax(230px,1.15fr);gap:12px;padding:12px}.proc-card{border:1px solid #394149;background:#0d1013;padding:10px}.proc-card h3{margin:0 0 9px;color:#d7b151;font:700 10px/1 monospace;letter-spacing:.13em}.proc-field{display:grid;gap:5px;margin:0 0 10px}.proc-field>span{color:#8f9aa2;font-size:9px;letter-spacing:.1em}.proc-field input,.proc-field select{width:100%;box-sizing:border-box;background:#080a0c;border:1px solid #4d565e;color:#edf1f3;padding:8px;font:11px monospace}.proc-seed-row{display:grid;grid-template-columns:1fr auto;gap:5px}.proc-size-row{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.proc-size-row button,.proc-actions button,.proc-seed-row button{background:#11161a;border:1px solid #59636c;color:#dce3e8;padding:8px;cursor:pointer;font:700 10px monospace}.proc-size-row button.is-active{border-color:#d7b151;color:#f4dc8c;background:#25200f}.proc-actions button:disabled{opacity:.35;cursor:not-allowed}.proc-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.proc-actions [data-proc-generate]{grid-column:1/-1;border-color:#d7b151;color:#f2d774}.proc-actions [data-proc-apply]{grid-column:1/-1;border-color:#587b61;color:#aee1b8}.proc-actions [data-proc-apply].is-armed{border-color:#c36e53;color:#ffd0c2;background:#27120d}.proc-apply-warning{margin-top:7px;padding:7px;border:1px solid #9b5744;color:#ffc3b2;background:#22100c}
.proc-meter{margin:7px 0}.proc-meter>div:first-child{display:flex;justify-content:space-between;color:#aeb6bc;font-size:9px}.proc-meter-track{height:4px;background:#242a2f;margin-top:3px;overflow:hidden}.proc-meter-track i{display:block;height:100%;background:#b89d4a}.proc-profile-meta{margin-top:9px;color:#7f8a92;font-size:9px}.proc-preview-wrap{aspect-ratio:1/1;min-height:230px;border:1px solid #333b42;background:#07090a;display:grid;place-items:center;overflow:hidden}.proc-preview-svg{width:100%;height:100%;display:block}.proc-svg-ground{fill:#11161a}.proc-svg-parcel{fill:none;stroke:#252d33;stroke-width:.35}.proc-svg-street{fill:#394149}.proc-svg-alley{fill:#252c31}.proc-svg-building{fill:#765f28;stroke:#d7b151;stroke-width:.35}.proc-svg-chunks{stroke:#64717a;stroke-width:.25;stroke-dasharray:1.5 1.5;opacity:.65}.proc-empty-preview{padding:18px;text-align:center;color:#68747c;font-size:9px}.proc-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.proc-summary-grid>div{border:1px solid #30373d;padding:6px}.proc-summary-grid small{display:block;color:#737e86;font-size:8px}.proc-summary-grid strong{display:block;margin-top:2px}.is-valid{color:#9bd3a7!important}.is-invalid{color:#ef9276!important}.proc-signature{margin-top:6px;color:#7d878e;font-size:9px;overflow-wrap:anywhere}.proc-check{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #252b30}.proc-check:last-child{border-bottom:0}.proc-validation-empty,.proc-summary-empty{color:#68747c;font-size:9px}.proc-footer{padding:0 12px 12px;color:#7f8a92;font-size:9px}.proc-footer strong{color:#b5bdc3}
@media(max-width:900px){#${PANEL_ID}{right:176px;width:calc(100vw - 194px)}.proc-creator-body{grid-template-columns:1fr}.proc-preview-wrap{min-height:180px}}
`;document.head.appendChild(style);
  }

  function ensureUi(){
    installStyles();
    launcher=document.createElement('div');launcher.id=LAUNCHER_ID;launcher.className='vtt-toolbar';launcher.hidden=true;launcher.innerHTML='<span class="vtt-toolbar-title">ZONE CREATOR</span><button type="button" class="brutalist-button" data-proc-launch>CREAR ZONA</button>';
    (document.getElementById('vtt-edit-sidebar')||document.getElementById('vtt-ui-container')||document.body).prepend(launcher);
    panel=document.createElement('section');panel.id=PANEL_ID;panel.hidden=true;panel.setAttribute('aria-hidden','true');panel.setAttribute('aria-label','Crear zona procedural');
    const options=procedural.profiles().map(p=>`<option value="${esc(p.id)}">${esc(p.label||p.id)}</option>`).join('');
    panel.innerHTML=`<header class="proc-creator-head"><h2>CREAR ZONA</h2><button type="button" class="proc-close" data-proc-close aria-label="Cerrar">×</button></header><div class="proc-creator-body"><div><section class="proc-card"><h3>ZONE CONFIGURATION</h3><label class="proc-field"><span>TIPO DE ZONA</span><select data-proc-profile>${options}</select></label><div class="proc-field"><span>TAMAÑO</span><div class="proc-size-row"><button type="button" data-proc-size="1">1×1</button><button type="button" data-proc-size="2">2×2</button><button type="button" data-proc-size="3">3×3</button></div></div><label class="proc-field"><span>SEED</span><div class="proc-seed-row"><input data-proc-seed type="text" value="${esc(mapData.id||mapData.mapId||'map')}:zone"><button type="button" data-proc-randomize>RANDOM</button></div></label></section><section class="proc-card"><h3>URBAN PROFILE</h3><div data-proc-profile-summary></div></section><section class="proc-card"><h3>VALIDATION GATE</h3><div data-proc-validation></div></section></div><div><section class="proc-card"><h3>GENERATION PREVIEW</h3><div class="proc-preview-wrap" data-proc-visual></div><div data-proc-summary></div><div class="proc-actions"><button type="button" data-proc-generate>GENERAR PREVIEW</button><button type="button" data-proc-reroll disabled>REROLL</button><button type="button" data-proc-cancel>CANCELAR</button><button type="button" data-proc-apply disabled>APLICAR ZONA</button></div><div class="proc-apply-warning" data-proc-apply-warning hidden>REEMPLAZARÁ la geometría, superficies y semántica de la escena. Los tokens existentes se conservarán.</div></section></div></div><footer class="proc-footer"><strong>40×40 cells por Chunk.</strong> 1×1 = 40×40 · 2×2 = 80×80 · 3×3 = 120×120. El preview no modifica el mapa.</footer>`;
    document.body.appendChild(panel);
    launcher.querySelector('[data-proc-launch]')?.addEventListener('click',open);panel.querySelector('[data-proc-close]')?.addEventListener('click',close);panel.querySelector('[data-proc-cancel]')?.addEventListener('click',close);
    panel.querySelector('[data-proc-generate]')?.addEventListener('click',()=>{reroll=0;preview();});panel.querySelector('[data-proc-reroll]')?.addEventListener('click',rerollPreview);panel.querySelector('[data-proc-apply]')?.addEventListener('click',apply);panel.querySelector('[data-proc-randomize]')?.addEventListener('click',randomize);
    panel.querySelector('[data-proc-profile]')?.addEventListener('change',invalidate);panel.querySelector('[data-proc-seed]')?.addEventListener('input',invalidate);panel.querySelectorAll('[data-proc-size]').forEach(btn=>btn.addEventListener('click',()=>{selectedChunks=Math.max(1,Math.min(3,Number(btn.dataset.procSize)||3));invalidate();}));
  }

  ensureUi();const timer=window.setInterval(syncUi,350);syncUi();
  const api=Object.freeze({open,close,preview,apply,reroll:rerollPreview,randomize,renderPreview:()=>renderPreviewSvg(lastPlan),getLastPlan:()=>lastPlan,getSize:()=>selectedChunks,syncUi,stop(){if(stopped)return;stopped=true;window.clearInterval(timer);launcher?.remove();panel?.remove();document.getElementById(STYLE_ID)?.remove();}});
  window.LuminousVttProceduralGeneratorAuthoringRuntime=api;return api;
}

function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine&&runtime?.procedural){start({runtime,mapData:runtime.engine.mapData});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
