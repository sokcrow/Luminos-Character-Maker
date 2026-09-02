import assert from 'node:assert/strict';
import {installTestLabTelemetry} from '../js/vtt/map-test-lab-telemetry.js';

const GRID=70;
const counters={
  visionRecomputes:0,visionInvalidations:0,visionCacheHits:0,renderRequests:0,renderedFrames:0,
  cameraDirtyEvents:0,cameraRenderCoalesces:0,activeFps:60,activeFrameTimeAvgMs:16.67,activeFrameTimeMaxMs:21.4,
};
const canvas=new EventTarget();
canvas.width=960;canvas.height=540;canvas.clientWidth=960;canvas.clientHeight=540;
canvas.getBoundingClientRect=()=>({width:960,height:540});
const topology=[];
for(let row=0;row<=40;row+=2)for(let col=0;col<40;col+=2)topology.push({id:`h:${col}:${row}`,type:'wall',from:{col,row},to:{col:Math.min(40,col+2),row}});
for(let col=0;col<=40;col+=2)for(let row=0;row<40;row+=2)topology.push({id:`v:${col}:${row}`,type:'wall',from:{col,row},to:{col,row:Math.min(40,row+2)}});
const token={id:'player:test',viewer:true,x:20.5*GRID,y:20.5*GRID,facingDeg:0};
const mapData={
  id:'luminous_test_lab',grid:{cols:40,rows:40,size:GRID,distancePerCell:5},topology,walls:[],tokens:[token],
  structures:Array.from({length:24},(_,i)=>({id:`structure:${i}`,position:{col:4+(i%12),row:8+Math.floor(i/12)}})),
  worldObjects:Array.from({length:80},(_,i)=>({id:`object:${i}`,x:(2+(i%20))*GRID,y:(3+Math.floor(i/20)*4)*GRID,radiusPx:16})),
  lights:Array.from({length:16},(_,i)=>({id:`light:${i}`,x:(6+(i%8)*3)*GRID,y:(8+Math.floor(i/8)*8)*GRID,radiusPx:30})),
  surfaceLayers:{'0':{}},
};
const engine={
  canvas,mapData,activeZ:0,legacyVisionRadius:10*GRID,
  renderer:{backend:'webgl2'},
  camera:{screenToWorld(x,y){return{x:x+13*GRID,y:y+16*GRID};}},
  viewerToken(){return token;},
  visionProfile(){return{fovDeg:120,radiusPx:10*GRID};},
  perceptionScheduler:{snapshot(){return{...counters};}},
};
const root={LuminousVttRuntime:{engine}};
const telemetry=installTestLabTelemetry(root,engine);
assert.ok(telemetry,'telemetry must install on luminous_test_lab');
let snapshot=telemetry.snapshot();
assert.equal(snapshot.renderer.webgl2,true,'Test Lab must identify the production WebGL2 backend');
assert.equal(snapshot.viewer.fovDeg,120,'player telemetry must preserve the 120 degree POV');
assert.equal(snapshot.workingSet.world.surfaces,1600,'empty surface overrides must still represent the full 40x40 grid working set');
assert.ok(snapshot.workingSet.viewport.total<snapshot.workingSet.world.total,'viewport candidates must be smaller than the whole Test Lab');
assert.ok(snapshot.workingSet.player120.total<snapshot.workingSet.world.total,'120 degree POV candidates must be smaller than the whole Test Lab');
assert.ok(snapshot.workingSet.dmSimplified.drawUnits.total<snapshot.workingSet.dmSimplified.visible.total,'DM simplified draw units must be below raw visible candidates');

for(let i=0;i<240;i++)canvas.dispatchEvent(new Event('vtt:token-preview-moved'));
snapshot=telemetry.snapshot();
assert.equal(snapshot.movement.previewFrames,240,'telemetry must count every visual preview frame');
assert.equal(snapshot.perception.visionRecomputes,0,'visual previews must not invent FOV recomputes');
assert.equal(snapshot.perception.visionInvalidations,0,'visual previews must not invent vision invalidations');

Object.assign(counters,{visionRecomputes:1,visionInvalidations:1,visionCacheHits:240,renderRequests:240,renderedFrames:240,cameraDirtyEvents:240,cameraRenderCoalesces:239});
snapshot=telemetry.snapshot();
assert.equal(snapshot.perception.visionRecomputes,1,'endpoint recompute must be visible in Test Lab telemetry');
assert.equal(snapshot.perception.visionCacheHits,240,'cached traversal vision must be visible in Test Lab telemetry');
assert.equal(snapshot.frame.renderedFrames,240,'rendered frame delta must be visible in Test Lab telemetry');
assert.equal(snapshot.frame.fps,60);
assert.equal(snapshot.frame.avgMs,16.67);
assert.equal(snapshot.frame.maxMs,21.4);

telemetry.reset();
snapshot=telemetry.snapshot();
assert.equal(snapshot.movement.previewFrames,0,'reset must establish a fresh manual-test baseline');
assert.equal(snapshot.perception.visionRecomputes,0,'reset must zero session deltas without touching scheduler totals');
assert.equal(telemetry.stop(),true);
assert.equal(engine.__testLabTelemetry,undefined);
console.log('vtt Test Lab telemetry: ok');
