(function (global) {
  "use strict";

  if (global.LuminousCookingEquipmentEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingEquipmentEngine;
    return;
  }

  const VERSION = 1;

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function freezeList(values) {
    return Object.freeze((values || []).map(normalizeId).filter(Boolean));
  }

  function station(id, label, tags = []) {
    return Object.freeze({ id:normalizeId(id), label, tags:freezeList(tags) });
  }

  const STATIONS = Object.freeze({
    prep_surface: station("prep_surface","Prep Surface",["prep","assembly","kneading"]),
    cooktop: station("cooktop","Cooktop",["boiling","pan_fry","simmer","stir_fry"]),
    grill: station("grill","Grill",["grill"]),
    steamer: station("steamer","Steamer",["steam"]),
    oven: station("oven","Oven",["bake","roast"]),
    fryer: station("fryer","Fryer",["deep_fry"]),
    smoker: station("smoker","Smoker",["smoke"]),
    preservation_station: station("preservation_station","Preservation Station",["cure","pickle","dry"]),
    fermentation_station: station("fermentation_station","Fermentation Station",["ferment"]),
    brewery: station("brewery","Brewery",["brew"]),
    distillation_station: station("distillation_station","Distillation Station",["distill"]),
    precision_kitchen: station("precision_kitchen","Precision Kitchen",["delicate"]),
  });

  function profile(def) {
    return Object.freeze({
      method: normalizeId(def.method),
      requiredToolIds: freezeList(def.requiredToolIds),
      preferredToolIds: freezeList(def.preferredToolIds),
      requiredStationIds: freezeList(def.requiredStationIds),
      preferredStationIds: freezeList(def.preferredStationIds),
    });
  }

  const METHOD_EQUIPMENT = Object.freeze({
    assemble: profile({method:"assemble",requiredToolIds:["cooks_utensils"],preferredStationIds:["prep_surface"]}),
    cut: profile({method:"cut",requiredToolIds:["cooks_utensils"],preferredStationIds:["prep_surface"]}),
    simple_mix: profile({method:"simple_mix",requiredToolIds:["cooks_utensils"],preferredStationIds:["prep_surface"]}),
    mixing: profile({method:"mixing",requiredToolIds:["cooks_utensils"],preferredStationIds:["prep_surface"]}),
    basic_boil: profile({method:"basic_boil",requiredToolIds:["cooks_utensils"],requiredStationIds:["cooktop"]}),
    grill: profile({method:"grill",requiredToolIds:["cooks_utensils"],requiredStationIds:["grill"]}),
    pan_fry: profile({method:"pan_fry",requiredToolIds:["cooks_utensils"],requiredStationIds:["cooktop"]}),
    steam: profile({method:"steam",requiredToolIds:["cooks_utensils"],requiredStationIds:["steamer"]}),
    roast: profile({method:"roast",requiredToolIds:["cooks_utensils"],requiredStationIds:["oven"]}),
    knead: profile({method:"knead",requiredToolIds:["cooks_utensils"],preferredStationIds:["prep_surface"]}),
    simmer: profile({method:"simmer",requiredToolIds:["cooks_utensils"],requiredStationIds:["cooktop"]}),
    stir_fry: profile({method:"stir_fry",requiredToolIds:["cooks_utensils"],requiredStationIds:["cooktop"]}),
    bake: profile({method:"bake",requiredToolIds:["cooks_utensils"],requiredStationIds:["oven"]}),
    deep_fry: profile({method:"deep_fry",requiredToolIds:["cooks_utensils"],requiredStationIds:["fryer","cooktop"]}),
    smoke: profile({method:"smoke",requiredToolIds:["cooks_utensils"],requiredStationIds:["smoker"]}),
    cure: profile({method:"cure",requiredToolIds:["cooks_utensils"],requiredStationIds:["preservation_station"]}),
    pickle: profile({method:"pickle",requiredToolIds:["cooks_utensils"],requiredStationIds:["preservation_station"]}),
    dry: profile({method:"dry",requiredToolIds:["cooks_utensils"],requiredStationIds:["preservation_station"]}),
    ferment: profile({method:"ferment",requiredToolIds:["brewers_supplies"],preferredToolIds:["cooks_utensils"],requiredStationIds:["fermentation_station"]}),
    brew: profile({method:"brew",requiredToolIds:["brewers_supplies"],preferredToolIds:["cooks_utensils"],requiredStationIds:["brewery"]}),
    distill: profile({method:"distill",requiredToolIds:["brewers_supplies"],preferredToolIds:["cooks_utensils"],requiredStationIds:["distillation_station"]}),
    delicate: profile({method:"delicate",requiredToolIds:["cooks_utensils"],requiredStationIds:["precision_kitchen"]}),
  });

  const STATION_ALIASES = Object.freeze({
    stove:"cooktop", range:"cooktop", kitchen_range:"cooktop",
    barbecue:"grill", bbq:"grill",
    steam_station:"steamer",
    baking_oven:"oven", roasting_oven:"oven",
    deep_fryer:"fryer",
    smokehouse:"smoker",
    curing_station:"preservation_station", drying_rack:"preservation_station", pickling_station:"preservation_station",
    fermenter:"fermentation_station",
    brewing_station:"brewery",
    still:"distillation_station",
    culinary_lab:"precision_kitchen",
  });

  function canonicalStationId(value) {
    const id=normalizeId(value);
    return STATION_ALIASES[id] || id;
  }

  function objectEntries(value) {
    if (Array.isArray(value)) return value.map((item,index)=>[String(index),item]);
    return value && typeof value==="object" ? Object.entries(value) : [];
  }

  function itemDefinitionId(item={}) {
    return normalizeId(item.definitionId || item.definition_id || item.itemId || item.item_id || item.canonicalId || item.id || item.key);
  }

  function carriedToolIds(unit={}) {
    const ids=new Set();
    for (const container of [unit.inventario_activo,unit.activeInventory,unit.inventory,unit.inventario,unit.inventario_stash,unit.stashInventory,unit.stash,unit.equipment]) {
      for (const [,item] of objectEntries(container)) {
        if (!item || Number(item.quantity ?? item.qty ?? item.cantidad ?? 1) <= 0) continue;
        const id=itemDefinitionId(item);
        if (id) ids.add(id);
      }
    }
    return [...ids];
  }

  function proficiencyFor(unit={}, toolId, options={}) {
    if (Number.isFinite(Number(options.proficiency))) return Math.max(0,Math.floor(Number(options.proficiency)));
    const id=normalizeId(toolId);
    const stores=[unit.toolProficiencies,unit.tool_proficiencies,unit.proficiencies?.tools,unit.proficiencies];
    for (const store of stores) {
      if (!store || typeof store!=="object") continue;
      const raw=store[id];
      if (raw === true) return Math.max(1,Math.floor(Number(unit.proficiency ?? unit.proficiencyBonus ?? 1) || 1));
      if (Number.isFinite(Number(raw))) return Math.max(0,Math.floor(Number(raw)));
      if (raw && typeof raw==="object") {
        if (Number.isFinite(Number(raw.value ?? raw.proficiency))) return Math.max(0,Math.floor(Number(raw.value ?? raw.proficiency)));
        if (raw.proficient===true) return Math.max(1,Math.floor(Number(unit.proficiency ?? unit.proficiencyBonus ?? 1) || 1));
      }
    }
    return 0;
  }

  function profileForRecipe(recipe={}) {
    const method=normalizeId(recipe.method);
    const base=METHOD_EQUIPMENT[method] || profile({method});
    const override=recipe.equipment && typeof recipe.equipment==="object" ? recipe.equipment : {};
    return Object.freeze({
      method,
      requiredToolIds: freezeList(override.requiredToolIds || base.requiredToolIds),
      preferredToolIds: freezeList(override.preferredToolIds || base.preferredToolIds),
      requiredStationIds: freezeList(override.requiredStationIds || base.requiredStationIds),
      preferredStationIds: freezeList(override.preferredStationIds || base.preferredStationIds),
    });
  }

  function evaluate(recipe={}, unit={}, options={}) {
    const req=profileForRecipe(recipe);
    const toolIds=new Set((options.availableToolIds || carriedToolIds(unit)).map(normalizeId));
    const stationIds=new Set([
      ...(options.availableStationIds || []),
      options.stationId,
      unit.currentCookingStationId,
      unit.cookingStationId,
    ].map(canonicalStationId).filter(Boolean));

    const hasRequiredTool=req.requiredToolIds.length===0 || req.requiredToolIds.some(id=>toolIds.has(id));
    const hasRequiredStation=req.requiredStationIds.length===0 || req.requiredStationIds.some(id=>stationIds.has(id));
    const hasCooksUtensils=options.hasCooksUtensils != null ? options.hasCooksUtensils===true : toolIds.has("cooks_utensils");
    const cookProf=proficiencyFor(unit,"cooks_utensils",options);
    const improperEquipmentCount=(hasRequiredTool?0:1)+(hasRequiredStation?0:1);

    return Object.freeze({
      profile:req,
      availableToolIds:Object.freeze([...toolIds]),
      availableStationIds:Object.freeze([...stationIds]),
      hasRequiredTool,
      hasRequiredStation,
      missingToolIds:Object.freeze(hasRequiredTool?[]:[...req.requiredToolIds]),
      missingStationIds:Object.freeze(hasRequiredStation?[]:[...req.requiredStationIds]),
      improperEquipmentCount,
      hasCooksUtensils,
      proficient:cookProf>0,
      proficiency:cookProf,
      stationThModifier:0,
      toolThModifier:0,
    });
  }

  const API=Object.freeze({
    VERSION,STATIONS,METHOD_EQUIPMENT,STATION_ALIASES,
    normalizeId,canonicalStationId,carriedToolIds,proficiencyFor,profileForRecipe,evaluate,
  });

  global.LuminousCookingEquipmentEngine=API;
  if (typeof module!=="undefined" && module.exports) module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
