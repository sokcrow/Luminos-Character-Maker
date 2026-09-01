import './procedural-chunk-streaming-core.js';

const APPLY_SELECTOR='[data-proc-apply]';
const PREVIEW_SELECTOR='[data-proc-preview],[data-proc-reroll]';
const SIZE_SELECTOR='[data-proc-size]';
const PANEL_ID='vtt-procedural-zone-panel';
const STATE_ROOT='campaña/estado_mundo/vttProceduralChunkState';
const REQUEST_ROOT='vtt_procedural_chunk_transition_requests';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const clean=v=>String(v??'').trim();

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData,procedural=runtime?.procedural}={}){
  if(!runtime?.engine||!mapData||!procedural)return null;
  if(window.LuminousVttProceduralChunkStreamingRuntime?.api)return window.LuminousVttProceduralChunkStreamingRuntime.api;
  const core=window.LuminousVttProceduralChunkStreaming,generator=window.LuminousVttProceduralGenerator;
  if(!core||!generator)throw new Error('PROCEDURAL_CHUNK_STREAMING_REQUIRED');

  const engine=runtime.engine,doc=window.document,isDm=Boolean(runtime.bridge?.isDm);
  const stateApi=window.LuminousVttMapAuthoringState;
  const firebase=stateApi?.hostFirebase?.(window)||window.firebase||null;
  const db=firebase?.database?.()||null;
  const mapId=clean(mapData.id||mapData.mapId||'default').replace(/[.#$[\]\/]/g,'_')||'default';
  const subscriptions=[];
  let stopped=false,transitioning=false,activePlan=null,remoteApplying=false;

  function notify(message,type='info'){runtime.controller?.notify?.(message,type);}
  function sizeInput(){return doc.querySelector(SIZE_SELECTOR);}
  function selectedLogicalSize(){const n=Number(sizeInput()?.value);return Math.max(1,Math.min(3,Number.isFinite(n)?Math.trunc(n):1));}
  function sceneHasContent(){return['topology','walls','worldObjects','horizontalPlanes','structures','verticalPortals'].some(k=>(mapData[k]||[]).length>0)||(mapData.semantics?.buildings||[]).length>0;}
  function descriptor(){return mapData.procedural?.streaming?core.createDescriptor(mapData.procedural.streaming):null;}
  function planProfile(plan={}){return clone(plan.fabric?.profile||null);}
  function buildDescriptor(plan={},size=1){return core.createDescriptor({zoneId:plan.zone?.id||`zone_${mapData.id||mapData.mapId||'active'}`,seed:plan.seed,profileId:plan.profileId,profile:planProfile(plan),chunkCols:size,chunkRows:size,activeChunk:{col:0,row:0}});}
  function writeStreamingMetadata(desc,plan){
    mapData.procedural={...(mapData.procedural||{}),streaming:core.createDescriptor(desc),logicalZone:{chunkSize:core.CHUNK_SIZE,chunkCols:desc.chunkCols,chunkRows:desc.chunkRows,cols:desc.logicalCols,rows:desc.logicalRows},activeChunk:clone(desc.activeChunk),activeChunkSignature:plan?.signature||null};
    return mapData.procedural.streaming;
  }
  function generationOverrides(){return{gridSize:mapData.grid?.size||70,maxAttempts:8,minBuildings:1};}
  async function generateChunk(desc,coord){return procedural.previewAsync(core.chunkGenerationOptions(desc,coord,generationOverrides()));}
  function redraw(reason='procedural-chunk-streamed'){runtime.semanticMap?.touch?.(reason);engine.renderer?.invalidate?.();engine.invalidate?.();}
  function centerOnToken(token){if(!token)return;engine.camera?.centerOnWorldPoint?.({x:token.x,y:token.y});if(!engine.camera?.centerOnWorldPoint)engine.centerCamera?.();}
  async function persistChunk(plan){if(!isDm)return;await procedural.persist(plan);}
  function stateRef(){return db?.ref?.(`${STATE_ROOT}/${mapId}`)||null;}
  function requestRootRef(){return db?.ref?.(`${REQUEST_ROOT}/${mapId}`)||null;}
  function subscribe(ref,event,handler){if(!ref?.on)return;ref.on(event,handler);subscriptions.push(()=>ref.off(event,handler));}
  function emitSemantic(type,detail){engine.canvas?.dispatchEvent?.(new CustomEvent(type,{detail}));}
  function emitDirty(sourceEvent,detail={}){
    window.LuminousVttSceneDirty?.emit?.(engine.canvas,{
      reason:'chunk',render:true,vision:true,active:false,sourceEvent,tokenId:detail?.tokenId??null,meta:detail,
    });
  }

  async function publishChunkState(desc,plan){
    if(!isDm||!stateRef())return false;
    const payload={schemaVersion:1,mapId,descriptor:core.createDescriptor(desc),activeSignature:plan?.signature||null,clientUpdatedAt:Date.now()};
    if(firebase?.database?.ServerValue?.TIMESTAMP)payload.updatedAt=firebase.database.ServerValue.TIMESTAMP;
    await stateRef().set(payload);return true;
  }

  function entryCandidates(token,entry,exit){
    const size=mapData.grid?.size||70,out=[],seen=new Set();
    const push=(col,row)=>{col=Math.max(0,Math.min(39,col));row=Math.max(0,Math.min(39,row));const key=`${col},${row}`;if(seen.has(key))return;seen.add(key);out.push({col,row,x:(col+.5)*size,y:(row+.5)*size});};
    push(entry.col,entry.row);
    for(let depth=1;depth<=6;depth++){
      const baseCol=exit.dx>0?depth:exit.dx<0?39-depth:entry.col,baseRow=exit.dy>0?depth:exit.dy<0?39-depth:entry.row;push(baseCol,baseRow);
      for(let offset=1;offset<=6;offset++){
        if(exit.dx){push(baseCol,entry.row-offset);push(baseCol,entry.row+offset);}
        if(exit.dy){push(entry.col-offset,baseRow);push(entry.col+offset,baseRow);}
      }
    }
    const rules=window.LuminousVttTokenInteraction;
    return out.find(point=>rules?.canOccupy?.(token,point,mapData)?.valid)||out[0];
  }

  function dispatchTransitionMove(token,from,transition,next){
    if(!token)return;
    const moveDetail={tokenId:token.id,from,to:{x:token.x,y:token.y,...token.gridPosition,elevationFt:token.elevationFt??0},chunkTransition:{from:transition.from,to:next.activeChunk,edges:transition.exit.edges}};
    const transitionDetail={tokenId:token.id,from:transition.from,to:next.activeChunk,edges:transition.exit.edges};
    emitSemantic('vtt:token-moved',moveDetail);
    emitSemantic('vtt:procedural-chunk-transition',transitionDetail);
  }

  async function activateChunk(desc,coord,{tokenId=null,requestedPoint=null,exit=null,persist=isDm,publish=isDm,center=true}={}){
    if(transitioning)throw new Error('PROCEDURAL_CHUNK_TRANSITION_BUSY');
    transitioning=true;const previous=core.createDescriptor(desc);
    try{
      const plan=await generateChunk(previous,coord);procedural.apply(plan,{replaceScene:true,persist:false});
      const next=core.withActiveChunk(previous,coord);writeStreamingMetadata(next,plan);activePlan=plan;
      let token=null;if(tokenId!=null)token=(mapData.tokens||[]).find(x=>String(x.id)===String(tokenId))||null;
      if(token&&requestedPoint&&exit){
        const entry=core.entryCell(requestedPoint,mapData.grid,exit),safe=entryCandidates(token,entry,exit);
        token.x=safe.x;token.y=safe.y;const z=Number(token.zLayer??token.gridPosition?.z??token.z?.[0]??0);token.zLayer=z;token.z=[z];token.gridPosition={col:safe.col,row:safe.row,z};if(center)centerOnToken(token);
      }else if(center)engine.centerCamera?.();
      redraw();if(persist)await persistChunk(plan);if(publish)await publishChunkState(next,plan);
      const loadedDetail={chunk:clone(next.activeChunk),logical:{cols:next.chunkCols,rows:next.chunkRows},signature:plan.signature};
      emitSemantic('vtt:procedural-chunk-loaded',loadedDetail);
      emitDirty('vtt:procedural-chunk-loaded',loadedDetail);
      return{descriptor:next,plan,token};
    }finally{transitioning=false;}
  }

  async function createStreamedZone(previewPlan,size=selectedLogicalSize()){
    if(!previewPlan?.validation?.valid)throw new Error('PROCEDURAL_PREVIEW_REQUIRED');if(transitioning)throw new Error('PROCEDURAL_CHUNK_TRANSITION_BUSY');
    transitioning=true;
    try{
      let desc=buildDescriptor(previewPlan,size);desc=core.withChunkSeed(desc,{col:0,row:0},previewPlan.seed);desc=core.withActiveChunk(desc,{col:0,row:0});
      procedural.apply(previewPlan,{replaceScene:true,persist:false});writeStreamingMetadata(desc,previewPlan);activePlan=previewPlan;engine.centerCamera?.();redraw('procedural-stream-created');
      const createdDetail={chunk:clone(desc.activeChunk),logical:{cols:desc.chunkCols,rows:desc.chunkRows},signature:previewPlan.signature};emitDirty('procedural-stream-created',createdDetail);
      await persistChunk(previewPlan);await publishChunkState(desc,previewPlan);
      mapData.proceduralEditor&&(mapData.proceduralEditor.previewPlan=null);if(mapData.proceduralEditor)mapData.proceduralEditor.previewGenerationError=null;
      doc.getElementById(PANEL_ID)?.querySelector('[data-proc-close]')?.click();notify(`Zona ${size}×${size} creada en streaming · activo 40×40 · chunk 1,1`,'success');
      return{descriptor:desc,plan:previewPlan,token:null};
    }finally{transitioning=false;}
  }

  function capturePreviewSizing(event){
    if(!event.target?.closest?.(PREVIEW_SELECTOR))return;
    const input=sizeInput(),logical=selectedLogicalSize();if(!input||logical<=1)return;
    mapData.proceduralEditor||={};mapData.proceduralEditor.logicalChunkSize=logical;input.value='1';queueMicrotask(()=>{if(input.isConnected)input.value=String(logical);});
  }

  function captureCreate(event){
    const button=event.target?.closest?.(APPLY_SELECTOR);if(!button||transitioning)return;
    const plan=mapData.proceduralEditor?.previewPlan,size=selectedLogicalSize();if(size<=1||!plan?.validation?.valid)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(sceneHasContent()&&!window.confirm('CREAR ZONA reemplazará la geometría y semántica actual. Los tokens de jugador se conservarán. ¿Continuar?'))return;
    button.disabled=true;Promise.resolve(createStreamedZone(plan,size)).catch(error=>{console.error('VTT PROCEDURAL STREAMED ZONE CREATE FAILED:',error);notify(error?.message||'PROCEDURAL_STREAM_CREATE_FAILED','error');}).finally(()=>{if(button.isConnected)button.disabled=false;});
  }

  function requestedPoint(event,drag){const world=engine.eventWorldPoint(event);return{x:world.x-drag.grabOffsetX,y:world.y-drag.grabOffsetY};}
  function restoreDrag(drag){drag.token.x=drag.originX;drag.token.y=drag.originY;drag.token.zLayer=drag.originZ;drag.token.z=[drag.originZ];drag.token.elevationFt=drag.originElevationFt;engine.tokenDrag=null;if(engine.canvas?.style)engine.canvas.style.cursor='default';}

  async function requestTransition(desc,transition,tokenId,requested,from){
    if(!db||!requestRootRef()){
      const result=await activateChunk(desc,transition.target,{tokenId,requestedPoint:requested,exit:transition.exit,persist:false,publish:false});dispatchTransitionMove(result.token,from,transition,result.descriptor);return result;
    }
    const ref=requestRootRef().push();const payload={schemaVersion:1,mapId,tokenId:String(tokenId),fromChunk:clone(transition.from),targetChunk:clone(transition.target),requestedPoint:clone(requested),exit:{dx:transition.exit.dx,dy:transition.exit.dy,edges:clone(transition.exit.edges)},origin:clone(from),status:'pending',clientCreatedAt:Date.now()};
    if(firebase?.database?.ServerValue?.TIMESTAMP)payload.createdAt=firebase.database.ServerValue.TIMESTAMP;
    await ref.set(payload);notify('Transición de zona solicitada.','pending');
    const handler=snapshot=>{const value=snapshot.val()||{};if(value.status==='applied'){notify('Zona cargada.','success');ref.off('value',handler);}else if(value.status==='denied'){notify(`Transición rechazada${value.reason?`: ${value.reason}`:''}.`,'error');ref.off('value',handler);}};ref.on('value',handler);
    return{pending:true,requestId:ref.key};
  }

  async function processTransitionRequest(snapshot){
    if(!isDm)return;const request=snapshot.val()||{};if(request.status!=='pending'||clean(request.mapId)!==mapId)return;
    const desc=descriptor();let reason=null;
    const from=core.normalizeCoord(request.fromChunk||{}),target=core.normalizeCoord(request.targetChunk||{}),current=desc?.activeChunk;
    const dx=target.col-from.col,dy=target.row-from.row;
    if(!desc)reason='STREAMING_ZONE_NOT_ACTIVE';
    else if(from.col!==current.col||from.row!==current.row)reason='STALE_CHUNK_REQUEST';
    else if((dx===0&&dy===0)||Math.abs(dx)>1||Math.abs(dy)>1||!core.containsChunk(desc,target))reason='INVALID_CHUNK_TRANSITION';
    if(reason){await snapshot.ref.update({status:'denied',reason,decidedAt:firebase?.database?.ServerValue?.TIMESTAMP||Date.now()});return;}
    const exit={dx,dy,edges:Array.isArray(request.exit?.edges)?request.exit.edges:[]},transition={valid:true,from,target,exit};
    try{
      const result=await activateChunk(desc,target,{tokenId:request.tokenId,requestedPoint:request.requestedPoint||{},exit,persist:true,publish:true});dispatchTransitionMove(result.token,request.origin||{},transition,result.descriptor);
      await snapshot.ref.update({status:'applied',reason:null,decidedAt:firebase?.database?.ServerValue?.TIMESTAMP||Date.now()});
    }catch(error){console.error('VTT PROCEDURAL CHUNK REQUEST FAILED:',error);await snapshot.ref.update({status:'denied',reason:clean(error?.message||error)||'CHUNK_TRANSITION_FAILED',decidedAt:firebase?.database?.ServerValue?.TIMESTAMP||Date.now()});}
  }

  async function applyRemoteState(snapshot){
    const value=snapshot.val()||{},incoming=value.descriptor;if(!incoming||clean(value.mapId)!==mapId||remoteApplying)return;
    const next=core.createDescriptor(incoming),current=descriptor(),sameChunk=current&&current.activeChunk.col===next.activeChunk.col&&current.activeChunk.row===next.activeChunk.row;
    const sameSignature=sameChunk&&clean(mapData.procedural?.activeChunkSignature)===clean(value.activeSignature);
    if(sameSignature)return;
    if(isDm&&sameChunk&&transitioning)return;
    remoteApplying=true;
    try{await activateChunk(next,next.activeChunk,{persist:false,publish:false,center:false});}
    catch(error){console.error('VTT PROCEDURAL REMOTE CHUNK APPLY FAILED:',error);notify(error?.message||'REMOTE_CHUNK_APPLY_FAILED','error');}
    finally{remoteApplying=false;}
  }

  function captureBoundaryTransition(event){
    const desc=descriptor(),drag=engine.tokenDrag;if(!desc||!drag||transitioning||event.button!==0)return;
    const requested=requestedPoint(event,drag),transition=core.resolveTransition(desc,requested,mapData.grid);if(!transition?.valid)return;
    event.preventDefault();event.stopImmediatePropagation();const tokenId=drag.token.id,from={x:drag.originX,y:drag.originY,z:drag.originZ,elevationFt:drag.originElevationFt};restoreDrag(drag);
    if(isDm){Promise.resolve(activateChunk(desc,transition.target,{tokenId,requestedPoint:requested,exit:transition.exit,persist:true,publish:true})).then(result=>dispatchTransitionMove(result.token,from,transition,result.descriptor)).catch(error=>{console.error('VTT PROCEDURAL CHUNK TRANSITION FAILED:',error);notify(error?.message||'PROCEDURAL_CHUNK_TRANSITION_FAILED','error');});}
    else Promise.resolve(requestTransition(desc,transition,tokenId,requested,from)).catch(error=>{console.error('VTT PROCEDURAL CHUNK REQUEST FAILED:',error);notify(error?.message||'PROCEDURAL_CHUNK_REQUEST_FAILED','error');});
  }

  doc.addEventListener('click',capturePreviewSizing,true);doc.addEventListener('click',captureCreate,true);window.addEventListener('mouseup',captureBoundaryTransition,true);
  if(db){subscribe(stateRef(),'value',snapshot=>{applyRemoteState(snapshot).catch(error=>console.error('VTT PROCEDURAL CHUNK STATE FAILED:',error));});if(isDm)subscribe(requestRootRef(),'child_added',snapshot=>{processTransitionRequest(snapshot).catch(error=>console.error('VTT PROCEDURAL CHUNK REQUEST PROCESS FAILED:',error));});}

  const api=Object.freeze({core,descriptor,createStreamedZone,activateChunk,publishChunkState,requestTransition,performance:()=>core.performanceBudget(descriptor()||{chunkCols:1,chunkRows:1}),get activePlan(){return activePlan;},get transitioning(){return transitioning;},stop(){if(stopped)return;stopped=true;doc.removeEventListener('click',capturePreviewSizing,true);doc.removeEventListener('click',captureCreate,true);window.removeEventListener('mouseup',captureBoundaryTransition,true);subscriptions.splice(0).forEach(unsubscribe=>unsubscribe());activePlan=null;}});
  window.LuminousVttProceduralChunkStreamingRuntime={api};window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,proceduralChunks:api});return api;
}
