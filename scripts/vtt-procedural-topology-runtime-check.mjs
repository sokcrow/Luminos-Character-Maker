import assert from 'node:assert/strict';
await import('../js/vtt/topology.js');
await import('../js/vtt/token-interaction.js');
await import('../js/vtt/pathfinding.js');
await import('../js/vtt/procedural-topology-optimizer.js');

const topology=globalThis.LuminousVttTopology;
const pathfinding=globalThis.LuminousVttPathfinding;
const optimizer=globalThis.LuminousVttProceduralTopologyOptimizer;
assert.ok(topology?.blockingSegments&&pathfinding?.findPath&&optimizer?.optimizeTopology);

const context={generated:true,zoneId:'zone',buildingId:'b1',parcelId:'p1'};
const wall=(id,a,b)=>({id,type:'wall',from:a,to:b,z:[0],thicknessFt:.5,procedural:{...context}});
const door=(state='closed')=>({id:'door-main',type:'door',from:{col:2,row:2},to:{col:3,row:2},z:[0],state,thicknessFt:.5,procedural:{...context}});
const raw=[
  wall('w0',{col:0,row:2},{col:1,row:2}),
  wall('w1',{col:1,row:2},{col:2,row:2}),
  door('closed'),
  wall('w3',{col:3,row:2},{col:4,row:2}),
  wall('w4',{col:4,row:2},{col:5,row:2}),
];
const optimized=optimizer.optimizeTopology(raw,{buildingCount:1}).topology;
assert.deepEqual(optimized.map(x=>x.type),['wall','door','wall']);
assert.equal(optimized.filter(x=>x.type==='wall').length,2);

const mapData={
  grid:{cols:5,rows:5,size:70,distancePerCell:5},
  topology:optimized,
  walls:[],tokens:[],movement:{blockTokens:false},
};
const token={id:'p1',x:175,y:105,zLayer:0,z:[0],radius:18,draggable:true};
mapData.tokens=[token];
const start={x:175,y:105};
const target={x:175,y:245};

const closedVision=topology.blockingSegments(mapData.topology,'vision',0,mapData.grid,mapData);
const closedMovement=topology.blockingSegments(mapData.topology,'movement',0,mapData.grid,mapData);
assert.equal(closedVision.length,3,'closed door must remain a vision blocker between compacted walls');
assert.equal(closedMovement.length,3,'closed door must remain a movement blocker between compacted walls');
const closedPath=pathfinding.findPath({token,start,target,mapData,zLayer:0,blockTokens:false,maxVisited:2000});
assert.equal(closedPath.valid,false,'pathfinding must not cross the compacted wall through a closed door');

mapData.topology=mapData.topology.map(x=>x.id==='door-main'?{...x,state:'open'}:x);
const openVision=topology.blockingSegments(mapData.topology,'vision',0,mapData.grid,mapData);
const openMovement=topology.blockingSegments(mapData.topology,'movement',0,mapData.grid,mapData);
assert.equal(openVision.length,2,'open door must create a real FOV opening');
assert.equal(openMovement.length,2,'open door must create a real movement opening');
const openPath=pathfinding.findPath({token,start,target,mapData,zLayer:0,blockTokens:false,maxVisited:2000});
assert.equal(openPath.valid,true,'pathfinding must cross the preserved opening when the door opens');

console.log('vtt optimized topology runtime semantics: ok');
