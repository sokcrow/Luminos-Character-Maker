import assert from 'node:assert/strict';

await import('../js/vtt/map-authoring.js');
await import('../js/vtt/map-authoring-state.js');
const lab=await import('../js/vtt/map-test-lab.js');

const baseAuthoring=globalThis.LuminousVttMapAuthoring;
const state=globalThis.LuminousVttMapAuthoringState;

const root={
  LuminousVttMapAuthoring:baseAuthoring,
  document:{body:{classList:{contains:(name)=>name==='on-game-dashboard'}}},
};
const bridge=state.createBridge({root,mapData:{id:'seed'}});
const authoring=root.LuminousVttMapAuthoring;

const created=await lab.ensureTestLab({bridge,authoring});
assert.equal(created.id,lab.TEST_LAB_ID);
assert.equal(created.name,lab.TEST_LAB_NAME);
assert.equal(created.grid.cols,40);
assert.equal(created.grid.rows,40);
assert.equal(created.grid.size,70);
assert.equal(created.grid.distancePerCell,5);
assert.deepEqual(created.environmentTags,['test','laboratory','rama4']);
assert.equal(bridge.activeMapId(),'','creating the lab must not activate it');
assert.equal(bridge.list().length,1);

const same=await lab.ensureTestLab({bridge,authoring});
assert.equal(same.id,created.id,'ensuring an existing lab must reuse it');
assert.equal(bridge.list().length,1,'ensuring the lab twice must not duplicate it');

const checklist=lab.labChecklist();
assert.ok(checklist.includes('map_lifecycle'));
assert.ok(checklist.includes('grid_camera_renderer'));
assert.ok(checklist.includes('topology_authoring'));
assert.ok(checklist.includes('verticality'));
assert.ok(checklist.includes('tokens_movement'));
assert.ok(checklist.includes('pov_vision'));
assert.ok(checklist.includes('lighting'));
assert.ok(checklist.includes('fog_memory'));
assert.ok(checklist.includes('procedural_generation'));
assert.ok(checklist.includes('chunk_streaming'));
assert.ok(checklist.includes('npc_simulation'));
assert.equal(checklist.at(-1),'performance','performance must be tested only after correctness layers');

console.log('vtt map test lab: ok');
