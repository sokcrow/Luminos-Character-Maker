import './player-discovery-core.js';

const PLAYER_ROOT='campaña/jugadores';
const clean=v=>String(v??'').trim();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const safe=v=>clean(v).replace(/[.#$\[\]\/]/g,'_')||'player';
function hostWindow(){try{if(window.parent&&window.parent!==window&&window.parent.document)return window.parent;}catch(_){}return window;}
function hostFirebase(){const host=hostWindow();return host?.firebase||window.firebase||null;}
function parseWorldTime(v){if(typeof v==='number'&&Number.isFinite(v))return v;const x=Date.parse(v||'');return Number.isFinite(x)?x:Date.now();}

export function start({runtime=globalThis.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(globalThis.LuminousVttPlayerDiscoveryRuntime?.api)return globalThis.LuminousVttPlayerDiscoveryRuntime.api;
  const Core=globalThis.LuminousVttPlayerDiscovery;if(!Core)throw new Error('PLAYER_DISCOVERY_CORE_REQUIRED');
  const firebase=hostFirebase(),db=firebase?.database?.()||null,identity=runtime.tokenStateBridge?.identity||{};
  const isDm=Boolean(runtime.bridge?.isDm),playerId=clean(identity.playerId),engine=runtime.engine,canvas=engine.canvas;
  let stopped=false,currentRecord=null,currentZone='',loading=null,capturing=false,pending=false;
  const listeners=[];

  function viewer(){return(mapData.tokens||[]).find(t=>t.viewer===true)||(mapData.tokens||[]).find(t=>t.characterLink?.mode==='current_player')||null;}
  function worldNow(){return parseWorldTime(hostWindow()?.LuminousWorldTimeScheduler?.getSnapshot?.()?.timestamp);}
  function position(){const token=viewer(),stream=mapData.procedural?.streaming||{};return token?.worldPosition||{worldId:mapData.worldId||'luminous',regionId:mapData.regionId||'region',zoneId:stream.zoneId||mapData.zoneId||mapData.id||'zone',chunkCol:stream.activeChunk?.col||0,chunkRow:stream.activeChunk?.row||0};}
  function chunk(pos=position()){const stream=mapData.procedural?.streaming||{};return{col:Number(pos?.chunkCol??stream.activeChunk?.col)||0,row:Number(pos?.chunkRow??stream.activeChunk?.row)||0};}
  function refFor(raw){return db?.ref(`${PLAYER_ROOT}/${safe(playerId)}/mapDiscovery/${Core.storageKey(raw)}`)||null;}
  function currentSlice(){const pos=position(),ch=chunk(pos);return Core.slice(currentRecord||Core.blank(pos),{identity:pos,zLayer:engine.activeZ,chunkCol:ch.col,chunkRow:ch.row,chunkSizeCells:40});}
  function publish(){mapData.playerDiscoveryRender=isDm?null:currentSlice();return mapData.playerDiscoveryRender;}

  async function load(raw=position(),force=false){
    if(isDm||!playerId){currentRecord=null;currentZone='';publish();return null;}
    const key=Core.zoneKey(raw);if(!force&&currentZone===key&&currentRecord)return currentRecord;if(loading)return loading;
    loading=(async()=>{let value=null;if(db){try{value=(await refFor(raw).once('value')).val();}catch(error){console.error('VTT PLAYER DISCOVERY LOAD FAILED:',error);}}
      currentRecord=Core.normalize(value||Core.blank(raw,worldNow()),raw);currentZone=key;publish();return currentRecord;})().finally(()=>{loading=null;});return loading;
  }

  function visibleTopology(vision,pos){
    const topology=globalThis.LuminousVttTopology;if(!topology||!Array.isArray(mapData.topology))return[];
    const out=[];for(const element of mapData.topology){
      if(topology.elementOnLayer&&!topology.elementOnLayer(element,engine.activeZ))continue;
      let seg=null;try{seg=topology.segment(element,mapData.grid);}catch(_){}if(!seg)continue;
      const points=[{x:seg.x1,y:seg.y1},{x:seg.x2,y:seg.y2},{x:(seg.x1+seg.x2)/2,y:(seg.y1+seg.y2)/2}];
      if(points.some(p=>Core.pointVisible(p,{polygon:vision.fovPolygon,tokenPos:vision.tokenPos,visionRadius:vision.visionRadius})))out.push(element);
    }return out;
  }

  async function persist(raw,record){
    if(!db||isDm||!playerId)return record;const ref=refFor(raw);
    const result=await ref.transaction(existing=>Core.merge(existing||Core.blank(raw),record));
    const saved=result?.snapshot?.val?.();if(saved)currentRecord=Core.normalize(saved,raw);return currentRecord;
  }

  async function captureNow(reason='vision'){
    if(stopped||isDm||!playerId)return null;if(capturing){pending=true;return null;}capturing=true;
    try{
      const pos=position(),zone=Core.zoneKey(pos);if(zone!==currentZone||!currentRecord)await load(pos,true);
      const vision=engine.calculateVision?.();if(!vision?.visible||!vision.fovPolygon?.length){publish();return currentRecord;}
      const ch=chunk(pos),cells=Core.visibleCells({polygon:vision.fovPolygon,tokenPos:vision.tokenPos,visionRadius:vision.visionRadius,gridSize:mapData.grid?.size||70,gridCols:mapData.grid?.cols||40,gridRows:mapData.grid?.rows||40,chunkCol:ch.col,chunkRow:ch.row,chunkSizeCells:40});
      const result=Core.capture(currentRecord,{identity:pos,zLayer:engine.activeZ,chunkCol:ch.col,chunkRow:ch.row,worldNow:worldNow(),cells,topology:visibleTopology(vision,pos)});
      if(result.changed){currentRecord=result.record;await persist(pos,currentRecord);}
      publish();
      canvas?.dispatchEvent?.(new CustomEvent('vtt:player-discovery-updated',{detail:{playerId,zoneKey:zone,reason,changed:result.changed,newCells:result.newCells,topologyChanges:result.topologyChanges,metrics:Core.metrics(currentRecord)}}));
      return currentRecord;
    }catch(error){console.error('VTT PLAYER DISCOVERY CAPTURE FAILED:',error);return currentRecord;}
    finally{capturing=false;if(pending&&!stopped){pending=false;void captureNow('coalesced');}}
  }

  function drawMemory(camera,activeZ,renderData,isExporting){
    if(isExporting||isDm)return;const memory=mapData.playerDiscoveryRender;if(!memory||Number(memory.zLayer)!==Number(activeZ))return;
    const ctx=engine.renderer?.ctx,size=Number(mapData.grid?.size)||70;if(!ctx)return;
    ctx.save();camera.applyTransformSimple(ctx);
    ctx.fillStyle='rgba(36,39,43,.72)';ctx.strokeStyle='rgba(120,125,132,.18)';ctx.lineWidth=1;
    for(const cell of memory.cells||[]){const center={x:(cell.col+.5)*size,y:(cell.row+.5)*size};if(renderData?.visible&&Core.pointVisible(center,{polygon:renderData.fovPolygon||[],tokenPos:renderData.tokenPos||{},visionRadius:renderData.visionRadius||0}))continue;ctx.fillRect(cell.col*size,cell.row*size,size,size);ctx.strokeRect(cell.col*size,cell.row*size,size,size);}
    const topology=globalThis.LuminousVttTopology;ctx.strokeStyle='rgba(150,154,160,.72)';ctx.lineWidth=3;
    for(const snapshot of memory.topology||[]){let seg=null;try{seg=topology?.segment?.(snapshot.element,mapData.grid);}catch(_){}if(!seg)continue;const mid={x:(seg.x1+seg.x2)/2,y:(seg.y1+seg.y2)/2};if(renderData?.visible&&Core.pointVisible(mid,{polygon:renderData.fovPolygon||[],tokenPos:renderData.tokenPos||{},visionRadius:renderData.visionRadius||0}))continue;ctx.beginPath();ctx.moveTo(seg.x1,seg.y1);ctx.lineTo(seg.x2,seg.y2);ctx.stroke();}
    ctx.restore();
  }

  const renderer=engine.renderer,originalRender=renderer?.render?.bind(renderer);
  if(renderer&&originalRender)renderer.render=(camera,activeZ,renderData,isExporting=false)=>{originalRender(camera,activeZ,renderData,isExporting);drawMemory(camera,activeZ,renderData,isExporting);};
  const listen=(target,name,fn)=>{target?.addEventListener?.(name,fn);listeners.push(()=>target?.removeEventListener?.(name,fn));};
  const captureEvent=event=>void captureNow(event?.type||'event');
  const reloadEvent=()=>{currentZone='';currentRecord=null;void load(position(),true).then(()=>captureNow('zone-change'));};
  listen(canvas,'vtt:token-moved',captureEvent);listen(canvas,'vtt:token-z-transition',captureEvent);listen(canvas,'vtt:procedural-chunk-loaded',captureEvent);listen(canvas,'vtt:regional-local-transition-applied',reloadEvent);listen(document,'vtt:token-senses-changed',captureEvent);
  void load(position(),true).then(()=>captureNow('start'));

  const api=Object.freeze({Core,isDm,playerId,load,capture:captureNow,handleTokenSync:reloadEvent,getRecord:()=>clone(currentRecord),getRenderSlice:()=>clone(mapData.playerDiscoveryRender),snapshot:()=>({zoneKey:currentZone,metrics:currentRecord?Core.metrics(currentRecord):null}),stop(){if(stopped)return;stopped=true;listeners.splice(0).forEach(fn=>fn());if(renderer&&originalRender)renderer.render=originalRender;mapData.playerDiscoveryRender=null;}});
  globalThis.LuminousVttPlayerDiscoveryRuntime={api};globalThis.LuminousVttRuntime=Object.freeze({...globalThis.LuminousVttRuntime,playerDiscovery:api});return api;
}
