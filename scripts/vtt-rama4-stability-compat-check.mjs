import assert from 'node:assert/strict';
import { installRama4FieldStabilityCompat } from '../js/vtt/rama4-field-stability-compat.js';

class Host extends EventTarget{
  constructor(){
    super();this.parent=this;this.document={};this.CustomEvent=globalThis.CustomEvent;this.performance=globalThis.performance;this.queueMicrotask=queueMicrotask;this.actorValueHandler=null;
    this.firebase={database:()=>({ref:()=>({on:(event,handler)=>{if(event==='value'){this.actorValueHandler=handler;handler({val:()=>({actor_a:{id:'actor_a',icono:'actor-a.png'}})});}},off:()=>{}})})};
  }
}
const host=new Host(),canvas=new EventTarget(),dirtyEvents=[],syncCalls=[];
host.LuminousVttSceneDirty={emit(target,detail){dirtyEvents.push(detail);target.dispatchEvent(new CustomEvent('vtt:scene-dirty',{detail}));return true;}};
let rawCameraDirty=0,rawVisionCalls=0;
const originalCalculateVision=()=>{rawVisionCalls+=1;return{version:rawVisionCalls};};
const engine={
  canvas,mapData:{tokens:[{id:'player:p1',actorId:'actor_a',canonicalScope:'player',x:10,y:20,zLayer:0}]},activeZ:0,cameraFollowActive:true,tokenDrag:null,tokenMotion:null,
  renderer:{syncTokenView(id){syncCalls.push(id);return true;}},
  camera:{notifyVisualChange(){rawCameraDirty+=1;}},
  calculateVision:originalCalculateVision,
  emitSemanticEvent(){},
};
host.LuminousVttRuntime={engine};
const compat=installRama4FieldStabilityCompat(host);compat.ensure();
await Promise.resolve();await Promise.resolve();

assert.equal(engine.calculateVision,originalCalculateVision,'Rama 4 stability compatibility must not wrap perception');
engine.calculateVision();engine.calculateVision();
assert.equal(rawVisionCalls,2,'vision must remain owned by the scheduler layer, not this compatibility module');

engine.tokenMotion={tokenId:'player:p1'};
engine.camera.notifyVisualChange('center',false,{});
assert.equal(rawCameraDirty,0,'traversal camera centering must not emit a duplicate dirty pulse');
engine.tokenMotion=null;
engine.camera.notifyVisualChange('center',false,{});
assert.equal(rawCameraDirty,1);

engine.tokenDrag={token:engine.mapData.tokens[0]};
host.dispatchEvent(new Event('mousedown'));
await Promise.resolve();
assert.equal(engine.cameraFollowActive,false,'raw drag must suspend camera-follow work');
host.dispatchEvent(new Event('mouseup'));
assert.equal(engine.cameraFollowActive,true);
engine.tokenDrag=null;

await Promise.resolve();
assert.equal(engine.mapData.tokens[0].icono,'actor-a.png');
assert.equal(engine.mapData.tokens[0].tokenImage,'actor-a.png');
assert.equal(engine.mapData.tokens[0].portrait,'actor-a.png');
assert.ok(syncCalls.includes('player:p1'));
assert.equal(dirtyEvents.at(-1)?.vision,false,'appearance hydration must remain render-only');

const snapshot=compat.snapshot();
assert.equal(snapshot.perceptionOwner,'PerceptionSchedulerRuntime');
assert.ok(snapshot.traversalCameraDirtySuppressions>=1);
assert.ok(snapshot.rawDragFollowSuspends>=1);
assert.ok(snapshot.playerIconsHydrated>=1);
compat.stop();
console.log('vtt Rama 4 field stability compatibility: ok');
