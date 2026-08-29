import './building-physics-core.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttBuildingPhysicsRuntime?.api)return window.LuminousVttBuildingPhysicsRuntime.api;
  const core=window.LuminousVttBuildingPhysics;
  if(!core)throw new Error('BUILDING_PHYSICS_RUNTIME_REQUIRED');
  const api=Object.freeze({
    core,
    validatePlan:(plan)=>core.validatePlan(plan,mapData),
    normalizePlan:(plan)=>core.normalizePlan(plan,mapData),
    stop(){},
  });
  window.LuminousVttBuildingPhysicsRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,buildingPhysics:api});
  return api;
}

function boot(attempt=0){
  const runtime=window.LuminousVttRuntime;
  if(runtime?.engine){start({runtime,mapData:runtime.engine.mapData});return;}
  if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();