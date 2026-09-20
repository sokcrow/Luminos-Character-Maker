(function (global) {
  "use strict";

  if (global.LuminousPlantProduceCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPlantProduceCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "plant_produce";
  const CURRENCY = "AHN";
  const AHN_ECONOMY_SCALE = 5;
  const DEFAULT_QUALITY = "standard";
  const MEASURE = "market_unit";
  const RECIPES_IMPLEMENTED = false;

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  }

  function affinityEngine() {
    return global.LuminousItemAffinityEngine || safeRequire("./item-affinity-engine.js");
  }

  function affinityCatalog() {
    return global.LuminousCulinaryAffinityCatalog || safeRequire("./item-culinary-affinity-data.js");
  }

  function processingEngine() {
    return global.LuminousItemProcessingEngine || safeRequire("./item-processing-engine.js");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function tags(values) {
    return Object.freeze((values || []).map(normalizeId).filter(Boolean));
  }

  function ingredient(id, name, group, iconFamily, standardUnitValueAhn, recipeRoles = [], flavorTags = [], functionalTags = [], craftTags = []) {
    const affinityData = affinityCatalog();
    const culinaryAffinities = affinityData?.get ? affinityData.get(id) : {};
    return Object.freeze({
      id,
      name,
      family: FAMILY,
      group,
      iconFamily,
      category: "ingredient",
      itemType: "material",
      sourceLine: "botanical_market",
      purchasable: true,
      currency: CURRENCY,
      standardUnitValueAhn: Math.round(standardUnitValueAhn * AHN_ECONOMY_SCALE),
      measure: MEASURE,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      stackable: true,
      stackPolicy: "identical_item_quality_affinity",
      cookingReady: true,
      culinaryAffinities: Object.freeze(culinaryAffinities || {}),
      culinaryAffinityProfileId: affinityData?.profileIdFor ? affinityData.profileIdFor(id) : null,
      recipesImplemented: RECIPES_IMPLEMENTED,
      rawCraftingReagent: true,
      gatheringModel: "deferred",
      recipeRoles: tags(recipeRoles),
      flavorTags: tags(flavorTags),
      functionalTags: tags(functionalTags),
      craftTags: tags(craftTags),
      itemTags: tags(["ingredient", "botanical", "raw", group]),
    });
  }

  const ITEMS = Object.freeze([
    // Fruits — 12
    ingredient("apple", "Apple", "fruit", "fruit_raw", 300, ["fruit"], ["sweet"], ["bake", "juice", "fermentable"]),
    ingredient("pear", "Pear", "fruit", "fruit_raw", 350, ["fruit"], ["sweet"], ["preserve"]),
    ingredient("orange", "Orange", "fruit", "fruit_raw", 400, ["fruit"], ["citrus", "acidic"], ["juice", "refreshing"]),
    ingredient("lemon", "Lemon", "fruit", "fruit_raw", 350, ["fruit"], ["citrus", "acidic"], ["seasoning", "preservation_support"]),
    ingredient("berry", "Berry", "fruit", "fruit_raw", 450, ["fruit"], ["berry", "sweet"], ["tea", "preserve"]),
    ingredient("strawberry", "Strawberry", "fruit", "fruit_raw", 500, ["fruit"], ["berry", "sweet"], ["dessert", "preserve"]),
    ingredient("grape", "Grape", "fruit", "fruit_raw", 450, ["fruit"], ["sweet"], ["juice", "fermentable"]),
    ingredient("peach", "Peach", "fruit", "fruit_raw", 500, ["fruit"], ["sweet"], ["preserve", "dessert"]),
    ingredient("cherry", "Cherry", "fruit", "fruit_raw", 600, ["fruit"], ["berry", "sweet"], ["dessert", "sauce"]),
    ingredient("melon", "Melon", "fruit", "fruit_raw", 500, ["fruit"], ["juicy", "fresh"], ["refreshing"]),
    ingredient("banana", "Banana", "fruit", "fruit_raw", 350, ["fruit", "starch"], ["sweet"], ["filling", "dessert"]),
    ingredient("exotic_fruit", "Exotic Fruit", "fruit", "fruit_raw", 1500, ["fruit"], ["exotic"], ["special_ingredient"], ["alchemy"]),

    // Vegetables / Produce — 14
    ingredient("potato", "Potato", "vegetable", "vegetable_raw", 200, ["vegetable", "starch"], ["earthy"], ["filling", "stew", "roast"]),
    ingredient("carrot", "Carrot", "vegetable", "vegetable_raw", 200, ["vegetable", "root"], ["sweet"], ["stew", "soup", "side"]),
    ingredient("onion", "Onion", "vegetable", "vegetable_raw", 250, ["vegetable", "aromatic"], ["savory"], ["soup", "stew", "sauce"]),
    ingredient("tomato", "Tomato", "vegetable", "vegetable_raw", 300, ["vegetable"], ["acidic"], ["sauce_base", "stew"]),
    ingredient("cabbage", "Cabbage", "vegetable", "vegetable_raw", 250, ["vegetable", "leafy"], ["savory"], ["stew", "soup", "pickle"]),
    ingredient("lettuce", "Lettuce", "vegetable", "vegetable_raw", 200, ["vegetable", "leafy"], ["fresh"], ["salad"]),
    ingredient("spinach", "Spinach", "vegetable", "vegetable_raw", 300, ["vegetable", "leafy"], ["fresh", "earthy"], ["nutritious", "soup", "side"]),
    ingredient("broccoli", "Broccoli", "vegetable", "vegetable_raw", 350, ["vegetable", "flower"], ["earthy"], ["nutritious", "side", "stir_fry"]),
    ingredient("pumpkin", "Pumpkin", "vegetable", "vegetable_raw", 450, ["vegetable", "starch"], ["sweet", "earthy"], ["soup", "bake", "filling"]),
    ingredient("beet", "Beet", "vegetable", "vegetable_raw", 300, ["vegetable", "root"], ["earthy", "sweet"], ["pigment", "side"]),
    ingredient("radish", "Radish", "vegetable", "vegetable_raw", 250, ["vegetable", "root"], ["sharp"], ["garnish", "pickle"]),
    ingredient("celery", "Celery", "vegetable", "vegetable_raw", 250, ["vegetable", "stem", "aromatic"], ["fresh", "savory"], ["broth_base", "soup"]),
    ingredient("cucumber", "Cucumber", "vegetable", "vegetable_raw", 250, ["vegetable"], ["fresh"], ["salad", "pickle", "refreshing"]),
    ingredient("bamboo_shoot", "Bamboo Shoot", "vegetable", "vegetable_raw", 500, ["vegetable", "shoot"], ["fresh"], ["stir_fry", "special_ingredient"]),

    // Grains / Legumes — 10
    ingredient("wheat", "Wheat", "grain_legume", "grain_seed_raw", 150, ["grain", "starch"], ["neutral"], ["flour_source", "bread", "noodle_base"]),
    ingredient("rice", "Rice", "grain_legume", "grain_seed_raw", 180, ["grain", "starch"], ["neutral"], ["staple", "rice_bowl", "porridge"]),
    ingredient("corn", "Corn", "grain_legume", "grain_seed_raw", 180, ["grain", "starch"], ["sweet"], ["flour_source", "oil_source", "staple"]),
    ingredient("oats", "Oats", "grain_legume", "grain_seed_raw", 160, ["grain", "starch"], ["earthy"], ["porridge", "ration_base"]),
    ingredient("barley", "Barley", "grain_legume", "grain_seed_raw", 170, ["grain", "starch"], ["earthy"], ["fermentable", "soup", "bread"]),
    ingredient("rye", "Rye", "grain_legume", "grain_seed_raw", 180, ["grain"], ["earthy"], ["flour_source", "bread"]),
    ingredient("beans", "Beans", "grain_legume", "grain_seed_raw", 220, ["legume", "protein"], ["earthy", "savory"], ["filling", "stew"]),
    ingredient("lentils", "Lentils", "grain_legume", "grain_seed_raw", 220, ["legume", "protein"], ["earthy"], ["filling", "soup", "stew"]),
    ingredient("peas", "Peas", "grain_legume", "grain_seed_raw", 200, ["legume", "vegetable", "protein"], ["sweet", "fresh"], ["side", "soup"]),
    ingredient("soybean", "Soybean", "grain_legume", "grain_seed_raw", 300, ["legume", "protein"], ["earthy"], ["oil_source", "processed_food"]),

    // Nuts / Seeds — 6
    ingredient("almond", "Almond", "nut_seed", "grain_seed_raw", 600, ["nut", "protein"], ["rich"], ["oil_source", "paste_source"]),
    ingredient("walnut", "Walnut", "nut_seed", "grain_seed_raw", 700, ["nut"], ["rich", "earthy"], ["oil_source"]),
    ingredient("peanut", "Peanut", "nut_seed", "grain_seed_raw", 350, ["nut", "protein"], ["rich"], ["oil_source", "paste_source"]),
    ingredient("sunflower_seed", "Sunflower Seed", "nut_seed", "grain_seed_raw", 300, ["seed"], ["nutty"], ["oil_source", "snack"]),
    ingredient("sesame_seed", "Sesame Seed", "nut_seed", "grain_seed_raw", 500, ["seed", "seasoning"], ["nutty"], ["oil_source"]),
    ingredient("exotic_seed", "Exotic Seed", "nut_seed", "grain_seed_raw", 1500, ["seed"], ["exotic"], ["special_ingredient"], ["alchemy"]),

    // Spices — 10
    ingredient("garlic", "Garlic", "spice", "spice_herb_raw", 350, ["spice", "aromatic"], ["savory"], ["recipe_enhancement"]),
    ingredient("ginger", "Ginger", "spice", "spice_herb_raw", 600, ["spice", "aromatic"], ["warming", "sharp"], ["tea", "recipe_enhancement"]),
    ingredient("black_pepper", "Black Pepper", "spice", "spice_herb_raw", 700, ["spice"], ["savory", "warming"], ["seasoning"]),
    ingredient("chili_pepper", "Chili Pepper", "spice", "spice_herb_raw", 600, ["spice"], ["hot"], ["stimulant_food", "seasoning"]),
    ingredient("paprika", "Paprika", "spice", "spice_herb_raw", 650, ["spice"], ["savory"], ["pigment", "seasoning"]),
    ingredient("cinnamon", "Cinnamon", "spice", "spice_herb_raw", 900, ["spice"], ["sweet", "warming"], ["dessert", "drink"]),
    ingredient("clove", "Clove", "spice", "spice_herb_raw", 1000, ["spice", "aromatic"], ["warming"], ["preservation_support", "seasoning"]),
    ingredient("nutmeg", "Nutmeg", "spice", "spice_herb_raw", 1100, ["spice", "aromatic"], ["sweet", "warming"], ["specialty_cooking"]),
    ingredient("turmeric", "Turmeric", "spice", "spice_herb_raw", 700, ["spice"], ["earthy", "bitter"], ["pigment", "medicinal_minor"], ["medicine"]),
    ingredient("rare_spice", "Rare Spice", "spice", "spice_herb_raw", 3000, ["spice"], ["rare"], ["special_ingredient", "signature_recipe"]),

    // Culinary Herbs — 6
    ingredient("basil", "Basil", "culinary_herb", "spice_herb_raw", 400, ["herb", "aromatic"], ["fresh", "savory"], ["sauce", "recipe_enhancement"]),
    ingredient("mint", "Mint", "culinary_herb", "spice_herb_raw", 450, ["herb"], ["fresh", "cooling", "aromatic"], ["tea", "drink"]),
    ingredient("rosemary", "Rosemary", "culinary_herb", "spice_herb_raw", 450, ["herb"], ["savory", "aromatic"], ["meat_pairing", "roast"]),
    ingredient("thyme", "Thyme", "culinary_herb", "spice_herb_raw", 400, ["herb"], ["savory", "aromatic"], ["stew", "soup"]),
    ingredient("sage", "Sage", "culinary_herb", "spice_herb_raw", 500, ["herb"], ["savory", "aromatic"], ["medicinal_minor", "tea"], ["medicine"]),
    ingredient("parsley", "Parsley", "culinary_herb", "spice_herb_raw", 300, ["herb"], ["fresh"], ["garnish", "recipe_enhancement"]),

    // Medicinal / Toxic Herbs — 8
    ingredient("medicinal_herb", "Medicinal Herb", "medicinal_toxic_herb", "medicinal_herb_raw", 1000, ["medicinal_herb"], ["bitter"], ["medicinal", "healing_reagent"], ["medicine", "alchemy"]),
    ingredient("bitterroot", "Bitterroot", "medicinal_toxic_herb", "medicinal_herb_raw", 1500, ["medicinal_herb", "root"], ["bitter"], ["medicinal", "digestive_reagent"], ["medicine", "alchemy"]),
    ingredient("feverleaf", "Feverleaf", "medicinal_toxic_herb", "medicinal_herb_raw", 1800, ["medicinal_herb", "leaf"], ["bitter"], ["medicinal", "fever_reagent"], ["medicine", "alchemy"]),
    ingredient("bloodleaf", "Bloodleaf", "medicinal_toxic_herb", "medicinal_herb_raw", 2000, ["medicinal_herb", "leaf"], ["earthy"], ["medicinal", "recovery_reagent"], ["medicine", "alchemy"]),
    ingredient("calming_herb", "Calming Herb", "medicinal_toxic_herb", "medicinal_herb_raw", 2000, ["medicinal_herb"], ["aromatic"], ["medicinal", "calming", "tea"], ["medicine", "alchemy"]),
    ingredient("toxic_herb", "Toxic Herb", "medicinal_toxic_herb", "medicinal_herb_raw", 1500, ["toxic_herb"], ["bitter"], ["toxic", "poison_reagent"], ["poison", "alchemy"]),
    ingredient("nightshade", "Nightshade", "medicinal_toxic_herb", "medicinal_herb_raw", 3000, ["toxic_herb"], ["bitter"], ["toxic", "potent_toxin"], ["poison", "alchemy"]),
    ingredient("exotic_medicinal_herb", "Exotic Medicinal Herb", "medicinal_toxic_herb", "medicinal_herb_raw", 7500, ["medicinal_herb"], ["exotic"], ["medicinal", "advanced_reagent", "rare"], ["medicine", "alchemy"]),

    // Fungi — 6
    ingredient("common_mushroom", "Common Mushroom", "fungus", "fungus_raw", 350, ["fungus", "edible"], ["savory", "earthy"], ["cooking"]),
    ingredient("cave_mushroom", "Cave Mushroom", "fungus", "fungus_raw", 600, ["fungus"], ["earthy"], ["cooking", "underground"]),
    ingredient("medicinal_mushroom", "Medicinal Mushroom", "fungus", "fungus_raw", 1500, ["fungus"], ["earthy"], ["medicinal", "medicine_reagent"], ["medicine", "alchemy"]),
    ingredient("toxic_mushroom", "Toxic Mushroom", "fungus", "fungus_raw", 1500, ["fungus"], ["bitter"], ["toxic", "poison_reagent"], ["poison", "alchemy"]),
    ingredient("fermentation_fungus", "Fermentation Fungus", "fungus", "fungus_raw", 800, ["fungus"], ["earthy"], ["culture", "fermentation"], ["processing"]),
    ingredient("exotic_fungus", "Exotic Fungus", "fungus", "fungus_raw", 5000, ["fungus"], ["exotic"], ["special_reagent", "rare"], ["alchemy"]),

    // Sap / Resin / Botanical Extracts — 4
    ingredient("sap", "Sap", "botanical_extract", "botanical_extract_raw", 400, ["extract", "sap"], ["sweet"], ["sweetener_base", "binder"], ["alchemy", "processing"]),
    ingredient("resin", "Resin", "botanical_extract", "botanical_extract_raw", 700, ["extract", "resin"], ["aromatic"], ["adhesive", "sealant", "chemical_processing"], ["crafting", "chemical"]),
    ingredient("plant_latex", "Plant Latex", "botanical_extract", "botanical_extract_raw", 900, ["extract", "latex"], ["neutral"], ["elastic", "binder", "material_processing"], ["crafting", "processing"]),
    ingredient("exotic_botanical_extract", "Exotic Botanical Extract", "botanical_extract", "botanical_extract_raw", 2500, ["extract"], ["exotic"], ["alchemy_reagent", "rare", "special_reagent"], ["alchemy", "crafting"]),
  ]);

  const ALIASES = Object.freeze({
    mushroom: "common_mushroom",
    common_fungus: "common_mushroom",
    medicinal_plant: "medicinal_herb",
    healing_herb: "medicinal_herb",
    poison_herb: "toxic_herb",
    botanical_extract: "exotic_botanical_extract",
    latex: "plant_latex",
  });

  function get(id) {
    const key = normalizeId(id);
    const resolved = ALIASES[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const group = normalizeId(options.group);
    const iconFamily = normalizeId(options.iconFamily);
    const recipeRole = normalizeId(options.recipeRole);
    const flavorTag = normalizeId(options.flavorTag);
    const functionalTag = normalizeId(options.functionalTag);
    const craftTag = normalizeId(options.craftTag);
    return ITEMS
      .filter((entry) => !group || entry.group === group)
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !recipeRole || entry.recipeRoles.includes(recipeRole))
      .filter((entry) => !flavorTag || entry.flavorTags.includes(flavorTag))
      .filter((entry) => !functionalTag || entry.functionalTags.includes(functionalTag))
      .filter((entry) => !craftTag || entry.craftTags.includes(craftTag))
      .map(clone);
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const baseValue = Number(entry.standardUnitValueAhn) || 0;
    return qEngine?.applyValue
      ? qEngine.applyValue(baseValue, quality, { rounding: "round" })
      : Math.round(baseValue);
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
      recipeRoles: clone(entry.recipeRoles),
      flavorTags: clone(entry.flavorTags),
      functionalTags: clone(entry.functionalTags),
      craftTags: clone(entry.craftTags),
      recipesImplemented: RECIPES_IMPLEMENTED,
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
    RECIPES_IMPLEMENTED,
    ITEMS,
    ALIASES,
    get,
    list,
    unitValueForQuality,
    createIngredientStack,
    processingMethodsFor,
    processIngredient,
  });

  global.LuminousPlantProduceCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
