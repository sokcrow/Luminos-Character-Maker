(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralMapAuthoringPatch=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function install(){
    const base=root?.LuminousVttMapAuthoring;if(!base)return null;if(base.__proceduralAware===true)return base;
    function payload(raw={},fallback={}){return{procedural:clone(raw.procedural??fallback.procedural??null)};}
    function attach(definition,raw={},fallback={}){return{...definition,...payload(raw,fallback)};}
    function normalizeDefinition(raw={},fallback={}){return attach(base.normalizeDefinition(raw,fallback),raw,fallback);}
    function definitionFromMapData(mapData={}){return attach(base.definitionFromMapData(mapData),mapData,mapData);}
    function applyDefinition(mapData,rawDefinition,options={}){const normalized=normalizeDefinition(rawDefinition,mapData||{});base.applyDefinition(mapData,normalized,options);mapData.procedural=clone(normalized.procedural);return mapData;}
    function preserve(fn){return function wrapped(rawDefinition,...args){return attach(fn(rawDefinition,...args),rawDefinition||{},rawDefinition||{});};}
    function createDefinition(options={}){return attach(base.createDefinition(options),options,{});}
    const patched=Object.freeze({...base,__proceduralAware:true,normalizeDefinition,definitionFromMapData,applyDefinition,addLevel:preserve(base.addLevel),updateLevel:preserve(base.updateLevel),removeLevel:preserve(base.removeLevel),createDefinition});
    root.LuminousVttMapAuthoring=patched;return patched;
  }

  const installed=install();
  return Object.freeze({install,installed});
});
