(function (global) {
  "use strict";

  if (global.LuminousItemEquipmentCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEquipmentCore;
    return;
  }

  const ROMAN = Object.freeze(["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  const VALID_CATEGORIES = new Set(["material", "weapon", "armor", "accessory", "module", "shield", "consumable", "augmentation", "item"]);
  const LOCAL_ID_RE = /^[a-z0-9][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*)*$/;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function tierToRoman(value) {
    const tier = clamp(Math.trunc(numberOr(value, 1)), 1, 10);
    return ROMAN[tier];
  }

  function romanToTier(value) {
    if (Number.isFinite(Number(value))) return clamp(Math.trunc(Number(value)), 1, 10);
    const normalized = String(value ?? "").trim().toUpperCase().replace(/^TIER\s+/, "");
    const index = ROMAN.indexOf(normalized);
    return index > 0 ? index : 1;
  }

  function readTier(definition = {}) {
    return romanToTier(definition.tierValue ?? definition.tier_value ?? definition.tier ?? definition.rareza ?? 1);
  }

  function canonicalId(type, localId) {
    const normalizedType = normalizeId(type).replace(/_/g, "-");
    const id = String(localId ?? "").trim().toLowerCase();
    if (!LOCAL_ID_RE.test(id)) throw new Error(`Invalid explicit local id: ${localId}`);
    if (!LOCAL_ID_RE.test(normalizedType)) throw new Error(`Invalid content type: ${type}`);
    return `${normalizedType}:${id}`;
  }

  function workshopName(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return /\bworkshop\b/i.test(raw) ? raw : `${raw} Workshop`;
  }

  function displayProductName(spec = {}) {
    const maker = workshopName(spec.workshopName ?? spec.manufacturerName ?? spec.workshop ?? "");
    const product = String(spec.productName ?? spec.name ?? spec.label ?? "Equipment").trim();
    const mark = clamp(Math.trunc(numberOr(spec.mark ?? spec.mk ?? 1, 1)), 1, 10);
    const prefix = maker ? `${maker} ` : "";
    return `${prefix}${product}${mark > 1 ? ` MK ${tierToRoman(mark)}` : ""}`.trim();
  }

  function glyphFor(definition = {}) {
    const category = normalizeId(definition.category || definition.tipo_categoria || definition.type || "item");
    const subtype = normalizeId(definition.subtype || definition.family || definition.chassisFamily || "");
    if (definition.visual?.glyph) return definition.visual.glyph;
    if (category === "weapon") return subtype.includes("firearm") ? "weapon_firearm" : "weapon";
    if (category === "armor") return "armor";
    if (category === "accessory") return "accessory";
    if (category === "module") return "module";
    if (category === "material") return "material";
    return "item";
  }

  function normalizeDefinition(raw = {}) {
    const id = String(raw.id ?? raw.localId ?? "").trim().toLowerCase();
    if (!LOCAL_ID_RE.test(id)) throw new Error("New ItemDefinition requires an explicit Firebase-safe id.");
    const category = normalizeId(raw.category || raw.tipo_categoria || raw.type || "item");
    const tier = readTier(raw);
    const name = String(raw.name ?? raw.nombre ?? id).trim();
    return {
      ...clone(raw),
      schemaVersion: Math.max(2, Math.trunc(numberOr(raw.schemaVersion, 2))),
      id,
      canonicalId: raw.canonicalId || canonicalId(raw.contentType || (category === "module" ? "module" : "item"), id),
      category: VALID_CATEGORIES.has(category) ? category : "item",
      name,
      tier,
      tierValue: tier,
      mark: clamp(Math.trunc(numberOr(raw.mark ?? raw.mk ?? 1, 1)), 1, 10),
      visual: {
        mode: raw.visual?.customAsset ? "custom" : (raw.visual?.mode || "auto"),
        glyph: glyphFor({ ...raw, category }),
        customAsset: raw.visual?.customAsset || raw.icono || null,
        ...(raw.visual || {}),
      },
      economy: {
        basePriceAhn: Math.max(0, numberOr(raw.economy?.basePriceAhn ?? raw.basePriceAhn ?? raw.price, 0)),
        ...(raw.economy || {}),
      },
      tags: Array.from(new Set((raw.tags || []).map(normalizeId).filter(Boolean))),
    };
  }

  function createInstance(definition, options = {}) {
    const normalized = normalizeDefinition(definition);
    const instanceId = String(options.instanceId || `itm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    return {
      schemaVersion: 2,
      instanceId,
      definitionId: normalized.canonicalId,
      quantity: Math.max(1, Math.trunc(numberOr(options.quantity, 1))),
      condition: {
        current: Math.max(0, numberOr(options.condition?.current, 100)),
        max: Math.max(1, numberOr(options.condition?.max, 100)),
      },
      installedModules: clone(options.installedModules || []),
      customName: options.customName || null,
      provenance: clone(options.provenance || {}),
      equipped: options.equipped === true,
    };
  }

  function resolveElement(element, runtime = global.LuminousElementalStatusRuntime) {
    const id = normalizeId(element);
    if (!id || !runtime) return null;
    const sinMap = runtime.ELEMENT_TO_SIN || {};
    const statusMap = runtime.ELEMENT_TO_STATUS || {};
    const sin = sinMap[id] || null;
    const status = statusMap[id] || null;
    return sin || status ? { element: id, sin, status } : null;
  }

  function legacyProjection(definition = {}) {
    const item = normalizeDefinition(definition);
    return {
      ...clone(definition),
      schemaVersion: 2,
      id: item.id,
      canonicalId: item.canonicalId,
      nombre: item.name,
      name: item.name,
      tier: tierToRoman(item.tier),
      tier_value: item.tier,
      price: item.economy.basePriceAhn,
      tipo_categoria: item.category,
      category: item.category,
      tags: item.tags,
      icono: item.visual.customAsset || "",
      visual: item.visual,
      mark: item.mark,
      displayName: displayProductName({
        workshopName: item.workshop?.name || item.manufacturerName || item.workshopName,
        productName: item.productName || item.name,
        mark: item.mark,
      }),
    };
  }

  const api = Object.freeze({
    ROMAN,
    LOCAL_ID_RE,
    normalizeId,
    tierToRoman,
    romanToTier,
    readTier,
    canonicalId,
    workshopName,
    displayProductName,
    glyphFor,
    normalizeDefinition,
    createInstance,
    resolveElement,
    legacyProjection,
  });

  global.LuminousItemEquipmentCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
