(function (global) {
  "use strict";

  if (global.LuminousShopRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShopRuntime;
    return;
  }

  const VERSION = 6;
  const CURRENCY = "AHN";
  const BASE_PURCHASE_MARKUP = 1.40;
  const BASE_SELLBACK_MULTIPLIER = 0.80;
  const SHOP_TIER_PRICE_STEP = 0.04;
  const MAX_TIER = 10;

  // Ordered from the strongest intrinsic / production signal to legacy fallbacks.
  // Zero is treated as "not authored" so placeholder price/costo fields cannot
  // shadow a valid canonical value later in the Item definition.
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
      id: "general",
      label: "Almacén General",
      priceMultiplier: 1.00,
      stockMultiplier: 1.25,
      description: "Inventario amplio y disponibilidad por encima de la media.",
    }),
    provisions: Object.freeze({
      id: "provisions",
      label: "Provisiones",
      priceMultiplier: 1.00,
      stockMultiplier: 1.50,
      description: "Comida, suministros y consumibles comunes con stock abundante.",
    }),
    clinic: Object.freeze({
      id: "clinic",
      label: "Clínica / Farmacia",
      priceMultiplier: 1.05,
      stockMultiplier: 1.00,
      description: "Medicina, curación y suministros especializados.",
    }),
    workshop: Object.freeze({
      id: "workshop",
      label: "Workshop",
      priceMultiplier: 1.08,
      stockMultiplier: 0.85,
      description: "Herramientas, componentes y equipo fabricado.",
    }),
    arms_dealer: Object.freeze({
      id: "arms_dealer",
      label: "Armería",
      priceMultiplier: 1.12,
      stockMultiplier: 0.75,
      description: "Armas, armaduras, munición y equipo de combate.",
    }),
    specialist: Object.freeze({
      id: "specialist",
      label: "Especialista",
      priceMultiplier: 1.18,
      stockMultiplier: 0.55,
      description: "Bienes raros, técnicos o de nicho con disponibilidad limitada.",
    }),
    black_market: Object.freeze({
      id: "black_market",
      label: "Mercado Negro",
      priceMultiplier: 1.25,
      stockMultiplier: 0.35,
      description: "Mercancía escasa o restringida a precios de riesgo.",
    }),
  });

  let activeMarketEvent = null;

  const SHOP_TYPE_CATALOG = Object.freeze({
    general: Object.freeze({
      primary: Object.freeze(["food", "culinary_staples", "plant_produce", "tools", "medical_supply"]),
      secondary: Object.freeze(["craft_components", "chemical_raw", "medicinal_raw", "healing_hp", "healing_sp", "status_cure"]),
      primaryStockMultiplier: 1.00,
      secondaryStockMultiplier: 0.70,
    }),
    provisions: Object.freeze({
      primary: Object.freeze(["food", "culinary_staples", "plant_produce", "meat"]),
      secondary: Object.freeze(["medical_supply", "healing_hp", "tools", "medicinal_raw"]),
      primaryStockMultiplier: 1.15,
      secondaryStockMultiplier: 0.65,
    }),
    clinic: Object.freeze({
      primary: Object.freeze(["healing_hp", "healing_sp", "healing_hybrid", "status_cure", "medical_supply"]),
      secondary: Object.freeze(["medicinal_raw", "medicinal_processed", "blood_ichor", "organ_gland"]),
      primaryStockMultiplier: 1.00,
      secondaryStockMultiplier: 0.60,
    }),
    workshop: Object.freeze({
      primary: Object.freeze(["tools", "craft_components", "ore_ingot_gem", "chemical_raw", "chemical_processed"]),
      secondary: Object.freeze([
        "armor_components", "weapon_components", "firearm_components", "ranged_weapon_components",
        "shield_components", "throwable_components", "armor_upgrades", "shield_upgrades",
        "weapon_upgrade", "armor_upgrade", "shield_upgrade", "weapon_component",
        "armor_component", "shield_component", "component", "hide_pelt", "scale_shell_chitin",
        "feather_raw_fiber", "hard_parts"
      ]),
      primaryStockMultiplier: 1.00,
      secondaryStockMultiplier: 0.65,
    }),
    arms_dealer: Object.freeze({
      primary: Object.freeze([
        "weapons", "weapon", "firearm_ammunition", "ammo_component", "weapon_components",
        "firearm_components", "ranged_weapon_components", "armor_components", "shield_components",
        "armor", "shield", "ammo"
      ]),
      secondary: Object.freeze([
        "throwable_components", "armor_upgrades", "shield_upgrades", "weapon_upgrade",
        "armor_upgrade", "shield_upgrade", "weapon_component", "armor_component", "shield_component"
      ]),
      primaryStockMultiplier: 1.00,
      secondaryStockMultiplier: 0.55,
    }),
    specialist: Object.freeze({
      primary: Object.freeze(["jewelry_valuables", "valuable", "essence_core", "ooze_gel", "venom_secretion", "organ_gland", "blood_ichor"]),
      secondary: Object.freeze([
        "medicinal_processed", "chemical_processed", "armor_upgrades", "shield_upgrades",
        "weapon_upgrade", "armor_upgrade", "shield_upgrade", "ore_ingot_gem", "tools"
      ]),
      primaryStockMultiplier: 0.85,
      secondaryStockMultiplier: 0.50,
    }),
    black_market: Object.freeze({
      primary: Object.freeze([
        "weapons", "weapon", "firearm_ammunition", "ammo_component", "throwable_components",
        "venom_secretion", "blood_ichor", "organ_gland", "essence_core", "jewelry_valuables", "valuable"
      ]),
      secondary: Object.freeze([
        "chemical_processed", "medicinal_processed", "healing_hybrid", "status_cure",
        "weapon_components", "firearm_components", "ranged_weapon_components",
        "armor_components", "shield_components", "armor_upgrades", "shield_upgrades",
        "weapon_upgrade", "armor_upgrade", "shield_upgrade"
      ]),
      primaryStockMultiplier: 0.70,
      secondaryStockMultiplier: 0.45,
      highTierFallbackStockMultiplier: 0.35,
      highTierFallbackMinTier: 4,
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
      title: String(event.title || "Cambio de mercado").trim() || "Cambio de mercado",
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

  function priceBreakdown(item = {}, shop = {}) {
    const type = shopType(shop);
    const resolution = resolveBaseValueAhn(item);
    const tierMultiplier = tierPriceMultiplier(shop);
    const localMultiplier = localPriceMultiplier(shop);
    const eventPercent = marketEventPercent(shop);
    const eventMultiplier = marketEventMultiplier(shop);
    const final = resolution.resolved
      ? roundAhn(
          resolution.value *
          BASE_PURCHASE_MARKUP *
          type.priceMultiplier *
          tierMultiplier *
          localMultiplier *
          eventMultiplier
        )
      : null;
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
      priceAhn: final,
    });
  }

  function purchasePrice(item = {}, shop = {}) {
    return priceBreakdown(item, shop).priceAhn;
  }

  function sellBreakdown(item = {}, shop = {}) {
    const resolution = resolveBaseValueAhn(item);
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
    const resolvedShopPrice = purchasePrice(next, shop);
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
    BASE_VALUE_FIELDS,
    SHOP_TYPES,
    SHOP_TYPE_CATALOG,
    tierNumber,
    tierRoman,
    shopTier,
    itemTier,
    shopTypeId,
    shopType,
    assignedPlayers,
    playerCount,
    isPlayerAllowed,
    normalizeToken,
    itemCatalogTokens,
    catalogRuleForShop,
    shopCatalogMatch,
    itemEligibleForShopType,
    resolveBaseValueAhn,
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
