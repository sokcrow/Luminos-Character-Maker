(function(global){
  'use strict';
  if(global.LuminousCombat073UnitDeployBridge)return;

  const clean=value=>String(value??'').trim();
  const clampQty=value=>Math.max(1,Math.min(20,Math.trunc(Number(value)||1)));
  function setup(){return global.LuminousCombatDmSetup073||null;}
  function adapterState(){return global.LuminousCombatLiveAdapter073?.state||null;}
  function isDm(){return adapterState()?.role==='dm';}
  function instantiator(){return global.LuminousUnitCombatInstantiator||null;}
  function library(){return global.LuminousUniversalLibrary||null;}
  function setMsg(text,bad=false){const node=global.document?.getElementById('c073-setup-msg');if(node){node.textContent=text;node.style.color=bad?'#ff8b78':'#9fd6a8';}}

  async function resolveDeploymentDefinition(unitId,definition,db){
    const lib=library();
    if(!lib?.resolveUnit)return{definition,source:'runtime-fallback',manifest:null,skillIds:lib?.skillIdsFor?.(definition)||definition.skillIds||[],missingSkills:[]};
    const resolved=await lib.resolveUnit(db,unitId,{campaignUnit:definition,loadSkills:false});
    if(resolved.missingSkills?.length)throw new Error(`UNIT_LOADOUT_INVALID:${unitId}:${resolved.missingSkills.join(',')}`);
    resolved.definition={
      ...resolved.definition,
      skillIds:resolved.skillIds,
      skillSlotIds:resolved.skillIds,
      action_slots:resolved.skillIds,
      equippedSkillIndex:resolved.equippedSkillIndex,
      libraryRef:resolved.manifest?{scope:'luminous_library',kind:'unit',id:unitId,version:resolved.manifest.version,hash:resolved.manifest.hash}:null
    };
    return resolved;
  }

  async function deployUnits(unitId,faction='enemy',quantity=1,options={}){
    const dmSetup=setup(),api=instantiator();
    if(!isDm())throw new Error('DM_ONLY');
    if(!dmSetup?.state?.db?.ref)throw new Error('COMBAT_DB_UNAVAILABLE');
    if(!api?.instantiate)throw new Error('UNIT_COMBAT_INSTANTIATOR_UNAVAILABLE');
    const visibleDefinition=dmSetup.state.units?.[unitId];
    if(!visibleDefinition||visibleDefinition.isPlayer===true)throw new Error('UNIT_NOT_FOUND');

    const resolved=await resolveDeploymentDefinition(unitId,visibleDefinition,dmSetup.state.db);
    const count=clampQty(quantity),side=faction==='ally'?'ally':'enemy',updates={};
    for(let index=0;index<count;index+=1){
      const serial=`${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2,6)}`;
      const combatant=api.instantiate(unitId,resolved.definition,{
        faction:side,serial,level:options.level,rank:options.rank,initializeEncounter:true
      });
      combatant.libraryRef=resolved.definition.libraryRef||null;
      combatant.librarySource=resolved.source;
      combatant.libraryVersion=resolved.manifest?.version||null;
      combatant.libraryHash=resolved.manifest?.hash||null;
      combatant.skillIds=[...(resolved.skillIds||combatant.skillIds||[])];
      combatant.skillSlotIds=[...combatant.skillIds];
      combatant.action_slots=[...combatant.skillIds];
      combatant.equippedSkillIndex=Object.fromEntries(combatant.skillIds.map(id=>[id,true]));
      updates[combatant.id]=combatant;
    }
    await dmSetup.state.db.ref('campaña/combate/combatants').update(updates);
    return Object.values(updates);
  }

  async function handleButton(button){
    const select=global.document?.getElementById('c073-unit'),qty=global.document?.getElementById('c073-qty'),unitId=clean(select?.value);
    if(!unitId)return setMsg('Selecciona una Unit real de la librería.',true);
    const side=button.id==='c073-ally'?'ally':'enemy';
    try{
      setMsg(`Validando Universal Library · ${unitId}…`);
      const deployed=await deployUnits(unitId,side,qty?.value||1),warnings=deployed[0]?.runtimeDiagnostics||{},notes=[];
      if(warnings.speedFallback)notes.push('Speed fallback 1–6');if(warnings.missingSprite)notes.push('sin sprite');if(warnings.missingSkills)notes.push('sin Skills');
      setMsg(`${deployed.length} Unit(s) desplegada(s) · loadout auto-equip${notes.length?` · ${notes.join(' · ')}`:''}.`);
    }catch(error){setMsg(`No se pudo desplegar: ${error?.message||error}`,true);}
  }
  function capture(event){const target=event.target?.closest?.('#c073-enemy,#c073-ally');if(!target||!isDm()||!instantiator())return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();handleButton(target);}
  function start(){if(!global.document?.addEventListener)return false;global.document.addEventListener('click',capture,true);return true;}
  function stop(){global.document?.removeEventListener?.('click',capture,true);}

  start();global.addEventListener?.('beforeunload',stop,{once:true});
  global.LuminousCombat073UnitDeployBridge=Object.freeze({version:'2.0.0',start,stop,deployUnits,resolveDeploymentDefinition});
})(window);
