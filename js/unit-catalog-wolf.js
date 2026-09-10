(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeRequire = (path) => {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  };

  const rankRuntime = global.LuminousUnitRankRuntime || safeRequire('./unit-rank-runtime.js');
  const skillCatalog = global.LuminousWolfSkillCatalog || safeRequire('./skill-catalog-wolf.js');
  const wolfRuntime = global.LuminousWolfUnitRuntime || safeRequire('./wolf-unit-runtime.js');
  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);
  const PACK_TACTICS_ID = 'pack_tactics';

  const FALLBACK_RANKS = Object.freeze({
    normal: Object.freeze({ id: 'normal', levelMultiplier: 1, minSpeedBonus: 0, maxSpeedBonus: 0, applyBonus: 0, basePowerBonus: 0, commandLevel: 0, aiCoordination: 'independent', targetPriority: 'random', turnEndSpRecovery: 0 }),
    captain: Object.freeze({ id: 'captain', levelMultiplier: 2, minSpeedBonus: 0, maxSpeedBonus: 1, applyBonus: 1, basePowerBonus: 0, commandLevel: 1, aiCoordination: 'focus_fire', targetPriority: 'lowest_hp_ratio', turnEndSpRecovery: 5 }),
    leader: Object.freeze({ id: 'leader', levelMultiplier: 3, minSpeedBonus: 1, maxSpeedBonus: 2, applyBonus: 2, basePowerBonus: 1, commandLevel: 2, aiCoordination: 'directed_focus', targetPriority: 'lowest_hp_ratio_then_highest_threat', turnEndSpRecovery: 10 }),
  });
  const UNIVERSAL_RANKS = rankRuntime?.RANKS || FALLBACK_RANKS;
  const MEANING = Object.freeze(clone(wolfRuntime?.MEANING || { id: 'wolf_meaning', name: 'Meaning', type: 'passive', description: "Can't be targeted by Units below 0 SP." }));
  const HUNTING_HOWLING = Object.freeze(clone(wolfRuntime?.HUNTING_HOWLING || { id: 'hunting_howling', name: 'Hunting Howling', type: 'quick_action', description: 'Quick Action. All deployed allied Wolves recover 5 SP and gain 1 Attack Power Up. Once per Encounter, add 3 Wolf Backup Units.' }));

  function packTacticsRef() { return { id: PACK_TACTICS_ID, source: 'racial_trait_catalog' }; }
  function rankHowling(requiredRank) {
    return { ...clone(HUNTING_HOWLING), requiredRank, rankOnly: true };
  }
  function skillRefs(unitId) {
    const loadout = skillCatalog?.loadout?.(unitId);
    return loadout ? [...(loadout.tier1 || []), ...(loadout.tier2 || [])] : [];
  }

  const DEFINITIONS = Object.freeze({
    wolf: Object.freeze({
      id: 'wolf', name: 'Wolf', species: 'wolf', variant: 'standard', unitType: 'enemy', actorCategory: 'enemy', faction: 'enemy', isPlayer: false,
      naturalWorldLevel: Object.freeze({ min: 2, max: 4 }), baseLevel: Object.freeze({ min: 2, max: 4 }),
      hpBase: 11, hpCoefficient: null,
      traitIds: Object.freeze([PACK_TACTICS_ID, MEANING.id, HUNTING_HOWLING.id]),
      traits: Object.freeze([packTacticsRef(), MEANING, Object.freeze(rankHowling('captain'))]),
      allowedRanks: Object.freeze(['normal', 'captain']), rankProfiles: UNIVERSAL_RANKS,
      staggerThresholds: STAGGER_THRESHOLDS,
      visual: Object.freeze({ spriteUrl: 'https://imgur.com/W6efoaJ.png', spritePending: false }),
      tier1: Object.freeze(['wolf_bite', 'wolf_gnaw', 'wolf_prowl_away']),
      tier2: Object.freeze(['wolf_hunting_bite']),
      action_slots: Object.freeze(skillRefs('wolf')),
      mechanics: Object.freeze({
        hpBase: 11, hpCoefficient: null, hpGrowthPendingCanonicalCoefficient: true,
        naturalWeapon: 'fangs', build: Object.freeze(['bleed', 'sinking']),
        packTacticsTraitId: PACK_TACTICS_ID, meaningTraitId: MEANING.id,
        huntingHowling: Object.freeze({ requiredRank: 'captain', economy: 'quick_action', spRecovery: 5, attackPowerUp: 1, backupUnitId: 'wolf', backupAmount: 3, backupOncePerEncounter: true }),
        encounterComposition: Object.freeze({ requiredRank: 'captain', minimum: 1 }),
        skills: Object.freeze(skillRefs('wolf')), staggerThresholds: STAGGER_THRESHOLDS,
      }),
      metadata: Object.freeze({ canonicalUnit: true, catalog: 'wolf-batch', oneCaptainPerEncounter: true, physicalProfilePending: true, speedPending: true, scoresPending: true }),
      schemaVersion: 2,
    }),

    dire_wolf: Object.freeze({
      id: 'dire_wolf', name: 'Dire Wolf', species: 'dire_wolf', variant: 'dire', unitType: 'enemy', actorCategory: 'enemy', faction: 'enemy', isPlayer: false,
      naturalWorldLevel: Object.freeze({ min: 5, max: 5 }), baseLevel: Object.freeze({ min: 5, max: 5 }),
      hpBase: 37, hpCoefficient: null,
      traitIds: Object.freeze([PACK_TACTICS_ID, MEANING.id, HUNTING_HOWLING.id]),
      traits: Object.freeze([packTacticsRef(), MEANING, Object.freeze(rankHowling('leader'))]),
      allowedRanks: Object.freeze(['normal', 'leader']), rankProfiles: UNIVERSAL_RANKS,
      staggerThresholds: STAGGER_THRESHOLDS,
      visual: Object.freeze({ spriteUrl: 'https://imgur.com/sqbDc2B.png', spritePending: false }),
      tier1: Object.freeze(['dire_wolf_bite', 'dire_wolf_stalking_step']),
      tier2: Object.freeze(['dire_wolf_rending_fangs', 'dire_wolf_break_the_prey']),
      action_slots: Object.freeze(skillRefs('dire_wolf')),
      mechanics: Object.freeze({
        hpBase: 37, hpCoefficient: null, hpGrowthPendingCanonicalCoefficient: true,
        naturalWeapon: 'fangs', build: Object.freeze(['bleed', 'sinking']),
        packTacticsTraitId: PACK_TACTICS_ID, meaningTraitId: MEANING.id,
        huntingHowling: Object.freeze({ requiredRank: 'leader', economy: 'quick_action', spRecovery: 5, attackPowerUp: 1, backupUnitId: 'wolf', backupAmount: 3, backupOncePerEncounter: true }),
        encounterComposition: Object.freeze({ requiredRank: 'leader', minimum: 1 }),
        skills: Object.freeze(skillRefs('dire_wolf')), staggerThresholds: STAGGER_THRESHOLDS,
      }),
      metadata: Object.freeze({ canonicalUnit: true, catalog: 'wolf-batch', oneLeaderPerEncounter: true, physicalProfilePending: true, speedPending: true, scoresPending: true }),
      schemaVersion: 2,
    }),
  });

  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
  function list() { return Object.values(DEFINITIONS).map(clone); }
  function normalizeRank(rank) {
    const id = rankRuntime?.normalizeRank ? rankRuntime.normalizeRank(rank, '') : String(rank || 'normal').trim().toLowerCase();
    if (!UNIVERSAL_RANKS[id]) throw new Error(`UNKNOWN_UNIT_RANK:${id}`);
    return id;
  }
  function normalizeLevel(level) {
    const value = Math.floor(Number(level));
    if (!Number.isFinite(value) || value < 1) throw new Error(`UNIT_LEVEL_OUT_OF_RANGE:${level}`);
    return value;
  }
  function resolveSkill(skillId, rank) {
    if (!skillCatalog?.get) throw new Error('WOLF_SKILL_CATALOG_REQUIRED');
    const skill = skillCatalog.get(skillId);
    if (!skill) throw new Error(`UNKNOWN_WOLF_SKILL:${skillId}`);
    const profile = UNIVERSAL_RANKS[normalizeRank(rank)];
    skill.basePower += Number(profile.basePowerBonus || 0);
    const boost = (effects) => (effects || []).forEach((effect) => {
      if (effect?.type === 'status' && Number(effect.count) > 0) effect.count = Number(effect.count) + Number(profile.applyBonus || 0);
    });
    boost(skill.effects); (skill.coins || []).forEach((coin) => boost(coin.effects));
    skill.metadata = { ...(skill.metadata || {}), unitRank: profile.id, rankBasePowerBonus: profile.basePowerBonus, rankApplyBonus: profile.applyBonus };
    return skill;
  }
  function resolve(id, options = {}) {
    const unit = get(id);
    if (!unit) throw new Error(`UNKNOWN_WOLF_UNIT:${id}`);
    const level = normalizeLevel(options.level ?? options.baseLevel ?? unit.naturalWorldLevel.min);
    const rank = normalizeRank(options.rank ?? unit.allowedRanks[0]);
    if (!unit.allowedRanks.includes(rank)) throw new Error(`UNIT_RANK_NOT_ALLOWED:${id}:${rank}`);
    const profile = UNIVERSAL_RANKS[rank];
    const effectiveLevel = rankRuntime?.effectiveLevel ? rankRuntime.effectiveLevel(level, rank) : level * Number(profile.levelMultiplier || 1);
    const maxHp = unit.hpCoefficient == null ? Number(unit.hpBase) : Math.floor(Number(unit.hpBase) + effectiveLevel * Number(unit.hpCoefficient));
    unit.rank = rank; unit.runtimeLevel = level; unit.baseLevelSelected = level; unit.effectiveLevel = effectiveLevel; unit.rankBonuses = clone(profile);
    unit.commandProfile = { commandLevel: profile.commandLevel, aiCoordination: profile.aiCoordination, targetPriority: profile.targetPriority, turnEndSpRecovery: profile.turnEndSpRecovery };
    unit.hp = maxHp; unit.maxHp = maxHp;
    unit.resolvedSkills = unit.mechanics.skills.map((skillId) => resolveSkill(skillId, rank));
    unit.mechanics = { ...unit.mechanics, hp: maxHp, maxHp, level: effectiveLevel, runtimeLevel: level, rank, statusApplyBonus: profile.applyBonus, basePowerBonus: profile.basePowerBonus, commandLevel: profile.commandLevel, turnEndSpRecovery: profile.turnEndSpRecovery };
    if (options.initializeEncounter === true) wolfRuntime?.resetEncounter?.(unit, options);
    return unit;
  }
  function firebasePayload() { const payload = {}; list().forEach((unit) => { payload[unit.id] = unit; }); return payload; }
  function firebaseSkillPayload(schema) { if (!skillCatalog?.firebasePayload) throw new Error('WOLF_SKILL_CATALOG_REQUIRED'); return skillCatalog.firebasePayload(schema); }

  const api = Object.freeze({
    version: '1.0.0', STAGGER_THRESHOLDS, PACK_TACTICS_ID, UNIVERSAL_RANKS, MEANING, HUNTING_HOWLING,
    DEFINITIONS, get, list, resolve, resolveSkill, firebasePayload, firebaseSkillPayload,
  });
  global.LuminousWolfUnitCatalog = api;
  wolfRuntime?.install?.();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
