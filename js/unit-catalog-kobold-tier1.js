(function (global) {
  'use strict';

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const skillCatalog = global.LuminousKoboldTier1SkillCatalog || (typeof require !== 'undefined' ? (() => { try { return require('./skill-catalog-kobold-tier1.js'); } catch (_) { return null; } })() : null);
  const rankRuntime = global.LuminousUnitRankRuntime || (typeof require !== 'undefined' ? (() => { try { return require('./unit-rank-runtime.js'); } catch (_) { return null; } })() : null);
  const combatMechanics = global.LuminousUnitCombatMechanics || (typeof require !== 'undefined' ? (() => { try { return require('./unit-combat-mechanics-runtime.js'); } catch (_) { return null; } })() : null);

  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);
  const SCORES = Object.freeze({ str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 });
  const PROFICIENCIES = Object.freeze({ savingThrows: Object.freeze({ dex: 'proficient' }), skills: Object.freeze({ stealth: 'proficient' }) });
  const PACK_TACTICS_ID = 'pack_tactics';

  const FALLBACK_RANKS = Object.freeze({
    normal: Object.freeze({ id: 'normal', levelMultiplier: 1, minSpeedBonus: 0, maxSpeedBonus: 0, applyBonus: 0, basePowerBonus: 0, commandLevel: 0, aiCoordination: 'independent', targetPriority: 'random', turnEndSpRecovery: 0 }),
    captain: Object.freeze({ id: 'captain', levelMultiplier: 2, minSpeedBonus: 0, maxSpeedBonus: 1, applyBonus: 1, basePowerBonus: 0, commandLevel: 1, aiCoordination: 'focus_fire', targetPriority: 'lowest_hp_ratio', turnEndSpRecovery: 5 }),
    leader: Object.freeze({ id: 'leader', levelMultiplier: 3, minSpeedBonus: 1, maxSpeedBonus: 2, applyBonus: 2, basePowerBonus: 1, commandLevel: 2, aiCoordination: 'directed_focus', targetPriority: 'lowest_hp_ratio_then_highest_threat', turnEndSpRecovery: 10 }),
  });
  const UNIVERSAL_RANKS = rankRuntime?.RANKS || FALLBACK_RANKS;

  const AERIAL_HARRIER = Object.freeze({
    id: 'aerial_harrier', name: 'Aerial Harrier', type: 'passive',
    description: 'This unit is a Flying Unit. [On Encounter Start] Gain 1 Rock. [On Comeback] Gain 1 Rock. If this unit has Rock, it may use Falling Rock. This unit prefers Retreat after harassment patterns.',
    mechanics: Object.freeze({ flying: true, ammunition: 'rock', preferredRetreatPattern: 'after_harassment' }),
  });
  const DRAGONHEART = Object.freeze({
    id: 'dragonheart', name: 'Draggonheart', type: 'passive',
    description: 'Gain +5 Final Power on Saves against Frightened and Paralyzed. While deployed, on Turn Start all Kobold allies gain +1 Clash Power Up.',
    mechanics: Object.freeze({ saveFinalPowerBonus: 5, saveConditions: ['frightened', 'paralyzed'], turnStartKoboldAllyClashPowerUp: 1 }),
  });
  const DRAGON_RESISTANCE = Object.freeze({
    id: 'dragon_resistance', name: 'Dragon Resistance', type: 'passive',
    description: 'On Encounter Start gain Resist on a random Sin Type and the Status Effect associated with the selected element.',
    mechanics: Object.freeze({ trigger: 'on_encounter_start', randomSinResistance: true, linkedElementStatusResistance: true }),
  });
  const SPELL_CASTER_CHARISMA = Object.freeze({
    id: 'spell_caster_charisma', name: 'Spell Caster — Charisma', type: 'passive',
    description: 'Uses Charisma as Spell Casting Mod. Spell Save Threshold = 10 + CHA Mod.',
    mechanics: Object.freeze({ spellcastingAbility: 'charisma', spellSaveBase: 10 }),
  });

  function visual(sprite, variants) {
    return { spriteUrl: sprite, idle_sprite: sprite, moving_sprite: '', guard_sprite: '', evade_sprite: '', hurt_sprite: '', dead_sprite: '', scale: 1, spriteX: 0, spriteY: 0, uiX: 0, uiY: 0, isFocused: false, variants: clone(variants || {}) };
  }

  function makeUnit(cfg) {
    const traitIds = [PACK_TACTICS_ID, ...(cfg.traits || []).map((t) => t.id)];
    const allSkills = [...cfg.tier1, ...(cfg.tier2 || []), ...(cfg.tier3 || [])];
    return {
      id: cfg.id, name: cfg.name, species: 'kobold', variant: cfg.variant, unitType: 'enemy', faction: 'enemy', actorCategory: 'enemy', isPlayer: false, linkedPlayerUID: '',
      tags: ['canonical', 'kobold', 'enemy', ...(cfg.tags || [])], icono: cfg.sprite, visual: visual(cfg.sprite, cfg.spriteVariants),
      naturalWorldLevel: clone(cfg.naturalWorldLevel), baseLevel: clone(cfg.naturalWorldLevel), scores: clone(SCORES), proficiencies: clone(PROFICIENCIES), size: 'kobold',
      traitIds, traits: [{ id: PACK_TACTICS_ID, source: 'racial_trait_catalog' }, ...(cfg.traits || []).map(clone)],
      staggerThresholds: clone(STAGGER_THRESHOLDS), rankProfiles: clone(UNIVERSAL_RANKS), allowedRanks: (cfg.allowedRanks || ['normal', 'captain', 'leader']).slice(),
      action_slots: allSkills.slice(), attack_tier_1_sequence: cfg.tier1.filter((id) => !id.startsWith('spell:')), attack_tier_2_sequence: (cfg.tier2 || []).slice(), attack_tier_3_sequence: (cfg.tier3 || []).slice(),
      damageTypeDefense: { resist: cfg.resist, weak: cfg.weak },
      mechanics: {
        hpModel: 'chassis_coefficient', hpBase: cfg.hpBase, hpCoefficient: cfg.hpCoefficient, defLvlMod: cfg.defLvlMod || 0, sp: 0,
        speed: cfg.speed, speedBonus: clone(cfg.speedBonus || { min: 0, max: 0 }), actionSlots: 1, maxSlotsLimit: 1, skills: allSkills.slice(),
        staggerThresholds: clone(STAGGER_THRESHOLDS), stagger: '75%,50%,25%', damageTypeDefense: { resist: cfg.resist, weak: cfg.weak }, ...(clone(cfg.mechanics || {})),
      },
      schemaVersion: 2,
      metadata: { canonicalUnit: true, catalog: 'kobold-batch', rankModel: 'universal_normal_captain_leader', hpModel: 'chassis_coefficient', naturalWorldLevelIsReferenceOnly: true },
    };
  }

  const DEFINITIONS = Object.freeze({
    kobold_dagger: Object.freeze(makeUnit({ id: 'kobold_dagger', name: 'Kobold · Dagger', variant: 'dagger', sprite: 'https://imgur.com/2BBvM2s.png', naturalWorldLevel: { min: 1, max: 3 }, hpBase: 5, hpCoefficient: 0.19, speed: '3-5', resist: 'perforante', weak: 'contundente', tags: ['tier1'], tier1: ['kobold_dagger_jab', 'kobold_desperate_stab', 'kobold_scurry'] })),
    kobold_sling: Object.freeze(makeUnit({ id: 'kobold_sling', name: 'Kobold · Sling', variant: 'sling', sprite: 'https://imgur.com/ndB257N.png', naturalWorldLevel: { min: 1, max: 3 }, hpBase: 5, hpCoefficient: 0.19, speed: '2-4', resist: 'perforante', weak: 'contundente', tags: ['tier1'], tier1: ['kobold_sling_shot', 'kobold_rapid_pebble', 'kobold_duck_away'] })),
    winged_kobold: Object.freeze(makeUnit({
      id: 'winged_kobold', name: 'Winged Kobold', variant: 'winged', sprite: 'https://imgur.com/529fa4E.png',
      spriteVariants: { dagger: 'https://imgur.com/evsrs1B.png', holdingRock: 'https://imgur.com/529fa4E.png', withoutRock: 'https://imgur.com/zmA1FPz.png', rockAsset: 'https://imgur.com/P4J48yc.png' },
      naturalWorldLevel: { min: 2, max: 4 }, hpBase: 7, hpCoefficient: 0.22, speed: '3-5', speedBonus: { min: 0, max: 2 }, resist: 'cortante', weak: 'perforante',
      tags: ['tier1', 'tier2', 'flying'], traits: [AERIAL_HARRIER], tier1: ['winged_kobold_falling_rock', 'winged_kobold_dagger'], tier2: ['winged_kobold_dive_stab'],
      mechanics: {
        flying: true,
        ammunition: { rock: { type: 'single', max: 1, icon: 'https://imgur.com/7rOv1S0.png', asset: 'https://imgur.com/P4J48yc.png' } },
        unitLifecycle: { onEncounterStart: { grantAmmunition: [{ id: 'rock', amount: 1, max: 1 }] }, onComeback: { grantAmmunition: [{ id: 'rock', amount: 1, max: 1 }] } },
        ai: { prefersRetreat: true, retreatAfter: 'harassment', fallingRockRequiresAmmo: 'rock' },
      },
    })),
    dragonheart_kobold: Object.freeze(makeUnit({
      id: 'dragonheart_kobold', name: 'Dragonheart Kobold', variant: 'dragonheart', sprite: 'https://imgur.com/4EYu3us.png', naturalWorldLevel: { min: 5, max: 9 },
      hpBase: 44, hpCoefficient: 0.30, speed: '2-4', defLvlMod: 3, resist: 'cortante', weak: 'contundente', tags: ['tier1', 'tier2', 'tier3', 'commander'],
      traits: [DRAGONHEART, DRAGON_RESISTANCE], allowedRanks: ['captain', 'leader'], tier1: ['dragonheart_spear_thrust'], tier2: ['dragonheart_guarding_skewer'], tier3: ['dragonheart_dragon_spear'],
    })),
    scale_sorcerer_kobold: Object.freeze(makeUnit({
      id: 'scale_sorcerer_kobold', name: 'Scale Sorcerer Kobold', variant: 'scale_sorcerer', sprite: 'https://imgur.com/TOHr6Dk.png', naturalWorldLevel: { min: 5, max: 9 },
      hpBase: 27, hpCoefficient: 0.25, speed: '2-4', defLvlMod: 3, resist: 'perforante', weak: 'cortante', tags: ['spellcaster', 'commander'], traits: [SPELL_CASTER_CHARISMA], allowedRanks: ['captain', 'leader'],
      tier1: ['kobold_dagger_jab', 'spell:fire_bolt', 'spell:poison_spray', 'spell:charm_person', 'spell:chromatic_orb', 'spell:expeditious_retreat', 'spell:scorching_ray'],
      mechanics: { spellcasting: { ability: 'charisma', saveThresholdFormula: '10 + CHA_MOD', spellSlots: { 1: 4, 2: 2 } }, sorceryPoints: { encounterStart: 3, runtime: 'sorcerer_class_runtime', metamagic: ['subtle_spell', 'heightened_spell'] }, spellReferencesPendingCanonicalCatalog: true },
    })),
  });

  function get(id) { return DEFINITIONS[String(id || '')] ? clone(DEFINITIONS[String(id || '')]) : null; }
  function list() { return Object.values(DEFINITIONS).map(clone); }
  function normalizeRank(rank) {
    const id = rankRuntime?.normalizeRank ? rankRuntime.normalizeRank(rank, '') : String(rank || 'normal').trim().toLowerCase();
    if (!UNIVERSAL_RANKS[id]) throw new Error(`UNKNOWN_UNIT_RANK:${id}`);
    return id;
  }
  function normalizeRuntimeLevel(level) {
    const value = Math.floor(Number(level));
    if (!Number.isFinite(value) || value < 1) throw new Error(`UNIT_LEVEL_OUT_OF_RANGE:${level}`);
    return value;
  }
  function parseSpeed(speed) {
    const m = String(speed || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!m) throw new Error(`INVALID_SPEED:${speed}`);
    return { min: Number(m[1]), max: Number(m[2]) };
  }
  function resolveSkill(skillId, rank) {
    const id = String(skillId || '');
    if (id.startsWith('spell:')) return { id: id.slice(6), sourceType: 'spell', canonicalReference: true, pendingSpellCatalogResolution: true };
    if (!skillCatalog?.get) throw new Error('KOBOLD_SKILL_CATALOG_REQUIRED');
    const skill = skillCatalog.get(id);
    if (!skill) throw new Error(`UNKNOWN_KOBOLD_SKILL:${id}`);
    const profile = UNIVERSAL_RANKS[normalizeRank(rank)];
    skill.basePower += Number(profile.basePowerBonus || 0);
    const boost = (effects) => (effects || []).forEach((e) => { if (e?.type === 'status' && Number(e.count) > 0) e.count = Number(e.count) + Number(profile.applyBonus || 0); });
    boost(skill.effects); (skill.coins || []).forEach((c) => boost(c.effects));
    skill.metadata = { ...(skill.metadata || {}), unitRank: profile.id, rankBasePowerBonus: profile.basePowerBonus, rankApplyBonus: profile.applyBonus };
    return skill;
  }
  function resolve(id, options) {
    const unit = get(id); if (!unit) throw new Error(`UNKNOWN_KOBOLD_UNIT:${id}`);
    const opts = options || {};
    const level = normalizeRuntimeLevel(opts.level ?? opts.baseLevel ?? unit.naturalWorldLevel.min);
    const rank = normalizeRank(opts.rank ?? unit.allowedRanks[0] ?? 'normal');
    if (!unit.allowedRanks.includes(rank)) throw new Error(`UNIT_RANK_NOT_ALLOWED:${id}:${rank}`);
    const profile = UNIVERSAL_RANKS[rank];
    const effectiveLevel = rankRuntime?.effectiveLevel ? rankRuntime.effectiveLevel(level, rank) : level * Number(profile.levelMultiplier || 1);
    const maxHp = Math.floor(Number(unit.mechanics.hpBase || 0) + effectiveLevel * Number(unit.mechanics.hpCoefficient || 0));
    const defensiveLevel = effectiveLevel + Number(unit.mechanics.defLvlMod || 0);
    const baseSpeed = parseSpeed(unit.mechanics.speed); const sb = unit.mechanics.speedBonus || {};
    const minSpeed = baseSpeed.min + Number(sb.min || 0) + Number(profile.minSpeedBonus || 0);
    const maxSpeed = baseSpeed.max + Number(sb.max || 0) + Number(profile.maxSpeedBonus || 0);
    unit.rank = rank; unit.baseLevelSelected = level; unit.runtimeLevel = level; unit.effectiveLevel = effectiveLevel; unit.defensiveLevel = defensiveLevel; unit.rankBonuses = clone(profile);
    unit.commandProfile = { commandLevel: profile.commandLevel, aiCoordination: profile.aiCoordination, targetPriority: profile.targetPriority, turnEndSpRecovery: profile.turnEndSpRecovery };
    unit.resolvedSkills = unit.mechanics.skills.map((skillId) => resolveSkill(skillId, rank));
    unit.mechanics = { ...unit.mechanics, hp: maxHp, maxHp, level: effectiveLevel, runtimeLevel: level, defensiveLevel, rank, minSpeed, maxSpeed, speed: `${minSpeed}-${maxSpeed}`, statusApplyBonus: profile.applyBonus, basePowerBonus: profile.basePowerBonus, commandLevel: profile.commandLevel, aiCoordination: profile.aiCoordination, turnEndSpRecovery: profile.turnEndSpRecovery };
    if (combatMechanics?.onEncounterStart && opts.initializeEncounter === true) combatMechanics.onEncounterStart(unit);
    return unit;
  }

  function firebasePayload() { const payload = {}; list().forEach((u) => { payload[u.id] = u; }); return payload; }
  function firebaseSkillPayload(schema) { if (!skillCatalog?.firebasePayload) throw new Error('KOBOLD_SKILL_CATALOG_REQUIRED'); return skillCatalog.firebasePayload(schema); }

  const api = Object.freeze({ version: '2.0.1', STAGGER_THRESHOLDS, SCORES, PROFICIENCIES, PACK_TACTICS_ID, UNIVERSAL_RANKS, AERIAL_HARRIER, DRAGONHEART, DRAGON_RESISTANCE, SPELL_CASTER_CHARISMA, DEFINITIONS, list, get, resolve, resolveSkill, firebasePayload, firebaseSkillPayload });
  global.LuminousKoboldUnitCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
