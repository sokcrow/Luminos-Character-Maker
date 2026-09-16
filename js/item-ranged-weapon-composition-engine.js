(function (global) {
  "use strict";

  if (global.LuminousRangedWeaponCompositionEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRangedWeaponCompositionEngine;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Ranged = global.LuminousRangedWeaponComponentCatalog || safeRequire("./item-catalog-ranged-weapon-components.js");
  const Melee = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  const MeleeComposition = global.LuminousWeaponCompositionEngine || safeRequire("./item-weapon-composition-engine.js");
  if (!Ranged || !Melee || !MeleeComposition) throw new Error("Ranged, melee component, and melee composition catalogs are required.");

  const VERSION = 1;
  const DEFAULT_QUALITY = "standard";

  function normalizeId(value) { return Ranged.normalizeId(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function roundAhn(value) { return Melee.roundAhn(value); }
  function slot(componentId, source = "ranged", quantity = 1) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Ranged chassis component quantities must be positive integers.");
    return Object.freeze({componentId:normalizeId(componentId),source:normalizeId(source),quantity});
  }
  function materialInput(slotId, quantity, requirements, referenceMaterialId, componentId) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Ammo material quantities must be positive integers.");
    return Object.freeze({slot:normalizeId(slotId),quantity,requirements:Object.freeze((requirements || []).map(normalizeId)),referenceMaterialId:normalizeId(referenceMaterialId),componentId:normalizeId(componentId)});
  }

  function chassis(def) {
    return Object.freeze({
      id:normalizeId(def.id), name:def.name, classification:normalizeId(def.classification), primaryComponentId:normalizeId(def.primaryComponentId),
      components:Object.freeze(def.components.slice()), baseThreshold:Number(def.baseThreshold), assemblyMultiplier:Number(def.assemblyMultiplier),
      requiredToolType:normalizeId(def.requiredToolType), semanticCheck:normalizeId(def.semanticCheck), iconFamily:normalizeId(def.iconFamily),
      handMode:normalizeId(def.handMode), handCost:Number(def.handCost), controlOnly:!!def.controlOnly, ammoRecipeId:normalizeId(def.ammoRecipeId || ""),
    });
  }

  const CHASSIS = Object.freeze([
    chassis({id:"shortbow",name:"Shortbow",classification:"simple_ranged",primaryComponentId:"bow_stave_short",components:[slot("bow_stave_short"),slot("bowstring"),slot("grip","melee")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"woodcarver_tools",semanticCheck:"bowmaking",iconFamily:"weapon_bow",handMode:"two_handed",handCost:2}),
    chassis({id:"longbow",name:"Longbow",classification:"martial_ranged",primaryComponentId:"bow_stave_long",components:[slot("bow_stave_long"),slot("bowstring"),slot("grip","melee")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"woodcarver_tools",semanticCheck:"bowmaking",iconFamily:"weapon_bow",handMode:"two_handed",handCost:2}),
    chassis({id:"hand_crossbow",name:"Hand Crossbow",classification:"martial_ranged",primaryComponentId:"crossbow_stock_small",components:[slot("crossbow_stock_small"),slot("crossbow_prod_small"),slot("bowstring"),slot("crossbow_trigger_lock"),slot("grip","melee")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"tinker_tools",semanticCheck:"crossbowmaking",iconFamily:"weapon_crossbow",handMode:"one_handed",handCost:1}),
    chassis({id:"light_crossbow",name:"Light Crossbow",classification:"simple_ranged",primaryComponentId:"crossbow_stock_medium",components:[slot("crossbow_stock_medium"),slot("crossbow_prod_medium"),slot("bowstring"),slot("crossbow_trigger_lock"),slot("grip","melee")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"tinker_tools",semanticCheck:"crossbowmaking",iconFamily:"weapon_crossbow",handMode:"two_handed",handCost:2}),
    chassis({id:"heavy_crossbow",name:"Heavy Crossbow",classification:"martial_ranged",primaryComponentId:"crossbow_stock_large",components:[slot("crossbow_stock_large"),slot("crossbow_prod_large"),slot("bowstring"),slot("crossbow_trigger_lock"),slot("grip","melee")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"tinker_tools",semanticCheck:"crossbowmaking",iconFamily:"weapon_crossbow",handMode:"two_handed",handCost:2}),
    chassis({id:"sling",name:"Sling",classification:"simple_ranged",primaryComponentId:"sling_pouch",components:[slot("sling_pouch"),slot("sling_cord")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"textile_tools",semanticCheck:"slingmaking",iconFamily:"weapon_sling",handMode:"one_handed",handCost:1}),
    chassis({id:"blowgun",name:"Blowgun",classification:"martial_ranged",primaryComponentId:"blowgun_tube",components:[slot("blowgun_tube"),slot("blowgun_mouthpiece")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"woodcarver_tools",semanticCheck:"blowgunmaking",iconFamily:"weapon_blowgun",handMode:"one_handed",handCost:1}),
    chassis({id:"dart",name:"Dart",classification:"simple_ranged",primaryComponentId:"projectile_head",components:[slot("projectile_shaft"),slot("projectile_head")],baseThreshold:18,assemblyMultiplier:1,requiredToolType:"fabrication_tools",semanticCheck:"projectilemaking",iconFamily:"ammo_thrown_dart",handMode:"one_handed",handCost:1,ammoRecipeId:"dart"}),
    chassis({id:"net",name:"Net",classification:"martial_ranged",primaryComponentId:"net_mesh",components:[slot("net_mesh"),slot("net_weighted_cord")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"textile_tools",semanticCheck:"netmaking",iconFamily:"weapon_net",handMode:"one_handed",handCost:1,controlOnly:true}),
  ]);
  const BY_ID = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id, entry])));

  function ammoRecipe(def) {
    return Object.freeze({
      id:normalizeId(def.id), name:def.name, iconFamily:normalizeId(def.iconFamily), batchYield:Number(def.batchYield || 1), processMultiplier:Number(def.processMultiplier || 1),
      materialInputs:Object.freeze((def.materialInputs || []).slice()), componentIds:Object.freeze((def.componentIds || []).map(normalizeId)),
      damageType:normalizeId(def.damageType || ""), consumedOnUse:!!def.consumedOnUse, recoverable:!!def.recoverable, repairable:!!def.repairable,
      ammoGradeEligible:!!def.ammoGradeEligible, natural:!!def.natural, upgradeable: def.upgradeable !== false,
    });
  }

  const AMMO_RECIPES = Object.freeze([
    ammoRecipe({id:"arrow",name:"Arrow",iconFamily:"ammo_arrow",batchYield:10,processMultiplier:1.25,materialInputs:[materialInput("shaft",1,["solid","structural"],"structural_wood","projectile_shaft"),materialInput("head",1,["solid","structural"],"iron","projectile_head"),materialInput("fletching",1,["flexible","fiber"],"textile","fletching")],componentIds:["projectile_shaft","projectile_head","fletching"],damageType:"pierce",consumedOnUse:true,ammoGradeEligible:true}),
    ammoRecipe({id:"bolt",name:"Crossbow Bolt",iconFamily:"ammo_bolt",batchYield:8,processMultiplier:1.25,materialInputs:[materialInput("shaft",1,["solid","structural"],"structural_wood","projectile_shaft"),materialInput("head",1,["solid","structural"],"iron","projectile_head"),materialInput("fletching",1,["flexible","fiber"],"textile","fletching")],componentIds:["projectile_shaft","projectile_head","fletching"],damageType:"pierce",consumedOnUse:true,ammoGradeEligible:true}),
    ammoRecipe({id:"blowgun_dart",name:"Blowgun Dart",iconFamily:"ammo_blowgun_dart",batchYield:20,processMultiplier:1.20,materialInputs:[materialInput("shaft",1,["solid","structural"],"structural_wood","projectile_shaft"),materialInput("head",1,["solid","structural"],"iron","projectile_head"),materialInput("fletching",1,["flexible","fiber"],"textile","fletching")],componentIds:["projectile_shaft","projectile_head","fletching"],damageType:"pierce",consumedOnUse:true,ammoGradeEligible:true}),
    ammoRecipe({id:"dart",name:"Thrown Dart",iconFamily:"ammo_thrown_dart",batchYield:10,processMultiplier:1.20,materialInputs:[materialInput("shaft",1,["solid","structural"],"structural_wood","projectile_shaft"),materialInput("head",1,["solid","structural"],"iron","projectile_head")],componentIds:["projectile_shaft","projectile_head"],damageType:"pierce",recoverable:true,repairable:true,ammoGradeEligible:false}),
    ammoRecipe({id:"sling_stone",name:"Sling Stone",iconFamily:"ore_raw",batchYield:1,processMultiplier:1,materialInputs:[],componentIds:[],damageType:"blunt",consumedOnUse:true,natural:true,upgradeable:false}),
    ammoRecipe({id:"sling_bullet",name:"Sling Bullet / Balín",iconFamily:"weapon_component_sling_projectile",batchYield:10,processMultiplier:1.20,materialInputs:[materialInput("body",1,["solid","structural","metal"],"iron","sling_bullet")],componentIds:["sling_bullet"],damageType:"blunt",consumedOnUse:true,ammoGradeEligible:true}),
  ]);
  const AMMO_BY_ID = Object.freeze(Object.fromEntries(AMMO_RECIPES.map((entry) => [entry.id, entry])));

  function componentCatalog(source) { return normalizeId(source) === "melee" ? Melee : Ranged; }
  function resolveReferenceComponent(entry) {
    const catalog = componentCatalog(entry.source);
    const resolved = catalog.resolveReferenceComponent(entry.componentId);
    return resolved ? Object.freeze({...resolved,source:entry.source,quantity:entry.quantity}) : null;
  }
  function durabilityFromComponents(rows) { return (rows || []).reduce((sum,row) => sum + Number(row.durability || 0) * Math.max(1,Number(row.quantity || 1)),0); }
  function productionFromComponents(rows,multiplier) {
    const input = (rows || []).reduce((sum,row) => sum + Number(row.productionValueAhn || 0) * Math.max(1,Number(row.quantity || 1)),0);
    return roundAhn(input * Number(multiplier || 1));
  }

  function referenceBuild(chassisId) {
    const def = BY_ID[normalizeId(chassisId)];
    if (!def) return null;
    if (def.ammoRecipeId) {
      const ammo = resolveAmmo(def.ammoRecipeId);
      return Object.freeze({valid:true,chassisId:def.id,name:def.name,classification:def.classification,primaryComponentId:def.primaryComponentId,components:ammo.components,maxDurability:ammo.structuralDurability,productionValueAhn:ammo.unitProductionValueAhn,baseThreshold:def.baseThreshold,assemblyMultiplier:def.assemblyMultiplier,requiredToolType:def.requiredToolType,semanticCheck:def.semanticCheck,handMode:def.handMode,handCost:def.handCost,iconFamily:def.iconFamily,recoverable:ammo.recoverable,repairable:ammo.repairable});
    }
    const rows = def.components.map(resolveReferenceComponent);
    if (rows.some((row) => !row?.valid)) return Object.freeze({valid:false,chassisId:def.id,reason:"component_resolution_failed"});
    const primary = rows.find((row) => normalizeId(row.componentId) === def.primaryComponentId);
    return Object.freeze({valid:true,chassisId:def.id,name:def.name,classification:def.classification,primaryComponentId:def.primaryComponentId,primaryMaterialId:primary?.primaryMaterial?.materialId || null,components:Object.freeze(rows),maxDurability:durabilityFromComponents(rows),productionValueAhn:productionFromComponents(rows,def.assemblyMultiplier),baseThreshold:def.baseThreshold,assemblyMultiplier:def.assemblyMultiplier,requiredToolType:def.requiredToolType,semanticCheck:def.semanticCheck,handMode:def.handMode,handCost:def.handCost,iconFamily:def.iconFamily,controlOnly:def.controlOnly,recoverable:def.id === "net",repairable:true});
  }

  function normalizeMaterialChoice(choice, fallbackId) {
    if (typeof choice === "string") return {materialId:normalizeId(choice)};
    const src = choice || {};
    return {materialId:normalizeId(src.materialId || src.id || fallbackId),durability:src.durability,unitValueAhn:src.unitValueAhn ?? src.standardUnitValueAhn,tags:src.tags,name:src.name || null};
  }

  function resolveAmmo(ammoId, materialChoices = {}) {
    const def = AMMO_BY_ID[normalizeId(ammoId)];
    if (!def) return null;
    if (def.natural) {
      return Object.freeze({valid:true,ammoId:def.id,name:def.name,iconFamily:def.iconFamily,batchYield:1,batchProductionValueAhn:0,unitProductionValueAhn:0,structuralDurability:Melee.getMaterialDurability("industrial_stone") || 30,components:Object.freeze([]),damageType:def.damageType,consumedOnUse:def.consumedOnUse,recoverable:def.recoverable,repairable:def.repairable,ammoGradeEligible:false,natural:true,upgradeable:false});
    }

    let inputValue = 0;
    let structuralDurability = 0;
    const componentRows = [];
    for (const input of def.materialInputs) {
      const selected = normalizeMaterialChoice(materialChoices[input.slot] ?? materialChoices[input.referenceMaterialId], input.referenceMaterialId);
      const validation = Melee.validateMaterial(input.requirements, selected);
      if (!validation.valid) return Object.freeze({valid:false,ammoId:def.id,reason:"incompatible_material",slot:input.slot,missing:validation.missing});
      const unitDurability = Melee.getMaterialDurability(selected.materialId, selected.durability);
      const unitValueAhn = Ranged.getMaterialValue(selected.materialId, selected.unitValueAhn);
      if (!Number.isFinite(unitDurability) || !Number.isFinite(unitValueAhn)) return Object.freeze({valid:false,ammoId:def.id,reason:"missing_material_data",slot:input.slot,materialId:selected.materialId});
      inputValue += input.quantity * unitValueAhn;
      structuralDurability += input.quantity * unitDurability;
      const materialRow = Object.freeze({slot:input.slot,materialId:selected.materialId,quantity:input.quantity,unitDurability,unitValueAhn,primaryMaterial:true});
      componentRows.push(Object.freeze({valid:true,componentId:input.componentId,quantity:1,composition:Object.freeze([materialRow]),primaryMaterial:materialRow,durability:input.quantity * unitDurability,productionValueAhn:0,quality:DEFAULT_QUALITY}));
    }
    const batchProductionValueAhn = Math.round(inputValue * def.processMultiplier);
    const unitProductionValueAhn = Math.round(batchProductionValueAhn / def.batchYield);
    return Object.freeze({valid:true,ammoId:def.id,name:def.name,iconFamily:def.iconFamily,batchYield:def.batchYield,batchProductionValueAhn,unitProductionValueAhn,structuralDurability,components:Object.freeze(componentRows),damageType:def.damageType,consumedOnUse:def.consumedOnUse,recoverable:def.recoverable,repairable:def.repairable,ammoGradeEligible:def.ammoGradeEligible,natural:def.natural,upgradeable:def.upgradeable});
  }

  function getChassis(id) { const def = BY_ID[normalizeId(id)]; return def ? clone(def) : null; }
  function listChassis(options = {}) { const c = normalizeId(options.classification); return CHASSIS.filter((x) => !c || x.classification === c).map(clone); }
  function getAmmo(id) { const def = AMMO_BY_ID[normalizeId(id)]; return def ? clone(def) : null; }
  function listAmmo() { return AMMO_RECIPES.map(clone); }

  const REFERENCE_BUILDS = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id, referenceBuild(entry.id)])));
  const REFERENCE_AMMO = Object.freeze(Object.fromEntries(AMMO_RECIPES.map((entry) => [entry.id, resolveAmmo(entry.id)])));

  const API = Object.freeze({
    VERSION,DEFAULT_QUALITY,CHASSIS,REFERENCE_BUILDS,AMMO_RECIPES,REFERENCE_AMMO,normalizeId,getChassis,listChassis,getAmmo,listAmmo,
    resolveAmmo,referenceBuild,durabilityFromComponents,productionFromComponents,
    resolveDurabilityBreak:MeleeComposition.resolveDurabilityBreak,repairState:MeleeComposition.repairState,canUpgrade:MeleeComposition.canUpgrade,
  });

  global.LuminousRangedWeaponCompositionEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);