(function (global) {
  "use strict";
  if (global.LuminousChemicalProcessedCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousChemicalProcessedCatalog;
    return;
  }

  const VERSION=1;
  const FAMILY="chemical_processed";
  const DEFAULT_QUALITY="standard";
  const IMPROVISED_THRESHOLD_PENALTY=3;

  function normalizeId(value){return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function freeze(values){return Object.freeze((values||[]).map((v)=>typeof v==="object"?Object.freeze({...v}):v));}
  function process(id,label,iconFamily,baseThreshold,multiplier,inputRequirements,outputTags,consumerHooks){
    return Object.freeze({
      id,label,outputId:id,iconFamily,
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",
      baseThreshold,complexity:baseThreshold>=28?"corp":baseThreshold>=22?"workshop":"generic",
      craftBaseMultiplier:multiplier,improvisedThresholdDelta:IMPROVISED_THRESHOLD_PENALTY,
      inputRequirements:freeze(inputRequirements),
      outputTags:Object.freeze((outputTags||[]).map(normalizeId)),
      consumerHooks:Object.freeze((consumerHooks||[]).map(normalizeId)),
    });
  }

  const PROCESSES=Object.freeze({
    cleaning_compound:process("cleaning_compound","Cleaning Compound","cleaning_compound",18,1.20,[
      {quantity:1,anyTags:["industrial_solvent","solvent","cleaning_input"]},
      {quantity:1,anyTags:["environmental_absorbent","absorbent","stabilizer"]}
    ],["chemical_component","cleaning_compound","maintenance_input","cleaning_input"],["maintenance","craft_components"]),
    sealant_compound:process("sealant_compound","Sealant Compound","sealant_compound",22,1.35,[
      {quantity:1,anyTags:["industrial_resin","resin"]},
      {quantity:1,anyTags:["industrial_polymer","polymer_feedstock"]},
      {quantity:1,anyTags:["chemical_stabilizer","stabilizer"]}
    ],["chemical_component","sealant","binder","construction_input","repair_input"],["craft_components","construction","armor"]),
    lubricant_compound:process("lubricant_compound","Lubricant Compound","lubricant_compound",18,1.25,[
      {quantity:1,anyTags:["industrial_lubricant","lubricant_input"]},
      {quantity:1,anyTags:["chemical_stabilizer","stabilizer"]}
    ],["chemical_component","lubricant","maintenance_input","mechanical_service_input"],["maintenance","mechanical_crafting","augments"]),
    polymer_compound:process("polymer_compound","Polymer Compound","polymer_compound",22,1.35,[
      {quantity:1,anyTags:["industrial_polymer","polymer_feedstock"]},
      {quantity:1,anyTags:["chemical_catalyst","catalyst"]}
    ],["chemical_component","polymer","structural_material","advanced_material","augment_material"],["craft_components","electronics","augments","construction"]),
    adhesive_compound:process("adhesive_compound","Adhesive Compound","adhesive_compound",18,1.25,[
      {quantity:1,anyTags:["industrial_adhesive","adhesive"]},
      {quantity:1,anyTags:["industrial_resin","resin","binder"]},
      {quantity:1,anyTags:["chemical_stabilizer","stabilizer"]}
    ],["chemical_component","adhesive","binder","repair_input","construction_input"],["craft_components","maintenance","construction"]),
    pigment_compound:process("pigment_compound","Pigment Compound","pigment_compound",18,1.20,[
      {quantity:1,anyTags:["industrial_pigment","pigment_source","ink"]},
      {quantity:1,anyTags:["industrial_solvent","solvent","liquid_carrier"]}
    ],["chemical_component","pigment","marking_supply","coating_input"],["craft_components","marking","coatings"]),
    reactive_compound:process("reactive_compound","Reactive Compound","reactive_compound",22,1.45,[
      {quantity:1,anyTags:["chemical_reactive","reactive_reagent","unstable_reagent"]},
      {quantity:1,anyTags:["chemical_catalyst","catalyst"]},
      {quantity:1,anyTags:["chemical_stabilizer","reactive_stabilizer","stabilizer"]}
    ],["chemical_component","reactive_compound","payload_input","advanced_material"],["advanced_crafting","throwables"]),
    corrosive_solution:process("corrosive_solution","Corrosive Solution","corrosive_solution",22,1.40,[
      {quantity:1,anyTags:["chemical_corrosive","corrosive_reagent","acid_secretion","etchant"]},
      {quantity:1,anyTags:["industrial_solvent","solvent","liquid_carrier"]},
      {quantity:1,anyTags:["chemical_stabilizer","stabilizer"]}
    ],["chemical_component","corrosive_solution","etchant","coating_input"],["armor","industrial_processing","throwables"]),
    neutralizing_solution:process("neutralizing_solution","Neutralizing Solution","neutralizing_solution",18,1.25,[
      {quantity:1,anyTags:["environmental_neutralizer","neutralizer"]},
      {quantity:1,anyTags:["industrial_solvent","solvent","liquid_carrier"]}
    ],["chemical_component","neutralizing_solution","environmental_treatment","hazard_countermeasure"],["environmental","maintenance"]),
    decontamination_solution:process("decontamination_solution","Decontamination Solution","decontamination_solution",22,1.35,[
      {quantity:1,anyTags:["industrial_solvent","solvent","cleaning_input"]},
      {quantity:1,anyTags:["environmental_neutralizer","neutralizer","decontamination_input"]},
      {quantity:1,anyTags:["environmental_absorbent","filter_media","absorbent"]}
    ],["chemical_component","decontamination_solution","environmental_treatment","hazard_countermeasure"],["environmental","hazard_control"]),
    stabilized_compound:process("stabilized_compound","Stabilized Compound","stabilized_compound",22,1.45,[
      {quantity:1,anyTags:["chemical_reactive","unstable_reagent","bio_reagent","exotic_reagent"]},
      {quantity:1,anyTags:["chemical_stabilizer","stabilizer","reactive_stabilizer"]}
    ],["chemical_component","stabilized_compound","advanced_material","augment_material"],["craft_components","augments","advanced_crafting"]),
    treatment_solution:process("treatment_solution","Treatment Solution","treatment_solution",18,1.25,[
      {quantity:1,anyTags:["water_treatment_reagent","water_treatment"]},
      {quantity:1,anyTags:["environmental_filter_media","filter_media","environmental_absorbent"]}
    ],["chemical_component","treatment_solution","water_treatment","infrastructure_input"],["survival","environmental","infrastructure"])
  });

  const ITEMS=Object.freeze(Object.values(PROCESSES).map((p)=>Object.freeze({
    id:p.outputId,name:p.label,family:FAMILY,iconFamily:p.iconFamily,
    category:"material",itemType:"ingredient",processed:true,rawCraftingReagent:false,
    baseQuality:DEFAULT_QUALITY,qualitySystem:"universal",reusableAsRecipeInput:true,
    processId:p.id,semanticCheck:p.semanticCheck,requiredToolType:p.requiredToolType,
    baseThreshold:p.baseThreshold,processTier:p.complexity,craftBaseMultiplier:p.craftBaseMultiplier,
    tags:p.outputTags,consumerHooks:p.consumerHooks,
  })));

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function get(id){const key=normalizeId(id);const entry=ITEMS.find((v)=>v.id===key);return entry?clone(entry):null;}
  function getProcess(id){const p=PROCESSES[normalizeId(id)];return p?clone(p):null;}
  function list(options={}){
    const tag=normalizeId(options.tag), hook=normalizeId(options.consumerHook);
    return ITEMS.filter((v)=>!tag||v.tags.includes(tag)).filter((v)=>!hook||v.consumerHooks.includes(hook)).map(clone);
  }
  function validateCatalog(){
    const errors=[];
    for(const item of ITEMS){
      if(!PROCESSES[item.processId]) errors.push({id:item.id,error:"missing_process"});
      if(![18,22,28].includes(item.baseThreshold)) errors.push({id:item.id,error:"invalid_threshold"});
      if(!item.tags.includes("chemical_component")) errors.push({id:item.id,error:"missing_chemical_component_tag"});
    }
    return {valid:errors.length===0,errors,count:ITEMS.length};
  }

  const API=Object.freeze({VERSION,FAMILY,DEFAULT_QUALITY,IMPROVISED_THRESHOLD_PENALTY,PROCESSES,ITEMS,get,getProcess,list,validateCatalog});
  global.LuminousChemicalProcessedCatalog=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
