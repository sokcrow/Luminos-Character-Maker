const TOOLBAR_ID='vtt-procedural-generator-toolbar';
const EDIT_SIDEBAR_ID='vtt-edit-sidebar';
const MAP_NEW_SELECTOR='[data-map-new]';

function clean(value){return String(value??'').trim();}

function localNotice(root,message,mode='info'){
  const runtime=root?.LuminousVttRuntime;
  runtime?.controller?.notify?.(message,mode);
  const node=root?.document?.getElementById?.('vtt-map-authoring-notice');
  if(node){node.textContent=message;node.dataset.mode=mode;node.hidden=false;}
}

export function moveCreatorToolbar(root=window){
  const doc=root?.document;if(!doc)return false;
  const toolbar=doc.getElementById(TOOLBAR_ID),sidebar=doc.getElementById(EDIT_SIDEBAR_ID);
  if(!toolbar||!sidebar)return false;
  if(toolbar.parentNode!==sidebar)sidebar.appendChild(toolbar);
  return true;
}

export async function ensureCreatorRuntime(root=window){
  let runtime=root?.LuminousVttRuntime;
  const mapData=runtime?.engine?.mapData;
  if(!runtime?.engine||!mapData||!runtime?.bridge?.isDm)return false;
  try{
    if(!runtime.procedural&&runtime.buildingNavigation){
      const module=await import('./procedural-generator-bootstrap.js');
      module.start({runtime,mapData});
      runtime=root.LuminousVttRuntime||runtime;
    }
    if(runtime.procedural&&!root.LuminousVttProceduralGeneratorAuthoringRuntime?.stop){
      const module=await import('./procedural-generator-authoring-bootstrap.js');
      module.start({runtime,mapData});
    }
    return moveCreatorToolbar(root);
  }catch(error){
    console.warn('VTT Zone Creator live mount failed:',error);
    return false;
  }
}

export async function createMapSafely(root=window,button=null){
  if(button)button.disabled=true;
  try{
    const runtime=root?.LuminousVttRuntime;
    const authoring=root?.LuminousVttMapAuthoring;
    const bridge=runtime?.mapAuthoring?.bridge;
    const doc=root?.document;
    if(!runtime?.engine||!authoring||!bridge||!doc)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
    const name=clean(root.prompt?.('Map name','New Map'));
    if(!name)return null;
    const selectedId=clean(doc.querySelector?.('[data-map-select]')?.value);
    const selected=bridge.get?.(selectedId)||authoring.definitionFromMapData(runtime.engine.mapData);
    if(!selected)throw new Error('MAP_TEMPLATE_REQUIRED');
    const id=authoring.firebaseKey(`${name}_${Date.now().toString(36)}`);
    const created=authoring.createDefinition({
      id,name,
      grid:selected.grid,
      environmentTags:selected.environmentTags,
      defaultZStepFt:selected.defaultZStepFt,
    });
    await bridge.saveDefinition(created);
    await Promise.resolve();
    const select=doc.querySelector?.('[data-map-select]');
    if(select){
      select.value=created.id;
      const EventCtor=root.Event;
      if(EventCtor)select.dispatchEvent(new EventCtor('change',{bubbles:true}));
    }
    localNotice(root,'Map created.','success');
    return created;
  }catch(error){
    const message=clean(error?.message||error)||'MAP_CREATE_FAILED';
    console.error('VTT NEW MAP FAILED:',error);
    localNotice(root,message,'error');
    return null;
  }finally{
    if(button?.isConnected)button.disabled=false;
  }
}

export function install({root=window}={}){
  const doc=root?.document;if(!doc||root.__luminousLiveMapCreatorHotfix)return root.__luminousLiveMapCreatorHotfix||null;
  let stopped=false,busy=false;
  const sync=()=>{if(!stopped)ensureCreatorRuntime(root);};
  const clickCapture=(event)=>{
    const button=event.target?.closest?.(MAP_NEW_SELECTOR);if(!button||busy)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
    busy=true;
    createMapSafely(root,button).finally(()=>{busy=false;});
  };
  doc.addEventListener('click',clickCapture,true);
  const interval=root.setInterval?.(sync,300)||null;
  doc.getElementById('vtt-dm-edit-toggle')?.addEventListener('click',()=>root.setTimeout?.(sync,0));
  sync();
  const api=Object.freeze({sync,stop(){if(stopped)return;stopped=true;if(interval!=null)root.clearInterval?.(interval);doc.removeEventListener('click',clickCapture,true);}});
  root.__luminousLiveMapCreatorHotfix=api;
  root.addEventListener?.('beforeunload',api.stop,{once:true});
  return api;
}

function autoStart(root=window){
  const run=()=>install({root});
  if(root?.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run,{once:true});else run();
}

autoStart();
