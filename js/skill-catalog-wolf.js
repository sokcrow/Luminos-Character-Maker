(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeRequire = (path) => {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  };
  const schema = global.CombatSkillSchema || safeRequire('./combat-skill-schema.js');

  function condition(status, component, value) {
    return { target: 'target', stat: status, component, operator: '>=', value };
  }
  function statusEffect(status, potency, count, when = null) {
    return {
      trigger: '[On Hit]', target: 'target', type: 'status', status, potency, count,
      maxCap: 0, scaleTarget: null, scaleCondition: null, is_reuse: false,
      target_ally: false, timing: 'immediate', condition: when ? clone(when) : null,
    };
  }
  function coin(index, effects = []) { return { index, type: 'normal', status: 'active', effects: clone(effects) }; }

  function attack({ id, name, variant, tier = 1, basePower, coinPower, coinAmount, coinEffects = {}, metadata = {} }) {
    const coins = Array.from({ length: coinAmount }, (_, index) => coin(index, coinEffects[index] || []));
    return {
      id, name, type: 'Attack', tier, maxCopies: tier === 1 ? 3 : 2,
      basePower, coinPower, coinAmount, coinType: 'positive', attackWeight: 1, skillRange: 1,
      damageType: 'perforante', sinAffinity: 'sinless', scalingStat: 'Fuerza', statUsed: '', skillUsed: '',
      targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1, sourceType: 'skill', sourceId: id,
      isItemSkill: false, isDefense: false, defenseSubtype: '', isClashable: true, isUnclashable: false,
      isIndiscriminate: false, isTargetFixed: false, requiresUnlock: false, resourceCosts: [], effects: [], coins,
      evolutionChain: null, schemaVersion: 2,
      metadata: {
        canonicalUnitSkill: true, species: variant === 'dire_wolf' ? 'dire_wolf' : 'wolf', unitVariant: variant,
        tier, statusFamily: 'bleed_sinking', combatRange: 'melee', weaponSkill: true, naturalWeapon: 'fangs',
        wolfRuntimeManagedStatusEffects: true, ...clone(metadata),
      },
    };
  }

  function evade({ id, name, variant, basePower, coinPower }) {
    return {
      id, name, type: 'Defense', tier: 1, maxCopies: 3,
      basePower, coinPower, coinAmount: 1, coinType: 'positive', attackWeight: 1, skillRange: 1,
      damageType: 'contundente', sinAffinity: 'sinless', scalingStat: 'Destreza', statUsed: '', skillUsed: '',
      targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1, sourceType: 'skill', sourceId: id,
      isItemSkill: false, isDefense: true, defenseSubtype: 'Evade', isClashable: true, isUnclashable: false,
      isIndiscriminate: false, isTargetFixed: false, requiresUnlock: false, resourceCosts: [], effects: [],
      coins: [coin(0)], evolutionChain: null, schemaVersion: 2,
      metadata: { canonicalUnitSkill: true, species: variant === 'dire_wolf' ? 'dire_wolf' : 'wolf', unitVariant: variant, tier: 1, rulesPolicy: 'defense_only', combatRange: 'self', weaponSkill: false },
    };
  }

  const bleed3 = condition('bleed', 'count', 3);
  const bleed4 = condition('bleed', 'count', 4);
  const sinking3 = condition('sinking', 'count', 3);
  const sinking4 = condition('sinking', 'count', 4);

  const DEFINITIONS = Object.freeze({
    wolf_bite: Object.freeze(attack({
      id: 'wolf_bite', name: 'Bite', variant: 'wolf', basePower: 6, coinPower: 5, coinAmount: 1,
      coinEffects: { 0: [
        statusEffect('bleed', 1, 2),
        statusEffect('sinking', 0, 2, bleed3),
      ] },
    })),
    wolf_gnaw: Object.freeze(attack({
      id: 'wolf_gnaw', name: 'Gnaw', variant: 'wolf', basePower: 4, coinPower: 3, coinAmount: 2,
      coinEffects: { 1: [
        statusEffect('sinking', 1, 2),
        statusEffect('bleed', 0, 2, sinking3),
      ] },
    })),
    wolf_prowl_away: Object.freeze(evade({ id: 'wolf_prowl_away', name: 'Prowl Away', variant: 'wolf', basePower: 5, coinPower: 5 })),
    wolf_hunting_bite: Object.freeze(attack({
      id: 'wolf_hunting_bite', name: 'Hunting Bite', variant: 'wolf', tier: 2, basePower: 6, coinPower: 5, coinAmount: 2,
      coinEffects: { 1: [
        statusEffect('bleed', 1, 2),
        statusEffect('sinking', 1, 2, bleed4),
      ] },
    })),

    dire_wolf_bite: Object.freeze(attack({
      id: 'dire_wolf_bite', name: 'Dire Bite', variant: 'dire_wolf', basePower: 6, coinPower: 6, coinAmount: 1,
      coinEffects: { 0: [
        statusEffect('bleed', 1, 2),
        statusEffect('sinking', 1, 2, bleed3),
      ] },
    })),
    dire_wolf_stalking_step: Object.freeze(evade({ id: 'dire_wolf_stalking_step', name: 'Stalking Step', variant: 'dire_wolf', basePower: 6, coinPower: 5 })),
    dire_wolf_rending_fangs: Object.freeze(attack({
      id: 'dire_wolf_rending_fangs', name: 'Rending Fangs', variant: 'dire_wolf', tier: 2, basePower: 7, coinPower: 5, coinAmount: 2,
      coinEffects: {
        0: [statusEffect('bleed', 0, 2)],
        1: [statusEffect('bleed', 1, 3, sinking4)],
      },
    })),
    dire_wolf_break_the_prey: Object.freeze(attack({
      id: 'dire_wolf_break_the_prey', name: 'Break the Prey', variant: 'dire_wolf', tier: 2, basePower: 6, coinPower: 4, coinAmount: 3,
      coinEffects: { 2: [statusEffect('bleed', 0, 2), statusEffect('sinking', 0, 2)] },
      metadata: {
        wolfFinalPowerIf: {
          all: [condition('bleed', 'count', 4), condition('sinking', 'count', 4)],
          bonus: 1,
          timing: '[Before Attack]',
        },
      },
    })),
  });

  const LOADOUTS = Object.freeze({
    wolf: Object.freeze({ tier1: Object.freeze(['wolf_bite', 'wolf_gnaw', 'wolf_prowl_away']), tier2: Object.freeze(['wolf_hunting_bite']) }),
    dire_wolf: Object.freeze({ tier1: Object.freeze(['dire_wolf_bite', 'dire_wolf_stalking_step']), tier2: Object.freeze(['dire_wolf_rending_fangs', 'dire_wolf_break_the_prey']) }),
  });

  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
  function list() { return Object.values(DEFINITIONS).map(clone); }
  function loadout(id) { return LOADOUTS[String(id || '')] ? clone(LOADOUTS[String(id || '')]) : null; }
  function firebasePayload(schemaOverride = schema) {
    const payload = {};
    list().forEach((skill) => { payload[skill.id] = schemaOverride?.serializeCombatSkill ? schemaOverride.serializeCombatSkill(skill) : skill; });
    return payload;
  }

  const api = Object.freeze({ version: '1.0.0', DEFINITIONS, LOADOUTS, condition, statusEffect, get, list, loadout, firebasePayload });
  global.LuminousWolfSkillCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
