(function (global) {
  "use strict";

  if (global.LuminousEquipmentCatalogV2) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEquipmentCatalogV2;
    return;
  }

  const core = global.LuminousItemEquipmentCore || (typeof require === "function" ? require("./item-equipment-core.js") : null);
  if (!core) throw new Error("LuminousItemEquipmentCore is required before EquipmentCatalogV2.");

  const material = (id, name, tier, basePriceAhn, family, tags = [], extra = {}) => Object.freeze({
    schemaVersion: 2, id, name, category: "material", tier, economy: { basePriceAhn }, family,
    stack: { inventoryMax: 20, stashMax: 99 }, tags: ["craft_material", family, ...tags], visual: { mode: "auto", glyph: "material" }, ...extra,
  });
  const chassis = (id, name, category, tier, basePriceAhn, family, recipe, equipment = {}, tags = []) => Object.freeze({
    schemaVersion: 2, id, name, productName: name, category, subtype: `${category}_chassis`, tier, economy: { basePriceAhn }, family,
    tags: ["equipment_chassis", `${category}_chassis`, family, ...tags], visual: { mode: "auto", glyph: category }, equipment,
    crafting: { operation: "craft", ingredients: recipe },
  });
  const ing = (materialId, quantity, role = "structural") => ({ materialId, quantity, role });

  const BASIC_STRUCTURAL = Object.freeze([
    material("scrap_metal", "Scrap Metal", 1, 2000, "raw_metal", ["salvage"]), material("iron_stock", "Iron Stock", 1, 3500, "raw_metal"),
    material("steel", "Steel", 2, 10000, "raw_metal"), material("refined_steel", "Refined Steel", 3, 28000, "raw_metal"),
    material("reinforced_steel", "Reinforced Steel", 4, 75000, "raw_metal"), material("light_alloy", "Light Alloy", 3, 36000, "alloy", ["lightweight"]),
    material("reinforced_alloy", "Reinforced Alloy", 5, 180000, "alloy"), material("precision_alloy", "Precision Alloy", 6, 450000, "alloy", ["precision"]),
    material("metal_plate", "Metal Plate", 2, 12000, "structural"), material("reinforced_plate", "Reinforced Plate", 4, 85000, "structural"),
    material("composite_plate", "Composite Plate", 5, 210000, "structural", ["composite"]), material("reinforced_fabric", "Reinforced Fabric", 2, 9000, "textile"),
    material("protective_weave", "Protective Weave", 3, 32000, "textile"), material("composite_fiber", "Composite Fiber", 5, 160000, "textile", ["composite"]),
    material("shock_absorption_layer", "Shock Absorption Layer", 3, 42000, "lining", ["impact_resistant"]), material("insulated_lining", "Insulated Lining", 3, 38000, "lining", ["insulated"]),
    material("chemical_resistant_lining", "Chemical Resistant Lining", 4, 90000, "lining", ["chemical_resistant"]), material("flexible_joint_assembly", "Flexible Joint Assembly", 4, 110000, "structural", ["mobility"]),
  ]);

  const MECHANICAL_ELECTRONIC = Object.freeze([
    material("gears", "Gears", 1, 3000, "mechanical"), material("springs", "Springs", 1, 2500, "mechanical"), material("bearings", "Bearings", 2, 8000, "mechanical"),
    material("mechanical_parts", "Mechanical Parts", 2, 12000, "mechanical"), material("precision_mechanism", "Precision Mechanism", 4, 120000, "mechanical", ["precision"]),
    material("small_motor", "Small Motor", 2, 18000, "motor"), material("industrial_motor", "Industrial Motor", 3, 55000, "motor"), material("high_output_motor", "High-Output Motor", 6, 650000, "motor", ["high_output"]),
    material("wiring", "Wiring", 1, 2500, "electrical"), material("circuitry", "Circuitry", 2, 15000, "electrical"), material("control_board", "Control Board", 3, 45000, "electrical"),
    material("processor", "Processor", 4, 130000, "electronic"), material("precision_processor", "Precision Processor", 6, 600000, "electronic", ["precision"]),
    material("battery", "Battery", 1, 5000, "power"), material("power_cell", "Power Cell", 3, 60000, "power"), material("high_density_cell", "High-Density Cell", 5, 260000, "power"),
    material("pressure_cylinder", "Pressure Cylinder", 2, 22000, "pneumatic"), material("hydraulic_assembly", "Hydraulic Assembly", 4, 140000, "hydraulic"),
  ]);

  const ELEMENTAL_COMPONENTS = Object.freeze([
    material("heating_coil", "Heating Coil", 2, 18000, "elemental", ["fire", "wrath", "burn"], { elemental: { element: "fire" } }),
    material("combustion_chamber", "Combustion Chamber", 4, 135000, "elemental", ["fire", "wrath", "burn"], { elemental: { element: "fire" } }),
    material("cryogenic_fluid", "Cryogenic Fluid", 2, 24000, "elemental", ["cold", "gloom", "chill"], { elemental: { element: "cold" } }),
    material("cryogenic_chamber", "Cryogenic Chamber", 4, 145000, "elemental", ["cold", "gloom", "chill"], { elemental: { element: "cold" } }),
    material("discharge_coil", "Discharge Coil", 2, 26000, "elemental", ["lightning", "envy", "shock"], { elemental: { element: "lightning" } }),
    material("arc_core", "Arc Core", 5, 310000, "elemental", ["lightning", "envy", "shock"], { elemental: { element: "lightning" } }),
    material("corrosive_compound", "Corrosive Compound", 2, 21000, "elemental", ["acid", "gluttony", "corrosion"], { elemental: { element: "acid" } }),
    material("toxin_base", "Toxin Base", 2, 23000, "elemental", ["poison", "gluttony"], { elemental: { element: "poison" } }),
    material("decay_reagent", "Decay Reagent", 3, 78000, "elemental", ["necrotic", "gloom", "decay"], { elemental: { element: "necrotic" } }),
    material("radiance_emitter", "Radiance Emitter", 4, 170000, "elemental", ["radiant", "pride", "radiance"], { elemental: { element: "radiant" } }),
    material("psychoactive_medium", "Psychoactive Medium", 3, 85000, "elemental", ["psychic", "lust", "sinking"], { elemental: { element: "psychic" } }),
    material("mental_resonator", "Mental Resonator", 5, 360000, "elemental", ["psychic", "lust", "sinking"], { elemental: { element: "psychic" } }),
    material("oscillator", "Oscillator", 2, 20000, "elemental", ["thunder", "wrath", "tremor"], { elemental: { element: "thunder" } }),
    material("resonance_chamber", "Resonance Chamber", 5, 280000, "elemental", ["thunder", "wrath", "tremor"], { elemental: { element: "thunder" } }),
    material("impulse_driver", "Impulse Driver", 3, 72000, "elemental", ["force", "sloth"], { elemental: { element: "force" } }),
    material("compression_core", "Compression Core", 5, 330000, "elemental", ["force", "sloth"], { elemental: { element: "force" } }),
  ]);

  const SPECIALIZED_COMPONENTS = Object.freeze([
    material("precision_components", "Precision Components", 4, 125000, "precision", ["specialized"]), material("calibrator", "Calibrator", 3, 52000, "precision", ["tool_component"]),
    material("connector_assembly", "Connector Assembly", 2, 18000, "interface", ["module_interface"]), material("control_interface", "Control Interface", 4, 115000, "interface", ["module_interface"]),
    material("proprietary_component", "Proprietary Component", 7, 1800000, "proprietary", ["restricted"]), material("experimental_component", "Experimental Component", 9, 12000000, "experimental", ["restricted", "prototype"]),
    material("aurelion_calibrated_resonator", "Aurelion Workshop Calibrated Resonator", 6, 720000, "proprietary", ["aurelion_workshop", "tremor", "signature"]),
    material("luan_pressure_regulator", "Luan Workshop Pressure Regulator", 6, 760000, "proprietary", ["luan_workshop", "direct_damage", "signature"]),
  ]);

  const WEAPON_CHASSIS = Object.freeze([
    chassis("knife_chassis", "Knife", "weapon", 1, 45000, "blade", [ing("steel",1),ing("reinforced_fabric",1,"filler")], {handCost:1,damageProfile:"slash"}, ["light_weapon","slash"]),
    chassis("short_blade_chassis", "Short Blade", "weapon", 2, 90000, "blade", [ing("steel",2),ing("reinforced_fabric",1,"filler")], {handCost:1,damageProfile:"slash"}, ["slash"]),
    chassis("long_blade_chassis", "Long Blade", "weapon", 2, 150000, "blade", [ing("refined_steel",2),ing("reinforced_fabric",1,"filler")], {handCost:1,damageProfile:"slash"}, ["slash"]),
    chassis("great_blade_chassis", "Great Blade", "weapon", 3, 290000, "blade", [ing("refined_steel",4),ing("reinforced_alloy",1,"core")], {handCost:2,damageProfile:"slash"}, ["heavy_weapon","slash"]),
    chassis("axe_chassis", "Axe", "weapon", 2, 130000, "axe", [ing("steel",2),ing("iron_stock",1)], {handCost:1,damageProfile:"slash"}, ["slash"]),
    chassis("heavy_axe_chassis", "Heavy Axe", "weapon", 3, 310000, "axe", [ing("refined_steel",3),ing("reinforced_steel",1,"core")], {handCost:2,damageProfile:"slash"}, ["heavy_weapon","slash"]),
    chassis("hammer_chassis", "Hammer", "weapon", 2, 120000, "hammer", [ing("steel",2),ing("iron_stock",1)], {handCost:1,damageProfile:"blunt"}, ["blunt"]),
    chassis("heavy_hammer_chassis", "Heavy Hammer", "weapon", 3, 330000, "hammer", [ing("refined_steel",3),ing("reinforced_steel",1,"core")], {handCost:2,damageProfile:"blunt"}, ["heavy_weapon","blunt","industrial"]),
    chassis("spear_chassis", "Spear", "weapon", 2, 125000, "polearm", [ing("steel",2),ing("iron_stock",1)], {handCost:2,damageProfile:"pierce"}, ["pierce","reach"]),
    chassis("polearm_chassis", "Polearm", "weapon", 3, 230000, "polearm", [ing("refined_steel",3),ing("reinforced_fabric",1,"filler")], {handCost:2,damageProfile:"pierce"}, ["pierce","reach"]),
    chassis("gauntlet_chassis", "Combat Gauntlet", "weapon", 2, 140000, "gauntlet", [ing("steel",2),ing("springs",2,"precision")], {handCost:1,damageProfile:"blunt"}, ["blunt","unarmed"]),
    chassis("pistol_chassis", "Pistol", "weapon", 3, 390000, "firearm", [ing("refined_steel",2),ing("precision_mechanism",1,"core"),ing("springs",2,"precision")], {handCost:1,damageProfile:"pierce",firearm:true}, ["pierce","firearm"]),
    chassis("revolver_chassis", "Revolver", "weapon", 3, 420000, "firearm", [ing("refined_steel",2),ing("precision_mechanism",1,"core"),ing("bearings",1,"precision")], {handCost:1,damageProfile:"pierce",firearm:true}, ["pierce","firearm"]),
    chassis("shotgun_chassis", "Shotgun", "weapon", 4, 760000, "firearm", [ing("reinforced_steel",2),ing("precision_mechanism",1,"core"),ing("mechanical_parts",2)], {handCost:2,damageProfile:"pierce",firearm:true}, ["pierce","firearm","heavy_weapon"]),
    chassis("rifle_chassis", "Rifle", "weapon", 4, 820000, "firearm", [ing("reinforced_steel",2),ing("precision_mechanism",2,"core"),ing("precision_components",1,"precision")], {handCost:2,damageProfile:"pierce",firearm:true}, ["pierce","firearm","precision"]),
    chassis("launcher_chassis", "Launcher", "weapon", 4, 900000, "launcher", [ing("reinforced_steel",2),ing("pressure_cylinder",2,"core"),ing("control_board",1,"precision")], {handCost:2,damageProfile:"blunt"}, ["ranged","heavy_weapon"]),
    chassis("staff_chassis", "Staff", "weapon", 2, 110000, "staff", [ing("steel",1),ing("iron_stock",2)], {handCost:2,damageProfile:"blunt"}, ["blunt","reach"]),
    chassis("flexible_weapon_chassis", "Flexible Weapon", "weapon", 3, 240000, "flexible", [ing("refined_steel",2),ing("bearings",2,"precision"),ing("reinforced_fabric",1)], {handCost:1,damageProfile:"slash"}, ["slash","flexible"]),
    chassis("industrial_weapon_chassis", "Industrial Weapon", "weapon", 3, 350000, "industrial", [ing("reinforced_steel",2),ing("industrial_motor",1,"core"),ing("mechanical_parts",2)], {handCost:2,damageProfile:"blunt"}, ["industrial","heavy_weapon"]),
    chassis("special_weapon_frame", "Special Weapon Frame", "weapon", 5, 1500000, "special", [ing("reinforced_alloy",2),ing("precision_components",2,"precision"),ing("control_interface",1,"core")], {handCost:2,damageProfile:"hybrid"}, ["special","modular"]),
  ]);

  const ARMOR_CHASSIS = Object.freeze([
    chassis("clothing_chassis","Protective Clothing","armor",1,60000,"clothing",[ing("reinforced_fabric",2)],{},["light_armor"]),
    chassis("reinforced_clothing_chassis","Reinforced Clothing","armor",2,130000,"clothing",[ing("protective_weave",2),ing("light_alloy",1)],{},["light_armor"]),
    chassis("combat_coat_chassis","Combat Coat","armor",3,280000,"coat",[ing("protective_weave",3),ing("light_alloy",2)],{},["light_armor","coat"]),
    chassis("protective_coat_chassis","Protective Coat","armor",3,330000,"coat",[ing("protective_weave",2),ing("shock_absorption_layer",2),ing("light_alloy",1)],{},["light_armor","coat"]),
    chassis("light_armor_chassis","Light Armor","armor",3,410000,"light_armor",[ing("light_alloy",3),ing("protective_weave",2)],{},["light_armor"]),
    chassis("medium_armor_chassis","Medium Armor","armor",4,760000,"medium_armor",[ing("reinforced_plate",2),ing("protective_weave",2),ing("flexible_joint_assembly",1,"precision")],{},["medium_armor"]),
    chassis("heavy_armor_chassis","Heavy Armor","armor",5,1450000,"heavy_armor",[ing("composite_plate",3),ing("reinforced_alloy",2),ing("shock_absorption_layer",2)],{},["heavy_armor"]),
    chassis("security_armor_chassis","Security Armor","armor",4,920000,"security",[ing("reinforced_plate",3),ing("shock_absorption_layer",2),ing("control_board",1,"precision")],{},["medium_armor","security"]),
    chassis("hazard_suit_chassis","Hazard Suit","armor",4,880000,"hazard",[ing("chemical_resistant_lining",2),ing("insulated_lining",2),ing("protective_weave",2)],{},["light_armor","hazard"]),
    chassis("powered_armor_chassis","Powered Armor","armor",6,3900000,"powered",[ing("reinforced_alloy",3),ing("high_output_motor",1,"core"),ing("precision_processor",1,"precision"),ing("high_density_cell",2,"core")],{},["heavy_armor","powered","modular"]),
  ]);

  const ACCESSORY_CHASSIS = Object.freeze([
    chassis("visor_chassis","Tactical Visor","accessory",2,95000,"sensor",[ing("circuitry",1),ing("reinforced_fabric",1),ing("battery",1,"filler")],{accessoryType:"head",slotCost:1},["sensor"]),
    chassis("goggles_chassis","Protective Goggles","accessory",1,38000,"sensor",[ing("reinforced_fabric",1),ing("light_alloy",1)],{accessoryType:"eye",slotCost:1},["sensor"]),
    chassis("mask_chassis","Protective Mask","accessory",2,72000,"protection",[ing("reinforced_fabric",1),ing("chemical_resistant_lining",1)],{accessoryType:"head",slotCost:1},["protection"]),
    chassis("headset_chassis","Communication Headset","accessory",2,110000,"communication",[ing("circuitry",1),ing("wiring",1),ing("battery",1)],{accessoryType:"head",slotCost:1},["communication"]),
    chassis("neck_device_chassis","Neck Device","accessory",3,210000,"device",[ing("control_board",1),ing("power_cell",1),ing("connector_assembly",1)],{accessoryType:"head",slotCost:1},["device","modular"]),
    chassis("arm_device_chassis","Arm Device","accessory",3,230000,"device",[ing("control_board",1),ing("light_alloy",1),ing("power_cell",1)],{accessoryType:"arm",slotCost:1},["device","modular"]),
    chassis("gloves_chassis","Tactical Gloves","accessory",2,90000,"utility",[ing("reinforced_fabric",2),ing("light_alloy",1)],{accessoryType:"hand",slotCost:1},["utility"]),
    chassis("utility_belt_chassis","Utility Belt","accessory",1,55000,"utility",[ing("reinforced_fabric",2),ing("connector_assembly",1)],{accessoryType:"torso",slotCost:1},["utility","storage"]),
    chassis("boots_chassis","Reinforced Boots","accessory",2,125000,"mobility",[ing("reinforced_fabric",2),ing("shock_absorption_layer",1),ing("light_alloy",1)],{accessoryType:"foot",slotCost:1},["mobility"]),
    chassis("portable_device_chassis","Portable Device","accessory",3,260000,"device",[ing("processor",1),ing("power_cell",1),ing("control_interface",1)],{accessoryType:"legacy_accessory",slotCost:1},["device","modular"]),
  ]);

  const MATERIALS = Object.freeze([...BASIC_STRUCTURAL,...MECHANICAL_ELECTRONIC,...ELEMENTAL_COMPONENTS,...SPECIALIZED_COMPONENTS]);
  const CHASSIS = Object.freeze([...WEAPON_CHASSIS,...ARMOR_CHASSIS,...ACCESSORY_CHASSIS]);
  const ITEMS = Object.freeze([...MATERIALS,...CHASSIS]);
  const byId = Object.freeze(Object.fromEntries(ITEMS.map((entry)=>[entry.id,entry])));
  const normalizedItems = Object.freeze(ITEMS.map((entry)=>core.normalizeDefinition(entry)));
  const WORKSHOPS = Object.freeze({
    aurelion_workshop:Object.freeze({id:"aurelion_workshop",name:"Aurelion Workshop",craftSpecialty:"vibration_engineering",combatDoctrine:"tremor",preferredFamilies:["tremor","thunder","blunt","mechanical"],preferredChassis:["hammer","axe","gauntlet","industrial"],signatureMaterialIds:["aurelion_calibrated_resonator"]}),
    luan_workshop:Object.freeze({id:"luan_workshop",name:"Luan Workshop",craftSpecialty:"high_output_engineering",combatDoctrine:"direct_damage",preferredFamilies:["direct_damage","slash","pierce","blunt"],preferredChassis:["blade","axe","hammer","polearm"],signatureMaterialIds:["luan_pressure_regulator"]}),
  });
  const api=Object.freeze({BASIC_STRUCTURAL,MECHANICAL_ELECTRONIC,ELEMENTAL_COMPONENTS,SPECIALIZED_COMPONENTS,MATERIALS,WEAPON_CHASSIS,ARMOR_CHASSIS,ACCESSORY_CHASSIS,CHASSIS,ITEMS,normalizedItems,byId,WORKSHOPS,counts:Object.freeze({basicStructural:BASIC_STRUCTURAL.length,mechanicalElectronic:MECHANICAL_ELECTRONIC.length,elementalComponents:ELEMENTAL_COMPONENTS.length,specializedComponents:SPECIALIZED_COMPONENTS.length,materials:MATERIALS.length,weaponChassis:WEAPON_CHASSIS.length,armorChassis:ARMOR_CHASSIS.length,accessoryChassis:ACCESSORY_CHASSIS.length,chassis:CHASSIS.length,items:ITEMS.length})});
  global.LuminousEquipmentCatalogV2=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
