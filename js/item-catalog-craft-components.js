(function (global) {
  "use strict";

  if (global.LuminousCraftComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCraftComponentCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "craft_components";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const PRICING_MODEL = "consumed_input_value_x_process_multiplier";
  const RETAIL_MARKUP_INCLUDED = false;
  const IMPROVISED_THRESHOLD_PENALTY = 3;
  const STATION_REQUIREMENTS_STATUS = "deferred";

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

  function requirement(...tags) {
    return Object.freeze({
      kind: "material_requirement",
      tags: Object.freeze(tags.flat().map(normalizeId).filter(Boolean)),
      quantity: null,
      quantityResolution: "recipe_or_material_lineage",
    });
  }

  function process(id, label, craftBaseMultiplier, semanticCheck, requiredToolType, baseThreshold, tier) {
    return Object.freeze({
      id: normalizeId(id),
      label,
      craftBaseMultiplier,
      semanticCheck: normalizeId(semanticCheck),
      requiredToolType: normalizeId(requiredToolType),
      baseThreshold,
      tier: normalizeId(tier),
      improvisationAllowed: true,
      improvisedThresholdDelta: IMPROVISED_THRESHOLD_PENALTY,
      stationRequirement: null,
      stationRequirementStatus: STATION_REQUIREMENTS_STATUS,
    });
  }

  const PROCESSES = Object.freeze({
    processed_stock: process("processed_stock", "Processed Stock", 1.20, "fabrication", "fabrication_tools", 18, "generic"),
    wire_cable: process("wire_cable", "Wire / Cable Processing", 1.25, "fabrication", "fabrication_tools", 18, "generic"),
    textile_processing: process("textile_processing", "Textile Processing", 1.25, "textile_work", "textile_tools", 18, "generic"),
    leather_processing: process("leather_processing", "Leather Processing", 1.25, "leatherworking", "textile_tools", 18, "generic"),
    paper_processing: process("paper_processing", "Paper Processing", 1.20, "fabrication", "fabrication_tools", 18, "generic"),
    container_fabrication: process("container_fabrication", "Container Fabrication", 1.25, "fabrication", "fabrication_tools", 18, "generic"),
    hardware_fabrication: process("hardware_fabrication", "Fastener / Hardware Fabrication", 1.30, "metalworking", "smithing_tools", 18, "generic"),
    structural_fabrication: process("structural_fabrication", "Structural Fabrication", 1.30, "fabrication", "fabrication_tools", 18, "generic"),
    housing_fabrication: process("housing_fabrication", "Housing / Casing Fabrication", 1.35, "fabrication", "fabrication_tools", 18, "generic"),
    glass_fabrication: process("glass_fabrication", "Glass Fabrication", 1.35, "glass_ceramic_fabrication", "fabrication_tools", 18, "generic"),
    ceramic_fabrication: process("ceramic_fabrication", "Ceramic Fabrication", 1.35, "glass_ceramic_fabrication", "fabrication_tools", 18, "generic"),
    chemical_processing: process("chemical_processing", "Chemical Processing", 1.40, "chemical_processing", "chemical_tools", 22, "workshop"),
    resistant_container_fabrication: process("resistant_container_fabrication", "Chemical-resistant Container Fabrication", 1.45, "chemical_processing", "chemical_tools", 22, "workshop"),
    electrical_fabrication: process("electrical_fabrication", "Electrical Fabrication", 1.50, "electrical_fabrication", "technical_tools", 22, "workshop"),
    mechanical_fabrication: process("mechanical_fabrication", "Mechanical Fabrication", 1.50, "mechanical_fabrication", "technical_tools", 22, "workshop"),
    precision_fabrication: process("precision_fabrication", "Precision Fabrication", 1.65, "precision_fabrication", "technical_tools", 22, "workshop"),
    optical_fabrication: process("optical_fabrication", "Optical / Lapidary Fabrication", 1.65, "lapidary_precision", "lapidary_tools", 22, "workshop"),
    calibration_fabrication: process("calibration_fabrication", "Calibration Fabrication", 1.70, "technical_diagnostics", "technical_tools", 22, "workshop"),
    electronics_fabrication: process("electronics_fabrication", "Electronics Fabrication", 1.65, "electronics", "technical_tools", 22, "workshop"),
    circuitry_fabrication: process("circuitry_fabrication", "Circuitry Fabrication", 1.80, "electronics", "technical_tools", 22, "workshop"),
    sensor_fabrication: process("sensor_fabrication", "Sensor Fabrication", 1.85, "technical_diagnostics", "technical_tools", 22, "workshop"),
    augment_grade_fabrication: process("augment_grade_fabrication", "Augment-grade Fabrication", 2.00, "advanced_technical_fabrication", "technical_tools", 28, "corp_wing"),
    corp_precision_fabrication: process("corp_precision_fabrication", "Corp / Wing Precision Fabrication", 2.20, "advanced_precision", "technical_tools", 28, "corp_wing"),
    exotic_industrial_fabrication: process("exotic_industrial_fabrication", "Exotic Industrial Fabrication", 2.50, "specialized_craft", "fabrication_tools", 28, "corp_wing"),
  });

  function component(def) {
    const processDef = PROCESSES[normalizeId(def.processId)];
    if (!processDef) throw new Error(`Unknown craft-component process: ${def.processId}`);
    const id = normalizeId(def.id);
    const requirementTags = Object.freeze((def.requirementTags || []).map(normalizeId).filter(Boolean));
    return Object.freeze({
      id,
      name: def.name,
      family: FAMILY,
      category: "ingredient",
      itemType: "component",
      iconFamily: normalizeId(def.iconFamily || "craft_component"),
      currency: CURRENCY,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      stackable: true,
      reusableAsRecipeInput: true,
      processed: true,
      rawCraftingReagent: false,
      pricingModel: PRICING_MODEL,
      retailMarkupIncluded: RETAIL_MARKUP_INCLUDED,
      processId: processDef.id,
      craftBaseMultiplier: processDef.craftBaseMultiplier,
      semanticCheck: processDef.semanticCheck,
      requiredToolType: processDef.requiredToolType,
      baseThreshold: processDef.baseThreshold,
      processTier: processDef.tier,
      stationRequirement: processDef.stationRequirement,
      stationRequirementStatus: processDef.stationRequirementStatus,
      requirementTags,
      inputRequirements: Object.freeze((def.inputRequirements || []).map((tags) => requirement(tags))),
      tags: Object.freeze([
        "ingredient",
        "craft_component",
        "processed_component",
        processDef.id,
        ...requirementTags,
        ...(def.tags || []).map(normalizeId).filter(Boolean),
      ]),
    });
  }

  const ITEMS = Object.freeze([
    component({ id: "structural_stock", name: "Structural Stock", iconFamily: "structural_stock", processId: "processed_stock", requirementTags: ["structural_stock", "wood_or_structural_stock", "refined_stock"], inputRequirements: [["refined_metal", "wood", "structural_material"]] }),
    component({ id: "fasteners_hardware", name: "Fasteners / Hardware Set", iconFamily: "fasteners_hardware", processId: "hardware_fabrication", requirementTags: ["fasteners", "hardware", "generic_component"], inputRequirements: [["refined_metal"]] }),
    component({ id: "wire_cable", name: "Wire / Cable", iconFamily: "wire_cable", processId: "wire_cable", requirementTags: ["wire", "cable", "conductor", "generic_component"], inputRequirements: [["refined_metal", "fiber", "conductive_material"]] }),
    component({ id: "processed_textile", name: "Processed Textile", iconFamily: "textile", processId: "textile_processing", requirementTags: ["textile", "textile_component", "textile_or_fiber"], inputRequirements: [["raw_fiber", "silk", "wool", "textile_feedstock"]] }),
    component({ id: "processed_leather", name: "Processed Leather", iconFamily: "hide_mammal", processId: "leather_processing", requirementTags: ["leather", "hide_or_leather", "textile_or_hide"], inputRequirements: [["hide", "pelt", "skin"]] }),
    component({ id: "paper_stock", name: "Paper Stock", iconFamily: "textile", processId: "paper_processing", requirementTags: ["paper_stock", "textile_or_paper_stock"], inputRequirements: [["fiber", "plant_fiber", "paper_feedstock"]] }),
    component({ id: "container", name: "Container", iconFamily: "container", processId: "container_fabrication", requirementTags: ["container", "generic_component"], inputRequirements: [["glass", "ceramic", "metal_stock", "structural_material"]] }),
    component({ id: "structural_component", name: "Structural Component", iconFamily: "structural_stock", processId: "structural_fabrication", requirementTags: ["structural_component", "generic_component"], inputRequirements: [["structural_stock", "refined_metal", "wood_or_structural_stock"]] }),
    component({ id: "structural_handle", name: "Handle / Grip / Frame Component", iconFamily: "craft_component", processId: "structural_fabrication", requirementTags: ["structural_handle", "handle", "grip", "frame_component", "generic_component"], inputRequirements: [["structural_stock", "wood_or_structural_stock", "refined_metal"]] }),
    component({ id: "housing_casing", name: "Housing / Casing", iconFamily: "craft_component", processId: "housing_fabrication", requirementTags: ["housing", "casing", "generic_component", "structural_component"], inputRequirements: [["structural_stock", "refined_metal", "structural_material"]] }),
    component({ id: "glass_component", name: "Glass Component", iconFamily: "glass_component", processId: "glass_fabrication", requirementTags: ["glass_component", "glass_or_ceramic_component", "glass_or_optical_material"], inputRequirements: [["glass", "quartz", "glass_feedstock"]] }),
    component({ id: "ceramic_component", name: "Ceramic Component", iconFamily: "craft_component", processId: "ceramic_fabrication", requirementTags: ["ceramic_component", "glass_or_ceramic_component", "structural_component"], inputRequirements: [["clay", "ceramic_feedstock"]] }),
    component({ id: "chemical_component", name: "Chemical Component", iconFamily: "chemical", processId: "chemical_processing", requirementTags: ["chemical_component", "pigment_or_chemical"], inputRequirements: [["chemical_reagent", "botanical_extract", "ooze", "secretion"]] }),
    component({ id: "adhesive_binder_sealant", name: "Adhesive / Binder / Sealant", iconFamily: "chemical", processId: "chemical_processing", requirementTags: ["adhesive", "binder", "sealant", "chemical_component"], inputRequirements: [["chemical_reagent", "resin", "adhesive_ooze"]] }),
    component({ id: "pigment_marking_supply", name: "Pigment / Marking Supply", iconFamily: "chemical", processId: "chemical_processing", requirementTags: ["pigment", "marking_supply", "pigment_or_chemical"], inputRequirements: [["pigment_source", "ink", "chemical_reagent"]] }),
    component({ id: "chemical_resistant_container", name: "Chemical-resistant Container", iconFamily: "container", processId: "resistant_container_fabrication", requirementTags: ["chemical_resistant_container", "container"], inputRequirements: [["glass_component", "ceramic_component", "corrosion_resistant_material"], ["chemical_component", "sealant"]] }),
    component({ id: "mechanical_parts", name: "Mechanical Parts", iconFamily: "scrap_mechanical", processId: "mechanical_fabrication", requirementTags: ["mechanical_parts", "generic_component"], inputRequirements: [["structural_stock", "refined_metal"], ["fasteners", "hardware"]] }),
    component({ id: "gear_spring_bearing_assembly", name: "Gear / Spring / Bearing Assembly", iconFamily: "scrap_mechanical", processId: "mechanical_fabrication", requirementTags: ["mechanical_parts", "mechanical_assembly"], inputRequirements: [["mechanical_parts", "refined_metal"], ["precision_component", "fasteners", "hardware"]] }),
    component({ id: "precision_component", name: "Precision Component", iconFamily: "precision_component", processId: "precision_fabrication", requirementTags: ["precision_component"], inputRequirements: [["refined_metal", "structural_stock", "mechanical_parts"]] }),
    component({ id: "optical_component", name: "Optical Component", iconFamily: "precision_component", processId: "optical_fabrication", requirementTags: ["optical_component", "glass_or_optical_material", "precision_component"], inputRequirements: [["glass_component", "quartz", "cut_gem", "optical_material"]] }),
    component({ id: "calibration_component", name: "Calibration Component", iconFamily: "precision_component", processId: "calibration_fabrication", requirementTags: ["calibration_component", "precision_component"], inputRequirements: [["precision_component"], ["mechanical_parts", "electronic_parts"]] }),
    component({ id: "electrical_component", name: "Electrical Component", iconFamily: "electronic_parts", processId: "electrical_fabrication", requirementTags: ["electrical_component", "electronic_parts"], inputRequirements: [["wire", "cable", "conductive_material"], ["insulator", "structural_component"]] }),
    component({ id: "electronic_parts", name: "Electronic Parts", iconFamily: "electronic_parts", processId: "electronics_fabrication", requirementTags: ["electronic_parts"], inputRequirements: [["electrical_component", "wire", "conductive_material"], ["precision_component", "structural_component"]] }),
    component({ id: "circuitry", name: "Circuitry", iconFamily: "circuitry", processId: "circuitry_fabrication", requirementTags: ["circuitry"], inputRequirements: [["electronic_parts"], ["wire", "conductive_material"], ["precision_component"]] }),
    component({ id: "sensor_component", name: "Sensor Component", iconFamily: "electronic_parts", processId: "sensor_fabrication", requirementTags: ["sensor_component", "electronic_parts", "precision_component"], inputRequirements: [["circuitry", "electronic_parts"], ["precision_component", "optical_component"]] }),
    component({ id: "augment_grade_component", name: "Augment-grade Component", iconFamily: "precision_component", processId: "augment_grade_fabrication", requirementTags: ["augment_grade_component", "advanced_component"], inputRequirements: [["precision_component", "circuitry", "sensor_component"], ["augment_grade_alloy", "advanced_material"]] }),
    component({ id: "corp_wing_precision_component", name: "Corp / Wing Precision Component", iconFamily: "precision_component", processId: "corp_precision_fabrication", requirementTags: ["corp_wing_precision_component", "advanced_component", "precision_component"], inputRequirements: [["augment_grade_component", "precision_component"], ["advanced_electronic_component", "circuitry"]] }),
    component({ id: "exotic_industrial_component", name: "Exotic Industrial Component", iconFamily: "craft_component", processId: "exotic_industrial_fabrication", requirementTags: ["exotic_industrial_component", "advanced_component", "generic_component"], inputRequirements: [["exotic_refined_material", "exotic_alloy", "exotic_material"], ["precision_component", "mechanical_parts", "circuitry"]] }),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(ITEMS.map((entry) => [entry.id, entry])));
  const ALIASES = Object.freeze({
    hardware: "fasteners_hardware",
    fasteners: "fasteners_hardware",
    wire: "wire_cable",
    cable: "wire_cable",
    textile_component: "processed_textile",
    leather: "processed_leather",
    paper: "paper_stock",
    generic_container: "container",
    housing: "housing_casing",
    casing: "housing_casing",
    glass: "glass_component",
    ceramic: "ceramic_component",
    chemicals: "chemical_component",
    marking_supply: "pigment_marking_supply",
    precision_components: "precision_component",
    electronics: "electronic_parts",
    circuit: "circuitry",
    sensor: "sensor_component",
  });

  function get(id) {
    const key = normalizeId(id);
    const resolved = Object.prototype.hasOwnProperty.call(ALIASES, key) ? ALIASES[key] : key;
    const found = Object.prototype.hasOwnProperty.call(BY_ID, resolved) ? BY_ID[resolved] : null;
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = normalizeId(options.iconFamily);
    const processId = normalizeId(options.processId);
    const semanticCheck = normalizeId(options.semanticCheck);
    const requiredToolType = normalizeId(options.requiredToolType);
    const requirementTag = normalizeId(options.requirementTag);
    const tier = normalizeId(options.tier || options.processTier);
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !processId || entry.processId === processId)
      .filter((entry) => !semanticCheck || entry.semanticCheck === semanticCheck)
      .filter((entry) => !requiredToolType || entry.requiredToolType === requiredToolType)
      .filter((entry) => !requirementTag || entry.requirementTags.includes(requirementTag))
      .filter((entry) => !tier || entry.processTier === tier)
      .map(clone);
  }

  function consumedInputValueAhn(inputs) {
    const rows = Array.isArray(inputs) ? inputs : [inputs];
    return rows.reduce((sum, input) => {
      if (input == null) return sum;
      if (typeof input === "number") return sum + Math.max(0, input);
      if (typeof input === "object") {
        const quantity = Math.max(0, Number(input.quantity ?? 1) || 0);
        const unitValue = Math.max(0, Number(input.unitValueAhn ?? input.valueAhn ?? input.standardValueAhn ?? 0) || 0);
        return sum + (quantity * unitValue);
      }
      return sum;
    }, 0);
  }

  function craftBaseValue(itemOrId, consumedInputs = [], options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const inputValue = consumedInputValueAhn(consumedInputs);
    const raw = inputValue * Number(entry.craftBaseMultiplier || 1);
    const rounding = normalizeId(options.rounding || "round");
    if (rounding === "floor") return Math.floor(raw);
    if (rounding === "ceil") return Math.ceil(raw);
    return Math.round(raw);
  }

  function craftedValueForQuality(itemOrId, consumedInputs = [], quality = DEFAULT_QUALITY, options = {}) {
    const base = craftBaseValue(itemOrId, consumedInputs, options);
    if (base == null) return null;
    const engine = qualityEngine();
    return engine?.applyValue ? engine.applyValue(base, quality, { rounding: options.rounding || "round" }) : base;
  }

  function satisfiesRequirement(itemOrId, requirementTag) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    const tag = normalizeId(requirementTag);
    return Boolean(entry && tag && (entry.requirementTags.includes(tag) || entry.tags.includes(tag)));
  }

  function resolveRequirement(requirementTag) {
    const tag = normalizeId(requirementTag);
    if (!tag) return [];
    return ITEMS.filter((entry) => entry.requirementTags.includes(tag) || entry.tags.includes(tag)).map(clone);
  }

  function getRecipe(itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const processDef = PROCESSES[entry.processId];
    return clone({
      id: `craft_${entry.id}`,
      operation: "create",
      outputItemId: entry.id,
      outputQuantity: 1,
      inputRequirements: entry.inputRequirements,
      pricingModel: PRICING_MODEL,
      craftBaseMultiplier: entry.craftBaseMultiplier,
      retailMarkupIncluded: RETAIL_MARKUP_INCLUDED,
      semanticCheck: entry.semanticCheck,
      requiredToolType: entry.requiredToolType,
      requiredToolConsumed: false,
      baseThreshold: entry.baseThreshold,
      processTier: entry.processTier,
      improvisationAllowed: processDef.improvisationAllowed,
      improvisedThresholdDelta: processDef.improvisedThresholdDelta,
      stationRequirement: entry.stationRequirement,
      stationRequirementStatus: entry.stationRequirementStatus,
      outputQuality: "craft_check",
      workUnits: null,
      workUnitsStatus: "deferred",
    });
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    PRICING_MODEL,
    RETAIL_MARKUP_INCLUDED,
    IMPROVISED_THRESHOLD_PENALTY,
    STATION_REQUIREMENTS_STATUS,
    PROCESSES,
    ITEMS,
    ALIASES,
    get,
    list,
    getRecipe,
    consumedInputValueAhn,
    craftBaseValue,
    craftedValueForQuality,
    satisfiesRequirement,
    resolveRequirement,
  });

  global.LuminousCraftComponentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
