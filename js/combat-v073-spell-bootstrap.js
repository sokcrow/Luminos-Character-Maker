/* Combat v0.7.3 canonical Spell bridge; no second Firebase/Viewer authority. */
(function(global){
 "use strict";
 if(global.LuminousCombatSpellBootstrap073)return;
 const VERSION="0.7.3-universal-spells.2";
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
  ["spell073-pierre-effects","js/spell-batch-pierre-runtime.js",()=>!!global.LuminousPierreSpellBatchRuntime],
  ["spell073-weapon-effects","js/spell-batch-weapon-cantrips-runtime.js",()=>!!global.LuminousWeaponCantripBatchRuntime],
  ["spell073-cantrip-effects","js/spell-batch-cantrips-runtime.js",()=>!!global.LuminousCantripBatchRuntime],
  ["spell073-runtime","js/battle-viewer-spell-runtime-074.js",()=>!!global.LuminousBattleViewerSpellRuntime074],
  ["spell073-execution","js/combat-source-execution.js",()=>!!global.LuminousCombatSourceExecution],
 ]);
 const state={phase:"idle",ready:false,error:null,modules:[]};
 let pending=null;
 // Other Viewer loaders use different IDs for the same scripts. Observe
 // their in-flight element instead of evaluating the same module twice.
 function load(id,src,ready){
   if(ready())return Promise.resolve(true);
   if(!global.document?.head)return Promise.resolve(false);
   return new Promise(resolve=>{
     let settled=false,timer=null;
     const started=Date.now();
     function finish(value){
       if(settled)return;settled=true;global.clearTimeout?.(timer);
       script?.removeEventListener?.("error",failed);
       resolve(Boolean(value));
     }
     const failed=()=>finish(false);
     let script=global.document.getElementById(id)||
       Array.from(global.document.scripts||[]).find(node=>
         (node.getAttribute?.("src")||node.src||"").split("?")[0].endsWith(src));
     const original=Boolean(script);
     if(!script){script=global.document.createElement("script");script.id=id;script.src=src+"?v=20261031-complete-actions-1";script.async=false}
     script.addEventListener("error",failed,{once:true});
     if(!original)global.document.head.appendChild(script);
     // Poll the contract, including when load fired before this subscription.
     const check=()=>{
       if(settled)return;
       try{if(ready())return finish(true)}catch(_){}
       if(Date.now()-started>=12000)return finish(false);
       timer=global.setTimeout(check,40);
     };check();
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
     if(await global.LuminousBattleViewerSpellRuntime074.ready!==true){
       state.phase="unavailable";state.error="spell_runtime_install_failed";
       notify("luminous:combat073-spells-unavailable");return false;
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

