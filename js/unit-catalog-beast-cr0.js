(function (global) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const skillCatalog = global.LuminousBeastCr0SkillCatalog || (typeof require !== "undefined" ? (() => { try { return require("./skill-catalog-beast-cr0.js"); } catch (_) { return null; } })() : null);
  const proficiencyRuntime = global.LuminousProficiencyRuntime || (typeof require !== "undefined" ? (() => { try { return require("./proficiency-runtime.js"); } catch (_) { return null; } })() : null);
  const movementRuntime = global.LuminousMovementSpeedRuntime || (typeof require !== "undefined" ? (() => { try { return require("./movement-speed-runtime.js"); } catch (_) { return null; } })() : null);

  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);

  const ELEVATED_TARGETABILITY = Object.freeze({
    canBeHitIfAny: Object.freeze([
      "lost_clash_against_skill",
      "attacker_weapon_is_ranged",
      "attacker_weapon_has_reach",
    ]),
  });

  const FLIGHT_RULES = Object.freeze({
    capable: true,
    groundedQuickAction: "fly",
    quickActionSetsFlying: true,
    quickActionRemovesProne: true,
    whileFlyingTargetability: ELEVATED_TARGETABILITY,
    onKnockedDown: Object.freeze({ setFlying: false, applyStatus: "prone" }),
  });

  const BLINDSIGHT_RULES = Object.freeze({
    ignoresDarkness: true,
    detectsInvisible: true,
    ignoresInvisibleDisadvantage: true,
  });

  const DARKVISION_RULES = Object.freeze({ ignoresDarkness: true });

  const WATER_BREATHING_RULES = Object.freeze({
    onlyUnderwater: true,
    underwater: Object.freeze({ gainsAirCounter: false }),
    outsideWater: Object.freeze({ gainsAirCounter: true }),
  });

  const TRAITS = Object.freeze({
    jumper: Object.freeze({
      id: "jumper",
      name: "Jumper",
      type: "passive",
      mechanics: Object.freeze({ jumpCheckAbility: "dex", jumpCheckFinalPowerBonus: 3 }),
    }),
    amphibious: Object.freeze({
      id: "amphibious",
      name: "Amphibious",
      type: "passive",
      mechanics: Object.freeze({
        underwaterEncounter: Object.freeze({ gainsAirCounter: false }),
        outsideWater: Object.freeze({ gainsAirCounter: false }),
      }),
    }),
    agile: Object.freeze({
      id: "agile",
      name: "Agile",
      type: "passive",
      mechanics: Object.freeze({ skillsTriggerCounterAttacks: false }),
    }),
    standing_leap: Object.freeze({
      id: "standing_leap",
      name: "Standing Leap",
      type: "passive",
      mechanics: Object.freeze({ jumpRequiresRunningStart: false }),
    }),
    illumination: Object.freeze({
      id: "illumination",
      name: "Illumination",
      type: "passive",
      mechanics: Object.freeze({ brightLightFeet: 10, dimLightAdditionalFeet: 10 }),
    }),
    spider_climb: Object.freeze({
      id: "spider_climb",
      name: "Spider Climb",
      type: "active",
      activation: Object.freeze({
        actionCost: "quick_action",
        requirementsAny: Object.freeze(["encounter_is_interior", "encounter_has_climbable_objects"]),
      }),
      mechanics: Object.freeze({
        terrestrial: true,
        setState: "climbing",
        targetabilityWhileClimbing: ELEVATED_TARGETABILITY,
        validSurfaces: Object.freeze(["interior_structure", "climbable_object"]),
      }),
    }),
    compression: Object.freeze({
      id: "compression",
      name: "Compression",
      type: "passive",
      mechanics: Object.freeze({ ignoreNarrowSpaceMovementPenalty: true, minimumOpeningInches: 1 }),
    }),
    water_breathing: Object.freeze({
      id: "water_breathing",
      name: "Water Breathing",
      type: "passive",
      mechanics: WATER_BREATHING_RULES,
    }),
    flyby: Object.freeze({
      id: "flyby",
      name: "Flyby",
      type: "passive",
      mechanics: Object.freeze({ whileFlying: Object.freeze({ evasionPowerBonus: 8 }) }),
    }),
    mimicry: Object.freeze({
      id: "mimicry",
      name: "Mimicry",
      type: "active",
      activation: Object.freeze({ actionCost: "quick_action", target: "enemy_that_can_hear" }),
      mechanics: Object.freeze({
        save: Object.freeze({ ability: "wis", threshold: 10 }),
        onFail: Object.freeze({ status: "clash_power_down", potency: 1 }),
      }),
    }),
    ink_spitting: Object.freeze({
      id: "ink_spitting",
      name: "Ink Spitting",
      type: "reaction",
      activation: Object.freeze({ actionCost: "reaction", uses: Object.freeze({ max: 1, reset: "encounter" }), target: "attacker" }),
      mechanics: Object.freeze({
        usableOutsideWater: true,
        applyToAttacker: Object.freeze({ status: "blind", potency: 1 }),
        afterSkill: Object.freeze({ action: "escape" }),
      }),
    }),
  });

  const CAT_APPEARANCES = Object.freeze([
    Object.freeze({ id: "domestic_longhair", name: "Domestic Longhair", sprite: "https://imgur.com/v0YAKCC" }),
    Object.freeze({ id: "bombay", name: "Bombay", sprite: "https://imgur.com/D5XUyMO" }),
    Object.freeze({ id: "persian", name: "Persa", sprite: "https://imgur.com/dOFAnyH" }),
    Object.freeze({ id: "siamese", name: "Siamés", sprite: "https://imgur.com/xcbK6Pk" }),
    Object.freeze({ id: "maine_coon", name: "Maine Coon", sprite: "https://imgur.com/CboUXvn" }),
    Object.freeze({ id: "russian_blue", name: "Azul Ruso", sprite: "https://imgur.com/xCBHiEa" }),
    Object.freeze({ id: "calico", name: "Calicó", sprite: "https://imgur.com/RUDnEd0" }),
    Object.freeze({ id: "tuxedo", name: "Tuxedo", sprite: "https://imgur.com/XfZN9J4" }),
    Object.freeze({ id: "bengal", name: "Bengalí", sprite: "https://imgur.com/gY8PySP" }),
    Object.freeze({ id: "sphynx", name: "Sphynx", sprite: "https://imgur.com/H1pcIg0" }),
  ]);

  function visual(sprite, variants = []) {
    return {
      spriteUrl: sprite,
      idle_sprite: sprite,
      moving_sprite: "",
      guard_sprite: "",
      evade_sprite: "",
      hurt_sprite: "",
      dead_sprite: "",
      scale: 1,
      spriteX: 0,
      spriteY: 0,
      uiX: 0,
      uiY: 0,
      isFocused: false,
      variants: clone(variants),
    };
  }

  function canonicalProficiencies({ savingThrows = {}, skills = {} } = {}) {
    return { savingThrows: { ...savingThrows }, skills: { ...skills } };
  }

  function makeUnit(cfg) {
    const traitIds = (cfg.traits || []).map((trait) => trait.id);
    const traits = (cfg.traits || []).map((trait) => {
      if (trait.source === "racial_trait_catalog") return clone(trait);
      return clone(TRAITS[trait.id] || trait);
    });
    const skillIds = cfg.skills.slice();

    const mechanics = {
      hpModel: "chassis_coefficient",
      hpBase: cfg.hpBase,
      hpCoefficient: cfg.hpCoefficient,
      sp: 0,
      actionSlots: 1,
      maxSlotsLimit: 1,
      skills: skillIds.slice(),
      staggerThresholds: clone(STAGGER_THRESHOLDS),
      stagger: "75%,50%,25%",
      proficiencyModel: "universal_level",
      movementFeet: clone(cfg.movement),
      preferredMovementMode: cfg.defaultMovementMode || "ground",
      senses: clone(cfg.senses || {}),
      ...clone(cfg.mechanics || {}),
    };

    if (cfg.movement?.fly) {
      mechanics.flying = true;
      mechanics.flight = clone(FLIGHT_RULES);
      mechanics.flyingTargetability = clone(ELEVATED_TARGETABILITY);
    }
    if (cfg.senses?.blindsight) mechanics.blindsight = clone(BLINDSIGHT_RULES);
    if (cfg.senses?.darkvision) mechanics.darkvision = clone(DARKVISION_RULES);

    const unit = {
      id: cfg.id,
      name: cfg.name,
      species: cfg.id,
      family: "beast_cr0",
      creatureType: "beast",
      challengeRating: 0,
      unitType: "beast",
      faction: "neutral",
      actorCategory: "npc",
      isPlayer: false,
      linkedPlayerUID: "",
      tags: ["canonical", "beast", "cr0", "find_familiar", ...(cfg.tags || [])],
      icono: cfg.sprite,
      visual: visual(cfg.sprite, cfg.appearances || []),
      summonAppearanceOptions: clone(cfg.appearances || []),
      naturalWorldLevel: { min: 1, max: 1 },
      baseLevel: { min: 1, max: 1 },
      scores: clone(cfg.scores),
      proficiencies: canonicalProficiencies(cfg.proficiencies),
      size: cfg.size,
      movement: clone(cfg.movement),
      movementFeet: clone(cfg.movement),
      preferredMovementMode: cfg.defaultMovementMode || "ground",
      senses: clone(cfg.senses || {}),
      resistances: clone(cfg.resistances || {}),
      traitIds,
      traits,
      flying: cfg.startsFlying === true,
      climbing: false,
      capabilities: {
        flight: Boolean(cfg.movement?.fly),
        climb: Boolean(cfg.movement?.climb),
        swim: Boolean(cfg.movement?.swim),
        burrow: Boolean(cfg.movement?.burrow),
      },
      staggerThresholds: clone(STAGGER_THRESHOLDS),
      allowedRanks: ["normal"],
      action_slots: skillIds.slice(),
      attack_tier_1_sequence: skillIds.slice(),
      attack_tier_2_sequence: [],
      attack_tier_3_sequence: [],
      mechanics,
      summon: {
        eligible: true,
        findFamiliar: true,
        selectableAppearance: Boolean((cfg.appearances || []).length),
      },
      schemaVersion: 2,
      metadata: {
        canonicalUnit: true,
        canonicalSource: "D&D 2024",
        catalog: "beast-cr0",
        hpModel: "chassis_coefficient",
        naturalWorldLevelIsReferenceOnly: true,
        canonicalScores: true,
        canonicalProficiencies: true,
        speedModel: "movement_feet_plus_size",
      },
    };

    movementRuntime?.decorateEntity?.(unit, { movementMode: cfg.defaultMovementMode || (cfg.startsFlying ? "fly" : "ground") });
    return unit;
  }

  const DEFINITIONS = Object.freeze({
    baboon: Object.freeze(makeUnit({
      id: "baboon", name: "Baboon", size: "small", sprite: "https://imgur.com/AMRt4K4",
      hpBase: 5, hpCoefficient: 0.06,
      scores: { str: 8, dex: 14, con: 11, int: 4, wis: 12, cha: 6 },
      proficiencies: {}, movement: { ground: 30, climb: 30 }, senses: { passivePerception: 11 },
      traits: [{ id: "pack_tactics", source: "racial_trait_catalog" }], skills: ["baboon_bite"],
    })),
    badger: Object.freeze(makeUnit({
      id: "badger", name: "Badger", size: "tiny", sprite: "https://imgur.com/HAPK4Na",
      hpBase: 5, hpCoefficient: 0.08,
      scores: { str: 10, dex: 11, con: 16, int: 2, wis: 12, cha: 5 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 20, burrow: 5 }, senses: { darkvision: 30, passivePerception: 13 },
      resistances: { poison: true },
      mechanics: {
        poisonResistance: { statusDamageMultiplier: 0.5 },
        burrow: { type: "temporary_retreat", untargetable: true, durationTurns: 1, returnAfterDuration: true },
      },
      skills: ["badger_bite"],
    })),
    bat: Object.freeze(makeUnit({
      id: "bat", name: "Bat", size: "tiny", sprite: "https://imgur.com/iYN0uye",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4 },
      proficiencies: {}, movement: { ground: 5, fly: 30 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { blindsight: 60, passivePerception: 11 }, skills: ["bat_bite"],
    })),
    cat: Object.freeze(makeUnit({
      id: "cat", name: "Cat", size: "tiny", sprite: "https://imgur.com/v0YAKCC", appearances: CAT_APPEARANCES,
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
      proficiencies: { savingThrows: { dex: "proficient" }, skills: { perception: "proficient", stealth: "proficient" } },
      movement: { ground: 40, climb: 40 }, senses: { darkvision: 60, passivePerception: 13 },
      traits: [{ id: "jumper" }], skills: ["cat_scratch"],
    })),
    crab: Object.freeze(makeUnit({
      id: "crab", name: "Crab", size: "tiny", sprite: "https://imgur.com/hWfiKo7",
      hpBase: 5, hpCoefficient: 0.06,
      scores: { str: 6, dex: 11, con: 12, int: 1, wis: 8, cha: 2 },
      proficiencies: { skills: { stealth: "proficient" } },
      movement: { ground: 20, swim: 20 }, senses: { blindsight: 30, passivePerception: 9 },
      traits: [{ id: "amphibious" }], skills: ["crab_claw"],
    })),
    deer: Object.freeze(makeUnit({
      id: "deer", name: "Deer", size: "medium", sprite: "https://imgur.com/DV2j7Yx",
      hpBase: 7, hpCoefficient: 0.07,
      scores: { str: 11, dex: 16, con: 11, int: 2, wis: 14, cha: 5 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 50 }, senses: { darkvision: 60, passivePerception: 14 },
      traits: [{ id: "agile" }], skills: ["deer_ram"],
    })),
    eagle: Object.freeze(makeUnit({
      id: "eagle", name: "Eagle", size: "small", sprite: "https://imgur.com/ma1CaXa",
      hpBase: 6, hpCoefficient: 0.06,
      scores: { str: 6, dex: 15, con: 12, int: 2, wis: 14, cha: 7 },
      proficiencies: { skills: { perception: "expertise" } },
      movement: { ground: 10, fly: 60 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 16 }, skills: ["eagle_talons"],
    })),
    frog: Object.freeze(makeUnit({
      id: "frog", name: "Frog", size: "tiny", sprite: "https://imgur.com/5178aOJ",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
      proficiencies: { skills: { perception: "proficient", stealth: "proficient" } },
      movement: { ground: 20, swim: 20 }, senses: { darkvision: 30, passivePerception: 11 },
      traits: [{ id: "amphibious" }, { id: "standing_leap" }], skills: ["frog_bite"],
    })),
    giant_fire_beetle: Object.freeze(makeUnit({
      id: "giant_fire_beetle", name: "Giant Fire Beetle", size: "small", sprite: "https://imgur.com/L9qe1px",
      hpBase: 6, hpCoefficient: 0.07,
      scores: { str: 8, dex: 10, con: 12, int: 1, wis: 7, cha: 3 },
      proficiencies: {}, movement: { ground: 30, climb: 30 }, senses: { blindsight: 30, passivePerception: 8 },
      resistances: { fire: true }, traits: [{ id: "illumination" }], skills: ["giant_fire_beetle_bite"],
    })),
    goat: Object.freeze(makeUnit({
      id: "goat", name: "Goat", size: "medium", sprite: "https://imgur.com/mlTs9SU",
      hpBase: 6, hpCoefficient: 0.07,
      scores: { str: 11, dex: 10, con: 11, int: 2, wis: 10, cha: 5 },
      proficiencies: { savingThrows: { str: "proficient" }, skills: { perception: "proficient" } },
      movement: { ground: 40, climb: 30 }, senses: { darkvision: 60, passivePerception: 12 }, skills: ["goat_ram"],
    })),
    hawk: Object.freeze(makeUnit({
      id: "hawk", name: "Hawk", size: "tiny", sprite: "https://imgur.com/cydn2Fq",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6 },
      proficiencies: { skills: { perception: "expertise" } },
      movement: { ground: 10, fly: 60 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 16 }, skills: ["hawk_talons"],
    })),
    hyena: Object.freeze(makeUnit({
      id: "hyena", name: "Hyena", size: "medium", sprite: "https://imgur.com/JqNrGNJ",
      hpBase: 7, hpCoefficient: 0.08,
      scores: { str: 11, dex: 13, con: 12, int: 2, wis: 12, cha: 5 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 50 }, senses: { darkvision: 60, passivePerception: 13 },
      traits: [{ id: "pack_tactics", source: "racial_trait_catalog" }], skills: ["hyena_bite"],
    })),
    jackal: Object.freeze(makeUnit({
      id: "jackal", name: "Jackal", size: "small", sprite: "https://imgur.com/epN41sW",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 8, dex: 15, con: 11, int: 3, wis: 12, cha: 6 },
      proficiencies: { skills: { perception: "expertise", stealth: "proficient" } },
      movement: { ground: 40 }, senses: { darkvision: 90, passivePerception: 15 }, skills: ["jackal_bite"],
    })),
    lizard: Object.freeze(makeUnit({
      id: "lizard", name: "Lizard", size: "tiny", sprite: "https://imgur.com/TJyipfD",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 3 },
      proficiencies: {}, movement: { ground: 20, climb: 20 }, senses: { darkvision: 30, passivePerception: 9 },
      traits: [{ id: "spider_climb" }], skills: ["lizard_bite"],
    })),
    octopus: Object.freeze(makeUnit({
      id: "octopus", name: "Octopus", size: "small", sprite: "https://imgur.com/R05Yylv",
      hpBase: 5, hpCoefficient: 0.06,
      scores: { str: 4, dex: 15, con: 11, int: 3, wis: 10, cha: 4 },
      proficiencies: { skills: { perception: "proficient", stealth: "expertise" } },
      movement: { ground: 5, swim: 30 }, defaultMovementMode: "swim",
      senses: { darkvision: 30, passivePerception: 12 },
      traits: [{ id: "compression" }, { id: "water_breathing" }, { id: "ink_spitting" }],
      mechanics: { waterBreathing: WATER_BREATHING_RULES },
      skills: ["octopus_tentacles"],
    })),
    owl: Object.freeze(makeUnit({
      id: "owl", name: "Owl", size: "tiny", sprite: "https://imgur.com/vWQEbDW",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7 },
      proficiencies: { skills: { perception: "expertise", stealth: "expertise" } },
      movement: { ground: 5, fly: 60 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { darkvision: 120, passivePerception: 15 }, traits: [{ id: "flyby" }], skills: ["owl_talons"],
    })),
    piranha: Object.freeze(makeUnit({
      id: "piranha", name: "Piranha", size: "tiny", sprite: "https://imgur.com/XgAyzp2",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 16, con: 9, int: 1, wis: 7, cha: 2 },
      proficiencies: {}, movement: { ground: 5, swim: 40 }, defaultMovementMode: "swim",
      senses: { darkvision: 60, passivePerception: 8 },
      traits: [{ id: "water_breathing" }], mechanics: { waterBreathing: WATER_BREATHING_RULES },
      skills: ["piranha_bite"],
    })),
    rat: Object.freeze(makeUnit({
      id: "rat", name: "Rat", size: "tiny", sprite: "https://imgur.com/5CSdJgg",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 20, climb: 20 }, senses: { darkvision: 30, passivePerception: 12 },
      traits: [{ id: "agile" }], skills: ["rat_bite"],
    })),
    raven: Object.freeze(makeUnit({
      id: "raven", name: "Raven", size: "tiny", sprite: "https://imgur.com/Ib3X9Dm",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 14, con: 10, int: 5, wis: 13, cha: 6 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 10, fly: 50 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 13 }, traits: [{ id: "mimicry" }], skills: ["raven_beak"],
    })),
    scorpion: Object.freeze(makeUnit({
      id: "scorpion", name: "Scorpion", size: "tiny", sprite: "https://imgur.com/ylih8ga",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 11, con: 8, int: 1, wis: 8, cha: 2 },
      proficiencies: {}, movement: { ground: 10 }, senses: { blindsight: 10, passivePerception: 9 },
      skills: ["scorpion_sting"],
    })),
  });

  function list() { return Object.values(DEFINITIONS).map(clone); }
  function get(id) {
    const value = DEFINITIONS[String(id || "")];
    return value ? clone(value) : null;
  }
  function normalizeRuntimeLevel(level) {
    const value = Math.floor(Number(level));
    if (!Number.isFinite(value) || value < 1) throw new Error(`UNIT_LEVEL_OUT_OF_RANGE:${level}`);
    return value;
  }
  function resolveSkill(skillId) {
    if (!skillCatalog?.get) throw new Error("BEAST_CR0_SKILL_CATALOG_REQUIRED");
    const skill = skillCatalog.get(skillId);
    if (!skill) throw new Error(`UNKNOWN_BEAST_CR0_SKILL:${skillId}`);
    return skill;
  }
  function resolve(id, options = {}) {
    const unit = get(id);
    if (!unit) throw new Error(`UNKNOWN_BEAST_CR0_UNIT:${id}`);
    const level = normalizeRuntimeLevel(options.level ?? options.baseLevel ?? 1);
    const maxHp = Math.floor(Number(unit.mechanics.hpBase || 0) + level * Number(unit.mechanics.hpCoefficient || 0));
    const proficiencyBonus = proficiencyRuntime?.proficiencyBonus ? proficiencyRuntime.proficiencyBonus(level) : Math.ceil(level / 20);
    if (options.flying != null) unit.flying = options.flying === true;
    if (options.climbing != null) unit.climbing = options.climbing === true;
    if (Array.isArray(options.encounterTags)) unit.encounterTags = options.encounterTags.slice();
    if (Array.isArray(options.environmentTags)) unit.environmentTags = options.environmentTags.slice();
    movementRuntime?.decorateEntity?.(unit, { movementMode: options.movementMode });

    unit.rank = "normal";
    unit.runtimeLevel = level;
    unit.baseLevelSelected = level;
    unit.effectiveLevel = level;
    unit.proficiencyBonus = proficiencyBonus;
    unit.resolvedSkills = unit.mechanics.skills.map(resolveSkill);
    unit.hp = maxHp;
    unit.maxHp = maxHp;
    unit.mechanics = {
      ...unit.mechanics,
      hp: maxHp,
      maxHp,
      level,
      runtimeLevel: level,
      proficiencyBonus,
      rank: "normal",
    };
    return unit;
  }

  function firebasePayload() {
    const payload = {};
    list().forEach((unit) => { payload[unit.id] = unit; });
    return payload;
  }
  function firebaseSkillPayload(schema) {
    if (!skillCatalog?.firebasePayload) throw new Error("BEAST_CR0_SKILL_CATALOG_REQUIRED");
    return skillCatalog.firebasePayload(schema);
  }

  const api = Object.freeze({
    version: "1.1.0",
    STAGGER_THRESHOLDS,
    ELEVATED_TARGETABILITY,
    FLIGHT_RULES,
    BLINDSIGHT_RULES,
    DARKVISION_RULES,
    WATER_BREATHING_RULES,
    TRAITS,
    CAT_APPEARANCES,
    DEFINITIONS,
    list,
    get,
    resolve,
    resolveSkill,
    firebasePayload,
    firebaseSkillPayload,
  });

  global.LuminousBeastCr0UnitCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
