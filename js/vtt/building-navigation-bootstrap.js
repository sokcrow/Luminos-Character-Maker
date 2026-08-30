import './building-navigation-core.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttBuildingNavigationRuntime?.api)return window.LuminousVttBuildingNavigationRuntime.api;
  const core=window.LuminousVttBuildingNavigation,buildings=runtime.buildingSemantics;
  if(!core||!buildings)throw new Error('BUILDING_NAVIGATION_RUNTIME_REQUIRED');
  const api=Object.freeze({
    core,
    buildGraph:(buildingId)=>core.buildGraph(mapData.semantics,buildingId,mapData),
    validateBuilding:(buildingId)=>core.validateGraph(mapData.semantics,buildingId,mapData),
    validateAll:()=>{
      const results=buildings.buildings().map(b=>core.validateGraph(mapData.semantics,b.id,mapData));
      const errors=results.flatMap(r=>r.errors),warnings=results.flatMap(r=>r.warnings);
      return{valid:errors.length===0,errors,warnings,results,summary:{buildings:results.length,nodes:results.reduce((n,r)=>n+(r.summary?.nodes||0),0),edges:results.reduce((n,r)=>n+(r.summary?.edges||0),0)}};
    },
    route:(buildingId,fromId,toId,options={})=>core.shortestRoute(core.buildGraph(mapData.semantics,buildingId,mapData),fromId,toId,options),
    structuralRoute:(buildingId,fromId,toId,options={})=>core.shortestRoute(core.buildGraph(mapData.semantics,buildingId,mapData),fromId,toId,{...options,mode:'structural',ignoreAccess:true}),
    routeContext:(buildingId,fromId,toId,options={})=>{
      const graph=core.buildGraph(mapData.semantics,buildingId,mapData),route=core.shortestRoute(graph,fromId,toId,options);
      return{buildingId,fromId,toId,route,graphSummary:{nodes:graph.nodes.length,edges:graph.edges.length},physicalRefs:route.found?[...new Set(route.edges.map(e=>e.physicalRefId).filter(Boolean))]:[],accessTransitions:route.accessTransitions||[],interactions:route.interactions||[]};
    },
  });
  window.LuminousVttBuildingNavigationRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,buildingNavigation:api});
  return api;
}
function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine&&runtime?.buildingSemantics){start({runtime,mapData:runtime.engine.mapData});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
