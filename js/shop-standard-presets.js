(function (global) {
  "use strict";

  if (global.LuminousShopStandardPresets) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShopStandardPresets;
    return;
  }

  const VERSION = 2;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function merchant(name, greeting, options = {}) {
    return {
      enabled: true,
      name,
      greeting,
      frequent_customer_min_purchases: options.frequentPurchases ?? 8,
      frequent_customer_discount_percent: options.frequentDiscount ?? 5,
      relationship_discounts: {
        trusted: options.trustedDiscount ?? 10,
      },
    };
  }

  function loyalty(id, name, paidPurchasesRequired = 6, scope = "items", serviceIds = []) {
    return {
      enabled: true,
      id,
      name,
      paid_purchases_required: paidPurchasesRequired,
      reward_type: "free_next",
      scope,
      service_ids: serviceIds,
    };
  }

  function percentPromotion(id, label, discountPercent) {
    return {
      id,
      type: "percent_discount",
      active: true,
      scope: "all",
      item_ids: [],
      stackable: false,
      discount_percent: discountPercent,
      label,
    };
  }

  function chain(id, name, loyaltyProgram = null, promotions = []) {
    return {
      id,
      name,
      loyalty_program: loyaltyProgram,
      promotions,
    };
  }

  function preset(config) {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      testFocus: config.testFocus,
      shop: {
        nombre: config.name,
        shop_type: config.shopType,
        shop_tier: config.tier ?? 1,
        fisica_activa: config.physical !== false,
        dias_entrega: config.deliveryDays ?? 0,
        dia_restock: config.restock ?? "Lunes",
        mod_venta: config.localPricePercent ?? 100,
        services: {
          repair: { enabled: config.repair === true },
        },
        merchant_npc: config.merchantNpc ?? null,
        chain: config.chainData ?? null,
        loyalty_program: config.chainData ? null : (config.loyaltyProgram ?? null),
        promotions: config.chainData ? [] : (config.promotions ?? []),
      },
    };
  }

  const quickStopLoyalty = loyalty(
    "quickstop_rewards",
    "QuickStop Rewards",
    5,
    "items",
  );
  const quickStopChain = chain(
    "quickstop",
    "QuickStop",
    quickStopLoyalty,
    [percentPromotion("quickstop_test_discount", "5% de descuento de prueba", 5)],
  );

  const sanaCorpLoyalty = loyalty(
    "sanacorp_care",
    "SanaCorp Care",
    6,
    "items",
  );
  const sanaCorpChain = chain(
    "sanacorp",
    "SanaCorp",
    sanaCorpLoyalty,
    [],
  );

  const boltBeamLoyalty = loyalty(
    "boltbeam_service",
    "Bolt & Beam Service",
    5,
    "services",
    ["repair"],
  );
  const boltBeamChain = chain(
    "boltbeam",
    "Bolt & Beam",
    boltBeamLoyalty,
    [],
  );

  const shiftCanteenLoyalty = loyalty(
    "shift_canteen_card",
    "Tarjeta Shift Canteen",
    5,
    "items",
  );
  const shiftCanteenChain = chain(
    "shift_canteen",
    "Shift Canteen",
    shiftCanteenLoyalty,
    [percentPromotion("shift_meal_discount", "10% de descuento de turno", 10)],
  );

  const PRESETS = deepFreeze({
    district_general: preset({
      id: "district_general",
      name: "Almacén del Distrito",
      description: "Tienda baseline para validar catálogo automático, stock compartido, compra y reventa.",
      testFocus: ["catálogo", "stock", "compra", "reventa"],
      shopType: "general",
      tier: 2,
      deliveryDays: 1,
      restock: "Lunes",
      merchantNpc: merchant(
        "Mara",
        "Pasa. Si está en inventario, tiene precio.",
        { frequentPurchases: 10 },
      ),
    }),

    quickstop_chain: preset({
      id: "quickstop_chain",
      name: "QuickStop 24/7 · Centro",
      description: "Sucursal de conveniencia para probar consumibles inmediatos, promociones y lealtad de cadena.",
      testFocus: ["cadena", "promoción", "lealtad", "consumibles"],
      shopType: "convenience",
      tier: 1,
      restock: "Martes",
      chainData: quickStopChain,
    }),

    metromart_supermarket: preset({
      id: "metromart_supermarket",
      name: "MetroMart",
      description: "Supermercado de alto volumen para alimentos, básicos y stock abundante.",
      testFocus: ["supermercado", "alto stock", "alimentos", "básicos"],
      shopType: "supermarket",
      tier: 2,
      deliveryDays: 1,
      restock: "Miércoles",
      merchantNpc: merchant(
        "Ena",
        "Hay reposición cada mañana. Revisa los pasillos antes del cierre.",
      ),
      loyaltyProgram: loyalty("metromart_points", "MetroMart Points", 8, "items"),
    }),

    bulk_supply: preset({
      id: "bulk_supply",
      name: "Central de Suministros",
      description: "Mayorista para probar stock elevado, materiales y pedidos remotos.",
      testFocus: ["mayorista", "stock alto", "entrega", "materiales"],
      shopType: "wholesaler",
      tier: 3,
      physical: false,
      deliveryDays: 2,
      restock: "Lunes",
      localPricePercent: 97,
    }),

    trail_provisions: preset({
      id: "trail_provisions",
      name: "Provisiones Ruta 8",
      description: "Punto de provisiones para comida, suministros y consumibles de expedición.",
      testFocus: ["provisiones", "comida", "consumibles", "stock"],
      shopType: "provisions",
      tier: 2,
      deliveryDays: 1,
      restock: "Jueves",
      merchantNpc: merchant(
        "Toma",
        "Si vas a salir del distrito, compra antes de cruzar el control.",
      ),
    }),

    canteen_standard: preset({
      id: "canteen_standard",
      name: "Shift Canteen · Día",
      description: "Restaurante para validar menú, alimentos preparados y beneficios de cadena.",
      testFocus: ["restaurante", "menú", "alimentos", "promoción"],
      shopType: "restaurant",
      tier: 2,
      restock: "Sábado",
      merchantNpc: merchant(
        "Nara",
        "Si vienes del turno largo, hoy sírvete algo caliente.",
        { frequentPurchases: 5 },
      ),
      chainData: shiftCanteenChain,
    }),

    redhook_butcher: preset({
      id: "redhook_butcher",
      name: "Red Hook Carnicería",
      description: "Carnicería para probar carne, pieles y subproductos biológicos.",
      testFocus: ["carne", "pieles", "órganos", "subproductos"],
      shopType: "butcher",
      tier: 2,
      restock: "Viernes",
      merchantNpc: merchant(
        "Bram",
        "Corte limpio, peso exacto. Lo raro se cobra aparte.",
      ),
    }),

    sanacorp_clinic: preset({
      id: "sanacorp_clinic",
      name: "SanaCorp Clínica · Central",
      description: "Clínica para tratamiento inmediato y suministros médicos dentro de la cadena SanaCorp.",
      testFocus: ["clínica", "curación", "cadena", "tratamiento"],
      shopType: "clinic",
      tier: 3,
      deliveryDays: 1,
      restock: "Miércoles",
      merchantNpc: merchant(
        "Dr. Vale",
        "Primero estabilizamos. Después hablamos de costos.",
        { frequentPurchases: 7, trustedDiscount: 8 },
      ),
      chainData: sanaCorpChain,
    }),

    sanacorp_pharmacy: preset({
      id: "sanacorp_pharmacy",
      name: "SanaCorp Farmacia · Central",
      description: "Farmacia para curación, status cures y medicina procesada con lealtad compartida.",
      testFocus: ["farmacia", "status cure", "medicina", "lealtad"],
      shopType: "pharmacy",
      tier: 3,
      deliveryDays: 1,
      restock: "Miércoles",
      merchantNpc: merchant(
        "Ilya",
        "Describe los síntomas y revisamos qué hay disponible.",
        { frequentPurchases: 8, trustedDiscount: 8 },
      ),
      chainData: sanaCorpChain,
    }),

    district_workshop: preset({
      id: "district_workshop",
      name: "Taller del Distrito",
      description: "Workshop estándar para componentes, materiales y reparación por Durabilidad.",
      testFocus: ["reparación", "componentes", "materiales", "servicios"],
      shopType: "workshop",
      tier: 3,
      deliveryDays: 2,
      restock: "Jueves",
      repair: true,
      merchantNpc: merchant(
        "Rook",
        "Déjalo en la mesa. Primero vemos cuánto material va a consumir.",
        { frequentPurchases: 6 },
      ),
      loyaltyProgram: loyalty(
        "district_workshop_service",
        "Tarjeta del Taller",
        4,
        "services",
        ["repair"],
      ),
    }),

    boltbeam_hardware: preset({
      id: "boltbeam_hardware",
      name: "Bolt & Beam · Ferretería",
      description: "Ferretería para herramientas, fijaciones, piezas estructurales y reparación.",
      testFocus: ["ferretería", "herramientas", "estructura", "reparación"],
      shopType: "hardware_store",
      tier: 2,
      deliveryDays: 1,
      restock: "Martes",
      repair: true,
      merchantNpc: merchant(
        "Jax",
        "Trae medidas. Si no sabes la medida, trae la pieza rota.",
      ),
      chainData: boltBeamChain,
    }),

    circuit_hub: preset({
      id: "circuit_hub",
      name: "Circuit Hub",
      description: "Tienda tecnológica para circuitos, sensores, óptica y piezas de precisión.",
      testFocus: ["electrónica", "precisión", "sensores", "reparación"],
      shopType: "electronics",
      tier: 4,
      deliveryDays: 2,
      restock: "Jueves",
      repair: true,
      merchantNpc: merchant(
        "Kite",
        "No toques la bandeja antiestática si no vas a comprar.",
      ),
    }),

    standard_armory: preset({
      id: "standard_armory",
      name: "Armería Estándar",
      description: "Armería Tier IV para armas, munición, componentes de combate y reparación.",
      testFocus: ["armas", "munición", "Tier IV", "reparación"],
      shopType: "arms_dealer",
      tier: 4,
      deliveryDays: 2,
      restock: "Viernes",
      repair: true,
      merchantNpc: merchant(
        "Vega",
        "Nada sale del mostrador sin revisar condición y munición.",
        { frequentPurchases: 8, frequentDiscount: 4, trustedDiscount: 8 },
      ),
    }),

    aurum_jeweler: preset({
      id: "aurum_jeweler",
      name: "Aurum Joyería",
      description: "Joyería para valuables, gemas, metales refinados y servicio de reparación.",
      testFocus: ["joyería", "gemas", "valuables", "reparación"],
      shopType: "jeweler",
      tier: 4,
      deliveryDays: 2,
      restock: "Sábado",
      repair: true,
      merchantNpc: merchant(
        "Sel",
        "La diferencia entre adorno y patrimonio está en el material.",
      ),
    }),

    second_chance_pawnshop: preset({
      id: "second_chance_pawnshop",
      name: "Segunda Oportunidad",
      description: "Casa de empeño para bienes usados, herramientas, equipo y valuables.",
      testFocus: ["empeño", "usados", "valuables", "equipo"],
      shopType: "pawnshop",
      tier: 2,
      restock: "Domingo",
      localPricePercent: 96,
      merchantNpc: merchant(
        "Milo",
        "Lo compro barato, lo vendo funcionando. Esa es la regla.",
        { frequentPurchases: 12, frequentDiscount: 3 },
      ),
    }),

    scrapline_salvage: preset({
      id: "scrapline_salvage",
      name: "Scrapline Recuperación",
      description: "Chatarrería para materiales recuperados, piezas y componentes de segunda mano.",
      testFocus: ["salvage", "materiales", "componentes", "reparación"],
      shopType: "salvage",
      tier: 3,
      deliveryDays: 1,
      restock: "Lunes",
      localPricePercent: 95,
      repair: true,
      merchantNpc: merchant(
        "Pax",
        "Si todavía tiene metal útil, todavía tiene valor.",
      ),
    }),

    meridian_outlet: preset({
      id: "meridian_outlet",
      name: "Meridian Corporate Outlet",
      description: "Outlet corporativo para piezas técnicas, precisión y equipo procesado.",
      testFocus: ["corporativo", "precisión", "procesados", "reparación"],
      shopType: "corporate_outlet",
      tier: 4,
      deliveryDays: 1,
      restock: "Miércoles",
      repair: true,
      merchantNpc: merchant(
        "Operador M-17",
        "Garantía válida sólo con número de lote y condición verificable.",
      ),
      loyaltyProgram: loyalty("meridian_account", "Meridian Account", 10, "all", ["repair"]),
    }),

    autovend_station: preset({
      id: "autovend_station",
      name: "AutoVend Station",
      description: "Punto automatizado para probar venta inmediata sin NPC y stock compacto.",
      testFocus: ["automatizado", "sin NPC", "consumibles", "stock bajo"],
      shopType: "automated_vendor",
      tier: 1,
      restock: "Lunes",
    }),

    oddities_specialist: preset({
      id: "oddities_specialist",
      name: "Oddities & Co.",
      description: "Especialista en materiales raros, Essence/Core, Ooze/Gel y biológicos poco comunes.",
      testFocus: ["especialista", "raros", "essence/core", "biológicos"],
      shopType: "specialist",
      tier: 5,
      deliveryDays: 3,
      restock: "Domingo",
      localPricePercent: 105,
      merchantNpc: merchant(
        "Orin",
        "Si sabes exactamente qué estás buscando, probablemente pueda conseguirlo.",
        { frequentPurchases: 10, trustedDiscount: 6 },
      ),
    }),

    black_market_test: preset({
      id: "black_market_test",
      name: "Mercado Gris",
      description: "Mercado Negro Tier V para stock escaso, fallback de Tier alto y recargos.",
      testFocus: ["mercado negro", "stock escaso", "Tier V", "recargo"],
      shopType: "black_market",
      tier: 5,
      deliveryDays: 3,
      restock: "Domingo",
      localPricePercent: 110,
      merchantNpc: merchant(
        "Noct",
        "Pregunta una vez. Si existe, te digo cuánto cuesta.",
        { frequentPurchases: 12, frequentDiscount: 3, trustedDiscount: 5 },
      ),
    }),

    quickstop_transit: preset({
      id: "quickstop_transit",
      name: "QuickStop 24/7 · Tránsito",
      description: "Segunda sucursal QuickStop con Tier distinto para comprobar progreso compartido entre tiendas de la cadena.",
      testFocus: ["sucursal", "cadena compartida", "Tier II", "lealtad"],
      shopType: "convenience",
      tier: 2,
      restock: "Viernes",
      chainData: quickStopChain,
    }),

    sanacorp_night_clinic: preset({
      id: "sanacorp_night_clinic",
      name: "SanaCorp Clínica · Nocturna",
      description: "Sucursal clínica Tier IV que comparte el programa SanaCorp Care con farmacia y clínica central.",
      testFocus: ["sucursal", "cadena compartida", "clínica", "Tier IV"],
      shopType: "clinic",
      tier: 4,
      deliveryDays: 1,
      restock: "Sábado",
      merchantNpc: merchant(
        "Dr. Nox",
        "Turno nocturno. Casos urgentes primero.",
        { frequentPurchases: 6, trustedDiscount: 8 },
      ),
      chainData: sanaCorpChain,
    }),

    boltbeam_industrial: preset({
      id: "boltbeam_industrial",
      name: "Bolt & Beam · Industrial",
      description: "Sucursal Tier IV de la ferretería para probar reparación y lealtad de servicios compartidas.",
      testFocus: ["sucursal", "ferretería", "Tier IV", "lealtad de servicio"],
      shopType: "hardware_store",
      tier: 4,
      deliveryDays: 2,
      restock: "Viernes",
      repair: true,
      merchantNpc: merchant(
        "Dera",
        "Industrial significa que la caja pesa más que tú. Usa el montacargas.",
      ),
      chainData: boltBeamChain,
    }),

    canteen_night: preset({
      id: "canteen_night",
      name: "Shift Canteen · Noche",
      description: "Segunda sucursal del comedor para probar promoción y tarjeta compartidas con otro Tier.",
      testFocus: ["sucursal", "restaurante", "promoción compartida", "lealtad"],
      shopType: "restaurant",
      tier: 3,
      restock: "Domingo",
      merchantNpc: merchant(
        "Iris",
        "El menú nocturno es corto, pero nunca cerramos.",
        { frequentPurchases: 5 },
      ),
      chainData: shiftCanteenChain,
    }),
  });

  function list() {
    return Object.values(PRESETS).map(clone);
  }

  function get(id) {
    return PRESETS[id] ? clone(PRESETS[id]) : null;
  }

  const API = Object.freeze({
    VERSION,
    PRESETS,
    list,
    get,
  });

  global.LuminousShopStandardPresets = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
