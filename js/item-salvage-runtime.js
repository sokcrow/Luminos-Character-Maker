(function (global) {
  "use strict";

  if (global.LuminousItemSalvageRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemSalvageRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const items = () => global.LuminousItemInventoryRuntime || global.LuminousItemRuntime || safeRequire("./item-inventory-runtime.js") || safeRequire("./item-runtime-engine.js");
  const workshops = () => global.LuminousWorkshopRuntime || safeRequire("./workshop-runtime.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const DEFAULT_BANDS = Object.freeze([
    { id: "condition:76_100", min: 76, max: 100, materialYieldMultiplier: 0.80, moduleRecoveryChance: 0.85, signatureComponentRecoveryChance: 0.65, signatureBlueprintDiscoveryChance: 0.10 },
    { id: "condition:51_75", min: 51, max: 75, materialYieldMultiplier: 0.60, moduleRecoveryChance: 0.65, signatureComponentRecoveryChance: 0.40, signatureBlueprintDiscoveryChance: 0.08 },
    { id: "condition:26_50", min: 26, max: 50, materialYieldMultiplier: 0.40, moduleRecoveryChance: 0.40, signatureComponentRecoveryChance: 0.20, signatureBlueprintDiscoveryChance: 0.05 },
    { id: "condition:1_25", min: 1, max: 25, materialYieldMultiplier: 0.20, moduleRecoveryChance: 0.20, signatureComponentRecoveryChance: 0.05, signatureBlueprintDiscoveryChance: 0.02 },
    { id: "condition:0", min: 0, max: 0, materialYieldMultiplier: 0.10, moduleRecoveryChance: 0.10, signatureComponentRecoveryChance: 0.00, signatureBlueprintDiscoveryChance: 0.00 },
  ]);

  function conditionPercent(item = {}) {
    const state = items()?.getCondition?.(item);
    if (state && Number.isFinite(Number(state.max)) && Number(state.max) > 0) return Math.max(0, Math.min(100, (Number(state.current) / Number(state.max)) * 100));
    const max = Math.max(1, numberOr(item.conditionMax ?? item.maxCondition, 100));
    const current = Math.max(0, Math.min(max, numberOr(item.condition, max)));
    return (current / max) * 100;
  }

  function conditionBand(item, options = {}) {
    const pct = conditionPercent(item);
    const bands = asArray(options.bands || DEFAULT_BANDS);
    return clone(bands.find((band) => pct >= numberOr(band.min, 0) && pct <= numberOr(band.max, 100)) || bands[bands.length - 1] || DEFAULT_BANDS[DEFAULT_BANDS.length - 1]);
  }

  function salvageProfile(item = {}) {
    const runtime = item.runtime && typeof item.runtime === "object" ? item.runtime : {};
    const profile = runtime.salvage || item.salvage || item.salvageProfile || {};
    return profile && typeof profile === "object" ? clone(profile) : {};
  }

  function normalizeMaterials(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((entry) => typeof entry === "string" ? { id: entry, quantity: 1 } : { ...clone(entry), id: entry?.id || entry?.materialId || entry?.definitionId, quantity: Math.max(0, numberOr(entry?.quantity ?? entry?.qty, 1)) }).filter((entry) => entry.id);
    if (typeof raw === "object") return Object.entries(raw).map(([id, quantity]) => ({ id, quantity: Math.max(0, numberOr(quantity, 0)) })).filter((entry) => entry.quantity > 0);
    return [];
  }

  function seededRandom(item, options = {}) {
    if (typeof options.random === "function") return options.random;
    const seed = options.seed || `${item.instanceId || item.definitionId || item.id || "item"}:salvage:${item.condition ?? 100}`;
    return workshops()?.seededRandom?.(seed) || Math.random;
  }

  function moduleDefinition(moduleRef, options = {}) {
    if (moduleRef && typeof moduleRef === "object") return moduleRef;
    const id = String(moduleRef || "");
    const catalog = options.moduleCatalog || options.modules || {};
    if (Array.isArray(catalog)) return catalog.find((entry) => String(entry?.id || entry?.moduleId || entry?.definitionId || "") === id) || { id };
    return catalog[id] || { id };
  }

  function isStructural(module = {}) {
    const cls = normalizeId(module.technologyClass || module.moduleClass || module.class || module.runtime?.technologyClass || "module");
    return cls === "structural_tech" || cls === "structural_technology";
  }

  function canSalvage(item, options = {}) {
    if (!item || typeof item !== "object") return { allowed: false, reason: "missing_item" };
    if (item.salvageable === false || salvageProfile(item).salvageable === false) return { allowed: false, reason: "item_not_salvageable" };
    if (item.equipped === true && options.allowEquipped !== true) return { allowed: false, reason: "item_equipped" };
    return { allowed: true, band: conditionBand(item, options), profile: salvageProfile(item) };
  }

  function salvageItem(item, options = {}) {
    const gate = canSalvage(item, options);
    if (!gate.allowed) return { salvaged: false, ...gate };
    const random = seededRandom(item, options);
    const band = gate.band;
    const profile = gate.profile;
    const baseMaterials = normalizeMaterials(options.materials || profile.materials || item.salvageMaterials || item.materials);
    const materials = baseMaterials.map((entry) => ({
      ...entry,
      quantity: Math.max(0, Math.floor(numberOr(entry.quantity, 0) * numberOr(band.materialYieldMultiplier, 0))),
    })).filter((entry) => entry.quantity > 0);

    const moduleRefs = [...new Set([
      ...asArray(item.installedModuleIds),
      ...asArray(item.installedModules).map((entry) => typeof entry === "string" ? entry : (entry?.definitionId || entry?.id || entry?.moduleId)).filter(Boolean),
    ].map(String))];
    const recoveredModules = [];
    const destroyedModules = [];
    moduleRefs.forEach((ref) => {
      const definition = moduleDefinition(ref, options);
      if (isStructural(definition) || definition.removable === false) {
        destroyedModules.push({ id: ref, reason: "structural_or_non_removable" });
        return;
      }
      if (random() <= numberOr(band.moduleRecoveryChance, 0)) recoveredModules.push(ref);
      else destroyedModules.push({ id: ref, reason: "recovery_roll_failed" });
    });

    const signatureComponents = asArray(item.signatureComponents || profile.signatureComponents).map((entry) => typeof entry === "string" ? { id: entry } : clone(entry)).filter((entry) => entry?.id || entry?.componentId);
    const recoveredSignatureComponents = [];
    signatureComponents.forEach((entry) => {
      if (entry.salvageable === false) return;
      if (random() <= numberOr(band.signatureComponentRecoveryChance, 0)) recoveredSignatureComponents.push(entry);
    });

    const discoveredBlueprints = [];
    const blueprintIds = asArray(profile.signatureBlueprintIds || item.signatureBlueprintIds).map(String).filter(Boolean);
    blueprintIds.forEach((id) => {
      if (random() <= numberOr(band.signatureBlueprintDiscoveryChance, 0)) discoveredBlueprints.push(id);
    });

    const result = {
      salvaged: true,
      sourceInstanceId: item.instanceId || null,
      sourceDefinitionId: item.definitionId || item.id || null,
      conditionPercent: conditionPercent(item),
      band,
      materials,
      recoveredModules,
      destroyedModules,
      recoveredSignatureComponents,
      discoveredBlueprints,
      structuralTechnologyRecoveredAsModule: false,
    };

    if (options.consumeSource === true) {
      item.quantity = Math.max(0, intOr(item.quantity ?? item.cantidad, 1) - 1);
      result.sourceConsumed = true;
    } else result.sourceConsumed = false;
    return result;
  }

  const api = Object.freeze({
    version: 1,
    DEFAULT_BANDS: clone(DEFAULT_BANDS),
    conditionPercent,
    conditionBand,
    salvageProfile,
    normalizeMaterials,
    isStructural,
    canSalvage,
    salvageItem,
  });

  global.LuminousItemSalvageRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
