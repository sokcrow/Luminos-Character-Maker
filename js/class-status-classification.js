(function (global) {
  "use strict";

  const VERSION = "0.7.4-class-status-classification";
  if (global.LuminousClassStatusClassification?.version === VERSION) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousClassStatusClassification;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  // These are mechanical markers/resources used by Traits and Classes. They are
  // deliberately NOT Status Library entries and must never render in the Status HUD.
  const INTERNAL_TRAIT_EFFECT_IDS = Object.freeze([
    "reckless_attack_armed",
    "countercharm",
  ]);
  const RESOURCE_ONLY_IDS = Object.freeze([
    "sorcery_points",
    "sorcerypoints",
  ]);
  const internalIds = new Set(INTERNAL_TRAIT_EFFECT_IDS);
  const resourceIds = new Set(RESOURCE_ONLY_IDS);

  const RAGE_DEFINITION = Object.freeze({
    name: "Rage",
    type: "positive",
    mode: "zero",
    icon: "https://imgur.com/j3C7GzS.png",
    category: "class_status",
    sourceClassId: "barbarian",
    description: "Barbarian Rage. Its mechanics, duration, restrictions and scaling are supplied by the Barbarian Trait runtime.",
  });

  function library() {
    return global.LuminousStatusLibrary || null;
  }

  function isInternalTraitEffect(statusId) {
    return internalIds.has(normalizeId(statusId));
  }

  function isResourceOnly(statusId) {
    return resourceIds.has(normalizeId(statusId));
  }

  function isVisibleStatus(statusId) {
    const id = normalizeId(statusId);
    return Boolean(id && !internalIds.has(id) && !resourceIds.has(id));
  }

  function installRage() {
    const statusLibrary = library();
    if (!statusLibrary?.registerExtension) return false;
    if (!statusLibrary.has?.("rage")) statusLibrary.registerExtension("rage", RAGE_DEFINITION);
    return Boolean(statusLibrary.get?.("rage"));
  }

  function installStatusEngineBridge() {
    const source = global.LuminousStatusEngine;
    if (!source) return false;
    if (source.__classStatusClassification074) return true;

    const wrapped = Object.freeze({
      ...source,
      __classStatusClassification074: true,
      isInternalTraitEffect,
      isResourceOnly,
      isVisibleStatus,
      getDefinition(statusId) {
        const id = normalizeId(statusId);
        if (isInternalTraitEffect(id)) {
          return {
            id,
            name: id,
            type: "internal",
            mode: "zero",
            icon: null,
            rules: [],
            hidden: true,
            internalEffect: true,
            description: "Internal Trait effect marker; not a Status Effect.",
          };
        }
        return source.getDefinition(statusId);
      },
      listStatuses(unit) {
        const entries = source.listStatuses?.(unit) || [];
        return entries.filter((entry) => isVisibleStatus(entry?.id || entry?.instance?.id));
      },
    });

    global.LuminousStatusEngine = wrapped;
    return true;
  }

  function install() {
    const rage = installRage();
    const statusEngine = installStatusEngineBridge();
    return { rage, statusEngine };
  }

  const api = Object.freeze({
    version: VERSION,
    rageDefinition: clone(RAGE_DEFINITION),
    internalTraitEffectIds: INTERNAL_TRAIT_EFFECT_IDS,
    resourceOnlyIds: RESOURCE_ONLY_IDS,
    isInternalTraitEffect,
    isResourceOnly,
    isVisibleStatus,
    installRage,
    installStatusEngineBridge,
    install,
  });

  global.LuminousClassStatusClassification = api;
  install();

  const timer = typeof global.setInterval === "function" ? global.setInterval(() => {
    installRage();
    installStatusEngineBridge();
  }, 250) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
