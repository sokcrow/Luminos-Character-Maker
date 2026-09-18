(function (global) {
  "use strict";
  if (global.LuminousArmorUpgradeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousArmorUpgradeCatalog;
    return;
  }
  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function upgrade(def) {
    return Object.freeze({ id:normalizeId(def.id), name:def.name, family:"armor_upgrades", category:"upgrade", itemType:"armor_upgrade", allowedComponents:Object.freeze((def.allowedComponents || []).map(normalizeId)), effects:Object.freeze(JSON.parse(JSON.stringify(def.effects || {}))), notes:def.notes || "" });
  }
  const U = [];
  function add(id,name,allowed,effects,notes="") { U.push(upgrade({id,name,allowedComponents:allowed,effects,notes})); }
  const PLATE=["armor_plate"], MAIL=["armor_mail"], SCALE=["armor_scale_layer"], LEATHER=["armor_leather_layer"], PAD=["armor_padding"], REIN=["armor_reinforcement"], FIT=["armor_fittings"];
  add("angled_plating","Angled Plating",PLATE,{affinityDelta:{pierce:1,blunt:-1}});
  add("rounded_plating","Rounded Plating",PLATE,{affinityDelta:{slash:1,pierce:-1}});
  add("impact_channels","Impact Channels",PLATE,{affinityDelta:{blunt:1,slash:-1}});
  add("segmented_plate","Segmented Plate",PLATE,{repairCostMultiplier:0.75});
  add("dense_weave","Dense Weave",MAIL,{affinityDelta:{pierce:1},weightMultiplier:1.10});
  add("flexible_weave","Flexible Weave",MAIL,{affinityDelta:{pierce:-1},weightMultiplier:0.90});
  add("reinforced_rings","Reinforced Rings",MAIL,{durabilityMultiplier:1.20,weightMultiplier:1.10});
  add("riveted_links","Riveted Links",MAIL,{affinityDelta:{slash:1},repairCostMultiplier:1.10});
  add("overlapping_scales","Overlapping Scales",SCALE,{affinityDelta:{slash:1,blunt:-1}});
  add("interlocked_scales","Interlocked Scales",SCALE,{affinityDelta:{pierce:1},weightMultiplier:1.10});
  add("floating_scales","Floating Scales",SCALE,{weightMultiplier:0.85,durabilityMultiplier:0.90});
  add("replaceable_scales","Replaceable Scales",SCALE,{repairCostMultiplier:0.75});
  add("hardened_leather","Hardened Leather",LEATHER,{affinityDelta:{slash:1},weightMultiplier:1.05});
  add("layered_leather","Layered Leather",LEATHER,{affinityDelta:{blunt:1},weightMultiplier:1.10});
  add("flexible_treatment","Flexible Treatment",LEATHER,{weightMultiplier:0.85,durabilityMultiplier:0.90});
  add("waxed_treatment","Waxed Treatment",LEATHER,{elementalWearMultiplier:{acid:0.90,fire:1.15}});
  add("shock_padding","Shock Padding",PAD,{affinityDelta:{blunt:1}});
  add("layered_padding","Layered Padding",PAD,{affinityDelta:{blunt:1},weightMultiplier:1.10});
  add("ventilated_padding","Ventilated Padding",PAD,{weightMultiplier:0.90,durabilityMultiplier:0.90,elementalWearMultiplier:{fire:0.90}});
  add("insulated_lining","Insulated Lining",PAD,{elementalWearMultiplier:{cold:0.75,fire:1.15}});
  add("anti_slash_bracing","Anti-Slash Bracing",REIN,{affinityDelta:{slash:1,blunt:-1}});
  add("anti_pierce_bracing","Anti-Pierce Bracing",REIN,{affinityDelta:{pierce:1,slash:-1}});
  add("shock_bracing","Shock Bracing",REIN,{affinityDelta:{blunt:1,pierce:-1}});
  add("heavy_bracing","Heavy Bracing",REIN,{durabilityMultiplier:1.20,weightMultiplier:1.15});
  add("lightweight_bracing","Lightweight Bracing",REIN,{weightMultiplier:0.85,durabilityMultiplier:0.90});
  add("modular_bracing","Modular Bracing",REIN,{repairCostMultiplier:0.75});
  add("balanced_harness","Balanced Harness",FIT,{armorSpeedDelta:{max:1}});
  add("articulated_fittings","Articulated Fittings",FIT,{armorSpeedDelta:{min:1}});
  add("load_distribution","Load Distribution",FIT,{weightMultiplier:0.90});
  add("lightweight_fittings","Lightweight Fittings",FIT,{weightMultiplier:0.80,durabilityMultiplier:0.90});
  add("silent_fittings","Silent Fittings",FIT,{noiseDelta:-1});
  add("quick_release","Quick Release",FIT,{equipActionStep:-1});
  add("anti_corrosion_coating","Anti-Corrosion Coating",[...PLATE,...MAIL,...SCALE,...REIN],{elementalWearMultiplier:{acid:0.70}});
  add("heat_treatment","Heat Treatment",[...PLATE,...MAIL,...SCALE,...REIN],{elementalWearMultiplier:{fire:0.75}});
  add("electrical_insulation","Electrical Insulation",[...PAD,...LEATHER,...FIT],{elementalWearMultiplier:{lightning:0.75}});

  const UPGRADES = Object.freeze(U);
  const BY_ID = Object.freeze(Object.fromEntries(UPGRADES.map((row) => [row.id,row])));
  function get(id) { const row=BY_ID[normalizeId(id)]; return row ? JSON.parse(JSON.stringify(row)) : null; }
  function list(options={}) { const component=normalizeId(options.componentId); return UPGRADES.filter((row)=>!component||row.allowedComponents.includes(component)).map((row)=>JSON.parse(JSON.stringify(row))); }
  const API = Object.freeze({ VERSION:1, UPGRADES, normalizeId, get, list });
  global.LuminousArmorUpgradeCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
