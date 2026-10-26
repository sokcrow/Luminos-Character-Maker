(function (global) {
  "use strict";
  if (global.LuminousMedicinalProcessedCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMedicinalProcessedCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "medicinal_processed";
  const DEFAULT_QUALITY = "standard";
  const IMPROVISED_THRESHOLD_PENALTY = 3;

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function freeze(values) { return Object.freeze((values || []).map((v) => typeof v === "object" ? Object.freeze({ ...v }) : v)); }
  function process(id, label, iconFamily, semanticCheck, requiredToolType, baseThreshold, complexity, craftBaseMultiplier, inputRequirements, outputTags) {
    return Object.freeze({
      id, label, outputId:id, iconFamily,
      semanticCheck:normalizeId(semanticCheck), requiredToolType:normalizeId(requiredToolType),
      baseThreshold, complexity:normalizeId(complexity), craftBaseMultiplier,
      improvisedThresholdDelta:IMPROVISED_THRESHOLD_PENALTY,
      inputRequirements:freeze(inputRequirements),
      outputTags:Object.freeze((outputTags || []).map(normalizeId)),
    });
  }

  const PROCESSES = Object.freeze({
    medicinal_extract: process("medicinal_extract","Medicinal Extract","medicinal_extract","medicine","medical_tools",18,"generic",1.25,[
      { quantity:2, anyTags:["medicinal","healing_reagent","digestive_reagent","fever_reagent","recovery_reagent","calming","medicine_reagent"] },
      { quantity:1, anyTags:["liquid_carrier","sterile_carrier","carrier"] }
    ],["processed_medicine","active_medicine","medicinal_extract"]),
    medicinal_concentrate: process("medicinal_concentrate","Medicinal Concentrate","medicinal_concentrate","chemical_processing","chemical_tools",22,"workshop",1.40,[
      { quantity:2, anyIds:["medicinal_extract"] },
      { quantity:1, anyTags:["stabilizer_reagent","medical_buffer"] }
    ],["processed_medicine","active_medicine","medicinal_concentrate"]),
    sterile_solution: process("sterile_solution","Sterile Solution","sterile_solution","medicine","medical_tools",18,"generic",1.20,[
      { quantity:1, anyIds:["sterile_water","medical_saline"] },
      { quantity:1, anyTags:["electrolyte_reagent","medical_buffer"] },
      { quantity:1, anyTags:["sterile_container","medicine_container"] }
    ],["processed_medicine","sterile_solution","sterile_carrier","active_solution"]),
    antiseptic_solution: process("antiseptic_solution","Antiseptic Solution","antiseptic_solution","chemical_processing","chemical_tools",22,"workshop",1.35,[
      { quantity:1, anyTags:["antiseptic_reagent"] },
      { quantity:1, anyIds:["sterile_solution"] }
    ],["processed_medicine","antiseptic_solution","active_solution"]),
    antitoxin_base: process("antitoxin_base","Antitoxin Base","antitoxin_base","chemical_processing","chemical_tools",22,"workshop",1.50,[
      { quantity:1, anyTags:["toxin_source","toxin_reagent","poison_input","potent_toxin","poison_reagent"] },
      { quantity:1, anyIds:["medicinal_extract"] },
      { quantity:1, anyTags:["stabilizer_reagent","medical_buffer"] }
    ],["processed_medicine","antitoxin_base","active_antidote"]),
    pharmaceutical_powder: process("pharmaceutical_powder","Pharmaceutical Powder","pharmaceutical_powder","chemical_processing","chemical_tools",22,"workshop",1.35,[
      { quantity:1, anyTags:["pharma_reagent","tablet_excipient"] },
      { quantity:1, anyTags:["stabilizer_reagent","medical_buffer"] }
    ],["processed_medicine","pharmaceutical_powder","active_medicine"]),
    medical_gel_base: process("medical_gel_base","Medical Gel Base","medical_gel_base","medicine","medical_tools",22,"workshop",1.40,[
      { quantity:1, anyTags:["regenerative_reagent","medical_reagent","gel","carrier"] },
      { quantity:1, anyIds:["sterile_solution"] },
      { quantity:1, anyTags:["medical_polymer"] }
    ],["processed_medicine","medical_gel_base","active_medicine"]),
    ointment_base: process("ointment_base","Ointment Base","ointment_base","medicine","medical_tools",18,"generic",1.25,[
      { quantity:1, anyTags:["topical_carrier","ointment_carrier"] },
      { quantity:1, anyIds:["medicinal_extract"] }
    ],["processed_medicine","ointment_base","active_medicine"]),
    stabilized_reagent: process("stabilized_reagent","Stabilized Reagent","stabilized_reagent","chemical_processing","chemical_tools",22,"workshop",1.40,[
      { quantity:1, anyTags:["exotic_reagent","unstable_catalyst","bio_reagent","chemical_toxin","pharma_reagent"] },
      { quantity:1, anyTags:["stabilizer_reagent","medical_buffer"] }
    ],["processed_medicine","stabilized_reagent"]),
    toxin_extract: process("toxin_extract","Toxin Extract","toxin_extract","chemical_processing","chemical_tools",22,"workshop",1.40,[
      { quantity:1, anyTags:["toxin_source","toxin_reagent","poison_input","potent_toxin","poison_reagent","chemical_toxin"] },
      { quantity:1, anyTags:["medical_solvent","liquid_carrier"] },
      { quantity:1, anyTags:["stabilizer_reagent","medical_buffer"] }
    ],["processed_chemical","toxin_extract","active_toxin"]),
  });

  const ITEMS = Object.freeze(Object.values(PROCESSES).map((p) => Object.freeze({
    id:p.outputId, name:p.label, family:FAMILY, iconFamily:p.iconFamily,
    category:"material", itemType:"ingredient", processed:true, rawCraftingReagent:false,
    baseQuality:DEFAULT_QUALITY, qualitySystem:"universal", reusableAsRecipeInput:true,
    processId:p.id, semanticCheck:p.semanticCheck, requiredToolType:p.requiredToolType,
    baseThreshold:p.baseThreshold, processTier:p.complexity, craftBaseMultiplier:p.craftBaseMultiplier,
    tags:p.outputTags,
  })));

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function get(id) { const key=normalizeId(id); const entry=ITEMS.find((v)=>v.id===key); return entry?clone(entry):null; }
  function getProcess(id) { const p=PROCESSES[normalizeId(id)]; return p?clone(p):null; }
  function list(options={}) {
    const check=normalizeId(options.semanticCheck);
    return ITEMS.filter((v)=>!check||v.semanticCheck===check).map(clone);
  }
  function validateCatalog() {
    const errors=[];
    for (const item of ITEMS) {
      if (!PROCESSES[item.processId]) errors.push({id:item.id,error:"missing_process"});
      if (![18,22,28].includes(item.baseThreshold)) errors.push({id:item.id,error:"invalid_threshold"});
    }
    return {valid:errors.length===0,errors,count:ITEMS.length};
  }

  const API=Object.freeze({VERSION,FAMILY,DEFAULT_QUALITY,IMPROVISED_THRESHOLD_PENALTY,PROCESSES,ITEMS,get,getProcess,list,validateCatalog});
  global.LuminousMedicinalProcessedCatalog=API;
  if (typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
