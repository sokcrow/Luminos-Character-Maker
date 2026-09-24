(function (global) {
  "use strict";

  if (global.LuminousRangedWeaponUpgradeEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRangedWeaponUpgradeEngine;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const RangedComponents = global.LuminousRangedWeaponComponentCatalog || safeRequire("./item-catalog-ranged-weapon-components.js");
  const MeleeComponents = global.LuminousWeaponComponentCatalog || safeRequire("./item-catalog-weapon-components.js");
  const Upgrades = global.LuminousRangedWeaponUpgradeCatalog || safeRequire("./item-catalog-ranged-weapon-upgrades.js");
  if (!RangedComponents || !MeleeComponents || !Upgrades) throw new Error("Ranged component, melee component, and ranged upgrade catalogs are required.");

  const VERSION = 1;
  const SLOT_THRESHOLDS = Object.freeze({oneMaxExclusive:20,twoMaxExclusive:35,maxSlots:3});
  const HEAVY_AMMO_BASE_PENALTY_PERCENT = 10;

  function normalizeId(value) { return RangedComponents.normalizeId(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function roundDurability(value) { return Math.max(1,Math.round(Number(value) || 0)); }
  function componentExists(id) { return !!RangedComponents.get(id) || !!MeleeComponents.get(id); }

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
    return rows.find((row) => row.primaryMaterial) || rows[0] || null;
  }

  function componentUpgradeCapacity(componentInstance) {
    const row = structuralMaterialRow(componentInstance);
    if (!row) return Object.freeze({valid:false,reason:"missing_structural_material",slots:0});
    const unitDurability = Number(row.unitDurability);
    const slots = slotsForMaterialDurability(unitDurability);
    if (!slots) return Object.freeze({valid:false,reason:"missing_material_durability",slots:0});
    return Object.freeze({valid:true,slots,materialId:normalizeId(row.materialId),unitDurability});
  }

  function validateLoadout(componentInstance, upgradeIds = []) {
    const componentId = normalizeId(componentInstance?.componentId || componentInstance?.id);
    if (!componentId || !componentExists(componentId)) return Object.freeze({valid:false,reason:"unknown_component"});
    const capacity = componentUpgradeCapacity(componentInstance);
    if (!capacity.valid) return capacity;
    const ids = upgradeIds.map(normalizeId);
    const groups = new Set();
    let slotsUsed = 0;
    for (const id of ids) {
      const def = Upgrades.get(id);
      if (!def) return Object.freeze({valid:false,reason:"unknown_upgrade",upgradeId:id});
      if (def.compatibleComponentIds.length && !def.compatibleComponentIds.includes(componentId)) return Object.freeze({valid:false,reason:"component_incompatible",upgradeId:id,componentId});
      if (groups.has(def.group)) return Object.freeze({valid:false,reason:"upgrade_group_conflict",group:def.group,upgradeId:id});
      groups.add(def.group);
      slotsUsed += def.slotCost;
    }
    if (slotsUsed > capacity.slots) return Object.freeze({valid:false,reason:"upgrade_slots_exceeded",slotsUsed,slotsAvailable:capacity.slots});
    return Object.freeze({valid:true,componentId,slotsUsed,slotsAvailable:capacity.slots});
  }

  function canInstallUpgrade(state) {
    const current = Number(state?.currentDurability); const max = Number(state?.maxDurability);
    return Number.isFinite(current) && Number.isFinite(max) && max > 0 && current > max * Upgrades.MIN_UPGRADE_DURABILITY_RATIO_EXCLUSIVE;
  }

  function modifiedComponentDurability(baseDurability, upgradeIds = []) {
    const base = Number(baseDurability);
    if (!Number.isFinite(base) || base <= 0) return null;
    let percent = 0;
    for (const id of upgradeIds) { const def = Upgrades.get(id); if (def) percent += Number(def.durabilityPercent || 0); }
    const ratio = Math.max(Upgrades.MIN_DURABILITY_FLOOR_RATIO,1 + percent / 100);
    return Object.freeze({baseDurability:base,modifierPercent:percent,appliedRatio:ratio,durability:roundDurability(base * ratio)});
  }

  function tagsMatch(def, skillContext) {
    const tags = new Set((skillContext?.tags || []).map(normalizeId));
    if (def.requiredSkillTags.some((tag) => !tags.has(tag))) return false;
    if (def.forbiddenSkillTags.some((tag) => tags.has(tag))) return false;
    return true;
  }

  function applyStatusAmplifier(statusApplications, def) {
    if (!def.statusType || !def.statusAxis || !def.statusDelta) return statusApplications;
    return statusApplications.map((entry) => {
      const copy = {...entry};
      const statusId = normalizeId(copy.statusId || copy.id || copy.status);
      if (statusId !== def.statusType) return copy;
      const current = Number(copy[def.statusAxis]);
      if (!Number.isFinite(current) || current <= 0) return copy;
      copy[def.statusAxis] = current + def.statusDelta;
      return copy;
    });
  }

  function applyUpgradeToSkill(skillContext, upgradeId, installedComponentId) {
    const def = Upgrades.get(upgradeId);
    const componentId = normalizeId(installedComponentId);
    if (!def) return Object.freeze({valid:false,reason:"unknown_upgrade",skill:clone(skillContext)});
    if (def.compatibleComponentIds.length && !def.compatibleComponentIds.includes(componentId)) return Object.freeze({valid:false,reason:"component_incompatible",skill:clone(skillContext)});
    if (!tagsMatch(def,skillContext)) return Object.freeze({valid:true,applied:false,skill:clone(skillContext)});

    const skill = clone(skillContext || {});
    skill.modifiers = {...(skill.modifiers || {})};
    const damageType = normalizeId(skill.damageType || "");
    if (def.damagePercent && (!def.damageType || def.damageType === damageType)) skill.modifiers.damagePercent = Number(skill.modifiers.damagePercent || 0) + def.damagePercent;
    if (def.ammoPowerPercent) skill.modifiers.ammoPowerPercent = Number(skill.modifiers.ammoPowerPercent || 0) + def.ammoPowerPercent;
    if (def.clashPercent) skill.modifiers.clashPercent = Number(skill.modifiers.clashPercent || 0) + def.clashPercent;
    if (def.controlPercent) skill.modifiers.controlPercent = Number(skill.modifiers.controlPercent || 0) + def.controlPercent;
    if (def.stabilityPercent) skill.modifiers.stabilityPercent = Number(skill.modifiers.stabilityPercent || 0) + def.stabilityPercent;
    if (def.mitigationChannel) {
      skill.modifiers.mitigation = {...(skill.modifiers.mitigation || {})};
      skill.modifiers.mitigation[def.mitigationChannel] = Number(skill.modifiers.mitigation[def.mitigationChannel] || 0) + def.mitigationPercent;
    }
    skill.statusApplications = applyStatusAmplifier(Array.isArray(skill.statusApplications) ? skill.statusApplications : [],def);
    return Object.freeze({valid:true,applied:true,skill:Object.freeze(skill)});
  }

  function applyLoadoutsToSkill(skillContext, loadouts = []) {
    let skill = clone(skillContext || {});
    for (const loadout of loadouts) {
      const componentId = normalizeId(loadout.componentId || loadout.component?.componentId || loadout.component?.id);
      for (const upgradeId of loadout.upgradeIds || []) {
        const result = applyUpgradeToSkill(skill,upgradeId,componentId);
        if (result.valid && result.applied) skill = clone(result.skill);
      }
    }
    return Object.freeze(skill);
  }

  function applyAmmoGrade(skillContext, grade = "standard", eligible = true) {
    const id = normalizeId(grade || "standard");
    const bonus = eligible ? Number(Upgrades.AMMO_GRADES[id] ?? 0) : 0;
    const skill = clone(skillContext || {});
    skill.modifiers = {...(skill.modifiers || {})};
    if (bonus) skill.modifiers.ammoPowerPercent = Number(skill.modifiers.ammoPowerPercent || 0) + bonus;
    skill.ammoGrade = id;
    return Object.freeze(skill);
  }

  function loadoutProperties(loadouts = []) {
    const properties = new Set();
    for (const loadout of loadouts) {
      for (const upgradeId of loadout.upgradeIds || []) {
        const def = Upgrades.get(upgradeId);
        for (const prop of def?.addProperties || []) properties.add(normalizeId(prop));
      }
    }
    return Object.freeze([...properties]);
  }

  function mitigationFromLoadouts(loadouts, channel) {
    const target = normalizeId(channel);
    let total = 0;
    for (const loadout of loadouts || []) for (const upgradeId of loadout.upgradeIds || []) {
      const def = Upgrades.get(upgradeId);
      if (def?.mitigationChannel === target) total += Number(def.mitigationPercent || 0);
    }
    return total;
  }

  function resolveLauncherAmmoCompatibility(launcherLoadouts = [], ammoLoadouts = []) {
    const heavy = loadoutProperties(ammoLoadouts).includes("heavy_projectile");
    if (!heavy) return Object.freeze({heavyProjectile:false,basePenaltyPercent:0,mitigationPercent:0,appliedPenaltyPercent:0});
    const mitigation = mitigationFromLoadouts(launcherLoadouts,"heavy_ammo_penalty") + mitigationFromLoadouts(ammoLoadouts,"heavy_ammo_penalty");
    const applied = Math.max(0,HEAVY_AMMO_BASE_PENALTY_PERCENT - mitigation);
    return Object.freeze({heavyProjectile:true,basePenaltyPercent:HEAVY_AMMO_BASE_PENALTY_PERCENT,mitigationPercent:mitigation,appliedPenaltyPercent:applied});
  }

  function applyRangedLoadoutToSkill(skillContext, options = {}) {
    const launcherLoadouts = options.launcherLoadouts || [];
    const ammoLoadouts = options.ammoLoadouts || [];
    let skill = clone(applyLoadoutsToSkill(skillContext,launcherLoadouts));
    skill = clone(applyLoadoutsToSkill(skill,ammoLoadouts));
    skill = clone(applyAmmoGrade(skill,options.ammoGrade || "standard",options.ammoGradeEligible !== false));
    const compatibility = resolveLauncherAmmoCompatibility(launcherLoadouts,ammoLoadouts);
    if (compatibility.appliedPenaltyPercent) {
      skill.modifiers = {...(skill.modifiers || {})};
      skill.modifiers.controlPercent = Number(skill.modifiers.controlPercent || 0) - compatibility.appliedPenaltyPercent;
      skill.modifiers.clashPercent = Number(skill.modifiers.clashPercent || 0) - compatibility.appliedPenaltyPercent;
    }
    skill.rangedCompatibility = clone(compatibility);
    return Object.freeze(skill);
  }

  const API = Object.freeze({
    VERSION,SLOT_THRESHOLDS,HEAVY_AMMO_BASE_PENALTY_PERCENT,slotsForMaterialDurability,structuralMaterialRow,componentUpgradeCapacity,
    validateLoadout,canInstallUpgrade,modifiedComponentDurability,applyUpgradeToSkill,applyLoadoutsToSkill,applyAmmoGrade,loadoutProperties,
    resolveLauncherAmmoCompatibility,applyRangedLoadoutToSkill,
  });

  global.LuminousRangedWeaponUpgradeEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);