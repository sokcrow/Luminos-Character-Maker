(function (global) {
  "use strict";

  if (global.LuminousShopStandardPresets) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShopStandardPresets;
    return;
  }

  const VERSION = 1;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  const PRESETS = deepFreeze({
    district_general: {
      id: "district_general",
      name: "Almacén del Distrito",
      description: "Tienda base para validar catálogo automático, stock compartido, compra y reventa.",
      testFocus: ["catálogo", "stock", "compra", "reventa"],
      shop: {
        nombre: "Almacén del Distrito",
        shop_type: "general",
        shop_tier: 2,
        fisica_activa: true,
        dias_entrega: 1,
        dia_restock: "Lunes",
        mod_venta: 100,
        services: { repair: { enabled: false } },
        merchant_npc: {
          enabled: true,
          name: "Mara",
          greeting: "Pasa. Si está en inventario, tiene precio.",
          frequent_customer_min_purchases: 10,
          frequent_customer_discount_percent: 5,
          relationship_discounts: { trusted: 10 }
        },
        chain: null,
        loyalty_program: null,
        promotions: []
      }
    },

    quickstop_chain: {
      id: "quickstop_chain",
      name: "QuickStop 24/7",
      description: "Sucursal de conveniencia para probar cadena, promociones y lealtad compartida.",
      testFocus: ["cadena", "promoción", "lealtad", "consumibles"],
      shop: {
        nombre: "QuickStop 24/7",
        shop_type: "convenience",
        shop_tier: 1,
        fisica_activa: true,
        dias_entrega: 0,
        dia_restock: "Martes",
        mod_venta: 100,
        services: { repair: { enabled: false } },
        merchant_npc: null,
        chain: {
          id: "quickstop",
          name: "QuickStop",
          loyalty_program: {
            enabled: true,
            id: "quickstop_rewards",
            name: "QuickStop Rewards",
            paid_purchases_required: 5,
            reward_type: "free_next",
            scope: "items",
            service_ids: []
          },
          promotions: [
            {
              id: "quickstop_opening_discount",
              type: "percent_discount",
              active: true,
              scope: "all",
              item_ids: [],
              stackable: false,
              discount_percent: 5,
              label: "5% de descuento de prueba"
            }
          ]
        },
        loyalty_program: null,
        promotions: []
      }
    },

    sanacorp_pharmacy: {
      id: "sanacorp_pharmacy",
      name: "SanaCorp Farmacia",
      description: "Farmacia de Tier III para revisar curación, cures, medicina procesada y beneficios de cadena.",
      testFocus: ["curación", "status cure", "Tier III", "lealtad"],
      shop: {
        nombre: "SanaCorp Farmacia",
        shop_type: "pharmacy",
        shop_tier: 3,
        fisica_activa: true,
        dias_entrega: 1,
        dia_restock: "Miércoles",
        mod_venta: 100,
        services: { repair: { enabled: false } },
        merchant_npc: {
          enabled: true,
          name: "Ilya",
          greeting: "Describe los síntomas y revisamos qué hay disponible.",
          frequent_customer_min_purchases: 8,
          frequent_customer_discount_percent: 5,
          relationship_discounts: { trusted: 8 }
        },
        chain: {
          id: "sanacorp",
          name: "SanaCorp",
          loyalty_program: {
            enabled: true,
            id: "sanacorp_care",
            name: "SanaCorp Care",
            paid_purchases_required: 6,
            reward_type: "free_next",
            scope: "items",
            service_ids: []
          },
          promotions: []
        },
        loyalty_program: null,
        promotions: []
      }
    },

    district_workshop: {
      id: "district_workshop",
      name: "Taller del Distrito",
      description: "Workshop estándar para probar componentes, materiales y reparación por Durabilidad.",
      testFocus: ["reparación", "componentes", "materiales", "servicios"],
      shop: {
        nombre: "Taller del Distrito",
        shop_type: "workshop",
        shop_tier: 3,
        fisica_activa: true,
        dias_entrega: 2,
        dia_restock: "Jueves",
        mod_venta: 100,
        services: { repair: { enabled: true } },
        merchant_npc: {
          enabled: true,
          name: "Rook",
          greeting: "Déjalo en la mesa. Primero vemos cuánto material va a consumir.",
          frequent_customer_min_purchases: 6,
          frequent_customer_discount_percent: 5,
          relationship_discounts: { trusted: 10 }
        },
        chain: null,
        loyalty_program: {
          enabled: true,
          id: "district_workshop_service",
          name: "Tarjeta del Taller",
          paid_purchases_required: 4,
          reward_type: "free_next",
          scope: "services",
          service_ids: ["repair"]
        },
        promotions: []
      }
    },

    standard_armory: {
      id: "standard_armory",
      name: "Armería Estándar",
      description: "Armería Tier IV para validar armas, munición, componentes de combate y reparación.",
      testFocus: ["armas", "munición", "Tier IV", "reparación"],
      shop: {
        nombre: "Armería Estándar",
        shop_type: "arms_dealer",
        shop_tier: 4,
        fisica_activa: true,
        dias_entrega: 2,
        dia_restock: "Viernes",
        mod_venta: 100,
        services: { repair: { enabled: true } },
        merchant_npc: {
          enabled: true,
          name: "Vega",
          greeting: "Nada sale del mostrador sin revisar condición y munición.",
          frequent_customer_min_purchases: 8,
          frequent_customer_discount_percent: 4,
          relationship_discounts: { trusted: 8 }
        },
        chain: null,
        loyalty_program: null,
        promotions: []
      }
    },

    canteen_standard: {
      id: "canteen_standard",
      name: "Comedor de Turno",
      description: "Restaurante para validar presentación tipo menú, alimentos preparados y promociones.",
      testFocus: ["restaurante", "menú", "alimentos", "promoción"],
      shop: {
        nombre: "Comedor de Turno",
        shop_type: "restaurant",
        shop_tier: 2,
        fisica_activa: true,
        dias_entrega: 0,
        dia_restock: "Sábado",
        mod_venta: 100,
        services: { repair: { enabled: false } },
        merchant_npc: {
          enabled: true,
          name: "Nara",
          greeting: "Si vienes del turno largo, hoy sírvete algo caliente.",
          frequent_customer_min_purchases: 5,
          frequent_customer_discount_percent: 5,
          relationship_discounts: { trusted: 10 }
        },
        chain: null,
        loyalty_program: {
          enabled: true,
          id: "canteen_stamp_card",
          name: "Tarjeta del Comedor",
          paid_purchases_required: 5,
          reward_type: "free_next",
          scope: "items",
          service_ids: []
        },
        promotions: [
          {
            id: "canteen_shift_discount",
            type: "percent_discount",
            active: true,
            scope: "all",
            item_ids: [],
            stackable: false,
            discount_percent: 10,
            label: "10% de descuento de prueba"
          }
        ]
      }
    },

    bulk_supply: {
      id: "bulk_supply",
      name: "Central de Suministros",
      description: "Mayorista Tier III para probar alto volumen de stock y compra remota con entrega.",
      testFocus: ["mayorista", "stock alto", "entrega", "materiales"],
      shop: {
        nombre: "Central de Suministros",
        shop_type: "wholesaler",
        shop_tier: 3,
        fisica_activa: false,
        dias_entrega: 2,
        dia_restock: "Lunes",
        mod_venta: 100,
        services: { repair: { enabled: false } },
        merchant_npc: null,
        chain: null,
        loyalty_program: null,
        promotions: []
      }
    },

    black_market_test: {
      id: "black_market_test",
      name: "Mercado Gris",
      description: "Mercado Negro Tier V para validar stock escaso, fallback de Tier alto y recargos.",
      testFocus: ["mercado negro", "stock escaso", "Tier V", "recargo"],
      shop: {
        nombre: "Mercado Gris",
        shop_type: "black_market",
        shop_tier: 5,
        fisica_activa: true,
        dias_entrega: 3,
        dia_restock: "Domingo",
        mod_venta: 110,
        services: { repair: { enabled: false } },
        merchant_npc: {
          enabled: true,
          name: "Noct",
          greeting: "Pregunta una vez. Si existe, te digo cuánto cuesta.",
          frequent_customer_min_purchases: 12,
          frequent_customer_discount_percent: 3,
          relationship_discounts: { trusted: 5 }
        },
        chain: null,
        loyalty_program: null,
        promotions: []
      }
    }
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
    get
  });

  global.LuminousShopStandardPresets = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
