const EPS=1e-9;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const VERTICAL_FIELDS=['x','y','elevationFt','zLayer','z','gridPosition','verticalMovement','lastVerticalTravel','movementRemainingFt'];

function snapshotToken(token={}){
  const snapshot={};
  for(const key of VERTICAL_FIELDS){
    snapshot[key]={present:Object.prototype.hasOwnProperty.call(token,key),value:clone(token[key])};
  }
  return snapshot;
}

function restoreToken(token,snapshot={}){
  for(const key of VERTICAL_FIELDS){
    const entry=snapshot[key];
    if(!entry?.present)delete token[key];
    else token[key]=clone(entry.value);
  }
  return token;
}

function snapshotValue(snapshot,key,fallback=undefined){
  return snapshot?.[key]?.present?snapshot[key].value:fallback;
}

function layerFromSnapshot(snapshot={},fallback=0){
  const direct=Number(snapshotValue(snapshot,'zLayer'));
  if(Number.isFinite(direct))return direct;
  const grid=Number(snapshotValue(snapshot,'gridPosition')?.z);
  if(Number.isFinite(grid))return grid;
  const z=snapshotValue(snapshot,'z');
  return Array.isArray(z)&&z.length?finite(z[0],fallback):fallback;
}

function feetPerPixel(mapData={}){
  return Math.max(.001,finite(mapData.grid?.distancePerCell,5))/Math.max(1,finite(mapData.grid?.size,70));
}

export function sampleVerticalMotion({start={},route,sourceZ=0,startProgressFt=0,endProgressFt=0,mapData={},ratio=0,routeApi=globalThis.LuminousVttStairRoute}={}){
  if(!route||!routeApi?.pointAtDistance)return null;
  const t=Math.max(0,Math.min(1,finite(ratio)));
  const startProgress=Math.max(0,finite(startProgressFt));
  const endProgress=Math.max(startProgress,finite(endProgressFt,startProgress));
  const routeStart=routeApi.pointAtDistance(route,sourceZ,startProgress,mapData);
  if(!routeStart)return null;
  const startPoint={
    x:finite(start.x,routeStart.x),
    y:finite(start.y,routeStart.y),
    elevationFt:finite(start.elevationFt,routeStart.elevationFt),
  };
  const approachFt=Math.hypot(startPoint.x-routeStart.x,startPoint.y-routeStart.y)*feetPerPixel(mapData);
  const routeFt=Math.max(0,endProgress-startProgress);
  const totalFt=approachFt+routeFt;
  if(totalFt<=EPS){
    return{...routeStart,progressFt:startProgress,phase:'route'};
  }
  const travelled=totalFt*t;
  if(approachFt>EPS&&travelled<approachFt){
    const a=Math.max(0,Math.min(1,travelled/approachFt));
    return{
      x:startPoint.x+((routeStart.x-startPoint.x)*a),
      y:startPoint.y+((routeStart.y-startPoint.y)*a),
      elevationFt:startPoint.elevationFt+((routeStart.elevationFt-startPoint.elevationFt)*a),
      progressFt:startProgress,
      phase:'approach',
    };
  }
  const along=Math.max(0,Math.min(routeFt,travelled-approachFt));
  const progressFt=startProgress+along;
  const point=routeApi.pointAtDistance(route,sourceZ,progressFt,mapData);
  return point?{...point,progressFt,phase:'route'}:null;
}

function emitCommittedMove(engine,token,drag,result,transition){
  const moveDetail={
    tokenId:token.id,
    from:{x:drag.originX,y:drag.originY,z:drag.originZ,elevationFt:drag.originElevationFt},
    to:{x:token.x,y:token.y,...token.gridPosition,elevationFt:token.elevationFt??0,verticalMovement:token.verticalMovement||null},
    path:Array.isArray(result.path)?result.path:[],
    routeCostFt:result.routeCostFt??result.costFt??null,
    movementCostFt:result.movementCostFt??result.costFt??null,
    movementMode:result.movementMode||result.mode||null,
    actionMode:result.actionMode||null,
    transition:transition?.valid?{
      routeId:transition.route?.id||null,
      complete:Boolean(transition.complete),
      targetZ:transition.targetZ,
      costSpentFt:transition.costSpentFt??null,
      continuous:true,
    }:null,
  };
  engine.emitSemanticEvent?.('vtt:token-moved',moveDetail,{reason:'token',render:true,vision:true,active:false});
  if(result.stopAtDoor){
    engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:movement-stopped-at-door',{detail:{tokenId:token.id,x:token.x,y:token.y,z:token.zLayer,...result.stopAtDoor}}));
  }
  if(transition?.valid){
    engine.emitSemanticEvent?.('vtt:token-z-transition',{tokenId:token.id,...transition,continuous:true},{reason:'token',render:true,vision:true,active:false});
  }
}

async function animateTransition(root,engine,token,transition,startState,finalState){
  const routeApi=root?.LuminousVttStairRoute;
  const route=transition?.route;
  if(!routeApi?.pointAtDistance||!route)return true;
  const sourceZ=Number.isFinite(Number(transition.sourceZ))?Number(transition.sourceZ):layerFromSnapshot(startState,0);
  const activeBefore=snapshotValue(startState,'verticalMovement');
  const startProgressFt=String(activeBefore?.routeId||'')===String(route.id||'')?Math.max(0,finite(activeBefore?.progressFt)):0;
  const endProgressFt=transition.complete?finite(route.pathLengthFt):Math.max(startProgressFt,finite(transition.progressFt,startProgressFt));
  const start={
    x:finite(snapshotValue(startState,'x')),
    y:finite(snapshotValue(startState,'y')),
    elevationFt:finite(snapshotValue(startState,'elevationFt'),routeApi.pointAtDistance(route,sourceZ,startProgressFt,engine.mapData)?.elevationFt||0),
  };
  const movement=engine.mapData?.movement||{};
  const routeTravelFt=Math.max(0,endProgressFt-startProgressFt);
  const entry=routeApi.pointAtDistance(route,sourceZ,startProgressFt,engine.mapData);
  const approachFt=entry?Math.hypot(start.x-entry.x,start.y-entry.y)*feetPerPixel(engine.mapData):0;
  const totalFt=routeTravelFt+approachFt;
  const perFt=Math.max(1,finite(movement.verticalAnimationMsPerFoot,18));
  const minMs=Math.max(80,finite(movement.verticalAnimationMinMs,140));
  const maxMs=Math.max(minMs,finite(movement.verticalAnimationMaxMs,1200));
  const durationMs=Math.min(maxMs,Math.max(minMs,totalFt*perFt));
  const raf=root?.requestAnimationFrame?.bind(root)||((fn)=>root?.setTimeout?.(()=>fn(Date.now()),16));
  const caf=root?.cancelAnimationFrame?.bind(root)||root?.clearTimeout?.bind(root);
  const motion={cancelled:false,frameId:null,tokenId:token.id,vertical:true,routeId:route.id,durationMs};
  engine.tokenMotion=motion;
  const startedAt=root?.performance?.now?.()??Date.now();
  const complete=await new Promise((resolve)=>{
    const step=(nowValue)=>{
      if(motion.cancelled)return resolve(false);
      const t=Math.min(1,Math.max(0,(Number(nowValue)-startedAt)/durationMs));
      const sample=sampleVerticalMotion({start,route,sourceZ,startProgressFt,endProgressFt,mapData:engine.mapData,ratio:t,routeApi});
      if(sample){
        token.x=sample.x;
        token.y=sample.y;
        token.elevationFt=sample.elevationFt;
        token.zLayer=sourceZ;
        token.z=[sourceZ];
        token.gridPosition={...(token.gridPosition||{}),...globalThis.LuminousVttVerticalMovement?.gridPositionForPoint?.(sample,sourceZ,engine.mapData),z:sourceZ};
        engine.emitSemanticEvent?.('vtt:token-preview-moved',{
          tokenId:token.id,x:token.x,y:token.y,z:sourceZ,elevationFt:token.elevationFt,
          traversing:true,verticalTransition:true,routeId:route.id,progressFt:sample.progressFt,totalFt:route.pathLengthFt,
        },{reason:'token',render:true,vision:true,active:true});
      }
      if(t>=1)return resolve(true);
      motion.frameId=raf(step);
    };
    motion.frameId=raf(step);
  });
  if(motion.frameId!=null&&motion.cancelled)caf?.(motion.frameId);
  if(engine.tokenMotion===motion)engine.tokenMotion=null;
  if(!complete){
    restoreToken(token,startState);
    return false;
  }
  restoreToken(token,finalState);
  return true;
}

export function installVerticalTransitionAnimation(root=globalThis,engine=root?.LuminousVttRuntime?.engine){
  if(!engine||engine.__continuousElevationTransitionV1)return engine?.__continuousElevationTransitionV1||null;
  const originalFinalize=engine.finalizeTokenMove?.bind(engine);
  if(typeof originalFinalize!=='function')return null;

  function candidateFor(token,point){
    const rules=engine.verticalMovementRules;
    if(!rules)return null;
    const resumed=rules.candidateForRouteId?.(engine.mapData,token?.verticalMovement?.routeId);
    if(resumed)return resumed;
    const z=rules.tokenLayer?.(token)??token?.zLayer??0;
    return rules.findTransitionAtPoint?.(point,engine.mapData,z)||null;
  }

  async function finalizeVertical(token,drag,result,endpoint){
    const zLayer=engine.spatialVisionRules?.layerOf?.(token)??token.z?.[0]??drag.originZ??0;
    token.x=Number(endpoint.x);
    token.y=Number(endpoint.y);
    token.zLayer=Number(zLayer)||0;
    token.z=[token.zLayer];
    token.gridPosition={
      col:Number.isFinite(Number(endpoint.col))?Number(endpoint.col):engine.tokenRules?.snapPointToGrid?.(token,engine.mapData.grid)?.col??token.gridPosition?.col??0,
      row:Number.isFinite(Number(endpoint.row))?Number(endpoint.row):engine.tokenRules?.snapPointToGrid?.(token,engine.mapData.grid)?.row??token.gridPosition?.row??0,
      z:token.zLayer,
    };
    const startState=snapshotToken(token);
    const transition=engine.verticalMovementRules?.transitionOnDrop?.(token,{x:token.x,y:token.y},engine.mapData)||{valid:false,reason:'NO_VERTICAL_TRANSITION'};
    if(!transition.valid){
      restoreToken(token,startState);
      return originalFinalize(token,drag,result);
    }
    const finalState=snapshotToken(token);
    restoreToken(token,startState);
    const animated=await animateTransition(root,engine,token,transition,startState,finalState);
    if(!animated){
      engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:movement-order-rejected',{detail:{tokenId:token.id,reason:'VERTICAL_MOVEMENT_CANCELLED'}}));
      return false;
    }
    if(transition.complete&&token.viewer===true&&Number.isFinite(Number(transition.targetZ)))engine.setZLayer?.(Number(transition.targetZ));
    emitCommittedMove(engine,token,drag,result,transition);
    return true;
  }

  const patchedFinalize=function continuousElevationFinalize(token,drag,result={}){
    const endpoint=(Array.isArray(result.path)&&result.path.length?result.path[result.path.length-1]:result);
    if(!token||!drag||!Number.isFinite(Number(endpoint?.x))||!Number.isFinite(Number(endpoint?.y)))return originalFinalize(token,drag,result);
    const candidate=candidateFor(token,{x:Number(endpoint.x),y:Number(endpoint.y)});
    if(!candidate)return originalFinalize(token,drag,result);
    void finalizeVertical(token,drag,result,endpoint).catch((error)=>{
      root?.console?.error?.('VTT continuous elevation transition failed:',error);
      try{originalFinalize(token,drag,result);}catch(fallbackError){root?.console?.error?.('VTT elevation fallback failed:',fallbackError);}
    });
    return undefined;
  };

  engine.finalizeTokenMove=patchedFinalize;
  const api=Object.freeze({
    originalFinalize,
    stop(){
      if(engine.finalizeTokenMove===patchedFinalize)engine.finalizeTokenMove=originalFinalize;
      if(engine.__continuousElevationTransitionV1===api)delete engine.__continuousElevationTransitionV1;
    },
  });
  engine.__continuousElevationTransitionV1=api;
  root.LuminousVttContinuousElevationTransition=api;
  return api;
}

export function startVerticalTransitionAnimation(root=globalThis){
  let attempts=0,stopped=false,installed=null;
  const tick=()=>{
    if(stopped||installed)return;
    installed=installVerticalTransitionAnimation(root,root?.LuminousVttRuntime?.engine);
    attempts+=1;
    if(!installed&&attempts<240)root?.setTimeout?.(tick,25);
  };
  tick();
  return Object.freeze({stop(){stopped=true;installed?.stop?.();},install(){installed=installVerticalTransitionAnimation(root,root?.LuminousVttRuntime?.engine);return installed;}});
}

if(typeof window!=='undefined')window.LuminousVttVerticalTransitionAnimationRuntime=startVerticalTransitionAnimation(window);
