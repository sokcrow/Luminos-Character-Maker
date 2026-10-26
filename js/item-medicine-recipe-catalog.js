(function (global) {
  "use strict";
  if (global.LuminousMedicineRecipeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMedicineRecipeCatalog;
    return;
  }

  const VERSION = 1;
  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function recipe(id, label, outputIconFamily, semanticCheck, requiredToolType, baseThreshold, multiplier, inputRequirements, tags=[]) {
    return Object.freeze({
      id, label, outputIconFamily, semanticCheck:normalizeId(semanticCheck),
      requiredToolType:normalizeId(requiredToolType), baseThreshold,
      complexity:baseThreshold>=28?"corp":baseThreshold>=22?"workshop":"generic",
      craftBaseMultiplier:multiplier,
      inputRequirements:Object.freeze(inputRequirements.map((v)=>Object.freeze({...v}))),
      tags:Object.freeze(tags.map(normalizeId)),
    });
  }

  const RECIPES = Object.freeze({
    medicine_tablet: recipe("medicine_tablet","Medicine Tablet","medicine_tablet","medicine","medical_tools",18,1.15,[
      {quantity:1,anyIds:["pharmaceutical_powder"]},{quantity:1,anyIds:["tablet_binder","medical_cellulose","pharmaceutical_starch"]}
    ],["finished_medicine","oral"]),
    medicine_capsule: recipe("medicine_capsule","Medicine Capsule","medicine_capsule","medicine","medical_tools",18,1.15,[
      {quantity:1,anyIds:["pharmaceutical_powder","medicinal_concentrate"]},{quantity:1,anyIds:["capsule_shell_material"]}
    ],["finished_medicine","oral"]),
    medicine_ampoule: recipe("medicine_ampoule","Medicine Ampoule","medicine_ampoule","medicine","medical_tools",22,1.25,[
      {quantity:1,anyTags:["active_medicine","active_solution"]},{quantity:1,anyIds:["sterile_solution"]},{quantity:1,anyIds:["ampoule_blank"]}
    ],["finished_medicine","sterile_delivery"]),
    medicine_vial: recipe("medicine_vial","Medicine Vial","medicine_vial","medicine","medical_tools",18,1.20,[
      {quantity:1,anyTags:["active_medicine","active_solution"]},{quantity:1,anyIds:["medical_vial_blank"]}
    ],["finished_medicine","liquid_delivery"]),
    medicine_inhaler: recipe("medicine_inhaler","Medicine Inhaler","medicine_inhaler","medicine","medical_tools",22,1.30,[
      {quantity:1,anyTags:["active_medicine","active_solution"]},{quantity:1,anyIds:["inhaler_canister"]}
    ],["finished_medicine","inhaled"]),
    medicine_patch: recipe("medicine_patch","Medicine Patch","medicine_patch","medicine","medical_tools",22,1.30,[
      {quantity:1,anyIds:["medical_gel_base","medicinal_concentrate"]},{quantity:1,anyTags:["medical_polymer"]}
    ],["finished_medicine","transdermal"]),
    medicine_topical: recipe("medicine_topical","Topical Medicine","medicine_topical","medicine","medical_tools",18,1.20,[
      {quantity:1,anyIds:["ointment_base","medical_gel_base"]},{quantity:1,anyIds:["medicinal_extract","medicinal_concentrate"]}
    ],["finished_medicine","topical"]),
    medicine_dressing: recipe("medicine_dressing","Medical Dressing","medicine_dressing","medicine","medical_tools",18,1.20,[
      {quantity:1,anyTags:["medical_dressing_material"]},{quantity:1,anyIds:["antiseptic_solution","medical_gel_base"]}
    ],["finished_medicine","dressing"]),
    medicine_kit: recipe("medicine_kit","Medicine Kit","medicine_kit","medicine","medical_tools",18,1.15,[
      {quantity:2,anyTags:["finished_medicine"]},{quantity:1,anyIds:["sterile_container"]}
    ],["finished_medicine","kit"]),

    antidote_tablet: recipe("antidote_tablet","Antidote Tablet","antidote_tablet","medicine","medical_tools",22,1.30,[
      {quantity:1,anyIds:["antitoxin_base"]},{quantity:1,anyIds:["pharmaceutical_powder","tablet_binder"]}
    ],["finished_antidote","oral"]),
    antidote_ampoule: recipe("antidote_ampoule","Antidote Ampoule","antidote_ampoule","medicine","medical_tools",22,1.35,[
      {quantity:1,anyIds:["antitoxin_base","sterile_solution"]},{quantity:1,anyIds:["ampoule_blank"]}
    ],["finished_antidote","sterile_delivery"]),
    antidote_vial: recipe("antidote_vial","Antidote Vial","antidote_vial","medicine","medical_tools",22,1.30,[
      {quantity:1,anyIds:["antitoxin_base"]},{quantity:1,anyIds:["sterile_solution"]},{quantity:1,anyIds:["medical_vial_blank"]}
    ],["finished_antidote","liquid_delivery"]),
    antidote_inhaler: recipe("antidote_inhaler","Antidote Inhaler","antidote_inhaler","medicine","medical_tools",22,1.35,[
      {quantity:1,anyIds:["antitoxin_base"]},{quantity:1,anyIds:["inhaler_canister"]}
    ],["finished_antidote","inhaled"]),

    poison_vial: recipe("poison_vial","Poison Vial","poison_vial","chemical_processing","chemical_tools",22,1.30,[
      {quantity:1,anyIds:["toxin_extract"]},{quantity:1,anyIds:["medical_vial_blank"]}
    ],["finished_toxin","liquid_delivery"]),
    poison_capsule: recipe("poison_capsule","Poison Capsule","poison_capsule","chemical_processing","chemical_tools",22,1.30,[
      {quantity:1,anyIds:["toxin_extract"]},{quantity:1,anyIds:["capsule_shell_material"]}
    ],["finished_toxin","oral"]),
    poison_coating: recipe("poison_coating","Poison Coating","poison_coating","chemical_processing","chemical_tools",22,1.25,[
      {quantity:1,anyIds:["toxin_extract"]},{quantity:1,anyTags:["binder","medical_polymer","topical_carrier"]}
    ],["finished_toxin","coating"]),
    toxic_aerosol: recipe("toxic_aerosol","Toxic Aerosol","toxic_aerosol","chemical_processing","chemical_tools",22,1.35,[
      {quantity:1,anyIds:["toxin_extract"]},{quantity:1,anyIds:["inhaler_canister","spray_canister"]}
    ],["finished_toxin","aerosol"]),
    toxic_ampoule: recipe("toxic_ampoule","Toxic Ampoule","toxic_ampoule","chemical_processing","chemical_tools",22,1.35,[
      {quantity:1,anyIds:["toxin_extract","stabilized_reagent"]},{quantity:1,anyIds:["ampoule_blank"]}
    ],["finished_toxin","sterile_delivery"]),
  });

  const PENDING_ICON_FORMS = Object.freeze([
    Object.freeze({ id:"medicine_spray", reason:"icon_url_pending", suggestedThreshold:22 }),
    Object.freeze({ id:"medicine_injector", reason:"icon_url_pending", suggestedThreshold:22 }),
    Object.freeze({ id:"toxic_canister", reason:"icon_url_pending", suggestedThreshold:22 }),
  ]);

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function get(id){const v=RECIPES[normalizeId(id)];return v?clone(v):null;}
  function list(options={}){
    const check=normalizeId(options.semanticCheck);
    const tag=normalizeId(options.tag);
    return Object.values(RECIPES)
      .filter((v)=>!check||v.semanticCheck===check)
      .filter((v)=>!tag||v.tags.includes(tag))
      .map(clone);
  }
  function validateCatalog(){
    const errors=[];
    for(const r of Object.values(RECIPES)){
      if(![18,22,28].includes(r.baseThreshold)) errors.push({id:r.id,error:"invalid_threshold"});
      if(!r.inputRequirements.length) errors.push({id:r.id,error:"missing_inputs"});
    }
    return {valid:errors.length===0,errors,count:Object.keys(RECIPES).length,pending:PENDING_ICON_FORMS.length};
  }

  const API=Object.freeze({VERSION,RECIPES,PENDING_ICON_FORMS,get,list,validateCatalog});
  global.LuminousMedicineRecipeCatalog=API;
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
