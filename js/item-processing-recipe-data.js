(function (global) {
  "use strict";

  if (global.LuminousItemProcessingRecipeData) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemProcessingRecipeData;
    return;
  }

  const VERSION = 1;

  function freezeList(values) {
    return Object.freeze([...(values || [])]);
  }

  function selector(spec = {}) {
    return Object.freeze({
      anyTags: freezeList(spec.anyTags || []),
      anyForms: freezeList(spec.anyForms || []),
      excludeTags: freezeList(spec.excludeTags || []),
      excludeForms: freezeList(spec.excludeForms || []),
      methodEligible: spec.methodEligible || null,
    });
  }

  function requirement(spec = {}) {
    return Object.freeze({
      id: spec.id || "input",
      units: Math.max(1, Math.trunc(Number(spec.units) || 1)),
      selector: selector(spec.selector || {}),
    });
  }

  function plan(spec = {}) {
    return Object.freeze({
      kind: spec.kind || "requirements",
      minDistinct: Math.max(0, Math.trunc(Number(spec.minDistinct) || 0)),
      unitsEach: Math.max(1, Math.trunc(Number(spec.unitsEach) || 1)),
      requirements: Object.freeze((spec.requirements || []).map(requirement)),
    });
  }

  function template(spec) {
    const multiplier = Number(spec.productionMultiplier);
    const tasteDelta = Number(spec.tasteDelta);
    return Object.freeze({
      id: spec.id,
      methodId: spec.methodId,
      priority: Math.trunc(Number(spec.priority) || 0),
      outputUnits: Math.max(1, Math.trunc(Number(spec.outputUnits) || 1)),
      tasteDelta: Number.isFinite(tasteDelta) ? tasteDelta : 0,
      productionMultiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
      outputId: spec.outputId || null,
      outputForm: spec.outputForm || null,
      inputPlan: plan(spec.inputPlan || {}),
      notes: spec.notes || null,
    });
  }

  const TEMPLATES = Object.freeze([
    template({ id: "cut", methodId: "cut", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.00,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "chop", methodId: "chop", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.00,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "crush", methodId: "crush", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.00,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "simple_mix", methodId: "simple_mix", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.05,
      inputPlan: { kind: "all_distinct", minDistinct: 2, unitsEach: 1 } }),

    template({ id: "flour", methodId: "grind", priority: 100, outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.10,
      outputId: "processed_flour", outputForm: "flour",
      inputPlan: { requirements: [{ id: "flour_source", units: 2, selector: { anyTags: ["flour_source"] } }] } }),
    template({ id: "paste_grind", methodId: "grind", priority: 90, outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.10,
      outputId: "processed_paste", outputForm: "paste",
      inputPlan: { requirements: [{ id: "paste_source", units: 2, selector: { anyTags: ["paste_source"] } }] } }),
    template({ id: "grind_simple", methodId: "grind", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.05,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),

    template({ id: "paste_mash", methodId: "mash", priority: 100, outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.10,
      outputId: "processed_paste", outputForm: "paste",
      inputPlan: { requirements: [{ id: "paste_source", units: 2, selector: { anyTags: ["paste_source"] } }] } }),
    template({ id: "mash", methodId: "mash", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.05,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),

    template({ id: "juice", methodId: "juice", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.10,
      inputPlan: { requirements: [{ id: "juicy_source", units: 2, selector: { anyTags: ["juice", "juicy", "refreshing", "citrus"] } }] } }),
    template({ id: "oil", methodId: "press", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.15,
      outputId: "processed_oil", outputForm: "oil",
      inputPlan: { requirements: [{ id: "oil_source", units: 3, selector: { anyTags: ["oil_source"] } }] } }),

    template({ id: "boil", methodId: "boil", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.10,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "blanch", methodId: "blanch", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.05,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "grill", methodId: "grill", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.10,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "pan_fry", methodId: "pan_fry", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.10,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "steam", methodId: "steam", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.10,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),
    template({ id: "roast", methodId: "roast", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.10,
      inputPlan: { requirements: [{ id: "source", units: 1 }] } }),

    template({ id: "dough", methodId: "knead", outputUnits: 2, tasteDelta: 0, productionMultiplier: 1.15,
      outputId: "processed_dough", outputForm: "dough",
      inputPlan: { requirements: [
        { id: "flour", units: 2, selector: { anyTags: ["flour"], anyForms: ["flour"] } },
        { id: "binder", units: 1, selector: { anyTags: ["liquid", "binder", "water"], anyForms: ["juice", "brew_base"] } }
      ] } }),

    template({ id: "stock", methodId: "simmer", priority: 100, outputUnits: 2, tasteDelta: 1, productionMultiplier: 1.15,
      outputId: "processed_stock", outputForm: "stock",
      inputPlan: { requirements: [
        { id: "protein", units: 1, selector: { anyTags: ["meat", "protein"] } },
        { id: "vegetable_aromatic", units: 2, selector: { anyTags: ["vegetable", "aromatic", "root"] } }
      ] } }),
    template({ id: "sauce_base", methodId: "simmer", priority: 90, outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.15,
      outputId: "processed_sauce_base", outputForm: "sauce_base",
      inputPlan: { requirements: [{ id: "sauce_inputs", units: 2, selector: { anyTags: ["sauce", "sauce_base"] } }] } }),

    template({ id: "syrup", methodId: "reduce", priority: 100, outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.20,
      outputId: "processed_syrup", outputForm: "syrup",
      inputPlan: { requirements: [{ id: "sweet_liquid", units: 2, selector: { anyTags: ["sap", "sweetener_base", "sweet"], anyForms: ["juice"] } }] } }),
    template({ id: "sauce_reduce", methodId: "reduce", priority: 90, outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.20,
      outputId: "processed_sauce_base", outputForm: "sauce_base",
      inputPlan: { requirements: [{ id: "sauce_base", units: 2, selector: { anyTags: ["sauce", "sauce_base"], anyForms: ["sauce_base"] } }] } }),

    template({ id: "stir_fry", methodId: "stir_fry", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.15,
      inputPlan: { kind: "all_distinct", minDistinct: 2, unitsEach: 1 } }),
    template({ id: "bake", methodId: "bake", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.15,
      inputPlan: { requirements: [{ id: "prepared_input", units: 1 }] } }),
    template({ id: "deep_fry", methodId: "deep_fry", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.15,
      inputPlan: { requirements: [
        { id: "primary", units: 1, selector: { excludeTags: ["oil"], excludeForms: ["oil"] } },
        { id: "oil", units: 1, selector: { anyTags: ["oil"], anyForms: ["oil"] } }
      ] },
      notes: "Oil is a real consumed input; it is not hidden in the process multiplier." }),

    template({ id: "smoke", methodId: "smoke", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.20,
      inputPlan: { requirements: [{ id: "source", units: 2 }] } }),
    template({ id: "cure", methodId: "cure", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.20,
      inputPlan: { requirements: [{ id: "source", units: 2 }] } }),
    template({ id: "pickle", methodId: "pickle", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.15,
      inputPlan: { requirements: [{ id: "source", units: 2 }] } }),
    template({ id: "dry", methodId: "dry", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.15,
      inputPlan: { requirements: [{ id: "source", units: 2 }] } }),

    template({ id: "ferment_base", methodId: "ferment", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.25,
      outputId: "processed_ferment_base", outputForm: "ferment_base",
      inputPlan: { requirements: [{ id: "fermentable", units: 2, selector: { anyTags: ["fermentable", "fermentation", "culture"] } }] } }),
    template({ id: "brew_base", methodId: "brew", outputUnits: 1, tasteDelta: 1, productionMultiplier: 1.20,
      outputId: "processed_brew_base", outputForm: "brew_base",
      inputPlan: { requirements: [{ id: "brew_inputs", units: 2, selector: { methodEligible: "brew" } }] } }),
    template({ id: "distillate", methodId: "distill", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.35,
      outputId: "processed_distillate", outputForm: "distillate",
      inputPlan: { requirements: [{ id: "distillable_base", units: 2, selector: { anyForms: ["ferment_base", "brew_base"] } }] } }),
    template({ id: "culinary_extract", methodId: "delicate_extract", outputUnits: 1, tasteDelta: 0, productionMultiplier: 1.35,
      outputId: "processed_culinary_extract", outputForm: "culinary_extract",
      inputPlan: { requirements: [{ id: "extract_source", units: 2, selector: { anyTags: ["medicinal", "medicinal_herb", "exotic", "special_ingredient", "advanced_reagent"] } }] } }),
  ]);

  const BY_METHOD = Object.freeze(TEMPLATES.reduce((map, entry) => {
    if (!map[entry.methodId]) map[entry.methodId] = [];
    map[entry.methodId].push(entry);
    map[entry.methodId].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    return map;
  }, {}));

  function listForMethod(methodId) {
    return [...(BY_METHOD[String(methodId || "").trim().toLowerCase()] || [])];
  }

  function get(id) {
    return TEMPLATES.find((entry) => entry.id === String(id || "").trim().toLowerCase()) || null;
  }

  const API = Object.freeze({
    VERSION,
    TEMPLATES,
    BY_METHOD,
    get,
    listForMethod,
  });

  global.LuminousItemProcessingRecipeData = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
