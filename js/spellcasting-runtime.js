(function (global) {
  "use strict";

  if (global.LuminousSpellcastingRuntime) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ABILITY_VARIABLES = Object.freeze({
    str: "StrengthMod",
    dex: "DexterityMod",
    con: "ConstitutionMod",
    int: "IntelligenceMod",
    wis: "WisdomMod",
    cha: "CharismaMod",
  });

  const ABILITY_ALIASES = Object.freeze({
    str: ["fuerza", "strength", "str"],
    dex: ["destreza", "dexterity", "dex"],
    con: ["constitucion", "constitution", "con"],
    int: ["inteligencia", "intelligence", "int"],
    wis: ["sabiduria", "wisdom", "wis"],
    cha: ["carisma", "charisma", "cha"],
  });

  const CLASS_ID_ALIASES = Object.freeze({
    artificer: "artificer",
    artifice: "artificer",
    artificio: "artificer",
    bard: "bard",
    bardo: "bard",
    cleric: "cleric",
    clerigo: "cleric",
    clérigo: "cleric",
    druid: "druid",
    druida: "druid",
    paladin: "paladin",
    paladín: "paladin",
    ranger: "ranger",
    explorador: "ranger",
    sorcerer: "sorcerer",
    hechicero: "sorcerer",
    warlock: "warlock",
    brujo: "warlock",
    wizard: "wizard",
    mago: "wizard",
  });

  const FULL_CASTER_SLOTS = Object.freeze([
    null,
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    [4, 3, 3, 3, 1, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 2, 1, 1],
  ]);

  const HALF_CASTER_SLOTS = Object.freeze([
    null,
    [2, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 2, 0, 0, 0],
    [4, 3, 0, 0, 0],
    [4, 3, 0, 0, 0],
    [4, 3, 2, 0, 0],
    [4, 3, 2, 0, 0],
    [4, 3, 3, 0, 0],
    [4, 3, 3, 0, 0],
    [4, 3, 3, 1, 0],
    [4, 3, 3, 1, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 2, 0],
    [4, 3, 3, 3, 1],
    [4, 3, 3, 3, 1],
    [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2],
  ]);

  const THIRD_CASTER_SLOTS = Object.freeze([
    null,
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [2, 0, 0, 0],
    [3, 0, 0, 0],
    [3, 0, 0, 0],
    [3, 0, 0, 0],
    [4, 2, 0, 0],
    [4, 2, 0, 0],
    [4, 2, 0, 0],
    [4, 3, 0, 0],
    [4, 3, 0, 0],
    [4, 3, 0, 0],
    [4, 3, 2, 0],
    [4, 3, 2, 0],
    [4, 3, 2, 0],
    [4, 3, 3, 0],
    [4, 3, 3, 0],
    [4, 3, 3, 0],
    [4, 3, 3, 1],
    [4, 3, 3, 1],
  ]);

  const CLASS_SPELLCASTING_PROFILES = Object.freeze({
    artificer: Object.freeze({ classId: "artificer", abilityId: "int", progression: "half", recovery: "long_rest" }),
    bard: Object.freeze({ classId: "bard", abilityId: "cha", progression: "full", recovery: "long_rest" }),
    cleric: Object.freeze({ classId: "cleric", abilityId: "wis", progression: "full", recovery: "long_rest" }),
    druid: Object.freeze({ classId: "druid", abilityId: "wis", progression: "full", recovery: "long_rest" }),
    paladin: Object.freeze({ classId: "paladin", abilityId: "cha", progression: "half", recovery: "long_rest" }),
    ranger: Object.freeze({ classId: "ranger", abilityId: "wis", progression: "half", recovery: "long_rest" }),
    sorcerer: Object.freeze({ classId: "sorcerer", abilityId: "cha", progression: "full", recovery: "long_rest" }),
    warlock: Object.freeze({ classId: "warlock", abilityId: "cha", progression: "pact", recovery: "short_or_long_rest" }),
    wizard: Object.freeze({ classId: "wizard", abilityId: "int", progression: "full", recovery: "long_rest" }),
  });

  const classAbilities = new Map();
  const classProfiles = new Map(Object.entries(CLASS_SPELLCASTING_PROFILES).map(([id, profile]) => [id, clone(profile)]));

  function canonicalSpellcastingClassId(classId) {
    const id = normalizeId(classId);
    return CLASS_ID_ALIASES[id] || id;
  }

  function sameSpellcastingClassId(left, right) {
    return canonicalSpellcastingClassId(left) === canonicalSpellcastingClassId(right);
  }

  function normalizeAbilityId(abilityId) {
    const raw = normalizeId(abilityId);
    if (ABILITY_VARIABLES[raw]) return raw;
    for (const [id, aliases] of Object.entries(ABILITY_ALIASES)) {
      if (aliases.includes(raw)) return id;
    }
    return null;
  }

  function registerClassSpellcastingProfile(classId, profile = {}) {
    const classKey = canonicalSpellcastingClassId(classId);
    const abilityId = normalizeAbilityId(profile.abilityId || profile.ability || profile.stat);
    const progression = normalizeId(profile.progression || "full");
    const recovery = normalizeId(profile.recovery || (progression === "pact" ? "short_or_long_rest" : "long_rest"));
    if (!classKey) throw new Error("Spellcasting Class id is required.");
    if (!ABILITY_VARIABLES[abilityId]) throw new Error(`Unsupported Spellcasting Ability: ${profile.abilityId || profile.ability || profile.stat}`);
    if (!["full", "half", "third", "pact"].includes(progression)) throw new Error(`Unsupported Spellcasting progression: ${profile.progression}`);
    const next = { classId: classKey, abilityId, progression, recovery };
    classProfiles.set(classKey, next);
    classAbilities.set(classKey, abilityId);
    return clone(next);
  }

  function registerClassSpellcastingAbility(classId, abilityId) {
    const classKey = canonicalSpellcastingClassId(classId);
    const abilityKey = normalizeAbilityId(abilityId);
    if (!classKey) throw new Error("Spellcasting Class id is required.");
    if (!ABILITY_VARIABLES[abilityKey]) throw new Error(`Unsupported Spellcasting Ability: ${abilityId}`);
    classAbilities.set(classKey, abilityKey);
    const current = classProfiles.get(classKey);
    if (current) classProfiles.set(classKey, { ...current, abilityId: abilityKey });
    return { classId: classKey, abilityId: abilityKey };
  }

  Object.entries(CLASS_SPELLCASTING_PROFILES).forEach(([classId, profile]) => {
    registerClassSpellcastingProfile(classId, profile);
  });

  function getClassSpellcastingProfile(classId) {
    return clone(classProfiles.get(canonicalSpellcastingClassId(classId)) || null);
  }

  function getClassSpellcastingAbility(classId) {
    return classAbilities.get(canonicalSpellcastingClassId(classId)) || null;
  }

  function classEntries(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = Array.isArray(character.classes) ? character.classes : (Array.isArray(build.classes) ? build.classes : []);
    return source.filter((entry) => entry && typeof entry === "object");
  }

  function getClassEntry(character = {}, classId) {
    return classEntries(character).find((entry) => sameSpellcastingClassId(entry.classId || entry.id, classId)) || null;
  }

  function getClassLevel(character = {}, classId) {
    const entry = getClassEntry(character, classId);
    return Math.max(0, intOr(entry?.levels ?? entry?.level, 0));
  }

  function limbusClassLevelToDndLevel(classLevel) {
    const level = Math.max(0, intOr(classLevel, 0));
    if (level <= 0) return 0;
    return Math.min(20, Math.max(1, Math.floor(level / 5)));
  }

  function arrayToSlotTable(row = []) {
    const table = {};
    row.forEach((maximum, index) => {
      if (maximum > 0) table[index + 1] = maximum;
    });
    return table;
  }

  function pactSlotTable(dndLevel) {
    const level = Math.max(0, Math.min(20, intOr(dndLevel, 0)));
    if (!level) return {};
    const slotLevel = level >= 9 ? 5 : (level >= 7 ? 4 : (level >= 5 ? 3 : (level >= 3 ? 2 : 1)));
    const slots = level >= 17 ? 4 : (level >= 11 ? 3 : (level >= 2 ? 2 : 1));
    return { [slotLevel]: slots };
  }

  function slotTableForProgression(progression, dndLevel) {
    const kind = normalizeId(progression);
    const level = Math.max(0, Math.min(20, intOr(dndLevel, 0)));
    if (!level) return {};
    if (kind === "pact") return pactSlotTable(level);
    const source = kind === "half" ? HALF_CASTER_SLOTS : (kind === "third" ? THIRD_CASTER_SLOTS : FULL_CASTER_SLOTS);
    return arrayToSlotTable(source[level] || []);
  }

  function getClassSpellSlotTable(character = {}, classId, classLevel = null) {
    const profile = getClassSpellcastingProfile(classId);
    if (!profile) return {};
    const limbusLevel = classLevel == null ? getClassLevel(character, classId) : Math.max(0, intOr(classLevel, 0));
    const dndLevel = limbusClassLevelToDndLevel(limbusLevel);
    return slotTableForProgression(profile.progression, dndLevel);
  }

  function totalLevel(character = {}, runtime = {}) {
    const explicit = runtime.Level ?? runtime.level ?? character.level ?? character.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(explicit))) return Math.max(0, intOr(explicit, 0));
    return classEntries(character).reduce((sum, entry) => sum + Math.max(0, intOr(entry?.levels ?? entry?.level, 0)), 0);
  }

  function statModifier(character = {}, abilityId) {
    const ability = normalizeAbilityId(abilityId);
    const stats = character.stats || character.dndStats || {};
    const aliases = ABILITY_ALIASES[ability] || [ability];
    const score = aliases
      .map((alias) => stats?.[alias] ?? character?.[alias])
      .find((value) => Number.isFinite(Number(value)));
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function classIdForTrait(trait = {}, runtime = {}) {
    const source = trait.source || {};
    return canonicalSpellcastingClassId(
      runtime.sourceClassId
      || runtime.classId
      || source.classId
      || (normalizeId(source.type) === "class" ? source.id : "")
    );
  }

  function resolveSpellcasting(character = {}, classId, runtime = {}, variables = {}) {
    const normalizedClassId = canonicalSpellcastingClassId(classId);
    const profile = getClassSpellcastingProfile(normalizedClassId);
    const abilityId = getClassSpellcastingAbility(normalizedClassId);
    if (!abilityId) return null;
    const variableName = ABILITY_VARIABLES[abilityId];
    const spellMod = Number.isFinite(Number(variables?.[variableName]))
      ? Number(variables[variableName])
      : (Number.isFinite(Number(runtime?.[variableName])) ? Number(runtime[variableName]) : statModifier(character, abilityId));
    const proficiency = Number.isFinite(Number(variables?.Proficiency))
      ? Number(variables.Proficiency)
      : numberOr(runtime.Proficiency ?? character.proficiency, Math.ceil(totalLevel(character, runtime) / 20));
    return {
      classId: normalizedClassId,
      abilityId,
      progression: profile?.progression || null,
      recovery: profile?.recovery || null,
      spellMod,
      proficiency,
      spellAttack: spellMod + proficiency,
      spellDC: 8 + spellMod + proficiency,
    };
  }

  function resolveForTrait(character = {}, trait = {}, runtime = {}, variables = {}) {
    return resolveSpellcasting(character, classIdForTrait(trait, runtime), runtime, variables);
  }

  function wrapTraitEngine() {
    const source = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
    if (!source?.buildVariables) return false;
    if (source.__spellcastingRuntimeWrapped) return true;

    const originalBuildVariables = source.buildVariables.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __spellcastingRuntimeWrapped: true,
      buildVariables(character = {}, runtime = {}, trait = {}) {
        const variables = originalBuildVariables(character, runtime, trait);
        const spellcasting = resolveForTrait(character, trait, runtime, variables);
        if (!spellcasting) return variables;
        return {
          ...variables,
          SpellMod: spellcasting.spellMod,
          SpellAttack: spellcasting.spellAttack,
          SpellDC: spellcasting.spellDC,
        };
      },
    });
    global.LuminousTraitEngine = wrapped;
    return true;
  }

  function ensureCasterSpellcastingTraitsAsset() {
    if (global.LuminousCasterSpellcastingTraitsRuntime) return global.LuminousCasterSpellcastingTraitsRuntime;
    if (typeof require === "function" && !global.document) {
      try { return require("./caster-spellcasting-traits-runtime.js"); } catch (_) { return null; }
    }
    if (!global.document) return null;
    let script = global.document.getElementById("caster-spellcasting-traits-runtime-script");
    if (script) return script;
    script = global.document.createElement("script");
    script.id = "caster-spellcasting-traits-runtime-script";
    script.src = "js/caster-spellcasting-traits-runtime.js";
    script.async = false;
    global.document.head?.appendChild(script);
    return script;
  }

  function install() {
    const wrapped = wrapTraitEngine();
    ensureCasterSpellcastingTraitsAsset();
    return wrapped;
  }

  const api = Object.freeze({
    ABILITY_VARIABLES,
    ABILITY_ALIASES,
    CLASS_ID_ALIASES,
    CLASS_SPELLCASTING_PROFILES,
    FULL_CASTER_SLOTS,
    HALF_CASTER_SLOTS,
    THIRD_CASTER_SLOTS,
    canonicalSpellcastingClassId,
    sameSpellcastingClassId,
    normalizeAbilityId,
    registerClassSpellcastingProfile,
    registerClassSpellcastingAbility,
    getClassSpellcastingProfile,
    getClassSpellcastingAbility,
    getClassEntry,
    getClassLevel,
    limbusClassLevelToDndLevel,
    slotTableForProgression,
    getClassSpellSlotTable,
    classIdForTrait,
    resolveSpellcasting,
    resolveForTrait,
    wrapTraitEngine,
    ensureCasterSpellcastingTraitsAsset,
    install,
  });

  global.LuminousSpellcastingRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, 800);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);