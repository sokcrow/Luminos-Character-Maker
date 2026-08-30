import '../regional-travel-core.js';
import '../regional-local-transition-core.js';
import './procedural-chunk-streaming-core.js';

const DM_UID='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
const REQUEST_ROOT='vtt_regional_local_transition_requests';
const PLAYER_ROOT='campaña/jugadores';
const clean=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const firebaseKey=(value,fallback='key')=>clean(value).replace(/[.#$\[\]\/]/g,'_')||fallback;

function hostWindow(){try{if(window.parent&&window.parent!==window&&window.parent.document)return window.parent;}catch(_){}return window;}
function hostFirebase(){const host=hostWindow();return host?.firebase||window.firebase||null;}
function currentUid(firebase){try{return clean(firebase?.auth?.().currentUser?.uid);}catch(_){return '';}}
function makeId(prefix='regional_local'){return`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}

export function start({runtime=globalThis.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(globalThis.LuminousVttRegionalLocalTransitionRuntime?.api)return globalThis.LuminousVttRegionalLocalTransitionRuntime.api;

  const Transition=globalThis.LuminousRegionalLocalTransitionCore;
  const Procedural=globalThis.LuminousVttProceduralChunkStreaming;
  const firebase=hostFirebase();
  const db=firebase?.database?.()||null;
  if(!Transition||!Procedural)throw new Error('REGIONAL_LOCAL_TRANSITION_DEPENDENCY_REQUIRED');

  const engine=runtime.engine;
  const identity=runtime.tokenStateBridge?.identity||{};
  const mapId=firebaseKey(mapData.id||mapData.mapId||'default','default');
  const isDm=Boolean(runtime.bridge?.isDm)||currentUid(firebase)===DM_UID;
  const subscriptions=[];
  const inFlight=new Set();
  let stopped=false,lastAppliedMarker='';

  const requestMapRoot=()=>db?.ref(`${REQUEST_ROOT}/${mapId}`);
  const playerWorldRef=playerId=>db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerId,'player')}/worldPosition`);
  const playerVttRef=playerId=>db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerId,'player')}/vttTokenState/${mapId}`);
  const notify=(message,mode='info')=>runtime.controller?.notify?.(message,mode);

  function subscribe(ref,event,handler){if(!ref?.on)return;ref.on(event,handler);subscriptions.push(()=>ref.off(event,handler));}
  function descriptor(){return globalThis.LuminousVttRuntime?.proceduralChunks?.descriptor?.()||Procedural.createDescriptor(mapData.procedural?.streaming||{});}
  function viewerToken(){return(mapData.tokens||[]).find(token=>token.viewer===true)||(mapData.tokens||[]).find(token=>token.characterLink?.mode==='current_player')||null;}
  function tokenPlayerId(token){return clean(token?.canonicalPlayerKey||token?.playerId||token?.characterLink?.playerId||identity.playerId);}
  function sourceWorldPosition(token){return token?.worldPosition&&typeof token.worldPosition==='object'?token.worldPosition:null;}

  function requestedPoint(event,drag){const world=engine.eventWorldPoint(event);return{x:world.x-drag.grabOffsetX,y:world.y-drag.grabOffsetY};}
  function restoreDrag(drag){
    drag.token.x=drag.originX;drag.token.y=drag.originY;drag.token.zLayer=drag.originZ;drag.token.z=[drag.originZ];
    drag.token.elevationFt=drag.originElevationFt;engine.tokenDrag=null;if(engine.canvas?.style)engine.canvas.style.cursor='default';
  }

  async function submitBoundaryRequest({token,position,transition,requested}){
    if(!db)throw new Error('REGIONAL_LOCAL_REALTIME_REQUIRED');
    const playerId=tokenPlayerId(token),uid=currentUid(firebase);
    if(!playerId||!uid)throw new Error('REGIONAL_LOCAL_PLAYER_IDENTITY_REQUIRED');
    const exitSide=Transition.boundaryExitSide({descriptor:descriptor(),exit:transition.exit,requestedPoint:requested});
    if(!exitSide)throw new Error('REGIONAL_EXIT_SIDE_UNRESOLVED');
    const requestId=makeId('regional_local');
    const payload={
      schemaVersion:1,requestId,mapId,playerId,tokenId:clean(token.id),requesterUid:uid,status:'pending',
      sourceZoneId:clean(position.zoneId),sourceRegionalHex:clone(position.regionalHex),
      sourceChunk:{col:Number(position.chunkCol)||0,row:Number(position.chunkRow)||0},exitSide,
      requestedAt:firebase.database.ServerValue.TIMESTAMP,
    };
    await db.ref(`${REQUEST_ROOT}/${mapId}/${requestId}`).set(payload);
    notify('Transición regional solicitada.','pending');
    return requestId;
  }

  async function consumeRequest(snapshot){
    if(!isDm||!snapshot?.ref)return;
    const request=snapshot.val()||{},requestId=clean(request.requestId||snapshot.key);
    if(!requestId||inFlight.has(requestId))return;
    inFlight.add(requestId);
    try{
      const playerId=clean(request.playerId),requesterUid=clean(request.requesterUid);
      const playerSnapshot=await db.ref(`${PLAYER_ROOT}/${firebaseKey(playerId,'player')}`).once('value');
      const player=playerSnapshot.val()||{},stored=player.worldPosition||null;
      const ownerUid=clean(player.uid||player.userUid||player.ownerUid||player.firebaseUid||player.authUid);
      let reason='';
      if(request.status!=='pending')reason='REQUEST_NOT_PENDING';
      else if(!playerId||!stored?.regionalHex)reason='WORLD_POSITION_REQUIRED';
      else if(requesterUid!==DM_UID&&ownerUid!==requesterUid)reason='PLAYER_OWNERSHIP_REQUIRED';
      else if(clean(request.sourceZoneId)!==clean(stored.zoneId))reason='STALE_ZONE_REQUEST';
      else if(!Transition.sameRegionalHex(request.sourceRegionalHex||{},stored.regionalHex||{}))reason='STALE_HEX_REQUEST';

      let plan=null;
      if(!reason){
        plan=Transition.createLocalExitPlan({worldPosition:stored,exitSide:request.exitSide,transitionId:requestId,cellSize:mapData.grid?.size||70,chunkCols:3,chunkRows:3,chunkSizeCells:40});
        if(!plan.valid)reason=plan.reason||'REGIONAL_TRANSITION_INVALID';
      }

      if(!reason&&stored.regionalGraphId){
        const Graph=globalThis.LuminousRegionalWorldGraphCore,graph=Graph?.getGraph?.(stored.regionalGraphId)||null;
        const targetNode=graph?.nodes?.get?.(`${plan.targetHex.district}:${plan.targetHex.q},${plan.targetHex.r}`)||null;
        if(graph&&!targetNode)reason='REGIONAL_GRAPH_TARGET_MISSING';
        else if(targetNode?.blocked)reason='REGIONAL_GRAPH_TARGET_BLOCKED';
        else if(requesterUid!==DM_UID&&targetNode?.requiredAccess?.length)reason='REGIONAL_ACCESS_REQUIRED';
      }

      if(reason){await snapshot.ref.remove();notify(`Transición regional rechazada: ${reason}.`,'error');return;}
      const targetPosition={...plan.targetPosition,realtimeUpdatedAt:firebase.database.ServerValue.TIMESTAMP};
      const updates={};
      updates[`${PLAYER_ROOT}/${firebaseKey(playerId,'player')}/worldPosition`]=targetPosition;
      updates[`${REQUEST_ROOT}/${mapId}/${requestId}`]=null;
      await db.ref().update(updates);
    }catch(error){console.error('VTT REGIONAL LOCAL REQUEST FAILED:',error);try{await snapshot.ref.remove();}catch(_){} }
    finally{inFlight.delete(requestId);}
  }

  async function applyAuthoritativePosition(position){
    if(isDm||!position?.regionalHex||!position?.zoneId)return false;
    const marker=clean(position.transitionId||position.travelArrivalId)||`${position.zoneId}:${position.chunkCol},${position.chunkRow}:${Number(position.realtimeUpdatedAt)||0}`;
    if(marker&&marker===lastAppliedMarker)return false;
    const token=viewerToken();if(!token)return false;
    const playerId=tokenPlayerId(token);if(!playerId)return false;

    let visualUpdatedAt=0;
    if(db){try{const snap=await playerVttRef(playerId).once('value');visualUpdatedAt=Number(snap.val()?.updatedAt)||0;}catch(_){} }
    const authoritativeUpdatedAt=Number(position.realtimeUpdatedAt)||0;
    const applyEntry=!visualUpdatedAt||!authoritativeUpdatedAt||authoritativeUpdatedAt>=visualUpdatedAt;
    const current=descriptor();
    const next=Procedural.createDescriptor({
      ...current,zoneId:position.zoneId,seed:Transition.zoneSeedForHex(position.worldId,position.regionalHex),
      chunkCols:3,chunkRows:3,activeChunk:{col:Number(position.chunkCol)||0,row:Number(position.chunkRow)||0},
    });
    const chunks=globalThis.LuminousVttRuntime?.proceduralChunks;
    if(chunks?.activateChunk){
      await chunks.activateChunk(next,next.activeChunk,{tokenId:token.id,persist:false,publish:false,center:false});
    }else{
      mapData.procedural||={};mapData.procedural.streaming=next;
    }
    token.worldPosition=clone(position);
    if(applyEntry){
      token.x=Number(position.x)||0;token.y=Number(position.y)||0;
      token.zLayer=Number(position.zLayer)||0;token.z=[token.zLayer];token.elevationFt=Number(position.elevationFt)||0;
      token.gridPosition={...(token.gridPosition||{}),col:Math.floor(token.x/(mapData.grid?.size||70)),row:Math.floor(token.y/(mapData.grid?.size||70)),z:token.zLayer};
      await runtime.tokenStateBridge?.saveToken?.(token);
    }
    lastAppliedMarker=marker;
    engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:regional-local-transition-applied',{detail:{playerId,tokenId:token.id,worldPosition:clone(position),applyEntry}}));
    engine.camera?.centerOnToken?.(token);
    return true;
  }

  function captureBoundary(event){
    const drag=engine.tokenDrag,desc=descriptor();if(!drag||!desc||event.button!==0)return;
    const requested=requestedPoint(event,drag),transition=Procedural.resolveTransition(desc,requested,mapData.grid);
    if(transition?.valid||transition?.reason!=='PROCEDURAL_ZONE_BOUNDARY')return;
    const token=drag.token,position=sourceWorldPosition(token);
    if(!position?.regionalHex)return;
    event.preventDefault();event.stopImmediatePropagation();restoreDrag(drag);
    Promise.resolve(submitBoundaryRequest({token,position,transition,requested})).catch(error=>{console.error('VTT REGIONAL LOCAL REQUEST SUBMIT FAILED:',error);notify(error?.message||'REGIONAL_LOCAL_REQUEST_FAILED','error');});
  }

  window.addEventListener('mouseup',captureBoundary,true);
  if(db&&isDm)subscribe(requestMapRoot(),'child_added',snapshot=>{consumeRequest(snapshot).catch(error=>console.error('VTT REGIONAL LOCAL CONSUME FAILED:',error));});
  if(db&&!isDm&&identity.playerId)subscribe(playerWorldRef(identity.playerId),'value',snapshot=>{applyAuthoritativePosition(snapshot.val()||{}).catch(error=>console.error('VTT REGIONAL LOCAL APPLY FAILED:',error));});

  const api=Object.freeze({Transition,Procedural,REQUEST_ROOT,mapId,isDm,submitBoundaryRequest,consumeRequest,applyAuthoritativePosition,stop(){if(stopped)return;stopped=true;window.removeEventListener('mouseup',captureBoundary,true);subscriptions.splice(0).forEach(unsubscribe=>unsubscribe());inFlight.clear();}});
  globalThis.LuminousVttRegionalLocalTransitionRuntime={api};
  globalThis.LuminousVttRuntime=Object.freeze({...globalThis.LuminousVttRuntime,regionalLocalTransition:api});
  return api;
}
