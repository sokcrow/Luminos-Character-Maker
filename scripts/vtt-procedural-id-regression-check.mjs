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
// Deliberately do not load procedural-topology-optimizer here. ID allocation must be
// testable independently from geometry compaction/performance work.
await import('../js/vtt/procedural-building-mix-patch.js');
await import('../js/vtt/procedural-id-auditor.js');
await import('../js/vtt/procedural-generator-core.js');

const generator=globalThis.LuminousVttProceduralGenerator;
const fabric=globalThis.LuminousVttUrbanFabric;
const auditor=globalThis.LuminousVttProceduralIdAuditor;
assert.ok(generator?.generateAttempt,'procedural generator must load');
assert.ok(auditor?.auditPlan,'procedural id auditor must load');

const profiles=Object.keys(fabric.PROFILES||{});
assert.deepEqual(profiles.sort(),['commercial','dense_backstreet','industrial','mixed_urban','open_complex','residential']);

const seeds=Array.from({length:8},(_,index)=>`rama4-id-${String(index+1).padStart(2,'0')}`);
const duplicateCodes=new Set(['SEMANTIC_DUPLICATE_ID','BUILDING_DUPLICATE_ID','ZONE_SOCKET_DUPLICATE_ID','PROCEDURAL_DUPLICATE_ID']);
const rows=[];
let plansChecked=0;

for(const profileId of profiles){
  let validPlans=0;
  for(const seed of seeds){
    // The live runtime currently generates one 40x40 chunk. Keep this P0 gate faithful to that path;
    // 3x3/120x120 belongs to the separate heavy performance suite.
    const mapId=`field_${profileId}_${seed}`;
    for(let attempt=0;attempt<3;attempt++){
      const plan=generator.generateAttempt({zoneId:`${mapId}:zone:0:0`,seed,profileId,gridSize:70,minBuildings:1,chunkCols:1,chunkRows:1},attempt);
      const audit=auditor.auditPlan(plan,{mapId,zoneId:plan.zone?.id,profileId,seed,attempt});
      plansChecked++;
      if(plan.validation?.valid)validPlans++;

      const validatorDuplicates=(plan.validation?.errors||[]).filter(error=>duplicateCodes.has(error?.code));
      if(!audit.valid||validatorDuplicates.length){
        const detail=[...audit.errors.map(auditor.format),...validatorDuplicates.map(error=>JSON.stringify(error))].join('\n');
        assert.fail(`duplicate procedural id detected\n${detail}`);
      }
    }
  }
  rows.push({profileId,seeds:seeds.length,attemptsPerSeed:3,plansChecked:seeds.length*3,validPlans});
}

assert.equal(plansChecked,profiles.length*seeds.length*3);
console.table(rows);
console.log(JSON.stringify({profiles:profiles.length,seedsPerProfile:seeds.length,attemptsPerSeed:3,plansChecked,duplicateIds:0}));
console.log('vtt procedural id regression: ok');
