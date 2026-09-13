(function (global) {
  "use strict";

  if (global.LuminousMeatCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMeatCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "meat";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";

  const ICON_FAMILIES = Object.freeze([
    "meat_mammal",
    "meat_bird",
    "meat_fish",
    "meat_shellfish",
    "meat_reptile",
    "meat_draconic",
    "meat_insectoid",
  ]);

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function qualityEngine() {
    return global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function item(id, name, iconFamily, priceAhn, tags = []) {
    return Object.freeze({
      id,
      name,
      family: FAMILY,
      iconFamily,
      category: "ingredient",
      itemType: "material",
      sourceLine: "harvest",
      purchasable: true,
      currency: CURRENCY,
      priceAhn,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      stackable: true,
      edibleRaw: true,
      tags: Object.freeze(["ingredient", "organic", "meat", ...tags]),
    });
  }

  const ITEMS = Object.freeze([
    item("meat_humanoid", "Humanoid Meat", "meat_mammal", 250, ["humanoid"]),
    item("meat_wolf", "Wolf Meat", "meat_mammal", 180, ["mammal", "wolf"]),
    item("meat_canid", "Canid Meat", "meat_mammal", 120, ["mammal", "canid"]),
    item("meat_lupine", "Lupine Meat", "meat_mammal", 450, ["humanoid", "mammal", "lupine"]),
    item("meat_bear", "Bear Meat", "meat_mammal", 300, ["mammal", "bear"]),
    item("meat_boar", "Boar Meat", "meat_mammal", 180, ["mammal", "boar"]),
    item("meat_venison", "Venison", "meat_mammal", 220, ["mammal", "cervid"]),
    item("meat_bovine", "Bovine Meat", "meat_mammal", 140, ["mammal", "bovine"]),
    item("meat_caprine", "Caprine Meat", "meat_mammal", 120, ["mammal", "caprine"]),
    item("meat_ovine", "Ovine Meat", "meat_mammal", 120, ["mammal", "ovine"]),
    item("meat_equine", "Equine Meat", "meat_mammal", 150, ["mammal", "equine"]),
    item("meat_camelid", "Camelid Meat", "meat_mammal", 170, ["mammal", "camelid"]),
    item("meat_elephant", "Elephant Meat", "meat_mammal", 220, ["mammal", "pachyderm"]),
    item("meat_rabbit", "Rabbit Meat", "meat_mammal", 140, ["mammal", "lagomorph"]),
    item("meat_rodent", "Rodent Meat", "meat_mammal", 60, ["mammal", "rodent"]),
    item("meat_mustelid", "Mustelid Meat", "meat_mammal", 100, ["mammal", "mustelid"]),
    item("meat_feline", "Feline Meat", "meat_mammal", 280, ["mammal", "feline"]),
    item("meat_hyena", "Hyena Meat", "meat_mammal", 160, ["mammal", "hyena"]),
    item("meat_primate", "Primate Meat", "meat_mammal", 230, ["mammal", "primate"]),
    item("meat_bat", "Bat Meat", "meat_mammal", 80, ["mammal", "bat"]),
    item("meat_avian", "Avian Meat", "meat_bird", 130, ["avian"]),
    item("meat_crocodilian", "Crocodilian Meat", "meat_reptile", 260, ["reptile", "crocodilian"]),
    item("meat_lizard", "Lizard Meat", "meat_reptile", 120, ["reptile", "lizard"]),
    item("meat_reptilian", "Reptilian Meat", "meat_reptile", 350, ["humanoid", "reptile"]),
    item("meat_snake", "Snake Meat", "meat_reptile", 160, ["reptile", "snake"]),
    item("meat_serpentine", "Serpentine Meat", "meat_reptile", 500, ["humanoid", "reptile", "serpentine"]),
    item("meat_turtle", "Turtle Meat", "meat_reptile", 180, ["reptile", "chelonoid"]),
    item("meat_amphibian", "Amphibian Meat", "meat_reptile", 100, ["amphibian"]),
    item("meat_fish", "Fish Meat", "meat_fish", 100, ["aquatic", "soft_meat", "fish"]),
    item("meat_shark", "Shark Meat", "meat_fish", 240, ["aquatic", "soft_meat", "shark"]),
    item("meat_cetacean", "Cetacean Meat", "meat_fish", 200, ["aquatic", "soft_meat", "cetacean"]),
    item("meat_cephalopod", "Cephalopod Meat", "meat_fish", 180, ["aquatic", "soft_meat", "cephalopod"]),
    item("meat_crustacean", "Crustacean Meat", "meat_shellfish", 160, ["aquatic", "hard_meat", "crustacean"]),
    item("meat_arachnid", "Arachnid Meat", "meat_insectoid", 220, ["insectoid", "arachnid"]),
    item("meat_insect", "Insect Meat", "meat_insectoid", 80, ["insectoid", "insect"]),
    item("meat_mollusk", "Mollusk Meat", "meat_shellfish", 120, ["aquatic", "hard_meat", "mollusk"]),
    item("meat_dinosaur", "Dinosaur Meat", "meat_mammal", 450, ["dinosaur"]),
    item("meat_draconic", "Draconic Meat", "meat_draconic", 750, ["humanoid", "draconic"]),
    item("meat_exotic_humanoid", "Exotic Humanoid Meat", "meat_mammal", 600, ["humanoid", "exotic"]),
  ]);

  function get(id) {
    const key = String(id || "").trim();
    const found = ITEMS.find((entry) => entry.id === key);
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const iconFamily = String(options.iconFamily || "").trim();
    const tag = String(options.tag || "").trim().toLowerCase();
    return ITEMS
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .filter((entry) => !tag || entry.tags.includes(tag))
      .map(clone);
  }

  function priceForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const engine = qualityEngine();
    if (!engine?.applyValue) return Math.round(Number(entry.priceAhn) || 0);
    return engine.applyValue(entry.priceAhn, quality, { rounding: "round" });
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const engine = qualityEngine();
    const quality = engine?.getQuality
      ? engine.getQuality(options.quality || DEFAULT_QUALITY).id
      : String(options.quality || DEFAULT_QUALITY);
    const quantity = Math.max(1, Math.trunc(Number(options.quantity || 1)));
    return {
      itemId: entry.id,
      family: FAMILY,
      quantity,
      quality,
      unitValueAhn: priceForQuality(entry, quality),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    ICON_FAMILIES,
    ITEMS,
    get,
    list,
    priceForQuality,
    createHarvestStack,
  });

  global.LuminousMeatCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
