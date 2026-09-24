(function (global) {
  "use strict";

  if (global.LuminousCookingRecipeResolver) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingRecipeResolver;
    return;
  }

  const VERSION = 1;

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function recipeCatalog() {
    return global.LuminousCookingRecipeCatalog || safeRequire("./item-cooking-recipe-catalog.js");
  }

  function plantCatalog() {
    return global.LuminousPlantProduceCatalog || safeRequire("./item-catalog-plant-produce.js");
  }

  function meatCatalog() {
    return global.LuminousMeatCatalog || safeRequire("./item-catalog-meat.js");
  }

  function staplesCatalog() {
    return global.LuminousCulinaryStaplesCatalog || safeRequire("./item-catalog-culinary-staples.js");
  }

  function foodCatalog() {
    return global.LuminousFoodCatalog || safeRequire("./item-catalog-food.js");
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function freezeList(values) {
    return Object.freeze([...(values || [])]);
  }

  function alias(spec = {}) {
    return Object.freeze({
      anyTags: freezeList((spec.anyTags || []).map(normalizeId).filter(Boolean)),
      anyForms: freezeList((spec.anyForms || []).map(normalizeId).filter(Boolean)),
      anyRecipeIds: freezeList((spec.anyRecipeIds || []).map(normalizeId).filter(Boolean)),
      anyDishFamilies: freezeList((spec.anyDishFamilies || []).map(normalizeId).filter(Boolean)),
      processedOnly: spec.processedOnly === true,
    });
  }

  const REQUIREMENT_ALIASES = Object.freeze({
    aromatic: alias({ anyTags:["aromatic"] }),
    avian_meat: alias({ anyTags:["avian"] }),
    baked_base: alias({ anyTags:["baked","bread","cake","pastry"], anyDishFamilies:["bread","cake","pastry","tart","pie"] }),
    batter: alias({ anyTags:["batter"], anyForms:["batter"] }),
    binder: alias({ anyTags:["binder","egg","dairy","liquid"] }),
    bread: alias({ anyTags:["bread"], anyDishFamilies:["bread"] }),
    brew_base: alias({ anyTags:["brewed"], anyForms:["brew_base"] }),
    broth_base: alias({ anyTags:["stock","broth","broth_base"], anyForms:["stock","broth"] }),
    cheese: alias({ anyTags:["cheese"], anyForms:["cheese"] }),
    coating: alias({ anyTags:["coating"], anyForms:["coating"] }),
    corn_dough: alias({ anyTags:["corn_dough"], anyForms:["corn_dough"] }),
    cream: alias({ anyTags:["cream"], anyForms:["cream"] }),
    dough: alias({ anyTags:["dough"], anyForms:["dough","corn_dough"] }),
    egg: alias({ anyTags:["egg"] }),
    fat: alias({ anyTags:["fat","oil","cream"], anyForms:["oil","cream"] }),
    filling: alias({ anyTags:["filling","meat","vegetable","protein","cheese","legume","fungus"] }),
    fish: alias({ anyTags:["fish"] }),
    flatbread: alias({ anyTags:["flatbread"], anyRecipeIds:["flatbread"] }),
    flour: alias({ anyTags:["flour"], anyForms:["flour","corn_flour"] }),
    fruit: alias({ anyTags:["fruit"] }),
    grain: alias({ anyTags:["grain"] }),
    ground_meat: alias({ anyTags:["ground_meat"], anyForms:["ground_meat"] }),
    herb: alias({ anyTags:["herb"] }),
    legume: alias({ anyTags:["legume"] }),
    low_grade_protein: alias({ anyTags:["low_grade_protein"] }),
    meat: alias({ anyTags:["meat"] }),
    meat_or_vegetable: alias({ anyTags:["meat","vegetable"] }),
    miso_paste: alias({ anyTags:["miso_paste"], anyForms:["miso_paste"] }),
    noodles: alias({ anyTags:["noodles"], anyForms:["noodles"] }),
    oil: alias({ anyTags:["oil"], anyForms:["oil"] }),
    pasta: alias({ anyTags:["pasta"], anyForms:["pasta"] }),
    processed_meat: alias({ anyTags:["processed_meat","cured","smoked","ground_meat"], anyForms:["cured","smoked","ground_meat"], processedOnly:true }),
    protein: alias({ anyTags:["protein","meat","egg","legume"] }),
    protein_or_vegetable: alias({ anyTags:["protein","meat","egg","legume","vegetable"] }),
    ration_base: alias({ anyTags:["ration_base"] }),
    rich_fruit: alias({ anyTags:["rich_fruit"] }),
    sauce_base: alias({ anyTags:["sauce_base"], anyForms:["sauce_base"] }),
    seasoning: alias({ anyTags:["seasoning","spice","herb"] }),
    seaweed: alias({ anyTags:["seaweed"] }),
    spice: alias({ anyTags:["spice"] }),
    stock: alias({ anyTags:["stock"], anyForms:["stock"] }),
    sweetener: alias({ anyTags:["sweetener","sweetener_base","syrup"], anyForms:["syrup"] }),
    vegetable: alias({ anyTags:["vegetable"] }),
    vegetable_or_meat: alias({ anyTags:["vegetable","meat"] }),
    vegetable_or_seafood: alias({ anyTags:["vegetable","aquatic","fish","crustacean","mollusk","cephalopod"] }),
    vegetable_or_meat: alias({ anyTags:["vegetable","meat"] }),
    wrapper: alias({ anyTags:["wrapper"], anyForms:["wrapper"] }),
  });

  function valuesFrom(item, key) {
    const value = item?.[key];
    if (value == null) return [];
    return (Array.isArray(value) ? value : [value]).map(normalizeId).filter(Boolean);
  }

  function catalogDefinition(item = {}) {
    const id = normalizeId(item.itemId || item.definitionId || item.id);
    if (!id) return null;
    for (const catalog of [plantCatalog(), meatCatalog(), staplesCatalog(), foodCatalog()]) {
      if (!catalog?.get) continue;
      const found = catalog.get(id);
      if (found) return found;
    }
    return null;
  }

  function enrichItem(item = {}) {
    const base = catalogDefinition(item) || {};
    return { ...clone(base), ...clone(item) };
  }

  function recipeMetadataForItem(item = {}) {
    const recipeId = normalizeId(item.recipeId || item.sourceRecipeId || item.cookingRecipeId);
    if (!recipeId) return null;
    return recipeCatalog()?.get?.(recipeId) || null;
  }

  function collectTags(rawItem = {}) {
    const item = enrichItem(rawItem);
    const tags = new Set();

    [
      "tags","itemTags","recipeRoles","flavorTags","functionalTags","craftTags",
      "reagentTags","processingTags","servingTags","techniqueTags"
    ].forEach((key) => valuesFrom(item, key).forEach((value) => tags.add(value)));

    [
      item.family,item.group,item.iconFamily,item.category,item.itemType,
      item.processedForm,item.processingMethod,item.dishFamily,item.course,
      item.cuisine
    ].map(normalizeId).filter(Boolean).forEach((value) => tags.add(value));

    const id = normalizeId(item.itemId || item.definitionId || item.id);
    if (id) tags.add(id);

    if (item.processed === true || normalizeId(item.family) === "processed_food") tags.add("processed");
    if (item.cookingReady === true) tags.add("cooking_ready");
    if (item.edibleRaw === true) tags.add("edible_raw");

    const recipe = recipeMetadataForItem(item);
    if (recipe) {
      tags.add(recipe.id);
      tags.add(recipe.dishFamily);
      tags.add(recipe.course);
      tags.add(recipe.cuisine);
      for (const tag of recipe.tags || []) tags.add(normalizeId(tag));
      if (recipe.method) tags.add(normalizeId(recipe.method));
    }

    return tags;
  }

  function itemQuantity(item = {}) {
    const value = Number(item.quantity ?? item.qty ?? item.count ?? 1);
    return Math.max(0, Number.isFinite(value) ? value : 0);
  }

  function isProcessed(item = {}) {
    return item.processed === true ||
      normalizeId(item.family) === "processed_food" ||
      Boolean(normalizeId(item.processedForm)) ||
      collectTags(item).has("processed");
  }

  function matchRequirement(requirement, rawItem) {
    const req = normalizeId(requirement?.requirement || requirement);
    if (!req || !rawItem) return Object.freeze({ matches:false, score:0, reason:"invalid" });

    const item = enrichItem(rawItem);
    const itemId = normalizeId(item.itemId || item.definitionId || item.id);
    const form = normalizeId(item.processedForm);
    const recipeId = normalizeId(item.recipeId || item.sourceRecipeId || item.cookingRecipeId);
    const recipeMeta = recipeMetadataForItem(item);
    const dishFamily = normalizeId(item.dishFamily || recipeMeta?.dishFamily);
    const tags = collectTags(item);

    if (itemId === req) return Object.freeze({ matches:true, score:1000, reason:"exact_item_id" });
    if (recipeId === req) return Object.freeze({ matches:true, score:975, reason:"exact_recipe_id" });
    if (form === req) return Object.freeze({ matches:true, score:950, reason:"exact_processed_form" });
    if (tags.has(req)) return Object.freeze({ matches:true, score:900, reason:"exact_tag" });

    const spec = REQUIREMENT_ALIASES[req];
    if (!spec) return Object.freeze({ matches:false, score:0, reason:"no_match" });
    if (spec.processedOnly && !isProcessed(item)) return Object.freeze({ matches:false, score:0, reason:"requires_processed_item" });

    if (spec.anyRecipeIds.includes(recipeId)) return Object.freeze({ matches:true, score:850, reason:"recipe_alias" });
    if (spec.anyForms.includes(form)) return Object.freeze({ matches:true, score:825, reason:"form_alias" });
    if (spec.anyDishFamilies.includes(dishFamily)) return Object.freeze({ matches:true, score:800, reason:"dish_family_alias" });
    if (spec.anyTags.some((tag) => tags.has(tag))) return Object.freeze({ matches:true, score:750, reason:"tag_alias" });

    return Object.freeze({ matches:false, score:0, reason:"no_match" });
  }

  function candidatesForRequirement(requirement, inventory = []) {
    return (Array.isArray(inventory) ? inventory : [])
      .map((item, index) => {
        const match = matchRequirement(requirement, item);
        return { index, item:enrichItem(item), ...match };
      })
      .filter((entry) => entry.matches && itemQuantity(entry.item) > 0)
      .sort((a,b) => b.score - a.score || a.index - b.index)
      .map((entry) => Object.freeze({
        index:entry.index,
        item:Object.freeze(clone(entry.item)),
        score:entry.score,
        reason:entry.reason,
        availableQuantity:itemQuantity(entry.item),
      }));
  }

  function recipeFrom(recipeOrId) {
    if (!recipeOrId) return null;
    if (typeof recipeOrId === "string") return recipeCatalog()?.get?.(recipeOrId) || null;
    return clone(recipeOrId);
  }

  function resolveRecipe(recipeOrId, inventory = [], options = {}) {
    const recipe = recipeFrom(recipeOrId);
    if (!recipe) return Object.freeze({ valid:false, reason:"unknown_recipe", recipeId:normalizeId(recipeOrId) || null });

    const items = (Array.isArray(inventory) ? inventory : []).map(enrichItem);
    const available = items.map(itemQuantity);
    const requirements = (recipe.ingredients || []).map((row, originalIndex) => {
      const candidates = candidatesForRequirement(row.requirement, items);
      return {
        originalIndex,
        row:clone(row),
        candidates,
        candidateCount:candidates.length,
      };
    });

    const ordered = [...requirements].sort((a,b) => {
      const aOptional = a.row.optional === true ? 1 : 0;
      const bOptional = b.row.optional === true ? 1 : 0;
      if (aOptional !== bOptional) return aOptional - bOptional;
      if (a.candidateCount !== b.candidateCount) return a.candidateCount - b.candidateCount;
      if (a.row.quantity !== b.row.quantity) return b.row.quantity - a.row.quantity;
      return a.originalIndex - b.originalIndex;
    });

    const assignedByIndex = new Map();
    const missing = [];

    for (const entry of ordered) {
      let remaining = Math.max(1, Math.trunc(Number(entry.row.quantity) || 1));
      const allocations = [];

      for (const candidate of entry.candidates) {
        if (remaining <= 0) break;
        const index = candidate.index;
        const take = Math.min(remaining, available[index]);
        if (take <= 0) continue;
        available[index] -= take;
        remaining -= take;
        allocations.push(Object.freeze({
          inventoryIndex:index,
          units:take,
          score:candidate.score,
          reason:candidate.reason,
          item:Object.freeze(clone(items[index])),
        }));
      }

      const fulfilled = remaining <= 0;
      assignedByIndex.set(entry.originalIndex, Object.freeze({
        requirement:entry.row.requirement,
        role:entry.row.role,
        quantity:entry.row.quantity,
        optional:entry.row.optional === true,
        fulfilled,
        missingUnits:Math.max(0,remaining),
        allocations:Object.freeze(allocations),
      }));

      if (!fulfilled && entry.row.optional !== true) {
        missing.push(Object.freeze({
          requirement:entry.row.requirement,
          role:entry.row.role,
          requiredQuantity:entry.row.quantity,
          missingUnits:Math.max(0,remaining),
          candidateCount:entry.candidateCount,
        }));
      }
    }

    const assignments = Object.freeze((recipe.ingredients || []).map((_, index) => assignedByIndex.get(index)));
    const recipeInputs = [];
    const consumption = new Map();

    for (const assignment of assignments) {
      if (!assignment?.fulfilled) continue;
      for (const allocation of assignment.allocations) {
        recipeInputs.push(Object.freeze({
          ...clone(allocation.item),
          quantity:allocation.units,
          consumedQuantity:allocation.units,
          recipeRole:assignment.role,
          role:assignment.role,
          recipeRequirement:assignment.requirement,
        }));

        const current = consumption.get(allocation.inventoryIndex) || {
          inventoryIndex:allocation.inventoryIndex,
          units:0,
          requirements:[],
          roles:[],
        };
        current.units += allocation.units;
        current.requirements.push(assignment.requirement);
        current.roles.push(assignment.role);
        consumption.set(allocation.inventoryIndex,current);
      }
    }

    const consumptionPlan = Object.freeze([...consumption.values()].map((entry) => Object.freeze({
      inventoryIndex:entry.inventoryIndex,
      units:entry.units,
      requirements:Object.freeze([...entry.requirements]),
      roles:Object.freeze([...entry.roles]),
    })));

    return Object.freeze({
      valid:missing.length === 0,
      reason:missing.length ? "missing_recipe_requirements" : null,
      recipe:Object.freeze(clone(recipe)),
      recipeId:recipe.id,
      assignments,
      missing:Object.freeze(missing),
      recipeInputs:Object.freeze(recipeInputs),
      consumptionPlan,
      remainingQuantities:Object.freeze([...available]),
      inventoryCount:items.length,
      options:Object.freeze({ preferExact:options.preferExact !== false }),
    });
  }

  function missingRequirements(recipeOrId, inventory = []) {
    return [...resolveRecipe(recipeOrId, inventory).missing];
  }

  function isCraftable(recipeOrId, inventory = []) {
    return resolveRecipe(recipeOrId, inventory).valid;
  }

  function craftableRecipes(inventory = [], options = {}) {
    const catalog = recipeCatalog();
    const recipes = catalog?.list ? catalog.list(options) : [];
    return recipes
      .map((recipe) => resolveRecipe(recipe, inventory))
      .filter((result) => result.valid)
      .map((result) => Object.freeze({
        recipeId:result.recipeId,
        recipe:Object.freeze(clone(result.recipe)),
        consumptionPlan:result.consumptionPlan,
        recipeInputs:result.recipeInputs,
      }));
  }

  function coverageForCatalog(inventory = [], options = {}) {
    const catalog = recipeCatalog();
    const recipes = catalog?.list ? catalog.list(options) : [];
    const results = recipes.map((recipe) => resolveRecipe(recipe, inventory));
    return Object.freeze({
      totalRecipes:results.length,
      craftableRecipes:results.filter((entry) => entry.valid).length,
      blockedRecipes:results.filter((entry) => !entry.valid).length,
      results:Object.freeze(results),
    });
  }

  const API = Object.freeze({
    VERSION,
    REQUIREMENT_ALIASES,
    normalizeId,
    collectTags,
    enrichItem,
    matchRequirement,
    candidatesForRequirement,
    resolveRecipe,
    missingRequirements,
    isCraftable,
    craftableRecipes,
    coverageForCatalog,
  });

  global.LuminousCookingRecipeResolver = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
