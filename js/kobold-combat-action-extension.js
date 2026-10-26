(function (global) {
  'use strict';

  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const mechanics = global.LuminousUnitCombatMechanics || (typeof require === 'function' ? (() => { try { return require('./unit-combat-mechanics-runtime.js'); } catch (_) { return null; } })() : null);

  function entityId(entity = {}) { return String(entity.id ?? entity.unitId ?? entity.characterId ?? '').trim(); }
  function unitById(context = {}, id) {
    const wanted = String(id ?? '');
    const units = Array.isArray(context.units) ? context.units : Object.values(context.combatData || {});
    return units.find((unit) => entityId(unit) === wanted) || null;
  }
  function normalizeAction(input) { return global.LuminousCombatAction?.normalizeCombatAction ? global.LuminousCombatAction.normalizeCombatAction(input) : input; }
  function sourceOf(action = {}) { return action?.metadata?.sourceDefinition || {}; }

  function ammunitionHandler() {
    return {
      validate({ actor, resource }) {
        const current = mechanics?.ammunitionCount ? mechanics.ammunitionCount(actor, resource.id) : 0;
        const required = Math.max(1, Number(resource.amount || 1));
        return { available: current >= required, current, required, reason: current >= required ? null : 'ammunition_unavailable' };
      },
      consume({ actor, resource }) {
        const result = mechanics?.consumeAmmunition ? mechanics.consumeAmmunition(actor, resource.id, resource.amount) : { ok: false, reason: 'ammunition_runtime_unavailable' };
        return { ...result, consumed: result.ok === true, success: result.ok === true, reason: result.ok === true ? null : (result.reason || 'ammunition_unavailable') };
      },
    };
  }

  function withUnitResourceHandlers(context = {}) {
    return {
      ...context,
      resourceHandlers: { ...(context.resourceHandlers || {}), ammunition: context.resourceHandlers?.ammunition || ammunitionHandler() },
    };
  }

  function applyDeclaredEconomy(action) {
    const source = sourceOf(action);
    const declared = normalizeId(source?.economy);
    if (declared === 'quick_action' && action?.economy) action.economy.cost = 'quick_action';
    if (declared === 'reaction' && action?.economy) action.economy.cost = 'reaction';
    return action;
  }

  function flyingUnopposedGate(action, actor, context) {
    if (action?.resolution?.type !== 'unopposed' || !actor) return null;
    const ids = [action?.targeting?.mainTargetId, ...(action?.targeting?.targetIds || [])].filter(Boolean);
    for (const id of ids) {
      const target = unitById(context, id);
      const rule = mechanics.flyingTargetRule?.({ attacker: actor, target, skill: sourceOf(action), resolutionType: 'unopposed' });
      if (rule?.allowed === false) return rule;
    }
    return null;
  }

  function runWithFlyingClashGuard(action, context, run) {
    if (action?.resolution?.type !== 'clash' || !context.opposingAction) return run();
    const engine = context.engine || global.CombatEngine;
    if (!engine || typeof engine.resolveUnilateralWithCounter !== 'function') return run();

    const opposing = normalizeAction(context.opposingAction);
    const original = engine.resolveUnilateralWithCounter;
    const sourceA = sourceOf(action);
    const sourceB = sourceOf(opposing);
    const actorA = unitById(context, action.actorId);
    const actorB = unitById(context, opposing.actorId);

    engine.resolveUnilateralWithCounter = function (attacker, attackSkill, defender, counterSkill, options) {
      const attackerIsA = entityId(attacker) === entityId(actorA);
      const defenderSkill = attackerIsA ? sourceB : sourceA;
      const rule = mechanics.flyingClashDamageRule?.({ attacker, defender, attackerSkill: attackSkill, defenderSkill });
      if (rule?.canDamage === false && normalizeId(options?.clashResult) === 'win') {
        return { resolved: true, damageNegated: true, damage: 0, flyingRule: rule, attackLogs: [], message: 'Clash won; melee damage cannot reach the Flying Unit.' };
      }
      return original.call(engine, attacker, attackSkill, defender, counterSkill, options);
    };

    try { return run(); }
    finally { engine.resolveUnilateralWithCounter = original; }
  }

  function failedSaveTargets(result = {}, context = {}) {
    return (result?.resolution?.results || []).filter((row) => row?.result?.isSuccess === false).map((row) => unitById(context, row.targetId)).filter(Boolean);
  }

  function install() {
    const base = global.LuminousCombatActionResolver;
    if (!base || base.__koboldUnitMechanicsInstalled === true || !mechanics) return false;

    const wrappedResolveCombatAction = function (input = {}, rawContext = {}) {
      const context = withUnitResourceHandlers(rawContext);
      const action = applyDeclaredEconomy(normalizeAction(input));
      const actor = unitById(context, action.actorId);
      const source = sourceOf(action);
      const flyingGate = flyingUnopposedGate(action, actor, context);
      if (flyingGate) return { resolved: false, reason: flyingGate.reason, flyingRule: flyingGate, action };

      const result = runWithFlyingClashGuard(action, context, () => base.resolveCombatAction(action, context));
      if (!result?.resolved || result?.resolution?.type !== 'save') return result;

      const failurePolicy = normalizeId(source?.save?.onFailure || source?.save?.on_failure || source?.saveOnFailure);
      if (failurePolicy !== 'unopposed_attack') return result;
      const failedTargets = failedSaveTargets(result, context);
      if (!failedTargets.length) return { ...result, failedSaveFollowup: { resolved: true, attacks: [] } };
      if (!actor || typeof base.resolveDirectAttack !== 'function') return { ...result, failedSaveFollowup: { resolved: false, reason: 'direct_attack_resolver_unavailable' } };

      const attack = base.resolveDirectAttack(result.action || action, actor, failedTargets, context, { skill: source, skipUseHooks: true });
      return { ...result, failedSaveFollowup: { resolved: Boolean(attack?.resolved), attacks: attack?.results || [], attack } };
    };

    global.LuminousCombatActionResolver = Object.freeze({ ...base, __koboldUnitMechanicsInstalled: true, withUnitResourceHandlers, resolveCombatAction: wrappedResolveCombatAction });
    return true;
  }

  const api = Object.freeze({ version: '1.1.0', ammunitionHandler, withUnitResourceHandlers, applyDeclaredEconomy, runWithFlyingClashGuard, install });
  global.LuminousKoboldCombatActionExtension = api;
  install();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
