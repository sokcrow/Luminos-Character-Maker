(function(global){
  'use strict';
  if(global.LuminousCombatUnitLibrarySync)return;

  const ROOTS=Object.freeze({
    campaignUnits:'campaña/base_datos_unidades',
    campaignSkills:'campaña/base_datos_skills',
    universalRoot:'campaña/combate/libraryManifest',
    universalUnitManifest:'campaña/combate/libraryManifest/units',
    universalSkillManifest:'campaña/combate/libraryManifest/skills'
  });
  const CATALOG_SCRIPTS=Object.freeze([
    'js/universal-library-runtime.js',
    'js/combat-skill-schema.js',
    'js/skill-catalog-kobold-tier1.js',
    'js/skill-catalog-goblin-tier1.js',
    'js/skill-catalog-wolf.js',
    'js/unit-rank-runtime.js',
    'js/universal-action-economy.js',
    'js/universal-ranged-ammo-runtime.js',
    'js/creature-type-catalog.js',
    'js/goblin-unit-runtime.js',
    'js/wolf-unit-runtime.js',
    'js/unit-catalog-kobold-tier1.js',
    'js/unit-catalog-goblin.js',
    'js/unit-catalog-wolf.js'
  ]);
  const DEPLOYMENT_SCRIPTS=Object.freeze(['js/unit-combat-instantiator.js','js/combat-v073-unit-deploy-bridge.js']);
  const state={loading:null,deploymentLoading:null,localUnits:{},localSkills:{},fallbackDb:null,fallbackUnsubscribers:[],remoteCampaignUnits:{},remoteManifest:{}};
  const clean=v=>String(v??'').trim();
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function readyForScript(src){
    const checks={
      'js/universal-library-runtime.js':()=>Boolean(global.LuminousUniversalLibrary),
      'js/combat-skill-schema.js':()=>Boolean(global.CombatSkillSchema),
      'js/skill-catalog-kobold-tier1.js':()=>Boolean(global.LuminousKoboldTier1SkillCatalog),
      'js/skill-catalog-goblin-tier1.js':()=>Boolean(global.LuminousGoblinTier1SkillCatalog),
      'js/skill-catalog-wolf.js':()=>Boolean(global.LuminousWolfSkillCatalog),
      'js/unit-rank-runtime.js':()=>Boolean(global.LuminousUnitRankRuntime),
      'js/universal-action-economy.js':()=>Boolean(global.LuminousActionEconomy),
      'js/universal-ranged-ammo-runtime.js':()=>Boolean(global.LuminousUniversalRangedAmmoRuntime),
      'js/creature-type-catalog.js':()=>Boolean(global.LuminousCreatureTypeCatalog),
      'js/goblin-unit-runtime.js':()=>Boolean(global.LuminousGoblinUnitRuntime),
      'js/wolf-unit-runtime.js':()=>Boolean(global.LuminousWolfUnitRuntime),
      'js/unit-catalog-kobold-tier1.js':()=>Boolean(global.LuminousKoboldUnitCatalog),
      'js/unit-catalog-goblin.js':()=>Boolean(global.LuminousGoblinUnitCatalog),
      'js/unit-catalog-wolf.js':()=>Boolean(global.LuminousWolfUnitCatalog),
      'js/unit-combat-instantiator.js':()=>Boolean(global.LuminousUnitCombatInstantiator),
      'js/combat-v073-unit-deploy-bridge.js':()=>Boolean(global.LuminousCombat073UnitDeployBridge)
    };
    try{return Boolean(checks[src]?.());}catch(_){return false;}
  }
  function loadScript(src,timeoutMs=5000){
    if(readyForScript(src))return Promise.resolve(null);
    if(!global.document?.head)return Promise.reject(new Error('DOCUMENT_UNAVAILABLE'));
    return new Promise((resolve,reject)=>{
      let settled=false,poll=null,timer=null;
      const existing=global.document.querySelector?.(`script[src="${src}"]`)||null,script=existing||global.document.createElement('script');
      const cleanup=()=>{if(poll)global.clearInterval?.(poll);if(timer)global.clearTimeout?.(timer);script.removeEventListener?.('load',onLoad);script.removeEventListener?.('error',onError);};
      const finish=error=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(script);};
      const onLoad=()=>{script.dataset.loaded='1';Promise.resolve().then(()=>finish());};
      const onError=()=>finish(new Error(`SCRIPT_LOAD_FAILED:${src}`));
      script.addEventListener?.('load',onLoad,{once:true});script.addEventListener?.('error',onError,{once:true});
      poll=global.setInterval?.(()=>{if(readyForScript(src)||script.dataset?.loaded==='1'||script.readyState==='complete')finish();},25);
      timer=global.setTimeout?.(()=>{if(readyForScript(src)||script.dataset?.loaded==='1'||script.readyState==='complete')finish();else finish(new Error(`SCRIPT_LOAD_TIMEOUT:${src}`));},timeoutMs);
      if(!existing){script.src=src;script.async=false;global.document.head.appendChild(script);}else if(readyForScript(src)||existing.dataset?.loaded==='1'||existing.readyState==='complete')finish();
    });
  }
  function catalogsReady(){return Boolean(global.LuminousUniversalLibrary&&global.CombatSkillSchema&&global.LuminousKoboldUnitCatalog&&global.LuminousGoblinTier1SkillCatalog&&global.LuminousGoblinUnitCatalog&&global.LuminousWolfUnitCatalog);}
  async function ensureCatalogs(){
    if(catalogsReady())return true;
    if(state.loading)return state.loading;
    state.loading=(async()=>{for(const src of CATALOG_SCRIPTS)if(!readyForScript(src))await loadScript(src);if(!catalogsReady())throw new Error('CATALOGS_NOT_READY');return true;})().finally(()=>{state.loading=null;});
    return state.loading;
  }
  async function ensureDeploymentRuntime(){
    await ensureCatalogs();
    if(global.LuminousUnitCombatInstantiator&&global.LuminousCombat073UnitDeployBridge)return true;
    if(state.deploymentLoading)return state.deploymentLoading;
    state.deploymentLoading=(async()=>{for(const src of DEPLOYMENT_SCRIPTS)if(!readyForScript(src))await loadScript(src);return Boolean(global.LuminousUnitCombatInstantiator&&global.LuminousCombat073UnitDeployBridge);})().finally(()=>{state.deploymentLoading=null;});
    return state.deploymentLoading;
  }
  function mergePayloads(...payloads){
    const merged={};
    for(const payload of payloads)for(const [id,value] of Object.entries(payload||{})){if(Object.prototype.hasOwnProperty.call(merged,id))throw new Error(`DUPLICATE_LIBRARY_ID:${id}`);merged[id]=value;}
    return merged;
  }
  async function buildPayloads(){
    await ensureCatalogs();
    const schema=global.CombatSkillSchema,kobolds=global.LuminousKoboldUnitCatalog,goblins=global.LuminousGoblinUnitCatalog,wolves=global.LuminousWolfUnitCatalog;
    const units=mergePayloads(kobolds.firebasePayload(),goblins.firebasePayload(),wolves.firebasePayload());
    const skills=mergePayloads(kobolds.firebaseSkillPayload(schema),goblins.firebaseSkillPayload(schema),wolves.firebaseSkillPayload(schema));
    state.localUnits=clone(units)||{};state.localSkills=clone(skills)||{};
    return{units,skills};
  }
  function diagnostics(units={}){
    const rows=Object.entries(units||{}).map(([id,unit])=>({id,unit:unit||{}}));
    return{
      pendingSprites:rows.filter(({unit})=>unit.metadata?.spritePending===true||!clean(unit.combatSprite||unit.visual?.spriteUrl||unit.icono||unit.img)).map(({id})=>id),
      pendingWeaponSkills:rows.filter(({unit})=>unit.metadata?.weaponSkillsPendingCanonicalCatalog===true).map(({id})=>id),
      families:{
        kobold:rows.filter(({unit,id})=>clean(unit.species||unit.family||id).toLowerCase().includes('kobold')).length,
        goblin:rows.filter(({unit,id})=>clean(unit.species||unit.family||id).toLowerCase().includes('goblin')).length,
        wolf:rows.filter(({unit,id})=>clean(unit.species||unit.family||id).toLowerCase().includes('wolf')).length
      }
    };
  }
  function isPlayerUnit(unit={}){const category=clean(unit.actorCategory||unit.category||unit.type||unit.canonicalScope).toLowerCase();return unit.isPlayer===true||category==='player';}
  function unitName(unit={},fallback='Unit'){return clean(unit.characterName||unit.nombre||unit.name||unit.displayName||fallback)||fallback;}
  function spriteFor(unit={}){return clean(unit.combatSprite||unit.sprite_combate||unit.combat_sprite||unit.visual?.spriteUrl||unit.tokenImage||unit.sprite||unit.idle_sprite||unit.img||unit.image||unit.icono);}
  function skillCount(unit={}){const source=unit.loadout?.skillIds||unit.action_slots||unit.skillIds||unit.skillSlotIds||unit.mechanics?.skills||[];return Array.isArray(source)?source.length:(source&&typeof source==='object'?Object.keys(source).length:0);}
  function canonicalUpgradeNeeded(existing={},canonical={}){
    if(existing?.metadata?.canonicalUnit!==true||canonical?.metadata?.canonicalUnit!==true)return false;
    const a=skillCount(existing),b=skillCount(canonical);return Number(existing.schemaVersion||0)<Number(canonical.schemaVersion||0)||a<b||existing.metadata?.weaponSkillsPendingCanonicalCatalog===true&&canonical.metadata?.weaponSkillsPendingCanonicalCatalog===false;
  }
  function mergeCanonicalUpgrade(existing={},canonical={}){
    const out={...clone(canonical),visual:{...(clone(canonical.visual)||{}),...(clone(existing.visual)||{})},combatVisual:{...(clone(canonical.combatVisual)||{}),...(clone(existing.combatVisual)||{})},metadata:{...(clone(canonical.metadata)||{}),...(clone(existing.metadata)||{})}};
    if(canonical.metadata?.weaponSkillsPendingCanonicalCatalog===false)out.metadata.weaponSkillsPendingCanonicalCatalog=false;
    for(const key of ['combatSprite','sprite_combate','combat_sprite','spriteX','spriteY','scale','visualScale'])if(existing[key]!=null&&existing[key]!=='')out[key]=clone(existing[key]);
    return out;
  }
  function refreshCombatTabSelector(){
    const manager=global.LuminousDmCombatTabManager,doc=global.document,type=doc?.getElementById?.('dm-combat-tab-type'),entity=doc?.getElementById?.('dm-combat-tab-entity');if(!manager?.state||!type||!entity)return false;
    const selectedType=manager.state.selectedType||type.value||'enemy',selectedKey=manager.state.selectedKey||entity.value||'';type.value=selectedType;
    try{type.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){return false;}
    if(selectedKey&&manager.descriptorsFor?.(selectedType)?.some?.(row=>row.key===selectedKey)){manager.state.selectedKey=selectedKey;entity.value=selectedKey;try{entity.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){}}
    return true;
  }
  function refreshEncounterSelector(){
    const setup=global.LuminousCombatDmSetup073,select=global.document?.getElementById?.('c073-unit');if(!setup?.state||!select)return false;
    const previous=select.value,rows=Object.entries(setup.state.units||{}).filter(([,unit])=>!isPlayerUnit(unit||{})).sort((a,b)=>unitName(a[1],a[0]).localeCompare(unitName(b[1],b[0])));
    select.innerHTML='<option value="">— Enemy / NPC Unit Library —</option>'+rows.map(([id,unit])=>`<option value="${String(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${unitName(unit,id)}${spriteFor(unit)?' · SPRITE':' · SIN SPRITE'}${skillCount(unit)?` · ${skillCount(unit)} SKILLS`:''}</option>`).join('');
    if(setup.state.units?.[previous])select.value=previous;return true;
  }
  function mergeRuntimeUnits(){return{...(clone(state.localUnits)||{}),...(clone(state.remoteCampaignUnits)||{})};}
  function applyRuntimeFallback(){
    const units=mergeRuntimeUnits(),skills=clone(state.localSkills)||{};
    if(global.LuminousDmCombatTabManager?.state){global.LuminousDmCombatTabManager.state.units=clone(units);global.LuminousDmCombatTabManager.state.skills=clone(skills);refreshCombatTabSelector();}
    if(global.LuminousCombatDmSetup073?.state){global.LuminousCombatDmSetup073.state.units=clone(units);refreshEncounterSelector();}
    try{global.dispatchEvent?.(new CustomEvent('luminous:combat-unit-library-local-ready',{detail:{units:clone(units),skills:clone(skills),manifest:clone(state.remoteManifest),diagnostics:diagnostics(units)}}));}catch(_){}
    return{units,skills};
  }
  function unsubscribeFallback(){state.fallbackUnsubscribers.splice(0).forEach(fn=>{try{fn();}catch(_){}});state.fallbackDb=null;}
  function subscribeValue(db,path,assign){const ref=db.ref(path),handler=snap=>{assign(snap.val()||{});applyRuntimeFallback();};ref.on('value',handler,error=>console.error('[Universal Library Sync]',path,error));state.fallbackUnsubscribers.push(()=>ref.off('value',handler));}
  function installRuntimeFallback(db,payloads={}){
    state.localUnits=clone(payloads.units||state.localUnits)||{};state.localSkills=clone(payloads.skills||state.localSkills)||{};applyRuntimeFallback();
    if(!db?.ref||state.fallbackDb===db)return true;unsubscribeFallback();state.fallbackDb=db;
    subscribeValue(db,ROOTS.campaignUnits,value=>{state.remoteCampaignUnits=value&&typeof value==='object'?value:{}});
    subscribeValue(db,ROOTS.universalUnitManifest,value=>{state.remoteManifest=value&&typeof value==='object'?value:{}});
    global.LuminousUniversalLibrary?.setDb?.(db);return true;
  }
  async function materialize(db,{force=false}={}){
    const payloads=await buildPayloads();installRuntimeFallback(db,payloads);
    const result=await global.LuminousUniversalLibrary.publish(db,payloads,{force});
    return{...result,unitsUpgraded:0,diagnostics:diagnostics(payloads.units),root:ROOTS.universalRoot};
  }
  async function ensureMissing(db){return materialize(db,{force:false});}
  async function syncAll(db){return materialize(db,{force:true});}

  global.LuminousCombatUnitLibrarySync=Object.freeze({
    version:'2.1.0',ROOTS,CATALOG_SCRIPTS,DEPLOYMENT_SCRIPTS,state,loadScript,ensureCatalogs,ensureDeploymentRuntime,mergePayloads,buildPayloads,diagnostics,
    canonicalUpgradeNeeded,mergeCanonicalUpgrade,installRuntimeFallback,applyRuntimeFallback,refreshCombatTabSelector,refreshEncounterSelector,ensureMissing,syncAll,materialize
  });
})(window);
