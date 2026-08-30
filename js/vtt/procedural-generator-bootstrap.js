import './topology.js';
import './surface-core.js';
import './horizontal-plane-core.js';
import './building-physics-core.js';
import './procedural-zone-core.js';
import './urban-fabric-core.js';
import './procedural-building-generator.js';
import './procedural-building-mix-patch.js';
import './procedural-generator-core.js';
import './procedural-map-authoring-patch.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttProceduralGeneratorRuntime?.api)return window.LuminousVttProceduralGeneratorRuntime.api;
  window.LuminousVttProceduralMapAuthoringPatch?.install?.();
  const core=window.LuminousVttProceduralGenerator,zoneCore=window.LuminousVttProceduralZone,fabric=window.LuminousVttUrbanFabric,buildings=window.LuminousVttProceduralBuildings;
  if(!core||!zoneCore||!fabric||!buildings)throw new Error('PROCEDURAL_GENERATOR_RUNTIME_REQUIRED');
  let lastPlan=null;
  function emit(name,detail={}){runtime.engine.canvas?.dispatchEvent?.(new CustomEvent(name,{detail}));window.dispatchEvent?.(new CustomEvent(name,{detail}));}
  function preview(options={}){
    const {profile,profileId,...rest}=options||{};
    const profileInput=profile||profileId||'mixed_urban';
    lastPlan=core.generateZone({
      zoneId:rest.zoneId||`zone_${mapData.id||mapData.mapId||'active'}`,
      profileId:profileInput,
      seed:rest.seed||`${mapData.id||mapData.mapId||'map'}:zone`,
      sockets:rest.sockets||mapData.procedural?.zone?.sockets||[],
      gridSize:mapData.grid?.size||70,
      ...rest,
    });
    emit('vtt:procedural-preview',{signature:lastPlan.signature,seed:lastPlan.seed,profileId:lastPlan.profileId,summary:lastPlan.validation.summary,zone:lastPlan.zone});
    return lastPlan;
  }
  async function persist(plan=lastPlan){
    if(!plan)throw new Error('PROCEDURAL_PREVIEW_REQUIRED');
    if(!runtime.bridge?.isDm)throw new Error('DM_REQUIRED');
    if(typeof runtime.bridge?.replaceAll!=='function')throw new Error('TOPOLOGY_REPLACE_ALL_REQUIRED');
    await runtime.bridge.replaceAll(mapData.topology||[]);
    if(typeof runtime.verticalBridge?.replaceAll==='function')await runtime.verticalBridge.replaceAll(mapData.verticalPortals||[]);
    const liveRuntime=window.LuminousVttRuntime||runtime;
    if(typeof liveRuntime.worldObjects?.bridge?.replaceAll==='function')await liveRuntime.worldObjects.bridge.replaceAll(mapData.worldObjects||[]);
    const authoring=window.LuminousVttMapAuthoring,mapBridge=liveRuntime.mapAuthoring?.bridge;
    if(!authoring?.definitionFromMapData||!mapBridge?.saveDefinition)throw new Error('MAP_AUTHORING_PERSISTENCE_REQUIRED');
    await mapBridge.saveDefinition(authoring.definitionFromMapData(mapData));
    emit('vtt:procedural-persisted',{signature:plan.signature,seed:plan.seed,profileId:plan.profileId,zone:plan.zone});
    return mapData;
  }
  function apply(plan=lastPlan,options={}){
    if(!plan)throw new Error('PROCEDURAL_PREVIEW_REQUIRED');
    const shouldPersist=options.persist!==false;
    core.applyPlan(mapData,plan,options);lastPlan=plan;
    runtime.semanticMap?.touch?.('procedural-applied');
    runtime.engine.renderer?.invalidate?.();
    emit('vtt:procedural-applied',{signature:plan.signature,seed:plan.seed,profileId:plan.profileId,summary:plan.validation.summary,zone:plan.zone});
    if(shouldPersist&&runtime.bridge?.isDm){
      Promise.resolve().then(()=>persist(plan)).catch((error)=>{
        emit('vtt:procedural-persist-failed',{signature:plan.signature,error:String(error?.message||error)});
        runtime.controller?.notify?.(`Zona aplicada, pero no se pudo guardar: ${String(error?.message||error)}`,'warning');
      });
    }
    return mapData;
  }
  async function createZone(options={},applyOptions={}){const plan=preview(options);apply(plan,{...applyOptions,persist:false});await persist(plan);return plan;}
  const api=Object.freeze({
    core,zoneCore,fabric,buildings,
    profiles:()=>Object.values(fabric.PROFILES).map(x=>({...x})),
    profile:(id='mixed_urban')=>({...fabric.normalizeProfile(id)}),
    buildingMix:(id='mixed_urban')=>({...buildings.normalizeBuildingMix?.(buildings.WEIGHTS?.[id]||buildings.WEIGHTS?.mixed_urban,id)}),
    preview,apply,persist,createZone,
    generateAndApply:createZone,
    getLastPlan:()=>lastPlan,
    currentMetadata:()=>mapData.procedural||null,
    continuationRequirements:(zone=lastPlan?.zone||mapData.procedural?.zone)=>zone?zoneCore.continuationRequirements(zone):[],
    validatePlan:(plan=lastPlan)=>plan?.validation||null,
    stop(){lastPlan=null;},
  });
  window.LuminousVttProceduralGeneratorRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,procedural:api});
  return api;
}

function boot(attempt=0){
  const runtime=window.LuminousVttRuntime;
  if(runtime?.engine&&runtime?.buildingSemantics&&runtime?.buildingNavigation){start({runtime,mapData:runtime.engine.mapData});return;}
  if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
