(function (global) {
  "use strict";

  if (global.LuminousMonkClassRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMonkClassRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const weaponProperties = global.LuminousWeaponPropertyRuntime || safeRequire("./weapon-property-runtime.js");
  const CLASS_ID = "monk";
  const CLASS_NAME = "Monk";
  const CATALOG_VERSION = 1;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const MONK_SOURCE = Object.freeze({ type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME });
  const unarmoredConditions = Object.freeze([
    Object.freeze({ path: "equipment.armorEquipped", operator: "falsy" }),
    Object.freeze({ path: "equipment.shield", operator: "falsy" }),
  ]);

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const MONK_DEFINITIONS = deepFreeze({
    unarmored_defense: {
      schemaVersion: 1,
      id: "unarmored_defense",
      name: "Unarmored Defense",
      description: "While not wearing Armor or using a Shield:\nGain (WIS Mod) Defensive Level.\nGain (WIS Mod) Defense Power.\nRemove 1 Stagger Threshold.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "defensive_level",
          mode: "add",
          formula: "WisdomMod",
          conditions: unarmoredConditions,
        },
        {
          type: "modifier",
          trigger: "passive",
          target: "self",
          channel: "defense_power",
          mode: "add",
          formula: "WisdomMod",
          conditions: unarmoredConditions,
        },
        {
          type: "stagger_threshold",
          trigger: "passive",
          target: "self",
          action: "remove",
          count: 1,
          scope: "permanent",
          conditions: unarmoredConditions,
        },
      ],
      mechanics: {
        requiresNoArmor: true,
        requiresNoShield: true,
        defensiveLevelFormula: "WisdomMod",
        defensePowerFormula: "WisdomMod",
        staggerThresholdsRemoved: 1,
      },
    },
    martial_arts: {
      schemaVersion: 1,
      id: "martial_arts",
      name: "Martial Arts",
      description: "While not wearing Armor or using a Shield:\nAfter using a Melee Attack Skill with an Unarmed Attack or Monk Weapon:\nSelect a target to use a Tier 1 Unarmed Attack Skill.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        requiresNoArmor: true,
        requiresNoShield: true,
        trigger: "after_melee_attack_skill",
        followUpTier: 1,
        followUpSkillFamily: "unarmed",
        targetSelectionRequired: true,
      },
    },
  });

  const monkGrant = (level, traitId) => ({
    id: `core_class_monk_l${level}_${traitId}`,
    sourceType: "class",
    sourceId: CLASS_ID,
    source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level },
    atLevel: level,
    traitId,
    grantType: "trait",
    multiclassPolicy: "allowed",
  });

  const MONK_GRANTS = deepFreeze([
    monkGrant(1, "unarmored_defense"),
    monkGrant(1, "martial_arts"),
  ]);

  function grantIdentity(grant = {}) {
    return `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.atLevel}`;
  }

  function isUnarmored(character = {}, modifiers = global.LuminousUniversalModifiers) {
    const equipment = modifiers?.resolveEquipment ? modifiers.resolveEquipment(character) : (character.equipment || {});
    return !equipment?.armorEquipped && !equipment?.shield;
  }

  function isUnarmedAttack(skill = {}) {
    const tags = [
      ...(Array.isArray(skill.tags) ? skill.tags : []),
      ...(Array.isArray(skill.metadata?.tags) ? skill.metadata.tags : []),
    ].map(normalizeId);
    return skill.isUnarmed === true
      || normalizeId(skill.weaponFamily || skill.weapon_family) === "unarmed"
      || tags.includes("unarmed")
      || tags.includes("unarmed_attack");
  }

  function isMonkWeapon(weapon = {}) {
    if (!weapon || typeof weapon !== "object") return false;
    const properties = new Set(weaponProperties?.resolveWeaponProperties?.(weapon) || weapon.properties || []);
    if (properties.has("heavy") || properties.has("two_handed")) return false;
    const classification = normalizeId(weapon.classification);
    const id = normalizeId(weapon.chassisId || weapon.definitionId || weapon.id);
    return classification === "simple_melee" || id === "shortsword";
  }

  function martialArtsEligibleAttack(skill = {}, weapon = {}) {
    const family = normalizeId(skill.skillFamily || skill.skill_family || skill.type);
    const mode = normalizeId(skill.attackMode || skill.attack_mode || (skill.isRanged ? "ranged" : "melee"));
    const isAttack = family === "attack" || normalizeId(skill.type) === "attack" || skill.isAttack === true;
    if (!isAttack || mode !== "melee") return false;
    return isUnarmedAttack(skill) || isMonkWeapon(weapon);
  }

  function martialArtsFollowUp(character = {}, skill = {}, weapon = {}, options = {}) {
    if (!isUnarmored(character, options.modifiers)) return { available: false, reason: "requires_unarmored_and_no_shield" };
    if (!martialArtsEligibleAttack(skill, weapon)) return { available: false, reason: "requires_unarmed_or_monk_weapon_melee_attack" };
    return {
      available: true,
      tier: 1,
      skillFamily: "unarmed",
      targetSelectionRequired: true,
      sourceTraitId: "martial_arts",
    };
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || safeRequire("./trait-catalog-core.js");
    if (!source) return false;
    if (source.__monkClassExtended) return true;

    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));

    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(MONK_DEFINITIONS) });
    const allGrants = () => {
      const combined = [...baseGrants(), ...clone(MONK_GRANTS)];
      const seen = new Set();
      return combined.filter((item) => {
        const identity = grantIdentity(item);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
    };
    const getDefinition = (id) => clone(MONK_DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const base = baseValidate(engine);
      const errors = [...(base.errors || [])];
      const warnings = [...(base.warnings || [])];
      Object.entries(MONK_DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) return;
        const validation = engine.validateTrait(definition);
        validation.errors.forEach((message) => errors.push(`${key}: ${message}`));
        validation.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      });
      return { valid: base.valid !== false && !errors.length, errors, warnings };
    };

    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __monkClassExtended: true,
      CATALOG_VERSION: Math.max(CATALOG_VERSION, Number(source.CATALOG_VERSION || 0)),
      DEFINITIONS: Object.freeze(allDefinitions()),
      GRANTS: Object.freeze(allGrants()),
      allDefinitions,
      allGrants,
      getDefinition,
      validateAll,
    });
    return true;
  }

  function install() {
    return wrapCatalog();
  }

  const API = Object.freeze({
    CLASS_ID,
    CLASS_NAME,
    CATALOG_VERSION,
    MONK_DEFINITIONS,
    MONK_GRANTS,
    isUnarmored,
    isUnarmedAttack,
    isMonkWeapon,
    martialArtsEligibleAttack,
    martialArtsFollowUp,
    wrapCatalog,
    install,
  });

  global.LuminousMonkClassRuntime = API;
  install();
  if (!global.document && typeof queueMicrotask === "function") queueMicrotask(install);
  if (global.document && global.setInterval) {
    const timer = global.setInterval(() => {
      if (install()) global.clearInterval?.(timer);
    }, 800);
    timer?.unref?.();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
