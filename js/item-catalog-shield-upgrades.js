(function (global) {
  "use strict";

  if (global.LuminousShieldUpgradeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShieldUpgradeCatalog;
    return;
  }

  const VERSION = 1;
  const MAX_SLOTS = 3;
  const BODY = ["shield_component_body"];
  const RIM = ["shield_component_rim"];
  const GRIP = ["shield_component_grip"];

  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  function arr(value) { return (value || []).map(normalizeId).filter(Boolean); }
  function freezeRecipe(recipe = {}) {
    return Object.freeze({
      materialInputs: Object.freeze((recipe.materialInputs || []).map((row) => Object.freeze({
        slot: normalizeId(row.slot),
        quantity: Math.max(1, Math.trunc(row.quantity || 1)),
        requirements: Object.freeze(arr(row.requirements)),
        referenceMaterialId: normalizeId(row.referenceMaterialId || ""),
        defaultSource: normalizeId(row.defaultSource || "component_primary"),
      }))),
      componentInputs: Object.freeze((recipe.componentInputs || []).map((row) => Object.freeze({
        componentId: normalizeId(row.componentId),
        quantity: Math.max(1, Math.trunc(row.quantity || 1)),
      }))),
      processMultiplier: Number(recipe.processMultiplier || 1),
      workRatio: Number(recipe.workRatio || 0),
    });
  }
  function mode(id, damageType, tags = [], surfaces = []) {
    return Object.freeze({ id:normalizeId(id), damageType:normalizeId(damageType), tags:Object.freeze(arr(tags)), surfaces:Object.freeze(arr(surfaces)) });
  }
  function upgrade(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      family: "shield_upgrades",
      category: normalizeId(def.category || "upgrade"),
      itemType: "shield_upgrade",
      group: normalizeId(def.group || def.id),
      tier: normalizeId(def.tier || "standard"),
      slotCost: Math.max(1, Math.trunc(def.slotCost || 1)),
      allowedComponents: Object.freeze(arr(def.allowedComponents)),
      requiredSurfaces: Object.freeze(arr(def.requiredSurfaces)),
      addSurfaces: Object.freeze(arr(def.addSurfaces)),
      addAttackModes: Object.freeze((def.addAttackModes || []).map((entry) => mode(entry.id, entry.damageType, entry.tags, entry.surfaces))),
      addTags: Object.freeze(arr(def.addTags)),
      effects: Object.freeze(JSON.parse(JSON.stringify(def.effects || {}))),
      recipe: freezeRecipe(def.recipe),
      notes: def.notes || "",
    });
  }

  const rigid1 = (mult = 1.25) => ({ materialInputs:[{slot:"material",quantity:1,requirements:["solid","structural"],referenceMaterialId:"iron",defaultSource:"component_primary"}], processMultiplier:mult });
  const structural1 = (mult = 1.25) => ({ materialInputs:[{slot:"material",quantity:1,requirements:["structural"],referenceMaterialId:"wood",defaultSource:"component_primary"}], processMultiplier:mult });
  const flexible1 = (mult = 1.20) => ({ materialInputs:[{slot:"material",quantity:1,requirements:["flexible"],referenceMaterialId:"leather",defaultSource:"component_flexible"}], processMultiplier:mult });

  const UPGRADES = Object.freeze([
    upgrade({ id:"reinforced_body", name:"Reinforced Body", category:"structure", group:"body_structure", allowedComponents:BODY,
      effects:{durabilityPercent:20,weightPercent:10}, recipe:structural1(1.25) }),
    upgrade({ id:"lightened_body", name:"Lightened Body", category:"handling", group:"body_structure", allowedComponents:BODY,
      effects:{durabilityPercent:-15,weightPercent:-15,guardDelta:-1}, recipe:{workRatio:0.30}, notes:"Retrabajo del Body existente; no consume MU adicional." }),
    upgrade({ id:"impact_boss", name:"Impact Boss", category:"offense", group:"boss_geometry", allowedComponents:BODY,
      addTags:["tremor_capable"], effects:{damagePercent:10,statusAmplifiers:[{statusType:"tremor",axis:"potency",delta:1}],weightPercent:10}, recipe:rigid1(1.25) }),
    upgrade({ id:"shock_boss", name:"Shock Boss", category:"offense", group:"boss_geometry", tier:"specialized", slotCost:2, allowedComponents:BODY,
      addTags:["tremor_capable"], effects:{damagePercent:15,statusAmplifiers:[{statusType:"tremor",axis:"count",delta:1}],weightPercent:15,durabilityPercent:-20}, recipe:rigid1(1.35) }),
    upgrade({ id:"spiked_face", name:"Spiked Face", category:"offense", group:"face_geometry", allowedComponents:BODY,
      addSurfaces:["point"], addAttackModes:[{id:"spike",damageType:"pierce",tags:["shield","point","rupture_capable"],surfaces:["point"]}], addTags:["rupture_capable"],
      effects:{guardDelta:-2,durabilityPercent:-10,statusAmplifiers:[{statusType:"rupture",axis:"potency",delta:1}]}, recipe:rigid1(1.30) }),
    upgrade({ id:"breaker_spikes", name:"Breaker Spikes", category:"offense", group:"face_geometry", tier:"specialized", slotCost:2, allowedComponents:BODY,
      addSurfaces:["point"], addAttackModes:[{id:"breaker_spike",damageType:"pierce",tags:["shield","point","rupture_capable"],surfaces:["point"]}], addTags:["rupture_capable"],
      effects:{guardDelta:-3,durabilityPercent:-20,statusAmplifiers:[{statusType:"rupture",axis:"potency",delta:2}]},
      recipe:{materialInputs:[{slot:"material",quantity:2,requirements:["solid","structural"],referenceMaterialId:"iron",defaultSource:"component_primary"}],processMultiplier:1.35} }),

    upgrade({ id:"parrying_rim", name:"Parrying Rim", category:"defense", group:"rim_defense", allowedComponents:RIM,
      effects:{parryTier:1}, recipe:rigid1(1.30), notes:"Buckler already has intrinsic Parry Tier 1 and does not spend a slot for it." }),
    upgrade({ id:"reinforced_rim", name:"Reinforced Rim", category:"structure", group:"rim_structure", allowedComponents:RIM,
      effects:{durabilityPercent:20,weightPercent:10}, recipe:rigid1(1.25) }),
    upgrade({ id:"bladed_rim", name:"Bladed Rim", category:"offense", group:"rim_geometry", allowedComponents:RIM,
      addSurfaces:["edge"], addAttackModes:[{id:"cut",damageType:"slash",tags:["shield","edge","bleed_capable"],surfaces:["edge"]}], addTags:["bleed_capable"],
      effects:{guardDelta:-2,durabilityPercent:-10,statusAmplifiers:[{statusType:"bleed",axis:"potency",delta:1}]}, recipe:rigid1(1.35) }),
    upgrade({ id:"serrated_rim", name:"Serrated Rim", category:"status", group:"rim_serration", allowedComponents:RIM, requiredSurfaces:["edge"],
      addTags:["bleed_capable"], effects:{durabilityPercent:-10,statusAmplifiers:[{statusType:"bleed",axis:"count",delta:1}]}, recipe:{workRatio:0.25} }),
    upgrade({ id:"mounted_knife", name:"Mounted Knife", category:"offense", group:"rim_geometry", tier:"specialized", slotCost:2, allowedComponents:RIM,
      addSurfaces:["edge","point"], addAttackModes:[
        {id:"knife_cut",damageType:"slash",tags:["shield","blade","bleed_capable"],surfaces:["edge"]},
        {id:"knife_stab",damageType:"pierce",tags:["shield","blade","bleed_capable"],surfaces:["point"]},
      ], addTags:["bleed_capable"], effects:{guardDelta:-3,durabilityPercent:-20},
      recipe:{componentInputs:[{componentId:"short_blade",quantity:1}],processMultiplier:1.20}, notes:"Uses a real Short Blade component; the Skill owns exact Bleed amounts." }),
    upgrade({ id:"hooked_rim", name:"Hooked Rim", category:"offense", group:"rim_geometry", allowedComponents:RIM,
      addSurfaces:["hook"], addAttackModes:[{id:"hook",damageType:"slash",tags:["shield","hook","displacement_capable"],surfaces:["hook"]}], effects:{guardDelta:-1}, recipe:rigid1(1.30) }),
    upgrade({ id:"staggering_rim", name:"Staggering Rim", category:"defense", group:"rim_clash", allowedComponents:RIM,
      effects:{staggerOnCrashWin:2,durabilityPercent:-10}, recipe:rigid1(1.30) }),
    upgrade({ id:"crushing_deflector", name:"Crushing Deflector", category:"defense", group:"rim_clash", tier:"specialized", slotCost:2, allowedComponents:RIM,
      effects:{shieldCrackedDelta:1,extraWearOnCrashContact:1}, recipe:rigid1(1.35) }),

    upgrade({ id:"reinforced_grip", name:"Reinforced Grip", category:"structure", group:"grip_structure", allowedComponents:GRIP,
      effects:{durabilityPercent:20}, recipe:rigid1(1.20) }),
    upgrade({ id:"shock_absorbing_grip", name:"Shock-Absorbing Grip", category:"defense", group:"grip_control", allowedComponents:GRIP,
      effects:{elementalWearFlatReduction:1}, recipe:flexible1(1.20), notes:"Cannot reduce a contacted Shield Skill below the canonical minimum 1 Wear." }),
    upgrade({ id:"counterweighted_grip", name:"Counterweighted Grip", category:"clash", group:"grip_balance", allowedComponents:GRIP,
      effects:{clashModifier:1,shieldAttackDamagePercent:-5}, recipe:rigid1(1.20) }),
    upgrade({ id:"power_grip", name:"Power Grip", category:"offense", group:"grip_balance", allowedComponents:GRIP,
      effects:{shieldAttackDamagePercent:5}, recipe:flexible1(1.15) }),
    upgrade({ id:"secure_grip", name:"Secure Grip", category:"handling", group:"grip_control", allowedComponents:GRIP,
      effects:{strengthRequirementDelta:-1}, recipe:flexible1(1.15) }),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(UPGRADES.map((entry) => [entry.id, entry])));
  function get(id) { const row = BY_ID[normalizeId(id)]; return row ? JSON.parse(JSON.stringify(row)) : null; }
  function list(options = {}) {
    const componentId = normalizeId(options.componentId);
    const category = normalizeId(options.category);
    return UPGRADES.filter((row) => !componentId || row.allowedComponents.includes(componentId))
      .filter((row) => !category || row.category === category)
      .map((row) => JSON.parse(JSON.stringify(row)));
  }

  const API = Object.freeze({ VERSION, MAX_SLOTS, UPGRADES, normalizeId, get, list });
  global.LuminousShieldUpgradeCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
