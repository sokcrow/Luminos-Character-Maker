(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  function safeRequire(path) {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  }

  const rangedAmmo = global.LuminousUniversalRangedAmmoRuntime || safeRequire('./universal-ranged-ammo-runtime.js');
  const ROCK_STATUS = Object.freeze(clone(rangedAmmo?.AMMO?.rock || {
    id: 'rock', name: 'Rock', icon: 'https://imgur.com/7rOv1S0.png', type: 'neutral', mode: 'single', maxCount: 1,
    description: 'Ammunition for ranged Skills.', metadata: { projectileAsset: 'https://imgur.com/P4J48yc.png' },
  }));

  function registerRockStatus() { return rangedAmmo?.registerStatuses?.() === true; }
  function ammunitionCount(unit, ammoId) { return rangedAmmo?.ammoCount?.(unit, ammoId) ?? 0; }
  function setAmmunition(unit, ammoId, amount) { return rangedAmmo?.setAmmo?.(unit, ammoId, amount) ?? 0; }
  function gainAmmunition(unit, ammoId, amount = 1) { return rangedAmmo?.gainAmmo?.(unit, ammoId, amount) ?? 0; }
  function consumeAmmunition(unit, ammoId, amount = 1) { return rangedAmmo?.consumeAmmo?.(unit, ammoId, amount) || { ok: false, reason: 'universal_ammo_runtime_unavailable' }; }

  function onEncounterStart(unit) { return rangedAmmo?.onEncounterStart?.(unit) || []; }
  function onComeback(unit) { return rangedAmmo?.onComeback?.(unit) || []; }

  function isFlyingUnit(unit) {
    if (!unit) return false;
    if (unit?.mechanics?.flying === true || unit?.flying === true) return true;
    const ids = Array.isArray(unit.traitIds) ? unit.traitIds.map(normalizeId) : [];
    return ids.includes('aerial_harrier') || ids.includes('flying');
  }

  function deliveryType(skill) {
    const range = Number(skill?.skillRange ?? skill?.range ?? skill?.metadata?.skillRange);
    return Number.isFinite(range) && range > 1 ? 'ranged' : 'melee';
  }

  function flyingTargetRule({ attacker, target, skill, resolutionType }) {
    if (!isFlyingUnit(target)) return { allowed: true, canDamage: true, reason: 'target_not_flying' };
    const delivery = deliveryType(skill);
    const resolution = normalizeId(resolutionType || 'unopposed');
    if (delivery === 'ranged') return { allowed: true, canDamage: true, reason: 'ranged_vs_flying' };
    if (resolution === 'unopposed') return { allowed: false, canDamage: false, reason: 'ground_melee_unopposed_cannot_target_flying' };
    return { allowed: true, canDamage: true, reason: 'melee_clash_vs_flying' };
  }

  function flyingClashDamageRule({ attacker, defender, attackerSkill, defenderSkill }) {
    if (!isFlyingUnit(defender)) return { canDamage: true, reason: 'defender_not_flying' };
    if (deliveryType(attackerSkill) === 'ranged') return { canDamage: true, reason: 'ranged_vs_flying' };
    if (deliveryType(defenderSkill) === 'melee') return { canDamage: true, reason: 'flying_melee_exposed' };
    return { canDamage: false, reason: 'ground_melee_only_negates_flying_ranged_clash' };
  }

  function resourceCostForSkill(skill) { return (Array.isArray(skill?.resourceCosts) ? skill.resourceCosts : []).map(clone); }
  function consumeSkillAmmunition(unit, skill) {
    const costs = resourceCostForSkill(skill).filter((cost) => normalizeId(cost?.type) === 'ammunition');
    const results = costs.map((cost) => rangedAmmo?.isAmmoConsumingSkill?.(skill, cost.id)
      ? consumeAmmunition(unit, cost.id, cost.amount)
      : { ok: false, reason: 'ammunition_requires_ranged_skill' });
    return { ok: results.length > 0 && results.every((result) => result.ok), results };
  }

  registerRockStatus();

  const api = Object.freeze({
    version: '2.0.0', ROCK_STATUS, registerRockStatus, ammunitionCount, setAmmunition, gainAmmunition, consumeAmmunition,
    consumeSkillAmmunition, onEncounterStart, onComeback, isFlyingUnit, deliveryType, flyingTargetRule, flyingClashDamageRule,
  });

  global.LuminousUnitCombatMechanics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
