(function (global) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeRequire = (path) => {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  };

  const rankRuntime = global.LuminousUnitRankRuntime || safeRequire('./unit-rank-runtime.js');
  const rangedAmmo = global.LuminousUniversalRangedAmmoRuntime || safeRequire('./universal-ranged-ammo-runtime.js');
  const goblinRuntime = global.LuminousGoblinUnitRuntime || safeRequire('./goblin-unit-runtime.js');

  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);
  const RACIAL_TRAIT_IDS = Object.freeze(['goblin_fury_of_small', 'goblin_nimble_escape']);
  const GOBLIN_SCORES = Object.freeze({ str: 8, dex: 15, con: 10, int: 10, wis: 9, cha: 8 });
  const GOBLIN_BOSS_SCORES = Object.freeze({ str: 10, dex: 16, con: 12, int: 11, wis: 10, cha: 12 });

  const FALLBACK_RANKS = Object.freeze({
    normal: Object.freeze({ id: 'normal', levelMultiplier: 1, minSpeedBonus: 0, maxSpeedBonus: 0, applyBonus: 0, basePowerBonus: 0, commandLevel: 0, aiCoordination: 'independent', targetPriority: 'random', turnEndSpRecovery: 0 }),
    captain: Object.freeze({ id: 'captain', levelMultiplier: 2, minSpeedBonus: 0, maxSpeedBonus: 1, applyBonus: 1, basePowerBonus: 0, commandLevel: 1, aiCoordination: 'focus_fire', targetPriority: 'lowest_hp_ratio', turnEndSpRecovery: 5 }),
    leader: Object.freeze({ id: 'leader', levelMultiplier: 3, minSpeedBonus: 1, maxSpeedBonus: 2, applyBonus: 2, basePowerBonus: 1, commandLevel: 2, aiCoordination: 'directed_focus', targetPriority: 'lowest_hp_ratio_then_highest_threat', turnEndSpRecovery: 10 }),
  });
  const UNIVERSAL_RANKS = rankRuntime?.RANKS || FALLBACK_RANKS;

  function ammoTrait(ammoId, amount) {
    if (rangedAmmo?.createAmmoTrait) return rangedAmmo.createAmmoTrait(ammoId, amount);
    return { id: `ammo_${ammoId}`, name: `Ammo — ${ammoId}`, type: 'passive', description: `[On Encounter Start] Gain ${amount} ${ammoId}.`, mechanics: { ammoId, encounterStart: amount, statusMode: 'single', rangedSkillsOnly: true } };
  }

  const AMMO_ARROWS = Object.freeze(ammoTrait('arrows', 10));
  const AMMO_JAVELIN = Object.freeze(ammoTrait('javelin', 6));
  const MULTI_ATTACK = Object.freeze(clone(goblinRuntime?.MULTI_ATTACK || {
    id: 'goblin_multi_attack', name: 'Multi Attack', type: 'passive',
    description: 'Melee Skills with 2+ Coins reuse the last Coin 1 + floor(Level / 30) times. Melee Skills with 5+ Coins deal +5% Damage.',
  }));
  const REDIRECT_ATTACK = Object.freeze(clone(goblinRuntime?.REDIRECT_ATTACK || {
    id: 'goblin_redirect_attack', name: 'Redirect Attack', type: 'passive',
    description: '[Before Getting Hit] If another allied Goblin is on the Field, redirect the attack to that Ally Goblin. Once per Turn.',
  }));

  function racialTraits() { return RACIAL_TRAIT_IDS.map((id) => ({ id, source: 'racial_trait_catalog' })); }
  function weaponRef(id, range, options = {}) {
    return {
      weaponId: id,
      range,
      skillRange: range === 'ranged' ? null : 1,
      canonicalWeaponSkillPending: true,
      ...(options.ammoType ? { ammoType: options.ammoType, ammoPerSkill: 1 } : {}),
      ...(options.pierced ? { onHitStatusId: 'pierced', onHitStatusCount: null, onHitStatusCountPending: true } : {}),
    };
  }

  const DEFINITIONS = Object.freeze({
    goblin: Object.freeze({
      id: 'goblin', name: 'Goblin', species: 'goblin', variant: 'standard', unitType: 'enemy', actorCategory: 'enemy', faction: 'enemy', isPlayer: false,
      naturalWorldLevel: Object.freeze({ min: 2, max: 4 }), baseLevel: Object.freeze({ min: 2, max: 4 }),
      scores: GOBLIN_SCORES,
      hpBase: 7, hpCoefficient: 0.21,
      size: 'goblin',
      traitIds: Object.freeze([...RACIAL_TRAIT_IDS, AMMO_ARROWS.id]),
      traits: Object.freeze([...racialTraits(), AMMO_ARROWS]),
      allowedRanks: Object.freeze(['normal', 'captain', 'leader']),
      rankProfiles: UNIVERSAL_RANKS,
      staggerThresholds: STAGGER_THRESHOLDS,
      visual: Object.freeze({ spriteUrl: '', spritePending: true }),
      mechanics: Object.freeze({
        hpModel: 'chassis_coefficient', hpBase: 7, hpCoefficient: 0.21,
        ammoLoadout: Object.freeze([{ id: 'arrows', amount: 10 }]),
        ammunition: Object.freeze({ arrows: Object.freeze({ type: 'single', icon: 'https://imgur.com/ivdNbBA.png' }) }),
        weaponLoadout: Object.freeze([
          Object.freeze(weaponRef('scimitar', 'melee')),
          Object.freeze(weaponRef('shortbow', 'ranged', { ammoType: 'arrows', pierced: true })),
        ]),
        staggerThresholds: STAGGER_THRESHOLDS,
      }),
      metadata: Object.freeze({ canonicalUnit: true, catalog: 'goblin-batch', spritePending: true, weaponSkillsPendingCanonicalCatalog: true, physicalProfilePending: true, speedPending: true }),
      schemaVersion: 2,
    }),

    goblin_boss: Object.freeze({
      id: 'goblin_boss', name: 'Goblin Boss', species: 'goblin', variant: 'boss', unitType: 'enemy', actorCategory: 'enemy', faction: 'enemy', isPlayer: false,
      naturalWorldLevel: Object.freeze({ min: 5, max: 5 }), baseLevel: Object.freeze({ min: 5, max: 5 }),
      scores: GOBLIN_BOSS_SCORES,
      hpBase: 21, hpCoefficient: 0.24,
      size: 'goblin',
      traitIds: Object.freeze([...RACIAL_TRAIT_IDS, AMMO_JAVELIN.id, MULTI_ATTACK.id, REDIRECT_ATTACK.id]),
      traits: Object.freeze([...racialTraits(), AMMO_JAVELIN, MULTI_ATTACK, REDIRECT_ATTACK]),
      allowedRanks: Object.freeze(['captain']),
      rankProfiles: UNIVERSAL_RANKS,
      staggerThresholds: STAGGER_THRESHOLDS,
      visual: Object.freeze({ spriteUrl: '', spritePending: true }),
      mechanics: Object.freeze({
        hpModel: 'chassis_coefficient', hpBase: 21, hpCoefficient: 0.24,
        ammoLoadout: Object.freeze([{ id: 'javelin', amount: 6 }]),
        ammunition: Object.freeze({ javelin: Object.freeze({ type: 'single', icon: 'https://imgur.com/3wBN5qk.png' }) }),
        weaponLoadout: Object.freeze([
          Object.freeze(weaponRef('scimitar', 'melee')),
          Object.freeze(weaponRef('javelin', 'ranged', { ammoType: 'javelin', pierced: true })),
        ]),
        multiAttack: MULTI_ATTACK.mechanics || null,
        redirectAttack: REDIRECT_ATTACK.mechanics || null,
        staggerThresholds: STAGGER_THRESHOLDS,
      }),
      metadata: Object.freeze({ canonicalUnit: true, catalog: 'goblin-batch', alwaysCaptain: true, spritePending: true, weaponSkillsPendingCanonicalCatalog: true, physicalProfilePending: true, speedPending: true }),
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
  function resolve(id, options = {}) {
    const unit = get(id);
    if (!unit) throw new Error(`UNKNOWN_GOBLIN_UNIT:${id}`);
    const level = normalizeLevel(options.level ?? options.baseLevel ?? unit.naturalWorldLevel.min);
    const rank = normalizeRank(options.rank ?? unit.allowedRanks[0]);
    if (!unit.allowedRanks.includes(rank)) throw new Error(`UNIT_RANK_NOT_ALLOWED:${id}:${rank}`);
    const profile = UNIVERSAL_RANKS[rank];
    const effectiveLevel = rankRuntime?.effectiveLevel ? rankRuntime.effectiveLevel(level, rank) : level * Number(profile.levelMultiplier || 1);
    const maxHp = Math.floor(Number(unit.hpBase) + effectiveLevel * Number(unit.hpCoefficient));
    unit.rank = rank;
    unit.runtimeLevel = level;
    unit.baseLevelSelected = level;
    unit.effectiveLevel = effectiveLevel;
    unit.rankBonuses = clone(profile);
    unit.commandProfile = { commandLevel: profile.commandLevel, aiCoordination: profile.aiCoordination, targetPriority: profile.targetPriority, turnEndSpRecovery: profile.turnEndSpRecovery };
    unit.hp = maxHp;
    unit.maxHp = maxHp;
    unit.mechanics = { ...unit.mechanics, hp: maxHp, maxHp, level: effectiveLevel, runtimeLevel: level, rank, commandLevel: profile.commandLevel, basePowerBonus: profile.basePowerBonus, statusApplyBonus: profile.applyBonus };
    if (options.initializeEncounter === true) rangedAmmo?.onEncounterStart?.(unit);
    return unit;
  }

  function firebasePayload() {
    const payload = {};
    list().forEach((unit) => { payload[unit.id] = unit; });
    return payload;
  }

  const api = Object.freeze({
    version: '1.0.0', STAGGER_THRESHOLDS, RACIAL_TRAIT_IDS, GOBLIN_SCORES, GOBLIN_BOSS_SCORES, UNIVERSAL_RANKS,
    AMMO_ARROWS, AMMO_JAVELIN, MULTI_ATTACK, REDIRECT_ATTACK, DEFINITIONS, get, list, resolve, firebasePayload,
  });

  global.LuminousGoblinUnitCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
