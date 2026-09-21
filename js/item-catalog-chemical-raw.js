(function (global) {
  "use strict";
  if (global.LuminousChemicalRawCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousChemicalRawCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "chemical_raw";
  const DEFAULT_QUALITY = "standard";

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function freezeTags(values) {
    return Object.freeze([...new Set((values || []).map(normalizeId).filter(Boolean))]);
  }
  function item(id, name, iconFamily, standardUnitValueAhn, tags = [], consumerHooks = []) {
    return Object.freeze({
      id, name, family:FAMILY, iconFamily,
      category:"material", itemType:"ingredient",
      baseQuality:DEFAULT_QUALITY, qualitySystem:"universal",
      stackable:true, rawCraftingReagent:true,
      standardUnitValueAhn:Math.max(0,Math.round(Number(standardUnitValueAhn)||0)),
      productionValueAhn:Math.max(0,Math.round(Number(standardUnitValueAhn)||0)),
      tags:freezeTags(["ingredient","chemical_raw","chemical_reagent",...tags]),
      reagentTags:freezeTags(tags),
      consumerHooks:freezeTags(consumerHooks),
    });
  }

  const ITEMS = Object.freeze([
    item("general_industrial_solvent","General Industrial Solvent","industrial_solvent",2200,
      ["industrial_solvent","solvent","cleaning_input","liquid_carrier"],["chemical_processing","maintenance"]),
    item("precision_cleaning_solvent","Precision Cleaning Solvent","industrial_solvent",3200,
      ["industrial_solvent","solvent","precision_cleaning_input"],["chemical_processing","electronics","maintenance"]),

    item("machine_lubricant_feedstock","Machine Lubricant Feedstock","industrial_lubricant",2600,
      ["industrial_lubricant","lubricant_input","mechanical_service_input"],["maintenance","mechanical_crafting"]),
    item("precision_lubricant_feedstock","Precision Lubricant Feedstock","industrial_lubricant",3800,
      ["industrial_lubricant","lubricant_input","precision_service_input"],["maintenance","augments","precision_components"]),

    item("structural_resin_feedstock","Structural Resin Feedstock","industrial_resin",2800,
      ["industrial_resin","resin","binder","sealant_input"],["chemical_processing","construction","armor"]),
    item("flexible_resin_feedstock","Flexible Resin Feedstock","industrial_resin",3200,
      ["industrial_resin","resin","flexible_binder","polymer_input"],["chemical_processing","armor","augments"]),

    item("rigid_polymer_feedstock","Rigid Polymer Feedstock","industrial_polymer",3400,
      ["industrial_polymer","polymer_feedstock","structural_material"],["chemical_processing","construction","electronics"]),
    item("flexible_polymer_feedstock","Flexible Polymer Feedstock","industrial_polymer",3600,
      ["industrial_polymer","polymer_feedstock","flexible","insulator"],["chemical_processing","electronics","augments"]),

    item("general_bonding_agent","General Bonding Agent","industrial_adhesive",2400,
      ["industrial_adhesive","adhesive","binder","repair_input"],["chemical_processing","maintenance","construction"]),
    item("structural_bonding_agent","Structural Bonding Agent","industrial_adhesive",3600,
      ["industrial_adhesive","adhesive","binder","structural_repair_input"],["maintenance","armor","construction"]),

    item("industrial_pigment_base","Industrial Pigment Base","industrial_pigment",1800,
      ["industrial_pigment","pigment_source","coating_input"],["chemical_processing","coatings"]),
    item("marking_pigment_base","Marking Pigment Base","industrial_pigment",2100,
      ["industrial_pigment","pigment_source","marking_supply"],["chemical_processing","marking","throwables"]),

    item("general_process_catalyst","General Process Catalyst","chemical_catalyst",4200,
      ["chemical_catalyst","catalyst","process_catalyst"],["chemical_processing"]),
    item("advanced_process_catalyst","Advanced Process Catalyst","chemical_catalyst",7200,
      ["chemical_catalyst","catalyst","advanced_material","advanced_catalyst"],["chemical_processing","augments","corp_crafting"]),

    item("general_chemical_stabilizer","General Chemical Stabilizer","chemical_stabilizer",3800,
      ["chemical_stabilizer","stabilizer","stabilizer_reagent"],["chemical_processing","medicine"]),
    item("reactive_stabilizer","Reactive Stabilizer","chemical_stabilizer",5600,
      ["chemical_stabilizer","stabilizer","reactive_stabilizer","advanced_material"],["chemical_processing","augments","throwables"]),

    item("reactive_reagent","Reactive Reagent","chemical_reactive",4600,
      ["chemical_reactive","reactive_reagent","unstable_reagent","payload_input"],["chemical_processing","throwables"]),
    item("high_energy_reagent","High-Energy Reagent","chemical_reactive",7600,
      ["chemical_reactive","reactive_reagent","unstable_reagent","advanced_material","payload_input"],["chemical_processing","advanced_crafting","throwables"]),

    item("corrosive_reagent","Corrosive Reagent","chemical_corrosive",4100,
      ["chemical_corrosive","corrosive_reagent","etchant","coating_input"],["chemical_processing","armor","industrial_processing"]),
    item("precision_etching_reagent","Precision Etching Reagent","chemical_corrosive",5200,
      ["chemical_corrosive","corrosive_reagent","etchant","precision_processing_input"],["chemical_processing","electronics","precision_components"]),

    item("conductive_paste_feedstock","Conductive Paste Feedstock","chemical_conductive",4400,
      ["chemical_conductive","conductive_material","conductor","electrical_input"],["electronics","augments","chemical_processing"]),
    item("conductive_fluid_feedstock","Conductive Fluid Feedstock","chemical_conductive",4800,
      ["chemical_conductive","conductive_material","conductor","sensor_input"],["electronics","sensors","augments"]),

    item("insulating_resin_feedstock","Insulating Resin Feedstock","chemical_insulator",4200,
      ["chemical_insulator","insulator","dielectric_material","polymer_input"],["electronics","augments","armor"]),
    item("dielectric_feedstock","Dielectric Feedstock","chemical_insulator",5100,
      ["chemical_insulator","insulator","dielectric_material","advanced_material"],["electronics","augments","precision_components"]),

    item("mineral_absorbent","Mineral Absorbent","environmental_absorbent",2200,
      ["environmental_absorbent","absorbent","spill_control_input"],["environmental","maintenance"]),
    item("polymer_absorbent","Polymer Absorbent","environmental_absorbent",3300,
      ["environmental_absorbent","absorbent","spill_control_input","polymer_input"],["environmental","containment"]),

    item("general_neutralizing_reagent","General Neutralizing Reagent","environmental_neutralizer",3000,
      ["environmental_neutralizer","neutralizer","decontamination_input"],["environmental","chemical_processing"]),
    item("hazard_neutralizing_reagent","Hazard Neutralizing Reagent","environmental_neutralizer",4700,
      ["environmental_neutralizer","neutralizer","hazard_treatment_input"],["environmental","hazard_control"]),

    item("particulate_filter_media","Particulate Filter Media","environmental_filter_media",2600,
      ["environmental_filter_media","filter_media","particulate_filter"],["environmental","infrastructure"]),
    item("chemical_filter_media","Chemical Filter Media","environmental_filter_media",4300,
      ["environmental_filter_media","filter_media","chemical_filter"],["environmental","infrastructure","hazard_control"]),

    item("clarifying_reagent","Water Clarifying Reagent","water_treatment_reagent",2400,
      ["water_treatment_reagent","water_treatment","clarifying_agent"],["survival","infrastructure","environmental"]),
    item("purification_reagent","Water Purification Reagent","water_treatment_reagent",3900,
      ["water_treatment_reagent","water_treatment","purification_agent"],["survival","infrastructure","environmental"])
  ]);

  const BY_ID=Object.freeze(Object.fromEntries(ITEMS.map((entry)=>[entry.id,entry])));
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function get(id){const entry=BY_ID[normalizeId(id)];return entry?clone(entry):null;}
  function list(options={}){
    const tag=normalizeId(options.tag||options.reagentTag);
    const iconFamily=normalizeId(options.iconFamily);
    const hook=normalizeId(options.consumerHook);
    return ITEMS
      .filter((entry)=>!tag||entry.tags.includes(tag)||entry.reagentTags.includes(tag))
      .filter((entry)=>!iconFamily||entry.iconFamily===iconFamily)
      .filter((entry)=>!hook||entry.consumerHooks.includes(hook))
      .map(clone);
  }
  function validateCatalog(){
    const errors=[]; const ids=new Set();
    for(const entry of ITEMS){
      if(!entry.id||ids.has(entry.id)) errors.push({id:entry.id,error:"duplicate_or_missing_id"});
      if(!(entry.standardUnitValueAhn>0)) errors.push({id:entry.id,error:"invalid_value"});
      if(!entry.tags.includes("chemical_reagent")) errors.push({id:entry.id,error:"missing_chemical_reagent_tag"});
      ids.add(entry.id);
    }
    return {valid:errors.length===0,errors,count:ITEMS.length};
  }

  const API=Object.freeze({VERSION,FAMILY,DEFAULT_QUALITY,ITEMS,get,list,validateCatalog});
  global.LuminousChemicalRawCatalog=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
