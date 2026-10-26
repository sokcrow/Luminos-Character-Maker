(function (global) {
  "use strict";

  if (global.LuminousItemSizeLineageEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemSizeLineageEngine;
    return;
  }

  const VERSION = 1;
  const DEFAULT_SIZE = "medium";
  const HUNGER_MAX_PERCENT = 100;
  const RATION_HUNGER = 100;

  const SIZE_ORDER = Object.freeze([
    "tiny",
    "small",
    "medium",
    "large",
    "huge",
    "gargantuan",
  ]);

  const SIZE_PROFILES = Object.freeze({
    tiny: Object.freeze({ id: "tiny", label: "Tiny", multiplier: 0.25, hideUnits: 1, dailyHunger: 25, rationEquivalent: 0.25 }),
    small: Object.freeze({ id: "small", label: "Small", multiplier: 0.5, hideUnits: 2, dailyHunger: 50, rationEquivalent: 0.5 }),
    medium: Object.freeze({ id: "medium", label: "Medium", multiplier: 1, hideUnits: 4, dailyHunger: 100, rationEquivalent: 1 }),
    large: Object.freeze({ id: "large", label: "Large", multiplier: 2, hideUnits: 8, dailyHunger: 200, rationEquivalent: 2 }),
    huge: Object.freeze({ id: "huge", label: "Huge", multiplier: 4, hideUnits: 16, dailyHunger: 400, rationEquivalent: 4 }),
    gargantuan: Object.freeze({ id: "gargantuan", label: "Gargantuan", multiplier: 8, hideUnits: 32, dailyHunger: 800, rationEquivalent: 8 }),
  });

  function normalizeToken(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function canonicalSize(value) {
    const normalized = normalizeToken(value || DEFAULT_SIZE);
    return SIZE_PROFILES[normalized] ? normalized : DEFAULT_SIZE;
  }

  function getSize(value = DEFAULT_SIZE) {
    return SIZE_PROFILES[canonicalSize(value)];
  }

  function roundValue(value, mode = "round") {
    const number = Number(value) || 0;
    if (mode === "floor") return Math.floor(number);
    if (mode === "ceil") return Math.ceil(number);
    if (mode === "none") return number;
    return Math.round(number);
  }

  function scaleValue(baseValue, size = DEFAULT_SIZE, options = {}) {
    return roundValue((Number(baseValue) || 0) * getSize(size).multiplier, options.rounding || "round");
  }

  function hideUnitsForSize(size = DEFAULT_SIZE) {
    return getSize(size).hideUnits;
  }

  function hungerForSize(size = DEFAULT_SIZE) {
    return getSize(size).dailyHunger;
  }

  function rationEquivalentForSize(size = DEFAULT_SIZE) {
    return getSize(size).rationEquivalent;
  }

  function hungerPercent(currentHunger, size = DEFAULT_SIZE) {
    const max = hungerForSize(size);
    if (max <= 0) return 0;
    const raw = ((Number(currentHunger) || 0) / max) * HUNGER_MAX_PERCENT;
    return Math.max(0, Math.min(HUNGER_MAX_PERCENT, raw));
  }

  function normalizeLineageId(value) {
    return normalizeToken(value);
  }

  function titleCase(value) {
    return String(value || "")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function lineageFrom(value, fallbackName = "") {
    const raw = value && typeof value === "object" ? value : {};
    const id = normalizeLineageId(raw.lineageId || raw.id || fallbackName);
    const name = String(raw.lineageName || raw.name || fallbackName || titleCase(id)).trim();
    return { lineageId: id || "generic", lineageName: name || "Generic" };
  }

  function ingredientAmount(entry) {
    const explicit = Number(entry?.namingAmount);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const quantity = Number(entry?.quantity);
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const sizeMultiplier = getSize(entry?.size || DEFAULT_SIZE).multiplier;
    return qty * sizeMultiplier;
  }

  function resolveDominantLineage(ingredients, options = {}) {
    const eligibleFamilies = new Set((options.eligibleFamilies || []).map(normalizeToken).filter(Boolean));
    const totals = new Map();

    for (const ingredient of Array.isArray(ingredients) ? ingredients : []) {
      if (!ingredient || ingredient.identityEligible === false) continue;
      const family = normalizeToken(ingredient.family || ingredient.itemFamily || "");
      if (eligibleFamilies.size && !eligibleFamilies.has(family)) continue;
      const lineage = lineageFrom(ingredient, ingredient.materialName || ingredient.name || "");
      const amount = ingredientAmount(ingredient);
      if (!(amount > 0)) continue;
      const current = totals.get(lineage.lineageId) || { ...lineage, amount: 0 };
      current.amount += amount;
      totals.set(lineage.lineageId, current);
    }

    if (!totals.size) return null;
    const ranked = Array.from(totals.values()).sort((a, b) => b.amount - a.amount || a.lineageName.localeCompare(b.lineageName));
    const top = ranked[0];
    const tied = ranked.filter((entry) => Math.abs(entry.amount - top.amount) < 1e-9);
    if (tied.length > 1) {
      return Object.freeze({ lineageId: "mixed", lineageName: "Mixed", amount: top.amount, mixed: true });
    }
    return Object.freeze({ lineageId: top.lineageId, lineageName: top.lineageName, amount: top.amount, mixed: false });
  }

  function composeInheritedName(options = {}) {
    const prefix = String(options.prefix || "").trim();
    const lineageName = String(options.lineageName || "").trim();
    const materialName = String(options.materialName || "").trim();
    const suffix = String(options.suffix || "").trim();
    return [prefix, lineageName, materialName, suffix].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  const API = Object.freeze({
    VERSION,
    DEFAULT_SIZE,
    HUNGER_MAX_PERCENT,
    RATION_HUNGER,
    SIZE_ORDER,
    SIZE_PROFILES,
    normalizeToken,
    canonicalSize,
    getSize,
    scaleValue,
    hideUnitsForSize,
    hungerForSize,
    rationEquivalentForSize,
    hungerPercent,
    normalizeLineageId,
    lineageFrom,
    ingredientAmount,
    resolveDominantLineage,
    composeInheritedName,
  });

  global.LuminousItemSizeLineageEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
