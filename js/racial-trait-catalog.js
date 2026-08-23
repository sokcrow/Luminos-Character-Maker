(function (global) {
  "use strict";

  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const CATALOG_VERSION = 1;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const raceSource = (id) => Object.freeze({ type: "race", id });

  const DEFINITIONS = deepFreeze({
    pack_tactics: {
      schemaVersion: 1,
      id: "pack_tactics",
      name: "Pack Tactics",
      description: "On the first attack each Turn, if the target is already Targeted by an Ally, gain +1 Final Power.",
      source: { type: "special", id: "shared" },
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "before_attack",
        target: "self",
        path: "skill.finalPower",
        mode: "add",
        value: 1,
        scope: "once_per_turn",
        conditions: [{ path: "targetedByAlly", operator: "truthy" }],
      }],
    },

    keen_hearing: {
      schemaVersion: 1,
      id: "keen_hearing",
      name: "Keen Hearing",
      description: "Sound-based Perception checks reduce Threshold by 4.",
      source: { type: "special", id: "shared" },
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "keen_hearing_perception",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "perception" },
          { path: "check.senses", operator: "contains", value: "hearing" },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    keen_hearing_and_smell: {
      schemaVersion: 1,
      id: "keen_hearing_and_smell",
      name: "Keen Hearing and Smell",
      description: "Perception checks based on hearing or smell reduce Threshold by 4.",
      source: { type: "special", id: "shared" },
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "keen_hearing_smell_perception",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "perception" },
          { any: [
            { path: "check.senses", operator: "contains", value: "hearing" },
            { path: "check.senses", operator: "contains", value: "smell" },
          ] },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    lizalin_natural_armor: {
      schemaVersion: 1,
      id: "lizalin_natural_armor",
      name: "Natural Armor",
      description: "Gain +1 Defensive Level.",
      source: raceSource("lizalin"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "defensive_level", mode: "add", value: 1 }],
    },

    kobold_burrow_mentality: {
      schemaVersion: 1,
      id: "kobold_burrow_mentality",
      name: "Burrow Mentality",
      description: "History and Survival checks related to tunnels, caverns, or underground structures reduce Threshold by 4.",
      source: raceSource("kobold"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "kobold_burrow_mentality_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "in", value: ["history", "survival"] },
          { any: [
            { path: "check.environmentTags", operator: "contains", value: "underground" },
            { path: "check.environmentTags", operator: "contains", value: "tunnel" },
            { path: "check.environmentTags", operator: "contains", value: "cavern" },
          ] },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    kenku_expert_forger: {
      schemaVersion: 1,
      id: "kenku_expert_forger",
      name: "Expert Forger",
      description: "Forgery checks reduce Threshold by 1.",
      source: raceSource("kenku"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "kenku_forgery_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ any: [
          { path: "check.skillId", operator: "eq", value: "forgery" },
          { path: "check.tags", operator: "contains", value: "forgery" },
        ] }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -1 }],
      }],
      rules: [],
    },

    kenku_limited_communication: {
      schemaVersion: 1,
      id: "kenku_limited_communication",
      name: "Limited Communication",
      description: "For verbal communication, Persuasion Threshold +1 and Deception Threshold -1.",
      source: raceSource("kenku"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [
        {
          id: "kenku_verbal_persuasion",
          contexts: ["theatre"],
          trigger: "before_check",
          conditions: [
            { path: "check.skillId", operator: "eq", value: "persuasion" },
            { path: "check.communicationMode", operator: "eq", value: "verbal" },
          ],
          operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: 1 }],
        },
        {
          id: "kenku_verbal_deception",
          contexts: ["theatre"],
          trigger: "before_check",
          conditions: [
            { path: "check.skillId", operator: "eq", value: "deception" },
            { path: "check.communicationMode", operator: "eq", value: "verbal" },
          ],
          operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -1 }],
        },
      ],
      rules: [],
    },

    goliath_stone_endurance: {
      schemaVersion: 1,
      id: "goliath_stone_endurance",
      name: "Stone's Endurance",
      description: "When damage is taken, reduce incoming damage by Constitution Mod.",
      source: raceSource("goliath"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "goliath_stone_endurance_damage",
        contexts: ["combat"],
        trigger: "damage_taken",
        conditions: [],
        operations: [{ type: "modify", path: "damage.amount", mode: "add", formula: "-max(0, ConstitutionMod)" }],
      }],
      rules: [],
    },

    goblin_nimble_escape: {
      schemaVersion: 1,
      id: "goblin_nimble_escape",
      name: "Nimble Escape",
      description: "Evade Skills gain +1 Final Power.",
      source: raceSource("goblin"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "final_power",
        mode: "add",
        value: 1,
        conditions: [{ path: "skill.type", operator: "eq", value: "evade" }],
      }],
    },

    warforged_reinforced_body: {
      schemaVersion: 1,
      id: "warforged_reinforced_body",
      name: "Reinforced Body",
      description: "Gain +1 Defensive Level.",
      source: raceSource("warforged"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "defensive_level", mode: "add", value: 1 }],
    },

    warforged_lone_reconnaissance: {
      schemaVersion: 1,
      id: "warforged_lone_reconnaissance",
      name: "Lone Reconnaissance",
      description: "When no allies are present, Stealth checks reduce Threshold by 4.",
      source: raceSource("warforged"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "warforged_lone_stealth",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "stealth" },
          { formula: "AliveAllies", operator: "eq", value: 0 },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    feline_reflexes: {
      schemaVersion: 1,
      id: "feline_reflexes",
      name: "Feline Reflexes",
      description: "Gain floor(Proficiency / 2) Max Speed and Proficiency Final Power on Evade Skills.",
      source: raceSource("felinae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", formula: "floor(Proficiency / 2)" },
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "final_power",
          mode: "add",
          formula: "Proficiency",
          conditions: [{ path: "skill.type", operator: "eq", value: "evade" }],
        },
      ],
    },

    felinae_light_footed: {
      schemaVersion: 1,
      id: "felinae_light_footed",
      name: "Light-Footed",
      description: "40 ft racial movement converts to +2 Max Speed.",
      source: raceSource("felinae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 2 }],
    },

    half_dragon_indomitable: {
      schemaVersion: 1,
      id: "half_dragon_indomitable",
      name: "Indomitable",
      description: "Checks against Charmed or Frightened reduce Threshold by 4.",
      source: raceSource("half_dragon"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "half_dragon_indomitable_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.effectTag", operator: "in", value: ["charmed", "frightened"] }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    half_dragon_desert_predator: {
      schemaVersion: 1,
      id: "half_dragon_desert_predator",
      name: "Desert Predator",
      description: "Stealth checks in sand or loose earth reduce Threshold by 4.",
      source: raceSource("half_dragon"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "half_dragon_desert_stealth",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "stealth" },
          { any: [
            { path: "check.environmentTags", operator: "contains", value: "sand" },
            { path: "check.environmentTags", operator: "contains", value: "loose_earth" },
            { path: "check.environmentTags", operator: "contains", value: "burrowable_ground" },
          ] },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    half_dragon_bold_speaker: {
      schemaVersion: 1,
      id: "half_dragon_bold_speaker",
      name: "Bold Speaker",
      description: "Persuasion checks reduce Threshold by 4. Magical Sleep immunity is handled by race capability/status immunity logic.",
      source: raceSource("half_dragon"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "half_dragon_bold_persuasion",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.skillId", operator: "eq", value: "persuasion" }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    lupae_canis_toughness: {
      schemaVersion: 1,
      id: "lupae_canis_toughness",
      name: "Canis Toughness",
      description: "Checks against Disease or Poison reduce Threshold by 4.",
      source: raceSource("lupae"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "lupae_canis_toughness_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.effectTag", operator: "in", value: ["disease", "poison"] }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    moonfae_intimidating_presence: {
      schemaVersion: 1,
      id: "moonfae_intimidating_presence",
      name: "Intimidating Presence",
      description: "Checks against Frightened reduce Threshold by 4. Intimidation proficiency is stored as racial metadata.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "moonfae_frightened_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.effectTag", operator: "eq", value: "frightened" }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    moonfae_lunge: {
      schemaVersion: 1,
      id: "moonfae_lunge",
      name: "Lunge",
      description: "If no damage was taken during the previous Turn, gain +2 Clash Power when attacking.",
      source: raceSource("moonfae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "before_attack",
        target: "self",
        path: "skill.clashPower",
        mode: "add",
        value: 2,
        conditions: [{ path: "self.took_damage_last_turn", operator: "falsy" }],
      }],
    },

    moonfae_crescent_speed: {
      schemaVersion: 1,
      id: "moonfae_crescent_speed",
      name: "Fast",
      description: "35 ft racial movement converts to +1 Max Speed.",
      source: raceSource("moonfae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 1 }],
    },

    moonfae_agile_escape: {
      schemaVersion: 1,
      id: "moonfae_agile_escape",
      name: "Agile Escape",
      description: "Evade Skills gain +2 Final Power.",
      source: raceSource("moonfae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "final_power",
        mode: "add",
        value: 2,
        conditions: [{ path: "skill.type", operator: "eq", value: "evade" }],
      }],
    },

    moonfae_natural_talent: {
      schemaVersion: 1,
      id: "moonfae_natural_talent",
      name: "Natural Talent",
      description: "On a Dexterity Check, gain +2 Check Bonus. Uses equal Proficiency and recover on Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: {
        type: "prompt",
        actionCost: "none",
        uses: { formula: "Proficiency", reset: "long_rest" },
        conditions: [{ path: "check.abilityId", operator: "eq", value: "dex" }],
      },
      effects: [{
        id: "moonfae_natural_talent_check",
        contexts: ["theatre"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "modify", path: "check.finalPower", mode: "add", value: 2 }],
      }],
      rules: [],
    },

    moonfae_cautious_senses: {
      schemaVersion: 1,
      id: "moonfae_cautious_senses",
      name: "Cautious Senses",
      description: "At Turn Start gain +2 Haste.",
      source: raceSource("moonfae"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "moonfae_cautious_senses_haste",
        contexts: ["combat"],
        trigger: "turn_start",
        conditions: [],
        operations: [{ type: "apply_status", statusId: "haste", count: 2, duration: "this_turn" }],
      }],
      rules: [],
    },

    moonfae_rabbits_luck: {
      schemaVersion: 1,
      id: "moonfae_rabbits_luck",
      name: "Rabbit's Luck",
      description: "Reduce the active Check Threshold by 4. Uses equal Proficiency and recover on Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: {
        type: "prompt",
        actionCost: "none",
        uses: { formula: "Proficiency", reset: "long_rest" },
      },
      effects: [{
        id: "moonfae_rabbits_luck_check",
        contexts: ["theatre"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    moonfae_favorable_action: {
      schemaVersion: 1,
      id: "moonfae_favorable_action",
      name: "Favorable Action",
      description: "Add Charisma Mod to the active Check. Uses equal Proficiency and recover on Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: {
        type: "prompt",
        actionCost: "none",
        uses: { formula: "Proficiency", reset: "long_rest" },
      },
      effects: [{
        id: "moonfae_favorable_action_check",
        contexts: ["theatre"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "modify", path: "check.finalPower", mode: "add", formula: "CharismaMod" }],
      }],
      rules: [],
    },

    yuan_ti_magic_resistance: {
      schemaVersion: 1,
      id: "yuan_ti_magic_resistance",
      name: "Magic Resistance",
      description: "Checks against Spells or Magical Effects reduce Threshold by 4.",
      source: raceSource("yuan_ti_pureblood"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "yuan_ti_magic_resistance_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.isMagical", operator: "truthy" }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    yuan_ti_wrath_affinity: sinAffinityTrait("yuan_ti_wrath_affinity", "Wrath", "Red Eyes — Wrath"),
    yuan_ti_envy_affinity: sinAffinityTrait("yuan_ti_envy_affinity", "Envy", "Purple Eyes — Envy"),
    yuan_ti_gloom_affinity: sinAffinityTrait("yuan_ti_gloom_affinity", "Gloom", "Cyan Eyes — Gloom"),
    yuan_ti_pride_affinity: sinAffinityTrait("yuan_ti_pride_affinity", "Pride", "Blue Eyes — Pride"),
    yuan_ti_gluttony_affinity: sinAffinityTrait("yuan_ti_gluttony_affinity", "Gluttony", "Green Eyes — Gluttony"),
    yuan_ti_lust_affinity: sinAffinityTrait("yuan_ti_lust_affinity", "Lust", "Orange Eyes — Lust"),
    yuan_ti_sloth_affinity: sinAffinityTrait("yuan_ti_sloth_affinity", "Sloth", "Yellow Eyes — Sloth"),

    yuan_ti_voracious_impulse: {
      schemaVersion: 1,
      id: "yuan_ti_voracious_impulse",
      name: "Voracious Impulse",
      description: "On Enemy Defeated, recover (5 + CHA Mod)% Max HP.",
      source: raceSource("yuan_ti_pureblood"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "yuan_ti_voracious_impulse_heal",
        contexts: ["combat"],
        trigger: "on_kill",
        conditions: [],
        operations: [{
          type: "heal_hp",
          path: "self.hp",
          maxPath: "self.maxHp",
          formula: "floor(MaxHP * (5 + CharismaMod) / 100)",
        }],
      }],
      rules: [],
    },

    undae_regeneration: {
      schemaVersion: 1,
      id: "undae_regeneration",
      name: "Undae Regeneration",
      description: "At Turn Start, if no Acid or Fire damage was taken during the previous Turn and HP is above 0, recover (10 + CON Mod)% Max HP.",
      source: raceSource("undae"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "undae_regeneration_heal",
        contexts: ["combat"],
        trigger: "turn_start",
        conditions: [
          { formula: "CurrentHP", operator: "gt", value: 0 },
          { path: "self.damageTakenPreviousTurnTypes", operator: "not_contains", value: "Acid" },
          { path: "self.damageTakenPreviousTurnTypes", operator: "not_contains", value: "Fire" },
        ],
        operations: [{
          type: "heal_hp",
          path: "self.hp",
          maxPath: "self.maxHp",
          formula: "floor(MaxHP * (10 + ConstitutionMod) / 100)",
        }],
      }],
      rules: [],
    },

    undae_thick_skin: {
      schemaVersion: 1,
      id: "undae_thick_skin",
      name: "Thick Skin",
      description: "Slashing damage taken is Halved.",
      source: raceSource("undae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "damage_taken_multiplier",
        mode: "add",
        value: 50,
        unit: "percent_reduction",
        conditions: [{ any: [
          { path: "skill.attackType", operator: "eq", value: "Slash" },
          { path: "skill.damageType", operator: "eq", value: "Slash" },
        ] }],
      }],
    },

    undae_stable_step: {
      schemaVersion: 1,
      id: "undae_stable_step",
      name: "Stable Step",
      description: "Checks to resist Knockdown or Forced Displacement reduce Threshold by 4.",
      source: raceSource("undae"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "undae_stable_step_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.effectTag", operator: "in", value: ["knockdown", "forced_displacement"] }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    undae_calming_presence: {
      schemaVersion: 1,
      id: "undae_calming_presence",
      name: "Calming Presence",
      description: "Persuasion checks against injured or frightened creatures reduce Threshold by 4.",
      source: raceSource("undae"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "undae_calming_presence_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "persuasion" },
          { any: [
            { path: "target.injured", operator: "truthy" },
            { path: "target.frightened", operator: "truthy" },
          ] },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    undae_silent_step: {
      schemaVersion: 1,
      id: "undae_silent_step",
      name: "Silent Step",
      description: "Stealth checks in natural terrain reduce Threshold by 4.",
      source: raceSource("undae"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "undae_silent_step_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "stealth" },
          { path: "check.environmentTags", operator: "contains", value: "natural" },
        ],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },
  });

  function sinAffinityTrait(id, affinity, name) {
    return {
      schemaVersion: 1,
      id,
      name,
      description: `Deal +(Level / 4)% ${affinity} Sin Damage.`,
      source: raceSource("yuan_ti_pureblood"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "damage_dealt_multiplier",
        mode: "add",
        formula: "Level / 4",
        unit: "percent",
        conditions: [{ any: [
          { path: "skill.affinity", operator: "eq", value: affinity },
          { path: "skill.sinAffinity", operator: "eq", value: affinity },
        ] }],
      }],
    };
  }

  const raceGrant = (sourceId, traitId, options = {}) => ({
    id: `core_race_${sourceId}${options.sourceSubtypeId ? `_${options.sourceSubtypeId}` : ""}${options.atLevel ? `_l${options.atLevel}` : ""}_${traitId}`,
    sourceType: "race",
    sourceId,
    ...(options.sourceSubtypeId ? { sourceSubtypeId: options.sourceSubtypeId } : {}),
    ...(options.atLevel ? { atLevel: options.atLevel } : {}),
    traitId,
    grantType: "trait",
  });

  const GRANTS = deepFreeze([
    raceGrant("lizalin", "lizalin_natural_armor"),
    raceGrant("kobold", "pack_tactics"),
    raceGrant("kobold", "kobold_burrow_mentality"),
    raceGrant("kenku", "kenku_expert_forger"),
    raceGrant("kenku", "kenku_limited_communication"),
    raceGrant("goliath", "goliath_stone_endurance"),
    raceGrant("goblin", "goblin_nimble_escape"),
    raceGrant("warforged", "warforged_reinforced_body", { sourceSubtypeId: "juggernaut" }),
    raceGrant("warforged", "warforged_lone_reconnaissance", { sourceSubtypeId: "skirmisher" }),
    raceGrant("felinae", "feline_reflexes"),
    raceGrant("felinae", "felinae_light_footed", { sourceSubtypeId: "ordinary" }),
    raceGrant("half_dragon", "half_dragon_indomitable", { sourceSubtypeId: "red" }),
    raceGrant("half_dragon", "half_dragon_desert_predator", { sourceSubtypeId: "blue" }),
    raceGrant("half_dragon", "half_dragon_bold_speaker", { sourceSubtypeId: "brass" }),
    raceGrant("lupae", "keen_hearing_and_smell"),
    raceGrant("lupae", "pack_tactics"),
    raceGrant("lupae", "lupae_canis_toughness"),
    raceGrant("moonfae", "keen_hearing"),
    raceGrant("moonfae", "moonfae_intimidating_presence", { sourceSubtypeId: "full_moon" }),
    raceGrant("moonfae", "moonfae_lunge", { sourceSubtypeId: "full_moon" }),
    raceGrant("moonfae", "moonfae_crescent_speed", { sourceSubtypeId: "crescent_moon" }),
    raceGrant("moonfae", "moonfae_agile_escape", { sourceSubtypeId: "crescent_moon" }),
    raceGrant("moonfae", "moonfae_natural_talent", { sourceSubtypeId: "crescent_moon" }),
    raceGrant("moonfae", "moonfae_cautious_senses", { sourceSubtypeId: "new_moon" }),
    raceGrant("moonfae", "moonfae_rabbits_luck", { sourceSubtypeId: "blue_moon" }),
    raceGrant("moonfae", "moonfae_favorable_action", { sourceSubtypeId: "blue_moon" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_magic_resistance"),
    raceGrant("yuan_ti_pureblood", "yuan_ti_wrath_affinity", { sourceSubtypeId: "red_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_envy_affinity", { sourceSubtypeId: "purple_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_gloom_affinity", { sourceSubtypeId: "cyan_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_pride_affinity", { sourceSubtypeId: "blue_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_gluttony_affinity", { sourceSubtypeId: "green_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_voracious_impulse", { sourceSubtypeId: "green_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_lust_affinity", { sourceSubtypeId: "orange_eyes" }),
    raceGrant("yuan_ti_pureblood", "yuan_ti_sloth_affinity", { sourceSubtypeId: "yellow_eyes" }),
    raceGrant("undae", "undae_regeneration"),
    raceGrant("undae", "undae_thick_skin", { sourceSubtypeId: "rock" }),
    raceGrant("undae", "undae_stable_step", { sourceSubtypeId: "rock" }),
    raceGrant("undae", "undae_calming_presence", { sourceSubtypeId: "mystic" }),
    raceGrant("undae", "undae_silent_step", { sourceSubtypeId: "wild" }),
  ]);

  const CAPABILITY_GRANTS = deepFreeze([
    { raceId: "fairy", capabilityId: "flight", conditions: { requiresFairyForm: true, blockedArmor: ["medium", "heavy"] } },
    { raceId: "half_dragon", raceSubtypeId: "blue", capabilityId: "burrow" },
    { raceId: "half_dragon", raceSubtypeId: "bronze", capabilityId: "swim_speed" },
    { raceId: "half_dragon", raceSubtypeId: "bronze", capabilityId: "underwater_breathing" },
    { raceId: "undae", capabilityId: "amphibious" },
    { raceId: "undae", raceSubtypeId: "war", capabilityId: "swim_speed" },
    { raceId: "elnae", capabilityId: "flight", conditions: { blockedArmor: ["medium"] } },
  ]);

  const RETREATS = deepFreeze({
    burrowed: {
      id: "burrowed",
      capabilityId: "burrow",
      awayTurns: 1,
      untargetable: true,
      comebackStatus: { statusId: "protection", count: 3 },
      encounterBonus: { channel: "defensive_level", value: 1 },
      nonStackableGroup: "retreat_bonus",
    },
    sink: {
      id: "sink",
      capabilityId: "swim_speed",
      awayTurns: 1,
      untargetable: true,
      comebackStatus: { statusId: "defense_power_up", count: 3 },
      encounterBonus: { channel: "final_power", value: 1, conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },
      nonStackableGroup: "retreat_bonus",
    },
    fly: {
      id: "fly",
      capabilityId: "flight",
      awayTurns: 1,
      untargetable: true,
      comebackStatus: { statusId: "haste", count: 3 },
      encounterBonus: [
        { channel: "min_speed", value: 2 },
        { channel: "max_speed", value: 2 },
      ],
      nonStackableGroup: "retreat_bonus",
    },
  });

  function normalizeCharacter(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    return {
      ...character,
      raceId: normalizeId(build.raceId ?? character.raceId ?? character.race?.id),
      raceSubtypeId: normalizeId(build.raceSubtypeId ?? character.raceSubtypeId ?? character.race?.subtypeId),
      level: Math.max(0, Number(build.calculatedAtLevel ?? character.level) || 0),
    };
  }

  function grantMatches(characterInput, grant) {
    const character = normalizeCharacter(characterInput);
    if (normalizeId(grant.sourceType) !== "race") return false;
    if (character.raceId !== normalizeId(grant.sourceId)) return false;
    if (grant.sourceSubtypeId && character.raceSubtypeId !== normalizeId(grant.sourceSubtypeId)) return false;
    if (grant.atLevel && character.level < Number(grant.atLevel)) return false;
    return true;
  }

  function allDefinitions() {
    return clone(DEFINITIONS);
  }

  function allGrants() {
    return clone(GRANTS);
  }

  function getDefinition(id) {
    return clone(DEFINITIONS[normalizeId(id)] || null);
  }

  function resolveTraitGrants(character, catalog = DEFINITIONS) {
    const byId = catalog instanceof Map
      ? catalog
      : new Map(Object.entries(catalog || {}).map(([id, definition]) => [normalizeId(id), definition]));
    return GRANTS.filter((grant) => grantMatches(character, grant)).map((grant) => {
      const definition = byId.get(normalizeId(grant.traitId));
      if (!definition) return null;
      const trait = engine?.normalizeTrait ? engine.normalizeTrait(definition) : clone(definition);
      trait.source = {
        ...(trait.source || {}),
        type: "race",
        id: normalizeId(grant.sourceId),
        ...(grant.sourceSubtypeId ? { subtypeId: normalizeId(grant.sourceSubtypeId) } : {}),
      };
      return trait;
    }).filter(Boolean);
  }

  function resolveCapabilities(characterInput) {
    const character = normalizeCharacter(characterInput);
    return CAPABILITY_GRANTS.filter((grant) => {
      if (normalizeId(grant.raceId) !== character.raceId) return false;
      return !grant.raceSubtypeId || normalizeId(grant.raceSubtypeId) === character.raceSubtypeId;
    }).map(clone);
  }

  function validateAll(customEngine = engine) {
    const errors = [];
    const warnings = [];
    if (!customEngine?.validateTrait) return { valid: false, errors: ["Trait Engine is not available."], warnings };
    Object.entries(DEFINITIONS).forEach(([id, definition]) => {
      const result = customEngine.validateTrait(definition);
      if (result.trait.id !== id) errors.push(`${id}: normalized id became ${result.trait.id}.`);
      result.errors.forEach((message) => errors.push(`${id}: ${message}`));
      result.warnings.forEach((message) => warnings.push(`${id}: ${message}`));
    });
    const seen = new Set();
    GRANTS.forEach((grant) => {
      if (seen.has(grant.id)) errors.push(`Duplicate racial grant id: ${grant.id}`);
      seen.add(grant.id);
      if (!DEFINITIONS[grant.traitId]) errors.push(`${grant.id}: missing Trait definition ${grant.traitId}.`);
    });
    return { valid: errors.length === 0, errors, warnings };
  }

  const api = Object.freeze({
    CATALOG_VERSION,
    DEFINITIONS,
    GRANTS,
    CAPABILITY_GRANTS,
    RETREATS,
    allDefinitions,
    allGrants,
    getDefinition,
    grantMatches,
    resolveTraitGrants,
    resolveCapabilities,
    validateAll,
  });

  global.LuminousRacialTraitCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
