(function(root,factory){const api=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.LuminousVttSemanticMapAuthoringPatch=api;})(typeof window!=='undefined'?window:globalThis,function(root){'use strict';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function install(){const base=root?.LuminousVttMapAuthoring,core=root?.LuminousVttSemanticMap;if(!base||!core)return null;if(base.__semanticMapAware===true)return base;
function payload(raw={},fallback={}){return{semantics:core.normalizeSemantics(raw.semantics||fallback.semantics||{})};}
function attach(definition,raw={},fallback={}){return{...definition,...payload(raw,fallback)};}
function normalizeDefinition(raw={},fallback={}){return attach(base.normalizeDefinition(raw,fallback),raw,fallback);}
function definitionFromMapData(mapData={}){return attach(base.definitionFromMapData(mapData),mapData,mapData);}
function applyDefinition(mapData,rawDefinition,options={}){const normalized=normalizeDefinition(rawDefinition,mapData||{});base.applyDefinition(mapData,normalized,options);mapData.semantics=clone(normalized.semantics);return mapData;}
function preserve(fn){return function wrapped(rawDefinition,...args){const result=fn(rawDefinition,...args);return attach(result,rawDefinition||{},rawDefinition||{});};}
function canDeleteLevel(mapData={},zLayer=0){const gate=base.canDeleteLevel(mapData,zLayer);if(!gate.valid)return gate;const z=Number(zLayer)||0,s=core.normalizeSemantics(mapData.semantics||{}),semanticAreas=s.areas.filter(x=>Number(x.zLayer)===z),semanticPoints=s.points.filter(x=>Number(x.zLayer)===z);if(semanticAreas.length||semanticPoints.length)return{valid:false,reason:'FLOOR_IN_USE',dependencies:{...(gate.dependencies||{}),semanticAreas,semanticPoints}};return{...gate,dependencies:{...(gate.dependencies||{}),semanticAreas:[],semanticPoints:[]}};}
function createDefinition(options={}){return attach(base.createDefinition(options),options,{});}
const patched=Object.freeze({...base,__semanticMapAware:true,normalizeDefinition,definitionFromMapData,applyDefinition,addLevel:preserve(base.addLevel),updateLevel:preserve(base.updateLevel),removeLevel:preserve(base.removeLevel),canDeleteLevel,createDefinition});root.LuminousVttMapAuthoring=patched;return patched;}
const installed=install();return Object.freeze({install,installed});});