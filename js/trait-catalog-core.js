(function (global) {
  "use strict";

  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const CATALOG_VERSION = 1;

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const DEFINITIONS = deepFreeze({
    danger_senses: {
      schemaVersion: 1,
      id: "danger_senses",
      name: "Danger Senses",
      description: "Reduce Dexterity check Difficulty by 4 before the roll resolves.",
      source: { type: "class", id: "barbarian", classId: "barbarian" },
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "danger_senses_dex_check",
        contexts: ["theatre"],
        trigger: "before_check",
        conditions: [{ path: "check.abilityId", operator: "eq", value: "dex" }],
        operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
      }],
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

    rage: {
      schemaVersion: 1,
      id: "rage",
      name: "Rage",
      description: "Spend a Quick Action to enter Rage. Uses scale with Barbarian ClassLevel and reset on Long Rest.",
      source: { type: "class", id: "barbarian", classId: "barbarian" },
      contexts: ["combat"],
      activation: {
        type: "manual",
        actionCost: "quick_action",
        uses: { formula: "floor(ClassLevel / 7)", reset: "long_rest" },
        conditions: [{ statusId: "rage", operator: "falsy" }],
      },
      effects: [{
        id: "rage_activate",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [],
        operations: [{ type: "apply_status", statusId: "rage", duration: "until_removed" }],
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

  // Grants are progression data, not mechanical definitions. Only keep a Grant
  // when its source requires no guessed class level. Class acquisition levels
  // remain DM-authored until the original progression is explicitly confirmed.
  const GRANTS = deepFreeze([
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
    });

    return { valid: !errors.length, errors, warnings };
  }

  const api = Object.freeze({
    CATALOG_VERSION,
    DEFINITIONS,
    GRANTS,
    allDefinitions,
    allGrants,
    getDefinition,
    validateAll,
  });

  global.LuminousTraitCatalogCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
