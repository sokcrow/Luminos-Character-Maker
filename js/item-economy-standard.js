(function (global) {
  "use strict";

  if (global.LuminousItemEconomyStandard) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEconomyStandard;
    return;
  }

  const VERSION = 1;
  const CURRENCY = "AHN";
  const REFERENCE_MONTHLY_WAGE_AHN = 1000000;

  function freezeBand(id, label, minAhn, maxAhn, scope, notes) {
    return Object.freeze({
      id,
      label,
      minAhn: Math.max(0, Math.round(Number(minAhn) || 0)),
      maxAhn: maxAhn == null ? null : Math.max(0, Math.round(Number(maxAhn) || 0)),
      scope,
      notes: notes || "",
    });
  }

  const SALARY_BANDS = Object.freeze([
    freezeBand("backstreets_extreme_poverty", "Backstreets - Miseria extrema", 100000, 300000, "backstreets", "Rats, indigentes y personas sin trabajo estable."),
    freezeBand("backstreets_very_poor", "Backstreets - Muy pobre", 300000, 600000, "backstreets", "Trabajo informal y empleos muy mal pagados."),
    freezeBand("backstreets_low", "Backstreets - Clase baja", 600000, 1000000, "backstreets", "Obreros y trabajadores comunes."),
    freezeBand("backstreets_stable_low", "Backstreets - Clase baja estable", 1000000, 1500000, "backstreets", "Trabajadores capacitados y pequeños talleres."),
    freezeBand("backstreets_middle", "Backstreets - Clase media", 1500000, 2000000, "backstreets", "Técnicos, comerciantes y Fixers de bajo nivel."),
    freezeBand("backstreets_high", "Backstreets - Clase alta", 2000000, 2800000, "backstreets", "Dueños de pequeños negocios y Fixers competentes."),
    freezeBand("nest_low", "Nest - Clase baja", 2500000, 3200000, "nest", "Empleados modestos que pueden permitirse vivir dentro de un Nest."),
    freezeBand("nest_middle", "Nest - Clase media", 3200000, 4000000, "nest", "Profesionales y empleados relativamente estables."),
    freezeBand("nest_upper_middle", "Nest - Clase media-alta", 4000000, 6000000, "nest", "Profesionales exitosos y Fixers bien pagados."),
    freezeBand("nest_high", "Nest - Clase alta", 6000000, 10000000, "nest", "Especialistas, directivos y Fixers importantes."),
    freezeBand("nest_very_rich", "Nest - Muy ricos", 10000000, 25000000, "nest", "Ejecutivos de Wings, empresarios y cargos importantes."),
    freezeBand("city_elite", "Élite de la Ciudad", 25000000, null, "city", "Altos ejecutivos, grandes empresarios y personas extremadamente poderosas."),
  ]);

  const QUICK_REFERENCES_AHN = Object.freeze({
    poor_backstreets: 500000,
    stable_backstreets_worker: 1000000,
    comfortable_backstreets: 2000000,
    modest_nest_citizen: 3000000,
    upper_middle: 4000000,
    successful_professional: 6000000,
    high_class: 10000000,
    elite: 25000000,
  });

  function shareOfReferenceMonthly(share, rounding = 100) {
    const raw = REFERENCE_MONTHLY_WAGE_AHN * Math.max(0, Number(share) || 0);
    const step = Math.max(1, Math.trunc(Number(rounding) || 1));
    return Math.round(raw / step) * step;
  }

  function priceBand(id, label, minShare, maxShare, notes) {
    return Object.freeze({
      id,
      label,
      minShare,
      maxShare,
      minAhn: shareOfReferenceMonthly(minShare),
      maxAhn: maxShare == null ? null : shareOfReferenceMonthly(maxShare),
      notes: notes || "",
    });
  }

  const FOOD_PRICE_BANDS = Object.freeze({
    survival: priceBand("survival", "Survival food", 0.001, 0.005, "Ration blocks, dubious stew, cheap noodles, stale bread."),
    cheap_meal: priceBand("cheap_meal", "Cheap meal", 0.005, 0.012, "Backstreets everyday prepared food."),
    normal_meal: priceBand("normal_meal", "Normal meal", 0.012, 0.030, "Standard complete meal."),
    good_restaurant: priceBand("good_restaurant", "Good restaurant", 0.030, 0.100, "Restaurant-quality meal or premium ingredients."),
    luxury_meal: priceBand("luxury_meal", "Luxury meal", 0.100, 0.800, "Fine dining, prestigious or exotic cuisine."),
  });

  const ITEM_PRICE_BANDS = Object.freeze({
    common_raw_food: priceBand("common_raw_food", "Common raw food", 0.0008, 0.0040),
    common_protein: priceBand("common_protein", "Common protein", 0.0060, 0.0180),
    specialty_food: priceBand("specialty_food", "Specialty ingredient", 0.0050, 0.0300),
    rare_culinary: priceBand("rare_culinary", "Rare culinary ingredient", 0.0200, 0.2000),
    common_biomaterial: priceBand("common_biomaterial", "Common biomaterial", 0.0050, 0.0800),
    industrial_material: priceBand("industrial_material", "Industrial material", 0.0100, 0.2500),
    rare_material: priceBand("rare_material", "Rare / advanced material", 0.1500, 2.0000),
    professional_tool: priceBand("professional_tool", "Professional tool set", 0.0600, 0.5000),
    simple_weapon: priceBand("simple_weapon", "Simple weapon", 0.0500, 0.6000),
    martial_weapon: priceBand("martial_weapon", "Martial weapon", 0.2500, 1.5000),
    armor_equipment: priceBand("armor_equipment", "Armor / defensive equipment", 0.3000, 3.0000),
    medical_consumable: priceBand("medical_consumable", "Medical consumable", 0.0100, 6.0000),
    corporate_technology: priceBand("corporate_technology", "Corporate / advanced technology", 0.1000, 25.0000),
  });

  const STAR_VALUE_MULTIPLIER = Object.freeze({
    1: 0.70,
    2: 0.85,
    3: 1.00,
    4: 1.20,
    5: 1.50,
  });

  const VENUE_MULTIPLIER = Object.freeze({
    grocery_prepared: 1.20,
    bakery: 1.25,
    street_stall: 1.25,
    deli_food_shop: 1.30,
    takeaway_fast_food: 1.35,
    specialty_food_shop: 1.40,
    diner: 1.50,
    restaurant_standard: 1.75,
    restaurant_good: 2.00,
    restaurant_upscale: 2.50,
    fine_dining: 3.00,
    luxury_prestige: 4.00,
  });

  const DISH_LABOR_SHARE = Object.freeze({
    snack: 0.0010,
    simple: 0.0020,
    standard: 0.0040,
    complex: 0.0070,
    elaborate: 0.0100,
    fine: 0.0150,
  });

  function roundAhn(value, step = 10) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const quantum = Math.max(1, Math.trunc(Number(step) || 1));
    return Math.max(0, Math.round((numeric + 1e-9) / quantum) * quantum);
  }

  function salaryBand(id) {
    return SALARY_BANDS.find((entry) => entry.id === String(id || "").trim().toLowerCase()) || null;
  }

  function midpointAhn(band) {
    if (!band) return null;
    if (band.maxAhn == null) return band.minAhn;
    return Math.round((band.minAhn + band.maxAhn) / 2);
  }

  function monthlyAffordability(priceAhn, monthlyIncomeAhn = REFERENCE_MONTHLY_WAGE_AHN) {
    const price = Math.max(0, Number(priceAhn) || 0);
    const income = Math.max(1, Number(monthlyIncomeAhn) || REFERENCE_MONTHLY_WAGE_AHN);
    return Object.freeze({
      priceAhn: roundAhn(price, 1),
      monthlyIncomeAhn: roundAhn(income, 1),
      monthlyShare: price / income,
      purchasesPerMonth: price > 0 ? income / price : Infinity,
    });
  }

  function realizedFoodValue(createdProductionValueAhn, stars = 3) {
    const quality = Math.max(1, Math.min(5, Math.round(Number(stars) || 3)));
    return roundAhn(Math.max(0, Number(createdProductionValueAhn) || 0) * STAR_VALUE_MULTIPLIER[quality], 10);
  }

  function venuePrice(realizedProductionValueAhn, venue = "restaurant_standard") {
    const key = String(venue || "").trim().toLowerCase();
    const multiplier = VENUE_MULTIPLIER[key];
    if (!multiplier) return null;
    return roundAhn(Math.max(0, Number(realizedProductionValueAhn) || 0) * multiplier, 10);
  }

  function dishLaborValueAhn(laborClass = "standard") {
    const share = DISH_LABOR_SHARE[String(laborClass || "").trim().toLowerCase()];
    return share == null ? null : shareOfReferenceMonthly(share, 10);
  }

  function dishCreatedProductionValue(inputProductionValueAhn, creationMultiplier = 1, laborClass = "standard") {
    const inputs = Math.max(0, Number(inputProductionValueAhn) || 0);
    const multiplier = Math.max(1, Number(creationMultiplier) || 1);
    const labor = dishLaborValueAhn(laborClass);
    if (labor == null) return null;
    return roundAhn(inputs * multiplier + labor, 10);
  }

  function foodPriceClass(priceAhn) {
    const value = Math.max(0, Number(priceAhn) || 0);
    for (const band of Object.values(FOOD_PRICE_BANDS)) {
      if (value >= band.minAhn && (band.maxAhn == null || value <= band.maxAhn)) return band.id;
    }
    if (value < FOOD_PRICE_BANDS.survival.minAhn) return "below_survival_reference";
    return "above_luxury_reference";
  }

  const API = Object.freeze({
    VERSION,
    CURRENCY,
    REFERENCE_MONTHLY_WAGE_AHN,
    SALARY_BANDS,
    QUICK_REFERENCES_AHN,
    FOOD_PRICE_BANDS,
    ITEM_PRICE_BANDS,
    STAR_VALUE_MULTIPLIER,
    VENUE_MULTIPLIER,
    DISH_LABOR_SHARE,
    roundAhn,
    shareOfReferenceMonthly,
    salaryBand,
    midpointAhn,
    monthlyAffordability,
    realizedFoodValue,
    venuePrice,
    dishLaborValueAhn,
    dishCreatedProductionValue,
    foodPriceClass,
  });

  global.LuminousItemEconomyStandard = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
