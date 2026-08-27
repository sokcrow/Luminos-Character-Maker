(function (global) {
  "use strict";

  const spellcasting = global.LuminousSpellcastingRuntime || (typeof require === "function" ? require("./spellcasting-runtime.js") : null);
  if (!spellcasting) return;

  const CATALOG_VERSION = 5;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const CLASS_NAMES = Object.freeze({
    artificer: "Artificer",
    bard: "Bard",
    cleric: "Cleric",
    druid: "Druid",
    paladin: "Paladin",
    ranger: "Ranger",
    sorcerer: "Sorcerer",
    warlock: "Warlock",
    wizard: "Wizard",
  });

  const ABILITY_NAMES = Object.freeze({ int: "Intelligence", wis: "Wisdom", cha: "Charisma" });
  const PROGRESSION_NAMES = Object.freeze({ full: "Full Caster", half: "Half Caster", pact: "Pact Caster", third: "Third Caster" });

  function sourceFor(classId) {
    return { type: "class", id: classId, classId, className: CLASS_NAMES[classId] || classId };
  }

  function traitIdFor(classId) {
    return classId === "bard" ? "spellcasting" : `spellcasting_ability_${classId}`;
  }

  function descriptionFor(classId, profile) {
    const className = CLASS_NAMES[classId] || classId;
    const abilityName = ABILITY_NAMES[profile.abilityId] || profile.abilityId.toUpperCase();
    const progressionName = PROGRESSION_NAMES[profile.progression] || profile.progression;
    const recovery = profile.recovery === "short_or_long_rest" ? "Short Rest or Long Rest" : "Long Rest";
    return `${abilityName} is the ${className} Spellcasting Ability. Spell Attack = Proficiency + ${abilityName} Modifier. Spell Save DC = 8 + Proficiency + ${abilityName} Modifier. ${className} uses ${progressionName} progression. Spell Slots are derived automatically from ${className} Class Level using the Limbus level conversion and recover on ${recovery}.`;
  }

  function definitionFor(classId) {
    const profile = spellcasting.getClassSpellcastingProfile(classId);
    if (!profile) return null;
    return {
      schemaVersion: 1,
      id: traitIdFor(classId),
      name: "Spellcasting Ability",
      description: descriptionFor(classId, profile),
      source: sourceFor(classId),
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        spellcasting: true,
        abilityId: profile.abilityId,
        progression: profile.progression,
        automaticSlots: true,
        slotLevelSource: "class_level",
        limbusLevelConversion: "dnd_level_1_equals_limbus_1_then_dnd_level_times_5",
        recovery: profile.recovery,
        spellAttackFormula: "Proficiency + SpellMod",
        spellSaveDcFormula: "8 + Proficiency + SpellMod",
      },
    };
  }

  const CASTER_CLASS_IDS = Object.freeze(Object.keys(spellcasting.CLASS_SPELLCASTING_PROFILES || {}));
  const CASTER_DEFINITIONS = Object.freeze(Object.fromEntries(CASTER_CLASS_IDS.map((classId) => [traitIdFor(classId), definitionFor(classId)]).filter(([, definition]) => definition)));

  function grantFor(classId) {
    const traitId = traitIdFor(classId);
    return {
      id: `core_class_${classId}_l1_${traitId}`,
      sourceType: "class",
      sourceId: classId,
      source: { className: CLASS_NAMES[classId] || classId, atLevel: 1, requiredClassLevel: 1 },
      atLevel: 1,
      traitId,
      grantType: "trait",
      multiclassPolicy: "allowed",
    };
  }

  // Bard already owns core_class_bard_l1_spellcasting in bard-class-runtime.js.
  const CASTER_GRANTS = Object.freeze(CASTER_CLASS_IDS.filter((classId) => classId !== "bard").map(grantFor));

  function catalogIsCurrent(source) {
    if (!source?.__casterSpellcastingTraitsExtended) return false;
    const bard = source.getDefinition?.("spellcasting") || source.DEFINITIONS?.spellcasting;
    return bard?.name === "Spellcasting Ability" && bard?.mechanics?.progression === "full" && bard?.mechanics?.automaticSlots === true;
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || (typeof require === "function" ? require("./trait-catalog-core.js") : null);
    if (!source) return false;
    if (catalogIsCurrent(source)) return true;

    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));

    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(CASTER_DEFINITIONS) });
    const allGrants = () => {
      const existing = baseGrants();
      const identities = new Set(existing.map((grant) => `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.atLevel}`));
      const additions = CASTER_GRANTS.filter((grant) => !identities.has(`${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.atLevel}`));
      return [...existing, ...clone(additions)];
    };
    const getDefinition = (id) => clone(CASTER_DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const baseResult = baseValidate(engine);
      const errors = [...(baseResult.errors || [])];
      const warnings = [...(baseResult.warnings || [])];
      Object.entries(CASTER_DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) {
          errors.push(`${key}: Trait Engine is not available.`);
          return;
        }
        const validation = engine.validateTrait(definition);
        validation.errors.forEach((message) => errors.push(`${key}: ${message}`));
        validation.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      });
      return { valid: baseResult.valid !== false && !errors.length, errors, warnings };
    };

    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __casterSpellcastingTraitsExtended: true,
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

  const api = Object.freeze({
    CATALOG_VERSION,
    CLASS_NAMES,
    CASTER_CLASS_IDS,
    CASTER_DEFINITIONS,
    CASTER_GRANTS,
    traitIdFor,
    definitionFor,
    grantFor,
    wrapCatalog,
    install,
  });

  global.LuminousCasterSpellcastingTraitsRuntime = api;
  install();

  if (global.document && global.setInterval) {
    const timer = global.setInterval(install, 800);
    timer?.unref?.();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);