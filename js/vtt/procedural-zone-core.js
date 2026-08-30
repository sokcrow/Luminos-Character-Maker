(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralZone=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const CHUNK_SIZE=40;
  const MAX_ZONE_CHUNKS=3;
  const DEFAULT_ZONE_CHUNKS=3;
  const EDGES=Object.freeze(['north','east','south','west']);
  const SOCKET_TYPES=Object.freeze(['street','alley','building','service_route','transition']);
  const clean=v=>String(v??'').trim();
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Math.trunc(finite(v,min))));
  const slug=(v,f='zone')=>clean(v).toLowerCase().replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||f;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function oppositeEdge(edge){
    return({north:'south',south:'north',east:'west',west:'east'})[edge]||null;
  }

  function axisLength(zone,edge){
    return edge==='north'||edge==='south'?zone.cols:zone.rows;
  }

  function normalizeSpan(raw={},length=1){
    const max=Math.max(0,length-1);
    const a=clamp(raw.fromCell??raw.from??raw.start??0,0,max);
    const b=clamp(raw.toCell??raw.to??raw.end??a,0,max);
    return{fromCell:Math.min(a,b),toCell:Math.max(a,b)};
  }

  function normalizeSocket(raw={},i=0,zone={cols:CHUNK_SIZE*DEFAULT_ZONE_CHUNKS,rows:CHUNK_SIZE*DEFAULT_ZONE_CHUNKS}){
    const edge=EDGES.includes(String(raw.edge||'').toLowerCase())?String(raw.edge).toLowerCase():'north';
    const type=SOCKET_TYPES.includes(String(raw.type||'').toLowerCase())?String(raw.type).toLowerCase():'transition';
    const length=axisLength(zone,edge);
    return{
      schemaVersion:SCHEMA_VERSION,
      id:clean(raw.id)||`socket_${edge}_${type}_${i}`,
      edge,
      type,
      span:normalizeSpan(raw.span||raw,length),
      semanticId:clean(raw.semanticId)||null,
      buildingId:clean(raw.buildingId)||null,
      continuationRequired:raw.continuationRequired!==false,
      tags:[...new Set((Array.isArray(raw.tags)?raw.tags:[]).map(x=>slug(x,'')).filter(Boolean))],
      metadata:clone(raw.metadata||{}),
    };
  }

  function normalizeZone(raw={}){
    const chunkCols=clamp(raw.chunkCols??raw.chunks?.cols??DEFAULT_ZONE_CHUNKS,1,MAX_ZONE_CHUNKS);
    const chunkRows=clamp(raw.chunkRows??raw.chunks?.rows??DEFAULT_ZONE_CHUNKS,1,MAX_ZONE_CHUNKS);
    const zone={
      schemaVersion:SCHEMA_VERSION,
      id:slug(raw.id||raw.zoneId||'zone_0_0','zone_0_0'),
      districtId:clean(raw.districtId)||null,
      coord:{x:Math.trunc(finite(raw.coord?.x??raw.x,0)),y:Math.trunc(finite(raw.coord?.y??raw.y,0))},
      chunkSize:CHUNK_SIZE,
      chunkCols,
      chunkRows,
      cols:chunkCols*CHUNK_SIZE,
      rows:chunkRows*CHUNK_SIZE,
      zBase:Math.trunc(finite(raw.zBase,0)),
      profileId:slug(raw.profileId||'mixed_urban','mixed_urban'),
      seed:clean(raw.seed)||null,
      sockets:[],
      metadata:clone(raw.metadata||{}),
    };
    zone.sockets=(Array.isArray(raw.sockets)?raw.sockets:[]).map((s,i)=>normalizeSocket(s,i,zone));
    return zone;
  }

  function createZone(options={}){return normalizeZone(options);}

  function chunkForCell(zoneInput={},col=0,row=0){
    const zone=normalizeZone(zoneInput),c=Math.trunc(finite(col,-1)),r=Math.trunc(finite(row,-1));
    if(c<0||r<0||c>=zone.cols||r>=zone.rows)return null;
    const chunkCol=Math.floor(c/CHUNK_SIZE),chunkRow=Math.floor(r/CHUNK_SIZE);
    return{
      id:`${zone.id}:chunk:${chunkCol}:${chunkRow}`,
      chunkCol,chunkRow,
      localCol:c-(chunkCol*CHUNK_SIZE),
      localRow:r-(chunkRow*CHUNK_SIZE),
      minCol:chunkCol*CHUNK_SIZE,
      minRow:chunkRow*CHUNK_SIZE,
      maxColExclusive:(chunkCol+1)*CHUNK_SIZE,
      maxRowExclusive:(chunkRow+1)*CHUNK_SIZE,
    };
  }

  function chunksForRect(zoneInput={},rect={}){
    const zone=normalizeZone(zoneInput);
    const minCol=clamp(rect.minCol,0,zone.cols-1),maxCol=clamp(rect.maxCol??rect.maxColExclusive-1,0,zone.cols-1);
    const minRow=clamp(rect.minRow,0,zone.rows-1),maxRow=clamp(rect.maxRow??rect.maxRowExclusive-1,0,zone.rows-1);
    const out=[];
    for(let cr=Math.floor(minRow/CHUNK_SIZE);cr<=Math.floor(maxRow/CHUNK_SIZE);cr++){
      for(let cc=Math.floor(minCol/CHUNK_SIZE);cc<=Math.floor(maxCol/CHUNK_SIZE);cc++)out.push(`${zone.id}:chunk:${cc}:${cr}`);
    }
    return out;
  }

  function internalChunkBoundaries(zoneInput={}){
    const zone=normalizeZone(zoneInput),vertical=[],horizontal=[];
    for(let i=1;i<zone.chunkCols;i++)vertical.push(i*CHUNK_SIZE);
    for(let i=1;i<zone.chunkRows;i++)horizontal.push(i*CHUNK_SIZE);
    return{vertical,horizontal};
  }

  function socketAnchor(zoneInput={},socketInput={}){
    const zone=normalizeZone(zoneInput),socket=normalizeSocket(socketInput,0,zone),mid=Math.floor((socket.span.fromCell+socket.span.toCell)/2);
    if(socket.edge==='north')return{col:mid,row:0};
    if(socket.edge==='south')return{col:mid,row:zone.rows-1};
    if(socket.edge==='west')return{col:0,row:mid};
    return{col:zone.cols-1,row:mid};
  }

  function projectedSocket(zoneInput={},socketInput={}){
    const zone=normalizeZone(zoneInput),socket=normalizeSocket(socketInput,0,zone);
    return normalizeSocket({
      ...socket,
      id:`${socket.id}:continuation`,
      edge:oppositeEdge(socket.edge),
      metadata:{...socket.metadata,projectedFromZone:zone.id,projectedFromSocket:socket.id},
    },0,zone);
  }

  function socketsCompatible(aInput={},bInput={},zoneAInput={},zoneBInput={}){
    const zoneA=normalizeZone(zoneAInput),zoneB=normalizeZone(zoneBInput),a=normalizeSocket(aInput,0,zoneA),b=normalizeSocket(bInput,0,zoneB);
    if(oppositeEdge(a.edge)!==b.edge||a.type!==b.type)return false;
    if(a.span.fromCell!==b.span.fromCell||a.span.toCell!==b.span.toCell)return false;
    if(a.type==='building'&&a.buildingId&&b.buildingId&&a.buildingId!==b.buildingId)return false;
    if(a.semanticId&&b.semanticId&&a.semanticId!==b.semanticId)return false;
    return true;
  }

  function continuationRequirements(zoneInput={}){
    const zone=normalizeZone(zoneInput);
    return zone.sockets.filter(s=>s.continuationRequired).map(s=>projectedSocket(zone,s));
  }

  function validateZone(zoneInput={}){
    const zone=normalizeZone(zoneInput),errors=[],warnings=[];
    if(zone.chunkSize!==CHUNK_SIZE)errors.push({code:'ZONE_CHUNK_SIZE_INVALID',expected:CHUNK_SIZE,actual:zone.chunkSize});
    if(zone.chunkCols>MAX_ZONE_CHUNKS||zone.chunkRows>MAX_ZONE_CHUNKS)errors.push({code:'ZONE_CHUNK_LIMIT_EXCEEDED'});
    const ids=new Set();
    for(const s of zone.sockets){
      if(ids.has(s.id))errors.push({code:'ZONE_SOCKET_DUPLICATE_ID',socketId:s.id});
      ids.add(s.id);
      const len=axisLength(zone,s.edge);
      if(s.span.fromCell<0||s.span.toCell>=len)errors.push({code:'ZONE_SOCKET_OUT_OF_BOUNDS',socketId:s.id});
      if(s.type==='building'&&s.continuationRequired&&!s.buildingId)errors.push({code:'ZONE_BUILDING_SOCKET_REQUIRES_BUILDING_ID',socketId:s.id});
      if(['street','alley','service_route'].includes(s.type)&&s.continuationRequired&&!s.semanticId)warnings.push({code:'ZONE_CONTINUATION_WITHOUT_SEMANTIC_ID',socketId:s.id});
    }
    return{valid:errors.length===0,errors,warnings,zone,summary:{cols:zone.cols,rows:zone.rows,chunks:zone.chunkCols*zone.chunkRows,sockets:zone.sockets.length}};
  }

  return Object.freeze({
    SCHEMA_VERSION,CHUNK_SIZE,MAX_ZONE_CHUNKS,DEFAULT_ZONE_CHUNKS,EDGES,SOCKET_TYPES,
    oppositeEdge,normalizeSpan,normalizeSocket,normalizeZone,createZone,chunkForCell,chunksForRect,
    internalChunkBoundaries,socketAnchor,projectedSocket,socketsCompatible,continuationRequirements,validateZone,
  });
});
