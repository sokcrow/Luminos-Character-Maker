import assert from 'node:assert/strict';

await import('../js/vtt/map-authoring.js');
await import('../js/vtt/map-authoring-state.js');
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
// Keep this ID-flow check independent from geometry compaction cost.
await import('../js/vtt/procedural-building-mix-patch.js');
await import('../js/vtt/procedural-id-auditor.js');
await import('../js/vtt/procedural-generator-core.js');

const state=globalThis.LuminousVttMapAuthoringState;
const baseAuthoring=globalThis.LuminousVttMapAuthoring;
const generator=globalThis.LuminousVttProceduralGenerator;
const auditor=globalThis.LuminousVttProceduralIdAuditor;
assert.ok(state?.createBridge&&baseAuthoring?.createDefinition&&generator?.generateAttempt&&auditor?.auditPlan);

const root={
  LuminousVttMapAuthoring:baseAuthoring,
  document:{body:{classList:{contains:(name)=>name==='on-game-dashboard'}}},
};
const bridge=state.createBridge({root,mapData:{id:'field_seed',grid:{cols:30,rows:30,size:70,distancePerCell:5}}});
const authoring=root.LuminousVttMapAuthoring;
const candidate='new_procedural_frozen_clock';
const maps=[];

for(let index=0;index<3;index++){
  const created=await bridge.saveDefinition(authoring.createDefinition({
    id:candidate,
    name:'New Procedural Map',
    grid:{cols:30,rows:30,size:70,distancePerCell:5},
    environmentTags:['urban'],
  }));
  maps.push(created);
}

assert.deepEqual(maps.map((map)=>map.id),[candidate,`${candidate}_2`,`${candidate}_3`]);
assert.equal(bridge.list().length,3);

for(const [index,map] of maps.entries()){
  const seed=`rama4-new-map-procedural-${index+1}`;
  const plan=generator.generateAttempt({
    zoneId:`${map.id}:zone:0:0`,
    seed,
    profileId:'mixed_urban',
    gridSize:70,
    minBuildings:1,
    chunkCols:1,
    chunkRows:1,
  },0);
  const audit=auditor.auditPlan(plan,{mapId:map.id,zoneId:plan.zone?.id,profileId:'mixed_urban',seed,attempt:0});
  if(!audit.valid){
    assert.fail(`duplicate id after NEW MAP -> procedural flow\n${audit.errors.map(auditor.format).join('\n')}`);
  }
  const validatorDuplicates=(plan.validation?.errors||[]).filter((error)=>String(error?.code||'').includes('DUPLICATE_ID'));
  assert.deepEqual(validatorDuplicates,[],`validator duplicate after procedural generation for ${map.id}`);
}

console.log(JSON.stringify({createdMaps:maps.map((map)=>map.id),proceduralPlans:maps.length,duplicateIds:0}));
console.log('vtt new-map to procedural flow: ok');
