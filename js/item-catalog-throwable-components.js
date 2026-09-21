(function (global) {
  "use strict";
  if (global.LuminousThrowableComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousThrowableComponentCatalog;
    return;
  }

  const VERSION=1;
  const FAMILY="throwable_components";
  const DEFAULT_QUALITY="standard";
  const IMPROVISED_THRESHOLD_PENALTY=3;

  function normalizeId(value){return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function freezeTags(values){return Object.freeze([...new Set((values||[]).map(normalizeId).filter(Boolean))]);}
  function freezeReqs(values){return Object.freeze((values||[]).map((v)=>Object.freeze({...v})));}

  function component(def){
    return Object.freeze({
      id:normalizeId(def.id),name:def.name,family:FAMILY,iconFamily:normalizeId(def.iconFamily||def.id),
      category:"material",itemType:"component",processed:true,rawCraftingReagent:false,reusableAsRecipeInput:true,
      baseQuality:DEFAULT_QUALITY,qualitySystem:"universal",stackable:true,
      semanticCheck:normalizeId(def.semanticCheck),requiredToolType:normalizeId(def.requiredToolType),
      baseThreshold:Number(def.baseThreshold),processTier:Number(def.baseThreshold)>=28?"corp_wing":Number(def.baseThreshold)>=22?"workshop":"generic",
      craftBaseMultiplier:Number(def.craftBaseMultiplier||1),
      improvisedThresholdDelta:IMPROVISED_THRESHOLD_PENALTY,
      inputRequirements:freezeReqs(def.inputRequirements),
      requirementTags:freezeTags(def.requirementTags),
      tags:freezeTags(["ingredient","throwable_component","processed_component",...(def.tags||[]),...(def.requirementTags||[])]),
      consumerHooks:freezeTags(def.consumerHooks||["throwables"]),
      runtimeEffectImplemented:false
    });
  }

  const ITEMS=Object.freeze([
    component({
      id:"grenade_shell",name:"Grenade Shell",iconFamily:"grenade_shell",
      semanticCheck:"housing_fabrication",requiredToolType:"fabrication_tools",baseThreshold:22,craftBaseMultiplier:1.30,
      inputRequirements:[
        {quantity:1,anyTags:["housing","casing","structural_component"]},
        {quantity:1,anyTags:["fasteners","hardware"]}
      ],
      requirementTags:["grenade_shell","throwable_shell","payload_container"],
      tags:["housing","casing","payload_container"]
    }),
    component({
      id:"fragmentation_filler",name:"Fragmentation Filler",iconFamily:"fragmentation_filler",
      semanticCheck:"fabrication",requiredToolType:"fabrication_tools",baseThreshold:18,craftBaseMultiplier:1.20,
      inputRequirements:[
        {quantity:1,anyTags:["scrap_mechanical","refined_metal","metal_stock","structural_material"]}
      ],
      requirementTags:["fragmentation_filler","fragmentation_payload"],
      tags:["physical_payload","fragmentation_payload"]
    }),
    component({
      id:"concussive_charge",name:"Concussive Charge",iconFamily:"concussive_charge",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:22,craftBaseMultiplier:1.35,
      inputRequirements:[
        {quantity:1,anyIds:["reactive_compound"]},
        {quantity:1,anyIds:["stabilized_compound"]}
      ],
      requirementTags:["concussive_charge","concussive_payload"],
      tags:["reactive_payload","concussive_payload"]
    }),
    component({
      id:"shock_charge",name:"Shock Charge",iconFamily:"shock_charge",
      semanticCheck:"electrical_fabrication",requiredToolType:"technical_tools",baseThreshold:22,craftBaseMultiplier:1.40,
      inputRequirements:[
        {quantity:1,anyTags:["electrical_component","electronic_parts"]},
        {quantity:1,anyTags:["conductive_material","conductor"]},
        {quantity:1,anyIds:["stabilized_compound"]}
      ],
      requirementTags:["shock_charge","electrical_payload","energy_component"],
      tags:["electrical_payload","energy_component","device_input"],
      consumerHooks:["throwables","electronics","devices","augments"]
    })
  ]);

  const BY_ID=Object.freeze(Object.fromEntries(ITEMS.map((entry)=>[entry.id,entry])));
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function get(id){const entry=BY_ID[normalizeId(id)];return entry?clone(entry):null;}
  function list(options={}){
    const tag=normalizeId(options.tag||options.requirementTag);
    const hook=normalizeId(options.consumerHook);
    return ITEMS.filter((entry)=>!tag||entry.tags.includes(tag)||entry.requirementTags.includes(tag))
      .filter((entry)=>!hook||entry.consumerHooks.includes(hook)).map(clone);
  }
  function validateCatalog(){
    const errors=[];const ids=new Set();
    for(const entry of ITEMS){
      if(!entry.id||ids.has(entry.id))errors.push({id:entry.id,error:"duplicate_or_missing_id"});
      if(![18,22,28].includes(entry.baseThreshold))errors.push({id:entry.id,error:"invalid_threshold"});
      if(!entry.semanticCheck||!entry.requiredToolType)errors.push({id:entry.id,error:"missing_process_contract"});
      if(!entry.inputRequirements.length)errors.push({id:entry.id,error:"missing_inputs"});
      if(entry.runtimeEffectImplemented!==false)errors.push({id:entry.id,error:"runtime_must_be_deferred"});
      ids.add(entry.id);
    }
    return {valid:errors.length===0,errors,count:ITEMS.length};
  }

  const API=Object.freeze({VERSION,FAMILY,DEFAULT_QUALITY,IMPROVISED_THRESHOLD_PENALTY,ITEMS,get,list,validateCatalog});
  global.LuminousThrowableComponentCatalog=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
