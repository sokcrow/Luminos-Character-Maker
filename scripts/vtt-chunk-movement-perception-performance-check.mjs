import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { PerceptionScheduler } from '../js/vtt/perception-scheduler.js';
import {
  createChunkSpatialIndex,
  queryPlayerPov,
  workingSetCounts,
} from '../js/vtt/visibility-working-set.js';

const GRID_SIZE=70;
const COLS=40;
const ROWS=40;
const PREVIEW_FRAMES=240;
const POV_DEG=120;
const RANGE_PX=10*GRID_SIZE;
const PRELOAD_PX=2*GRID_SIZE;

function rng(seed=0x5eed1234){
  let state=seed>>>0;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

function buildScene(){
  const random=rng();
  const topology=[];
  for(let row=0;row<=ROWS;row+=2){
    for(let col=0;col<COLS;col+=2){
      topology.push({id:`h-${col}-${row}`,type:'wall',from:{col,row},to:{col:Math.min(COLS,col+2),row},z:[0]});
    }
  }
  for(let col=0;col<=COLS;col+=2){
    for(let row=0;row<ROWS;row+=2){
      topology.push({id:`v-${col}-${row}`,type:'wall',from:{col,row},to:{col,row:Math.min(ROWS,row+2)},z:[0]});
    }
  }
  const worldObjects=Array.from({length:320},(_,i)=>({
    id:`obj-${i}`,
    x:(1+Math.floor(random()*(COLS-2)))*GRID_SIZE,
    y:(1+Math.floor(random()*(ROWS-2)))*GRID_SIZE,
    radiusPx:10+(i%4)*5,
  }));
  const tokens=Array.from({length:96},(_,i)=>({
    id:`token-${i}`,
    x:(1+Math.floor(random()*(COLS-2)))*GRID_SIZE,
    y:(1+Math.floor(random()*(ROWS-2)))*GRID_SIZE,
    radiusPx:18,
  }));
  const lights=Array.from({length:72},(_,i)=>({
    id:`light-${i}`,
    x:(1+Math.floor(random()*(COLS-2)))*GRID_SIZE,
    y:(1+Math.floor(random()*(ROWS-2)))*GRID_SIZE,
    radiusPx:28,
  }));
  const surfaces=[];
  for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++)surfaces.push({id:`surface-${col}-${row}`,col,row});
  return{topology,worldObjects,tokens,lights,surfaces};
}

function pointFromVertex(vertex){
  return{x:Number(vertex?.col||0)*GRID_SIZE,y:Number(vertex?.row||0)*GRID_SIZE};
}

function orientation(a,b,c){
  return((b.y-a.y)*(c.x-b.x))-((b.x-a.x)*(c.y-b.y));
}

function onSegment(a,b,c){
  return b.x<=Math.max(a.x,c.x)+1e-9&&b.x+1e-9>=Math.min(a.x,c.x)
    &&b.y<=Math.max(a.y,c.y)+1e-9&&b.y+1e-9>=Math.min(a.y,c.y);
}

function segmentsIntersect(a,b,c,d){
  const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);
  if(((o1>0&&o2<0)||(o1<0&&o2>0))&&((o3>0&&o4<0)||(o3<0&&o4>0)))return true;
  if(Math.abs(o1)<1e-9&&onSegment(a,c,b))return true;
  if(Math.abs(o2)<1e-9&&onSegment(a,d,b))return true;
  if(Math.abs(o3)<1e-9&&onSegment(c,a,d))return true;
  if(Math.abs(o4)<1e-9&&onSegment(c,b,d))return true;
  return false;
}

function exactVision(index,player){
  const set=queryPlayerPov(index,player,{fovDeg:POV_DEG,rangePx:RANGE_PX,preloadPx:PRELOAD_PX});
  const walls=set.topology||[];
  const targets=[...(set.tokens||[]),...(set.worldObjects||[])];
  const origin={x:player.x,y:player.y};
  let visibleTargets=0;
  let intersectionChecks=0;
  let checksum=workingSetCounts(set).total;
  for(const target of targets){
    let blocked=false;
    for(const wall of walls){
      const a=pointFromVertex(wall.from||wall.a);
      const b=pointFromVertex(wall.to||wall.b);
      intersectionChecks+=1;
      if(segmentsIntersect(origin,{x:Number(target.x||0),y:Number(target.y||0)},a,b)){
        blocked=true;
        break;
      }
    }
    if(!blocked){
      visibleTargets+=1;
      checksum=(checksum+String(target.id||'').length*17)>>>0;
    }
  }
  return Object.freeze({candidateCount:workingSetCounts(set).total,visibleTargets,intersectionChecks,checksum});
}

function playerAtFrame(frame){
  const t=frame/Math.max(1,PREVIEW_FRAMES-1);
  return{
    x:(8+(24*t))*GRID_SIZE,
    y:(20+Math.sin(t*Math.PI*4)*3)*GRID_SIZE,
    facingDeg:Math.sin(t*Math.PI*2)*40,
  };
}

function time(fn){
  const started=performance.now();
  const result=fn();
  return{result,totalMs:performance.now()-started};
}

const scene=buildScene();
const index=createChunkSpatialIndex(scene,{gridSize:GRID_SIZE,bucketCells:4});
const startPlayer=playerAtFrame(0);
const endpointPlayer=playerAtFrame(PREVIEW_FRAMES-1);

// Warm both strategies from an already exact, canonical starting position.
const warmVision=exactVision(index,startPlayer);
assert.ok(warmVision.candidateCount>0,'warm exact vision must have candidates');

let naiveExactCalls=0;
let naiveIntersectionChecks=0;
let naiveChecksum=0;
const naive=time(()=>{
  for(let frame=0;frame<PREVIEW_FRAMES;frame+=1){
    const vision=exactVision(index,playerAtFrame(frame));
    naiveExactCalls+=1;
    naiveIntersectionChecks+=vision.intersectionChecks;
    naiveChecksum=(naiveChecksum+vision.checksum)>>>0;
  }
  const endpoint=exactVision(index,endpointPlayer);
  naiveExactCalls+=1;
  naiveIntersectionChecks+=endpoint.intersectionChecks;
  naiveChecksum=(naiveChecksum+endpoint.checksum)>>>0;
  return endpoint;
});

const scheduler=new PerceptionScheduler();
let currentPlayer=startPlayer;
let cachedExactCalls=0;
let cachedIntersectionChecks=0;
const computeExact=()=>{
  const vision=exactVision(index,currentPlayer);
  cachedExactCalls+=1;
  cachedIntersectionChecks+=vision.intersectionChecks;
  return vision;
};

// Establish canonical cached vision before movement; route deltas start after this point.
scheduler.consumeVision(computeExact);
scheduler.didRender();
const beforeRoute=scheduler.snapshot();
const cached=time(()=>{
  let checksum=0;
  scheduler.setAnimationActive(true);
  for(let frame=0;frame<PREVIEW_FRAMES;frame+=1){
    currentPlayer=playerAtFrame(frame);
    scheduler.markSceneDirty({reason:'token-preview',render:true,vision:false,active:true});
    const vision=scheduler.consumeVision(computeExact);
    checksum=(checksum+vision.checksum)>>>0;
    assert.equal(scheduler.shouldRender(),true,'each visual preview frame must remain renderable');
    scheduler.didRender();
  }
  scheduler.setAnimationActive(false);
  const afterPreview=scheduler.snapshot();

  currentPlayer=endpointPlayer;
  scheduler.markSceneDirty({reason:'token-endpoint',render:true,vision:true,active:false});
  const endpoint=scheduler.consumeVision(computeExact);
  checksum=(checksum+endpoint.checksum)>>>0;
  if(scheduler.shouldRender())scheduler.didRender();
  return{endpoint,afterPreview,afterEndpoint:scheduler.snapshot(),checksum};
});

const previewRecomputes=cached.result.afterPreview.visionRecomputes-beforeRoute.visionRecomputes;
const previewCacheHits=cached.result.afterPreview.visionCacheHits-beforeRoute.visionCacheHits;
const previewRenderedFrames=cached.result.afterPreview.renderedFrames-beforeRoute.renderedFrames;
const previewInvalidations=cached.result.afterPreview.visionInvalidations-beforeRoute.visionInvalidations;
const endpointRecomputes=cached.result.afterEndpoint.visionRecomputes-cached.result.afterPreview.visionRecomputes;
const endpointInvalidations=cached.result.afterEndpoint.visionInvalidations-cached.result.afterPreview.visionInvalidations;
const routeExactCalls=cachedExactCalls-1;
const exactCallReductionPercent=(1-(routeExactCalls/naiveExactCalls))*100;

assert.equal(previewRenderedFrames,PREVIEW_FRAMES,'all preview frames must render visually');
assert.equal(previewRecomputes,0,'raw/traversal preview must not recompute exact FOV');
assert.equal(previewInvalidations,0,'raw/traversal preview must not invalidate exact FOV');
assert.equal(previewCacheHits,PREVIEW_FRAMES,'preview frames may reuse cached vision without exact computation');
assert.equal(endpointRecomputes,1,'canonical endpoint must recompute exact perception exactly once');
assert.equal(endpointInvalidations,1,'canonical endpoint must invalidate exact perception once');
assert.equal(routeExactCalls,1,'cached route must perform only the endpoint exact computation after warm cache');
assert.equal(naiveExactCalls,PREVIEW_FRAMES+1,'naive route must model per-frame FOV plus endpoint exact FOV');
assert.ok(exactCallReductionPercent>99,'cached route must reduce route exact FOV calls by more than 99%');
assert.equal(cached.result.afterEndpoint.cameraDirtyEvents,0,'token traversal must not require a second camera dirty pulse');
assert.deepEqual(cached.result.endpoint,naive.result,'cached endpoint perception must equal naive exact endpoint perception');

const report={
  chunk:{cols:COLS,rows:ROWS,gridSize:GRID_SIZE,worldEntities:workingSetCounts(scene).total},
  movement:{previewFrames:PREVIEW_FRAMES,povDeg:POV_DEG,rangeCells:RANGE_PX/GRID_SIZE,preloadCells:PRELOAD_PX/GRID_SIZE},
  naive:{exactVisionCalls:naiveExactCalls,intersectionChecks:naiveIntersectionChecks,totalMs:naive.totalMs,checksum:naiveChecksum},
  cached:{
    warmExactCalls:1,
    routeExactVisionCalls:routeExactCalls,
    previewVisionRecomputes:previewRecomputes,
    previewVisionInvalidations:previewInvalidations,
    previewCacheHits,
    previewRenderedFrames,
    endpointVisionRecomputes:endpointRecomputes,
    endpointVisionInvalidations:endpointInvalidations,
    routeIntersectionChecks:cachedIntersectionChecks-warmVision.intersectionChecks,
    totalMs:cached.totalMs,
    checksum:cached.result.checksum,
  },
  reduction:{
    exactVisionCallsPercent:Number(exactCallReductionPercent.toFixed(2)),
    exactVisionCallFactor:Number((naiveExactCalls/routeExactCalls).toFixed(2)),
    diagnosticCpuSpeedup:Number((naive.totalMs/Math.max(cached.totalMs,0.000001)).toFixed(2)),
  },
};

console.log('vtt simulated chunk movement perception performance: ok');
console.log(JSON.stringify(report,null,2));
