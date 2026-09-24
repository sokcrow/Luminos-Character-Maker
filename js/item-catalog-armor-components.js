(function (global) {
  "use strict";

  if (global.LuminousArmorComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousArmorComponentCatalog;
    return;
  }

  function safeRequire(path) { if (typeof require !== "function") return null; try { return require(path); } catch (_) { return null; } }
  const Materials = global.LuminousArmorMaterialProfile || safeRequire("./item-armor-material-profile.js");
  if (!Materials) throw new Error("LuminousArmorMaterialProfile is required before LuminousArmorComponentCatalog.");

  const VERSION = 1;
  const FAMILY = "armor_components";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const VALUE_ROUNDING_AHN = 1000;

  const ICONS = Object.freeze({
    armor_component_padding: "Assets/Icons/items/equipment/armor_component_padding.png",
    armor_component_leather: "Assets/Icons/items/equipment/armor_component_leather.png",
    armor_component_mail: "Assets/Icons/items/equipment/armor_component_mail.png",
    armor_component_scale: "Assets/Icons/items/equipment/armor_component_scale.png",
    armor_component_plate: "Assets/Icons/items/equipment/armor_component_plate.png",
    armor_component_reinforcement: "Assets/Icons/items/equipment/armor_component_reinforcement.png",
    armor_component_fittings: "Assets/Icons/items/equipment/armor_component_fittings.png",
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) { return Materials.normalizeId(value); }
  function roundAhn(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n / VALUE_ROUNDING_AHN) * VALUE_ROUNDING_AHN);
  }
  function materialInput(slot, quantity, requirements, referenceMaterialId, primaryMaterial = false) {
    return Object.freeze({ slot:normalizeId(slot), quantity:Math.max(1, Math.trunc(quantity || 1)), requirements:Object.freeze((requirements || []).map(normalizeId)), referenceMaterialId:normalizeId(referenceMaterialId), primaryMaterial:!!primaryMaterial });
  }
  function component(def) {
    return Object.freeze({
      id: normalizeId(def.id), name:def.name, family:FAMILY, category:"component", itemType:"armor_component", stackable:true, currency:CURRENCY,
      iconFamily:normalizeId(def.iconFamily), icon:ICONS[normalizeId(def.iconFamily)] || null,
      role:normalizeId(def.role), defensiveWeight:Number(def.defensiveWeight || 0),
      geometry:Object.freeze({ slash:Number(def.geometry?.slash ?? 1), pierce:Number(def.geometry?.pierce ?? 1), blunt:Number(def.geometry?.blunt ?? 1) }),
      materialInputs:Object.freeze(def.materialInputs.slice()), processMultiplier:Number(def.processMultiplier || 1),
      tags:Object.freeze(["armor_component", normalizeId(def.role)].filter(Boolean)), notes:def.notes || "",
    });
  }

  const COMPONENTS = Object.freeze([
    component({ id:"armor_padding", name:"Armor Padding", iconFamily:"armor_component_padding", role:"padding", defensiveWeight:0.35, geometry:{slash:0.60,pierce:0.50,blunt:1.40}, materialInputs:[materialInput("body",2,["flexible"],"processed_textile",true)], processMultiplier:1.25 }),
    component({ id:"armor_leather_layer", name:"Leather / Hide Layer", iconFamily:"armor_component_leather", role:"primary_layer", defensiveWeight:1.00, geometry:{slash:1.00,pierce:0.90,blunt:1.00}, materialInputs:[materialInput("body",2,["flexible","structural"],"processed_leather",true)], processMultiplier:1.25 }),
    component({ id:"armor_mail", name:"Mail / Links", iconFamily:"armor_component_mail", role:"primary_layer", defensiveWeight:1.00, geometry:{slash:1.10,pierce:0.90,blunt:1.20}, materialInputs:[materialInput("links",3,["linkable","structural"],"iron",true)], processMultiplier:1.35 }),
    component({ id:"armor_scale_layer", name:"Scale Layer", iconFamily:"armor_component_scale", role:"primary_layer", defensiveWeight:1.00, geometry:{slash:1.10,pierce:1.00,blunt:1.10}, materialInputs:[materialInput("scales",3,["scale_compatible","structural"],"scale",true)], processMultiplier:1.30 }),
    component({ id:"armor_plate", name:"Armor Plate", iconFamily:"armor_component_plate", role:"primary_layer", defensiveWeight:1.00, geometry:{slash:1.00,pierce:1.00,blunt:1.00}, materialInputs:[materialInput("body",4,["solid","structural"],"iron",true)], processMultiplier:1.30 }),
    component({ id:"armor_reinforcement", name:"Armor Reinforcement", iconFamily:"armor_component_reinforcement", role:"reinforcement", defensiveWeight:0.50, geometry:{slash:1.00,pierce:1.00,blunt:1.00}, materialInputs:[materialInput("body",1,["structural"],"iron",true)], processMultiplier:1.30 }),
    component({ id:"armor_fittings", name:"Straps / Fittings", iconFamily:"armor_component_fittings", role:"fittings", defensiveWeight:0.10, geometry:{slash:0.50,pierce:0.50,blunt:0.50}, materialInputs:[materialInput("straps",1,["flexible"],"processed_leather",true),materialInput("hardware",1,["structural"],"iron",false)], processMultiplier:1.30 }),
  ]);
  const BY_ID = Object.freeze(Object.fromEntries(COMPONENTS.map((entry) => [entry.id, entry])));

  function get(id) { const row = BY_ID[normalizeId(id)]; return row ? clone(row) : null; }
  function list(options = {}) { const role = normalizeId(options.role); return COMPONENTS.filter((row) => !role || row.role === role).map(clone); }

  function validateMaterial(requirements, material) {
    const tags = new Set(material.tags || []);
    const missing = (requirements || []).filter((tag) => !tags.has(normalizeId(tag)));
    return Object.freeze({ valid:missing.length === 0, missing:Object.freeze(missing) });
  }

  function weightedElemental(rows) {
    const totals = {fire:0,cold:0,lightning:0,acid:0}; let weight = 0;
    for (const row of rows) {
      const q = Number(row.quantity || 1); weight += q;
      for (const key of Object.keys(totals)) totals[key] += Number(row.material.elementalWear[key] || 1) * q;
    }
    if (!weight) return Object.freeze({fire:1,cold:1,lightning:1,acid:1});
    return Object.freeze(Object.fromEntries(Object.entries(totals).map(([k,v]) => [k, v / weight])));
  }

  function resolveComponent(componentId, materialChoices = {}, craft = {}) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    const composition = [];
    let durability = 0, weightScore = 0, inputValue = 0;
    let primaryMaterial = null;
    const rawAffinity = {slash:0,pierce:0,blunt:0};
    let affinityUnits = 0;

    for (const input of def.materialInputs) {
      const choice = materialChoices[input.slot] ?? materialChoices[input.referenceMaterialId] ?? input.referenceMaterialId;
      const material = Materials.resolve(choice, typeof choice === "object" ? choice : {});
      const validation = validateMaterial(input.requirements, material);
      if (!validation.valid) return Object.freeze({ valid:false, componentId:def.id, reason:"incompatible_material", slot:input.slot, missing:validation.missing, materialId:material.id });
      const q = input.quantity;
      durability += q * material.durability;
      weightScore += q * material.weight;
      inputValue += q * material.unitValueAhn;
      for (const type of Materials.DAMAGE_TYPES) rawAffinity[type] += material.affinity[type] * q;
      affinityUnits += q;
      const row = Object.freeze({ slot:input.slot, quantity:q, primaryMaterial:input.primaryMaterial, material:clone(material) });
      composition.push(row);
      if (input.primaryMaterial) primaryMaterial = material;
    }

    const avg = Object.fromEntries(Materials.DAMAGE_TYPES.map((type) => [type, affinityUnits ? rawAffinity[type] / affinityUnits : 0]));
    const physicalAffinity = Object.freeze(Object.fromEntries(Materials.DAMAGE_TYPES.map((type) => [type, avg[type] * def.geometry[type]])));
    const baseMaterialDurability = Number(primaryMaterial?.durability || 0);
    return Object.freeze({
      valid:true, componentId:def.id, name:def.name, role:def.role, iconFamily:def.iconFamily, icon:def.icon,
      defensiveWeight:def.defensiveWeight, geometry:clone(def.geometry), composition:Object.freeze(composition), primaryMaterial:primaryMaterial ? clone(primaryMaterial) : null,
      physicalAffinity, durability, baseMaterialDurability, upgradeCapacity:Materials.upgradeSlotsForDurability(baseMaterialDurability),
      weightScore, elementalWear:weightedElemental(composition), productionValueAhn:roundAhn(inputValue * def.processMultiplier),
      quality:normalizeId(craft.quality || DEFAULT_QUALITY), processMultiplier:def.processMultiplier,
      installedUpgrades:Object.freeze([]), armorSpeedDelta:Object.freeze({min:0,max:0}), repairCostMultiplier:1, noiseDelta:0,
    });
  }

  function resolveReferenceComponent(componentId) { return resolveComponent(componentId, {}, {quality:DEFAULT_QUALITY}); }

  const API = Object.freeze({ VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, VALUE_ROUNDING_AHN, ICONS, COMPONENTS, normalizeId, get, list, validateMaterial, resolveComponent, resolveReferenceComponent, roundAhn });
  global.LuminousArmorComponentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
