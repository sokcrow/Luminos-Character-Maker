import './building-archetype-core.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttBuildingArchetypeRuntime?.api)return window.LuminousVttBuildingArchetypeRuntime.api;
  const core=window.LuminousVttBuildingArchetypes,buildingRuntime=runtime.buildingSemantics;
  if(!core||!buildingRuntime)throw new Error('BUILDING_ARCHETYPE_RUNTIME_REQUIRED');
  const api=Object.freeze({
    core,
    list:()=>core.listArchetypes(),
    archetypeById:(id)=>core.archetypeById(id),
    requirementsFor:(id)=>core.requirementsFor(id),
    generatorContract:(id)=>core.generatorContract(id),
    register:(definition)=>core.registerArchetype(definition),
    unregister:(id)=>core.unregisterArchetype(id),
    validateBuilding:(buildingId)=>core.validateBuildingArchetype(mapData.semantics,buildingId,mapData),
    validateAll:()=>core.validateAllBuildingArchetypes(mapData.semantics,mapData),
  });
  window.LuminousVttBuildingArchetypeRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,buildingArchetypes:api});
  return api;
}

function boot(attempt=0){
  const runtime=window.LuminousVttRuntime;
  if(runtime?.engine&&runtime?.buildingSemantics){start({runtime,mapData:runtime.engine.mapData});return;}
  if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
