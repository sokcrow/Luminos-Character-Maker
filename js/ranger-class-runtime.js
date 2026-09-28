(function (global) {
  "use strict";

  if (global.LuminousRangerClassRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRangerClassRuntime;
    return;
  }

  const CLASS_ID = "ranger";
  const CLASS_NAME = "Ranger";
  const CATALOG_VERSION = 1;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const creatureCatalog = global.LuminousCreatureTypeCatalog || (typeof require === "function" ? (() => { try { return require("./creature-type-catalog.js"); } catch (_) { return null; } })() : null);
  const fightingStyles = global.LuminousFightingStyleRuntime || (typeof require === "function" ? (() => { try { return require("./fighting-style-runtime.js"); } catch (_) { return null; } })() : null);

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const RANGER_SOURCE = Object.freeze({ type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME });
  const FAVORED_TERRAINS = Object.freeze(["forest", "grassland", "hills", "mountain", "swamp", "desert", "coast", "arctic", "underground"]);
  const TERRAIN_ALIASES = Object.freeze({
    plains: "grassland",
    grasslands: "grassland",
    hill: "hills",
    mountains: "mountain",
    marsh: "swamp",
    wetlands: "swamp",
    deep_snow: "arctic",
    tundra: "arctic",
    polar: "arctic",
    subterranean: "underground",
    underdark: "underground",
    coastal: "coast",
  });

  const RANGER_DEFINITIONS = deepFreeze({
    favored_enemy: {
      schemaVersion: 1,
      id: "favored_enemy",
      name: "Favored Enemy",
      description: "Choose one Creature Type as your Favored Enemy. Gain +1 Final Power against creatures of your Favored Enemy type. Gain +4 to Survival Checks made to track them. Analyse automatically succeeds against them. Learn one associated language, if applicable. If Humanoid is chosen, select one Humanoid Subtype and its associated language.",
      source: RANGER_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        creatureTypeCatalog: "LuminousCreatureTypeCatalog",
        baseChoices: 1,
        additionalChoicesAtClassLevels: [30, 70],
        finalPowerBonus: 1,
        survivalTrackingBonus: 4,
        analyseAutoSuccess: true,
        humanoidSubtypeRequired: true,
        associatedLanguage: true,
        languageCatalogStatus: "pending_canonical_language_catalog",
      },
    },
    natural_explorer: {
      schemaVersion: 1,
      id: "natural_explorer",
      name: "Natural Explorer",
      description: "Choose one Terrain Type as your Favored Terrain. While in an Encounter that matches one of your Favored Terrains, gain +1 Clash Power.",
      source: RANGER_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        terrainChoices: FAVORED_TERRAINS,
        baseChoices: 1,
        additionalChoicesAtClassLevels: [30, 50],
        clashPowerBonus: 1,
        encounterContextAware: true,
      },
    },
  });

  const rangerGrant = (level, traitId) => ({
    id: `core_class_ranger_l${level}_${traitId}`,
    sourceType: "class",
    sourceId: CLASS_ID,
    source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level },
    atLevel: level,
    traitId,
    grantType: "trait",
    multiclassPolicy: "allowed",
  });

  const RANGER_GRANTS = deepFreeze([
    rangerGrant(1, "favored_enemy"),
    rangerGrant(1, "natural_explorer"),
    rangerGrant(10, "fighting_style"),
  ]);

  function classEntries(character = {}) {
    const candidates = [character.classes, character.characterBuild?.classes, character.dnd?.classes, character.classLevels];
    for (const value of candidates) {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return Object.entries(value).map(([id, entry]) => typeof entry === "object" ? { id, ...entry } : { id, level: entry });
    }
    return [];
  }

  function rangerLevel(character = {}, engine = global.LuminousTraitEngine) {
    if (engine?.getClassLevel) {
      const viaEngine = Number(engine.getClassLevel(character, CLASS_ID));
      if (Number.isFinite(viaEngine)) return Math.max(0, Math.trunc(viaEngine));
    }
    const found = classEntries(character).find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level ?? found?.classLevel, 0));
  }

  function favoredEnemyChoiceCount(character = {}, engine) {
    const level = rangerLevel(character, engine);
    if (level < 1) return 0;
    return 1 + (level >= 30 ? 1 : 0) + (level >= 70 ? 1 : 0);
  }

  function naturalExplorerChoiceCount(character = {}, engine) {
    const level = rangerLevel(character, engine);
    if (level < 1) return 0;
    return 1 + (level >= 30 ? 1 : 0) + (level >= 50 ? 1 : 0);
  }

  function choiceStore(character = {}) {
    if (!character.traitChoices || typeof character.traitChoices !== "object" || Array.isArray(character.traitChoices)) character.traitChoices = {};
    return character.traitChoices;
  }

  function normalizeFavoredEnemyChoice(input) {
    const raw = typeof input === "string" ? { creatureType: input } : clone(input || {});
    const catalog = global.LuminousCreatureTypeCatalog || creatureCatalog;
    const creatureType = catalog?.normalizeCreatureType?.(raw.creatureType || raw.type || raw.id) || normalizeId(raw.creatureType || raw.type || raw.id);
    if (!catalog?.isValidCreatureType?.(creatureType)) return { valid: false, reason: "unknown_creature_type", creatureType };
    const creatureSubtype = normalizeId(raw.creatureSubtype || raw.subtype || "");
    if (creatureType === "humanoid" && !creatureSubtype) return { valid: false, reason: "humanoid_subtype_required", creatureType };
    return {
      valid: true,
      creatureType,
      creatureSubtype: creatureSubtype || null,
      languageId: normalizeId(raw.languageId || raw.language || "") || null,
    };
  }

  function favoredEnemyChoices(character = {}) {
    const raw = character.traitChoices?.favored_enemy?.choices ?? character.favoredEnemies ?? character.favored_enemies ?? [];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(normalizeFavoredEnemyChoice).filter((entry) => entry.valid).map(({ valid, ...entry }) => entry);
  }

  function applyFavoredEnemyChoices(character = {}, choices = [], engine) {
    const allowedCount = favoredEnemyChoiceCount(character, engine);
    const normalized = (Array.isArray(choices) ? choices : [choices]).map(normalizeFavoredEnemyChoice);
    const invalid = normalized.find((entry) => !entry.valid);
    if (invalid) return { success: false, reason: invalid.reason, choice: invalid, allowedCount };
    if (normalized.length > allowedCount) return { success: false, reason: "too_many_favored_enemies", allowedCount, choices: normalized };
    const keys = normalized.map((entry) => `${entry.creatureType}:${entry.creatureSubtype || ""}`);
    if (new Set(keys).size !== keys.length) return { success: false, reason: "duplicate_favored_enemy", allowedCount };
    const clean = normalized.map(({ valid, ...entry }) => entry);
    choiceStore(character).favored_enemy = { choices: clean, sourceClassId: CLASS_ID };
    character.favoredEnemies = clone(clean);
    return { success: true, allowedCount, choices: clean, remainingChoices: Math.max(0, allowedCount - clean.length), pendingLanguages: clean.filter((entry) => !entry.languageId).length };
  }

  function normalizeTerrain(value) {
    const id = normalizeId(value);
    const terrain = TERRAIN_ALIASES[id] || id;
    return FAVORED_TERRAINS.includes(terrain) ? terrain : "";
  }

  function naturalExplorerChoices(character = {}) {
    const raw = character.traitChoices?.natural_explorer?.terrains ?? character.favoredTerrains ?? character.favored_terrains ?? [];
    return [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).map(normalizeTerrain).filter(Boolean))];
  }

  function applyNaturalExplorerChoices(character = {}, terrains = [], engine) {
    const allowedCount = naturalExplorerChoiceCount(character, engine);
    const raw = Array.isArray(terrains) ? terrains : [terrains];
    const normalized = raw.map(normalizeTerrain);
    if (normalized.some((entry) => !entry)) return { success: false, reason: "unknown_favored_terrain", allowedCount, terrains: raw };
    const unique = [...new Set(normalized)];
    if (unique.length !== normalized.length) return { success: false, reason: "duplicate_favored_terrain", allowedCount, terrains: unique };
    if (unique.length > allowedCount) return { success: false, reason: "too_many_favored_terrains", allowedCount, terrains: unique };
    choiceStore(character).natural_explorer = { terrains: unique, sourceClassId: CLASS_ID };
    character.favoredTerrains = unique.slice();
    return { success: true, allowedCount, terrains: unique, remainingChoices: Math.max(0, allowedCount - unique.length) };
  }

  function targetProfile(target = {}) {
    const catalog = global.LuminousCreatureTypeCatalog || creatureCatalog;
    try { return catalog?.profileForUnit?.(target, { required: false }) || null; } catch (_) { return null; }
  }

  function favoredEnemyMatches(character = {}, target = {}) {
    const profile = targetProfile(target);
    if (!profile) return false;
    return favoredEnemyChoices(character).some((choice) => {
      if (choice.creatureType !== profile.creatureType) return false;
      if (choice.creatureType !== "humanoid") return true;
      return Boolean(choice.creatureSubtype && profile.creatureSubtypes?.includes(choice.creatureSubtype));
    });
  }

  function favoredEnemyFinalPowerBonus(character = {}, target = {}) { return favoredEnemyMatches(character, target) ? 1 : 0; }
  function survivalTrackingBonus(character = {}, target = {}) { return favoredEnemyMatches(character, target) ? 4 : 0; }
  function analyseAutomaticallySucceeds(character = {}, target = {}) { return favoredEnemyMatches(character, target); }
  function resolveAnalyse(character = {}, target = {}) {
    const automaticSuccess = analyseAutomaticallySucceeds(character, target);
    return { automaticSuccess, bypassCheck: automaticSuccess, sourceTraitId: automaticSuccess ? "favored_enemy" : null };
  }

  function terrainTokens(context = {}) {
    const environment = context.environment || context.encounter?.environment || {};
    const candidates = [
      context.terrain, context.terrainType, context.biome, context.biomeId,
      context.encounter?.terrain, context.encounter?.terrainType, context.encounter?.biome, context.encounter?.biomeId,
      environment.terrain, environment.terrainType, environment.biome, environment.biomeId,
      context.variables?.terrain, context.variables?.terrainType, context.variables?.biome, context.variables?.biomeId,
    ];
    const tokens = new Set(candidates.flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).map(normalizeTerrain).filter(Boolean));
    if (normalizeId(environment.encounterType || context.encounterType) === "underground") tokens.add("underground");
    return [...tokens];
  }

  function naturalExplorerMatches(character = {}, context = {}) {
    const selected = new Set(naturalExplorerChoices(character));
    return terrainTokens(context).some((terrain) => selected.has(terrain));
  }
  function naturalExplorerClashPowerBonus(character = {}, context = {}) { return naturalExplorerMatches(character, context) ? 1 : 0; }

  function fightingStyleOptions() {
    return fightingStyles?.catalog?.forClass?.(CLASS_ID) || global.LuminousFightingStyleCatalog?.forClass?.(CLASS_ID) || [];
  }
  function applyFightingStyleChoice(character = {}, styleId) {
    const runtime = global.LuminousFightingStyleRuntime || fightingStyles;
    if (!runtime?.applyChoice) return { success: false, reason: "fighting_style_runtime_unavailable" };
    return runtime.applyChoice(character, CLASS_ID, styleId);
  }

  function traitBaseId(trait = {}) {
    return normalizeId(trait.baseTraitId || String(trait.id || trait.name || "").split("__class__")[0]);
  }
  function hasTrait(traits = [], id) {
    const wanted = normalizeId(id);
    return (traits || []).some((trait) => traitBaseId(trait) === wanted);
  }
  function isTrackingSurvivalCheck(check = {}) {
    const skillId = normalizeId(check.skillId || check.skill || "");
    if (skillId !== "survival") return false;
    if (check.tracking === true || check.isTracking === true) return true;
    if (["track", "tracking"].includes(normalizeId(check.purpose || check.intent))) return true;
    const tags = Array.isArray(check.tags) ? check.tags.map(normalizeId) : [];
    return tags.includes("track") || tags.includes("tracking");
  }

  function grantIdentity(grant = {}) { return `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.atLevel}`; }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || (typeof require === "function" ? (() => { try { return require("./trait-catalog-core.js"); } catch (_) { return null; } })() : null);
    if (!source) return false;
    if (source.__rangerClassExtended) return true;
    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));
    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(RANGER_DEFINITIONS) });
    const allGrants = () => {
      const combined = [...baseGrants(), ...clone(RANGER_GRANTS)], seen = new Set();
      return combined.filter((grant) => { const key = grantIdentity(grant); if (seen.has(key)) return false; seen.add(key); return true; });
    };
    const getDefinition = (id) => clone(RANGER_DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const base = baseValidate(engine), errors = [...(base.errors || [])], warnings = [...(base.warnings || [])];
      Object.entries(RANGER_DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) return;
        const validation = engine.validateTrait(definition);
        validation.errors.forEach((message) => errors.push(`${key}: ${message}`));
        validation.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      });
      return { valid: base.valid !== false && !errors.length, errors, warnings };
    };
    global.LuminousTraitCatalogCore = Object.freeze({ ...source, __rangerClassExtended: true, CATALOG_VERSION: Math.max(CATALOG_VERSION, Number(source.CATALOG_VERSION || 0)), DEFINITIONS: Object.freeze(allDefinitions()), GRANTS: Object.freeze(allGrants()), allDefinitions, allGrants, getDefinition, validateAll });
    return true;
  }

  function wrapTraitEngine() {
    const source = global.LuminousTraitEngine || (typeof require === "function" ? (() => { try { return require("./trait-engine.js"); } catch (_) { return null; } })() : null);
    if (!source) return false;
    if (source.__rangerClassRuntimeWrapped) return true;
    const originalResolveTheatreCheck = source.resolveTheatreCheck?.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __rangerClassRuntimeWrapped: true,
      resolveTheatreCheck(input = {}) {
        const result = originalResolveTheatreCheck ? originalResolveTheatreCheck(input) : { check: clone(input.check || {}), state: input.state, outcomes: [] };
        const traits = input.traits || [];
        if (hasTrait(traits, "favored_enemy") && isTrackingSurvivalCheck(result.check || input.check || {})) {
          const target = input.target || input.trackingTarget || input.check?.target || null;
          const bonus = target ? survivalTrackingBonus(input.character || {}, target) : 0;
          if (bonus) {
            result.check.finalPower = Number(result.check.finalPower || 0) + bonus;
            result.outcomes = [...(result.outcomes || []), { type: "ranger_favored_enemy_tracking", traitId: "favored_enemy", finalPowerBonus: bonus }];
          }
        }
        return result;
      },
    });
    return true;
  }

  function wrapModifierEngine() {
    const source = global.LuminousUniversalModifiers;
    if (!source) return false;
    if (source.__rangerClassRuntimeWrapped) return true;
    const originalResolve = source.resolveTraitModifiers?.bind(source);
    if (!originalResolve) return false;
    global.LuminousUniversalModifiers = Object.freeze({
      ...source,
      __rangerClassRuntimeWrapped: true,
      resolveTraitModifiers(options = {}) {
        const output = originalResolve(options);
        const character = options.character || options.unit || {};
        const traits = options.traits || [];
        if (hasTrait(traits, "favored_enemy") && options.target) output.final_power += favoredEnemyFinalPowerBonus(character, options.target);
        if (hasTrait(traits, "natural_explorer") && naturalExplorerMatches(character, options)) output.clash_power += 1;
        return output;
      },
    });
    return true;
  }

  function install() {
    const catalog = wrapCatalog();
    const engine = wrapTraitEngine();
    wrapModifierEngine();
    return catalog && engine;
  }

  const api = Object.freeze({
    CLASS_ID, CLASS_NAME, CATALOG_VERSION, RANGER_SOURCE, FAVORED_TERRAINS, TERRAIN_ALIASES, RANGER_DEFINITIONS, RANGER_GRANTS,
    rangerLevel, favoredEnemyChoiceCount, naturalExplorerChoiceCount, normalizeFavoredEnemyChoice, favoredEnemyChoices, applyFavoredEnemyChoices,
    normalizeTerrain, naturalExplorerChoices, applyNaturalExplorerChoices, favoredEnemyMatches, favoredEnemyFinalPowerBonus, survivalTrackingBonus,
    analyseAutomaticallySucceeds, resolveAnalyse, terrainTokens, naturalExplorerMatches, naturalExplorerClashPowerBonus,
    fightingStyleOptions, applyFightingStyleChoice, isTrackingSurvivalCheck, wrapCatalog, wrapTraitEngine, wrapModifierEngine, install,
  });

  global.LuminousRangerClassRuntime = api;
  install();
  if (!global.document && typeof queueMicrotask === "function") queueMicrotask(install);
  if (global.document && global.setInterval) {
    const timer = global.setInterval(() => {
      const ready = install();
      if (ready && global.LuminousUniversalModifiers) global.clearInterval?.(timer);
    }, 500);
    timer?.unref?.();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
