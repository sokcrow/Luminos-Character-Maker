import assert from 'node:assert/strict';
import { installPerceptionSchedulerRuntime } from '../js/vtt/perception-scheduler-runtime.js';

const previousSceneDirty=globalThis.LuminousVttSceneDirty;
const canvas=new EventTarget();
const dirtyEvents=[];
globalThis.LuminousVttSceneDirty={
  emit(target,detail){
    dirtyEvents.push(detail);
    target.dispatchEvent(new CustomEvent('vtt:scene-dirty',{detail}));
    return true;
  },
};

let rawVisionCalls=0;
let renderCalls=0;
const engine={
  canvas,
  isRunning:false,
  isExporting:false,
  activeZ:0,
  camera:{},
  renderer:{render(){renderCalls+=1;}},
  loop(){},
  calculateVision(){rawVisionCalls+=1;return{version:rawVisionCalls};},
  emitSemanticEvent(type,detail={},dirty=null){
    canvas.dispatchEvent(new CustomEvent(type,{detail}));
    if(dirty)globalThis.LuminousVttSceneDirty.emit(canvas,{...dirty,sourceEvent:type,tokenId:detail?.tokenId??dirty.tokenId??null,meta:detail});
  },
};
const runtime={engine};
const api=installPerceptionSchedulerRuntime({runtime});
assert.ok(api?.__rama4);

const first=engine.calculateVision();
for(let i=0;i<100;i++)assert.equal(engine.calculateVision(),first);
assert.equal(rawVisionCalls,1,'clean vision must remain cached across repeated consumers');

engine.emitSemanticEvent('vtt:token-preview-moved',{tokenId:'p1',traversing:true},{reason:'token',render:true,vision:true,active:true});
assert.equal(dirtyEvents.at(-1)?.vision,false,'traversal preview must be emitted as visual-only');
engine.calculateVision();
assert.equal(rawVisionCalls,1,'traversal preview must not recalculate FOV');
api.scheduler.didRender();
const requestsBeforeCamera=api.snapshot().renderRequests;
globalThis.LuminousVttSceneDirty.emit(canvas,{reason:'camera',render:true,vision:true,active:true,sourceEvent:'camera:follow'});
assert.equal(api.snapshot().renderRequests,requestsBeforeCamera,'camera-follow during traversal must not create a second render request');
assert.equal(api.snapshot().cameraRenderCoalesces,1);
engine.calculateVision();
assert.equal(rawVisionCalls,1,'camera-only changes must not recalculate world FOV');

engine.emitSemanticEvent('vtt:token-preview-moved',{tokenId:'p1'},{reason:'token',render:true,vision:true,active:true});
assert.equal(dirtyEvents.at(-1)?.vision,false,'raw token preview must be emitted as visual-only');
engine.calculateVision();
assert.equal(rawVisionCalls,1,'raw preview must not recalculate FOV');

engine.emitSemanticEvent('vtt:token-moved',{tokenId:'p1'},{reason:'token',render:true,vision:true,active:false});
assert.equal(dirtyEvents.at(-1)?.vision,true,'canonical endpoint must keep perception invalidation');
const second=engine.calculateVision();
assert.equal(second.version,2);
assert.equal(rawVisionCalls,2,'endpoint must recalculate FOV exactly once');
engine.calculateVision();
assert.equal(rawVisionCalls,2,'endpoint result must be cached after recompute');

const snapshot=api.snapshot();
assert.equal(snapshot.visionRecomputes,2);
assert.ok(snapshot.visionCacheHits>=102);
assert.ok(snapshot.cameraDirtyEvents>=1);
assert.ok(snapshot.cameraRenderCoalesces>=1);

api.stop();
assert.notEqual(engine.calculateVision,undefined);
globalThis.LuminousVttSceneDirty=previousSceneDirty;
console.log('vtt perception scheduler runtime: ok');
