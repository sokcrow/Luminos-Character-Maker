(function (global) {
  'use strict';

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const skillCatalog = global.LuminousKoboldTier1SkillCatalog || (typeof require !== 'undefined' ? (() => { try { return require('./skill-catalog-kobold-tier1.js'); } catch (_) { return null; } })() : null);
  const rankRuntime = global.LuminousUnitRankRuntime || (typeof require !== 'undefined' ? (() => { try { return require('./unit-rank-runtime.js'); } catch (_) { return null; } })() : null);
  const combatMechanics = global.LuminousUnitCombatMechanics || (typeof require !== 'undefined' ? (() => { try { return require('./unit-combat-mechanics-runtime.js'); } catch (_) { return null; } })() : null);
  const rangedAmmo = global.LuminousUniversalRangedAmmoRuntime || (typeof require !== 'undefined' ? (() => { try { return require('./universal-ranged-ammo-runtime.js'); } catch (_) { return null; } })() : null);
  const movementRuntime = global.LuminousMovementSpeedRuntime || (typeof require !== 'undefined' ? (() => { try { return require('./movement-speed-runtime.js'); } catch (_) { return null; } })() : null);
  const lootContract = global.LuminousUnitLootProfileContract || (typeof require !== 'undefined' ? (() => { try { return require('./unit-loot-profile-contract.js'); } catch (_) { return null; } })() : null);
  const socialLoot = global.LuminousLootSocialProfileContract || (typeof require !== 'undefined' ? (() => { try { return require('./loot-social-profile-contract.js'); } catch (_) { return null; } })() : null);

  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);
  const KOBOLD_WARRIOR_SCORES = Object.freeze({ str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 });
  const WINGED_KOBOLD_SCORES = Object.freeze({ str: 7, dex: 16, con: 9, int: 8, wis: 7, cha: 8 });
  const DRAGONSHIELD_SCORES = Object.freeze({ str: 12, dex: 15, con: 14, int: 8, wis: 9, cha: 10 });
  const SCALE_SORCERER_SCORES = Object.freeze({ str: 7, dex: 15, con: 14, int: 10, wis: 9, cha: 14 });
  const NO_PROFICIENCIES = Object.freeze({ savingThrows: Object.freeze({}), skills: Object.freeze({}) });
  const DRAGONSHIELD_PROFICIENCIES = Object.freeze({ savingThrows: Object.freeze({}), skills: Object.freeze({ perception: 'proficient' }) });
  const SCALE_SORCERER_PROFICIENCIES = Object.freeze({ savingThrows: Object.freeze({}), skills: Object.freeze({ arcana: 'proficient', medicine: 'proficient' }) });
  const DARKVISION_RULES = Object.freeze({ ignoresDarkness: true });
  const PACK_TACTICS_ID = 'pack_tactics';

  const KOBOLD_LOOT_PROFILES = lootContract?.createProfiles ? lootContract.createProfiles({
    bodyProfile: {
      kind: 'organic',
      sizeClass: 'small',
      materials: ['flesh', 'blood', 'bone', 'scale'],
      edible: true,
      resources: [
        { id: 'meat', integrityFamily: 'meat', sourceMaterial: 'flesh', itemId: 'meat_reptilian', catalogFamily: 'meat', culinary: true, knownUses: ['cooking'], tags: ['humanoid', 'reptile'] },
        { id: 'scales', integrityFamily: 'hide_pelt', sourceMaterial: 'scale', itemId: 'scale', catalogFamily: 'scale_shell_chitin', valuable: true, knownUses: ['armor_crafting'], tags: ['scale', 'reptile'] },
        { id: 'bones', integrityFamily: 'hard_parts', sourceMaterial: 'bone', itemId: 'hard_bone', catalogFamily: 'hard_parts', anatomicalIdentity: 'bone', knownUses: ['primitive_crafting'] },
        { id: 'internal_organs', integrityFamily: 'organ_internal', sourceMaterial: 'flesh', itemId: 'internal_organ', catalogFamily: 'organ_gland', anatomicalIdentity: 'internal_organ', valuable: true, knownUses: ['medicine', 'crafting'] },
        { id: 'sensory_organs', integrityFamily: 'organ_sensory', sourceMaterial: 'flesh', itemId: 'eye', catalogFamily: 'organ_gland', anatomicalIdentity: 'eye', valuable: true, knownUses: ['medicine', 'crafting'] },
        { id: 'brain', integrityFamily: 'organ_brain', sourceMaterial: 'flesh', itemId: 'brain', catalogFamily: 'organ_gland', anatomicalIdentity: 'brain', valuable: true, knownUses: ['medicine', 'research'] },
        { id: 'glands', integrityFamily: 'organ_gland', sourceMaterial: 'flesh', itemId: 'gland', catalogFamily: 'organ_gland', anatomicalIdentity: 'gland', valuable: true, knownUses: ['medicine', 'crafting'] },
        { id: 'blood', integrityFamily: 'blood_ichor', sourceMaterial: 'blood', itemId: 'humanoid_blood', catalogFamily: 'blood_ichor', knownUses: ['medicine', 'crafting'] },
      ],
    },
    lootProfile: {
      carried: [],
      equipment: { source: 'unit_loadout' },
      currency: null,
      harvest: { source: 'body_profile' },
      impossibleCategories: [],
      notes: 'Base profile only. Wealth, Encounter Zone and Event modifiers are resolved by later Loot Update slices.',
    },
  }) : Object.freeze({
    bodyProfile: Object.freeze({
      version: 1, kind: 'organic', sizeClass: 'small', materials: Object.freeze(['flesh', 'blood', 'bone', 'scale']), edible: true,
      resources: Object.freeze([
        Object.freeze({ id: 'meat', integrityFamily: 'meat', sourceMaterial: 'flesh', yield: null }),
        Object.freeze({ id: 'scales', integrityFamily: 'hide_pelt', sourceMaterial: 'scale', yield: null }),
        Object.freeze({ id: 'bones', integrityFamily: 'hard_parts', sourceMaterial: 'bone', yield: null }),
        Object.freeze({ id: 'internal_organs', integrityFamily: 'organ_internal', sourceMaterial: 'flesh', yield: null }),
        Object.freeze({ id: 'sensory_organs', integrityFamily: 'organ_sensory', sourceMaterial: 'flesh', yield: null }),
        Object.freeze({ id: 'brain', integrityFamily: 'organ_brain', sourceMaterial: 'flesh', yield: null }),
        Object.freeze({ id: 'glands', integrityFamily: 'organ_gland', sourceMaterial: 'flesh', yield: null }),
        Object.freeze({ id: 'blood', integrityFamily: 'blood_ichor', sourceMaterial: 'blood', yield: null }),
      ]),
    }),
    lootProfile: Object.freeze({ version: 1, carried: Object.freeze([]), equipment: Object.freeze({ source: 'unit_loadout' }), currency: null, harvest: Object.freeze({ source: 'body_profile' }), impossibleCategories: Object.freeze([]) }),
  });

  const FALLBACK_RANKS = Object.freeze({
    normal: Object.freeze({ id: 'normal', levelMultiplier: 1, minSpeedBonus: 0, maxSpeedBonus: 0, applyBonus: 0, basePowerBonus: 0, commandLevel: 0, aiCoordination: 'independent', targetPriority: 'random', turnEndSpRecovery: 0 }),
    captain: Object.freeze({ id: 'captain', levelMultiplier: 2, minSpeedBonus: 0, maxSpeedBonus: 1, applyBonus: 1, basePowerBonus: 0, commandLevel: 1, aiCoordination: 'focus_fire', targetPriority: 'lowest_hp_ratio', turnEndSpRecovery: 5 }),
    leader: Object.freeze({ id: 'leader', levelMultiplier: 3, minSpeedBonus: 1, maxSpeedBonus: 2, applyBonus: 2, basePowerBonus: 1, commandLevel: 2, aiCoordination: 'directed_focus', targetPriority: 'lowest_hp_ratio_then_highest_threat', turnEndSpRecovery: 10 }),
  });
  const UNIVERSAL_RANKS = rankRuntime?.RANKS || FALLBACK_RANKS;

  function ammoTrait(ammoId, amount) {
    if (rangedAmmo?.createAmmoTrait) return Object.freeze(rangedAmmo.createAmmoTrait(ammoId, amount));
    const name = String(ammoId || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return Object.freeze({ id: `ammo_${ammoId}`, name: `Ammo — ${name}`, type: 'passive', description: `[On Encounter Start] Gain ${amount} ${name}.`, mechanics: { ammoId, encounterStart: amount, statusMode: 'single', rangedSkillsOnly: true } });
  }

  const AMMO_PEBBLES = ammoTrait('pebbles', 6);
  const AMMO_ROCK = ammoTrait('rock', 1);

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
    // Spell references belong to the canonical Spell Catalog, not the Combat Skill library.
    const combatSkills = allSkills.filter((id) => !id.startsWith('spell:'));
    const spellIds = allSkills.filter((id) => id.startsWith('spell:')).map((id) => id.slice(6));
    const unit = {
      id: cfg.id, name: cfg.name, species: 'kobold', variant: cfg.variant, creatureType: cfg.creatureType || 'dragon',
      challengeRating: cfg.challengeRating, // Official CR for each source stat block; independent of runtime level.
      unitType: 'enemy', faction: 'enemy', actorCategory: 'enemy', isPlayer: false, linkedPlayerUID: '',
      ...(cfg.classId ? { classId: cfg.classId } : {}),
      ...(spellIds.length ? { spellIds } : {}),
      bodyProfile: clone(KOBOLD_LOOT_PROFILES.bodyProfile), lootProfile: clone(KOBOLD_LOOT_PROFILES.lootProfile),
      wealthProfile: socialLoot?.normalizeWealthProfile ? socialLoot.normalizeWealthProfile({ bandId: cfg.wealthBand || 'backstreets_very_poor', source: 'catalog_default' }) : { bandId: cfg.wealthBand || 'backstreets_very_poor', source: 'catalog_default', carriedCashSeparate: true },
      roleProfile: socialLoot?.normalizeRoleProfile ? socialLoot.normalizeRoleProfile({ roles: cfg.lootRoles || ['soldier'], source: 'catalog_default' }) : { roles: (cfg.lootRoles || ['soldier']).slice(), source: 'catalog_default' },
      tags: ['canonical', 'kobold', 'enemy', ...(cfg.tags || [])], icono: cfg.sprite, visual: visual(cfg.sprite, cfg.spriteVariants),
      naturalWorldLevel: clone(cfg.naturalWorldLevel), baseLevel: clone(cfg.naturalWorldLevel),
      scores: clone(cfg.scores || KOBOLD_WARRIOR_SCORES), proficiencies: clone(cfg.proficiencies || NO_PROFICIENCIES),
      size: 'small', movement: clone(cfg.movement || { ground: 30 }), movementFeet: clone(cfg.movement || { ground: 30 }),
      preferredMovementMode: cfg.defaultMovementMode || (cfg.startsFlying ? 'fly' : 'ground'),
      senses: clone(cfg.senses || { darkvision: 60, darkvisionFt: 60, passivePerception: 8 }),
      traitIds, traits: [{ id: PACK_TACTICS_ID, source: 'racial_trait_catalog' }, ...(cfg.traits || []).map(clone)],
      staggerThresholds: clone(STAGGER_THRESHOLDS), rankProfiles: clone(UNIVERSAL_RANKS), allowedRanks: (cfg.allowedRanks || ['normal', 'captain', 'leader']).slice(),
      action_slots: combatSkills.slice(), attack_tier_1_sequence: cfg.tier1.filter((id) => !id.startsWith('spell:')), attack_tier_2_sequence: (cfg.tier2 || []).slice(), attack_tier_3_sequence: (cfg.tier3 || []).slice(),
      damageTypeDefense: { resist: cfg.resist, weak: cfg.weak },
      flying: cfg.startsFlying === true,
      capabilities: { flight: Boolean(cfg.movement?.fly), climb: Boolean(cfg.movement?.climb), swim: Boolean(cfg.movement?.swim), burrow: Boolean(cfg.movement?.burrow) },
      mechanics: {
        hpModel: 'chassis_coefficient', hpBase: cfg.hpBase, hpCoefficient: cfg.hpCoefficient, defLvlMod: cfg.defLvlMod || 0, sp: 0,
        movementFeet: clone(cfg.movement || { ground: 30 }), preferredMovementMode: cfg.defaultMovementMode || (cfg.startsFlying ? 'fly' : 'ground'),
        darkvision: DARKVISION_RULES,
        weaponLoadout: clone(cfg.weaponLoadout || []),
        speedBonus: clone(cfg.speedBonus || { min: 0, max: 0 }), actionSlots: 1, maxSlotsLimit: 1, skills: combatSkills.slice(),
        ...(spellIds.length ? { spellIds: spellIds.slice() } : {}),
        staggerThresholds: clone(STAGGER_THRESHOLDS), stagger: '75%,50%,25%', damageTypeDefense: { resist: cfg.resist, weak: cfg.weak }, ...(clone(cfg.mechanics || {})),
      },
      schemaVersion: 5,
      metadata: {
        canonicalUnit: true, catalog: 'kobold-batch', rankModel: 'universal_normal_captain_leader',
        hpModel: 'chassis_coefficient', naturalWorldLevelIsReferenceOnly: true, speedModel: 'movement_feet_plus_size', speedPending: false, physicalProfilePending: false,
        canonicalSourceName: cfg.canonicalSourceName || 'Kobold Warrior', canonicalSourceBook: cfg.canonicalSourceBook || 'Monster Manual (2025)', canonicalScores: true, canonicalProficiencies: true,
      },
    };
    movementRuntime?.decorateEntity?.(unit, { movementMode: unit.preferredMovementMode });
    return unit;
  }

  const freezeCompendiumContent = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freezeCompendiumContent); Object.freeze(value); }
    return value;
  };
  const COMPENDIUM_CONTENT = freezeCompendiumContent({
  "kobold_dagger": {
    "basicDescription": "Pequeño humanoide reptiliano de hocico alargado y cola visible. Este ejemplar lleva una daga y prendas adaptadas a su talla.",
    "lore": {
      "context": "En algunas periferias de Limbus existen grupos de kobolds que sobreviven mediante trabajos, intercambios, saqueos o emboscadas. La pertenencia y las lealtades de este individuo deben establecerse en la escena.",
      "behavior": "Su daga favorece las aproximaciones cercanas y los ataques desde espacios reducidos. Puede aprovechar la presión de compañeros próximos, pero su coordinación efectiva debe observarse."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "history",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su anatomía es biológica y reptiliana. El equipo que porta se estudia como pertenencias; los materiales del cuerpo requieren las acciones anatómicas correspondientes."
      }
    }
  },
  "kobold_sling": {
    "basicDescription": "Pequeño humanoide reptiliano que porta una honda. Puede llevar bolsas o recipientes para objetos pequeños; su contenido no se distingue sin revisarlos.",
    "lore": {
      "context": "Las hondas permiten a grupos con recursos limitados convertir objetos disponibles en proyectiles. Eso no determina una profesión, una facción ni el origen de las pertenencias de este kobold.",
      "behavior": "Busca lanzar desde una distancia que le permita preparar otro proyectil o retroceder. Una bolsa visible no revela cuántas piedras quedan ni qué otras pertenencias contiene."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "history",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Tiene un cuerpo biológico y pertenencias separadas de su anatomía. Revisar su equipo y estudiar sus órganos son acciones distintas."
      }
    }
  },
  "winged_kobold": {
    "basicDescription": "Humanoide reptiliano pequeño con un par de alas membranosas. Las armas y cualquier objeto que sostenga deben describirse según su estado visible.",
    "lore": {
      "context": "Los kobolds alados pueden ocupar funciones diferentes dentro de un grupo. Su capacidad de volar no demuestra jerarquía, favor divino ni pertenencia a una comunidad concreta.",
      "behavior": "Puede utilizar la altura para acercarse, transportar objetos o retirarse de una posición comprometida. Un objeto que lleve entre las manos forma parte de la situación observable y no de un repertorio supuesto."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "history",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Las alas forman parte de un cuerpo biológico. Examinar sus membranas y articulaciones permite estudiar su estructura, sin revelar automáticamente las reglas de vuelo del individuo."
      }
    }
  },
  "dragonheart_kobold": {
    "basicDescription": "Kobold de presencia firme y equipo de combate visible. Su postura y los gestos que dirige a sus acompañantes pueden distinguirlo dentro del grupo.",
    "lore": {
      "context": "Algunos grupos reconocen figuras capaces de sostener la moral colectiva. El título Dragonheart no establece por sí solo una relación real con un dragón ni una autoridad compartida por todos los kobolds.",
      "behavior": "Su presencia puede sostener la respuesta de otros kobolds ante amenazas. Las reacciones de sus compañeros ayudan a distinguir una influencia de mando de una simple coincidencia."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "history",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo sigue siendo biológico. Sus cualidades de mando no constituyen un órgano o componente recuperable ni se transfieren con sus pertenencias."
      }
    }
  },
  "scale_sorcerer_kobold": {
    "basicDescription": "Humanoide reptiliano pequeño. Sus gestos, palabras y manifestaciones visibles durante un lanzamiento permiten distinguir el uso de magia del uso de un arma.",
    "lore": {
      "context": "La presencia de un hechicero puede influir en la posición de un individuo dentro de una comunidad. No todos los kobolds comparten sus conocimientos ni su vínculo con la magia.",
      "behavior": "Combina recursos de lanzamiento con las necesidades de un cuerpo pequeño y vulnerable al entorno. Presenciar un conjuro no revela los demás, ni permite atribuir magia a todos sus ataques con arma."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "arcana",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo es biológico. El poder de lanzamiento y los recursos mágicos no deben tratarse como sustancias extraíbles sin una regla específica que lo permita."
      }
    }
  }
});

  const DEFINITIONS = Object.freeze(Object.fromEntries(Object.entries({
    kobold_dagger: Object.freeze(makeUnit({ id: 'kobold_dagger', name: 'Kobold · Dagger', variant: 'dagger', challengeRating: 0.125, weaponLoadout: [{ weaponId: 'dagger', skillId: 'kobold_dagger_jab', range: 'melee' }], lootRoles: ['soldier'], sprite: 'https://imgur.com/2BBvM2s.png', canonicalSourceName: 'Kobold Warrior',
      naturalWorldLevel: { min: 1, max: 3 }, hpBase: 5, hpCoefficient: 0.19,
      scores: KOBOLD_WARRIOR_SCORES, proficiencies: NO_PROFICIENCIES, movement: { ground: 30 }, senses: { darkvision: 60, darkvisionFt: 60, passivePerception: 8 },
      resist: 'perforante', weak: 'contundente', tags: ['tier1'], tier1: ['kobold_dagger_jab', 'kobold_desperate_stab', 'kobold_scurry'] })),
    kobold_sling: Object.freeze(makeUnit({
      id: 'kobold_sling', name: 'Kobold · Sling', variant: 'sling', challengeRating: 0.125, weaponLoadout: [{ weaponId: 'sling', skillId: 'kobold_sling_shot', range: 'ranged', ammoType: 'pebbles' }], lootRoles: ['hunter'], sprite: 'https://imgur.com/ndB257N.png', canonicalSourceName: 'Kobold Warrior',
      naturalWorldLevel: { min: 1, max: 3 }, hpBase: 5, hpCoefficient: 0.19,
      scores: KOBOLD_WARRIOR_SCORES, proficiencies: NO_PROFICIENCIES, movement: { ground: 30 }, senses: { darkvision: 60, darkvisionFt: 60, passivePerception: 8 },
      resist: 'perforante', weak: 'contundente', tags: ['tier1', 'ranged'], traits: [AMMO_PEBBLES], tier1: ['kobold_sling_shot', 'kobold_rapid_pebble', 'kobold_duck_away'],
      mechanics: { ammoLoadout: [{ id: 'pebbles', amount: 6 }], ammunition: { pebbles: { type: 'single', icon: 'https://imgur.com/hhYbwsi.png' } } },
    })),
    winged_kobold: Object.freeze(makeUnit({
      id: 'winged_kobold', name: 'Winged Kobold', variant: 'winged', challengeRating: 0.25, weaponLoadout: [{ weaponId: 'dagger', skillId: 'winged_kobold_dagger', range: 'melee' }], lootRoles: ['soldier'], sprite: 'https://imgur.com/529fa4E.png',
      spriteVariants: { dagger: 'https://imgur.com/evsrs1B.png', holdingRock: 'https://imgur.com/529fa4E.png', withoutRock: 'https://imgur.com/zmA1FPz.png', rockAsset: 'https://imgur.com/P4J48yc.png' },
      canonicalSourceName: 'Winged Kobold', naturalWorldLevel: { min: 2, max: 4 }, hpBase: 7, hpCoefficient: 0.22,
      scores: WINGED_KOBOLD_SCORES, proficiencies: NO_PROFICIENCIES, movement: { ground: 30, fly: 30 }, defaultMovementMode: 'fly', startsFlying: true,
      senses: { darkvision: 60, darkvisionFt: 60, passivePerception: 8 }, resist: 'cortante', weak: 'perforante',
      tags: ['tier1', 'tier2', 'flying'], traits: [AERIAL_HARRIER, AMMO_ROCK], tier1: ['winged_kobold_falling_rock', 'winged_kobold_dagger'], tier2: ['winged_kobold_dive_stab'],
      mechanics: {
        flying: true,
        ammoLoadout: [{ id: 'rock', amount: 1 }],
        ammunition: { rock: { type: 'single', max: 1, icon: 'https://imgur.com/7rOv1S0.png', asset: 'https://imgur.com/P4J48yc.png' } },
        unitLifecycle: { onComeback: { grantAmmunition: [{ id: 'rock', amount: 1, max: 1 }] } },
        ai: { prefersRetreat: true, retreatAfter: 'harassment', fallingRockRequiresAmmo: 'rock' },
      },
    })),
    dragonheart_kobold: Object.freeze(makeUnit({
      id: 'dragonheart_kobold', name: 'Dragonheart Kobold', variant: 'dragonheart', challengeRating: 1, weaponLoadout: [{ weaponId: 'spear', skillId: 'dragonheart_spear_thrust', range: 'melee' }], lootRoles: ['soldier', 'commander'], wealthBand: 'backstreets_low', sprite: 'https://imgur.com/4EYu3us.png', canonicalSourceName: 'Kobold Dragonshield', canonicalSourceBook: 'Mordenkainen Presents: Monsters of the Multiverse',
      naturalWorldLevel: { min: 5, max: 9 }, hpBase: 44, hpCoefficient: 0.30,
      scores: DRAGONSHIELD_SCORES, proficiencies: DRAGONSHIELD_PROFICIENCIES, movement: { ground: 20 }, senses: { darkvision: 60, darkvisionFt: 60, passivePerception: 11 },
      defLvlMod: 3, resist: 'cortante', weak: 'contundente', tags: ['tier1', 'tier2', 'tier3', 'commander'],
      traits: [DRAGONHEART, DRAGON_RESISTANCE], allowedRanks: ['captain', 'leader'], tier1: ['dragonheart_spear_thrust'], tier2: ['dragonheart_guarding_skewer'], tier3: ['dragonheart_dragon_spear'],
    })),
    scale_sorcerer_kobold: Object.freeze(makeUnit({
      id: 'scale_sorcerer_kobold', name: 'Scale Sorcerer Kobold', variant: 'scale_sorcerer', challengeRating: 1, weaponLoadout: [{ weaponId: 'dagger', skillId: 'kobold_dagger_jab', range: 'melee' }], lootRoles: ['commander'], wealthBand: 'backstreets_low', sprite: 'https://imgur.com/TOHr6Dk.png', canonicalSourceName: 'Kobold Scale Sorcerer', canonicalSourceBook: 'Mordenkainen Presents: Monsters of the Multiverse', creatureType: 'humanoid',
      naturalWorldLevel: { min: 5, max: 9 }, hpBase: 27, hpCoefficient: 0.25,
      scores: SCALE_SORCERER_SCORES, proficiencies: SCALE_SORCERER_PROFICIENCIES, movement: { ground: 30 }, senses: { darkvision: 60, darkvisionFt: 60, passivePerception: 9 },
      defLvlMod: 3, resist: 'perforante', weak: 'cortante', classId: 'sorcerer', tags: ['spellcaster', 'commander'], traits: [SPELL_CASTER_CHARISMA], allowedRanks: ['captain', 'leader'],
      tier1: ['kobold_dagger_jab', 'spell:fire_bolt', 'spell:poison_spray', 'spell:charm_person', 'spell:chromatic_orb', 'spell:expeditious_retreat', 'spell:scorching_ray'],
      mechanics: { spellcasting: { ability: 'charisma', saveThresholdFormula: '10 + CHA_MOD', spellSlots: { 1: 4, 2: 2 } }, sorceryPoints: { encounterStart: 3, runtime: 'sorcerer_class_runtime', metamagic: ['subtle_spell', 'heightened_spell'] }, spellReferencesPendingCanonicalCatalog: true },
    })),
  }).map(([id, unit]) => [id, Object.freeze({ ...unit, ...COMPENDIUM_CONTENT[id], lootProfile: Object.freeze({ ...unit.lootProfile, maxRewardTier: 2, observationUpgrades: Object.freeze([Object.freeze({fromItemId: 'hp_generic_pocket_recovery_patch', toItemId: 'hp_generic_rapid_recovery_gel'})]) }) })])));

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
    const baseSpeed = movementRuntime?.rangeForEntity?.(unit, { movementMode: opts.movementMode });
    if (!baseSpeed) throw new Error('MOVEMENT_SPEED_RUNTIME_REQUIRED:kobold');
    const sb = unit.mechanics.speedBonus || {};
    const minSpeed = Math.max(1, Number(baseSpeed.min || 1) + Number(sb.min || 0) + Number(profile.minSpeedBonus || 0));
    const maxSpeed = Math.max(2, minSpeed, Number(baseSpeed.max || 6) + Number(sb.max || 0) + Number(profile.maxSpeedBonus || 0));
    unit.rank = rank; unit.baseLevelSelected = level; unit.runtimeLevel = level; unit.effectiveLevel = effectiveLevel; unit.defensiveLevel = defensiveLevel; unit.rankBonuses = clone(profile);
    unit.speedRange = [minSpeed, maxSpeed]; unit.speedMin = minSpeed; unit.speedMax = maxSpeed; unit.speedProfileMode = baseSpeed.mode || unit.preferredMovementMode || 'ground';
    unit.commandProfile = { commandLevel: profile.commandLevel, aiCoordination: profile.aiCoordination, targetPriority: profile.targetPriority, turnEndSpRecovery: profile.turnEndSpRecovery };
    unit.resolvedSkills = unit.mechanics.skills.map((skillId) => resolveSkill(skillId, rank));
    unit.mechanics = { ...unit.mechanics, hp: maxHp, maxHp, level: effectiveLevel, runtimeLevel: level, defensiveLevel, rank, speedRange: [minSpeed, maxSpeed], minSpeed, maxSpeed, speed: `${minSpeed}-${maxSpeed}`, speedProfileMode: unit.speedProfileMode, statusApplyBonus: profile.applyBonus, basePowerBonus: profile.basePowerBonus, commandLevel: profile.commandLevel, aiCoordination: profile.aiCoordination, turnEndSpRecovery: profile.turnEndSpRecovery };
    if (combatMechanics?.onEncounterStart && opts.initializeEncounter === true) combatMechanics.onEncounterStart(unit);
    return unit;
  }

  function firebasePayload() { const payload = {}; list().forEach((u) => { payload[u.id] = u; }); return payload; }
  function firebaseSkillPayload(schema) { if (!skillCatalog?.firebasePayload) throw new Error('KOBOLD_SKILL_CATALOG_REQUIRED'); return skillCatalog.firebasePayload(schema); }

  const api = Object.freeze({ version: '2.4.0', STAGGER_THRESHOLDS, KOBOLD_WARRIOR_SCORES, WINGED_KOBOLD_SCORES, DRAGONSHIELD_SCORES, SCALE_SORCERER_SCORES, NO_PROFICIENCIES, DRAGONSHIELD_PROFICIENCIES, SCALE_SORCERER_PROFICIENCIES, PACK_TACTICS_ID, UNIVERSAL_RANKS, AMMO_PEBBLES, AMMO_ROCK, AERIAL_HARRIER, DRAGONHEART, DRAGON_RESISTANCE, SPELL_CASTER_CHARISMA, DEFINITIONS, list, get, resolve, resolveSkill, firebasePayload, firebaseSkillPayload });
  global.LuminousKoboldUnitCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);


