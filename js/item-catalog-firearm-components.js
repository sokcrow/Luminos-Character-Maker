(function (global) {
  "use strict";

  if (global.LuminousFirearmComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFirearmComponentCatalog;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Base = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  if (!Base) throw new Error("LuminousWeaponComponentCatalog is required before LuminousFirearmComponentCatalog.");

  const VERSION = 1;
  const FAMILY = "firearm_components";
  const CURRENCY = "AHN";
  const MATERIAL_ECONOMY_SCALE = 2.5;
  const DEFAULT_QUALITY = "standard";

  function normalizeId(value) { return Base.normalizeId(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function roundAhn(value) { return Base.roundAhn(value); }

  const ICONS = Object.freeze({
    weapon_component_firearm_frame: "https://imgur.com/PTvX2iC.png",
    weapon_component_firearm_barrel: "https://imgur.com/CevBgU5.png",
    weapon_component_firearm_action: "https://imgur.com/4X3iLIX.png",
    weapon_component_firearm_trigger: "https://imgur.com/EJm7eVM.png",
    weapon_component_firearm_grip: "https://imgur.com/Z8uo0ce.png",
    weapon_component_firearm_stock: "https://imgur.com/zlqG6UR.png",
    weapon_component_firearm_magazine: "https://imgur.com/NfR1h3w.png",
    weapon_component_firearm_cylinder: "https://imgur.com/6jARKtW.png",
    weapon_component_firearm_tube_feed: "https://imgur.com/LN7kuCw.png",
    weapon_component_firearm_sights: "https://imgur.com/1UbIJyN",
  });

  // Reference Production Values only. Real instances may inject actual Production Values
  // from the processed Craft Components or chosen materials they consume.
  const REFERENCE_INPUT_VALUE_AHN = Object.freeze({
    housing_casing: Math.round(27000 * MATERIAL_ECONOMY_SCALE),
    iron: Math.round(20000 * MATERIAL_ECONOMY_SCALE),
    fasteners_hardware: Math.round(26000 * MATERIAL_ECONOMY_SCALE),
    carbon_steel: Math.round(40000 * MATERIAL_ECONOMY_SCALE),
    mechanical_parts: Math.round(69000 * MATERIAL_ECONOMY_SCALE),
    precision_component: Math.round(114000 * MATERIAL_ECONOMY_SCALE),
    structural_stock: Math.round(10000 * MATERIAL_ECONOMY_SCALE),
    processed_leather: Math.round(7000 * MATERIAL_ECONOMY_SCALE),
  });

  const QUALITY_SCALABLE_FIELDS = Object.freeze([
    "control",
    "reliability",
    "rangeEfficiency",
    "stability",
  ]);

  const DISCRETE_FIELDS = Object.freeze([
    "cadenceModes",
    "capacity",
    "reload",
    "caliberTiers",
    "connections",
  ]);

  function craftInput(id, quantity = 1, kind = "component") {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Firearm component input quantities must be positive integers.");
    return Object.freeze({ id: normalizeId(id), quantity, kind: normalizeId(kind) });
  }

  function component(def) {
    const iconFamily = normalizeId(def.iconFamily);
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      family: FAMILY,
      category: "component",
      itemType: "weapon_component",
      weaponFamily: "firearm",
      stackable: true,
      currency: CURRENCY,
      iconFamily,
      icon: ICONS[iconFamily] || null,
      role: normalizeId(def.role),
      sizeClass: normalizeId(def.sizeClass || "medium"),
      craftInputs: Object.freeze((def.craftInputs || []).slice()),
      processMultiplier: Number(def.processMultiplier || 1),
      baseThreshold: Number(def.baseThreshold),
      requiredToolType: normalizeId(def.requiredToolType || "technical_tools"),
      semanticCheck: normalizeId(def.semanticCheck || "mechanical_fabrication"),
      authority: Object.freeze((def.authority || []).map(normalizeId)),
      connections: Object.freeze((def.connections || []).map(normalizeId)),
      properties: Object.freeze(clone(def.properties || {})),
      qualityScalableFields: QUALITY_SCALABLE_FIELDS,
      discreteFields: DISCRETE_FIELDS,
      directDamageAllowed: false,
      statusApplicationAllowed: false,
      soundSuppressionAllowed: false,
      notes: def.notes || "",
      tags: Object.freeze(["weapon_component", "firearm_component", normalizeId(def.role), normalizeId(def.sizeClass || "medium")].filter(Boolean)),
    });
  }

  const FRAME_CONNECTIONS = Object.freeze(["barrel_mount","action_mount","trigger_mount","grip_mount","feed_mount","sight_mount","stock_mount"]);

  const COMPONENTS = Object.freeze([
    component({ id:"compact_frame", name:"Compact Firearm Frame", iconFamily:"weapon_component_firearm_frame", role:"frame", sizeClass:"small",
      craftInputs:[craftInput("housing_casing"),craftInput("iron"),craftInput("fasteners_hardware")], processMultiplier:1.50, baseThreshold:20,
      authority:["connections","caliber_compatibility","control","reliability"], connections:FRAME_CONNECTIONS,
      properties:{control:0,reliability:1,caliberTiers:[1,2]} }),
    component({ id:"standard_frame", name:"Standard Firearm Frame", iconFamily:"weapon_component_firearm_frame", role:"frame", sizeClass:"medium",
      craftInputs:[craftInput("housing_casing"),craftInput("iron",2),craftInput("fasteners_hardware")], processMultiplier:1.50, baseThreshold:20,
      authority:["connections","caliber_compatibility","control","reliability"], connections:FRAME_CONNECTIONS,
      properties:{control:1,reliability:2,caliberTiers:[1,2,3]} }),
    component({ id:"long_frame", name:"Long Firearm Frame", iconFamily:"weapon_component_firearm_frame", role:"frame", sizeClass:"large",
      craftInputs:[craftInput("housing_casing",2),craftInput("iron",2),craftInput("fasteners_hardware")], processMultiplier:1.50, baseThreshold:20,
      authority:["connections","caliber_compatibility","control","reliability"], connections:FRAME_CONNECTIONS,
      properties:{control:1,reliability:3,caliberTiers:[2,3,4]} }),

    component({ id:"compact_barrel", name:"Compact Barrel", iconFamily:"weapon_component_firearm_barrel", role:"barrel", sizeClass:"small",
      craftInputs:[craftInput("carbon_steel"),craftInput("mechanical_parts")], processMultiplier:1.55, baseThreshold:24,
      authority:["range_efficiency","control","caliber_compatibility"], properties:{control:0,rangeEfficiency:0,caliberTiers:[1,2,3]} }),
    component({ id:"standard_barrel", name:"Standard Barrel", iconFamily:"weapon_component_firearm_barrel", role:"barrel", sizeClass:"medium",
      craftInputs:[craftInput("carbon_steel",2),craftInput("mechanical_parts")], processMultiplier:1.55, baseThreshold:24,
      authority:["range_efficiency","control","caliber_compatibility"], properties:{control:0,rangeEfficiency:5,caliberTiers:[1,2,3,4]} }),
    component({ id:"long_barrel", name:"Long Barrel", iconFamily:"weapon_component_firearm_barrel", role:"barrel", sizeClass:"large",
      craftInputs:[craftInput("carbon_steel",3),craftInput("mechanical_parts")], processMultiplier:1.55, baseThreshold:24,
      authority:["range_efficiency","control","caliber_compatibility"], properties:{control:1,rangeEfficiency:10,caliberTiers:[1,2,3,4]} }),

    component({ id:"standard_action", name:"Standard Weapon Action", iconFamily:"weapon_component_firearm_action", role:"action", sizeClass:"medium",
      craftInputs:[craftInput("mechanical_parts"),craftInput("precision_component"),craftInput("fasteners_hardware")], processMultiplier:1.65, baseThreshold:24,
      authority:["cadence","reliability","reload_support","recovery"], properties:{reliability:1,cadenceModes:["single","rapid"]} }),
    component({ id:"high_cadence_action", name:"High-Cadence Weapon Action", iconFamily:"weapon_component_firearm_action", role:"action", sizeClass:"medium",
      craftInputs:[craftInput("mechanical_parts",2),craftInput("precision_component"),craftInput("fasteners_hardware")], processMultiplier:1.65, baseThreshold:24,
      authority:["cadence","reliability","reload_support","recovery"], properties:{reliability:1,cadenceModes:["single","rapid","burst","full"]} }),

    component({ id:"trigger_group", name:"Trigger Group", iconFamily:"weapon_component_firearm_trigger", role:"trigger", sizeClass:"small",
      craftInputs:[craftInput("mechanical_parts"),craftInput("fasteners_hardware")], processMultiplier:1.55, baseThreshold:24,
      authority:["control","cadence_handling"], properties:{control:1} }),
    component({ id:"grip", name:"Firearm Grip", iconFamily:"weapon_component_firearm_grip", role:"grip", sizeClass:"small",
      craftInputs:[craftInput("structural_stock"),craftInput("processed_leather")], processMultiplier:1.30, baseThreshold:20, requiredToolType:"fabrication_tools", semanticCheck:"fabrication",
      authority:["control","stability"], properties:{control:1,stability:1} }),
    component({ id:"stock", name:"Firearm Stock", iconFamily:"weapon_component_firearm_stock", role:"stock", sizeClass:"medium",
      craftInputs:[craftInput("structural_stock",2),craftInput("processed_leather"),craftInput("fasteners_hardware")], processMultiplier:1.35, baseThreshold:20, requiredToolType:"fabrication_tools", semanticCheck:"fabrication",
      authority:["control","stability","range_efficiency","hand_mode"], properties:{control:2,stability:2,rangeEfficiency:2} }),

    component({ id:"compact_magazine", name:"Compact Magazine", iconFamily:"weapon_component_firearm_magazine", role:"feed", sizeClass:"small",
      craftInputs:[craftInput("housing_casing"),craftInput("fasteners_hardware")], processMultiplier:1.45, baseThreshold:20,
      authority:["capacity","reload"], properties:{capacity:6,reload:{economy:"action",mode:"full",amount:"capacity"},feedType:"magazine"} }),
    component({ id:"standard_magazine", name:"Standard Magazine", iconFamily:"weapon_component_firearm_magazine", role:"feed", sizeClass:"medium",
      craftInputs:[craftInput("housing_casing"),craftInput("fasteners_hardware"),craftInput("structural_stock")], processMultiplier:1.45, baseThreshold:20,
      authority:["capacity","reload"], properties:{capacity:12,reload:{economy:"action",mode:"full",amount:"capacity"},feedType:"magazine"} }),
    component({ id:"cylinder", name:"Cylinder", iconFamily:"weapon_component_firearm_cylinder", role:"feed", sizeClass:"medium",
      craftInputs:[craftInput("carbon_steel"),craftInput("mechanical_parts"),craftInput("fasteners_hardware")], processMultiplier:1.55, baseThreshold:24,
      authority:["capacity","reload","reliability"], properties:{capacity:6,reliability:1,reload:{economy:"action",mode:"incremental",amount:3},feedType:"cylinder"} }),
    component({ id:"tube_feed", name:"Tubular Feed", iconFamily:"weapon_component_firearm_tube_feed", role:"feed", sizeClass:"medium",
      craftInputs:[craftInput("housing_casing"),craftInput("mechanical_parts"),craftInput("fasteners_hardware")], processMultiplier:1.50, baseThreshold:24,
      authority:["capacity","reload"], properties:{capacity:6,reload:{economy:"action",mode:"incremental",amount:2},feedType:"tube_feed"} }),

    component({ id:"sights", name:"Mechanical Sights", iconFamily:"weapon_component_firearm_sights", role:"sights", sizeClass:"small",
      craftInputs:[craftInput("mechanical_parts"),craftInput("iron")], processMultiplier:1.45, baseThreshold:24,
      authority:["range_efficiency","control"], properties:{control:0,rangeEfficiency:3} }),
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

  function referenceInputValue(inputId) {
    const value = REFERENCE_INPUT_VALUE_AHN[normalizeId(inputId)];
    return Number.isFinite(value) ? value : null;
  }

  function productionValue(componentId, inputValuesAhn = {}) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    let inputValue = 0;
    for (const input of def.craftInputs) {
      const explicit = Number(inputValuesAhn[input.id]);
      const unit = Number.isFinite(explicit) ? explicit : referenceInputValue(input.id);
      if (!Number.isFinite(unit)) return null;
      inputValue += unit * input.quantity;
    }
    return roundAhn(inputValue * def.processMultiplier);
  }

  function resolveComponent(componentId, options = {}) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    return Object.freeze({
      valid:true,
      componentId:def.id,
      name:def.name,
      iconFamily:def.iconFamily,
      icon:def.icon,
      role:def.role,
      sizeClass:def.sizeClass,
      quality:normalizeId(options.quality || DEFAULT_QUALITY),
      productionValueAhn:productionValue(def.id, options.inputValuesAhn || {}),
      baseThreshold:def.baseThreshold,
      requiredToolType:def.requiredToolType,
      semanticCheck:def.semanticCheck,
      authority:def.authority,
      connections:def.connections,
      properties:clone(def.properties),
      directDamageAllowed:false,
      statusApplicationAllowed:false,
      soundSuppressionAllowed:false,
    });
  }

  function resolveReferenceComponent(componentId) {
    return resolveComponent(componentId, {quality:DEFAULT_QUALITY});
  }

  const API = Object.freeze({
    VERSION,FAMILY,CURRENCY,DEFAULT_QUALITY,ICONS,REFERENCE_INPUT_VALUE_AHN,QUALITY_SCALABLE_FIELDS,DISCRETE_FIELDS,COMPONENTS,
    normalizeId,get,list,referenceInputValue,productionValue,resolveComponent,resolveReferenceComponent,roundAhn,
  });

  global.LuminousFirearmComponentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
