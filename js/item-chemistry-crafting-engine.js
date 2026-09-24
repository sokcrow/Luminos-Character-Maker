(function (global) {
  "use strict";
  if (global.LuminousChemistryCraftingEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousChemistryCraftingEngine;
    return;
  }

  const VERSION=1;
  const IMPROVISED_THRESHOLD_PENALTY=3;

  function safeRequire(path){if(typeof require!=="function")return null;try{return require(path);}catch(_){return null;}}
  function normalizeId(value){return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function qualityEngine(){return global.LuminousItemQualityEngine||safeRequire("./item-quality-engine.js");}
  function processedCatalog(){return global.LuminousChemicalProcessedCatalog||safeRequire("./item-catalog-chemical-processed.js");}
  function recipeCatalog(){return global.LuminousChemistryRecipeCatalog||safeRequire("./item-chemistry-recipe-catalog.js");}
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

  function tagSet(input){
    const out=new Set();
    const add=(v)=>{const id=normalizeId(v);if(id)out.add(id);};
    add(input?.id);add(input?.family);add(input?.iconFamily);add(input?.category);add(input?.itemType);
    for(const key of ["tags","reagentTags","materialTags","functionalTags","craftTags","recipeRoles","requirementTags","consumerHooks"]){
      for(const value of input?.[key]||[])add(value);
    }
    if(out.has("acid_secretion")){out.add("corrosive_reagent");out.add("chemical_corrosive");out.add("etchant");}
    if(out.has("resin")){out.add("industrial_resin");out.add("binder");}
    if(out.has("adhesive_ooze")){out.add("industrial_adhesive");out.add("adhesive");out.add("binder");}
    if(out.has("ink_secretion")||out.has("ink")){out.add("pigment_source");}
    if(out.has("conductive_gel")){out.add("conductive_material");out.add("conductor");}
    return out;
  }
  function quantityOf(input){const n=Number(input?.quantity??input?.count??input?.units??1);return Number.isFinite(n)?Math.max(0,n):0;}
  function productionValueOf(input){
    for(const key of ["productionValueAhn","standardUnitValueAhn","unitValueAhn","valueAhn","standardValueAhn"]){
      const n=Number(input?.[key]);if(Number.isFinite(n)&&n>=0)return n;
    }
    return 0;
  }
  function requirementMatches(input,requirement){
    const id=normalizeId(input?.id),tags=tagSet(input);
    const anyIds=(requirement?.anyIds||[]).map(normalizeId).filter(Boolean);
    const anyTags=(requirement?.anyTags||[]).map(normalizeId).filter(Boolean);
    const allTags=(requirement?.allTags||[]).map(normalizeId).filter(Boolean);
    if(anyIds.length&&!anyIds.includes(id))return false;
    if(anyTags.length&&!anyTags.some((tag)=>tags.has(tag)))return false;
    if(allTags.length&&!allTags.every((tag)=>tags.has(tag)))return false;
    return Boolean(anyIds.length||anyTags.length||allTags.length);
  }
  function validateInputs(contract,inputs=[]){
    const remaining=inputs.map((input,index)=>({index,input,remaining:quantityOf(input)}));
    const allocations=[],missing=[];
    for(const requirement of contract?.inputRequirements||[]){
      let needed=Math.max(0,Number(requirement.quantity??1)||0);const allocated=[];
      for(const row of remaining){
        if(needed<=0)break;
        if(row.remaining<=0||!requirementMatches(row.input,requirement))continue;
        const take=Math.min(needed,row.remaining);row.remaining-=take;needed-=take;
        allocated.push({inputIndex:row.index,itemId:normalizeId(row.input?.id),quantity:take});
      }
      if(needed>0)missing.push({requirement:clone(requirement),missingQuantity:needed});
      allocations.push({requirement:clone(requirement),allocated});
    }
    return {valid:missing.length===0,missing,allocations};
  }
  function thresholdFor(contract,options={}){
    let threshold=Number(contract?.baseThreshold||18);
    if(options.improvised===true)threshold+=Number(contract?.improvisedThresholdDelta??IMPROVISED_THRESHOLD_PENALTY);
    if(options.exotic===true||options.corpGrade===true||options.advanced===true)threshold=Math.max(28,threshold);
    return threshold;
  }
  function resolveCraftQuality(checkTotal,threshold){
    const engine=qualityEngine();
    if(checkTotal==null||!Number.isFinite(Number(checkTotal)))return {quality:"standard",checkTotal:null,threshold,margin:null};
    if(engine?.resolveQuality){
      const result=engine.resolveQuality(Number(checkTotal),threshold);
      return {quality:result.quality.id,checkTotal:result.checkTotal,threshold:result.threshold,margin:result.margin};
    }
    const margin=Number(checkTotal)-threshold;
    return {quality:margin>=8?"exceptional":margin>=4?"fine":margin>=0?"standard":margin>=-7?"poor":"ruined",checkTotal:Number(checkTotal),threshold,margin};
  }
  function craftValue(contract,inputs,quality){
    const consumed=(inputs||[]).reduce((sum,input)=>sum+productionValueOf(input)*quantityOf(input),0);
    const base=Math.round(consumed*Number(contract?.craftBaseMultiplier||1));
    const engine=qualityEngine();
    const value=engine?.applyValue?engine.applyValue(base,quality,{rounding:"round"}):base;
    return {consumedInputProductionValueAhn:Math.round(consumed),craftBaseValueAhn:base,productionValueAhn:value};
  }
  function craftProcessed(processId,inputs=[],options={}){
    const contract=processedCatalog()?.getProcess?.(processId),definition=processedCatalog()?.get?.(processId);
    if(!contract||!definition)return {crafted:false,reason:"unknown_process"};
    const inputCheck=validateInputs(contract,inputs);
    if(!inputCheck.valid)return {crafted:false,reason:"missing_inputs",inputCheck,contract};
    const threshold=thresholdFor(contract,options),craft=resolveCraftQuality(options.checkTotal,threshold),values=craftValue(contract,inputs,craft.quality);
    const output={...definition,quality:craft.quality,quantity:Math.max(1,Number(options.outputQuantity||1)||1),productionValueAhn:values.productionValueAhn,
      craft:{semanticCheck:contract.semanticCheck,requiredToolType:contract.requiredToolType,threshold,checkTotal:craft.checkTotal,margin:craft.margin,improvised:options.improvised===true,sourceInputs:inputCheck.allocations}};
    return {crafted:true,type:"processed",contract,output,inputCheck,...values};
  }
  function craftProduct(recipeId,inputs=[],options={}){
    const contract=recipeCatalog()?.get?.(recipeId);
    if(!contract)return {crafted:false,reason:"unknown_recipe"};
    const inputCheck=validateInputs(contract,inputs);
    if(!inputCheck.valid)return {crafted:false,reason:"missing_inputs",inputCheck,contract};
    const threshold=thresholdFor(contract,options),craft=resolveCraftQuality(options.checkTotal,threshold),values=craftValue(contract,inputs,craft.quality);
    const output={
      id:normalizeId(options.outputId||contract.id),name:String(options.outputName||contract.label),
      family:"chemical_product",iconFamily:contract.outputIconFamily,category:"utility",itemType:"chemical_product",
      quality:craft.quality,qualitySystem:"universal",stackable:true,crafted:true,productionValueAhn:values.productionValueAhn,
      tags:[...(contract.tags||[])],consumerHooks:[...(contract.consumerHooks||[])],
      integrationStatus:contract.integrationStatus,runtimeEffectImplemented:false,recipeId:contract.id,
      craft:{semanticCheck:contract.semanticCheck,requiredToolType:contract.requiredToolType,threshold,checkTotal:craft.checkTotal,margin:craft.margin,improvised:options.improvised===true,sourceInputs:inputCheck.allocations}
    };
    return {crafted:true,type:"finished_product",contract,output,inputCheck,...values};
  }
  function craft(id,inputs=[],options={}){
    if(processedCatalog()?.getProcess?.(id))return craftProcessed(id,inputs,options);
    if(recipeCatalog()?.get?.(id))return craftProduct(id,inputs,options);
    return {crafted:false,reason:"unknown_recipe_or_process"};
  }
  function validateEngine(){
    const processed=processedCatalog()?.validateCatalog?.(),recipes=recipeCatalog()?.validateCatalog?.();
    return {valid:Boolean(processed?.valid&&recipes?.valid),processed:processed||null,recipes:recipes||null};
  }

  const API=Object.freeze({VERSION,IMPROVISED_THRESHOLD_PENALTY,tagSet,quantityOf,productionValueOf,requirementMatches,validateInputs,thresholdFor,resolveCraftQuality,craftValue,craftProcessed,craftProduct,craft,validateEngine});
  global.LuminousChemistryCraftingEngine=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
