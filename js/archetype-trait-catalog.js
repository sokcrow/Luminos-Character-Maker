(function (global) {
  "use strict";

  const archetypeEngine = global.LuminousArchetypeEngine || (typeof require === "function" ? require("./archetype-engine.js") : null);
  const traitEngine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  if (!archetypeEngine) return;

  // Kept for backwards compatibility with the original single-Archetype catalog API.
  const ARCHETYPE_ID = "path_of_the_devil_lineage";
  const CLASS_ID = "barbarian";
  const COLLEGE_OF_WHISPERS_ID = "college_of_whispers";
  const COLLEGE_OF_WHISPERS_CLASS_ID = "bard";

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const ARCHETYPES = deepFreeze({
    [ARCHETYPE_ID]: {
      id: ARCHETYPE_ID,
      name: "Path of the Devil Lineage",
      classId: CLASS_ID,
      className: "Barbarian",
      unlockLevel: 15,
      traitLevels: [15, 30, 50, 70],
    },
    [COLLEGE_OF_WHISPERS_ID]: {
      id: COLLEGE_OF_WHISPERS_ID,
      name: "College of Whispers",
      classId: COLLEGE_OF_WHISPERS_CLASS_ID,
      className: "Bard",
      unlockLevel: 15,
      traitLevels: [15, 30, 70],
    },
  });

  const source = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: "Path of the Devil Lineage",
    classId: CLASS_ID,
    className: "Barbarian",
  });

  const whispersSource = Object.freeze({
    type: "archetype",
    id: COLLEGE_OF_WHISPERS_ID,
    archetypeId: COLLEGE_OF_WHISPERS_ID,
    archetypeName: "College of Whispers",
    classId: COLLEGE_OF_WHISPERS_CLASS_ID,
    className: "Bard",
  });

  const DEFINITIONS = deepFreeze({
    devil_lineage_devil_strength: {
      schemaVersion: 1,
      id: "devil_lineage_devil_strength",
      name: "Devil Strength",
      description: "Gain +2 Active Inventory. Strength Checks have Threshold -1. Two-Handed Weapons can be equipped using only 1 Hand Equipment Slot.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        activeInventoryBonus: 2,
        strengthCheckThreshold: -1,
        twoHandedHandSlots: 1,
        twoHandedAsOneHanded: true,
      },
    },

    devil_lineage_infernal_speed: {
      schemaVersion: 1,
      id: "devil_lineage_infernal_speed",
      name: "Infernal Speed",
      description: "While having Rage, gain +2 Max Speed and halve Jump Check Thresholds.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 2, whileStatus: "rage" },
      ],
      mechanics: {
        whileStatus: "rage",
        jumpThresholdMultiplier: 0.5,
      },
    },

    devil_lineage_demonic_resistance: {
      schemaVersion: 1,
      id: "devil_lineage_demonic_resistance",
      name: "Demonic Resistance",
      description: "Take Half Damage from Burn and Poison. At Turn Start, Recover (CON Mod + Proficiency)% Max HP.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "devil_lineage_demonic_resistance_heal",
        contexts: ["combat"],
        trigger: "turn_start",
        conditions: [
          { path: "self.isDowned", operator: "falsy" },
          { path: "self.lifeState", operator: "ne", value: "downed" },
        ],
        operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", formula: "floor(MaxHP * (ConstitutionMod + Proficiency) / 100)" }],
      }],
      rules: [],
      mechanics: {
        statusDamageMultipliers: { burn: 0.5, poison: 0.5 },
      },
    },

    devil_lineage_jackpot: {
      schemaVersion: 1,
      id: "devil_lineage_jackpot",
      name: "¡JACKPOT!",
      description: "Coins that spend Ammo deal +(10 × STR Mod)% Damage. Performance Checks gain +(STR Mod) Power.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        ammoCoinDamagePercentFormula: "10 * StrengthMod",
        performancePowerFormula: "StrengthMod",
      },
    },

    devil_lineage_infernal_touch: {
      schemaVersion: 1,
      id: "devil_lineage_infernal_touch",
      name: "Infernal Touch",
      description: "While having Rage, Slash, Pierce and Blunt Resistance is treated as Normal (x1) for you. At 50% Max HP or less gain +10% Critical Chance. On Critical with a 2-3 Coin Skill, Reuse its last Coin once per Turn. On Critical Kill with a 1 Coin Skill, Reuse that Skill once per Turn.",
      source,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        {
          type: "coin",
          trigger: "on_crit",
          target: "self",
          action: "reuse_last",
          count: 1,
          scope: "once_per_turn",
          conditions: [{ variable: "SkillCoinCount", operator: "between", value: 2, max: 3 }],
        },
      ],
      mechanics: {
        resistanceToNormalWhileStatus: { statusId: "rage", damageTypes: ["slash", "pierce", "blunt"], resistance: 0.5, normal: 1 },
        lowHpCriticalChance: { atOrBelowPercent: 50, bonusPercent: 10 },
        oneCoinCriticalKillReuse: { scope: "once_per_turn", coinCount: 1 },
      },
    },

    devil_lineage_supernatural_endurance: {
      schemaVersion: 1,
      id: "devil_lineage_supernatural_endurance",
      name: "Supernatural Endurance",
      description: "Gain +2 Death Save Power.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "devil_lineage_supernatural_endurance_death_save_power",
        contexts: ["combat"],
        trigger: "before_check",
        conditions: [{ path: "check.kind", operator: "eq", value: "death_save" }],
        operations: [{ type: "modify", path: "check.deathSavePower", mode: "add", value: 2 }],
      }],
      rules: [],
      mechanics: { deathSavePowerBonus: 2 },
    },

    devil_lineage_demon_wing: {
      schemaVersion: 1,
      id: "devil_lineage_demon_wing",
      name: "Demon Wing",
      description: "Gain Flight and +1 Max Speed.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 1 },
      ],
      mechanics: { capabilities: ["flight"], maxSpeedFinalBonus: 1 },
    },

    devil_lineage_improved_devil_strength: {
      schemaVersion: 1,
      id: "devil_lineage_improved_devil_strength",
      name: "Improved Devil Strength",
      description: "While having Rage, On Hit apply 3 Burn Potency and On Critical apply 1 Burn Count.",
      source,
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [
        { type: "status", trigger: "on_hit", target: "target", action: "inflict", statusId: "burn", potency: 3, count: 0, whileStatus: "rage" },
        { type: "status", trigger: "on_crit", target: "target", action: "inflict", statusId: "burn", potency: 0, count: 1, whileStatus: "rage" },
      ],
    },

    devil_lineage_improved_demonic_resistance: {
      schemaVersion: 1,
      id: "devil_lineage_improved_demonic_resistance",
      name: "Improved Demonic Resistance",
      description: "Quick Action: Spend 1 Recover Slot and perform that Recover immediately. The used Recover Slot becomes Blocked until 2 Long Rests are completed.",
      source,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "quick_action" },
      effects: [],
      rules: [],
      mechanics: {
        spendRecoverSlot: 1,
        performRecoverImmediately: true,
        blockUsedRecoverSlotLongRests: 2,
      },
    },

    devil_lineage_demonic_regeneration: {
      schemaVersion: 1,
      id: "devil_lineage_demonic_regeneration",
      name: "Demonic Regeneration",
      description: "Lost body parts regenerate after 3 Days if the character remains at 1 HP or higher. Restore Equipment Slots blocked by that lost body part when it regenerates.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        bodyPartRegenerationDays: 3,
        bodyPartRegenerationHours: 72,
        minimumHpDuringRegeneration: 1,
        restoreBlockedEquipmentSlots: true,
      },
    },

    devil_lineage_demon_wings: {
      schemaVersion: 1,
      id: "devil_lineage_demon_wings",
      name: "Demon Wings",
      description: "Gain Flight, +3 Max Speed and +1 Min Speed.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 2 },
        { type: "modifier", trigger: "passive", target: "self", channel: "min_speed", mode: "add", value: 1 },
      ],
      mechanics: { capabilities: ["flight"], maxSpeedFinalBonus: 3, minSpeedFinalBonus: 1, upgradesTraitId: "devil_lineage_demon_wing" },
    },

    devil_lineage_power_of_the_nine_hells: {
      schemaVersion: 1,
      id: "devil_lineage_power_of_the_nine_hells",
      name: "Power of the Nine Hells",
      description: "Gain +6 Active Inventory. Strength Checks have Threshold -3. On Hit, STR Skills deal (STR Mod × 2)% Fixed Damage.",
      source,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        activeInventoryBonus: 6,
        strengthCheckThreshold: -3,
        onHitStrengthFixedDamagePercentFormula: "StrengthMod * 2",
        upgradesTraitId: "devil_lineage_devil_strength",
      },
    },

    devil_lineage_cursed_juggernaut: {
      schemaVersion: 1,
      id: "devil_lineage_cursed_juggernaut",
      name: "Cursed Juggernaut",
      description: "While having Rage, HP cannot be reduced below 1. Once per Encounter, when Damage or an Effect would reduce HP to 1 or less, set HP to 1 and mark a recovery. At the next Turn Start, Recover Max(14, 14 × CON Mod)% Max HP even if other healing already raised HP.",
      source,
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        whileStatus: "rage",
        minimumHp: 1,
        triggerAtOrBelowHp: 1,
        recoveryScope: "encounter",
        recoveryTiming: "next_turn_start",
        recoveryPercentFormula: "max(14, 14 * ConstitutionMod)",
        pendingRecoveryPersistsAfterHealing: true,
      },
    },

    psychic_blade: {
      schemaVersion: 1,
      id: "psychic_blade",
      name: "Psychic Blade",
      description: "[On Use] Consume 1 Bardic Inspiration to Gain ((CHA Mod)+(Bard Level/20)) Psychic Blade. [On Hit] Reduce SP by ((CHA Mod/2)+(Bard Level/25)), then reduce Count by 1.",
      source: whispersSource,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        consumeTraitUse: { traitId: "bardic_inspiration", amount: 1 },
        gainCountFormula: "CharismaMod + ClassLevel / 20",
        onHitSpReductionFormula: "CharismaMod / 2 + ClassLevel / 25",
      },
    },

    words_of_terror: {
      schemaVersion: 1,
      id: "words_of_terror",
      name: "Words of Terror",
      description: "[On Use] Target makes a WIS Save against your Spell DC. On Fail, Inflict Frightened.",
      source: whispersSource,
      contexts: ["any"],
      activation: { type: "manual", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        save: { abilityId: "wis", dc: "SpellDC", onFailStatusId: "frightened" },
      },
    },

    mantle_of_whispers: {
      schemaVersion: 1,
      id: "mantle_of_whispers",
      name: "Mantle of Whispers",
      description: "[On Encounter] When a Humanoid dies, choose to absorb its Shadow to Gain Shadow of [Unit or Character Name]. (Once Per Long Rest) Shadow of [Unit or Character Name]: [On Use] Consume Stored Shadow to assume its Identity for 1 Hour. [While Disguised] Gain +5 Deception Power against Insight Checks. [On Long Rest] If Stored Shadow was not consumed, lose it.",
      source: whispersSource,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        trigger: "humanoid_death",
        acquireScope: "long_rest",
        dynamicEffectName: "Shadow of [Unit or Character Name]",
        storedShadowMax: 1,
        assumedIdentityHours: 1,
        deceptionPowerAgainstInsight: 5,
        unusedShadowExpiresOnLongRest: true,
      },
    },

    shadow_lore: {
      schemaVersion: 1,
      id: "shadow_lore",
      name: "Shadow Lore",
      description: "[On Use] Target makes a WIS Save against your Spell DC. On Fail, Inflict Charmed for 8 Hours. (Once Per Long Rest) While Charmed by Shadow Lore, the Target believes you know its darkest secret and treats you as a trusted ally out of fear of exposure. The Target will not willingly risk its life unless it was already inclined to do so. Shadow Lore ends if you or your Allies attack or damage the Target. You do not learn the Target's secret.",
      source: whispersSource,
      contexts: ["any"],
      activation: { type: "manual", actionCost: "none", uses: { max: 1, reset: "long_rest" } },
      effects: [],
      rules: [],
      mechanics: {
        save: { abilityId: "wis", dc: "SpellDC", onFailStatusId: "charmed" },
        durationHours: 8,
        believesDarkestSecretKnown: true,
        treatsCasterAsTrustedAlly: true,
        willNotRiskLifeUnlessAlreadyInclined: true,
        endsIfCasterOrAlliesDamageTarget: true,
        casterLearnsSecret: false,
      },
    },
  });

  function archetypeGrant(atLevel, traitId, archetypeId, classId, traitSource) {
    return {
      sourceType: "archetype",
      sourceId: archetypeId,
      archetypeId,
      classId,
      atLevel,
      traitId,
      source: { ...traitSource, atLevel, requiredClassLevel: atLevel },
    };
  }

  const GRANTS = deepFreeze([
    archetypeGrant(15, "devil_lineage_devil_strength", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(15, "devil_lineage_infernal_speed", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(15, "devil_lineage_demonic_resistance", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(15, "devil_lineage_jackpot", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(30, "devil_lineage_infernal_touch", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(50, "devil_lineage_supernatural_endurance", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(50, "devil_lineage_demon_wing", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(50, "devil_lineage_improved_devil_strength", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(50, "devil_lineage_improved_demonic_resistance", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(70, "devil_lineage_demonic_regeneration", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(70, "devil_lineage_demon_wings", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(70, "devil_lineage_power_of_the_nine_hells", ARCHETYPE_ID, CLASS_ID, source),
    archetypeGrant(70, "devil_lineage_cursed_juggernaut", ARCHETYPE_ID, CLASS_ID, source),

    archetypeGrant(15, "psychic_blade", COLLEGE_OF_WHISPERS_ID, COLLEGE_OF_WHISPERS_CLASS_ID, whispersSource),
    archetypeGrant(15, "words_of_terror", COLLEGE_OF_WHISPERS_ID, COLLEGE_OF_WHISPERS_CLASS_ID, whispersSource),
    archetypeGrant(30, "mantle_of_whispers", COLLEGE_OF_WHISPERS_ID, COLLEGE_OF_WHISPERS_CLASS_ID, whispersSource),
    archetypeGrant(70, "shadow_lore", COLLEGE_OF_WHISPERS_ID, COLLEGE_OF_WHISPERS_CLASS_ID, whispersSource),
  ]);

  function allDefinitions() {
    return { ...DEFINITIONS };
  }

  function allGrants() {
    return GRANTS.map((grant) => ({ ...grant, source: { ...(grant.source || {}) } }));
  }

  function allArchetypes() {
    return { ...ARCHETYPES };
  }

  function getDefinition(id) {
    const key = String(id ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    return DEFINITIONS[key] || null;
  }

  function resolveTraitGrants(character = {}, definitions = allDefinitions()) {
    return archetypeEngine.resolveTraitGrants(character, GRANTS, definitions, ARCHETYPES, global.LuminousTraitEngine || traitEngine);
  }

  function ensureRuntime(id, src, ready) {
    const doc = global.document;
    if (!doc || ready?.() || doc.getElementById?.(id)) return null;
    const script = doc.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    doc.head?.appendChild(script);
    return script;
  }

  function ensureDevilLineageRuntime() {
    return ensureRuntime("devil-lineage-runtime-script", "js/devil-lineage-runtime.js", () => Boolean(global.LuminousDevilLineageRuntime));
  }

  function ensureCollegeOfWhispersRuntime() {
    return ensureRuntime("college-of-whispers-runtime-script", "js/college-of-whispers-runtime.js", () => Boolean(global.LuminousCollegeOfWhispersRuntime));
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    CLASS_ID,
    COLLEGE_OF_WHISPERS_ID,
    COLLEGE_OF_WHISPERS_CLASS_ID,
    ARCHETYPES,
    DEFINITIONS,
    GRANTS,
    allDefinitions,
    allGrants,
    allArchetypes,
    getDefinition,
    resolveTraitGrants,
    ensureDevilLineageRuntime,
    ensureCollegeOfWhispersRuntime,
  });

  global.LuminousArchetypeTraitCatalog = api;
  ensureDevilLineageRuntime();
  ensureCollegeOfWhispersRuntime();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
