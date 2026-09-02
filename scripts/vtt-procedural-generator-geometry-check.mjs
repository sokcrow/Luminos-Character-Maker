import assert from 'node:assert/strict';

await import('../js/vtt/topology.js');
await import('../js/vtt/surface-core.js');
await import('../js/vtt/horizontal-plane-core.js');
await import('../js/vtt/building-physics-core.js');
await import('../js/vtt/semantic-map-core.js');
await import('../js/vtt/building-semantic-core.js');
await import('../js/vtt/building-archetype-core.js');
await import('../js/vtt/vertical-portal.js');
await import('../js/vtt/building-navigation-core.js');
await import('../js/vtt/procedural-zone-core.js');
await import('../js/vtt/urban-fabric-core.js');
await import('../js/vtt/procedural-building-generator.js');
await import('../js/vtt/procedural-topology-optimizer.js');
await import('../js/vtt/procedural-building-mix-patch.js');
await import('../js/vtt/procedural-generator-core.js');

const generator=globalThis.LuminousVttProceduralGenerator;
assert.ok(generator?.generateZone,'procedural generator must load');

const seeds=['rama4-field-a','rama4-field-b','rama4-field-c'];
const rows=[];
for(const seed of seeds){
  const plan=generator.generateZone({zoneId:`zone_${seed}`,seed,profileId:'mixed_urban',gridSize:70,maxAttempts:12,minBuildings:4});
  assert.equal(plan.validation.valid,true,`generated plan ${seed} must validate`);
  const geometry=plan.generated?.geometryDiagnostics;
  assert.ok(geometry,'runtime generator must expose geometry diagnostics');
  assert.equal(geometry.buildings,plan.mapData.semantics.buildings.length);
  assert.equal(geometry.optimizedTopologyElements,plan.mapData.topology.length);
  assert.ok(geometry.rawWallSegments>=geometry.optimizedWallSegments);
  assert.ok(geometry.absoluteReduction>0,'representative procedural zone should compact at least one wall run');
  assert.ok(geometry.reductionPercent>0);
  assert.ok(Object.keys(plan.generated?.topologySourceIdMap||{}).length>=geometry.optimizedWallSegments,'source id translation metadata must survive generation');
  rows.push({seed,buildings:geometry.buildings,rawWalls:geometry.rawWallSegments,optimizedWalls:geometry.optimizedWallSegments,reductionPercent:Number(geometry.reductionPercent.toFixed(1)),doors:geometry.doors,windows:geometry.windows,visionBlocking:geometry.visionBlockingSegments});
}

const totals=rows.reduce((acc,row)=>({raw:acc.raw+row.rawWalls,optimized:acc.optimized+row.optimizedWalls}),{raw:0,optimized:0});
assert.ok(totals.optimized<totals.raw,'generator integration must reduce wall count across representative zones');
console.table(rows);
console.log(JSON.stringify({rawWalls:totals.raw,optimizedWalls:totals.optimized,reductionPercent:Number((((totals.raw-totals.optimized)/totals.raw)*100).toFixed(1))}));
console.log('vtt procedural generator geometry: ok');
