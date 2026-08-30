const STYLE_ID='vtt-dm-authoring-polish-style';
const HEADER_ID='vtt-dm-authoring-header';
const GROUP_PREFIX='vtt-dm-workbench-group-';
const STORAGE_PREFIX='luminous.vtt.dmWorkbench.';

const GROUPS=Object.freeze([
  Object.freeze({id:'zone',label:'MAP / ZONE',hint:'generate and manage the active zone',open:true}),
  Object.freeze({id:'construction',label:'CONSTRUCTION',hint:'surfaces, walls, openings and structures',open:true}),
  Object.freeze({id:'vertical',label:'VERTICAL',hint:'stairs, ramps, elevators and floor holes',open:false}),
  Object.freeze({id:'environment',label:'ENVIRONMENT',hint:'lighting and scene environment',open:false}),
  Object.freeze({id:'semantics',label:'SEMANTICS',hint:'areas, buildings, archetypes and navigation',open:false}),
  Object.freeze({id:'advanced',label:'ADVANCED',hint:'other map authoring tools',open:false}),
]);

const clean=value=>String(value??'').trim();

export function toolbarGroup(id=''){
  const key=clean(id).toLowerCase();
  if(key.includes('procedural')||key.includes('map-creator'))return'zone';
  if(key.includes('semantic')||key.includes('archetype')||key.includes('building-navigation'))return'semantics';
  if(key.includes('vertical')||key.includes('elevator')||key.includes('ramp')||key.includes('floor-opening'))return'vertical';
  if(key.includes('lighting')||key.includes('environment'))return'environment';
  if(key.includes('topology')||key.includes('surface')||key.includes('structure')||key.includes('horizontal-plane')||key.includes('roof'))return'construction';
  return'advanced';
}

export function describeStreaming(mapData={}){
  const stream=mapData?.procedural?.streaming||null;
  const active=stream?.activeChunk||mapData?.procedural?.activeChunk||null;
  const cols=Math.max(1,Number(stream?.chunkCols||mapData?.procedural?.logicalZone?.chunkCols||1)||1);
  const rows=Math.max(1,Number(stream?.chunkRows||mapData?.procedural?.logicalZone?.chunkRows||1)||1);
  if(!active)return{label:'LOCAL 40×40',detail:`1 / ${cols*rows}`,cols,rows,col:0,row:0};
  const col=Math.max(0,Number(active.col)||0),row=Math.max(0,Number(active.row)||0);
  return{label:`CHUNK ${col+1},${row+1}`,detail:`${col+1 + row*cols} / ${cols*rows}`,cols,rows,col,row};
}

export function activeToolLabel(doc){
  const sidebar=doc?.getElementById?.('vtt-edit-sidebar');
  const active=sidebar?.querySelector?.('button.is-active,button[aria-pressed="true"]');
  if(!active)return'SELECT';
  return clean(active.dataset?.vttShellLabel||active.getAttribute?.('aria-label')||active.textContent)||'SELECT';
}

function runtimeOf(root){return root?.LuminousVttRuntime||null;}
function mapDataOf(root){return runtimeOf(root)?.engine?.mapData||null;}
function isDmEditing(root){const runtime=runtimeOf(root);return Boolean(runtime?.bridge?.isDm&&runtime?.engine?.mapData?.dmEditMode?.active);}

function injectStyles(doc){
  if(!doc||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
.vtt-edit-sidebar{width:264px!important;gap:8px!important;padding:8px!important;background:rgba(6,8,10,.985)!important;border-color:#76652f!important;scrollbar-width:thin;scrollbar-color:#59636c #0a0d0f}
#${HEADER_ID}{position:sticky;top:-8px;z-index:20;margin:-1px -1px 1px;padding:10px;background:linear-gradient(180deg,#15191c 0%,#090c0e 100%);border:1px solid #4d4931;box-shadow:0 7px 14px rgba(0,0,0,.42)}
#${HEADER_ID} .dm-workbench-title{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}#${HEADER_ID} .dm-workbench-title strong{display:block;color:#f0cf65;font:700 12px/1 monospace;letter-spacing:.15em}#${HEADER_ID} .dm-workbench-title small{display:block;margin-top:4px;color:#87929a;font:8px/1 monospace;letter-spacing:.12em}
#${HEADER_ID} .dm-workbench-actions{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:9px}#${HEADER_ID} .dm-zone-create,#${HEADER_ID} .dm-authoring-cancel{min-height:38px;border:1px solid #76652f;background:#15130a;color:#f2da84;font:700 10px monospace;letter-spacing:.08em;cursor:pointer}#${HEADER_ID} .dm-zone-create:hover{border-color:#e6c861;background:#25200e}#${HEADER_ID} .dm-authoring-cancel{width:70px;border-color:#4d565d;background:#101417;color:#c8d0d5;font-size:9px}
#${HEADER_ID} .dm-workbench-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:8px}#${HEADER_ID} .dm-status-cell{min-width:0;padding:6px;border:1px solid #2d3439;background:#080b0d}#${HEADER_ID} .dm-status-cell span{display:block;color:#68747d;font:7px/1 monospace;letter-spacing:.12em}#${HEADER_ID} .dm-status-cell strong{display:block;margin-top:4px;color:#d9e0e4;font:9px/1.1 monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HEADER_ID} .dm-status-cell[data-state="good"] strong{color:#8ce6a3}
.dm-workbench-group{border:1px solid #30383e;background:#0b0f12}.dm-workbench-group>summary{list-style:none;display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;padding:9px;cursor:pointer;color:#d7b151;font:700 9px/1 monospace;letter-spacing:.12em}.dm-workbench-group>summary::-webkit-details-marker{display:none}.dm-workbench-group>summary::before{content:'▸';margin-right:5px;color:#7d8991}.dm-workbench-group[open]>summary::before{content:'▾'}.dm-workbench-summary-main{display:flex;align-items:center;min-width:0}.dm-workbench-count{min-width:20px;padding:2px 4px;text-align:center;border:1px solid #454d52;color:#89959d;font:8px monospace}.dm-workbench-hint{display:block;padding:0 9px 7px;color:#647079;font:8px/1.25 monospace}.dm-workbench-body{display:flex;flex-direction:column;gap:7px;padding:0 7px 7px}.dm-workbench-group[data-empty="true"]{display:none}
.vtt-edit-sidebar .vtt-toolbar,.vtt-edit-sidebar .vtt-light-toolbar{border:1px solid #343c42!important;background:#0c1013!important;padding:8px!important;box-shadow:0 2px 0 rgba(0,0,0,.35)}.vtt-edit-sidebar .vtt-toolbar-title{color:#d7b151!important;font-size:9px!important;letter-spacing:.14em!important;padding:2px 1px 7px!important}.vtt-edit-sidebar .brutalist-button{min-height:36px;border-color:#485159!important;background:#11161a!important;color:#e2e7ea!important;transition:border-color .12s ease,background .12s ease,color .12s ease,transform .12s ease}.vtt-edit-sidebar .brutalist-button:hover:not(:disabled){border-color:#8e7a39!important;background:#171c1f!important}.vtt-edit-sidebar .brutalist-button.is-active,.vtt-edit-sidebar .brutalist-button[aria-pressed="true"]{border-color:#d7b151!important;background:#27210f!important;color:#f2dc8d!important}.vtt-edit-sidebar button:focus-visible,.vtt-edit-sidebar input:focus-visible,.vtt-edit-sidebar select:focus-visible,.dm-workbench-group>summary:focus-visible{outline:2px solid #e6c861!important;outline-offset:2px}.vtt-edit-sidebar button:disabled{opacity:.38!important;cursor:not-allowed!important}.vtt-edit-sidebar input,.vtt-edit-sidebar select{background:#080b0d!important;border:1px solid #465058!important;color:#edf1f3!important;padding:7px!important;box-sizing:border-box}.vtt-edit-sidebar .vtt-toolbar-field{gap:4px!important}.vtt-edit-sidebar .vtt-toolbar-field>label,.vtt-edit-sidebar label{letter-spacing:.04em}.vtt-panel,.vtt-light-panel{right:290px!important}.vtt-vertical-panel{right:620px!important}
.dm-workbench-shortcuts{padding:7px 9px;border:1px solid #2d3439;background:#080b0d;color:#69757d;font:8px/1.45 monospace}.dm-workbench-shortcuts b{color:#aeb9bf;font-weight:600}
@media(max-width:900px){.vtt-edit-sidebar{width:196px!important}.vtt-panel,.vtt-light-panel,.vtt-vertical-panel{right:220px!important}#${HEADER_ID} .dm-workbench-status{grid-template-columns:1fr}.dm-workbench-shortcuts{display:none}}
`;doc.head.appendChild(style);
}

function ensureHeader(root){
  const doc=root?.document,sidebar=doc?.getElementById?.('vtt-edit-sidebar');if(!sidebar)return null;
  let header=doc.getElementById(HEADER_ID);
  if(!header){
    header=doc.createElement('header');header.id=HEADER_ID;
    header.innerHTML=`<div class="dm-workbench-title"><div><strong>DM AUTHORING</strong><small>MAP WORKBENCH</small></div></div><div class="dm-workbench-actions"><button type="button" class="dm-zone-create" data-dm-create-zone>CREAR ZONA</button><button type="button" class="dm-authoring-cancel" data-dm-cancel>CANCEL</button></div><div class="dm-workbench-status"><div class="dm-status-cell"><span>LAYER</span><strong data-dm-status-z>Z0</strong></div><div class="dm-status-cell"><span>STREAM</span><strong data-dm-status-chunk>LOCAL 40×40</strong></div><div class="dm-status-cell"><span>TOOL</span><strong data-dm-status-tool>SELECT</strong></div><div class="dm-status-cell" data-dm-perf-cell><span>RENDER</span><strong data-dm-status-perf>GUARD…</strong></div></div>`;
    header.querySelector('[data-dm-create-zone]')?.addEventListener('click',()=>openZoneCreator(root));
    header.querySelector('[data-dm-cancel]')?.addEventListener('click',()=>cancelAuthoring(root));
  }
  if(sidebar.firstElementChild!==header)sidebar.prepend(header);return header;
}

function groupState(root,id,fallback){
  try{const value=root?.sessionStorage?.getItem?.(`${STORAGE_PREFIX}${id}`);if(value==='1'||value==='0')return value==='1';}catch(_){}
  return fallback;
}
function saveGroupState(root,id,open){try{root?.sessionStorage?.setItem?.(`${STORAGE_PREFIX}${id}`,open?'1':'0');}catch(_){} }

function ensureGroups(root){
  const doc=root?.document,sidebar=doc?.getElementById?.('vtt-edit-sidebar');if(!sidebar)return new Map();const result=new Map();
  for(const config of GROUPS){
    let details=doc.getElementById(`${GROUP_PREFIX}${config.id}`);
    if(!details){
      details=doc.createElement('details');details.id=`${GROUP_PREFIX}${config.id}`;details.className='dm-workbench-group';details.open=groupState(root,config.id,config.open);details.innerHTML=`<summary><span class="dm-workbench-summary-main">${config.label}</span><span class="dm-workbench-count" data-dm-group-count>0</span></summary><small class="dm-workbench-hint">${config.hint}</small><div class="dm-workbench-body" data-dm-group-body></div>`;details.addEventListener('toggle',()=>saveGroupState(root,config.id,details.open));sidebar.appendChild(details);
    }
    result.set(config.id,details);
  }
  let shortcuts=doc.getElementById('vtt-dm-workbench-shortcuts');if(!shortcuts){shortcuts=doc.createElement('div');shortcuts.id='vtt-dm-workbench-shortcuts';shortcuts.className='dm-workbench-shortcuts';shortcuts.innerHTML='<b>SHORTCUTS</b> · Alt+Z Zone · Alt+1 Select · Alt+W Wall · Alt+D Door · Esc Cancel';sidebar.appendChild(shortcuts);}
  return result;
}

function candidateToolbars(sidebar){if(!sidebar)return[];return[...sidebar.querySelectorAll('.vtt-toolbar,.vtt-light-toolbar')].filter(node=>node.id&&!node.closest('.dm-workbench-body'));}
function allManagedToolbars(sidebar){return sidebar?[...sidebar.querySelectorAll('.vtt-toolbar,.vtt-light-toolbar')].filter(node=>node.id):[];}

function organizeToolbars(root){
  const doc=root?.document,sidebar=doc?.getElementById?.('vtt-edit-sidebar');if(!sidebar)return;const groups=ensureGroups(root);
  for(const toolbar of candidateToolbars(sidebar)){const group=groups.get(toolbarGroup(toolbar.id))||groups.get('advanced'),body=group?.querySelector('[data-dm-group-body]');if(body&&toolbar.parentNode!==body)body.appendChild(toolbar);}
  const counts=new Map(GROUPS.map(g=>[g.id,0]));for(const toolbar of allManagedToolbars(sidebar)){const body=toolbar.closest('.dm-workbench-body');if(!body)continue;const details=body.closest('.dm-workbench-group'),id=clean(details?.id).replace(GROUP_PREFIX,'');counts.set(id,(counts.get(id)||0)+1);}
  for(const config of GROUPS){const details=groups.get(config.id),count=counts.get(config.id)||0;if(!details)continue;details.dataset.empty=count?'false':'true';const badge=details.querySelector('[data-dm-group-count]');if(badge&&badge.textContent!==String(count))badge.textContent=String(count);}
}

function openZoneCreator(root){
  if(!isDmEditing(root))return false;
  const api=root?.LuminousVttProceduralGeneratorAuthoringRuntime;if(api?.open){api.open();return true;}
  const button=root?.document?.querySelector?.('#vtt-procedural-generator-toolbar [data-proc-open],[data-proc-open]');if(button){button.click();return true;}
  runtimeOf(root)?.controller?.notify?.('Zone Creator todavía no está disponible.','warning');return false;
}

function selectAllTools(root){
  const runtime=runtimeOf(root);runtime?.controller?.setTool?.('select');runtime?.verticalController?.setTool?.('select',false);runtime?.surfaces?.setTool?.('select');runtime?.structures?.setTool?.('select');runtime?.floorOpenings?.setTool?.('select');runtime?.horizontalPlanes?.setTool?.('select');runtime?.lighting?.controller?.setTool?.('select');root?.LuminousVttElevatorAuthoringRuntime?.setTool?.('select');root?.LuminousVttRampAuthoringRuntime?.setTool?.('select');root?.LuminousVttSemanticAuthoringRuntime?.setTool?.('select');
}
function cancelAuthoring(root){if(!isDmEditing(root))return false;root?.LuminousVttProceduralGeneratorAuthoringRuntime?.clearPreview?.();root?.LuminousVttProceduralGeneratorAuthoringRuntime?.close?.();selectAllTools(root);runtimeOf(root)?.controller?.notify?.('Herramienta cancelada · SELECT activo.','info');return true;}

function clickTool(root,selector){const button=root?.document?.querySelector?.(selector);if(!button||button.disabled)return false;button.click();return true;}
function onKey(root,event){
  if(!isDmEditing(root)||event.defaultPrevented)return;const target=event.target,typing=target?.matches?.('input,textarea,select,[contenteditable="true"]');
  if(event.key==='Escape'){cancelAuthoring(root);event.preventDefault();return;}
  if(!event.altKey||event.ctrlKey||event.metaKey||typing)return;const key=clean(event.key).toLowerCase();let handled=false;
  if(key==='z')handled=openZoneCreator(root);else if(key==='1'){selectAllTools(root);handled=true;}else if(key==='w')handled=clickTool(root,'[data-vtt-tool="wall"]');else if(key==='d')handled=clickTool(root,'[data-vtt-tool="door"]');
  if(handled)event.preventDefault();
}

function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function syncStatus(root){
  const doc=root?.document,header=doc?.getElementById?.(HEADER_ID),runtime=runtimeOf(root),mapData=mapDataOf(root);if(!header||!runtime||!mapData)return;
  const z=header.querySelector('[data-dm-status-z]'),chunk=header.querySelector('[data-dm-status-chunk]'),tool=header.querySelector('[data-dm-status-tool]'),perf=header.querySelector('[data-dm-status-perf]'),perfCell=header.querySelector('[data-dm-perf-cell]');
  setText(z,`Z${Number(runtime.engine?.activeZ)||0}`);const stream=describeStreaming(mapData);setText(chunk,`${stream.label} · ${stream.detail}`);if(chunk)chunk.title=`Logical zone ${stream.cols}×${stream.rows} chunks · live scene 40×40`;
  setText(tool,activeToolLabel(doc));const guard=root?.LuminousVttPerformanceGuard,snapshot=guard?.snapshot?.();if(snapshot){setText(perf,`ON · SAVED ${snapshot.savedFrames||0}`);if(perfCell)perfCell.dataset.state='good';}else{setText(perf,'GUARD STARTING');if(perfCell)delete perfCell.dataset.state;}
}

function decorateToolbars(root){const doc=root?.document,sidebar=doc?.getElementById?.('vtt-edit-sidebar');if(!sidebar)return;for(const button of sidebar.querySelectorAll('button')){if(button.closest(`#${HEADER_ID}`))continue;const label=clean(button.dataset?.vttShellLabel||button.getAttribute('aria-label')||button.textContent);if(label&&!button.title)button.title=label;}}

export function install({root=window}={}){
  const doc=root?.document;if(!doc)return()=>{};injectStyles(doc);ensureHeader(root);ensureGroups(root);organizeToolbars(root);decorateToolbars(root);syncStatus(root);
  const onKeyDown=event=>onKey(root,event);root.addEventListener?.('keydown',onKeyDown,true);
  const sidebar=doc.getElementById('vtt-edit-sidebar');const observer=typeof root.MutationObserver==='function'?new root.MutationObserver(()=>{ensureHeader(root);organizeToolbars(root);decorateToolbars(root);}):null;observer?.observe?.(sidebar||doc.body,{childList:true,subtree:false});
  const timer=root.setInterval?.(()=>{ensureHeader(root);organizeToolbars(root);decorateToolbars(root);syncStatus(root);},750);
  return()=>{if(timer!=null)root.clearInterval?.(timer);observer?.disconnect?.();root.removeEventListener?.('keydown',onKeyDown,true);doc.querySelectorAll?.(`[id^="${GROUP_PREFIX}"]`).forEach(group=>{const body=group.querySelector?.('[data-dm-group-body]'),target=doc.getElementById('vtt-edit-sidebar');if(body&&target)for(const child of [...body.children])target.appendChild(child);group.remove();});doc.getElementById('vtt-dm-workbench-shortcuts')?.remove();doc.getElementById(HEADER_ID)?.remove();doc.getElementById(STYLE_ID)?.remove();};
}
