import './procedural-chunk-streaming-core.js';

const APPLY_SELECTOR='[data-proc-apply]';
const SIZE_SELECTOR='[data-proc-size]';
const PANEL_ID='vtt-procedural-zone-panel';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData,procedural=runtime?.procedural}={}){
  if(!runtime?.engine||!mapData||!procedural)return null;
  if(window.LuminousVttProceduralChunkStreamingRuntime?.api)return window.LuminousVttProceduralChunkStreamingRuntime.api;
  const core=window.LuminousVttProceduralChunkStreaming,generator=window.LuminousVttProceduralGenerator;
  if(!core||!generator)throw new Error('PROCEDURAL_CHUNK_STREAMING_REQUIRED');

  const engine=runtime.engine,doc=window.document;
  let stopped=false,transitioning=false,activePlan=null;

  function notify(message,type='info'){runtime.controller?.notify?.(message,type);}
  function selectedLogicalSize(){const n=Number(doc.querySelector(SIZE_SELECTOR)?.value);return Math.max(1,Math.min(3,Number.isFinite(n)?Math.trunc(n):1));}
  function sceneHasContent(){return['topology','walls','worldObjects','horizontalPlanes','structures','verticalPortals'].some(k=>(mapData[k]||[]).length>0)||(mapData.semantics?.buildings||[]).length>0;}
  function descriptor(){return mapData.procedural?.streaming?core.createDescriptor(mapData.procedural.streaming):null;}
  function planProfile(plan={}){return clone(plan.fabric?.profile||null);}
  function buildDescriptor(plan={},size=1){return core.createDescriptor({zoneId:plan.zone?.id||`zone_${mapData.id||mapData.mapId||'active'}`,seed:plan.seed,profileId:plan.profileId,profile:planProfile(plan),chunkCols:size,chunkRows:size,activeChunk:{col:0,row:0}});}
  function writeStreamingMetadata(desc,plan){
    mapData.procedural={...(mapData.procedural||{}),streaming:core.createDescriptor(desc),logicalZone:{chunkSize:core.CHUNK_SIZE,chunkCols:desc.chunkCols,chunkRows:desc.chunkRows,cols:desc.logicalCols,rows:desc.logicalRows},activeChunk:clone(desc.activeChunk),activeChunkSignature:plan?.signature||null};
    return mapData.procedural.streaming;
  }
  function generationOverrides(desc){return{gridSize:mapData.grid?.size||70,maxAttempts:8,minBuildings:1};}
  async function generateChunk(desc,coord){return procedural.previewAsync(core.chunkGenerationOptions(desc,coord,generationOverrides(desc)));}
  function redraw(reason='procedural-chunk-streamed'){
    runtime.semanticMap?.touch?.(reason);
    engine.renderer?.invalidate?.();
    engine.invalidate?.();
  }
  function centerOnToken(token){if(!token)return;engine.camera?.centerOnWorldPoint?.({x:token.x,y:token.y});if(!engine.camera?.centerOnWorldPoint)engine.centerCamera?.();}
  async function persistChunk(plan){if(!runtime.bridge?.isDm)return;await procedural.persist(plan);}

  function entryCandidates(token,entry,exit){
    const size=mapData.grid?.size||70,out=[],seen=new Set();
    const push=(col,row)=>{col=Math.max(0,Math.min(39,col));row=Math.max(0,Math.min(39,row));const key=`${col},${row}`;if(seen.has(key))return;seen.add(key);out.push({col,row,x:(col+.5)*size,y:(row+.5)*size});};
    push(entry.col,entry.row);
    for(let depth=1;depth<=6;depth++){
      const baseCol=exit.dx>0?depth:exit.dx<0?39-depth:entry.col;
      const baseRow=exit.dy>0?depth:exit.dy<0?39-depth:entry.row;
      push(baseCol,baseRow);
      for(let offset=1;offset<=6;offset++){
        if(exit.dx){push(baseCol,entry.row-offset);push(baseCol,entry.row+offset);}
        if(exit.dy){push(entry.col-offset,baseRow);push(entry.col+offset,baseRow);}
      }
    }
    const rules=window.LuminousVttTokenInteraction;
    return out.find(point=>rules?.canOccupy?.(token,point,mapData)?.valid)||out[0];
  }

  async function activateChunk(desc,coord,{tokenId=null,requestedPoint=null,exit=null,persist=true}={}){
    if(transitioning)throw new Error('PROCEDURAL_CHUNK_TRANSITION_BUSY');
    transitioning=true;
    const previous=core.createDescriptor(desc);
    try{
      const plan=await generateChunk(previous,coord);
      procedural.apply(plan,{replaceScene:true,persist:false});
      const next=core.withActiveChunk(previous,coord);writeStreamingMetadata(next,plan);activePlan=plan;
      let token=null;
      if(tokenId!=null)token=(mapData.tokens||[]).find(x=>String(x.id)===String(tokenId))||null;
      if(token&&requestedPoint&&exit){
        const entry=core.entryCell(requestedPoint,mapData.grid,exit),safe=entryCandidates(token,entry,exit);
        token.x=safe.x;token.y=safe.y;const z=Number(token.zLayer??token.gridPosition?.z??token.z?.[0]??0);token.zLayer=z;token.z=[z];token.gridPosition={col:safe.col,row:safe.row,z};
        centerOnToken(token);
      }else engine.centerCamera?.();
      redraw();
      if(persist)await persistChunk(plan);
      engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:procedural-chunk-loaded',{detail:{chunk:clone(next.activeChunk),logical:{cols:next.chunkCols,rows:next.chunkRows},signature:plan.signature}}));
      return{descriptor:next,plan,token};
    }finally{transitioning=false;}
  }

  async function createStreamedZone(previewPlan,size=selectedLogicalSize()){
    if(!previewPlan?.validation?.valid)throw new Error('PROCEDURAL_PREVIEW_REQUIRED');
    const desc=buildDescriptor(previewPlan,size);
    const result=await activateChunk(desc,{col:0,row:0},{persist:true});
    mapData.proceduralEditor&&(mapData.proceduralEditor.previewPlan=null);
    if(mapData.proceduralEditor)mapData.proceduralEditor.previewGenerationError=null;
    doc.getElementById(PANEL_ID)?.querySelector('[data-proc-close]')?.click();
    notify(`Zona ${size}×${size} creada en streaming · activo 40×40 · chunk 1,1`,'success');
    return result;
  }

  function captureCreate(event){
    const button=event.target?.closest?.(APPLY_SELECTOR);if(!button||transitioning)return;
    const plan=mapData.proceduralEditor?.previewPlan,size=selectedLogicalSize();
    if(size<=1||!plan?.validation?.valid)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(sceneHasContent()&&!window.confirm('CREAR ZONA reemplazará la geometría y semántica actual. Los tokens de jugador se conservarán. ¿Continuar?'))return;
    button.disabled=true;
    Promise.resolve(createStreamedZone(plan,size)).catch(error=>{console.error('VTT PROCEDURAL STREAMED ZONE CREATE FAILED:',error);notify(error?.message||'PROCEDURAL_STREAM_CREATE_FAILED','error');}).finally(()=>{if(button.isConnected)button.disabled=false;});
  }

  function requestedPoint(event,drag){const world=engine.eventWorldPoint(event);return{x:world.x-drag.grabOffsetX,y:world.y-drag.grabOffsetY};}
  function captureBoundaryTransition(event){
    const desc=descriptor(),drag=engine.tokenDrag;if(!desc||!drag||transitioning||event.button!==0)return;
    const requested=requestedPoint(event,drag),transition=core.resolveTransition(desc,requested,mapData.grid);
    if(!transition?.valid)return;
    event.preventDefault();event.stopImmediatePropagation();
    const tokenId=drag.token.id,from={x:drag.originX,y:drag.originY,z:drag.originZ,elevationFt:drag.originElevationFt};
    drag.token.x=drag.originX;drag.token.y=drag.originY;drag.token.zLayer=drag.originZ;drag.token.z=[drag.originZ];drag.token.elevationFt=drag.originElevationFt;
    engine.tokenDrag=null;if(engine.canvas?.style)engine.canvas.style.cursor='default';
    Promise.resolve(activateChunk(desc,transition.target,{tokenId,requestedPoint:requested,exit:transition.exit,persist:true})).then(({token,descriptor:next})=>{
      if(!token)return;
      engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:token-moved',{detail:{tokenId:token.id,from,to:{x:token.x,y:token.y,...token.gridPosition,elevationFt:token.elevationFt??0},chunkTransition:{from:transition.from,to:next.activeChunk,edges:transition.exit.edges}}}));
      engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:procedural-chunk-transition',{detail:{tokenId:token.id,from:transition.from,to:next.activeChunk,edges:transition.exit.edges}}));
    }).catch(error=>{console.error('VTT PROCEDURAL CHUNK TRANSITION FAILED:',error);notify(error?.message||'PROCEDURAL_CHUNK_TRANSITION_FAILED','error');});
  }

  doc.addEventListener('click',captureCreate,true);
  window.addEventListener('mouseup',captureBoundaryTransition,true);

  const api=Object.freeze({
    core,descriptor,createStreamedZone,activateChunk,
    performance:()=>core.performanceBudget(descriptor()||{chunkCols:1,chunkRows:1}),
    get activePlan(){return activePlan;},
    get transitioning(){return transitioning;},
    stop(){if(stopped)return;stopped=true;doc.removeEventListener('click',captureCreate,true);window.removeEventListener('mouseup',captureBoundaryTransition,true);activePlan=null;},
  });
  window.LuminousVttProceduralChunkStreamingRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,proceduralChunks:api});
  return api;
}
