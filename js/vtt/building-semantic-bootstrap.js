import './semantic-map-core.js';
import './building-semantic-core.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttBuildingSemanticRuntime?.api)return window.LuminousVttBuildingSemanticRuntime.api;
  const core=window.LuminousVttBuildingSemantics,semanticRuntime=runtime.semanticMap;
  if(!core||!semanticRuntime)throw new Error('BUILDING_SEMANTIC_RUNTIME_REQUIRED');
  mapData.semantics=core.normalizeModel(mapData.semantics||{});
  const api=Object.freeze({
    core,
    get semantics(){return mapData.semantics;},
    buildings:()=>core.normalizeBuildings(mapData.semantics.buildings),
    buildingById:(id)=>core.buildingById(mapData.semantics,id),
    buildingOf:(entityOrId)=>core.buildingOf(mapData.semantics,entityOrId),
    areasOfBuilding:(id)=>core.areasOfBuilding(mapData.semantics,id),
    pointsOfBuilding:(id)=>core.pointsOfBuilding(mapData.semantics,id),
    buildingLevels:(id)=>core.buildingLevels(mapData.semantics,id,mapData),
    areasOnBuildingLevel:(id,z)=>core.areasOnBuildingLevel(mapData.semantics,id,z),
    effectiveAccess:(entityOrId)=>core.effectiveAccess(mapData.semantics,entityOrId),
    areasByAccess:(id,access)=>core.areasByAccess(mapData.semantics,id,access),
    accessZones:(id)=>core.accessZones(mapData.semantics,id),
    entrancesOfBuilding:(id)=>core.entrancesOfBuilding(mapData.semantics,id),
    verticalConnectorsOfBuilding:(id)=>core.verticalConnectorsOfBuilding(mapData.semantics,id,mapData),
    entitiesByRole:(role)=>core.entitiesByRole(mapData.semantics,role),
    entitiesByCapability:(capability)=>core.entitiesByCapability(mapData.semantics,capability),
    validate:()=>core.validateBuildingSemantics(mapData.semantics,mapData),
  });
  window.LuminousVttBuildingSemanticRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,buildingSemantics:api});
  return api;
}
function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine&&runtime?.semanticMap){start({runtime,mapData:runtime.engine.mapData});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
