(function (global) {
  "use strict";

  if (global.LuminousFirearmAmmoCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFirearmAmmoCatalog;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const AmmoRuntime = global.LuminousAmmoRuntime || safeRequire("./item-ammo-runtime.js");
  const VERSION = 1;
  const FAMILY = "firearm_ammunition";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const GENERIC_AMMO_ICON = "Assets/Icons/items/resource/ammo.png";
  const DEDICATED_PART_ICON_STATUS = "pending_dedicated_art";
  const FORBIDDEN_ORDINARY_STATUS = Object.freeze(["decay","radiance"]);

  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function roundAhn(value) { const n=Number(value); return Number.isFinite(n) ? Math.max(0,Math.round(n/1000)*1000) : null; }

  function part(def) {
    return Object.freeze({
      id:normalizeId(def.id),name:def.name,family:FAMILY,category:"component",itemType:"ammo_component",stackable:true,currency:CURRENCY,
      iconFamily:"ammo",icon:GENERIC_AMMO_ICON,iconStatus:DEDICATED_PART_ICON_STATUS,role:normalizeId(def.role),baseThreshold:Number(def.baseThreshold),
      requiredToolType:normalizeId(def.requiredToolType),semanticCheck:normalizeId(def.semanticCheck),processMultiplier:Number(def.processMultiplier),
      authority:Object.freeze((def.authority || []).map(normalizeId)),ordinaryStatusForbidden:Object.freeze(FORBIDDEN_ORDINARY_STATUS.slice()),
      notes:def.notes || "",
    });
  }

  const PARTS = Object.freeze([
    part({id:"ammo_projectile",name:"Firearm Projectile",role:"projectile",baseThreshold:24,requiredToolType:"technical_tools",semanticCheck:"precision_fabrication",processMultiplier:1.65,authority:["combat_grade","damage_type","physical_profile","elemental_profile"],notes:"The offensive material controls canonical physical Ammo Combat Grade."}),
    part({id:"ammo_casing",name:"Firearm Casing / Hull",role:"casing",baseThreshold:22,requiredToolType:"technical_tools",semanticCheck:"housing_fabrication",processMultiplier:1.35,authority:["compatibility","reliability","structure"]}),
    part({id:"ammo_propellant",name:"Propellant Charge",role:"propellant",baseThreshold:24,requiredToolType:"chemical_tools",semanticCheck:"chemical_processing",processMultiplier:1.40,authority:["caliber_support","reliability"],notes:"Abstract game component; no real-world chemical recipe is encoded."}),
    part({id:"ammo_ignition",name:"Primer / Ignition Component",role:"ignition",baseThreshold:24,requiredToolType:"technical_tools",semanticCheck:"precision_fabrication",processMultiplier:1.65,authority:["reliability"],notes:"Abstract game component; no real-world ignition recipe is encoded."}),
  ]);
  const PART_BY_ID = Object.freeze(Object.fromEntries(PARTS.map((entry)=>[entry.id,entry])));

  const CALIBER_TIERS = Object.freeze({
    1:Object.freeze({tier:1,id:"caliber_1",batchYield:20,label:"Caliber Tier 1"}),
    2:Object.freeze({tier:2,id:"caliber_2",batchYield:15,label:"Caliber Tier 2"}),
    3:Object.freeze({tier:3,id:"caliber_3",batchYield:10,label:"Caliber Tier 3"}),
    4:Object.freeze({tier:4,id:"caliber_4",batchYield:5,label:"Caliber Tier 4"}),
  });

  const BATCH_ASSEMBLY_MULTIPLIER = 1.30;

  function getPart(id) { const row=PART_BY_ID[normalizeId(id)]; return row ? clone(row) : null; }
  function listParts() { return PARTS.map(clone); }
  function getCaliberTier(tier) { const row=CALIBER_TIERS[Math.round(Number(tier))]; return row ? clone(row) : null; }

  function combatGradeForMaterial(materialId, override) {
    if (AmmoRuntime?.combatGradeForMaterial) return AmmoRuntime.combatGradeForMaterial(materialId,override);
    const explicit=Number(override); return Number.isFinite(explicit) ? Math.max(-3,Math.min(3,Math.round(explicit))) : 0;
  }
  function combatGradeDamagePercent(grade) {
    if (AmmoRuntime?.combatGradeDamagePercent) return AmmoRuntime.combatGradeDamagePercent(grade);
    return ({"-3":-30,"-2":-20,"-1":-10,"0":0,"1":5,"2":10,"3":15})[String(Math.max(-3,Math.min(3,Math.round(Number(grade)||0))))] || 0;
  }

  function resolveBatch(caliberTier, partBatchValuesAhn = {}, options = {}) {
    const tier=getCaliberTier(caliberTier);
    if (!tier) return Object.freeze({valid:false,reason:"invalid_caliber_tier"});
    let inputValue=0;
    for (const partDef of PARTS) {
      const value=Number(partBatchValuesAhn[partDef.id] ?? partBatchValuesAhn[partDef.role]);
      if (!Number.isFinite(value) || value < 0) return Object.freeze({valid:false,reason:"missing_part_batch_value",partId:partDef.id});
      inputValue += value;
    }
    const batchProductionValueAhn=roundAhn(inputValue * Number(options.assemblyMultiplier || BATCH_ASSEMBLY_MULTIPLIER));
    const unitProductionValueAhn=Math.round(batchProductionValueAhn / tier.batchYield);
    return Object.freeze({valid:true,caliberTier:tier.tier,batchYield:tier.batchYield,batchProductionValueAhn,unitProductionValueAhn,assemblyMultiplier:Number(options.assemblyMultiplier || BATCH_ASSEMBLY_MULTIPLIER)});
  }

  function validateStatus(statusId) {
    const id=normalizeId(statusId);
    return Object.freeze({valid:!FORBIDDEN_ORDINARY_STATUS.includes(id),statusId:id,reason:FORBIDDEN_ORDINARY_STATUS.includes(id)?"forbidden_ordinary_firearm_ammo_status":null});
  }

  function resolveRoundProfile(input = {}) {
    const tier=getCaliberTier(input.caliberTier);
    if (!tier) return Object.freeze({valid:false,reason:"invalid_caliber_tier"});
    const offensiveMaterialId=normalizeId(input.offensiveMaterialId || "iron");
    const combatGrade=combatGradeForMaterial(offensiveMaterialId,input.combatGradeOverride);
    const materialDamagePercent=combatGradeDamagePercent(combatGrade);
    const statusId=normalizeId(input.statusId || "");
    if (statusId && !validateStatus(statusId).valid) return Object.freeze({valid:false,reason:"forbidden_ordinary_firearm_ammo_status",statusId});
    return Object.freeze({
      valid:true,ammoFamily:FAMILY,caliberTier:tier.tier,offensiveMaterialId,combatGrade,materialDamagePercent,
      quality:normalizeId(input.quality || DEFAULT_QUALITY),damageType:normalizeId(input.damageType || "pierce"),
      physicalProfile:normalizeId(input.physicalProfile || "standard"),elementalProfile:normalizeId(input.elementalProfile || ""),
      statusId,statusRule:"skill_driven_amplification_only",createsAbsentStatus:false,forbiddenOrdinaryStatus:Object.freeze(FORBIDDEN_ORDINARY_STATUS.slice()),
      consumedPerCadenceUnit:1,
    });
  }

  const API = Object.freeze({
    VERSION,FAMILY,CURRENCY,DEFAULT_QUALITY,GENERIC_AMMO_ICON,DEDICATED_PART_ICON_STATUS,FORBIDDEN_ORDINARY_STATUS,PARTS,CALIBER_TIERS,BATCH_ASSEMBLY_MULTIPLIER,
    normalizeId,getPart,listParts,getCaliberTier,combatGradeForMaterial,combatGradeDamagePercent,resolveBatch,validateStatus,resolveRoundProfile,
  });

  global.LuminousFirearmAmmoCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
