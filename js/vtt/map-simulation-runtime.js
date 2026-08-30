import './map-simulation-core.js';
import { start as startWorldStreaming } from './world-streaming-runtime.js';

const DM_UID='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
const PERSIST_ROOT='campaña/estado_mundo/mapSimulationZones';
const clean=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

function hostWindow(){try{if(window.parent&&window.parent!==window&&window.parent.document)return window.parent;}catch(_){}return window;}
function hostFirebase(){const host=hostWindow();return host?.firebase||window.firebase||null;}
function currentUid(firebase){try{return clean(firebase?.auth?.().currentUser?.uid);}catch(_){return '';}}
function parseWorldTime(value){if(typeof value==='number'&&Number.isFinite(value))return value;const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:null;}

export function start({runtime=globalThis.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(globalThis.LuminousVttMapSimulationRuntime?.api)return globalThis.LuminousVttMapSimulationRuntime.api;

  const worldStreaming=startWorldStreaming({runtime,mapData});
  const liveRuntime=globalThis.LuminousVttRuntime||runtime;
  const Core=globalThis.LuminousVttMapSimulation;
  if(!Core||!worldStreaming)throw new Error('MAP_SIMULATION_DEPENDENCY_REQUIRED');

  const firebase=hostFirebase(),db=firebase?.database?.()||null;
  const isDm=Boolean(liveRuntime.bridge?.isDm)||currentUid(firebase)===DM_UID;
  const manager=Core.createSimulationBubbleManager({maxActiveZones:8,maxWarmZones:16,warmTtlMs:60000});
  const store=Core.createDeltaStore({maxDeltaEntities:4096,maxTemporaryEntities:1024});
  const canvas=liveRuntime.engine.canvas;
  const loadedZones=new Set(),restoreInFlight=new Map(),flushInFlight=new Map();
  let stopped=false,lastLifecycle=null;

  function worldNowMs(){
    const scheduler=hostWindow()?.LuminousWorldTimeScheduler||globalThis.LuminousWorldTimeScheduler;
    const worldMs=parseWorldTime(scheduler?.getSnapshot?.()?.timestamp);
    return Number.isFinite(worldMs)?worldMs:Date.now();
  }
  function baseIdentity(){
    const stream=mapData.procedural?.streaming||{};
    return Core.zoneIdentity({worldId:mapData.worldId||mapData.world?.id||'luminous',regionId:mapData.regionId||mapData.region?.id||'region',zoneId:stream.zoneId||mapData.zoneId||mapData.id||mapData.mapId||'zone'});
  }
  function identityForToken(token){
    const position=token?.worldPosition||worldStreaming.positionForToken?.(token)||baseIdentity();
    return Core.zoneIdentity(position);
  }
  function currentIdentity(){
    const viewer=(mapData.tokens||[]).find(token=>token.viewer===true)||(mapData.tokens||[]).find(token=>token.characterLink?.mode==='current_player')||(mapData.tokens||[])[0];
    return viewer?identityForToken(viewer):baseIdentity();
  }
  function metadataFor(identity){
    const stream=mapData.procedural?.streaming||{};
    const isCurrent=clean(stream.zoneId)===identity.zoneId||(!stream.zoneId&&clean(mapData.zoneId||mapData.id||mapData.mapId)===identity.zoneId);
    return{
      seed:isCurrent&&stream.seed?clean(stream.seed):Core.defaultSeed(identity),
      generatorVersion:clean(mapData.procedural?.generatorVersion||mapData.procedural?.version||'worldgen_1'),
    };
  }
  function actorRecords(){
    return(mapData.tokens||[]).map(token=>{const id=clean(token?.id);if(!id)return null;const position=token.worldPosition||worldStreaming.positionForToken?.(token);return position?{id,position}:null;}).filter(Boolean);
  }
  function zoneRef(identity){return db?.ref(`${PERSIST_ROOT}/${Core.storageKey(identity)}`)||null;}
  function emit(name,detail){
    const EventCtor=globalThis.CustomEvent;if(typeof EventCtor!=='function')return;
    canvas?.dispatchEvent?.(new EventCtor(name,{detail:clone(detail)}));
    globalThis.dispatchEvent?.(new EventCtor(name,{detail:clone(detail)}));
  }
  function ensureRecord(identity,extra={}){
    const meta={...metadataFor(identity),...extra};store.ensure(identity,meta);manager.setFlags(identity,{persistent:extra.persistent,pinned:extra.pinned});return store.get(identity,worldNowMs());
  }
  function applyRestoredWorldObjects(identity,record){
    if(Core.zoneKey(identity)!==Core.zoneKey(currentIdentity()))return false;
    if(!record?.entities||!Object.values(record.entities).some(delta=>delta?.kind==='world_object'))return false;
    mapData.worldObjects=Core.applyEntityDeltas(mapData.worldObjects||[],record,{kind:'world_object'});
    liveRuntime.engine.renderer?.invalidate?.();
    emit('vtt:map-simulation-delta-applied',{identity,kind:'world_object',count:mapData.worldObjects.length,revision:record.revision});
    return true;
  }
  async function restoreZone(raw){
    const identity=Core.zoneIdentity(raw),key=Core.zoneKey(identity);
    if(loadedZones.has(key))return store.get(identity,worldNowMs());
    if(restoreInFlight.has(key))return restoreInFlight.get(key);
    const task=(async()=>{
      let record=null;
      if(db){
        try{const snapshot=await zoneRef(identity).once('value');const value=snapshot.val();if(value)record=store.importRecord(value);}
        catch(error){console.error('VTT MAP SIMULATION RESTORE FAILED:',error);}
      }
      if(!record)record=ensureRecord(identity);
      store.pruneExpired(identity,worldNowMs());record=store.get(identity,worldNowMs());
      manager.setFlags(identity,{persistent:record?.persistent,pinned:record?.pinned});
      loadedZones.add(key);applyRestoredWorldObjects(identity,record);
      emit('vtt:map-simulation-zone-restored',{identity,record});return record;
    })().finally(()=>restoreInFlight.delete(key));
    restoreInFlight.set(key,task);return task;
  }
  async function flushZone(raw,{reason='flush',force=false}={}){
    const identity=Core.zoneIdentity(raw),key=Core.zoneKey(identity);
    if(!isDm||!db)return store.get(identity,worldNowMs());
    if(!force&&!store.isDirty(identity))return store.get(identity,worldNowMs());
    if(!force&&!store.hasMeaningfulState(identity)){store.clearDirty(identity);return null;}
    if(flushInFlight.has(key))return flushInFlight.get(key);
    const task=(async()=>{
      store.touchSimulated(identity,worldNowMs());const record=store.get(identity,worldNowMs());
      if(!record)return null;
      await zoneRef(identity).set({...record,lastPersistReason:reason});store.clearDirty(identity);
      emit('vtt:map-simulation-zone-persisted',{identity,revision:record.revision,reason});return record;
    })().finally(()=>flushInFlight.delete(key));
    flushInFlight.set(key,task);return task;
  }
  async function persistEntityDelta(identity,entityId,reason='persistent-change'){
    if(!isDm||!db)return null;
    const record=store.get(identity,worldNowMs()),entry=record?.entities?.[entityId];if(!record||!entry)return null;
    const updates={schemaVersion:record.schemaVersion,state:record.state,identity:record.identity,seed:record.seed,generatorVersion:record.generatorVersion,revision:record.revision,updatedAt:record.updatedAt,lastSimulatedAt:worldNowMs(),persistent:record.persistent,pinned:record.pinned,lastPersistReason:reason};
    updates[`entities/${entityId}`]=entry;
    await zoneRef(identity).update(updates);return entry;
  }
  async function persistTemporary(identity,temporaryId,reason='temporary-change'){
    if(!isDm||!db)return null;
    const record=store.get(identity,worldNowMs()),entry=record?.temporary?.[temporaryId];if(!record||!entry)return null;
    const updates={schemaVersion:record.schemaVersion,state:record.state,identity:record.identity,seed:record.seed,generatorVersion:record.generatorVersion,revision:record.revision,updatedAt:record.updatedAt,lastSimulatedAt:worldNowMs(),persistent:record.persistent,pinned:record.pinned,lastPersistReason:reason};
    updates[`temporary/${temporaryId}`]=entry;
    await zoneRef(identity).update(updates);return entry;
  }
  function resolveIdentity(detail={}){return Core.zoneIdentity(detail.zoneIdentity||detail.worldPosition||detail.position||currentIdentity());}
  async function recordPersistentChange(detail={}){
    const identity=resolveIdentity(detail),meta=metadataFor(identity);
    const delta=store.recordEntityChange(identity,{...meta,entityId:detail.entityId||detail.id,kind:detail.kind||'entity',operation:detail.operation||detail.op||'upsert',patch:detail.patch??detail.value??{},updatedAt:detail.updatedAt||worldNowMs(),persistent:detail.persistent!==false});
    manager.setFlags(identity,{persistent:true});
    emit('vtt:map-simulation-delta-recorded',{identity,delta});
    try{await persistEntityDelta(identity,delta.entityId,detail.reason||detail.source||'persistent-change');}catch(error){console.error('VTT MAP SIMULATION DELTA PERSIST FAILED:',error);}
    return delta;
  }
  async function recordTemporary(detail={}){
    const identity=resolveIdentity(detail),meta=metadataFor(identity);
    const temporary=store.recordTemporary(identity,{...meta,temporaryId:detail.temporaryId||detail.entityId||detail.id,kind:detail.kind||'temporary',payload:detail.payload??detail.patch??{},createdAt:detail.createdAt||worldNowMs(),expiresAt:detail.expiresAt});
    emit('vtt:map-simulation-temporary-recorded',{identity,temporary});
    try{await persistTemporary(identity,temporary.temporaryId,detail.reason||detail.source||'temporary-change');}catch(error){console.error('VTT MAP SIMULATION TEMPORARY PERSIST FAILED:',error);}
    return temporary;
  }
  async function markZone(raw,flags={}){
    const identity=Core.zoneIdentity(raw),record=store.markZone(identity,{...metadataFor(identity),...flags,updatedAt:worldNowMs(),worldNow:worldNowMs()});manager.setFlags(identity,{persistent:record?.persistent,pinned:record?.pinned});
    await flushZone(identity,{reason:flags.reason||'zone-flags',force:true});return record;
  }
  function reconcile(rawActors=actorRecords(),now=worldNowMs()){
    worldStreaming.reconcile?.(now);
    const lifecycle=manager.reconcile(rawActors,now);lastLifecycle=lifecycle;
    for(const active of lifecycle.activated){ensureRecord(active.identity);void restoreZone(active.identity);}
    for(const dormant of lifecycle.dormant)if(store.hasMeaningfulState(dormant.identity)||store.isDirty(dormant.identity))void flushZone(dormant.identity,{reason:dormant.reason||'dormant'});
    mapData.mapSimulation={schemaVersion:Core.SCHEMA_VERSION,...lifecycle.metrics,persistence:store.metrics()};
    emit('vtt:map-simulation-lifecycle',{metrics:mapData.mapSimulation,activated:lifecycle.activated,warmed:lifecycle.warmed,dormant:lifecycle.dormant});return lifecycle;
  }
  function pruneTemporary(){
    const now=worldNowMs();let removed=0;for(const key of store.keys())removed+=store.pruneExpired(key,now);if(removed)emit('vtt:map-simulation-temporary-pruned',{removed,worldNow:now});return removed;
  }
  function onMovement(){reconcile();}
  function onDelta(event){const detail=event?.detail||{};if(detail.temporary===true||detail.expiresAt!=null)void recordTemporary(detail);else void recordPersistentChange(detail);}
  function onWorldClock(){pruneTemporary();const lifecycle=manager.tick(worldNowMs());lastLifecycle=lifecycle;for(const dormant of lifecycle.dormant)if(store.hasMeaningfulState(dormant.identity)||store.isDirty(dormant.identity))void flushZone(dormant.identity,{reason:dormant.reason||'world-clock'});mapData.mapSimulation={schemaVersion:Core.SCHEMA_VERSION,...lifecycle.metrics,persistence:store.metrics()};}

  canvas?.addEventListener?.('vtt:token-moved',onMovement);
  canvas?.addEventListener?.('vtt:regional-local-transition-applied',onMovement);
  canvas?.addEventListener?.('vtt:procedural-chunk-loaded',onMovement);
  globalThis.addEventListener?.('vtt:map-delta',onDelta);
  globalThis.addEventListener?.('luminous:world-scheduler-updated',onWorldClock);

  const initial=reconcile();
  const api=Object.freeze({Core,PERSIST_ROOT,isDm,manager,store,reconcile,reconcileActors:(actors,now=worldNowMs())=>reconcile(actors,now),restoreZone,flushZone,recordPersistentChange,recordTemporary,markZone,pinZone:(raw,pinned=true)=>markZone(raw,{pinned,persistent:true,reason:'pin-zone'}),snapshot:()=>({lifecycle:manager.snapshot(),persistence:store.metrics(),lastLifecycle}),worldNowMs,stop(){if(stopped)return;stopped=true;canvas?.removeEventListener?.('vtt:token-moved',onMovement);canvas?.removeEventListener?.('vtt:regional-local-transition-applied',onMovement);canvas?.removeEventListener?.('vtt:procedural-chunk-loaded',onMovement);globalThis.removeEventListener?.('vtt:map-delta',onDelta);globalThis.removeEventListener?.('luminous:world-scheduler-updated',onWorldClock);for(const key of store.dirtyKeys()){const record=store.get(key,worldNowMs());if(record?.identity)void flushZone(record.identity,{reason:'runtime-stop'});}loadedZones.clear();restoreInFlight.clear();}});
  globalThis.LuminousVttMapSimulationRuntime={api};globalThis.LuminousVttRuntime=Object.freeze({...globalThis.LuminousVttRuntime,mapSimulation:api});return api;
}
