(function(root,factory){
  'use strict';
  const Streaming=typeof module!=='undefined'&&module.exports?require('./world-streaming-core.js'):root?.LuminousVttWorldStreaming;
  const api=factory(Streaming);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttMapSimulation=api;
})(typeof window!=='undefined'?window:globalThis,function(Streaming){
  'use strict';

  if(!Streaming)throw new Error('WORLD_STREAMING_CORE_REQUIRED');

  const SCHEMA_VERSION=1;
  const STATES=Object.freeze({ACTIVE:'ACTIVE',WARM:'WARM',DORMANT:'DORMANT'});
  const OPS=Object.freeze({UPSERT:'upsert',ADD:'add',REMOVE:'remove'});
  const DEFAULTS=Object.freeze({warmTtlMs:60000,maxWarmZones:16,maxActiveZones:8,maxDeltaEntities:4096,maxTemporaryEntities:1024});
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const clean=(value,fallback='')=>String(value??fallback).trim()||fallback;
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const integer=(value,fallback=0)=>Math.trunc(finite(value,fallback));
  const safeKey=(value,fallback='key')=>clean(value,fallback).replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_').slice(0,160)||fallback;
  const nowValue=(value,fallback=Date.now())=>Math.max(0,finite(value,fallback));

  function zoneIdentity(raw={}){
    if(typeof raw==='string'){
      const parts=raw.split('/');
      if(parts.length>=3)return Object.freeze({worldId:clean(parts[0],'luminous'),regionId:clean(parts[1],'region'),zoneId:clean(parts.slice(2).join('/'),'zone')});
    }
    const source=raw?.position||raw?.worldPosition||raw||{};
    const position=Streaming.normalizeWorldPosition(source,{cellSize:source.cellSize||70,chunkSizeCells:source.chunkSizeCells||40});
    return Object.freeze({worldId:clean(position.worldId,'luminous'),regionId:clean(position.regionId,'region'),zoneId:clean(position.zoneId,'zone')});
  }

  function zoneKey(raw={}){
    const id=zoneIdentity(raw);
    return `${id.worldId}/${id.regionId}/${id.zoneId}`;
  }

  function storageKey(raw={}){
    const id=zoneIdentity(raw);
    return `${safeKey(id.worldId,'luminous')}__${safeKey(id.regionId,'region')}__${safeKey(id.zoneId,'zone')}`;
  }

  function defaultSeed(raw={}){
    const id=zoneIdentity(raw);
    return `${id.worldId}:zone:${id.regionId}:${id.zoneId}`;
  }

  function createSimulationBubbleManager(options={}){
    const config=Object.freeze({
      warmTtlMs:Math.max(0,finite(options.warmTtlMs,DEFAULTS.warmTtlMs)),
      maxWarmZones:Math.max(0,integer(options.maxWarmZones,DEFAULTS.maxWarmZones)),
      maxActiveZones:Math.max(1,integer(options.maxActiveZones,DEFAULTS.maxActiveZones)),
    });
    const zones=new Map(),actors=new Map(),flags=new Map();
    let dormantTransitions=0,peakResidentZones=0,peakActiveZones=0,serial=0;

    function flagRecord(key){return flags.get(key)||{persistent:false,pinned:false};}
    function ensure(raw,now){
      const identity=zoneIdentity(raw),key=zoneKey(identity);
      let entry=zones.get(key);
      if(!entry){
        const zoneFlags=flagRecord(key);
        entry={key,identity,state:STATES.WARM,actorIds:new Set(),lastTouched:now,warmUntil:now+config.warmTtlMs,serial:++serial,persistent:Boolean(zoneFlags.persistent),pinned:Boolean(zoneFlags.pinned)};
        zones.set(key,entry);
      }
      return entry;
    }
    function toWarm(entry,now,events,reason='released'){
      if(!entry||entry.actorIds.size>0||entry.state!==STATES.ACTIVE)return;
      entry.state=STATES.WARM;entry.lastTouched=now;entry.warmUntil=now+config.warmTtlMs;
      events.warmed.push({key:entry.key,identity:entry.identity,state:STATES.WARM,reason,persistent:entry.persistent,pinned:entry.pinned});
    }
    function toDormant(entry,events,reason){
      if(!entry||entry.state===STATES.DORMANT)return;
      zones.delete(entry.key);dormantTransitions+=1;
      events.dormant.push({key:entry.key,identity:entry.identity,state:STATES.DORMANT,lastTouched:entry.lastTouched,reason,persistent:entry.persistent,pinned:entry.pinned});
    }
    function expireWarm(now,events){
      for(const entry of [...zones.values()])if(entry.state===STATES.WARM&&entry.warmUntil<=now)toDormant(entry,events,'warm-ttl');
      const warm=[...zones.values()].filter(entry=>entry.state===STATES.WARM).sort((a,b)=>a.lastTouched-b.lastTouched||a.serial-b.serial);
      while(warm.length>config.maxWarmZones)toDormant(warm.shift(),events,'warm-capacity');
    }
    function metrics(){
      let activeZones=0,warmZones=0,actorRefs=0,pinnedZones=0,persistentZones=0;
      for(const entry of zones.values()){
        if(entry.state===STATES.ACTIVE)activeZones+=1;else if(entry.state===STATES.WARM)warmZones+=1;
        actorRefs+=entry.actorIds.size;if(entry.pinned)pinnedZones+=1;if(entry.persistent)persistentZones+=1;
      }
      peakResidentZones=Math.max(peakResidentZones,zones.size);peakActiveZones=Math.max(peakActiveZones,activeZones);
      return Object.freeze({schemaVersion:SCHEMA_VERSION,activeZones,warmZones,residentZones:zones.size,dormantTransitions,actorRefs,uniqueActors:actors.size,pinnedZones,persistentZones,peakActiveZones,peakResidentZones,overActiveBudget:Math.max(0,activeZones-config.maxActiveZones),maxResidentBudget:config.maxActiveZones+config.maxWarmZones});
    }
    function reconcile(rawActors=[],rawNow=Date.now()){
      const now=nowValue(rawNow),events={activated:[],warmed:[],dormant:[],moved:[],released:[]},desired=new Map();
      for(const raw of Array.isArray(rawActors)?rawActors:[]){
        const actorId=clean(raw?.id??raw?.actorId);if(!actorId)continue;
        const identity=zoneIdentity(raw?.position||raw?.worldPosition||raw),key=zoneKey(identity);
        desired.set(actorId,{actorId,key,identity});
      }
      for(const [actorId,current] of [...actors]){
        if(desired.has(actorId))continue;
        const entry=zones.get(current.key);if(entry){entry.actorIds.delete(actorId);toWarm(entry,now,events,'actor-released');}
        actors.delete(actorId);events.released.push({actorId,key:current.key});
      }
      for(const next of desired.values()){
        const previous=actors.get(next.actorId);
        if(previous&&previous.key!==next.key){
          const from=zones.get(previous.key);if(from){from.actorIds.delete(next.actorId);toWarm(from,now,events,'actor-moved');}
          events.moved.push({actorId:next.actorId,from:previous.key,to:next.key});
        }
        const entry=ensure(next.identity,now),wasActive=entry.state===STATES.ACTIVE;
        const zoneFlags=flagRecord(next.key);entry.persistent=Boolean(zoneFlags.persistent);entry.pinned=Boolean(zoneFlags.pinned);
        entry.state=STATES.ACTIVE;entry.actorIds.add(next.actorId);entry.lastTouched=now;entry.warmUntil=0;
        actors.set(next.actorId,{key:next.key,identity:next.identity});
        if(!wasActive)events.activated.push({key:entry.key,identity:entry.identity,state:STATES.ACTIVE,persistent:entry.persistent,pinned:entry.pinned});
      }
      expireWarm(now,events);
      return Object.freeze({...events,metrics:metrics()});
    }
    function tick(rawNow=Date.now()){
      const events={activated:[],warmed:[],dormant:[],moved:[],released:[]};expireWarm(nowValue(rawNow),events);return Object.freeze({...events,metrics:metrics()});
    }
    function setFlags(raw,patch={}){
      const identity=zoneIdentity(raw),key=zoneKey(identity),previous=flagRecord(key),next={persistent:patch.persistent==null?Boolean(previous.persistent):Boolean(patch.persistent),pinned:patch.pinned==null?Boolean(previous.pinned):Boolean(patch.pinned)};
      flags.set(key,next);const entry=zones.get(key);if(entry){entry.persistent=next.persistent;entry.pinned=next.pinned;}return Object.freeze({key,identity,...next});
    }
    function stateOf(raw){return zones.get(zoneKey(raw))?.state||STATES.DORMANT;}
    function entryOf(raw){const entry=zones.get(zoneKey(raw));return entry?Object.freeze({key:entry.key,identity:entry.identity,state:entry.state,actorIds:[...entry.actorIds],lastTouched:entry.lastTouched,warmUntil:entry.warmUntil,persistent:entry.persistent,pinned:entry.pinned}):null;}
    function entries(){return [...zones.values()].map(entry=>Object.freeze({key:entry.key,identity:entry.identity,state:entry.state,actorIds:[...entry.actorIds],lastTouched:entry.lastTouched,warmUntil:entry.warmUntil,persistent:entry.persistent,pinned:entry.pinned}));}
    return Object.freeze({config,reconcile,tick,setFlags,stateOf,entryOf,entries,snapshot:metrics});
  }

  function normalizeEntityId(raw){return safeKey(raw,'entity');}
  function normalizeOperation(raw){const op=clean(raw,OPS.UPSERT).toLowerCase();return op===OPS.REMOVE?OPS.REMOVE:op===OPS.ADD?OPS.ADD:OPS.UPSERT;}

  function createDeltaStore(options={}){
    const maxDeltaEntities=Math.max(1,integer(options.maxDeltaEntities,DEFAULTS.maxDeltaEntities));
    const maxTemporaryEntities=Math.max(1,integer(options.maxTemporaryEntities,DEFAULTS.maxTemporaryEntities));
    const records=new Map();

    function ensure(raw,meta={}){
      const identity=zoneIdentity(raw),key=zoneKey(identity);
      let record=records.get(key);
      if(!record){
        record={schemaVersion:SCHEMA_VERSION,key,identity,seed:clean(meta.seed,defaultSeed(identity)),generatorVersion:clean(meta.generatorVersion,'worldgen_1'),revision:0,updatedAt:0,lastSimulatedAt:0,persistent:Boolean(meta.persistent),pinned:Boolean(meta.pinned),entities:{},temporary:{},dirty:false};records.set(key,record);
      }else{
        if(meta.seed)record.seed=clean(meta.seed,record.seed);if(meta.generatorVersion)record.generatorVersion=clean(meta.generatorVersion,record.generatorVersion);
        if(meta.persistent!=null)record.persistent=Boolean(meta.persistent);if(meta.pinned!=null)record.pinned=Boolean(meta.pinned);
      }
      return record;
    }
    function bump(record,updatedAt){record.revision+=1;record.updatedAt=Math.max(record.updatedAt,nowValue(updatedAt));record.dirty=true;return record;}
    function entityCount(record){return Object.keys(record.entities||{}).length;}
    function temporaryCount(record){return Object.keys(record.temporary||{}).length;}
    function snapshotRecord(record){return Object.freeze({schemaVersion:SCHEMA_VERSION,state:STATES.DORMANT,key:record.key,identity:clone(record.identity),seed:record.seed,generatorVersion:record.generatorVersion,revision:record.revision,updatedAt:record.updatedAt,lastSimulatedAt:record.lastSimulatedAt,persistent:Boolean(record.persistent),pinned:Boolean(record.pinned),entities:clone(record.entities),temporary:clone(record.temporary)});}
    function recordEntityChange(raw,input={}){
      const record=ensure(raw,input),entityId=normalizeEntityId(input.entityId||input.id),operation=normalizeOperation(input.operation||input.op),updatedAt=nowValue(input.updatedAt);
      const existing=record.entities[entityId]||null;
      if(!existing&&entityCount(record)>=maxDeltaEntities)throw new Error('MAP_DELTA_ENTITY_CAP_EXCEEDED');
      if(operation===OPS.REMOVE){record.entities[entityId]={entityId,kind:clean(input.kind,'entity'),operation:OPS.REMOVE,updatedAt};}
      else{
        const patch=clone(input.patch??input.value??{});const mergedPatch=existing&&existing.operation!==OPS.REMOVE&&existing.patch&&typeof existing.patch==='object'&&patch&&typeof patch==='object'?{...clone(existing.patch),...patch}:patch;
        record.entities[entityId]={entityId,kind:clean(input.kind||existing?.kind,'entity'),operation:existing?.operation===OPS.ADD?OPS.ADD:operation,patch:mergedPatch,updatedAt};
      }
      if(input.persistent!==false)record.persistent=true;bump(record,updatedAt);return clone(record.entities[entityId]);
    }
    function recordTemporary(raw,input={}){
      const record=ensure(raw,input),temporaryId=normalizeEntityId(input.temporaryId||input.entityId||input.id),createdAt=nowValue(input.createdAt),expiresAt=Math.max(createdAt,nowValue(input.expiresAt,createdAt));
      if(!record.temporary[temporaryId]&&temporaryCount(record)>=maxTemporaryEntities)throw new Error('MAP_TEMPORARY_ENTITY_CAP_EXCEEDED');
      record.temporary[temporaryId]={temporaryId,kind:clean(input.kind,'temporary'),payload:clone(input.payload??input.patch??{}),createdAt,expiresAt};bump(record,createdAt);return clone(record.temporary[temporaryId]);
    }
    function pruneExpired(raw,worldNow=Date.now()){
      const record=records.get(zoneKey(raw));if(!record)return 0;const now=nowValue(worldNow);let removed=0;
      for(const [id,temp] of Object.entries(record.temporary||{}))if(finite(temp.expiresAt,0)<=now){delete record.temporary[id];removed+=1;}
      if(removed)bump(record,now);return removed;
    }
    function markZone(raw,meta={}){
      const record=ensure(raw,meta);let changed=false;
      for(const key of ['seed','generatorVersion'])if(meta[key]&&clean(meta[key])!==record[key]){record[key]=clean(meta[key]);changed=true;}
      for(const key of ['persistent','pinned'])if(meta[key]!=null&&Boolean(meta[key])!==record[key]){record[key]=Boolean(meta[key]);changed=true;}
      if(changed)bump(record,meta.updatedAt);return compactRecord(record.identity,meta.worldNow);
    }
    function compactRecord(raw,worldNow=Date.now()){
      const key=zoneKey(raw),record=records.get(key);if(!record)return null;pruneExpired(record.identity,worldNow);return snapshotRecord(record);
    }
    function importRecord(raw={}){
      const identity=zoneIdentity(raw.identity||raw),record=ensure(identity,{seed:raw.seed,generatorVersion:raw.generatorVersion,persistent:raw.persistent,pinned:raw.pinned});
      record.revision=Math.max(0,integer(raw.revision,0));record.updatedAt=nowValue(raw.updatedAt,0);record.lastSimulatedAt=nowValue(raw.lastSimulatedAt,0);record.entities=clone(raw.entities||{});record.temporary=clone(raw.temporary||{});record.dirty=false;return snapshotRecord(record);
    }
    function touchSimulated(raw,worldNow=Date.now()){
      const record=ensure(raw),next=nowValue(worldNow);if(next>record.lastSimulatedAt){record.lastSimulatedAt=next;bump(record,next);}return record.lastSimulatedAt;
    }
    function hasMeaningfulState(raw){const record=records.get(zoneKey(raw));return Boolean(record&&(record.persistent||record.pinned||entityCount(record)>0||temporaryCount(record)>0));}
    function isDirty(raw){return Boolean(records.get(zoneKey(raw))?.dirty);}
    function clearDirty(raw){const record=records.get(zoneKey(raw));if(record)record.dirty=false;}
    function get(raw,worldNow=Date.now()){return compactRecord(raw,worldNow);}
    function keys(){return [...records.keys()];}
    function dirtyKeys(){return [...records.values()].filter(record=>record.dirty).map(record=>record.key);}
    function metrics(){let deltaEntities=0,temporaryEntities=0,dirtyZones=0,pinnedZones=0,persistentZones=0;for(const record of records.values()){deltaEntities+=entityCount(record);temporaryEntities+=temporaryCount(record);if(record.dirty)dirtyZones+=1;if(record.pinned)pinnedZones+=1;if(record.persistent)persistentZones+=1;}return Object.freeze({schemaVersion:SCHEMA_VERSION,records:records.size,deltaEntities,temporaryEntities,dirtyZones,pinnedZones,persistentZones,maxDeltaEntities,maxTemporaryEntities});}

    return Object.freeze({ensure,recordEntityChange,recordTemporary,pruneExpired,markZone,compactRecord,importRecord,touchSimulated,hasMeaningfulState,isDirty,clearDirty,get,keys,dirtyKeys,metrics});
  }

  function stableEntityId(entity,index=0){return safeKey(entity?.entityId||entity?.instanceId||entity?.id||`entity_${index}`);}
  function applyEntityDeltas(baseEntities=[],record={},options={}){
    const kind=clean(options.kind),map=new Map();
    for(const [index,entity] of (Array.isArray(baseEntities)?baseEntities:[]).entries())map.set(stableEntityId(entity,index),clone(entity));
    const deltas=record?.entities&&typeof record.entities==='object'?record.entities:{};
    for(const [rawId,delta] of Object.entries(deltas)){
      if(!delta||typeof delta!=='object'||(kind&&clean(delta.kind)!==kind))continue;
      const id=normalizeEntityId(delta.entityId||rawId),operation=normalizeOperation(delta.operation);
      if(operation===OPS.REMOVE){map.delete(id);continue;}
      const patch=clone(delta.patch||{}),previous=map.get(id)||{};
      map.set(id,{...previous,...patch});
    }
    return [...map.values()];
  }

  function dormantRecordFromStore(store,raw,worldNow=Date.now()){
    const record=store?.compactRecord?.(raw,worldNow);if(!record)return null;
    return Object.freeze({...record,state:STATES.DORMANT});
  }

  return Object.freeze({SCHEMA_VERSION,STATES,OPS,DEFAULTS,zoneIdentity,zoneKey,storageKey,defaultSeed,createSimulationBubbleManager,createDeltaStore,applyEntityDeltas,dormantRecordFromStore});
});
