/* Keep Favored Enemy grants current while the DM manages the library/characters. */
(function(global){
 'use strict';if(global.LuminousCompendiumDmBootstrap)return;global.LuminousCompendiumDmBootstrap=true;
 let generation=0,activeDb=null;
 function script(path,ready){if(ready())return Promise.resolve();return new Promise((resolve,reject)=>{const element=document.createElement('script');element.src=path;element.async=false;element.onload=resolve;element.onerror=reject;document.head.appendChild(element);});}
 function init(){
  const auth=global.firebase?.auth?.();if(!auth)return;
  auth.onAuthStateChanged(async user=>{
   const token=++generation;if(activeDb)global.LuminousCompendiumProgressLive?.stopAuthority(activeDb);activeDb=null;if(!user)return;
   try{
    const db=global.firebase.database(),dm=(await db.ref('campaña/config/dm_uid').once('value')).val();
    if(token!==generation||(user.uid!==dm&&user.uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'))return;
    await script('js/creature-type-catalog.js',()=>Boolean(global.LuminousCreatureTypeCatalog));
    await script('js/ranger-class-runtime.js',()=>Boolean(global.LuminousRangerClassRuntime));
    await script('js/compendium-progression-core.js?v=20261030-progression-1',()=>Boolean(global.LuminousCompendiumProgression));
    await script('js/compendium-progression-live.js?v=20261030-progression-1',()=>Boolean(global.LuminousCompendiumProgressLive));
    if(token!==generation)return;activeDb=db;await global.LuminousCompendiumProgressLive.startAuthority(db);
   }catch(error){global.console?.error('No se pudo actualizar el conocimiento de Enemigo Predilecto.',error);}
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
