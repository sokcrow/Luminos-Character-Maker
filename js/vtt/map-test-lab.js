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
export const TEST_LAB_UPPER_Z=1;
export const TEST_LAB_UPPER_ELEVATION_FT=15;

export const TEST_LAB_IDS=Object.freeze({
  ramp:'lab:elevation:ramp',
  stairs:'lab:elevation:stairs',
  structures:Object.freeze([
    'lab:structure:pillar:7_12',
    'lab:structure:pillar:9_12',
    'lab:structure:barrier:8_11_8_12',
  ]),
});

export function labStructures(){
  return[
    {id:TEST_LAB_IDS.structures[0],definitionId:'pillar:concrete',type:'pillar',position:{col:7,row:12,zLayer:0},zLayer:0},
    {id:TEST_LAB_IDS.structures[1],definitionId:'pillar:concrete',type:'pillar',position:{col:9,row:12,zLayer:0},zLayer:0},
    {id:TEST_LAB_IDS.structures[2],definitionId:'barrier:concrete',type:'barrier',from:{col:8,row:11},to:{col:8,row:12},zLayer:0},
  ];
}

export function labScenarioMatrix(){
  return Object.freeze({
    control:Object.freeze({
      id:'control',
      label:'CONTROL · SAME ROUTE / NO STRUCTURES',
      from:Object.freeze({col:4,row:12,z:0}),
      to:Object.freeze({col:14,row:12,z:0}),
      expectation:'Direct planar movement with no structural detour.',
    }),
    structures:Object.freeze({
      id:'structures',
      label:'STRUCTURES · SAME ROUTE / PHYSICAL OBSTACLES',
      from:Object.freeze({col:4,row:12,z:0}),
      to:Object.freeze({col:14,row:12,z:0}),
      expectation:'Same A→B as CONTROL, but pathfinding must route around physical structures.',
    }),
    ramp:Object.freeze({
      id:'ramp',
      label:'ELEVATION · RAMP',
      from:Object.freeze({col:4,row:20,z:0,elevationFt:0}),
      to:Object.freeze({col:10,row:20,z:1,elevationFt:TEST_LAB_UPPER_ELEVATION_FT}),
      expectation:'x/y/elevationFt change continuously; zLayer changes only at the physical exit.',
    }),
    stairs:Object.freeze({
      id:'stairs',
      label:'ELEVATION · STAIRS',
      from:Object.freeze({col:4,row:28,z:0,elevationFt:0}),
      to:Object.freeze({col:7,row:28,z:1,elevationFt:TEST_LAB_UPPER_ELEVATION_FT}),
      expectation:'Traverse the stair route continuously; never snap to the destination cell center.',
    }),
  });
}

export function testLabTemplate(authoring){
  if(!authoring?.createDefinition)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
  let definition=authoring.createDefinition({
    id:TEST_LAB_ID,
    name:TEST_LAB_NAME,
    grid:{...TEST_LAB_GRID},
    environmentTags:[...TEST_LAB_TAGS],
    defaultZStepFt:TEST_LAB_UPPER_ELEVATION_FT,
    structures:labStructures(),
  });
  if(authoring.addLevel&&!definition.zLevels?.[String(TEST_LAB_UPPER_Z)]){
    definition=authoring.addLevel(definition,0,1,{elevationFt:TEST_LAB_UPPER_ELEVATION_FT,label:'Elevation Lab'});
  }
  return definition;
}

export function isTestLab(definition){
  return String(definition?.id||'')===TEST_LAB_ID;
}

function needsUpgrade(definition){
  if(!definition)return true;
  if(!definition.zLevels?.[String(TEST_LAB_UPPER_Z)])return true;
  const ids=new Set((definition.structures||[]).map(entry=>String(entry?.id||'')));
  return TEST_LAB_IDS.structures.some(id=>!ids.has(id));
}

function upgradedDefinition(authoring,existing){
  let next=existing;
  if(authoring.addLevel&&!next.zLevels?.[String(TEST_LAB_UPPER_Z)]){
    next=authoring.addLevel(next,0,1,{elevationFt:TEST_LAB_UPPER_ELEVATION_FT,label:'Elevation Lab'});
  }
  if(Array.isArray(next.structures)){
    const ids=new Set(next.structures.map(entry=>String(entry?.id||'')));
    next={...next,structures:[...next.structures,...labStructures().filter(entry=>!ids.has(entry.id))]};
    if(authoring.normalizeDefinition)next=authoring.normalizeDefinition(next,next);
  }
  return next;
}

export async function ensureTestLab({bridge,authoring}={}){
  if(!bridge||!authoring)throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
  const existing=bridge.get?.(TEST_LAB_ID);
  if(existing){
    if(needsUpgrade(existing)&&typeof bridge.saveDefinition==='function'){
      return bridge.saveDefinition(upgradedDefinition(authoring,existing));
    }
    return existing;
  }
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
