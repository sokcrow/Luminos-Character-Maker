(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function statusEffect(status, potency, count, options = {}) {
    return {
      trigger: '[On Hit]', target: 'target', type: 'status', status, potency, count,
      maxCap: 0, scaleTarget: null, scaleCondition: null, is_reuse: false,
      target_ally: false, timing: 'immediate', condition: null,
      ...(options.requiresTargetStatuses ? { requiresTargetStatuses: clone(options.requiresTargetStatuses) } : {}),
      ...(options.requiresAnyTargetStatuses ? { requiresAnyTargetStatuses: clone(options.requiresAnyTargetStatuses) } : {}),
      ...(options.requiresTargetStatus ? { requiresTargetStatus: options.requiresTargetStatus } : {}),
    };
  }

  function coin(index, effects = []) {
    return { index, type: 'normal', status: 'active', effects: clone(effects) };
  }

  function attack({
    id, name, weaponId, variant, tier = 1,
    basePower, coinPower, coinAmount, damageType, skillRange,
    ammoType = null, pierced = 0, hitEffects = [],
    aiEstimate = null, metadata = {},
  }) {
    const coins = Array.from({ length: coinAmount }, (_, index) => coin(index));
    if (pierced > 0 && coins.length) coins[coins.length - 1].effects.push(statusEffect('pierced', 0, pierced));
    for (const entry of hitEffects) {
      const coinNumber = Math.max(1, Math.min(coinAmount, Number(entry.coin || coinAmount)));
      coins[coinNumber - 1].effects.push(statusEffect(
        entry.status,
        Number(entry.potency || 0),
        Number(entry.count || 0),
        entry,
      ));
    }
    const resourceCosts = ammoType
      ? [{ owner: 'source', type: 'ammunition', id: ammoType, amount: 1, timing: 'on_user' }]
      : [];
    const managedStatusEffects = coins.some((entry) => (entry.effects || []).some((effect) => effect?.type === 'status'));
    return {
      id, name, type: 'Attack', tier, maxCopies: 3,
      basePower, coinPower, coinAmount, coinType: 'positive', attackWeight: 1, skillRange,
      damageType, sinAffinity: 'sinless', scalingStat: 'Destreza', statUsed: '', skillUsed: '',
      targetingType: 'Focused Attack', aoePattern: 'Self', skillAmount: 1,
      sourceType: 'skill', sourceId: id, isItemSkill: false, isDefense: false, defenseSubtype: '',
      isClashable: true, isUnclashable: false, isIndiscriminate: false, isTargetFixed: false,
      requiresUnlock: false, resourceCosts, effects: [], coins, evolutionChain: null, schemaVersion: 2,
      ...(aiEstimate ? { aiEstimate: clone(aiEstimate) } : {}),
      metadata: {
        canonicalUnitSkill: true,
        species: 'goblin',
        unitVariant: variant,
        tier,
        weaponSkill: true,
        weaponId,
        combatRange: skillRange > 1 ? 'ranged' : 'melee',
        statusFamily: pierced > 0 ? 'pierced' : null,
        goblinRuntimeManagedStatusEffects: managedStatusEffects,
        ...(ammoType ? { ammoType } : {}),
        ...(pierced > 0 ? { piercedCountOnHit: pierced, piercedBuild: 'bind_bleed' } : {}),
        ...clone(metadata),
      },
    };
  }

  const DEFINITIONS = Object.freeze({
    // ── Goblin shared / Tier 1 ──────────────────────────────────────────────
    goblin_scimitar_slash: Object.freeze(attack({
      id: 'goblin_scimitar_slash', name: 'Scimitar Slash', weaponId: 'scimitar', variant: 'shared', tier: 1,
      basePower: 5, coinPower: 4, coinAmount: 2, damageType: 'cortante', skillRange: 1,
      aiEstimate: { advantage: 1.5, consumesTags: ['goblin_bind_setup', 'goblin_bleed_setup', 'bind', 'bleed'] },
      metadata: {
        goblinMultiAttackEligible: true,
        goblinBindBleedPayoff: { bindFinalPower: 1, bleedFinalPower: 1, maxFinalPowerBonus: 2 },
      },
    })),
    goblin_hamstring_cut: Object.freeze(attack({
      id: 'goblin_hamstring_cut', name: 'Hamstring Cut', weaponId: 'scimitar', variant: 'standard', tier: 1,
      basePower: 4, coinPower: 3, coinAmount: 2, damageType: 'cortante', skillRange: 1,
      hitEffects: [
        { coin: 2, status: 'bind', count: 1 },
        { coin: 2, status: 'bind', count: 1, requiresTargetStatus: 'bleed' },
      ],
      aiEstimate: { advantage: 2.5, producesTags: ['bind', 'goblin_bind_setup'], consumesTags: ['bleed', 'goblin_bleed_setup'] },
    })),
    goblin_shortbow_shot: Object.freeze(attack({
      id: 'goblin_shortbow_shot', name: 'Shortbow Shot', weaponId: 'shortbow', variant: 'standard', tier: 1,
      basePower: 6, coinPower: 4, coinAmount: 1, damageType: 'perforante', skillRange: 6,
      ammoType: 'arrows', pierced: 1,
      aiEstimate: { advantage: 3, producesTags: ['pierced', 'goblin_bind_setup', 'goblin_bleed_setup'] },
    })),

    // ── Goblin normal / Tier 2 ─────────────────────────────────────────────
    goblin_serrated_slash: Object.freeze(attack({
      id: 'goblin_serrated_slash', name: 'Serrated Slash', weaponId: 'scimitar', variant: 'standard', tier: 2,
      basePower: 5, coinPower: 4, coinAmount: 3, damageType: 'cortante', skillRange: 1,
      hitEffects: [{ coin: 3, status: 'bleed', count: 1 }],
      aiEstimate: { advantage: 3, producesTags: ['bleed', 'goblin_bleed_setup'], consumesTags: ['bind', 'goblin_bind_setup'] },
      metadata: {
        goblinConditionalPower: { coinPower: [{ requires: ['bind'], coins: [3], amount: 2 }] },
      },
    })),
    goblin_crippling_stab: Object.freeze(attack({
      id: 'goblin_crippling_stab', name: 'Crippling Stab', weaponId: 'scimitar', variant: 'standard', tier: 2,
      basePower: 6, coinPower: 3, coinAmount: 2, damageType: 'perforante', skillRange: 1,
      hitEffects: [{ coin: 2, status: 'bind', count: 2 }],
      aiEstimate: { advantage: 3, producesTags: ['bind', 'goblin_bind_setup'], consumesTags: ['bleed', 'goblin_bleed_setup'] },
      metadata: {
        goblinConditionalPower: { finalPower: [{ requires: ['bleed'], amount: 1 }] },
      },
    })),
    goblin_barbed_arrow: Object.freeze(attack({
      id: 'goblin_barbed_arrow', name: 'Barbed Arrow', weaponId: 'shortbow', variant: 'standard', tier: 2,
      basePower: 5, coinPower: 5, coinAmount: 2, damageType: 'perforante', skillRange: 6,
      ammoType: 'arrows', pierced: 2,
      hitEffects: [{ coin: 2, status: 'bleed', count: 1, requiresTargetStatus: 'pierced' }],
      aiEstimate: { advantage: 4, producesTags: ['pierced', 'bind', 'bleed', 'goblin_bind_setup', 'goblin_bleed_setup'] },
    })),

    // ── Goblin Boss / Tier 1 ───────────────────────────────────────────────
    goblin_butchers_cut: Object.freeze(attack({
      id: 'goblin_butchers_cut', name: "Butcher's Cut", weaponId: 'scimitar', variant: 'boss', tier: 1,
      basePower: 6, coinPower: 3, coinAmount: 3, damageType: 'cortante', skillRange: 1,
      hitEffects: [{ coin: 3, status: 'bleed', count: 2, requiresTargetStatus: 'bleed' }],
      aiEstimate: { advantage: 3, producesTags: ['bleed', 'goblin_bleed_setup'], consumesTags: ['bleed', 'goblin_bleed_setup'] },
      metadata: { goblinMultiAttackEligible: true },
    })),
    goblin_kneecapper: Object.freeze(attack({
      id: 'goblin_kneecapper', name: 'Kneecapper', weaponId: 'scimitar', variant: 'boss', tier: 1,
      basePower: 4, coinPower: 4, coinAmount: 2, damageType: 'contundente', skillRange: 1,
      hitEffects: [{ coin: 2, status: 'bind', count: 2 }],
      aiEstimate: { advantage: 3, producesTags: ['bind', 'goblin_bind_setup'], consumesTags: ['bind'] },
      metadata: {
        goblinMultiAttackEligible: true,
        goblinConditionalPower: { coinPower: [{ requires: ['bind'], allCoins: true, amount: 1 }] },
      },
    })),
    goblin_javelin_throw: Object.freeze(attack({
      id: 'goblin_javelin_throw', name: 'Javelin Throw', weaponId: 'javelin', variant: 'boss', tier: 1,
      basePower: 6, coinPower: 5, coinAmount: 1, damageType: 'perforante', skillRange: 5,
      ammoType: 'javelin', pierced: 1,
      aiEstimate: { advantage: 3, producesTags: ['pierced', 'goblin_bind_setup', 'goblin_bleed_setup'] },
      metadata: { thrownProjectile: true },
    })),

    // ── Goblin Boss / Tier 2 ───────────────────────────────────────────────
    goblin_relentless_cleave: Object.freeze(attack({
      id: 'goblin_relentless_cleave', name: 'Relentless Cleave', weaponId: 'scimitar', variant: 'boss', tier: 2,
      basePower: 6, coinPower: 4, coinAmount: 3, damageType: 'cortante', skillRange: 1,
      aiEstimate: { advantage: 4, consumesTags: ['bind', 'goblin_bind_setup'] },
      metadata: {
        goblinMultiAttackEligible: true,
        goblinConditionalPower: { coinPower: [{ requires: ['bind'], coins: [2, 3], amount: 1 }] },
      },
    })),
    goblin_bloodletter: Object.freeze(attack({
      id: 'goblin_bloodletter', name: 'Bloodletter', weaponId: 'scimitar', variant: 'boss', tier: 2,
      basePower: 5, coinPower: 4, coinAmount: 4, damageType: 'cortante', skillRange: 1,
      hitEffects: [
        { coin: 2, status: 'bleed', count: 1 },
        { coin: 4, status: 'bleed', count: 1 },
      ],
      aiEstimate: { advantage: 4, producesTags: ['bleed', 'goblin_bleed_setup'], consumesTags: ['bleed', 'goblin_bleed_setup'] },
      metadata: {
        goblinMultiAttackEligible: true,
        goblinConditionalPower: { finalPower: [{ requires: ['bleed'], amount: 1 }] },
      },
    })),
    goblin_tyrants_assault: Object.freeze(attack({
      id: 'goblin_tyrants_assault', name: "Tyrant's Assault", weaponId: 'scimitar', variant: 'boss', tier: 2,
      basePower: 7, coinPower: 3, coinAmount: 3, damageType: 'cortante', skillRange: 1,
      hitEffects: [
        { coin: 3, status: 'bind', count: 1, requiresTargetStatuses: ['bind', 'bleed'] },
        { coin: 3, status: 'bleed', count: 1, requiresTargetStatuses: ['bind', 'bleed'] },
      ],
      aiEstimate: { advantage: 5, producesTags: ['bind', 'bleed'], consumesTags: ['bind', 'bleed', 'goblin_bind_setup', 'goblin_bleed_setup'] },
      metadata: {
        goblinMultiAttackEligible: true,
        goblinConditionalPower: { finalPower: [{ requires: ['bind', 'bleed'], amount: 2 }] },
      },
    })),
    goblin_barbed_javelin: Object.freeze(attack({
      id: 'goblin_barbed_javelin', name: 'Barbed Javelin', weaponId: 'javelin', variant: 'boss', tier: 2,
      basePower: 6, coinPower: 5, coinAmount: 2, damageType: 'perforante', skillRange: 5,
      ammoType: 'javelin', pierced: 2,
      aiEstimate: { advantage: 4, producesTags: ['pierced', 'goblin_bind_setup', 'goblin_bleed_setup'] },
      metadata: { thrownProjectile: true },
    })),
  });

  const LOADOUTS = Object.freeze({
    goblin: Object.freeze([
      'goblin_scimitar_slash', 'goblin_hamstring_cut', 'goblin_shortbow_shot',
      'goblin_serrated_slash', 'goblin_crippling_stab', 'goblin_barbed_arrow',
    ]),
    goblin_boss: Object.freeze([
      'goblin_scimitar_slash', 'goblin_butchers_cut', 'goblin_kneecapper', 'goblin_javelin_throw',
      'goblin_relentless_cleave', 'goblin_bloodletter', 'goblin_tyrants_assault', 'goblin_barbed_javelin',
    ]),
  });

  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
  function list() { return Object.values(DEFINITIONS).map(clone); }
  function loadout(unitId) { return LOADOUTS[String(unitId || '')] ? clone(LOADOUTS[String(unitId || '')]) : []; }
  function byTier(unitId, tier) {
    const wanted = Number(tier);
    return loadout(unitId).map(get).filter((skill) => skill && Number(skill.tier) === wanted);
  }
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

  const api = Object.freeze({ version: '2.0.0', DEFINITIONS, LOADOUTS, get, list, loadout, byTier, finalPower, firebasePayload });
  global.LuminousGoblinTier1SkillCatalog = api;
  global.LuminousGoblinSkillCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);