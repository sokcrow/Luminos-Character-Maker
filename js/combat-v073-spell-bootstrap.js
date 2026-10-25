/* Combat v0.7.3 canonical Spell bridge; no second Firebase/Viewer authority. */
(function(global){
 "use strict";
 if(global.LuminousCombatSpellBootstrap073)return;
 const VERSION="0.7.3-universal-spells.1";
 const MODULES=Object.freeze([
  ["spell073-registry","js/content-registry.js",()=>!!global.LuminousContentRegistry],
  ["spell073-registry-boot","js/content-registry-bootstrap.js",()=>!!global.LuminousContentRegistryBootstrap],
  ["spell073-casting","js/spellcasting-runtime.js",()=>!!global.LuminousSpellcastingRuntime],
  ["spell073-basic-rules","js/spellcasting-basic-rules-runtime.js",()=>global.LuminousSpellcastingRuntime?.__basicRulesV1===true],
  ["spell073-catalog","js/spell-catalog-core.js",()=>!!global.LuminousSpellCatalog],
  ["spell073-role-catalog","js/role-spell-catalog-core.js",()=>!!global.LuminousRoleSpellCatalog],
  ["spell073-selection","js/spell-loadout-core.js",()=>!!global.LuminousSpellLoadout],
  ["spell073-combat-selection","js/combat-spell-loadout-074.js",()=>!!global.LuminousCombatSpellLoadout074],
  ["spell073-schema","js/combat-action-schema.js",()=>!!global.LuminousCombatAction],
  ["spell073-action-adapters","js/combat-action-adapters.js",()=>!!global.LuminousCombatActionAdapters],
  ["spell073-base-adapter","js/battle-viewer-action-adapter-073.js",()=>!!global.LuminousBattleViewerActionAdapter073],
  ["spell073-canonical-adapter","js/battle-viewer-spell-adapter-074.js",()=>!!global.LuminousBattleViewerSpellAdapter074],
  ["spell073-runtime","js/battle-viewer-spell-runtime-074.js",()=>!!global.LuminousBattleViewerSpellRuntime074],
 ]);
 const state={phase:"idle",ready:false,error:null,modules:[]};
 let pending=null;
 function waitFor(ready,ms=12000){
   return new Promise(resolve=>{
     const started=Date.now();
     const check=()=>{
       try{if(ready())return resolve(true)}catch(_){}
       if(Date.now()-started>=ms)return resolve(false);
       global.setTimeout(check,40);
     };check();
   });
 }
 function load(id,src,ready){
   if(ready())return Promise.resolve(true);
   if(!global.document?.head)return Promise.resolve(false);
   return new Promise(resolve=>{
     let settled=false;
     const timeout=global.setTimeout(()=>finish(false),12000);
     function finish(value){if(settled)return;settled=true;global.clearTimeout?.(timeout);resolve(Boolean(value))}
     let script=global.document.getElementById(id);
     const original=Boolean(script);
     if(!script){script=global.document.createElement("script");script.id=id;script.src=src;script.async=false}
     script.addEventListener("load",()=>{waitFor(ready).then(finish)},{once:true});
     script.addEventListener("error",()=>finish(false),{once:true});
     if(!original)global.document.head.appendChild(script);
     else if(script.readyState==="complete"||script.readyState==="loaded")waitFor(ready).then(finish);
     if(ready())finish(true);
   });
 }
 function notify(name){
   try{global.dispatchEvent?.(new global.CustomEvent(name,{detail:{version:VERSION,ready:state.ready,error:state.error}}))}catch(_){}
 }
 async function boot(){
   if(state.ready)return true;
   if(pending)return pending;
   pending=(async()=>{
     state.phase="loading";state.error=null;state.modules=[];
     for(const [id,src,ready] of MODULES){
       const ok=await load(id,src,ready);
       state.modules.push({id,loaded:ok});
       if(!ok){state.phase="unavailable";state.error="spell_dependency_unavailable:"+src;
         global.console?.error?.("[Combat Spell Bridge] Module unavailable",src);
         notify("luminous:combat073-spells-unavailable");return false}
     }
     global.LuminousContentRegistryBootstrap?.registerAvailableCore?.();
     if(!global.LuminousBattleViewerSpellAdapter074?.install?.()||
       !global.LuminousBattleViewerActionAdapter073?.__spellAdapter074||
       !global.LuminousBattleViewerCombatHooks073?.__spellRuntime074){
       state.phase="unavailable";state.error="spell_adapter_or_effects_unavailable";
       notify("luminous:combat073-spells-unavailable");return false;
     }
     state.phase="ready";state.ready=true;
     global.LuminousCombatLiveAdapter073?.scheduleHydrate?.();
     global.LuminousCombatEconomyMenu073?.refreshOpenedMenu?.();
     notify("luminous:combat073-spells-ready");
     return true;
   })();
   try{return await pending}finally{pending=null}
 }
 function resolveForUnit(unit={},spellId,options={}){
   if(!state.ready)return {ok:false,reason:"SPELL_RUNTIME_NOT_READY",spell:null};
   return global.LuminousCombatSpellLoadout074.resolveSpellForCombatant(unit,spellId,options);
 }
 global.LuminousCombatSpellBootstrap073=Object.freeze({version:VERSION,MODULES,state,boot,resolveForUnit});
 global.addEventListener?.("luminous:combat073-runtime-ready",()=>{boot()});
 global.setTimeout?.(()=>{boot()},0);
})(typeof window==="undefined"?globalThis:window);
