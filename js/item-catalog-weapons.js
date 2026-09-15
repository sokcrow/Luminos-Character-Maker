(function (global) {
  "use strict";

  if (global.LuminousWeaponCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "weapons";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const PRICING_MODEL = "chassis_reference_plus_materials_and_upgrades";
  const PRICE_REFERENCE_SCOPE = "chassis_only";
  const IMPROVISED_THRESHOLD_PENALTY = 3;
  const MATERIAL_DURABILITY_STATUS = "pending_material_table";
  const STATION_REQUIREMENTS_STATUS = "deferred";

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  const QUALITY_ORDER = Object.freeze(["ruined", "poor", "standard", "fine", "exceptional"]);
  const QUALITY = Object.freeze({
    ruined: Object.freeze({ id: "ruined", damageMultiplier: 0.60, durabilityMultiplier: 0.50, valueMultiplier: 0.20, improvised: true, destroyAtZero: true }),
    poor: Object.freeze({ id: "poor", damageMultiplier: 0.80, durabilityMultiplier: 0.75, valueMultiplier: 0.55, improvised: false, destroyAtZero: false }),
    standard: Object.freeze({ id: "standard", damageMultiplier: 1.00, durabilityMultiplier: 1.00, valueMultiplier: 1.00, improvised: false, destroyAtZero: false }),
    fine: Object.freeze({ id: "fine", damageMultiplier: 1.20, durabilityMultiplier: 1.25, valueMultiplier: 1.65, improvised: false, destroyAtZero: false }),
    exceptional: Object.freeze({ id: "exceptional", damageMultiplier: 1.40, durabilityMultiplier: 1.50, valueMultiplier: 2.50, improvised: false, destroyAtZero: false }),
  });

  const RECIPE_PROFILES = Object.freeze({
    wooden_blunt: Object.freeze({ inputTags: ["structural_stock"], requiredToolType: "fabrication_tools", semanticCheck: "woodcarving", baseThreshold: 18, assemblyMultiplier: 1.20 }),
    small_blade: Object.freeze({ inputTags: ["refined_weapon_material", "structural_handle"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 18, assemblyMultiplier: 1.30 }),
    headed_weapon: Object.freeze({ inputTags: ["refined_weapon_material", "structural_handle", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 18, assemblyMultiplier: 1.30 }),
    hafted_piercing: Object.freeze({ inputTags: ["structural_stock", "refined_weapon_material", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 18, assemblyMultiplier: 1.30 }),
    bow: Object.freeze({ inputTags: ["structural_stock", "processed_textile"], requiredToolType: "fabrication_tools", semanticCheck: "woodcarving", baseThreshold: 18, assemblyMultiplier: 1.30 }),
    sling: Object.freeze({ inputTags: ["processed_leather_or_textile"], requiredToolType: "textile_tools", semanticCheck: "leatherworking", baseThreshold: 18, assemblyMultiplier: 1.20 }),
    simple_mechanical_ranged: Object.freeze({ inputTags: ["structural_stock", "mechanical_parts", "wire_cable", "fasteners_hardware"], requiredToolType: "technical_tools", semanticCheck: "mechanical_fabrication", baseThreshold: 22, assemblyMultiplier: 1.65 }),
    martial_blade: Object.freeze({ inputTags: ["refined_weapon_material", "structural_handle", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 22, assemblyMultiplier: 1.40 }),
    martial_headed: Object.freeze({ inputTags: ["refined_weapon_material", "structural_handle", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 22, assemblyMultiplier: 1.40 }),
    chained_blunt: Object.freeze({ inputTags: ["refined_weapon_material", "structural_handle", "wire_cable", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 22, assemblyMultiplier: 1.40 }),
    polearm: Object.freeze({ inputTags: ["refined_weapon_material", "structural_stock", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 22, assemblyMultiplier: 1.50 }),
    heavy_melee: Object.freeze({ inputTags: ["refined_weapon_material", "structural_handle", "fasteners_hardware"], requiredToolType: "smithing_tools", semanticCheck: "smithing", baseThreshold: 22, assemblyMultiplier: 1.50 }),
    whip: Object.freeze({ inputTags: ["processed_leather", "fasteners_hardware"], requiredToolType: "textile_tools", semanticCheck: "leatherworking", baseThreshold: 22, assemblyMultiplier: 1.40 }),
    blowgun: Object.freeze({ inputTags: ["structural_stock", "precision_component"], requiredToolType: "technical_tools", semanticCheck: "precision_fabrication", baseThreshold: 18, assemblyMultiplier: 1.30 }),
    precision_crossbow: Object.freeze({ inputTags: ["housing_casing", "mechanical_parts", "precision_component", "wire_cable", "fasteners_hardware"], requiredToolType: "technical_tools", semanticCheck: "mechanical_fabrication", baseThreshold: 22, assemblyMultiplier: 1.65 }),
    reinforced_crossbow: Object.freeze({ inputTags: ["structural_stock", "mechanical_parts", "mechanical_assembly", "precision_component", "wire_cable", "fasteners_hardware"], requiredToolType: "technical_tools", semanticCheck: "mechanical_fabrication", baseThreshold: 22, assemblyMultiplier: 1.65 }),
    martial_bow: Object.freeze({ inputTags: ["structural_stock", "processed_textile"], requiredToolType: "fabrication_tools", semanticCheck: "woodcarving", baseThreshold: 22, assemblyMultiplier: 1.40 }),
    net: Object.freeze({ inputTags: ["processed_textile", "fasteners_hardware"], requiredToolType: "textile_tools", semanticCheck: "textile_work", baseThreshold: 18, assemblyMultiplier: 1.30 }),
  });

  function recipeFor(itemId, profileId) {
    const profile = RECIPE_PROFILES[normalizeId(profileId)];
    if (!profile) throw new Error(`Unknown weapon recipe profile: ${profileId}`);
    return Object.freeze({
      id: `craft_${normalizeId(itemId)}`,
      operation: "create",
      outputItemId: normalizeId(itemId),
      outputQuantity: 1,
      recipeProfile: normalizeId(profileId),
      inputTags: Object.freeze(profile.inputTags.slice()),
      requiredToolType: profile.requiredToolType,
      requiredToolConsumed: false,
      semanticCheck: profile.semanticCheck,
      baseThreshold: profile.baseThreshold,
      assemblyMultiplier: profile.assemblyMultiplier,
      improvisationAllowed: true,
      improvisedThresholdDelta: IMPROVISED_THRESHOLD_PENALTY,
      outputQuality: "craft_check",
      stationRequirement: null,
      stationRequirementStatus: STATION_REQUIREMENTS_STATUS,
      exactMaterialQuantitiesStatus: "deferred_material_binding",
    });
  }

  function weapon(def) {
    const id = normalizeId(def.id);
    const handCost = Math.max(1, Number(def.handCost || 1));
    return Object.freeze({
      id,
      name: def.name,
      family: FAMILY,
      category: "weapon",
      itemType: "weapon",
      classification: normalizeId(def.classification),
      weaponFamily: normalizeId(def.weaponFamily),
      iconFamily: normalizeId(def.iconFamily),
      damageType: normalizeId(def.damageType || "none"),
      currency: CURRENCY,
      purchasable: true,
      stackable: false,
      baseQuality: DEFAULT_QUALITY,
      qualitySystem: "weapon",
      pricingModel: PRICING_MODEL,
      priceReferenceScope: PRICE_REFERENCE_SCOPE,
      standardChassisValueAhn: Number(def.standardChassisValueAhn),
      baseDurability: Number(def.baseDurability),
      durabilitySystem: "weapon_quality_cycles",
      materialDurabilityModifierStatus: MATERIAL_DURABILITY_STATUS,
      equipment: Object.freeze({ handCost }),
      handCost,
      recipe: recipeFor(id, def.recipeProfile),
      tags: Object.freeze(["weapon", "equipment", normalizeId(def.classification), normalizeId(def.weaponFamily), normalizeId(def.iconFamily)]),
    });
  }

  const ITEMS = Object.freeze([
    weapon({ id: "club", name: "Club", classification: "simple_melee", weaponFamily: "blunt", iconFamily: "weapon_blunt", damageType: "blunt", standardChassisValueAhn: 12000, baseDurability: 35, handCost: 1, recipeProfile: "wooden_blunt" }),
    weapon({ id: "dagger", name: "Dagger", classification: "simple_melee", weaponFamily: "dagger", iconFamily: "weapon_dagger", damageType: "pierce", standardChassisValueAhn: 35000, baseDurability: 30, handCost: 1, recipeProfile: "small_blade" }),
    weapon({ id: "greatclub", name: "Greatclub", classification: "simple_melee", weaponFamily: "blunt", iconFamily: "weapon_blunt", damageType: "blunt", standardChassisValueAhn: 22000, baseDurability: 55, handCost: 2, recipeProfile: "wooden_blunt" }),
    weapon({ id: "handaxe", name: "Handaxe", classification: "simple_melee", weaponFamily: "axe", iconFamily: "weapon_axe", damageType: "slash", standardChassisValueAhn: 50000, baseDurability: 45, handCost: 1, recipeProfile: "headed_weapon" }),
    weapon({ id: "javelin", name: "Javelin", classification: "simple_melee", weaponFamily: "spear", iconFamily: "weapon_spear", damageType: "pierce", standardChassisValueAhn: 32000, baseDurability: 30, handCost: 1, recipeProfile: "hafted_piercing" }),
    weapon({ id: "light_hammer", name: "Light Hammer", classification: "simple_melee", weaponFamily: "hammer", iconFamily: "weapon_hammer", damageType: "blunt", standardChassisValueAhn: 40000, baseDurability: 40, handCost: 1, recipeProfile: "headed_weapon" }),
    weapon({ id: "mace", name: "Mace", classification: "simple_melee", weaponFamily: "blunt", iconFamily: "weapon_blunt", damageType: "blunt", standardChassisValueAhn: 55000, baseDurability: 50, handCost: 1, recipeProfile: "headed_weapon" }),
    weapon({ id: "quarterstaff", name: "Quarterstaff", classification: "simple_melee", weaponFamily: "staff", iconFamily: "weapon_staff", damageType: "blunt", standardChassisValueAhn: 18000, baseDurability: 40, handCost: 1, recipeProfile: "wooden_blunt" }),
    weapon({ id: "sickle", name: "Sickle", classification: "simple_melee", weaponFamily: "sickle", iconFamily: "weapon_dagger", damageType: "slash", standardChassisValueAhn: 32000, baseDurability: 25, handCost: 1, recipeProfile: "small_blade" }),
    weapon({ id: "spear", name: "Spear", classification: "simple_melee", weaponFamily: "spear", iconFamily: "weapon_spear", damageType: "pierce", standardChassisValueAhn: 45000, baseDurability: 45, handCost: 1, recipeProfile: "hafted_piercing" }),
    weapon({ id: "light_crossbow", name: "Light Crossbow", classification: "simple_ranged", weaponFamily: "crossbow", iconFamily: "weapon_crossbow", damageType: "pierce", standardChassisValueAhn: 140000, baseDurability: 50, handCost: 2, recipeProfile: "simple_mechanical_ranged" }),
    weapon({ id: "dart", name: "Dart", classification: "simple_ranged", weaponFamily: "dart", iconFamily: "weapon_dagger", damageType: "pierce", standardChassisValueAhn: 12000, baseDurability: 15, handCost: 1, recipeProfile: "small_blade" }),
    weapon({ id: "shortbow", name: "Shortbow", classification: "simple_ranged", weaponFamily: "bow", iconFamily: "weapon_bow", damageType: "pierce", standardChassisValueAhn: 85000, baseDurability: 35, handCost: 2, recipeProfile: "bow" }),
    weapon({ id: "sling", name: "Sling", classification: "simple_ranged", weaponFamily: "sling", iconFamily: "weapon_sling", damageType: "blunt", standardChassisValueAhn: 15000, baseDurability: 25, handCost: 1, recipeProfile: "sling" }),
    weapon({ id: "battleaxe", name: "Battleaxe", classification: "martial_melee", weaponFamily: "axe", iconFamily: "weapon_axe", damageType: "slash", standardChassisValueAhn: 95000, baseDurability: 55, handCost: 1, recipeProfile: "martial_headed" }),
    weapon({ id: "flail", name: "Flail", classification: "martial_melee", weaponFamily: "flail", iconFamily: "weapon_blunt", damageType: "blunt", standardChassisValueAhn: 110000, baseDurability: 50, handCost: 1, recipeProfile: "chained_blunt" }),
    weapon({ id: "glaive", name: "Glaive", classification: "martial_melee", weaponFamily: "polearm", iconFamily: "weapon_polearm", damageType: "slash", standardChassisValueAhn: 135000, baseDurability: 60, handCost: 2, recipeProfile: "polearm" }),
    weapon({ id: "greataxe", name: "Greataxe", classification: "martial_melee", weaponFamily: "axe", iconFamily: "weapon_axe", damageType: "slash", standardChassisValueAhn: 145000, baseDurability: 70, handCost: 2, recipeProfile: "heavy_melee" }),
    weapon({ id: "greatsword", name: "Greatsword", classification: "martial_melee", weaponFamily: "sword", iconFamily: "weapon_sword", damageType: "slash", standardChassisValueAhn: 160000, baseDurability: 65, handCost: 2, recipeProfile: "heavy_melee" }),
    weapon({ id: "halberd", name: "Halberd", classification: "martial_melee", weaponFamily: "polearm", iconFamily: "weapon_polearm", damageType: "slash", standardChassisValueAhn: 145000, baseDurability: 65, handCost: 2, recipeProfile: "polearm" }),
    weapon({ id: "lance", name: "Lance", classification: "martial_melee", weaponFamily: "spear", iconFamily: "weapon_spear", damageType: "pierce", standardChassisValueAhn: 130000, baseDurability: 60, handCost: 2, recipeProfile: "polearm" }),
    weapon({ id: "longsword", name: "Longsword", classification: "martial_melee", weaponFamily: "sword", iconFamily: "weapon_sword", damageType: "slash", standardChassisValueAhn: 100000, baseDurability: 50, handCost: 1, recipeProfile: "martial_blade" }),
    weapon({ id: "maul", name: "Maul", classification: "martial_melee", weaponFamily: "hammer", iconFamily: "weapon_hammer", damageType: "blunt", standardChassisValueAhn: 125000, baseDurability: 80, handCost: 2, recipeProfile: "heavy_melee" }),
    weapon({ id: "morningstar", name: "Morningstar", classification: "martial_melee", weaponFamily: "blunt", iconFamily: "weapon_blunt", damageType: "pierce", standardChassisValueAhn: 90000, baseDurability: 55, handCost: 1, recipeProfile: "martial_headed" }),
    weapon({ id: "pike", name: "Pike", classification: "martial_melee", weaponFamily: "spear", iconFamily: "weapon_spear", damageType: "pierce", standardChassisValueAhn: 110000, baseDurability: 60, handCost: 2, recipeProfile: "polearm" }),
    weapon({ id: "rapier", name: "Rapier", classification: "martial_melee", weaponFamily: "sword", iconFamily: "weapon_sword", damageType: "pierce", standardChassisValueAhn: 120000, baseDurability: 40, handCost: 1, recipeProfile: "martial_blade" }),
    weapon({ id: "scimitar", name: "Scimitar", classification: "martial_melee", weaponFamily: "sword", iconFamily: "weapon_sword", damageType: "slash", standardChassisValueAhn: 90000, baseDurability: 45, handCost: 1, recipeProfile: "martial_blade" }),
    weapon({ id: "shortsword", name: "Shortsword", classification: "martial_melee", weaponFamily: "sword", iconFamily: "weapon_sword", damageType: "pierce", standardChassisValueAhn: 80000, baseDurability: 40, handCost: 1, recipeProfile: "martial_blade" }),
    weapon({ id: "trident", name: "Trident", classification: "martial_melee", weaponFamily: "spear", iconFamily: "weapon_spear", damageType: "pierce", standardChassisValueAhn: 100000, baseDurability: 50, handCost: 1, recipeProfile: "polearm" }),
    weapon({ id: "war_pick", name: "War Pick", classification: "martial_melee", weaponFamily: "pick", iconFamily: "weapon_pick", damageType: "pierce", standardChassisValueAhn: 85000, baseDurability: 50, handCost: 1, recipeProfile: "martial_headed" }),
    weapon({ id: "warhammer", name: "Warhammer", classification: "martial_melee", weaponFamily: "hammer", iconFamily: "weapon_hammer", damageType: "blunt", standardChassisValueAhn: 95000, baseDurability: 65, handCost: 1, recipeProfile: "martial_headed" }),
    weapon({ id: "whip", name: "Whip", classification: "martial_melee", weaponFamily: "whip", iconFamily: "weapon_whip", damageType: "slash", standardChassisValueAhn: 60000, baseDurability: 35, handCost: 1, recipeProfile: "whip" }),
    weapon({ id: "blowgun", name: "Blowgun", classification: "martial_ranged", weaponFamily: "blowgun", iconFamily: "weapon_blowgun", damageType: "pierce", standardChassisValueAhn: 45000, baseDurability: 30, handCost: 1, recipeProfile: "blowgun" }),
    weapon({ id: "hand_crossbow", name: "Hand Crossbow", classification: "martial_ranged", weaponFamily: "crossbow", iconFamily: "weapon_crossbow", damageType: "pierce", standardChassisValueAhn: 180000, baseDurability: 40, handCost: 1, recipeProfile: "precision_crossbow" }),
    weapon({ id: "heavy_crossbow", name: "Heavy Crossbow", classification: "martial_ranged", weaponFamily: "crossbow", iconFamily: "weapon_crossbow", damageType: "pierce", standardChassisValueAhn: 240000, baseDurability: 70, handCost: 2, recipeProfile: "reinforced_crossbow" }),
    weapon({ id: "longbow", name: "Longbow", classification: "martial_ranged", weaponFamily: "bow", iconFamily: "weapon_bow", damageType: "pierce", standardChassisValueAhn: 130000, baseDurability: 45, handCost: 2, recipeProfile: "martial_bow" }),
    weapon({ id: "net", name: "Net", classification: "martial_ranged", weaponFamily: "net", iconFamily: "weapon_net", damageType: "none", standardChassisValueAhn: 35000, baseDurability: 25, handCost: 1, recipeProfile: "net" }),
  ]);

  const ALIASES = Object.freeze({ great_sword: "greatsword", short_sword: "shortsword", long_sword: "longsword", hand_axe: "handaxe", war_hammer: "warhammer", war_pickaxe: "war_pick", light_cross_bow: "light_crossbow", hand_cross_bow: "hand_crossbow", heavy_cross_bow: "heavy_crossbow", blow_gun: "blowgun" });

  function getQuality(value) { return QUALITY[normalizeId(value || DEFAULT_QUALITY)] || QUALITY.standard; }
  function get(id) {
    const key = normalizeId(id);
    const found = ITEMS.find((entry) => entry.id === (ALIASES[key] || key));
    return found ? clone(found) : null;
  }
  function list(options = {}) {
    const classification = normalizeId(options.classification);
    const weaponFamily = normalizeId(options.weaponFamily);
    const iconFamily = normalizeId(options.iconFamily);
    return ITEMS.filter((entry) => !classification || entry.classification === classification).filter((entry) => !weaponFamily || entry.weaponFamily === weaponFamily).filter((entry) => !iconFamily || entry.iconFamily === iconFamily).map(clone);
  }
  function chassisValueForQuality(itemOrId, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    return entry ? Math.round(entry.standardChassisValueAhn * getQuality(quality).valueMultiplier) : null;
  }
  function damageMultiplierForQuality(quality = DEFAULT_QUALITY) { return getQuality(quality).damageMultiplier; }
  function maxDurability(itemOrId, materialDurabilityModifier = 1, quality = DEFAULT_QUALITY) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const raw = Number(materialDurabilityModifier);
    const material = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return Math.max(1, Math.round(entry.baseDurability * material * getQuality(quality).durabilityMultiplier));
  }
  function degradeQuality(quality = DEFAULT_QUALITY) {
    const id = getQuality(quality).id;
    if (id === "ruined") return Object.freeze({ from: "ruined", to: null, destroyed: true });
    const index = QUALITY_ORDER.indexOf(id);
    return Object.freeze({ from: id, to: QUALITY_ORDER[Math.max(0, index - 1)] || "ruined", destroyed: false });
  }
  function resolveDurabilityBreak(itemOrId, state = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const quality = getQuality(state.quality || DEFAULT_QUALITY).id;
    const currentDurability = Number(state.currentDurability ?? 0);
    const materialModifier = Number(state.materialDurabilityModifier ?? 1) || 1;
    if (currentDurability > 0) return Object.freeze({ weaponId: entry.id, quality, currentDurability, maxDurability: maxDurability(entry, materialModifier, quality), destroyed: false, degraded: false, improvised: quality === "ruined" });
    const degraded = degradeQuality(quality);
    if (degraded.destroyed) return Object.freeze({ weaponId: entry.id, quality: "ruined", currentDurability: 0, maxDurability: maxDurability(entry, materialModifier, "ruined"), destroyed: true, degraded: false, improvised: true });
    const nextMax = maxDurability(entry, materialModifier, degraded.to);
    return Object.freeze({ weaponId: entry.id, quality: degraded.to, currentDurability: nextMax, maxDurability: nextMax, destroyed: false, degraded: true, improvised: degraded.to === "ruined" });
  }
  function repairState(itemOrId, state = {}) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    if (!entry) return null;
    const quality = getQuality(state.quality || DEFAULT_QUALITY).id;
    const materialModifier = Number(state.materialDurabilityModifier ?? 1) || 1;
    const max = maxDurability(entry, materialModifier, quality);
    return Object.freeze({ weaponId: entry.id, quality, currentDurability: max, maxDurability: max, destroyed: false, improvised: quality === "ruined" });
  }
  function getRecipe(itemOrId) {
    const entry = typeof itemOrId === "string" ? get(itemOrId) : clone(itemOrId);
    return entry?.recipe ? clone(entry.recipe) : null;
  }

  const API = Object.freeze({ VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, PRICING_MODEL, PRICE_REFERENCE_SCOPE, IMPROVISED_THRESHOLD_PENALTY, MATERIAL_DURABILITY_STATUS, STATION_REQUIREMENTS_STATUS, QUALITY_ORDER, QUALITY, RECIPE_PROFILES, ITEMS, ALIASES, normalizeId, getQuality, get, list, getRecipe, chassisValueForQuality, damageMultiplierForQuality, maxDurability, degradeQuality, resolveDurabilityBreak, repairState });
  global.LuminousWeaponCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
