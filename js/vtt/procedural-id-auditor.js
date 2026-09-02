(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralIdAuditor=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const clean=value=>String(value??'').trim();

  function entry(collection,item,index){
    return{collection,index,id:clean(item?.id),kind:clean(item?.kind||item?.type)||null};
  }

  function duplicatesInNamespace(namespace,collections=[]){
    const seen=new Map(),duplicates=[];
    for(const spec of collections){
      const name=String(spec?.name||'unknown'),items=Array.isArray(spec?.items)?spec.items:[];
      for(let index=0;index<items.length;index++){
        const current=entry(name,items[index],index);
        if(!current.id)continue;
        const first=seen.get(current.id);
        if(first){duplicates.push({code:'PROCEDURAL_DUPLICATE_ID',namespace,id:current.id,first,duplicate:current});continue;}
        seen.set(current.id,current);
      }
    }
    return duplicates;
  }

  function duplicateIdsWithin(collection,items=[]){
    return duplicatesInNamespace(collection,[{name:collection,items}]);
  }

  function auditPlan(plan={},context={}){
    const fabric=plan.fabric||{},generated=plan.generated||{},mapData=plan.mapData||{},semantics=mapData.semantics||generated.semantics||{},zone=plan.zone||fabric.zone||{},duplicates=[];

    // Core semantic contract: buildings, areas and points share an identity namespace.
    duplicates.push(...duplicatesInNamespace('semantic_entities',[
      {name:'semantics.buildings',items:semantics.buildings||generated.buildings||[]},
      {name:'semantics.areas',items:semantics.areas||generated.areas||[]},
      {name:'semantics.points',items:semantics.points||generated.points||[]},
    ]));

    // Relations reference semantic entities but still need stable unique IDs among themselves.
    duplicates.push(...duplicateIdsWithin('semantics.relations',semantics.relations||generated.relations||[]));

    // Fabric collections are kept separate semantically, but duplicate IDs inside any collection are invalid authoring data.
    for(const [name,items] of [
      ['fabric.streets',fabric.streets],
      ['fabric.blocks',fabric.blocks],
      ['fabric.parcels',fabric.parcels],
      ['fabric.alleys',fabric.alleys],
      ['fabric.edgeRelations',fabric.edgeRelations],
      ['zone.sockets',zone.sockets],
      ['mapData.topology',mapData.topology||generated.topology],
      ['mapData.verticalPortals',mapData.verticalPortals],
      ['mapData.horizontalPlanes',mapData.horizontalPlanes],
      ['mapData.structures',mapData.structures],
      ['mapData.worldObjects',mapData.worldObjects],
    ])duplicates.push(...duplicateIdsWithin(name,items||[]));

    const meta={
      mapId:clean(context.mapId||mapData.id||mapData.mapId)||null,
      zoneId:clean(context.zoneId||zone.id)||null,
      profileId:clean(context.profileId||plan.profileId||fabric.profile?.id)||null,
      seed:clean(context.seed||plan.seed||zone.seed)||null,
      attempt:Number.isFinite(Number(context.attempt??plan.attempt))?Number(context.attempt??plan.attempt):null,
    };
    const errors=duplicates.map(item=>({...item,...meta}));
    return{
      schemaVersion:SCHEMA_VERSION,
      valid:errors.length===0,
      errors,
      warnings:[],
      summary:{duplicateCount:errors.length,checkedNamespaces:12,...meta},
    };
  }

  function format(error={}){
    const first=error.first||{},duplicate=error.duplicate||{};
    return[
      error.code||'PROCEDURAL_DUPLICATE_ID',
      `namespace=${error.namespace||'unknown'}`,
      `id=${error.id||'unknown'}`,
      `first=${first.collection||'?'}[${first.index??'?'}]`,
      `duplicate=${duplicate.collection||'?'}[${duplicate.index??'?'}]`,
      error.mapId?`map=${error.mapId}`:null,
      error.zoneId?`zone=${error.zoneId}`:null,
      error.profileId?`profile=${error.profileId}`:null,
      error.seed?`seed=${error.seed}`:null,
      error.attempt!=null?`attempt=${error.attempt}`:null,
    ].filter(Boolean).join(' ');
  }

  return Object.freeze({SCHEMA_VERSION,duplicatesInNamespace,duplicateIdsWithin,auditPlan,format});
});
