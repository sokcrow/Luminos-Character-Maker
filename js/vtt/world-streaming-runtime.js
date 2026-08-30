import './world-streaming-core.js';

const clean=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const REGIONAL_KEYS=Object.freeze(['regionalHex','entrySide','regionalEntrySide','transitionMode','transitionId','regionalGraphId','regionalGraphRevision','regionalGraphFingerprint','travelArrivalId','arrivedAtWorldTs']);

export function start({runtime=globalThis.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(globalThis.LuminousVttWorldStreamingRuntime?.api)return globalThis.LuminousVttWorldStreamingRuntime.api;
  const core=globalThis.LuminousVttWorldStreaming;if(!core)throw new Error('WORLD_STREAMING_CORE_REQUIRED');
  const canvas=runtime.engine.canvas;
  const manager=core.createLifecycleManager({maxActiveChunks:8,maxWarmChunks:16,warmTtlMs:30000,cellSize:mapData.grid?.size||70,chunkSizeCells:40});
  let stopped=false,currentChunk=mapData.procedural?.streaming?.activeChunk||{col:0,row:0};

  function basePosition(){
    const streaming=mapData.procedural?.streaming||{};
    return{worldId:clean(mapData.worldId||mapData.world?.id)||'luminous',regionId:clean(mapData.regionId||mapData.region?.id)||'region',zoneId:clean(streaming.zoneId||mapData.zoneId||mapData.id||mapData.mapId)||'zone',chunkCol:Number(currentChunk?.col)||0,chunkRow:Number(currentChunk?.row)||0,cellSize:mapData.grid?.size||70,chunkSizeCells:40};
  }
  function regionalMetadata(prior={}){const meta={};for(const key of REGIONAL_KEYS)if(prior[key]!=null&&prior[key]!=='')meta[key]=clone(prior[key]);return meta;}
  function positionForToken(token,chunkOverride=null){
    const prior=token?.worldPosition||{},base=basePosition(),chunk=chunkOverride||null;
    const normalized=core.normalizeWorldPosition({...base,...prior,chunkCol:chunk?.col??prior.chunkCol??base.chunkCol,chunkRow:chunk?.row??prior.chunkRow??base.chunkRow,x:token?.x??prior.x??0,y:token?.y??prior.y??0,zLayer:token?.zLayer??token?.gridPosition?.z??prior.zLayer??0,elevationFt:token?.elevationFt??prior.elevationFt??0},{cellSize:mapData.grid?.size||70,chunkSizeCells:40});
    return Object.freeze({...normalized,...regionalMetadata(prior)});
  }
  function actorRecords(){return(mapData.tokens||[]).map(token=>({id:token.id,position:positionForToken(token)})).filter(entry=>clean(entry.id));}
  function persistTokenPosition(token,position){if(!token)return null;token.worldPosition={worldId:position.worldId,regionId:position.regionId,zoneId:position.zoneId,chunkCol:position.chunkCol,chunkRow:position.chunkRow,x:position.x,y:position.y,zLayer:position.zLayer,elevationFt:position.elevationFt,...regionalMetadata(position)};return token.worldPosition;}
  function reconcile(now=Date.now()){for(const token of mapData.tokens||[])persistTokenPosition(token,positionForToken(token));const result=manager.reconcile(actorRecords(),now);mapData.worldStreaming={schemaVersion:core.SCHEMA_VERSION,...result.metrics};return result;}
  function onTokenMoved(event){
    const detail=event?.detail||{},token=(mapData.tokens||[]).find(entry=>String(entry.id)===String(detail.tokenId));if(!token)return;
    const target=detail.chunkTransition?.to||null;if(target)currentChunk={col:Number(target.col)||0,row:Number(target.row)||0};
    persistTokenPosition(token,positionForToken(token,target));reconcile();
  }
  function onChunkLoaded(event){const chunk=event?.detail?.chunk;if(chunk)currentChunk={col:Number(chunk.col)||0,row:Number(chunk.row)||0};reconcile();}
  canvas?.addEventListener?.('vtt:token-moved',onTokenMoved);canvas?.addEventListener?.('vtt:procedural-chunk-loaded',onChunkLoaded);
  const initial=reconcile();
  const api=Object.freeze({core,manager,reconcile,positionForToken,persistTokenPosition,compactChunkRecord:core.createDormantRecord,snapshot:()=>manager.snapshot(),get initial(){return initial;},stop(){if(stopped)return;stopped=true;canvas?.removeEventListener?.('vtt:token-moved',onTokenMoved);canvas?.removeEventListener?.('vtt:procedural-chunk-loaded',onChunkLoaded);}});
  globalThis.LuminousVttWorldStreamingRuntime={api};globalThis.LuminousVttRuntime=Object.freeze({...globalThis.LuminousVttRuntime,worldStreaming:api});return api;
}
