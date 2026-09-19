(function (global) {
  "use strict";

  if (global.LuminousCookingEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingEngine;
    return;
  }

  const VERSION = 1;
  const MIN_RECIPE_TH = 8;
  const MAX_RECIPE_TH = 24;
  const MEDIUM_HUNGER_SLOTS = 3;
  const MEDIUM_HYDRATION_SLOTS = 3;
  const SURVIVAL_DECAY_HOURS = 6;
  const IMPROPER_EQUIPMENT_TH_PENALTY = 3;
  const PROCESSED_STABILIZATION_CAP = 2;
  const AUXILIARY_COMPLEXITY_CAP = 4;

  const METHOD_BASE_TH = Object.freeze({
    assemble: 8,
    cut: 8,
    simple_mix: 8,
    mixing: 9,
    basic_boil: 9,
    grill: 10,
    pan_fry: 10,
    steam: 11,
    roast: 11,
    knead: 11,
    simmer: 12,
    stir_fry: 12,
    bake: 13,
    deep_fry: 13,
    smoke: 14,
    cure: 14,
    pickle: 14,
    dry: 14,
    ferment: 15,
    brew: 15,
    distill: 15,
    delicate: 15,
  });

  const AUXILIARY_TH = Object.freeze({
    cut: 0,
    prep: 0,
    mix: 0,
    season: 0,
    knead: 1,
    whisk: 1,
    emulsify: 1,
    reduce: 1,
    caramelize: 1,
    temper: 1,
    separate: 1,
    clarify: 1,
    fine_filter: 1,
    second_cooking_method: 1,
    temperature_control: 1,
    prior_fermentation: 2,
  });

  const ROLE_COMPLEXITY = Object.freeze({
    core: 1,
    major: 1,
    minor: 0.5,
    seasoning: 0.25,
    garnish: 0,
  });

  const PROPERTY_WEIGHT = Object.freeze({
    core: 3,
    major: 3,
    minor: 2,
    seasoning: 1,
    garnish: 0,
  });

  const STAR_BANDS = Object.freeze([
    Object.freeze({ stars: 1, maxMargin: -8 }),
    Object.freeze({ stars: 2, maxMargin: -1 }),
    Object.freeze({ stars: 3, maxMargin: 3 }),
    Object.freeze({ stars: 4, maxMargin: 7 }),
    Object.freeze({ stars: 5, maxMargin: Infinity }),
  ]);

  const STAR_TASTE_MODIFIER = Object.freeze({ 1: -2, 2: -1, 3: 0, 4: 1, 5: 2 });
  const STAR_ACTIVE_EFFECTS = Object.freeze({ 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 });
  const STAR_DURATION_HOURS = Object.freeze({ 1: 0, 2: 1, 3: 2, 4: 4, 5: 6 });

  const PROPERTY_VARIANT_COUNT = Object.freeze({
    normal: 0,
    notable: 1,
    rare: 2,
    exceptional: 3,
  });

  const SKILL_TARGETS = Object.freeze([
    "athletics", "acrobatics", "sleight_of_hand", "stealth",
    "arcana", "history", "investigation", "nature", "religion",
    "animal_handling", "insight", "medicine", "perception", "survival",
    "deception", "persuasion", "intimidation", "performance",
  ]);

  const SAVE_TARGETS = Object.freeze([
    "str_save", "dex_save", "con_save", "int_save", "wis_save", "cha_save",
  ]);

  const VALID_TARGETS = Object.freeze(new Set([...SKILL_TARGETS, ...SAVE_TARGETS]));
  const VALID_ABILITIES = Object.freeze(new Set(["dex", "int", "wis"]));

  const REST_CONTRACT = Object.freeze({
    shortRest: Object.freeze({
      activeWindows: 1,
      choice: Object.freeze(["activity", "eat_drink"]),
      sleepRequired: false,
      cooldownHours: 2,
    }),
    longRest: Object.freeze({
      activeWindows: 1,
      choice: Object.freeze(["activity", "eat_drink"]),
      sleepRequired: true,
      sleepAfterActiveWindow: true,
    }),
  });

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function methodBaseTh(method) {
    const key = normalizeId(method);
    return Object.prototype.hasOwnProperty.call(METHOD_BASE_TH, key) ? METHOD_BASE_TH[key] : null;
  }

  function ingredientComplexity(ingredients) {
    const entries = Array.isArray(ingredients) ? ingredients : [];
    const raw = entries.reduce((sum, ingredient) => {
      const role = normalizeId(ingredient?.role || "major");
      return sum + (ROLE_COMPLEXITY[role] ?? 0);
    }, 0);
    return Object.freeze({ raw, th: Math.ceil(raw) });
  }

  function auxiliaryComplexity(steps) {
    const entries = Array.isArray(steps) ? steps : [];
    const raw = entries.reduce((sum, step) => {
      if (typeof step === "number") return sum + Math.max(0, step);
      if (step && Number.isFinite(Number(step.thDelta))) return sum + Math.max(0, Number(step.thDelta));
      return sum + (AUXILIARY_TH[normalizeId(step?.id || step)] ?? 0);
    }, 0);
    return Object.freeze({ raw, th: Math.min(AUXILIARY_COMPLEXITY_CAP, Math.ceil(raw)) });
  }

  function processedStabilization(ingredients) {
    const entries = Array.isArray(ingredients) ? ingredients : [];
    const total = entries.reduce((sum, ingredient) => {
      const explicit = Number(ingredient?.processedStabilization);
      if (Number.isFinite(explicit)) return sum + clamp(explicit, 0, 2);
      const tier = normalizeId(ingredient?.processedRole);
      if (tier === "key") return sum + 2;
      if (tier === "appropriate") return sum + 1;
      return sum;
    }, 0);
    return Math.min(PROCESSED_STABILIZATION_CAP, Math.floor(total));
  }

  function buildRecipeTh(recipe = {}) {
    const base = Number.isFinite(Number(recipe.baseTh))
      ? clamp(Math.round(Number(recipe.baseTh)), 8, 15)
      : methodBaseTh(recipe.method);
    if (base == null) throw new Error("Cooking recipe requires a known method or baseTh 8..15.");

    const ingredient = ingredientComplexity(recipe.ingredients);
    const auxiliary = auxiliaryComplexity(recipe.auxiliarySteps);
    const processed = Number.isFinite(Number(recipe.processedStabilization))
      ? clamp(Math.floor(Number(recipe.processedStabilization)), 0, PROCESSED_STABILIZATION_CAP)
      : processedStabilization(recipe.ingredients);
    const specialPenalty = Math.max(0, Math.floor(Number(recipe.specialPenalty) || 0));
    const raw = base + ingredient.th + auxiliary.th + specialPenalty - processed;
    const recipeTh = clamp(raw, MIN_RECIPE_TH, MAX_RECIPE_TH);

    return Object.freeze({
      baseTh: base,
      ingredientComplexity: ingredient.raw,
      ingredientTh: ingredient.th,
      auxiliaryComplexity: auxiliary.raw,
      auxiliaryTh: auxiliary.th,
      specialPenalty,
      processedStabilization: processed,
      rawTh: raw,
      recipeTh,
    });
  }

  function cooksUtensilsReduction(options = {}) {
    if (!options.hasCooksUtensils) return 0;
    if (!options.proficient) return 1;
    const proficiency = Math.max(0, Math.floor(Number(options.proficiency) || 0));
    return 2 + proficiency;
  }

  function effectiveCookingTh(recipeTh, options = {}) {
    const improperCount = Math.max(0, Math.floor(Number(options.improperEquipmentCount) || 0));
    const improperPenalty = improperCount * IMPROPER_EQUIPMENT_TH_PENALTY;
    const utensilReduction = cooksUtensilsReduction(options);
    const stationModifier = Number(options.stationThModifier) || 0;
    const toolModifier = Number(options.toolThModifier) || 0;
    const effectiveTh = Math.max(1, Math.round(Number(recipeTh) + improperPenalty + stationModifier + toolModifier - utensilReduction));
    return Object.freeze({
      recipeTh: Math.round(Number(recipeTh) || 0),
      improperCount,
      improperPenalty,
      utensilReduction,
      stationThModifier: stationModifier,
      toolThModifier: toolModifier,
      effectiveTh,
    });
  }

  function validateRecipeAbility(ability) {
    const key = normalizeId(ability);
    return VALID_ABILITIES.has(key) ? key : null;
  }

  function starsFromMargin(margin) {
    const value = Number(margin) || 0;
    if (value <= -8) return 1;
    if (value <= -1) return 2;
    if (value <= 3) return 3;
    if (value <= 7) return 4;
    return 5;
  }

  function resolveCookingQuality(checkResult, effectiveTh) {
    const result = Number(checkResult) || 0;
    const threshold = Number(effectiveTh) || 0;
    const margin = result - threshold;
    const stars = starsFromMargin(margin);
    return Object.freeze({
      checkResult: result,
      effectiveTh: threshold,
      margin,
      stars,
      activeEffectCount: STAR_ACTIVE_EFFECTS[stars],
      durationHours: STAR_DURATION_HOURS[stars],
      tasteModifier: STAR_TASTE_MODIFIER[stars],
    });
  }

  function baseTaste(ingredients) {
    const entries = Array.isArray(ingredients) ? ingredients : [];
    let weighted = 0;
    let totalWeight = 0;
    for (const ingredient of entries) {
      const role = normalizeId(ingredient?.role || "major");
      const weight = ROLE_COMPLEXITY[role] ?? 0;
      if (weight <= 0) continue;
      const taste = clamp(Math.round(Number(ingredient?.taste) || 0), 0, 4);
      weighted += taste * weight;
      totalWeight += weight;
    }
    const raw = totalWeight > 0 ? weighted / totalWeight : 0;
    return Object.freeze({ raw, value: clamp(Math.round(raw), 0, 4), totalWeight });
  }

  function finalTaste(baseTasteValue, stars) {
    const quality = clamp(Math.round(Number(stars) || 1), 1, 5);
    return clamp(Math.round(Number(baseTasteValue) || 0) + STAR_TASTE_MODIFIER[quality], 0, 6);
  }

  function spFromTaste(taste, edible = true) {
    const value = clamp(Math.round(Number(taste) || 0), 0, 6);
    if (edible !== false) return clamp(value + 2, 2, 8);
    if (value >= 5) return -5;
    return -10 + value;
  }

  function propertyPowerCapForTh(recipeTh) {
    const th = clamp(Math.round(Number(recipeTh) || MIN_RECIPE_TH), MIN_RECIPE_TH, MAX_RECIPE_TH);
    if (th <= 11) return 2;
    if (th <= 15) return 3;
    if (th <= 19) return 4;
    return 6;
  }

  function powerVector(distinctTargetCount, stars) {
    const count = Math.max(0, Math.floor(Number(distinctTargetCount) || 0));
    const quality = clamp(Math.round(Number(stars) || 1), 1, 5);
    if (!count || quality === 1) return [];
    if (count === 1) return ({ 2: [2], 3: [3], 4: [4], 5: [6] })[quality] || [];
    if (count === 2) return ({ 2: [1], 3: [2], 4: [3, 1], 5: [4, 2] })[quality] || [];
    if (count === 3) return ({ 2: [1], 3: [2], 4: [2, 1], 5: [3, 2, 1] })[quality] || [];
    return ({ 2: [1], 3: [1], 4: [1, 1], 5: [1, 1, 1] })[quality] || [];
  }

  function canonicalPropertyTarget(value) {
    const key = normalizeId(value);
    return VALID_TARGETS.has(key) ? key : null;
  }

  function rankPropertyTargets(ingredients, options = {}) {
    const priority = (Array.isArray(options.recipePriority) ? options.recipePriority : [])
      .map(canonicalPropertyTarget)
      .filter(Boolean);
    const priorityIndex = new Map(priority.map((id, index) => [id, index]));
    const scores = new Map();
    const seenSources = new Set();

    for (const ingredient of (Array.isArray(ingredients) ? ingredients : [])) {
      const role = normalizeId(ingredient?.role || "major");
      const weight = PROPERTY_WEIGHT[role] ?? 0;
      if (weight <= 0) continue;
      for (const property of (Array.isArray(ingredient?.culinaryProperties) ? ingredient.culinaryProperties : [])) {
        const target = canonicalPropertyTarget(property?.target || property);
        if (!target) continue;
        const sourceInstanceId = String(property?.sourceInstanceId || ingredient?.sourceInstanceId || "").trim();
        const sourceKey = sourceInstanceId ? sourceInstanceId + "::" + target : "";
        if (sourceKey && seenSources.has(sourceKey)) continue;
        if (sourceKey) seenSources.add(sourceKey);
        scores.set(target, (scores.get(target) || 0) + weight);
      }
    }

    return [...scores.entries()]
      .map(([target, affinity]) => ({ target, affinity }))
      .sort((a, b) => {
        if (b.affinity !== a.affinity) return b.affinity - a.affinity;
        const ai = priorityIndex.has(a.target) ? priorityIndex.get(a.target) : Number.MAX_SAFE_INTEGER;
        const bi = priorityIndex.has(b.target) ? priorityIndex.get(b.target) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.target.localeCompare(b.target);
      });
  }

  function resolveCulinaryEffects(ingredients, options = {}) {
    const ranked = rankPropertyTargets(ingredients, options);
    const stars = clamp(Math.round(Number(options.stars) || 1), 1, 5);
    const recipeTh = clamp(Math.round(Number(options.recipeTh) || MIN_RECIPE_TH), MIN_RECIPE_TH, MAX_RECIPE_TH);
    const vector = powerVector(ranked.length, stars);
    const cap = propertyPowerCapForTh(recipeTh);
    return Object.freeze(ranked.slice(0, vector.length).map((entry, index) => Object.freeze({
      target: entry.target,
      affinity: entry.affinity,
      power: Math.min(vector[index], cap),
      durationHours: STAR_DURATION_HOURS[stars],
    })));
  }

  function restoreSurvivalSlots(current, amount, maxSlots) {
    const max = Math.max(0, Math.floor(Number(maxSlots) || 0));
    return clamp(Math.floor(Number(current) || 0) + Math.max(0, Math.floor(Number(amount) || 0)), 0, max);
  }

  function dailySurvivalExhaustion(state = {}) {
    const sleepPenalty = state.completedRequiredLongRest ? 0 : 1;
    const sustenancePenalty = Number(state.hungerSlots) >= 1 && Number(state.hydrationSlots) >= 1 ? 0 : 1;
    return Object.freeze({
      sleepPenalty,
      sustenancePenalty,
      total: Math.min(2, sleepPenalty + sustenancePenalty),
    });
  }

  function resolvePreparedItem(recipe = {}, checkResult, options = {}) {
    const ability = validateRecipeAbility(recipe.ability);
    if (!ability) throw new Error("Cooking recipe must declare ability dex, int, or wis.");
    const th = buildRecipeTh(recipe);
    const equipment = effectiveCookingTh(th.recipeTh, options.equipment || {});
    const quality = resolveCookingQuality(checkResult, equipment.effectiveTh);
    const tasteBase = baseTaste(recipe.ingredients);
    const taste = finalTaste(tasteBase.value, quality.stars);
    const effects = resolveCulinaryEffects(recipe.ingredients, {
      stars: quality.stars,
      recipeTh: th.recipeTh,
      recipePriority: recipe.propertyPriority,
    });
    const edible = recipe.edible !== false;
    return Object.freeze({
      recipeId: recipe.id || null,
      ability,
      recipeTh: th.recipeTh,
      effectiveTh: equipment.effectiveTh,
      margin: quality.margin,
      stars: quality.stars,
      tasteBase: tasteBase.value,
      taste,
      sp: spFromTaste(taste, edible),
      edible,
      activeEffectCount: effects.length,
      durationHours: quality.durationHours,
      effects,
      provenance: Object.freeze((recipe.ingredients || []).map((item) => item?.itemId || item?.id || null).filter(Boolean)),
    });
  }

  const API = Object.freeze({
    VERSION,
    MIN_RECIPE_TH,
    MAX_RECIPE_TH,
    MEDIUM_HUNGER_SLOTS,
    MEDIUM_HYDRATION_SLOTS,
    SURVIVAL_DECAY_HOURS,
    IMPROPER_EQUIPMENT_TH_PENALTY,
    PROCESSED_STABILIZATION_CAP,
    AUXILIARY_COMPLEXITY_CAP,
    METHOD_BASE_TH,
    AUXILIARY_TH,
    ROLE_COMPLEXITY,
    PROPERTY_WEIGHT,
    STAR_BANDS,
    STAR_TASTE_MODIFIER,
    STAR_ACTIVE_EFFECTS,
    STAR_DURATION_HOURS,
    PROPERTY_VARIANT_COUNT,
    SKILL_TARGETS,
    SAVE_TARGETS,
    REST_CONTRACT,
    normalizeId,
    clamp,
    methodBaseTh,
    ingredientComplexity,
    auxiliaryComplexity,
    processedStabilization,
    buildRecipeTh,
    cooksUtensilsReduction,
    effectiveCookingTh,
    validateRecipeAbility,
    starsFromMargin,
    resolveCookingQuality,
    baseTaste,
    finalTaste,
    spFromTaste,
    propertyPowerCapForTh,
    powerVector,
    canonicalPropertyTarget,
    rankPropertyTargets,
    resolveCulinaryEffects,
    restoreSurvivalSlots,
    dailySurvivalExhaustion,
    resolvePreparedItem,
  });

  global.LuminousCookingEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
