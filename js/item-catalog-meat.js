(function (global) {
  "use strict";

  if (global.LuminousMeatCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMeatCatalog;
    return;
  }

  const VERSION = 2;
  const FAMILY = "meat";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const DEFAULT_SIZE = "medium";
  const AHN_ECONOMY_SCALE = 100;

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

  function affinityEngine() {
    return global.LuminousItemAffinityEngine || safeRequire("./item-affinity-engine.js");
  }

  function affinityCatalog() {
    return global.LuminousCulinaryAffinityCatalog || safeRequire("./item-culinary-affinity-data.js");
  }

  function processingEngine() {
    return global.LuminousItemProcessingEngine || safeRequire("./item-processing-engine.js");
  }

  function sizeEngine() {
    return global.LuminousItemSizeLineageEngine || safeRequire("./item-size-lineage-engine.js");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function lineageNameFromItemName(name) {
    return String(name || "").replace(/ Meat$/i, "").trim();
  }

  function item(id, name, iconFamily, priceAhn, tags = []) {
    const lineageId = String(id).replace(/^meat_/, "");
    const lineageName = lineageNameFromItemName(name);
    const affinityData = affinityCatalog();
    const culinaryAffinities = affinityData?.get ? affinityData.get(id) : {};
    return Object.freeze({
      id,
      name,
      lineageId,
      lineageName,
      family: FAMILY,
      iconFamily,
      category: "ingredient",
      itemType: "material",
      sourceLine: "harvest",
      purchasable: true,
      currency: CURRENCY,
      priceAhn: Math.round(priceAhn * AHN_ECONOMY_SCALE),
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "universal",
      sizeSystem: "universal_physical",
      stackable: true,
      stackPolicy: "identical_item_quality_size_lineage_affinity",
      edibleRaw: true,
      culinaryAffinities: Object.freeze(culinaryAffinities || {}),
      culinaryAffinityProfileId: affinityData?.profileIdFor ? affinityData.profileIdFor(id) : null,
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

  function priceForSizeAndQuality(itemOrId, size = DEFAULT_SIZE, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const sEngine = sizeEngine();
    const qEngine = qualityEngine();
    const sized = sEngine?.scaleValue
      ? sEngine.scaleValue(entry.priceAhn, size, { rounding: "round" })
      : Math.round(Number(entry.priceAhn) || 0);
    if (!qEngine?.applyValue) return sized;
    return qEngine.applyValue(sized, quality, { rounding: "round" });
  }

  function priceForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    return priceForSizeAndQuality(itemOrId, DEFAULT_SIZE, quality);
  }

  function createHarvestStack(itemOrId, options = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const qEngine = qualityEngine();
    const sEngine = sizeEngine();
    const quality = qEngine?.getQuality
      ? qEngine.getQuality(options.quality || DEFAULT_QUALITY).id
      : String(options.quality || DEFAULT_QUALITY);
    const size = sEngine?.canonicalSize ? sEngine.canonicalSize(options.size || DEFAULT_SIZE) : String(options.size || DEFAULT_SIZE);
    const lineage = sEngine?.lineageFrom
      ? sEngine.lineageFrom({
          lineageId: options.lineageId || entry.lineageId,
          lineageName: options.lineageName || entry.lineageName,
        }, entry.lineageName)
      : { lineageId: options.lineageId || entry.lineageId, lineageName: options.lineageName || entry.lineageName };
    const quantity = Math.max(1, Math.trunc(Number(options.quantity || 1)));
    const hungerPerUnit = sEngine?.hungerForSize ? sEngine.hungerForSize(size) : 100;
    const affinity = affinityEngine();
    const sourceInstanceId = String(options.sourceInstanceId || options.instanceId || options.sourceEntityId || "").trim() || null;
    const materialized = affinity?.materializeCulinaryAffinity
      ? affinity.materializeCulinaryAffinity({
          ...entry,
          sourceInstanceId,
          culinaryProperties: clone(options.culinaryProperties || []),
        }, {
          sourceInstanceId,
          roll: options.affinityRoll,
          rng: options.affinityRng,
        })
      : { culinaryProperties: clone(options.culinaryProperties || []) };
    const culinaryProperties = clone(materialized.culinaryProperties || []);
    const realized = culinaryProperties[0] || null;
    return {
      itemId: entry.id,
      family: FAMILY,
      quantity,
      size,
      quality,
      stackPolicy: entry.stackPolicy,
      sourceInstanceId: materialized.sourceInstanceId || sourceInstanceId,
      culinaryProperties,
      affinityTarget: realized?.target || null,
      affinityBranch: realized?.affinityBranch || null,
      lineageId: lineage.lineageId,
      lineageName: lineage.lineageName,
      displayName: entry.name === "Venison" && lineage.lineageName === "Venison" ? "Venison" : `${lineage.lineageName} Meat`,
      hungerPerUnit,
      rationEquivalentPerUnit: hungerPerUnit / 100,
      unitValueAhn: priceForSizeAndQuality(entry, size, quality),
      originCreatureType: options.originCreatureType || null,
      originCreatureId: options.originCreatureId || null,
      originRaceId: options.originRaceId || null,
      originSubtypeId: options.originSubtypeId || null,
      sourceEntityId: options.sourceEntityId || null,
    };
  }

  function processingMethodsFor(itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return [];
    const engine = processingEngine();
    return engine?.availableMethodsFor ? engine.availableMethodsFor(entry) : [];
  }

  function processIngredient(stackOrId, methodId, options = {}) {
    const stack = typeof stackOrId === "string"
      ? createHarvestStack(stackOrId, options.sourceOptions || {})
      : clone(stackOrId);
    if (!stack) return null;
    const entry = get(stack.itemId || stack.id);
    if (!entry) return null;
    const engine = processingEngine();
    if (!engine?.createProcessedItem) return null;
    return engine.createProcessedItem({ ...entry, ...stack }, methodId, options);
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    CURRENCY,
    DEFAULT_QUALITY,
    DEFAULT_SIZE,
    AHN_ECONOMY_SCALE,
    ICON_FAMILIES,
    ITEMS,
    get,
    list,
    priceForQuality,
    priceForSizeAndQuality,
    createHarvestStack,
    processingMethodsFor,
    processIngredient,
  });

  global.LuminousMeatCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
