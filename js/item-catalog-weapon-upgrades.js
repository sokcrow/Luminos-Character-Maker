(function (global) {
  "use strict";

  if (global.LuminousWeaponUpgradeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponUpgradeCatalog;
    return;
  }

  const VERSION = 1;
  const MAX_SLOTS = 3;
  const MIN_UPGRADE_DURABILITY_RATIO_EXCLUSIVE = 0.50;
  const MIN_DURABILITY_FLOOR_RATIO = 0.40;

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function arr(value) { return Object.freeze((value || []).map(normalizeId)); }

  function upgrade(def) {
    const statusType = normalizeId(def.statusType || "");
    const statusAxis = normalizeId(def.statusAxis || "");
    if (statusAxis && !["potency", "count"].includes(statusAxis)) throw new Error(`Invalid status axis for ${def.id}`);
    if ((def.statusDelta || 0) && (!statusType || !statusAxis)) throw new Error(`Status delta requires type+axis for ${def.id}`);
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      category: normalizeId(def.category),
      group: normalizeId(def.group || def.category),
      tier: normalizeId(def.tier || "standard"),
      slotCost: Number(def.slotCost || 1),
      compatibleComponentIds: arr(def.compatibleComponentIds),
      compatibleFamilies: arr(def.compatibleFamilies),
      requiredSurfaces: arr(def.requiredSurfaces),
      requiredSkillTags: arr(def.requiredSkillTags),
      forbiddenSkillTags: arr(def.forbiddenSkillTags),
      damageType: normalizeId(def.damageType || ""),
      damagePercent: Number(def.damagePercent || 0),
      powerPercent: Number(def.powerPercent || 0),
      clashPercent: Number(def.clashPercent || 0),
      guardPercent: Number(def.guardPercent || 0),
      counterPercent: Number(def.counterPercent || 0),
      statusType,
      statusAxis,
      statusDelta: Number(def.statusDelta || 0),
      durabilityPercent: Number(def.durabilityPercent || 0),
      supportWearExtra: Number(def.supportWearExtra || 0),
      mitigationPercent: Number(def.mitigationPercent || 0),
      mitigationChannel: normalizeId(def.mitigationChannel || ""),
      addSurfaces: arr(def.addSurfaces),
      addProperties: arr(def.addProperties),
      notes: def.notes || "",
    });
  }

  const BLADE = ["short_blade","long_blade","great_blade"];
  const AXE = ["axe_head_small","axe_head_medium","axe_head_large"];
  const HAMMER = ["hammer_head_small","hammer_head_medium","hammer_head_large"];
  const IMPACT_HEAD = [...HAMMER,"mace_head","flail_head","club_body_medium","club_body_large"];
  const POINT_HEAD = ["short_blade","long_blade","great_blade","spear_head","polearm_head","pick_head"];
  const HANDLE = ["handle","reinforced_handle","grip"];
  const SUPPORT = ["handle","reinforced_handle","shaft","long_shaft","grip"];
  const SHAFT = ["shaft","long_shaft"];

  const UPGRADES = Object.freeze([
    upgrade({id:"sharpened_edge",name:"Sharpened Edge",category:"damage",group:"edge_damage",compatibleComponentIds:[...BLADE,...AXE,"polearm_head"],requiredSurfaces:["edge"],damageType:"slash",damagePercent:10}),
    upgrade({id:"razor_edge",name:"Razor Edge",category:"damage",group:"edge_damage",tier:"specialized",compatibleComponentIds:[...BLADE,...AXE],requiredSurfaces:["edge"],damageType:"slash",damagePercent:15,durabilityPercent:-20}),
    upgrade({id:"honed_point",name:"Honed Point",category:"damage",group:"point_damage",compatibleComponentIds:POINT_HEAD,requiredSurfaces:["point"],damageType:"pierce",damagePercent:10}),
    upgrade({id:"needle_point",name:"Needle Point",category:"damage",group:"point_damage",tier:"specialized",compatibleComponentIds:[...BLADE,"spear_head"],requiredSurfaces:["point"],damageType:"pierce",damagePercent:15,durabilityPercent:-20}),
    upgrade({id:"weighted_face",name:"Weighted Face",category:"damage",group:"impact_damage",compatibleComponentIds:IMPACT_HEAD,requiredSurfaces:["impact"],damageType:"blunt",damagePercent:10}),
    upgrade({id:"overweighted_head",name:"Overweighted Head",category:"damage",group:"impact_damage",tier:"specialized",compatibleComponentIds:[...HAMMER,"mace_head","flail_head"],requiredSurfaces:["impact"],damageType:"blunt",damagePercent:15,supportWearExtra:1,addProperties:["heavy_head"]}),
    upgrade({id:"versatile_geometry",name:"Versatile Geometry",category:"damage",group:"blade_geometry",compatibleComponentIds:["long_blade","great_blade"],requiredSurfaces:["edge","point"],notes:"Compatible Slash and Pierce Skills each receive +5% damage."}),

    upgrade({id:"serrated_edge",name:"Serrated Edge",category:"status",group:"bleed_potency",compatibleComponentIds:[...BLADE,...AXE,"polearm_head"],requiredSurfaces:["edge"],statusType:"bleed",statusAxis:"potency",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"deep_serration",name:"Deep Serration",category:"status",group:"bleed_potency",tier:"specialized",slotCost:2,compatibleComponentIds:[...BLADE,...AXE],requiredSurfaces:["edge"],statusType:"bleed",statusAxis:"potency",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"retaining_teeth",name:"Retaining Teeth",category:"status",group:"bleed_count",compatibleComponentIds:[...BLADE,...AXE,"polearm_head"],requiredSurfaces:["edge"],statusType:"bleed",statusAxis:"count",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"hooked_serration",name:"Hooked Serration",category:"status",group:"bleed_count",tier:"specialized",slotCost:2,compatibleComponentIds:[...BLADE,...AXE],requiredSurfaces:["edge"],statusType:"bleed",statusAxis:"count",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"barbed_point",name:"Barbed Point",category:"status",group:"bleed_potency",compatibleComponentIds:[...BLADE,"spear_head","polearm_head"],requiredSurfaces:["point"],statusType:"bleed",statusAxis:"potency",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"spiked_face",name:"Spiked Face",category:"status",group:"bleed_potency",compatibleComponentIds:[...HAMMER,"mace_head"],requiredSurfaces:["impact"],statusType:"bleed",statusAxis:"potency",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"barbed_lash",name:"Barbed Lash",category:"status",group:"bleed_count",compatibleComponentIds:["lash"],statusType:"bleed",statusAxis:"count",statusDelta:1,durabilityPercent:-10}),

    upgrade({id:"breaker_point",name:"Breaker Point",category:"status",group:"rupture_potency",compatibleComponentIds:["pick_head","spear_head","polearm_head"],requiredSurfaces:["point"],statusType:"rupture",statusAxis:"potency",statusDelta:1}),
    upgrade({id:"deep_penetrator",name:"Deep Penetrator",category:"status",group:"rupture_potency",tier:"specialized",slotCost:2,compatibleComponentIds:["pick_head","spear_head",...BLADE],requiredSurfaces:["point"],statusType:"rupture",statusAxis:"potency",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"anchoring_point",name:"Anchoring Point",category:"status",group:"rupture_count",compatibleComponentIds:["pick_head","spear_head","polearm_head",...BLADE],requiredSurfaces:["point"],statusType:"rupture",statusAxis:"count",statusDelta:1,durabilityPercent:-10}),
    upgrade({id:"embedded_breaker",name:"Embedded Breaker",category:"status",group:"rupture_count",tier:"specialized",slotCost:2,compatibleComponentIds:["pick_head","spear_head","polearm_head"],requiredSurfaces:["point"],statusType:"rupture",statusAxis:"count",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"wedge_edge",name:"Wedge Edge",category:"status",group:"rupture_potency",compatibleComponentIds:[...AXE,"great_blade"],requiredSurfaces:["edge"],statusType:"rupture",statusAxis:"potency",statusDelta:1}),
    upgrade({id:"stress_concentrator",name:"Stress Concentrator",category:"status",group:"rupture_potency",compatibleComponentIds:[...HAMMER,"mace_head","pick_head"],statusType:"rupture",statusAxis:"potency",statusDelta:1,durabilityPercent:-10}),

    upgrade({id:"impact_mass",name:"Impact Mass",category:"status",group:"tremor_potency",compatibleComponentIds:IMPACT_HEAD,requiredSurfaces:["impact"],statusType:"tremor",statusAxis:"potency",statusDelta:1}),
    upgrade({id:"shock_concentrator",name:"Shock Concentrator",category:"status",group:"tremor_potency",tier:"specialized",slotCost:2,compatibleComponentIds:[...HAMMER,"mace_head"],requiredSurfaces:["impact"],statusType:"tremor",statusAxis:"potency",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"rebound_mass",name:"Rebound Mass",category:"status",group:"tremor_count",compatibleComponentIds:IMPACT_HEAD,requiredSurfaces:["impact"],statusType:"tremor",statusAxis:"count",statusDelta:1}),
    upgrade({id:"persistent_shock_head",name:"Persistent Shock Head",category:"status",group:"tremor_count",tier:"specialized",slotCost:2,compatibleComponentIds:[...HAMMER,"mace_head","flail_head"],requiredSurfaces:["impact"],statusType:"tremor",statusAxis:"count",statusDelta:2,durabilityPercent:-20}),
    upgrade({id:"weighted_chain",name:"Weighted Chain",category:"status",group:"tremor_count",compatibleComponentIds:["chain_link"],statusType:"tremor",statusAxis:"count",statusDelta:1,durabilityPercent:-10}),

    upgrade({id:"back_spike",name:"Back Spike",category:"geometry",group:"axe_geometry",slotCost:2,compatibleComponentIds:AXE,addSurfaces:["point"],durabilityPercent:-20}),
    upgrade({id:"spike_conversion",name:"Spike Conversion",category:"geometry",group:"impact_geometry",slotCost:2,compatibleComponentIds:[...HAMMER,"mace_head"],addSurfaces:["point"],durabilityPercent:-20}),
    upgrade({id:"hooked_head",name:"Hooked Head",category:"geometry",group:"head_geometry",compatibleComponentIds:[...AXE,"polearm_head"],addProperties:["hook"]}),
    upgrade({id:"extended_edge",name:"Extended Edge",category:"geometry",group:"edge_geometry",compatibleComponentIds:[...BLADE,"polearm_head"],requiredSurfaces:["edge"],addProperties:["extended_edge"],durabilityPercent:-10}),

    upgrade({id:"balanced_handle",name:"Balanced Handle",category:"clash",group:"clash_core",compatibleComponentIds:HANDLE,clashPercent:10}),
    upgrade({id:"duelist_hilt",name:"Duelist Hilt",category:"clash",group:"clash_defense",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["clashable"],clashPercent:15,notes:"Only applies to Clashable Guard/Counter skill contexts."}),
    upgrade({id:"two_hand_brace",name:"Two-Hand Brace",category:"clash",group:"clash_stance",compatibleComponentIds:["reinforced_handle","shaft","long_shaft"],requiredSkillTags:["two_handed"],clashPercent:10,durabilityPercent:10}),
    upgrade({id:"clash_stabilizer",name:"Clash Stabilizer",category:"clash",group:"clash_mitigation",compatibleComponentIds:SUPPORT,mitigationChannel:"clash_penalty",mitigationPercent:10}),
    upgrade({id:"counterweighted_pommel",name:"Counterweighted Pommel",category:"clash",group:"balance",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["heavy"],clashPercent:10,durabilityPercent:10}),

    upgrade({id:"reinforced_guard",name:"Reinforced Guard",category:"guard",group:"guard_core",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["guard"],guardPercent:10,durabilityPercent:20}),
    upgrade({id:"wide_guard",name:"Wide Guard",category:"guard",group:"guard_core",tier:"specialized",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["guard"],guardPercent:15,counterPercent:-5}),
    upgrade({id:"braced_hilt",name:"Braced Hilt",category:"guard",group:"guard_stance",compatibleComponentIds:["reinforced_handle"],requiredSkillTags:["guard","two_handed"],guardPercent:15,durabilityPercent:10}),
    upgrade({id:"impact_absorbing_grip",name:"Impact-Absorbing Grip",category:"guard",group:"guard_absorption",compatibleComponentIds:["grip","reinforced_handle"],requiredSkillTags:["guard","physical"],guardPercent:10,durabilityPercent:10}),
    upgrade({id:"parrying_guard",name:"Parrying Guard",category:"guard",group:"guard_clash",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["guard","clashable"],clashPercent:15}),

    upgrade({id:"counter_brace",name:"Counter Brace",category:"counter",group:"counter_core",compatibleComponentIds:["reinforced_handle","shaft","long_shaft"],requiredSkillTags:["counter"],counterPercent:10,durabilityPercent:10}),
    upgrade({id:"reactive_grip",name:"Reactive Grip",category:"counter",group:"counter_core",tier:"specialized",compatibleComponentIds:["grip","reinforced_handle"],requiredSkillTags:["counter","reactive"],counterPercent:15}),
    upgrade({id:"quick_recovery_hilt",name:"Quick-Recovery Hilt",category:"counter",group:"counter_recovery",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["counter"],mitigationChannel:"recovery_penalty",mitigationPercent:10}),
    upgrade({id:"catching_quillons",name:"Catching Quillons",category:"counter",group:"counter_clash",compatibleComponentIds:["handle","reinforced_handle"],requiredSkillTags:["counter","clashable","physical"],clashPercent:15}),

    upgrade({id:"forward_balance_handle",name:"Forward-Balance Handle",category:"handling",group:"balance",compatibleComponentIds:["handle","reinforced_handle"],powerPercent:5,clashPercent:-10}),
    upgrade({id:"rear_balance_handle",name:"Rear-Balance Handle",category:"handling",group:"balance",compatibleComponentIds:["handle","reinforced_handle"],powerPercent:-5,clashPercent:10}),
    upgrade({id:"power_grip",name:"Power Grip",category:"handling",group:"power_transfer",compatibleComponentIds:["grip","handle","reinforced_handle"],requiredSkillTags:["physical"],powerPercent:5}),
    upgrade({id:"leverage_handle",name:"Leverage Handle",category:"handling",group:"power_transfer",compatibleComponentIds:["reinforced_handle","shaft","long_shaft"],requiredSkillTags:["physical","leverage","two_handed"],powerPercent:10}),
    upgrade({id:"heavy_counterweight",name:"Heavy Counterweight",category:"handling",group:"balance",compatibleComponentIds:["handle","reinforced_handle"],mitigationChannel:"heavy_balance_penalty",mitigationPercent:100,powerPercent:-5,durabilityPercent:10}),
    upgrade({id:"secure_grip",name:"Secure Grip",category:"handling",group:"grip_control",compatibleComponentIds:["grip","handle","reinforced_handle"],mitigationChannel:"control_penalty",mitigationPercent:10,durabilityPercent:10}),
    upgrade({id:"ergonomic_grip",name:"Ergonomic Grip",category:"handling",group:"grip_control",compatibleComponentIds:["grip"],mitigationChannel:"handling_penalty",mitigationPercent:5}),
    upgrade({id:"transition_grip",name:"Transition Grip",category:"handling",group:"grip_transition",compatibleComponentIds:["grip","reinforced_handle"],requiredSkillTags:["surface_transition"],clashPercent:10}),

    upgrade({id:"balanced_shaft",name:"Balanced Shaft",category:"shaft",group:"shaft_balance",compatibleComponentIds:SHAFT,clashPercent:10}),
    upgrade({id:"weighted_shaft",name:"Weighted Shaft",category:"shaft",group:"shaft_balance",compatibleComponentIds:SHAFT,powerPercent:5,clashPercent:-10,durabilityPercent:10}),
    upgrade({id:"tapered_shaft",name:"Tapered Shaft",category:"shaft",group:"shaft_balance",compatibleComponentIds:SHAFT,clashPercent:10,durabilityPercent:-10}),
    upgrade({id:"extended_shaft",name:"Extended Shaft",category:"geometry",group:"shaft_geometry",compatibleComponentIds:SHAFT,addProperties:["extended_shaft"]}),
    upgrade({id:"reinforced_shaft",name:"Reinforced Shaft",category:"structure",group:"structure_reinforcement",compatibleComponentIds:SHAFT,durabilityPercent:20}),
    upgrade({id:"reinforced_joint",name:"Reinforced Joint",category:"structure",group:"joint_reinforcement",compatibleComponentIds:["reinforced_handle",...SHAFT],durabilityPercent:20}),
    upgrade({id:"flexible_haft",name:"Flexible Haft",category:"shaft",group:"shaft_absorption",compatibleComponentIds:SHAFT,mitigationChannel:"support_wear",mitigationPercent:1,durabilityPercent:10}),

    upgrade({id:"reinforced_blade",name:"Reinforced Blade",category:"structure",group:"structure_reinforcement",compatibleComponentIds:BLADE,durabilityPercent:20}),
    upgrade({id:"reinforced_head",name:"Reinforced Head",category:"structure",group:"structure_reinforcement",compatibleComponentIds:[...AXE,...HAMMER,"mace_head","spear_head","polearm_head","pick_head","flail_head"],durabilityPercent:20}),
    upgrade({id:"protected_point",name:"Protected Point",category:"structure",group:"point_reinforcement",compatibleComponentIds:POINT_HEAD,requiredSurfaces:["point"],durabilityPercent:10}),
    upgrade({id:"reinforced_links",name:"Reinforced Links",category:"structure",group:"structure_reinforcement",compatibleComponentIds:["chain_link"],durabilityPercent:20}),
    upgrade({id:"braided_lash",name:"Braided Lash",category:"structure",group:"structure_reinforcement",compatibleComponentIds:["lash"],durabilityPercent:20}),
    upgrade({id:"reinforced_tang",name:"Reinforced Tang",category:"structure",group:"joint_reinforcement",compatibleComponentIds:["handle","reinforced_handle"],durabilityPercent:20}),
    upgrade({id:"full_reinforcement",name:"Full Reinforcement",category:"structure",group:"structure_reinforcement",tier:"specialized",slotCost:2,compatibleComponentIds:[...BLADE,...AXE,...HAMMER,"mace_head","spear_head","polearm_head","pick_head","flail_head","chain_link","handle","reinforced_handle","shaft","long_shaft","club_body_medium","club_body_large","lash"],durabilityPercent:30}),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(UPGRADES.map((entry) => [entry.id, entry])));
  function get(id) { const entry = BY_ID[normalizeId(id)]; return entry ? clone(entry) : null; }
  function list(options = {}) {
    const category = normalizeId(options.category || "");
    return UPGRADES.filter((entry) => !category || entry.category === category).map(clone);
  }

  const API = Object.freeze({VERSION,MAX_SLOTS,MIN_UPGRADE_DURABILITY_RATIO_EXCLUSIVE,MIN_DURABILITY_FLOOR_RATIO,UPGRADES,normalizeId,get,list});
  global.LuminousWeaponUpgradeCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
