(function (global) {
  "use strict";

  if (global.LuminousItemAugmentationRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemAugmentationRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const items = () => global.LuminousItemRuntime || global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js") || safeRequire("./item-runtime-engine.js");
  const anatomy = () => global.LuminousAnatomyEquipmentEngine || safeRequire("./anatomy-equipment-engine.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function instanceIdOf(item = {}) {
    return String(item.instanceId || item.instance_id || items()?.itemId?.(item) || "").trim();
  }

  function categoryOf(item = {}) {
    return normalizeId(items()?.categoryOf?.(item) || item.category || item.itemType || item.type || item.tipo_categoria || "");
  }

  function augmentationProfile(item = {}) {
    const runtime = item.runtime && typeof item.runtime === "object" ? item.runtime : {};
    const explicit = runtime.augmentation || runtime.augment || item.augmentation || item.augment || item.augmentationProfile || {};
    return explicit && typeof explicit === "object" ? clone(explicit) : {};
  }

  function isAugmentation(item = {}) {
    return ["augmentation", "augment", "aumento", "alteracion_corporal"].includes(categoryOf(item)) || augmentationProfile(item).enabled === true;
  }

  function installedAugments(unit = {}, create = false) {
    const keys = ["augmentations", "augments", "bodyAugmentations"];
    for (const key of keys) {
      if (Array.isArray(unit[key])) return { key, value: unit[key] };
    }
    if (!create) return { key: "augmentations", value: [] };
    unit.augmentations = [];
    return { key: "augmentations", value: unit.augmentations };
  }

  function findInstalledAugment(unit, ref) {
    const wanted = String(typeof ref === "object" ? instanceIdOf(ref) : ref || "");
    return installedAugments(unit).value.find((entry) => {
      if (!entry) return false;
      if (entry === ref) return true;
      return String(entry.instanceId || entry.instance_id || entry.id || "") === wanted;
    }) || null;
  }

  function resolveAnatomy(unit = {}, options = {}) {
    const engine = anatomy();
    if (!engine?.resolveCharacterAnatomy) return null;
    return engine.resolveCharacterAnatomy(unit, options);
  }

  function requirementProfile(item = {}) {
    const profile = augmentationProfile(item);
    return {
      targetPartIds: asArray(profile.targetPartIds || profile.targetParts || profile.partIds).map(normalizeId).filter(Boolean),
      targetPartTypes: asArray(profile.targetPartTypes || profile.partTypes || profile.slots).map(normalizeId).filter(Boolean),
      requiredPartCount: Math.max(1, intOr(profile.requiredPartCount || profile.partCount, 1)),
      allowedSubstrates: asArray(profile.allowedSubstrates || profile.substrates).map(normalizeId).filter(Boolean),
      replaceBodyPart: clone(profile.replaceBodyPart || profile.replacesBodyPart || profile.replaces || null),
      addBodyParts: clone(profile.addBodyParts || profile.addBodyPart || profile.addsBodyParts || null),
      removable: profile.removable !== false && item.removable !== false,
      installationDifficulty: profile.installationDifficulty ?? item.installationDifficulty ?? null,
      removalDifficulty: profile.removalDifficulty ?? item.removalDifficulty ?? null,
    };
  }

  function validateBodyRequirements(unit, item, options = {}) {
    const engine = anatomy();
    const resolved = resolveAnatomy(unit, options);
    if (!resolved || !engine) return { allowed: false, reason: "anatomy_engine_unavailable" };
    const requirements = requirementProfile(item);
    const matchedPartIds = [];

    if (requirements.targetPartIds.length) {
      for (const partId of requirements.targetPartIds) {
        const part = resolved.parts?.[partId];
        if (!part || !engine.isPartUsable?.(part)) return { allowed: false, reason: "required_body_part_unavailable", partId };
        if (requirements.allowedSubstrates.length && !requirements.allowedSubstrates.includes(normalizeId(part.substrate))) {
          return { allowed: false, reason: "body_part_substrate_incompatible", partId, substrate: part.substrate };
        }
        matchedPartIds.push(partId);
      }
    }

    if (requirements.targetPartTypes.length) {
      for (const type of requirements.targetPartTypes) {
        const parts = engine.partsByType?.(resolved, type, { usableOnly: true }) || [];
        const compatible = requirements.allowedSubstrates.length
          ? parts.filter((part) => requirements.allowedSubstrates.includes(normalizeId(part.substrate)))
          : parts;
        if (compatible.length < requirements.requiredPartCount) return { allowed: false, reason: "required_body_part_type_unavailable", partType: type, required: requirements.requiredPartCount, available: compatible.length };
        compatible.slice(0, requirements.requiredPartCount).forEach((part) => matchedPartIds.push(part.id));
      }
    }

    return { allowed: true, anatomy: resolved, requirements, matchedPartIds: [...new Set(matchedPartIds)] };
  }

  function canInstallAugment(unit, itemInput, options = {}) {
    const item = typeof itemInput === "object" ? itemInput : items()?.findItem?.(unit, itemInput, { container: options.container || "active" });
    if (!unit || !item) return { allowed: false, reason: "missing_unit_or_item" };
    if (!isAugmentation(item)) return { allowed: false, reason: "item_not_augmentation", item };
    const id = instanceIdOf(item);
    if (!id) return { allowed: false, reason: "missing_item_instance_id", item };
    if (findInstalledAugment(unit, id)) return { allowed: false, reason: "augmentation_already_installed", item };
    const body = validateBodyRequirements(unit, item, options);
    if (!body.allowed) return { ...body, item };
    if (typeof options.checkInstallation === "function") {
      const check = options.checkInstallation(unit, item, body.requirements);
      if (check === false || check?.allowed === false) return { allowed: false, reason: check?.reason || "augmentation_installation_check_failed", item, body };
    }
    return { allowed: true, item, body };
  }

  function installAugment(unit, itemInput, options = {}) {
    const gate = canInstallAugment(unit, itemInput, options);
    if (!gate.allowed) return { installed: false, ...gate };
    const item = gate.item;
    const store = installedAugments(unit, true).value;
    item.installed = true;
    item.equipped = true;
    item.installedBodyPartIds = clone(gate.body.matchedPartIds || []);
    item.installedByWorkshopId = options.installedByWorkshopId || item.installedByWorkshopId || null;
    item.installedAt = options.installedAt || item.installedAt || null;
    store.push(item);
    const resolved = resolveAnatomy(unit, options);
    const result = { installed: true, item, installedBodyPartIds: clone(item.installedBodyPartIds), anatomy: resolved };
    emit("luminous:augmentation-installed", { unit, ...result });
    return result;
  }

  function canRemoveAugment(unit, itemInput, options = {}) {
    const item = typeof itemInput === "object" ? itemInput : findInstalledAugment(unit, itemInput);
    if (!unit || !item) return { allowed: false, reason: "augmentation_not_installed" };
    const profile = requirementProfile(item);
    if (!profile.removable && options.force !== true) return { allowed: false, reason: "augmentation_not_removable", item, profile };
    if (typeof options.checkRemoval === "function") {
      const check = options.checkRemoval(unit, item, profile);
      if (check === false || check?.allowed === false) return { allowed: false, reason: check?.reason || "augmentation_removal_check_failed", item, profile };
    }
    return { allowed: true, item, profile };
  }

  function removeAugment(unit, itemInput, options = {}) {
    const gate = canRemoveAugment(unit, itemInput, options);
    if (!gate.allowed) return { removed: false, ...gate };
    const store = installedAugments(unit, true);
    const id = instanceIdOf(gate.item);
    unit[store.key] = store.value.filter((entry) => instanceIdOf(entry) !== id);
    gate.item.installed = false;
    gate.item.equipped = false;
    gate.item.installedBodyPartIds = [];
    const result = { removed: true, item: gate.item, anatomy: resolveAnatomy(unit, options) };
    emit("luminous:augmentation-removed", { unit, ...result });
    return result;
  }

  function collectAugmentModifierTraits(unit = {}) {
    const traits = [];
    installedAugments(unit).value.forEach((item) => {
      const source = `augmentation:${instanceIdOf(item) || item.id || "item"}`;
      const raw = item.modifiers || item.modifierTraits || item.runtime?.modifiers || augmentationProfile(item).modifiers;
      asArray(raw).forEach((modifier, index) => {
        if (!modifier || typeof modifier !== "object") return;
        traits.push({
          id: `${source}:modifier:${index}`,
          name: item.displayName || item.name || item.nombre || "Augmentation",
          enabled: true,
          mechanics: { modifiers: [clone(modifier)] },
          sourceType: "augmentation",
          sourceItemInstanceId: instanceIdOf(item),
        });
      });
    });
    return traits;
  }

  let modifierBridgeBase = null;
  function installModifierBridge() {
    const current = global.LuminousUniversalModifiers || safeRequire("./universal-modifier-engine.js");
    if (!current) return false;
    if (current.__luminousAugmentationBridge) return true;
    modifierBridgeBase = current;
    const mergeTraits = (options = {}) => {
      const unit = options.unit || options.character || {};
      return { ...options, traits: [...asArray(options.traits), ...collectAugmentModifierTraits(unit)] };
    };
    global.LuminousUniversalModifiers = Object.freeze({
      ...current,
      __luminousAugmentationBridge: true,
      __luminousAugmentationBase: current,
      resolveTraitModifiers(options = {}) { return current.resolveTraitModifiers(mergeTraits(options)); },
      resolveStats(options = {}) { return current.resolveStats(mergeTraits(options)); },
    });
    return true;
  }

  const api = Object.freeze({
    version: 1,
    augmentationProfile,
    isAugmentation,
    installedAugments,
    findInstalledAugment,
    resolveAnatomy,
    requirementProfile,
    validateBodyRequirements,
    canInstallAugment,
    installAugment,
    canRemoveAugment,
    removeAugment,
    collectAugmentModifierTraits,
    installModifierBridge,
  });

  global.LuminousItemAugmentationRuntime = api;
  installModifierBridge();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
