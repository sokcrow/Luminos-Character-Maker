(function (global) {
  "use strict";

  const VERSION = "0.7.4-class-status-semantics";
  const RAGE_ICON = "https://imgur.com/j3C7GzS.png";
  const BARDIC_INSPIRATION_ICON = "https://imgur.com/LaZgHYg.png";
  const PSYCHIC_BLADE_ICON = "https://imgur.com/vEDE8Q8.png";
  const SECOND_WIND_ICON = "https://imgur.com/VSxnVEo.png";
  const INTERNAL_EFFECT_IDS = Object.freeze(new Set([
    "reckless_attack_armed",
    "countercharm",
  ]));
  const RESOURCE_ONLY_IDS = Object.freeze(new Set([
    "sorcery_points",
  ]));

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function isInternalEffectId(value) {
    return INTERNAL_EFFECT_IDS.has(normalizeId(value));
  }

  function isResourceOnlyId(value) {
    return RESOURCE_ONLY_IDS.has(normalizeId(value));
  }

  function registerClassStatuses() {
    const library = global.LuminousStatusLibrary;
    if (!library?.registerExtension) return false;

    library.registerExtension("rage", {
      name: "Rage",
      type: "positive",
      mode: "zero",
      icon: RAGE_ICON,
      description: "Barbarian Rage. A visible combat Status created by the Rage Quick Action and consumed by Barbarian/Archetype mechanics.",
      classId: "barbarian",
      visible: true,
    });

    library.registerExtension("bardic_inspiration", {
      name: "Bardic Inspiration",
      type: "positive",
      mode: "double",
      icon: BARDIC_INSPIRATION_ICON,
      description: "Bardic Inspiration. Potency is the Power bonus granted before a chosen Check or Skill; Count tracks the consumable Inspiration instance.",
      classId: "bard",
      visible: true,
    });

    library.registerExtension("psychic_blade", {
      name: "Psychic Blade",
      type: "positive",
      mode: "single",
      icon: PSYCHIC_BLADE_ICON,
      description: "College of Whispers Psychic Blade charges. Count tracks the remaining charges consumed by successful hits.",
      classId: "bard",
      archetypeId: "college_of_whispers",
      visible: true,
    });

    library.registerExtension("second_wind", {
      name: "Second Wind",
      type: "positive",
      mode: "single",
      icon: SECOND_WIND_ICON,
      description: "Fighter Second Wind. Count tracks the remaining Second Wind uses available during the Encounter.",
      classId: "fighter",
      visible: true,
    });

    return library.get?.("rage")?.icon === RAGE_ICON
      && library.get?.("bardic_inspiration")?.icon === BARDIC_INSPIRATION_ICON
      && library.get?.("psychic_blade")?.icon === PSYCHIC_BLADE_ICON
      && library.get?.("second_wind")?.icon === SECOND_WIND_ICON;
  }

  function patchRecklessAttack(definition) {
    if (!definition) return null;
    const next = clone(definition);

    next.effects = (next.effects || []).map((effect) => {
      const patched = clone(effect);
      if (normalizeId(patched.id) === "reckless_attack_arm") {
        patched.operations = [{ type: "set_flag", flagId: "reckless_attack_armed", value: true }];
      }
      return patched;
    });

    if (!next.effects.some((effect) => normalizeId(effect.id) === "reckless_attack_disarm")) {
      next.effects.push({
        id: "reckless_attack_disarm",
        contexts: ["combat"],
        trigger: "attack_end",
        conditions: [{ flagId: "reckless_attack_armed", operator: "truthy" }],
        operations: [{ type: "clear_flag", flagId: "reckless_attack_armed" }],
      });
    }

    next.rules = (next.rules || [])
      .filter((rule) => !(normalizeId(rule.type) === "status" && normalizeId(rule.statusId) === "reckless_attack_armed"))
      .map((rule) => {
        const patched = clone(rule);
        if (normalizeId(patched.whileStatus) === "reckless_attack_armed") {
          delete patched.whileStatus;
          patched.conditions = [
            ...(Array.isArray(patched.conditions) ? patched.conditions : []),
            { flagId: "reckless_attack_armed", operator: "truthy" },
          ];
        }
        return patched;
      });

    return next;
  }

  function patchTraitCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source) return false;
    if (source.__classStatusSemantics074) return true;

    const baseGet = typeof source.getDefinition === "function"
      ? source.getDefinition.bind(source)
      : (id) => clone(source.DEFINITIONS?.[normalizeId(id)] || null);
    const baseAll = typeof source.allDefinitions === "function"
      ? source.allDefinitions.bind(source)
      : () => clone(source.DEFINITIONS || {});

    const reckless = patchRecklessAttack(baseGet("reckless_attack"));
    if (!reckless) return false;

    const definitions = Object.freeze({
      ...(source.DEFINITIONS || baseAll()),
      reckless_attack: Object.freeze(clone(reckless)),
    });

    const getDefinition = (id) => normalizeId(id) === "reckless_attack"
      ? clone(reckless)
      : baseGet(id);
    const allDefinitions = () => ({ ...baseAll(), reckless_attack: clone(reckless) });

    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __classStatusSemantics074: true,
      DEFINITIONS: definitions,
      getDefinition,
      allDefinitions,
    });
    return true;
  }

  function patchStatusEngine() {
    const source = global.LuminousStatusEngine;
    if (!source) return false;
    if (source.__classStatusSemantics074) return true;

    const wrapped = Object.freeze({
      ...source,
      __classStatusSemantics074: true,
      listStatuses(unit) {
        const rows = typeof source.listStatuses === "function" ? source.listStatuses(unit) : [];
        return (rows || []).filter((entry) => !isInternalEffectId(entry?.id || entry?.instance?.id));
      },
    });

    global.LuminousStatusEngine = wrapped;
    return true;
  }

  function ensureFighterRuntime() {
    if (global.LuminousFighterClassRuntime) {
      global.LuminousFighterClassRuntime.install?.();
      return true;
    }
    if (typeof require === "function") {
      try {
        const runtime = require("./fighter-class-runtime.js");
        runtime?.install?.();
        if (runtime) return true;
      } catch (_) {}
    }
    if (!global.document) return false;
    if (global.document.getElementById("fighter-class-runtime-script")) return true;
    const script = global.document.createElement("script");
    script.id = "fighter-class-runtime-script";
    script.src = "js/fighter-class-runtime.js";
    script.async = false;
    global.document.head?.appendChild(script);
    return true;
  }

  function install() {
    const status = registerClassStatuses();
    const catalog = patchTraitCatalog();
    const engine = patchStatusEngine();
    ensureFighterRuntime();
    return { status, catalog, engine };
  }

  const api = Object.freeze({
    version: VERSION,
    RAGE_ICON,
    BARDIC_INSPIRATION_ICON,
    PSYCHIC_BLADE_ICON,
    SECOND_WIND_ICON,
    INTERNAL_EFFECT_IDS,
    RESOURCE_ONLY_IDS,
    isInternalEffectId,
    isResourceOnlyId,
    registerClassStatuses,
    patchTraitCatalog,
    patchStatusEngine,
    patchRecklessAttack,
    ensureFighterRuntime,
    install,
  });

  global.LuminousClassStatusSemantics = api;
  install();

  if (typeof global.setInterval === "function") {
    const timer = global.setInterval(() => {
      const result = install();
      if (result.status && result.catalog && result.engine) global.clearInterval?.(timer);
    }, 250);
    timer?.unref?.();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
