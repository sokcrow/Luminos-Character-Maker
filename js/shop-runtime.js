(function (global) {
  "use strict";

  if (global.LuminousShopRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShopRuntime;
    return;
  }

  const VERSION = 8;
  const CURRENCY = "AHN";
  const BASE_PURCHASE_MARKUP = 1.40;
  const BASE_SELLBACK_MULTIPLIER = 0.80;
  const SHOP_TIER_PRICE_STEP = 0.04;
  const MAX_TIER = 10;

  const REPAIR_SERVICE_MARKUP = 1.40;

  const SERVICE_TYPES = Object.freeze({
    repair: Object.freeze({
      id: "repair",
      label: "Reparación",
      description: "Restaura puntos de Durabilidad pagando material y mano de obra.",
      markup: REPAIR_SERVICE_MARKUP,
    }),
  });

  const SHOP_TYPE_SERVICES = Object.freeze({
    general: Object.freeze([]),
    convenience: Object.freeze([]),
    supermarket: Object.freeze([]),
    wholesaler: Object.freeze([]),
    provisions: Object.freeze([]),
    restaurant: Object.freeze([]),
    butcher: Object.freeze([]),
    clinic: Object.freeze([]),
    pharmacy: Object.freeze([]),
    workshop: Object.freeze(["repair"]),
    hardware_store: Object.freeze(["repair"]),
    electronics: Object.freeze(["repair"]),
    arms_dealer: Object.freeze(["repair"]),
    jeweler: Object.freeze(["repair"]),
    pawnshop: Object.freeze([]),
    salvage: Object.freeze(["repair"]),
    corporate_outlet: Object.freeze(["repair"]),
    automated_vendor: Object.freeze([]),
    specialist: Object.freeze([]),
    black_market: Object.freeze([]),
  });

  const PROMOTION_TYPES = Object.freeze({
    PERCENT_DISCOUNT: "percent_discount",
    BUY_X_GET_Y: "buy_x_get_y",
    GIFT_AFTER_PURCHASE: "gift_after_purchase",
  });

  const REPAIR_MATERIAL_VALUE_FIELDS = Object.freeze([
    "repairMaterialValuePerPointAhn",
    "repairMaterialPerPointAhn",
    "repairMaterialUnitAhn",
    "materialValuePerDurabilityAhn",
    "materialValuePerPointAhn",
    "durabilityMaterialValueAhn",
  ]);

  // Ordered from the strongest intrinsic / production signal to legacy fallbacks.
  // Zero is treated as "not authored" so placeholder price/costo fields cannot
  // shadow a valid canonical value later in the Item definition.
  const SELL_UNIT_VALUE_FIELDS = Object.freeze([
    "unitValueAhn",
    "standardUnitValueAhn",
    "mediumStandardValueAhn",
    "standardMediumValueAhn",
  ]);

  const BASE_VALUE_FIELDS = Object.freeze([
    "productionValueAhn",
    "productionValue",
    "createdProductionValueAhn",
    "craftBaseValueAhn",
    "cookedBaseValueAhn",
    "totalValueAhn",
    "standardMediumValueAhn",
    "mediumStandardValueAhn",
    "standardUnitValueAhn",
    "standardValueAhn",
    "standardChassisValueAhn",
    "unitValueAhn",
    "baseValueAhn",
    "priceAhn",
    "retailValueAhn",
    "valorBase",
    "costo",
    "price",
  ]);

  const SHOP_TYPES = Object.freeze({
    general: Object.freeze({
      id: "general", label: "Almacén General", priceMultiplier: 1.00, stockMultiplier: 1.25,
      description: "Comercio multipropósito con surtido amplio de bienes cotidianos.",
    }),
    convenience: Object.freeze({
      id: "convenience", label: "Tienda de Conveniencia", priceMultiplier: 1.08, stockMultiplier: 0.95,
      description: "Compra rápida, surtido corto y recargo por disponibilidad inmediata.",
    }),
    supermarket: Object.freeze({
      id: "supermarket", label: "Supermercado", priceMultiplier: 0.96, stockMultiplier: 1.80,
      description: "Alimentos, básicos y consumo cotidiano con alto volumen y margen menor.",
    }),
    wholesaler: Object.freeze({
      id: "wholesaler", label: "Distribuidor / Mayorista", priceMultiplier: 0.90, stockMultiplier: 2.20,
      description: "Proveedor de alto volumen para comercios, talleres y organizaciones.",
    }),
    provisions: Object.freeze({
      id: "provisions", label: "Provisiones", priceMultiplier: 1.00, stockMultiplier: 1.50,
      description: "Comida, suministros y consumibles comunes con stock abundante.",
    }),
    restaurant: Object.freeze({
      id: "restaurant", label: "Restaurante / Comedor", priceMultiplier: 1.18, stockMultiplier: 0.80,
      description: "Alimentos preparados y productos culinarios listos para consumo.",
    }),
    butcher: Object.freeze({
      id: "butcher", label: "Carnicería", priceMultiplier: 1.03, stockMultiplier: 1.20,
      description: "Carne, cortes y subproductos biológicos aptos para cocina o procesamiento.",
    }),
    clinic: Object.freeze({
      id: "clinic", label: "Clínica", priceMultiplier: 1.05, stockMultiplier: 1.00,
      description: "Atención médica y suministros de tratamiento inmediato.",
    }),
    pharmacy: Object.freeze({
      id: "pharmacy", label: "Farmacia", priceMultiplier: 1.08, stockMultiplier: 1.15,
      description: "Medicamentos, curación, antídotos y suministros farmacéuticos.",
    }),
    workshop: Object.freeze({
      id: "workshop", label: "Workshop", priceMultiplier: 1.08, stockMultiplier: 0.85,
      description: "Herramientas, componentes y equipo fabricado.",
    }),
    hardware_store: Object.freeze({
      id: "hardware_store", label: "Ferretería / Suministros", priceMultiplier: 1.02, stockMultiplier: 1.25,
      description: "Herramientas, piezas estructurales, fijaciones y consumibles industriales.",
    }),
    electronics: Object.freeze({
      id: "electronics", label: "Electrónica / Tecnología", priceMultiplier: 1.15, stockMultiplier: 0.70,
      description: "Componentes eléctricos, circuitos, sensores, óptica y precisión.",
    }),
    arms_dealer: Object.freeze({
      id: "arms_dealer", label: "Armería", priceMultiplier: 1.12, stockMultiplier: 0.75,
      description: "Armas, armaduras, munición y equipo de combate.",
    }),
    jeweler: Object.freeze({
      id: "jeweler", label: "Joyería", priceMultiplier: 1.18, stockMultiplier: 0.60,
      description: "Joyas, gemas, metales refinados y objetos de valor.",
    }),
    pawnshop: Object.freeze({
      id: "pawnshop", label: "Casa de Empeño", priceMultiplier: 0.95, stockMultiplier: 0.70,
      description: "Bienes usados, herramientas, equipo y valuables de procedencia variable.",
    }),
    salvage: Object.freeze({
      id: "salvage", label: "Chatarrería / Recuperación", priceMultiplier: 0.88, stockMultiplier: 1.10,
      description: "Material recuperado, piezas, componentes y recursos de segunda mano.",
    }),
    corporate_outlet: Object.freeze({
      id: "corporate_outlet", label: "Tienda Corporativa", priceMultiplier: 1.10, stockMultiplier: 0.90,
      description: "Suministro técnico y productos de línea corporativa o de alta precisión.",
    }),
    automated_vendor: Object.freeze({
      id: "automated_vendor", label: "Punto Automatizado", priceMultiplier: 1.12, stockMultiplier: 0.65,
      description: "Venta automática de consumibles y suministros de uso inmediato.",
    }),
    specialist: Object.freeze({
      id: "specialist", label: "Especialista", priceMultiplier: 1.18, stockMultiplier: 0.55,
      description: "Bienes raros, técnicos o de nicho con disponibilidad limitada.",
    }),
    black_market: Object.freeze({
      id: "black_market", label: "Mercado Negro", priceMultiplier: 1.25, stockMultiplier: 0.35,
      description: "Mercancía escasa o restringida a precios de riesgo.",
    }),
  });

  let activeMarketEvent = null;

  const SHOP_TYPE_CATALOG = Object.freeze({
    general: Object.freeze({
      primary: Object.freeze(["food", "culinary_staples", "plant_produce", "tools", "medical_supply"]),
      secondary: Object.freeze(["craft_components", "chemical_raw", "medicinal_raw", "healing_hp", "healing_sp", "status_cure"]),
      primaryStockMultiplier: 1.00, secondaryStockMultiplier: 0.70,
    }),
    convenience: Object.freeze({
      primary: Object.freeze(["retail_food", "food", "healing_hp", "medical_supply", "status_cure"]),
      secondary: Object.freeze(["tools", "culinary_staples", "plant_produce", "firearm_ammunition", "ammo"]),
      primaryStockMultiplier: 1.00, secondaryStockMultiplier: 0.45,
    }),
    supermarket: Object.freeze({
      primary: Object.freeze(["retail_food", "food", "culinary_staples", "plant_produce", "meat"]),
      secondary: Object.freeze(["medical_supply", "healing_hp", "tools", "processed_textile", "container", "cleaning_compound"]),
      primaryStockMultiplier: 1.20, secondaryStockMultiplier: 0.70,
    }),
    wholesaler: Object.freeze({
      primary: Object.freeze(["food", "culinary_staples", "plant_produce", "meat", "craft_components", "medical_supply", "chemical_raw", "medicinal_raw"]),
      secondary: Object.freeze(["tools", "chemical_processed", "medicinal_processed", "ore_ingot_gem"]),
      primaryStockMultiplier: 1.35, secondaryStockMultiplier: 0.90,
    }),
    provisions: Object.freeze({
      primary: Object.freeze(["food", "culinary_staples", "plant_produce", "meat"]),
      secondary: Object.freeze(["medical_supply", "healing_hp", "tools", "medicinal_raw"]),
      primaryStockMultiplier: 1.15, secondaryStockMultiplier: 0.65,
    }),
    restaurant: Object.freeze({
      primary: Object.freeze(["retail_food", "food", "meat", "plant_produce", "culinary_staples"]),
      secondary: Object.freeze(["container"]),
      primaryStockMultiplier: 0.95, secondaryStockMultiplier: 0.35,
    }),
    butcher: Object.freeze({
      primary: Object.freeze(["meat", "raw_meat", "hide_pelt"]),
      secondary: Object.freeze(["organ_gland", "blood_ichor", "culinary_staples"]),
      primaryStockMultiplier: 1.10, secondaryStockMultiplier: 0.55,
    }),
    clinic: Object.freeze({
      primary: Object.freeze(["healing_hp", "healing_sp", "healing_hybrid", "status_cure", "medical_supply"]),
      secondary: Object.freeze(["medicinal_raw", "medicinal_processed", "blood_ichor", "organ_gland"]),
      primaryStockMultiplier: 1.00, secondaryStockMultiplier: 0.60,
    }),
    pharmacy: Object.freeze({
      primary: Object.freeze(["healing_hp", "healing_sp", "healing_hybrid", "status_cure", "medical_supply", "medicinal_processed"]),
      secondary: Object.freeze(["medicinal_raw", "antitoxin_base", "pharmaceutical_powder", "medical_gel_base"]),
      primaryStockMultiplier: 1.10, secondaryStockMultiplier: 0.65,
    }),
    workshop: Object.freeze({
      primary: Object.freeze(["tools", "craft_components", "ore_ingot_gem", "chemical_raw", "chemical_processed"]),
      secondary: Object.freeze(["armor_components", "weapon_components", "firearm_components", "ranged_weapon_components", "shield_components", "throwable_components", "armor_upgrades", "shield_upgrades", "weapon_upgrade", "armor_upgrade", "shield_upgrade", "weapon_component", "armor_component", "shield_component", "component", "hide_pelt", "scale_shell_chitin", "feather_raw_fiber", "hard_parts"]),
      primaryStockMultiplier: 1.00, secondaryStockMultiplier: 0.65,
    }),
    hardware_store: Object.freeze({
      primary: Object.freeze(["tools", "craft_components", "fasteners_hardware", "structural_stock", "mechanical_parts", "adhesive_binder_sealant"]),
      secondary: Object.freeze(["ore_ingot_gem", "armor_components", "weapon_components", "shield_components", "chemical_raw", "chemical_processed"]),
      primaryStockMultiplier: 1.10, secondaryStockMultiplier: 0.70,
    }),
    electronics: Object.freeze({
      primary: Object.freeze(["electronic_parts", "electrical_component", "circuitry", "sensor_component", "precision_component", "optical_component", "calibration_component", "tools"]),
      secondary: Object.freeze(["craft_components", "chemical_processed", "corp_wing_precision_component"]),
      primaryStockMultiplier: 0.95, secondaryStockMultiplier: 0.55,
    }),
    arms_dealer: Object.freeze({
      primary: Object.freeze(["weapons", "weapon", "firearm_ammunition", "ammo_component", "weapon_components", "firearm_components", "ranged_weapon_components", "armor_components", "shield_components", "armor", "shield", "ammo"]),
      secondary: Object.freeze(["throwable_components", "armor_upgrades", "shield_upgrades", "weapon_upgrade", "armor_upgrade", "shield_upgrade", "weapon_component", "armor_component", "shield_component"]),
      primaryStockMultiplier: 1.00, secondaryStockMultiplier: 0.55,
    }),
    jeweler: Object.freeze({
      primary: Object.freeze(["jewelry_valuables", "jewelry", "valuable", "cut_gem", "gem", "gemstone"]),
      secondary: Object.freeze(["ore_ingot_gem", "refined_metal", "alloy"]),
      primaryStockMultiplier: 0.90, secondaryStockMultiplier: 0.55,
    }),
    pawnshop: Object.freeze({
      primary: Object.freeze(["valuable", "jewelry_valuables", "tools", "weapons", "weapon", "armor", "shield"]),
      secondary: Object.freeze(["ore_ingot_gem", "medical_supply"]),
      primaryStockMultiplier: 0.75, secondaryStockMultiplier: 0.45,
    }),
    salvage: Object.freeze({
      primary: Object.freeze(["craft_components", "ore_ingot_gem", "hide_pelt", "scale_shell_chitin", "feather_raw_fiber", "hard_parts"]),
      secondary: Object.freeze(["weapon_components", "armor_components", "shield_components", "firearm_components", "ranged_weapon_components", "chemical_raw"]),
      primaryStockMultiplier: 1.05, secondaryStockMultiplier: 0.70,
    }),
    corporate_outlet: Object.freeze({
      primary: Object.freeze(["corp_wing_precision_component", "exotic_industrial_component", "precision_component", "electronic_parts", "tools", "medical_supply"]),
      secondary: Object.freeze(["weapon_components", "armor_upgrades", "weapon_upgrade", "ore_ingot_gem", "chemical_processed"]),
      primaryStockMultiplier: 0.90, secondaryStockMultiplier: 0.50,
    }),
    automated_vendor: Object.freeze({
      primary: Object.freeze(["retail_food", "food", "healing_hp", "healing_sp", "medical_supply", "firearm_ammunition", "ammo"]),
      secondary: Object.freeze(["status_cure", "tools"]),
      primaryStockMultiplier: 0.80, secondaryStockMultiplier: 0.35,
    }),
    specialist: Object.freeze({
      primary: Object.freeze(["jewelry_valuables", "valuable", "essence_core", "ooze_gel", "venom_secretion", "organ_gland", "blood_ichor"]),
      secondary: Object.freeze(["medicinal_processed", "chemical_processed", "armor_upgrades", "shield_upgrades", "weapon_upgrade", "armor_upgrade", "shield_upgrade", "ore_ingot_gem", "tools"]),
      primaryStockMultiplier: 0.85, secondaryStockMultiplier: 0.50,
    }),
    black_market: Object.freeze({
      primary: Object.freeze(["weapons", "weapon", "firearm_ammunition", "ammo_component", "throwable_components", "venom_secretion", "blood_ichor", "organ_gland", "essence_core", "jewelry_valuables", "valuable"]),
      secondary: Object.freeze(["chemical_processed", "medicinal_processed", "healing_hybrid", "status_cure", "weapon_components", "firearm_components", "ranged_weapon_components", "armor_components", "shield_components", "armor_upgrades", "shield_upgrades", "weapon_upgrade", "armor_upgrade", "shield_upgrade"]),
      primaryStockMultiplier: 0.70, secondaryStockMultiplier: 0.45,
      highTierFallbackStockMultiplier: 0.35, highTierFallbackMinTier: 4,
    }),
  });

  const ROMAN = Object.freeze(["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  const ROMAN_TO_NUMBER = Object.freeze(
    ROMAN.reduce((out, value, index) => {
      if (value) out[value] = index;
      return out;
    }, {})
  );

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeToken(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function itemCatalogTokens(item = {}) {
    const tokens = new Set();
    const add = (value) => {
      const token = normalizeToken(value);
      if (token) tokens.add(token);
    };
    const addMany = (value) => {
      if (Array.isArray(value)) value.forEach(add);
      else if (value != null) add(value);
    };

    [
      item.id, item.definitionId, item.canonicalId, item.family, item.group,
      item.category, item.tipo, item.tipo_categoria, item.itemType, item.item_type,
      item.iconFamily, item.icon_family, item.toolCategory, item.processId,
      item.form, item.processedForm, item.outputForm, item.materialClass,
      item.sourceLine, item.scope
    ].forEach(add);

    [
      item.tags, item.itemTags, item.useTags, item.functionalTags, item.craftTags,
      item.reagentTags, item.materialTags, item.processingTags, item.requirementTags,
      item.addTags, item.recipeRoles
    ].forEach(addMany);

    return tokens;
  }

  function tokensMatchRule(tokens, ruleToken) {
    const wanted = normalizeToken(ruleToken);
    if (!wanted) return false;
    for (const token of tokens) {
      if (token === wanted || token.startsWith(wanted + "_")) return true;
    }
    return false;
  }

  function numberOr(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundAhn(value) {
    const economy = global.LuminousItemEconomyStandard;
    if (economy && typeof economy.roundAhn === "function") {
      return economy.roundAhn(value, 10);
    }
    return Math.max(0, Math.round(numberOr(value, 0) / 10) * 10);
  }

  function tierNumber(value, fallback = 1) {
    if (typeof value === "string") {
      const normalized = value.trim().toUpperCase();
      if (ROMAN_TO_NUMBER[normalized]) return ROMAN_TO_NUMBER[normalized];
    }
    return clamp(Math.trunc(numberOr(value, fallback)) || fallback, 1, MAX_TIER);
  }

  function tierRoman(value) {
    return ROMAN[tierNumber(value)] || "I";
  }

  function shopTier(shop = {}) {
    return tierNumber(shop.shop_tier ?? shop.shopTier ?? shop.tier ?? 1);
  }

  function itemTier(item = {}) {
    return tierNumber(item.tier ?? item.itemTier ?? item.qualityTier ?? 1);
  }

  function shopTypeId(shop = {}) {
    const id = String(shop.shop_type ?? shop.shopType ?? shop.tipo_tienda ?? "general").trim().toLowerCase();
    return SHOP_TYPES[id] ? id : "general";
  }

  function shopType(shopOrId = {}) {
    const id = typeof shopOrId === "string" ? shopOrId : shopTypeId(shopOrId);
    return SHOP_TYPES[id] || SHOP_TYPES.general;
  }


  function listValues(value) {
    if (Array.isArray(value)) return value.filter((entry) => entry != null);
    if (!value || typeof value !== "object") return [];
    return Object.values(value).filter((entry) => entry != null);
  }

  function shopChain(shop = {}) {
    const raw = shop.chain ?? shop.cadena ?? null;
    const explicitName = String(
      (raw && typeof raw === "object" ? (raw.name ?? raw.nombre) : raw) ??
      shop.chain_name ??
      shop.cadena_nombre ??
      ""
    ).trim();
    const explicitId = String(
      (raw && typeof raw === "object" ? raw.id : "") ??
      shop.chain_id ??
      shop.cadena_id ??
      ""
    ).trim();
    const id = normalizeToken(explicitId || explicitName);
    if (!id && !explicitName) return null;
    return Object.freeze({
      id: id || normalizeToken(explicitName),
      name: explicitName || explicitId,
      promotions: raw && typeof raw === "object" ? clone(raw.promotions ?? raw.promociones ?? []) : [],
      loyaltyProgram: raw && typeof raw === "object"
        ? clone(raw.loyalty_program ?? raw.loyaltyProgram ?? null)
        : null,
    });
  }

  function merchantNpc(shop = {}) {
    const raw = shop.merchant_npc ?? shop.merchantNpc ?? shop.merchant ?? null;
    if (!raw || typeof raw !== "object") return null;
    if (raw.enabled === false || raw.activo === false) return null;
    const name = String(raw.name ?? raw.nombre ?? "").trim();
    const sprite = String(raw.sprite ?? raw.sprite_url ?? raw.retrato ?? "").trim();
    const id = normalizeToken(raw.id ?? raw.npc_id ?? name);
    if (!id && !name && !sprite) return null;
    return Object.freeze({
      id,
      name,
      sprite,
      frequentCustomerMinPurchases: Math.max(
        0,
        Math.trunc(numberOr(raw.frequent_customer_min_purchases ?? raw.frequentCustomerMinPurchases, 0)),
      ),
      frequentCustomerDiscountPercent: clamp(
        numberOr(raw.frequent_customer_discount_percent ?? raw.frequentCustomerDiscountPercent, 0),
        0,
        90,
      ),
      relationshipDiscounts: Object.freeze({
        ...(raw.relationship_discounts ?? raw.relationshipDiscounts ?? {}),
      }),
      promotions: clone(raw.promotions ?? raw.promociones ?? []),
    });
  }

  function defaultServiceIdsForShopType(shopOrType = {}) {
    const typeId = typeof shopOrType === "string"
      ? (SHOP_TYPES[shopOrType] ? shopOrType : "general")
      : shopTypeId(shopOrType);
    return SHOP_TYPE_SERVICES[typeId] || Object.freeze([]);
  }

  function serviceConfig(shop = {}, serviceId = "") {
    const id = normalizeToken(serviceId);
    if (!SERVICE_TYPES[id]) return null;
    const raw = shop.services ?? shop.servicios;
    if (Array.isArray(raw)) {
      return raw.map(normalizeToken).includes(id) ? Object.freeze({ enabled: true }) : null;
    }
    if (raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, id)) {
      const config = raw[id];
      if (config === true) return Object.freeze({ enabled: true });
      if (config === false) return Object.freeze({ enabled: false });
      if (config && typeof config === "object") {
        return Object.freeze({ ...clone(config), enabled: config.enabled !== false });
      }
    }
    return null;
  }

  function serviceEnabled(shop = {}, serviceId = "") {
    const id = normalizeToken(serviceId);
    if (!SERVICE_TYPES[id]) return false;
    const explicit = serviceConfig(shop, id);
    if (explicit) return explicit.enabled !== false;
    return defaultServiceIdsForShopType(shop).includes(id);
  }

  function servicesForShop(shop = {}) {
    return Object.freeze(
      Object.keys(SERVICE_TYPES).filter((id) => serviceEnabled(shop, id)),
    );
  }

  function firstFinite(values, { positive = false, nonNegative = false } = {}) {
    for (const raw of values) {
      if (raw == null || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      if (positive && value <= 0) continue;
      if (nonNegative && value < 0) continue;
      return value;
    }
    return null;
  }

  function durabilityState(item = {}) {
    const current = firstFinite([
      item.durabilityCurrent,
      item.currentDurability,
      item.durability?.current,
      item.durabilidad_actual,
      item.durabilidadActual,
      typeof item.durabilidad === "number" ? item.durabilidad : null,
    ], { nonNegative: true });
    const max = firstFinite([
      item.durabilityMax,
      item.maxDurability,
      item.durability?.max,
      item.durabilidad_maxima,
      item.durabilidadMaxima,
      item.max_durabilidad,
    ], { positive: true });

    if (current == null || max == null) {
      return Object.freeze({
        resolved: false,
        current: current == null ? null : current,
        max: max == null ? null : max,
        missing: null,
      });
    }

    const normalizedCurrent = clamp(current, 0, max);
    return Object.freeze({
      resolved: true,
      current: normalizedCurrent,
      max,
      missing: Math.max(0, max - normalizedCurrent),
    });
  }

  function resolveRepairMaterialValueAhn(item = {}, options = {}) {
    const direct = firstFinite([
      options.materialValuePerPointAhn,
      options.materialValueAhn,
      ...REPAIR_MATERIAL_VALUE_FIELDS.map((field) => item?.[field]),
    ], { positive: true });
    if (direct != null) {
      return Object.freeze({ resolved: true, field: "per_point", value: direct });
    }

    if (options.material && typeof options.material === "object") {
      const materialResolution = resolveBaseValueAhn(options.material);
      if (materialResolution.resolved) {
        return Object.freeze({
          resolved: true,
          field: "material:" + materialResolution.field,
          value: materialResolution.value,
        });
      }
    }

    return Object.freeze({ resolved: false, field: null, value: null });
  }

  function repairBreakdown(item = {}, shop = {}, options = {}) {
    const enabled = serviceEnabled(shop, "repair");
    const durability = durabilityState(item);
    const material = resolveRepairMaterialValueAhn(item, options);
    const requestedPoints = options.points == null
      ? durability.missing
      : Math.max(0, Math.trunc(numberOr(options.points, 0)));
    const points = durability.resolved
      ? clamp(requestedPoints == null ? 0 : requestedPoints, 0, durability.missing)
      : 0;

    let reason = "available";
    if (!enabled) reason = "service_unavailable";
    else if (!durability.resolved) reason = "durability_unresolved";
    else if (durability.missing <= 0) reason = "not_damaged";
    else if (!material.resolved) reason = "material_unpriced";

    const subtotal = reason === "available"
      ? roundAhn(points * material.value)
      : null;
    const price = reason === "available"
      ? roundAhn(subtotal * REPAIR_SERVICE_MARKUP)
      : null;

    return Object.freeze({
      serviceId: "repair",
      serviceLabel: SERVICE_TYPES.repair.label,
      available: reason === "available",
      reason,
      currency: CURRENCY,
      currentDurability: durability.current,
      maxDurability: durability.max,
      missingDurability: durability.missing,
      points,
      materialValuePerPointAhn: material.value,
      materialValueSource: material.field,
      materialSubtotalAhn: subtotal,
      serviceMarkup: REPAIR_SERVICE_MARKUP,
      priceAhn: price,
    });
  }

  function repairPrice(item = {}, shop = {}, options = {}) {
    return repairBreakdown(item, shop, options).priceAhn;
  }

  function normalizePromotion(raw = {}, index = 0) {
    if (!raw || typeof raw !== "object" || raw.active === false || raw.enabled === false) return null;
    const type = normalizeToken(raw.type ?? raw.kind ?? raw.promotion_type);
    if (!Object.values(PROMOTION_TYPES).includes(type)) return null;
    const id = normalizeToken(raw.id ?? raw.promotion_id ?? (type + "_" + index));
    const scope = normalizeToken(raw.scope ?? "all") || "all";
    return Object.freeze({
      id,
      label: String(raw.label ?? raw.name ?? raw.nombre ?? "Promoción").trim() || "Promoción",
      type,
      scope,
      discountPercent: clamp(numberOr(raw.discount_percent ?? raw.discountPercent, 0), 0, 100),
      itemIds: Object.freeze((raw.item_ids ?? raw.itemIds ?? []).map?.(normalizeToken) || []),
      categories: Object.freeze((raw.categories ?? raw.categorias ?? []).map?.(normalizeToken) || []),
      serviceIds: Object.freeze((raw.service_ids ?? raw.serviceIds ?? []).map?.(normalizeToken) || []),
      buyQuantity: Math.max(1, Math.trunc(numberOr(raw.buy_quantity ?? raw.buyQuantity, 1))),
      rewardItemId: normalizeToken(raw.reward_item_id ?? raw.rewardItemId ?? ""),
      rewardQuantity: Math.max(1, Math.trunc(numberOr(raw.reward_quantity ?? raw.rewardQuantity, 1))),
      stackable: raw.stackable === true,
    });
  }

  function shopPromotions(shop = {}) {
    const chain = shopChain(shop);
    const merchant = merchantNpc(shop);
    const raw = [
      ...listValues(chain?.promotions),
      ...listValues(shop.promotions ?? shop.promociones),
      ...listValues(merchant?.promotions),
    ];
    return Object.freeze(
      raw.map(normalizePromotion).filter(Boolean),
    );
  }

  function promotionMatchesItem(promotion, item = {}) {
    if (!promotion) return false;
    if (promotion.scope === "all" || !promotion.scope) return true;
    const ids = new Set([
      normalizeToken(item.id),
      normalizeToken(item.definitionId),
      normalizeToken(item.canonicalId),
    ].filter(Boolean));
    if (promotion.scope === "item") {
      return promotion.itemIds.some((id) => ids.has(id));
    }
    if (promotion.scope === "category") {
      const tokens = itemCatalogTokens(item);
      return promotion.categories.some((category) => tokensMatchRule(tokens, category));
    }
    return false;
  }

  function promotionDiscountBreakdown(item = {}, shop = {}) {
    const matches = shopPromotions(shop).filter(
      (promotion) =>
        promotion.type === PROMOTION_TYPES.PERCENT_DISCOUNT &&
        promotionMatchesItem(promotion, item) &&
        promotion.discountPercent > 0,
    );
    const stackable = matches
      .filter((promotion) => promotion.stackable)
      .reduce((sum, promotion) => sum + promotion.discountPercent, 0);
    const bestExclusive = matches
      .filter((promotion) => !promotion.stackable)
      .reduce((best, promotion) => Math.max(best, promotion.discountPercent), 0);
    return Object.freeze({
      percent: clamp(stackable + bestExclusive, 0, 90),
      promotions: Object.freeze(matches),
    });
  }

  function merchantDiscountPercent(shop = {}, context = {}) {
    const merchant = merchantNpc(shop);
    if (!merchant) return 0;
    let total = 0;
    const purchaseCount = Math.max(
      0,
      Math.trunc(numberOr(
        context.shopPurchaseCount ??
        context.purchaseCount ??
        context.customer?.shopPurchaseCount,
        0,
      )),
    );
    if (
      merchant.frequentCustomerMinPurchases > 0 &&
      purchaseCount >= merchant.frequentCustomerMinPurchases
    ) {
      total += merchant.frequentCustomerDiscountPercent;
    }

    const relationshipTier = normalizeToken(
      context.relationshipTier ??
      context.npcRelationshipTier ??
      context.customer?.relationshipTier ??
      "",
    );
    if (relationshipTier) {
      const raw = Number(merchant.relationshipDiscounts?.[relationshipTier]);
      if (Number.isFinite(raw) && raw > 0) total += raw;
    }

    const direct = Number(context.merchantDiscountPercent);
    if (Number.isFinite(direct) && direct > 0) total += direct;
    return clamp(total, 0, 90);
  }

  function loyaltyProgram(shop = {}) {
    const chain = shopChain(shop);
    const raw =
      shop.loyalty_program ??
      shop.loyaltyProgram ??
      chain?.loyaltyProgram ??
      null;
    if (!raw || typeof raw !== "object" || raw.enabled === false || raw.active === false) return null;
    const name = String(raw.name ?? raw.nombre ?? raw.label ?? "Programa de lealtad").trim();
    const id = normalizeToken(raw.id ?? raw.program_id ?? raw.programId ?? name);
    const paidPurchasesRequired = Math.max(
      1,
      Math.trunc(numberOr(
        raw.paid_purchases_required ??
        raw.paidPurchasesRequired ??
        raw.stamps_required ??
        raw.stampsRequired,
        9,
      )),
    );
    return Object.freeze({
      id: id || "shop_loyalty",
      name: name || "Programa de lealtad",
      paidPurchasesRequired,
      rewardType: normalizeToken(raw.reward_type ?? raw.rewardType ?? "free_next") || "free_next",
      itemIds: Object.freeze((raw.item_ids ?? raw.itemIds ?? []).map?.(normalizeToken) || []),
      categories: Object.freeze((raw.categories ?? raw.categorias ?? []).map?.(normalizeToken) || []),
      serviceIds: Object.freeze((raw.service_ids ?? raw.serviceIds ?? []).map?.(normalizeToken) || []),
    });
  }

  function loyaltyAppliesToItem(program, item = {}) {
    if (!program) return false;
    if (!program.itemIds.length && !program.categories.length && !program.serviceIds.length) return true;
    const ids = new Set([
      normalizeToken(item.id),
      normalizeToken(item.definitionId),
      normalizeToken(item.canonicalId),
    ].filter(Boolean));
    if (program.itemIds.some((id) => ids.has(id))) return true;
    const tokens = itemCatalogTokens(item);
    return program.categories.some((category) => tokensMatchRule(tokens, category));
  }

  function loyaltyStatus(shop = {}, context = {}, item = null) {
    const program = loyaltyProgram(shop);
    if (!program) return Object.freeze({ active: false, program: null, progress: 0, rewardReady: false });
    const source =
      context.loyalty ??
      context.loyaltyPrograms?.[program.id] ??
      context.customer?.loyaltyPrograms?.[program.id] ??
      {};
    const progress = clamp(
      Math.trunc(numberOr(source.progress ?? source.stamps ?? context.loyaltyProgress, 0)),
      0,
      program.paidPurchasesRequired,
    );
    const eligible = item ? loyaltyAppliesToItem(program, item) : true;
    return Object.freeze({
      active: true,
      program,
      progress,
      required: program.paidPurchasesRequired,
      eligible,
      rewardReady: eligible && progress >= program.paidPurchasesRequired,
    });
  }

  function nextLoyaltyProgress(shop = {}, context = {}, options = {}) {
    const status = loyaltyStatus(shop, context, options.item || null);
    if (!status.active || options.qualified === false || status.eligible === false) return status.progress || 0;
    if (options.redeemed === true || status.rewardReady) return 0;
    return Math.min(status.required, status.progress + 1);
  }

  function promotionRewardPlan(item = {}, shop = {}, context = {}) {
    const rewards = [];
    const progress = context.promotionProgress ?? {};
    for (const promotion of shopPromotions(shop)) {
      if (!promotionMatchesItem(promotion, item)) continue;
      if (promotion.type === PROMOTION_TYPES.GIFT_AFTER_PURCHASE && promotion.rewardItemId) {
        rewards.push(Object.freeze({
          promotionId: promotion.id,
          type: promotion.type,
          itemId: promotion.rewardItemId,
          quantity: promotion.rewardQuantity,
        }));
      }
      if (promotion.type === PROMOTION_TYPES.BUY_X_GET_Y && promotion.rewardItemId) {
        const current = Math.max(0, Math.trunc(numberOr(progress[promotion.id], 0)));
        if (current + 1 >= promotion.buyQuantity) {
          rewards.push(Object.freeze({
            promotionId: promotion.id,
            type: promotion.type,
            itemId: promotion.rewardItemId,
            quantity: promotion.rewardQuantity,
          }));
        }
      }
    }
    return Object.freeze(rewards);
  }

  function assignedPlayers(shop = {}) {
    const raw = shop.jugadores_presentes ?? shop.assignedPlayers ?? {};
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .filter(([, allowed]) => allowed === true)
      .map(([id]) => String(id));
  }

  function playerCount(shop = {}, fallback = 1) {
    const count = assignedPlayers(shop).length;
    return count > 0 ? count : Math.max(0, Math.trunc(numberOr(fallback, 1)));
  }

  function isPlayerAllowed(shop = {}, playerId) {
    const players = assignedPlayers(shop);
    if (!players.length) return true; // Legacy stores without an access map remain usable.
    return players.includes(String(playerId ?? ""));
  }

  function catalogRuleForShop(shop = {}) {
    return SHOP_TYPE_CATALOG[shopTypeId(shop)] || SHOP_TYPE_CATALOG.general;
  }

  function shopCatalogMatch(item = {}, shop = {}) {
    if (item && item.purchasable === false) {
      return Object.freeze({ eligible: false, band: "blocked", stockMultiplier: 0 });
    }

    const rule = catalogRuleForShop(shop);
    const tokens = itemCatalogTokens(item);
    const primary = rule.primary.some((token) => tokensMatchRule(tokens, token));
    if (primary) {
      return Object.freeze({
        eligible: true,
        band: "primary",
        stockMultiplier: rule.primaryStockMultiplier,
      });
    }

    const secondary = rule.secondary.some((token) => tokensMatchRule(tokens, token));
    if (secondary) {
      return Object.freeze({
        eligible: true,
        band: "secondary",
        stockMultiplier: rule.secondaryStockMultiplier,
      });
    }

    if (
      shopTypeId(shop) === "black_market" &&
      itemTier(item) >= (rule.highTierFallbackMinTier || 4)
    ) {
      return Object.freeze({
        eligible: true,
        band: "high_tier_fallback",
        stockMultiplier: rule.highTierFallbackStockMultiplier || 0.35,
      });
    }

    return Object.freeze({ eligible: false, band: "none", stockMultiplier: 0 });
  }

  function itemEligibleForShopType(item = {}, shop = {}) {
    return shopCatalogMatch(item, shop).eligible;
  }

  function resolveBaseValueAhn(item = {}) {
    for (const field of BASE_VALUE_FIELDS) {
      const raw = item?.[field];
      if (raw == null || raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        return Object.freeze({ resolved: true, field, value });
      }
    }
    return Object.freeze({ resolved: false, field: null, value: null });
  }

  function hasBaseValueAhn(item = {}) {
    return resolveBaseValueAhn(item).resolved;
  }

  function baseValueAhn(item = {}) {
    return resolveBaseValueAhn(item).value || 0;
  }

  function stackQuantityOf(item = {}) {
    const quantity = Number(item.quantity ?? item.cantidad ?? 1);
    return Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.trunc(quantity)) : 1;
  }

  function resolveSellUnitValueAhn(item = {}) {
    for (const field of SELL_UNIT_VALUE_FIELDS) {
      const raw = item?.[field];
      if (raw == null || raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        return Object.freeze({ resolved: true, field, value });
      }
    }

    const total = Number(item?.totalValueAhn);
    if (Number.isFinite(total) && total > 0) {
      const quantity = stackQuantityOf(item);
      return Object.freeze({
        resolved: true,
        field: quantity > 1 ? "totalValueAhn/quantity" : "totalValueAhn",
        value: total / quantity,
      });
    }

    return resolveBaseValueAhn(item);
  }

  const REFERENCE_COMPONENT_CATALOGS = Object.freeze({
    armor_components: "LuminousArmorComponentCatalog",
    weapon_components: "LuminousWeaponComponentCatalog",
    ranged_weapon_components: "LuminousRangedWeaponComponentCatalog",
    firearm_components: "LuminousFirearmComponentCatalog",
    shield_components: "LuminousShieldComponentCatalog",
  });

  function definitionIdOf(item = {}) {
    return normalizeToken(
      item.definitionId ?? item.definition_id ?? item.canonicalId ??
      item.itemId ?? item.item_id ?? item.id ?? item.key ?? ""
    );
  }

  function positiveEconomicAlias(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function materializeReferenceItem(item = {}, options = {}) {
    const source = clone(item) || {};
    const authored = resolveBaseValueAhn(source);
    if (authored.resolved) return source;

    const definitionId = definitionIdOf(source);
    if (!definitionId) return null;

    const family = normalizeToken(source.family || source.group || source.catalogId || source.catalog_id);
    let resolved = null;

    const componentGlobalName = REFERENCE_COMPONENT_CATALOGS[family];
    const componentCatalog = componentGlobalName ? global[componentGlobalName] : null;
    if (componentCatalog && typeof componentCatalog.resolveReferenceComponent === "function") {
      try {
        resolved = componentCatalog.resolveReferenceComponent(definitionId);
      } catch (_) {}
    }

    if ((!resolved || resolved.valid === false) && family === "jewelry_valuables") {
      const catalog = global.LuminousJewelryValuableCatalog;
      if (catalog && typeof catalog.create === "function") {
        const isValuable =
          normalizeToken(source.kind) === "valuable" ||
          normalizeToken(source.category) === "valuable" ||
          normalizeToken(source.itemType) === "valuable" ||
          source.lootOnly === true;

        try {
          if (isValuable) {
            resolved = catalog.create(definitionId, {
              origin: "loot",
              variant: normalizeToken(options.valuableVariant || source.valuableVariant || "gold") || "gold",
            });
          } else {
            resolved = catalog.create(definitionId, {
              metalId: options.metalId || options.metal || source.metalId || catalog.DEFAULT_METAL_ID || "silver",
              quality: options.quality || source.quality || "standard",
              gems: options.gems || source.gems || [],
            });
          }
        } catch (_) {}
      }
    }

    if (!resolved || resolved.valid === false) return null;

    const merged = Object.assign({}, source, clone(resolved));
    merged.id = source.id || resolved.id || definitionId;
    merged.definitionId = source.definitionId || resolved.definitionId || definitionId;
    merged.canonicalId = source.canonicalId || merged.definitionId;
    merged.nombre = resolved.displayName || source.nombre || resolved.name || source.name || definitionId;
    merged.name = resolved.name || source.name || source.nombre || merged.nombre;

    const valueResolution = resolveBaseValueAhn(merged);
    if (!valueResolution.resolved) return null;

    const value = roundAhn(valueResolution.value);
    merged.price = positiveEconomicAlias(merged.price, value);
    merged.costo = positiveEconomicAlias(merged.costo, value);
    merged.valorBase = positiveEconomicAlias(merged.valorBase, value);
    return merged;
  }

  function tierPriceMultiplier(shopOrTier = {}) {
    const tier = typeof shopOrTier === "object" ? shopTier(shopOrTier) : tierNumber(shopOrTier);
    return 1 + (tier - 1) * SHOP_TIER_PRICE_STEP;
  }

  function localPriceMultiplier(shop = {}) {
    const percent = numberOr(shop.mod_venta ?? shop.localPricePercent, 100);
    return clamp(percent, 25, 400) / 100;
  }

  function sanitizeMarketEvent(event = null) {
    if (!event || event.active === false) return null;
    const modifiers = {};
    for (const id of Object.keys(SHOP_TYPES)) {
      const raw = Number(event.modifiers?.[id] ?? event.shopTypeModifiers?.[id]);
      if (!Number.isFinite(raw) || raw === 0) continue;
      modifiers[id] = clamp(Math.round(raw), -90, 300);
    }
    if (!Object.keys(modifiers).length) return null;
    return Object.freeze({
      active: true,
      id: String(event.id || event.eventId || event.revision || ""),
      revision: Number(event.revision || event.updatedAt || 0) || 0,
      title: String(event.title || "Variación de precios").trim() || "Variación de precios",
      message: String(event.message || "").trim(),
      modifiers: Object.freeze(modifiers),
    });
  }

  function setMarketEvent(event = null) {
    activeMarketEvent = sanitizeMarketEvent(event);
    return activeMarketEvent;
  }

  function getMarketEvent() {
    return activeMarketEvent;
  }

  function marketEventPercent(shop = {}) {
    if (!activeMarketEvent) return 0;
    const percent = Number(activeMarketEvent.modifiers?.[shopTypeId(shop)]);
    return Number.isFinite(percent) ? percent : 0;
  }

  function marketEventMultiplier(shop = {}) {
    return Math.max(0.10, 1 + marketEventPercent(shop) / 100);
  }

  function priceBreakdown(item = {}, shop = {}, options = {}) {
    const type = shopType(shop);
    const resolution = resolveBaseValueAhn(item);
    const tierMultiplier = tierPriceMultiplier(shop);
    const localMultiplier = localPriceMultiplier(shop);
    const eventPercent = options.ignoreMarketEvent ? 0 : marketEventPercent(shop);
    const eventMultiplier = options.ignoreMarketEvent ? 1 : marketEventMultiplier(shop);
    const listPrice = resolution.resolved
      ? roundAhn(
          resolution.value *
          BASE_PURCHASE_MARKUP *
          type.priceMultiplier *
          tierMultiplier *
          localMultiplier *
          eventMultiplier
        )
      : null;

    const context = options.context ?? options.customer ?? {};
    const promotionBreakdown = options.ignoreCommerce || options.ignorePromotions
      ? Object.freeze({ percent: 0, promotions: Object.freeze([]) })
      : promotionDiscountBreakdown(item, shop);
    const merchantPercent = options.ignoreCommerce || options.ignoreMerchant
      ? 0
      : merchantDiscountPercent(shop, context);
    const loyalty = options.ignoreCommerce || options.ignoreLoyalty
      ? Object.freeze({ active: false, rewardReady: false, progress: 0 })
      : loyaltyStatus(shop, context, item);
    const totalDiscountPercent = clamp(
      promotionBreakdown.percent + merchantPercent,
      0,
      90,
    );
    const final = listPrice == null
      ? null
      : loyalty.rewardReady
        ? 0
        : roundAhn(listPrice * (1 - totalDiscountPercent / 100));

    return Object.freeze({
      currency: CURRENCY,
      baseValueAhn: resolution.resolved ? roundAhn(resolution.value) : null,
      baseValueSource: resolution.field,
      priceResolved: resolution.resolved,
      purchaseMarkup: BASE_PURCHASE_MARKUP,
      shopType: type.id,
      shopTypeMultiplier: type.priceMultiplier,
      shopTier: shopTier(shop),
      shopTierMultiplier: tierMultiplier,
      localMultiplier,
      marketEventPercent: eventPercent,
      marketEventMultiplier: eventMultiplier,
      marketEventId: activeMarketEvent?.id || null,
      listPriceAhn: listPrice,
      promotionDiscountPercent: promotionBreakdown.percent,
      appliedPromotions: promotionBreakdown.promotions,
      merchantDiscountPercent: merchantPercent,
      totalDiscountPercent,
      loyaltyProgramId: loyalty.program?.id || null,
      loyaltyProgress: loyalty.progress || 0,
      loyaltyRequired: loyalty.required || loyalty.program?.paidPurchasesRequired || 0,
      loyaltyRewardApplied: loyalty.rewardReady === true,
      priceAhn: final,
    });
  }

  function purchasePrice(item = {}, shop = {}, options = {}) {
    return priceBreakdown(item, shop, options).priceAhn;
  }

  function sellBreakdown(item = {}, shop = {}) {
    const resolution = resolveSellUnitValueAhn(item);
    const final = resolution.resolved
      ? roundAhn(resolution.value * BASE_SELLBACK_MULTIPLIER)
      : null;
    return Object.freeze({
      currency: CURRENCY,
      baseValueAhn: resolution.resolved ? roundAhn(resolution.value) : null,
      baseValueSource: resolution.field,
      priceResolved: resolution.resolved,
      sellbackMultiplier: BASE_SELLBACK_MULTIPLIER,
      discountFromBase: 1 - BASE_SELLBACK_MULTIPLIER,
      shopType: shopTypeId(shop),
      shopTier: shopTier(shop),
      priceAhn: final,
    });
  }

  function sellPrice(item = {}, shop = {}) {
    return sellBreakdown(item, shop).priceAhn;
  }

  function stockUnitsPerPlayer(item = {}, shop = {}) {
    const storeTier = shopTier(shop);
    const productTier = itemTier(item);
    if (productTier > storeTier) return 0;
    const gap = storeTier - productTier;
    if (gap >= 4) return 4;
    if (gap >= 2) return 3;
    if (gap >= 1) return 2;
    return 1;
  }

  function stockForItem(item = {}, shop = {}, options = {}) {
    if (!hasBaseValueAhn(item)) return 0;
    const catalogMatch = shopCatalogMatch(item, shop);
    if (!catalogMatch.eligible) return 0;
    const units = stockUnitsPerPlayer(item, shop);
    if (units <= 0) return 0;
    const players = playerCount(shop, options.playerCountFallback ?? 1);
    if (players <= 0) return 0;
    const multiplier =
      shopType(shop).stockMultiplier *
      catalogMatch.stockMultiplier;
    return Math.max(1, Math.round(players * units * multiplier));
  }

  function itemAvailability(item = {}, shop = {}) {
    const catalogMatch = shopCatalogMatch(item, shop);
    const tierOk = itemTier(item) <= shopTier(shop);
    const valueResolution = resolveBaseValueAhn(item);
    const priceOk = valueResolution.resolved;
    return Object.freeze({
      available: catalogMatch.eligible && tierOk && priceOk,
      typeEligible: catalogMatch.eligible,
      tierEligible: tierOk,
      priceEligible: priceOk,
      baseValueAhn: valueResolution.value,
      baseValueSource: valueResolution.field,
      catalogBand: catalogMatch.band,
      stockMultiplier: catalogMatch.stockMultiplier,
      reason: !catalogMatch.eligible
        ? "shop_type"
        : !tierOk
          ? "shop_tier"
          : !priceOk
            ? "unpriced"
            : "available",
    });
  }

  function itemAvailable(item = {}, shop = {}) {
    return itemAvailability(item, shop).available;
  }

  function applyAutomaticStock(item = {}, shop = {}, options = {}) {
    const next = clone(item) || {};
    const nextMax = stockForItem(next, shop, options);
    const previousMax = numberOr(next.stock_maximo, nextMax);
    const previousCurrent = numberOr(next.stock_actual, previousMax);
    const preserveSold = options.preserveSold === true;
    const sold = preserveSold && previousMax >= 0 && previousCurrent >= 0
      ? Math.max(0, previousMax - previousCurrent)
      : 0;

    next.stock_maximo = nextMax;
    next.stock_actual = Math.max(0, nextMax - sold);
    const resolvedShopPrice = priceBreakdown(next, shop, { ignoreMarketEvent: true, ignoreCommerce: true }).priceAhn;
    if (resolvedShopPrice == null) delete next.shop_price_ahn;
    else next.shop_price_ahn = resolvedShopPrice;
    next.shop_stock_auto = true;
    next.shop_runtime_version = VERSION;
    return next;
  }

  function generateCatalog(globalItems = {}, shop = {}, existingItems = {}, options = {}) {
    const out = {};
    const preserveSold = options.preserveSold === true;
    for (const [itemId, globalItem] of Object.entries(globalItems || {})) {
      if (!globalItem || typeof globalItem !== "object") continue;
      const materialized = materializeReferenceItem(globalItem, {
        purpose: "shop_catalog",
      });
      if (!materialized || !itemAvailable(materialized, shop)) continue;

      const existing = existingItems?.[itemId] || {};
      const source = {
        ...clone(materialized),
        requisito_aparicion:
          existing.requisito_aparicion ||
          globalItem.requisito_aparicion ||
          "Siempre",
      };

      if (preserveSold && existing && typeof existing === "object") {
        if (existing.stock_maximo !== undefined) source.stock_maximo = existing.stock_maximo;
        if (existing.stock_actual !== undefined) source.stock_actual = existing.stock_actual;
      }

      source.costo = baseValueAhn(source);
      out[itemId] = applyAutomaticStock(source, shop, { ...options, preserveSold });
    }
    return out;
  }

  function catalogSummary(globalItems = {}, shop = {}) {
    const summary = { eligible: 0, available: 0, primary: 0, secondary: 0, highTierFallback: 0 };
    for (const item of Object.values(globalItems || {})) {
      if (!item || typeof item !== "object") continue;
      const match = shopCatalogMatch(item, shop);
      if (!match.eligible) continue;
      summary.eligible += 1;
      if (match.band === "primary") summary.primary += 1;
      if (match.band === "secondary") summary.secondary += 1;
      if (match.band === "high_tier_fallback") summary.highTierFallback += 1;
      const materialized = materializeReferenceItem(item, { purpose: "catalog_summary" });
      if (materialized && itemAvailability(materialized, shop).available) summary.available += 1;
    }
    return Object.freeze(summary);
  }

  function describeShop(shop = {}) {
    const type = shopType(shop);
    const tier = shopTier(shop);
    return Object.freeze({
      typeId: type.id,
      typeLabel: type.label,
      tier,
      tierRoman: tierRoman(tier),
      playerCount: assignedPlayers(shop).length,
      purchaseMarkup: BASE_PURCHASE_MARKUP,
      sellbackMultiplier: BASE_SELLBACK_MULTIPLIER,
      typePriceMultiplier: type.priceMultiplier,
      tierPriceMultiplier: tierPriceMultiplier(tier),
      stockMultiplier: type.stockMultiplier,
    });
  }

  const API = Object.freeze({
    VERSION,
    CURRENCY,
    BASE_PURCHASE_MARKUP,
    BASE_SELLBACK_MULTIPLIER,
    SHOP_TIER_PRICE_STEP,
    MAX_TIER,
    REPAIR_SERVICE_MARKUP,
    SERVICE_TYPES,
    SHOP_TYPE_SERVICES,
    PROMOTION_TYPES,
    REPAIR_MATERIAL_VALUE_FIELDS,
    BASE_VALUE_FIELDS,
    SELL_UNIT_VALUE_FIELDS,
    SHOP_TYPES,
    SHOP_TYPE_CATALOG,
    tierNumber,
    tierRoman,
    shopTier,
    itemTier,
    shopTypeId,
    shopType,
    shopChain,
    merchantNpc,
    defaultServiceIdsForShopType,
    serviceConfig,
    serviceEnabled,
    servicesForShop,
    durabilityState,
    resolveRepairMaterialValueAhn,
    repairBreakdown,
    repairPrice,
    normalizePromotion,
    shopPromotions,
    promotionMatchesItem,
    promotionDiscountBreakdown,
    merchantDiscountPercent,
    loyaltyProgram,
    loyaltyAppliesToItem,
    loyaltyStatus,
    nextLoyaltyProgress,
    promotionRewardPlan,
    assignedPlayers,
    playerCount,
    isPlayerAllowed,
    normalizeToken,
    itemCatalogTokens,
    catalogRuleForShop,
    shopCatalogMatch,
    itemEligibleForShopType,
    resolveBaseValueAhn,
    resolveSellUnitValueAhn,
    hasBaseValueAhn,
    baseValueAhn,
    definitionIdOf,
    materializeReferenceItem,
    tierPriceMultiplier,
    localPriceMultiplier,
    sanitizeMarketEvent,
    setMarketEvent,
    getMarketEvent,
    marketEventPercent,
    marketEventMultiplier,
    priceBreakdown,
    purchasePrice,
    sellBreakdown,
    sellPrice,
    stockUnitsPerPlayer,
    stockForItem,
    itemAvailability,
    itemAvailable,
    applyAutomaticStock,
    generateCatalog,
    catalogSummary,
    describeShop,
  });

  global.LuminousShopRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
