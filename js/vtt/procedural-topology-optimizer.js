(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralTopologyOptimizer=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clean=v=>String(v??'').trim();

  function topologyCore(){
    if(root?.LuminousVttTopology)return root.LuminousVttTopology;
    if(typeof require!=='undefined'){try{return require('./topology.js');}catch(_){}}
    return null;
  }

  function layersOf(element={}){
    const core=topologyCore();
    if(core?.elementLayers)return core.elementLayers(element).map(Number).sort((a,b)=>a-b);
    if(Array.isArray(element.z))return element.z.map(Number).sort((a,b)=>a-b);
    return[finite(element.z,0)];
  }

  function flagsOf(element={}){
    if(typeof element.blocksMovement==='boolean'||typeof element.blocksVision==='boolean')return{blocksMovement:element.blocksMovement!==false,blocksVision:element.blocksVision!==false};
    const core=topologyCore();
    if(core?.effectiveFlags)return core.effectiveFlags(element);
    const type=clean(element.type)||'wall',state=clean(element.state)||'closed';
    if(type==='wall')return{blocksMovement:true,blocksVision:true};
    if(state==='open'||state==='broken')return{blocksMovement:false,blocksVision:false};
    if(type==='window')return{blocksMovement:true,blocksVision:false};
    return{blocksMovement:true,blocksVision:true};
  }

  function normalize(element={}){
    const core=topologyCore();
    return core?.normalizeElement?core.normalizeElement(element):{
      ...clone(element),
      id:clean(element.id),
      type:clean(element.type)||'wall',
      from:{col:finite(element.from?.col),row:finite(element.from?.row)},
      to:{col:finite(element.to?.col),row:finite(element.to?.row)},
      z:layersOf(element),
      thicknessFt:Math.max(.1,finite(element.thicknessFt,.5)),
    };
  }

  function axis(element={}){
    const from=element.from||{},to=element.to||{};
    if(Number(from.row)===Number(to.row)&&Number(from.col)!==Number(to.col))return'h';
    if(Number(from.col)===Number(to.col)&&Number(from.row)!==Number(to.row))return'v';
    return null;
  }

  function stableArray(value){return Array.isArray(value)?[...value].map(String).sort():[];}
  function compatibilityKey(element={}){
    const normalized=normalize(element),flags=flagsOf(normalized);
    const semantics={
      type:normalized.type,
      z:layersOf(normalized),
      thicknessFt:finite(normalized.thicknessFt,.5),
      blocksMovement:Boolean(flags.blocksMovement),
      blocksVision:Boolean(flags.blocksVision),
      materialId:clean(normalized.materialId||normalized.material?.id),
      physicalMaterialId:clean(normalized.physicalMaterialId||normalized.physicsMaterialId),
      collisionMaterialId:clean(normalized.collisionMaterialId),
      wallClass:clean(normalized.wallClass||normalized.structuralType),
      soundBlocking:normalized.soundBlocking??null,
      soundTransmission:normalized.soundTransmission??null,
      tags:stableArray(normalized.tags),
      zoneId:clean(normalized.procedural?.zoneId),
      buildingId:clean(normalized.procedural?.buildingId),
      parcelId:clean(normalized.procedural?.parcelId),
    };
    return JSON.stringify(semantics);
  }

  function sourceIdsOf(element={}){
    const ids=[];
    if(clean(element.id))ids.push(clean(element.id));
    for(const id of element.sourceIds||[])if(clean(id))ids.push(clean(id));
    for(const id of element.procedural?.sourceIds||[])if(clean(id))ids.push(clean(id));
    return[...new Set(ids)];
  }

  function orderedSegment(element={}){
    const normalized=normalize(element),orientation=axis(normalized);
    if(!orientation)return null;
    const fixed=orientation==='h'?Number(normalized.from.row):Number(normalized.from.col);
    const a=orientation==='h'?Number(normalized.from.col):Number(normalized.from.row);
    const b=orientation==='h'?Number(normalized.to.col):Number(normalized.to.row);
    return{element:normalized,orientation,fixed,start:Math.min(a,b),end:Math.max(a,b)};
  }

  function mergedElement(run=[]){
    if(!run.length)return null;
    const first=run[0],base=clone(first.element);
    const sourceIds=[...new Set(run.flatMap(item=>sourceIdsOf(item.element)))];
    const end=Math.max(...run.map(item=>item.end));
    if(first.orientation==='h'){
      base.from={col:first.start,row:first.fixed};
      base.to={col:end,row:first.fixed};
    }else{
      base.from={col:first.fixed,row:first.start};
      base.to={col:first.fixed,row:end};
    }
    base.sourceIds=sourceIds;
    base.procedural={...(base.procedural||{}),sourceIds};
    return base;
  }

  function geometryMetrics(raw=[],optimized=raw,buildingCount=0){
    const rawWalls=raw.filter(x=>x?.type==='wall').length;
    const optimizedWalls=optimized.filter(x=>x?.type==='wall').length;
    const absoluteReduction=Math.max(0,rawWalls-optimizedWalls);
    const reductionPercent=rawWalls?(absoluteReduction/rawWalls)*100:0;
    const doors=optimized.filter(x=>x?.type==='door').length;
    const windows=optimized.filter(x=>x?.type==='window').length;
    const curtainWindows=optimized.filter(x=>x?.type==='curtain_window').length;
    const openings=optimized.filter(x=>x?.type==='opening').length;
    const visionBlockingSegments=optimized.filter(x=>flagsOf(x).blocksVision).length;
    const warnings=[];
    const diagnosticThreshold=Math.max(256,Math.max(1,finite(buildingCount,0))*64);
    if(rawWalls>=diagnosticThreshold)warnings.push({code:'PROCEDURAL_GEOMETRY_HIGH',rawWallSegments:rawWalls,buildings:finite(buildingCount,0),diagnosticThreshold,gameplayLimit:false});
    return Object.freeze({buildings:finite(buildingCount,0),rawTopologyElements:raw.length,rawWallSegments:rawWalls,optimizedTopologyElements:optimized.length,optimizedWallSegments:optimizedWalls,doors,windows,curtainWindows,openings,visionBlockingSegments,absoluteReduction,reductionPercent,warnings});
  }

  function optimizeTopology(elements=[],options={}){
    const raw=(Array.isArray(elements)?elements:[]).map(normalize);
    const passthrough=[];
    const groups=new Map();
    raw.forEach((element,index)=>{
      const segment=orderedSegment(element);
      if(element.type!=='wall'||!segment){passthrough.push({index,element});return;}
      const key=`${segment.orientation}:${segment.fixed}:${compatibilityKey(element)}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({...segment,index});
    });

    const merged=[];
    for(const items of groups.values()){
      items.sort((a,b)=>a.start-b.start||a.end-b.end||a.index-b.index);
      let run=[];
      const flush=()=>{if(run.length){merged.push({index:Math.min(...run.map(x=>x.index)),element:mergedElement(run)});run=[];}};
      for(const item of items){
        if(!run.length){run=[item];continue;}
        const prev=run[run.length-1];
        if(item.start<=prev.end){
          if(item.end>prev.end)run.push({...item,start:prev.end});else run.push(item);
          continue;
        }
        flush();run=[item];
      }
      flush();
    }

    const ordered=[...passthrough,...merged].sort((a,b)=>a.index-b.index).map(x=>x.element);
    const sourceIdMap={};
    for(const element of ordered)for(const sourceId of sourceIdsOf(element))sourceIdMap[sourceId]=element.id;
    const metrics=geometryMetrics(raw,ordered,options.buildingCount||0);
    return Object.freeze({topology:ordered,sourceIdMap:Object.freeze(sourceIdMap),metrics});
  }

  return Object.freeze({axis,compatibilityKey,sourceIdsOf,geometryMetrics,optimizeTopology});
});
