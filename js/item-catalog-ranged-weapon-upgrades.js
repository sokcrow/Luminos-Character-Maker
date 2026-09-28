(function (global) {
  "use strict";

  if (global.LuminousRangedWeaponUpgradeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRangedWeaponUpgradeCatalog;
    return;
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function arr(value) { return Object.freeze((value || []).map(normalizeId)); }

  const VERSION = 1;
  const MAX_SLOTS = 3;
  const MIN_UPGRADE_DURABILITY_RATIO_EXCLUSIVE = 0.50;
  const MIN_DURABILITY_FLOOR_RATIO = 0.40;
  const AMMO_GRADES = Object.freeze({standard:0,precision:5,enhanced:10,masterwork:15});

  function upgrade(def) {
    const scope = normalizeId(def.scope || "ammo");
    const damagePercent = Number(def.damagePercent || 0);
    const ammoPowerPercent = Number(def.ammoPowerPercent || 0);
    if (scope === "launcher" && (damagePercent || ammoPowerPercent)) throw new Error(`Launcher upgrade ${def.id} cannot grant direct damage/ammo power.`);
    const statusType = normalizeId(def.statusType || "");
    const statusAxis = normalizeId(def.statusAxis || "");
    if (statusAxis && !["potency","count"].includes(statusAxis)) throw new Error(`Invalid status axis for ${def.id}`);
    if ((def.statusDelta || 0) && (!statusType || !statusAxis)) throw new Error(`Status delta requires type+axis for ${def.id}`);
    return Object.freeze({
      id:normalizeId(def.id), name:def.name, scope, category:normalizeId(def.category), group:normalizeId(def.group || def.category), tier:normalizeId(def.tier || "standard"),
      slotCost:Number(def.slotCost || 1), compatibleComponentIds:arr(def.compatibleComponentIds), requiredSkillTags:arr(def.requiredSkillTags), forbiddenSkillTags:arr(def.forbiddenSkillTags),
      damageType:normalizeId(def.damageType || ""), damagePercent, ammoPowerPercent, clashPercent:Number(def.clashPercent || 0), controlPercent:Number(def.controlPercent || 0), stabilityPercent:Number(def.stabilityPercent || 0),
      statusType,statusAxis,statusDelta:Number(def.statusDelta || 0),durabilityPercent:Number(def.durabilityPercent || 0),mitigationChannel:normalizeId(def.mitigationChannel || ""),mitigationPercent:Number(def.mitigationPercent || 0),
      addProperties:arr(def.addProperties), notes:def.notes || "",
    });
  }

  const HEAD = ["projectile_head"];
  const SHAFT = ["projectile_shaft"];
  const FLETCH = ["fletching"];
  const BULLET = ["sling_bullet"];
  const BOW_STAVE = ["bow_stave_short","bow_stave_long"];
  const XBOW_PROD = ["crossbow_prod_small","crossbow_prod_medium","crossbow_prod_large"];
  const XBOW_STOCK = ["crossbow_stock_small","crossbow_stock_medium","crossbow_stock_large"];

  const UPGRADES = Object.freeze([
    upgrade({id:"ammo_honed_point",name:"Honed Point",scope:"ammo",category:"damage",group:"point_damage",compatibleComponentIds:HEAD,damageType:"pierce",damagePercent:10}),
    upgrade({id:"ammo_needle_point",name:"Needle Point",scope:"ammo",category:"damage",group:"point_damage",tier:"specialized",slotCost:2,compatibleComponentIds:HEAD,damageType:"pierce",damagePercent:15,durabilityPercent:-20}),
    upgrade({id:"ammo_broadhead",name:"Broadhead",scope:"ammo",category:"damage",group:"edge_damage",compatibleComponentIds:HEAD,damageType:"slash",damagePercent:10,durabilityPercent:-10,addProperties:["edge_geometry"]}),
    upgrade({id:"ammo_razor_broadhead",name:"Razor Broadhead",scope:"ammo",category:"damage",group:"edge_damage",tier:"specialized",slotCost:2,compatibleComponentIds:HEAD,damageType:"slash",damagePercent:15,durabilityPercent:-20,addProperties:["edge_geometry"]}),
    upgrade({id:"ammo_impact_head",name:"Impact Head",scope:"ammo",category:"damage",group:"impact_damage",compatibleComponentIds:[...HEAD,...BULLET],damageType:"blunt",damagePercent:10,addProperties:["impact_geometry"]}),
    upgrade({id:"ammo_heavy_impact_head",name:"Heavy Impact Head",scope:"ammo",category:"damage",group:"impact_damage",tier:"specialized",slotCost:2,compatibleComponentIds:[...HEAD,...BULLET],damageType:"blunt",damagePercent:15,durabilityPercent:-20,addProperties:["impact_geometry","heavy_projectile"]}),

    upgrade({id:"ammo_barbed_point",name:"Barbed Point",scope:"ammo",category:"status",group:"bleed_potency",compatibleComponentIds:HEAD,statusType:"bleed",statusAxis:"potency",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"ammo_retaining_barbs",name:"Retaining Barbs",scope:"ammo",category:"status",group:"bleed_count",compatibleComponentIds:HEAD,statusType:"bleed",statusAxis:"count",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"ammo_deep_barbs",name:"Deep Barbs",scope:"ammo",category:"status",group:"bleed_count",tier:"specialized",slotCost:2,compatibleComponentIds:HEAD,statusType:"bleed",statusAxis:"count",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"ammo_breaker_point",name:"Breaker Point",scope:"ammo",category:"status",group:"rupture_potency",compatibleComponentIds:HEAD,statusType:"rupture",statusAxis:"potency",statusDelta:1}),
    upgrade({id:"ammo_deep_penetrator",name:"Deep Penetrator",scope:"ammo",category:"status",group:"rupture_potency",tier:"specialized",slotCost:2,compatibleComponentIds:HEAD,statusType:"rupture",statusAxis:"potency",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"ammo_anchoring_point",name:"Anchoring Point",scope:"ammo",category:"status",group:"rupture_count",compatibleComponentIds:HEAD,statusType:"rupture",statusAxis:"count",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"ammo_embedded_breaker",name:"Embedded Breaker",scope:"ammo",category:"status",group:"rupture_count",tier:"specialized",slotCost:2,compatibleComponentIds:HEAD,statusType:"rupture",statusAxis:"count",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"ammo_shock_head",name:"Shock Head",scope:"ammo",category:"status",group:"tremor_potency",compatibleComponentIds:[...HEAD,...BULLET],statusType:"tremor",statusAxis:"potency",statusDelta:1,addProperties:["impact_geometry"]}),
    upgrade({id:"ammo_rebound_head",name:"Rebound Head",scope:"ammo",category:"status",group:"tremor_count",compatibleComponentIds:[...HEAD,...BULLET],statusType:"tremor",statusAxis:"count",statusDelta:1,addProperties:["impact_geometry"]}),

    upgrade({id:"ammo_balanced_shaft",name:"Balanced Shaft",scope:"ammo",category:"handling",group:"shaft_balance",compatibleComponentIds:SHAFT,ammoPowerPercent:5}),
    upgrade({id:"ammo_reinforced_shaft",name:"Reinforced Shaft",scope:"ammo",category:"reinforcement",group:"shaft_structure",compatibleComponentIds:SHAFT,durabilityPercent:20}),
    upgrade({id:"ammo_heavy_shaft",name:"Heavy Shaft",scope:"ammo",category:"handling",group:"shaft_balance",compatibleComponentIds:SHAFT,ammoPowerPercent:5,controlPercent:-10,addProperties:["heavy_projectile"]}),
    upgrade({id:"ammo_light_shaft",name:"Light Shaft",scope:"ammo",category:"handling",group:"shaft_balance",compatibleComponentIds:SHAFT,ammoPowerPercent:-5,controlPercent:10,durabilityPercent:-10}),
    upgrade({id:"ammo_stiff_shaft",name:"Stiff Shaft",scope:"ammo",category:"handling",group:"shaft_tolerance",compatibleComponentIds:SHAFT,mitigationChannel:"heavy_ammo_penalty",mitigationPercent:10}),

    upgrade({id:"ammo_balanced_fletching",name:"Balanced Fletching",scope:"ammo",category:"handling",group:"fletching_balance",compatibleComponentIds:FLETCH,clashPercent:10,controlPercent:10}),
    upgrade({id:"ammo_long_fletching",name:"Long Fletching",scope:"ammo",category:"handling",group:"fletching_profile",compatibleComponentIds:FLETCH,stabilityPercent:10}),
    upgrade({id:"ammo_short_fletching",name:"Short Fletching",scope:"ammo",category:"handling",group:"fletching_profile",compatibleComponentIds:FLETCH,ammoPowerPercent:5,stabilityPercent:-10}),
    upgrade({id:"ammo_reinforced_fletching",name:"Reinforced Fletching",scope:"ammo",category:"reinforcement",group:"fletching_structure",compatibleComponentIds:FLETCH,durabilityPercent:20}),
    upgrade({id:"ammo_quick_spin_fletching",name:"Quick-Spin Fletching",scope:"ammo",category:"handling",group:"fletching_profile",tier:"specialized",slotCost:2,compatibleComponentIds:FLETCH,ammoPowerPercent:10,durabilityPercent:-10}),
    upgrade({id:"ammo_stabilizing_flights",name:"Stabilizing Flights",scope:"ammo",category:"handling",group:"fletching_balance",compatibleComponentIds:FLETCH,mitigationChannel:"control_penalty",mitigationPercent:10}),

    upgrade({id:"bow_reinforced_limbs",name:"Reinforced Limbs",scope:"launcher",category:"reinforcement",group:"limb_structure",compatibleComponentIds:BOW_STAVE,durabilityPercent:20}),
    upgrade({id:"bow_tuned_limbs",name:"Tuned Limbs",scope:"launcher",category:"handling",group:"limb_tuning",compatibleComponentIds:BOW_STAVE,clashPercent:10,controlPercent:10}),
    upgrade({id:"bow_heavy_tension_tuning",name:"Heavy-Tension Tuning",scope:"launcher",category:"handling",group:"limb_tuning",compatibleComponentIds:BOW_STAVE,mitigationChannel:"heavy_ammo_penalty",mitigationPercent:10}),
    upgrade({id:"bow_reinforced_string",name:"Reinforced String",scope:"launcher",category:"reinforcement",group:"string_structure",compatibleComponentIds:["bowstring"],durabilityPercent:20}),
    upgrade({id:"bow_precision_string",name:"Precision String",scope:"launcher",category:"handling",group:"string_tuning",compatibleComponentIds:["bowstring"],clashPercent:10,controlPercent:10,durabilityPercent:-10}),
    upgrade({id:"bow_quick_release_string",name:"Quick-Release String",scope:"launcher",category:"handling",group:"string_tuning",compatibleComponentIds:["bowstring"],mitigationChannel:"recovery_penalty",mitigationPercent:10,durabilityPercent:-10}),

    upgrade({id:"crossbow_reinforced_prod",name:"Reinforced Prod",scope:"launcher",category:"reinforcement",group:"prod_structure",compatibleComponentIds:XBOW_PROD,durabilityPercent:20}),
    upgrade({id:"crossbow_tuned_prod",name:"Tuned Prod",scope:"launcher",category:"handling",group:"prod_tuning",compatibleComponentIds:XBOW_PROD,clashPercent:10,controlPercent:10}),
    upgrade({id:"crossbow_heavy_tension_tuning",name:"Heavy-Tension Tuning",scope:"launcher",category:"handling",group:"prod_tuning",compatibleComponentIds:XBOW_PROD,mitigationChannel:"heavy_ammo_penalty",mitigationPercent:10}),
    upgrade({id:"crossbow_reinforced_stock",name:"Reinforced Stock",scope:"launcher",category:"reinforcement",group:"stock_structure",compatibleComponentIds:XBOW_STOCK,durabilityPercent:20}),
    upgrade({id:"crossbow_balanced_stock",name:"Balanced Stock",scope:"launcher",category:"handling",group:"stock_balance",compatibleComponentIds:XBOW_STOCK,clashPercent:10,controlPercent:10}),
    upgrade({id:"crossbow_braced_stock",name:"Braced Stock",scope:"launcher",category:"handling",group:"stock_balance",compatibleComponentIds:["crossbow_stock_medium","crossbow_stock_large"],requiredSkillTags:["two_handed"],stabilityPercent:10}),
    upgrade({id:"crossbow_precision_trigger",name:"Precision Trigger",scope:"launcher",category:"handling",group:"trigger_tuning",compatibleComponentIds:["crossbow_trigger_lock"],clashPercent:10,controlPercent:10}),
    upgrade({id:"crossbow_reinforced_lock",name:"Reinforced Lock",scope:"launcher",category:"reinforcement",group:"trigger_structure",compatibleComponentIds:["crossbow_trigger_lock"],durabilityPercent:20}),
    upgrade({id:"crossbow_quick_reset_lock",name:"Quick-Reset Lock",scope:"launcher",category:"handling",group:"trigger_tuning",compatibleComponentIds:["crossbow_trigger_lock"],mitigationChannel:"recovery_penalty",mitigationPercent:10}),

    upgrade({id:"sling_reinforced_cord",name:"Reinforced Cord",scope:"launcher",category:"reinforcement",group:"sling_cord_structure",compatibleComponentIds:["sling_cord"],durabilityPercent:20}),
    upgrade({id:"sling_balanced_cord",name:"Balanced Cord",scope:"launcher",category:"handling",group:"sling_cord_tuning",compatibleComponentIds:["sling_cord"],clashPercent:10,controlPercent:10}),
    upgrade({id:"sling_long_cord",name:"Long Cord",scope:"launcher",category:"handling",group:"sling_cord_tuning",compatibleComponentIds:["sling_cord"],controlPercent:-5,mitigationChannel:"heavy_ammo_penalty",mitigationPercent:10}),
    upgrade({id:"sling_reinforced_pouch",name:"Reinforced Pouch",scope:"launcher",category:"reinforcement",group:"sling_pouch_structure",compatibleComponentIds:["sling_pouch"],durabilityPercent:20}),
    upgrade({id:"sling_deep_pouch",name:"Deep Pouch",scope:"launcher",category:"handling",group:"sling_pouch_tuning",compatibleComponentIds:["sling_pouch"],mitigationChannel:"heavy_ammo_penalty",mitigationPercent:10}),
    upgrade({id:"sling_quick_release_pouch",name:"Quick-Release Pouch",scope:"launcher",category:"handling",group:"sling_pouch_tuning",compatibleComponentIds:["sling_pouch"],mitigationChannel:"recovery_penalty",mitigationPercent:10}),

    upgrade({id:"blowgun_reinforced_tube",name:"Reinforced Tube",scope:"launcher",category:"reinforcement",group:"tube_structure",compatibleComponentIds:["blowgun_tube"],durabilityPercent:20}),
    upgrade({id:"blowgun_long_tube",name:"Long Tube",scope:"launcher",category:"handling",group:"tube_profile",compatibleComponentIds:["blowgun_tube"],stabilityPercent:10}),
    upgrade({id:"blowgun_precision_bore",name:"Precision Bore",scope:"launcher",category:"handling",group:"tube_profile",compatibleComponentIds:["blowgun_tube"],clashPercent:10,controlPercent:10}),
    upgrade({id:"blowgun_tight_bore",name:"Tight Bore",scope:"launcher",category:"handling",group:"tube_profile",compatibleComponentIds:["blowgun_tube"],mitigationChannel:"heavy_ammo_penalty",mitigationPercent:10,durabilityPercent:-10}),
    upgrade({id:"blowgun_reinforced_mouthpiece",name:"Reinforced Mouthpiece",scope:"launcher",category:"reinforcement",group:"mouthpiece_structure",compatibleComponentIds:["blowgun_mouthpiece"],durabilityPercent:20}),
    upgrade({id:"blowgun_ergonomic_mouthpiece",name:"Ergonomic Mouthpiece",scope:"launcher",category:"handling",group:"mouthpiece_tuning",compatibleComponentIds:["blowgun_mouthpiece"],mitigationChannel:"control_penalty",mitigationPercent:10}),

    upgrade({id:"net_reinforced_mesh",name:"Reinforced Mesh",scope:"net",category:"reinforcement",group:"net_mesh_structure",compatibleComponentIds:["net_mesh"],durabilityPercent:20}),
    upgrade({id:"net_tight_mesh",name:"Tight Mesh",scope:"net",category:"control",group:"net_mesh_tuning",compatibleComponentIds:["net_mesh"],controlPercent:10}),
    upgrade({id:"net_flexible_mesh",name:"Flexible Mesh",scope:"net",category:"control",group:"net_mesh_tuning",compatibleComponentIds:["net_mesh"],mitigationChannel:"control_penalty",mitigationPercent:10}),
    upgrade({id:"net_reinforced_weighted_cord",name:"Reinforced Weighted Cord",scope:"net",category:"reinforcement",group:"net_weight_structure",compatibleComponentIds:["net_weighted_cord"],durabilityPercent:20}),
    upgrade({id:"net_balanced_weights",name:"Balanced Weights",scope:"net",category:"control",group:"net_weight_tuning",compatibleComponentIds:["net_weighted_cord"],clashPercent:10,controlPercent:10}),
    upgrade({id:"net_quick_release_weights",name:"Quick-Release Weights",scope:"net",category:"control",group:"net_weight_tuning",compatibleComponentIds:["net_weighted_cord"],mitigationChannel:"recovery_penalty",mitigationPercent:10}),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(UPGRADES.map((entry) => [entry.id, entry])));
  function get(id) { const entry = BY_ID[normalizeId(id)]; return entry ? clone(entry) : null; }
  function list(options = {}) {
    const scope = normalizeId(options.scope); const category = normalizeId(options.category);
    return UPGRADES.filter((x) => !scope || x.scope === scope).filter((x) => !category || x.category === category).map(clone);
  }

  const API = Object.freeze({VERSION,MAX_SLOTS,MIN_UPGRADE_DURABILITY_RATIO_EXCLUSIVE,MIN_DURABILITY_FLOOR_RATIO,AMMO_GRADES,UPGRADES,normalizeId,get,list});
  global.LuminousRangedWeaponUpgradeCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);