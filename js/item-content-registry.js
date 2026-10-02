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

  const SYNTHESIS_SLOT_TOOL_CATEGORIES = Object.freeze([
    "fabrication_tools",
    "chemical_tools",
    "medical_tools",
    "cooking_tools",
    "smithing_tools",
    "technical_tools",
    "textile_tools",
    "lapidary_tools",
    "repair_kit"
  ]);

  function toolDefinition(item, root) {
    const host = root || global;
    const catalog = host.LuminousToolCatalog || global.LuminousToolCatalog;
    if (!catalog || typeof catalog.get !== "function") return null;
    for (const id of itemIdentity(item)) {
      const found = catalog.get(id);
      if (found) return found;
    }
    return null;
  }

  function isSynthesisSlotUnlockTool(item, root) {
    const definition = toolDefinition(item, root);
    if (!definition) return false;
    const category = normalizeId(
      definition.toolCategory ||
      definition.iconFamily ||
      item?.toolCategory ||
      item?.iconFamily ||
      item?.icon_family
    );
    return SYNTHESIS_SLOT_TOOL_CATEGORIES.includes(category);
  }

  function toolMatchScore(requiredToolType, item, root) {
    const required = normalizeId(requiredToolType);
    if (!required || !item) return required ? 0 : 1;

    const definition = toolDefinition(item, root) || {};
    const tags = itemTags(Object.assign({}, definition, item));
    [
      definition.toolCategory,
      definition.iconFamily,
      definition.proficiencyType,
      item.toolCategory,
      item.iconFamily,
      item.icon_family
    ].map(normalizeId).filter(Boolean).forEach((value) => tags.add(value));

    if (tags.has(required)) return 1000;
    if (required.endsWith("_tools")) {
      const stem = required.replace(/_tools$/, "");
      if ([...tags].some((tag) => tag === stem || tag.startsWith(stem + "_"))) return 750;
    }
    return 0;
  }

  function requiredToolType(recipe) {
    return normalizeId(recipe && recipe.requiredToolType);
  }

  function hasRequiredTool(recipe, toolItems, root) {
    const required = requiredToolType(recipe);
    if (!required) return true;
    return (Array.isArray(toolItems) ? toolItems : [])
      .some((item) => selectedUnits(item) > 0 && toolMatchScore(required, item, root) > 0);
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

  function resolveCookingRecipe(recipe, items, root, options) {
    const host = root || global;
    const opts = options || {};
    const resolver = host.LuminousCookingRecipeResolver || global.LuminousCookingRecipeResolver;
    const cookingEngine = host.LuminousCookingEngine || global.LuminousCookingEngine;
    const equipmentEngine = host.LuminousCookingEquipmentEngine || global.LuminousCookingEquipmentEngine;
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

    if (consumedUnits !== totalSelectedUnits) {
      return Object.assign({}, result, {
        valid: false,
        reason: "extra_recipe_inputs",
        consumedUnits,
        totalSelectedUnits,
        score
      });
    }

    const cookingRuntime = host.LuminousCookingRuntime || global.LuminousCookingRuntime;
    const concreteRecipe = cookingRuntime && typeof cookingRuntime.concreteRecipe === "function"
      ? cookingRuntime.concreteRecipe(recipe, result)
      : Object.assign({}, clone(recipe), {
          ingredients: (result.recipeInputs || []).map((input) => Object.assign({}, clone(input), {
            role: normalizeId(input.recipeRole || input.role || "major")
          }))
        });

    let equipmentEvaluation = null;
    if (equipmentEngine && typeof equipmentEngine.evaluate === "function") {
      const availableToolIds = (opts.toolItems || [])
        .flatMap((item) => [...itemIdentity(item)])
        .filter(Boolean);
      equipmentEvaluation = equipmentEngine.evaluate(concreteRecipe, opts.unit || {}, {
        availableToolIds,
        availableStationIds: opts.availableStationIds || []
      });
    }

    let thBreakdown = null;
    let effectiveThBreakdown = null;
    if (cookingEngine && typeof cookingEngine.buildRecipeTh === "function") {
      try {
        thBreakdown = cookingEngine.buildRecipeTh(concreteRecipe);
        effectiveThBreakdown = typeof cookingEngine.effectiveCookingTh === "function"
          ? cookingEngine.effectiveCookingTh(thBreakdown.recipeTh, equipmentEvaluation || {})
          : { effectiveTh: thBreakdown.recipeTh };
      } catch (_) {}
    }

    const baseResult = Object.assign({}, result, {
      concreteRecipe,
      equipment: equipmentEvaluation,
      recipeTh: thBreakdown?.recipeTh ?? null,
      thBreakdown,
      effectiveTh: effectiveThBreakdown?.effectiveTh ?? thBreakdown?.recipeTh ?? null,
      effectiveThBreakdown,
      consumedUnits,
      totalSelectedUnits,
      score
    });

    if (opts.enforceEquipment === true) {
      if (!equipmentEngine || typeof equipmentEngine.evaluate !== "function") {
        return Object.assign({}, baseResult, {
          valid: false,
          reason: "cooking_equipment_engine_unavailable"
        });
      }
      if (!equipmentEvaluation.hasRequiredTool || !equipmentEvaluation.hasRequiredStation) {
        return Object.assign({}, baseResult, {
          valid: false,
          reason: "missing_cooking_equipment",
          missingToolIds: equipmentEvaluation.missingToolIds || [],
          missingStationIds: equipmentEvaluation.missingStationIds || []
        });
      }
    }

    return Object.assign({}, baseResult, { valid: true });
  }

  function resolveProcessingRecipe(recipe, items, root) {
    const host = root || global;
    const engine = host.LuminousItemProcessingEngine || global.LuminousItemProcessingEngine;
    if (!engine || typeof engine.resolveProcessingBatch !== "function") {
      return { valid: false, reason: "processing_engine_unavailable", recipe };
    }

    const selected = (items || []).map((item) => Object.assign({}, clone(item), {
      quantity: Math.max(1, selectedUnits(item) || 1)
    }));
    const result = engine.resolveProcessingBatch(selected, recipe.methodId, {
      templateId: recipe.id,
      batches: 1
    });
    if (!result?.valid) {
      return {
        valid: false,
        reason: result?.reason || "processing_recipe_not_resolved",
        recipe,
        processing: result || null
      };
    }

    const consumedUnits = (result.consumption?.allocations || [])
      .reduce((sum, row) => sum + Number(row.units || 0), 0);
    const totalSelectedUnits = selected.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return {
      valid: consumedUnits === totalSelectedUnits,
      reason: consumedUnits === totalSelectedUnits ? null : "extra_recipe_inputs",
      recipe,
      processing: result,
      processingInputs: clone(selected),
      consumedUnits,
      totalSelectedUnits,
      score: 1000 + Number(recipe.priority || 0),
      consumptionPlan: result.consumption?.allocations || []
    };
  }

  function resolveRecipe(recipe, items, root, options) {
    const opts = options || {};
    const adapted = recipe && recipe.__contentKind === "recipe"
      ? clone(recipe)
      : adaptRecipe(recipe || {}, recipe && recipe.__catalogSource || "runtime", recipe && recipe.recipeKind);
    const selected = (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((item) => Object.assign({}, clone(item), { __selectedUnits: Math.max(1, selectedUnits(item) || 1) }));

    if (!selected.length) return { valid: false, reason: "no_recipe_inputs", recipe: adapted };

    let result;
    if (adapted.recipeKind === "cooking") {
      result = resolveCookingRecipe(adapted, selected, root, opts);
    } else if (adapted.recipeKind === "processing") {
      result = resolveProcessingRecipe(adapted, selected, root);
    } else {
      const sourceInputs = selected.map((item) => Object.assign({}, clone(item), {
        id: item.id || item.definitionId || item.canonicalId || item.itemId || normalizeId(item.name || item.nombre),
        quantity: Math.max(1, selectedUnits(item) || 1)
      }));
      result = Object.assign(
        { recipe: adapted, sourceInputs },
        allocateRequirements(adapted.inputRequirements || [], selected)
      );
    }

    if (result && result.valid && opts.enforceTools === true && !hasRequiredTool(adapted, opts.toolItems || [], root)) {
      return Object.assign({}, result, {
        valid: false,
        reason: "missing_required_tool",
        requiredToolType: requiredToolType(adapted)
      });
    }
    return result;
  }

  function recipeRuntimeReady(recipe) {
    const kind = normalizeId(recipe && recipe.recipeKind);
    if (kind !== "throwable") return true;
    if (recipe && recipe.runtimeEffectImplemented === false) return false;
    if (normalizeId(recipe && recipe.combatContractStatus) === "deferred") return false;
    return true;
  }

  function findMatchingRecipes(root, items, options) {
    const opts = options || {};
    return Object.values(collectRecipeMap(root || global))
      .filter((recipe) => opts.includeDeferred === true || recipeRuntimeReady(recipe))
      .map((recipe) => {
        const resolution = resolveRecipe(recipe, items, root, opts);
        return {
          recipe,
          recipeKey: recipe.__catalogKey || recipe.id,
          resolution,
          score: Number(resolution && resolution.score || 0)
        };
      })
      .filter((entry) => entry.resolution && entry.resolution.valid)
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.recipe.priority || 0) - Number(a.recipe.priority || 0) ||
        clean(a.recipe.id).localeCompare(clean(b.recipe.id))
      );
  }

  function findMatchingRecipe(root, items, options) {
    const opts = options || {};
    const matches = findMatchingRecipes(root, items, opts);
    const preferred = normalizeId(opts.recipeId || opts.recipeKey);
    if (preferred) {
      return matches.find((entry) =>
        normalizeId(entry.recipeKey) === preferred ||
        normalizeId(entry.recipe.id) === preferred
      ) || null;
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function qualityTierFor(value) {
    const engine = global.LuminousItemQualityEngine;
    const canonical = engine?.canonicalQualityId
      ? engine.canonicalQualityId(value || "standard")
      : normalizeId(value || "standard");
    const order = Array.isArray(engine?.QUALITY_ORDER)
      ? engine.QUALITY_ORDER
      : ["ruined", "poor", "standard", "fine", "exceptional"];
    const index = order.indexOf(canonical);
    return index >= 0 ? index + 1 : 3;
  }

  function recipeDifficulty(recipe, resolution) {
    const kind = normalizeId(recipe && recipe.recipeKind);
    const effectiveCooking = Number(resolution && resolution.effectiveTh);
    if (kind === "cooking" && Number.isFinite(effectiveCooking) && effectiveCooking >= 0) {
      return Math.round(effectiveCooking);
    }

    if (kind === "processing") {
      const engine = global.LuminousItemProcessingEngine;
      const methodId = normalizeId(recipe && recipe.methodId);
      const methodTh = Number(engine?.METHODS?.[methodId]?.baseTh);
      if (Number.isFinite(methodTh) && methodTh >= 0) return Math.round(methodTh);
    }

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

    if (recipeKind === "cooking") {
      const resolution = opts.resolution || {};
      const cookingEngine = global.LuminousCookingEngine;
      const cookingRuntime = global.LuminousCookingRuntime;
      const recipeCatalog = global.LuminousCookingRecipeCatalog;
      if (!resolution.concreteRecipe || !cookingEngine?.resolvePreparedItem || !cookingRuntime?.finishedFoodItem) {
        return null;
      }

      const prepared = cookingEngine.resolvePreparedItem(
        resolution.concreteRecipe,
        Number(opts.checkResult) || 0,
        { equipment: resolution.equipment || {} }
      );
      const pricing = recipeCatalog?.resolveReferencePricing
        ? recipeCatalog.resolveReferencePricing(raw, resolution.concreteRecipe.ingredients || [], {
            stars: prepared.stars,
            venue: raw.defaultVenue
          })
        : null;
      const finished = cookingRuntime.finishedFoodItem(raw, prepared, pricing, {
        createdAt: opts.createdAt,
        instanceId: opts.instanceId
      });
      return Object.assign({}, clone(finished), {
        canonicalId: finished.definitionId || finished.itemId || finished.id,
        nombre: finished.name || finished.displayName,
        cantidad: Number(finished.quantity || 1),
        crafted: true,
        sourceRecipeId: normalizeId(raw.id || raw.recipeId || finished.recipeId)
      });
    }

    if (recipeKind === "processing") {
      const resolution = opts.resolution || {};
      const processingEngine = global.LuminousItemProcessingEngine;
      if (!processingEngine?.createProcessedItem || !Array.isArray(resolution.processingInputs)) {
        return null;
      }
      const processed = processingEngine.createProcessedItem(
        resolution.processingInputs,
        raw.methodId,
        {
          templateId: raw.id,
          batches: 1,
          quality: opts.quality
        }
      );
      if (!processed?.created) return null;
      return Object.assign({}, clone(processed), {
        definitionId: processed.itemId || processed.id,
        canonicalId: processed.itemId || processed.id,
        nombre: processed.name || processed.displayName,
        cantidad: Number(processed.quantity || 1),
        qualityTier: qualityTierFor(processed.quality),
        crafted: true,
        recipeId: normalizeId(raw.id || raw.recipeId || processed.processingTemplateId),
        sourceRecipeId: normalizeId(raw.id || raw.recipeId || processed.processingTemplateId),
        craft: {
          threshold: recipeDifficulty(raw, resolution),
          recipeKind,
          canonical: true
        }
      });
    }


    if (recipeKind === "chemistry" || recipeKind === "medicine") {
      const resolution = opts.resolution || {};
      const sourceInputs = Array.isArray(resolution.sourceInputs) ? resolution.sourceInputs : [];
      const engine = recipeKind === "chemistry"
        ? global.LuminousChemistryCraftingEngine
        : global.LuminousMedicineCraftingEngine;
      if (!engine?.craft || !sourceInputs.length) return null;

      const crafted = engine.craft(raw.id || raw.recipeId, sourceInputs, {
        checkTotal: Number(opts.checkResult),
        outputQuantity: opts.quantity
      });
      if (!crafted?.crafted || !crafted.output) return null;

      const output = clone(crafted.output);
      return Object.assign({}, output, {
        id: output.id || normalizeId(raw.id || raw.recipeId),
        definitionId: output.definitionId || output.id || normalizeId(raw.id || raw.recipeId),
        canonicalId: output.canonicalId || output.definitionId || output.id || normalizeId(raw.id || raw.recipeId),
        nombre: output.name || output.nombre || raw.name || raw.label,
        quantity: Math.max(1, Number(output.quantity || 1)),
        cantidad: Math.max(1, Number(output.quantity || 1)),
        qualityTier: qualityTierFor(output.quality),
        crafted: true,
        recipeId: normalizeId(raw.id || raw.recipeId),
        sourceRecipeId: normalizeId(raw.id || raw.recipeId),
        consumedInputProductionValueAhn: crafted.consumedInputProductionValueAhn,
        craftBaseValueAhn: crafted.craftBaseValueAhn,
        productionValueAhn: crafted.productionValueAhn ?? output.productionValueAhn,
        craft: Object.assign({}, output.craft || {}, {
          recipeKind,
          canonical: true
        })
      });
    }
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
      category = "food";
      itemType = "consumable";
      family = "food";
      tags.push("food");
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
      hungerSlotsRestored: recipeKind === "cooking"
        ? Math.max(0, Math.trunc(Number(raw.hungerSlotsRestored ?? raw.hungerRestore ?? 1) || 0))
        : undefined,
      hydrationSlotsRestored: recipeKind === "cooking"
        ? Math.max(0, Math.trunc(Number(raw.hydrationSlotsRestored ?? raw.hydrationRestore ?? 0) || 0))
        : undefined,
      dishFamily: raw.dishFamily,
      processedForm: raw.outputForm || undefined,
      processingMethod: raw.methodId || raw.method || undefined,
      craft: {
        threshold: recipeDifficulty(raw, opts.resolution),
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
    SYNTHESIS_SLOT_TOOL_CATEGORIES,
    isSynthesisSlotUnlockTool,
    toolMatchScore,
    requiredToolType,
    hasRequiredTool,
    requirementMatchScore,
    resolveRecipe,
    recipeRuntimeReady,
    findMatchingRecipes,
    findMatchingRecipe,
    qualityTierFor,
    recipeDifficulty,
    createRecipeOutput,
    appendFirebaseAugmentations,
    build
  });

  global.LuminousItemContentRegistry = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
