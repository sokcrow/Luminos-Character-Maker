(function (global) {
  "use strict";

  const archetypeEngine = global.LuminousArchetypeEngine || (typeof require === "function" ? require("./archetype-engine.js") : null);
  const traitEngine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  if (!archetypeEngine) return;

  const ARCHETYPE_ID = "path_of_the_devil_lineage";
  const CLASS_ID = "barbarian";

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
  });

  const source = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: "Path of the Devil Lineage",
    classId: CLASS_ID,
    className: "Barbarian",
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
  });

  const GRANTS = deepFreeze([
    [15, "devil_lineage_devil_strength"],
    [15, "devil_lineage_infernal_speed"],
    [15, "devil_lineage_demonic_resistance"],
    [15, "devil_lineage_jackpot"],
    [30, "devil_lineage_infernal_touch"],
    [50, "devil_lineage_supernatural_endurance"],
    [50, "devil_lineage_demon_wing"],
    [50, "devil_lineage_improved_devil_strength"],
    [50, "devil_lineage_improved_demonic_resistance"],
    [70, "devil_lineage_demonic_regeneration"],
    [70, "devil_lineage_demon_wings"],
    [70, "devil_lineage_power_of_the_nine_hells"],
    [70, "devil_lineage_cursed_juggernaut"],
  ].map(([atLevel, traitId]) => ({
    sourceType: "archetype",
    sourceId: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    classId: CLASS_ID,
    atLevel,
    traitId,
    source: { ...source, atLevel, requiredClassLevel: atLevel },
  })));

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

  function ensureDevilLineageRuntime() {
    const doc = global.document;
    if (!doc || global.LuminousDevilLineageRuntime || doc.getElementById?.("devil-lineage-runtime-script")) return null;
    const script = doc.createElement("script");
    script.id = "devil-lineage-runtime-script";
    script.src = "js/devil-lineage-runtime.js";
    script.async = false;
    doc.head?.appendChild(script);
    return script;
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    CLASS_ID,
    ARCHETYPES,
    DEFINITIONS,
    GRANTS,
    allDefinitions,
    allGrants,
    allArchetypes,
    getDefinition,
    resolveTraitGrants,
    ensureDevilLineageRuntime,
  });

  global.LuminousArchetypeTraitCatalog = api;
  ensureDevilLineageRuntime();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
