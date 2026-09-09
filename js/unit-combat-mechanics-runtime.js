(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const ROCK_STATUS = Object.freeze({
    id: 'rock',
    name: 'Rock',
    icon: 'https://imgur.com/7rOv1S0.png',
    type: 'ammunition',
    stackType: 'single',
    maxCount: 1,
    maxPotency: 1,
    description: 'Ammunition for skills.',
    metadata: Object.freeze({ asset: 'https://imgur.com/P4J48yc.png', category: 'ammunition' }),
  });

  function statusEngine() {
    return global.LuminousStatusEngine || global.StatusEngine || null;
  }

  function statusLibrary() {
    return global.LuminousStatusLibrary || global.StatusLibrary || null;
  }

  function registerRockStatus() {
    const library = statusLibrary();
    if (!library?.registerExtension) return false;
    try {
      library.registerExtension(ROCK_STATUS.id, clone(ROCK_STATUS));
      return true;
    } catch (_) {
      return false;
    }
  }

  function statusRows(unit) {
    if (!unit) return [];
    if (!Array.isArray(unit.statusEffects)) unit.statusEffects = [];
    return unit.statusEffects;
  }

  function findStatus(unit, statusId) {
    const id = normalizeId(statusId);
    return statusRows(unit).find((row) => normalizeId(row?.id || row?.status || row?.statusId) === id) || null;
  }

  function ammunitionCount(unit, ammoId) {
    const row = findStatus(unit, ammoId);
    return Math.max(0, Number(row?.count ?? row?.potency ?? 0) || 0);
  }

  function setAmmunition(unit, ammoId, amount, maxAmount = 1) {
    const id = normalizeId(ammoId);
    const next = Math.max(0, Math.min(Number(maxAmount) || 1, Math.floor(Number(amount) || 0)));
    const engine = statusEngine();
    if (engine?.applyStatus) {
      engine.applyStatus(unit, id, { count: next, potency: next }, { mode: 'set' });
      return ammunitionCount(unit, id);
    }
    const rows = statusRows(unit);
    let row = findStatus(unit, id);
    if (!row) {
      row = { id, status: id, count: 0, potency: 0 };
      rows.push(row);
    }
    row.count = next;
    row.potency = next;
    return next;
  }

  function gainAmmunition(unit, ammoId, amount = 1, maxAmount = 1) {
    return setAmmunition(unit, ammoId, ammunitionCount(unit, ammoId) + amount, maxAmount);
  }

  function consumeAmmunition(unit, ammoId, amount = 1) {
    const required = Math.max(1, Math.floor(Number(amount) || 1));
    const current = ammunitionCount(unit, ammoId);
    if (current < required) return { ok: false, current, required };
    const remaining = setAmmunition(unit, ammoId, current - required, Math.max(1, current));
    return { ok: true, current, required, remaining };
  }

  function lifecycleRules(unit) {
    return unit?.mechanics?.unitLifecycle || unit?.unitLifecycle || {};
  }

  function applyLifecycle(unit, trigger) {
    const rules = lifecycleRules(unit);
    const grants = Array.isArray(rules?.[trigger]?.grantAmmunition) ? rules[trigger].grantAmmunition : [];
    const applied = [];
    grants.forEach((grant) => {
      const id = normalizeId(grant?.id);
      if (!id) return;
      const amount = Math.max(1, Math.floor(Number(grant?.amount) || 1));
      const max = Math.max(amount, Math.floor(Number(grant?.max) || 1));
      applied.push({ id, amount, total: gainAmmunition(unit, id, amount, max) });
    });
    return applied;
  }

  function onEncounterStart(unit) { return applyLifecycle(unit, 'onEncounterStart'); }
  function onComeback(unit) { return applyLifecycle(unit, 'onComeback'); }

  function isFlyingUnit(unit) {
    if (!unit) return false;
    if (unit?.mechanics?.flying === true || unit?.flying === true) return true;
    const ids = Array.isArray(unit.traitIds) ? unit.traitIds.map(normalizeId) : [];
    return ids.includes('aerial_harrier') || ids.includes('flying');
  }

  function deliveryType(skill) {
    const explicit = normalizeId(skill?.deliveryType || skill?.metadata?.combatRange || skill?.combatRange);
    if (explicit === 'melee' || explicit === 'ranged') return explicit;
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

  function resourceCostForSkill(skill) {
    const rows = Array.isArray(skill?.resourceCosts) ? skill.resourceCosts : [];
    return rows.map(clone);
  }

  function consumeSkillAmmunition(unit, skill) {
    const costs = resourceCostForSkill(skill).filter((cost) => normalizeId(cost?.type) === 'ammunition');
    const results = costs.map((cost) => consumeAmmunition(unit, cost.id, cost.amount));
    return { ok: results.every((result) => result.ok), results };
  }

  registerRockStatus();

  const api = Object.freeze({
    version: '1.0.0',
    ROCK_STATUS,
    registerRockStatus,
    ammunitionCount,
    setAmmunition,
    gainAmmunition,
    consumeAmmunition,
    consumeSkillAmmunition,
    onEncounterStart,
    onComeback,
    isFlyingUnit,
    deliveryType,
    flyingTargetRule,
    flyingClashDamageRule,
  });

  global.LuminousUnitCombatMechanics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
