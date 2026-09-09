(function (global) {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const skillCatalog = global.LuminousKoboldTier1SkillCatalog
    || (typeof require !== 'undefined' ? (() => { try { return require('./skill-catalog-kobold-tier1.js'); } catch (_) { return null; } })() : null);
  const rankRuntime = global.LuminousUnitRankRuntime
    || (typeof require !== 'undefined' ? (() => { try { return require('./unit-rank-runtime.js'); } catch (_) { return null; } })() : null);

  const BASE_LEVEL = Object.freeze({ min: 1, max: 3 });
  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);
  const SCORES = Object.freeze({ str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 });
  const PROFICIENCIES = Object.freeze({
    savingThrows: Object.freeze({ dex: 'proficient' }),
    skills: Object.freeze({ stealth: 'proficient' }),
  });
  const PACK_TACTICS = Object.freeze({
    id: 'kobold_pack_tactics',
    name: 'Pack Tactics',
    type: 'passive',
    clashPower: 1,
    condition: 'target_also_attacked_by_kobold_ally_this_round',
    runtimeHook: 'metadata_only',
    description: 'When this Kobold attacks a target that is also being attacked by another Kobold ally during the round, gain +1 Clash Power.',
  });

  const FALLBACK_UNIVERSAL_RANKS = Object.freeze({
    normal: Object.freeze({ id: 'normal', levelMultiplier: 1, minSpeedBonus: 0, maxSpeedBonus: 0, applyBonus: 0, basePowerBonus: 0, commandLevel: 0, aiCoordination: 'independent', targetPriority: 'random', turnEndSpRecovery: 0 }),
    captain: Object.freeze({ id: 'captain', levelMultiplier: 2, minSpeedBonus: 0, maxSpeedBonus: 1, applyBonus: 1, basePowerBonus: 0, commandLevel: 1, aiCoordination: 'focus_fire', targetPriority: 'lowest_hp_ratio', turnEndSpRecovery: 5 }),
    leader: Object.freeze({ id: 'leader', levelMultiplier: 3, minSpeedBonus: 1, maxSpeedBonus: 2, applyBonus: 2, basePowerBonus: 1, commandLevel: 2, aiCoordination: 'directed_focus', targetPriority: 'lowest_hp_ratio_then_highest_threat', turnEndSpRecovery: 10 }),
  });
  const UNIVERSAL_RANKS = rankRuntime?.RANKS || FALLBACK_UNIVERSAL_RANKS;

  // Durability belongs to the Kobold chassis. Command/speed/apply/power behavior belongs to the universal rank runtime.
  const HP_RANKS = Object.freeze({
    normal: Object.freeze({ hpBase: 24, hpCoefficient: 1.00, defLvlMod: 0 }),
    captain: Object.freeze({ hpBase: 30, hpCoefficient: 1.25, defLvlMod: 0 }),
    leader: Object.freeze({ hpBase: 36, hpCoefficient: 1.50, defLvlMod: 0 }),
  });

  const RANKS = Object.freeze(Object.fromEntries(
    Object.keys(HP_RANKS).map((rankId) => [rankId, Object.freeze({ ...UNIVERSAL_RANKS[rankId], ...HP_RANKS[rankId] })])
  ));

  function baseUnit({ id, name, variant, sprite, speed, skills }) {
    return {
      id,
      name,
      species: 'kobold',
      variant,
      unitType: 'enemy',
      faction: 'enemy',
      actorCategory: 'enemy',
      isPlayer: false,
      linkedPlayerUID: '',
      tags: ['canonical', 'kobold', 'enemy', 'tier1'],
      icono: sprite,
      visual: {
        spriteUrl: sprite,
        idle_sprite: sprite,
        moving_sprite: '',
        guard_sprite: '',
        evade_sprite: '',
        hurt_sprite: '',
        dead_sprite: '',
        scale: 1,
        spriteX: 0,
        spriteY: 0,
        uiX: 0,
        uiY: 0,
        isFocused: false,
      },
      baseLevel: clone(BASE_LEVEL),
      scores: clone(SCORES),
      proficiencies: clone(PROFICIENCIES),
      traitIds: [PACK_TACTICS.id],
      traits: [clone(PACK_TACTICS)],
      staggerThresholds: clone(STAGGER_THRESHOLDS),
      rankProfiles: clone(RANKS),
      action_slots: skills.slice(),
      attack_tier_1_sequence: skills.filter((skillId) => !skillId.includes('scurry') && !skillId.includes('duck_away')),
      attack_tier_2_sequence: [],
      attack_tier_3_sequence: [],
      mechanics: {
        hpModel: 'coefficient',
        sp: 0,
        speed,
        actionSlots: 1,
        maxSlotsLimit: 1,
        skills: skills.slice(),
        staggerThresholds: clone(STAGGER_THRESHOLDS),
        stagger: '75%,50%,25%',
      },
      schemaVersion: 1,
      metadata: {
        canonicalUnit: true,
        catalog: 'kobold-tier1',
        rankModel: 'universal_normal_captain_leader',
        hpModel: 'rank_coefficient',
      },
    };
  }

  const DEFINITIONS = Object.freeze({
    kobold_dagger: Object.freeze(baseUnit({
      id: 'kobold_dagger',
      name: 'Kobold · Dagger',
      variant: 'dagger',
      sprite: 'https://imgur.com/2BBvM2s.png',
      speed: '3-5',
      skills: ['kobold_dagger_jab', 'kobold_desperate_stab', 'kobold_scurry'],
    })),
    kobold_sling: Object.freeze(baseUnit({
      id: 'kobold_sling',
      name: 'Kobold · Sling',
      variant: 'sling',
      sprite: 'https://imgur.com/ndB257N.png',
      speed: '2-4',
      skills: ['kobold_sling_shot', 'kobold_rapid_pebble', 'kobold_duck_away'],
    })),
  });

  function normalizeRank(rank) {
    const id = rankRuntime?.normalizeRank ? rankRuntime.normalizeRank(rank, '') : String(rank || 'normal').trim().toLowerCase();
    if (!RANKS[id]) throw new Error(`UNKNOWN_UNIT_RANK:${id}`);
    return id;
  }

  function normalizeBaseLevel(level) {
    const value = Math.floor(Number(level));
    if (!Number.isFinite(value) || value < BASE_LEVEL.min || value > BASE_LEVEL.max) throw new Error(`BASE_LEVEL_OUT_OF_RANGE:${level}`);
    return value;
  }

  function parseSpeed(speed) {
    const match = String(speed || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!match) throw new Error(`INVALID_SPEED:${speed}`);
    return { min: Number(match[1]), max: Number(match[2]) };
  }

  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
  function list() { return Object.values(DEFINITIONS).map(clone); }

  function resolveSkill(skillId, rank) {
    if (!skillCatalog?.get) throw new Error('KOBOLD_SKILL_CATALOG_REQUIRED');
    const skill = skillCatalog.get(skillId);
    if (!skill) throw new Error(`UNKNOWN_KOBOLD_SKILL:${skillId}`);
    const rankId = normalizeRank(rank);
    const profile = RANKS[rankId];
    skill.basePower += profile.basePowerBonus;
    const applyCountBonus = (effects) => (effects || []).forEach((effect) => {
      if (effect?.type === 'status' && Number(effect.count) > 0) effect.count = Number(effect.count) + profile.applyBonus;
    });
    applyCountBonus(skill.effects);
    (skill.coins || []).forEach((coinData) => applyCountBonus(coinData.effects));
    skill.metadata = { ...(skill.metadata || {}), unitRank: rankId, rankBasePowerBonus: profile.basePowerBonus, rankApplyBonus: profile.applyBonus };
    return skill;
  }

  function resolve(id, options) {
    const unit = get(id);
    if (!unit) throw new Error(`UNKNOWN_KOBOLD_UNIT:${id}`);
    const opts = options || {};
    const baseLevel = normalizeBaseLevel(opts.baseLevel ?? 1);
    const rank = normalizeRank(opts.rank ?? 'normal');
    const profile = RANKS[rank];
    const effectiveLevel = rankRuntime?.effectiveLevel ? rankRuntime.effectiveLevel(baseLevel, rank) : baseLevel * profile.levelMultiplier;
    const maxHp = Math.floor(profile.hpBase + (effectiveLevel + profile.defLvlMod) * profile.hpCoefficient);
    const baseSpeed = parseSpeed(unit.mechanics.speed);
    const minSpeed = baseSpeed.min + profile.minSpeedBonus;
    const maxSpeed = baseSpeed.max + profile.maxSpeedBonus;
    const resolvedSkills = unit.action_slots.map((skillId) => resolveSkill(skillId, rank));

    unit.rank = rank;
    unit.baseLevelSelected = baseLevel;
    unit.effectiveLevel = effectiveLevel;
    unit.rankBonuses = clone(profile);
    unit.commandProfile = {
      commandLevel: profile.commandLevel,
      aiCoordination: profile.aiCoordination,
      targetPriority: profile.targetPriority,
      turnEndSpRecovery: profile.turnEndSpRecovery,
    };
    unit.resolvedSkills = resolvedSkills;
    unit.mechanics = {
      ...unit.mechanics,
      hp: maxHp,
      maxHp,
      level: effectiveLevel,
      baseLevel,
      rank,
      hpBase: profile.hpBase,
      hpCoefficient: profile.hpCoefficient,
      defLvlMod: profile.defLvlMod,
      speed: `${minSpeed}-${maxSpeed}`,
      minSpeed,
      maxSpeed,
      statusApplyBonus: profile.applyBonus,
      basePowerBonus: profile.basePowerBonus,
      commandLevel: profile.commandLevel,
      aiCoordination: profile.aiCoordination,
      turnEndSpRecovery: profile.turnEndSpRecovery,
    };
    return unit;
  }

  function firebasePayload() {
    const payload = {};
    list().forEach((unit) => { payload[unit.id] = unit; });
    return payload;
  }

  function firebaseSkillPayload(schema) {
    if (!skillCatalog?.firebasePayload) throw new Error('KOBOLD_SKILL_CATALOG_REQUIRED');
    return skillCatalog.firebasePayload(schema);
  }

  const api = Object.freeze({
    version: '1.1.0', BASE_LEVEL, STAGGER_THRESHOLDS, SCORES, PROFICIENCIES, PACK_TACTICS,
    UNIVERSAL_RANKS, HP_RANKS, RANKS, DEFINITIONS,
    list, get, resolve, resolveSkill, firebasePayload, firebaseSkillPayload,
  });
  global.LuminousKoboldUnitCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
