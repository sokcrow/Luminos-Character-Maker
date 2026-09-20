(function (global) {
  "use strict";

  if (global.LuminousToolCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousToolCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "tools";
  const CURRENCY = "AHN";
  const AHN_ECONOMY_SCALE = 4;
  const DEFAULT_QUALITY = "standard";
  const IMPROVISED_THRESHOLD_PENALTY = 3;
  const TOOL_BASE_POWER_STATUS = "deferred_tuning";
  const RECIPE_COMPONENT_QUANTITIES_STATUS = "deferred_until_component_catalog";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
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

  function componentRequirement(...tags) {
    return Object.freeze({
      kind: "component_requirement",
      tags: Object.freeze(tags.flat().map(normalizeId).filter(Boolean)),
      quantity: null,
      quantityStatus: RECIPE_COMPONENT_QUANTITIES_STATUS,
    });
  }

  function recipe(outputItemId, requiredToolType, inputs) {
    return Object.freeze({
      id: `craft_${outputItemId}`,
      operation: "create",
      outputItemId,
      outputQuantity: 1,
      inputs: Object.freeze(inputs),
      requiredToolType: normalizeId(requiredToolType),
      requiredToolConsumed: false,
      improvisationAllowed: true,
      improvisedThresholdDelta: IMPROVISED_THRESHOLD_PENALTY,
      associatedSkill: null,
      associatedSkillResolution: "work_order_or_action",
      craftThreshold: null,
      craftThresholdResolution: "work_order_or_recipe",
      outputQuality: "craft_check",
      stationRequirement: null,
      stationRequirementStatus: "deferred",
      componentQuantitiesStatus: RECIPE_COMPONENT_QUANTITIES_STATUS,
    });
  }

  function tool(id, name, standardValueAhn, iconFamily, useTags, recipeSpec) {
    const key = normalizeId(id);
    const icon = normalizeId(iconFamily || "tool");
    return Object.freeze({
      id: key,
      name,
      family: FAMILY,
      category: "utility",
      itemType: "tool",
      iconFamily: icon,
      toolCategory: icon,
      proficiencyType: key,
      currency: CURRENCY,
      standardValueAhn: Math.round(standardValueAhn * AHN_ECONOMY_SCALE),
      purchasable: true,
      stackable: false,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      baseToolPower: null,
      baseToolPowerStatus: TOOL_BASE_POWER_STATUS,
      associatedSkill: null,
      associatedSkillResolution: "action_or_recipe",
      reusable: true,
      consumedOnUse: false,
      useTags: Object.freeze((useTags || []).map(normalizeId).filter(Boolean)),
      recipe: recipe(key, recipeSpec.requiredToolType, recipeSpec.inputs),
      tags: Object.freeze(["tool", "reusable", "crafted_item", icon]),
    });
  }

  const ITEMS = Object.freeze([
    tool("calligraphers_supplies", "Calligrapher's Supplies", 8000, "tool", ["writing", "documents", "calligraphy"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("textile_or_paper_stock"), componentRequirement("pigment_or_chemical"), componentRequirement("precision_component")] }),
    tool("painters_supplies", "Painter's Supplies", 10000, "tool", ["painting", "finishing", "pigment_work"], { requiredToolType: "chemical_tools", inputs: [componentRequirement("pigment_or_chemical"), componentRequirement("container"), componentRequirement("textile_or_fiber")] }),
    tool("disguise_kit", "Disguise Kit", 18000, "tool", ["disguise", "cosmetics", "appearance"], { requiredToolType: "textile_tools", inputs: [componentRequirement("textile"), componentRequirement("pigment_or_chemical"), componentRequirement("generic_component")] }),
    tool("cartographers_tools", "Cartographer's Tools", 20000, "tool", ["cartography", "mapping", "surveying"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("textile_or_paper_stock"), componentRequirement("precision_component"), componentRequirement("marking_supply")] }),
    tool("forgery_kit", "Forgery Kit", 25000, "tool", ["forgery", "documents", "counterfeit_documents"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("textile_or_paper_stock"), componentRequirement("pigment_or_chemical"), componentRequirement("precision_component")] }),
    tool("navigators_tools", "Navigator's Tools", 25000, "tool", ["navigation", "surveying", "orientation"], { requiredToolType: "technical_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("precision_component"), componentRequirement("glass_or_optical_material")] }),

    tool("harvesting_tools", "Harvesting Tools", 25000, "harvest_kit", ["harvest", "skinning", "butchering", "organ_extraction", "venom_collection"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("textile_or_hide"), componentRequirement("generic_component")] }),
    tool("herbalism_botanical_gathering_kit", "Herbalism / Botanical Gathering Kit", 20000, "harvest_kit", ["botanical_gathering", "herbalism", "plant_harvest"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("textile"), componentRequirement("container"), componentRequirement("generic_component")] }),

    tool("cooks_utensils", "Cook's Utensils", 15000, "cooking_tools", ["cooking", "food_prep", "boiling", "frying"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("generic_component")] }),
    tool("brewers_supplies", "Brewer's Supplies", 22000, "cooking_tools", ["brewing", "fermentation", "beverage_processing"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("container"), componentRequirement("generic_component")] }),

    tool("smiths_tools", "Smith's Tools", 35000, "smithing_tools", ["smithing", "forging", "metal_shaping", "metallurgy_manual"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("refined_metal_or_steel"), componentRequirement("generic_component")] }),

    tool("carpenters_tools", "Carpenter's Tools", 25000, "fabrication_tools", ["carpentry", "construction", "wood_fabrication"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("wood_or_structural_stock"), componentRequirement("generic_component")] }),
    tool("woodcarvers_tools", "Woodcarver's Tools", 20000, "fabrication_tools", ["woodcarving", "precision_woodwork"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("structural_handle"), componentRequirement("precision_component")] }),
    tool("masons_tools", "Mason's Tools", 30000, "fabrication_tools", ["masonry", "stonework", "construction"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("hardened_metal"), componentRequirement("generic_component")] }),
    tool("potters_tools", "Potter's Tools", 20000, "fabrication_tools", ["pottery", "ceramic_shaping", "clay_processing"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("structural_component"), componentRequirement("container"), componentRequirement("generic_component")] }),
    tool("glassblowers_tools", "Glassblower's Tools", 35000, "fabrication_tools", ["glasswork", "glass_shaping", "heat_work"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("heat_resistant_metal"), componentRequirement("generic_component")] }),

    tool("cobblers_tools", "Cobbler's Tools", 18000, "textile_tools", ["cobbling", "footwear", "leather_repair"], { requiredToolType: "textile_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("textile"), componentRequirement("hide_or_leather")] }),
    tool("weavers_tools", "Weaver's Tools", 22000, "textile_tools", ["weaving", "textile_processing", "fiber_work"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("structural_component"), componentRequirement("textile_component")] }),
    tool("leatherworkers_tools", "Leatherworker's Tools", 25000, "textile_tools", ["leatherworking", "hide_processing", "light_armor_work"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("textile_or_hide"), componentRequirement("generic_component")] }),
    tool("tailor_sewing_kit", "Tailor / Sewing Kit", 20000, "textile_tools", ["tailoring", "sewing", "textile_repair"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("precision_component"), componentRequirement("textile")] }),

    tool("medical_instruments", "Medical Instruments", 35000, "medical_tools", ["medicine", "treatment", "diagnosis"], { requiredToolType: "technical_tools", inputs: [componentRequirement("stainless_or_precision_metal"), componentRequirement("precision_component")] }),
    tool("surgical_tools", "Surgical Tools", 60000, "medical_tools", ["surgery", "transplant", "augment_installation"], { requiredToolType: "technical_tools", inputs: [componentRequirement("stainless_or_advanced_metal"), componentRequirement("precision_component")] }),

    tool("tinkers_tools", "Tinker's Tools", 40000, "technical_tools", ["tinkering", "mechanisms", "repair", "assembly"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("refined_metal"), componentRequirement("precision_component"), componentRequirement("mechanical_parts")] }),
    tool("thieves_tools", "Thieves' Tools", 35000, "technical_tools", ["locks", "mechanisms", "bypass"], { requiredToolType: "technical_tools", inputs: [componentRequirement("hardened_or_precision_metal"), componentRequirement("precision_component")] }),
    tool("electronics_tools", "Electronics Tools", 55000, "technical_tools", ["electronics", "circuitry", "technical_repair"], { requiredToolType: "technical_tools", inputs: [componentRequirement("electronic_parts"), componentRequirement("precision_component"), componentRequirement("refined_metal")] }),
    tool("diagnostic_tools", "Diagnostic Tools", 65000, "technical_tools", ["diagnostics", "calibration", "sensors"], { requiredToolType: "technical_tools", inputs: [componentRequirement("electronic_parts"), componentRequirement("circuitry"), componentRequirement("precision_component")] }),

    tool("jewelers_tools", "Jeweler's Tools", 40000, "lapidary_tools", ["jewelry", "gem_setting", "accessory_work"], { requiredToolType: "smithing_tools", inputs: [componentRequirement("hardened_metal"), componentRequirement("precision_component")] }),
    tool("lapidary_tools", "Lapidary Tools", 60000, "lapidary_tools", ["gem_cutting", "gem_polishing", "lapidary"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("hardened_metal"), componentRequirement("abrasive_mineral"), componentRequirement("precision_component")] }),

    tool("alchemists_supplies", "Alchemist's Supplies", 45000, "chemical_tools", ["alchemy", "chemical_processing", "reagents"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("glass_or_ceramic_component"), componentRequirement("chemical_component"), componentRequirement("refined_metal")] }),
    tool("poisoners_kit", "Poisoner's Kit", 50000, "chemical_tools", ["poison_processing", "venom_processing", "toxin_preparation"], { requiredToolType: "chemical_tools", inputs: [componentRequirement("chemical_component"), componentRequirement("container"), componentRequirement("precision_component")] }),
    tool("chemical_processing_tools", "Chemical Processing Tools", 55000, "chemical_tools", ["chemical_processing", "acid_processing", "ooze_processing", "extract_processing"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("chemical_resistant_container"), componentRequirement("refined_metal"), componentRequirement("precision_component")] }),

    tool("repair_kit", "Repair Kit", 30000, "repair_kit", ["repair", "maintenance", "field_service"], { requiredToolType: "fabrication_tools", inputs: [componentRequirement("mechanical_parts"), componentRequirement("refined_metal"), componentRequirement("precision_component")] }),
  ]);

  const ALIASES = Object.freeze({
    harvesting_tool: "harvesting_tools",
    harvesting_kit: "harvesting_tools",
    herbalism_kit: "herbalism_botanical_gathering_kit",
    cooks_tools: "cooks_utensils",
    cooking_utensils: "cooks_utensils",
    smithing_tools: "smiths_tools",
    smith_tools: "smiths_tools",
    sewing_kit: "tailor_sewing_kit",
    electronics_kit: "electronics_tools",
    diagnostic_kit: "diagnostic_tools",
    jewelers_kit: "jewelers_tools",
    alchemy_tools: "alchemists_supplies",
    poisoner_kit: "poisoners_kit",
  });

  function get(id) {
    const key = normalizeId(id);
    const resolved = ALIASES[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = normalizeId(options.iconFamily || options.toolCategory);
    const useTag = normalizeId(options.useTag);
    const requiredToolType = normalizeId(options.requiredToolType);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !useTag || entry.useTags.includes(useTag))
      .filter((entry) => !requiredToolType || entry.recipe.requiredToolType === requiredToolType)
      .map(clone);
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const baseValue = Number(entry.standardValueAhn) || 0;
    const engine = qualityEngine();
    return engine?.applyValue ? engine.applyValue(baseValue, quality, { rounding: "round" }) : Math.round(baseValue);
  }

  function getRecipe(itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    return entry?.recipe ? clone(entry.recipe) : null;
  }

  function resolveToolCheck(input = {}) {
    const baseThreshold = Number(input.baseThreshold ?? input.threshold ?? 0);
    const skillPower = Number(input.skillPower ?? 0) || 0;
    const hasRequiredTool = input.hasRequiredTool !== false;
    const canImprovise = input.canImprovise !== false;
    const hasToolProficiency = input.hasToolProficiency === true;
    const proficiencyPower = hasToolProficiency ? (Number(input.proficiencyPower ?? 0) || 0) : 0;

    if (!hasRequiredTool && !canImprovise) {
      return Object.freeze({ allowed: false, improvised: false, baseThreshold, threshold: baseThreshold, thresholdDelta: 0, skillPower, toolBasePower: 0, proficiencyPower, totalPower: null });
    }

    const improvised = !hasRequiredTool;
    const toolBasePower = improvised ? 0 : (Number(input.toolBasePower ?? 0) || 0);
    const thresholdDelta = improvised ? IMPROVISED_THRESHOLD_PENALTY : 0;
    const threshold = baseThreshold + thresholdDelta;
    const totalPower = skillPower + toolBasePower + proficiencyPower;

    return Object.freeze({ allowed: true, improvised, baseThreshold, threshold, thresholdDelta, skillPower, toolBasePower, proficiencyPower, totalPower });
  }

  const API = Object.freeze({ VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, IMPROVISED_THRESHOLD_PENALTY, TOOL_BASE_POWER_STATUS, RECIPE_COMPONENT_QUANTITIES_STATUS, ITEMS, ALIASES, normalizeId, get, list, unitValueForQuality, getRecipe, resolveToolCheck });

  global.LuminousToolCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
