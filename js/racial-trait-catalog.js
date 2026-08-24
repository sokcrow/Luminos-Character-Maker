(function (global) {
  "use strict";

  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const CATALOG_VERSION = 2;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const raceSource = (id) => Object.freeze({ type: "race", id });
  const sharedSource = Object.freeze({ type: "special", id: "shared" });

  function passiveModifier(id, name, sourceId, channel, value, options = {}) {
    return {
      schemaVersion: 1,
      id,
      name,
      description: options.description || name,
      source: options.shared ? sharedSource : raceSource(sourceId),
      contexts: options.contexts || ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: options.trigger || "passive",
        target: options.target || "self",
        channel,
        ...(options.path ? { path: options.path } : {}),
        mode: options.mode || "add",
        ...(options.formula != null ? { formula: options.formula } : { value }),
        ...(options.unit ? { unit: options.unit } : {}),
        ...(options.scope ? { scope: options.scope } : {}),
        ...(options.whileStatus ? { whileStatus: options.whileStatus } : {}),
        conditions: options.conditions || [],
      }],
    };
  }

  function thresholdTrait(id, name, sourceId, conditions, value = -4, options = {}) {
    return {
      schemaVersion: 1,
      id,
      name,
      description: options.description || `${name}: modify Check Threshold by ${value}.`,
      source: options.shared ? sharedSource : raceSource(sourceId),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: `${id}_check`,
        contexts: ["theatre"],
        trigger: "before_check",
        conditions,
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value }],
      }],
      rules: [],
    };
  }

  function sinAffinityTrait(id, affinity, name) {
    return passiveModifier(id, name, "yuan_ti_pureblood", "damage_dealt_multiplier", 0, {
      description: `Deal +(Level / 4)% ${affinity} Sin Damage.`,
      formula: "Level / 4",
      unit: "percent",
      conditions: [{ any: [
        { path: "skill.affinity", operator: "eq", value: affinity },
        { path: "skill.sinAffinity", operator: "eq", value: affinity },
      ] }],
    });
  }

  const DEFINITIONS = deepFreeze({
    pack_tactics: {
      schemaVersion: 1,
      id: "pack_tactics",
      name: "Pack Tactics",
      description: "When the current target is also Targeted by an Ally, gain +1 Final Power for this attack.",
      source: sharedSource,
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
        conditions: [{ path: "targetedByAlly", operator: "truthy" }],
      }],
    },

    keen_hearing: thresholdTrait("keen_hearing", "Keen Hearing", "shared", [
      { path: "check.skillId", operator: "eq", value: "perception" },
      { path: "check.senses", operator: "contains", value: "hearing" },
    ], -4, { shared: true, description: "Sound-based Perception checks reduce Threshold by 4." }),

    keen_hearing_and_smell: thresholdTrait("keen_hearing_and_smell", "Keen Hearing and Smell", "shared", [
      { path: "check.skillId", operator: "eq", value: "perception" },
      { any: [
        { path: "check.senses", operator: "contains", value: "hearing" },
        { path: "check.senses", operator: "contains", value: "smell" },
      ] },
    ], -4, { shared: true, description: "Perception checks based on hearing or smell reduce Threshold by 4." }),

    lanae_community_resilience: {
      schemaVersion: 1,
      id: "lanae_community_resilience",
      name: "Community Resilience",
      description: "After failing a Check, add Alive Allies as Check Bonus (max +5) and recalculate. Uses equal Proficiency; Long Rest.",
      source: raceSource("lanae"),
      contexts: ["theatre"],
      activation: {
        type: "prompt",
        actionCost: "reaction",
        uses: { formula: "Proficiency", reset: "long_rest" },
        conditions: [{ any: [
          { path: "check.failed", operator: "truthy" },
          { path: "check.passed", operator: "eq", value: false },
        ] }],
      },
      effects: [{
        id: "lanae_community_resilience_retry",
        contexts: ["theatre"],
        trigger: "on_use",
        conditions: [],
        operations: [
          { type: "modify", path: "check.finalPower", mode: "add", formula: "min(5, AliveAllies)" },
          { type: "modify", path: "check.recalculate", mode: "set", value: 1 },
        ],
      }],
      rules: [],
    },

    lizalin_natural_armor: passiveModifier("lizalin_natural_armor", "Natural Armor", "lizalin", "defensive_level", 1, {
      description: "Gain +1 Defensive Level.",
    }),

    lizalin_hungry_jaws: {
      schemaVersion: 1,
      id: "lizalin_hungry_jaws",
      name: "Hungry Jaws",
      description: "When Bite deals damage, gain Shield equal to (CON Mod + Level/4)% of that Bite damage.",
      source: raceSource("lizalin"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "lizalin_hungry_jaws_shield",
        contexts: ["combat"],
        trigger: "damage_dealt",
        conditions: [{ any: [
          { path: "skill.id", operator: "eq", value: "bite" },
          { path: "skill.tags", operator: "contains", value: "bite" },
          { path: "skill.naturalWeapon", operator: "eq", value: "bite" },
        ] }],
        operations: [{ type: "gain_shield", path: "self.shield", formula: "floor(DamageDealt * (ConstitutionMod + Level / 4) / 100)" }],
      }],
      rules: [],
    },

    kobold_burrow_mentality: thresholdTrait("kobold_burrow_mentality", "Burrow Mentality", "kobold", [
      { path: "check.skillId", operator: "in", value: ["history", "survival"] },
      { any: [
        { path: "check.environmentTags", operator: "contains", value: "underground" },
        { path: "check.environmentTags", operator: "contains", value: "tunnel" },
        { path: "check.environmentTags", operator: "contains", value: "cavern" },
      ] },
    ], -4, { description: "History and Survival checks related to tunnels, caverns, or underground structures reduce Threshold by 4." }),

    kobold_cower_grovel_beg: {
      schemaVersion: 1,
      id: "kobold_cower_grovel_beg",
      name: "Cower, Grovel and Beg",
      description: "Once per Encounter, enemies that fail the racial Deception Check receive +1 Clash Power Down for 1 Turn.",
      source: raceSource("kobold"),
      contexts: ["combat", "theatre"],
      activation: { type: "manual", actionCost: "quick_action", uses: { max: 1, reset: "encounter" } },
      effects: [{
        id: "kobold_cower_request",
        contexts: ["combat", "theatre"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "log", message: "Enemies make the configured Check against Threshold 8 + Deception; failures gain 1 Clash Power Down for one Turn." }],
      }],
      rules: [],
      resolutions: [{
        id: "kobold_cower_enemy_checks",
        trigger: "on_use",
        type: "check_status",
        targets: "all_enemies",
        check: { thresholdBase: 8, sourceSkillId: "deception" },
        onFail: { statusId: "clash_power_down", count: 1, duration: "this_turn" },
      }],
    },

    kenku_mimicry: {
      schemaVersion: 1,
      id: "kenku_mimicry",
      name: "Mimicry",
      description: "When imitating a sound or voice, the Kenku receives +4 Check Bonus on the opposed Deception Check against Insight.",
      source: raceSource("kenku"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "kenku_mimicry_opposed_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [
          { path: "check.skillId", operator: "eq", value: "deception" },
          { any: [
            { path: "check.tags", operator: "contains", value: "mimicry" },
            { path: "check.isMimicry", operator: "truthy" },
          ] },
        ],
        operations: [{ type: "modify", path: "check.finalPower", mode: "add", value: 4 }],
      }],
      rules: [],
    },

    kenku_expert_forger: thresholdTrait("kenku_expert_forger", "Expert Forger", "kenku", [{ any: [
      { path: "check.skillId", operator: "eq", value: "forgery" },
      { path: "check.tags", operator: "contains", value: "forgery" },
    ] }], -1, { description: "Forgery checks reduce Threshold by 1." }),

    kenku_limited_communication: {
      schemaVersion: 1,
      id: "kenku_limited_communication",
      name: "Limited Communication",
      description: "For verbal communication, Persuasion Threshold +1 and Deception Threshold -1. Written checks are unaffected.",
      source: raceSource("kenku"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [
        { id: "kenku_verbal_persuasion", contexts: ["theatre"], trigger: "before_check", conditions: [{ path: "check.skillId", operator: "eq", value: "persuasion" }, { path: "check.communicationMode", operator: "eq", value: "verbal" }], operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: 1 }] },
        { id: "kenku_verbal_deception", contexts: ["theatre"], trigger: "before_check", conditions: [{ path: "check.skillId", operator: "eq", value: "deception" }, { path: "check.communicationMode", operator: "eq", value: "verbal" }], operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -1 }] },
      ],
      rules: [],
    },

    centaur_difficult_climb: thresholdTrait("centaur_difficult_climb", "Equine Climb", "centaur", [{ any: [{ path: "check.skillId", operator: "eq", value: "climb" }, { path: "check.tags", operator: "contains", value: "climb" }] }], 6, { description: "Climbing Checks have Threshold +6 because of the Centaur's equine body." }),

    centaur_charge: {
      schemaVersion: 1,
      id: "centaur_charge",
      name: "Charge",
      description: "When attacking a target with lower Speed, gain +1 Final Power.",
      source: raceSource("centaur"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "final_power", mode: "add", value: 1, conditions: [{ path: "target.speed", operator: "lt", valueFormula: "MaxSpeed" }] }],
    },

    goliath_stone_endurance: {
      schemaVersion: 1,
      id: "goliath_stone_endurance",
      name: "Stone's Endurance",
      description: "When damage is taken, reduce incoming damage by Constitution Mod.",
      source: raceSource("goliath"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{ id: "goliath_stone_endurance_damage", contexts: ["combat"], trigger: "damage_taken", conditions: [], operations: [{ type: "modify", path: "damage.amount", mode: "add", formula: "-max(0, ConstitutionMod)" }] }],
      rules: [],
    },

    goblin_fury_of_small: {
      schemaVersion: 1,
      id: "goblin_fury_of_small",
      name: "Fury of the Small",
      description: "Once per Turn when damaging a larger Unit, add max(1, CON Mod) Fixed Damage.",
      source: raceSource("goblin"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [{ id: "goblin_fury_fixed_damage", type: "modifier", trigger: "damage_dealt", target: "self", path: "damage.amount", mode: "add", formula: "max(1, ConstitutionMod)", scope: "once_per_turn", conditions: [{ path: "target.size", operator: "in", value: ["medium", "large", "huge", "gargantuan"] }] }],
    },

    goblin_nimble_escape: passiveModifier("goblin_nimble_escape", "Nimble Escape", "goblin", "evade_power", 1, { description: "Evade Skills gain +1 Evade Power.", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }),

    fairy_form: {
      schemaVersion: 1,
      id: "fairy_form",
      name: "Fairy Form",
      description: "Toggle Fairy Form: Tiny size, +2 Min/+2 Max Speed, +2 Evade Power, and take 50% more Damage.",
      source: raceSource("fairy"),
      contexts: ["combat", "theatre"],
      activation: { type: "manual", actionCost: "none" },
      effects: [
        { id: "fairy_form_enable", contexts: ["combat", "theatre"], trigger: "on_use", conditions: [{ path: "self.statusEffects.fairy_form", operator: "falsy" }], operations: [{ type: "apply_status", statusId: "fairy_form", count: 1, duration: "until_removed" }] },
        { id: "fairy_form_disable", contexts: ["combat", "theatre"], trigger: "on_use", conditions: [{ path: "self.statusEffects.fairy_form", operator: "truthy" }], operations: [{ type: "remove_status", statusId: "fairy_form" }] },
      ],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "min_speed", mode: "add", value: 2, whileStatus: "fairy_form" },
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 2, whileStatus: "fairy_form" },
        { type: "modifier", trigger: "passive", target: "self", channel: "evade_power", mode: "add", value: 2, whileStatus: "fairy_form", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },
        { type: "modifier", trigger: "passive", target: "self", channel: "damage_taken_multiplier", mode: "add", value: -5, whileStatus: "fairy_form" },
      ],
    },

    aasimar_healing_hands: {
      schemaVersion: 1,
      id: "aasimar_healing_hands",
      name: "Healing Hands",
      description: "Heal (Level/2) + CON Mod HP. Uses equal Proficiency; Long Rest.",
      source: raceSource("aasimar"),
      contexts: ["combat", "theatre"],
      activation: { type: "manual", actionCost: "action", uses: { formula: "Proficiency", reset: "long_rest" }, target: "self_or_ally" },
      effects: [
        { id: "aasimar_healing_hands_target", contexts: ["combat", "theatre"], trigger: "on_use", conditions: [{ path: "target", operator: "truthy" }], operations: [{ type: "heal_hp", path: "target.hp", maxPath: "target.maxHp", formula: "max(0, floor(Level / 2) + ConstitutionMod)" }] },
        { id: "aasimar_healing_hands_self_fallback", contexts: ["combat", "theatre"], trigger: "on_use", conditions: [{ path: "target", operator: "falsy" }], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", formula: "max(0, floor(Level / 2) + ConstitutionMod)" }] },
      ],
      rules: [],
    },

    aasimar_protector_transformation: {
      schemaVersion: 1,
      id: "aasimar_protector_transformation",
      name: "Radiant Soul",
      description: "Protector transformation for Count 6. Grants Flight and once per Turn adds at least 1 Fixed Damage based on Level/10.",
      source: raceSource("aasimar"),
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action", uses: { max: 1, reset: "long_rest" } },
      effects: [{ id: "aasimar_protector_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_protector_form", count: 6, duration: "until_removed" }] }],
      rules: [
        { id: "aasimar_protector_duration_start", type: "counter", trigger: "on_use", stateKey: "aasimar_protector_duration", mode: "set", value: 6, reset: "long_rest" },
        { id: "aasimar_protector_duration_tick", type: "counter", trigger: "turn_end", stateKey: "aasimar_protector_duration", mode: "add", value: -1, conditions: [{ statusId: "aasimar_protector_form", operator: "truthy" }] },
        { id: "aasimar_protector_duration_end", type: "status", trigger: "turn_end", action: "remove", target: "self", statusId: "aasimar_protector_form", conditions: [{ counterKey: "aasimar_protector_duration", operator: "lte", value: 0 }] },
        { id: "aasimar_protector_damage", type: "modifier", trigger: "damage_dealt", target: "self", path: "damage.amount", mode: "add", formula: "max(1, floor(Level / 10))", scope: "once_per_turn", whileStatus: "aasimar_protector_form" },
      ],
    },

    aasimar_scourge_transformation: {
      schemaVersion: 1,
      id: "aasimar_scourge_transformation",
      name: "Radiant Consumption",
      description: "Scourge transformation for Count 6. Once per Turn adds at least 1 Fixed Damage based on Level/10; aura damage is exposed for encounter resolution.",
      source: raceSource("aasimar"),
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action", uses: { max: 1, reset: "long_rest" } },
      effects: [{ id: "aasimar_scourge_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_scourge_form", count: 6, duration: "until_removed" }] }],
      rules: [
        { id: "aasimar_scourge_duration_start", type: "counter", trigger: "on_use", stateKey: "aasimar_scourge_duration", mode: "set", value: 6, reset: "long_rest" },
        { id: "aasimar_scourge_duration_tick", type: "counter", trigger: "turn_end", stateKey: "aasimar_scourge_duration", mode: "add", value: -1, conditions: [{ statusId: "aasimar_scourge_form", operator: "truthy" }] },
        { id: "aasimar_scourge_duration_end", type: "status", trigger: "turn_end", action: "remove", target: "self", statusId: "aasimar_scourge_form", conditions: [{ counterKey: "aasimar_scourge_duration", operator: "lte", value: 0 }] },
        { id: "aasimar_scourge_damage", type: "modifier", trigger: "damage_dealt", target: "self", path: "damage.amount", mode: "add", formula: "max(1, floor(Level / 10))", scope: "once_per_turn", whileStatus: "aasimar_scourge_form" },
      ],
      resolutions: [{ id: "aasimar_scourge_aura_damage", trigger: "turn_end", type: "area_damage", targets: "self_and_all_creatures", rangeFeet: 10, whileStatus: "aasimar_scourge_form", amountFormula: "max(1, ceil(Level / 10))" }],
    },

    aasimar_fallen_transformation: {
      schemaVersion: 1,
      id: "aasimar_fallen_transformation",
      name: "Necrotic Shroud",
      description: "Fallen transformation for Count 6. Once per Turn adds at least 1 Fixed Damage based on Level/10; activation exposes the Frightened check request.",
      source: raceSource("aasimar"),
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action", uses: { max: 1, reset: "long_rest" } },
      effects: [{ id: "aasimar_fallen_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_fallen_form", count: 6, duration: "until_removed" }] }],
      rules: [
        { id: "aasimar_fallen_duration_start", type: "counter", trigger: "on_use", stateKey: "aasimar_fallen_duration", mode: "set", value: 6, reset: "long_rest" },
        { id: "aasimar_fallen_duration_tick", type: "counter", trigger: "turn_end", stateKey: "aasimar_fallen_duration", mode: "add", value: -1, conditions: [{ statusId: "aasimar_fallen_form", operator: "truthy" }] },
        { id: "aasimar_fallen_duration_end", type: "status", trigger: "turn_end", action: "remove", target: "self", statusId: "aasimar_fallen_form", conditions: [{ counterKey: "aasimar_fallen_duration", operator: "lte", value: 0 }] },
        { id: "aasimar_fallen_damage", type: "modifier", trigger: "damage_dealt", target: "self", path: "damage.amount", mode: "add", formula: "max(1, floor(Level / 10))", scope: "once_per_turn", whileStatus: "aasimar_fallen_form" },
      ],
      resolutions: [{
        id: "aasimar_fallen_frightened_check",
        trigger: "on_use",
        type: "check_status",
        targets: "all_other_creatures",
        rangeFeet: 10,
        requireCanSeeSource: true,
        check: { abilityId: "cha", thresholdFormula: "8 + Proficiency + CharismaMod" },
        onFail: { statusId: "frightened", count: 1, duration: "next_turn_end" },
      }],
    },

    warforged_sentry_rest: {
      schemaVersion: 1,
      id: "warforged_sentry_rest",
      name: "Sentry's Rest",
      description: "During Long Rest the Warforged remains conscious and can see and hear.",
      source: raceSource("warforged"),
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{ id: "warforged_sentry_rest_flag", contexts: ["any"], trigger: "long_rest", conditions: [], operations: [{ type: "set_flag", flagId: "conscious_during_long_rest", value: true }] }],
      rules: [],
    },

    warforged_integrated_tool: {
      schemaVersion: 1,
      id: "warforged_integrated_tool",
      name: "Integrated Tool",
      description: "Checks using the chosen integrated proficient Tool reduce Threshold by 25%.",
      source: raceSource("warforged"),
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{ id: "warforged_integrated_tool_check", contexts: ["theatre"], trigger: "before_check", conditions: [{ path: "check.usesIntegratedTool", operator: "truthy" }], operations: [{ type: "modify", path: "check.difficulty", mode: "multiply", value: 0.75 }] }],
      rules: [],
    },

    warforged_reinforced_body: passiveModifier("warforged_reinforced_body", "Reinforced Body", "warforged", "defensive_level", 1, { description: "Gain +1 Defensive Level." }),

    warforged_lone_reconnaissance: thresholdTrait("warforged_lone_reconnaissance", "Lone Reconnaissance", "warforged", [{ path: "check.skillId", operator: "eq", value: "stealth" }, { formula: "AliveAllies", operator: "eq", value: 0 }], -4, { description: "When no allies are present, Stealth checks reduce Threshold by 4." }),

    feline_reflexes: {
      schemaVersion: 1,
      id: "feline_reflexes",
      name: "Feline Reflexes",
      description: "Gain floor(Proficiency / 2) Max Speed and Proficiency Evade Power on Evade Skills.",
      source: raceSource("felinae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", formula: "floor(Proficiency / 2)" },
        { type: "modifier", trigger: "passive", target: "self", channel: "evade_power", mode: "add", formula: "Proficiency", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },
      ],
    },

    felinae_light_footed: passiveModifier("felinae_light_footed", "Light-Footed", "felinae", "max_speed", 2, { description: "40 ft racial movement converts to +2 Max Speed." }),

    felinae_soft_landing: passiveModifier("felinae_soft_landing", "Soft Landing", "felinae", "damage_taken_multiplier", 50, { description: "Fall Damage Taken is Halved.", unit: "percent_reduction", conditions: [{ any: [{ path: "skill.damageType", operator: "eq", value: "Fall" }, { path: "skill.tags", operator: "contains", value: "fall_damage" }] }] }),

    half_dragon_indomitable: thresholdTrait("half_dragon_indomitable", "Indomitable", "half_dragon", [{ path: "check.effectTag", operator: "in", value: ["charmed", "frightened"] }], -4, { description: "Checks against Charmed or Frightened reduce Threshold by 4." }),

    half_dragon_relentless_strength: {
      schemaVersion: 1,
      id: "half_dragon_relentless_strength",
      name: "Relentless Strength",
      description: "When Dragon Breath deals damage, add CON Mod Fixed Damage; double that bonus while Dragon Form is active.",
      source: raceSource("half_dragon"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [
        { id: "half_dragon_relentless_strength_normal", contexts: ["combat"], trigger: "damage_dealt", conditions: [{ path: "skill.tags", operator: "contains", value: "dragon_breath" }, { not: { path: "self.statusEffects.dragon_form", operator: "truthy" } }], operations: [{ type: "modify", path: "damage.amount", mode: "add", formula: "max(1, ConstitutionMod)" }] },
        { id: "half_dragon_relentless_strength_form", contexts: ["combat"], trigger: "damage_dealt", conditions: [{ path: "skill.tags", operator: "contains", value: "dragon_breath" }, { path: "self.statusEffects.dragon_form", operator: "truthy" }], operations: [{ type: "modify", path: "damage.amount", mode: "add", formula: "2 * max(1, ConstitutionMod)" }] },
      ],
      rules: [],
    },

    half_dragon_skilled_hunter: {
      schemaVersion: 1,
      id: "half_dragon_skilled_hunter",
      name: "Skilled Hunter",
      description: "When attacking a target with lower Speed, gain +2 Clash Power.",
      source: raceSource("half_dragon"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 2, conditions: [{ path: "target.speed", operator: "lt", valueFormula: "MaxSpeed" }] }],
    },

    half_dragon_desert_predator: thresholdTrait("half_dragon_desert_predator", "Desert Predator", "half_dragon", [{ path: "check.skillId", operator: "eq", value: "stealth" }, { any: [{ path: "check.environmentTags", operator: "contains", value: "sand" }, { path: "check.environmentTags", operator: "contains", value: "loose_earth" }, { path: "check.environmentTags", operator: "contains", value: "burrowable_ground" }] }], -4, { description: "Stealth checks in sand or loose earth reduce Threshold by 4." }),

    half_dragon_gold_breath_conversion: {
      schemaVersion: 1,
      id: "half_dragon_gold_breath_conversion",
      name: "Sacred Breath",
      description: "When Dragon Breath damages a Demon or Undead, deal +(Level / 4)% Damage. Dragon Breath keeps its normal Fire/Burn damage type.",
      source: raceSource("half_dragon"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "half_dragon_gold_sacred_breath_damage",
        contexts: ["combat"],
        trigger: "damage_dealt",
        conditions: [
          { any: [
            { path: "skill.id", operator: "eq", value: "dragon_breath" },
            { path: "skill.tags", operator: "contains", value: "dragon_breath" },
          ] },
          { any: [
            { path: "target.creatureType", operator: "in", value: ["demon", "undead"] },
            { path: "target.type", operator: "in", value: ["demon", "undead"] },
            { path: "target.tags", operator: "contains", value: "demon" },
            { path: "target.tags", operator: "contains", value: "undead" },
          ] },
        ],
        operations: [{ type: "modify", path: "damage.amount", mode: "add", formula: "max(1, floor(DamageDealt * (Level / 4) / 100))" }],
      }],
      rules: [],
    },

    half_dragon_bold_speaker: thresholdTrait("half_dragon_bold_speaker", "Bold Speaker", "half_dragon", [{ path: "check.skillId", operator: "eq", value: "persuasion" }], -4, { description: "Persuasion checks reduce Threshold by 4. Magical Sleep immunity is a race property." }),

    lupae_canis_toughness: thresholdTrait("lupae_canis_toughness", "Canis Toughness", "lupae", [{ path: "check.effectTag", operator: "in", value: ["disease", "poison"] }], -4, { description: "Checks against Disease or Poison reduce Threshold by 4." }),

    moonfae_intimidating_presence: thresholdTrait("moonfae_intimidating_presence", "Intimidating Presence", "moonfae", [{ path: "check.effectTag", operator: "eq", value: "frightened" }], -4, { description: "Checks against Frightened reduce Threshold by 4. Intimidation proficiency is racial metadata." }),

    moonfae_lunge: {
      schemaVersion: 1,
      id: "moonfae_lunge",
      name: "Lunge",
      description: "If no damage was taken during the previous Turn, gain +2 Clash Power when attacking.",
      source: raceSource("moonfae"),
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 2, conditions: [{ path: "self.took_damage_last_turn", operator: "falsy" }] }],
    },

    moonfae_crescent_speed: passiveModifier("moonfae_crescent_speed", "Fast", "moonfae", "max_speed", 1, { description: "35 ft racial movement converts to +1 Max Speed." }),
    moonfae_agile_escape: passiveModifier("moonfae_agile_escape", "Agile Escape", "moonfae", "evade_power", 2, { description: "Evade Skills gain +2 Evade Power.", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }),

    moonfae_natural_talent: {
      schemaVersion: 1,
      id: "moonfae_natural_talent",
      name: "Natural Talent",
      description: "On a Dexterity Check, gain +2 Check Bonus. Uses equal Proficiency; Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: { type: "prompt", actionCost: "none", uses: { formula: "Proficiency", reset: "long_rest" }, conditions: [{ path: "check.abilityId", operator: "eq", value: "dex" }] },
      effects: [{ id: "moonfae_natural_talent_check", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "modify", path: "check.finalPower", mode: "add", value: 2 }] }],
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
      effects: [{ id: "moonfae_cautious_senses_haste", contexts: ["combat"], trigger: "turn_start", conditions: [], operations: [{ type: "apply_status", statusId: "haste", count: 2, duration: "this_turn" }] }],
      rules: [],
    },

    moonfae_empathy: {
      schemaVersion: 1,
      id: "moonfae_empathy",
      name: "Empathy",
      description: "Touch a creature to learn its general emotional state without making the target aware. Uses equal Proficiency; Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: { type: "manual", actionCost: "action", uses: { formula: "Proficiency", reset: "long_rest" }, target: "creature" },
      effects: [{ id: "moonfae_empathy_read", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "set_flag", flagId: "empathy_read_requested", value: true }] }],
      rules: [],
    },

    moonfae_unsettling_knowledge: {
      schemaVersion: 1,
      id: "moonfae_unsettling_knowledge",
      name: "Unsettling Knowledge",
      description: "On Use, a random Enemy loses 3 SP.",
      source: raceSource("moonfae"),
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action", target: "random_enemy" },
      effects: [{ id: "moonfae_unsettling_knowledge_sp", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_sp", path: "target.sp", formula: "-3" }] }],
      rules: [],
    },

    moonfae_rabbits_luck: {
      schemaVersion: 1,
      id: "moonfae_rabbits_luck",
      name: "Rabbit's Luck",
      description: "Reduce the active Check Threshold by 4. Uses equal Proficiency; Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: { type: "prompt", actionCost: "none", uses: { formula: "Proficiency", reset: "long_rest" }, target: "self_or_ally" },
      effects: [{ id: "moonfae_rabbits_luck_check", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }] }],
      rules: [],
    },

    moonfae_favorable_action: {
      schemaVersion: 1,
      id: "moonfae_favorable_action",
      name: "Favorable Action",
      description: "Add Charisma Mod to the active Check. Uses equal Proficiency; Long Rest.",
      source: raceSource("moonfae"),
      contexts: ["theatre"],
      activation: { type: "prompt", actionCost: "none", uses: { formula: "Proficiency", reset: "long_rest" } },
      effects: [{ id: "moonfae_favorable_action_check", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "modify", path: "check.finalPower", mode: "add", formula: "CharismaMod" }] }],
      rules: [],
    },

    moonfae_lunar_transformation: {
      schemaVersion: 1,
      id: "moonfae_lunar_transformation",
      name: "Lunar Transformation",
      description: "Transform into Rabbit Form: equipment inactive, +2 Defensive Level, +2 Max Speed, Perception Threshold -4 and Strength Check Threshold +4.",
      source: raceSource("moonfae"),
      contexts: ["combat", "theatre"],
      activation: { type: "manual", actionCost: "action" },
      effects: [
        { id: "moonfae_rabbit_form_enable", contexts: ["combat", "theatre"], trigger: "on_use", conditions: [{ path: "self.statusEffects.moonfae_rabbit_form", operator: "falsy" }], operations: [{ type: "apply_status", statusId: "moonfae_rabbit_form", count: 1, duration: "until_removed" }] },
        { id: "moonfae_rabbit_form_disable", contexts: ["combat", "theatre"], trigger: "on_use", conditions: [{ path: "self.statusEffects.moonfae_rabbit_form", operator: "truthy" }], operations: [{ type: "remove_status", statusId: "moonfae_rabbit_form" }] },
      ],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "defensive_level", mode: "add", value: 2, whileStatus: "moonfae_rabbit_form" },
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 2, whileStatus: "moonfae_rabbit_form" },
      ],
    },

    moonfae_rabbit_perception: thresholdTrait("moonfae_rabbit_perception", "Rabbit Senses", "moonfae", [{ path: "self.statusEffects.moonfae_rabbit_form", operator: "truthy" }, { path: "check.skillId", operator: "eq", value: "perception" }], -4, { description: "While in Rabbit Form, Perception Threshold -4." }),
    moonfae_rabbit_strength_penalty: thresholdTrait("moonfae_rabbit_strength_penalty", "Rabbit Weakness", "moonfae", [{ path: "self.statusEffects.moonfae_rabbit_form", operator: "truthy" }, { path: "check.abilityId", operator: "eq", value: "str" }], 4, { description: "While in Rabbit Form, Strength Check Threshold +4." }),

    yuan_ti_magic_resistance: thresholdTrait("yuan_ti_magic_resistance", "Magic Resistance", "yuan_ti_pureblood", [{ path: "check.isMagical", operator: "truthy" }], -4, { description: "Checks against Spells or Magical Effects reduce Threshold by 4." }),
    yuan_ti_wrath_affinity: sinAffinityTrait("yuan_ti_wrath_affinity", "Wrath", "Red Eyes — Wrath"),
    yuan_ti_envy_affinity: sinAffinityTrait("yuan_ti_envy_affinity", "Envy", "Purple Eyes — Envy"),
    yuan_ti_gloom_affinity: sinAffinityTrait("yuan_ti_gloom_affinity", "Gloom", "Cyan Eyes — Gloom"),
    yuan_ti_pride_affinity: sinAffinityTrait("yuan_ti_pride_affinity", "Pride", "Blue Eyes — Pride"),
    yuan_ti_gluttony_affinity: sinAffinityTrait("yuan_ti_gluttony_affinity", "Gluttony", "Green Eyes — Gluttony"),
    yuan_ti_lust_affinity: sinAffinityTrait("yuan_ti_lust_affinity", "Lust", "Orange Eyes — Lust"),
    yuan_ti_sloth_affinity: sinAffinityTrait("yuan_ti_sloth_affinity", "Sloth", "Yellow Eyes — Sloth"),

    yuan_ti_cold_fury: passiveModifier("yuan_ti_cold_fury", "Cold Fury", "yuan_ti_pureblood", "counter_power", 4, {
      description: "Counter and ClashableCounter Skills gain +4 Counter Power.",
      conditions: [{ path: "skill.defense_subtype", operator: "in", value: ["counter", "clashablecounter", "clashable_counter"] }],
    }),

    yuan_ti_subtle_influence: {
      schemaVersion: 1,
      id: "yuan_ti_subtle_influence",
      name: "Subtle Influence",
      description: "Choose a creature and make the configured CHA Check; on pass, CHA Checks against that target reduce Threshold by 4 for the effect duration.",
      source: raceSource("yuan_ti_pureblood"),
      contexts: ["theatre"],
      activation: { type: "manual", actionCost: "action", target: "creature" },
      effects: [{ id: "yuan_ti_subtle_influence_request", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "set_flag", flagId: "subtle_influence_check_requested", value: true }] }],
      rules: [],
    },

    yuan_ti_voracious_impulse: {
      schemaVersion: 1,
      id: "yuan_ti_voracious_impulse",
      name: "Voracious Impulse",
      description: "On Enemy Defeated, recover (5 + CHA Mod)% Max HP.",
      source: raceSource("yuan_ti_pureblood"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{ id: "yuan_ti_voracious_impulse_heal", contexts: ["combat"], trigger: "on_kill", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", formula: "floor(MaxHP * (5 + CharismaMod) / 100)" }] }],
      rules: [],
    },

    undae_regeneration: {
      schemaVersion: 1,
      id: "undae_regeneration",
      name: "Undae Regeneration",
      description: "At Turn Start, if no Acid or Fire Damage was taken during the previous Turn and HP is above 0, recover (10 + CON Mod)% Max HP.",
      source: raceSource("undae"),
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{ id: "undae_regeneration_heal", contexts: ["combat"], trigger: "turn_start", conditions: [{ formula: "CurrentHP", operator: "gt", value: 0 }, { path: "self.damageTakenPreviousTurnTypes", operator: "not_contains", value: "Acid" }, { path: "self.damageTakenPreviousTurnTypes", operator: "not_contains", value: "Fire" }], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", formula: "floor(MaxHP * (10 + ConstitutionMod) / 100)" }] }],
      rules: [],
    },

    undae_aquatic_tenacity: passiveModifier("undae_aquatic_tenacity", "Aquatic Tenacity", "undae", "max_speed", 6, { description: "During an Underwater Encounter, gain +6 Max Speed.", conditions: [{ any: [{ path: "self.encounterTags", operator: "contains", value: "underwater" }, { path: "self.environmentTags", operator: "contains", value: "underwater" }] }] }),

    undae_thick_skin: passiveModifier("undae_thick_skin", "Thick Skin", "undae", "damage_taken_multiplier", 50, { description: "Slashing Damage Taken is Halved.", unit: "percent_reduction", conditions: [{ any: [{ path: "skill.attackType", operator: "eq", value: "Slash" }, { path: "skill.damageType", operator: "eq", value: "Slash" }] }] }),

    undae_stable_step: thresholdTrait("undae_stable_step", "Stable Step", "undae", [{ path: "check.effectTag", operator: "in", value: ["knockdown", "forced_displacement"] }], -4, { description: "Checks to resist Knockdown or Forced Displacement reduce Threshold by 4." }),

    undae_calming_presence: thresholdTrait("undae_calming_presence", "Calming Presence", "undae", [{ path: "check.skillId", operator: "eq", value: "persuasion" }, { any: [{ path: "target.injured", operator: "truthy" }, { path: "target.statusEffects.frightened", operator: "truthy" }] }], -4, { description: "Persuasion against injured or frightened creatures reduces Threshold by 4." }),

    undae_silent_step: thresholdTrait("undae_silent_step", "Silent Step", "undae", [{ path: "check.skillId", operator: "eq", value: "stealth" }, { path: "check.environmentTags", operator: "contains", value: "natural" }], -4, { description: "Stealth checks in Natural Terrain reduce Threshold by 4." }),

    undae_friend_of_life: {
      schemaVersion: 1,
      id: "undae_friend_of_life",
      name: "Friend of Life",
      description: "When you Stabilize a Creature, revive the target with 5% HP.",
      source: raceSource("undae"),
      contexts: ["combat", "theatre"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{ id: "undae_friend_of_life_revive", contexts: ["combat", "theatre"], trigger: "after_check", conditions: [{ any: [{ path: "check.actionId", operator: "eq", value: "stabilize" }, { path: "check.tags", operator: "contains", value: "stabilize" }] }, { path: "check.passed", operator: "truthy" }], operations: [{ type: "heal_hp", path: "target.hp", maxPath: "target.maxHp", formula: "max(1, floor(TargetMaxHP * 5 / 100))" }] }],
      rules: [],
    },
  });

  const NON_TRAIT_FEATURES = deepFreeze({
    human: ["ability_score_package", "variant_general_trait_choice"],
    lanae: ["horns_natural_weapon", "lanae_magic", "mountain_born", "languages"],
    lizalin: ["bite_natural_weapon", "hold_breath", "cunning_artisan_recipes", "hunter_lore_proficiencies"],
    kobold: ["darkvision", "improvised_engineering", "languages"],
    kenku: ["training_proficiencies", "languages"],
    centaur: ["hooves_natural_weapon", "active_inventory_plus_3", "survivor_proficiency", "movement_40"],
    goliath: ["active_inventory_plus_2", "mountain_born", "athletics_proficiency"],
    goblin: ["darkvision", "size", "languages"],
    fairy: ["flight_capability", "darkvision", "natural_glow", "subrace_resistances", "subrace_spells", "blinding_flash_skill"],
    aasimar: ["darkvision", "radiant_necrotic_resistance", "light_spell", "flight_capability_while_protector"],
    tiefling: ["darkvision", "burn_resistance", "heritage_spell_grants"],
    warforged: ["poison_disease_sleep_immunity", "food_water_property", "envoy_proficiencies", "iron_fists_skill", "skirmisher_movement"],
    felinae: ["darkvision", "claws_skill", "subrace_proficiencies", "active_inventory_plus_2", "mystic_cantrip"],
    half_dragon: ["dragon_breath_dynamic_skill", "ancestry_resistance", "subrace_proficiencies", "subrace_spell_grants", "burrow_swim_capabilities", "silver_paralyzing_breath"],
    lupae: ["fangs_dynamic_skill", "movement_35", "darkvision"],
    moonfae: ["darkvision", "thaumaturgy", "cycle_spell_grants", "cycle_proficiencies", "active_inventory_plus_2"],
    yuan_ti_pureblood: ["poison_immunity", "darkvision", "innate_spells", "eye_proficiencies_languages"],
    undae: ["amphibious", "poison_immunity", "darkvision", "subrace_spells_proficiencies", "swim_capability"],
    elnae: ["flight_capability", "darkvision", "part_of_nature_spells", "heavy_armor_proficiency_restriction"],
  });

  const RACE_TRAIT_MANIFEST = deepFreeze({
    human: { base: [] },
    lanae: { base: ["lanae_community_resilience"] },
    lizalin: { base: ["lizalin_natural_armor", "lizalin_hungry_jaws"] },
    kobold: { base: ["pack_tactics", "kobold_burrow_mentality", "kobold_cower_grovel_beg"] },
    kenku: { base: ["kenku_mimicry", "kenku_expert_forger", "kenku_limited_communication"] },
    centaur: { base: ["centaur_difficult_climb", "centaur_charge"] },
    goliath: { base: ["goliath_stone_endurance"] },
    goblin: { base: ["goblin_fury_of_small", "goblin_nimble_escape"] },
    fairy: { base: ["fairy_form"] },
    aasimar: { base: ["aasimar_healing_hands"], protector: ["aasimar_protector_transformation"], scourge: ["aasimar_scourge_transformation"], fallen: ["aasimar_fallen_transformation"] },
    tiefling: { base: [] },
    warforged: { base: ["warforged_sentry_rest"], envoy: ["warforged_integrated_tool"], juggernaut: ["warforged_reinforced_body"], skirmisher: ["warforged_lone_reconnaissance"] },
    felinae: { base: ["feline_reflexes"], ordinary: ["felinae_light_footed", "felinae_soft_landing"] },
    half_dragon: { base: [], red: ["half_dragon_indomitable"], black: ["half_dragon_relentless_strength"], white: ["half_dragon_skilled_hunter"], blue: ["half_dragon_desert_predator"], gold: ["half_dragon_gold_breath_conversion"], brass: ["half_dragon_bold_speaker"] },
    lupae: { base: ["keen_hearing_and_smell", "pack_tactics", "lupae_canis_toughness"] },
    moonfae: {
      base: ["keen_hearing", "moonfae_lunar_transformation", "moonfae_rabbit_perception", "moonfae_rabbit_strength_penalty"],
      full_moon: ["moonfae_intimidating_presence", "moonfae_lunge"],
      crescent_moon: ["moonfae_crescent_speed", "moonfae_agile_escape", "moonfae_natural_talent"],
      new_moon: ["moonfae_cautious_senses", "moonfae_empathy"],
      crimson_moon: ["moonfae_unsettling_knowledge"],
      blue_moon: ["moonfae_rabbits_luck", "moonfae_favorable_action"],
    },
    yuan_ti_pureblood: {
      base: ["yuan_ti_magic_resistance"],
      red_eyes: ["yuan_ti_wrath_affinity", "yuan_ti_cold_fury"],
      purple_eyes: ["yuan_ti_envy_affinity"],
      cyan_eyes: ["yuan_ti_gloom_affinity", "yuan_ti_subtle_influence"],
      blue_eyes: ["yuan_ti_pride_affinity"],
      green_eyes: ["yuan_ti_gluttony_affinity", "yuan_ti_voracious_impulse"],
      orange_eyes: ["yuan_ti_lust_affinity"],
      yellow_eyes: ["yuan_ti_sloth_affinity"],
      pale_eyes: [],
    },
    undae: { base: ["undae_regeneration"], war: ["undae_aquatic_tenacity"], rock: ["undae_thick_skin", "undae_stable_step"], mystic: ["undae_calming_presence"], wild: ["undae_silent_step", "undae_friend_of_life"] },
    elnae: { base: [] },
  });

  const raceGrant = (sourceId, traitId, options = {}) => ({
    id: `core_race_${sourceId}${options.sourceSubtypeId ? `_${options.sourceSubtypeId}` : ""}_${traitId}`,
    sourceType: "race",
    sourceId,
    ...(options.sourceSubtypeId ? { sourceSubtypeId: options.sourceSubtypeId } : {}),
    traitId,
    grantType: "trait",
  });

  function grantsFromManifest() {
    const grants = [];
    Object.entries(RACE_TRAIT_MANIFEST).forEach(([raceId, manifest]) => {
      (manifest.base || []).forEach((traitId) => grants.push(raceGrant(raceId, traitId)));
      Object.entries(manifest).forEach(([subtypeId, traitIds]) => {
        if (subtypeId === "base") return;
        (traitIds || []).forEach((traitId) => grants.push(raceGrant(raceId, traitId, { sourceSubtypeId: subtypeId })));
      });
    });
    return grants;
  }

  const GRANTS = deepFreeze(grantsFromManifest());

  const CAPABILITY_GRANTS = deepFreeze([
    { raceId: "fairy", capabilityId: "flight", conditions: { requiresFairyForm: true, blockedArmor: ["medium", "heavy"] } },
    { raceId: "aasimar", raceSubtypeId: "protector", capabilityId: "flight", conditions: { requiresStatus: "aasimar_protector_form" } },
    { raceId: "half_dragon", raceSubtypeId: "blue", capabilityId: "burrow" },
    { raceId: "half_dragon", raceSubtypeId: "bronze", capabilityId: "swim_speed" },
    { raceId: "half_dragon", raceSubtypeId: "bronze", capabilityId: "underwater_breathing" },
    { raceId: "undae", capabilityId: "amphibious" },
    { raceId: "undae", raceSubtypeId: "war", capabilityId: "swim_speed" },
    { raceId: "elnae", capabilityId: "flight", conditions: { blockedArmor: ["medium"] } },
  ]);

  const RETREATS = deepFreeze({
    burrowed: { id: "burrowed", capabilityId: "burrow", awayTurns: 1, untargetable: true, comebackStatus: { statusId: "protection", count: 3 }, encounterBonus: { channel: "defensive_level", value: 1 }, nonStackableGroup: "retreat_bonus" },
    sink: { id: "sink", capabilityId: "swim_speed", awayTurns: 1, untargetable: true, comebackStatus: { statusId: "defense_power_up", count: 3 }, encounterBonus: { channel: "final_power", value: 1, conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }, nonStackableGroup: "retreat_bonus" },
    fly: { id: "fly", capabilityId: "flight", awayTurns: 1, untargetable: true, comebackStatus: { statusId: "haste", count: 3 }, encounterBonus: [{ channel: "min_speed", value: 2 }, { channel: "max_speed", value: 2 }], nonStackableGroup: "retreat_bonus" },
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
    return true;
  }

  function allDefinitions() { return clone(DEFINITIONS); }
  function allGrants() { return clone(GRANTS); }
  function getDefinition(id) { return clone(DEFINITIONS[normalizeId(id)] || null); }

  function resolveTraitGrants(character, catalog = DEFINITIONS) {
    const byId = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}).map(([id, definition]) => [normalizeId(id), definition]));
    return GRANTS.filter((grant) => grantMatches(character, grant)).map((grant) => {
      const definition = byId.get(normalizeId(grant.traitId));
      if (!definition) return null;
      const trait = engine?.normalizeTrait ? engine.normalizeTrait(definition) : clone(definition);
      trait.source = { ...(trait.source || {}), type: "race", id: normalizeId(grant.sourceId), ...(grant.sourceSubtypeId ? { subtypeId: normalizeId(grant.sourceSubtypeId) } : {}) };
      return trait;
    }).filter(Boolean);
  }

  function resolveCapabilities(characterInput) {
    const character = normalizeCharacter(characterInput);
    return CAPABILITY_GRANTS.filter((grant) => normalizeId(grant.raceId) === character.raceId && (!grant.raceSubtypeId || normalizeId(grant.raceSubtypeId) === character.raceSubtypeId)).map(clone);
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
    Object.entries(RACE_TRAIT_MANIFEST).forEach(([raceId, manifest]) => {
      Object.entries(manifest).forEach(([subtypeId, traitIds]) => {
        (traitIds || []).forEach((traitId) => { if (!DEFINITIONS[traitId]) errors.push(`${raceId}/${subtypeId}: missing manifest definition ${traitId}.`); });
      });
    });
    return { valid: errors.length === 0, errors, warnings };
  }

  function installVariableBridge() {
    const source = global.LuminousTraitEngine;
    if (!source || source.__racialVariableBridge) return Boolean(source);
    if (typeof source.dispatchCombatEvent !== "function") return false;
    const wrapped = Object.freeze({
      ...source,
      __racialVariableBridge: true,
      dispatchCombatEvent(trigger, input = {}) {
        const self = input.self || input.character || null;
        const target = input.target || input.defender || null;
        const variables = {
          ...(input.variables || {}),
          DamageDealt: Number(input.damage?.amount ?? input.damageDealt ?? 0) || 0,
          DamageTaken: Number(input.damage?.amount ?? input.damageTaken ?? 0) || 0,
          UserSpeed: Number(self?.speed ?? self?.maxSpeed ?? self?.combatStats?.maxSpeed ?? 0) || 0,
          TargetSpeed: Number(target?.speed ?? target?.maxSpeed ?? target?.combatStats?.maxSpeed ?? 0) || 0,
        };
        return source.dispatchCombatEvent.call(source, trigger, { ...(input || {}), variables });
      },
    });
    global.LuminousTraitEngine = wrapped;
    return true;
  }

  const api = Object.freeze({
    CATALOG_VERSION,
    DEFINITIONS,
    GRANTS,
    RACE_TRAIT_MANIFEST,
    NON_TRAIT_FEATURES,
    CAPABILITY_GRANTS,
    RETREATS,
    allDefinitions,
    allGrants,
    getDefinition,
    grantMatches,
    resolveTraitGrants,
    resolveCapabilities,
    validateAll,
    installVariableBridge,
  });

  global.LuminousRacialTraitCatalog = api;
  installVariableBridge();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
