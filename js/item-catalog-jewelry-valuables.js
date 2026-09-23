(function (global) {
  "use strict";

  if (global.LuminousJewelryValuableCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousJewelryValuableCatalog;
    return;
  }

  const VERSION = 3;
  const FAMILY = "jewelry_valuables";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const PRICING_MODEL = "consumed_material_value_x_chassis_multiplier_x_quality_v1";
  const ENCHANTMENT_PRICING_STATUS = "deferred";
  const DEFAULT_METAL_ID = "silver";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function oreCatalog() {
    return global.LuminousOreIngotGemCatalog || safeRequire("./item-catalog-ore-ingot-gem.js");
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function freezeChassis(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      family: FAMILY,
      category: def.kind === "jewelry" ? "equipment" : "valuable",
      itemType: def.kind === "jewelry" ? "accessory" : "valuable",
      equipmentKind: def.kind === "jewelry" ? "accessory" : null,
      kind: def.kind,
      iconFamily: def.kind === "jewelry" ? "accessory" : "valuable",
      stackable: false,
      metalUnits: Number(def.metalUnits),
      maxGemCount: Math.max(0, Math.trunc(Number(def.maxGemCount) || 0)),
      craftMultiplier: Number(def.craftMultiplier),
      processTier: def.processTier || "workshop",
      mundaneOnly: true,
      craftable: def.kind === "jewelry",
      retailAvailable: def.kind === "jewelry",
      lootOnly: def.kind === "valuable",
      acquisition: def.kind === "jewelry" ? "market_or_craft" : "loot_only",
      enchantmentPricingStatus: ENCHANTMENT_PRICING_STATUS,
      tags: Object.freeze([
        def.kind === "jewelry" ? "jewelry" : "valuable",
        def.kind === "jewelry" ? "accessory" : "treasure",
        "mundane",
        "generative_variant",
        ...(def.tags || []).map(normalizeId).filter(Boolean),
      ]),
    });
  }

  const JEWELRY_CHASSIS = Object.freeze([
    freezeChassis({ id:"plain_band", name:"Plain Band", kind:"jewelry", metalUnits:0.08, maxGemCount:1, craftMultiplier:1.20, tags:["ring"] }),
    freezeChassis({ id:"ring", name:"Ring", kind:"jewelry", metalUnits:0.12, maxGemCount:5, craftMultiplier:1.35, tags:["ring"] }),
    freezeChassis({ id:"signet_ring", name:"Signet Ring", kind:"jewelry", metalUnits:0.18, maxGemCount:3, craftMultiplier:1.45, tags:["ring","signet"] }),
    freezeChassis({ id:"earrings", name:"Earrings", kind:"jewelry", metalUnits:0.16, maxGemCount:6, craftMultiplier:1.40, tags:["earring_pair"] }),
    freezeChassis({ id:"pendant", name:"Pendant", kind:"jewelry", metalUnits:0.22, maxGemCount:5, craftMultiplier:1.45, tags:["neckwear"] }),
    freezeChassis({ id:"medallion", name:"Medallion", kind:"jewelry", metalUnits:0.25, maxGemCount:6, craftMultiplier:1.50, tags:["neckwear"] }),
    freezeChassis({ id:"necklace", name:"Necklace", kind:"jewelry", metalUnits:0.45, maxGemCount:16, craftMultiplier:1.50, tags:["neckwear"] }),
    freezeChassis({ id:"choker", name:"Choker", kind:"jewelry", metalUnits:0.35, maxGemCount:12, craftMultiplier:1.50, tags:["neckwear"] }),
    freezeChassis({ id:"bracelet", name:"Bracelet", kind:"jewelry", metalUnits:0.30, maxGemCount:10, craftMultiplier:1.40, tags:["wristwear"] }),
    freezeChassis({ id:"bangle", name:"Bangle", kind:"jewelry", metalUnits:0.35, maxGemCount:8, craftMultiplier:1.35, tags:["wristwear"] }),
    freezeChassis({ id:"cuff_bracelet", name:"Cuff Bracelet", kind:"jewelry", metalUnits:0.40, maxGemCount:12, craftMultiplier:1.50, tags:["wristwear"] }),
    freezeChassis({ id:"anklet", name:"Anklet", kind:"jewelry", metalUnits:0.28, maxGemCount:10, craftMultiplier:1.40, tags:["anklewear"] }),
    freezeChassis({ id:"brooch", name:"Brooch", kind:"jewelry", metalUnits:0.20, maxGemCount:8, craftMultiplier:1.50, tags:["pin"] }),
    freezeChassis({ id:"cufflinks", name:"Cufflinks", kind:"jewelry", metalUnits:0.14, maxGemCount:4, craftMultiplier:1.45, tags:["formalwear"] }),
    freezeChassis({ id:"hairpin", name:"Ornamental Hairpin", kind:"jewelry", metalUnits:0.16, maxGemCount:6, craftMultiplier:1.45, tags:["hairwear"] }),
  ]);

  const VALUABLE_CHASSIS = Object.freeze([
    freezeChassis({ id:"gold_relic", name:"Gold Relic", kind:"valuable", metalUnits:1.00, maxGemCount:0, craftMultiplier:1.75, tags:["relic","valuable_tier_1","gold_visual"] }),
    freezeChassis({ id:"gem_inlaid_relic", name:"Gem-Inlaid Relic", kind:"valuable", metalUnits:1.00, maxGemCount:0, craftMultiplier:2.50, processTier:"corp_wing", tags:["relic","valuable_tier_2","gem_inlaid_visual"] }),
  ]);

  const CHASSIS = Object.freeze([...JEWELRY_CHASSIS, ...VALUABLE_CHASSIS]);
  const BY_ID = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id, entry])));

  const ALIASES = Object.freeze({
    band: "plain_band",
    earring: "earrings",
    necklace_pendant: "pendant",
    cuff: "cuff_bracelet",
    pin: "brooch",
    hair_pin: "hairpin",
    relic: "gold_relic",
    golden_relic: "gold_relic",
    jeweled_relic: "gem_inlaid_relic",
    gem_relic: "gem_inlaid_relic",
  });

  function get(id) {
    const key = normalizeId(id);
    const resolved = ALIASES[key] || key;
    return BY_ID[resolved] ? clone(BY_ID[resolved]) : null;
  }

  function list(options = {}) {
    const kind = normalizeId(options.kind);
    return CHASSIS.filter((entry) => !kind || entry.kind === kind).map(clone);
  }

  function resolveMetal(id) {
    const catalog = oreCatalog();
    const entry = catalog?.get?.(id);
    if (!entry) return null;
    if (!["refined_metal","alloy"].includes(entry.form)) return null;
    return entry;
  }

  function resolveCutGem(id) {
    const catalog = oreCatalog();
    const entry = catalog?.get?.(id);
    if (!entry || entry.form !== "cut_gem") return null;
    return entry;
  }

  function normalizeGemSelection(input = []) {
    const raw = Array.isArray(input) ? input : [input];
    const quantities = new Map();
    for (const value of raw) {
      const id = normalizeId(typeof value === "string" ? value : value?.id ?? value?.gemId ?? value?.gem);
      const quantity = Math.max(0, Math.trunc(Number(typeof value === "string" ? 1 : value?.quantity ?? value?.qty ?? 1) || 0));
      if (!id || quantity <= 0) continue;
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    return [...quantities.entries()].map(([id, quantity]) => Object.freeze({ id, quantity }));
  }

  function gemResonanceProfile(gems = []) {
    const weights = {};
    for (const gem of gems) {
      const quantity = Math.max(0, Math.trunc(Number(gem.quantity) || 0));
      for (const tag of gem.resonanceTags || []) {
        const id = normalizeId(tag);
        if (!id) continue;
        weights[id] = (weights[id] || 0) + quantity;
      }
    }
    const max = Math.max(0, ...Object.values(weights));
    return Object.freeze({
      weights: Object.freeze({ ...weights }),
      dominantTags: Object.freeze(Object.entries(weights).filter(([,weight]) => weight === max && max > 0).map(([id]) => id)),
    });
  }

  function qualityValue(baseValueAhn, quality = DEFAULT_QUALITY) {
    const engine = qualityEngine();
    if (engine?.applyValue) return engine.applyValue(baseValueAhn, quality, { rounding:"round" });
    return Math.round(Math.max(0, Number(baseValueAhn) || 0));
  }

  function create(chassisOrId, options = {}) {
    const chassis = typeof chassisOrId === "string" ? get(chassisOrId) : clone(chassisOrId);
    if (!chassis) return Object.freeze({ valid:false, reason:"unknown_chassis" });

    const origin = normalizeId(options.origin || options.source || "");
    if (chassis.lootOnly && !["loot","world_loot","location_loot","treasure"].includes(origin)) {
      return Object.freeze({ valid:false, reason:"loot_only_chassis", chassisId:chassis.id });
    }

    const metalId = normalizeId(chassis.kind === "valuable" ? "gold" : (options.metalId || options.metal || DEFAULT_METAL_ID));
    const metal = resolveMetal(metalId);
    if (!metal) return Object.freeze({ valid:false, reason:"invalid_jewelry_metal", metalId });

    const requestedGems = chassis.kind === "valuable" ? [] : normalizeGemSelection(options.gems || options.gemstones || []);
    const gemCount = requestedGems.reduce((sum, entry) => sum + entry.quantity, 0);
    if (gemCount > chassis.maxGemCount) {
      return Object.freeze({ valid:false, reason:"gem_capacity_exceeded", maxGemCount:chassis.maxGemCount, requestedGemCount:gemCount });
    }

    const gems = [];
    for (const requested of requestedGems) {
      const gem = resolveCutGem(requested.id);
      if (!gem) return Object.freeze({ valid:false, reason:"invalid_cut_gem", gemId:requested.id });
      gems.push(Object.freeze({
        id: gem.id,
        name: gem.name,
        quantity: requested.quantity,
        iconFamily: gem.iconFamily,
        unitValueAhn: gem.standardUnitValueAhn,
        totalValueAhn: Math.round(gem.standardUnitValueAhn * requested.quantity),
        resonanceTags: Object.freeze([...(gem.resonanceTags || [])]),
      }));
    }

    const metalInputValueAhn = Math.round(metal.standardUnitValueAhn * chassis.metalUnits);
    const gemstoneInputValueAhn = gems.reduce((sum, gem) => sum + gem.totalValueAhn, 0);
    const abstractRelicPremiumAhn = chassis.id === "gem_inlaid_relic" ? metalInputValueAhn : 0;
    const consumedInputValueAhn = metalInputValueAhn + gemstoneInputValueAhn + abstractRelicPremiumAhn;
    const standardProductionValueAhn = Math.round(consumedInputValueAhn * chassis.craftMultiplier);
    const quality = normalizeId(options.quality || DEFAULT_QUALITY) || DEFAULT_QUALITY;
    const productionValueAhn = qualityValue(standardProductionValueAhn, quality);
    const resonance = gemResonanceProfile(gems);

    const gemSummary = gems.map((gem) => `${gem.name} ×${gem.quantity}`).join(", ");
    const displayName = chassis.kind === "valuable"
      ? chassis.name
      : `${metal.name} ${chassis.name}${gemSummary ? ` — ${gemSummary}` : ""}`;

    return Object.freeze({
      valid: true,
      id: chassis.id,
      definitionId: chassis.id,
      family: FAMILY,
      category: chassis.category,
      itemType: chassis.itemType,
      equipmentKind: chassis.equipmentKind,
      kind: chassis.kind,
      iconFamily: chassis.iconFamily,
      name: chassis.name,
      displayName,
      currency: CURRENCY,
      quality,
      qualitySystem: "universal",
      stackable: false,
      quantity: 1,
      acquisition: chassis.acquisition,
      craftable: chassis.craftable,
      retailAvailable: chassis.retailAvailable,
      lootOnly: chassis.lootOnly,
      origin: chassis.lootOnly ? origin : (origin || "market_or_craft"),
      pricingModel: PRICING_MODEL,
      metalId: metal.id,
      metalName: metal.name,
      metalUnits: chassis.metalUnits,
      metalInputValueAhn,
      gemCount,
      maxGemCount: chassis.maxGemCount,
      gems: Object.freeze(gems),
      gemstoneInputValueAhn,
      abstractRelicPremiumAhn,
      relicValueTier: chassis.id === "gem_inlaid_relic" ? 2 : (chassis.id === "gold_relic" ? 1 : null),
      consumedInputValueAhn,
      craftMultiplier: chassis.craftMultiplier,
      processTier: chassis.processTier,
      standardProductionValueAhn,
      productionValueAhn,
      unitValueAhn: productionValueAhn,
      totalValueAhn: productionValueAhn,
      gemResonanceWeights: resonance.weights,
      dominantResonanceTags: resonance.dominantTags,
      enchanted: false,
      enchantment: null,
      enchantmentValueAhn: 0,
      enchantmentPricingStatus: ENCHANTMENT_PRICING_STATUS,
      tags: Object.freeze([...chassis.tags, metal.id, ...(gemCount ? ["gem_set"] : ["ungemmed"])]),
    });
  }

  const API = Object.freeze({
    VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, PRICING_MODEL, ENCHANTMENT_PRICING_STATUS,
    DEFAULT_METAL_ID, JEWELRY_CHASSIS, VALUABLE_CHASSIS, CHASSIS, ALIASES,
    get, list, resolveMetal, resolveCutGem, normalizeGemSelection, gemResonanceProfile, create,
  });

  global.LuminousJewelryValuableCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
