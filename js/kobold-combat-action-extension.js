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
      resourceHandlers: {
        ...(context.resourceHandlers || {}),
        ammunition: context.resourceHandlers?.ammunition || ammunitionHandler(),
      },
    };
  }

  function failedSaveTargets(result = {}, context = {}) {
    const rows = result?.resolution?.results || [];
    return rows.filter((row) => row?.result?.isSuccess === false).map((row) => unitById(context, row.targetId)).filter(Boolean);
  }

  function install() {
    const base = global.LuminousCombatActionResolver;
    if (!base || base.__koboldUnitMechanicsInstalled === true || !mechanics) return false;

    const wrappedResolveCombatAction = function (input = {}, rawContext = {}) {
      const context = withUnitResourceHandlers(rawContext);
      const normalized = global.LuminousCombatAction?.normalizeCombatAction ? global.LuminousCombatAction.normalizeCombatAction(input) : input;
      const actor = unitById(context, normalized.actorId);
      const source = normalized?.metadata?.sourceDefinition || {};

      if (normalized?.resolution?.type === 'unopposed' && actor && normalized?.targeting?.mainTargetId) {
        const target = unitById(context, normalized.targeting.mainTargetId);
        const rule = mechanics.flyingTargetRule?.({ attacker: actor, target, skill: source, resolutionType: 'unopposed' });
        if (rule?.allowed === false) return { resolved: false, reason: rule.reason, flyingRule: rule, action: normalized };
      }

      const result = base.resolveCombatAction(input, context);
      if (!result?.resolved || result?.resolution?.type !== 'save') return result;

      const failurePolicy = normalizeId(source?.save?.onFailure || source?.save?.on_failure || source?.saveOnFailure);
      if (failurePolicy !== 'unopposed_attack') return result;

      const failedTargets = failedSaveTargets(result, context);
      if (!failedTargets.length) return { ...result, failedSaveFollowup: { resolved: true, attacks: [] } };
      if (!actor || typeof base.resolveDirectAttack !== 'function') return { ...result, failedSaveFollowup: { resolved: false, reason: 'direct_attack_resolver_unavailable' } };

      const attack = base.resolveDirectAttack(result.action || normalized, actor, failedTargets, context, { skill: source, skipUseHooks: true });
      return { ...result, failedSaveFollowup: { resolved: Boolean(attack?.resolved), attacks: attack?.results || [], attack } };
    };

    global.LuminousCombatActionResolver = Object.freeze({
      ...base,
      __koboldUnitMechanicsInstalled: true,
      withUnitResourceHandlers,
      resolveCombatAction: wrappedResolveCombatAction,
    });
    return true;
  }

  const api = Object.freeze({ version: '1.0.0', ammunitionHandler, withUnitResourceHandlers, install });
  global.LuminousKoboldCombatActionExtension = api;
  install();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
