(function (global) {
  "use strict";

  if (global.LuminousItemQualityEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemQualityEngine;
    return;
  }

  const VERSION = 1;
  const DEFAULT_THRESHOLD = 18;

  const QUALITY_ORDER = Object.freeze(["ruined", "poor", "standard", "fine", "exceptional"]);
  const QUALITIES = Object.freeze({
    ruined: Object.freeze({
      id: "ruined",
      label: "Ruined",
      labelEs: "Arruinado",
      minMargin: Number.NEGATIVE_INFINITY,
      maxMargin: -8,
      effectMultiplier: 0.50,
      valueMultiplier: 0.25,
    }),
    poor: Object.freeze({
      id: "poor",
      label: "Poor",
      labelEs: "Pobre",
      minMargin: -7,
      maxMargin: -1,
      effectMultiplier: 0.75,
      valueMultiplier: 0.50,
    }),
    standard: Object.freeze({
      id: "standard",
      label: "Standard",
      labelEs: "Estándar",
      minMargin: 0,
      maxMargin: 3,
      effectMultiplier: 1.00,
      valueMultiplier: 1.00,
    }),
    fine: Object.freeze({
      id: "fine",
      label: "Fine",
      labelEs: "Fino",
      minMargin: 4,
      maxMargin: 7,
      effectMultiplier: 1.25,
      valueMultiplier: 1.50,
    }),
    exceptional: Object.freeze({
      id: "exceptional",
      label: "Exceptional",
      labelEs: "Excepcional",
      minMargin: 8,
      maxMargin: Number.POSITIVE_INFINITY,
      effectMultiplier: 1.50,
      valueMultiplier: 2.00,
    }),
  });

  const CRAFT_COMPLEXITY_THRESHOLDS = Object.freeze({
    generic: 18,
    workshop: 22,
    corp: 28,
  });

  const QUALITY_ALIASES = Object.freeze({
    damaged: "ruined",
    bad: "poor",
    normal: "standard",
    good: "fine",
    excellent: "exceptional",
  });

  const COMPLEXITY_ALIASES = Object.freeze({
    base: "generic",
    normal: "generic",
    generic: "generic",
    workshop: "workshop",
    corp: "corp",
    corporate: "corp",
    wing: "corp",
  });

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function canonicalQualityId(value) {
    const normalized = normalizeId(value || "standard");
    return QUALITY_ALIASES[normalized] || normalized;
  }

  function getQuality(value, options = {}) {
    const id = canonicalQualityId(value);
    if (QUALITIES[id]) return QUALITIES[id];
    return options.fallback === false ? null : QUALITIES.standard;
  }

  function resolveQualityFromMargin(margin) {
    const value = Number(margin);
    if (!Number.isFinite(value)) return QUALITIES.standard;
    if (value <= -8) return QUALITIES.ruined;
    if (value <= -1) return QUALITIES.poor;
    if (value <= 3) return QUALITIES.standard;
    if (value <= 7) return QUALITIES.fine;
    return QUALITIES.exceptional;
  }

  function resolveQuality(checkTotal, threshold = DEFAULT_THRESHOLD) {
    const total = Number(checkTotal);
    const target = Number(threshold);
    if (!Number.isFinite(total) || !Number.isFinite(target)) {
      return Object.freeze({
        checkTotal: Number.isFinite(total) ? total : null,
        threshold: Number.isFinite(target) ? target : DEFAULT_THRESHOLD,
        margin: 0,
        quality: QUALITIES.standard,
      });
    }
    const margin = total - target;
    return Object.freeze({
      checkTotal: total,
      threshold: target,
      margin,
      quality: resolveQualityFromMargin(margin),
    });
  }

  function canonicalComplexity(value) {
    const normalized = normalizeId(value || "generic");
    return COMPLEXITY_ALIASES[normalized] || normalized;
  }

  function craftingThreshold(complexity = "generic", thresholdAdjustment = 0) {
    const key = canonicalComplexity(complexity);
    const base = CRAFT_COMPLEXITY_THRESHOLDS[key] ?? DEFAULT_THRESHOLD;
    const adjustment = Number(thresholdAdjustment);
    return base + (Number.isFinite(adjustment) ? adjustment : 0);
  }

  function resolveCraftQuality(input = {}) {
    const threshold = input.threshold == null
      ? craftingThreshold(input.complexity || input.sourceLine || "generic", input.thresholdAdjustment || 0)
      : Number(input.threshold) + (Number(input.thresholdAdjustment) || 0);
    const checkTotal = Number(input.checkTotal ?? input.finalCheckPower ?? input.total);
    const result = resolveQuality(checkTotal, threshold);
    return Object.freeze({
      ...result,
      complexity: canonicalComplexity(input.complexity || input.sourceLine || "generic"),
    });
  }

  function roundValue(value, mode = "round") {
    if (!Number.isFinite(value)) return 0;
    if (mode === "none") return value;
    if (mode === "floor") return Math.floor(value);
    if (mode === "ceil") return Math.ceil(value);
    if (mode === "trunc") return Math.trunc(value);
    return Math.round(value);
  }

  function applyEffect(baseValue, quality = "standard", options = {}) {
    const base = Number(baseValue);
    if (!Number.isFinite(base)) return 0;
    const multiplier = getQuality(quality).effectMultiplier;
    return roundValue(base * multiplier, options.rounding || "none");
  }

  function applyValue(baseValue, quality = "standard", options = {}) {
    const base = Number(baseValue);
    if (!Number.isFinite(base)) return 0;
    const multiplier = getQuality(quality).valueMultiplier;
    return roundValue(base * multiplier, options.rounding || "round");
  }

  function describe(value) {
    const quality = getQuality(value);
    return Object.freeze({
      ...quality,
      effectPercent: Math.round((quality.effectMultiplier - 1) * 100),
      valuePercent: Math.round((quality.valueMultiplier - 1) * 100),
    });
  }

  const API = Object.freeze({
    VERSION,
    DEFAULT_THRESHOLD,
    QUALITY_ORDER,
    QUALITIES,
    QUALITY_ALIASES,
    CRAFT_COMPLEXITY_THRESHOLDS,
    COMPLEXITY_ALIASES,
    normalizeId,
    canonicalQualityId,
    getQuality,
    resolveQualityFromMargin,
    resolveQuality,
    canonicalComplexity,
    craftingThreshold,
    resolveCraftQuality,
    applyEffect,
    applyValue,
    describe,
  });

  global.LuminousItemQualityEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
