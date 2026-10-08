(function (global) {
  "use strict";

  if (global.LuminousRangerClassRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRangerClassRuntime;
    return;
  }

  const CLASS_ID = "ranger";
  const CLASS_NAME = "Ranger";
  const CATALOG_VERSION = 2;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const HIDE_PENDING_KEY = "__luminousRangerHideInPlainSightPending";
  const HIDDEN_KEY = "__luminousRangerHiddenInPlainSight";
  const FOE_SLAYER_CHOICE_KEY = "__luminousRangerFoeSlayerChoice";
  const FOE_SLAYER_PENDING_KEY = "__luminousRangerFoeSlayerPending";
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
    primeval_awareness: {
      schemaVersion: 1,
      id: "primeval_awareness",
      name: "Primeval Awareness",
      description: "Your experience in the wild has taught you to recognize subtle signs of supernatural creatures and unnatural presences.",
      source: RANGER_SOURCE,
      contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { loreOnly: true, implementationStatus: "lore_only" },
    },
    lands_stride: {
      schemaVersion: 1,
      id: "lands_stride",
      name: "Land's Stride",
      description: "You have learned to move through the wilderness without allowing difficult ground, dense vegetation, or natural obstacles to slow your advance. Your familiarity with hostile terrain allows you to navigate forests, undergrowth, rough ground, and similar natural environments with practiced ease.",
      source: RANGER_SOURCE,
      contexts: ["theatre", "combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { loreOnly: true, implementationStatus: "lore_only" },
    },
    hide_in_plain_sight: {
      schemaVersion: 1,
      id: "hide_in_plain_sight",
      name: "Hide in Plain Sight",
      description: "While in one of your Favored Terrains, use Hide in Plain Sight to make a hidden Stealth Check. At Turn End, a successful check makes you visually withdraw without leaving the Encounter. While Hidden, enemies cannot select you as a direct target. Using an Attack Skill reveals you before the attack resolves.",
      source: RANGER_SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action", target: "self" },
      effects: [],
      rules: [],
      mechanics: {
        requiresFavoredTerrain: true,
        hiddenStealthCheck: true,
        resolvesAt: "turn_end",
        falseRetreatVisual: true,
        leavesEncounter: false,
        preserveGridPosition: true,
        enemyDirectTargetingDisabled: true,
        revealBeforeAttack: true,
        upgradedByTrait: "vanish",
      },
    },
    vanish: {
      schemaVersion: 1,
      id: "vanish",
      name: "Vanish",
      description: "Hide in Plain Sight becomes a Quick Action. While Hidden, you are harder to detect. You cannot be tracked by nonmagical means unless you choose to leave a trail.",
      source: RANGER_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        upgradesTraitId: "hide_in_plain_sight",
        hideActionCost: "quick_action",
        harderToDetectWhileHidden: true,
        detectionBonusStatus: "pending_detection_runtime",
        blocksNonmagicalTracking: true,
        mayChooseToLeaveTrail: true,
      },
    },
    feral_senses: {
      schemaVersion: 1,
      id: "feral_senses",
      name: "Feral Senses",
      description: "You can see Invisible enemies that are Slower than you.",
      source: RANGER_SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { seeInvisibleIfTargetSpeedLower: true },
    },
    foe_slayer: {
      schemaVersion: 1,
      id: "foe_slayer",
      name: "Foe Slayer",
      description: "Against your Favored Enemy, at the start of your Turn select one effect until the start of your next Turn: deal +max(10, 10 × WIS Mod)% Damage, or gain +max(1, WIS Mod) Final Power.",
      source: RANGER_SOURCE,
      contexts: ["combat"],
      activation: {
        type: "choice",
        actionCost: "none",
        target: "self",
        inputs: [{ id: "foe_slayer_mode", type: "select", options: ["damage", "final_power"] }],
      },
      effects: [],
      rules: [],
      mechanics: {
        turnStartChoice: true,
        options: ["damage", "final_power"],
        damagePercentFormula: "max(10, 10 * WisdomMod)",
        finalPowerFormula: "max(1, WisdomMod)",
        requiresFavoredEnemy: true,
        expiresAt: "next_turn_start",
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
    rangerGrant(15, "primeval_awareness"),
    rangerGrant(25, "additional_attack"),
    rangerGrant(40, "lands_stride"),
    rangerGrant(50, "hide_in_plain_sight"),
    rangerGrant(70, "vanish"),
    rangerGrant(90, "feral_senses"),
    rangerGrant(100, "foe_slayer"),
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

  function activeAt(character = {}, level, engine) { return rangerLevel(character, engine) >= Math.max(0, intOr(level, 0)); }

  function wisdomModifier(character = {}) {
    const explicit = [
      character.wisdomMod, character.wisMod, character.wisdom_modifier,
      character.combatStats?.wisdomMod, character.combatStats?.wisMod,
    ].map(Number).find(Number.isFinite);
    if (Number.isFinite(explicit)) return Math.trunc(explicit);
    const score = [
      character.stats?.sabiduria, character.stats?.wisdom, character.wisdom, character.wis,
    ].map(Number).find(Number.isFinite);
    return Math.floor(((Number.isFinite(score) ? score : 10) - 10) / 2);
  }

  function rangerTerrainContext(character = {}, context = {}) {
    return {
      ...context,
      terrain: context.terrain ?? context.terrainType ?? character.currentTerrain ?? character.terrain ?? character.terrainType,
      biome: context.biome ?? context.biomeId ?? character.currentBiome ?? character.biome ?? character.biomeId,
      encounter: context.encounter ?? character.currentEncounter ?? character.encounter,
      environment: context.environment ?? character.currentEnvironment ?? character.environment,
      encounterType: context.encounterType ?? character.encounterType,
    };
  }

  function hideInPlainSightActionCost(character = {}, engine) {
    return activeAt(character, 70, engine) ? "quick_action" : "action";
  }

  function isHiddenInPlainSight(character = {}) { return character?.[HIDDEN_KEY] === true; }
  function hideInPlainSightPending(character = {}) { return character?.[HIDE_PENDING_KEY] === true; }

  function hideInPlainSightAvailable(character = {}, context = {}) {
    if (!activeAt(character, 50, context.engine)) return { available: false, reason: "hide_in_plain_sight_locked" };
    if (isHiddenInPlainSight(character)) return { available: false, reason: "already_hidden" };
    const terrainContext = rangerTerrainContext(character, context);
    if (!naturalExplorerMatches(character, terrainContext)) return { available: false, reason: "favored_terrain_required" };
    return { available: true, reason: null, actionCost: hideInPlainSightActionCost(character, context.engine) };
  }

  function armHideInPlainSight(character = {}, context = {}) {
    const gate = hideInPlainSightAvailable(character, context);
    if (!gate.available) return { success: false, ...gate };
    character[HIDE_PENDING_KEY] = true;
    return { success: true, pending: true, actionCost: gate.actionCost, resolvesAt: "turn_end" };
  }

  function hiddenStealthSucceeded(result) {
    if (typeof result === "boolean") return result;
    if (!result || typeof result !== "object") return null;
    if (typeof result.success === "boolean") return result.success;
    const outcome = normalizeId(result.outcome || result.result || result.status);
    if (["success", "succeeded", "pass", "passed"].includes(outcome)) return true;
    if (["failure", "failed", "fail"].includes(outcome)) return false;
    return null;
  }

  function emitRangerEvent(name, detail) {
    if (typeof global.CustomEvent === "function" && global.document?.dispatchEvent) {
      global.document.dispatchEvent(new global.CustomEvent(name, { detail }));
      return true;
    }
    return false;
  }

  function completeHideInPlainSight(character = {}, checkResult, options = {}) {
    if (!hideInPlainSightPending(character)) return { resolved: false, success: false, reason: "hide_not_pending" };
    const success = hiddenStealthSucceeded(checkResult);
    if (success == null) return { resolved: false, success: false, reason: "hidden_stealth_result_required", pending: true };
    character[HIDE_PENDING_KEY] = false;
    character[HIDDEN_KEY] = success === true;
    const result = {
      resolved: true,
      success,
      hidden: success === true,
      sourceTraitId: "hide_in_plain_sight",
      visualOnlyRetreat: success === true,
      leavesEncounter: false,
      preserveGridPosition: true,
    };
    if (success) emitRangerEvent("luminous:ranger-false-retreat", { character, ...result, context: options.context || null });
    return result;
  }

  function resolveHideInPlainSightTurnEnd(character = {}, options = {}) {
    if (!hideInPlainSightPending(character)) return { resolved: false, success: false, reason: "hide_not_pending" };
    let checkResult = options.hiddenStealthCheckResult ?? options.stealthCheckResult ?? null;
    const resolver = options.resolveHiddenStealthCheck || global.LuminousRangerHiddenStealthResolver;
    if (checkResult == null && typeof resolver === "function") {
      checkResult = resolver({
        character,
        abilityId: "dex",
        skillId: "stealth",
        hidden: true,
        sourceTraitId: "hide_in_plain_sight",
        context: options,
      });
      if (checkResult && typeof checkResult.then === "function") {
        emitRangerEvent("luminous:ranger-hidden-stealth-check", {
          character, abilityId: "dex", skillId: "stealth", hidden: true, sourceTraitId: "hide_in_plain_sight",
        });
        return { resolved: false, success: false, reason: "async_hidden_stealth_resolution_pending", pending: true };
      }
    }
    if (checkResult == null) {
      emitRangerEvent("luminous:ranger-hidden-stealth-check", {
        character, abilityId: "dex", skillId: "stealth", hidden: true, sourceTraitId: "hide_in_plain_sight",
      });
      return { resolved: false, success: false, reason: "hidden_stealth_check_required", pending: true };
    }
    return completeHideInPlainSight(character, checkResult, options);
  }

  function revealHideInPlainSight(character = {}, reason = "attack") {
    if (!isHiddenInPlainSight(character)) return { revealed: false, reason: "not_hidden" };
    character[HIDDEN_KEY] = false;
    const result = { revealed: true, reason, sourceTraitId: "hide_in_plain_sight" };
    emitRangerEvent("luminous:ranger-reappear", { character, ...result });
    return result;
  }

  function isAttackSkill(skill = {}) {
    const normalized = global.LuminousUniversalModifiers?.normalizeSkill?.({ ...skill }) || skill || {};
    const family = normalizeId(normalized.skillFamily || normalized.skill_family || normalized.family);
    if (family) return family === "attack";
    return !["defense", "spell", "roll", "check"].includes(normalizeId(normalized.type));
  }

  function onBeforeSkill(character = {}, skill = {}) {
    if (!isHiddenInPlainSight(character) || !isAttackSkill(skill)) return { revealed: false };
    return revealHideInPlainSight(character, "attack");
  }

  function canBeEnemyDirectTarget(character = {}) { return !isHiddenInPlainSight(character); }
  function filterEnemyDirectTargetCandidates(candidates = []) { return (candidates || []).filter((unit) => canBeEnemyDirectTarget(unit)); }

  function vanishPreventsNonmagicalTracking(character = {}, options = {}) {
    if (!activeAt(character, 70, options.engine)) return false;
    if (options.leaveTrail === true || options.voluntaryTrail === true) return false;
    return options.magical !== true && normalizeId(options.origin || options.methodOrigin || "nonmagical") !== "magical";
  }

  function isInvisible(unit = {}) {
    if (unit.invisible === true || unit.isInvisible === true) return true;
    const stores = [unit.statusEffects, unit.statuses, unit.conditions];
    return stores.some((store) => {
      if (Array.isArray(store)) return store.some((entry) => normalizeId(entry?.id || entry?.statusId || entry) === "invisible");
      return Boolean(store && typeof store === "object" && (store.invisible || store.Invisible));
    });
  }

  function unitSpeed(unit = {}) {
    const values = [
      unit.currentSpeed, unit.current_speed, unit.speed,
      unit.combatStats?.currentSpeed, unit.combatStats?.current_speed, unit.combatStats?.speed,
      unit.turnSpeed, unit.turn_speed, unit.maxSpeed, unit.max_speed, unit.combatStats?.maxSpeed, unit.combatStats?.max_speed,
    ].map(Number);
    const found = values.find(Number.isFinite);
    return Number.isFinite(found) ? found : null;
  }

  function feralSensesCanSee(character = {}, target = {}, options = {}) {
    if (!activeAt(character, 90, options.engine) || !isInvisible(target)) return false;
    const selfSpeed = Number(options.selfSpeed ?? options.rangerSpeed ?? unitSpeed(character));
    const targetSpeed = Number(options.targetSpeed ?? unitSpeed(target));
    return Number.isFinite(selfSpeed) && Number.isFinite(targetSpeed) && targetSpeed < selfSpeed;
  }

  function foeSlayerChoice(character = {}) {
    const value = normalizeId(character?.[FOE_SLAYER_CHOICE_KEY]);
    return ["damage", "final_power"].includes(value) ? value : null;
  }

  function foeSlayerChoicePending(character = {}) { return character?.[FOE_SLAYER_PENDING_KEY] === true; }

  function beginFoeSlayerTurn(character = {}, engine) {
    if (!activeAt(character, 100, engine)) return { active: false, reason: "foe_slayer_locked" };
    character[FOE_SLAYER_CHOICE_KEY] = null;
    character[FOE_SLAYER_PENDING_KEY] = true;
    return { active: true, pendingChoice: true, options: ["damage", "final_power"] };
  }

  function selectFoeSlayerChoice(character = {}, choice, engine) {
    if (!activeAt(character, 100, engine)) return { success: false, reason: "foe_slayer_locked" };
    if (!foeSlayerChoicePending(character)) return { success: false, reason: "foe_slayer_choice_not_pending" };
    const selected = normalizeId(typeof choice === "object" ? choice?.foe_slayer_mode || choice?.mode || choice?.value || choice?.id : choice);
    if (!["damage", "final_power"].includes(selected)) return { success: false, reason: "invalid_foe_slayer_choice", options: ["damage", "final_power"] };
    character[FOE_SLAYER_CHOICE_KEY] = selected;
    character[FOE_SLAYER_PENDING_KEY] = false;
    return { success: true, choice: selected };
  }

  function foeSlayerDamagePercent(character = {}, engine) {
    return activeAt(character, 100, engine) ? Math.max(10, 10 * wisdomModifier(character)) : 0;
  }

  function foeSlayerFinalPower(character = {}, engine) {
    return activeAt(character, 100, engine) ? Math.max(1, wisdomModifier(character)) : 0;
  }

  function foeSlayerBonuses(character = {}, target = {}, engine) {
    if (!activeAt(character, 100, engine) || !favoredEnemyMatches(character, target)) return { damagePercent: 0, finalPower: 0, choice: null };
    const choice = foeSlayerChoice(character);
    return {
      choice,
      damagePercent: choice === "damage" ? foeSlayerDamagePercent(character, engine) : 0,
      finalPower: choice === "final_power" ? foeSlayerFinalPower(character, engine) : 0,
    };
  }

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
    const originalCanActivateTrait = source.canActivateTrait?.bind(source);
    const originalActivateTrait = source.activateTrait?.bind(source);
    const originalDispatchCombatEvent = source.dispatchCombatEvent?.bind(source);

    function effectiveTrait(trait = {}, runtime = {}) {
      const next = clone(trait) || {};
      const id = traitBaseId(next);
      const character = runtime.character || runtime.self || {};
      if (id === "hide_in_plain_sight" && next.activation) next.activation.actionCost = hideInPlainSightActionCost(character, source);
      return next;
    }

    function rangerCanActivateTrait(trait = {}, runtime = {}, state) {
      const next = effectiveTrait(trait, runtime);
      const result = originalCanActivateTrait ? originalCanActivateTrait(next, runtime, state) : { available: true, reasons: [], trait: next, state };
      const id = traitBaseId(next);
      const character = runtime.character || runtime.self || {};
      const reasons = [...(result.reasons || [])];
      if (id === "hide_in_plain_sight") {
        const gate = hideInPlainSightAvailable(character, { ...runtime, engine: source });
        if (!gate.available && !reasons.includes(gate.reason)) reasons.push(gate.reason);
      }
      if (id === "foe_slayer" && !foeSlayerChoicePending(character) && !reasons.includes("foe_slayer_choice_not_pending")) reasons.push("foe_slayer_choice_not_pending");
      return { ...result, available: reasons.length === 0, reasons, trait: next, actionCost: next.activation?.actionCost || result.actionCost };
    }

    function rangerActivateTrait(trait = {}, runtime = {}, state) {
      const gate = rangerCanActivateTrait(trait, runtime, state);
      if (!gate.available) return { ...gate, outcomes: [] };
      const next = gate.trait;
      const result = originalActivateTrait ? originalActivateTrait(next, runtime, state) : { available: true, trait: next, runtime, state, outcomes: [] };
      const id = traitBaseId(next);
      const character = result.runtime?.self || result.runtime?.character || runtime.self || runtime.character || {};
      if (result?.available !== false && id === "hide_in_plain_sight" && result.scheduled !== true) {
        const armed = armHideInPlainSight(character, { ...runtime, engine: source });
        result.outcomes = [...(result.outcomes || []), { type: "ranger_hide_in_plain_sight_pending", traitId: id, ...armed }];
      }
      if (result?.available !== false && id === "foe_slayer") {
        const selected = selectFoeSlayerChoice(character, runtime.choice, source);
        if (!selected.success) return { ...result, available: false, reasons: [selected.reason], outcomes: [] };
        result.outcomes = [...(result.outcomes || []), { type: "ranger_foe_slayer_selected", traitId: id, ...selected }];
      }
      return result;
    }

    function rangerListAvailableTraitActions(traits = [], runtime = {}, state) {
      return (traits || []).map((trait) => rangerCanActivateTrait(trait, runtime, state))
        .filter((result) => ["manual", "prompt", "choice"].includes(normalizeId(result.trait?.activation?.type)))
        .map((result) => ({
          traitId: result.trait.id,
          name: result.trait.name,
          activationType: result.trait.activation.type,
          actionCost: result.actionCost,
          available: result.available,
          reasons: result.reasons,
          maximum: result.maximum,
          remaining: result.remaining,
          target: result.trait.activation.target || "self",
          inputs: clone(result.trait.activation.inputs || []),
        }));
    }

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __rangerClassRuntimeWrapped: true,
      resolveTheatreCheck(input = {}) {
        const result = originalResolveTheatreCheck ? originalResolveTheatreCheck(input) : { check: clone(input.check || {}), state: input.state, outcomes: [] };
        const traits = input.traits || [];
        if (hasTrait(traits, "favored_enemy") && !result.check?.__rangerFavoredEnemyTrackingApplied && isTrackingSurvivalCheck(result.check || input.check || {})) {
          const target = input.target || input.trackingTarget || input.check?.target || null;
          const bonus = target ? survivalTrackingBonus(input.character || {}, target) : 0;
          if (bonus) {
            result.check.finalPower = Number(result.check.finalPower || 0) + bonus;
            result.check.__rangerFavoredEnemyTrackingApplied = true;
            result.outcomes = [...(result.outcomes || []), { type: "ranger_favored_enemy_tracking", traitId: "favored_enemy", finalPowerBonus: bonus }];
          }
        }
        return result;
      },
      canActivateTrait: rangerCanActivateTrait,
      activateTrait: rangerActivateTrait,
      listAvailableTraitActions: rangerListAvailableTraitActions,
      dispatchCombatEvent(trigger, input = {}) {
        const result = originalDispatchCombatEvent ? originalDispatchCombatEvent(trigger, input) : { state: input.state, runtime: input, outcomes: [] };
        const normalizedTrigger = normalizeId(trigger);
        const character = input.character || input.self || result.runtime?.character || result.runtime?.self || {};
        const traits = input.traits || [];
        const outcomes = [...(result.outcomes || [])];
        if (normalizedTrigger === "turn_start" && hasTrait(traits, "foe_slayer")) {
          const started = beginFoeSlayerTurn(character, source);
          if (started.active) outcomes.push({ type: "ranger_foe_slayer_choice_required", traitId: "foe_slayer", ...started });
        }
        if (normalizedTrigger === "before_skill" && hasTrait(traits, "hide_in_plain_sight")) {
          const revealed = onBeforeSkill(character, input.skill || result.runtime?.skill || {});
          if (revealed.revealed) outcomes.push({ type: "ranger_hide_in_plain_sight_revealed", traitId: "hide_in_plain_sight", ...revealed });
        }
        if (normalizedTrigger === "turn_end" && hasTrait(traits, "hide_in_plain_sight") && hideInPlainSightPending(character)) {
          const hideResult = resolveHideInPlainSightTurnEnd(character, { ...input, ...(result.runtime || {}) });
          outcomes.push({ type: "ranger_hide_in_plain_sight_turn_end", traitId: "hide_in_plain_sight", ...hideResult });
        }
        return { ...result, outcomes };
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
        if (hasTrait(traits, "foe_slayer") && options.target) {
          const bonus = foeSlayerBonuses(character, options.target);
          output.final_power += bonus.finalPower;
          output.damage_dealt_multiplier += bonus.damagePercent / 10;
        }
        return output;
      },
    });
    return true;
  }

  function wrapCombatTargeting() {
    const source = global.LuminousCombatAction;
    if (!source) return false;
    if (source.__rangerHiddenTargetingWrapped) return true;
    const originalResolveTargetSelection = source.resolveTargetSelection?.bind(source);
    if (!originalResolveTargetSelection) return false;
    global.LuminousCombatAction = Object.freeze({
      ...source,
      __rangerHiddenTargetingWrapped: true,
      resolveTargetSelection(actionInput = {}, candidates = [], options = {}) {
        const action = source.normalizeCombatAction ? source.normalizeCombatAction(actionInput) : actionInput;
        const allegiance = normalizeId(action?.targeting?.allegiance || "");
        const mode = normalizeId(action?.targeting?.mode || "");
        const directEnemyTargeting = allegiance === "enemy" && !["aoe", "indiscriminate"].includes(mode);
        const pool = directEnemyTargeting ? filterEnemyDirectTargetCandidates(candidates) : candidates;
        return originalResolveTargetSelection(actionInput, pool, options);
      },
    });
    return true;
  }

  function install() {
    const catalog = wrapCatalog();
    const engine = wrapTraitEngine();
    wrapModifierEngine();
    wrapCombatTargeting();
    return catalog && engine;
  }

  const api = Object.freeze({
    CLASS_ID, CLASS_NAME, CATALOG_VERSION, RANGER_SOURCE, FAVORED_TERRAINS, TERRAIN_ALIASES, RANGER_DEFINITIONS, RANGER_GRANTS,
    rangerLevel, activeAt, favoredEnemyChoiceCount, naturalExplorerChoiceCount, normalizeFavoredEnemyChoice, favoredEnemyChoices, applyFavoredEnemyChoices,
    normalizeTerrain, naturalExplorerChoices, applyNaturalExplorerChoices, favoredEnemyMatches, favoredEnemyFinalPowerBonus, survivalTrackingBonus,
    analyseAutomaticallySucceeds, resolveAnalyse, terrainTokens, naturalExplorerMatches, naturalExplorerClashPowerBonus,
    wisdomModifier, rangerTerrainContext, hideInPlainSightActionCost, hideInPlainSightAvailable, armHideInPlainSight, hideInPlainSightPending,
    isHiddenInPlainSight, completeHideInPlainSight, resolveHideInPlainSightTurnEnd, revealHideInPlainSight, onBeforeSkill,
    canBeEnemyDirectTarget, filterEnemyDirectTargetCandidates, vanishPreventsNonmagicalTracking, isInvisible, unitSpeed, feralSensesCanSee,
    foeSlayerChoice, foeSlayerChoicePending, beginFoeSlayerTurn, selectFoeSlayerChoice, foeSlayerDamagePercent, foeSlayerFinalPower, foeSlayerBonuses,
    fightingStyleOptions, applyFightingStyleChoice, isTrackingSurvivalCheck, wrapCatalog, wrapTraitEngine, wrapModifierEngine, wrapCombatTargeting, install,
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
