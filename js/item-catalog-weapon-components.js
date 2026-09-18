(function (global) {
  "use strict";

  if (global.LuminousWeaponComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponComponentCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "weapon_components";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const VALUE_ROUNDING_AHN = 1000;

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function roundAhn(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n / VALUE_ROUNDING_AHN) * VALUE_ROUNDING_AHN);
  }

  const QUALITY_ORDER = Object.freeze(["ruined", "poor", "standard", "fine", "exceptional"]);
  const QUALITY_SCORE = Object.freeze({ ruined: 0, poor: 1, standard: 2, fine: 3, exceptional: 4 });

  // Durability is structural and comes from incorporated material. Quality does not multiply it.
  const MATERIAL_DURABILITY = Object.freeze({
    raw_fiber: 8,
    processed_textile: 8,
    textile: 8,
    leather: 10,
    processed_leather: 10,
    structural_wood: 15,
    wood: 15,
    bone: 18,
    horn: 18,
    chitin: 20,
    shell: 25,
    industrial_stone: 30,
    obsidian: 18,
    quartz: 18,
    glass: 14,
    ceramic: 22,
    lithium: 8,
    lead: 15,
    zinc: 16,
    tin: 16,
    gold: 15,
    silver: 18,
    aluminum: 20,
    copper: 20,
    manganese: 24,
    iron: 25,
    nickel: 28,
    chromium: 30,
    cobalt: 30,
    vanadium: 32,
    niobium: 32,
    molybdenum: 33,
    tantalum: 35,
    tungsten: 45,
    titanium: 45,
    rare_earth_refined_material: 20,
    refined_uranium_material: 24,
    superconductive_material: 30,
    refined_metamaterial: 55,
    null_dampening_material: 50,
    exotic_refined_material: 65,
    brass: 20,
    bronze: 22,
    carbon_steel: 30,
    high_carbon_steel: 35,
    stainless_steel: 35,
    nickel_steel: 38,
    chrome_steel: 40,
    hardened_steel: 42,
    hardened_weapon_steel: 40,
    armor_steel: 43,
    cobalt_alloy: 45,
    tungsten_alloy: 50,
    titanium_alloy: 53,
    advanced_titanium_alloy: 60,
    superalloy: 68,
    augment_grade_alloy: 75,
    corp_composite_alloy: 88,
    exotic_alloy: 100,
  });

  const MATERIAL_VALUE_REFERENCE_AHN = Object.freeze({
    structural_wood: 8000,
    wood: 8000,
    leather: 7000,
    processed_leather: 7000,
    textile: 6000,
    processed_textile: 6000,
    iron: 22000,
    hardened_steel: 90000,
  });

  const MATERIAL_TAGS = Object.freeze({
    raw_fiber: Object.freeze(["flexible", "fiber"]),
    processed_textile: Object.freeze(["flexible", "fiber"]),
    textile: Object.freeze(["flexible", "fiber"]),
    leather: Object.freeze(["flexible", "structural"]),
    processed_leather: Object.freeze(["flexible", "structural"]),
    structural_wood: Object.freeze(["solid", "structural"]),
    wood: Object.freeze(["solid", "structural"]),
    bone: Object.freeze(["solid", "structural"]),
    horn: Object.freeze(["solid", "structural"]),
    chitin: Object.freeze(["solid", "structural"]),
    shell: Object.freeze(["solid", "structural"]),
    industrial_stone: Object.freeze(["solid", "structural"]),
    obsidian: Object.freeze(["solid", "structural"]),
    quartz: Object.freeze(["solid", "structural"]),
    glass: Object.freeze(["solid"]),
    ceramic: Object.freeze(["solid", "structural"]),
  });

  const METAL_IDS = Object.freeze(Object.keys(MATERIAL_DURABILITY).filter((id) =>
    !["raw_fiber","processed_textile","textile","leather","processed_leather","structural_wood","wood","bone","horn","chitin","shell","industrial_stone","obsidian","quartz","glass","ceramic"].includes(id)
  ));

  function tagsForMaterial(materialId, explicitTags) {
    if (Array.isArray(explicitTags) && explicitTags.length) return explicitTags.map(normalizeId);
    const id = normalizeId(materialId);
    if (Object.prototype.hasOwnProperty.call(MATERIAL_TAGS, id)) return MATERIAL_TAGS[id].slice();
    if (METAL_IDS.includes(id)) return ["solid", "structural", "linkable", "metal"];
    return [];
  }

  const ICONS = Object.freeze({
    weapon_component_blade_short: "https://imgur.com/VqcSTYZ.png",
    weapon_component_blade_long: "https://imgur.com/Dy9oMIw.png",
    weapon_component_blade_great: "https://imgur.com/YZcd7xb.png",
    weapon_component_head_axe: "https://imgur.com/n1ywyev.png",
    weapon_component_head_hammer: "https://imgur.com/gaGJyHT.png",
    weapon_component_head_mace: "https://imgur.com/tUEsPpJ.png",
    weapon_component_head_spear: "https://imgur.com/6ievQXp.png",
    weapon_component_head_polearm: "https://imgur.com/GPg1tgF.png",
    weapon_component_head_pick: "https://imgur.com/nUJ7c4s.png",
    weapon_component_head_flail: "https://imgur.com/zsb8ZB6.png",
    weapon_component_chain: "https://imgur.com/gmYk0N8.png",
    weapon_component_handle: "https://imgur.com/uP3M6zY.png",
    weapon_component_handle_reinforced: "https://imgur.com/qfDfQAU.png",
    weapon_component_shaft: "https://imgur.com/FXZYH92.png",
    weapon_component_shaft_long: "https://imgur.com/NZMcC9c.png",
    weapon_component_body_club: "https://imgur.com/ICgzPQ2.png",
    weapon_component_grip: "https://imgur.com/5vSVRcm.png",
    weapon_component_lash: "https://imgur.com/fpYkdIH.png",
  });

  function materialInput(slot, quantity, requirements, referenceMaterialId, primaryMaterial = false) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Weapon component material quantities must be positive integers.");
    return Object.freeze({
      slot: normalizeId(slot),
      quantity,
      requirements: Object.freeze((requirements || []).map(normalizeId)),
      referenceMaterialId: normalizeId(referenceMaterialId),
      primaryMaterial: !!primaryMaterial,
    });
  }

  function component(def) {
    const id = normalizeId(def.id);
    const iconFamily = normalizeId(def.iconFamily);
    return Object.freeze({
      id,
      name: def.name,
      family: FAMILY,
      category: "component",
      itemType: "weapon_component",
      stackable: true,
      currency: CURRENCY,
      iconFamily,
      icon: ICONS[iconFamily] || null,
      role: normalizeId(def.role),
      sizeClass: normalizeId(def.sizeClass || "medium"),
      primaryEligible: !!def.primaryEligible,
      weaponFamily: normalizeId(def.weaponFamily || ""),
      materialInputs: Object.freeze(def.materialInputs.slice()),
      processMultiplier: Number(def.processMultiplier || 1),
      minHands: Number(def.minHands || 1),
      allowedHands: def.allowedHands ? Object.freeze(def.allowedHands.slice()) : null,
      compatibleSupports: Object.freeze((def.compatibleSupports || []).map(normalizeId)),
      requiresChain: !!def.requiresChain,
      allowsGrip: !!def.allowsGrip,
      notes: def.notes || "",
      tags: Object.freeze(["weapon_component", normalizeId(def.role), normalizeId(def.sizeClass || "medium")].filter(Boolean)),
    });
  }

  const SUPPORT_HANDLE = Object.freeze(["handle", "reinforced_handle", "shaft", "long_shaft"]);
  const SUPPORT_HEAD = Object.freeze(["handle", "reinforced_handle", "shaft", "long_shaft"]);
  const SUPPORT_SPEAR = Object.freeze(["shaft", "long_shaft"]);
  const SUPPORT_LASH = Object.freeze(["handle", "reinforced_handle"]);

  const COMPONENTS = Object.freeze([
    component({ id:"short_blade", name:"Short Blade", iconFamily:"weapon_component_blade_short", role:"primary", sizeClass:"small", primaryEligible:true, weaponFamily:"blade", materialInputs:[materialInput("body",1,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HANDLE }),
    component({ id:"long_blade", name:"Long Blade", iconFamily:"weapon_component_blade_long", role:"primary", sizeClass:"medium", primaryEligible:true, weaponFamily:"blade", materialInputs:[materialInput("body",2,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HANDLE }),
    component({ id:"great_blade", name:"Great Blade", iconFamily:"weapon_component_blade_great", role:"primary", sizeClass:"large", primaryEligible:true, weaponFamily:"blade", materialInputs:[materialInput("body",3,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:2, compatibleSupports:["reinforced_handle","shaft","long_shaft"] }),

    component({ id:"axe_head_small", name:"Axe Head — Small", iconFamily:"weapon_component_head_axe", role:"primary", sizeClass:"small", primaryEligible:true, weaponFamily:"axe", materialInputs:[materialInput("head",1,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HEAD }),
    component({ id:"axe_head_medium", name:"Axe Head — Medium", iconFamily:"weapon_component_head_axe", role:"primary", sizeClass:"medium", primaryEligible:true, weaponFamily:"axe", materialInputs:[materialInput("head",2,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HEAD }),
    component({ id:"axe_head_large", name:"Axe Head — Large", iconFamily:"weapon_component_head_axe", role:"primary", sizeClass:"large", primaryEligible:true, weaponFamily:"axe", materialInputs:[materialInput("head",3,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:2, compatibleSupports:["reinforced_handle","shaft","long_shaft"] }),

    component({ id:"hammer_head_small", name:"Hammer Head — Small", iconFamily:"weapon_component_head_hammer", role:"primary", sizeClass:"small", primaryEligible:true, weaponFamily:"hammer", materialInputs:[materialInput("head",1,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HEAD }),
    component({ id:"hammer_head_medium", name:"Hammer Head — Medium", iconFamily:"weapon_component_head_hammer", role:"primary", sizeClass:"medium", primaryEligible:true, weaponFamily:"hammer", materialInputs:[materialInput("head",2,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HEAD }),
    component({ id:"hammer_head_large", name:"Hammer Head — Large", iconFamily:"weapon_component_head_hammer", role:"primary", sizeClass:"large", primaryEligible:true, weaponFamily:"hammer", materialInputs:[materialInput("head",3,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:2, compatibleSupports:["reinforced_handle","shaft","long_shaft"] }),

    component({ id:"mace_head", name:"Mace Head", iconFamily:"weapon_component_head_mace", role:"primary", sizeClass:"medium", primaryEligible:true, weaponFamily:"mace", materialInputs:[materialInput("head",2,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HEAD }),
    component({ id:"spear_head", name:"Spear Head", iconFamily:"weapon_component_head_spear", role:"primary", sizeClass:"small", primaryEligible:true, weaponFamily:"spear", materialInputs:[materialInput("head",1,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_SPEAR }),
    component({ id:"polearm_head", name:"Polearm Head", iconFamily:"weapon_component_head_polearm", role:"primary", sizeClass:"medium", primaryEligible:true, weaponFamily:"polearm", materialInputs:[materialInput("head",2,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:2, compatibleSupports:["shaft","long_shaft"] }),
    component({ id:"pick_head", name:"Pick Head", iconFamily:"weapon_component_head_pick", role:"primary", sizeClass:"small", primaryEligible:true, weaponFamily:"pick", materialInputs:[materialInput("head",1,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:SUPPORT_HEAD }),
    component({ id:"flail_head", name:"Flail Head", iconFamily:"weapon_component_head_flail", role:"primary", sizeClass:"small", primaryEligible:true, weaponFamily:"flail", materialInputs:[materialInput("head",1,["solid","structural"],"iron",true)], processMultiplier:1.30, minHands:1, compatibleSupports:["handle","reinforced_handle"], requiresChain:true }),

    component({ id:"chain_link", name:"Chain Link Assembly", iconFamily:"weapon_component_chain", role:"connector", sizeClass:"medium", primaryEligible:false, materialInputs:[materialInput("links",1,["solid","linkable"],"iron",false)], processMultiplier:1.35, minHands:1 }),
    component({ id:"handle", name:"Handle", iconFamily:"weapon_component_handle", role:"support", sizeClass:"small", primaryEligible:false, materialInputs:[materialInput("body",1,["solid","structural"],"structural_wood",false)], processMultiplier:1.20, minHands:1, allowedHands:[1], allowsGrip:true }),
    component({ id:"reinforced_handle", name:"Reinforced Handle", iconFamily:"weapon_component_handle_reinforced", role:"support", sizeClass:"medium", primaryEligible:false, materialInputs:[materialInput("body",1,["solid","structural"],"structural_wood",false),materialInput("reinforcement",1,["flexible"],"leather",false)], processMultiplier:1.25, minHands:1, allowedHands:[1,2], allowsGrip:true }),
    component({ id:"shaft", name:"Shaft", iconFamily:"weapon_component_shaft", role:"support", sizeClass:"medium", primaryEligible:false, materialInputs:[materialInput("body",2,["solid","structural"],"structural_wood",false)], processMultiplier:1.20, minHands:1, allowedHands:[1,2], allowsGrip:true }),
    component({ id:"long_shaft", name:"Long Shaft", iconFamily:"weapon_component_shaft_long", role:"support", sizeClass:"large", primaryEligible:false, materialInputs:[materialInput("body",3,["solid","structural"],"structural_wood",false)], processMultiplier:1.20, minHands:2, allowedHands:[2], allowsGrip:true }),

    component({ id:"club_body_medium", name:"Club Body — Medium", iconFamily:"weapon_component_body_club", role:"body", sizeClass:"medium", primaryEligible:true, weaponFamily:"blunt", materialInputs:[materialInput("body",2,["solid","structural"],"structural_wood",true)], processMultiplier:1.20, minHands:1, allowedHands:[1], allowsGrip:true }),
    component({ id:"club_body_large", name:"Club Body — Large", iconFamily:"weapon_component_body_club", role:"body", sizeClass:"large", primaryEligible:true, weaponFamily:"blunt", materialInputs:[materialInput("body",3,["solid","structural"],"structural_wood",true)], processMultiplier:1.20, minHands:2, allowedHands:[2], allowsGrip:true }),

    component({ id:"grip", name:"Grip", iconFamily:"weapon_component_grip", role:"grip", sizeClass:"small", primaryEligible:false, materialInputs:[materialInput("wrap",1,["flexible"],"leather",false)], processMultiplier:1.15, minHands:1 }),
    component({ id:"lash", name:"Lash", iconFamily:"weapon_component_lash", role:"primary", sizeClass:"medium", primaryEligible:true, weaponFamily:"whip", materialInputs:[materialInput("body",2,["flexible"],"leather",true)], processMultiplier:1.15, minHands:1, compatibleSupports:SUPPORT_LASH }),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(COMPONENTS.map((entry) => [entry.id, entry])));

  function get(id) {
    const entry = BY_ID[normalizeId(id)];
    return entry ? clone(entry) : null;
  }

  function list(options = {}) {
    const role = normalizeId(options.role);
    const sizeClass = normalizeId(options.sizeClass);
    return COMPONENTS.filter((entry) => !role || entry.role === role)
      .filter((entry) => !sizeClass || entry.sizeClass === sizeClass)
      .map(clone);
  }

  function getMaterialDurability(materialId, explicitDurability) {
    const explicit = Number(explicitDurability);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const value = MATERIAL_DURABILITY[normalizeId(materialId)];
    return Number.isFinite(value) ? value : null;
  }

  function getMaterialValue(materialId, explicitValueAhn) {
    const explicit = Number(explicitValueAhn);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const value = MATERIAL_VALUE_REFERENCE_AHN[normalizeId(materialId)];
    return Number.isFinite(value) ? value : null;
  }

  function validateMaterial(requirements, material) {
    const tags = new Set(tagsForMaterial(material?.materialId || material?.id, material?.tags));
    const missing = (requirements || []).filter((tag) => !tags.has(normalizeId(tag)));
    return Object.freeze({ valid: missing.length === 0, missing: Object.freeze(missing.slice()), tags: Object.freeze([...tags]) });
  }

  function normalizeMaterialChoice(choice, fallbackId) {
    if (typeof choice === "string") return { materialId: normalizeId(choice), quality: DEFAULT_QUALITY };
    const source = choice || {};
    return {
      materialId: normalizeId(source.materialId || source.id || fallbackId),
      quality: normalizeId(source.quality || DEFAULT_QUALITY),
      durability: source.durability,
      unitValueAhn: source.unitValueAhn ?? source.standardUnitValueAhn,
      tags: source.tags,
      name: source.name || null,
    };
  }

  function resolveComponent(componentId, materialChoices = {}, craft = {}) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    const composition = [];
    let durability = 0;
    let inputValue = 0;
    let primaryMaterial = null;

    for (const input of def.materialInputs) {
      const selected = normalizeMaterialChoice(materialChoices[input.slot] ?? materialChoices[input.referenceMaterialId], input.referenceMaterialId);
      const validation = validateMaterial(input.requirements, selected);
      if (!validation.valid) {
        return Object.freeze({ valid:false, componentId:def.id, reason:"incompatible_material", slot:input.slot, missing:validation.missing });
      }
      const unitDurability = getMaterialDurability(selected.materialId, selected.durability);
      const unitValueAhn = getMaterialValue(selected.materialId, selected.unitValueAhn);
      if (!Number.isFinite(unitDurability)) {
        return Object.freeze({ valid:false, componentId:def.id, reason:"missing_material_durability", slot:input.slot, materialId:selected.materialId });
      }
      if (!Number.isFinite(unitValueAhn)) {
        return Object.freeze({ valid:false, componentId:def.id, reason:"missing_material_value", slot:input.slot, materialId:selected.materialId });
      }
      durability += input.quantity * unitDurability;
      inputValue += input.quantity * unitValueAhn;
      const row = Object.freeze({
        slot: input.slot,
        materialId: selected.materialId,
        materialName: selected.name,
        quantity: input.quantity,
        quality: QUALITY_SCORE[selected.quality] == null ? DEFAULT_QUALITY : selected.quality,
        unitDurability,
        unitValueAhn,
        primaryMaterial: input.primaryMaterial,
      });
      composition.push(row);
      if (input.primaryMaterial) primaryMaterial = row;
    }

    const productionValueAhn = roundAhn(inputValue * def.processMultiplier);
    return Object.freeze({
      valid: true,
      componentId: def.id,
      name: def.name,
      iconFamily: def.iconFamily,
      icon: def.icon,
      role: def.role,
      sizeClass: def.sizeClass,
      primaryEligible: def.primaryEligible,
      weaponFamily: def.weaponFamily,
      minHands: def.minHands,
      allowedHands: def.allowedHands ? Object.freeze(def.allowedHands.slice()) : null,
      compatibleSupports: Object.freeze(def.compatibleSupports.slice()),
      requiresChain: def.requiresChain,
      allowsGrip: def.allowsGrip,
      composition: Object.freeze(composition),
      primaryMaterial: primaryMaterial ? clone(primaryMaterial) : null,
      durability,
      productionValueAhn,
      quality: normalizeId(craft.quality || DEFAULT_QUALITY),
      processMultiplier: def.processMultiplier,
    });
  }

  function resolveReferenceComponent(componentId) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    const choices = {};
    for (const input of def.materialInputs) choices[input.slot] = input.referenceMaterialId;
    return resolveComponent(def.id, choices, { quality: DEFAULT_QUALITY });
  }

  const API = Object.freeze({
    VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, VALUE_ROUNDING_AHN,
    QUALITY_ORDER, QUALITY_SCORE, MATERIAL_DURABILITY, MATERIAL_VALUE_REFERENCE_AHN, MATERIAL_TAGS, ICONS,
    COMPONENTS, normalizeId, get, list, tagsForMaterial, getMaterialDurability, getMaterialValue,
    validateMaterial, resolveComponent, resolveReferenceComponent, roundAhn,
  });

  global.LuminousWeaponComponentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
