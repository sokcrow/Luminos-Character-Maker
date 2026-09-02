import { PerceptionScheduler } from './perception-scheduler.js';

function text(value=''){return String(value??'').trim();}

export function normalizePerceptionDirty(detail={}){
  const meta=detail?.meta&&typeof detail.meta==='object'?detail.meta:{};
  const reason=text(detail?.reason||'generic').toLowerCase();
  const sourceEvent=text(detail?.sourceEvent);
  const rawDrag=Boolean(meta.rawDrag);
  const traversalPreview=Boolean(meta.traversing)&&detail?.active!==false;
  const tokenPreview=sourceEvent==='vtt:token-preview-moved';
  const cameraOnly=reason==='camera';
  const visualOnly=rawDrag||traversalPreview||tokenPreview||cameraOnly;
  return Object.freeze({
    ...detail,
    reason,
    meta,
    vision:detail?.vision===true&&!visualOnly,
    render:detail?.render!==false,
    visualOnly,
  });
}

export function installPerceptionSchedulerRuntime({runtime=globalThis.LuminousVttRuntime}={}){
  const engine=runtime?.engine,canvas=engine?.canvas;
  if(!engine||!canvas)return null;
  if(engine.perceptionScheduler?.__rama4)return globalThis.LuminousVttPerceptionSchedulerRuntime||engine.perceptionScheduler;

  const scheduler=new PerceptionScheduler();
  Object.defineProperty(scheduler,'__rama4',{value:true,enumerable:false});
  const exactCalculateVision=engine.calculateVision.bind(engine);
  const originalLoop=engine.loop;
  const raf=typeof globalThis.requestAnimationFrame==='function'
    ?globalThis.requestAnimationFrame.bind(globalThis)
    :(callback)=>globalThis.setTimeout(()=>callback(globalThis.performance?.now?.()||Date.now()),16);
  let stopped=false;

  function calculateVisionScheduled(...args){
    return scheduler.consumeVision(()=>exactCalculateVision(...args));
  }

  function scheduledLoop(){
    if(stopped||!engine.isRunning)return;
    const renderData=scheduler.consumeVision(()=>exactCalculateVision());
    if(!engine.isExporting&&scheduler.shouldRender()){
      engine.renderer?.render?.(engine.camera,engine.activeZ,renderData,engine.isExporting);
      scheduler.didRender();
    }
    raf(engine.loop);
  }

  function onSceneDirty(event){
    const detail=normalizePerceptionDirty(event?.detail||{});
    if(detail.meta?.traversing)scheduler.setAnimationActive(detail.active!==false);
    else if(detail.reason==='token'&&detail.active===false)scheduler.setAnimationActive(false);
    scheduler.markSceneDirty(detail);
  }

  engine.calculateVision=calculateVisionScheduled;
  engine.loop=scheduledLoop;
  engine.perceptionScheduler=scheduler;
  canvas.addEventListener?.('vtt:scene-dirty',onSceneDirty);

  const api=Object.freeze({
    __rama4:true,
    scheduler,
    normalizePerceptionDirty,
    invalidateVision:()=>scheduler.invalidateVision(),
    requestRender:()=>scheduler.requestRender(),
    snapshot:()=>scheduler.snapshot(),
    stop(){
      if(stopped)return false;
      stopped=true;
      canvas.removeEventListener?.('vtt:scene-dirty',onSceneDirty);
      if(engine.calculateVision===calculateVisionScheduled)engine.calculateVision=exactCalculateVision;
      if(engine.loop===scheduledLoop)engine.loop=originalLoop;
      if(engine.perceptionScheduler===scheduler)delete engine.perceptionScheduler;
      if(globalThis.LuminousVttPerceptionSchedulerRuntime===api)delete globalThis.LuminousVttPerceptionSchedulerRuntime;
      return true;
    },
  });
  globalThis.LuminousVttPerceptionSchedulerRuntime=api;
  return api;
}
