(function (global) {
  "use strict";

  if (global.LuminousItemContentRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemContentRegistry;
    return;
  }

  const VERSION = 1;
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
    if (!itemCore) {
      return Object.freeze({
        items: Object.freeze({}),
        recipes: Object.freeze(collectRecipeMap(host)),
        counts: Object.freeze({ items: 0, recipes: Object.keys(collectRecipeMap(host)).length }),
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

    const recipes = collectRecipeMap(host);
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
    appendFirebaseAugmentations,
    build
  });

  global.LuminousItemContentRegistry = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
