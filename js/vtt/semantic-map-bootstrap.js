import './semantic-map-core.js';
import './semantic-map-authoring-patch.js';
import './semantic-map-renderer-patch.js';
import { start as startBuildingSemantics } from './building-semantic-bootstrap.js';
import { start as startBuildingSemanticAuthoring } from './building-semantic-authoring-bootstrap.js';
import { start as startBuildingArchetypes } from './building-archetype-bootstrap.js';
import { start as startBuildingArchetypeAuthoring } from './building-archetype-authoring-bootstrap.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttSemanticMapRuntime?.api)return window.LuminousVttSemanticMapRuntime.api;
  const core=window.LuminousVttSemanticMap;if(!core)throw new Error('SEMANTIC_MAP_RUNTIME_REQUIRED');
  window.LuminousVttSemanticMapAuthoringPatch?.install?.();
  mapData.semantics=core.normalizeSemantics(mapData.semantics||{});
  mapData.semanticEditor||={visible:false,selectedId:null,preview:null};
  let revision=0,index=null,indexRevision=-1,stopped=false;
  const stopRenderer=window.LuminousVttSemanticMapRendererPatch?.install?.(runtime.engine.renderer,mapData)||(()=>{});
  function ensureIndex(){if(!index||indexRevision!==revision){index=core.buildCellIndex(mapData.semantics,mapData);indexRevision=revision;}return index;}
  function touch(reason='semantic-change'){revision+=1;index=null;runtime.engine.canvas?.dispatchEvent?.(new CustomEvent('vtt:semantics-changed',{detail:{reason,revision}}));return revision;}
  function replace(next,reason='replace'){mapData.semantics=core.normalizeSemantics(next||{});touch(reason);return mapData.semantics;}
  const api=Object.freeze({
    core,
    get semantics(){return mapData.semantics;},
    touch,
    replace,
    index:ensureIndex,
    semanticAt:(z,col,row)=>core.semanticAt(mapData.semantics,ensureIndex(),z,col,row),
    entityById:(id)=>core.entityById(mapData.semantics,id),
    areasByFunction:(type)=>core.areasByFunction(mapData.semantics,type),
    areasBySpatialType:(type)=>core.areasBySpatialType(mapData.semantics,type),
    childrenOf:(id)=>core.childrenOf(mapData.semantics,id),
    relationsFrom:(id)=>core.relationsFrom(mapData.semantics,id),
    relationsTo:(id)=>core.relationsTo(mapData.semantics,id),
    validate:()=>core.validateSemantics(mapData.semantics,mapData),
    stop(){if(stopped)return;stopped=true;stopRenderer();},
  });
  window.LuminousVttSemanticMapRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,semanticMap:api});
  const buildingRuntime=startBuildingSemantics({runtime:window.LuminousVttRuntime,mapData});
  if(buildingRuntime&&window.LuminousVttRuntime?.bridge?.isDm)startBuildingSemanticAuthoring({runtime:window.LuminousVttRuntime,mapData});
  const archetypeRuntime=buildingRuntime?startBuildingArchetypes({runtime:window.LuminousVttRuntime,mapData}):null;
  if(archetypeRuntime&&window.LuminousVttRuntime?.bridge?.isDm)startBuildingArchetypeAuthoring({runtime:window.LuminousVttRuntime,mapData});
  return api;
}
function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine){const api=start({runtime,mapData:runtime.engine.mapData});if(api)window.addEventListener('beforeunload',()=>api.stop?.(),{once:true});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
