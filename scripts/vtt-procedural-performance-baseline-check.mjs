import assert from 'node:assert/strict';
import { installProceduralPerformanceRuntime, geometrySnapshot } from '../js/vtt/procedural-performance-runtime.js';

const canvas=new EventTarget();
const wall=(id,count)=>({id,type:'wall',from:{col:0,row:0},to:{col:1,row:0},z:[0],sourceIds:Array.from({length:count},(_,i)=>`${id}:${i}`)});
const mapData={
  grid:{cols:20,rows:20,size:70,distancePerCell:5},
  procedural:{signature:'rama4-baseline'},
  semantics:{buildings:Array.from({length:4},(_,i)=>({id:`b${i}`}))},
  topology:[wall('merged-a',20),wall('merged-b',20),{id:'door',type:'door',from:{col:1,row:0},to:{col:2,row:0},z:[0],state:'closed'}],
  walls:[],structures:[],worldObjects:[],horizontalPlanes:[],surfaceLayers:{'0':{}},
};
const visionWalls=Array.from({length:100},(_,i)=>({id:`vision-${i}`,x1:i,y1:0,x2:i,y2:70}));
let rawRenderCalls=0;
const engine={
  canvas,mapData,activeZ:0,legacyVisionRadius:400,
  renderer:{render(){rawRenderCalls+=1;}},
  camera:{screenToWorld(x,y){return{x,y};}},
  visionWallsForLayer(){return visionWalls;},
  viewerToken(){return{x:100,y:100};},
  visionProfile(){return{radiusPx:400};},
  perceptionScheduler:{snapshot(){return{visionRecomputes:2,visionCacheHits:99,renderRequests:12,cameraDirtyEvents:3,activeFps:60,activeFrameTimeAvgMs:16.67,activeFrameTimeMaxMs:20};}},
};
const api=installProceduralPerformanceRuntime({runtime:{engine},mapData});
assert.equal(api.spatialFilteringEnabled,false,'spatial FOV filtering must remain OFF before field measurements');
assert.equal(api.renderCullingEnabled,false,'render culling must remain OFF before field measurements');
assert.equal(engine.visionWallsForLayer(0).length,100,'baseline must measure every FOV candidate before spatial filtering is authorized');
engine.renderer.render(engine.camera,0,null,false);
assert.equal(rawRenderCalls,1);

const geometry=geometrySnapshot(mapData);
assert.equal(geometry.rawWallSegments,40);
assert.equal(geometry.optimizedWallSegments,2);
assert.equal(geometry.absoluteReduction,38);
assert.equal(Number(geometry.reductionPercent.toFixed(1)),95);

const snapshot=api.snapshot();
assert.equal(snapshot.topologyCandidates,100);
assert.equal(snapshot.topologyTotalForLastVision,100);
assert.equal(snapshot.visionRecomputes,2);
assert.equal(snapshot.visionCacheHits,99);
assert.equal(snapshot.renderRequests,12);
assert.equal(snapshot.cameraDirtyEvents,3);
assert.equal(snapshot.activeFps,60);
assert.equal(snapshot.experimental.spatialFilteringEnabled,false);
assert.equal(snapshot.experimental.renderCullingEnabled,false);
assert.equal(snapshot.geometry.rawWallSegments,40);
assert.equal(snapshot.geometry.optimizedWallSegments,2);
api.stop();
console.log('vtt procedural performance baseline: ok');
