(function (global) {
  "use strict";

  if (global.LuminousAmmoRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousAmmoRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Composition = global.LuminousRangedWeaponCompositionEngine || safeRequire("./item-ranged-weapon-composition-engine.js");
  const UpgradeCatalog = global.LuminousRangedWeaponUpgradeCatalog || safeRequire("./item-catalog-ranged-weapon-upgrades.js");
  if (!Composition || !UpgradeCatalog) throw new Error("Ranged composition and upgrade catalogs are required before LuminousAmmoRuntime.");

  const VERSION = 1;
  const SUPPORTED_AMMO = Object.freeze(["arrow", "bolt", "blowgun_dart", "sling_bullet", "sling_stone"]);
  const OFFENSIVE_COMPONENT_BY_AMMO = Object.freeze({
    arrow: "projectile_head",
    bolt: "projectile_head",
    blowgun_dart: "projectile_head",
    sling_bullet: "sling_bullet",
    sling_stone: "natural",
  });

  const COMBAT_GRADE_DAMAGE_PERCENT = Object.freeze({
    "-3": -30,
    "-2": -20,
    "-1": -10,
    "0": 0,
    "1": 5,
    "2": 10,
    "3": 15,
  });

  const MATERIAL_COMBAT_GRADE = Object.freeze({
    raw_fiber: -3,
    processed_textile: -3,
    textile: -3,
    structural_wood: -3,
    wood: -3,
    glass: -3,
    lead: -3,
    lithium: -3,

    bone: -2,
    horn: -2,
    quartz: -2,
    zinc: -2,
    tin: -2,
    gold: -2,
    silver: -2,

    chitin: -1,
    shell: -1,
    ceramic: -1,
    aluminum: -1,
    copper: -1,
    brass: -1,
    industrial_stone: -1,

    iron: 0,
    bronze: 0,
    manganese: 0,
    nickel: 0,

    obsidian: 1,
    carbon_steel: 1,
    chromium: 1,
    cobalt: 1,
    vanadium: 1,
    niobium: 1,
    molybdenum: 1,

    high_carbon_steel: 2,
    stainless_steel: 2,
    nickel_steel: 2,
    chrome_steel: 2,
    hardened_weapon_steel: 2,
    armor_steel: 2,
    tungsten: 2,
    titanium: 2,
    cobalt_alloy: 2,

    tungsten_alloy: 3,
    titanium_alloy: 3,
    advanced_titanium_alloy: 3,
    superalloy: 3,
    augment_grade_alloy: 3,
    corp_composite_alloy: 3,
    exotic_alloy: 3,
    refined_metamaterial: 3,
    exotic_refined_material: 3,
  });

  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function roundDurability(value) { return Math.max(1, Math.round(Number(value) || 0)); }

  function combatGradeForMaterial(materialId, override) {
    if (Number.isFinite(Number(override))) return clamp(Math.round(Number(override)), -3, 3);
    const id = normalizeId(materialId);
    return Object.prototype.hasOwnProperty.call(MATERIAL_COMBAT_GRADE, id) ? MATERIAL_COMBAT_GRADE[id] : 0;
  }

  function combatGradeDamagePercent(grade) {
    const g = clamp(Math.round(Number(grade) || 0), -3, 3);
    return Number(COMBAT_GRADE_DAMAGE_PERCENT[String(g)] || 0);
  }

  function resolveAmmo(ammoId, materialChoices) {
    const id = normalizeId(ammoId);
    if (!SUPPORTED_AMMO.includes(id)) return null;
    return Composition.resolveAmmo(id, materialChoices || {});
  }

  function resolveOffensiveMaterial(ammo, ammoId, options = {}) {
    if (options.offensiveMaterialId) return normalizeId(options.offensiveMaterialId);
    const id = normalizeId(ammoId);
    if (id === "sling_stone") return normalizeId(options.stoneMaterialId || "industrial_stone");
    const componentId = OFFENSIVE_COMPONENT_BY_AMMO[id];
    const component = (ammo?.components || []).find((entry) => normalizeId(entry.componentId) === componentId);
    return normalizeId(component?.primaryMaterial?.materialId || component?.composition?.[0]?.materialId || "");
  }

  function baseDurabilityPerPiece(ammoId, materialChoices = {}, options = {}) {
    const id = normalizeId(ammoId);
    if (!SUPPORTED_AMMO.includes(id)) return null;
    if (id === "sling_stone") return 1;
    const ammo = resolveAmmo(id, materialChoices);
    if (!ammo?.valid) return null;
    const craftDurability = Number(options.craftDurability ?? ammo.structuralDurability);
    const output = Math.max(1, Number(options.batchYield ?? ammo.batchYield) || 1);
    return roundDurability(craftDurability / output);
  }

  function wearPenaltyForUpgrade(upgradeId) {
    const def = UpgradeCatalog.get(upgradeId);
    if (!def || normalizeId(def.scope) !== "ammo") return 0;
    if (normalizeId(def.category) === "reinforcement") return 0;

    let penalty = 30;
    if (normalizeId(def.tier) === "specialized" || Number(def.slotCost || 1) >= 2) penalty += 30;

    const highIntensity =
      Math.abs(Number(def.damagePercent || 0)) >= 15 ||
      Math.abs(Number(def.ammoPowerPercent || 0)) >= 10 ||
      Math.abs(Number(def.statusDelta || 0)) >= 2 ||
      (def.addProperties || []).map(normalizeId).includes("heavy_projectile");
    if (highIntensity) penalty += 30;

    return clamp(penalty, 30, 90);
  }

  function combinedUpgradeWearPenalty(upgradeIds = []) {
    let total = 0;
    for (const id of upgradeIds) total += wearPenaltyForUpgrade(id);
    return clamp(total, 0, 90);
  }

  function statusSpecializationDamagePenalty(upgradeIds = []) {
    const statusIds = upgradeIds.filter((id) => normalizeId(UpgradeCatalog.get(id)?.category) === "status");
    if (!statusIds.length) return 0;
    const wear = combinedUpgradeWearPenalty(statusIds);
    if (wear >= 90) return -40;
    if (wear >= 60) return -30;
    return -20;
  }

  function resolveAmmoProfile(ammoId, materialChoices = {}, options = {}) {
    const id = normalizeId(ammoId);
    const ammo = resolveAmmo(id, materialChoices);
    if (!ammo?.valid) return null;

    const offensiveMaterialId = resolveOffensiveMaterial(ammo, id, options);
    const combatGrade = combatGradeForMaterial(offensiveMaterialId, options.combatGradeOverride);
    const materialDamagePercent = combatGradeDamagePercent(combatGrade);
    const reinforced = !!options.reinforced && id !== "sling_stone";
    const upgradeIds = Array.isArray(options.upgradeIds) ? options.upgradeIds.map(normalizeId) : [];
    const baseDurability = baseDurabilityPerPiece(id, materialChoices, options);
    const wearPenaltyPercent = combinedUpgradeWearPenalty(upgradeIds);
    const reinforcementMultiplier = reinforced ? 2 : 1;
    const rawDurability = baseDurability * reinforcementMultiplier * (1 - wearPenaltyPercent / 100);
    const maxDurability = id === "sling_stone" ? 1 : roundDurability(rawDurability);
    const reinforcedDamagePenalty = reinforced ? -30 : 0;
    const specializationDamagePenalty = statusSpecializationDamagePenalty(upgradeIds);
    const ammoPowerPercent = materialDamagePercent + reinforcedDamagePenalty + specializationDamagePenalty;

    return Object.freeze({
      ammoId: id,
      offensiveMaterialId,
      combatGrade,
      materialDamagePercent,
      reinforced,
      reinforcedDamagePenalty,
      specializationDamagePenalty,
      ammoPowerPercent,
      baseDurability,
      reinforcementMultiplier,
      wearPenaltyPercent,
      maxDurability,
      recoverable: id !== "sling_stone",
      durabilityLocked: id === "sling_stone",
      upgradeIds: Object.freeze(upgradeIds.slice()),
    });
  }

  function applyAmmoProfileToSkill(skillContext, profile) {
    const skill = clone(skillContext || {});
    skill.modifiers = {...(skill.modifiers || {})};
    if (profile?.ammoPowerPercent) skill.modifiers.ammoPowerPercent = Number(skill.modifiers.ammoPowerPercent || 0) + Number(profile.ammoPowerPercent || 0);
    skill.ammoProfile = profile ? clone(profile) : null;
    return Object.freeze(skill);
  }

  function normalizeBuckets(source) {
    const out = {};
    for (const [key, value] of Object.entries(source || {})) {
      const durability = Math.max(1, Math.round(Number(key) || 0));
      const quantity = Math.max(0, Math.floor(Number(value) || 0));
      if (quantity) out[durability] = (out[durability] || 0) + quantity;
    }
    return out;
  }

  function createAmmoStack(profile, quantity) {
    const qty = Math.max(0, Math.floor(Number(quantity) || 0));
    const maxDurability = Math.max(1, Math.round(Number(profile?.maxDurability) || 1));
    return Object.freeze({
      ammoId: normalizeId(profile?.ammoId),
      profile: clone(profile),
      available: Object.freeze(qty ? {[maxDurability]: qty} : {}),
      spent: Object.freeze({}),
      destroyed: 0,
    });
  }

  function fireProjectile(stack, options = {}) {
    const next = clone(stack || {});
    next.available = normalizeBuckets(next.available);
    next.spent = normalizeBuckets(next.spent);
    next.destroyed = Math.max(0, Math.floor(Number(next.destroyed) || 0));

    const keys = Object.keys(next.available).map(Number).filter((d) => next.available[d] > 0).sort((a, b) => a - b);
    if (!keys.length) return Object.freeze({valid:false,reason:"no_available_ammo",stack:Object.freeze(next)});

    const preferred = Number(options.preferredDurability);
    const current = Number.isFinite(preferred) && next.available[preferred] > 0 ? preferred : keys[0];
    next.available[current] -= 1;
    if (next.available[current] <= 0) delete next.available[current];

    const remaining = current - 1;
    if (remaining > 0 && next.profile?.recoverable !== false) next.spent[remaining] = (next.spent[remaining] || 0) + 1;
    else next.destroyed += 1;

    next.available = Object.freeze(next.available);
    next.spent = Object.freeze(next.spent);
    return Object.freeze({valid:true,firedDurability:current,remainingDurability:Math.max(0,remaining),stack:Object.freeze(next)});
  }

  function resolveEndOfCombatRecovery(stack) {
    const next = clone(stack || {});
    next.available = normalizeBuckets(next.available);
    next.spent = normalizeBuckets(next.spent);
    for (const [durability, quantity] of Object.entries(next.spent)) next.available[durability] = (next.available[durability] || 0) + quantity;
    next.spent = {};
    next.available = Object.freeze(next.available);
    next.spent = Object.freeze(next.spent);
    return Object.freeze(next);
  }

  const API = Object.freeze({
    VERSION,
    SUPPORTED_AMMO,
    OFFENSIVE_COMPONENT_BY_AMMO,
    COMBAT_GRADE_DAMAGE_PERCENT,
    MATERIAL_COMBAT_GRADE,
    normalizeId,
    combatGradeForMaterial,
    combatGradeDamagePercent,
    baseDurabilityPerPiece,
    wearPenaltyForUpgrade,
    combinedUpgradeWearPenalty,
    statusSpecializationDamagePenalty,
    resolveAmmoProfile,
    applyAmmoProfileToSkill,
    createAmmoStack,
    fireProjectile,
    resolveEndOfCombatRecovery,
  });

  global.LuminousAmmoRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
