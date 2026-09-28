(function (global) {
  "use strict";
  if (global.LuminousChemistryRecipeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousChemistryRecipeCatalog;
    return;
  }

  const VERSION=1;
  function normalizeId(value){return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function recipe(id,label,outputIconFamily,semanticCheck,requiredToolType,baseThreshold,multiplier,inputRequirements,tags=[],consumerHooks=[],integrationStatus="prepared"){
    return Object.freeze({
      id,label,outputIconFamily,
      semanticCheck:normalizeId(semanticCheck),requiredToolType:normalizeId(requiredToolType),
      baseThreshold,complexity:baseThreshold>=28?"corp":baseThreshold>=22?"workshop":"generic",
      craftBaseMultiplier:multiplier,
      inputRequirements:Object.freeze(inputRequirements.map((v)=>Object.freeze({...v}))),
      tags:Object.freeze(tags.map(normalizeId)),
      consumerHooks:Object.freeze(consumerHooks.map(normalizeId)),
      integrationStatus:normalizeId(integrationStatus),
      runtimeEffectImplemented:false,
    });
  }

  const RECIPES=Object.freeze({
    industrial_cleaner:recipe("industrial_cleaner","Industrial Cleaner","industrial_cleaner","chemical_processing","chemical_tools",18,1.15,[
      {quantity:1,anyIds:["cleaning_compound"]},{quantity:1,anyTags:["container","chemical_resistant_container"]}
    ],["chemical_product","cleaning_supply","maintenance_input"],["maintenance","craft_components"],"active_component"),

    industrial_sealant:recipe("industrial_sealant","Industrial Sealant","industrial_sealant","chemical_processing","chemical_tools",18,1.20,[
      {quantity:1,anyIds:["sealant_compound"]},{quantity:1,anyTags:["container","chemical_resistant_container"]}
    ],["chemical_product","sealant","binder","construction_input","repair_input"],["craft_components","construction","armor"],"active_component"),

    industrial_lubricant_pack:recipe("industrial_lubricant_pack","Industrial Lubricant Pack","industrial_lubricant_pack","chemical_processing","chemical_tools",18,1.20,[
      {quantity:1,anyIds:["lubricant_compound"]},{quantity:1,anyTags:["container","chemical_resistant_container"]}
    ],["chemical_product","lubricant","maintenance_input","mechanical_service_input"],["maintenance","mechanical_crafting","augments"],"prepared"),

    industrial_coating:recipe("industrial_coating","Industrial Coating","industrial_coating","chemical_processing","chemical_tools",22,1.30,[
      {quantity:1,anyIds:["polymer_compound","sealant_compound"]},{quantity:1,anyIds:["pigment_compound","stabilized_compound"]}
    ],["chemical_product","coating","corrosion_protection_input","armor_upgrade_input","construction_input"],["armor","construction"],"active_component"),

    repair_adhesive:recipe("repair_adhesive","Repair Adhesive","repair_adhesive","chemical_processing","chemical_tools",18,1.20,[
      {quantity:1,anyIds:["adhesive_compound"]},{quantity:1,anyTags:["container","chemical_resistant_container"]}
    ],["chemical_product","adhesive","repair_input","construction_input"],["craft_components","maintenance","construction"],"active_component"),

    chemical_cartridge:recipe("chemical_cartridge","Chemical Cartridge","chemical_cartridge","fabrication","fabrication_tools",22,1.25,[
      {quantity:1,anyTags:["chemical_resistant_container","container"]},{quantity:1,anyIds:["sealant_compound","polymer_compound"]}
    ],["chemical_product","chemical_cartridge","payload_container","device_input"],["augments","devices","throwables"],"prepared"),

    chemical_canister:recipe("chemical_canister","Chemical Canister","chemical_canister","fabrication","fabrication_tools",22,1.25,[
      {quantity:1,anyTags:["chemical_resistant_container","container"]},{quantity:1,anyIds:["sealant_compound"]}
    ],["chemical_product","chemical_canister","payload_container","hazard_container"],["environmental","throwables","infrastructure"],"prepared"),

    reactive_canister:recipe("reactive_canister","Reactive Canister","reactive_canister","chemical_processing","chemical_tools",22,1.35,[
      {quantity:1,anyIds:["reactive_compound"]},{quantity:1,anyIds:["chemical_canister","chemical_cartridge"]}
    ],["chemical_product","reactive_payload","payload_container"],["throwables","advanced_crafting"],"prepared"),

    corrosive_canister:recipe("corrosive_canister","Corrosive Canister","corrosive_canister","chemical_processing","chemical_tools",22,1.35,[
      {quantity:1,anyIds:["corrosive_solution"]},{quantity:1,anyIds:["chemical_canister","chemical_cartridge"]}
    ],["chemical_product","corrosive_payload","payload_container"],["throwables","industrial_processing"],"prepared"),

    maintenance_kit:recipe("maintenance_kit","Maintenance Kit","maintenance_kit","fabrication","fabrication_tools",18,1.15,[
      {quantity:1,anyIds:["industrial_cleaner"]},{quantity:1,anyIds:["industrial_lubricant_pack"]},{quantity:1,anyIds:["repair_adhesive"]}
    ],["chemical_product","maintenance_kit","maintenance_input"],["maintenance","repair"],"prepared"),

    water_purifier:recipe("water_purifier","Water Purifier","water_purifier","fabrication","fabrication_tools",22,1.30,[
      {quantity:1,anyIds:["treatment_solution"]},{quantity:1,anyIds:["filter_cartridge"]},{quantity:1,anyTags:["housing","container","structural_component"]}
    ],["environmental_product","water_purification","infrastructure_input","survival_supply"],["survival","infrastructure","environmental"],"prepared"),

    filter_cartridge:recipe("filter_cartridge","Filter Cartridge","filter_cartridge","fabrication","fabrication_tools",18,1.20,[
      {quantity:1,anyTags:["environmental_filter_media","filter_media"]},{quantity:1,anyIds:["polymer_compound","sealant_compound"]}
    ],["environmental_product","filter_cartridge","filter_component","infrastructure_input"],["environmental","infrastructure","hazard_control"],"prepared"),

    spill_absorbent_kit:recipe("spill_absorbent_kit","Spill Absorbent Kit","spill_absorbent_kit","fabrication","fabrication_tools",18,1.15,[
      {quantity:2,anyTags:["environmental_absorbent","absorbent"]},{quantity:1,anyIds:["hazard_bag"]}
    ],["environmental_product","spill_control","hazard_countermeasure"],["environmental","hazard_control","maintenance"],"prepared"),

    decontamination_spray:recipe("decontamination_spray","Decontamination Spray","decontamination_spray","chemical_processing","chemical_tools",22,1.25,[
      {quantity:1,anyIds:["decontamination_solution"]},{quantity:1,anyIds:["chemical_canister","chemical_cartridge"]}
    ],["environmental_product","decontamination","hazard_countermeasure"],["environmental","hazard_control"],"prepared"),

    neutralizer_spray:recipe("neutralizer_spray","Neutralizer Spray","neutralizer_spray","chemical_processing","chemical_tools",18,1.20,[
      {quantity:1,anyIds:["neutralizing_solution"]},{quantity:1,anyIds:["chemical_canister","chemical_cartridge"]}
    ],["environmental_product","neutralizer","hazard_countermeasure"],["environmental","hazard_control"],"prepared"),

    containment_foam:recipe("containment_foam","Containment Foam","containment_foam","chemical_processing","chemical_tools",22,1.30,[
      {quantity:1,anyIds:["polymer_compound"]},{quantity:1,anyIds:["neutralizing_solution","decontamination_solution"]},{quantity:1,anyIds:["chemical_canister"]}
    ],["environmental_product","containment","spill_control","hazard_countermeasure"],["environmental","hazard_control","infrastructure"],"prepared"),

    hazard_bag:recipe("hazard_bag","Hazard Bag","hazard_bag","fabrication","fabrication_tools",18,1.15,[
      {quantity:1,anyIds:["polymer_compound"]},{quantity:1,anyIds:["sealant_compound"]}
    ],["environmental_product","hazard_container","containment","waste_handling"],["environmental","hazard_control","infrastructure"],"prepared"),

    environmental_kit:recipe("environmental_kit","Environmental Kit","environmental_kit","fabrication","fabrication_tools",18,1.10,[
      {quantity:1,anyIds:["spill_absorbent_kit"]},{quantity:1,anyIds:["decontamination_spray"]},{quantity:1,anyIds:["neutralizer_spray"]},{quantity:1,anyIds:["filter_cartridge"]}
    ],["environmental_product","environmental_kit","hazard_countermeasure"],["environmental","hazard_control","infrastructure"],"prepared")
  });

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function get(id){const row=RECIPES[normalizeId(id)];return row?clone(row):null;}
  function list(options={}){
    const hook=normalizeId(options.consumerHook),status=normalizeId(options.integrationStatus),tag=normalizeId(options.tag);
    return Object.values(RECIPES)
      .filter((r)=>!hook||r.consumerHooks.includes(hook))
      .filter((r)=>!status||r.integrationStatus===status)
      .filter((r)=>!tag||r.tags.includes(tag))
      .map(clone);
  }
  function validateCatalog(){
    const errors=[];
    for(const r of Object.values(RECIPES)){
      if(![18,22,28].includes(r.baseThreshold)) errors.push({id:r.id,error:"invalid_threshold"});
      if(!r.inputRequirements.length) errors.push({id:r.id,error:"missing_inputs"});
      if(!["active_component","prepared"].includes(r.integrationStatus)) errors.push({id:r.id,error:"invalid_integration_status"});
      if(r.runtimeEffectImplemented!==false) errors.push({id:r.id,error:"runtime_effect_must_remain_deferred"});
    }
    return {valid:errors.length===0,errors,count:Object.keys(RECIPES).length};
  }

  const API=Object.freeze({VERSION,RECIPES,get,list,validateCatalog});
  global.LuminousChemistryRecipeCatalog=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
