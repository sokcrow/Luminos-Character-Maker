(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)api.install();
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const ARCHETYPES=Object.freeze(['shop','apartment_building','workshop','warehouse']);
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  let original=null;

  function fabricCore(){
    if(root?.LuminousVttUrbanFabric)return root.LuminousVttUrbanFabric;
    if(typeof require!=='undefined'){try{return require('./urban-fabric-core.js');}catch(_){}}
    return null;
  }

  function profileWeights(profileId='mixed_urban'){
    const base=original||root?.LuminousVttProceduralBuildings;
    return base?.WEIGHTS?.[profileId]||base?.WEIGHTS?.mixed_urban||{shop:.3,apartment_building:.35,workshop:.2,warehouse:.15};
  }

  function normalizeBuildingMix(raw=null,profileId='mixed_urban'){
    const fallback=profileWeights(profileId),src=raw&&typeof raw==='object'?raw:fallback,out={};
    for(const key of ARCHETYPES)out[key]=Math.max(0,finite(src[key],fallback[key]||0));
    const total=ARCHETYPES.reduce((sum,key)=>sum+out[key],0);
    if(total<=0)return{...fallback};
    for(const key of ARCHETYPES)out[key]/=total;
    return out;
  }

  function eligibleWeights(raw,parcel={},profileId='mixed_urban'){
    const fc=fabricCore(),weights=normalizeBuildingMix(raw,profileId),area=fc?fc.width(parcel.buildable)*fc.height(parcel.buildable):100;
    if(area<130)weights.warehouse=0;
    if(area<70)weights.workshop*=.5;
    let total=ARCHETYPES.reduce((sum,key)=>sum+(weights[key]||0),0);
    if(total<=0){
      const fallback={...profileWeights(profileId)};
      if(area<130)fallback.warehouse=0;
      if(area<70)fallback.workshop*=.5;
      total=ARCHETYPES.reduce((sum,key)=>sum+(fallback[key]||0),0)||1;
      for(const key of ARCHETYPES)weights[key]=(fallback[key]||0)/total;
      return weights;
    }
    for(const key of ARCHETYPES)weights[key]=(weights[key]||0)/total;
    return weights;
  }

  function forcedRoll(target,parcel={},profileId='mixed_urban'){
    const weights=eligibleWeights(profileWeights(profileId),parcel,profileId),entries=ARCHETYPES.filter(key=>(weights[key]||0)>0),total=entries.reduce((sum,key)=>sum+weights[key],0)||1;
    let before=0;
    for(const key of entries){
      const weight=weights[key];
      if(key===target)return Math.max(0,Math.min(.999999,(before+(weight/2))/total));
      before+=weight;
    }
    return .000001;
  }

  function generateBuildings(fabric={},rngInput=null){
    const base=original,fc=fabricCore();
    if(!base||!fc)throw new Error('PROCEDURAL_BUILDING_MIX_DEPENDENCY_REQUIRED');
    const rng=rngInput||fc.createRng(`${fabric.zone?.seed||fabric.zone?.id||'zone'}:buildings`),profileId=fabric.profile?.id||'mixed_urban',mix=fabric.profile?.buildingMix||null,buildings=[],areas=[],points=[],relations=[],topology=[],surfaceCells=[];
    for(const parcel of fabric.parcels||[]){
      if(!rng.chance(fabric.profile?.density??.75))continue;
      const target=base.weightedPick(eligibleWeights(mix,parcel,profileId),rng),roll=forcedRoll(target,parcel,profileId),result=base.generateBuilding(parcel,fabric,{next:()=>roll},fabric.zone?.id||'zone');
      buildings.push(result.building);areas.push(...result.areas);points.push(...result.points);relations.push(...result.relations);topology.push(...result.topology);
      const g=result.footprint;for(let row=g.minRow;row<=g.maxRow;row++)for(let col=g.minCol;col<=g.maxCol;col++)surfaceCells.push({zLayer:0,col,row,materialId:result.surfaceMaterialId,buildingId:result.building.id});
    }
    return{schemaVersion:base.SCHEMA_VERSION,buildings,areas,points,relations,topology:base.dedupeTopology(topology),surfaceCells};
  }

  function install(){
    const current=root?.LuminousVttProceduralBuildings;
    if(!current)return null;
    if(current.__buildingMixAware)return current;
    original=current;
    const patched=Object.freeze({...current,__buildingMixAware:true,normalizeBuildingMix,eligibleWeights,generateBuildings});
    root.LuminousVttProceduralBuildings=patched;
    return patched;
  }

  return Object.freeze({ARCHETYPES,normalizeBuildingMix,eligibleWeights,install});
});
