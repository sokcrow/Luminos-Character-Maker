(function (global) {
  "use strict";

  if (global.LuminousSpellcastingRuntime) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;

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

  // Class spellcasting is declared once here and consumed everywhere through SpellMod / SpellDC.
  // Add future Classes to this registry instead of repeating an Ability Mod on every Spell/Trait.
  const classAbilities = new Map([
    ["bard", "cha"],
  ]);

  function registerClassSpellcastingAbility(classId, abilityId) {
    const classKey = normalizeId(classId);
    const abilityKey = normalizeId(abilityId).slice(0, 3);
    if (!classKey) throw new Error("Spellcasting Class id is required.");
    if (!ABILITY_VARIABLES[abilityKey]) throw new Error(`Unsupported Spellcasting Ability: ${abilityId}`);
    classAbilities.set(classKey, abilityKey);
    return { classId: classKey, abilityId: abilityKey };
  }

  function getClassSpellcastingAbility(classId) {
    return classAbilities.get(normalizeId(classId)) || null;
  }

  function totalLevel(character = {}, runtime = {}) {
    const explicit = runtime.Level ?? runtime.level ?? character.level ?? character.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(explicit))) return Math.max(0, intOr(explicit, 0));
    const classes = Array.isArray(character.classes)
      ? character.classes
      : (Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : []);
    return classes.reduce((sum, entry) => sum + Math.max(0, intOr(entry?.levels ?? entry?.level, 0)), 0);
  }

  function statModifier(character = {}, abilityId) {
    const ability = normalizeId(abilityId).slice(0, 3);
    const stats = character.stats || character.dndStats || {};
    const aliases = ABILITY_ALIASES[ability] || [ability];
    const score = aliases
      .map((alias) => stats?.[alias] ?? character?.[alias])
      .find((value) => Number.isFinite(Number(value)));
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function classIdForTrait(trait = {}, runtime = {}) {
    const source = trait.source || {};
    return normalizeId(
      runtime.sourceClassId
      || runtime.classId
      || source.classId
      || (normalizeId(source.type) === "class" ? source.id : "")
    );
  }

  function resolveSpellcasting(character = {}, classId, runtime = {}, variables = {}) {
    const normalizedClassId = normalizeId(classId);
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
      spellMod,
      proficiency,
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
          SpellDC: spellcasting.spellDC,
        };
      },
    });
    global.LuminousTraitEngine = wrapped;
    return true;
  }

  function install() {
    return wrapTraitEngine();
  }

  const api = Object.freeze({
    ABILITY_VARIABLES,
    registerClassSpellcastingAbility,
    getClassSpellcastingAbility,
    classIdForTrait,
    resolveSpellcasting,
    resolveForTrait,
    wrapTraitEngine,
    install,
  });

  global.LuminousSpellcastingRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, 800);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
