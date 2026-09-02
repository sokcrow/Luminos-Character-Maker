export const TEST_LAB_ID='luminous_test_lab';
export const TEST_LAB_NAME='LUMINOUS TEST LAB';
export const TEST_LAB_TAGS=Object.freeze(['test','laboratory','rama4']);
export const TEST_LAB_GRID=Object.freeze({
  cols:40,
  rows:40,
  size:70,
  distancePerCell:5,
  distanceUnit:'ft',
});

export function testLabTemplate(authoring){
  if(!authoring?.createDefinition)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
  return authoring.createDefinition({
    id:TEST_LAB_ID,
    name:TEST_LAB_NAME,
    grid:{...TEST_LAB_GRID},
    environmentTags:[...TEST_LAB_TAGS],
    defaultZStepFt:15,
  });
}

export function isTestLab(definition){
  return String(definition?.id||'')===TEST_LAB_ID;
}

export async function ensureTestLab({bridge,authoring}={}){
  if(!bridge||!authoring)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
  const existing=bridge.get?.(TEST_LAB_ID);
  if(existing)return existing;
  const draft=testLabTemplate(authoring);
  const create=typeof bridge.createDefinition==='function'
    ? bridge.createDefinition.bind(bridge)
    : bridge.saveDefinition?.bind(bridge);
  if(!create)throw new Error('MAP_CREATE_RUNTIME_REQUIRED');
  const created=await create(draft);
  if(!created?.id)throw new Error('TEST_LAB_CREATE_FAILED');
  return created;
}

export function labChecklist(){
  return Object.freeze([
    'map_lifecycle',
    'grid_camera_renderer',
    'topology_authoring',
    'verticality',
    'structures_world_objects',
    'tokens_movement',
    'pov_vision',
    'lighting',
    'fog_memory',
    'procedural_generation',
    'chunk_streaming',
    'npc_simulation',
    'performance',
  ]);
}
