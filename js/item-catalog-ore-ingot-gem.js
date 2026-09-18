(function (global) {
  "use strict";

  if (global.LuminousOreIngotGemCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousOreIngotGemCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "ore_ingot_gem";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const MATERIAL_UNIT = "material_unit";
  const MATERIAL_UNIT_ABBREVIATION = "MU";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  }

  function sizeEngine() {
    return global.LuminousItemSizeLineageEngine || safeRequire("./item-size-lineage-engine.js");
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

  function material(def) {
    return Object.freeze({
      family: FAMILY,
      category: "ingredient",
      itemType: "material",
      currency: CURRENCY,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      stackable: true,
      ...def,
      useTags: Object.freeze((def.useTags || []).map(normalizeId).filter(Boolean)),
      resonanceTags: Object.freeze((def.resonanceTags || []).map(normalizeId).filter(Boolean)),
      tags: Object.freeze((def.tags || []).map(normalizeId).filter(Boolean)),
      sourceKinds: Object.freeze((def.sourceKinds || []).map(normalizeId).filter(Boolean)),
    });
  }

  function rawMineral(id, name, standardUnitValueAhn, useTags = []) {
    return material({
      id, name, materialNoun: name, form: "raw_mineral", materialClass: "mineral",
      iconFamily: "ore_raw", standardUnitValueAhn, measure: MATERIAL_UNIT, unitAbbreviation: MATERIAL_UNIT_ABBREVIATION,
      pieceBased: false, processed: false, rawCraftingReagent: true,
      sourceKinds: ["deposit", "creature_body"], useTags,
      tags: ["ingredient", "raw_mineral", "ore", "mining", "creature_mineral_harvest"],
    });
  }

  function refinedMetal(id, name, standardUnitValueAhn, form = "refined_metal") {
    return material({
      id, name, materialNoun: name, form, materialClass: form === "alloy" ? "alloy" : "refined_metal",
      iconFamily: "metal_ingot", standardUnitValueAhn, measure: MATERIAL_UNIT, unitAbbreviation: MATERIAL_UNIT_ABBREVIATION,
      pieceBased: false, processed: true, rawCraftingReagent: false,
      sourceKinds: ["metallurgy"], useTags: ["weapons", "armor", "tools", "augments", "industrial_fabrication", "upgrade_material"],
      tags: ["ingredient", "metal_stock", "ingot", form],
    });
  }

  function gemstone(baseId, name, roughValue, cutValue, resonanceTags) {
    return [
      material({
        id: `rough_${baseId}`, name: `Rough ${name}`, materialNoun: name, form: "rough_gem", materialClass: "gemstone",
        iconFamily: "gem_rough", standardUnitValueAhn: roughValue, measure: "piece", pieceBased: true, processed: false,
        rawCraftingReagent: true, sourceKinds: ["deposit", "creature_body"], resonanceTags,
        useTags: ["lapidary_input", "enchantment_material"],
        tags: ["ingredient", "gemstone", "rough_gem", "resonant", "creature_mineral_harvest"],
      }),
      material({
        id: baseId, name, materialNoun: name, form: "cut_gem", materialClass: "gemstone",
        iconFamily: "gem_cut", standardUnitValueAhn: cutValue, measure: "piece", pieceBased: true, processed: true,
        rawCraftingReagent: false, sourceKinds: ["lapidary"], resonanceTags,
        processedFrom: `rough_${baseId}`, useTags: ["enchantment_material", "accessory_socket", "weapon_socket"],
        tags: ["ingredient", "gemstone", "cut_gem", "resonant", "enchantment"],
      }),
    ];
  }

  const RAW_MINERALS = Object.freeze([
    rawMineral("industrial_stone", "Industrial Stone", 4000, ["construction", "abrasive", "fabrication"]),
    rawMineral("clay", "Clay", 5000, ["ceramic", "insulation", "fabrication"]),
    rawMineral("coal", "Coal", 8000, ["fuel", "carbon", "metallurgy"]),
    rawMineral("lead_ore", "Lead Ore", 10000, ["shielding", "ammunition", "industry"]),
    rawMineral("iron_ore", "Iron Ore", 12000, ["weapons", "armor", "structure"]),
    rawMineral("bauxite_aluminum_ore", "Bauxite / Aluminum Ore", 14000, ["light_structure", "armor", "industry"]),
    rawMineral("zinc_ore", "Zinc Ore", 15000, ["alloying", "corrosion_protection"]),
    rawMineral("tin_ore", "Tin Ore", 16000, ["bronze", "soldering", "alloying"]),
    rawMineral("copper_ore", "Copper Ore", 18000, ["conductive", "electronics", "machinery"]),
    rawMineral("graphite_carbon_mineral", "Graphite / Carbon Mineral", 18000, ["alloying", "energy", "composite"]),
    rawMineral("manganese_ore", "Manganese Ore", 20000, ["steel", "alloying"]),
    rawMineral("obsidian", "Obsidian", 20000, ["cutting", "special_component"]),
    rawMineral("quartz", "Quartz", 22000, ["optics", "glass", "electronics"]),
    rawMineral("nickel_ore", "Nickel Ore", 24000, ["alloying", "armor", "energy"]),
    rawMineral("chromium_ore", "Chromium Ore", 30000, ["hardening", "corrosion_resistance", "alloying"]),
    rawMineral("lithium_ore", "Lithium Ore", 35000, ["battery", "energy"]),
    rawMineral("molybdenum_ore", "Molybdenum Ore", 40000, ["high_heat_alloy", "alloying"]),
    rawMineral("vanadium_ore", "Vanadium Ore", 42000, ["armor", "titanium_alloy", "alloying"]),
    rawMineral("cobalt_ore", "Cobalt Ore", 45000, ["energy", "motor", "superalloy"]),
    rawMineral("silver_ore", "Silver Ore", 55000, ["electronics", "precision", "conductive"]),
    rawMineral("tungsten_ore", "Tungsten Ore", 65000, ["weapon", "penetrator", "tooling", "high_heat"]),
    rawMineral("titanium_ore", "Titanium Ore", 75000, ["armor", "weapon", "augment", "light_structure"]),
    rawMineral("gold_ore", "Gold Ore", 80000, ["advanced_electronics", "conductive"]),
    rawMineral("niobium_ore", "Niobium Ore", 85000, ["superconductive", "alloying"]),
    rawMineral("tantalum_ore", "Tantalum Ore", 90000, ["electronics", "augment"]),
    rawMineral("rare_earth_concentrate", "Rare-Earth Concentrate", 100000, ["sensor", "motor", "advanced_technology"]),
    rawMineral("uranium_bearing_ore", "Uranium-bearing Ore", 120000, ["regulated_energy", "nuclear"]),
    rawMineral("superconductive_mineral", "Superconductive Mineral", 180000, ["energy", "corp_technology", "superconductive"]),
    rawMineral("metamaterial_ore", "Metamaterial Ore", 220000, ["advanced_armor", "experimental_technology"]),
    rawMineral("null_dampening_mineral", "Null / Dampening Mineral", 275000, ["dampening", "isolation", "special_technology"]),
    rawMineral("exotic_industrial_mineral", "Exotic Industrial Mineral", 300000, ["exotic_industry", "high_tier_crafting"]),
  ]);

  const REFINED_METALS = Object.freeze([
    refinedMetal("lead", "Lead", 18000),
    refinedMetal("iron", "Iron", 20000),
    refinedMetal("aluminum", "Aluminum", 24000),
    refinedMetal("zinc", "Zinc", 25000),
    refinedMetal("tin", "Tin", 27000),
    refinedMetal("copper", "Copper", 30000),
    refinedMetal("manganese", "Manganese", 34000),
    refinedMetal("nickel", "Nickel", 40000),
    refinedMetal("chromium", "Chromium", 50000),
    refinedMetal("lithium", "Lithium", 58000),
    refinedMetal("molybdenum", "Molybdenum", 65000),
    refinedMetal("vanadium", "Vanadium", 70000),
    refinedMetal("cobalt", "Cobalt", 75000),
    refinedMetal("silver", "Silver", 90000),
    refinedMetal("tungsten", "Tungsten", 105000),
    refinedMetal("titanium", "Titanium", 120000),
    refinedMetal("gold", "Gold", 130000),
    refinedMetal("niobium", "Niobium", 140000),
    refinedMetal("tantalum", "Tantalum", 150000),
    refinedMetal("rare_earth_refined_material", "Rare-Earth Refined Material", 175000),
    refinedMetal("refined_uranium_material", "Refined Uranium Material", 220000),
    refinedMetal("superconductive_material", "Superconductive Material", 300000),
    refinedMetal("refined_metamaterial", "Refined Metamaterial", 375000),
    refinedMetal("null_dampening_material", "Null / Dampening Material", 450000),
    refinedMetal("exotic_refined_material", "Exotic Refined Material", 500000),
  ]);

  const ALLOYS = Object.freeze([
    refinedMetal("bronze", "Bronze", 38000, "alloy"),
    refinedMetal("brass", "Brass", 42000, "alloy"),
    refinedMetal("carbon_steel", "Carbon Steel", 40000, "alloy"),
    refinedMetal("high_carbon_steel", "High-Carbon Steel", 55000, "alloy"),
    refinedMetal("stainless_steel", "Stainless Steel", 70000, "alloy"),
    refinedMetal("hardened_steel", "Hardened Steel", 90000, "alloy"),
    refinedMetal("nickel_steel", "Nickel Steel", 100000, "alloy"),
    refinedMetal("chrome_steel", "Chrome Steel", 115000, "alloy"),
    refinedMetal("cobalt_alloy", "Cobalt Alloy", 145000, "alloy"),
    refinedMetal("tungsten_alloy", "Tungsten Alloy", 170000, "alloy"),
    refinedMetal("titanium_alloy", "Titanium Alloy", 185000, "alloy"),
    refinedMetal("advanced_titanium_alloy", "Advanced Titanium Alloy", 240000, "alloy"),
    refinedMetal("superalloy", "Superalloy", 275000, "alloy"),
    refinedMetal("augment_grade_alloy", "Augment-Grade Alloy", 300000, "alloy"),
    refinedMetal("corp_composite_alloy", "Corp Composite Alloy", 450000, "alloy"),
    refinedMetal("exotic_alloy", "Exotic Alloy", 650000, "alloy"),
  ]);

  const GEMSTONE_PAIRS = Object.freeze([
    Object.freeze(gemstone("ruby", "Ruby", 15000, 40000, ["fire", "heat"])),
    Object.freeze(gemstone("sapphire", "Sapphire", 15000, 40000, ["cold", "ice"])),
    Object.freeze(gemstone("aquamarine", "Aquamarine", 16000, 42000, ["water", "flow"])),
    Object.freeze(gemstone("topaz", "Topaz", 18000, 48000, ["lightning", "energy"])),
    Object.freeze(gemstone("garnet", "Garnet", 18000, 48000, ["blood", "physical"])),
    Object.freeze(gemstone("emerald", "Emerald", 20000, 55000, ["vitality", "nature"])),
    Object.freeze(gemstone("amethyst", "Amethyst", 22000, 60000, ["arcane", "mental"])),
    Object.freeze(gemstone("onyx", "Onyx", 25000, 70000, ["shadow", "necrotic"])),
    Object.freeze(gemstone("moonstone", "Moonstone", 28000, 80000, ["spirit"])),
    Object.freeze(gemstone("opal", "Opal", 30000, 90000, ["prismatic"])),
    Object.freeze(gemstone("diamond", "Diamond", 35000, 100000, ["light", "force"])),
    Object.freeze(gemstone("starstone_exotic_gem", "Starstone / Exotic Gem", 60000, 180000, ["exotic"])),
  ]);

  const ROUGH_GEMS = Object.freeze(GEMSTONE_PAIRS.map((pair) => pair[0]));
  const CUT_GEMS = Object.freeze(GEMSTONE_PAIRS.map((pair) => pair[1]));
  const ITEMS = Object.freeze([...RAW_MINERALS, ...REFINED_METALS, ...ALLOYS, ...ROUGH_GEMS, ...CUT_GEMS]);

  const CREATURE_MINERAL_HARVEST_RULE = Object.freeze({
    id: "creature_mineral_body_replacement",
    bodyCompositions: Object.freeze(["mineral", "rock", "metallic", "crystalline", "hybrid"]),
    eligibleForms: Object.freeze(["raw_mineral", "rough_gem"]),
    replacesBiologicalFamilies: true,
    additiveOnlyWhenSourceActuallyHasBothAnatomies: true,
    preservesLineage: true,
    naturalGemsAreRoughByDefault: true,
    note: "Mineral, rocky, metallic or crystalline creature bodies may replace incompatible Meat/Organ-style yields with coherent raw minerals, ores or rough gems. These are body materials, not automatic bonus loot.",
  });

  const ALIASES = Object.freeze({
    bauxite: "bauxite_aluminum_ore",
    aluminum_ore: "bauxite_aluminum_ore",
    graphite: "graphite_carbon_mineral",
    carbon_mineral: "graphite_carbon_mineral",
    rare_earth: "rare_earth_concentrate",
    uranium_ore: "uranium_bearing_ore",
    null_mineral: "null_dampening_mineral",
    dampening_mineral: "null_dampening_mineral",
    starstone: "starstone_exotic_gem",
    exotic_gem: "starstone_exotic_gem",
    rough_starstone: "rough_starstone_exotic_gem",
    rough_exotic_gem: "rough_starstone_exotic_gem",
    hardened_weapon_steel: "hardened_steel",
    armor_steel: "hardened_steel",
  });

  function get(id) {
    const key = normalizeId(id);
    const resolved = ALIASES[key] || key;
    const found = ITEMS.find((entry) => entry.id === resolved);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const form = normalizeId(options.form);
    const materialClass = normalizeId(options.materialClass);
    const tag = normalizeId(options.tag);
    const resonance = normalizeId(options.resonance);
    return ITEMS
      .filter((entry) => !form || entry.form === form)
      .filter((entry) => !materialClass || entry.materialClass === materialClass)
      .filter((entry) => !tag || entry.tags.includes(tag) || entry.useTags.includes(tag))
      .filter((entry) => !resonance || entry.resonanceTags.includes(resonance))
      .map(clone);
  }

  function qualityInfo(quality = DEFAULT_QUALITY) {
    const engine = qualityEngine();
    if (engine?.getQuality) return engine.getQuality(quality);
    return { id: normalizeId(quality || DEFAULT_QUALITY), effectMultiplier: 1, valueMultiplier: 1 };
  }

  function unitValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const baseValue = Number(entry.standardUnitValueAhn) || 0;
    const engine = qualityEngine();
    return engine?.applyValue
      ? engine.applyValue(baseValue, quality, { rounding: "round" })
      : Math.round(baseValue * (Number(qualityInfo(quality)?.valueMultiplier) || 1));
  }

  function canSourceFromCreatureBody(itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    return Boolean(entry && CREATURE_MINERAL_HARVEST_RULE.eligibleForms.includes(entry.form));
  }

  function createStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id : normalizeId(options.quality || DEFAULT_QUALITY);
    const quantity = entry.pieceBased
      ? Math.max(0, Math.trunc(Number(options.quantity ?? 1) || 0))
      : Math.max(0, Number(options.materialUnits ?? options.quantity ?? 0) || 0);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({ lineageId: options.lineageId, lineageName: options.lineageName }, entry.name)
      : { lineageId: normalizeId(options.lineageId || entry.id), lineageName: String(options.lineageName || entry.name) };
    const unitValueAhn = unitValueForQuality(entry, quality);
    const materialName = options.lineageId || options.lineageName
      ? `${lineage.lineageName} ${entry.materialNoun}`.replace(/\s+/g, " ").trim()
      : entry.name;
    return {
      itemId: entry.id, family: FAMILY, form: entry.form, materialClass: entry.materialClass, iconFamily: entry.iconFamily,
      measure: entry.measure, unitAbbreviation: entry.unitAbbreviation || null, quantity,
      materialUnits: entry.pieceBased ? null : quantity, quality,
      lineageId: lineage.lineageId, lineageName: lineage.lineageName, materialName, displayName: materialName,
      unitValueAhn, totalValueAhn: Math.round(unitValueAhn * quantity),
      resonanceTags: clone(entry.resonanceTags), useTags: clone(entry.useTags),
      origin: normalizeId(options.origin || "inventory"),
    };
  }

  function createCreatureHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry || !canSourceFromCreatureBody(entry)) return null;
    return createStack(entry, { ...options, origin: "creature_body" });
  }

  const API = Object.freeze({
    VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, MATERIAL_UNIT, MATERIAL_UNIT_ABBREVIATION,
    RAW_MINERALS, REFINED_METALS, ALLOYS, ROUGH_GEMS, CUT_GEMS, ITEMS, ALIASES,
    CREATURE_MINERAL_HARVEST_RULE, get, list, unitValueForQuality, canSourceFromCreatureBody, createStack, createCreatureHarvestStack,
  });

  global.LuminousOreIngotGemCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
