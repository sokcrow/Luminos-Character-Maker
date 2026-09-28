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
  const CATALOG_VERSION = 2;
  const STATE_ROOT = "classResources";
  const STATE_KEY = "monk";
  const KI_MAX = 20;
  const BASE_LANGUAGE_IDS = Object.freeze(["common","dwarvish","elvish","giant","gnomish","goblin","halfling","orc","abyssal","celestial","draconic","deep_speech","infernal","primordial","sylvan","undercommon"]);
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
        { type: "modifier", trigger: "passive", target: "self", channel: "defensive_level", mode: "add", formula: "WisdomMod", conditions: unarmoredConditions },
        { type: "modifier", trigger: "passive", target: "self", channel: "defense_power", mode: "add", formula: "WisdomMod", conditions: unarmoredConditions },
        { type: "stagger_threshold", trigger: "passive", target: "self", action: "remove", count: 1, scope: "permanent", conditions: unarmoredConditions },
      ],
      mechanics: { requiresNoArmor: true, requiresNoShield: true, defensiveLevelFormula: "WisdomMod", defensePowerFormula: "WisdomMod", staggerThresholdsRemoved: 1 },
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
      mechanics: { requiresNoArmor: true, requiresNoShield: true, trigger: "after_melee_attack_skill", followUpTier: 1, followUpSkillFamily: "unarmed", targetSelectionRequired: true },
    },
    ki: {
      schemaVersion: 1,
      id: "ki",
      name: "Ki",
      description: "[On Turn Start] Ki Pool Maximum = floor(Monk Class Level / 5) (Max 20).\nGain 1 Ki on Clash Win with an Unarmed Attack or Monk Weapon (Once per Skill).\nGain 1 Ki on a successful Evade (Once per Skill).\nAfter landing 3 Coins with Unarmed Attacks or Monk Weapons in the same Turn, gain 1 Ki.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { resourceId: "ki", maximumFormula: "min(20, floor(ClassLevel / 5))", gainOnClashWin: 1, clashWinOncePerSkill: true, gainOnEvade: 1, evadeOncePerSkill: true, landedCoinsPerKi: 3 },
    },
    flurry_of_blows: {
      schemaVersion: 1,
      id: "flurry_of_blows",
      name: "Flurry of Blows",
      description: "[On Use] Spend 3 Ki.\nUnarmed Attack Skills with 1 Coin: Reuse the Skill.\nUnarmed Attack Skills with 2+ Coins: Reuse the Skill's last Coin.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "none", target: "self" },
      effects: [],
      rules: [],
      mechanics: { kiCost: 3, skillFamily: "unarmed", oneCoinReuseSkill: true, multiCoinReuseLastCoin: 1 },
    },
    patient_defense: {
      schemaVersion: 1,
      id: "patient_defense",
      name: "Patient Defense",
      description: "[On Use] Spend 4 Ki.\nGain +6 Evade Power until Turn End.\nGain +40% Guard Shield until Turn End.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "none", target: "self" },
      effects: [],
      rules: [],
      mechanics: { kiCost: 4, evadePower: 6, guardShieldPercent: 40, duration: "this_turn" },
    },
    step_of_the_wind: {
      schemaVersion: 1,
      id: "step_of_the_wind",
      name: "Step of the Wind",
      description: "[On Use] Spend 3 Ki.\nGain +2 Haste Speed this Turn and next Turn.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "none", target: "self" },
      effects: [],
      rules: [],
      mechanics: { kiCost: 3, hasteSpeed: 2, durationTurns: 2 },
    },
    unarmored_movement: {
      schemaVersion: 1,
      id: "unarmored_movement",
      name: "Unarmored Movement",
      description: "While not wearing Armor or using a Shield:\nGain +1 Max Speed.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 1, conditions: unarmoredConditions }],
      mechanics: { requiresNoArmor: true, requiresNoShield: true, minSpeed: 0, maxSpeed: 1 },
    },
    deflect_missiles: {
      schemaVersion: 1,
      id: "deflect_missiles",
      name: "Deflect Missiles",
      description: "Gain +1 Clash Power against Spells.\nGain +2 Clash Power against Ranged Skills.\nSpend 2 Ki to gain +1 additional Clash Power against them.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { spellClashPower: 1, rangedClashPower: 2, kiCost: 2, additionalClashPower: 1 },
    },
    slow_fall: {
      schemaVersion: 1,
      id: "slow_fall",
      name: "Slow Fall",
      description: "Reduce Fall Damage by (Monk Class Level)% (Max 50%).",
      source: MONK_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { reductionPercentFormula: "min(50, ClassLevel)", maximumPercent: 50 },
    },
    stunning_strike: {
      schemaVersion: 1,
      id: "stunning_strike",
      name: "Stunning Strike",
      description: "[On Hit]\nRaise Stagger Threshold by 10% of Damage dealt.\nSpend 2 Ki to raise Stagger Threshold by an additional +20% of Damage dealt for one Skill.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { baseDamagePercent: 10, kiCost: 2, additionalDamagePercent: 20, boostedSkillTotalPercent: 30 },
    },
    ki_empowered_strikes: {
      schemaVersion: 1,
      id: "ki_empowered_strikes",
      name: "Ki-Empowered Strikes",
      description: "When you spend Ki, your next Melee Skill ignores 0.2 of the target's Resistance.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { trigger: "spend_ki", nextMeleeSkill: true, resistanceIgnore: 0.2 },
    },
    evasion: {
      schemaVersion: 1,
      id: "evasion",
      name: "Evasion",
      description: "Gain +3 Evade Power.\nWhen targeted by a Skill with ATK Weight 2+, trigger Evasion.\nIf you pass a DEX Save, reduce that Skill's Damage to 0.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "evade_power", mode: "add", value: 3 }],
      mechanics: { evadePower: 3, minimumAttackWeight: 2, saveAbility: "dex", onPassDamageMultiplier: 0 },
    },
    stillness_of_mind: {
      schemaVersion: 1,
      id: "stillness_of_mind",
      name: "Stillness of Mind",
      description: "[On Turn End]\nRemove Charmed or Frightened (Only one per Turn).\nTake -3 less SP Damage.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { turnEndRemoveOneOf: ["charmed", "frightened"], maxRemovedPerTurn: 1, spDamageReduction: 3 },
    },
    unarmored_movement_plus: {
      schemaVersion: 1,
      id: "unarmored_movement_plus",
      name: "Unarmored Movement+",
      description: "While not wearing Armor or using a Shield:\nGain +1 Min Speed and +2 Max Speed.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "min_speed", mode: "add", value: 1, conditions: unarmoredConditions },
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 2, conditions: unarmoredConditions },
      ],
      mechanics: { replacesTraitId: "unarmored_movement", requiresNoArmor: true, requiresNoShield: true, minSpeed: 1, maxSpeed: 2 },
    },
    purity_of_body: {
      schemaVersion: 1,
      id: "purity_of_body",
      name: "Purity of Body",
      description: "Gain immunity to Disease and Poison.",
      source: MONK_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { immunities: ["disease", "poison"] },
    },
    tongue_of_the_sun_and_moon: {
      schemaVersion: 1,
      id: "tongue_of_the_sun_and_moon",
      name: "Tongue of the Sun and Moon",
      description: "Set all Base Languages to 100%.\nDoes not grant or interpret Anomalous, Unique, or Non-Standard Languages.",
      source: MONK_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { baseLanguagesToPercent: 100, includeDndStandard: true, includeDndExotic: true, excludeNonDnd: true, excludeSpecial: true },
    },
    diamond_soul: {
      schemaVersion: 1,
      id: "diamond_soul",
      name: "Diamond Soul",
      description: "Gain Proficiency to all Saves.\nAfter failing a Save, spend 3 Ki to reroll failed Coins (Once per Turn).",
      source: MONK_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { proficientAllSaves: true, kiCost: 3, rerollFailedCoins: true, oncePerTurn: true },
    },
    timeless_body: {
      schemaVersion: 1,
      id: "timeless_body",
      name: "Timeless Body",
      description: "You no longer suffer penalties from Aging.\nYou do not require Food or Water.\nYou are immune to Magical Aging.",
      source: MONK_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { agingPenaltiesIgnored: true, requiresFood: false, requiresWater: false, magicalAgingImmune: true },
    },
    unarmored_movement_plus_plus: {
      schemaVersion: 1,
      id: "unarmored_movement_plus_plus",
      name: "Unarmored Movement++",
      description: "While not wearing Armor or using a Shield:\nGain +1 Min Speed and +3 Max Speed.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "min_speed", mode: "add", value: 1, conditions: unarmoredConditions },
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 3, conditions: unarmoredConditions },
      ],
      mechanics: { replacesTraitId: "unarmored_movement_plus", requiresNoArmor: true, requiresNoShield: true, minSpeed: 1, maxSpeed: 3 },
    },
    empty_body: {
      schemaVersion: 1,
      id: "empty_body",
      name: "Empty Body",
      description: "[On Use] Spend 4 Ki.\nGain +5 Evade Power this Turn.\nTake 50% less Damage this Turn.\nSpend 8 Ki to use Astral Projection on yourself.",
      source: MONK_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "manual", actionCost: "none", target: "self" },
      effects: [],
      rules: [],
      mechanics: { combatKiCost: 4, evadePower: 5, damageTakenReductionPercent: 50, duration: "this_turn", astralProjectionKiCost: 8, astralProjectionSelfOnly: true },
    },
    perfect_self: {
      schemaVersion: 1,
      id: "perfect_self",
      name: "Perfect Self",
      description: "[Combat Start] Gain 8 Ki.\n[On Turn Start] Gain +2 Ki.",
      source: MONK_SOURCE,
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { combatStartKi: 8, turnStartKi: 2 },
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
    monkGrant(10, "ki"),
    monkGrant(10, "flurry_of_blows"),
    monkGrant(10, "patient_defense"),
    monkGrant(10, "step_of_the_wind"),
    monkGrant(10, "unarmored_movement"),
    monkGrant(15, "deflect_missiles"),
    monkGrant(20, "slow_fall"),
    monkGrant(25, "additional_attack"),
    monkGrant(25, "stunning_strike"),
    monkGrant(30, "ki_empowered_strikes"),
    monkGrant(35, "evasion"),
    monkGrant(35, "stillness_of_mind"),
    monkGrant(50, "unarmored_movement_plus"),
    monkGrant(50, "purity_of_body"),
    monkGrant(65, "tongue_of_the_sun_and_moon"),
    monkGrant(70, "diamond_soul"),
    monkGrant(75, "timeless_body"),
    monkGrant(90, "unarmored_movement_plus_plus"),
    monkGrant(90, "empty_body"),
    monkGrant(100, "perfect_self"),
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
