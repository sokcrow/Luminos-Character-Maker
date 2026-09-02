import {TEST_LAB_ID} from './map-test-lab.js';
import {createChunkSpatialIndex,queryChunkRect,queryPlayerPov,queryDmSimplified,workingSetCounts,drawUnitCounts} from './visibility-working-set.js';

const clean=value=>String(value??'').trim();
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const percent=(part,total)=>total>0?(part/total)*100:0;

function isLab(engine){return clean(engine?.mapData?.id||engine?.mapData?.mapId)===TEST_LAB_ID;}

function surfaceCells(mapData={},zLayer=0){
  const layer=mapData.surfaceLayers?.[String(Number(zLayer)||0)];
  if(layer&&typeof layer==='object'&&Object.keys(layer).length){
    return Object.keys(layer).map(key=>{
      const match=String(key).match(/^(-?\d+)_(-?\d+)$/);
      return match?{id:`surface:${key}`,col:Number(match[1]),row:Number(match[2])}:{id:`surface:${key}`,col:0,row:0};
    });
  }
  const cols=Math.max(1,Math.trunc(finite(mapData.grid?.cols,1)));
  const rows=Math.max(1,Math.trunc(finite(mapData.grid?.rows,1)));
  const result=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)result.push({id:`grid:${col}_${row}`,col,row});
  return result;
}

function sceneFromEngine(engine){
  const mapData=engine?.mapData||{};
  const topology=Array.isArray(mapData.topology)&&mapData.topology.length?mapData.topology:(Array.isArray(mapData.walls)?mapData.walls:[]);
  const worldObjects=[...(Array.isArray(mapData.worldObjects)?mapData.worldObjects:[]),...(Array.isArray(mapData.structures)?mapData.structures:[])];
  const lights=Array.isArray(mapData.lights)?mapData.lights:(Array.isArray(mapData.lighting?.lights)?mapData.lighting.lights:[]);
  return{topology,worldObjects,tokens:Array.isArray(mapData.tokens)?mapData.tokens:[],lights,surfaces:surfaceCells(mapData,engine?.activeZ)};
}

function cameraBounds(engine){
  const canvas=engine?.canvas,camera=engine?.camera;
  if(!canvas||typeof camera?.screenToWorld!=='function')return null;
  const rect=canvas.getBoundingClientRect?.()||{};
  const width=Math.max(1,finite(rect.width,canvas.clientWidth||canvas.width||1));
  const height=Math.max(1,finite(rect.height,canvas.clientHeight||canvas.height||1));
  const a=camera.screenToWorld(0,0),b=camera.screenToWorld(width,height);
  return{minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y)};
}

function viewerState(engine){
  const token=engine?.viewerToken?.()||engine?.mapData?.tokens?.[0]||null;
  if(!token)return null;
  const profile=engine?.visionProfile?.(token)||{};
  const size=Math.max(1,finite(engine?.mapData?.grid?.size,70));
  const rawFacing=token.facingDeg??token.facing??token.rotationDeg??token.rotation??0;
  return{
    token,
    x:finite(token.x),
    y:finite(token.y),
    facingDeg:finite(rawFacing),
    fovDeg:finite(profile.fovDeg??profile.angleDeg,120),
    rangePx:Math.max(size,finite(profile.radiusPx,engine?.legacyVisionRadius||size*10)),
    preloadPx:size*2,
  };
}

function rendererInfo(root,engine){
  const renderer=engine?.renderer;
  const gl=renderer?.gl||renderer?.context?.gl||null;
  let webgl2=String(renderer?.backend||'').toLowerCase()==='webgl2';
  try{if(root?.WebGL2RenderingContext&&gl instanceof root.WebGL2RenderingContext)webgl2=true;}catch(_){}
  return{backend:clean(renderer?.backend||renderer?.constructor?.name||'unknown'),webgl2};
}

function metricDelta(current={},baseline={}){
  const keys=['visionRecomputes','visionCacheHits','renderRequests','renderedFrames','cameraDirtyEvents','cameraRenderCoalesces','visionInvalidations'];
  const result={};
  for(const key of keys)result[key]=Math.max(0,finite(current[key])-finite(baseline[key]));
  return result;
}

export function installTestLabTelemetry(root=globalThis,engine=root?.LuminousVttRuntime?.engine){
  if(!engine||!isLab(engine))return null;
  if(engine.__testLabTelemetry)return engine.__testLabTelemetry;
  const scheduler=()=>root?.LuminousVttPerceptionSchedulerRuntime?.snapshot?.()||engine.perceptionScheduler?.snapshot?.()||{};
  let baseline=scheduler();
  let previewFrames=0;
  let stopped=false;
  const onPreview=()=>{previewFrames+=1;};
  engine.canvas?.addEventListener?.('vtt:token-preview-moved',onPreview);

  const api={
    __rama4TestLabTelemetry:true,
    reset(){baseline=scheduler();previewFrames=0;return this.snapshot();},
    snapshot(){
      const size=Math.max(1,finite(engine.mapData?.grid?.size,70));
      const scene=sceneFromEngine(engine);
      const index=createChunkSpatialIndex(scene,{gridSize:size,bucketCells:4});
      const world=workingSetCounts(scene);
      const bounds=cameraBounds(engine);
      const viewport=bounds?workingSetCounts(queryChunkRect(index,bounds)):workingSetCounts(scene);
      const viewer=viewerState(engine);
      const playerSet=viewer?queryPlayerPov(index,viewer,{fovDeg:viewer.fovDeg,rangePx:viewer.rangePx,preloadPx:viewer.preloadPx}):scene;
      const player=workingSetCounts(playerSet);
      const dm=bounds?queryDmSimplified(index,bounds,{groupCells:4}):{visible:scene,drawUnits:world};
      const dmVisible=workingSetCounts(dm.visible);
      const dmDraw=drawUnitCounts(dm.drawUnits);
      const perception=scheduler();
      const delta=metricDelta(perception,baseline);
      return Object.freeze({
        renderer:rendererInfo(root,engine),
        frame:Object.freeze({
          fps:finite(perception.activeFps),
          avgMs:finite(perception.activeFrameTimeAvgMs),
          maxMs:finite(perception.activeFrameTimeMaxMs),
          renderedFrames:delta.renderedFrames,
        }),
        movement:Object.freeze({previewFrames}),
        perception:Object.freeze({
          visionRecomputes:delta.visionRecomputes,
          visionInvalidations:delta.visionInvalidations,
          visionCacheHits:delta.visionCacheHits,
          renderRequests:delta.renderRequests,
          cameraDirtyEvents:delta.cameraDirtyEvents,
          cameraRenderCoalesces:delta.cameraRenderCoalesces,
        }),
        workingSet:Object.freeze({
          world,
          viewport:{...viewport,percentOfWorld:percent(viewport.total,world.total)},
          player120:{...player,percentOfWorld:percent(player.total,world.total)},
          dmSimplified:{visible:dmVisible,drawUnits:dmDraw,drawPercentOfVisible:percent(dmDraw.total,dmVisible.total)},
        }),
        viewer:viewer?Object.freeze({fovDeg:viewer.fovDeg,rangePx:viewer.rangePx,preloadPx:viewer.preloadPx}):null,
      });
    },
    stop(){if(stopped)return false;stopped=true;engine.canvas?.removeEventListener?.('vtt:token-preview-moved',onPreview);if(engine.__testLabTelemetry===api)delete engine.__testLabTelemetry;if(root.LuminousVttTestLabTelemetry===api)delete root.LuminousVttTestLabTelemetry;return true;},
  };
  engine.__testLabTelemetry=api;
  root.LuminousVttTestLabTelemetry=api;
  return api;
}

function formatSnapshot(snapshot){
  const frame=snapshot.frame,perception=snapshot.perception,work=snapshot.workingSet;
  const fmt=value=>Number(finite(value).toFixed(2));
  return [
    `Renderer          ${snapshot.renderer.backend}${snapshot.renderer.webgl2?' / WebGL2':''}`,
    `FPS               ${fmt(frame.fps)}`,
    `Frame Avg         ${fmt(frame.avgMs)} ms`,
    `Frame Max         ${fmt(frame.maxMs)} ms`,
    '',
    `Rendered Frames   ${frame.renderedFrames}`,
    `Preview Frames    ${snapshot.movement.previewFrames}`,
    `Render Requests   ${perception.renderRequests}`,
    `Camera Dirty      ${perception.cameraDirtyEvents}`,
    `Camera Coalesces  ${perception.cameraRenderCoalesces}`,
    '',
    `Vision Recompute  ${perception.visionRecomputes}`,
    `Vision Invalid.   ${perception.visionInvalidations}`,
    `Vision Cache Hits ${perception.visionCacheHits}`,
    '',
    `World Candidates  ${work.world.total}`,
    `Viewport          ${work.viewport.total} (${fmt(work.viewport.percentOfWorld)}%)`,
    `POV 120°          ${work.player120.total} (${fmt(work.player120.percentOfWorld)}%)`,
    `DM Draw Units     ${work.dmSimplified.drawUnits.total} (${fmt(work.dmSimplified.drawPercentOfVisible)}%)`,
  ].join('\n');
}

export function mountTestLabTelemetry(root=globalThis,engine=root?.LuminousVttRuntime?.engine){
  const telemetry=installTestLabTelemetry(root,engine);
  if(!telemetry||!root?.document)return telemetry;
  let attempts=0,interval=0,stopped=false;
  const mount=()=>{
    if(stopped)return;
    const panel=root.document.getElementById?.('vtt-test-lab-panel');
    if(!panel){if(++attempts<240)root.setTimeout?.(mount,25);return;}
    if(panel.querySelector?.('[data-lab-telemetry]'))return;
    const section=root.document.createElement('section');
    section.setAttribute('data-lab-telemetry','');
    section.style.cssText='margin-top:10px;padding-top:10px;border-top:1px solid #555b61';
    section.innerHTML='<strong style="display:block;margin-bottom:6px">WEBGL2 // TELEMETRY</strong><pre data-lab-telemetry-readout style="margin:0;white-space:pre-wrap;line-height:1.35"></pre><button type="button" data-lab-telemetry-reset style="margin-top:8px">RESET COUNTERS</button>';
    panel.appendChild(section);
    const readout=section.querySelector('[data-lab-telemetry-readout]');
    const refresh=()=>{try{readout.textContent=formatSnapshot(telemetry.snapshot());}catch(error){readout.textContent=`TELEMETRY ERROR: ${clean(error?.message||error)}`;}};
    section.querySelector('[data-lab-telemetry-reset]')?.addEventListener?.('click',()=>{telemetry.reset();refresh();});
    refresh();
    interval=root.setInterval?.(refresh,250)||0;
  };
  mount();
  const originalStop=telemetry.stop.bind(telemetry);
  telemetry.stop=()=>{stopped=true;if(interval)root.clearInterval?.(interval);root.document?.querySelector?.('[data-lab-telemetry]')?.remove?.();return originalStop();};
  return telemetry;
}

export function startTestLabTelemetry(root=globalThis){
  let installed=null,stopped=false,timer=0;
  const tick=()=>{
    if(stopped||installed)return;
    const engine=root?.LuminousVttRuntime?.engine;
    if(engine&&isLab(engine))installed=mountTestLabTelemetry(root,engine);
    if(!installed)timer=root?.setTimeout?.(tick,500)||0;
  };
  tick();
  return Object.freeze({stop(){stopped=true;if(timer)root?.clearTimeout?.(timer);installed?.stop?.();}});
}

if(typeof window!=='undefined')window.LuminousVttTestLabTelemetryBootstrap=startTestLabTelemetry(window);
