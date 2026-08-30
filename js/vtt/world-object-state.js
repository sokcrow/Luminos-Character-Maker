(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttWorldObjectState=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const core=root?.LuminousVttWorldObjectCore||(typeof require!=='undefined'?require('./world-object-core.js'):null);
  if(!core)throw new Error('World object core is required.');
  const DM_UID='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const clean=v=>String(v??'').trim();
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function database(){return root?.firebase?.database?.()||null;}
  function authUser(){return root?.firebase?.auth?.().currentUser||null;}
  function mapIdOf(mapData){return clean(mapData?.id||mapData?.mapId||'default');}

  function createBridge({mapData,onChanged,onDefinitionsChanged,notify}={}){
    const db=database(),mapId=mapIdOf(mapData),listeners=[],isDm=authUser()?.uid===DM_UID;
    mapData.worldObjects=Array.isArray(mapData.worldObjects)?mapData.worldObjects:[];
    mapData.worldObjectDefinitions=mapData.worldObjectDefinitions||{};
    const objectsPath=`campaña/estado_mundo/vttObjects/${mapId}`;
    const definitionsPath='campaña/estado_mundo/vttObjectDefinitions';

    function attach(path,cb){if(!db)return;const ref=db.ref(path),handler=s=>cb(s.val()||{});ref.on('value',handler);listeners.push(()=>ref.off('value',handler));}
    function replaceLocal(instances=[]){mapData.worldObjects=clone(instances);onChanged?.(mapData.worldObjects);return mapData.worldObjects;}
    function start(){
      attach(objectsPath,value=>replaceLocal(Object.values(value||{}).filter(Boolean)));
      attach(definitionsPath,value=>{const next={};Object.entries(value||{}).forEach(([key,raw])=>{try{const def=core.normalizeDefinition({...raw,id:raw?.id||key});next[def.id]=def;}catch(_){}});mapData.worldObjectDefinitions=next;onDefinitionsChanged?.(next);});
      return api;
    }
    function stop(){while(listeners.length)listeners.pop()();}
    async function saveInstance(instance){if(!db||!isDm)throw new Error('DM authority required to persist world objects.');if(!instance?.instanceId)throw new Error('World object instanceId is required.');await db.ref(`${objectsPath}/${instance.instanceId}`).set(instance);return instance;}
    async function deleteInstance(instanceId){if(!db||!isDm)throw new Error('DM authority required to delete world objects.');await db.ref(`${objectsPath}/${clean(instanceId)}`).remove();}
    async function replaceAll(instances=mapData.worldObjects||[]){
      if(!isDm&&db)throw new Error('DM authority required to replace world objects.');
      const normalized=(Array.isArray(instances)?instances:[]).filter(x=>clean(x?.instanceId)).map(clone);
      if(!db)return replaceLocal(normalized);
      const record=Object.fromEntries(normalized.map(instance=>[instance.instanceId,instance]));
      await db.ref(objectsPath).set(record);
      return normalized;
    }
    async function saveDefinition(definition){if(!db||!isDm)throw new Error('DM authority required to persist world object definitions.');const def=core.normalizeDefinition(definition),key=def.id.replace(/^object:/,'');await db.ref(`${definitionsPath}/${key}`).set(def);return def;}

    const api={mapId,isDm,objectsPath,definitionsPath,start,stop,saveInstance,deleteInstance,replaceAll,saveDefinition};
    return api;
  }

  return Object.freeze({DM_UID,mapIdOf,createBridge});
});
