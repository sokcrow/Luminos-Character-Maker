(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  function safeRequire(path) {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  }

  const rangedAmmo = global.LuminousUniversalRangedAmmoRuntime || safeRequire('./universal-ranged-ammo-runtime.js');
  const actionEconomy = global.LuminousActionEconomy || safeRequire('./universal-action-economy.js');
  const weaponProperties = global.LuminousWeaponPropertyRuntime || safeRequire('./weapon-property-runtime.js');
  const statusEngine = global.LuminousStatusEngine || safeRequire('./status-engine.js');
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

  function statusActive(unit, statusId) {
    const value = unit?.statusEffects?.[normalizeId(statusId)] ?? unit?.statuses?.[normalizeId(statusId)];
    if (value == null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'object') return Number(value.count ?? value.potency ?? 1) > 0;
    return Boolean(value);
  }

  function hasFlightCapability(unit) {
    if (!unit) return false;
    if (unit?.mechanics?.flight?.capable === true || unit?.capabilities?.flight === true) return true;
    if (unit?.mechanics?.flying === true) return true;
    const ids = Array.isArray(unit.traitIds) ? unit.traitIds.map(normalizeId) : [];
    return ids.includes('aerial_harrier') || ids.includes('flying') || ids.includes('flyby');
  }

  function isFlyingUnit(unit) {
    if (!unit || statusActive(unit, 'prone')) return false;
    if (unit.flying === false) return false;
    if (unit.flying === true || statusActive(unit, 'flying')) return true;
    return unit?.mechanics?.flying === true;
  }

  function isClimbingUnit(unit) {
    if (!unit || statusActive(unit, 'prone')) return false;
    return unit.climbing === true || statusActive(unit, 'climbing') || unit?.mechanics?.climbing === true;
  }

  function deliveryType(skill) {
    const range = Number(skill?.skillRange ?? skill?.range ?? skill?.metadata?.skillRange);
    return Number.isFinite(range) && range > 1 ? 'ranged' : 'melee';
  }

  function equippedWeapon(attacker, skill) {
    return skill?.weapon || skill?.sourceWeapon || skill?.metadata?.weapon ||
      attacker?.equipment?.mainHand || attacker?.equipment?.weapon || attacker?.mainHand || attacker?.weapon || null;
  }

  function skillHasReach(attacker, skill) {
    const arrays = [skill?.weaponProperties, skill?.properties, skill?.metadata?.weaponProperties, skill?.metadata?.properties];
    if (arrays.some((values) => Array.isArray(values) && values.map(normalizeId).includes('reach'))) return true;
    if (skill?.reach === true || skill?.metadata?.reach === true) return true;
    const weapon = equippedWeapon(attacker, skill);
    return Boolean(weapon && weaponProperties?.hasProperty?.(weapon, 'reach'));
  }

  function elevatedState(target) {
    if (isFlyingUnit(target)) return 'flying';
    if (isClimbingUnit(target)) return 'climbing';
    return null;
  }

  function elevatedTargetRule({ attacker, target, skill, resolutionType }) {
    const state = elevatedState(target);
    if (!state) return { allowed: true, canDamage: true, reason: 'target_not_elevated' };
    const delivery = deliveryType(skill);
    const resolution = normalizeId(resolutionType || 'unopposed');
    if (delivery === 'ranged') return { allowed: true, canDamage: true, reason: `ranged_vs_${state}` };
    if (skillHasReach(attacker, skill)) return { allowed: true, canDamage: true, reason: `reach_vs_${state}` };
    if (resolution === 'unopposed') return { allowed: false, canDamage: false, reason: `ground_melee_unopposed_cannot_target_${state}` };
    return { allowed: true, canDamage: true, reason: `melee_clash_vs_${state}` };
  }

  function flyingTargetRule(input) {
    return elevatedTargetRule(input || {});
  }

  function elevatedClashDamageRule({ attacker, defender, attackerSkill }) {
    const state = elevatedState(defender);
    if (!state) return { canDamage: true, reason: 'defender_not_elevated' };
    if (deliveryType(attackerSkill) === 'ranged') return { canDamage: true, reason: `ranged_vs_${state}` };
    if (skillHasReach(attacker, attackerSkill)) return { canDamage: true, reason: `reach_vs_${state}` };
    return { canDamage: true, reason: `lost_clash_vs_${state}` };
  }

  function flyingClashDamageRule(input) {
    return elevatedClashDamageRule(input || {});
  }

  function onKnockedDown(unit) {
    if (!unit) return { changed: false };
    const wasFlying = isFlyingUnit(unit);
    if (wasFlying || hasFlightCapability(unit)) unit.flying = false;
    return { changed: wasFlying, flying: false, prone: statusActive(unit, 'prone') };
  }

  function canUseFlyQuickAction(unit, options = {}) {
    if (!hasFlightCapability(unit)) return { available: false, reason: 'flight_capability_required' };
    if (isFlyingUnit(unit)) return { available: false, reason: 'already_flying' };
    const gate = actionEconomy?.availability?.(unit, 'quick_action', options);
    if (gate && gate.available === false) return gate;
    return { available: true, reason: null };
  }

  function useFlyQuickAction(unit, options = {}) {
    const gate = canUseFlyQuickAction(unit, options);
    if (!gate.available) return { used: false, reason: gate.reason };
    if (actionEconomy?.consume && !actionEconomy.consume(unit, 'quick_action', options)) return { used: false, reason: 'quick_action_unavailable' };
    unit.flying = true;
    if (statusEngine?.removeStatus) statusEngine.removeStatus(unit, 'prone', { ignoreProtection: true, from: 'fly_quick_action' });
    else if (unit.statusEffects?.prone) delete unit.statusEffects.prone;
    return { used: true, flying: true, removedProne: true };
  }

  function hasTrait(unit, traitId) {
    const id = normalizeId(traitId);
    const ids = Array.isArray(unit?.traitIds) ? unit.traitIds.map(normalizeId) : [];
    if (ids.includes(id)) return true;
    return Array.isArray(unit?.traits) && unit.traits.some((trait) => normalizeId(trait?.id || trait?.name) === id);
  }

  function underwaterContext(unit, options = {}) {
    const tags = [
      ...(Array.isArray(options.encounterTags) ? options.encounterTags : []),
      ...(Array.isArray(options.environmentTags) ? options.environmentTags : []),
      ...(Array.isArray(unit?.encounterTags) ? unit.encounterTags : []),
      ...(Array.isArray(unit?.environmentTags) ? unit.environmentTags : []),
    ].map(normalizeId);
    if (tags.includes('underwater') || tags.includes('submerged')) return true;
    const environment = options.environment || unit?.environment || null;
    if (normalizeId(environment?.encounterType) === 'underwater') return true;
    const effectIds = Array.isArray(environment?.effectIds) ? environment.effectIds.map(normalizeId) : [];
    return effectIds.includes('submerged') || effectIds.includes('in_water');
  }

  function canUseBubbleDash(unit, options = {}) {
    if (!hasTrait(unit, 'bubble_dash')) return { available: false, reason: 'bubble_dash_trait_required' };
    if (!underwaterContext(unit, options)) return { available: false, reason: 'underwater_required' };
    const gate = actionEconomy?.availability?.(unit, 'action', options);
    if (gate && gate.available === false) return gate;
    return { available: true, reason: null };
  }

  function useBubbleDash(unit, options = {}) {
    const gate = canUseBubbleDash(unit, options);
    if (!gate.available) return { used: false, reason: gate.reason };
    if (actionEconomy?.consume && !actionEconomy.consume(unit, 'action', options)) return { used: false, reason: 'action_unavailable' };
    const movementFeet = Math.max(0, Number(unit?.movementFeet?.swim ?? unit?.movement?.swim ?? unit?.mechanics?.movementFeet?.swim ?? 0) || 0);
    const reposition = {
      source: 'bubble_dash',
      movementMode: 'swim',
      maxMovementFeet: movementFeet,
      provokesCounterAttacks: false,
      provokesOpportunityAttacks: false,
    };
    unit.__luminousReposition = reposition;
    return { used: true, reposition: true, ...reposition };
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
    version: '2.2.0', ROCK_STATUS, registerRockStatus, ammunitionCount, setAmmunition, gainAmmunition, consumeAmmunition,
    consumeSkillAmmunition, onEncounterStart, onComeback, hasFlightCapability, isFlyingUnit, isClimbingUnit, deliveryType, skillHasReach,
    elevatedState, elevatedTargetRule, elevatedClashDamageRule, flyingTargetRule, flyingClashDamageRule, onKnockedDown, canUseFlyQuickAction, useFlyQuickAction,
    hasTrait, underwaterContext, canUseBubbleDash, useBubbleDash,
  });

  global.LuminousUnitCombatMechanics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
