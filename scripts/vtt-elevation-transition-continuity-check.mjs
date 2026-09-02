import assert from 'node:assert/strict';

await import('../js/vtt/spatial-vision.js');
await import('../js/vtt/vertical-portal.js');
await import('../js/vtt/ramp-core.js');
await import('../js/vtt/ramp-portal-patch.js');
await import('../js/vtt/stair-route.js');
await import('../js/vtt/ramp-route-patch.js');
await import('../js/vtt/vertical-movement.js');
await import('../js/vtt/ramp-movement-patch.js');
const animation=await import('../js/vtt/vertical-transition-animation-runtime.js');

const mapData={
  grid:{cols:40,rows:40,size:70,distancePerCell:5,distanceUnit:'ft'},
  defaultZStepFt:15,
  zLevels:{
    '0':{zLayer:0,elevationFt:0,label:'Ground'},
    '1':{zLayer:1,elevationFt:15,label:'Upper'},
  },
  verticalPortals:[],
};

const portals=globalThis.LuminousVttVerticalPortal;
const ramps=globalThis.LuminousVttRamp;
const routes=globalThis.LuminousVttStairRoute;
const movement=globalThis.LuminousVttVerticalMovement;

assert.ok(portals?.createPortal);
assert.ok(ramps?.createRampPortal);
assert.ok(routes?.pointAtDistance);
assert.ok(movement?.transitionOnDrop);
assert.equal(movement.__rampAware,true,'vertical movement must be ramp-aware');

const stairs={...portals.createPortal({
  type:'stairs',from:{col:4,row:28},to:{col:7,row:28},fromZ:0,toZ:1,mapData,layout:'straight',widthFt:5,
}),id:'lab:elevation:stairs'};
const ramp={...ramps.createRampPortal({
  from:{col:4,row:20},to:{col:10,row:20},fromZ:0,toZ:1,mapData,widthFt:5,maxGrade:.5,costMultiplier:1,
}),id:'lab:elevation:ramp'};
mapData.verticalPortals=[stairs,ramp];

for(const portal of [stairs,ramp]){
  const route=routes.routeFor(portal,mapData);
  assert.ok(route.pathLengthFt>15,`${portal.type} must have a physical 3D path length`);
  const mid=routes.pointAtDistance(route,0,route.pathLengthFt/2,mapData);
  assert.ok(mid.elevationFt>0&&mid.elevationFt<15,`${portal.type} midpoint must have intermediate elevation`);

  const entry=routes.routeEntryForLayer(route,0);
  const partialToken={
    id:`token-${portal.type}`,
    x:entry.x,
    y:entry.y,
    zLayer:0,
    z:[0],
    gridPosition:{col:portal.from.col,row:portal.from.row,z:0},
    elevationFt:0,
    movementRemainingFt:route.pathLengthFt/2,
  };
  const partial=movement.transitionOnDrop(partialToken,{x:entry.x,y:entry.y},mapData);
  assert.equal(partial.valid,true);
  assert.equal(partial.complete,false,`${portal.type} must support partial traversal instead of teleporting`);
  assert.equal(partialToken.zLayer,0,'partial traversal stays on source zLayer');
  assert.ok(partialToken.elevationFt>0&&partialToken.elevationFt<15,'partial traversal changes physical elevation');
  assert.ok(partialToken.verticalMovement?.progressFt>0,'partial traversal records route progress');

  partialToken.movementRemainingFt=100;
  const completed=movement.transitionOnDrop(partialToken,{x:partialToken.x,y:partialToken.y},mapData);
  assert.equal(completed.valid,true);
  assert.equal(completed.complete,true);
  assert.equal(partialToken.zLayer,1,'zLayer changes only when the route is completed');
  assert.equal(partialToken.elevationFt,15);
  const exit=routes.routeEntryForLayer(route,1);
  assert.equal(partialToken.x,exit.x,'completion must end on the physical route exit x');
  assert.equal(partialToken.y,exit.y,'completion must end on the physical route exit y');
  const oldTeleportCenter=movement.centerForGridPosition(partialToken.gridPosition,mapData);
  assert.ok(Math.hypot(partialToken.x-oldTeleportCenter.x,partialToken.y-oldTeleportCenter.y)>1,
    'completion must not snap to the destination cell center');

  const sample=animation.sampleVerticalMotion({
    start:{x:entry.x,y:entry.y,elevationFt:0},
    route,sourceZ:0,startProgressFt:0,endProgressFt:route.pathLengthFt,mapData,ratio:.5,routeApi:routes,
  });
  assert.ok(sample.elevationFt>0&&sample.elevationFt<15,'animation sample must interpolate elevation during traversal');
  assert.ok(Math.hypot(sample.x-exit.x,sample.y-exit.y)>1,'mid-animation sample must not already be at the exit');
}

console.log('vtt elevation transition continuity: ok');
