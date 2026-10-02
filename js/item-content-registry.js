(function (global) {
  "use strict";

  if (global.LuminousItemContentRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemContentRegistry;
    return;
  }

  const VERSION = 2;
  const RECIPE_SOURCES = Object.freeze([
    Object.freeze({ globalName: "LuminousChemistryRecipeCatalog", fields: Object.freeze(["RECIPES"]), kind: "chemistry" }),
    Object.freeze({ globalName: "LuminousCookingRecipeCatalog", fields: Object.freeze(["RECIPES"]), kind: "cooking" }),
    Object.freeze({ globalName: "LuminousMedicineRecipeCatalog", fields: Object.freeze(["RECIPES"]), kind: "medicine" }),
    Object.freeze({ globalName: "LuminousThrowableRecipeCatalog", fields: Object.freeze(["RECIPES"]), kind: "throwable" }),
    Object.freeze({ globalName: "LuminousItemProcessingRecipeData", fields: Object.freeze(["TEMPLATES"]), kind: "processing" })
  ]);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value == null ? "" : value).trim();

  function core(root) {
    return (root || global).LuminousDmItemCatalogCore || global.LuminousDmItemCatalogCore || null;
  }

  function normalizeId(value) {
    const itemCore = core(global);
    if (itemCore && typeof itemCore.normalizeId === "function") return itemCore.normalizeId(value);
    return clean(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function recipeRows(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((row) => row && typeof row === "object");
    if (typeof value === "object") {
      return Object.entries(value)
        .filter(([, row]) => row && typeof row === "object")
        .map(([key, row]) => Object.assign({ id: row.id || key }, clone(row)));
    }
    return [];
  }

  function adaptRecipe(recipe, source, recipeKind) {
    const raw = clone(recipe) || {};
    const id = normalizeId(raw.id || raw.recipeId || raw.templateId || raw.outputId || raw.name || raw.label);
    const name = clean(raw.name || raw.label || raw.displayName || id) || id;
    return Object.assign({}, raw, {
      id,
      recipeId: raw.recipeId || id,
      name,
      label: raw.label || name,
      recipeKind: recipeKind || normalizeId(raw.family || "recipe"),
      __contentKind: "recipe",
      __catalogSource: source
    });
  }

  function collectRecipeMap(root) {
    const host = root || global;
    const buckets = new Map();

    RECIPE_SOURCES.forEach((sourceDef) => {
      const api = host[sourceDef.globalName];
      if (!api) return;
      sourceDef.fields.forEach((field) => {
        recipeRows(api[field]).forEach((row) => {
          const adapted = adaptRecipe(row, sourceDef.globalName, sourceDef.kind);
          if (!adapted.id) return;
          const bucket = buckets.get(adapted.id) || [];
          bucket.push(adapted);
          buckets.set(adapted.id, bucket);
        });
      });
    });

    const out = {};
    buckets.forEach((rows, id) => {
      if (rows.length === 1) {
        out[id] = Object.assign({}, rows[0], { __catalogKey: id });
        return;
      }
      rows.forEach((row, index) => {
        const sourceKey = normalizeId(row.__catalogSource.replace(/^Luminous/, "").replace(/Catalog$|Data$/g, ""));
        let key = sourceKey + "__" + id;
        let suffix = 2;
        while (out[key]) {
          key = sourceKey + "__" + id + "__" + suffix;
          suffix += 1;
        }
        out[key] = Object.assign({}, row, {
          __catalogKey: key,
          __canonicalCollisionId: id,
          __canonicalCollisionIndex: index
        });
      });
    });
    return out;
  }

  function valueList(value) {
    return (Array.isArray(value) ? value : value == null ? [] : [value])
      .map(normalizeId)
      .filter(Boolean);
  }

  function itemIdentity(item) {
    const ids = new Set();
    [
      item && item.definitionId,
      item && item.canonicalId,
      item && item.itemId,
      item && item.id,
      item && item.key,
      item && item.nombre,
      item && item.name,
      item && item.label
    ].map(normalizeId).filter(Boolean).forEach((value) => ids.add(value));
    return ids;
  }

  function itemTags(item) {
    const tags = new Set(itemIdentity(item));
    [
      "tags", "itemTags", "useTags", "recipeRoles", "flavorTags", "functionalTags",
      "craftTags", "reagentTags", "materialTags", "processingTags", "servingTags"
    ].forEach((key) => valueList(item && item[key]).forEach((value) => tags.add(value)));

    [
      item && item.family,
      item && item.group,
      item && item.category,
      item && item.tipo_categoria,
      item && item.itemType,
      item && item.item_type,
      item && item.iconFamily,
      item && item.icon_family,
      item && item.processedForm,
      item && item.outputForm,
      item && item.processingMethod,
      item && item.dishFamily
    ].map(normalizeId).filter(Boolean).forEach((value) => tags.add(value));
    return tags;
  }

  function selectedUnits(item) {
    const raw = Number(item && (item.__selectedUnits ?? item.selectedUnits ?? item.quantity ?? item.cantidad ?? 1));
    return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  }

  function requirementMatchScore(requirement, item) {
    const ids = itemIdentity(item);
    const tags = itemTags(item);
    const anyIds = valueList(requirement && requirement.anyIds);
    const anyTags = valueList(requirement && requirement.anyTags);
    const allTags = valueList(requirement && requirement.allTags);
    const anyForms = valueList(requirement && (requirement.anyForms || requirement.forms));
    const form = normalizeId(item && (item.processedForm || item.outputForm));

    if (anyIds.length && !anyIds.some((id) => ids.has(id))) return 0;
    if (anyTags.length && !anyTags.some((tag) => tags.has(tag))) return 0;
    if (allTags.length && !allTags.every((tag) => tags.has(tag))) return 0;
    if (anyForms.length && !anyForms.includes(form) && !anyForms.some((value) => tags.has(value))) return 0;

    let score = 100;
    if (anyIds.some((id) => ids.has(id))) score += 900;
    if (anyTags.some((tag) => tags.has(tag))) score += 650;
    if (allTags.length && allTags.every((tag) => tags.has(tag))) score += 500;
    if (anyForms.length && (anyForms.includes(form) || anyForms.some((value) => tags.has(value)))) score += 550;
    return score;
  }

  function allocateRequirements(requirements, items) {
    const available = items.map(selectedUnits);
    const plan = [];
    let score = 0;

    for (const rawRequirement of requirements || []) {
      const quantity = Math.max(1, Math.trunc(Number(rawRequirement.quantity ?? rawRequirement.units ?? 1) || 1));
      const selector = rawRequirement.selector || {};
      const requirement = {
        anyIds: rawRequirement.anyIds || selector.anyIds || [],
        anyTags: rawRequirement.anyTags || selector.anyTags || [],
        allTags: rawRequirement.allTags || selector.allTags || [],
        anyForms: rawRequirement.anyForms || selector.anyForms || []
      };
      const isGeneric = !valueList(requirement.anyIds).length &&
        !valueList(requirement.anyTags).length &&
        !valueList(requirement.allTags).length &&
        !valueList(requirement.anyForms).length;

      let remaining = quantity;
      const allocations = [];
      const candidates = items
        .map((item, index) => ({
          index,
          matchScore: isGeneric ? 25 : requirementMatchScore(requirement, item)
        }))
        .filter((entry) => entry.matchScore > 0 && available[entry.index] > 0)
        .sort((a, b) => b.matchScore - a.matchScore || a.index - b.index);

      for (const candidate of candidates) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, available[candidate.index]);
        if (take <= 0) continue;
        available[candidate.index] -= take;
        remaining -= take;
        score += candidate.matchScore * take;
        allocations.push({
          inventoryIndex: candidate.index,
          units: take,
          score: candidate.matchScore
        });
      }

      if (remaining > 0) {
        return {
          valid: false,
          reason: "missing_recipe_requirements",
          missing: quantity - (quantity - remaining),
          consumptionPlan: plan,
          score
        };
      }
      plan.push({
        requirement: rawRequirement.id || null,
        units: quantity,
        allocations
      });
    }

    const consumedUnits = plan.reduce((sum, row) =>
      sum + row.allocations.reduce((rowSum, allocation) => rowSum + allocation.units, 0), 0);
    const totalSelectedUnits = items.reduce((sum, item) => sum + selectedUnits(item), 0);

    return {
      valid: consumedUnits === totalSelectedUnits,
      reason: consumedUnits === totalSelectedUnits ? null : "extra_recipe_inputs",
      consumptionPlan: plan,
      consumedUnits,
      totalSelectedUnits,
      score
    };
  }

  function resolveCookingRecipe(recipe, items, root) {
    const host = root || global;
    const resolver = host.LuminousCookingRecipeResolver || global.LuminousCookingRecipeResolver;
    if (!resolver || typeof resolver.resolveRecipe !== "function") {
      return { valid: false, reason: "cooking_recipe_resolver_unavailable", recipe };
    }
    const selected = items.map((item) => Object.assign({}, clone(item), { quantity: selectedUnits(item) }));
    const result = resolver.resolveRecipe(recipe, selected);
    if (!result || !result.valid) return Object.assign({ recipe }, result || { valid: false, reason: "recipe_not_resolved" });

    const consumedUnits = (result.consumptionPlan || []).reduce((sum, row) => sum + Number(row.units || 0), 0);
    const totalSelectedUnits = selected.reduce((sum, item) => sum + selectedUnits(item), 0);
    const score = (result.assignments || []).reduce((sum, assignment) =>
      sum + (assignment && assignment.allocations || []).reduce((rowSum, allocation) =>
        rowSum + Number(allocation.score || 0) * Number(allocation.units || 0), 0), 0);

    return Object.assign({}, result, {
      valid: consumedUnits === totalSelectedUnits,
      reason: consumedUnits === totalSelectedUnits ? null : "extra_recipe_inputs",
      consumedUnits,
      totalSelectedUnits,
      score
    });
  }

  function resolveProcessingRecipe(recipe, items) {
    if (!recipe.outputId) {
      return { valid: false, reason: "processing_recipe_requires_runtime_context", recipe };
    }
    const plan = recipe.inputPlan || {};
    if (plan.kind === "all_distinct") {
      const ids = new Set(items.map((item) => [...itemIdentity(item)][0]).filter(Boolean));
      const minimum = Math.max(2, Math.trunc(Number(plan.minDistinct || 2)));
      const valid = items.length >= minimum && ids.size >= minimum;
      return {
        valid,
        reason: valid ? null : "missing_distinct_inputs",
        recipe,
        consumedUnits: valid ? items.length : 0,
        totalSelectedUnits: items.length,
        score: valid ? 50 + Number(recipe.priority || 0) : 0,
        consumptionPlan: valid ? items.map((item, index) => ({ inventoryIndex: index, units: selectedUnits(item) })) : []
      };
    }
    const result = allocateRequirements(plan.requirements || [], items);
    return Object.assign({ recipe }, result, {
      score: Number(result.score || 0) + Number(recipe.priority || 0)
    });
  }

  function resolveRecipe(recipe, items, root) {
    const adapted = recipe && recipe.__contentKind === "recipe"
      ? clone(recipe)
      : adaptRecipe(recipe || {}, recipe && recipe.__catalogSource || "runtime", recipe && recipe.recipeKind);
    const selected = (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((item) => Object.assign({}, clone(item), { __selectedUnits: Math.max(1, selectedUnits(item) || 1) }));

    if (!selected.length) return { valid: false, reason: "no_recipe_inputs", recipe: adapted };

    if (adapted.recipeKind === "cooking") {
      return resolveCookingRecipe(adapted, selected, root);
    }
    if (adapted.recipeKind === "processing") {
      return resolveProcessingRecipe(adapted, selected);
    }
    return Object.assign({ recipe: adapted }, allocateRequirements(adapted.inputRequirements || [], selected));
  }

  function findMatchingRecipe(root, items) {
    const recipes = Object.values(collectRecipeMap(root || global));
    const matches = recipes
      .map((recipe) => {
        const resolution = resolveRecipe(recipe, items, root);
        return { recipe, resolution, score: Number(resolution && resolution.score || 0) };
      })
      .filter((entry) => entry.resolution && entry.resolution.valid)
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.recipe.priority || 0) - Number(a.recipe.priority || 0) ||
        clean(a.recipe.id).localeCompare(clean(b.recipe.id))
      );
    return matches[0] || null;
  }

  function recipeDifficulty(recipe) {
    const direct = Number(recipe && (recipe.baseThreshold ?? recipe.dificultad_base));
    if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);
    const labor = normalizeId(recipe && recipe.laborClass);
    if (labor === "corp" || labor === "corp_wing") return 28;
    if (labor === "complex" || labor === "elaborate" || labor === "workshop") return 22;
    return 18;
  }

  function createRecipeOutput(recipe, options) {
    const opts = options || {};
    const raw = clone(recipe) || {};
    const recipeKind = normalizeId(raw.recipeKind || "recipe");
    const id = normalizeId(raw.outputId || raw.id || raw.recipeId || raw.name || raw.label);
    const name = clean(raw.outputName || raw.name || raw.label || raw.outputForm || id) || id;
    const quantity = Math.max(1, Math.trunc(Number(opts.quantity ?? raw.outputUnits ?? 1) || 1));
    const tags = Array.from(new Set([
      ...valueList(raw.tags),
      recipeKind,
      "crafted_item"
    ]));

    let category = "utility";
    let itemType = recipeKind;
    let family = recipeKind + "_crafted";
    if (recipeKind === "cooking") {
      category = "consumable";
      itemType = "food";
      family = "prepared_food";
    } else if (recipeKind === "medicine") {
      category = "consumable";
      itemType = "consumable";
      family = "medicine_crafted";
    } else if (recipeKind === "throwable") {
      category = "consumable";
      itemType = "throwable";
      family = "throwables";
    } else if (recipeKind === "processing") {
      category = "material";
      itemType = "ingredient";
      family = "processed_material";
    } else if (recipeKind === "chemistry") {
      category = "utility";
      itemType = "chemical_product";
      family = "chemical_product";
    }

    return {
      id,
      definitionId: id,
      canonicalId: id,
      name,
      nombre: name,
      family,
      category,
      tipo_categoria: category,
      itemType,
      iconFamily: normalizeId(raw.iconFamily || raw.outputIconFamily || raw.outputForm || id),
      tags,
      stackable: true,
      crafted: true,
      recipeId: normalizeId(raw.id || raw.recipeId || id),
      sourceRecipeId: normalizeId(raw.id || raw.recipeId || id),
      quantity,
      cantidad: quantity,
      hungerRestore: raw.hungerRestore,
      hydrationRestore: raw.hydrationRestore,
      dishFamily: raw.dishFamily,
      processedForm: raw.outputForm || undefined,
      processingMethod: raw.methodId || raw.method || undefined,
      craft: {
        threshold: recipeDifficulty(raw),
        recipeKind,
        canonical: true
      }
    };
  }

  function appendFirebaseAugmentations(items, firebaseAugmentations, options) {
    const itemCore = core(global);
    if (!itemCore) return Object.assign({}, items || {});
    const out = Object.assign({}, items || {});
    const iconRegistry = options && options.iconRegistry || global.LuminousItemIconRegistry;

    Object.entries(firebaseAugmentations || {}).forEach(([firebaseKey, row]) => {
      if (!row || typeof row !== "object") return;
      const definitionId = itemCore.definitionIdOf(row, firebaseKey);
      const adapted = itemCore.adaptDefinition(Object.assign({}, row, {
        id: row.id || definitionId,
        definitionId: row.definitionId || definitionId,
        category: row.category || row.tipo_categoria || "augmentation",
        tipo_categoria: row.tipo_categoria || row.category || "augmentation"
      }), {
        fallbackId: definitionId,
        source: "firebase_augmentation",
        iconRegistry
      });
      let catalogKey = "firebase_augmentation__" + definitionId;
      let suffix = 2;
      while (out[catalogKey]) {
        catalogKey = "firebase_augmentation__" + definitionId + "__" + suffix;
        suffix += 1;
      }
      out[catalogKey] = Object.assign({}, adapted, {
        __catalogKey: catalogKey,
        __catalogSource: "firebase_augmentation",
        __firebasePath: "campaña/base_datos_aumentos",
        __firebaseKey: firebaseKey
      });
    });
    return out;
  }

  function build(root, options) {
    const host = root || global;
    const opts = options || {};
    const itemCore = core(host);
    const recipes = collectRecipeMap(host);
    if (!itemCore) {
      return Object.freeze({
        items: Object.freeze({}),
        recipes: Object.freeze(recipes),
        counts: Object.freeze({ items: 0, recipes: Object.keys(recipes).length }),
        ready: false,
        reason: "dm_item_catalog_core_unavailable"
      });
    }

    const canonicalItems = itemCore.collectCatalogMap(host, opts);
    let items = itemCore.mergeFirebaseItems(canonicalItems, opts.firebaseItems || {}, opts);
    Object.entries(items).forEach(([key, row]) => {
      if (row && row.__catalogSource === "firebase") {
        row.__firebasePath = "campaña/base_datos_items";
        row.__firebaseKey = key;
      }
    });
    items = appendFirebaseAugmentations(items, opts.firebaseAugmentations || {}, opts);

    return Object.freeze({
      items: Object.freeze(items),
      recipes: Object.freeze(recipes),
      counts: Object.freeze({
        items: Object.keys(items).length,
        recipes: Object.keys(recipes).length
      }),
      ready: true,
      version: VERSION
    });
  }

  const API = Object.freeze({
    VERSION,
    RECIPE_SOURCES,
    collectRecipeMap,
    itemIdentity,
    itemTags,
    requirementMatchScore,
    resolveRecipe,
    findMatchingRecipe,
    recipeDifficulty,
    createRecipeOutput,
    appendFirebaseAugmentations,
    build
  });

  global.LuminousItemContentRegistry = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
