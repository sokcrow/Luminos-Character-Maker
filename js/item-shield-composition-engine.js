(function (global) {
  "use strict";

  if (global.LuminousShieldCompositionEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShieldCompositionEngine;
    return;
  }

  function safeRequire(path) { if (typeof require !== "function") return null; try { return require(path); } catch (_) { return null; } }
  const Materials = global.LuminousArmorMaterialProfile || safeRequire("./item-armor-material-profile.js");
  const Components = global.LuminousShieldComponentCatalog || safeRequire("./item-catalog-shield-components.js");
  const UpgradeEngine = global.LuminousShieldUpgradeEngine || safeRequire("./item-shield-upgrade-engine.js");
  if (!Materials || !Components) throw new Error("Shield material/components are required before LuminousShieldCompositionEngine.");

  const VERSION = 1;
  const DEFAULT_QUALITY = "standard";
  const QUALITY_ORDER = Object.freeze(["ruined","poor","standard","fine","exceptional"]);
  const QUALITY_SCORE = Object.freeze({ ruined:0, poor:1, standard:2, fine:3, exceptional:4 });
  const QUALITY_STRUCTURE = Object.freeze({ ruined:0.70, poor:0.85, standard:1.00, fine:1.10, exceptional:1.20 });
  const QUALITY_DURABILITY = Object.freeze({ ruined:0.60, poor:0.80, standard:1.00, fine:1.20, exceptional:1.40 });
  const QUALITY_VALUE = Object.freeze({ ruined:0.20, poor:0.55, standard:1.00, fine:1.65, exceptional:2.50 });

  const MATERIAL_STRUCTURE = Object.freeze({
    textile:0.20, leather:0.35, hide:0.40, wood:0.55, bone:0.60, horn:0.60,
    shell:0.68, chitin:0.70, scale:0.72, bronze:0.74, ceramic:0.75, iron:0.76,
    carbon_steel:0.82, stainless_steel:0.82, high_carbon_steel:0.85, nickel_steel:0.87,
    titanium:0.88, chrome_steel:0.89, hardened_steel:0.90, titanium_alloy:0.94,
    tungsten:0.95, advanced_titanium_alloy:0.98, tungsten_alloy:1.00,
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) { return Components.normalizeId(value); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function slot(componentId, quantity = 1) { return Object.freeze({ componentId:normalizeId(componentId), quantity:Math.max(1, Math.trunc(quantity || 1)) }); }
  function chassis(def) {
    return Object.freeze({
      id:normalizeId(def.id), name:def.name, iconFamily:"shield", handCost:1,
      primaryComponentId:"shield_component_body", components:Object.freeze(def.components.slice()),
      guardMin:Number(def.guardMin), guardMax:Number(def.guardMax),
      baseWeightEffect:Object.freeze({ min:Number(def.baseWeightEffect?.min || 0), max:Number(def.baseWeightEffect?.max || 0) }),
      strengthTarget:clamp(def.strengthTarget,0,13), clashModifier:Number(def.clashModifier || 0),
      shieldCrackedPower:Number(def.shieldCrackedPower || 0), intrinsicParryTier:Number(def.intrinsicParryTier || 0),
      baseThreshold:Number(def.baseThreshold || 20), assemblyMultiplier:Number(def.assemblyMultiplier || 1),
      requiredToolType:normalizeId(def.requiredToolType || "fabrication_tools"), semanticCheck:normalizeId(def.semanticCheck || "fabrication"),
    });
  }

  const CHASSIS = Object.freeze([
    chassis({ id:"shield_buckler", name:"Buckler", components:[slot("shield_component_body"),slot("shield_component_grip")], guardMin:8, guardMax:15, baseWeightEffect:{min:0,max:0}, strengthTarget:4, clashModifier:2, shieldCrackedPower:0, intrinsicParryTier:1, baseThreshold:18, assemblyMultiplier:1.15 }),
    chassis({ id:"shield_round", name:"Round Shield", components:[slot("shield_component_body",2),slot("shield_component_rim"),slot("shield_component_grip")], guardMin:15, guardMax:25, baseWeightEffect:{min:0,max:-1}, strengthTarget:6, clashModifier:1, shieldCrackedPower:1, intrinsicParryTier:0, baseThreshold:20, assemblyMultiplier:1.20 }),
    chassis({ id:"shield_heater", name:"Heater Shield", components:[slot("shield_component_body",3),slot("shield_component_rim"),slot("shield_component_grip")], guardMin:22, guardMax:35, baseWeightEffect:{min:0,max:-2}, strengthTarget:8, clashModifier:0, shieldCrackedPower:2, intrinsicParryTier:0, baseThreshold:22, assemblyMultiplier:1.25 }),
    chassis({ id:"shield_tower", name:"Tower Shield", components:[slot("shield_component_body",5),slot("shield_component_rim",2),slot("shield_component_grip")], guardMin:30, guardMax:50, baseWeightEffect:{min:-1,max:-3}, strengthTarget:11, clashModifier:-2, shieldCrackedPower:3, intrinsicParryTier:0, baseThreshold:24, assemblyMultiplier:1.30 }),
  ]);
  const BY_ID = Object.freeze(Object.fromEntries(CHASSIS.map((row) => [row.id,row])));

  function getChassis(id) { const row = BY_ID[normalizeId(id)]; return row ? clone(row) : null; }
  function listChassis() { return CHASSIS.map(clone); }
  function craftAdjustment(craftResult, threshold) { const m=Number(craftResult)-Number(threshold); if(!Number.isFinite(m))return 0; if(m>=5)return 1; if(m>=0)return 0; if(m>=-4)return-1; return-2; }
  function qualityOf(rows, craftResult, threshold) {
    let sum=0,count=0;
    for (const row of rows) {
      const q=Number(row.quantity||1), score=QUALITY_SCORE[normalizeId(row.component.quality||DEFAULT_QUALITY)];
      if (score==null) continue;
      sum += score*q; count += q;
    }
    const base = count ? sum/count : QUALITY_SCORE.standard;
    const index = clamp(Math.round(base)+craftAdjustment(craftResult,threshold),0,4);
    return QUALITY_ORDER[index];
  }
  function weightTier(ratio) { if(!Number.isFinite(ratio)||ratio<=0)return 0; if(ratio<=0.70)return-2; if(ratio<=0.85)return-1; if(ratio<1.15)return 0; if(ratio<1.35)return 1; return 2; }
  function structureForMaterial(material) {
    const id = Materials.canonicalId ? Materials.canonicalId(material?.id || material?.materialId) : normalizeId(material?.id || material?.materialId);
    if (MATERIAL_STRUCTURE[id] != null) return MATERIAL_STRUCTURE[id];
    const durability = Number(material?.durability || 0);
    if (!Number.isFinite(durability) || durability <= 0) return 0.55;
    return clamp(0.20 + (durability / 60) * 0.80, 0.20, 1.00);
  }
  function requiredCountMap(def) { return Object.fromEntries(def.components.map((need)=>[need.componentId,need.quantity])); }
  function validateAssembly(def, rows) {
    const required=requiredCountMap(def), seen={};
    for(const row of rows){ if(!row?.component?.valid)return{valid:false,reason:"invalid_component"}; const id=normalizeId(row.component.componentId),q=Math.max(1,Math.trunc(row.quantity||1)); seen[id]=(seen[id]||0)+q; }
    for(const [id,q] of Object.entries(required)) if((seen[id]||0)<q)return{valid:false,reason:"missing_component",componentId:id,required:q,actual:seen[id]||0};
    return {valid:true};
  }
  function componentRowsForReference(def) { return def.components.map((need)=>({component:Components.resolveReferenceComponent(need.componentId),quantity:need.quantity})); }
  function rowEffects(row) { return row.component.shieldUpgradeEffects || {}; }
  function totalWeight(rows) {
    return rows.reduce((sum,row)=>{
      const base=Number(row.component.weightScore||0)*Number(row.quantity||1);
      return sum + base * Math.max(0.20,1+Number(rowEffects(row).weightPercent||0)/100);
    },0);
  }
  function totalDurability(rows) {
    return rows.reduce((sum,row)=>{
      const base=Number(row.component.durability||0)*Number(row.quantity||1);
      return sum + base * Math.max(0.40,1+Number(rowEffects(row).durabilityPercent||0)/100);
    },0);
  }
  function totalUpgradeValue(rows) { return rows.reduce((sum,row)=>sum+Number(row.component.upgradeProductionValueAhn||0),0); }
  function totalBaseValue(rows) { return rows.reduce((sum,row)=>sum+Number(row.component.productionValueAhn||0)*Number(row.quantity||1),0); }
  function guardDelta(rows) { return rows.reduce((sum,row)=>sum+Number(rowEffects(row).guardDelta||0),0); }
  function effectSum(rows,key) { return rows.reduce((sum,row)=>sum+Number(rowEffects(row)[key]||0),0); }
  function effectMax(rows,key) { return rows.reduce((max,row)=>Math.max(max,Number(rowEffects(row)[key]||0)),0); }
  function bodyMaterial(def, rows) { return rows.find((row)=>normalizeId(row.component.componentId)===def.primaryComponentId)?.component?.primaryMaterial || null; }
  function displayMaterial(material) { if(!material)return""; return (material.lineageName?`${material.lineageName} ${material.name}`:material.name||"").replace(/\s+/g," ").trim(); }
  function qualityLabel(id) { return ({ruined:"Ruined",poor:"Poor",standard:"Standard",fine:"Fine",exceptional:"Exceptional"})[id] || "Standard"; }
  function displayName(def, material, quality) {
    const base = `${displayMaterial(material)} ${def.name}`.replace(/\s+/g," ").trim();
    return quality === "standard" ? base : `${qualityLabel(quality)} ${base}`.trim();
  }
  function attackModes(rows) {
    const map = new Map([["bash",{id:"bash",damageType:"blunt",tags:["shield","impact","tremor_capable"],surfaces:["impact"]}]]);
    for(const row of rows) for(const mode of rowEffects(row).addAttackModes||[]) map.set(mode.id,clone(mode));
    return Object.freeze([...map.values()].map(Object.freeze));
  }
  function tags(rows) {
    const out=new Set(["shield","impact","tremor_capable"]);
    rows.forEach((row)=>(rowEffects(row).addTags||[]).forEach((tag)=>out.add(normalizeId(tag))));
    return Object.freeze([...out]);
  }
  function statusAmplifiers(rows) { return Object.freeze(rows.flatMap((row)=>clone(rowEffects(row).statusAmplifiers||[])).map(Object.freeze)); }
  function elementalWear(rows) {
    const totals={fire:0,cold:0,lightning:0,acid:0}; let weight=0;
    for(const row of rows){ const q=Number(row.quantity||1); weight+=q; for(const key of Object.keys(totals))totals[key]+=Number(row.component.elementalWear?.[key]||1)*q; }
    if(!weight)return Object.freeze({fire:1,cold:1,lightning:1,acid:1});
    return Object.freeze(Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v/weight])));
  }

  function assemble(chassisId, componentRows, options = {}) {
    const def=BY_ID[normalizeId(chassisId)]; if(!def)return Object.freeze({valid:false,reason:"unknown_chassis"});
    const rows=(componentRows||[]).map((row)=>({component:row.component||row,quantity:Math.max(1,Math.trunc(row.quantity||1))}));
    const valid=validateAssembly(def,rows); if(!valid.valid)return Object.freeze(valid);
    const quality=qualityOf(rows,options.craftResult,def.baseThreshold);
    const material=bodyMaterial(def,rows); if(!material)return Object.freeze({valid:false,reason:"missing_primary_body_material"});
    const baseStructure=structureForMaterial(material), effectiveStructure=clamp(baseStructure*QUALITY_STRUCTURE[quality],0,1);
    const rawGuard=Math.floor(def.guardMin+(def.guardMax-def.guardMin)*effectiveStructure);
    const guard=clamp(rawGuard+guardDelta(rows),0,100);
    const referenceWeight=totalWeight(componentRowsForReference(def)), actualWeight=totalWeight(rows), ratio=referenceWeight?actualWeight/referenceWeight:1, tier=weightTier(ratio);
    const speedMin=Number(def.baseWeightEffect.min||0)+(tier<=-2?1:tier>=2?-1:0);
    const speedMax=Number(def.baseWeightEffect.max||0)-tier;
    const strengthTarget=clamp(def.strengthTarget+tier+effectSum(rows,"strengthRequirementDelta"),0,13);
    const rawDurability=totalDurability(rows), durability=Math.max(1,Math.floor(rawDurability*QUALITY_DURABILITY[quality]));
    const standardPhysicalValueAhn=Components.roundAhn((totalBaseValue(rows)+totalUpgradeValue(rows))*def.assemblyMultiplier);
    const productionValueAhn=Components.roundAhn(standardPhysicalValueAhn*QUALITY_VALUE[quality]);
    const parryTier=Math.max(def.intrinsicParryTier,effectMax(rows,"parryTier"));
    const intrinsicParry=def.intrinsicParryTier>0;
    return Object.freeze({
      valid:true, itemType:"shield", category:"shield", chassisId:def.id, name:displayName(def,material,quality), iconFamily:"shield", handCost:1,
      equipment:Object.freeze({kind:"shield",handCost:1}), quality, qualityMultipliers:Object.freeze({structure:QUALITY_STRUCTURE[quality],durability:QUALITY_DURABILITY[quality],value:QUALITY_VALUE[quality],weight:1}),
      primaryMaterial:clone(material), materialStructure:baseStructure, effectiveStructure, guardRange:Object.freeze({min:def.guardMin,max:def.guardMax}), baseGuard:rawGuard, guard,
      proficiencyGuardPerPoint:2, physicalResistanceSupport:Object.freeze({base:0.02,perProficiency:0.02,cap:0.08}),
      clashModifier:def.clashModifier+effectSum(rows,"clashModifier"), shieldCrackedPower:def.shieldCrackedPower+effectSum(rows,"shieldCrackedDelta"),
      staggerOnCrashWin:effectSum(rows,"staggerOnCrashWin"), extraWearOnCrashContact:effectSum(rows,"extraWearOnCrashContact"), elementalWearFlatReduction:effectSum(rows,"elementalWearFlatReduction"),
      intrinsicParry, parry:Object.freeze({enabled:parryTier>0,tier:parryTier||1,skillType:"ClashableGuard"}),
      attackModes:attackModes(rows), tags:tags(rows), statusAmplifiers:statusAmplifiers(rows), shieldAttackDamagePercent:effectSum(rows,"shieldAttackDamagePercent")+effectSum(rows,"damagePercent"),
      components:Object.freeze(rows.map((row)=>Object.freeze({component:clone(row.component),quantity:row.quantity}))),
      weightScore:actualWeight, referenceWeightScore:referenceWeight, weightRatio:ratio, weightTier:tier, weightEffect:Object.freeze({min:speedMin,max:speedMax}), strengthTarget,
      rawDurability, durability, maxDurability:durability, elementalWear:elementalWear(rows), standardPhysicalValueAhn, productionValueAhn,
      assemblyMultiplier:def.assemblyMultiplier, baseThreshold:def.baseThreshold, requiredToolType:def.requiredToolType, semanticCheck:def.semanticCheck,
    });
  }

  function resolvePreset(chassisId, plan = {}, options = {}) {
    const def=BY_ID[normalizeId(chassisId)]; if(!def)return Object.freeze({valid:false,reason:"unknown_chassis"});
    const rows=[];
    for(const need of def.components){
      const choice=plan[need.componentId]||{};
      let component=Components.resolveComponent(need.componentId,choice.materials||choice,{quality:choice.quality||options.componentQuality||DEFAULT_QUALITY});
      if(choice.upgrades?.length&&UpgradeEngine)component=UpgradeEngine.apply(component,choice.upgrades);
      if(!component?.valid)return component;
      rows.push({component,quantity:need.quantity});
    }
    return assemble(def.id,rows,options);
  }
  function resolveReferenceShield(chassisId, options = {}) { return resolvePreset(chassisId,{},options); }

  const API=Object.freeze({
    VERSION, DEFAULT_QUALITY, QUALITY_ORDER, QUALITY_STRUCTURE, QUALITY_DURABILITY, QUALITY_VALUE, MATERIAL_STRUCTURE,
    CHASSIS, normalizeId, getChassis, listChassis, craftAdjustment, qualityOf, weightTier, structureForMaterial, assemble, resolvePreset, resolveReferenceShield,
  });
  global.LuminousShieldCompositionEngine=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
