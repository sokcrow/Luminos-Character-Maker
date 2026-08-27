(function (global) {
  "use strict";

  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const CATALOG_VERSION = 5;

  const RULE_TYPES = Object.freeze([
    "modifier",
    "status",
    "restriction",
    "resource",
    "coin",
    "check",
    "counter",
    "stagger_threshold",
    "status_protection",
    "stat",
    "speed_override",
  ]);
  const RULE_TARGETS = Object.freeze(["self", "target"]);
  const RULE_SCOPES = Object.freeze(["immediate", "once_per_turn", "once_per_skill", "next_skill", "encounter", "long_rest", "permanent"]);
  const MODIFIER_CHANNELS = Object.freeze([
    "damage_dealt_multiplier",
    "damage_taken_multiplier",
    "healing_multiplier",
    "final_power",
    "base_power",
    "defense_power",
    "clash_power",
    "offensive_level",
    "defensive_level",
    "speed",
    "min_speed",
    "max_speed",
    "resource",
    "coin_power",
    "crit_damage_multiplier",
  ]);

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const classSource = Object.freeze({ type: "class", id: "barbarian", classId: "barbarian" });

  const DEFINITIONS = deepFreeze({
    armorless_defense: {
      schemaVersion: 1,
      id: "armorless_defense",
      name: "Armorless Defense",
      description: "Without Armor:\nGain +(1, Constitution Mod) Defensive Level.\n\n[On Encounter Start] Without Armor:\nGain (Class Level)% Max HP as Shield for encounter\n\nRemove 1 Stagger Threshold.",
      source: classSource,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      mechanics: {
        defensiveLevelFormula: "max(1, ConstitutionMod)",
        encounterShieldPercentFormula: "ClassLevel",
        encounterShieldAmountFormula: "MaxHP * ClassLevel / 100",
        encounterShieldType: "encounter",
      },
      effects: [{
        id: "armorless_defense_encounter_shield",
        contexts: ["combat"],
        trigger: "encounter_start",
        conditions: [{ path: "equipment.armorEquipped", operator: "falsy" }],
        operations: [
          { type: "modify", path: "self.shieldPools.encounter", mode: "add", formula: "MaxHP * ClassLevel / 100" },
          { type: "modify", path: "self.shield", mode: "add", formula: "MaxHP * ClassLevel / 100" },
        ],
      }],
      rules: [
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "defensive_level",
          mode: "add",
          formula: "max(1, ConstitutionMod)",
          conditions: [{ path: "equipment.armorEquipped", operator: "falsy" }],
        },
        {
          type: "stagger_threshold",
          trigger: "passive",
          target: "self",
          action: "remove",
          count: 1,
          scope: "permanent",
          conditions: [{ path: "equipment.armorEquipped", operator: "falsy" }],
        },
      ],
    },

    rage: {
      schemaVersion: 1,
      id: "rage",
      name: "Rage",
      description: "Spend a Quick Action to gain Rage. Uses and Rage scaling use Barbarian Class Level, not total Character Level or Offensive Level. Uses are always at least 1 and reset on Long Rest.",
      source: classSource,
      contexts: ["combat"],
      activation: {
        type: "manual",
        actionCost: "quick_action",
        uses: { formula: "max(1, floor(ClassLevel / 7))", reset: "long_rest" },
        conditions: [{ statusId: "rage", operator: "falsy" }],
      },
      effects: [{
        id: "rage_activate",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "apply_status", statusId: "rage", duration: "until_removed" }],
      }],
      rules: [
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "damage_taken_multiplier",
          mode: "add",
          value: 50,
          unit: "percent_reduction",
          whileStatus: "rage",
          conditions: [{ any: [
            { path: "skill.attackType", operator: "in", value: ["Slash", "Pierce", "Blunt"] },
            { path: "skill.damageType", operator: "in", value: ["Slash", "Pierce", "Blunt"] },
          ] }],
        },
        { type: "restriction", trigger: "passive", target: "self", restriction: "spell_skills", whileStatus: "rage" },
        { type: "resource", trigger: "turn_end", target: "self", resourceId: "sp", mode: "lose", value: 5, whileStatus: "rage" },
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "damage_dealt_multiplier",
          mode: "add",
          formula: "ClassLevel",
          unit: "percent",
          whileStatus: "rage",
        },
        { type: "resource", trigger: "skill_resource_gain", target: "self", resourceId: "wrath", mode: "gain", value: 1, whileStatus: "rage", conditions: [{ any: [
          { path: "skill.affinity", operator: "eq", value: "Wrath" },
          { path: "skill.sinAffinity", operator: "eq", value: "Wrath" },
        ] }] },
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "final_power",
          mode: "add",
          formula: "floor(ClassLevel / 30)",
          whileStatus: "rage",
          conditions: [{ any: [
            { path: "skill.affinity", operator: "eq", value: "Wrath" },
            { path: "skill.sinAffinity", operator: "eq", value: "Wrath" },
          ] }],
        },
      ],
    },

    reckless_attack: {
      schemaVersion: 1,
      id: "reckless_attack",
      name: "Reckless Attack",
      description: "Quick Action, once per Turn. The next Skill makes all Coins Red; Coins already Red gain +1 Coin Power. On Hit with that Skill, gain 1 Fragile.",
      source: classSource,
      contexts: ["combat"],
      activation: {
        type: "manual",
        actionCost: "quick_action",
        uses: { formula: "1", reset: "turn" },
      },
      effects: [{
        id: "reckless_attack_arm",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "apply_status", statusId: "reckless_attack_armed", duration: "next_skill" }],
      }],
      rules: [
        { type: "coin", trigger: "before_skill", action: "set_type", target: "self", coinType: "unbreakable", displayType: "red", scope: "next_skill", whileStatus: "reckless_attack_armed", alreadyTypePowerBonus: 1 },
        { type: "status", trigger: "on_hit", action: "gain", target: "self", statusId: "fragile", count: 1, scope: "next_skill", whileStatus: "reckless_attack_armed" },
        { type: "status", trigger: "attack_end", action: "remove", target: "self", statusId: "reckless_attack_armed" },
      ],
    },

    danger_senses: {
      schemaVersion: 1,
      id: "danger_senses",
      name: "Danger Senses",
      description: "Reduce Dexterity check Difficulty by 4 before the roll resolves.",
      source: classSource,
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "danger_senses_dex_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.abilityId", operator: "eq", value: "dex" }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
      rules: [],
    },

    additional_attack: {
      schemaVersion: 1,
      id: "additional_attack",
      name: "Additional Attack",
      description: "Melee Attack Skills with 2 or 3 Coins reuse the Skill's last Coin once per Skill.",
      source: classSource,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "coin",
        trigger: "before_skill",
        action: "reuse_last",
        target: "self",
        count: 1,
        scope: "once_per_skill",
        conditions: [
          { any: [
            { all: [
              { path: "skill.skillFamily", operator: "eq", value: "attack" },
              { path: "skill.attackMode", operator: "eq", value: "melee" },
            ] },
            { path: "skill.isMelee", operator: "truthy" },
          ] },
          { path: "skill.coinAmount", operator: "between", value: 2, max: 3 },
        ],
      }],
    },

    fast_movement: {
      schemaVersion: 1,
      id: "fast_movement",
      name: "Fast Movement",
      description: "Gain +1 Min Speed.",
      source: classSource,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "min_speed", mode: "add", value: 1 }],
    },

    wild_instincts: {
      schemaVersion: 1,
      id: "wild_instincts",
      name: "Wild Instincts",
      description: "At Encounter Start gain STR Mod Haste. While Surprised, Speed is not Halved.",
      source: classSource,
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "wild_instincts_haste",
        contexts: ["combat"],
        trigger: "encounter_start",
        conditions: [],
        operations: [{ type: "apply_status", statusId: "haste", count: { formula: "StrengthMod" }, duration: "encounter" }],
      }],
      rules: [
        { type: "speed_override", trigger: "passive", target: "self", action: "ignore_halving", whileStatus: "surprised" },
      ],
    },

    brutal_critical: {
      schemaVersion: 1,
      id: "brutal_critical",
      name: "Brutal Critical",
      description: "Deal floor(Barbarian Class Level / 2)% additional Crit Damage.",
      display: {
        playerDescription: "Deal {critDamage} additional Crit Damage.",
        resolvedValues: [
          { id: "critDamage", label: "Additional Crit Damage", formula: "floor(ClassLevel / 2)", unit: "percent", signed: true },
        ],
      },
      source: classSource,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "crit_damage_multiplier",
        mode: "add",
        formula: "floor(ClassLevel / 2)",
        unit: "percent",
      }],
    },

    unstoppable_rage: {
      schemaVersion: 1,
      id: "unstoppable_rage",
      name: "Unstoppable Rage",
      description: "While Raging, at 0 HP make a CON Check starting at Threshold 10. On a pass regain floor(Barbarian Class Level / 3)% HP. Every trigger raises this Trait Threshold by 5; only Long Rest resets it to 10.",
      display: {
        playerDescription: "While Raging, at 0 HP make a CON Check starting at Threshold 10. On a pass regain {recovery} HP. Every trigger raises this Trait Threshold by 5; only Long Rest resets it to 10.",
        resolvedValues: [
          { id: "recovery", label: "HP Recovery", formula: "floor(ClassLevel / 3)", unit: "percent" },
        ],
      },
      source: classSource,
      contexts: ["combat", "theatre"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [
        {
          type: "check",
          trigger: "hp_zero",
          target: "self",
          abilityId: "con",
          threshold: { stateKey: "unstoppable_rage_threshold", initial: 10 },
          whileStatus: "rage",
          onPass: [{ type: "modifier", target: "self", path: "hpPercent", mode: "regain", formula: "floor(ClassLevel / 3)" }],
        },
        {
          type: "counter",
          trigger: "after_trigger",
          target: "self",
          stateKey: "unstoppable_rage_threshold",
          initial: 10,
          mode: "add",
          value: 5,
          reset: "long_rest",
        },
      ],
    },

    persistent_rage: {
      schemaVersion: 1,
      id: "persistent_rage",
      name: "Persistent Rage",
      description: "Rage cannot be lost by effects.",
      source: classSource,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "status_protection", trigger: "passive", target: "self", statusId: "rage", from: "effects" }],
    },

    unstoppable_strength: {
      schemaVersion: 1,
      id: "unstoppable_strength",
      name: "Unstoppable Strength",
      description: "On a failed Coin in a Strength or Athletics Check, re-toss the last failed Coin floor(STR Mod / 2) times.",
      source: classSource,
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "coin",
        trigger: "check_coin_fail",
        action: "retoss_last",
        target: "self",
        formula: "floor(StrengthMod / 2)",
        conditions: [
          { path: "check.abilityId", operator: "eq", value: "str" },
          { any: [
            { path: "check.kind", operator: "in", value: ["ability", "skill"] },
            { path: "check.kind", operator: "falsy" },
          ] },
        ],
      }],
    },

    primordial_champion: {
      schemaVersion: 1,
      id: "primordial_champion",
      name: "Primordial Champion",
      description: "Strength and Constitution gain +4 and their maximum becomes 24.",
      source: classSource,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "stat", trigger: "passive", target: "self", statId: "strength", value: 4, max: 24, scope: "permanent" },
        { type: "stat", trigger: "passive", target: "self", statId: "constitution", value: 4, max: 24, scope: "permanent" },
      ],
    },

    green_eyed_heir: {
      schemaVersion: 1,
      id: "green_eyed_heir",
      name: "Green Eyed Heir",
      description: "Gain +2 Final Power on Insight and Perception checks.",
      source: { type: "special", id: "" },
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "green_eyed_heir_awareness",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.skillId", operator: "in", value: ["insight", "perception"] }],
        operations: [{ type: "modify", path: "check.finalPower", mode: "add", value: 2 }],
      }],
    },

    devil_body: {
      schemaVersion: 1,
      id: "devil_body",
      name: "Devil Body",
      description: "At Turn Start, heal HP equal to floor(DefensiveLevel / 2), capped by Max HP.",
      source: { type: "lineage", id: "devil_lineage" },
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [{
        id: "devil_body_regeneration",
        contexts: ["combat"],
        trigger: "turn_start",
        conditions: [],
        operations: [{
          type: "heal_hp",
          path: "self.currentHp",
          maxPath: "self.maxHp",
          formula: "floor(DefensiveLevel / 2)",
        }],
      }],
    },

    devil_trigger: {
      schemaVersion: 1,
      id: "devil_trigger",
      name: "Devil Trigger",
      description: "Consume all Devil Gauge on use and evaluate threshold effects from the consumed amount.",
      source: { type: "special", id: "" },
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "none" },
      effects: [
        {
          id: "devil_trigger_consume_gauge",
          contexts: ["combat"],
          trigger: "on_use",
          conditions: [],
          operations: [{
            type: "resource",
            resourceId: "devil_gauge",
            mode: "consume_all",
            storeAs: "ConsumedGauge",
          }],
        },
        {
          id: "devil_trigger_threshold_7",
          contexts: ["combat"],
          trigger: "on_use",
          conditions: [{ formula: "ConsumedGauge", operator: "gte", value: 7 }],
          operations: [{ type: "modify", path: "self.damagePercent", mode: "add", formula: "OffensiveLevel" }],
        },
      ],
    },
  });

  const barbarianGrant = (level, traitId) => ({
    id: `core_class_barbarian_l${level}_${traitId}`,
    sourceType: "class",
    sourceId: "barbarian",
    atLevel: level,
    traitId,
    grantType: "trait",
    multiclassPolicy: "allowed",
  });

  const GRANTS = deepFreeze([
    barbarianGrant(1, "armorless_defense"),
    barbarianGrant(1, "rage"),
    barbarianGrant(10, "reckless_attack"),
    barbarianGrant(10, "danger_senses"),
    barbarianGrant(25, "additional_attack"),
    barbarianGrant(25, "fast_movement"),
    barbarianGrant(35, "wild_instincts"),
    barbarianGrant(45, "brutal_critical"),
    barbarianGrant(55, "unstoppable_rage"),
    barbarianGrant(75, "persistent_rage"),
    barbarianGrant(90, "unstoppable_strength"),
    barbarianGrant(100, "primordial_champion"),
    {
      id: "core_lineage_devil_lineage_devil_body",
      sourceType: "lineage",
      sourceId: "devil_lineage",
      traitId: "devil_body",
    },
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function validateRules(definition = {}) {
    const errors = [];
    const rules = Array.isArray(definition.rules) ? definition.rules : [];
    rules.forEach((rule, index) => {
      const label = `${definition.id || definition.name || "trait"} rule ${index + 1}`;
      if (!RULE_TYPES.includes(rule?.type)) errors.push(`${label}: unsupported rule type ${rule?.type || "<missing>"}.`);
      if (rule?.target && !RULE_TARGETS.includes(rule.target)) errors.push(`${label}: unsupported target ${rule.target}.`);
      if (rule?.scope && !RULE_SCOPES.includes(rule.scope)) errors.push(`${label}: unsupported scope ${rule.scope}.`);
      if (rule?.type === "modifier" && rule.channel && !MODIFIER_CHANNELS.includes(rule.channel)) errors.push(`${label}: unsupported modifier channel ${rule.channel}.`);
      if (rule?.type === "status" && !rule.statusId) errors.push(`${label}: status rule requires statusId.`);
      if (rule?.type === "status" && rule.action === "gain" && rule.target !== "self") errors.push(`${label}: Gain must target self.`);
      if (rule?.type === "status" && rule.action === "inflict" && rule.target !== "target") errors.push(`${label}: Inflict must target target.`);
      if (rule?.type === "counter" && rule.reset !== "long_rest" && rule.stateKey === "unstoppable_rage_threshold") errors.push(`${label}: Unstoppable Rage Threshold may only reset on long_rest.`);
      if (rule?.type === "coin" && !rule.action) errors.push(`${label}: coin rule requires action.`);
      if (rule?.type === "check" && !rule.abilityId) errors.push(`${label}: check rule requires abilityId.`);
      if (rule?.type === "stat" && (!rule.statId || rule.max == null)) errors.push(`${label}: stat rule requires statId and max.`);
    });
    return { valid: !errors.length, errors };
  }

  function allDefinitions() {
    return clone(DEFINITIONS);
  }

  function allGrants() {
    return clone(GRANTS);
  }

  function getDefinition(id) {
    const key = engine?.normalizeId ? engine.normalizeId(id) : String(id ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    return clone(DEFINITIONS[key] || null);
  }

  function validateAll(customEngine = engine) {
    const errors = [];
    const warnings = [];
    if (!customEngine?.validateTrait) return { valid: false, errors: ["Trait Engine is not available."], warnings };

    Object.entries(DEFINITIONS).forEach(([key, definition]) => {
      const result = customEngine.validateTrait(definition);
      if (result.trait.id !== key) errors.push(`${key}: normalized id became ${result.trait.id}.`);
      result.errors.forEach((message) => errors.push(`${key}: ${message}`));
      result.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      validateRules(definition).errors.forEach((message) => errors.push(message));
    });

    const seenGrantIds = new Set();
    const seenIdentities = new Set();
    GRANTS.forEach((grant) => {
      if (!grant.id) errors.push("Core grant is missing deterministic id.");
      if (seenGrantIds.has(grant.id)) errors.push(`Duplicate core grant id: ${grant.id}`);
      seenGrantIds.add(grant.id);
      if (!DEFINITIONS[grant.traitId]) errors.push(`${grant.id}: missing Trait definition ${grant.traitId}.`);
      const identity = `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.sourceType === "class" ? grant.atLevel : 0}`;
      if (seenIdentities.has(identity)) errors.push(`Duplicate core grant identity: ${identity}`);
      seenIdentities.add(identity);
      if (grant.sourceType === "class" && !["allowed", "starting_class_only"].includes(grant.multiclassPolicy || "allowed")) errors.push(`${grant.id}: invalid multiclassPolicy.`);
    });

    return { valid: !errors.length, errors, warnings };
  }

  const api = Object.freeze({
    CATALOG_VERSION,
    RULE_TYPES,
    RULE_TARGETS,
    RULE_SCOPES,
    MODIFIER_CHANNELS,
    DEFINITIONS,
    GRANTS,
    allDefinitions,
    allGrants,
    getDefinition,
    validateRules,
    validateAll,
  });

  global.LuminousTraitCatalogCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined" && !global.LuminousTraitStandardizationRuntime && !document.getElementById("trait-standardization-runtime-script")) {
    const script = document.createElement("script");
    script.id = "trait-standardization-runtime-script";
    script.src = "js/trait-standardization-runtime.js";
    script.async = false;
    document.head?.appendChild(script);
  }

  if (typeof document !== "undefined" && !global.LuminousShieldDurationRuntime && !document.getElementById("shield-duration-runtime-script")) {
    const script = document.createElement("script");
    script.id = "shield-duration-runtime-script";
    script.src = "js/shield-duration-runtime.js";
    script.async = false;
    document.head?.appendChild(script);
  }

  if (typeof document !== "undefined" && !global.LuminousBarbarianClassRuntime && !document.getElementById("barbarian-class-runtime-script")) {
    const script = document.createElement("script");
    script.id = "barbarian-class-runtime-script";
    script.src = "js/barbarian-class-runtime.js";
    script.async = false;
    document.head?.appendChild(script);
  }
})(typeof window !== "undefined" ? window : globalThis);
