(function (global) {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function statusEffect(status, potency, count) {
    return {
      trigger: '[On Hit]', target: 'target', type: 'status', status, potency, count,
      maxCap: 0, scaleTarget: null, scaleCondition: null, is_reuse: false,
      target_ally: false, timing: 'immediate', condition: null,
    };
  }

  function coin(index, effects) { return { index, type: 'normal', status: 'active', effects: effects || [] }; }

  function attack({ id, name, variant, tier = 1, maxCopies, basePower, coinPower, coinAmount, damageType, skillRange, statusFamily, statusCoin = 0, potency, count, effects = [], metadata = {} }) {
    const coins = Array.from({ length: coinAmount }, (_, index) => coin(index, []));
    if (statusFamily && coins[statusCoin]) coins[statusCoin].effects.push(statusEffect(statusFamily, potency, count));
    return {
      id, name, type: 'Attack', tier, maxCopies: maxCopies ?? (tier === 1 ? 3 : tier === 2 ? 2 : 1),
      basePower, coinPower, coinAmount, coinType: 'positive', attackWeight: 1, skillRange,
      damageType, sinAffinity: 'sinless', scalingStat: 'Destreza', statUsed: '', skillUsed: '',
      targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1, sourceType: 'skill', sourceId: id,
      isItemSkill: false, isDefense: false, defenseSubtype: '', isClashable: true, isUnclashable: false,
      isIndiscriminate: false, isTargetFixed: false, requiresUnlock: false,
      effects: clone(effects), coins, evolutionChain: null, schemaVersion: 2,
      metadata: {
        canonicalUnitSkill: true, species: 'kobold', unitVariant: variant, tier,
        statusFamily: statusFamily || null, combatRange: skillRange > 1 ? 'ranged' : 'melee', ...metadata,
      },
    };
  }

  function evade({ id, name, variant }) {
    return {
      id, name, type: 'Defense', tier: 1, maxCopies: 3,
      basePower: 5, coinPower: 5, coinAmount: 1, coinType: 'positive', attackWeight: 1,
      skillRange: 1, damageType: 'contundente', sinAffinity: 'sinless', scalingStat: 'Destreza',
      statUsed: '', skillUsed: '', targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1,
      sourceType: 'skill', sourceId: id, isItemSkill: false, isDefense: true, defenseSubtype: 'Evade',
      isClashable: true, isUnclashable: false, isIndiscriminate: false, isTargetFixed: false,
      requiresUnlock: false, effects: [], coins: [coin(0, [])], evolutionChain: null, schemaVersion: 2,
      metadata: { canonicalUnitSkill: true, species: 'kobold', unitVariant: variant, tier: 1, statusFamily: null, rulesPolicy: 'defense_only', combatRange: 'self' },
    };
  }

  function fallingRock() {
    return {
      id: 'winged_kobold_falling_rock',
      name: 'Falling Rock',
      type: 'Attack',
      tier: 1,
      maxCopies: 3,
      basePower: 3,
      coinPower: 3,
      coinAmount: 1,
      coinType: 'positive',
      attackWeight: 1,
      skillRange: 6,
      damageType: 'contundente',
      sinAffinity: 'sinless',
      scalingStat: 'Destreza',
      statUsed: '',
      skillUsed: '',
      economy: 'quick_action',
      targetingType: 'Focused Attack',
      aoePattern: 'Self',
      skillAmount: 1,
      sourceType: 'skill',
      sourceId: 'winged_kobold_falling_rock',
      isItemSkill: false,
      isDefense: false,
      defenseSubtype: '',
      isClashable: false,
      isUnclashable: true,
      isIndiscriminate: false,
      isTargetFixed: false,
      requiresUnlock: false,
      save: { ability: 'dexterity', dc: 9, onSuccess: 'negates', onFailure: 'unopposed_attack' },
      resourceCosts: [{ owner: 'source', type: 'ammunition', id: 'rock', amount: 1, timing: 'on_user' }],
      effects: [],
      coins: [coin(0, [])],
      evolutionChain: null,
      schemaVersion: 2,
      metadata: {
        canonicalUnitSkill: true,
        species: 'kobold',
        unitVariant: 'winged',
        tier: 1,
        tierPowerException: 'save_harassment_skill',
        combatRange: 'ranged',
        damageTypeLabel: 'Blunt',
        economyLabel: 'Quick Action',
        resolutionPolicy: 'save_then_unopposed_attack_on_failure',
      },
    };
  }

  const DEFINITIONS = Object.freeze({
    kobold_dagger_jab: Object.freeze(attack({ id: 'kobold_dagger_jab', name: 'Dagger Jab', variant: 'dagger', basePower: 6, coinPower: 5, coinAmount: 1, damageType: 'perforante', skillRange: 1, statusFamily: 'bleed', statusCoin: 0, potency: 1, count: 2 })),
    kobold_desperate_stab: Object.freeze(attack({ id: 'kobold_desperate_stab', name: 'Desperate Stab', variant: 'dagger', basePower: 4, coinPower: 3, coinAmount: 2, damageType: 'perforante', skillRange: 1, statusFamily: 'bleed', statusCoin: 1, potency: 1, count: 3 })),
    kobold_scurry: Object.freeze(evade({ id: 'kobold_scurry', name: 'Scurry', variant: 'dagger' })),
    kobold_sling_shot: Object.freeze(attack({ id: 'kobold_sling_shot', name: 'Sling Shot', variant: 'sling', basePower: 6, coinPower: 4, coinAmount: 1, damageType: 'contundente', skillRange: 6, statusFamily: 'tremor', statusCoin: 0, potency: 1, count: 2 })),
    kobold_rapid_pebble: Object.freeze(attack({ id: 'kobold_rapid_pebble', name: 'Rapid Pebble', variant: 'sling', basePower: 4, coinPower: 3, coinAmount: 2, damageType: 'contundente', skillRange: 6, statusFamily: 'tremor', statusCoin: 1, potency: 1, count: 3 })),
    kobold_duck_away: Object.freeze(evade({ id: 'kobold_duck_away', name: 'Duck Away', variant: 'sling' })),

    winged_kobold_dagger: Object.freeze(attack({ id: 'winged_kobold_dagger', name: 'Airborne Dagger', variant: 'winged', tier: 1, basePower: 5, coinPower: 5, coinAmount: 1, damageType: 'perforante', skillRange: 1, metadata: { rulesPolicy: 'flying_melee' } })),
    winged_kobold_falling_rock: Object.freeze(fallingRock()),
    winged_kobold_dive_stab: Object.freeze(attack({ id: 'winged_kobold_dive_stab', name: 'Dive Stab', variant: 'winged', tier: 2, maxCopies: 2, basePower: 7, coinPower: 5, coinAmount: 2, damageType: 'perforante', skillRange: 1, metadata: { rulesPolicy: 'flying_melee_commit' } })),

    dragonheart_spear_thrust: Object.freeze(attack({ id: 'dragonheart_spear_thrust', name: 'Spear Thrust', variant: 'dragonheart', tier: 1, basePower: 6, coinPower: 6, coinAmount: 1, damageType: 'perforante', skillRange: 1 })),
    dragonheart_guarding_skewer: Object.freeze(attack({ id: 'dragonheart_guarding_skewer', name: 'Guarding Skewer', variant: 'dragonheart', tier: 2, maxCopies: 2, basePower: 7, coinPower: 5, coinAmount: 2, damageType: 'perforante', skillRange: 1, metadata: { condition: 'while_command_rank_active', conditionBonus: '+1 Clash Power' } })),
    dragonheart_dragon_spear: Object.freeze(attack({ id: 'dragonheart_dragon_spear', name: 'Dragon Spear', variant: 'dragonheart', tier: 3, maxCopies: 1, basePower: 9, coinPower: 5, coinAmount: 3, damageType: 'perforante', skillRange: 1, metadata: { condition: 'target_has_negative_status', conditionBonus: '+1 Final Power' } })),
  });

  function list() { return Object.values(DEFINITIONS).map(clone); }
  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
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

  const api = Object.freeze({ version: '1.1.0', DEFINITIONS, list, get, finalPower, firebasePayload });
  global.LuminousKoboldTier1SkillCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
