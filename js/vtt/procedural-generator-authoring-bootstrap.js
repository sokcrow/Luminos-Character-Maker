const TOOLBAR_ID='vtt-procedural-generator-toolbar',STYLE_ID='vtt-procedural-generator-style';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData||!runtime.bridge?.isDm)return null;
  if(window.LuminousVttProceduralGeneratorAuthoringRuntime?.stop)return window.LuminousVttProceduralGeneratorAuthoringRuntime;
  const procedural=runtime.procedural;if(!procedural)return null;
  let toolbar=null,lastPlan=null,stopped=false,reroll=0;
  const enabled=()=>mapData.dmEditMode?.active===true;

  function values(){
    const seed=toolbar?.querySelector('[data-proc-seed]')?.value?.trim()||`${mapData.id||mapData.mapId||'map'}:zone`;
    const profileId=toolbar?.querySelector('[data-proc-profile]')?.value||'mixed_urban';
    return{seed:reroll?`${seed}:reroll:${reroll}`:seed,profileId};
  }
  function notify(message,type='info'){runtime.controller?.notify?.(message,type);}
  function preview(){
    try{lastPlan=procedural.preview(values());notify(`Procedural válido · ${lastPlan.validation.summary.buildings} buildings · ${lastPlan.signature}`,'success');syncUi();return lastPlan;}
    catch(error){lastPlan=null;const first=error?.failures?.[0]?.errors?.[0]?.code||error?.message||'PROCEDURAL_GENERATION_FAILED';notify(first,'warning');syncUi();return null;}
  }
  function apply(){
    if(!lastPlan)return null;
    try{procedural.apply(lastPlan,{replaceScene:true});notify(`Zone aplicada · ${lastPlan.signature}`,'success');syncUi();return lastPlan;}
    catch(error){notify(error?.message||'PROCEDURAL_APPLY_FAILED','warning');return null;}
  }
  function rerollPreview(){reroll+=1;return preview();}
  function syncUi(){
    if(!toolbar)return;toolbar.hidden=!enabled();
    const applyButton=toolbar.querySelector('[data-proc-apply]'),readout=toolbar.querySelector('[data-proc-readout]');if(applyButton)applyButton.disabled=!lastPlan?.validation?.valid;
    if(readout){if(!lastPlan)readout.textContent='NO PREVIEW';else{const f=lastPlan.fabric,v=lastPlan.validation;readout.textContent=`${v.valid?'VALID':'INVALID'} · 120×120 · C9 · ST ${f.streets.length} · B ${v.summary.buildings} · P ${f.parcels.length} · A ${f.alleys.length} · ${lastPlan.signature}`;}}
  }
  function ensureUi(){
    if(!document.getElementById(STYLE_ID)){const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`#${TOOLBAR_ID}{border-color:#f0ca59!important;display:flex;gap:6px;align-items:center;flex-wrap:wrap}#${TOOLBAR_ID} input,#${TOOLBAR_ID} select{background:#111;color:#eee;border:1px solid #806d2d;padding:5px;font:10px monospace}#${TOOLBAR_ID} .proc-readout{font:10px monospace;border:1px solid #806d2d;padding:5px;white-space:nowrap}`;document.head.appendChild(style);}
    toolbar=document.createElement('div');toolbar.id=TOOLBAR_ID;toolbar.className='vtt-toolbar';toolbar.hidden=true;
    const options=procedural.profiles().map(p=>`<option value="${p.id}">${p.label||p.id}</option>`).join('');
    toolbar.innerHTML=`<span class="vtt-toolbar-title">PROCEDURAL ZONE</span><select data-proc-profile>${options}</select><input data-proc-seed type="text" value="${mapData.id||mapData.mapId||'map'}:zone" aria-label="Procedural seed"><button type="button" class="brutalist-button" data-proc-preview>PREVIEW</button><button type="button" class="brutalist-button" data-proc-reroll>REROLL</button><button type="button" class="brutalist-button" data-proc-apply disabled>APPLY</button><span class="proc-readout" data-proc-readout>NO PREVIEW</span>`;
    (document.getElementById('vtt-edit-sidebar')||document.getElementById('vtt-ui-container')||document.body).appendChild(toolbar);
    toolbar.querySelector('[data-proc-preview]')?.addEventListener('click',()=>{reroll=0;preview();});toolbar.querySelector('[data-proc-reroll]')?.addEventListener('click',rerollPreview);toolbar.querySelector('[data-proc-apply]')?.addEventListener('click',apply);
  }
  ensureUi();const timer=window.setInterval(syncUi,350);syncUi();
  const api=Object.freeze({preview,apply,reroll:rerollPreview,getLastPlan:()=>lastPlan,syncUi,stop(){if(stopped)return;stopped=true;window.clearInterval(timer);toolbar?.remove();document.getElementById(STYLE_ID)?.remove();}});
  window.LuminousVttProceduralGeneratorAuthoringRuntime=api;return api;
}

function boot(attempt=0){
  const runtime=window.LuminousVttRuntime;
  if(runtime?.engine&&runtime?.procedural){start({runtime,mapData:runtime.engine.mapData});return;}
  if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
