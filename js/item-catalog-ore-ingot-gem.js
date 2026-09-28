(function (global) {
  "use strict";

  if (global.LuminousOreIngotGemCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousOreIngotGemCatalog;
    return;
  }

  const VERSION = 5;
  const FAMILY = "ore_ingot_gem";
  const CURRENCY = "AHN";
  const AHN_ECONOMY_SCALE = 2.5;
  const DEFAULT_QUALITY = "standard";
  const MATERIAL_UNIT = "material_unit";
  const MATERIAL_UNIT_ABBREVIATION = "MU";
  const RAW_MINERAL_PRICING_MODEL = "ahn_material_unit_tiered_v2";
  const REFINED_PRICING_MODEL = "source_raw_value_x_refinement_multiplier_v2";
  const REFINEMENT_PROFILES = Object.freeze({
    basic: Object.freeze({ id:"basic", multiplier:1.50, tier:"generic" }),
    specialized: Object.freeze({ id:"specialized", multiplier:1.60, tier:"workshop" }),
    advanced: Object.freeze({ id:"advanced", multiplier:1.70, tier:"workshop" }),
    corp: Object.freeze({ id:"corp", multiplier:1.85, tier:"corp_wing" }),
    exotic: Object.freeze({ id:"exotic", multiplier:2.00, tier:"corp_wing" }),
  });
  const GEM_PRICING_MODEL = "rough_value_x_lapidary_multiplier_v2";
  const LAPIDARY_PROFILES = Object.freeze({
    resonant: Object.freeze({ id:"resonant", multiplier:2.50, tier:"workshop" }),
    precious: Object.freeze({ id:"precious", multiplier:2.75, tier:"workshop" }),
    exotic: Object.freeze({ id:"exotic", multiplier:3.00, tier:"corp_wing" }),
  });

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

  function rawMineral(id, name, standardUnitValueAhn, useTags = [], iconFamily = "ore_raw") {
    return material({
      id, name, materialNoun: name, form: "raw_mineral", materialClass: "mineral",
      iconFamily: normalizeId(iconFamily || "ore_raw"), standardUnitValueAhn: Math.round(standardUnitValueAhn * AHN_ECONOMY_SCALE), measure: MATERIAL_UNIT, unitAbbreviation: MATERIAL_UNIT_ABBREVIATION,
      pieceBased: false, processed: false, rawCraftingReagent: true,
      sourceKinds: ["deposit", "creature_body"], useTags,
      tags: ["ingredient", "raw_mineral", "ore", "mining", "creature_mineral_harvest"],
    });
  }

  function refinedMetal(id, name, standardUnitValueAhn, form = "refined_metal", iconFamily = "metal_ingot") {
    return material({
      id, name, materialNoun: name, form, materialClass: form === "alloy" ? "alloy" : "refined_metal",
      iconFamily: normalizeId(iconFamily || "metal_ingot"), standardUnitValueAhn: Math.round(standardUnitValueAhn * AHN_ECONOMY_SCALE), measure: MATERIAL_UNIT, unitAbbreviation: MATERIAL_UNIT_ABBREVIATION,
      pieceBased: false, processed: true, rawCraftingReagent: false,
      sourceKinds: ["metallurgy"], useTags: ["weapons", "armor", "tools", "augments", "industrial_fabrication", "upgrade_material"],
      tags: ["ingredient", "metal_stock", "ingot", form],
    });
  }

  function refinedFromRaw(def) {
    const sourceRawId = normalizeId(def.sourceRawId);
    const source = RAW_MINERALS.find((entry) => entry.id === sourceRawId);
    if (!source) throw new Error(`Unknown raw mineral source for refined material: ${sourceRawId}`);
    const profileId = normalizeId(def.profile || "basic");
    const profile = REFINEMENT_PROFILES[profileId];
    if (!profile) throw new Error(`Unknown refinement profile: ${profileId}`);
    const form = normalizeId(def.form || "refined_metal");
    const isIngot = def.ingot !== false;
    return material({
      id: normalizeId(def.id),
      name: def.name,
      materialNoun: def.name,
      form,
      materialClass: "refined_metal",
      iconFamily: normalizeId(def.iconFamily || "metal_ingot"),
      standardUnitValueAhn: Math.round(source.standardUnitValueAhn * profile.multiplier),
      measure: MATERIAL_UNIT,
      unitAbbreviation: MATERIAL_UNIT_ABBREVIATION,
      pieceBased: false,
      processed: true,
      rawCraftingReagent: false,
      sourceKinds: ["metallurgy"],
      sourceRawId,
      pricingModel: REFINED_PRICING_MODEL,
      refinementProfile: profile.id,
      refinementMultiplier: profile.multiplier,
      processTier: profile.tier,
      useTags: [
        "weapons","armor","tools","augments","industrial_fabrication","upgrade_material",
        ...(def.useTags || [])
      ],
      tags: [
        "ingredient","metal_stock","refined_metal",
        ...(isIngot ? ["ingot"] : ["processed_material"]),
        ...(def.tags || [])
      ],
    });
  }

  function gemstone(def) {
    const baseId = normalizeId(def.id);
    const profileId = normalizeId(def.profile || "resonant");
    const profile = LAPIDARY_PROFILES[profileId];
    if (!profile) throw new Error(`Unknown lapidary profile: ${profileId}`);
    const roughValueAhn = Math.max(0, Math.round(Number(def.roughValueAhn) || 0));
    const cutValueAhn = Math.round(roughValueAhn * profile.multiplier);
    const resonanceTags = (def.resonanceTags || []).map(normalizeId).filter(Boolean);
    return [
      material({
        id: `rough_${baseId}`,
        name: `Rough ${def.name}`,
        materialNoun: def.name,
        form: "rough_gem",
        materialClass: "gemstone",
        iconFamily: normalizeId(def.roughIconFamily || "gem_rough"),
        standardUnitValueAhn: roughValueAhn,
        measure: "piece",
        pieceBased: true,
        processed: false,
        rawCraftingReagent: true,
        sourceKinds: ["deposit", "creature_body"],
        resonanceTags,
        pricingModel: GEM_PRICING_MODEL,
        lapidaryProfile: profile.id,
        lapidaryMultiplier: profile.multiplier,
        processTier: profile.tier,
        enchantmentReady: false,
        useTags: ["lapidary_input", "enchantment_material", "enchantment_feedstock"],
        tags: ["ingredient", "gemstone", "rough_gem", "resonant", "creature_mineral_harvest"],
      }),
      material({
        id: baseId,
        name: def.name,
        materialNoun: def.name,
        form: "cut_gem",
        materialClass: "gemstone",
        iconFamily: normalizeId(def.cutIconFamily || "gem_cut"),
        standardUnitValueAhn: cutValueAhn,
        measure: "piece",
        pieceBased: true,
        processed: true,
        rawCraftingReagent: false,
        sourceKinds: ["lapidary"],
        resonanceTags,
        processedFrom: `rough_${baseId}`,
        pricingModel: GEM_PRICING_MODEL,
        lapidaryProfile: profile.id,
        lapidaryMultiplier: profile.multiplier,
        processTier: profile.tier,
        enchantmentReady: true,
        useTags: ["enchantment_material", "accessory_socket", "armor_socket", "weapon_socket"],
        tags: ["ingredient", "gemstone", "cut_gem", "resonant", "enchantment"],
      }),
    ];
  }

  const RAW_MINERALS = Object.freeze([
    rawMineral("industrial_stone", "Industrial Stone", 4000, ["construction", "abrasive", "fabrication"], "mineral_industrial_stone"),
    rawMineral("clay", "Clay", 5000, ["ceramic", "insulation", "fabrication"], "mineral_clay"),
    rawMineral("coal", "Coal", 7000, ["fuel", "carbon", "metallurgy"], "mineral_coal"),
    rawMineral("lead_ore", "Lead Ore", 10000, ["shielding", "ammunition", "industry"], "ore_lead"),
    rawMineral("iron_ore", "Iron Ore", 12000, ["weapons", "armor", "structure"], "ore_iron"),
    rawMineral("bauxite_aluminum_ore", "Bauxite / Aluminum Ore", 14000, ["light_structure", "armor", "industry"], "ore_bauxite"),
    rawMineral("zinc_ore", "Zinc Ore", 15000, ["alloying", "corrosion_protection"], "ore_zinc"),
    rawMineral("tin_ore", "Tin Ore", 16000, ["bronze", "soldering", "alloying"], "ore_tin"),
    rawMineral("copper_ore", "Copper Ore", 18000, ["conductive", "electronics", "machinery"], "ore_copper"),
    rawMineral("graphite_carbon_mineral", "Graphite / Carbon Mineral", 19000, ["alloying", "energy", "composite"], "mineral_graphite"),
    rawMineral("manganese_ore", "Manganese Ore", 20000, ["steel", "alloying"], "ore_manganese"),
    rawMineral("obsidian", "Obsidian", 22000, ["cutting", "special_component"], "mineral_obsidian"),
    rawMineral("quartz", "Quartz", 24000, ["optics", "glass", "electronics"], "mineral_quartz"),
    rawMineral("nickel_ore", "Nickel Ore", 26000, ["alloying", "armor", "energy"], "ore_nickel"),
    rawMineral("chromium_ore", "Chromium Ore", 31000, ["hardening", "corrosion_resistance", "alloying"], "ore_chromium"),
    rawMineral("lithium_ore", "Lithium Ore", 36000, ["battery", "energy"], "ore_lithium"),
    rawMineral("molybdenum_ore", "Molybdenum Ore", 40000, ["high_heat_alloy", "alloying"], "ore_molybdenum"),
    rawMineral("vanadium_ore", "Vanadium Ore", 43000, ["armor", "titanium_alloy", "alloying"], "ore_vanadium"),
    rawMineral("cobalt_ore", "Cobalt Ore", 46000, ["energy", "motor", "superalloy"], "ore_cobalt"),
    rawMineral("silver_ore", "Silver Ore", 60000, ["electronics", "precision", "conductive", "jewelry_material"], "ore_silver"),
    rawMineral("tungsten_ore", "Tungsten Ore", 66000, ["weapon", "penetrator", "tooling", "high_heat"], "ore_tungsten"),
    rawMineral("titanium_ore", "Titanium Ore", 76000, ["armor", "weapon", "augment", "light_structure"], "ore_titanium"),
    rawMineral("niobium_ore", "Niobium Ore", 86000, ["superconductive", "alloying"], "ore_niobium"),
    rawMineral("gold_ore", "Gold Ore", 90000, ["advanced_electronics", "conductive", "jewelry_material", "precious_metal"], "ore_gold"),
    rawMineral("tantalum_ore", "Tantalum Ore", 94000, ["electronics", "augment"], "ore_tantalum"),
    rawMineral("rare_earth_concentrate", "Rare-Earth Concentrate", 110000, ["sensor", "motor", "advanced_technology"], "mineral_rare_earth"),
    rawMineral("platinum_ore", "Platinum Ore", 120000, ["precision", "electronics", "jewelry_material", "precious_metal"], "ore_platinum"),
    rawMineral("uranium_bearing_ore", "Uranium-bearing Ore", 140000, ["regulated_energy", "nuclear"], "ore_uranium"),
    rawMineral("superconductive_mineral", "Superconductive Mineral", 200000, ["energy", "corp_technology", "superconductive"], "mineral_superconductive"),
    rawMineral("metamaterial_ore", "Metamaterial Ore", 250000, ["advanced_armor", "experimental_technology"], "ore_metamaterial"),
    rawMineral("null_dampening_mineral", "Null / Dampening Mineral", 320000, ["dampening", "isolation", "special_technology"], "mineral_null_dampening"),
    rawMineral("exotic_industrial_mineral", "Exotic Industrial Mineral", 400000, ["exotic_industry", "high_tier_crafting"], "mineral_exotic_industrial"),
  ]);

  const REFINED_METALS = Object.freeze([
    refinedFromRaw({ id:"lead", name:"Lead", sourceRawId:"lead_ore", profile:"basic", iconFamily:"ingot_lead" }),
    refinedFromRaw({ id:"iron", name:"Iron", sourceRawId:"iron_ore", profile:"basic", iconFamily:"ingot_iron" }),
    refinedFromRaw({ id:"aluminum", name:"Aluminum", sourceRawId:"bauxite_aluminum_ore", profile:"basic", iconFamily:"ingot_aluminum" }),
    refinedFromRaw({ id:"zinc", name:"Zinc", sourceRawId:"zinc_ore", profile:"basic", iconFamily:"ingot_zinc" }),
    refinedFromRaw({ id:"tin", name:"Tin", sourceRawId:"tin_ore", profile:"basic", iconFamily:"ingot_tin" }),
    refinedFromRaw({ id:"copper", name:"Copper", sourceRawId:"copper_ore", profile:"basic", iconFamily:"ingot_copper" }),
    refinedFromRaw({ id:"manganese", name:"Manganese", sourceRawId:"manganese_ore", profile:"basic", iconFamily:"ingot_manganese" }),
    refinedFromRaw({ id:"nickel", name:"Nickel", sourceRawId:"nickel_ore", profile:"basic", iconFamily:"ingot_nickel" }),

    refinedFromRaw({ id:"chromium", name:"Chromium", sourceRawId:"chromium_ore", profile:"specialized", iconFamily:"ingot_chromium" }),
    refinedFromRaw({ id:"lithium", name:"Lithium", sourceRawId:"lithium_ore", profile:"specialized", iconFamily:"ingot_lithium" }),
    refinedFromRaw({ id:"molybdenum", name:"Molybdenum", sourceRawId:"molybdenum_ore", profile:"specialized", iconFamily:"ingot_molybdenum" }),
    refinedFromRaw({ id:"vanadium", name:"Vanadium", sourceRawId:"vanadium_ore", profile:"specialized", iconFamily:"ingot_vanadium" }),
    refinedFromRaw({ id:"cobalt", name:"Cobalt", sourceRawId:"cobalt_ore", profile:"specialized", iconFamily:"ingot_cobalt" }),
    refinedFromRaw({ id:"silver", name:"Silver", sourceRawId:"silver_ore", profile:"specialized", iconFamily:"ingot_silver", useTags:["jewelry_material","precious_metal"], tags:["jewelry_material","precious_metal"] }),
    refinedFromRaw({ id:"tungsten", name:"Tungsten", sourceRawId:"tungsten_ore", profile:"specialized", iconFamily:"ingot_tungsten" }),
    refinedFromRaw({ id:"titanium", name:"Titanium", sourceRawId:"titanium_ore", profile:"specialized", iconFamily:"ingot_titanium" }),
    refinedFromRaw({ id:"gold", name:"Gold", sourceRawId:"gold_ore", profile:"specialized", iconFamily:"ingot_gold", useTags:["jewelry_material","precious_metal"], tags:["jewelry_material","precious_metal"] }),
    refinedFromRaw({ id:"niobium", name:"Niobium", sourceRawId:"niobium_ore", profile:"specialized", iconFamily:"ingot_niobium" }),
    refinedFromRaw({ id:"tantalum", name:"Tantalum", sourceRawId:"tantalum_ore", profile:"specialized", iconFamily:"ingot_tantalum" }),
    refinedFromRaw({ id:"platinum", name:"Platinum", sourceRawId:"platinum_ore", profile:"specialized", iconFamily:"ingot_platinum", useTags:["jewelry_material","precious_metal","precision"], tags:["jewelry_material","precious_metal"] }),

    refinedFromRaw({ id:"rare_earth_refined_material", name:"Rare-Earth Refined Material", sourceRawId:"rare_earth_concentrate", profile:"advanced", iconFamily:"material_rare_earth_refined", ingot:false, form:"refined_material", useTags:["advanced_material","electronics","sensor"], tags:["advanced_material"] }),
    refinedFromRaw({ id:"refined_uranium_material", name:"Refined Uranium Material", sourceRawId:"uranium_bearing_ore", profile:"advanced", iconFamily:"material_uranium_refined", ingot:false, form:"refined_material", useTags:["advanced_material","regulated_energy","nuclear"], tags:["advanced_material","regulated_material"] }),
    refinedFromRaw({ id:"superconductive_material", name:"Superconductive Material", sourceRawId:"superconductive_mineral", profile:"corp", iconFamily:"material_superconductive", ingot:false, form:"refined_material", useTags:["advanced_material","superconductive","energy","corp_technology"], tags:["advanced_material","corp_material"] }),
    refinedFromRaw({ id:"refined_metamaterial", name:"Refined Metamaterial", sourceRawId:"metamaterial_ore", profile:"corp", iconFamily:"material_metamaterial_refined", ingot:false, form:"refined_material", useTags:["advanced_material","advanced_armor","experimental_technology"], tags:["advanced_material","corp_material"] }),
    refinedFromRaw({ id:"null_dampening_material", name:"Null / Dampening Material", sourceRawId:"null_dampening_mineral", profile:"exotic", iconFamily:"material_null_dampening", ingot:false, form:"refined_material", useTags:["advanced_material","dampening","isolation","special_technology"], tags:["advanced_material","exotic_material"] }),
    refinedFromRaw({ id:"exotic_refined_material", name:"Exotic Refined Material", sourceRawId:"exotic_industrial_mineral", profile:"exotic", iconFamily:"material_exotic_refined", ingot:false, form:"refined_material", useTags:["advanced_material","exotic_industry","high_tier_crafting"], tags:["advanced_material","exotic_material"] }),
  ]);

  const ALLOYS = Object.freeze([
    refinedMetal("bronze", "Bronze", 38000, "alloy", "ingot_copper"),
    refinedMetal("brass", "Brass", 42000, "alloy", "ingot_copper"),
    refinedMetal("carbon_steel", "Carbon Steel", 40000, "alloy", "ingot_iron"),
    refinedMetal("high_carbon_steel", "High-Carbon Steel", 55000, "alloy", "ingot_iron"),
    refinedMetal("stainless_steel", "Stainless Steel", 70000, "alloy", "ingot_chromium"),
    refinedMetal("hardened_steel", "Hardened Steel", 90000, "alloy", "ingot_iron"),
    refinedMetal("nickel_steel", "Nickel Steel", 100000, "alloy", "ingot_nickel"),
    refinedMetal("chrome_steel", "Chrome Steel", 115000, "alloy", "ingot_chromium"),
    refinedMetal("cobalt_alloy", "Cobalt Alloy", 145000, "alloy", "ingot_cobalt"),
    refinedMetal("tungsten_alloy", "Tungsten Alloy", 170000, "alloy", "ingot_tungsten"),
    refinedMetal("titanium_alloy", "Titanium Alloy", 185000, "alloy", "ingot_titanium"),
    refinedMetal("advanced_titanium_alloy", "Advanced Titanium Alloy", 240000, "alloy", "ingot_titanium"),
    refinedMetal("superalloy", "Superalloy", 275000, "alloy", "ingot_cobalt"),
    refinedMetal("augment_grade_alloy", "Augment-Grade Alloy", 300000, "alloy", "ingot_titanium"),
    refinedMetal("corp_composite_alloy", "Corp Composite Alloy", 450000, "alloy", "material_metamaterial_refined"),
    refinedMetal("exotic_alloy", "Exotic Alloy", 650000, "alloy", "material_exotic_refined"),
  ]);

  const GEMSTONE_PAIRS = Object.freeze([
    Object.freeze(gemstone({ id:"ruby", name:"Ruby", roughValueAhn:90000, profile:"resonant", roughIconFamily:"gem_ruby_rough", cutIconFamily:"gem_ruby_cut", resonanceTags:["fire","heat"] })),
    Object.freeze(gemstone({ id:"sapphire", name:"Sapphire", roughValueAhn:90000, profile:"resonant", roughIconFamily:"gem_sapphire_rough", cutIconFamily:"gem_sapphire_cut", resonanceTags:["cold","ice"] })),
    Object.freeze(gemstone({ id:"aquamarine", name:"Aquamarine", roughValueAhn:95000, profile:"resonant", roughIconFamily:"gem_aquamarine_rough", cutIconFamily:"gem_aquamarine_cut", resonanceTags:["water","flow"] })),
    Object.freeze(gemstone({ id:"topaz", name:"Topaz", roughValueAhn:105000, profile:"resonant", roughIconFamily:"gem_topaz_rough", cutIconFamily:"gem_topaz_cut", resonanceTags:["lightning","energy"] })),
    Object.freeze(gemstone({ id:"garnet", name:"Garnet", roughValueAhn:105000, profile:"resonant", roughIconFamily:"gem_garnet_rough", cutIconFamily:"gem_garnet_cut", resonanceTags:["blood","physical"] })),
    Object.freeze(gemstone({ id:"emerald", name:"Emerald", roughValueAhn:120000, profile:"resonant", roughIconFamily:"gem_emerald_rough", cutIconFamily:"gem_emerald_cut", resonanceTags:["vitality","nature"] })),
    Object.freeze(gemstone({ id:"amethyst", name:"Amethyst", roughValueAhn:135000, profile:"precious", roughIconFamily:"gem_amethyst_rough", cutIconFamily:"gem_amethyst_cut", resonanceTags:["arcane","mental"] })),
    Object.freeze(gemstone({ id:"onyx", name:"Onyx", roughValueAhn:150000, profile:"precious", roughIconFamily:"gem_onyx_rough", cutIconFamily:"gem_onyx_cut", resonanceTags:["shadow","necrotic"] })),
    Object.freeze(gemstone({ id:"moonstone", name:"Moonstone", roughValueAhn:170000, profile:"precious", roughIconFamily:"gem_moonstone_rough", cutIconFamily:"gem_moonstone_cut", resonanceTags:["spirit"] })),
    Object.freeze(gemstone({ id:"opal", name:"Opal", roughValueAhn:190000, profile:"precious", roughIconFamily:"gem_opal_rough", cutIconFamily:"gem_opal_cut", resonanceTags:["prismatic"] })),
    Object.freeze(gemstone({ id:"diamond", name:"Diamond", roughValueAhn:240000, profile:"precious", roughIconFamily:"gem_diamond_rough", cutIconFamily:"gem_diamond_cut", resonanceTags:["light","force"] })),
    Object.freeze(gemstone({ id:"starstone_exotic_gem", name:"Starstone / Exotic Gem", roughValueAhn:400000, profile:"exotic", roughIconFamily:"gem_starstone_rough", cutIconFamily:"gem_starstone_cut", resonanceTags:["exotic"] })),
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
    raw_platinum: "platinum_ore",
    platinum_ingot: "platinum",
    refined_platinum: "platinum",
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
    VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, MATERIAL_UNIT, MATERIAL_UNIT_ABBREVIATION, RAW_MINERAL_PRICING_MODEL, REFINED_PRICING_MODEL, REFINEMENT_PROFILES, GEM_PRICING_MODEL, LAPIDARY_PROFILES,
    RAW_MINERALS, REFINED_METALS, ALLOYS, ROUGH_GEMS, CUT_GEMS, ITEMS, ALIASES,
    CREATURE_MINERAL_HARVEST_RULE, get, list, unitValueForQuality, canSourceFromCreatureBody, createStack, createCreatureHarvestStack,
  });

  global.LuminousOreIngotGemCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
