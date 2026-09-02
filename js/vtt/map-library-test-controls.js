import { TEST_LAB_ID, ensureTestLab } from './map-test-lab.js';

const BODY_ID='vtt-map-authoring-body';
const TEST_BUTTON='[data-map-test-lab]';
const DELETE_BUTTON='[data-map-delete]';

function clean(value){return String(value??'').trim();}

function context(root=window){
  return{
    runtime:root?.LuminousVttRuntime||null,
    authoring:root?.LuminousVttMapAuthoring||null,
    bridge:root?.LuminousVttRuntime?.mapAuthoring?.bridge||null,
    documentRef:root?.document||null,
  };
}

function notify(root,message,mode='info'){
  root?.LuminousVttRuntime?.controller?.notify?.(message,mode);
  const node=root?.document?.getElementById?.('vtt-map-authoring-notice');
  if(!node)return;
  node.textContent=message;
  node.dataset.mode=mode;
  node.hidden=false;
}

function selectMap(root,mapId){
  const select=root?.document?.querySelector?.('[data-map-select]');
  if(!select)return false;
  select.value=mapId;
  const EventCtor=root?.Event;
  if(typeof EventCtor==='function')select.dispatchEvent(new EventCtor('change',{bubbles:true}));
  return true;
}

async function openTestLab(root=window){
  const {bridge,authoring}=context(root);
  if(!bridge||!authoring)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
  const lab=await ensureTestLab({bridge,authoring});
  await Promise.resolve();
  selectMap(root,lab.id);
  notify(root,lab.id===TEST_LAB_ID?'Test Lab ready.':'Test Lab allocated.','success');
  return lab;
}

async function deleteSelectedMap(root=window){
  const {bridge,documentRef}=context(root);
  if(!bridge||!documentRef)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
  const mapId=clean(documentRef.querySelector?.('[data-map-select]')?.value);
  if(!mapId)throw new Error('MAP_NOT_FOUND');
  const definition=bridge.get?.(mapId);
  if(!definition)throw new Error('MAP_NOT_FOUND');
  if(bridge.activeMapId?.()===mapId)throw new Error('ACTIVE_MAP_CANNOT_BE_DELETED');

  const confirmed=root.confirm?.(`Delete map "${definition.name}"? This cannot be undone.`);
  if(confirmed===false)return false;

  await bridge.deleteDefinition(mapId);
  const fallback=bridge.activeMapId?.()||bridge.list?.()?.[0]?.id||'';
  await Promise.resolve();
  if(fallback)selectMap(root,fallback);
  notify(root,'Map deleted.','success');
  return true;
}

function refreshDeleteState(root=window){
  const {bridge,documentRef}=context(root);
  const button=documentRef?.querySelector?.(DELETE_BUTTON);
  if(!button||!bridge)return false;
  const selectedId=clean(documentRef.querySelector?.('[data-map-select]')?.value);
  button.disabled=!selectedId||!bridge.get?.(selectedId)||bridge.activeMapId?.()===selectedId;
  button.title=button.disabled&&selectedId===bridge.activeMapId?.()
    ? 'The active map cannot be deleted.'
    : 'Delete the selected inactive map.';
  return true;
}

function mountControls(root=window){
  const {bridge,documentRef}=context(root);
  if(!bridge||!documentRef)return false;
  const body=documentRef.getElementById?.(BODY_ID);
  if(!body)return false;
  const newButton=body.querySelector?.('[data-map-new]');
  const actions=newButton?.closest?.('.vtt-map-actions');
  if(!actions)return false;

  if(!actions.querySelector(TEST_BUTTON)){
    const button=documentRef.createElement('button');
    button.type='button';
    button.className='brutalist-button';
    button.dataset.mapTestLab='';
    button.textContent='TEST LAB';
    button.addEventListener('click',()=>{
      button.disabled=true;
      openTestLab(root).catch((error)=>notify(root,clean(error?.message||error)||'TEST_LAB_FAILED','error')).finally(()=>{if(button.isConnected)button.disabled=false;});
    });
    actions.appendChild(button);
  }

  if(!actions.querySelector(DELETE_BUTTON)){
    const button=documentRef.createElement('button');
    button.type='button';
    button.className='vtt-danger-button';
    button.dataset.mapDelete='';
    button.textContent='DELETE MAP';
    button.addEventListener('click',()=>{
      button.disabled=true;
      deleteSelectedMap(root).catch((error)=>{
        const code=clean(error?.message||error)||'MAP_DELETE_FAILED';
        notify(root,code==='ACTIVE_MAP_CANNOT_BE_DELETED'?'The active map cannot be deleted.':code,'error');
      }).finally(()=>refreshDeleteState(root));
    });
    actions.appendChild(button);
  }

  const select=body.querySelector?.('[data-map-select]');
  if(select&&!select.dataset.testControlsBound){
    select.dataset.testControlsBound='1';
    select.addEventListener('change',()=>queueMicrotask(()=>refreshDeleteState(root)));
  }
  refreshDeleteState(root);
  return true;
}

export function install({root=window}={}){
  const documentRef=root?.document;
  if(!documentRef||root.__luminousMapLibraryTestControls)return root.__luminousMapLibraryTestControls||null;
  let stopped=false;
  let scheduled=false;
  const sync=()=>{
    if(stopped||scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;
      if(!stopped)mountControls(root);
    });
  };
  const Observer=root.MutationObserver;
  const observer=typeof Observer==='function'?new Observer(sync):null;
  observer?.observe(documentRef.documentElement||documentRef.body,{childList:true,subtree:true});
  documentRef.addEventListener('click',sync,true);
  sync();

  const api=Object.freeze({
    sync,
    openTestLab:()=>openTestLab(root),
    deleteSelectedMap:()=>deleteSelectedMap(root),
    stop(){
      if(stopped)return;
      stopped=true;
      observer?.disconnect?.();
      documentRef.removeEventListener('click',sync,true);
    },
  });
  root.__luminousMapLibraryTestControls=api;
  root.addEventListener?.('beforeunload',api.stop,{once:true});
  return api;
}

function autoStart(root=window){
  const run=()=>install({root});
  if(root?.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
}

autoStart();
