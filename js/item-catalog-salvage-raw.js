(function (global) {
  "use strict";

  if (global.LuminousRawSalvageCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRawSalvageCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "raw_salvage";
  const CURRENCY = "AHN";

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function item(id, name, materialClass, iconFamily, unitValueAhn, tags = [], useTags = []) {
    return Object.freeze({
      id,
      name,
      family: FAMILY,
      category: "ingredient",
      itemType: "material",
      sourceLine: "salvage",
      materialClass,
      iconFamily,
      currency: CURRENCY,
      standardUnitValueAhn: Math.max(0, Math.round(Number(unitValueAhn) || 0)),
      measure: "salvage_unit",
      rawCraftingReagent: true,
      processed: false,
      stackable: true,
      stackPolicy: "identical_raw_salvage_material_quality_source",
      tags: Object.freeze(["ingredient", "material", "raw_salvage", "crafting_input", ...tags].map(normalizeId).filter(Boolean)),
      useTags: Object.freeze(["crafting", ...useTags].map(normalizeId).filter(Boolean)),
    });
  }

  const ITEMS = Object.freeze([
    item("scrap_metal", "Metal Scrap", "metal", "scrap_metal", 2500, ["scrap", "metal"], ["metalworking", "fabrication"]),
    item("mechanical_scrap", "Mechanical Scrap", "mechanical", "scrap_mechanical", 3500, ["scrap", "mechanical"], ["fabrication", "mechanical_parts"]),
    item("stone_fragment", "Stone Fragment", "stone", "mineral_industrial_stone", 1200, ["stone", "mineral"], ["construction", "abrasive"]),
    item("synthetic_scrap", "Synthetic Scrap", "synthetic", "structural_stock", 3000, ["synthetic", "scrap"], ["fabrication", "composite_feedstock"]),
    item("crystal_fragment", "Crystal Fragment", "crystal", "gem_rough", 5000, ["crystal", "fragment"], ["lapidary_input", "optical_material"]),
    item("wood_salvage", "Salvaged Wood", "wood", "structural_stock", 900, ["wood", "plant"], ["woodworking", "structural_material"]),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(ITEMS.map((entry) => [entry.id, entry])));

  function get(id) {
    const key = normalizeId(id);
    return BY_ID[key] ? clone(BY_ID[key]) : null;
  }

  function list(options = {}) {
    const materialClass = normalizeId(options.materialClass);
    const tag = normalizeId(options.tag);
    return ITEMS
      .filter((entry) => !materialClass || entry.materialClass === materialClass)
      .filter((entry) => !tag || entry.tags.includes(tag) || entry.useTags.includes(tag))
      .map(clone);
  }

  function itemForMaterial(material) {
    const id = normalizeId(material);
    const map = {
      metal: "scrap_metal",
      mechanical: "mechanical_scrap",
      stone: "stone_fragment",
      mineral: "stone_fragment",
      synthetic: "synthetic_scrap",
      crystal: "crystal_fragment",
      wood: "wood_salvage",
      plant: "wood_salvage",
    };
    return get(map[id]);
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    ITEMS,
    get,
    list,
    itemForMaterial,
  });

  global.LuminousRawSalvageCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
