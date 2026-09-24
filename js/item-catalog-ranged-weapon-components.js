(function (global) {
  "use strict";

  if (global.LuminousRangedWeaponComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRangedWeaponComponentCatalog;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Base = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  if (!Base) throw new Error("LuminousWeaponComponentCatalog is required before LuminousRangedWeaponComponentCatalog.");

  const VERSION = 1;
  const FAMILY = "ranged_weapon_components";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";

  function normalizeId(value) { return Base.normalizeId(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function roundAhn(value) { return Base.roundAhn(value); }

  const MATERIAL_VALUE_REFERENCE_AHN = Object.freeze({
    ...Base.MATERIAL_VALUE_REFERENCE_AHN,
    industrial_stone: 10000,
  });

  const ICONS = Object.freeze({
    weapon_component_bow_stave: "Assets/Icons/items/equipment/weapon_component_bow_stave.png",
    weapon_component_bowstring: "Assets/Icons/items/equipment/weapon_component_bowstring.png",
    weapon_component_crossbow_stock: "Assets/Icons/items/equipment/weapon_component_crossbow_stock.png",
    weapon_component_crossbow_prod: "Assets/Icons/items/equipment/weapon_component_crossbow_prod.png",
    weapon_component_crossbow_trigger: "Assets/Icons/items/equipment/weapon_component_crossbow_trigger.png",
    weapon_component_sling_pouch: "Assets/Icons/items/equipment/weapon_component_sling_pouch.png",
    weapon_component_sling_cord: "Assets/Icons/items/equipment/weapon_component_sling_cord.png",
    weapon_component_blowgun_tube: "Assets/Icons/items/equipment/weapon_component_blowgun_tube.png",
    weapon_component_blowgun_mouthpiece: "Assets/Icons/items/equipment/weapon_component_blowgun_mouthpiece.png",
    weapon_component_projectile_shaft: "Assets/Icons/items/equipment/weapon_component_projectile_shaft.png",
    weapon_component_projectile_head: "Assets/Icons/items/equipment/weapon_component_projectile_head.png",
    weapon_component_fletching: "Assets/Icons/items/equipment/weapon_component_fletching.png",
    weapon_component_net_mesh: "Assets/Icons/items/equipment/weapon_component_net_mesh.png",
    weapon_component_net_weighted_cord: "Assets/Icons/items/equipment/weapon_component_net_weighted_cord.png",
    weapon_component_sling_projectile: "Assets/Icons/items/equipment/weapon_component_sling_projectile.png",
    ammo_arrow: "Assets/Icons/items/equipment/ammo_arrow.png",
    ammo_bolt: "Assets/Icons/items/equipment/ammo_bolt.png",
    ammo_blowgun_dart: "Assets/Icons/items/equipment/ammo_bolt.png",
    ammo_thrown_dart: "Assets/Icons/items/equipment/ammo_bolt.png",
  });

  function materialInput(slot, quantity, requirements, referenceMaterialId, primaryMaterial = false) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Ranged component material quantities must be positive integers.");
    return Object.freeze({
      slot: normalizeId(slot), quantity,
      requirements: Object.freeze((requirements || []).map(normalizeId)),
      referenceMaterialId: normalizeId(referenceMaterialId),
      primaryMaterial: !!primaryMaterial,
    });
  }

  function component(def) {
    const iconFamily = normalizeId(def.iconFamily);
    return Object.freeze({
      id: normalizeId(def.id),
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
      materialInputs: Object.freeze(def.materialInputs.slice()),
      processMultiplier: Number(def.processMultiplier || 1),
      batchSurfaceOnly: !!def.batchSurfaceOnly,
      notes: def.notes || "",
      tags: Object.freeze(["weapon_component","ranged_weapon_component",normalizeId(def.role),normalizeId(def.sizeClass || "medium")].filter(Boolean)),
    });
  }

  const COMPONENTS = Object.freeze([
    component({id:"bow_stave_short",name:"Bow Stave — Short",iconFamily:"weapon_component_bow_stave",role:"launcher_body",sizeClass:"medium",primaryEligible:true,materialInputs:[materialInput("body",2,["solid","structural"],"structural_wood",true)],processMultiplier:1.20}),
    component({id:"bow_stave_long",name:"Bow Stave — Long",iconFamily:"weapon_component_bow_stave",role:"launcher_body",sizeClass:"large",primaryEligible:true,materialInputs:[materialInput("body",3,["solid","structural"],"structural_wood",true)],processMultiplier:1.20}),
    component({id:"bowstring",name:"Bowstring",iconFamily:"weapon_component_bowstring",role:"tension",sizeClass:"small",materialInputs:[materialInput("string",1,["flexible","fiber"],"textile")],processMultiplier:1.15}),

    component({id:"crossbow_stock_small",name:"Crossbow Stock — Small",iconFamily:"weapon_component_crossbow_stock",role:"launcher_body",sizeClass:"small",primaryEligible:true,materialInputs:[materialInput("body",1,["solid","structural"],"structural_wood",true)],processMultiplier:1.25}),
    component({id:"crossbow_stock_medium",name:"Crossbow Stock — Medium",iconFamily:"weapon_component_crossbow_stock",role:"launcher_body",sizeClass:"medium",primaryEligible:true,materialInputs:[materialInput("body",2,["solid","structural"],"structural_wood",true)],processMultiplier:1.25}),
    component({id:"crossbow_stock_large",name:"Crossbow Stock — Large",iconFamily:"weapon_component_crossbow_stock",role:"launcher_body",sizeClass:"large",primaryEligible:true,materialInputs:[materialInput("body",3,["solid","structural"],"structural_wood",true)],processMultiplier:1.25}),
    component({id:"crossbow_prod_small",name:"Crossbow Prod — Small",iconFamily:"weapon_component_crossbow_prod",role:"tension",sizeClass:"small",materialInputs:[materialInput("body",1,["solid","structural"],"structural_wood")],processMultiplier:1.25}),
    component({id:"crossbow_prod_medium",name:"Crossbow Prod — Medium",iconFamily:"weapon_component_crossbow_prod",role:"tension",sizeClass:"medium",materialInputs:[materialInput("body",2,["solid","structural"],"structural_wood")],processMultiplier:1.25}),
    component({id:"crossbow_prod_large",name:"Crossbow Prod — Large",iconFamily:"weapon_component_crossbow_prod",role:"tension",sizeClass:"large",materialInputs:[materialInput("body",3,["solid","structural"],"structural_wood")],processMultiplier:1.25}),
    component({id:"crossbow_trigger_lock",name:"Trigger / Lock Mechanism",iconFamily:"weapon_component_crossbow_trigger",role:"mechanism",sizeClass:"small",materialInputs:[materialInput("mechanism",1,["solid","structural","metal"],"iron")],processMultiplier:1.50}),

    component({id:"sling_pouch",name:"Sling Pouch",iconFamily:"weapon_component_sling_pouch",role:"launcher_body",sizeClass:"small",primaryEligible:true,materialInputs:[materialInput("body",1,["flexible","structural"],"leather",true)],processMultiplier:1.15}),
    component({id:"sling_cord",name:"Sling Cord",iconFamily:"weapon_component_sling_cord",role:"tension",sizeClass:"small",materialInputs:[materialInput("cord",1,["flexible","fiber"],"textile")],processMultiplier:1.15}),

    component({id:"blowgun_tube",name:"Blowgun Tube",iconFamily:"weapon_component_blowgun_tube",role:"launcher_body",sizeClass:"medium",primaryEligible:true,materialInputs:[materialInput("body",2,["solid","structural"],"structural_wood",true)],processMultiplier:1.20}),
    component({id:"blowgun_mouthpiece",name:"Blowgun Mouthpiece",iconFamily:"weapon_component_blowgun_mouthpiece",role:"mouthpiece",sizeClass:"small",materialInputs:[materialInput("body",1,["solid","structural"],"structural_wood")],processMultiplier:1.15}),

    component({id:"projectile_shaft",name:"Projectile Shaft",iconFamily:"weapon_component_projectile_shaft",role:"projectile_shaft",sizeClass:"small",materialInputs:[materialInput("body",1,["solid","structural"],"structural_wood",true)],processMultiplier:1.20,batchSurfaceOnly:true,notes:"Logical projectile surface. Final ammo Production Value is resolved by the batch recipe to preserve integer material units."}),
    component({id:"projectile_head",name:"Projectile Head",iconFamily:"weapon_component_projectile_head",role:"projectile_head",sizeClass:"small",primaryEligible:true,materialInputs:[materialInput("head",1,["solid","structural"],"iron",true)],processMultiplier:1.30,batchSurfaceOnly:true,notes:"Logical projectile contact surface. Final ammo Production Value is resolved by the batch recipe."}),
    component({id:"fletching",name:"Fletching / Flights",iconFamily:"weapon_component_fletching",role:"fletching",sizeClass:"small",materialInputs:[materialInput("flight",1,["flexible","fiber"],"textile")],processMultiplier:1.15,batchSurfaceOnly:true}),

    component({id:"net_mesh",name:"Net Mesh",iconFamily:"weapon_component_net_mesh",role:"control_body",sizeClass:"medium",primaryEligible:true,materialInputs:[materialInput("mesh",2,["flexible","fiber"],"textile",true)],processMultiplier:1.20}),
    component({id:"net_weighted_cord",name:"Net Weighted Cord / Weights",iconFamily:"weapon_component_net_weighted_cord",role:"control_weight",sizeClass:"medium",materialInputs:[materialInput("cord",1,["flexible","fiber"],"textile"),materialInput("weight",1,["solid","structural"],"industrial_stone")],processMultiplier:1.25}),
    component({id:"sling_bullet",name:"Sling Bullet / Balín",iconFamily:"weapon_component_sling_projectile",role:"projectile_body",sizeClass:"small",primaryEligible:true,materialInputs:[materialInput("body",1,["solid","structural","metal"],"iron",true)],processMultiplier:1.20,batchSurfaceOnly:true}),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(COMPONENTS.map((entry) => [entry.id, entry])));

  function get(id) {
    const entry = BY_ID[normalizeId(id)];
    return entry ? clone(entry) : null;
  }

  function list(options = {}) {
    const role = normalizeId(options.role);
    return COMPONENTS.filter((entry) => !role || entry.role === role).map(clone);
  }

  function getMaterialValue(materialId, explicitValueAhn) {
    const explicit = Number(explicitValueAhn);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const value = MATERIAL_VALUE_REFERENCE_AHN[normalizeId(materialId)];
    return Number.isFinite(value) ? value : null;
  }

  function normalizeMaterialChoice(choice, fallbackId) {
    if (typeof choice === "string") return {materialId:normalizeId(choice),quality:DEFAULT_QUALITY};
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
      const validation = Base.validateMaterial(input.requirements, selected);
      if (!validation.valid) return Object.freeze({valid:false,componentId:def.id,reason:"incompatible_material",slot:input.slot,missing:validation.missing});
      const unitDurability = Base.getMaterialDurability(selected.materialId, selected.durability);
      const unitValueAhn = getMaterialValue(selected.materialId, selected.unitValueAhn);
      if (!Number.isFinite(unitDurability)) return Object.freeze({valid:false,componentId:def.id,reason:"missing_material_durability",slot:input.slot,materialId:selected.materialId});
      if (!Number.isFinite(unitValueAhn)) return Object.freeze({valid:false,componentId:def.id,reason:"missing_material_value",slot:input.slot,materialId:selected.materialId});
      durability += input.quantity * unitDurability;
      inputValue += input.quantity * unitValueAhn;
      const row = Object.freeze({slot:input.slot,materialId:selected.materialId,materialName:selected.name,quantity:input.quantity,quality:selected.quality,unitDurability,unitValueAhn,primaryMaterial:input.primaryMaterial});
      composition.push(row);
      if (input.primaryMaterial) primaryMaterial = row;
    }

    return Object.freeze({
      valid:true, componentId:def.id, name:def.name, iconFamily:def.iconFamily, icon:def.icon, role:def.role, sizeClass:def.sizeClass,
      primaryEligible:def.primaryEligible, composition:Object.freeze(composition), primaryMaterial:primaryMaterial ? clone(primaryMaterial) : null,
      durability, productionValueAhn:roundAhn(inputValue * def.processMultiplier), quality:normalizeId(craft.quality || DEFAULT_QUALITY),
      processMultiplier:def.processMultiplier, batchSurfaceOnly:def.batchSurfaceOnly,
    });
  }

  function resolveReferenceComponent(componentId) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    const choices = {};
    for (const input of def.materialInputs) choices[input.slot] = input.referenceMaterialId;
    return resolveComponent(def.id, choices, {quality:DEFAULT_QUALITY});
  }

  const API = Object.freeze({
    VERSION,FAMILY,CURRENCY,DEFAULT_QUALITY,MATERIAL_VALUE_REFERENCE_AHN,ICONS,COMPONENTS,
    normalizeId,get,list,getMaterialValue,resolveComponent,resolveReferenceComponent,roundAhn,
  });

  global.LuminousRangedWeaponComponentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);