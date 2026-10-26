(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function creatureTypes() {
    if (global?.LuminousCreatureTypeCatalog) return global.LuminousCreatureTypeCatalog;
    if (typeof require === 'function') {
      try { return require('./creature-type-catalog.js'); } catch (_) {}
    }
    return null;
  }

  const CANONICAL_KEYS = Object.freeze([
    'allowedCreatureTypes',
    'excludedCreatureTypes',
    'allowedCreatureSubtypes',
    'excludedCreatureSubtypes',
  ]);

  const LEGACY_KEYS = Object.freeze([
    'creatureTypes',
    'targetCreatureTypes',
    'forbiddenCreatureTypes',
    'creatureSubtypes',
    'targetCreatureSubtypes',
    'forbiddenCreatureSubtypes',
    'targetingRules',
    'targetingRestrictions',
  ]);

  function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null);
  }

  function rawRule(source = {}) {
    const targeting = source?.targeting && typeof source.targeting === 'object' ? source.targeting : {};
    const rules = source?.targetingRules && typeof source.targetingRules === 'object' ? source.targetingRules : {};
    const restrictions = source?.targetingRestrictions && typeof source.targetingRestrictions === 'object' ? source.targetingRestrictions : {};
    return {
      allowedCreatureTypes: firstDefined(
        source.allowedCreatureTypes,
        rules.allowedCreatureTypes,
        restrictions.allowedCreatureTypes,
        targeting.allowedCreatureTypes,
        source.creatureTypes,
        rules.creatureTypes,
        restrictions.creatureTypes,
        targeting.creatureTypes,
        source.targetCreatureTypes,
      ),
      excludedCreatureTypes: firstDefined(
        source.excludedCreatureTypes,
        rules.excludedCreatureTypes,
        restrictions.excludedCreatureTypes,
        targeting.excludedCreatureTypes,
        source.forbiddenCreatureTypes,
      ),
      allowedCreatureSubtypes: firstDefined(
        source.allowedCreatureSubtypes,
        rules.allowedCreatureSubtypes,
        restrictions.allowedCreatureSubtypes,
        targeting.allowedCreatureSubtypes,
        source.creatureSubtypes,
        source.targetCreatureSubtypes,
      ),
      excludedCreatureSubtypes: firstDefined(
        source.excludedCreatureSubtypes,
        rules.excludedCreatureSubtypes,
        restrictions.excludedCreatureSubtypes,
        targeting.excludedCreatureSubtypes,
        source.forbiddenCreatureSubtypes,
      ),
    };
  }

  function normalizeTypes(value) {
    const catalog = creatureTypes();
    if (!catalog?.assertCreatureType) throw new Error('CREATURE_TYPE_CATALOG_REQUIRED');
    return [...new Set(asArray(value).filter((entry) => entry !== '' && entry != null).map((entry) => catalog.assertCreatureType(entry)))];
  }

  function normalizeSubtypes(value) {
    const catalog = creatureTypes();
    if (!catalog?.normalizeCreatureSubtypes) throw new Error('CREATURE_TYPE_CATALOG_REQUIRED');
    return catalog.normalizeCreatureSubtypes(value);
  }

  function normalizeRule(source = {}) {
    const raw = rawRule(source);
    return {
      allowedCreatureTypes: normalizeTypes(raw.allowedCreatureTypes),
      excludedCreatureTypes: normalizeTypes(raw.excludedCreatureTypes),
      allowedCreatureSubtypes: normalizeSubtypes(raw.allowedCreatureSubtypes),
      excludedCreatureSubtypes: normalizeSubtypes(raw.excludedCreatureSubtypes),
    };
  }

  function hasRestrictions(source = {}) {
    const rule = normalizeRule(source);
    return CANONICAL_KEYS.some((key) => rule[key].length > 0);
  }

  function validateRule(source = {}) {
    try {
      const rule = normalizeRule(source);
      const contradictoryTypes = rule.allowedCreatureTypes.filter((id) => rule.excludedCreatureTypes.includes(id));
      const contradictorySubtypes = rule.allowedCreatureSubtypes.filter((id) => rule.excludedCreatureSubtypes.includes(id));
      const errors = [];
      if (contradictoryTypes.length) errors.push(`SPELL_TARGETING_TYPE_CONTRADICTION:${contradictoryTypes.join(',')}`);
      if (contradictorySubtypes.length) errors.push(`SPELL_TARGETING_SUBTYPE_CONTRADICTION:${contradictorySubtypes.join(',')}`);
      return { valid: errors.length === 0, errors, rule };
    } catch (error) {
      return { valid: false, errors: [String(error?.message || error)], rule: null };
    }
  }

  function canonicalizeSpellDefinition(definition = {}) {
    const validation = validateRule(definition);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' | ') || 'SPELL_TARGETING_INVALID');
      error.code = 'SPELL_TARGETING_INVALID';
      error.errors = validation.errors;
      throw error;
    }
    const spell = clone(definition || {}) || {};
    LEGACY_KEYS.forEach((key) => { if (key in spell) delete spell[key]; });
    if (spell.targeting && typeof spell.targeting === 'object') {
      const targeting = { ...spell.targeting };
      [...CANONICAL_KEYS, 'creatureTypes'].forEach((key) => { if (key in targeting) delete targeting[key]; });
      spell.targeting = targeting;
    }
    return { ...spell, ...clone(validation.rule) };
  }

  function ruleForSpell(spell = {}) {
    return normalizeRule(spell);
  }

  function matchesTarget(spell = {}, target = {}) {
    const catalog = creatureTypes();
    if (!catalog?.matchesTargetRule) return false;
    const rule = normalizeRule(spell);
    return catalog.matchesTargetRule(target, rule);
  }

  function validateTarget(spell = {}, target = {}) {
    const validation = validateRule(spell);
    if (!validation.valid) return { valid: false, reason: 'SPELL_TARGETING_INVALID', errors: validation.errors, rule: validation.rule, targetProfile: null };
    const restricted = CANONICAL_KEYS.some((key) => validation.rule[key].length > 0);
    if (!restricted) return { valid: true, reason: null, errors: [], rule: validation.rule, targetProfile: null };
    const catalog = creatureTypes();
    if (!catalog?.profileForUnit || !catalog?.matchesTargetRule) return { valid: false, reason: 'CREATURE_TYPE_CATALOG_REQUIRED', errors: ['CREATURE_TYPE_CATALOG_REQUIRED'], rule: validation.rule, targetProfile: null };
    let profile = null;
    try { profile = catalog.profileForUnit(target, { required: false }); } catch (error) {
      return { valid: false, reason: 'SPELL_TARGET_CREATURE_TYPE_INVALID', errors: [String(error?.message || error)], rule: validation.rule, targetProfile: null };
    }
    if (!profile) return { valid: false, reason: 'SPELL_TARGET_CREATURE_TYPE_REQUIRED', errors: ['SPELL_TARGET_CREATURE_TYPE_REQUIRED'], rule: validation.rule, targetProfile: null };
    const valid = catalog.matchesTargetRule(target, validation.rule);
    return {
      valid,
      reason: valid ? null : 'SPELL_TARGET_INVALID_CREATURE_TYPE',
      errors: valid ? [] : ['SPELL_TARGET_INVALID_CREATURE_TYPE'],
      rule: validation.rule,
      targetProfile: profile,
    };
  }

  function authoringContract() {
    const catalog = creatureTypes();
    return {
      schemaVersion: 1,
      canonicalKeys: [...CANONICAL_KEYS],
      creatureTypes: catalog?.list?.() || [],
      subtypeFormat: 'normalized_open_token',
      example: {
        allowedCreatureTypes: ['beast'],
        excludedCreatureTypes: [],
        allowedCreatureSubtypes: [],
        excludedCreatureSubtypes: [],
      },
    };
  }

  const api = Object.freeze({
    version: '1.0.0',
    CANONICAL_KEYS,
    normalizeRule,
    validateRule,
    hasRestrictions,
    canonicalizeSpellDefinition,
    ruleForSpell,
    matchesTarget,
    validateTarget,
    authoringContract,
  });

  global.LuminousSpellTargetingLanguage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
