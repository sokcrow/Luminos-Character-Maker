(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function statusEffect(status, potency, count) {
    return {
      trigger: '[On Hit]', target: 'target', type: 'status', status, potency, count,
      maxCap: 0, scaleTarget: null, scaleCondition: null, is_reuse: false,
      target_ally: false, timing: 'immediate', condition: null,
    };
  }

  function coin(index, effects = []) {
    return { index, type: 'normal', status: 'active', effects: clone(effects) };
  }

  function attack({ id, name, weaponId, variant, basePower, coinPower, coinAmount, damageType, skillRange, ammoType = null, pierced = 0, metadata = {} }) {
    const coins = Array.from({ length: coinAmount }, (_, index) => coin(index));
    if (pierced > 0 && coins.length) coins[coins.length - 1].effects.push(statusEffect('pierced', 0, pierced));
    const resourceCosts = ammoType
      ? [{ owner: 'source', type: 'ammunition', id: ammoType, amount: 1, timing: 'on_user' }]
      : [];
    return {
      id, name, type: 'Attack', tier: 1, maxCopies: 3,
      basePower, coinPower, coinAmount, coinType: 'positive', attackWeight: 1, skillRange,
      damageType, sinAffinity: 'sinless', scalingStat: 'Destreza', statUsed: '', skillUsed: '',
      targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1,
      sourceType: 'skill', sourceId: id, isItemSkill: false, isDefense: false, defenseSubtype: '',
      isClashable: true, isUnclashable: false, isIndiscriminate: false, isTargetFixed: false,
      requiresUnlock: false, resourceCosts, effects: [], coins, evolutionChain: null, schemaVersion: 2,
      metadata: {
        canonicalUnitSkill: true,
        species: 'goblin',
        unitVariant: variant,
        tier: 1,
        weaponSkill: true,
        weaponId,
        combatRange: skillRange > 1 ? 'ranged' : 'melee',
        statusFamily: pierced > 0 ? 'pierced' : null,
        goblinRuntimeManagedStatusEffects: pierced > 0,
        ...(ammoType ? { ammoType } : {}),
        ...(pierced > 0 ? { piercedCountOnHit: pierced, piercedBuild: 'bind_bleed' } : {}),
        ...clone(metadata),
      },
    };
  }

  const DEFINITIONS = Object.freeze({
    goblin_scimitar_slash: Object.freeze(attack({
      id: 'goblin_scimitar_slash',
      name: 'Scimitar Slash',
      weaponId: 'scimitar',
      variant: 'shared',
      basePower: 5,
      coinPower: 4,
      coinAmount: 2,
      damageType: 'cortante',
      skillRange: 1,
      metadata: { goblinMultiAttackEligible: true },
    })),
    goblin_shortbow_shot: Object.freeze(attack({
      id: 'goblin_shortbow_shot',
      name: 'Shortbow Shot',
      weaponId: 'shortbow',
      variant: 'standard',
      basePower: 6,
      coinPower: 4,
      coinAmount: 1,
      damageType: 'perforante',
      skillRange: 6,
      ammoType: 'arrows',
      pierced: 1,
    })),
    goblin_javelin_throw: Object.freeze(attack({
      id: 'goblin_javelin_throw',
      name: 'Javelin Throw',
      weaponId: 'javelin',
      variant: 'boss',
      basePower: 6,
      coinPower: 5,
      coinAmount: 1,
      damageType: 'perforante',
      skillRange: 5,
      ammoType: 'javelin',
      pierced: 1,
      metadata: { thrownProjectile: true },
    })),
  });

  const LOADOUTS = Object.freeze({
    goblin: Object.freeze(['goblin_scimitar_slash', 'goblin_shortbow_shot']),
    goblin_boss: Object.freeze(['goblin_scimitar_slash', 'goblin_javelin_throw']),
  });

  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
  function list() { return Object.values(DEFINITIONS).map(clone); }
  function loadout(unitId) { return LOADOUTS[String(unitId || '')] ? clone(LOADOUTS[String(unitId || '')]) : []; }
  function finalPower(skillOrId) {
    const skill = typeof skillOrId === 'string' ? get(skillOrId) : skillOrId;
    if (!skill) return null;
    return Number(skill.basePower || 0) + Number(skill.coinPower || 0) * Number(skill.coinAmount || 0);
  }
  function firebasePayload(schema = global.CombatSkillSchema) {
    const payload = {};
    list().forEach((skill) => {
      if (schema?.validateCombatSkill && schema?.serializeCombatSkill) {
        const validation = schema.validateCombatSkill(skill);
        if (!validation.valid) throw new Error(`${skill.id}: ${validation.errors.join(' · ')}`);
        payload[skill.id] = schema.serializeCombatSkill({ ...validation.skill, id: skill.id }, { includeLegacyAliases: true });
      } else payload[skill.id] = skill;
    });
    return payload;
  }

  const api = Object.freeze({ version: '1.0.1', DEFINITIONS, LOADOUTS, get, list, loadout, finalPower, firebasePayload });
  global.LuminousGoblinTier1SkillCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);