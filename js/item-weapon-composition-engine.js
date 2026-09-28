(function (global) {
  "use strict";

  if (global.LuminousWeaponCompositionEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponCompositionEngine;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Components = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  if (!Components) throw new Error("LuminousWeaponComponentCatalog is required before LuminousWeaponCompositionEngine.");

  const VERSION = 1;
  const DEFAULT_QUALITY = "standard";
  const QUALITY_ORDER = Object.freeze(["ruined", "poor", "standard", "fine", "exceptional"]);
  const QUALITY_SCORE = Object.freeze({ ruined:0, poor:1, standard:2, fine:3, exceptional:4 });
  const IMPROVISED_DAMAGE_MULTIPLIER = 0.60;
  const BASE_SKILL_DURABILITY_LOSS = 1;
  const UPGRADE_MIN_DURABILITY_RATIO_EXCLUSIVE = 0.50;

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) { return Components.normalizeId(value); }
  function clampQualityIndex(index) { return Math.max(0, Math.min(QUALITY_ORDER.length - 1, index)); }
  function qualityFromScore(score) {
    const n = Number(score);
    return QUALITY_ORDER[clampQualityIndex(Math.round(Number.isFinite(n) ? n : QUALITY_SCORE.standard))];
  }

  function slot(componentId, quantity = 1) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Weapon recipe component quantities must be positive integers.");
    return Object.freeze({ componentId: normalizeId(componentId), quantity });
  }

  function chassis(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      classification: normalizeId(def.classification),
      primaryComponentId: normalizeId(def.primaryComponentId),
      components: Object.freeze(def.components.slice()),
      baseThreshold: Number(def.baseThreshold),
      assemblyMultiplier: Number(def.assemblyMultiplier),
      requiredToolType: normalizeId(def.requiredToolType),
      semanticCheck: normalizeId(def.semanticCheck),
      damageType: normalizeId(def.damageType),
      iconFamily: normalizeId(def.iconFamily),
      nonRepairable: !!def.nonRepairable,
    });
  }

  // Melee canonical recipes. Ranged/firearm composition is a later pass.
  const CHASSIS = Object.freeze([
    chassis({id:"club",name:"Club",classification:"simple_melee",primaryComponentId:"club_body_medium",components:[slot("club_body_medium"),slot("grip")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"fabrication_tools",semanticCheck:"woodcarving",damageType:"blunt",iconFamily:"weapon_blunt"}),
    chassis({id:"dagger",name:"Dagger",classification:"simple_melee",primaryComponentId:"short_blade",components:[slot("short_blade"),slot("handle")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_dagger"}),
    chassis({id:"greatclub",name:"Greatclub",classification:"simple_melee",primaryComponentId:"club_body_large",components:[slot("club_body_large"),slot("grip")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"fabrication_tools",semanticCheck:"woodcarving",damageType:"blunt",iconFamily:"weapon_blunt"}),
    chassis({id:"handaxe",name:"Handaxe",classification:"simple_melee",primaryComponentId:"axe_head_small",components:[slot("axe_head_small"),slot("handle")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_axe"}),
    chassis({id:"javelin",name:"Javelin",classification:"simple_melee",primaryComponentId:"spear_head",components:[slot("spear_head"),slot("shaft")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_spear"}),
    chassis({id:"light_hammer",name:"Light Hammer",classification:"simple_melee",primaryComponentId:"hammer_head_small",components:[slot("hammer_head_small"),slot("handle")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"blunt",iconFamily:"weapon_hammer"}),
    chassis({id:"mace",name:"Mace",classification:"simple_melee",primaryComponentId:"mace_head",components:[slot("mace_head"),slot("handle")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"blunt",iconFamily:"weapon_blunt"}),
    chassis({id:"quarterstaff",name:"Quarterstaff",classification:"simple_melee",primaryComponentId:"long_shaft",components:[slot("long_shaft"),slot("grip")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"fabrication_tools",semanticCheck:"woodcarving",damageType:"blunt",iconFamily:"weapon_staff"}),
    chassis({id:"sickle",name:"Sickle",classification:"simple_melee",primaryComponentId:"short_blade",components:[slot("short_blade"),slot("handle")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_dagger"}),
    chassis({id:"spear",name:"Spear",classification:"simple_melee",primaryComponentId:"spear_head",components:[slot("spear_head"),slot("shaft")],baseThreshold:18,assemblyMultiplier:1.20,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_spear"}),

    chassis({id:"battleaxe",name:"Battleaxe",classification:"martial_melee",primaryComponentId:"axe_head_medium",components:[slot("axe_head_medium"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_axe"}),
    chassis({id:"flail",name:"Flail",classification:"martial_melee",primaryComponentId:"flail_head",components:[slot("flail_head"),slot("chain_link"),slot("handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"blunt",iconFamily:"weapon_blunt"}),
    chassis({id:"glaive",name:"Glaive",classification:"martial_melee",primaryComponentId:"polearm_head",components:[slot("polearm_head"),slot("long_shaft"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_polearm"}),
    chassis({id:"greataxe",name:"Greataxe",classification:"martial_melee",primaryComponentId:"axe_head_large",components:[slot("axe_head_large"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_axe"}),
    chassis({id:"greatsword",name:"Greatsword",classification:"martial_melee",primaryComponentId:"great_blade",components:[slot("great_blade"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_sword"}),
    chassis({id:"halberd",name:"Halberd",classification:"martial_melee",primaryComponentId:"polearm_head",components:[slot("polearm_head"),slot("long_shaft"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_polearm"}),
    chassis({id:"lance",name:"Lance",classification:"martial_melee",primaryComponentId:"spear_head",components:[slot("spear_head"),slot("long_shaft"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_spear"}),
    chassis({id:"longsword",name:"Longsword",classification:"martial_melee",primaryComponentId:"long_blade",components:[slot("long_blade"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_sword"}),
    chassis({id:"maul",name:"Maul",classification:"martial_melee",primaryComponentId:"hammer_head_large",components:[slot("hammer_head_large"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"blunt",iconFamily:"weapon_hammer"}),
    chassis({id:"morningstar",name:"Morningstar",classification:"martial_melee",primaryComponentId:"mace_head",components:[slot("mace_head"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_blunt"}),
    chassis({id:"pike",name:"Pike",classification:"martial_melee",primaryComponentId:"spear_head",components:[slot("spear_head"),slot("long_shaft"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_spear"}),
    chassis({id:"rapier",name:"Rapier",classification:"martial_melee",primaryComponentId:"long_blade",components:[slot("long_blade"),slot("handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_sword"}),
    chassis({id:"scimitar",name:"Scimitar",classification:"martial_melee",primaryComponentId:"long_blade",components:[slot("long_blade"),slot("handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"slash",iconFamily:"weapon_sword"}),
    chassis({id:"shortsword",name:"Shortsword",classification:"martial_melee",primaryComponentId:"long_blade",components:[slot("long_blade"),slot("handle")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_sword"}),
    chassis({id:"trident",name:"Trident",classification:"martial_melee",primaryComponentId:"polearm_head",components:[slot("polearm_head"),slot("shaft"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_spear"}),
    chassis({id:"war_pick",name:"War Pick",classification:"martial_melee",primaryComponentId:"pick_head",components:[slot("pick_head"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"pierce",iconFamily:"weapon_pick"}),
    chassis({id:"warhammer",name:"Warhammer",classification:"martial_melee",primaryComponentId:"hammer_head_medium",components:[slot("hammer_head_medium"),slot("reinforced_handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"smithing_tools",semanticCheck:"smithing",damageType:"blunt",iconFamily:"weapon_hammer"}),
    chassis({id:"whip",name:"Whip",classification:"martial_melee",primaryComponentId:"lash",components:[slot("lash"),slot("handle"),slot("grip")],baseThreshold:22,assemblyMultiplier:1.30,requiredToolType:"textile_tools",semanticCheck:"leatherworking",damageType:"slash",iconFamily:"weapon_whip"}),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id, entry])));

  function getChassis(id) {
    const entry = BY_ID[normalizeId(id)];
    return entry ? clone(entry) : null;
  }

  function listChassis(options = {}) {
    const classification = normalizeId(options.classification);
    return CHASSIS.filter((entry) => !classification || entry.classification === classification).map(clone);
  }

  function craftAdjustment(craftResult, threshold) {
    const margin = Number(craftResult) - Number(threshold);
    if (!Number.isFinite(margin)) return 0;
    if (margin >= 5) return 1;
    if (margin >= 0) return 0;
    if (margin >= -4) return -1;
    return -2;
  }

  function compositionQuality(componentInstances) {
    const rows = Array.isArray(componentInstances) ? componentInstances : [];
    let weighted = 0;
    let count = 0;
    for (const row of rows) {
      const quantity = Number(row.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) continue;
      const quality = normalizeId(row.quality || DEFAULT_QUALITY);
      const score = QUALITY_SCORE[quality];
      if (score == null) continue;
      weighted += score * quantity;
      count += quantity;
    }
    const score = count ? weighted / count : QUALITY_SCORE.standard;
    return Object.freeze({ score, quality: qualityFromScore(score), count });
  }

  function craftedQuality(componentInstances, craftResult, threshold) {
    const base = compositionQuality(componentInstances);
    const adjustment = craftAdjustment(craftResult, threshold);
    const finalIndex = Math.max(0, Math.min(4, QUALITY_SCORE[base.quality] + adjustment));
    return Object.freeze({ compositionQuality: base.quality, compositionScore: base.score, adjustment, quality: QUALITY_ORDER[finalIndex] });
  }

  function resolveHandMode(componentInstances) {
    const rows = Array.isArray(componentInstances) ? componentInstances : [];
    let minHands = 1;
    let allowed = new Set([1,2]);
    for (const row of rows) {
      const def = Components.get(row.componentId || row.id);
      if (!def) continue;
      minHands = Math.max(minHands, Number(def.minHands || 1));
      if (Array.isArray(def.allowedHands) && def.allowedHands.length) {
        allowed = new Set([...allowed].filter((value) => def.allowedHands.includes(value)));
      }
    }
    allowed = new Set([...allowed].filter((value) => value >= minHands));
    const values = [...allowed].sort();
    if (!values.length) return Object.freeze({ valid:false, reason:"hand_requirement_conflict", minHands, allowedHands:Object.freeze([]) });
    const handMode = values.length > 1 ? "versatile" : values[0] === 2 ? "two_handed" : "one_handed";
    return Object.freeze({ valid:true, handMode, handCost: handMode === "two_handed" ? 2 : 1, minHands, allowedHands:Object.freeze(values) });
  }

  function validateAssembly(componentInstances) {
    const rows = Array.isArray(componentInstances) ? componentInstances : [];
    const defs = rows.map((row) => Components.get(row.componentId || row.id)).filter(Boolean);
    if (defs.length !== rows.length || !defs.length) return Object.freeze({ valid:false, reason:"unknown_or_empty_component_set" });

    const primaries = defs.filter((entry) => entry.primaryEligible);
    if (primaries.length !== 1) return Object.freeze({ valid:false, reason:"requires_exactly_one_primary_component", primaryCount:primaries.length });

    const primary = primaries[0];
    if (primary.role === "body") {
      const invalid = defs.some((entry) => ![primary.id, "grip"].includes(entry.id));
      if (invalid) return Object.freeze({ valid:false, reason:"body_weapon_rejects_extra_structural_parts" });
    } else {
      const supports = defs.filter((entry) => entry.role === "support");
      if (supports.length !== 1) return Object.freeze({ valid:false, reason:"requires_exactly_one_support", supportCount:supports.length });
      if (!primary.compatibleSupports.includes(supports[0].id)) return Object.freeze({ valid:false, reason:"primary_support_incompatible", primary:primary.id, support:supports[0].id });
      const chainCount = defs.filter((entry) => entry.id === "chain_link").length;
      if (primary.requiresChain && chainCount !== 1) return Object.freeze({ valid:false, reason:"chain_required" });
      if (!primary.requiresChain && chainCount) return Object.freeze({ valid:false, reason:"chain_not_supported" });
      const gripCount = defs.filter((entry) => entry.id === "grip").length;
      if (gripCount > 1) return Object.freeze({ valid:false, reason:"too_many_grips" });
      if (gripCount && !supports[0].allowsGrip) return Object.freeze({ valid:false, reason:"support_does_not_accept_grip" });
    }

    const hands = resolveHandMode(rows);
    if (!hands.valid) return hands;
    return Object.freeze({ valid:true, primaryComponentId:primary.id, handMode:hands.handMode, handCost:hands.handCost, allowedHands:hands.allowedHands });
  }

  function durabilityFromComponents(componentInstances) {
    return (Array.isArray(componentInstances) ? componentInstances : []).reduce((sum, row) => sum + Math.max(0, Number(row.durability || 0)) * Math.max(1, Number(row.quantity || 1)), 0);
  }

  function productionValueFromComponents(componentInstances, assemblyMultiplier = 1) {
    const input = (Array.isArray(componentInstances) ? componentInstances : []).reduce((sum, row) => sum + Math.max(0, Number(row.productionValueAhn || 0)) * Math.max(1, Number(row.quantity || 1)), 0);
    return Components.roundAhn(input * Number(assemblyMultiplier || 1));
  }

  function referenceComponentInstance(componentId) {
    const resolved = Components.resolveReferenceComponent(componentId);
    if (!resolved?.valid) return null;
    return Object.freeze({ ...resolved, quantity:1, quality:DEFAULT_QUALITY });
  }

  function referenceBuild(chassisId) {
    const def = BY_ID[normalizeId(chassisId)];
    if (!def) return null;
    const instances = def.components.map((entry) => {
      const resolved = referenceComponentInstance(entry.componentId);
      return Object.freeze({ ...resolved, quantity:entry.quantity });
    });
    const validation = validateAssembly(instances);
    if (!validation.valid) return Object.freeze({ valid:false, chassisId:def.id, reason:validation.reason });
    const primary = instances.find((entry) => entry.componentId === def.primaryComponentId);
    return Object.freeze({
      valid:true,
      chassisId:def.id,
      name:def.name,
      classification:def.classification,
      primaryComponentId:def.primaryComponentId,
      primaryMaterialId:primary?.primaryMaterial?.materialId || null,
      components:Object.freeze(instances),
      maxDurability:durabilityFromComponents(instances),
      productionValueAhn:productionValueFromComponents(instances, def.assemblyMultiplier),
      baseThreshold:def.baseThreshold,
      assemblyMultiplier:def.assemblyMultiplier,
      requiredToolType:def.requiredToolType,
      semanticCheck:def.semanticCheck,
      handMode:validation.handMode,
      handCost:validation.handCost,
      damageType:def.damageType,
      iconFamily:def.iconFamily,
    });
  }

  function resolveCanonicalBuild(chassisId, componentInstances, craftResult) {
    const def = BY_ID[normalizeId(chassisId)];
    if (!def) return null;
    const instances = Array.isArray(componentInstances) && componentInstances.length ? componentInstances.map(clone) : referenceBuild(def.id)?.components;
    const validation = validateAssembly(instances);
    if (!validation.valid) return Object.freeze({ valid:false, chassisId:def.id, reason:validation.reason });
    const actualIds = instances.flatMap((entry) => Array.from({length:Math.max(1, Number(entry.quantity || 1))}, () => normalizeId(entry.componentId))).sort();
    const expectedIds = def.components.flatMap((entry) => Array.from({length:entry.quantity}, () => entry.componentId)).sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
      return Object.freeze({ valid:false, chassisId:def.id, reason:"component_recipe_mismatch", expected:Object.freeze(expectedIds), actual:Object.freeze(actualIds) });
    }
    const primary = instances.find((entry) => normalizeId(entry.componentId) === def.primaryComponentId);
    const quality = craftedQuality(instances, craftResult ?? def.baseThreshold, def.baseThreshold);
    const maxDurability = durabilityFromComponents(instances);
    return Object.freeze({
      valid:true, chassisId:def.id, name:def.name, classification:def.classification,
      components:Object.freeze(instances.map(clone)), primaryComponentId:def.primaryComponentId,
      primaryMaterialId:primary?.primaryMaterial?.materialId || null,
      compositionQuality:quality.compositionQuality, craftedQuality:quality.quality, currentQuality:quality.quality,
      maxDurability, currentDurability:maxDurability,
      productionValueAhn:productionValueFromComponents(instances, def.assemblyMultiplier),
      baseThreshold:def.baseThreshold, craftAdjustment:quality.adjustment,
      handMode:validation.handMode, handCost:validation.handCost,
      upgradeEligible:maxDurability > 0,
      damageType:def.damageType, iconFamily:def.iconFamily,
    });
  }

  function resolveCustomAssembly(componentInstances, craft = {}) {
    const instances = (Array.isArray(componentInstances) ? componentInstances : []).map(clone);
    const validation = validateAssembly(instances);
    if (!validation.valid) return validation;
    const primary = instances.find((entry) => normalizeId(entry.componentId) === validation.primaryComponentId);
    const threshold = Number(craft.threshold ?? 22);
    const quality = craftedQuality(instances, craft.result ?? threshold, threshold);
    const maxDurability = durabilityFromComponents(instances);
    const support = instances.map((entry) => Components.get(entry.componentId)).find((entry) => entry?.role === "support");
    const primaryDef = Components.get(validation.primaryComponentId);
    const family = support?.id === "long_shaft" ? "polearm" : (primaryDef?.weaponFamily || "custom");
    return Object.freeze({
      valid:true,
      chassisId:"custom",
      weaponFamily:family,
      primaryComponentId:validation.primaryComponentId,
      primaryMaterialId:primary?.primaryMaterial?.materialId || null,
      components:Object.freeze(instances),
      compositionQuality:quality.compositionQuality,
      craftedQuality:quality.quality,
      currentQuality:quality.quality,
      maxDurability,
      currentDurability:maxDurability,
      productionValueAhn:productionValueFromComponents(instances, Number(craft.assemblyMultiplier || 1.30)),
      handMode:validation.handMode,
      handCost:validation.handCost,
      craftAdjustment:quality.adjustment,
      upgradeEligible:maxDurability > 0,
    });
  }

  function degradeQuality(quality) {
    const id = normalizeId(quality || DEFAULT_QUALITY);
    const index = QUALITY_ORDER.indexOf(id);
    if (index <= 0) return Object.freeze({ from:"ruined", to:null, destroyed:true });
    return Object.freeze({ from:id, to:QUALITY_ORDER[index - 1], destroyed:false });
  }

  function resolveDurabilityBreak(state = {}) {
    const maxDurability = Math.max(0, Number(state.maxDurability || 0));
    const currentDurability = Number(state.currentDurability ?? 0);
    const quality = QUALITY_SCORE[normalizeId(state.currentQuality)] == null ? DEFAULT_QUALITY : normalizeId(state.currentQuality);
    if (currentDurability > 0) return Object.freeze({ ...state, currentQuality:quality, maxDurability, destroyed:false, degraded:false });
    if (state.nonRepairable) return Object.freeze({ ...state, currentQuality:quality, currentDurability:0, maxDurability, destroyed:true, degraded:false });
    const next = degradeQuality(quality);
    if (next.destroyed) return Object.freeze({ ...state, currentQuality:"ruined", currentDurability:0, maxDurability, destroyed:true, degraded:false });
    return Object.freeze({ ...state, currentQuality:next.to, currentDurability:maxDurability, maxDurability, destroyed:false, degraded:true });
  }

  function repairState(state = {}) {
    const maxDurability = Math.max(0, Number(state.maxDurability || 0));
    return Object.freeze({ ...state, currentDurability:maxDurability, maxDurability, destroyed:false });
  }

  function durabilityLossForSkill(elementalWear = 0) {
    return BASE_SKILL_DURABILITY_LOSS + Math.max(0, Math.round(Number(elementalWear || 0)));
  }

  function canUpgrade(state = {}) {
    const max = Math.max(0, Number(state.maxDurability || 0));
    const current = Math.max(0, Number(state.currentDurability || 0));
    return max > 0 && current > max * UPGRADE_MIN_DURABILITY_RATIO_EXCLUSIVE;
  }

  function improvisedDamage(normalDamage) {
    return Math.round(Math.max(0, Number(normalDamage || 0)) * IMPROVISED_DAMAGE_MULTIPLIER);
  }

  const REFERENCE_BUILDS = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id, referenceBuild(entry.id)])));

  const API = Object.freeze({
    VERSION, DEFAULT_QUALITY, QUALITY_ORDER, QUALITY_SCORE,
    IMPROVISED_DAMAGE_MULTIPLIER, BASE_SKILL_DURABILITY_LOSS, UPGRADE_MIN_DURABILITY_RATIO_EXCLUSIVE,
    CHASSIS, REFERENCE_BUILDS, normalizeId, getChassis, listChassis,
    craftAdjustment, compositionQuality, craftedQuality, resolveHandMode, validateAssembly,
    durabilityFromComponents, productionValueFromComponents, referenceBuild, resolveCanonicalBuild, resolveCustomAssembly,
    degradeQuality, resolveDurabilityBreak, repairState, durabilityLossForSkill, canUpgrade, improvisedDamage,
  });

  global.LuminousWeaponCompositionEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
