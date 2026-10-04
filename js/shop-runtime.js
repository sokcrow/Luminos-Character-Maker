(function (global) {
  "use strict";

  if (global.LuminousShopRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShopRuntime;
    return;
  }

  const VERSION = 1;
  const CURRENCY = "AHN";
  const BASE_PURCHASE_MARKUP = 1.40;
  const SHOP_TIER_PRICE_STEP = 0.04;
  const MAX_TIER = 10;

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

  function baseValueAhn(item = {}) {
    const candidates = [
      item.productionValueAhn,
      item.productionValue,
      item.createdProductionValueAhn,
      item.totalValueAhn,
      item.standardMediumValueAhn,
      item.standardUnitValueAhn,
      item.standardChassisValueAhn,
      item.valorBase,
      item.costo,
      item.priceAhn,
      item.unitValueAhn,
    ];
    for (const candidate of candidates) {
      const value = numberOr(candidate, NaN);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return 0;
  }

  function tierPriceMultiplier(shopOrTier = {}) {
    const tier = typeof shopOrTier === "object" ? shopTier(shopOrTier) : tierNumber(shopOrTier);
    return 1 + (tier - 1) * SHOP_TIER_PRICE_STEP;
  }

  function localPriceMultiplier(shop = {}) {
    const percent = numberOr(shop.mod_venta ?? shop.localPricePercent, 100);
    return clamp(percent, 25, 400) / 100;
  }

  function priceBreakdown(item = {}, shop = {}) {
    const type = shopType(shop);
    const base = baseValueAhn(item);
    const tierMultiplier = tierPriceMultiplier(shop);
    const localMultiplier = localPriceMultiplier(shop);
    const final = roundAhn(
      base *
      BASE_PURCHASE_MARKUP *
      type.priceMultiplier *
      tierMultiplier *
      localMultiplier
    );
    return Object.freeze({
      currency: CURRENCY,
      baseValueAhn: roundAhn(base),
      purchaseMarkup: BASE_PURCHASE_MARKUP,
      shopType: type.id,
      shopTypeMultiplier: type.priceMultiplier,
      shopTier: shopTier(shop),
      shopTierMultiplier: tierMultiplier,
      localMultiplier,
      priceAhn: final,
    });
  }

  function purchasePrice(item = {}, shop = {}) {
    return priceBreakdown(item, shop).priceAhn;
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
    const units = stockUnitsPerPlayer(item, shop);
    if (units <= 0) return 0;
    const players = playerCount(shop, options.playerCountFallback ?? 1);
    if (players <= 0) return 0;
    const multiplier = shopType(shop).stockMultiplier;
    return Math.max(1, Math.round(players * units * multiplier));
  }

  function itemAvailable(item = {}, shop = {}) {
    return itemTier(item) <= shopTier(shop);
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
    next.shop_price_ahn = purchasePrice(next, shop);
    next.shop_stock_auto = true;
    next.shop_runtime_version = VERSION;
    return next;
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
      typePriceMultiplier: type.priceMultiplier,
      tierPriceMultiplier: tierPriceMultiplier(tier),
      stockMultiplier: type.stockMultiplier,
    });
  }

  const API = Object.freeze({
    VERSION,
    CURRENCY,
    BASE_PURCHASE_MARKUP,
    SHOP_TIER_PRICE_STEP,
    MAX_TIER,
    SHOP_TYPES,
    tierNumber,
    tierRoman,
    shopTier,
    itemTier,
    shopTypeId,
    shopType,
    assignedPlayers,
    playerCount,
    isPlayerAllowed,
    baseValueAhn,
    tierPriceMultiplier,
    localPriceMultiplier,
    priceBreakdown,
    purchasePrice,
    stockUnitsPerPlayer,
    stockForItem,
    itemAvailable,
    applyAutomaticStock,
    describeShop,
  });

  global.LuminousShopRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
