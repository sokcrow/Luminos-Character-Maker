(function (global) {
  "use strict";

  if (global.LuminousFirearmCompositionEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFirearmCompositionEngine;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Parts = global.LuminousFirearmComponentCatalog || safeRequire("./item-catalog-firearm-components.js");
  if (!Parts) throw new Error("LuminousFirearmComponentCatalog is required before LuminousFirearmCompositionEngine.");

  const VERSION = 1;
  const DEFAULT_QUALITY = "standard";
  const QUALITY_ORDER = Object.freeze(["ruined","poor","standard","fine","exceptional"]);
  const QUALITY_SCORE = Object.freeze({ruined:0,poor:1,standard:2,fine:3,exceptional:4});

  function normalizeId(value) { return Parts.normalizeId(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function slot(componentId, required = true) { return Object.freeze({componentId:normalizeId(componentId),required:!!required}); }

  function chassis(def) {
    return Object.freeze({
      id:normalizeId(def.id), name:def.name, classification:normalizeId(def.classification), iconFamily:normalizeId(def.iconFamily),
      components:Object.freeze(def.components.slice()), optionalComponents:Object.freeze((def.optionalComponents || []).slice()),
      baseThreshold:Number(def.baseThreshold), assemblyMultiplier:Number(def.assemblyMultiplier), requiredToolType:normalizeId(def.requiredToolType || "technical_tools"),
      semanticCheck:normalizeId(def.semanticCheck || "firearm_assembly"), handMode:normalizeId(def.handMode), handCost:Number(def.handCost),
      rangeProfile:normalizeId(def.rangeProfile), allowedCadenceModes:Object.freeze((def.allowedCadenceModes || []).map(normalizeId)),
      feedTypes:Object.freeze((def.feedTypes || []).map(normalizeId)),
    });
  }

  const CHASSIS = Object.freeze([
    chassis({id:"pistol",name:"Pistol",classification:"simple_firearm",iconFamily:"weapon_firearm_pistol",components:[slot("compact_frame"),slot("compact_barrel"),slot("standard_action"),slot("trigger_group"),slot("grip"),slot("compact_magazine"),slot("sights")],optionalComponents:[slot("stock",false)],baseThreshold:24,assemblyMultiplier:1.35,handMode:"one_handed",handCost:1,rangeProfile:"faster",allowedCadenceModes:["single","rapid"],feedTypes:["magazine"]}),
    chassis({id:"revolver",name:"Revolver",classification:"simple_firearm",iconFamily:"weapon_firearm_revolver",components:[slot("compact_frame"),slot("compact_barrel"),slot("standard_action"),slot("trigger_group"),slot("grip"),slot("cylinder"),slot("sights")],optionalComponents:[slot("stock",false)],baseThreshold:24,assemblyMultiplier:1.35,handMode:"one_handed",handCost:1,rangeProfile:"faster",allowedCadenceModes:["single"],feedTypes:["cylinder"]}),
    chassis({id:"smg",name:"SMG",classification:"martial_firearm",iconFamily:"weapon_firearm_smg",components:[slot("standard_frame"),slot("compact_barrel"),slot("high_cadence_action"),slot("trigger_group"),slot("grip"),slot("standard_magazine"),slot("stock"),slot("sights")],baseThreshold:26,assemblyMultiplier:1.40,handMode:"versatile",handCost:1,rangeProfile:"slower",allowedCadenceModes:["single","rapid","burst","full"],feedTypes:["magazine"]}),
    chassis({id:"rifle",name:"Rifle",classification:"martial_firearm",iconFamily:"weapon_firearm_rifle",components:[slot("long_frame"),slot("long_barrel"),slot("standard_action"),slot("trigger_group"),slot("grip"),slot("stock"),slot("standard_magazine"),slot("sights")],baseThreshold:26,assemblyMultiplier:1.40,handMode:"two_handed",handCost:2,rangeProfile:"fastest",allowedCadenceModes:["single","rapid"],feedTypes:["magazine"]}),
    chassis({id:"shotgun",name:"Shotgun",classification:"martial_firearm",iconFamily:"weapon_firearm_shotgun",components:[slot("long_frame"),slot("standard_barrel"),slot("standard_action"),slot("trigger_group"),slot("grip"),slot("stock"),slot("tube_feed"),slot("sights")],baseThreshold:26,assemblyMultiplier:1.40,handMode:"two_handed",handCost:2,rangeProfile:"slowest",allowedCadenceModes:["single"],feedTypes:["tube_feed"]}),
  ]);
  const BY_ID = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id,entry])));

  function getChassis(id) { const def = BY_ID[normalizeId(id)]; return def ? clone(def) : null; }
  function listChassis() { return CHASSIS.map(clone); }

  function componentRows(componentIds) {
    return (componentIds || []).map((id) => Parts.resolveReferenceComponent(id)).filter(Boolean);
  }

  function uniqueRole(rows, role) {
    const found = rows.filter((row) => normalizeId(row.role) === normalizeId(role));
    return found.length === 1 ? found[0] : null;
  }

  function validateAssembly(componentInstances, options = {}) {
    const rows = (componentInstances || []).map((row) => typeof row === "string" ? Parts.resolveReferenceComponent(row) : clone(row)).filter(Boolean);
    if (!rows.length) return Object.freeze({valid:false,reason:"empty_component_set"});
    for (const role of ["frame","barrel","action","trigger","grip","feed","sights"]) {
      if (!uniqueRole(rows, role)) return Object.freeze({valid:false,reason:`requires_exactly_one_${role}`});
    }
    if (rows.filter((row) => normalizeId(row.role) === "stock").length > 1) return Object.freeze({valid:false,reason:"too_many_stocks"});
    const feedType = normalizeId(uniqueRole(rows,"feed")?.properties?.feedType);
    const expectedFeedTypes = (options.feedTypes || []).map(normalizeId);
    if (expectedFeedTypes.length && !expectedFeedTypes.includes(feedType)) return Object.freeze({valid:false,reason:"incompatible_feed_type",feedType});
    return Object.freeze({valid:true,rows:Object.freeze(rows)});
  }

  function intersectNumeric(arrays) {
    const valid = arrays.filter((x) => Array.isArray(x) && x.length);
    if (!valid.length) return [];
    return valid.slice(1).reduce((acc,next) => acc.filter((v) => next.includes(v)), valid[0].slice()).sort((a,b)=>a-b);
  }

  function deriveProfile(rows, chassisDef = null) {
    const action = uniqueRole(rows,"action");
    const feed = uniqueRole(rows,"feed");
    const frame = uniqueRole(rows,"frame");
    const barrel = uniqueRole(rows,"barrel");
    const supported = (action?.properties?.cadenceModes || ["single"]).map(normalizeId);
    const cadenceModes = chassisDef?.allowedCadenceModes?.length ? supported.filter((id) => chassisDef.allowedCadenceModes.includes(id)) : supported;
    const caliberTiers = intersectNumeric([frame?.properties?.caliberTiers,barrel?.properties?.caliberTiers]);
    const sum = (field) => rows.reduce((total,row) => total + Number(row?.properties?.[field] || 0),0);
    return Object.freeze({
      capacity:Number(feed?.properties?.capacity || 0),
      reload:clone(feed?.properties?.reload || null),
      feedType:normalizeId(feed?.properties?.feedType),
      cadenceModes:Object.freeze(cadenceModes),
      maxAmmoPerCoin:cadenceModes.includes("full") ? 4 : cadenceModes.includes("burst") ? 3 : cadenceModes.includes("rapid") ? 2 : 1,
      control:sum("control"),
      reliability:sum("reliability"),
      stability:sum("stability"),
      rangeProfile:normalizeId(chassisDef?.rangeProfile || ""),
      rangeEfficiency:sum("rangeEfficiency"),
      caliberTiers:Object.freeze(caliberTiers),
      directDamageFromWeapon:false,
      statusFromWeapon:false,
      soundSuppression:false,
    });
  }

  function compositionQuality(rows) {
    if (!rows.length) return DEFAULT_QUALITY;
    const score = rows.reduce((sum,row) => sum + (QUALITY_SCORE[normalizeId(row.quality || DEFAULT_QUALITY)] ?? QUALITY_SCORE.standard),0) / rows.length;
    return QUALITY_ORDER[Math.max(0,Math.min(QUALITY_ORDER.length-1,Math.round(score)))];
  }

  function craftAdjustment(craftResult, threshold) {
    const margin = Number(craftResult) - Number(threshold);
    if (!Number.isFinite(margin)) return 0;
    if (margin >= 5) return 1;
    if (margin >= 0) return 0;
    if (margin >= -4) return -1;
    return -2;
  }

  function finalQuality(rows, craftResult, threshold) {
    const base = compositionQuality(rows);
    const idx = QUALITY_SCORE[base] + craftAdjustment(craftResult,threshold);
    return QUALITY_ORDER[Math.max(0,Math.min(4,idx))];
  }

  function productionValue(rows, multiplier) {
    const sum = rows.reduce((total,row) => total + Number(row.productionValueAhn || 0),0);
    return Parts.roundAhn(sum * Number(multiplier || 1));
  }

  function referenceBuild(chassisId) {
    const def = BY_ID[normalizeId(chassisId)];
    if (!def) return null;
    const rows = componentRows(def.components.map((entry) => entry.componentId));
    const valid = validateAssembly(rows,{feedTypes:def.feedTypes});
    if (!valid.valid) return valid;
    return Object.freeze({
      valid:true,chassisId:def.id,name:def.name,classification:def.classification,iconFamily:def.iconFamily,
      components:Object.freeze(rows),productionValueAhn:productionValue(rows,def.assemblyMultiplier),baseThreshold:def.baseThreshold,
      assemblyMultiplier:def.assemblyMultiplier,requiredToolType:def.requiredToolType,semanticCheck:def.semanticCheck,handMode:def.handMode,handCost:def.handCost,
      quality:DEFAULT_QUALITY,profile:deriveProfile(rows,def),
    });
  }

  function assemble(chassisId, componentInstances, craftResult) {
    const def = BY_ID[normalizeId(chassisId)];
    if (!def) return Object.freeze({valid:false,reason:"unknown_chassis"});
    const valid = validateAssembly(componentInstances,{feedTypes:def.feedTypes});
    if (!valid.valid) return valid;
    const rows = valid.rows;
    return Object.freeze({
      valid:true,chassisId:def.id,name:def.name,classification:def.classification,iconFamily:def.iconFamily,components:rows,
      productionValueAhn:productionValue(rows,def.assemblyMultiplier),baseThreshold:def.baseThreshold,assemblyMultiplier:def.assemblyMultiplier,
      requiredToolType:def.requiredToolType,semanticCheck:def.semanticCheck,handMode:def.handMode,handCost:def.handCost,
      quality:finalQuality(rows,craftResult,def.baseThreshold),profile:deriveProfile(rows,def),
    });
  }

  const API = Object.freeze({VERSION,DEFAULT_QUALITY,CHASSIS,normalizeId,getChassis,listChassis,validateAssembly,deriveProfile,compositionQuality,craftAdjustment,finalQuality,productionValue,referenceBuild,assemble});
  global.LuminousFirearmCompositionEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
