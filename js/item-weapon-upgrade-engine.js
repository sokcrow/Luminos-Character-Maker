(function (global) {
  "use strict";

  if (global.LuminousWeaponUpgradeEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponUpgradeEngine;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Components = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  const Upgrades = global.LuminousWeaponUpgradeCatalog || safeRequire("./item-catalog-weapon-upgrades.js");
  if (!Components) throw new Error("LuminousWeaponComponentCatalog is required before LuminousWeaponUpgradeEngine.");
  if (!Upgrades) throw new Error("LuminousWeaponUpgradeCatalog is required before LuminousWeaponUpgradeEngine.");

  const VERSION = 1;
  const SLOT_THRESHOLDS = Object.freeze({ oneMaxExclusive:20, twoMaxExclusive:35, maxSlots:3 });
  const BASE_SURFACES = Object.freeze({
    short_blade:Object.freeze(["edge","point"]),
    long_blade:Object.freeze(["edge","point"]),
    great_blade:Object.freeze(["edge","point"]),
    axe_head_small:Object.freeze(["edge"]), axe_head_medium:Object.freeze(["edge"]), axe_head_large:Object.freeze(["edge"]),
    hammer_head_small:Object.freeze(["impact"]), hammer_head_medium:Object.freeze(["impact"]), hammer_head_large:Object.freeze(["impact"]),
    mace_head:Object.freeze(["impact"]), spear_head:Object.freeze(["point"]), polearm_head:Object.freeze(["edge","point"]),
    pick_head:Object.freeze(["point"]), flail_head:Object.freeze(["impact"]),
    chain_link:Object.freeze([]), handle:Object.freeze([]), reinforced_handle:Object.freeze([]),
    shaft:Object.freeze(["impact"]), long_shaft:Object.freeze(["impact"]),
    club_body_medium:Object.freeze(["impact"]), club_body_large:Object.freeze(["impact"]),
    grip:Object.freeze([]), lash:Object.freeze(["impact"]),
  });

  function normalizeId(value) { return Components.normalizeId ? Components.normalizeId(value) : Upgrades.normalizeId(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function roundDurability(value) { return Math.max(1, Math.round(Number(value) || 0)); }

  function slotsForMaterialDurability(unitDurability) {
    const n = Number(unitDurability);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n < SLOT_THRESHOLDS.oneMaxExclusive) return 1;
    if (n < SLOT_THRESHOLDS.twoMaxExclusive) return 2;
    return SLOT_THRESHOLDS.maxSlots;
  }

  function structuralMaterialRow(componentInstance) {
    if (!componentInstance) return null;
    if (componentInstance.primaryMaterial && Number.isFinite(Number(componentInstance.primaryMaterial.unitDurability))) return componentInstance.primaryMaterial;
    const rows = Array.isArray(componentInstance.composition) ? componentInstance.composition : [];
    return rows.find((row) => ["body","head","links","wrap"].includes(normalizeId(row.slot))) || rows[0] || null;
  }

  function componentUpgradeCapacity(componentInstance) {
    const row = structuralMaterialRow(componentInstance);
    if (!row) return Object.freeze({ valid:false, reason:"missing_structural_material", slots:0 });
    const unitDurability = Number(row.unitDurability);
    const slots = slotsForMaterialDurability(unitDurability);
    if (!slots) return Object.freeze({ valid:false, reason:"missing_material_durability", slots:0 });
    return Object.freeze({ valid:true, slots, materialId:normalizeId(row.materialId), unitDurability });
  }

  function baseSurfaces(componentId) { return (BASE_SURFACES[normalizeId(componentId)] || []).slice(); }

  function resolvedSurfaces(componentId, upgradeIds = []) {
    const surfaces = new Set(baseSurfaces(componentId));
    for (const id of upgradeIds) {
      const def = Upgrades.get(id);
      if (!def) continue;
      for (const surface of def.addSurfaces || []) surfaces.add(normalizeId(surface));
    }
    return Object.freeze([...surfaces]);
  }

  function componentCompatible(def, componentId) {
    const id = normalizeId(componentId);
    return !def.compatibleComponentIds.length || def.compatibleComponentIds.includes(id);
  }

  function surfaceCompatible(def, componentId, installedUpgradeIds = []) {
    if (!def.requiredSurfaces.length) return true;
    const surfaces = new Set(resolvedSurfaces(componentId, installedUpgradeIds));
    return def.requiredSurfaces.every((surface) => surfaces.has(surface));
  }

  function validateLoadout(componentInstance, upgradeIds = []) {
    const componentId = normalizeId(componentInstance?.componentId || componentInstance?.id);
    if (!componentId || !Components.get(componentId)) return Object.freeze({valid:false,reason:"unknown_component"});
    const capacity = componentUpgradeCapacity(componentInstance);
    if (!capacity.valid) return capacity;
    const ids = upgradeIds.map(normalizeId);
    const defs = [];
    const groups = new Set();
    let slotsUsed = 0;
    for (const id of ids) {
      const def = Upgrades.get(id);
      if (!def) return Object.freeze({valid:false,reason:"unknown_upgrade",upgradeId:id});
      if (!componentCompatible(def, componentId)) return Object.freeze({valid:false,reason:"component_incompatible",upgradeId:id,componentId});
      if (!surfaceCompatible(def, componentId, ids)) return Object.freeze({valid:false,reason:"surface_incompatible",upgradeId:id,componentId});
      if (groups.has(def.group)) return Object.freeze({valid:false,reason:"upgrade_group_conflict",group:def.group,upgradeId:id});
      groups.add(def.group);
      slotsUsed += def.slotCost;
      defs.push(def);
    }
    if (slotsUsed > capacity.slots) return Object.freeze({valid:false,reason:"upgrade_slots_exceeded",slotsUsed,slotsAvailable:capacity.slots});
    return Object.freeze({valid:true,componentId,slotsUsed,slotsAvailable:capacity.slots,upgrades:Object.freeze(defs.map(clone))});
  }

  function canInstallUpgrade(state) {
    const current = Number(state?.currentDurability);
    const max = Number(state?.maxDurability);
    return Number.isFinite(current) && Number.isFinite(max) && max > 0 && current > max * Upgrades.MIN_UPGRADE_DURABILITY_RATIO_EXCLUSIVE;
  }

  function modifiedComponentDurability(baseDurability, upgradeIds = []) {
    const base = Number(baseDurability);
    if (!Number.isFinite(base) || base <= 0) return null;
    let percent = 0;
    for (const id of upgradeIds) {
      const def = Upgrades.get(id);
      if (def) percent += Number(def.durabilityPercent || 0);
    }
    const rawRatio = 1 + percent / 100;
    const ratio = Math.max(Upgrades.MIN_DURABILITY_FLOOR_RATIO, rawRatio);
    return Object.freeze({ baseDurability:base, modifierPercent:percent, appliedRatio:ratio, durability:roundDurability(base * ratio) });
  }

  function tagsMatch(def, skillContext) {
    const tags = new Set((skillContext?.tags || []).map(normalizeId));
    if (def.requiredSkillTags.some((tag) => !tags.has(tag))) return false;
    if (def.forbiddenSkillTags.some((tag) => tags.has(tag))) return false;
    return true;
  }

  function offensiveSurfaceMatch(def, skillContext, installedComponentId) {
    const usedComponentId = normalizeId(skillContext?.usedComponentId || "");
    if (usedComponentId && usedComponentId !== normalizeId(installedComponentId)) return false;
    const usedSurface = normalizeId(skillContext?.usedSurface || "");
    if (def.requiredSurfaces.length && usedSurface && !def.requiredSurfaces.includes(usedSurface)) return false;
    return true;
  }

  function applyStatusAmplifier(statusApplications, def) {
    if (!def.statusType || !def.statusAxis || !def.statusDelta) return statusApplications;
    return statusApplications.map((entry) => {
      const copy = {...entry};
      const statusId = normalizeId(copy.statusId || copy.id || copy.status);
      if (statusId !== def.statusType) return copy;
      const current = Number(copy[def.statusAxis]);
      // Canonical V1: weapon upgrades amplify an axis the Skill already applies. They never inject a new Status/axis On Hit.
      if (!Number.isFinite(current) || current <= 0) return copy;
      copy[def.statusAxis] = current + def.statusDelta;
      return copy;
    });
  }

  function applyUpgradeToSkill(skillContext, upgradeId, installedComponentId) {
    const def = Upgrades.get(upgradeId);
    if (!def) return Object.freeze({valid:false,reason:"unknown_upgrade",skill:clone(skillContext)});
    if (!componentCompatible(def, installedComponentId)) return Object.freeze({valid:false,reason:"component_incompatible",skill:clone(skillContext)});
    if (!tagsMatch(def, skillContext)) return Object.freeze({valid:true,applied:false,skill:clone(skillContext)});
    if (!offensiveSurfaceMatch(def, skillContext, installedComponentId)) return Object.freeze({valid:true,applied:false,skill:clone(skillContext)});

    const skill = clone(skillContext || {});
    skill.modifiers = {...(skill.modifiers || {})};
    const damageType = normalizeId(skill.damageType || "");
    if (def.damagePercent && (!def.damageType || def.damageType === damageType)) {
      skill.modifiers.damagePercent = Number(skill.modifiers.damagePercent || 0) + def.damagePercent;
    }
    if (def.id === "versatile_geometry" && ["slash","pierce"].includes(damageType)) {
      skill.modifiers.damagePercent = Number(skill.modifiers.damagePercent || 0) + 5;
    }
    if (def.powerPercent) skill.modifiers.powerPercent = Number(skill.modifiers.powerPercent || 0) + def.powerPercent;
    if (def.clashPercent) skill.modifiers.clashPercent = Number(skill.modifiers.clashPercent || 0) + def.clashPercent;
    if (def.guardPercent) skill.modifiers.guardPercent = Number(skill.modifiers.guardPercent || 0) + def.guardPercent;
    if (def.counterPercent) skill.modifiers.counterPercent = Number(skill.modifiers.counterPercent || 0) + def.counterPercent;
    if (def.mitigationChannel) {
      skill.modifiers.mitigation = {...(skill.modifiers.mitigation || {})};
      skill.modifiers.mitigation[def.mitigationChannel] = Number(skill.modifiers.mitigation[def.mitigationChannel] || 0) + def.mitigationPercent;
    }
    const before = Array.isArray(skill.statusApplications) ? skill.statusApplications : [];
    skill.statusApplications = applyStatusAmplifier(before, def);
    return Object.freeze({valid:true,applied:true,skill:Object.freeze(skill)});
  }

  function applyLoadoutToSkill(skillContext, installedComponents = []) {
    let skill = clone(skillContext || {});
    for (const component of installedComponents) {
      const componentId = normalizeId(component.componentId || component.id);
      for (const upgradeId of component.upgradeIds || []) {
        const result = applyUpgradeToSkill(skill, upgradeId, componentId);
        if (result.valid && result.applied) skill = clone(result.skill);
      }
    }
    return Object.freeze(skill);
  }

  function supportWearForSkill(baseWear, primaryUpgradeIds = [], supportUpgradeIds = []) {
    let wear = Math.max(0, Math.round(Number(baseWear) || 0));
    for (const id of primaryUpgradeIds) {
      const def = Upgrades.get(id);
      if (def) wear += Math.max(0, Math.round(Number(def.supportWearExtra || 0)));
    }
    let mitigation = 0;
    for (const id of supportUpgradeIds) {
      const def = Upgrades.get(id);
      if (def?.mitigationChannel === "support_wear") mitigation += Math.max(0, Math.round(Number(def.mitigationPercent || 0)));
    }
    return Math.max(baseWear > 0 ? 1 : 0, wear - mitigation);
  }

  const API = Object.freeze({
    VERSION,SLOT_THRESHOLDS,BASE_SURFACES,slotsForMaterialDurability,structuralMaterialRow,componentUpgradeCapacity,
    baseSurfaces,resolvedSurfaces,validateLoadout,canInstallUpgrade,modifiedComponentDurability,applyUpgradeToSkill,
    applyLoadoutToSkill,supportWearForSkill,
  });

  global.LuminousWeaponUpgradeEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
