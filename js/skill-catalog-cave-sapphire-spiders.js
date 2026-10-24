(function (global) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const effect = (status, { target = 'target', potency = 0, count = 0, trigger = '[On Hit]', timing = 'immediate' } = {}) =>
    ({ trigger, target, type: 'status', status, potency, count, timing });
  const coin = (index, effects = []) => ({ index, type: 'normal', status: 'active', effects });
  const attack = (id, name, tier, basePower, coinPower, coinAmount, damageType, effects, coins, owner, description) => ({
    id, name, type: 'Attack', tier, maxCopies: tier === 1 ? 3 : tier === 2 ? 2 : 1,
    basePower, coinPower, coinAmount, coinType: 'positive', attackWeight: 1, skillRange: 1,
    damageType, sinAffinity: 'pride', scalingStat: 'Destreza', statUsed: '', skillUsed: '',
    targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1, sourceType: 'skill',
    sourceId: id, isItemSkill: false, isDefense: false, defenseSubtype: '', isClashable: true,
    isUnclashable: false, isIndiscriminate: false, isTargetFixed: false, requiresUnlock: false,
    resourceCosts: [], effects, coins, evolutionChain: null, schemaVersion: 2,
    metadata: { canonicalUnitSkill: true, caveSapphireSpider: owner, naturalWeapon: true, description }
  });
  const evade = (id, name, dex, owner, poisePerBonus, maxBonus) => ({
    id, name, type: 'Defense', tier: 1, maxCopies: 1, basePower: Math.floor((dex - 10) / 2),
    coinPower: dex, coinAmount: 1, coinType: 'positive', attackWeight: 1, skillRange: 1,
    damageType: 'Evade', sinAffinity: 'sinless', scalingStat: 'Destreza', statUsed: '',
    skillUsed: '', targetingType: 'Self', aoePattern: 'Self', skillAmount: 1,
    sourceType: 'skill', sourceId: id, isItemSkill: false, isDefense: true, defenseSubtype: 'Evade',
    isClashable: false, isUnclashable: true, isIndiscriminate: false, isTargetFixed: true,
    requiresUnlock: false, resourceCosts: [], effects: [], coins: [coin(0, [
      effect('haste', { target: 'self', count: 1, trigger: '[On Evade]', timing: 'next_turn' })
    ])], evolutionChain: null, schemaVersion: 2,
    metadata: { canonicalUnitSkill: true, caveSapphireSpider: owner, poiseEvadeBonusPerCount: poisePerBonus,
      poiseEvadeBonusMax: maxBonus, defensiveScoreKey: 'dex', scoreScaledDefense: true }
  });

  const DEFINITIONS = Object.freeze({
    sapphire_spider_prismatic_slash: attack('sapphire_spider_prismatic_slash', 'Prismatic Slash', 1, 6, 3, 3, 'cortante', [
      effect('poise', { target: 'self', potency: 1, count: 3, trigger: '[On Use]' })
    ], [
      coin(0, [effect('poise', { target: 'self', potency: 1 })]),
      coin(1, [effect('poise', { target: 'self', potency: 2, trigger: '[Heads Hit]' })]),
      coin(2, [effect('haste', { target: 'self', count: 2, trigger: '[On Crit]', timing: 'next_turn' })])
    ], 'adult', 'On Coin 3 Hit, gain 2 Poise Count if the target is slower (runtime conditional).'),
    sapphire_spider_crystal_thread: attack('sapphire_spider_crystal_thread', 'Crystal Thread', 2, 7, 4, 2, 'perforante', [
      effect('haste', { target: 'self', count: 3, trigger: '[Clash Win]', timing: 'next_turn' })
    ], [
      coin(0, [effect('bind', { count: 1, timing: 'next_turn' })]),
      coin(1, [effect('bind', { count: 1, timing: 'next_turn' })])
    ], 'adult', 'On Coin 2 Crit inflict 1 Restrained; +1 if faster; +1 if the target has Bind (runtime conditional).'),
    sapphire_spider_hunters_sting: attack('sapphire_spider_hunters_sting', "Hunter's Sting", 3, 7, 4, 3, 'perforante', [
      effect('poise', { target: 'self', potency: 3, trigger: '[On Use]' })
    ], [
      coin(0, [effect('poise', { target: 'self', count: 2 })]),
      coin(1, [effect('bind', { count: 1, timing: 'next_turn' })]),
      coin(2, [effect('poise', { target: 'self', count: 2 })])
    ], 'adult', 'Coins 2/3 apply 2 Fragile next Turn if Restrained; Coin 3 Crit grants 4 Haste if Restrained and +20% Crit Damage.'),
    sapphire_spider_faceted_evasion: evade('sapphire_spider_faceted_evasion', 'Faceted Evasion', 18, 'adult', 3, 3),
    sapphire_spiderling_shard_claws: attack('sapphire_spiderling_shard_claws', 'Shard Claws', 1, 5, 3, 2, 'cortante', [
      effect('haste', { target: 'self', count: 1, trigger: '[On Use]', timing: 'next_turn' })
    ], [
      coin(0, [effect('poise', { target: 'self', potency: 1 })]),
      coin(1, [effect('poise', { target: 'self', count: 2, trigger: '[Heads Hit]' })])
    ], 'spiderling', 'Juvenile Poise / Haste starter.'),
    sapphire_spiderling_silken_snare: attack('sapphire_spiderling_silken_snare', 'Silken Snare', 2, 6, 3, 2, 'perforante', [
      effect('bind', { count: 1, trigger: '[Clash Win]', timing: 'next_turn' })
    ], [
      coin(0, [effect('bind', { count: 1, timing: 'next_turn' })]),
      coin(1, [effect('bind', { count: 1, timing: 'next_turn' })])
    ], 'spiderling', 'Up to 3 Bind next Turn on Clash Win and both Coins hit.'),
    sapphire_spiderling_skittering_evasion: evade('sapphire_spiderling_skittering_evasion', 'Skittering Evasion', 16, 'spiderling', 2, 2)
  });
  const LOADOUTS = Object.freeze({
    sapphire_spider: Object.freeze(['sapphire_spider_prismatic_slash', 'sapphire_spider_crystal_thread',
      'sapphire_spider_hunters_sting', 'sapphire_spider_faceted_evasion']),
    sapphire_spiderling: Object.freeze(['sapphire_spiderling_shard_claws',
      'sapphire_spiderling_silken_snare', 'sapphire_spiderling_skittering_evasion'])
  });
  const get = id => DEFINITIONS[id] ? clone(DEFINITIONS[id]) : null;
  const list = () => Object.keys(DEFINITIONS).map(get);
  const loadout = id => LOADOUTS[id] ? [...LOADOUTS[id]] : null;
  const firebasePayload = (schema = global.CombatSkillSchema) => {
    const result = {};
    for (const skill of list()) {
      if (schema?.validateCombatSkill && schema?.serializeCombatSkill) {
        const validation = schema.validateCombatSkill(skill);
        if (!validation.valid) throw Error('INVALID_SAPPHIRE_SKILL:' + skill.id + ':' + validation.errors.join(','));
        result[skill.id] = schema.serializeCombatSkill({ ...validation.skill, id: skill.id }, { includeLegacyAliases: true });
      } else result[skill.id] = skill;
    }
    return result;
  };
  const api = Object.freeze({ version: '1.0.0', DEFINITIONS, LOADOUTS, get, list, loadout, firebasePayload });
  global.LuminousCaveSapphireSpiderSkillCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
