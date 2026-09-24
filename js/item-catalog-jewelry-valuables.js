(function (global) {
  "use strict";

  if (global.LuminousJewelryValuableCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousJewelryValuableCatalog;
    return;
  }

  const VERSION = 6;
  const FAMILY = "jewelry_valuables";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const PRICING_MODEL = "consumed_material_value_x_chassis_multiplier_x_quality_v1";
  const ENCHANTMENT_PRICING_STATUS = "multiplier_ready";
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
      iconFamily: def.kind === "jewelry" ? null : "valuable",
      iconBase: def.kind === "jewelry" ? normalizeId(def.iconBase || `jewelry_${def.id}`) : null,
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
    freezeChassis({ id:"ring", name:"Ring", kind:"jewelry", iconBase:"jewelry_ring", metalUnits:0.12, maxGemCount:5, craftMultiplier:1.35, tags:["ring"] }),
    freezeChassis({ id:"earrings", name:"Earrings", kind:"jewelry", iconBase:"jewelry_earrings", metalUnits:0.16, maxGemCount:6, craftMultiplier:1.40, tags:["earring_pair"] }),
    freezeChassis({ id:"pendant", name:"Pendant", kind:"jewelry", iconBase:"jewelry_pendant", metalUnits:0.22, maxGemCount:5, craftMultiplier:1.45, tags:["neckwear"] }),
    freezeChassis({ id:"necklace", name:"Necklace", kind:"jewelry", iconBase:"jewelry_necklace", metalUnits:0.45, maxGemCount:16, craftMultiplier:1.50, tags:["neckwear"] }),
    freezeChassis({ id:"bracelet", name:"Bracelet", kind:"jewelry", iconBase:"jewelry_bracelet", metalUnits:0.30, maxGemCount:10, craftMultiplier:1.40, tags:["wristwear"] }),
    freezeChassis({ id:"anklet", name:"Anklet", kind:"jewelry", iconBase:"jewelry_anklet", metalUnits:0.28, maxGemCount:10, craftMultiplier:1.40, tags:["anklewear"] }),
    freezeChassis({ id:"brooch", name:"Brooch", kind:"jewelry", iconBase:"jewelry_brooch", metalUnits:0.20, maxGemCount:8, craftMultiplier:1.50, tags:["pin"] }),
    freezeChassis({ id:"hairpin", name:"Ornamental Hairpin", kind:"jewelry", iconBase:"jewelry_hairpin", metalUnits:0.16, maxGemCount:6, craftMultiplier:1.45, tags:["hairwear"] }),
  ]);

  const VALUABLE_CHASSIS = Object.freeze([
    Object.freeze({ id:"goblet", name:"Goblet", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_goblet_gold", standardValueAhn:420000}), gems:Object.freeze({iconFamily:"valuable_goblet_gems", standardValueAhn:780000}) }) }),
    Object.freeze({ id:"chalice", name:"Chalice", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_chalice_gold", standardValueAhn:500000}), gems:Object.freeze({iconFamily:"valuable_chalice_gems", standardValueAhn:900000}) }) }),
    Object.freeze({ id:"decorative_box", name:"Decorative Box", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_box_gold", standardValueAhn:650000}), gems:Object.freeze({iconFamily:"valuable_box_gems", standardValueAhn:1150000}) }) }),
    Object.freeze({ id:"statuette", name:"Statuette", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_statuette_gold", standardValueAhn:800000}), gems:Object.freeze({iconFamily:"valuable_statuette_gems", standardValueAhn:1450000}) }) }),
    Object.freeze({ id:"mask", name:"Mask", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_mask_gold", standardValueAhn:700000}), gems:Object.freeze({iconFamily:"valuable_mask_gems", standardValueAhn:1250000}) }) }),
    Object.freeze({ id:"plate", name:"Ornamental Plate", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_plate_gold", standardValueAhn:850000}), gems:Object.freeze({iconFamily:"valuable_plate_gems", standardValueAhn:1500000}) }) }),
    Object.freeze({ id:"reliquary", name:"Reliquary", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_reliquary_gold", standardValueAhn:1100000}), gems:Object.freeze({iconFamily:"valuable_reliquary_gems", standardValueAhn:1950000}) }) }),
    Object.freeze({ id:"scepter", name:"Scepter", family:FAMILY, category:"valuable", itemType:"valuable", kind:"valuable", stackable:false, lootOnly:true, craftable:false, retailAvailable:false, acquisition:"loot_only", variants:Object.freeze({ gold:Object.freeze({iconFamily:"valuable_scepter_gold", standardValueAhn:1250000}), gems:Object.freeze({iconFamily:"valuable_scepter_gems", standardValueAhn:2200000}) }) }),
  ]);

  const CHASSIS = Object.freeze([...JEWELRY_CHASSIS, ...VALUABLE_CHASSIS]);
  const BY_ID = Object.freeze(Object.fromEntries(CHASSIS.map((entry) => [entry.id, entry])));

  const ALIASES = Object.freeze({
    earring: "earrings",
    hair_pin: "hairpin",
    jewelry_box: "decorative_box",
    ornamental_plate: "plate",
    ornamental_scepter: "scepter",
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

  function metalVisualVariant(metalId) {
    const id = normalizeId(metalId);
    if (id === "gold") return "gold";
    if (["silver","platinum"].includes(id)) return "silver";
    if (["copper","bronze","brass"].includes(id)) return "copper";
    return "metal";
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

  function dominantGemEntry(gems = []) {
    const ranked = [...gems].sort((a,b) =>
      (Number(b.quantity) || 0) - (Number(a.quantity) || 0) ||
      (Number(b.totalValueAhn) || 0) - (Number(a.totalValueAhn) || 0) ||
      String(a.id).localeCompare(String(b.id))
    );
    return ranked[0] || null;
  }

  function compositionSignature(chassisId, metalId, quality, gems = []) {
    const gemPart = [...gems]
      .sort((a,b) => String(a.id).localeCompare(String(b.id)))
      .map((gem) => `${normalizeId(gem.id)}x${Math.max(1, Math.trunc(Number(gem.quantity) || 1))}`)
      .join("+");
    return [normalizeId(chassisId), normalizeId(metalId), normalizeId(quality || DEFAULT_QUALITY), gemPart || "ungemmed"].join(":");
  }

  function applyEnchantmentMultiplier(item = {}, multiplier, metadata = {}) {
    if (!item?.valid) return Object.freeze({ valid:false, reason:"invalid_item" });
    if (!item.enchantmentReady) return Object.freeze({ valid:false, reason:"item_not_enchantment_ready", itemId:item.id || null });
    const factor = Number(multiplier);
    if (!Number.isFinite(factor) || factor < 1) return Object.freeze({ valid:false, reason:"invalid_enchantment_multiplier", multiplier });
    const base = Math.max(0, Math.round(Number(item.enchantmentBaseValueAhn ?? item.baseMundaneValueAhn ?? item.productionValueAhn) || 0));
    const total = Math.round(base * factor);
    const enchanted = factor > 1;
    return Object.freeze({
      ...clone(item),
      enchanted,
      enchantment: enchanted ? Object.freeze({ multiplier:factor, ...clone(metadata) }) : null,
      enchantmentMultiplier: factor,
      enchantmentBaseValueAhn: base,
      baseMundaneValueAhn: base,
      enchantmentValueAhn: Math.max(0, total - base),
      productionValueAhn: total,
      unitValueAhn: total,
      totalValueAhn: total,
      enchantmentPricingStatus: ENCHANTMENT_PRICING_STATUS,
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
    if (chassis.kind === "valuable") {
      if (!["loot","world_loot","location_loot","treasure"].includes(origin)) {
        return Object.freeze({ valid:false, reason:"loot_only_chassis", chassisId:chassis.id });
      }
      const variant = normalizeId(options.variant || options.valueTier || "gold");
      const variantDef = chassis.variants?.[variant];
      if (!variantDef) return Object.freeze({ valid:false, reason:"invalid_valuable_variant", variant });
      const hasGemVariant = variant === "gems";
      const baseMundaneValueAhn = variantDef.standardValueAhn;
      return Object.freeze({
        valid:true,
        id:chassis.id,
        definitionId:chassis.id,
        family:FAMILY,
        category:"valuable",
        itemType:"valuable",
        equipmentKind:null,
        kind:"valuable",
        iconFamily:variantDef.iconFamily,
        hasGemVariant,
        gemOverlayGemId:null,
        gemOverlayIconFamily:null,
        gemOverlayCount:0,
        name:chassis.name,
        displayName:`${variant === "gems" ? "Gem-Inlaid" : "Gold"} ${chassis.name}`,
        currency:CURRENCY,
        quality:"standard",
        stackable:false,
        quantity:1,
        acquisition:"loot_only",
        craftable:false,
        retailAvailable:false,
        lootOnly:true,
        origin,
        valuableVariant:variant,
        variantSignature:`${chassis.id}:${variant}`,
        standardProductionValueAhn:baseMundaneValueAhn,
        baseMundaneValueAhn,
        enchantmentBaseValueAhn:baseMundaneValueAhn,
        enchantmentReady:hasGemVariant,
        enchantmentMultiplier:1,
        productionValueAhn:baseMundaneValueAhn,
        unitValueAhn:baseMundaneValueAhn,
        totalValueAhn:baseMundaneValueAhn,
        enchanted:false,
        enchantment:null,
        enchantmentValueAhn:0,
        enchantmentPricingStatus:ENCHANTMENT_PRICING_STATUS,
        tags:Object.freeze(["valuable","treasure","loot_only",variant === "gems" ? "gem_inlaid_visual" : "gold_visual"]),
      });
    }

    const metalId = normalizeId(options.metalId || options.metal || DEFAULT_METAL_ID);
    const metal = resolveMetal(metalId);
    if (!metal) return Object.freeze({ valid:false, reason:"invalid_jewelry_metal", metalId });

    const requestedGems = normalizeGemSelection(options.gems || options.gemstones || []);
    const gemCount = requestedGems.reduce((sum, entry) => sum + entry.quantity, 0);
    if (gemCount > chassis.maxGemCount) {
      return Object.freeze({ valid:false, reason:"gem_capacity_exceeded", maxGemCount:chassis.maxGemCount, requestedGemCount:gemCount });
    }

    const gems = [];
    for (const requested of requestedGems) {
      const gem = resolveCutGem(requested.id);
      if (!gem) return Object.freeze({ valid:false, reason:"invalid_cut_gem", gemId:requested.id });
      gems.push(Object.freeze({
        id:gem.id, name:gem.name, quantity:requested.quantity, iconFamily:gem.iconFamily,
        unitValueAhn:gem.standardUnitValueAhn,
        totalValueAhn:Math.round(gem.standardUnitValueAhn * requested.quantity),
        resonanceTags:Object.freeze([...(gem.resonanceTags || [])]),
      }));
    }

    const visualVariant = metalVisualVariant(metal.id);
    const iconFamily = `${chassis.iconBase}_${visualVariant}`;
    const metalInputValueAhn = Math.round(metal.standardUnitValueAhn * chassis.metalUnits);
    const gemstoneInputValueAhn = gems.reduce((sum, gem) => sum + gem.totalValueAhn, 0);
    const consumedInputValueAhn = metalInputValueAhn + gemstoneInputValueAhn;
    const standardProductionValueAhn = Math.round(consumedInputValueAhn * chassis.craftMultiplier);
    const quality = normalizeId(options.quality || DEFAULT_QUALITY) || DEFAULT_QUALITY;
    const productionValueAhn = qualityValue(standardProductionValueAhn, quality);
    const resonance = gemResonanceProfile(gems);
    const overlayGem = dominantGemEntry(gems);
    const gemSummary = gems.map((gem) => `${gem.name} ×${gem.quantity}`).join(", ");
    const displayName = `${metal.name} ${chassis.name}${gemSummary ? ` — ${gemSummary}` : ""}`;

    return Object.freeze({
      valid:true, id:chassis.id, definitionId:chassis.id, family:FAMILY,
      category:chassis.category, itemType:chassis.itemType, equipmentKind:chassis.equipmentKind,
      kind:chassis.kind, iconFamily, iconVisualVariant:visualVariant,
      hasGemVariant:gemCount > 0,
      gemOverlayGemId:overlayGem?.id || null,
      gemOverlayIconFamily:overlayGem?.iconFamily || null,
      gemOverlayCount:overlayGem?.quantity || 0,
      name:chassis.name, displayName, currency:CURRENCY, quality, qualitySystem:"universal",
      stackable:false, quantity:1, acquisition:"market_or_craft", craftable:true, retailAvailable:true, lootOnly:false,
      origin:origin || "market_or_craft", pricingModel:PRICING_MODEL,
      metalId:metal.id, metalName:metal.name, metalUnits:chassis.metalUnits, metalInputValueAhn,
      gemCount, maxGemCount:chassis.maxGemCount, gems:Object.freeze(gems), gemstoneInputValueAhn,
      consumedInputValueAhn, craftMultiplier:chassis.craftMultiplier, processTier:chassis.processTier,
      standardProductionValueAhn,
      baseMundaneValueAhn:productionValueAhn,
      enchantmentBaseValueAhn:productionValueAhn,
      enchantmentReady:gemCount > 0,
      enchantmentMultiplier:1,
      variantSignature:compositionSignature(chassis.id, metal.id, quality, gems),
      productionValueAhn, unitValueAhn:productionValueAhn, totalValueAhn:productionValueAhn,
      gemResonanceWeights:resonance.weights, dominantResonanceTags:resonance.dominantTags,
      enchanted:false, enchantment:null, enchantmentValueAhn:0, enchantmentPricingStatus:ENCHANTMENT_PRICING_STATUS,
      tags:Object.freeze([...chassis.tags, metal.id, ...(gemCount ? ["gem_set"] : ["ungemmed"])]),
    });
  }

  const API = Object.freeze({
    VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, PRICING_MODEL, ENCHANTMENT_PRICING_STATUS,
    DEFAULT_METAL_ID, JEWELRY_CHASSIS, VALUABLE_CHASSIS, CHASSIS, ALIASES,
    get, list, resolveMetal, resolveCutGem, metalVisualVariant, normalizeGemSelection, gemResonanceProfile,
    dominantGemEntry, compositionSignature, applyEnchantmentMultiplier, create,
  });

  global.LuminousJewelryValuableCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
