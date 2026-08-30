(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttWorldStreaming=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const CHUNK_SIZE_CELLS=40;
  const STATES=Object.freeze({ACTIVE:'ACTIVE',WARM:'WARM',DORMANT:'DORMANT'});
  const DEFAULTS=Object.freeze({warmTtlMs:30000,maxWarmChunks:16,maxActiveChunks:8,cellSize:70,chunkSizeCells:CHUNK_SIZE_CELLS});
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const integer=(v,f=0)=>Math.trunc(finite(v,f));
  const clean=(v,f='')=>String(v??f).trim()||f;
  const positive=(v,f)=>Math.max(1,integer(v,f));
  const mod=(value,size)=>((value%size)+size)%size;

  function normalizeWorldPosition(raw={},options={}){
    const chunkSizeCells=positive(options.chunkSizeCells??raw.chunkSizeCells,CHUNK_SIZE_CELLS);
    const cellSize=Math.max(1,finite(options.cellSize??raw.cellSize,DEFAULTS.cellSize));
    let chunkCol=integer(raw.chunkCol??raw.chunk?.col,0),chunkRow=integer(raw.chunkRow??raw.chunk?.row,0);
    let x=finite(raw.x??raw.localX,0),y=finite(raw.y??raw.localY,0);
    const chunkPx=chunkSizeCells*cellSize;
    if(Number.isFinite(x)){
      const shift=Math.floor(x/chunkPx);chunkCol+=shift;x=mod(x,chunkPx);
    }else x=0;
    if(Number.isFinite(y)){
      const shift=Math.floor(y/chunkPx);chunkRow+=shift;y=mod(y,chunkPx);
    }else y=0;
    const cellCol=Math.max(0,Math.min(chunkSizeCells-1,Math.floor(x/cellSize)));
    const cellRow=Math.max(0,Math.min(chunkSizeCells-1,Math.floor(y/cellSize)));
    return Object.freeze({
      schemaVersion:SCHEMA_VERSION,
      worldId:clean(raw.worldId,'luminous'),regionId:clean(raw.regionId,'region'),zoneId:clean(raw.zoneId,'zone'),
      chunkCol,chunkRow,x,y,cellCol,cellRow,zLayer:integer(raw.zLayer??raw.z??raw.gridPosition?.z,0),
      elevationFt:finite(raw.elevationFt,0),chunkSizeCells,cellSize,
    });
  }

  function worldChunkKey(raw={},options={}){
    const p=normalizeWorldPosition(raw,options);
    return `${p.worldId}/${p.regionId}/${p.zoneId}/${p.chunkCol},${p.chunkRow}`;
  }

  function worldCell(raw={},options={}){
    const p=normalizeWorldPosition(raw,options);
    return Object.freeze({col:p.chunkCol*p.chunkSizeCells+p.cellCol,row:p.chunkRow*p.chunkSizeCells+p.cellRow,z:p.zLayer});
  }

  function deriveWorldChunkSeed(seed,raw={},options={}){
    return `${clean(seed,'luminous-world')}:world-chunk:${worldChunkKey(raw,options)}`;
  }

  function createDormantRecord({position={},seed='',delta=null,revision=0,updatedAt=Date.now()}={}){
    const p=normalizeWorldPosition(position);
    return Object.freeze({schemaVersion:SCHEMA_VERSION,state:STATES.DORMANT,key:worldChunkKey(p),position:{worldId:p.worldId,regionId:p.regionId,zoneId:p.zoneId,chunkCol:p.chunkCol,chunkRow:p.chunkRow},seed:clean(seed)||deriveWorldChunkSeed('luminous-world',p),delta:clone(delta),revision:Math.max(0,integer(revision,0)),updatedAt:Math.max(0,finite(updatedAt,0))});
  }

  function createLifecycleManager(options={}){
    const config=Object.freeze({
      warmTtlMs:Math.max(0,finite(options.warmTtlMs,DEFAULTS.warmTtlMs)),
      maxWarmChunks:Math.max(0,integer(options.maxWarmChunks,DEFAULTS.maxWarmChunks)),
      maxActiveChunks:positive(options.maxActiveChunks,DEFAULTS.maxActiveChunks),
      cellSize:Math.max(1,finite(options.cellSize,DEFAULTS.cellSize)),
      chunkSizeCells:positive(options.chunkSizeCells,DEFAULTS.chunkSizeCells),
    });
    const chunks=new Map(),actors=new Map();
    let dormantCount=0,peakResidentChunks=0,peakActiveChunks=0,serial=0;
    const nowValue=raw=>Math.max(0,finite(raw,Date.now()));
    const normalize=p=>normalizeWorldPosition(p,config);

    function residentEntry(position,now){
      const p=normalize(position),key=worldChunkKey(p,config);
      let entry=chunks.get(key);
      if(!entry){entry={key,state:STATES.WARM,position:p,actors:new Set(),lastTouched:now,warmUntil:now+config.warmTtlMs,serial:++serial};chunks.set(key,entry);}
      return entry;
    }
    function transitionDormant(entry,events,reason){
      if(!entry||entry.state===STATES.DORMANT)return;
      chunks.delete(entry.key);dormantCount+=1;
      events.dormant.push({key:entry.key,state:STATES.DORMANT,position:entry.position,lastTouched:entry.lastTouched,reason});
    }
    function capWarm(events){
      const warm=[...chunks.values()].filter(x=>x.state===STATES.WARM).sort((a,b)=>a.lastTouched-b.lastTouched||a.serial-b.serial);
      while(warm.length>config.maxWarmChunks)transitionDormant(warm.shift(),events,'warm-capacity');
    }
    function expireWarm(now,events){
      for(const entry of [...chunks.values()])if(entry.state===STATES.WARM&&entry.warmUntil<=now)transitionDormant(entry,events,'warm-ttl');
      capWarm(events);
    }
    function snapshot(){
      let active=0,warm=0,actorRefs=0;
      for(const entry of chunks.values()){
        if(entry.state===STATES.ACTIVE)active+=1;else if(entry.state===STATES.WARM)warm+=1;
        actorRefs+=entry.actors.size;
      }
      peakResidentChunks=Math.max(peakResidentChunks,chunks.size);peakActiveChunks=Math.max(peakActiveChunks,active);
      return Object.freeze({schemaVersion:SCHEMA_VERSION,activeChunks:active,warmChunks:warm,residentChunks:chunks.size,dormantTransitions:dormantCount,actorRefs,uniqueActors:actors.size,overActiveBudget:Math.max(0,active-config.maxActiveChunks),liveCells:active*config.chunkSizeCells*config.chunkSizeCells,peakActiveChunks,peakResidentChunks,maxResidentBudget:config.maxActiveChunks+config.maxWarmChunks});
    }
    function reconcile(rawActors=[],rawNow=Date.now()){
      const now=nowValue(rawNow),events={activated:[],warmed:[],dormant:[],moved:[],released:[]};
      const desired=new Map();
      for(const raw of Array.isArray(rawActors)?rawActors:[]){
        const id=clean(raw?.id??raw?.actorId);if(!id)continue;
        const position=normalize(raw.position||raw.worldPosition||raw),key=worldChunkKey(position,config);
        desired.set(id,{id,key,position});
      }
      for(const [id,current] of [...actors]){
        if(desired.has(id))continue;
        const entry=chunks.get(current.key);if(entry){entry.actors.delete(id);entry.lastTouched=now;if(entry.actors.size===0&&entry.state===STATES.ACTIVE){entry.state=STATES.WARM;entry.warmUntil=now+config.warmTtlMs;events.warmed.push({key:entry.key,position:entry.position});}}
        actors.delete(id);events.released.push({actorId:id,key:current.key});
      }
      for(const next of desired.values()){
        const previous=actors.get(next.id);
        if(previous&&previous.key!==next.key){
          const from=chunks.get(previous.key);if(from){from.actors.delete(next.id);from.lastTouched=now;if(from.actors.size===0&&from.state===STATES.ACTIVE){from.state=STATES.WARM;from.warmUntil=now+config.warmTtlMs;events.warmed.push({key:from.key,position:from.position});}}
          events.moved.push({actorId:next.id,from:previous.key,to:next.key});
        }
        const entry=residentEntry(next.position,now),wasActive=entry.state===STATES.ACTIVE;
        entry.state=STATES.ACTIVE;entry.position=next.position;entry.lastTouched=now;entry.warmUntil=0;entry.actors.add(next.id);
        actors.set(next.id,{key:next.key,position:next.position});
        if(!wasActive)events.activated.push({key:entry.key,position:entry.position});
      }
      expireWarm(now,events);const metrics=snapshot();
      return Object.freeze({...events,metrics});
    }
    function tick(rawNow=Date.now()){const events={activated:[],warmed:[],dormant:[],moved:[],released:[]};expireWarm(nowValue(rawNow),events);return Object.freeze({...events,metrics:snapshot()});}
    function actorPosition(id){return actors.get(clean(id))?.position||null;}
    function chunkState(position){const entry=chunks.get(worldChunkKey(position,config));return entry?.state||STATES.DORMANT;}
    function entries(){return [...chunks.values()].map(entry=>Object.freeze({key:entry.key,state:entry.state,position:entry.position,actorIds:[...entry.actors],lastTouched:entry.lastTouched,warmUntil:entry.warmUntil}));}
    return Object.freeze({config,reconcile,tick,snapshot,actorPosition,chunkState,entries});
  }

  return Object.freeze({SCHEMA_VERSION,CHUNK_SIZE_CELLS,STATES,DEFAULTS,normalizeWorldPosition,worldChunkKey,worldCell,deriveWorldChunkSeed,createDormantRecord,createLifecycleManager});
});
