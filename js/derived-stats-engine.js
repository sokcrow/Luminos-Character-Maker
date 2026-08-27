(function (global) {
  "use strict";

  if (global.LuminousDerivedStats) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDerivedStats;
    return;
  }

  const VERSION = 1;
  const ABILITIES = Object.freeze([
    Object.freeze({ id: "str", key: "fuerza" }),
    Object.freeze({ id: "dex", key: "destreza" }),
    Object.freeze({ id: "con", key: "constitucion" }),
    Object.freeze({ id: "int", key: "inteligencia" }),
    Object.freeze({ id: "wis", key: "sabiduria" }),
    Object.freeze({ id: "cha", key: "carisma" }),
  ]);
  const ABILITY_BY_ID = Object.freeze(Object.fromEntries(ABILITIES.map((entry) => [entry.id, entry])));
  const ABILITY_BY_KEY = Object.freeze(Object.fromEntries(ABILITIES.map((entry) => [entry.key, entry])));
  const ZERO_ABILITY_MAP = Object.freeze(Object.fromEntries(ABILITIES.map((entry) => [entry.id, 0])));

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function buildRules() {
    let rules = global.LuminousCharacterBuildRules || safeRequire("./character-build-rules.js");
    const canonical = global.LuminousCanonicalRaceIntegration || safeRequire("./canonical-race-integration.js");
    const existing = global.LuminousExistingRacialStatIntegration || safeRequire("./existing-racial-stat-integration.js");
    try { if (canonical?.installRules) rules = canonical.installRules(rules) || rules; } catch (_) {}
    try { if (existing?.installRules) rules = existing.installRules(rules) || rules; } catch (_) {}
    return rules;
  }

  function modifierEngine() {
    return global.LuminousUniversalModifiers || safeRequire("./universal-modifier-engine.js");
  }

  function abilityModifier(score) {
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function proficiencyBonus(level) {
    return Math.max(0, Math.ceil(Math.max(0, numberOr(level, 0)) / 20));
  }

  function abilityId(value) {
    const id = normalizeId(value);
    if (ABILITY_BY_ID[id]) return id;
    return ABILITY_BY_KEY[id]?.id || null;
  }

  function abilityKey(value) {
    const id = abilityId(value);
    return id ? ABILITY_BY_ID[id].key : null;
  }

  function emptyAbilityBonuses() {
    return { ...ZERO_ABILITY_MAP };
  }

  function normalizeAbilityBonuses(source) {
    const output = emptyAbilityBonuses();
    if (!source || typeof source !== "object") return output;
    Object.entries(source).forEach(([rawKey, rawValue]) => {
      const id = abilityId(rawKey);
      if (id) output[id] += numberOr(rawValue, 0);
    });
    return output;
  }

  function addAbilityMaps(...sources) {
    const output = emptyAbilityBonuses();
    sources.forEach((source) => {
      const normalized = normalizeAbilityBonuses(source);
      ABILITIES.forEach(({ id }) => { output[id] += normalized[id]; });
    });
    return output;
  }

  function storedRacialBreakdown(character = {}) {
    const build = character.characterBuild || {};
    const value = build.breakdown?.racialStatBonuses || character.racialStatBonuses || null;
    return value && typeof value === "object" ? normalizeAbilityBonuses(value) : null;
  }

  function hasBaseStats(character = {}) {
    const source = character.characterBuild?.baseStats || character.baseStats;
    return Boolean(source && typeof source === "object" && ABILITIES.some(({ id, key }) => Number.isFinite(Number(source[key] ?? source[id]))));
  }

  function baseStats(character = {}) {
    const modern = character.characterBuild?.baseStats || character.baseStats;
    const storedStats = character.stats || character.dndStats || {};
    const storedRacial = storedRacialBreakdown(character);
    const modernBase = hasBaseStats(character);
    const output = {};

    ABILITIES.forEach(({ id, key }) => {
      if (modernBase) {
        output[key] = integerOr(modern?.[key] ?? modern?.[id], 10);
        return;
      }
      const stored = integerOr(storedStats?.[key] ?? storedStats?.[id], 10);
      output[key] = storedRacial ? stored - numberOr(storedRacial[id], 0) : stored;
    });
    return output;
  }

  function characterLevel(character = {}) {
    const direct = character.characterBuild?.calculatedAtLevel ?? character.characterBuild?.characterLevel ?? character.level ?? character.characterLevel;
    if (Number.isFinite(Number(direct))) return Math.max(1, integerOr(direct, 1));
    const classes = character.characterBuild?.classes || character.classes;
    if (Array.isArray(classes)) {
      const total = classes.reduce((sum, entry) => sum + Math.max(0, integerOr(entry?.levels ?? entry?.level, 0)), 0);
      if (total > 0) return total;
    }
    return 1;
  }

  function racialInput(character = {}) {
    const build = character.characterBuild || {};
    return {
      raceId: normalizeId(build.raceId ?? character.raceId ?? character.race?.id),
      raceSubtypeId: normalizeId(build.raceSubtypeId ?? build.subraceId ?? character.raceSubtypeId ?? character.race?.subtypeId) || null,
      racialStatChoices: clone(build.racialStatChoices ?? character.racialStatChoices ?? []),
    };
  }

  function racialBonuses(character = {}, options = {}) {
    if (options.racialBonuses) return normalizeAbilityBonuses(options.racialBonuses);
    const input = racialInput(character);
    if (!input.raceId) return emptyAbilityBonuses();
    const rules = options.buildRules || buildRules();
    if (!rules) return storedRacialBreakdown(character) || emptyAbilityBonuses();
    try {
      if (rules.EXISTING_RACIAL_STAT_RULES?.[input.raceId] && typeof rules.resolveExistingRacialStatBonuses === "function") {
        return normalizeAbilityBonuses(rules.resolveExistingRacialStatBonuses(input));
      }
      if (typeof rules.resolveRacialStatBonuses === "function") return normalizeAbilityBonuses(rules.resolveRacialStatBonuses(input));
    } catch (_) {}
    return storedRacialBreakdown(character) || emptyAbilityBonuses();
  }

  function persistentScoreBonuses(character = {}, options = {}) {
    const breakdown = character.characterBuild?.breakdown || {};
    const background = normalizeAbilityBonuses(
      options.backgroundStatBonuses ?? breakdown.backgroundStatBonuses ?? character.backgroundStatBonuses ?? {},
    );
    const traits = normalizeAbilityBonuses(
      options.traitStatBonuses ?? breakdown.traitStatBonuses ?? breakdown.traitsStatBonuses ?? character.traitStatBonuses ?? character.traitsStatBonuses ?? {},
    );
    return { background, traits };
  }

  function persistentEffectiveStats(character = {}, options = {}) {
    const base = baseStats(character);
    const racial = racialBonuses(character, options);
    const extra = persistentScoreBonuses(character, options);
    const stats = {};
    ABILITIES.forEach(({ id, key }) => {
      stats[key] = numberOr(base[key], 10) + racial[id] + extra.background[id] + extra.traits[id];
    });
    return { base, racial, background: extra.background, traits: extra.traits, stats };
  }

  function canonicalStatView(character, stats, base) {
    const build = character.characterBuild || {};
    return {
      ...clone(character),
      baseStats: { ...(base || {}) },
      stats: { ...(stats || {}) },
      characterBuild: {
        ...clone(build),
        baseStats: { ...(base || {}) },
      },
    };
  }

  function runtimeStats(character, persistent, options = {}) {
    const direct = normalizeAbilityBonuses(options.runtimeStatBonuses || {});
    const starting = { ...persistent.stats };
    ABILITIES.forEach(({ id, key }) => { starting[key] += direct[id]; });

    const engine = options.modifierEngine || modifierEngine();
    const traitDefinitions = options.traits || options.traitDefinitions || [];
    if (!engine?.resolveStats || !Array.isArray(traitDefinitions) || !traitDefinitions.length) {
      return { stats: starting, runtime: direct, traitRuntime: emptyAbilityBonuses(), statCaps: clone(character.statCaps || {}) };
    }

    try {
      const runtimeCharacter = canonicalStatView(character, starting, persistent.base);
      const runtimeUnit = canonicalStatView(options.unit || character, starting, persistent.base);
      const resolved = engine.resolveStats({
        unit: runtimeUnit,
        character: runtimeCharacter,
        traits: traitDefinitions,
        traitState: options.traitState || {},
        context: options.context || "any",
        equipment: options.equipment,
      });
      const traitRuntime = emptyAbilityBonuses();
      ABILITIES.forEach(({ id, key }) => { traitRuntime[id] = numberOr(resolved?.stats?.[key], starting[key]) - starting[key]; });
      return {
        stats: Object.fromEntries(ABILITIES.map(({ key }) => [key, numberOr(resolved?.stats?.[key], starting[key])])),
        runtime: addAbilityMaps(direct, traitRuntime),
        traitRuntime,
        statCaps: clone(resolved?.statCaps || character.statCaps || {}),
      };
    } catch (_) {
      return { stats: starting, runtime: direct, traitRuntime: emptyAbilityBonuses(), statCaps: clone(character.statCaps || {}) };
    }
  }

  function modifierDeltas(baseScore, sources) {
    let score = numberOr(baseScore, 10);
    let previous = abilityModifier(score);
    const result = { base: previous };
    for (const [name, amount] of sources) {
      score += numberOr(amount, 0);
      const next = abilityModifier(score);
      result[name] = next - previous;
      previous = next;
    }
    result.total = previous;
    return result;
  }

  function abilitySnapshots(persistent, runtime) {
    const output = {};
    ABILITIES.forEach(({ id, key }) => {
      const baseScore = numberOr(persistent.base[key], 10);
      const racialScoreBonus = numberOr(persistent.racial[id], 0);
      const backgroundScoreBonus = numberOr(persistent.background[id], 0);
      const traitScoreBonus = numberOr(persistent.traits[id], 0);
      const runtimeScoreBonus = numberOr(runtime.runtime[id], 0);
      const score = numberOr(runtime.stats[key], baseScore + racialScoreBonus + backgroundScoreBonus + traitScoreBonus + runtimeScoreBonus);
      const modifier = abilityModifier(score);
      const modifierBreakdown = modifierDeltas(baseScore, [
        ["racial", racialScoreBonus],
        ["background", backgroundScoreBonus],
        ["traits", traitScoreBonus],
        ["runtime", runtimeScoreBonus],
      ]);
      output[id] = Object.freeze({
        id,
        key,
        baseScore,
        racialScoreBonus,
        backgroundScoreBonus,
        traitScoreBonus,
        runtimeScoreBonus,
        score,
        modifier,
        modifierBreakdown: Object.freeze(modifierBreakdown),
      });
    });
    return Object.freeze(output);
  }

  function buildInput(character, abilities, level, options = {}) {
    const build = character.characterBuild || {};
    return {
      level,
      constitution: abilities.con.score,
      classes: clone(build.classes ?? character.classes ?? []),
      backgroundId: build.backgroundId ?? character.backgroundId ?? null,
      raceId: build.raceId ?? character.raceId ?? character.race?.id ?? null,
      raceSubtypeId: build.raceSubtypeId ?? build.subraceId ?? character.raceSubtypeId ?? null,
      racialStatChoices: clone(build.racialStatChoices ?? character.racialStatChoices ?? []),
      transformationHpCoefBonus: numberOr(options.transformationHpCoefBonus ?? character.transformationHpCoefBonus, 0),
      baseOffLevel: level,
      baseDefLevel: level,
      runtimeHpCoef: 0,
      runtimeOff: 0,
      runtimeDef: 0,
    };
  }

  function buildCalculation(character, abilities, level, options = {}) {
    const rules = options.buildRules || buildRules();
    if (!rules?.calculateBuild) return null;
    try { return rules.calculateBuild(buildInput(character, abilities, level, options)); } catch (_) { return null; }
  }

  function readFirst(character, paths, fallback = null) {
    for (const path of paths) {
      let current = character;
      for (const part of path.split(".")) current = current?.[part];
      if (Number.isFinite(Number(current))) return Number(current);
    }
    return fallback;
  }

  function channelModifiers(character, options = {}) {
    const engine = options.modifierEngine || modifierEngine();
    if (!engine) return { trait: {}, status: {}, merged: {} };
    let trait = {};
    let status = {};
    const traitUnit = options.traitUnit || character;
    const statusUnit = options.unit || character;
    try {
      if (engine.resolveTraitModifiers) trait = engine.resolveTraitModifiers({
        unit: traitUnit,
        character,
        traits: options.traits || options.traitDefinitions || [],
        traitState: options.traitState || {},
        context: options.context || "any",
        equipment: options.equipment,
      }) || {};
    } catch (_) {}
    try {
      if (engine.resolveStatusModifiers) status = engine.resolveStatusModifiers({ unit: statusUnit, skill: options.skill }) || {};
    } catch (_) {}
    const merged = engine.mergeModifiers ? engine.mergeModifiers(trait, status) : { ...trait, ...status };
    return { trait, status, merged };
  }

  function combatLevelSnapshot(character, kind, level, calculation, channels) {
    const offense = kind === "offensive";
    const stored = character.combatLevels?.[kind] || {};
    const classModifier = calculation?.valid
      ? numberOr(offense ? calculation.classOffMod : calculation.classDefMod, 0)
      : numberOr(stored.classModifier ?? character.classModifiers?.[offense ? "offensiveLevel" : "defensiveLevel"], 0);
    const raceModifier = offense ? 0 : (calculation?.valid
      ? numberOr(calculation.raceDefMod, 0)
      : numberOr(stored.raceModifier ?? character.raceModifiers?.defensiveLevel, 0));
    const dmModifier = numberOr(stored.dmModifier ?? character.combatStats?.[offense ? "off_lvl_mod" : "def_lvl_mod"], 0);
    const itemModifier = numberOr(stored.itemModifier ?? character.equipmentModifiers?.[offense ? "offensiveLevel" : "defensiveLevel"], 0);
    const runtimeModifier = numberOr(channels.merged?.[offense ? "offensive_level" : "defensive_level"], 0);
    const total = Math.max(1, level + classModifier + raceModifier + dmModifier + itemModifier + runtimeModifier);
    return Object.freeze({ level, classModifier, raceModifier, dmModifier, itemModifier, runtimeModifier, total });
  }

  function hpSnapshot(character, calculation, options = {}) {
    const storedBase = readFirst(character, ["combatStats.hp_base", "hp_base"], 0);
    const storedCoef = readFirst(character, ["combatStats.hp_coefficient", "hp_coefficient"], 0);
    const storedMax = readFirst(character, ["combatStats.hp_max", "hp_max", "maxHp", "max_hp"], null);
    const current = readFirst(character, ["combatStats.hp_actual", "hp_actual", "hp", "currentHp", "current_hp"], storedMax ?? 0);
    const base = calculation?.valid ? numberOr(calculation.hpBase, storedBase) : storedBase;
    const coefficient = calculation?.valid ? numberOr(calculation.intrinsicHpCoef, storedCoef) : storedCoef;
    const runtimeCoefficient = numberOr(options.runtimeHpCoef, 0);
    const defensiveLevel = numberOr(options.defensiveLevel, calculation?.defLevel ?? character.level ?? 1);
    const calculatedMax = Math.max(0, Math.round(base + (coefficient + runtimeCoefficient) * defensiveLevel));
    const max = calculation?.valid || options.recalculateHp === true ? calculatedMax : (storedMax ?? calculatedMax);
    return Object.freeze({ current, max, base, coefficient, runtimeCoefficient, breakdown: Object.freeze({ base, coefficient, runtimeCoefficient, defensiveLevel }) });
  }

  function spSnapshot(character) {
    const current = readFirst(character, ["combatStats.sp_actual", "combatStats.sp", "sp_actual", "sp", "currentSp", "current_sp"], 0);
    const max = readFirst(character, ["combatStats.sp_max", "combatStats.maxSp", "sp_max", "maxSp", "max_sp"], null);
    return Object.freeze({ current, max, source: max == null ? "current-only" : "stored" });
  }

  function speedSnapshot(character, channels, options = {}) {
    const baseCurrent = numberOr(options.baseSpeed ?? readFirst(character, ["combatStats.speed", "baseSpeed", "base_speed", "speed"], 0), 0);
    const baseMin = numberOr(options.baseMinSpeed ?? readFirst(character, ["combatStats.minSpeed", "combatStats.min_speed", "minSpeed", "min_speed"], baseCurrent), baseCurrent);
    const baseMax = Math.max(baseMin, numberOr(options.baseMaxSpeed ?? readFirst(character, ["combatStats.maxSpeed", "combatStats.max_speed", "maxSpeed", "max_speed"], baseCurrent), baseCurrent));
    const passive = numberOr(channels.merged?.speed, 0);
    const minModifier = numberOr(channels.merged?.min_speed, 0);
    const maxModifier = numberOr(channels.merged?.max_speed, 0);
    const min = baseMin + minModifier + passive;
    const max = Math.max(min, baseMax + maxModifier + passive);
    const current = Math.max(min, Math.min(max, baseCurrent + passive));
    return Object.freeze({ current, min, max, baseCurrent, baseMin, baseMax, passiveModifier: passive, minModifier, maxModifier });
  }

  function resolveCharacterStats(character = {}, options = {}) {
    const source = character && typeof character === "object" ? character : {};
    const level = characterLevel(source);
    const persistent = persistentEffectiveStats(source, options);
    const runtime = runtimeStats(source, persistent, options);
    const abilities = abilitySnapshots(persistent, runtime);
    const calculation = buildCalculation(source, abilities, level, options);

    const canonicalCharacter = canonicalStatView(source, runtime.stats, persistent.base);
    const canonicalTraitUnit = canonicalStatView(options.unit || source, runtime.stats, persistent.base);
    const channels = channelModifiers(canonicalCharacter, {
      ...options,
      traitUnit: canonicalTraitUnit,
      unit: options.unit || source,
    });

    const offensiveLevel = combatLevelSnapshot(source, "offensive", level, calculation, channels);
    const defensiveLevel = combatLevelSnapshot(source, "defensive", level, calculation, channels);
    const proficiency = Object.freeze({
      bonus: Number.isFinite(Number(options.proficiencyBonusOverride))
        ? Math.max(0, numberOr(options.proficiencyBonusOverride, 0))
        : proficiencyBonus(level),
      level,
      source: Number.isFinite(Number(options.proficiencyBonusOverride)) ? "override" : "character-level",
    });
    const hp = hpSnapshot(source, calculation, { ...options, defensiveLevel: defensiveLevel.total });
    const sp = spSnapshot(source);
    const speed = speedSnapshot(source, channels, options);

    return Object.freeze({
      version: VERSION,
      level,
      baseStats: Object.freeze({ ...persistent.base }),
      effectiveStats: Object.freeze({ ...runtime.stats }),
      persistentEffectiveStats: Object.freeze({ ...persistent.stats }),
      abilities,
      proficiency,
      hp,
      sp,
      offensiveLevel,
      defensiveLevel,
      speed,
      build: calculation ? Object.freeze(clone(calculation)) : null,
      runtime: Object.freeze({
        statBonuses: Object.freeze({ ...runtime.runtime }),
        traitStatBonuses: Object.freeze({ ...runtime.traitRuntime }),
        channels: Object.freeze({ ...channels.merged }),
      }),
      breakdowns: Object.freeze({
        abilities: Object.freeze(Object.fromEntries(ABILITIES.map(({ id }) => [id, abilities[id].modifierBreakdown]))),
        offensiveLevel,
        defensiveLevel,
        hp: hp.breakdown,
        speed,
      }),
    });
  }

  function resolveAbility(character, id, options = {}) {
    const normalized = abilityId(id);
    return normalized ? resolveCharacterStats(character, options).abilities[normalized] : null;
  }

  const api = Object.freeze({
    VERSION,
    ABILITIES,
    abilityId,
    abilityKey,
    abilityModifier,
    proficiencyBonus,
    characterLevel,
    hasBaseStats,
    baseStats,
    racialBonuses,
    persistentEffectiveStats,
    resolveCharacterStats,
    resolveAbility,
  });

  global.LuminousDerivedStats = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
