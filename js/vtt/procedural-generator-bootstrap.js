import './topology.js';
import './surface-core.js';
import './horizontal-plane-core.js';
import './building-physics-core.js';
import './procedural-zone-core.js';
import './urban-fabric-core.js';
import './procedural-building-generator.js';
import './procedural-generator-core.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttProceduralGeneratorRuntime?.api)return window.LuminousVttProceduralGeneratorRuntime.api;
  const core=window.LuminousVttProceduralGenerator,zoneCore=window.LuminousVttProceduralZone,fabric=window.LuminousVttUrbanFabric;
  if(!core||!zoneCore||!fabric)throw new Error('PROCEDURAL_GENERATOR_RUNTIME_REQUIRED');
  let lastPlan=null;
  function emit(name,detail={}){runtime.engine.canvas?.dispatchEvent?.(new CustomEvent(name,{detail}));window.dispatchEvent?.(new CustomEvent(name,{detail}));}
  function preview(options={}){
    lastPlan=core.generateZone({zoneId:options.zoneId||`zone_${mapData.id||mapData.mapId||'active'}`,profileId:options.profileId||'mixed_urban',seed:options.seed||`${mapData.id||mapData.mapId||'map'}:zone`,sockets:options.sockets||mapData.procedural?.zone?.sockets||[],gridSize:mapData.grid?.size||70,...options});
    emit('vtt:procedural-preview',{signature:lastPlan.signature,seed:lastPlan.seed,profileId:lastPlan.profileId,summary:lastPlan.validation.summary});
    return lastPlan;
  }
  function apply(plan=lastPlan,options={}){
    if(!plan)throw new Error('PROCEDURAL_PREVIEW_REQUIRED');
    core.applyPlan(mapData,plan,options);lastPlan=plan;
    runtime.semanticMap?.touch?.('procedural-applied');
    runtime.engine.renderer?.invalidate?.();
    emit('vtt:procedural-applied',{signature:plan.signature,seed:plan.seed,profileId:plan.profileId,summary:plan.validation.summary});
    return mapData;
  }
  const api=Object.freeze({
    core,zoneCore,fabric,
    profiles:()=>Object.values(fabric.PROFILES).map(x=>({...x})),
    preview,apply,
    generateAndApply:(options={},applyOptions={})=>{const plan=preview(options);apply(plan,applyOptions);return plan;},
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
