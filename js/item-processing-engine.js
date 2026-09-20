(function (global) {
  "use strict";

  if (global.LuminousItemProcessingEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemProcessingEngine;
    return;
  }

  const VERSION = 1;
  const PROCESSED_FAMILY = "processed_food";
  const DEFAULT_STACK_POLICY = "identical_processed_form_quality_affinity_provenance";

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function cookingEngine() {
    return global.LuminousCookingEngine || safeRequire("./item-cooking-engine.js");
  }

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function freezeList(values) {
    return Object.freeze([...(values || [])]);
  }

  function method(spec) {
    return Object.freeze({
      inputMode: "single",
      outputMode: "procedural",
      stabilizationHint: 0,
      usuallyFinal: false,
      ...spec,
      tags: freezeList(spec.tags || []),
    });
  }

  const METHODS = Object.freeze({
    cut: method({
      id: "cut", label: "Cut / Slice", cookingMethod: "cut", baseTh: 8,
      outputForm: "sliced", namePrefix: "Sliced", tags: ["prep", "knife"],
    }),
    chop: method({
      id: "chop", label: "Chop / Dice", cookingMethod: "cut", baseTh: 8,
      outputForm: "chopped", namePrefix: "Chopped", tags: ["prep", "knife"],
    }),
    crush: method({
      id: "crush", label: "Crush", cookingMethod: "cut", baseTh: 8,
      outputForm: "crushed", namePrefix: "Crushed", tags: ["prep"],
    }),
    simple_mix: method({
      id: "simple_mix", label: "Simple Mix", cookingMethod: "simple_mix", baseTh: 8,
      inputMode: "multi", outputForm: "mixed_base", name: "Mixed Base",
      tags: ["mix", "base"],
    }),
    grind: method({
      id: "grind", label: "Grind", cookingMethod: "mixing", baseTh: 9,
      outputMode: "canonical_or_procedural", outputForm: "ground", namePrefix: "Ground",
      tags: ["prep", "milled"],
    }),
    mash: method({
      id: "mash", label: "Mash / Purée", cookingMethod: "mixing", baseTh: 9,
      outputForm: "puree", nameSuffix: "Purée", stabilizationHint: 1,
      tags: ["prep", "puree"],
    }),
    juice: method({
      id: "juice", label: "Juice", cookingMethod: "mixing", baseTh: 9,
      outputForm: "juice", nameSuffix: "Juice", stabilizationHint: 1,
      tags: ["liquid", "juice"],
    }),
    press: method({
      id: "press", label: "Press", cookingMethod: "mixing", baseTh: 9,
      outputMode: "canonical_or_procedural", outputForm: "pressed",
      stabilizationHint: 1, tags: ["pressed"],
    }),
    boil: method({
      id: "boil", label: "Boil", cookingMethod: "basic_boil", baseTh: 9,
      outputForm: "boiled", namePrefix: "Boiled", stabilizationHint: 1,
      tags: ["cooked"],
    }),
    blanch: method({
      id: "blanch", label: "Blanch", cookingMethod: "basic_boil", baseTh: 9,
      outputForm: "blanched", namePrefix: "Blanched", tags: ["cooked", "light_process"],
    }),
    grill: method({
      id: "grill", label: "Grill", cookingMethod: "grill", baseTh: 10,
      outputForm: "grilled", namePrefix: "Grilled", stabilizationHint: 1,
      tags: ["cooked"],
    }),
    pan_fry: method({
      id: "pan_fry", label: "Pan Fry", cookingMethod: "pan_fry", baseTh: 10,
      outputForm: "pan_fried", namePrefix: "Pan-Fried", stabilizationHint: 1,
      tags: ["cooked", "fried"],
    }),
    steam: method({
      id: "steam", label: "Steam", cookingMethod: "steam", baseTh: 11,
      outputForm: "steamed", namePrefix: "Steamed", stabilizationHint: 1,
      tags: ["cooked"],
    }),
    roast: method({
      id: "roast", label: "Roast", cookingMethod: "roast", baseTh: 11,
      outputForm: "roasted", namePrefix: "Roasted", stabilizationHint: 1,
      tags: ["cooked"],
    }),
    knead: method({
      id: "knead", label: "Knead", cookingMethod: "knead", baseTh: 11,
      inputMode: "multi", outputMode: "canonical", outputId: "processed_dough",
      outputForm: "dough", name: "Dough", stabilizationHint: 2,
      tags: ["dough", "base"],
    }),
    simmer: method({
      id: "simmer", label: "Simmer", cookingMethod: "simmer", baseTh: 12,
      inputMode: "single_or_multi", outputMode: "canonical_or_procedural",
      outputForm: "simmered", namePrefix: "Simmered", stabilizationHint: 1,
      tags: ["cooked", "liquid_base"],
    }),
    reduce: method({
      id: "reduce", label: "Reduce", cookingMethod: "simmer", baseTh: 12,
      outputMode: "canonical_or_procedural", outputForm: "reduction",
      nameSuffix: "Reduction", stabilizationHint: 2,
      tags: ["concentrated", "liquid_base"],
    }),
    stir_fry: method({
      id: "stir_fry", label: "Stir Fry", cookingMethod: "stir_fry", baseTh: 12,
      inputMode: "single_or_multi", outputForm: "stir_fried",
      namePrefix: "Stir-Fried", usuallyFinal: true, tags: ["cooked", "final_candidate"],
    }),
    bake: method({
      id: "bake", label: "Bake", cookingMethod: "bake", baseTh: 13,
      inputMode: "single_or_multi", outputForm: "baked", namePrefix: "Baked",
      usuallyFinal: true, tags: ["cooked", "final_candidate"],
    }),
    deep_fry: method({
      id: "deep_fry", label: "Deep Fry", cookingMethod: "deep_fry", baseTh: 13,
      outputForm: "deep_fried", namePrefix: "Deep-Fried",
      usuallyFinal: true, tags: ["cooked", "fried", "final_candidate"],
    }),
    smoke: method({
      id: "smoke", label: "Smoke", cookingMethod: "smoke", baseTh: 14,
      outputForm: "smoked", namePrefix: "Smoked", stabilizationHint: 2,
      tags: ["preserved", "smoked"],
    }),
    cure: method({
      id: "cure", label: "Cure", cookingMethod: "cure", baseTh: 14,
      outputForm: "cured", namePrefix: "Cured", stabilizationHint: 2,
      tags: ["preserved", "cured"],
    }),
    pickle: method({
      id: "pickle", label: "Pickle", cookingMethod: "pickle", baseTh: 14,
      outputForm: "pickled", namePrefix: "Pickled", stabilizationHint: 2,
      tags: ["preserved", "pickled"],
    }),
    dry: method({
      id: "dry", label: "Dry / Dehydrate", cookingMethod: "dry", baseTh: 14,
      outputForm: "dried", namePrefix: "Dried", stabilizationHint: 2,
      tags: ["preserved", "dried"],
    }),
    ferment: method({
      id: "ferment", label: "Ferment", cookingMethod: "ferment", baseTh: 15,
      outputMode: "canonical", outputId: "processed_ferment_base",
      outputForm: "ferment_base", name: "Ferment Base", stabilizationHint: 2,
      tags: ["fermented", "liquid_base", "base"],
    }),
    brew: method({
      id: "brew", label: "Brew", cookingMethod: "brew", baseTh: 15,
      inputMode: "single_or_multi", outputMode: "canonical",
      outputId: "processed_brew_base", outputForm: "brew_base", name: "Brew Base",
      stabilizationHint: 2, tags: ["brewed", "liquid", "base"],
    }),
    distill: method({
      id: "distill", label: "Distill", cookingMethod: "distill", baseTh: 15,
      outputMode: "canonical", outputId: "processed_distillate",
      outputForm: "distillate", name: "Distillate", stabilizationHint: 2,
      tags: ["distilled", "liquid", "concentrated"],
    }),
    delicate_extract: method({
      id: "delicate_extract", label: "Delicate Extract", cookingMethod: "delicate", baseTh: 15,
      outputMode: "canonical", outputId: "processed_culinary_extract",
      outputForm: "culinary_extract", name: "Culinary Extract",
      stabilizationHint: 2, tags: ["extract", "concentrated"],
    }),
  });

  const TAG_METHODS = Object.freeze({
    fruit: freezeList(["cut", "chop", "crush", "mash", "dry", "pickle", "bake"]),
    berry: freezeList(["crush", "mash", "dry", "bake"]),
    citrus: freezeList(["juice", "crush"]),
    juicy: freezeList(["juice"]),
    vegetable: freezeList(["cut", "chop", "mash", "boil", "blanch", "grill", "pan_fry", "steam", "roast", "simmer", "stir_fry", "dry", "pickle"]),
    root: freezeList(["cut", "chop", "mash", "boil", "roast", "dry", "pickle"]),
    leafy: freezeList(["cut", "chop", "blanch", "steam", "pan_fry", "dry", "pickle"]),
    starch: freezeList(["mash", "boil", "roast", "bake"]),
    grain: freezeList(["grind", "boil", "roast"]),
    legume: freezeList(["boil", "mash", "simmer", "grind"]),
    nut: freezeList(["crush", "grind", "press", "roast"]),
    seed: freezeList(["crush", "grind", "press", "roast"]),
    spice: freezeList(["crush", "grind", "dry", "brew"]),
    seasoning: freezeList(["crush", "grind", "dry"]),
    herb: freezeList(["cut", "crush", "dry", "brew"]),
    medicinal_herb: freezeList(["cut", "crush", "dry", "brew", "delicate_extract"]),
    toxic_herb: freezeList(["cut", "crush", "dry", "delicate_extract"]),
    fungus: freezeList(["cut", "chop", "boil", "grill", "pan_fry", "steam", "roast", "simmer", "dry", "pickle"]),
    extract: freezeList(["simple_mix", "delicate_extract"]),
    sap: freezeList(["reduce", "ferment"]),
    meat: freezeList(["cut", "chop", "boil", "grill", "pan_fry", "steam", "roast", "simmer", "deep_fry", "smoke", "dry", "cure"]),
    aquatic: freezeList(["cut", "boil", "grill", "pan_fry", "steam", "smoke", "dry", "cure"]),
    insectoid: freezeList(["cut", "boil", "grill", "pan_fry", "roast", "dry"]),
    raw: freezeList(["simple_mix"]),
    cooking_ready: freezeList(["simple_mix"]),

    juice: freezeList(["juice"]),
    refreshing: freezeList(["juice"]),
    flour_source: freezeList(["grind"]),
    oil_source: freezeList(["press"]),
    paste_source: freezeList(["grind", "mash"]),
    fermentable: freezeList(["ferment"]),
    fermentation: freezeList(["ferment"]),
    culture: freezeList(["ferment"]),
    tea: freezeList(["brew"]),
    drink: freezeList(["brew"]),
    stew: freezeList(["simmer"]),
    soup: freezeList(["simmer"]),
    broth_base: freezeList(["simmer"]),
    sauce: freezeList(["simmer", "reduce"]),
    sauce_base: freezeList(["simmer", "reduce"]),
    bake: freezeList(["bake"]),
    roast: freezeList(["roast"]),
    stir_fry: freezeList(["stir_fry"]),
    pickle: freezeList(["pickle"]),
    preserve: freezeList(["dry", "pickle"]),
    preservation_support: freezeList(["dry", "pickle"]),
    medicinal: freezeList(["brew", "delicate_extract"]),
    medicinal_minor: freezeList(["brew", "delicate_extract"]),
    special_ingredient: freezeList(["delicate_extract"]),
    advanced_reagent: freezeList(["delicate_extract"]),
  });

  const FORM_METHODS = Object.freeze({
    sliced: freezeList(["simple_mix", "boil", "grill", "pan_fry", "steam", "roast", "stir_fry", "dry", "pickle"]),
    chopped: freezeList(["simple_mix", "boil", "pan_fry", "simmer", "stir_fry", "dry", "pickle"]),
    crushed: freezeList(["simple_mix", "brew", "simmer"]),
    ground: freezeList(["simple_mix", "brew"]),
    puree: freezeList(["simple_mix", "simmer", "reduce", "bake"]),
    juice: freezeList(["simple_mix", "reduce", "ferment", "brew"]),
    oil: freezeList(["simple_mix", "pan_fry", "deep_fry"]),
    flour: freezeList(["simple_mix", "knead", "bake"]),
    dough: freezeList(["bake", "steam", "deep_fry"]),
    stock: freezeList(["simple_mix", "simmer", "reduce"]),
    broth: freezeList(["simple_mix", "simmer", "reduce"]),
    sauce_base: freezeList(["simple_mix", "simmer", "reduce"]),
    syrup: freezeList(["simple_mix", "bake"]),
    ferment_base: freezeList(["brew", "distill"]),
    brew_base: freezeList(["distill"]),
    mixed_base: freezeList(["simmer", "steam", "bake", "deep_fry"]),
    reduction: freezeList(["simple_mix", "bake"]),
    culinary_extract: freezeList(["simple_mix", "brew"]),
  });

  const CANONICAL_OUTPUTS = Object.freeze({
    processed_flour: Object.freeze({ id: "processed_flour", name: "Flour", form: "flour", tags: freezeList(["flour", "powder", "base"]) }),
    processed_oil: Object.freeze({ id: "processed_oil", name: "Oil", form: "oil", tags: freezeList(["oil", "liquid", "fat"]) }),
    processed_paste: Object.freeze({ id: "processed_paste", name: "Paste", form: "paste", tags: freezeList(["paste", "base"]) }),
    processed_dough: Object.freeze({ id: "processed_dough", name: "Dough", form: "dough", tags: freezeList(["dough", "base"]) }),
    processed_stock: Object.freeze({ id: "processed_stock", name: "Stock", form: "stock", tags: freezeList(["stock", "liquid", "base"]) }),
    processed_sauce_base: Object.freeze({ id: "processed_sauce_base", name: "Sauce Base", form: "sauce_base", tags: freezeList(["sauce_base", "liquid", "base"]) }),
    processed_syrup: Object.freeze({ id: "processed_syrup", name: "Syrup", form: "syrup", tags: freezeList(["syrup", "concentrated", "base"]) }),
    processed_ferment_base: Object.freeze({ id: "processed_ferment_base", name: "Ferment Base", form: "ferment_base", tags: freezeList(["fermented", "liquid", "base"]) }),
    processed_brew_base: Object.freeze({ id: "processed_brew_base", name: "Brew Base", form: "brew_base", tags: freezeList(["brewed", "liquid", "base"]) }),
    processed_distillate: Object.freeze({ id: "processed_distillate", name: "Distillate", form: "distillate", tags: freezeList(["distilled", "liquid", "concentrated"]) }),
    processed_culinary_extract: Object.freeze({ id: "processed_culinary_extract", name: "Culinary Extract", form: "culinary_extract", tags: freezeList(["extract", "concentrated"]) }),
  });

  function valuesFrom(item, key) {
    const value = item?.[key];
    if (value == null) return [];
    return (Array.isArray(value) ? value : [value]).map(normalizeId).filter(Boolean);
  }

  function collectTags(item = {}) {
    const tags = new Set();
    [
      "tags", "itemTags", "recipeRoles", "flavorTags", "functionalTags",
      "craftTags", "reagentTags", "processingTags",
    ].forEach((key) => valuesFrom(item, key).forEach((value) => tags.add(value)));

    [
      item.family, item.group, item.iconFamily, item.category, item.itemType,
      item.processedForm, item.processingMethod,
    ].map(normalizeId).filter(Boolean).forEach((value) => tags.add(value));

    if (item.cookingReady === true) tags.add("cooking_ready");
    if (item.edibleRaw === true) tags.add("edible_raw");
    if (item.rawCraftingReagent === true) tags.add("raw_crafting_reagent");
    return tags;
  }

  function explicitAllowed(item = {}) {
    return valuesFrom(item, "processingMethodsAllowed");
  }

  function explicitDenied(item = {}) {
    return new Set(valuesFrom(item, "processingMethodsDenied"));
  }

  function availableMethodIds(item = {}) {
    const tags = collectTags(item);
    const methods = new Set(explicitAllowed(item));
    const denied = explicitDenied(item);

    for (const tag of tags) {
      for (const methodId of (TAG_METHODS[tag] || [])) methods.add(methodId);
    }
    const form = normalizeId(item.processedForm);
    for (const methodId of (FORM_METHODS[form] || [])) methods.add(methodId);

    for (const methodId of denied) methods.delete(methodId);
    return [...methods].filter((id) => METHODS[id]).sort((a, b) => {
      const ath = METHODS[a].baseTh;
      const bth = METHODS[b].baseTh;
      if (ath !== bth) return ath - bth;
      return a.localeCompare(b);
    });
  }

  function availableMethodsFor(item = {}) {
    return availableMethodIds(item).map((id) => clone(METHODS[id]));
  }

  function hasTag(item, tag) {
    return collectTags(item).has(normalizeId(tag));
  }

  function normalizedInputs(inputs) {
    return (Array.isArray(inputs) ? inputs : [inputs]).filter(Boolean);
  }

  function validateInputCount(methodSpec, inputs) {
    const count = inputs.length;
    if (methodSpec.inputMode === "multi") return count >= 2;
    if (methodSpec.inputMode === "single_or_multi") return count >= 1;
    return count === 1;
  }

  function specialInputRequirement(methodId, inputs) {
    if (methodId === "knead") {
      const hasFlour = inputs.some((item) => normalizeId(item.processedForm) === "flour" || hasTag(item, "flour"));
      const hasBinder = inputs.some((item) =>
        hasTag(item, "liquid") || hasTag(item, "binder") || hasTag(item, "water") ||
        ["juice", "brew_base"].includes(normalizeId(item.processedForm))
      );
      return hasFlour && hasBinder;
    }
    if (methodId === "reduce") {
      return inputs.some((item) =>
        ["juice", "stock", "broth", "sauce_base", "puree", "reduction"].includes(normalizeId(item.processedForm)) ||
        hasTag(item, "juice") || hasTag(item, "sauce") || hasTag(item, "sauce_base") || hasTag(item, "broth_base")
      );
    }
    if (methodId === "distill") {
      return inputs.some((item) =>
        ["ferment_base", "brew_base"].includes(normalizeId(item.processedForm)) ||
        hasTag(item, "fermented") || hasTag(item, "brewed")
      );
    }
    return true;
  }

  function canProcess(inputs, methodId) {
    const entries = normalizedInputs(inputs);
    const id = normalizeId(methodId);
    const spec = METHODS[id];
    if (!spec) return Object.freeze({ allowed: false, reason: "unknown_method", methodId: id });
    if (!validateInputCount(spec, entries)) {
      return Object.freeze({ allowed: false, reason: "invalid_input_count", methodId: id });
    }

    const eligible = entries.every((item) => {
      if (id === "simple_mix") return availableMethodIds(item).length > 0;
      return availableMethodIds(item).includes(id) || ["knead", "reduce", "distill"].includes(id);
    });
    if (!eligible) return Object.freeze({ allowed: false, reason: "incompatible_input", methodId: id });
    if (!specialInputRequirement(id, entries)) {
      return Object.freeze({ allowed: false, reason: "missing_required_input_form", methodId: id });
    }
    return Object.freeze({ allowed: true, reason: null, methodId: id });
  }

  function sourceName(item = {}) {
    return String(item.displayName || item.name || item.materialName || item.itemId || item.id || "Ingredient").trim();
  }

  function sourceId(item = {}) {
    return String(item.itemId || item.definitionId || item.id || "").trim();
  }

  function canonicalOutputFor(methodId, inputs) {
    const id = normalizeId(methodId);
    const first = inputs[0] || {};

    if (id === "grind" && inputs.some((item) => hasTag(item, "flour_source"))) return CANONICAL_OUTPUTS.processed_flour;
    if (id === "press" && inputs.some((item) => hasTag(item, "oil_source"))) return CANONICAL_OUTPUTS.processed_oil;
    if (["grind", "mash"].includes(id) && inputs.some((item) => hasTag(item, "paste_source"))) return CANONICAL_OUTPUTS.processed_paste;
    if (id === "knead") return CANONICAL_OUTPUTS.processed_dough;

    if (id === "simmer") {
      if (inputs.some((item) => hasTag(item, "sauce") || hasTag(item, "sauce_base"))) return CANONICAL_OUTPUTS.processed_sauce_base;
      if (inputs.some((item) => hasTag(item, "meat") || hasTag(item, "broth_base"))) return CANONICAL_OUTPUTS.processed_stock;
    }

    if (id === "reduce") {
      if (
        hasTag(first, "sweet") ||
        normalizeId(first.processedForm) === "juice" ||
        inputs.some((item) => hasTag(item, "sweetener_base"))
      ) return CANONICAL_OUTPUTS.processed_syrup;
      if (inputs.some((item) => hasTag(item, "sauce") || hasTag(item, "sauce_base"))) return CANONICAL_OUTPUTS.processed_sauce_base;
    }

    const spec = METHODS[id];
    if (spec?.outputId && CANONICAL_OUTPUTS[spec.outputId]) return CANONICAL_OUTPUTS[spec.outputId];
    return null;
  }

  function proceduralOutputId(methodSpec, input) {
    const id = sourceId(input) || normalizeId(sourceName(input)) || "ingredient";
    return `processed_${methodSpec.outputForm}_${normalizeId(id)}`;
  }

  function proceduralOutputName(methodSpec, input, inputCount) {
    if (methodSpec.name) return methodSpec.name;
    if (inputCount > 1) {
      if (methodSpec.id === "stir_fry") return "Stir-Fried Mix";
      if (methodSpec.id === "bake") return "Baked Mix";
      return `${methodSpec.label} Mix`;
    }
    const name = sourceName(input);
    if (methodSpec.namePrefix) return `${methodSpec.namePrefix} ${name}`;
    if (methodSpec.nameSuffix) return `${name} ${methodSpec.nameSuffix}`;
    return `${methodSpec.label} ${name}`;
  }

  function uniqueCulinaryProperties(inputs) {
    const seen = new Set();
    const result = [];
    for (const input of inputs) {
      for (const property of (Array.isArray(input?.culinaryProperties) ? input.culinaryProperties : [])) {
        const target = normalizeId(property?.target || property);
        if (!target) continue;
        const sourceInstanceId = String(property?.sourceInstanceId || input?.sourceInstanceId || "").trim() || null;
        const key = `${sourceInstanceId || "unknown"}::${target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(Object.freeze({
          target,
          sourceInstanceId,
          affinityBranch: property?.affinityBranch || null,
          source: property?.source || "item_affinity_v1",
        }));
      }
    }
    return result;
  }

  function provenanceFrom(inputs) {
    return inputs.map((item) => Object.freeze({
      itemId: sourceId(item) || null,
      sourceInstanceId: String(item?.sourceInstanceId || item?.instanceId || "").trim() || null,
      quantity: Math.max(0, Number(item?.quantity ?? 1) || 0),
      processedForm: normalizeId(item?.processedForm) || null,
      processingMethod: normalizeId(item?.processingMethod) || null,
    }));
  }

  function inheritedTags(inputs) {
    const result = new Set();
    for (const input of inputs) {
      for (const tag of collectTags(input)) result.add(tag);
    }
    return result;
  }

  function createProcessedItem(inputs, methodId, options = {}) {
    const entries = normalizedInputs(inputs);
    const validation = canProcess(entries, methodId);
    if (!validation.allowed) {
      if (options.throwOnInvalid === true) {
        throw new Error(`Cannot process with ${normalizeId(methodId)}: ${validation.reason}.`);
      }
      return Object.freeze({ created: false, ...validation });
    }

    const spec = METHODS[validation.methodId];
    const canonical = canonicalOutputFor(validation.methodId, entries);
    const first = entries[0];
    const outputId = canonical?.id || proceduralOutputId(spec, first);
    const outputName = canonical?.name || proceduralOutputName(spec, first, entries.length);
    const outputForm = canonical?.form || spec.outputForm;
    const properties = uniqueCulinaryProperties(entries);
    const provenance = provenanceFrom(entries);
    const sourceItemIds = [...new Set(provenance.map((entry) => entry.itemId).filter(Boolean))];
    const sourceInstanceIds = [...new Set(provenance.map((entry) => entry.sourceInstanceId).filter(Boolean))];
    const tags = inheritedTags(entries);

    tags.add("ingredient");
    tags.add("processed");
    tags.add(outputForm);
    tags.add(spec.id);
    for (const tag of spec.tags) tags.add(normalizeId(tag));
    for (const tag of (canonical?.tags || [])) tags.add(normalizeId(tag));

    const quantity = Math.max(1, Math.trunc(Number(options.outputQuantity ?? options.quantity ?? 1) || 1));
    const quality = options.quality || entries[0]?.quality || "standard";
    const taste = options.taste == null ? entries[0]?.taste ?? null : Number(options.taste);

    return Object.freeze({
      created: true,
      itemId: outputId,
      id: outputId,
      name: outputName,
      displayName: outputName,
      family: PROCESSED_FAMILY,
      category: "ingredient",
      itemType: "material",
      sourceLine: "culinary_processing",
      stackable: true,
      stackPolicy: DEFAULT_STACK_POLICY,
      quantity,
      quality,
      processed: true,
      processedForm: outputForm,
      processingMethod: spec.id,
      processingMethodLabel: spec.label,
      processingBaseTh: spec.baseTh,
      processedStabilizationHint: spec.stabilizationHint,
      usuallyFinal: spec.usuallyFinal === true,
      culinaryProperties: Object.freeze(properties),
      affinityTarget: properties.length === 1 ? properties[0].target : null,
      affinityBranch: properties.length === 1 ? properties[0].affinityBranch : null,
      sourceItemIds: Object.freeze(sourceItemIds),
      sourceInstanceIds: Object.freeze(sourceInstanceIds),
      provenance: Object.freeze(provenance),
      processingTags: Object.freeze([...tags].sort()),
      taste: taste != null && Number.isFinite(Number(taste)) ? Number(taste) : null,
      outputMode: canonical ? "canonical" : "procedural",
      canonicalProcessedId: canonical?.id || null,
    });
  }

  function buildProcessingRecipe(inputs, methodId, options = {}) {
    const entries = normalizedInputs(inputs);
    const validation = canProcess(entries, methodId);
    if (!validation.allowed) return Object.freeze({ valid: false, ...validation });

    const spec = METHODS[validation.methodId];
    const cooking = cookingEngine();
    const roles = Array.isArray(options.roles) ? options.roles : [];
    const ingredients = entries.map((item, index) => ({
      ...clone(item),
      role: roles[index] || item.role || (index === 0 ? "major" : "minor"),
    }));

    const recipe = {
      id: options.recipeId || `process_${spec.id}`,
      method: spec.cookingMethod,
      ability: options.ability || "dex",
      ingredients,
      auxiliarySteps: clone(options.auxiliarySteps || []),
      specialPenalty: Math.max(0, Number(options.specialPenalty) || 0),
    };

    const th = cooking?.buildRecipeTh ? cooking.buildRecipeTh(recipe) : Object.freeze({
      baseTh: spec.baseTh,
      recipeTh: Math.max(8, Math.min(24, spec.baseTh + Math.ceil(
        ingredients.reduce((sum, item) => sum + (item.role === "minor" ? 0.5 : item.role === "seasoning" ? 0.25 : item.role === "garnish" ? 0 : 1), 0)
      ))),
    });

    return Object.freeze({
      valid: true,
      methodId: spec.id,
      method: clone(spec),
      recipe: Object.freeze(recipe),
      th,
    });
  }

  function validateMethodThAgainstCooking() {
    const cooking = cookingEngine();
    if (!cooking?.methodBaseTh) return Object.freeze({ valid: true, checked: false, mismatches: [] });
    const mismatches = [];
    for (const spec of Object.values(METHODS)) {
      const canonicalTh = cooking.methodBaseTh(spec.cookingMethod);
      if (canonicalTh !== spec.baseTh) mismatches.push({ methodId: spec.id, expected: canonicalTh, actual: spec.baseTh });
    }
    return Object.freeze({ valid: mismatches.length === 0, checked: true, mismatches: Object.freeze(mismatches) });
  }

  const API = Object.freeze({
    VERSION,
    PROCESSED_FAMILY,
    DEFAULT_STACK_POLICY,
    METHODS,
    TAG_METHODS,
    FORM_METHODS,
    CANONICAL_OUTPUTS,
    normalizeId,
    collectTags,
    availableMethodIds,
    availableMethodsFor,
    canProcess,
    canonicalOutputFor,
    createProcessedItem,
    buildProcessingRecipe,
    validateMethodThAgainstCooking,
  });

  global.LuminousItemProcessingEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
