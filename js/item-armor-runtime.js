(function (global) {
  "use strict";
  if (global.LuminousArmorRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousArmorRuntime;
    return;
  }
  function safeRequire(path){if(typeof require!=="function")return null;try{return require(path);}catch(_){return null;}}
  const DefensiveWear=global.LuminousDefensiveWearRuntime||safeRequire("./item-defensive-wear-runtime.js");
  const VERSION=1;
  const UNARMORED_BASE=Object.freeze({slash:1.35,pierce:1.35,blunt:1.35});
  const NORMAL_CON_RATE=0.03, ARMORLESS_CON_RATE=0.05, ARMOR_PROFICIENCY_BONUS=0.02;
  const ARMOR_RESISTANCE_MIN=0.30, ARMOR_RESISTANCE_MAX=1.50, STR_RELIEF_THRESHOLD=3;
  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function roundResistance(n){return Math.round((Number(n)+Number.EPSILON)*100)/100;}
  function baseSpeed(dexMod){const dex=Math.floor(Number(dexMod)||0);return Object.freeze({min:Math.max(1,Math.floor(dex/4)+1),max:Math.max(2,dex+2)});}
  function hasStrengthRelief(armor,strengthScore,threshold=STR_RELIEF_THRESHOLD){if(!armor||!Number.isFinite(Number(armor.strengthTarget))||Number(armor.strengthTarget)<=0)return false;return Number(strengthScore)>=Number(armor.strengthTarget)+Number(threshold);}
  function relieveWeightEffect(effect,relief){const n=Number(effect)||0;if(!relief||n>=0)return n;const halved=Math.floor(Math.abs(n)/2);return halved===0?0:-halved;}
  function resolveSpeed({dexMod=0,armor=null,strengthScore=0,strengthReliefThreshold=STR_RELIEF_THRESHOLD,nonWeightMin=0,nonWeightMax=0}={}){
    const base=baseSpeed(dexMod),relief=hasStrengthRelief(armor,strengthScore,strengthReliefThreshold),raw=armor?.weightEffect||{min:0,max:0};
    const effective={min:relieveWeightEffect(raw.min,relief),max:relieveWeightEffect(raw.max,relief)};
    let min=Math.max(1,Math.floor(base.min+effective.min+Number(nonWeightMin||0))),max=Math.max(2,Math.floor(base.max+effective.max+Number(nonWeightMax||0)));if(min>max)min=max;
    return Object.freeze({base,rawWeightEffect:Object.freeze({min:Number(raw.min||0),max:Number(raw.max||0)}),strengthRelief:relief,effectiveWeightEffect:Object.freeze(effective),min,max});
  }
  function resolvePhysicalResistance({armor=null,constitutionMod=0,proficient=false,armorlessDefense=false}={}){
    const con=Number(constitutionMod)||0;
    const armorlessEligible=!!armorlessDefense&&(!armor||armor.classification==="clothing");
    const base=armorlessEligible||!armor?UNARMORED_BASE:armor.physicalResistanceProfile;
    const conRate=armorlessEligible?ARMORLESS_CON_RATE:NORMAL_CON_RATE;
    const conAdjustment=con*conRate;
    const proficiencyAdjustment=armor?.isArmor&&proficient&&!armorlessEligible?ARMOR_PROFICIENCY_BONUS:0;
    const final={};
    for(const type of ["slash","pierce","blunt"]){const raw=Number(base?.[type]??1.35)-conAdjustment-proficiencyAdjustment;final[type]=roundResistance(armor?.isArmor&&!armorlessEligible?clamp(raw,ARMOR_RESISTANCE_MIN,ARMOR_RESISTANCE_MAX):Math.max(0,raw));}
    return Object.freeze({base:Object.freeze({...base}),conRate,conAdjustment,proficiencyAdjustment,armorlessDefenseApplied:armorlessEligible,final:Object.freeze(final)});
  }
  function applyPhysicalDamage(amount,damageType,resistance){const n=Math.max(0,Number(amount)||0),type=String(damageType||"").toLowerCase(),profile=resistance?.final||resistance||UNARMORED_BASE,m=Number(profile[type]??1);return n*m;}
  function resolveDurabilityWear({damage=0,damageType="",armor=null}={}){
    if(DefensiveWear?.resolveArmorWear)return DefensiveWear.resolveArmorWear({damage,damageType,elementalWear:armor?.elementalWear});
    const n=Math.max(0,Number(damage)||0);if(!n)return 0;
    const base=Math.max(1,Math.floor(n/10)),type=String(damageType||"").toLowerCase();
    if(!["fire","cold","lightning","acid"].includes(type))return base;
    const factor=Number(armor?.elementalWear?.[type]||1);
    return Math.max(1,Math.floor(base*1.25*factor));
  }
  const API=Object.freeze({VERSION,UNARMORED_BASE,NORMAL_CON_RATE,ARMORLESS_CON_RATE,ARMOR_PROFICIENCY_BONUS,ARMOR_RESISTANCE_MIN,ARMOR_RESISTANCE_MAX,STR_RELIEF_THRESHOLD,baseSpeed,hasStrengthRelief,relieveWeightEffect,resolveSpeed,resolvePhysicalResistance,applyPhysicalDamage,resolveDurabilityWear});
  global.LuminousArmorRuntime=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
