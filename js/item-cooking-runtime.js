(function (global) {
  "use strict";

  if (global.LuminousCookingRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingRuntime;
    return;
  }

  const VERSION = 1;

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function cooking() { return global.LuminousCookingEngine || safeRequire("./item-cooking-engine.js"); }
  function cookingV2() { return global.LuminousCookingV2Engine || safeRequire("./item-cooking-v2-engine.js"); }
  function recipes() { return global.LuminousCookingRecipeCatalog || safeRequire("./item-cooking-recipe-catalog.js"); }
  function resolver() { return global.LuminousCookingRecipeResolver || safeRequire("./item-cooking-recipe-resolver.js"); }
  function equipment() { return global.LuminousCookingEquipmentEngine || safeRequire("./item-cooking-equipment-engine.js"); }
  function inventory() { return global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js"); }
  function itemRuntime() { return global.LuminousItemRuntime || safeRequire("./item-runtime-engine.js"); }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function objectEntries(value) {
    if (Array.isArray(value)) return value.map((item,index)=>[String(index),item]);
    return value && typeof value === "object" ? Object.entries(value) : [];
  }
  function quantityOf(item={}) {
    const raw=Number(item.quantity ?? item.qty ?? item.cantidad ?? item.stack ?? item.count ?? 1);
    return Math.max(0,Number.isFinite(raw)?Math.trunc(raw):0);
  }
  function setQuantity(item,value) {
    const rt=itemRuntime();
    if (rt?.setQuantity) return rt.setQuantity(item,value);
    item.quantity=Math.max(0,Math.trunc(Number(value)||0));
    return item.quantity;
  }

  function inventoryView(unit={}, options={}) {
    const rows=[];
    const sources=[];
    const add=(container,containerType)=>{
      for(const [key,item] of objectEntries(container)) {
        if (!item || quantityOf(item)<=0) continue;
        rows.push({ ...clone(item), __cookingContainerType:containerType, __cookingContainerKey:key });
        sources.push({ container, containerType, key, item });
      }
    };
    const inv=inventory();
    const active=inv?.activeContainer ? inv.activeContainer(unit,false).value : (unit.inventario_activo || unit.activeInventory || unit.inventory || unit.inventario);
    const stash=inv?.stashContainer ? inv.stashContainer(unit,false).value : (unit.inventario_stash || unit.stashInventory || unit.stash);
    add(active,"active");
    if (options.includeStash !== false) add(stash,"stash");
    return { rows, sources };
  }

  function inferredTaste(item={}) {
    if (Number.isFinite(Number(item.taste))) return Math.max(0,Math.min(4,Math.round(Number(item.taste))));
    const tags=[
      ...(item.flavorTags || []),...(item.tags || []),...(item.itemTags || []),...(item.recipeRoles || [])
    ].map(normalizeId);
    if (tags.includes("bitter") || tags.includes("toxic")) return 1;
    if (tags.includes("rich") || tags.includes("sweet") || tags.includes("savory") || tags.includes("fresh") || tags.includes("aromatic")) return 3;
    return 2;
  }

  function concreteRecipe(recipe,resolution) {
    return {
      ...clone(recipe),
      ingredients:(resolution.recipeInputs || []).map(input=>({
        ...clone(input),
        role:normalizeId(input.recipeRole || input.role || "major"),
        taste:inferredTaste(input),
      })),
    };
  }

  function buildSourcePlan(resolution,view) {
    return Object.freeze((resolution.consumptionPlan || []).map(row=>{
      const source=view.sources[row.inventoryIndex];
      return Object.freeze({
        inventoryIndex:row.inventoryIndex,
        containerType:source?.containerType || null,
        key:source?.key || null,
        units:row.units,
        requirements:Object.freeze([...(row.requirements || [])]),
        roles:Object.freeze([...(row.roles || [])]),
      });
    }));
  }

  function previewCook(unit={},recipeOrId,options={}) {
    const recipe=typeof recipeOrId==="string" ? recipes()?.get?.(recipeOrId) : clone(recipeOrId);
    if (!recipe) return Object.freeze({valid:false,reason:"unknown_recipe"});
    const v2Function=cookingV2()?.get?.(recipe) || null;
    if(v2Function?.adoption==="adapt" && cookingV2()?.hasExplicitKnowledgeStore?.(unit) && !cookingV2().knowsRecipe(unit,recipe)) {
      return Object.freeze({valid:false,reason:"unknown_recipe_knowledge",recipe:Object.freeze(clone(recipe)),v2Function:Object.freeze(clone(v2Function))});
    }
    const view=inventoryView(unit,options);
    const resolved=resolver()?.resolveRecipe?.(recipe,view.rows,options);
    if (!resolved?.valid) {
      return Object.freeze({
        valid:false,reason:resolved?.reason || "recipe_not_resolved",
        recipe:Object.freeze(clone(recipe)),
        resolution:resolved || null,
        missing:Object.freeze([...(resolved?.missing || [])]),
      });
    }

    const concrete=concreteRecipe(recipe,resolved);
    const gourmet=cookingV2()?.checkGourmetComponents?.(recipe,resolved.recipeInputs || []) || null;
    if(gourmet && gourmet.valid===false) {
      return Object.freeze({valid:false,reason:"gourmet_component_quality",recipe:Object.freeze(clone(recipe)),resolution:resolved,gourmet:Object.freeze(clone(gourmet)),v2Function:Object.freeze(clone(v2Function))});
    }
    const eq=equipment()?.evaluate?.(concrete,unit,options.equipment || options) || {
      improperEquipmentCount:0,hasCooksUtensils:false,proficient:false,proficiency:0,stationThModifier:0,toolThModifier:0
    };
    const th=cooking().buildRecipeTh(concrete);
    const effective=cooking().effectiveCookingTh(th.recipeTh,eq);
    const sourcePlan=buildSourcePlan(resolved,view);

    return Object.freeze({
      valid:true,
      recipe:Object.freeze(clone(recipe)),
      concreteRecipe:Object.freeze(clone(concrete)),
      resolution:resolved,
      sourcePlan,
      equipment:Object.freeze(clone(eq)),
      recipeTh:th.recipeTh,
      thBreakdown:th,
      effectiveTh:effective.effectiveTh,
      effectiveThBreakdown:effective,
      v2Function:v2Function ? Object.freeze(clone(v2Function)) : null,
      gourmet:gourmet ? Object.freeze(clone(gourmet)) : null,
    });
  }

  function canInsertFinishedItem(unit={},destination="active") {
    const inv=inventory();
    if (!inv) return true;
    if (normalizeId(destination)==="stash") return true;
    const container=inv.activeContainer?.(unit,true)?.value;
    if (!container) return true;
    const count=objectEntries(container).filter(([,item])=>item && quantityOf(item)>0).length;
    return count < (inv.activeSlotLimit?.(unit) ?? 10);
  }

  function deleteFromContainer(container,key,item) {
    if (Array.isArray(container)) {
      const index=Number(key);
      if (Number.isInteger(index) && index>=0 && index<container.length) container.splice(index,1);
      else {
        const found=container.indexOf(item);
        if (found>=0) container.splice(found,1);
      }
    } else if (container && typeof container==="object") {
      delete container[key];
    }
  }

  function consumeSourcePlan(unit,sourcePlan,options={}) {
    const view=inventoryView(unit,options);
    const deductions=[];
    for(const row of sourcePlan) {
      const source=view.sources[row.inventoryIndex];
      if (!source || quantityOf(source.item)<row.units) {
        return {consumed:false,reason:"inventory_changed_since_preview",row};
      }
      deductions.push({source,units:row.units});
    }
    for(const {source,units} of deductions) {
      const next=quantityOf(source.item)-units;
      setQuantity(source.item,next);
      if(next<=0) deleteFromContainer(source.container,source.key,source.item);
    }
    return {consumed:true,deductions:deductions.map(({source,units})=>({containerType:source.containerType,key:source.key,units}))};
  }

  function finishedFoodItem(recipe,prepared,pricing,options={}) {
    const now=Number(options.createdAt ?? Date.now());
    const v2Prepared=options.v2Prepared || null;
    const id=`food_prepared_${normalizeId(recipe.id)}`;
    const instanceId=String(options.instanceId || `${id}_${now}_${Math.random().toString(36).slice(2,8)}`);
    return {
      id,
      definitionId:id,
      itemId:id,
      instanceId,
      recipeId:recipe.id,
      displayName:recipe.name,
      name:recipe.name,
      family:"food",
      category:"food",
      itemType:"consumable",
      sourceLine:v2Prepared ? "cooking_v2" : "cooking_v1",
      quantity:1,
      stackPolicy:"identical_finished_recipe_stars_taste_effects_provenance",
      cuisine:recipe.cuisine,
      course:recipe.course,
      dishFamily:recipe.dishFamily,
      iconFamily:recipe.iconFamily || "food",
      tags:["food","prepared_food","cooked",...(recipe.tags || [])],
      edible:true,
      stars:prepared.stars,
      taste:prepared.taste,
      spRestore:v2Prepared ? Number(v2Prepared.spRecovery || 0) : prepared.sp,
      hungerSlotsRestored:v2Prepared ? Number(v2Prepared.hungerRestore || 0) : (Number(recipe.hungerRestore ?? 1) || 0),
      hydrationSlotsRestored:v2Prepared ? Number(v2Prepared.hydrationRestore || 0) : (Number(recipe.hydrationRestore ?? 0) || 0),
      culinaryEffects:clone(v2Prepared ? (v2Prepared.effects || []) : (prepared.effects || [])),
      activeEffectCount:v2Prepared ? (v2Prepared.effects || []).length : prepared.activeEffectCount,
      durationHours:v2Prepared ? Number(v2Prepared.durationHours || 0) : prepared.durationHours,
      maxHpBonus:v2Prepared ? Number(v2Prepared.maxHpBonus || 0) : 0,
      mealFocus:v2Prepared?.mealFocus || null,
      mealFocusLabel:v2Prepared?.mealFocusLabel || null,
      restTiming:v2Prepared?.restTiming || null,
      sleepSynergy:clone(v2Prepared?.sleepSynergy || {type:"none"}),
      freshnessEligible:v2Prepared?.freshnessEligible===true,
      freshnessMultiplier:v2Prepared?.freshnessMultiplier || null,
      freshnessDurationHours:null,
      cateringEligible:v2Prepared?.cateringEligible===true,
      gourmetMinStars:Number(v2Prepared?.gourmetMinStars || 0),
      seasoningCompatible:v2Prepared?.seasoningCompatible ?? null,
      recipeKnowledge:v2Prepared?.recipeKnowledge || null,
      recipeTh:prepared.recipeTh,
      effectiveTh:prepared.effectiveTh,
      cookingMargin:prepared.margin,
      culinaryAbility:prepared.ability,
      provenance:clone(prepared.provenance || []),
      createdProductionValueAhn:pricing?.createdProductionValueAhn ?? null,
      productionValueAhn:pricing?.realizedProductionValueAhn ?? pricing?.createdProductionValueAhn ?? null,
      retailReferencePriceAhn:pricing?.retailReferencePriceAhn ?? null,
      defaultVenue:recipe.defaultVenue || null,
      priceClass:recipe.priceClass || null,
      currency:"AHN",
      createdAt:now,
      runtime:Object.freeze({functions:["eat_drink"],actionCost:"none",consumeQty:1}),
    };
  }

  function insertFinishedItem(unit,item,destination="active") {
    const inv=inventory();
    const type=normalizeId(destination)==="stash" ? "stash" : "active";
    const container=type==="stash"
      ? (inv?.stashContainer?.(unit,true)?.value || (unit.inventario_stash ||= {}))
      : (inv?.activeContainer?.(unit,true)?.value || (unit.inventario_activo ||= {}));
    if (!container) return {inserted:false,reason:"inventory_container_unavailable"};
    if (Array.isArray(container)) container.push(item);
    else container[item.instanceId]=item;
    return {inserted:true,containerType:type,key:item.instanceId,item};
  }

  function executeCook(unit={},recipeOrId,checkResult,options={}) {
    const preview=previewCook(unit,recipeOrId,options);
    if (!preview.valid) return Object.freeze({cooked:false,...preview});
    const destination=normalizeId(options.destination || "active");
    if (!canInsertFinishedItem(unit,destination)) return Object.freeze({cooked:false,reason:"output_inventory_full",preview});

    const prepared=cooking().resolvePreparedItem(preview.concreteRecipe,checkResult,{equipment:preview.equipment});
    const v2Prepared=cookingV2()?.resolvePreparedFunction?.(preview.recipe,prepared.stars,unit,{...options,equipment:preview.equipment}) || null;
    const pricing=recipes()?.resolveReferencePricing?.(preview.recipe,preview.concreteRecipe.ingredients,{
      stars:prepared.stars,
      venue:options.venue || preview.recipe.defaultVenue,
    }) || null;

    const consumption=consumeSourcePlan(unit,preview.sourcePlan,options);
    if (!consumption.consumed) return Object.freeze({cooked:false,reason:consumption.reason,preview,consumption});

    const item=finishedFoodItem(preview.recipe,prepared,pricing,{...options,v2Prepared});
    const insertion=insertFinishedItem(unit,item,destination);
    if (!insertion.inserted) return Object.freeze({cooked:false,reason:insertion.reason,preview,consumption});

    const result=Object.freeze({
      cooked:true,
      recipeId:preview.recipe.id,
      item:Object.freeze(clone(item)),
      prepared,
      preparedV2:v2Prepared ? Object.freeze(clone(v2Prepared)) : null,
      pricing,
      consumption,
      insertion:Object.freeze({containerType:insertion.containerType,key:insertion.key}),
      preview,
    });
    try {
      if(typeof global.dispatchEvent==="function" && typeof global.CustomEvent==="function") {
        global.dispatchEvent(new global.CustomEvent("luminous:food-cooked",{detail:result}));
      }
    } catch(_){}
    return result;
  }

  const API=Object.freeze({
    VERSION,normalizeId,inventoryView,inferredTaste,concreteRecipe,previewCook,
    finishedFoodItem,executeCook,
  });

  global.LuminousCookingRuntime=API;
  if (typeof module!=="undefined" && module.exports) module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
