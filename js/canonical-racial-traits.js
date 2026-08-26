(function (global) {
  "use strict";

  if (global.LuminousCanonicalRacialTraits) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCanonicalRacialTraits;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const sharedSource = Object.freeze({ type: "special", id: "shared" });
  const raceSource = (id) => Object.freeze({ type: "race", id });

  let baseCatalog = null;
  let traitEngine = null;
  let installedCatalog = null;

  function loadBase() {
    if (global.LuminousRacialTraitCatalog && !global.LuminousRacialTraitCatalog.__canonicalRacialTraits) baseCatalog = global.LuminousRacialTraitCatalog;
    if (!baseCatalog && typeof require === "function") {
      try { baseCatalog = require("./racial-trait-catalog.js"); } catch (_) {}
    }
    return baseCatalog;
  }

  function loadEngine() {
    traitEngine = global.LuminousTraitEngine || traitEngine;
    if (!traitEngine && typeof require === "function") {
      try { traitEngine = require("./trait-engine.js"); } catch (_) {}
    }
    return traitEngine;
  }

  function descriptive(id, name, sourceId, description, options = {}) {
    return {
      schemaVersion: 1,
      id,
      name,
      description,
      source: options.shared ? sharedSource : raceSource(sourceId),
      contexts: options.contexts || ["any"],
      activation: options.activation || { type: "passive", actionCost: "none" },
      effects: options.effects || [],
      rules: options.rules || [],
    };
  }

  function threshold(id, name, sourceId, description, conditions, value = -4, options = {}) {
    return descriptive(id, name, sourceId, description, {
      ...options,
      contexts: ["theatre"],
      effects: [{
        id: `${id}_check`,
        contexts: ["theatre"],
        trigger: "before_check",
        conditions,
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value }],
      }],
    });
  }

  const DEFINITIONS = Object.freeze({
    dwarven_resilience: threshold(
      "dwarven_resilience",
      "Dwarven Resilience",
      "dwarf",
      "Conditional Poisoned-related CON Checks reduce Threshold by 4.\n\nTake Half Damage from Poison.",
      [
        { path: "check.abilityId", operator: "eq", value: "con" },
        { any: [
          { path: "check.effectTag", operator: "eq", value: "poisoned" },
          { path: "check.tags", operator: "contains", value: "poisoned" },
        ] },
      ],
    ),
    stonecunning: threshold(
      "stonecunning",
      "Stonecunning",
      "dwarf",
      "Condicional History Checks related to stonework, masonry, stone structures, or stone architecture reduce Threshold by 4.",
      [
        { path: "check.skillId", operator: "eq", value: "history" },
        { any: [
          { path: "check.tags", operator: "contains", value: "stonework" },
          { path: "check.tags", operator: "contains", value: "masonry" },
          { path: "check.tags", operator: "contains", value: "stone_structure" },
          { path: "check.tags", operator: "contains", value: "stone_architecture" },
        ] },
      ],
    ),
    dwarven_combat_training: descriptive(
      "dwarven_combat_training",
      "Dwarven Combat Training",
      "dwarf",
      "Gain +(Proficiency/2 Rounded Down) Offensive Level with Battle-axe, Handaxe, Light Hammer & Warhammer.",
      {
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "offensive_level", mode: "add", formula: "floor(Proficiency / 2)",
          conditions: [{ any: [
            { path: "skill.weaponId", operator: "in", value: ["battleaxe", "handaxe", "light_hammer", "warhammer"] },
            { path: "skill.tags", operator: "contains", value: "dwarven_combat_training" },
          ] }],
        }],
      },
    ),
    tool_proficiency: descriptive(
      "tool_proficiency",
      "Tool Proficiency",
      "dwarf",
      "Choose one:\nSmith's Tools, Brewer's Supplies, or Mason's Tools.",
    ),
    heavy_armor_movement: descriptive(
      "heavy_armor_movement",
      "Heavy Armor Movement",
      "dwarf",
      "Heavy Armors don't reduce your Speed.",
      {
        contexts: ["combat"],
        rules: [{
          type: "speed_override", trigger: "passive", target: "self", action: "ignore_halving",
          conditions: [{ any: [
            { path: "self.armor.category", operator: "eq", value: "heavy" },
            { path: "self.armorType", operator: "eq", value: "heavy" },
          ] }],
        }],
      },
    ),
    dwarven_toughness: descriptive(
      "dwarven_toughness",
      "Dwarven Toughness",
      "dwarf",
      "Your Max HP increases by 2.\n\nEvery 5 levels, Gain +2 Max HP.",
    ),
    dwarven_armor_training: descriptive(
      "dwarven_armor_training",
      "Dwarven Armor Training",
      "dwarf",
      "Gain +(Proficiency/2 Rounded Down) Defensive Level with Light Armor and Medium Armor.",
    ),
    duergar_resilience: threshold(
      "duergar_resilience",
      "Duergar Resilience",
      "dwarf",
      "Conditional Checks against Illusion, Charmed, or Paralyzed reduce Threshold by 4.",
      [{ any: [
        { path: "check.effectTag", operator: "in", value: ["illusion", "charmed", "paralyzed"] },
        { path: "check.tags", operator: "contains", value: "illusion" },
        { path: "check.tags", operator: "contains", value: "charmed" },
        { path: "check.tags", operator: "contains", value: "paralyzed" },
      ] }],
    ),
    duergar_magic: descriptive(
      "duergar_magic",
      "Duergar Magic",
      "dwarf",
      "At Level 15, gain Enlarge on Self once per Long Rest.\n\nAt Level 25, gain Invisibility on Self once per Long Rest.",
    ),
    superior_darkvision: descriptive(
      "superior_darkvision",
      "Superior Darkvision",
      "shared",
      "On Encounters With Darkness, Gain +1 Clash Power.",
      {
        shared: true,
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 1,
          conditions: [{ any: [
            { path: "environment.tags", operator: "contains", value: "darkness" },
            { path: "environmentTags", operator: "contains", value: "darkness" },
          ] }],
        }],
      },
    ),
    sunlight_sensitivity: descriptive(
      "sunlight_sensitivity",
      "Sunlight Sensitivity",
      "shared",
      "Conditional sight-based Perception Checks while on direct sunlight increase Threshold by 4.\n\nWhile on Sunlight Clash Power -4.",
      {
        shared: true,
        contexts: ["combat", "theatre"],
        effects: [{
          id: "sunlight_sensitivity_perception",
          contexts: ["theatre"],
          trigger: "before_check",
          conditions: [
            { path: "check.skillId", operator: "eq", value: "perception" },
            { path: "check.senses", operator: "contains", value: "sight" },
            { any: [
              { path: "check.environmentTags", operator: "contains", value: "sunlight" },
              { path: "check.environmentTags", operator: "contains", value: "direct_sunlight" },
            ] },
          ],
          operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: 4 }],
        }],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: -4,
          conditions: [{ any: [
            { path: "environment.tags", operator: "contains", value: "sunlight" },
            { path: "environmentTags", operator: "contains", value: "sunlight" },
          ] }],
        }],
      },
    ),

    keen_senses: descriptive("keen_senses", "Keen Senses", "elf", "Gain Proficiency in Perception."),
    fey_ancestry: threshold(
      "fey_ancestry",
      "Fey Ancestry",
      "shared",
      "Checks against Charmed reduce Threshold by 4.\n\nSleep From inflicted by Spells is not applied.",
      [{ any: [
        { path: "check.effectTag", operator: "eq", value: "charmed" },
        { path: "check.tags", operator: "contains", value: "charmed" },
      ] }],
      -4,
      { shared: true },
    ),
    trance: descriptive("trance", "Trance", "elf", "Long Rest takes 4 Hours."),
    elf_weapon_training: descriptive(
      "elf_weapon_training", "Elf Weapon Training", "elf",
      "Gain +(Proficiency/2 Rounded Down) Offensive Level with Longsword, Shortsword, Shortbow & Longbow.",
      {
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "offensive_level", mode: "add", formula: "floor(Proficiency / 2)",
          conditions: [{ any: [
            { path: "skill.weaponId", operator: "in", value: ["longsword", "shortsword", "shortbow", "longbow"] },
            { path: "skill.tags", operator: "contains", value: "elf_weapon_training" },
          ] }],
        }],
      },
    ),
    cantrip: descriptive("cantrip", "Cantrip", "elf", "Gain one Cantrip from the Wizard Spell List."),
    extra_language: descriptive("extra_language", "Extra Language", "elf", "Gain one Language of your choice."),
    mask_of_the_wild: descriptive(
      "mask_of_the_wild",
      "Mask of the Wild",
      "elf",
      "Gain +1 Clash Power with Rain, Fog & Snow\n\nCan Use Retreat - Hidden with Forest Environment & Rain, Fog & Snow Environment effects",
      {
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 1,
          conditions: [{ any: [
            { path: "environmentTags", operator: "contains", value: "rain" },
            { path: "environmentTags", operator: "contains", value: "fog" },
            { path: "environmentTags", operator: "contains", value: "snow" },
            { path: "environment.tags", operator: "contains", value: "rain" },
            { path: "environment.tags", operator: "contains", value: "fog" },
            { path: "environment.tags", operator: "contains", value: "snow" },
          ] }],
        }],
      },
    ),
    drow_magic: descriptive(
      "drow_magic",
      "Drow Magic",
      "elf",
      "At Level 5, gain Dancing Lights.\n\nAt Level 15, gain Faerie Fire once per Long Rest.\n\nAt Level 25, gain Darkness once per Long Rest.\n\nCharisma is your Spellcasting Ability for these Spells.",
    ),
    drow_weapon_training: descriptive(
      "drow_weapon_training", "Drow Weapon Training", "elf",
      "Gain +(Proficiency/2 Rounded Down) Offensive Level with Rapier, Shortsword & Hand Crossbow.",
      {
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "offensive_level", mode: "add", formula: "floor(Proficiency / 2)",
          conditions: [{ any: [
            { path: "skill.weaponId", operator: "in", value: ["rapier", "shortsword", "hand_crossbow"] },
            { path: "skill.tags", operator: "contains", value: "drow_weapon_training" },
          ] }],
        }],
      },
    ),
    sea_elf_training: descriptive(
      "sea_elf_training", "Sea Elf Training", "elf",
      "Gain +(Proficiency/2 Rounded Down) Offensive Level with Spear, Trident, Light Crossbow & Net.",
      {
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "offensive_level", mode: "add", formula: "floor(Proficiency / 2)",
          conditions: [{ any: [
            { path: "skill.weaponId", operator: "in", value: ["spear", "trident", "light_crossbow", "net"] },
            { path: "skill.tags", operator: "contains", value: "sea_elf_training" },
          ] }],
        }],
      },
    ),
    fey_step: descriptive(
      "fey_step", "Fey Step", "elf",
      "Once per Short Rest, as a Quick Action, Use Retreat - Fey Step\n\nAt Level 15, Fey Step gains an additional effect based on your current Season.\n\nRetreat - Fey Step\nOn Comeback heal 5 SP and gain +2 Clash Power Up",
      { contexts: ["combat"], activation: { type: "manual", actionCost: "quick_action", uses: { max: 1, reset: "short_rest" } }, effects: [{ id: "fey_step_request", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "log", message: "Use Retreat - Fey Step." }] }] },
    ),
    eladrin_autumn: descriptive("eladrin_autumn", "Autumn", "elf", "After using Fey Step, the 2 Slowest Allies gain +1 Clash Power Up."),
    eladrin_winter: descriptive("eladrin_winter", "Winter", "elf", "After using Fey Step, the Slowest Ally gain +2 Protection."),
    eladrin_spring: descriptive("eladrin_spring", "Spring", "elf", "You can Choose to Apply Retreat - Fey Step to an Ally Unit."),
    eladrin_summer: descriptive("eladrin_summer", "Summer", "elf", "After using Fey Step, Apply +2 Burn County to all Enemies Deployed."),
    necrotic_resistance: descriptive("necrotic_resistance", "Necrotic Resistance", "elf", "Take Half Damage from Necrotic."),
    blessing_of_the_raven_queen: descriptive(
      "blessing_of_the_raven_queen",
      "Blessing of the Raven Queen",
      "elf",
      "Once per Long Rest, as a Quick Action, Use Retreat - Raven Queen.\n\nRetreat - Raven Queen\nOn Comeback Gain +2 Defense Power Up\nAt Level 15, On Comeback gain +5 Protection.",
      { contexts: ["combat"], activation: { type: "manual", actionCost: "quick_action", uses: { max: 1, reset: "long_rest" } }, effects: [{ id: "raven_queen_request", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "log", message: "Use Retreat - Raven Queen." }] }] },
    ),

    brave: threshold(
      "brave",
      "Brave",
      "halfling",
      "Checks against Frightened reduce Threshold by 4.\n\nReduce by 1 SP damage taken",
      [{ any: [
        { path: "check.effectTag", operator: "eq", value: "frightened" },
        { path: "check.tags", operator: "contains", value: "frightened" },
      ] }],
    ),
    lucky: descriptive(
      "lucky",
      "Lucky",
      "halfling",
      "On Fail Check retry once\n\nCan use this trait (Proficiency) times per long rest.",
      {
        contexts: ["theatre"],
        activation: {
          type: "prompt", actionCost: "none", uses: { formula: "Proficiency", reset: "long_rest" },
          conditions: [{ any: [
            { path: "check.failed", operator: "truthy" },
            { path: "check.passed", operator: "eq", value: false },
          ] }],
        },
        effects: [{ id: "lucky_retry", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "log", message: "Retry the failed Check once." }] }],
      },
    ),
    halfling_nimbleness: descriptive(
      "halfling_nimbleness",
      "Halfling Nimbleness",
      "halfling",
      "Gain +2 Evasion power against a Bigger size attacker.",
      {
        contexts: ["combat"],
        rules: [{
          type: "modifier", trigger: "passive", target: "self", channel: "evade_power", mode: "add", value: 2,
          conditions: [
            { path: "skill.type", operator: "eq", value: "evade" },
            { path: "target.size", operator: "in", value: ["medium", "large", "huge", "gargantuan"] },
          ],
        }],
      },
    ),
    naturally_stealthy: descriptive("naturally_stealthy", "Naturally Stealthy", "halfling", "Can Use Retreat - Hidden while a Bigger Size Ally Unit is Deployed."),
    stout_resilience: threshold(
      "stout_resilience",
      "Stout Resilience",
      "halfling",
      "Conditional Poisoned-related CON Checks reduce Threshold by 4.\n\nTake Half Damage from Poison.",
      [
        { path: "check.abilityId", operator: "eq", value: "con" },
        { any: [
          { path: "check.effectTag", operator: "eq", value: "poisoned" },
          { path: "check.tags", operator: "contains", value: "poisoned" },
        ] },
      ],
    ),

    gnome_cunning: threshold(
      "gnome_cunning",
      "Gnome Cunning",
      "gnome",
      "Conditional INT, WIS, or CHA Save Checks against Spells or Magical Effects reduce Threshold by 4.",
      [
        { path: "check.kind", operator: "eq", value: "save" },
        { path: "check.abilityId", operator: "in", value: ["int", "wis", "cha"] },
        { any: [
          { path: "check.isMagical", operator: "truthy" },
          { path: "check.tags", operator: "contains", value: "spell" },
          { path: "check.tags", operator: "contains", value: "magical_effect" },
        ] },
      ],
    ),
    speak_with_small_beasts: descriptive(
      "speak_with_small_beasts",
      "Speak with Small Beasts",
      "gnome",
      "You can communicate simple ideas with Small or smaller Beasts through sounds and gestures.",
    ),
    artificers_lore: threshold(
      "artificers_lore",
      "Artificer's Lore",
      "gnome",
      "Magic Items, Alchemical Objects, or Technological Devices reduce craft Threshold by 4.",
      [
        { any: [
          { path: "check.actionId", operator: "eq", value: "craft" },
          { path: "check.tags", operator: "contains", value: "craft" },
        ] },
        { any: [
          { path: "check.tags", operator: "contains", value: "magic_item" },
          { path: "check.tags", operator: "contains", value: "alchemical_object" },
          { path: "check.tags", operator: "contains", value: "technological_device" },
        ] },
      ],
    ),
    tinker: descriptive(
      "tinker",
      "Tinker",
      "gnome",
      "Using Tinker's Tools, you can craft simple Tiny mechanical devices such as Clockwork Toys, Fire Starters, or Music Boxes.\n\nYou can maintain up to 3 Tinker Devices at the same time.",
    ),

    relentless_endurance: descriptive(
      "relentless_endurance",
      "Relentless Endurance",
      "half_orc",
      "When your HP would be reduced to 0, recover 10% of Max HP.\n\nOnce per Long Rest.",
      {
        contexts: ["combat"],
        activation: {
          type: "prompt", actionCost: "none", uses: { max: 1, reset: "long_rest" },
          conditions: [{ any: [
            { path: "self.hp", operator: "lte", value: 0 },
            { path: "self.currentHp", operator: "lte", value: 0 },
          ] }],
        },
        effects: [{
          id: "relentless_endurance_recover",
          contexts: ["combat"],
          trigger: "on_use",
          conditions: [],
          operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", formula: "floor(MaxHP * 10 / 100)" }],
        }],
      },
    ),
    savage_attacks: descriptive(
      "savage_attacks",
      "Savage Attacks",
      "half_orc",
      "Deal +5% Crit Damage",
      {
        contexts: ["combat"],
        effects: [{
          id: "savage_attacks_crit_damage",
          contexts: ["combat"],
          trigger: "on_crit",
          conditions: [],
          operations: [{ type: "modify", path: "damage.amount", mode: "multiply", value: 1.05 }],
        }],
      },
    ),
    aggressive: descriptive(
      "aggressive",
      "Aggressive",
      "orc",
      "As quick action gain +2 speed this turn\n\nOnce per turn",
      {
        contexts: ["combat"],
        activation: { type: "manual", actionCost: "quick_action", uses: { max: 1, reset: "turn" } },
        effects: [{ id: "aggressive_speed_request", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "log", message: "Gain +2 speed this turn." }] }],
      },
    ),
  });

  const MANIFEST = Object.freeze({
    dwarf: Object.freeze({
      base: Object.freeze(["dwarven_resilience", "stonecunning", "dwarven_combat_training", "tool_proficiency", "heavy_armor_movement"]),
      hill: Object.freeze(["dwarven_toughness"]),
      mountain: Object.freeze(["dwarven_armor_training"]),
      duergar: Object.freeze(["duergar_resilience", "duergar_magic", "sunlight_sensitivity", "superior_darkvision"]),
    }),
    elf: Object.freeze({
      base: Object.freeze(["keen_senses", "fey_ancestry", "trance"]),
      high: Object.freeze(["elf_weapon_training", "cantrip", "extra_language"]),
      wood: Object.freeze(["mask_of_the_wild"]),
      drow: Object.freeze(["superior_darkvision", "sunlight_sensitivity", "drow_magic", "drow_weapon_training"]),
      sea: Object.freeze(["sea_elf_training"]),
      eladrin: Object.freeze(["fey_step", "eladrin_autumn", "eladrin_winter", "eladrin_spring", "eladrin_summer"]),
      shadar_kai: Object.freeze(["necrotic_resistance", "blessing_of_the_raven_queen"]),
    }),
    halfling: Object.freeze({
      base: Object.freeze(["brave", "lucky", "halfling_nimbleness"]),
      lightfoot: Object.freeze(["naturally_stealthy"]),
      stout: Object.freeze(["stout_resilience"]),
    }),
    dragonborn: Object.freeze({ base: Object.freeze([]) }),
    gnome: Object.freeze({
      base: Object.freeze(["gnome_cunning"]),
      forest: Object.freeze(["speak_with_small_beasts"]),
      rock: Object.freeze(["artificers_lore", "tinker"]),
    }),
    half_elf: Object.freeze({ base: Object.freeze(["fey_ancestry"]) }),
    half_orc: Object.freeze({ base: Object.freeze(["relentless_endurance", "savage_attacks"]) }),
    orc: Object.freeze({ base: Object.freeze(["aggressive"]) }),
  });

  const NON_TRAIT_FEATURES = Object.freeze({
    dwarf: Object.freeze(["darkvision", "languages", "movement_25"]),
    elf: Object.freeze(["darkvision", "languages", "subrace_speed_and_capabilities"]),
    halfling: Object.freeze(["size", "languages", "movement_25"]),
    dragonborn: Object.freeze(["draconic_ancestry", "dragon_breath_dynamic_skill", "ancestry_resistance", "languages"]),
    gnome: Object.freeze(["darkvision", "languages", "forest_minor_illusion_spell_grant"]),
    half_elf: Object.freeze(["darkvision", "skill_versatility", "languages", "ability_score_choices"]),
    half_orc: Object.freeze(["darkvision", "menacing_proficiency", "languages"]),
    orc: Object.freeze(["darkvision", "menacing_proficiency", "powerful_build", "languages"]),
  });

  function raceGrant(sourceId, traitId, options = {}) {
    return {
      id: `core_race_${sourceId}${options.sourceSubtypeId ? `_${options.sourceSubtypeId}` : ""}_${traitId}`,
      sourceType: "race",
      sourceId,
      ...(options.sourceSubtypeId ? { sourceSubtypeId: options.sourceSubtypeId } : {}),
      traitId,
      grantType: "trait",
    };
  }

  function grantsFromManifest(manifest) {
    const grants = [];
    Object.entries(manifest || {}).forEach(([raceId, packageDef]) => {
      (packageDef.base || []).forEach((traitId) => grants.push(raceGrant(raceId, traitId)));
      Object.entries(packageDef || {}).forEach(([subtypeId, traitIds]) => {
        if (subtypeId === "base") return;
        (traitIds || []).forEach((traitId) => grants.push(raceGrant(raceId, traitId, { sourceSubtypeId: subtypeId })));
      });
    });
    return grants;
  }

  function install(base = loadBase(), engine = loadEngine()) {
    if (!base || !engine) return null;
    if (base.__canonicalRacialTraits) {
      installedCatalog = base;
      return base;
    }

    const definitions = Object.freeze({ ...(base.DEFINITIONS || {}), ...DEFINITIONS });
    const manifest = Object.freeze({ ...(base.RACE_TRAIT_MANIFEST || {}), ...MANIFEST });
    const nonTraits = Object.freeze({ ...(base.NON_TRAIT_FEATURES || {}), ...NON_TRAIT_FEATURES });
    const grants = Object.freeze(grantsFromManifest(manifest));

    function grantMatches(characterInput, grant) {
      const build = characterInput?.characterBuild && typeof characterInput.characterBuild === "object" ? characterInput.characterBuild : {};
      const raceId = normalizeId(build.raceId ?? characterInput?.raceId ?? characterInput?.race?.id);
      const subtypeId = normalizeId(build.raceSubtypeId ?? characterInput?.raceSubtypeId ?? characterInput?.race?.subtypeId);
      if (normalizeId(grant.sourceType) !== "race") return false;
      if (raceId !== normalizeId(grant.sourceId)) return false;
      if (grant.sourceSubtypeId && subtypeId !== normalizeId(grant.sourceSubtypeId)) return false;
      return true;
    }

    function resolveTraitGrants(character, catalog = definitions) {
      const byId = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}).map(([id, definition]) => [normalizeId(id), definition]));
      return grants.filter((grant) => grantMatches(character, grant)).map((grant) => {
        const definition = byId.get(normalizeId(grant.traitId));
        if (!definition) return null;
        const trait = engine.normalizeTrait ? engine.normalizeTrait(definition) : clone(definition);
        trait.source = {
          ...(trait.source || {}),
          type: "race",
          id: normalizeId(grant.sourceId),
          ...(grant.sourceSubtypeId ? { subtypeId: normalizeId(grant.sourceSubtypeId) } : {}),
        };
        return trait;
      }).filter(Boolean);
    }

    function validateAll(customEngine = engine) {
      const errors = [];
      const warnings = [];
      if (!customEngine?.validateTrait) return { valid: false, errors: ["Trait Engine is not available."], warnings };
      Object.entries(definitions).forEach(([id, definition]) => {
        const result = customEngine.validateTrait(definition);
        if (!result.valid) result.errors.forEach((error) => errors.push(`${id}: ${error}`));
        (result.warnings || []).forEach((warning) => warnings.push(`${id}: ${warning}`));
      });
      Object.entries(manifest).forEach(([raceId, packageDef]) => {
        Object.entries(packageDef || {}).forEach(([subtypeId, traitIds]) => {
          (traitIds || []).forEach((traitId) => {
            if (!definitions[traitId]) errors.push(`${raceId}/${subtypeId}: missing Trait ${traitId}`);
          });
        });
      });
      return { valid: errors.length === 0, errors, warnings };
    }

    const api = Object.freeze({
      ...base,
      __canonicalRacialTraits: true,
      DEFINITIONS: definitions,
      GRANTS: grants,
      RACE_TRAIT_MANIFEST: manifest,
      NON_TRAIT_FEATURES: nonTraits,
      allDefinitions: () => clone(definitions),
      allGrants: () => clone(grants),
      getDefinition: (id) => clone(definitions[normalizeId(id)] || null),
      grantMatches,
      resolveTraitGrants,
      validateAll,
    });

    installedCatalog = api;
    global.LuminousRacialTraitCatalog = api;
    return api;
  }

  const api = Object.freeze({
    DEFINITIONS,
    MANIFEST,
    NON_TRAIT_FEATURES,
    install,
    get catalog() { return installedCatalog; },
  });

  global.LuminousCanonicalRacialTraits = api;
  install();
  if (global.document && typeof global.setInterval === "function") {
    const retry = global.setInterval(() => {
      if (install()) global.clearInterval(retry);
    }, 100);
    global.setTimeout(() => global.clearInterval(retry), 10000);
  }

  if (typeof module !== "undefined" && module.exports) {
    install();
    module.exports = global.LuminousRacialTraitCatalog || api;
  }
})(typeof window !== "undefined" ? window : globalThis);
