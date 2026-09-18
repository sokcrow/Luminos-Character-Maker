(function (global) {
  "use strict";

  if (global.LuminousShieldUpgradeEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShieldUpgradeEngine;
    return;
  }

  function safeRequire(path) { if (typeof require !== "function") return null; try { return require(path); } catch (_) { return null; } }
  const Materials = global.LuminousArmorMaterialProfile || safeRequire("./item-armor-material-profile.js");
  const Components = global.LuminousShieldComponentCatalog || safeRequire("./item-catalog-shield-components.js");
  const Catalog = global.LuminousShieldUpgradeCatalog || safeRequire("./item-catalog-shield-upgrades.js");
  const WeaponComponents = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  if (!Materials || !Components || !Catalog) throw new Error("Shield material/component/upgrade catalogs are required before LuminousShieldUpgradeEngine.");

  const VERSION = 1;
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) { return Catalog.normalizeId(value); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function asSpec(value) { return typeof value === "string" ? { id:value } : (value || {}); }

  function structuralMaterial(component) {
    return component?.primaryMaterial || component?.composition?.find((row) => row.primaryMaterial)?.material || component?.composition?.[0]?.material || null;
  }
  function flexibleMaterial(component) {
    return component?.composition?.find((row) => (row.material?.tags || []).includes("flexible"))?.material || null;
  }
  function resolveRecipeMaterial(input, component, spec = {}) {
    const choice = spec.materials?.[input.slot]
      ?? spec.materials?.material
      ?? spec.material
      ?? (input.defaultSource === "component_flexible" ? flexibleMaterial(component) : structuralMaterial(component))
      ?? input.referenceMaterialId;
    const material = Materials.resolve(choice, typeof choice === "object" ? choice : {});
    const tags = new Set(material.tags || []);
    const missing = (input.requirements || []).filter((tag) => !tags.has(normalizeId(tag)));
    return { valid:missing.length === 0, material, missing };
  }
  function shortBladeValue(component, spec = {}) {
    const explicit = Number(spec.shortBladeComponent?.productionValueAhn ?? spec.shortBladeValueAhn);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    if (!WeaponComponents?.resolveComponent) return null;
    const material = spec.materials?.blade ?? spec.bladeMaterial ?? structuralMaterial(component) ?? "iron";
    const resolved = WeaponComponents.resolveComponent("short_blade", { body:material }, { quality:spec.shortBladeQuality || "standard" });
    return Number.isFinite(Number(resolved?.productionValueAhn)) ? Number(resolved.productionValueAhn) : null;
  }
  function recipeValue(def, component, spec = {}) {
    const recipe = def.recipe || {};
    if (Number(recipe.workRatio || 0) > 0) {
      return Components.roundAhn(Number(component.productionValueAhn || 0) * Number(recipe.workRatio));
    }
    let inputValue = 0;
    for (const input of recipe.materialInputs || []) {
      const resolved = resolveRecipeMaterial(input, component, spec);
      if (!resolved.valid) return { valid:false, reason:"incompatible_upgrade_material", upgradeId:def.id, slot:input.slot, missing:resolved.missing, materialId:resolved.material.id };
      inputValue += Number(input.quantity || 1) * Number(resolved.material.unitValueAhn || 0);
    }
    for (const input of recipe.componentInputs || []) {
      if (input.componentId !== "short_blade") return { valid:false, reason:"unsupported_upgrade_component_input", componentId:input.componentId, upgradeId:def.id };
      const value = shortBladeValue(component, spec);
      if (!Number.isFinite(value)) return { valid:false, reason:"missing_short_blade_value", upgradeId:def.id };
      inputValue += Number(input.quantity || 1) * value;
    }
    return { valid:true, value:Components.roundAhn(inputValue * Number(recipe.processMultiplier || 1)) };
  }

  function resolvedSurfaces(component, defs = []) {
    const set = new Set((component.baseSurfaces || []).map(normalizeId));
    defs.forEach((def) => (def.addSurfaces || []).forEach((surface) => set.add(normalizeId(surface))));
    return set;
  }

  function validateLoadout(component, upgradeSpecs = []) {
    if (!component?.valid) return Object.freeze({ valid:false, reason:"invalid_component" });
    const specs = (upgradeSpecs || []).map(asSpec);
    const defs = [];
    const ids = [];
    const groups = new Set();
    let slotsUsed = 0;
    for (const spec of specs) {
      const id = normalizeId(spec.id);
      if (!id) continue;
      if (ids.includes(id)) return Object.freeze({ valid:false, reason:"duplicate_upgrade", upgradeId:id });
      const def = Catalog.get(id);
      if (!def) return Object.freeze({ valid:false, reason:"unknown_upgrade", upgradeId:id });
      if (!def.allowedComponents.includes(normalizeId(component.componentId))) return Object.freeze({ valid:false, reason:"incompatible_upgrade", upgradeId:id, componentId:component.componentId });
      if (groups.has(def.group)) return Object.freeze({ valid:false, reason:"upgrade_group_conflict", upgradeId:id, group:def.group });
      ids.push(id); defs.push(def); groups.add(def.group); slotsUsed += Number(def.slotCost || 1);
    }
    const surfaces = resolvedSurfaces(component, defs);
    for (const def of defs) {
      const missing = (def.requiredSurfaces || []).filter((surface) => !surfaces.has(normalizeId(surface)));
      if (missing.length) return Object.freeze({ valid:false, reason:"surface_incompatible", upgradeId:def.id, missing:Object.freeze(missing) });
    }
    const slotsAvailable = Number(component.upgradeCapacity || 0);
    if (slotsUsed > slotsAvailable) return Object.freeze({ valid:false, reason:"upgrade_slots_exceeded", slotsUsed, slotsAvailable });
    return Object.freeze({ valid:true, slotsUsed, slotsAvailable, ids:Object.freeze(ids), defs:Object.freeze(defs.map(clone)), specs:Object.freeze(specs.map(clone)) });
  }

  function apply(component, upgradeSpecs = []) {
    const validation = validateLoadout(component, upgradeSpecs);
    if (!validation.valid) return validation;
    const out = clone(component);
    out.installedUpgrades = [];
    out.installedUpgradeDefinitions = [];
    out.upgradeProductionValueAhn = 0;
    const effects = {
      durabilityPercent:0, weightPercent:0, guardDelta:0, clashModifier:0, shieldCrackedDelta:0,
      staggerOnCrashWin:0, extraWearOnCrashContact:0, elementalWearFlatReduction:0,
      strengthRequirementDelta:0, shieldAttackDamagePercent:0, damagePercent:0,
      parryTier:0, statusAmplifiers:[], addTags:[], addAttackModes:[], addSurfaces:[],
    };

    validation.defs.forEach((def, index) => {
      const spec = validation.specs[index] || { id:def.id };
      const price = recipeValue(def, component, spec);
      if (price && price.valid === false) { out.__priceError = price; return; }
      out.upgradeProductionValueAhn += Number(price?.value ?? price ?? 0);
      const e = def.effects || {};
      for (const key of ["durabilityPercent","weightPercent","guardDelta","clashModifier","shieldCrackedDelta","staggerOnCrashWin","extraWearOnCrashContact","elementalWearFlatReduction","strengthRequirementDelta","shieldAttackDamagePercent","damagePercent"]) effects[key] += Number(e[key] || 0);
      effects.parryTier = Math.max(effects.parryTier, Number(e.parryTier || 0));
      effects.statusAmplifiers.push(...clone(e.statusAmplifiers || []));
      effects.addTags.push(...clone(def.addTags || []));
      effects.addAttackModes.push(...clone(def.addAttackModes || []));
      effects.addSurfaces.push(...clone(def.addSurfaces || []));
      out.installedUpgrades.push(def.id);
      out.installedUpgradeDefinitions.push(clone(def));
    });
    if (out.__priceError) return Object.freeze(out.__priceError);
    effects.weightPercent = clamp(effects.weightPercent, -80, 300);
    effects.durabilityPercent = clamp(effects.durabilityPercent, -60, 300);
    out.shieldUpgradeEffects = effects;
    out.installedUpgrades = Object.freeze(out.installedUpgrades.slice());
    out.installedUpgradeDefinitions = Object.freeze(out.installedUpgradeDefinitions.map(Object.freeze));
    out.upgradeProductionValueAhn = Components.roundAhn(out.upgradeProductionValueAhn);
    out.valid = true;
    return Object.freeze(out);
  }

  const API = Object.freeze({ VERSION, structuralMaterial, flexibleMaterial, recipeValue, resolvedSurfaces, validateLoadout, apply });
  global.LuminousShieldUpgradeEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
