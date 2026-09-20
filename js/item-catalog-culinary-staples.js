(function (global) {
  "use strict";

  if (global.LuminousCulinaryStaplesCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCulinaryStaplesCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "culinary_staples";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const MEASURE = "unit";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function affinityEngine() {
    return global.LuminousItemAffinityEngine || safeRequire("./item-affinity-engine.js");
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  }

  function processingEngine() {
    return global.LuminousItemProcessingEngine || safeRequire("./item-processing-engine.js");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function freezeTags(values) {
    return Object.freeze((values || []).map(normalizeId).filter(Boolean));
  }

  function affinity(spec = {}) {
    const entries = Object.entries(spec).map(([target, weight]) => [normalizeId(target), Number(weight) || 0]);
    const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
    if (total !== 100) throw new Error(`Culinary staple affinity distribution must total 100, got ${total}.`);
    return Object.freeze(Object.fromEntries(entries));
  }

  function item(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      family: FAMILY,
      group: normalizeId(def.group || "staple"),
      iconFamily: def.iconFamily || "food",
      category: "ingredient",
      itemType: "material",
      sourceLine: def.sourceLine || "culinary_market",
      purchasable: true,
      currency: CURRENCY,
      standardUnitValueAhn: Math.max(0, Math.round(Number(def.standardUnitValueAhn) || 0)),
      measure: MEASURE,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      stackable: true,
      stackPolicy: "identical_item_quality_affinity",
      cookingReady: true,
      edibleRaw: def.edibleRaw !== false,
      taste: Math.max(0, Math.min(4, Math.round(Number(def.taste ?? 2) || 0))),
      culinaryAffinities: affinity(def.culinaryAffinities || {}),
      culinaryAffinityProfileId: def.culinaryAffinityProfileId || `staple_${normalizeId(def.id)}`,
      recipeRoles: freezeTags(def.recipeRoles),
      flavorTags: freezeTags(def.flavorTags),
      functionalTags: freezeTags(def.functionalTags),
      craftTags: freezeTags(def.craftTags),
      itemTags: freezeTags(["ingredient", "culinary_staple", "raw", def.group || "staple", ...(def.itemTags || [])]),
      processingMethodsAllowed: freezeTags(def.processingMethodsAllowed),
      processingMethodsDenied: freezeTags(def.processingMethodsDenied),
    });
  }

  const ITEMS = Object.freeze([
    item({
      id:"egg", name:"Egg", group:"animal_product", iconFamily:"food", standardUnitValueAhn:1800, taste:2,
      recipeRoles:["egg","protein","binder"], flavorTags:["rich","neutral"],
      functionalTags:["baking","coating_support","filling"],
      processingMethodsAllowed:["simple_mix","boil","pan_fry","bake"],
      culinaryAffinities:{con_save:30,medicine:20,athletics:20,survival:15,animal_handling:15},
    }),
    item({
      id:"milk", name:"Milk", group:"dairy", iconFamily:"food", standardUnitValueAhn:2200, taste:2,
      recipeRoles:["dairy","liquid","binder"], flavorTags:["rich","mild"],
      functionalTags:["cream_source","cheese_source","butter_source","fermentable"],
      processingMethodsAllowed:["press","simple_mix","boil","ferment"],
      culinaryAffinities:{con_save:30,medicine:25,survival:20,animal_handling:15,wis_save:10},
    }),
    item({
      id:"seaweed", name:"Seaweed", group:"aquatic_produce", iconFamily:"vegetable_raw", standardUnitValueAhn:1800, taste:2,
      recipeRoles:["vegetable","seaweed","seasoning"], flavorTags:["savory","briny"],
      functionalTags:["aquatic","wrapper_support","garnish"],
      processingMethodsAllowed:["cut","dry","simple_mix","simmer"],
      culinaryAffinities:{survival:30,nature:30,perception:20,medicine:20},
    }),
    item({
      id:"avocado", name:"Avocado", group:"fruit", iconFamily:"fruit_raw", standardUnitValueAhn:3200, taste:3,
      recipeRoles:["fruit","rich_fruit","fat"], flavorTags:["rich","fresh"],
      functionalTags:["paste_source","filling"],
      processingMethodsAllowed:["cut","chop","mash","simple_mix"],
      culinaryAffinities:{con_save:30,survival:25,medicine:20,nature:15,athletics:10},
    }),
    item({
      id:"honey", name:"Honey", group:"sweetener", iconFamily:"botanical_extract_raw", standardUnitValueAhn:3800, taste:4,
      recipeRoles:["sweetener","binder"], flavorTags:["sweet","aromatic"],
      functionalTags:["sweetener_base","syrup","preservation_support"],
      processingMethodsAllowed:["simple_mix","reduce","bake","brew"],
      culinaryAffinities:{survival:25,medicine:25,perception:20,con_save:15,nature:15},
    }),
    item({
      id:"sugar_cane", name:"Sugar Cane", group:"sweetener_crop", iconFamily:"vegetable_raw", standardUnitValueAhn:1400, taste:3,
      recipeRoles:["plant","sweetener_source"], flavorTags:["sweet"],
      functionalTags:["juice","sweetener_base","refine_sugar"],
      processingMethodsAllowed:["cut","crush","juice","press","reduce"],
      culinaryAffinities:{nature:25,con_save:25,survival:20,athletics:15,medicine:15},
    }),
    item({
      id:"water", name:"Water", group:"liquid", iconFamily:"drink", standardUnitValueAhn:500, taste:1,
      recipeRoles:["water","liquid"], flavorTags:["neutral","fresh"],
      functionalTags:["hydrating","dough_liquid","boil_support","brew_base"],
      processingMethodsAllowed:["simple_mix","boil","brew"],
      itemTags:["drink"],
      culinaryAffinities:{con_save:30,survival:25,medicine:20,perception:15,nature:10},
    }),
    item({
      id:"salt", name:"Salt", group:"seasoning", iconFamily:"spice_herb_raw", standardUnitValueAhn:1200, taste:0,
      recipeRoles:["seasoning","salt","mineral"], flavorTags:["salty"],
      functionalTags:["seasoning","preservation_support","cure_support"],
      processingMethodsAllowed:["simple_mix"], edibleRaw:false,
      culinaryAffinities:{con_save:30,survival:25,medicine:20,perception:15,investigation:10},
    }),
    item({
      id:"yeast", name:"Yeast", group:"culture", iconFamily:"fungus_raw", standardUnitValueAhn:1800, taste:0,
      recipeRoles:["culture","fermentation_agent"], flavorTags:["fermented"],
      functionalTags:["culture","fermentable","bread_leavening"],
      processingMethodsAllowed:["simple_mix","ferment"], edibleRaw:false,
      culinaryAffinities:{nature:30,investigation:25,history:20,con_save:15,survival:10},
    }),
    item({
      id:"beeswax", name:"Beeswax", group:"culinary_material", iconFamily:"botanical_extract_raw", standardUnitValueAhn:2400, taste:0,
      recipeRoles:["wax","binder"], flavorTags:["neutral"],
      functionalTags:["pastry_release","cannele_support","crafting"],
      processingMethodsAllowed:["simple_mix","delicate_extract"], edibleRaw:false,
      culinaryAffinities:{nature:25,investigation:25,survival:20,medicine:15,con_save:15},
    }),
    item({
      id:"gelatin", name:"Gelatin", group:"culinary_material", iconFamily:"food", standardUnitValueAhn:2200, taste:0,
      recipeRoles:["binder","gel"], flavorTags:["neutral"],
      functionalTags:["gelling_agent","dessert_support"],
      processingMethodsAllowed:["simple_mix","boil"], edibleRaw:false,
      culinaryAffinities:{con_save:30,medicine:25,survival:20,investigation:15,athletics:10},
    }),
    item({
      id:"jellyfish", name:"Jellyfish", group:"aquatic_protein", iconFamily:"food", standardUnitValueAhn:3500, taste:1,
      recipeRoles:["aquatic","protein","seafood"], flavorTags:["briny","mild"],
      functionalTags:["salad","slicing","aquatic"],
      processingMethodsAllowed:["cut","boil","steam","pickle","simple_mix"], edibleRaw:false,
      culinaryAffinities:{survival:30,con_save:25,perception:20,nature:15,dex_save:10},
    }),
    item({
      id:"recycled_protein", name:"Recycled Protein", group:"city_survival", iconFamily:"food", standardUnitValueAhn:2500, taste:0,
      sourceLine:"city_survival_market",
      recipeRoles:["protein","low_grade_protein","ration_base"], flavorTags:["neutral"],
      functionalTags:["processed_food","filling","survival_food"],
      processingMethodsAllowed:["grind","simple_mix","pan_fry","grill","simmer"],
      culinaryAffinities:{con_save:35,survival:30,athletics:20,medicine:15},
    }),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(ITEMS.map((entry) => [entry.id, entry])));

  function get(id) {
    const entry = BY_ID[normalizeId(id)];
    return entry ? clone(entry) : null;
  }

  function list(options = {}) {
    const group = normalizeId(options.group);
    const tag = normalizeId(options.tag);
    return ITEMS
      .filter((entry) => !group || entry.group === group)
      .filter((entry) => !tag || [
        ...entry.recipeRoles,
        ...entry.flavorTags,
        ...entry.functionalTags,
        ...entry.craftTags,
        ...entry.itemTags,
      ].includes(tag))
      .map(clone);
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    return qEngine?.applyValue
      ? qEngine.applyValue(entry.standardUnitValueAhn, quality, { rounding:"round" })
      : entry.standardUnitValueAhn;
  }

  function createIngredientStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const quality = qEngine?.getQuality
      ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id
      : normalizeId(options.quality || DEFAULT_QUALITY);
    const quantity = Math.max(0, Number(options.quantity ?? 1) || 0);
    const unitValueAhn = unitValueForQuality(entry, quality);
    const affinity = affinityEngine();
    const sourceInstanceId = String(options.sourceInstanceId || options.instanceId || "").trim() || null;
    const materialized = affinity?.materializeCulinaryAffinity
      ? affinity.materializeCulinaryAffinity({
          ...entry,
          sourceInstanceId,
          culinaryProperties: clone(options.culinaryProperties || []),
        }, {
          sourceInstanceId,
          roll: options.affinityRoll,
          rng: options.affinityRng,
        })
      : { culinaryProperties: clone(options.culinaryProperties || []) };
    const culinaryProperties = clone(materialized.culinaryProperties || []);
    const realized = culinaryProperties[0] || null;

    return {
      itemId: entry.id,
      family: FAMILY,
      group: entry.group,
      iconFamily: entry.iconFamily,
      quantity,
      measure: MEASURE,
      quality,
      stackPolicy: entry.stackPolicy,
      sourceInstanceId: materialized.sourceInstanceId || sourceInstanceId,
      culinaryProperties,
      affinityTarget: realized?.target || null,
      affinityBranch: realized?.affinityBranch || null,
      unitValueAhn,
      totalValueAhn: Math.round(unitValueAhn * quantity),
      taste: entry.taste,
      edibleRaw: entry.edibleRaw,
      recipeRoles: clone(entry.recipeRoles),
      flavorTags: clone(entry.flavorTags),
      functionalTags: clone(entry.functionalTags),
      craftTags: clone(entry.craftTags),
      itemTags: clone(entry.itemTags),
      processingMethodsAllowed: clone(entry.processingMethodsAllowed),
      processingMethodsDenied: clone(entry.processingMethodsDenied),
    };
  }

  function processingMethodsFor(itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return [];
    const engine = processingEngine();
    return engine?.availableMethodsFor ? engine.availableMethodsFor(entry) : [];
  }

  function processIngredient(stackOrId, methodId, options = {}) {
    const stack = typeof stackOrId === "string"
      ? createIngredientStack(stackOrId, options.sourceOptions || {})
      : clone(stackOrId);
    if (!stack) return null;
    const entry = get(stack.itemId || stack.id);
    if (!entry) return null;
    const engine = processingEngine();
    if (!engine?.createProcessedItem) return null;
    return engine.createProcessedItem({ ...entry, ...stack }, methodId, options);
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    MEASURE,
    ITEMS,
    get,
    list,
    unitValueForQuality,
    createIngredientStack,
    processingMethodsFor,
    processIngredient,
  });

  global.LuminousCulinaryStaplesCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
