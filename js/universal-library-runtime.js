(function(global){
  'use strict';
  if(global.LuminousUniversalLibrary)return;

  const ROOTS=Object.freeze({
    root:'campaña',
    manifestUnits:'campaña/combate/libraryManifest/units',
    manifestSkills:'campaña/combate/libraryManifest/skills',
    units:'campaña/base_datos_unidades',
    skills:'campaña/base_datos_skills',
    campaignUnits:'campaña/base_datos_unidades',
    campaignSkills:'campaña/base_datos_skills',
    unitOverrides:'campaña/unit_overrides'
  });
  const state={
    db:null,
    manifest:{units:{},skills:{}},
    manifestMiss:{units:new Set(),skills:new Set()},
    cache:{units:new Map(),skills:new Map()},
    pending:{units:new Map(),skills:new Map()},
    reads:{manifest:0,records:0,campaignFallback:0},
    lastPublish:null
  };

  const clean=v=>String(v??'').trim();
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const kindName=kind=>String(kind||'').toLowerCase().startsWith('skill')?'skills':'units';
  const pathFor=(kind,id)=>`${kindName(kind)==='skills'?ROOTS.skills:ROOTS.units}/${id}`;
  const manifestPathFor=(kind,id)=>`${kindName(kind)==='skills'?ROOTS.manifestSkills:ROOTS.manifestUnits}/${id}`;

  function stableValue(value){
    if(Array.isArray(value))return value.map(stableValue);
    if(value&&typeof value==='object'){const out={};Object.keys(value).sort().forEach(key=>{if(value[key]!==undefined)out[key]=stableValue(value[key]);});return out;}
    return value;
  }
  function stableStringify(value){return JSON.stringify(stableValue(value));}
  function hash(value){const text=stableStringify(value);let h=2166136261;for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
  function versionFor(record={}){const value=Number(record.libraryVersion??record.schemaVersion??record.version??record.revision??1);return Number.isFinite(value)&&value>0?Math.trunc(value):1;}
  function spriteFor(record={}){return clean(record.combatSprite||record.sprite_combate||record.combat_sprite||record.combatVisual?.spriteUrl||record.visual?.spriteUrl||record.tokenImage||record.sprite||record.idle_sprite||record.icono||record.img||record.image||record.portrait);}
  function skillIdsFor(record={}){
    const raw=record.loadout?.skillIds??record.action_slots??record.skillSlotIds??record.skillIds??record.skill_ids??record.mechanics?.skills??record.equippedSkills??[];let ids=[];
    if(Array.isArray(raw))ids=raw.map(row=>clean(row?.id||row?.skillId||row)).filter(Boolean);
    else if(raw&&typeof raw==='object')ids=Object.entries(raw).filter(([,value])=>value!==false&&value!=null).map(([key,value])=>clean(value?.id||value?.skillId||key)).filter(Boolean);
    if(!ids.length&&record.equippedSkillIndex&&typeof record.equippedSkillIndex==='object')ids=Object.keys(record.equippedSkillIndex).filter(id=>record.equippedSkillIndex[id]===true);
    return[...new Set(ids)];
  }
  function manifestEntry(kind,id,record={}){
    const type=kindName(kind),recordHash=hash(record),version=versionFor(record);
    if(type==='skills')return{id,enabled:record.enabled!==false,version,hash:recordHash,name:clean(record.name||record.nombre||id)||id,kind:clean(record.kind||record.type||record.actionType||'skill')||'skill'};
    return{id,enabled:record.enabled!==false,version,hash:recordHash,name:clean(record.characterName||record.nombre||record.name||record.displayName||id)||id,species:clean(record.species||record.family||record.variant||''),spriteUrl:spriteFor(record)||null,skillIds:skillIdsFor(record),canonical:record.metadata?.canonicalUnit===true};
  }
  function unitWithLoadout(record={}){
    const copy=clone(record)||{},skillIds=skillIdsFor(copy);copy.loadout={...(copy.loadout||{}),skillIds};copy.skillIds=skillIds;copy.skillSlotIds=skillIds;copy.action_slots=skillIds;copy.equippedSkillIndex=Object.fromEntries(skillIds.map(id=>[id,true]));return copy;
  }
  async function read(db,path){if(!db?.ref)throw new Error('FIREBASE_DB_REQUIRED');const snap=await db.ref(path).once('value');return snap.val();}
  function cacheKey(entry){return`${entry?.version||0}:${entry?.hash||''}`;}
  function cacheGet(kind,id,entry){const row=state.cache[kindName(kind)].get(id);if(!row||row.key!==cacheKey(entry))return null;return clone(row.value);}
  function cacheSet(kind,id,entry,value){state.cache[kindName(kind)].set(id,{key:cacheKey(entry),value:clone(value)});return clone(value);}

  async function getManifest(db,kind,id,{refresh=false}={}){
    const type=kindName(kind);if(refresh)state.manifestMiss[type].delete(id);
    if(!refresh&&state.manifest[type][id])return clone(state.manifest[type][id]);
    if(!refresh&&state.manifestMiss[type].has(id))return null;
    state.reads.manifest+=1;const value=await read(db,manifestPathFor(type,id));
    if(value&&typeof value==='object'){state.manifest[type][id]=value;state.manifestMiss[type].delete(id);return clone(value);}
    delete state.manifest[type][id];state.manifestMiss[type].add(id);return null;
  }
  async function getRecord(db,kind,id,{campaignFallback=true,refreshManifest=false}={}){
    const type=kindName(kind),manifest=await getManifest(db,type,id,{refresh:refreshManifest});
    if(manifest?.enabled===false)throw new Error(`LIBRARY_${type.toUpperCase()}_DISABLED:${id}`);
    if(manifest){
      const cached=cacheGet(type,id,manifest);if(cached)return{source:'universal',manifest,record:cached};
      const pending=state.pending[type].get(id);if(pending)return pending;
      const task=(async()=>{state.reads.records+=1;const value=await read(db,pathFor(type,id));if(!value||typeof value!=='object')throw new Error(`LIBRARY_${type.toUpperCase()}_MISSING:${id}`);return{source:'universal',manifest,record:cacheSet(type,id,manifest,value)};})().finally(()=>state.pending[type].delete(id));
      state.pending[type].set(id,task);return task;
    }
    if(!campaignFallback)return null;
    state.reads.campaignFallback+=1;const path=type==='skills'?`${ROOTS.campaignSkills}/${id}`:`${ROOTS.campaignUnits}/${id}`,value=await read(db,path);return value&&typeof value==='object'?{source:'campaign',manifest:null,record:clone(value)}:null;
  }
  async function getSkill(db,id,options={}){return getRecord(db,'skills',id,options);}
  async function getUnit(db,id,options={}){return getRecord(db,'units',id,options);}
  async function validateSkill(db,id,{campaignFallback=true,localFallback=null}={}){
    const manifest=await getManifest(db,'skills',id);if(manifest)return manifest.enabled!==false;
    if(localFallback?.[id])return true;
    if(!campaignFallback)return false;
    return Boolean((await getSkill(db,id,{campaignFallback:true}).catch(()=>null))?.record);
  }
  async function validateUnit(db,id,{validateLoadout=true}={}){
    const manifest=await getManifest(db,'units',id);if(!manifest||manifest.enabled===false)return{valid:false,id,reason:'UNIT_NOT_ENABLED',missingSkills:[]};if(!validateLoadout)return{valid:true,id,manifest,missingSkills:[]};
    const ids=Array.isArray(manifest.skillIds)?manifest.skillIds:[],valid=await Promise.all(ids.map(async skillId=>({id:skillId,valid:await validateSkill(db,skillId)}))),missingSkills=valid.filter(row=>!row.valid).map(row=>row.id);return{valid:missingSkills.length===0,id,manifest,missingSkills,reason:missingSkills.length?'MISSING_LIBRARY_SKILLS':null};
  }
  function mergeOverride(base={},override={}){return{...clone(base),...clone(override),visual:{...(clone(base.visual)||{}),...(clone(override.visual)||{})},combatVisual:{...(clone(base.combatVisual)||{}),...(clone(override.combatVisual)||{})},mechanics:{...(clone(base.mechanics)||{}),...(clone(override.mechanics)||{})},metadata:{...(clone(base.metadata)||{}),...(clone(override.metadata)||{})}};}
  async function resolveUnit(db,id,{campaignUnit=null,campaignOverride=null,loadSkills=false,localSkills=null}={}){
    let source='campaign',manifest=null,definition=null;const canonical=campaignUnit?.metadata?.canonicalUnit===true;
    try{const row=await getUnit(db,id,{campaignFallback:!canonical});if(row){source=row.source;manifest=row.manifest;definition=row.record;}}catch(error){if(!campaignUnit)throw error;}
    if(!definition&&campaignUnit){definition=clone(campaignUnit);source=canonical?'bundled':'campaign';}
    if(!definition)throw new Error(`UNIT_NOT_FOUND:${id}`);
    let override=campaignOverride;if(override==null&&db?.ref){try{override=await read(db,`${ROOTS.unitOverrides}/${id}`);}catch(_){override=null;}}
    definition=unitWithLoadout(mergeOverride(definition,override&&typeof override==='object'?override:{}));
    const skillIds=skillIdsFor(definition),missingSkills=[],skills={};
    for(const skillId of skillIds){
      let row=null;
      try{row=await getSkill(db,skillId,{campaignFallback:true});}catch(_){}
      if(!row?.record&&localSkills?.[skillId])row={source:'bundled',manifest:null,record:clone(localSkills[skillId])};
      if(!row?.record){missingSkills.push(skillId);continue;}
      if(loadSkills)skills[skillId]=row.record;
    }
    return{id,source,manifest,definition,skillIds,skills,missingSkills,valid:missingSkills.length===0,equippedSkillIndex:Object.fromEntries(skillIds.filter(skillId=>!missingSkills.includes(skillId)).map(skillId=>[skillId,true]))};
  }
  async function listUnitManifest(db,{refresh=false}={}){
    if(!refresh&&Object.keys(state.manifest.units).length)return clone(state.manifest.units);state.reads.manifest+=1;const value=await read(db,ROOTS.manifestUnits);state.manifest.units=value&&typeof value==='object'?clone(value):{};state.manifestMiss.units.clear();return clone(state.manifest.units);
  }
  async function publish(db,{units={},skills={}},{force=false}={}){
    if(!db?.ref)throw new Error('FIREBASE_DB_REQUIRED');state.db=db;
    const [existingUnits,existingSkills]=await Promise.all([read(db,ROOTS.manifestUnits).catch(()=>({})),read(db,ROOTS.manifestSkills).catch(()=>({}))]),updates={};let unitsWritten=0,skillsWritten=0,manifestsWritten=0;
    for(const [id,raw] of Object.entries(units||{})){
      const record=unitWithLoadout(raw||{}),entry=manifestEntry('units',id,record),existing=existingUnits?.[id];
      if(force||!existing||existing.hash!==entry.hash||Number(existing.version)!==Number(entry.version)){updates[`${ROOTS.units}/${id}`]=record;updates[`${ROOTS.manifestUnits}/${id}`]=entry;unitsWritten+=1;manifestsWritten+=1;}
      state.manifest.units[id]=entry;state.manifestMiss.units.delete(id);cacheSet('units',id,entry,record);
    }
    for(const [id,record] of Object.entries(skills||{})){
      const entry=manifestEntry('skills',id,record||{}),existing=existingSkills?.[id];
      if(force||!existing||existing.hash!==entry.hash||Number(existing.version)!==Number(entry.version)){updates[`${ROOTS.skills}/${id}`]=clone(record);updates[`${ROOTS.manifestSkills}/${id}`]=entry;skillsWritten+=1;manifestsWritten+=1;}
      state.manifest.skills[id]=entry;state.manifestMiss.skills.delete(id);cacheSet('skills',id,entry,record);
    }
    if(Object.keys(updates).length)await db.ref().update(updates);state.lastPublish={unitsWritten,skillsWritten,manifestsWritten,at:Date.now(),force};return{unitCount:Object.keys(units||{}).length,skillCount:Object.keys(skills||{}).length,unitsWritten,skillsWritten,manifestsWritten,force};
  }
  function clearCache(){state.cache.units.clear();state.cache.skills.clear();state.manifest.units={};state.manifest.skills={};state.manifestMiss.units.clear();state.manifestMiss.skills.clear();}
  function setDb(db){state.db=db;return Boolean(db?.ref);}

  global.LuminousUniversalLibrary=Object.freeze({version:'1.2.0',ROOTS,state,setDb,stableStringify,hash,versionFor,spriteFor,skillIdsFor,manifestEntry,unitWithLoadout,getManifest,getRecord,getSkill,getUnit,validateSkill,validateUnit,resolveUnit,listUnitManifest,publish,mergeOverride,clearCache});
  if(typeof module!=='undefined'&&module.exports)module.exports=global.LuminousUniversalLibrary;
})(typeof window!=='undefined'?window:globalThis);
