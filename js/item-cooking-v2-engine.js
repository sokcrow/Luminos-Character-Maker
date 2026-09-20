(function (global) {
  "use strict";

  if (global.LuminousCookingV2Engine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingV2Engine;
    return;
  }

  const VERSION = 2;
  const SP_MIN = -45;
  const SP_MAX = 45;
  const DURATION_MIN_HOURS = 8;
  const DURATION_MAX_HOURS = 20;
  const DURATION_PER_PROFICIENCY_BONUS = 2;
  const FRESHNESS_MULTIPLIER = 1.20;
  const MAX_HP_STEPS = Object.freeze([0, 10, 15, 18, 20, 25, 30, 40, 50]);
  const STAR_RESOURCE_SCALE = Object.freeze({ 1: 0.20, 2: 0.40, 3: 0.60, 4: 0.80, 5: 1.00 });
  const STAR_EFFECT_COUNT = Object.freeze({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 3 });

  const SKILL_TARGETS = Object.freeze([
    "athletics", "acrobatics", "sleight_of_hand", "stealth",
    "arcana", "history", "investigation", "nature", "religion",
    "animal_handling", "insight", "medicine", "perception", "survival",
    "deception", "persuasion", "intimidation", "performance",
  ]);
  const SAVE_TARGETS = Object.freeze(["str_save", "dex_save", "con_save", "int_save", "wis_save", "cha_save"]);
  const VALID_TARGETS = Object.freeze(new Set([...SKILL_TARGETS, ...SAVE_TARGETS]));

  const FOCUS = Object.freeze({
    martial: Object.freeze({
      label: "Martial",
      examples: "Fighter / Barbarian / martial Paladin",
      skills: Object.freeze(["athletics", "intimidation", "survival"]),
      saves: Object.freeze(["str_save", "con_save"]),
    }),
    agile: Object.freeze({
      label: "Agile",
      examples: "Rogue / Monk / agile Ranger",
      skills: Object.freeze(["acrobatics", "sleight_of_hand", "stealth", "perception"]),
      saves: Object.freeze(["dex_save", "con_save"]),
    }),
    arcane: Object.freeze({
      label: "Arcane",
      examples: "Wizard / Sorcerer / Warlock / Artificer",
      skills: Object.freeze(["arcana", "history", "investigation"]),
      saves: Object.freeze(["int_save", "wis_save"]),
    }),
    primal: Object.freeze({
      label: "Primal",
      examples: "Druid / Ranger / primal caster",
      skills: Object.freeze(["nature", "animal_handling", "survival", "perception"]),
      saves: Object.freeze(["wis_save", "con_save"]),
    }),
    support: Object.freeze({
      label: "Support",
      examples: "Cleric / healer / protector",
      skills: Object.freeze(["religion", "medicine", "insight"]),
      saves: Object.freeze(["wis_save", "con_save"]),
    }),
    social: Object.freeze({
      label: "Social",
      examples: "Bard / party face / social caster",
      skills: Object.freeze(["deception", "persuasion", "performance", "insight"]),
      saves: Object.freeze(["cha_save", "wis_save"]),
    }),
  });

  const PROFILE = Object.freeze({
    balanced_meal: Object.freeze({ maxHp5: 20, spRecovery5: 5, focuses:["martial","primal","support","social","arcane","agile"] }),
    fruit_refresh: Object.freeze({ maxHp5: 10, spRecovery5: 5, focuses:["agile","primal","support","social"] }),
    vegetable_focus: Object.freeze({ maxHp5: 15, spRecovery5: 5, focuses:["primal","support","arcane"] }),
    mushroom_focus: Object.freeze({ maxHp5: 15, spRecovery5: 5, focuses:["arcane","primal","agile"] }),
    grain_endurance: Object.freeze({ maxHp5: 18, spRecovery5: 0, focuses:["martial","support","primal","social"] }),
    egg_balance: Object.freeze({ maxHp5: 15, spRecovery5: 0, focuses:["support","agile","primal"] }),
    dairy_comfort: Object.freeze({ maxHp5: 20, spRecovery5: 5, focuses:["support","social","primal"] }),
    protein_power: Object.freeze({ maxHp5: 25, spRecovery5: 0, focuses:["martial","primal","agile"] }),
    heavy_protein: Object.freeze({ maxHp5: 30, spRecovery5: 0, focuses:["martial","support"] }),
    seafood_precision: Object.freeze({ maxHp5: 18, spRecovery5: 5, focuses:["agile","primal","arcane"] }),
    soup_recovery: Object.freeze({ maxHp5: 20, spRecovery5: 5, focuses:["support","primal","martial"] }),
    rice_balance: Object.freeze({ maxHp5: 20, spRecovery5: 5, focuses:["agile","primal","arcane","social"] }),
    noodle_balance: Object.freeze({ maxHp5: 20, spRecovery5: 5, focuses:["agile","arcane","social"] }),
    portable_meal: Object.freeze({ maxHp5: 20, spRecovery5: 0, focuses:["martial","agile","social"] }),
    pizza_hearty: Object.freeze({ maxHp5: 25, spRecovery5: 0, focuses:["social","martial","support"] }),
    fried_energy: Object.freeze({ maxHp5: 20, spRecovery5: 0, focuses:["martial","agile","social"] }),
    spicy_drive: Object.freeze({ maxHp5: 20, spRecovery5: 5, focuses:["martial","social","primal"] }),
    fermented_resilience: Object.freeze({ maxHp5: 15, spRecovery5: 0, focuses:["primal","support","arcane"] }),
    dessert_focus: Object.freeze({ maxHp5: 10, spRecovery5: 10, focuses:["social","arcane","agile","support"] }),
    tea_composure: Object.freeze({ maxHp5: 10, spRecovery5: 10, focuses:["support","arcane","social"] }),
    coffee_alertness: Object.freeze({ maxHp5: 10, spRecovery5: 10, focuses:["arcane","agile","social"] }),
    drink_refresh: Object.freeze({ maxHp5: 10, spRecovery5: 5, focuses:["social","agile","support","primal"] }),
    cocktail_social: Object.freeze({ maxHp5: 10, spRecovery5: 10, focuses:["social","agile","arcane"] }),
    gourmet_precision: Object.freeze({ maxHp5: 25, spRecovery5: 10, focuses:["arcane","social","agile","support"] }),
    party_feast: Object.freeze({ maxHp5: 30, spRecovery5: 10, focuses:["social","support","martial","primal"] }),
    legendary_dragon: Object.freeze({ maxHp5: 50, spRecovery5: 15, focuses:["arcane","martial","support"] }),
    legendary_kraken: Object.freeze({ maxHp5: 40, spRecovery5: 10, focuses:["primal","arcane","martial","agile"] }),
    none_processed: Object.freeze({ maxHp5: 0, spRecovery5: 0, focuses:[] }),
  });

  const FOCUS_KEYWORD_BOOSTS = Object.freeze([
    Object.freeze({ words:["dragon","magic","magical","fortune"], focuses:["arcane","support"] }),
    Object.freeze({ words:["kraken","eel","salmon","tuna","fish","seafood","sashimi","sushi","shrimp","lobster","crab"], focuses:["agile","primal"] }),
    Object.freeze({ words:["truffle","caviar","coffee","espresso","macaron"], focuses:["arcane","social"] }),
    Object.freeze({ words:["tea","porridge","soup","stew","milk","yogurt"], focuses:["support","primal"] }),
    Object.freeze({ words:["steak","roast","chicken","pork","beef","sausage","ribs"], focuses:["martial"] }),
    Object.freeze({ words:["salad","fruit","fresh","granita"], focuses:["agile","primal"] }),
    Object.freeze({ words:["cake","cookie","dessert","cocktail","pizza","burger"], focuses:["social"] }),
    Object.freeze({ words:["mushroom","herb","kimchi","miso","natto","pickle"], focuses:["primal","arcane","support"] }),
  ]);

  const SKILL_KEYWORDS = Object.freeze({
    athletics:["steak","roast","meat","chicken","pork","beef","fried","ribs","sausage"],
    intimidation:["spicy","pepper","fire","dragon","gochujang","curry","hot_chicken"],
    survival:["stew","bread","rice","fish","smelt","porridge","ration","grilled"],
    acrobatics:["salad","sashimi","sushi","fruit","light","crepe"],
    sleight_of_hand:["sushi","canape","shumai","macaron","tart","dumpling","croissant","sashimi"],
    stealth:["mushroom","tea","herb","sashimi","eel","night","smoked"],
    perception:["coffee","fish","seafood","tea","caviar","smelt","tuna","salmon"],
    arcana:["dragon","kraken","magical","truffle","chocolate","rare"],
    history:["barley","cornbread","moon_cake","songpyeon","miso","traditional","bread","rice_cake"],
    investigation:["coffee","espresso","truffle","caviar","ferment","sauce","cream","pasta"],
    nature:["vegetable","mushroom","herb","fruit","ferment","kimchi","cabbage","tofu"],
    animal_handling:["milk","cheese","yogurt","egg","chicken","beef","pork"],
    medicine:["soup","porridge","tea","vegetable","herb","yogurt","egg","salad"],
    insight:["tea","soup","porridge","pudding","milk","comfort","fondue"],
    religion:["moon_cake","songpyeon","fortune","festival","birthday","ceremonial","tea"],
    deception:["cocktail","sweet","chocolate","burger","pizza"],
    persuasion:["cocktail","pizza","sandwich","tea_set","dessert","cake","cheese"],
    performance:["cake","cookie","dessert","cocktail","tea_set","birthday","festival","pizza"],
  });

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function recipeCatalog() {
    return global.LuminousCookingRecipeCatalog || safeRequire("./item-cooking-recipe-catalog.js");
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
  function hasAny(text, words) {
    const haystack = normalizeId(text);
    return (words || []).some((word) => haystack.includes(normalizeId(word)));
  }

  function profileIdFor(recipe = {}) {
    const name = normalizeId(recipe.name || recipe.id);
    const family = normalizeId(recipe.dishFamily);
    const course = normalizeId(recipe.course);
    const tags = unique([...(recipe.tags || []).map(normalizeId), family, course]);
    const combined = [name, ...tags].join("_");

    if (hasAny(combined, ["dragon"])) return "legendary_dragon";
    if (hasAny(combined, ["kraken"])) return "legendary_kraken";
    if (hasAny(combined, ["caviar","truffle","shark_fin","fugu","otoro","lobster","luxury","gourmet"])) return "gourmet_precision";
    if (hasAny(combined, ["meal_set","tea_set","dessert_set","party","feast"])) return "party_feast";
    if (hasAny(combined, ["kimchi","miso","natto","pickle","sauerkraut","hakarl","yogurt","umeboshi","ferment"])) return "fermented_resilience";
    if (hasAny(combined, ["curry","gochujang","spicy","yangnyeom","tteokbokki","tandoori","chili"])) return "spicy_drive";
    if (hasAny(combined, ["coffee","espresso","cappuccino","mocha","macchiato"])) return "coffee_alertness";
    if (hasAny(combined, ["tea"])) return "tea_composure";
    if (course === "drink" || hasAny(combined, ["juice","milk_drink","drink","cocktail","beer","cider","highball"])) {
      return hasAny(combined, ["cocktail","beer","cider","highball","sling","sunrise"]) ? "cocktail_social" : "drink_refresh";
    }
    if (hasAny(combined, ["fish","shrimp","eel","salmon","tuna","mackerel","herring","trout","carp","catfish","crab","scallop","shellfish","octopus","sea_bream","marlin","sweetfish","sashimi","sushi","seafood","jellyfish","smelt","capelin","sturgeon","angler"])) return "seafood_precision";
    if (hasAny(combined, ["mushroom","fungus"])) return "mushroom_focus";
    if (hasAny(combined, ["egg","omelette","chawanmushi","gyeran"]) && !hasAny(combined,["eggplant"])) return "egg_balance";
    if (hasAny(combined, ["fruit","apple","grape","strawberry","blueberry","orange","lemon","pineapple","plum","jam","marmalade"])) return "fruit_refresh";
    if (hasAny(combined, ["soup","stew","jjigae","hot_pot","porridge","juk","bouillabaisse","fondue"])) return "soup_recovery";
    if (hasAny(combined, ["pizza","calzone"])) return "pizza_hearty";
    if (hasAny(combined, ["ramen","udon","soba","noodle","chow_mein","pad_thai","spaghetti","pasta","farfalle","amatriciana","vongole","carbonara","gnocchi"])) return "noodle_balance";
    if (hasAny(combined, ["rice","bibimbap","omurice","rice_bowl"]) && !hasAny(combined,["rice_cake"])) return "rice_balance";
    if (hasAny(combined, ["burger","sandwich","burrito","kebab","croque","taco","quesadilla","fajita"])) return "portable_meal";
    if (hasAny(combined, ["steak","roast","schweinshaxe","churrasco","t_bone","ribs","turkey"])) return "heavy_protein";
    if (hasAny(combined, ["meat","chicken","pork","beef","sausage","tonkatsu","bacon","ham","bulgogi","meatloaf"])) return "protein_power";
    if (hasAny(combined, ["fried","tempura","fries","chip","croquette","donut"])) return "fried_energy";
    if (hasAny(combined, ["salad","coleslaw","vegetable","cabbage","celery","guacamole","salsa"])) return "vegetable_focus";
    if (hasAny(combined, ["milk","cheese","cream"]) && !hasAny(combined,["cake","cookie","chocolate"])) return "dairy_comfort";
    if (hasAny(combined, ["cake","cookie","chocolate","macaron","pie","tart","souffle","brownie","candy","jelly","panna_cotta","pudding","crepe","dessert","moon_cake","cannele","biscuit","smore","marshmallow","croffle","tiramisu","muffin","sweet_roll"])) return "dessert_focus";
    if (hasAny(combined, ["bread","cornbread","focaccia","croissant","toast","scone","tortilla","naan","pretzel","baguette","rolls","pancake","waffle"])) return "grain_endurance";
    return "balanced_meal";
  }

  function runtimeRole(recipe = {}) {
    const status = normalizeId(recipe.catalogStatus || recipe.sourceStatus);
    const family = normalizeId(recipe.dishFamily);
    const tags = (recipe.tags || []).map(normalizeId);
    if (status === "exclude" || tags.includes("failure")) return "excluded_failure";
    if (status.includes("event") || tags.includes("event") || tags.includes("pet")) return "reference_only";
    if (tags.includes("processed") || family.includes("processed") || family.includes("ingredient")) return "processed_intermediate";
    if (normalizeId(recipe.course) === "drink") return "drink";
    return "finished_dish";
  }

  function restTimingFor(recipe = {}, profileId = "balanced_meal", role = "finished_dish") {
    if (!["finished_dish","drink"].includes(role)) return "n_a";
    const name = normalizeId(recipe.name || recipe.id);
    if (hasAny(name, ["coffee","espresso","juice","cocktail","milk","tea","salad","fruit","sashimi","sushi","canape","granita"])) return "immediate";
    if (["soup_recovery","dairy_comfort","tea_composure","fermented_resilience","grain_endurance"].includes(profileId) || hasAny(name,["porridge","stew","bread","yogurt","pudding","fondue"])) return "pre_sleep_long_rest";
    return "rest_meal";
  }

  function sleepSynergyFor(restTiming, profileId, recipe = {}) {
    if (restTiming !== "pre_sleep_long_rest") return Object.freeze({ type:"none" });
    const name = normalizeId(recipe.name || recipe.id);
    if (["soup_recovery","tea_composure","dairy_comfort"].includes(profileId) || hasAny(name,["porridge","stew","soup","tea","milk","yogurt"])) {
      return Object.freeze({ type:"secondary_skill_bonus", power:1, durationHours:4 });
    }
    return Object.freeze({ type:"duration_extension", hours:2, capHours:20 });
  }

  function gourmetMinStarsFor(recipe = {}, profileId = "balanced_meal") {
    const name = normalizeId(recipe.name || recipe.id);
    if (["legendary_dragon","legendary_kraken"].includes(profileId) || hasAny(name,["caviar","shark_fin","fugu","full_kraken"])) return 5;
    if (profileId === "gourmet_precision" || hasAny(name,["macaron","panna_cotta","souffle","gorgonzola","lobster","coq_au_vin","bouillabaisse","afternoon_tea","truffle","rare_cheesecake"])) return 4;
    return 0;
  }

  function draftThFor(recipe = {}, profileId = "balanced_meal", gourmetMinStars = 0) {
    const baseByMethod = {
      assemble:8, cut:8, simple_mix:8, mixing:9, basic_boil:9, boil:9, grill:10, pan_fry:10,
      steam:11, roast:11, knead:11, simmer:12, stir_fry:12, bake:13, deep_fry:13,
      smoke:14, cure:14, pickle:14, dry:14, ferment:15, brew:15, distill:15, delicate:15,
    };
    const base = baseByMethod[normalizeId(recipe.method)] ?? 10;
    const easy = new Set(["balanced_meal","fruit_refresh","grain_endurance","egg_balance","drink_refresh"]);
    const medium = new Set(["vegetable_focus","mushroom_focus","dairy_comfort","protein_power","seafood_precision","soup_recovery","rice_balance","noodle_balance","portable_meal","fried_energy","fermented_resilience","dessert_focus","tea_composure","coffee_alertness","cocktail_social"]);
    const hard = new Set(["heavy_protein","pizza_hearty","spicy_drive","gourmet_precision"]);
    let extra = easy.has(profileId) ? 1 : medium.has(profileId) ? 2 : hard.has(profileId) ? 3 : 4;
    if (gourmetMinStars === 4) extra += 1;
    if (gourmetMinStars === 5) extra += 2;
    return clamp(base + extra, 8, 24);
  }

  function orderedFocusCandidates(recipe, profileId) {
    const profile = PROFILE[profileId] || PROFILE.balanced_meal;
    const name = normalizeId(recipe.name || recipe.id);
    const boosted = [];
    for (const rule of FOCUS_KEYWORD_BOOSTS) {
      if (!hasAny(name, rule.words)) continue;
      for (const focus of rule.focuses) if (profile.focuses.includes(focus)) boosted.push(focus);
    }
    return unique([...boosted, ...profile.focuses]);
  }

  function orderedSkillCandidates(recipe, focusId) {
    const focus = FOCUS[focusId];
    const name = normalizeId(recipe.name || recipe.id);
    const boosted = focus.skills.filter((skill) => hasAny(name, SKILL_KEYWORDS[skill] || []));
    return unique([...boosted, ...focus.skills]);
  }

  function minCountId(ids, counts) {
    return ids.reduce((best, id) => {
      if (!best) return id;
      const a = counts.get(id) || 0;
      const b = counts.get(best) || 0;
      return a < b ? id : best;
    }, null);
  }

  function compileRecipeFunctions(recipeList = []) {
    const recipes = (Array.isArray(recipeList) ? recipeList : []).map(clone);
    const focusCounts = new Map(Object.keys(FOCUS).map((id) => [id, 0]));
    const skillCounts = new Map(SKILL_TARGETS.map((id) => [id, 0]));
    const saveCounts = new Map(SAVE_TARGETS.map((id) => [id, 0]));
    const rows = [];

    for (const recipe of recipes) {
      const role = runtimeRole(recipe);
      const adoption = ["finished_dish","drink"].includes(role) ? "adapt" : role === "reference_only" ? "reference_optional" : role === "excluded_failure" ? "exclude" : "adapt";
      const profileId = role === "processed_intermediate" ? "none_processed" : profileIdFor(recipe);
      const profile = PROFILE[profileId] || PROFILE.balanced_meal;
      const gourmetMinStars = gourmetMinStarsFor(recipe, profileId);
      const restTiming = restTimingFor(recipe, profileId, role);
      let focusId = null;
      let effects5 = [];

      if (adoption === "adapt" && ["finished_dish","drink"].includes(role)) {
        const focusCandidates = orderedFocusCandidates(recipe, profileId);
        focusId = minCountId(focusCandidates, focusCounts);
        focusCounts.set(focusId, (focusCounts.get(focusId) || 0) + 1);

        const skillCandidates = orderedSkillCandidates(recipe, focusId);
        const primary = minCountId(skillCandidates, skillCounts);
        skillCounts.set(primary, (skillCounts.get(primary) || 0) + 1);
        const secondaryPool = skillCandidates.filter((id) => id !== primary);
        const secondary = minCountId(secondaryPool, skillCounts);
        skillCounts.set(secondary, (skillCounts.get(secondary) || 0) + 1);
        const save = minCountId(FOCUS[focusId].saves, saveCounts);
        saveCounts.set(save, (saveCounts.get(save) || 0) + 1);
        const primaryPower = gourmetMinStars > 0 || profileId.startsWith("legendary_") ? 2 : 1;
        effects5 = [
          Object.freeze({ target:primary, power:primaryPower, kind:"skill" }),
          Object.freeze({ target:secondary, power:1, kind:"skill" }),
          Object.freeze({ target:save, power:1, kind:"save" }),
        ];
      }

      rows.push(Object.freeze({
        recipeId: normalizeId(recipe.id || recipe.name),
        name: recipe.name || recipe.id,
        profileId,
        runtimeRole: role,
        adoption,
        edible: ["finished_dish","drink"].includes(role),
        reusableAsIngredient: role === "processed_intermediate",
        hungerRestore: role === "drink" || role === "processed_intermediate" ? 0 : (recipe.hungerRestore ?? 1),
        hydrationRestore: role === "drink" ? Math.max(1, Number(recipe.hydrationRestore ?? 1) || 1) : Math.max(0, Number(recipe.hydrationRestore ?? 0) || 0),
        recipeKnowledge: adoption === "adapt" ? "trackable_dm_unlock" : "n_a",
        freshnessEligible: ["finished_dish","drink"].includes(role),
        freshnessMultiplier: FRESHNESS_MULTIPLIER,
        cateringEligible: adoption === "adapt" && ["finished_dish","drink"].includes(role),
        gourmetMinStars,
        seasoningCompatible: role === "processed_intermediate" ? "enhancement_node" : adoption === "adapt",
        maxHp5: profile.maxHp5,
        spRecovery5: profile.spRecovery5,
        effects5: Object.freeze(effects5),
        mealFocus: focusId,
        mealFocusLabel: focusId ? FOCUS[focusId].label : "N/A",
        exampleClasses: focusId ? FOCUS[focusId].examples : "N/A",
        restTiming,
        sleepSynergy: sleepSynergyFor(restTiming, profileId, recipe),
        thDraft: draftThFor(recipe, profileId, gourmetMinStars),
      }));
    }

    return Object.freeze({
      rows: Object.freeze(rows),
      byId: Object.freeze(Object.fromEntries(rows.map((row) => [row.recipeId, row]))),
      coverage: Object.freeze({
        focus: Object.freeze(Object.fromEntries(focusCounts)),
        skills: Object.freeze(Object.fromEntries(skillCounts)),
        saves: Object.freeze(Object.fromEntries(saveCounts)),
      }),
    });
  }

  let compiledCache = null;
  let compiledSource = null;
  function compiledFunctions() {
    const catalog = recipeCatalog();
    const source = catalog?.RECIPES || catalog?.list?.() || [];
    if (!compiledCache || compiledSource !== source) {
      compiledSource = source;
      compiledCache = compileRecipeFunctions(source);
    }
    return compiledCache;
  }

  function get(recipeOrId) {
    const id = normalizeId(typeof recipeOrId === "object" ? (recipeOrId?.id || recipeOrId?.name) : recipeOrId);
    if (!id) return null;
    const compiled = compiledFunctions();
    if (compiled.byId[id]) return clone(compiled.byId[id]);
    if (typeof recipeOrId === "object") {
      const single = compileRecipeFunctions([recipeOrId]);
      return single.rows.length ? clone(single.rows[0]) : null;
    }
    return null;
  }

  function scaleResource(value5, stars) {
    const quality = clamp(Math.round(Number(stars) || 1), 1, 5);
    return Math.max(0, Math.round((Number(value5) || 0) * STAR_RESOURCE_SCALE[quality]));
  }

  function nearestMaxHpStep(value) {
    const target = Math.max(0, Number(value) || 0);
    return MAX_HP_STEPS.reduce((best, step) => Math.abs(step - target) < Math.abs(best - target) ? step : best, 0);
  }

  function scaledMaxHp(maxHp5, stars) {
    const quality = clamp(Math.round(Number(stars) || 1), 1, 5);
    return nearestMaxHpStep((Number(maxHp5) || 0) * STAR_RESOURCE_SCALE[quality]);
  }

  function effectsForStars(row, stars, durationHours) {
    const quality = clamp(Math.round(Number(stars) || 1), 1, 5);
    const count = STAR_EFFECT_COUNT[quality] || 0;
    return Object.freeze((row?.effects5 || []).slice(0, count).map((effect) => Object.freeze({
      target: normalizeId(effect.target),
      power: quality >= 5 ? Number(effect.power) || 0 : Math.min(1, Number(effect.power) || 0),
      durationHours,
      source: "recipe_v2",
    })).filter((effect) => VALID_TARGETS.has(effect.target) && effect.power > 0));
  }

  function cookProficiencyBonus(unit = {}, equipment = {}, options = {}) {
    const candidates = [
      options.cookProficiencyBonus,
      options.proficiencyBonus,
      unit.cookingProficiencyBonus,
      unit.cookProficiencyBonus,
      unit.proficiencyBonus,
      unit.proficiency,
      equipment.proficiency,
    ];
    for (const value of candidates) {
      if (Number.isFinite(Number(value))) return clamp(Math.floor(Number(value)), 0, 6);
    }
    return 0;
  }

  function durationHoursForCook(unit = {}, equipment = {}, options = {}) {
    const pb = cookProficiencyBonus(unit, equipment, options);
    return clamp(DURATION_MIN_HOURS + DURATION_PER_PROFICIENCY_BONUS * pb, DURATION_MIN_HOURS, DURATION_MAX_HOURS);
  }

  function resolvePreparedFunction(recipeOrId, stars, unit = {}, options = {}) {
    const row = get(recipeOrId);
    if (!row || row.adoption !== "adapt") return null;
    const durationHours = durationHoursForCook(unit, options.equipment || {}, options);
    const quality = clamp(Math.round(Number(stars) || 1), 1, 5);
    return Object.freeze({
      ...clone(row),
      stars: quality,
      durationHours,
      maxHpBonus: scaledMaxHp(row.maxHp5, quality),
      spRecovery: scaleResource(row.spRecovery5, quality),
      effects: effectsForStars(row, quality, durationHours),
    });
  }

  function knowledgeStores(unit = {}) {
    return [unit.cookingKnowledge, unit.knownRecipes, unit.knownCookingRecipes, unit.recipeKnowledge].filter((store) => store != null);
  }
  function hasExplicitKnowledgeStore(unit = {}) { return knowledgeStores(unit).length > 0; }

  function storeHasRecipe(store, ids) {
    if (Array.isArray(store)) return store.map(normalizeId).some((id) => ids.includes(id));
    if (store instanceof Set) return [...store].map(normalizeId).some((id) => ids.includes(id));
    if (store && typeof store === "object") {
      return Object.entries(store).some(([key, value]) => value !== false && value != null && ids.includes(normalizeId(key)));
    }
    return false;
  }

  function knowsRecipe(unit = {}, recipeOrId) {
    const row = get(recipeOrId);
    const ids = unique([
      normalizeId(typeof recipeOrId === "object" ? recipeOrId?.id : recipeOrId),
      normalizeId(typeof recipeOrId === "object" ? recipeOrId?.name : null),
      row?.recipeId,
      normalizeId(row?.name),
    ]);
    const stores = knowledgeStores(unit);
    if (!stores.length) return true;
    return stores.some((store) => storeHasRecipe(store, ids));
  }

  function grantRecipeKnowledge(unit = {}, recipeOrId) {
    const row = get(recipeOrId);
    const id = row?.recipeId || normalizeId(typeof recipeOrId === "object" ? recipeOrId?.id : recipeOrId);
    if (!id) return Object.freeze({ granted:false, reason:"unknown_recipe" });
    if (!unit.cookingKnowledge || typeof unit.cookingKnowledge !== "object" || Array.isArray(unit.cookingKnowledge)) unit.cookingKnowledge = {};
    unit.cookingKnowledge[id] = true;
    return Object.freeze({ granted:true, recipeId:id });
  }

  function canCaterParty(recipeOrId, party = []) {
    const row = get(recipeOrId);
    if (!row?.cateringEligible) return Object.freeze({ allowed:false, reason:"recipe_not_catering_eligible" });
    const members = Array.isArray(party) ? party : [];
    const index = members.findIndex((member) => knowsRecipe(member, recipeOrId));
    return index >= 0
      ? Object.freeze({ allowed:true, knowledgeableMemberIndex:index })
      : Object.freeze({ allowed:false, reason:"party_lacks_recipe_knowledge" });
  }

  function checkGourmetComponents(recipeOrId, inputs = []) {
    const row = get(recipeOrId);
    const required = Math.max(0, Math.trunc(Number(row?.gourmetMinStars) || 0));
    if (!required) return Object.freeze({ valid:true, requiredStars:0, checked:0, failures:Object.freeze([]) });
    const reusable = (Array.isArray(inputs) ? inputs : []).filter((input) =>
      input && (input.processed === true || normalizeId(input.family) === "processed_food" || normalizeId(input.category) === "food" || input.recipeId)
    );
    if (!reusable.length) return Object.freeze({ valid:true, requiredStars:required, checked:0, failures:Object.freeze([]), deferred:true });
    const failures = reusable.filter((input) => Number.isFinite(Number(input.stars)) && Number(input.stars) < required)
      .map((input) => Object.freeze({ itemId:input.itemId || input.definitionId || input.id || null, stars:Number(input.stars), requiredStars:required }));
    return Object.freeze({ valid:failures.length === 0, requiredStars:required, checked:reusable.length, failures:Object.freeze(failures) });
  }

  const API = Object.freeze({
    VERSION, SP_MIN, SP_MAX, DURATION_MIN_HOURS, DURATION_MAX_HOURS, DURATION_PER_PROFICIENCY_BONUS,
    FRESHNESS_MULTIPLIER, MAX_HP_STEPS, STAR_RESOURCE_SCALE, STAR_EFFECT_COUNT,
    SKILL_TARGETS, SAVE_TARGETS, VALID_TARGETS, FOCUS, PROFILE,
    normalizeId, profileIdFor, runtimeRole, restTimingFor, sleepSynergyFor, gourmetMinStarsFor, draftThFor,
    compileRecipeFunctions, compiledFunctions, get, scaleResource, nearestMaxHpStep, scaledMaxHp, effectsForStars,
    cookProficiencyBonus, durationHoursForCook, resolvePreparedFunction,
    hasExplicitKnowledgeStore, knowsRecipe, grantRecipeKnowledge, canCaterParty, checkGourmetComponents,
  });

  global.LuminousCookingV2Engine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
