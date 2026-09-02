const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function proceduralScene(mapData){
  const state=mapData?.procedural;
  return Boolean(state&&(state.signature||state.generatorVersion||state.streaming||state.activeChunkSignature));
}

function pointFrom(value,size=70){
  if(!value||typeof value!=='object')return null;
  if(Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y)))return{x:Number(value.x),y:Number(value.y)};
  if(Number.isFinite(Number(value.col))&&Number.isFinite(Number(value.row)))return{x:Number(value.col)*size,y:Number(value.row)*size};
  return null;
}

function cameraBounds(engine,camera=engine?.camera,paddingCells=2){
  if(!engine?.canvas||typeof camera?.screenToWorld!=='function')return null;
  const rect=engine.canvas.getBoundingClientRect?.();
  const width=Math.max(1,finite(rect?.width,engine.canvas.clientWidth||engine.canvas.width||1));
  const height=Math.max(1,finite(rect?.height,engine.canvas.clientHeight||engine.canvas.height||1));
  const a=camera.screenToWorld(0,0),b=camera.screenToWorld(width,height);
  const pad=Math.max(0,finite(engine.mapData?.grid?.size,70)*paddingCells);
  return{minX:Math.min(a.x,b.x)-pad,minY:Math.min(a.y,b.y)-pad,maxX:Math.max(a.x,b.x)+pad,maxY:Math.max(a.y,b.y)+pad};
}

function rectIntersects(bounds,minX,minY,maxX,maxY,padding=0){
  if(!bounds)return true;
  const pad=Math.max(0,finite(padding));
  return !(maxX<bounds.minX-pad||minX>bounds.maxX+pad||maxY<bounds.minY-pad||minY>bounds.maxY+pad);
}

function segmentVisible(raw,bounds,size,padding=0){
  if(!bounds||!raw)return true;
  if([raw.x1,raw.y1,raw.x2,raw.y2].every(v=>Number.isFinite(Number(v)))){
    return rectIntersects(bounds,Math.min(Number(raw.x1),Number(raw.x2)),Math.min(Number(raw.y1),Number(raw.y2)),Math.max(Number(raw.x1),Number(raw.x2)),Math.max(Number(raw.y1),Number(raw.y2)),padding);
  }
  const a=pointFrom(raw.a||raw.from||raw.start||raw.p1,size),b=pointFrom(raw.b||raw.to||raw.end||raw.p2,size);
  if(!a||!b)return true;
  return rectIntersects(bounds,Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x,b.x),Math.max(a.y,b.y),padding);
}

function structureVisible(raw,bounds,size){
  if(!raw||!bounds)return true;
  if(segmentVisible(raw,bounds,size,size))return true;
  const p=pointFrom(raw.position||raw.gridPosition||raw,size)||pointFrom(raw,size);
  return p?rectIntersects(bounds,p.x,p.y,p.x,p.y,size*2):true;
}

function objectVisible(raw,bounds,size){
  if(!raw||!bounds)return true;
  const p=pointFrom(raw.position||raw.gridPosition||raw.anchor||raw,size)||pointFrom(raw,size);
  return p?rectIntersects(bounds,p.x,p.y,p.x,p.y,size*4):true;
}

function planeVisible(raw,bounds,size){
  if(!raw||!bounds)return true;
  const g=raw.footprint||raw.geometry||raw.rect;
  if(g&&[g.minCol,g.minRow,g.maxCol,g.maxRow].every(v=>Number.isFinite(Number(v)))){
    return rectIntersects(bounds,Number(g.minCol)*size,Number(g.minRow)*size,(Number(g.maxCol)+1)*size,(Number(g.maxRow)+1)*size,size);
  }
  return true;
}

function surfaceLayerInBounds(mapData,zLayer,bounds){
  const layers=mapData.surfaceLayers;
  if(!layers||!bounds)return layers;
  const key=String(Number(zLayer)||0),source=layers[key];
  if(!source||typeof source!=='object')return layers;
  const size=Math.max(1,finite(mapData.grid?.size,70));
  const cols=Math.max(1,Math.trunc(finite(mapData.grid?.cols,1))),rows=Math.max(1,Math.trunc(finite(mapData.grid?.rows,1)));
  const minCol=Math.max(0,Math.floor(bounds.minX/size)),maxCol=Math.min(cols-1,Math.floor(bounds.maxX/size));
  const minRow=Math.max(0,Math.floor(bounds.minY/size)),maxRow=Math.min(rows-1,Math.floor(bounds.maxY/size));
  const visible={};
  for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
    const cellKey=`${col}_${row}`;
    if(source[cellKey]!=null)visible[cellKey]=source[cellKey];
  }
  return{...layers,[key]:visible};
}

function sceneCounts(mapData,zLayer){
  return{
    topology:Array.isArray(mapData.topology)?mapData.topology.length:0,
    walls:Array.isArray(mapData.walls)?mapData.walls.length:0,
    structures:Array.isArray(mapData.structures)?mapData.structures.length:0,
    worldObjects:Array.isArray(mapData.worldObjects)?mapData.worldObjects.length:0,
    horizontalPlanes:Array.isArray(mapData.horizontalPlanes)?mapData.horizontalPlanes.length:0,
    surfaces:Object.keys(mapData.surfaceLayers?.[String(Number(zLayer)||0)]||{}).length,
  };
}

function topologyBlocksVision(element={}){
  const core=globalThis.LuminousVttTopology;
  if(core?.effectiveFlags)return Boolean(core.effectiveFlags(element)?.blocksVision);
  const type=String(element.type||'wall'),state=String(element.state||'closed');
  if(type==='wall')return true;
  if(state==='open'||state==='broken')return false;
  return type!=='window';
}

function geometrySnapshot(mapData={}){
  const topology=Array.isArray(mapData.topology)?mapData.topology:[];
  const proceduralDiagnostics=mapData.procedural?.geometryDiagnostics||mapData.procedural?.geometryBudget||null;
  const currentWalls=topology.filter(x=>x?.type==='wall').length;
  const buildings=Array.isArray(mapData.semantics?.buildings)?mapData.semantics.buildings.length:(Array.isArray(mapData.buildings)?mapData.buildings.length:0);
  const rawTopologyElements=Math.max(topology.length,finite(proceduralDiagnostics?.rawTopologyElements,topology.length));
  const rawWallSegments=Math.max(currentWalls,finite(proceduralDiagnostics?.rawWallSegments,currentWalls));
  const optimizedWallSegments=currentWalls;
  const absoluteReduction=Math.max(0,rawWallSegments-optimizedWallSegments);
  const reductionPercent=rawWallSegments>0?(absoluteReduction/rawWallSegments)*100:0;
  const doors=topology.filter(x=>x?.type==='door').length;
  const windows=topology.filter(x=>x?.type==='window').length;
  const curtainWindows=topology.filter(x=>x?.type==='curtain_window').length;
  const openings=topology.filter(x=>x?.type==='opening').length;
  const visionBlockingSegments=topology.filter(topologyBlocksVision).length;
  const warnings=[];
  const diagnosticHigh=Math.max(256,Math.max(1,buildings)*64);
  if(rawWallSegments>=diagnosticHigh)warnings.push({code:'PROCEDURAL_GEOMETRY_HIGH',rawWallSegments,buildings,diagnosticThreshold:diagnosticHigh,gameplayLimit:false});
  return Object.freeze({buildings,rawTopologyElements,rawWallSegments,optimizedWallSegments,doors,windows,curtainWindows,openings,visionBlockingSegments,absoluteReduction,reductionPercent,warnings});
}

export function installProceduralPerformanceRuntime({runtime=globalThis.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(globalThis.LuminousVttProceduralPerformance?.__v1)return globalThis.LuminousVttProceduralPerformance;
  const engine=runtime.engine,renderer=engine.renderer,size=Math.max(1,finite(mapData.grid?.size,70));
  let enabled=true,stopped=false;
  const metrics={renderFrames:0,renderRequests:0,cameraDirtyEvents:0,tokenPreviewFrames:0,cullPrepTotalMs:0,cullPrepMaxMs:0,frameTotalMs:0,frameMaxMs:0,visionCalls:0,visionFilterTotalMs:0,visionFilterMaxMs:0,lastTotals:null,lastVisible:null,lastVisionTotal:0,lastVisionCandidates:0};

  const onSceneDirty=(event)=>{
    metrics.renderRequests+=event?.detail?.render===false?0:1;
    if(event?.detail?.reason==='camera')metrics.cameraDirtyEvents+=1;
  };
  const onTokenPreview=()=>{metrics.tokenPreviewFrames+=1;};
  engine.canvas?.addEventListener?.('vtt:scene-dirty',onSceneDirty);
  engine.canvas?.addEventListener?.('vtt:token-preview-moved',onTokenPreview);

  const originalVisionWalls=engine.visionWallsForLayer?.bind(engine);
  let wrappedVisionWalls=null;
  if(originalVisionWalls){
    wrappedVisionWalls=function proceduralVisionWalls(zLayer){
      const all=originalVisionWalls(zLayer)||[];
      if(!enabled||!proceduralScene(mapData)||all.length<32){metrics.lastVisionTotal=all.length;metrics.lastVisionCandidates=all.length;return all;}
      const started=performance.now();
      const viewer=engine.viewerToken?.();
      if(!viewer){metrics.lastVisionTotal=all.length;metrics.lastVisionCandidates=all.length;return all;}
      const profile=engine.visionProfile?.(viewer);
      const radius=Math.max(size*2,finite(profile?.radiusPx,engine.legacyVisionRadius||400))+size*2;
      const bounds={minX:finite(viewer.x)-radius,minY:finite(viewer.y)-radius,maxX:finite(viewer.x)+radius,maxY:finite(viewer.y)+radius};
      const filtered=all.filter(wall=>segmentVisible(wall,bounds,size,size));
      const elapsed=performance.now()-started;
      metrics.visionCalls+=1;metrics.visionFilterTotalMs+=elapsed;metrics.visionFilterMaxMs=Math.max(metrics.visionFilterMaxMs,elapsed);metrics.lastVisionTotal=all.length;metrics.lastVisionCandidates=filtered.length;
      return filtered;
    };
    engine.visionWallsForLayer=wrappedVisionWalls;
  }

  const originalRender=renderer?.render?.bind(renderer);
  let wrappedRender=null;
  if(originalRender){
    wrappedRender=function proceduralCulledRender(camera,activeZ,renderData,isExporting=false){
      if(!enabled||!proceduralScene(mapData)||isExporting)return originalRender(camera,activeZ,renderData,isExporting);
      const bounds=cameraBounds(engine,camera,2);
      if(!bounds)return originalRender(camera,activeZ,renderData,isExporting);
      const frameStarted=performance.now(),prepStarted=frameStarted,originals={
        topology:mapData.topology,walls:mapData.walls,structures:mapData.structures,worldObjects:mapData.worldObjects,horizontalPlanes:mapData.horizontalPlanes,surfaceLayers:mapData.surfaceLayers,
      };
      const totals=sceneCounts(mapData,activeZ);
      try{
        if(Array.isArray(originals.topology))mapData.topology=originals.topology.filter(item=>segmentVisible(item,bounds,size,size));
        if(Array.isArray(originals.walls))mapData.walls=originals.walls.filter(item=>segmentVisible(item,bounds,size,size));
        if(Array.isArray(originals.structures))mapData.structures=originals.structures.filter(item=>structureVisible(item,bounds,size));
        if(Array.isArray(originals.worldObjects))mapData.worldObjects=originals.worldObjects.filter(item=>objectVisible(item,bounds,size));
        if(Array.isArray(originals.horizontalPlanes))mapData.horizontalPlanes=originals.horizontalPlanes.filter(item=>planeVisible(item,bounds,size));
        if(originals.surfaceLayers)mapData.surfaceLayers=surfaceLayerInBounds(mapData,activeZ,bounds);
        metrics.lastTotals=totals;metrics.lastVisible=sceneCounts(mapData,activeZ);
        const prepElapsed=performance.now()-prepStarted;metrics.cullPrepTotalMs+=prepElapsed;metrics.cullPrepMaxMs=Math.max(metrics.cullPrepMaxMs,prepElapsed);
        return originalRender(camera,activeZ,renderData,isExporting);
      }finally{
        mapData.topology=originals.topology;mapData.walls=originals.walls;mapData.structures=originals.structures;mapData.worldObjects=originals.worldObjects;mapData.horizontalPlanes=originals.horizontalPlanes;mapData.surfaceLayers=originals.surfaceLayers;
        const frameElapsed=performance.now()-frameStarted;metrics.renderFrames+=1;metrics.frameTotalMs+=frameElapsed;metrics.frameMaxMs=Math.max(metrics.frameMaxMs,frameElapsed);
      }
    };
    renderer.render=wrappedRender;
  }

  const api=Object.freeze({
    __v1:true,
    setEnabled(value){enabled=Boolean(value);return enabled;},
    get enabled(){return enabled;},
    get active(){return enabled&&proceduralScene(mapData);},
    bounds:()=>cameraBounds(engine,engine.camera,2),
    geometry:()=>geometrySnapshot(mapData),
    snapshot(){
      const field=globalThis.LuminousVttFieldStabilityHotfix?.snapshot?.()||{};
      return Object.freeze({...metrics,avgCullPrepMs:metrics.renderFrames?metrics.cullPrepTotalMs/metrics.renderFrames:0,avgFrameMs:metrics.renderFrames?metrics.frameTotalMs/metrics.renderFrames:0,avgVisionFilterMs:metrics.visionCalls?metrics.visionFilterTotalMs/metrics.visionCalls:0,visionRecomputes:finite(field.visionRecomputes,0),visionCacheHits:finite(field.visionCacheHits,0),topologyCandidates:metrics.lastVisionCandidates,geometry:geometrySnapshot(mapData),enabled,active:enabled&&proceduralScene(mapData)});
    },
    stop(){
      if(stopped)return false;stopped=true;
      engine.canvas?.removeEventListener?.('vtt:scene-dirty',onSceneDirty);
      engine.canvas?.removeEventListener?.('vtt:token-preview-moved',onTokenPreview);
      if(wrappedVisionWalls&&engine.visionWallsForLayer===wrappedVisionWalls)engine.visionWallsForLayer=originalVisionWalls;
      if(wrappedRender&&renderer.render===wrappedRender)renderer.render=originalRender;
      if(globalThis.LuminousVttProceduralPerformance===api)delete globalThis.LuminousVttProceduralPerformance;
      return true;
    },
  });
  globalThis.LuminousVttProceduralPerformance=api;
  return api;
}
