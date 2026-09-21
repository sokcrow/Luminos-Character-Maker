(function (global) {
  "use strict";
  if (global.LuminousThrowableRecipeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousThrowableRecipeCatalog;
    return;
  }

  const VERSION=1;
  const FAMILY="throwables";
  const DEFAULT_QUALITY="standard";
  const IMPROVISED_THRESHOLD_PENALTY=3;

  function normalizeId(value){return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function freezeTags(values){return Object.freeze([...new Set((values||[]).map(normalizeId).filter(Boolean))]);}
  function freezeReqs(values){return Object.freeze((values||[]).map((v)=>Object.freeze({...v})));}

  function recipe(def){
    return Object.freeze({
      id:normalizeId(def.id),name:def.name,family:FAMILY,iconFamily:normalizeId(def.iconFamily||def.id),
      category:"consumable",itemType:"throwable",consumable:true,consumedOnUse:true,stackable:true,
      baseQuality:DEFAULT_QUALITY,qualitySystem:"universal",
      semanticCheck:normalizeId(def.semanticCheck),requiredToolType:normalizeId(def.requiredToolType),
      baseThreshold:Number(def.baseThreshold),processTier:Number(def.baseThreshold)>=28?"corp_wing":Number(def.baseThreshold)>=22?"workshop":"generic",
      craftBaseMultiplier:Number(def.craftBaseMultiplier||1),
      improvisedThresholdDelta:IMPROVISED_THRESHOLD_PENALTY,
      inputRequirements:freezeReqs(def.inputRequirements),
      tags:freezeTags(["throwable","offensive_consumable","crafted_item",...(def.tags||[])]),
      payloadTags:freezeTags(def.payloadTags||[]),
      runtimeEffectImplemented:false,
      combatContractStatus:"deferred"
    });
  }

  const RECIPES=Object.freeze({
    fragmentation_throwable:recipe({
      id:"fragmentation_throwable",name:"Fragmentation Throwable",iconFamily:"fragmentation_throwable",
      semanticCheck:"fabrication",requiredToolType:"fabrication_tools",baseThreshold:22,craftBaseMultiplier:1.30,
      inputRequirements:[
        {quantity:1,anyIds:["grenade_shell"]},
        {quantity:1,anyIds:["fragmentation_filler"]},
        {quantity:1,anyIds:["reactive_compound"]}
      ],
      payloadTags:["physical_payload","fragmentation_payload"]
    }),
    incendiary_throwable:recipe({
      id:"incendiary_throwable",name:"Incendiary Throwable",iconFamily:"incendiary_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:22,craftBaseMultiplier:1.35,
      inputRequirements:[
        {quantity:1,anyIds:["grenade_shell","chemical_canister"]},
        {quantity:1,anyTags:["combustible_source","fuel"]},
        {quantity:1,anyIds:["stabilized_compound"]}
      ],
      payloadTags:["fire_payload","incendiary_payload","combustible_payload"]
    }),
    cryogenic_throwable:recipe({
      id:"cryogenic_throwable",name:"Cryogenic Throwable",iconFamily:"cryogenic_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:22,craftBaseMultiplier:1.35,
      inputRequirements:[
        {quantity:1,anyIds:["grenade_shell","chemical_canister"]},
        {quantity:1,anyIds:["cryogenic_solution"]}
      ],
      payloadTags:["cold_payload","cryogenic_payload"]
    }),
    shock_throwable:recipe({
      id:"shock_throwable",name:"Shock Throwable",iconFamily:"shock_throwable",
      semanticCheck:"electrical_fabrication",requiredToolType:"technical_tools",baseThreshold:22,craftBaseMultiplier:1.35,
      inputRequirements:[
        {quantity:1,anyIds:["grenade_shell"]},
        {quantity:1,anyIds:["shock_charge"]}
      ],
      payloadTags:["lightning_payload","electrical_payload"]
    }),
    concussive_throwable:recipe({
      id:"concussive_throwable",name:"Concussive Throwable",iconFamily:"concussive_throwable",
      semanticCheck:"fabrication",requiredToolType:"fabrication_tools",baseThreshold:22,craftBaseMultiplier:1.30,
      inputRequirements:[
        {quantity:1,anyIds:["grenade_shell"]},
        {quantity:1,anyIds:["concussive_charge"]}
      ],
      payloadTags:["thunder_payload","concussive_payload"]
    }),
    smoke_throwable:recipe({
      id:"smoke_throwable",name:"Smoke Throwable",iconFamily:"smoke_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:18,craftBaseMultiplier:1.20,
      inputRequirements:[
        {quantity:1,anyIds:["chemical_canister","grenade_shell"]},
        {quantity:1,anyIds:["reactive_compound"]},
        {quantity:1,anyIds:["stabilized_compound"]}
      ],
      payloadTags:["smoke_payload","obscuring_payload"]
    }),
    flash_throwable:recipe({
      id:"flash_throwable",name:"Flash Throwable",iconFamily:"flash_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:22,craftBaseMultiplier:1.30,
      inputRequirements:[
        {quantity:1,anyIds:["grenade_shell"]},
        {quantity:1,anyIds:["reactive_compound"]},
        {quantity:1,anyIds:["stabilized_compound"]}
      ],
      payloadTags:["flash_payload","sensory_payload"]
    }),
    marking_throwable:recipe({
      id:"marking_throwable",name:"Marking Throwable",iconFamily:"marking_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:18,craftBaseMultiplier:1.15,
      inputRequirements:[
        {quantity:1,anyIds:["chemical_canister","grenade_shell"]},
        {quantity:1,anyIds:["pigment_compound"]}
      ],
      payloadTags:["marking_payload","pigment_payload"]
    }),
    corrosive_throwable:recipe({
      id:"corrosive_throwable",name:"Corrosive Throwable",iconFamily:"corrosive_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:22,craftBaseMultiplier:1.35,
      inputRequirements:[
        {quantity:1,anyIds:["corrosive_canister"]},
        {quantity:1,anyIds:["grenade_shell"]}
      ],
      payloadTags:["acid_payload","corrosive_payload"]
    }),
    toxic_throwable:recipe({
      id:"toxic_throwable",name:"Toxic Throwable",iconFamily:"toxic_throwable",
      semanticCheck:"chemical_processing",requiredToolType:"chemical_tools",baseThreshold:22,craftBaseMultiplier:1.35,
      inputRequirements:[
        {quantity:1,anyIds:["chemical_canister","grenade_shell"]},
        {quantity:1,anyIds:["toxin_extract"]},
        {quantity:1,anyIds:["stabilized_reagent","stabilized_compound"]}
      ],
      payloadTags:["poison_payload","toxic_payload"]
    })
  });

  const EXISTING_PAYLOAD_ITEMS=Object.freeze({
    reactive:"reactive_canister",
    corrosive:"corrosive_canister",
    toxic:"toxic_aerosol",
    containment:"containment_foam"
  });

  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function get(id){const row=RECIPES[normalizeId(id)];return row?clone(row):null;}
  function list(options={}){
    const payloadTag=normalizeId(options.payloadTag);
    const processTier=normalizeId(options.processTier);
    return Object.values(RECIPES)
      .filter((entry)=>!payloadTag||entry.payloadTags.includes(payloadTag))
      .filter((entry)=>!processTier||entry.processTier===processTier)
      .map(clone);
  }
  function validateCatalog(){
    const errors=[];
    for(const entry of Object.values(RECIPES)){
      if(![18,22,28].includes(entry.baseThreshold))errors.push({id:entry.id,error:"invalid_threshold"});
      if(!entry.inputRequirements.length)errors.push({id:entry.id,error:"missing_inputs"});
      if(!entry.iconFamily)errors.push({id:entry.id,error:"missing_icon_family"});
      if(entry.runtimeEffectImplemented!==false||entry.combatContractStatus!=="deferred")errors.push({id:entry.id,error:"combat_runtime_must_be_deferred"});
    }
    return {valid:errors.length===0,errors,count:Object.keys(RECIPES).length};
  }

  const API=Object.freeze({VERSION,FAMILY,DEFAULT_QUALITY,IMPROVISED_THRESHOLD_PENALTY,RECIPES,EXISTING_PAYLOAD_ITEMS,get,list,validateCatalog});
  global.LuminousThrowableRecipeCatalog=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
