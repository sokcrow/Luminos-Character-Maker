(function (global) {
  "use strict";

  const CLASS_ID = "fighter";
  const CLASS_NAME = "Fighter";
  const CATALOG_VERSION = 1;
  const SECOND_WIND_STATUS_ID = "second_wind";
  const fightingStyles = global.LuminousFightingStyleRuntime || (typeof require === "function" ? (() => { try { return require("./fighting-style-runtime.js"); } catch (_) { return null; } })() : null);

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const FIGHTER_SOURCE = Object.freeze({ type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME });

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const additionalAttackRule = (maxCoins) => ({
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
      { path: "skill.coinAmount", operator: "between", value: 2, max: maxCoins },
    ],
  });

  const FIGHTER_DEFINITIONS = deepFreeze({
    second_wind: {
      schemaVersion: 1,
      id: "second_wind",
      name: "Second Wind",
      description: "[On Encounter Start] Gain 1 + floor(Fighter Class Level / 20) Second Wind Count. Quick Action: Spend 1 Second Wind Count to recover 25% Max HP. [On Turn Start] Recover 2% Max HP per Second Wind Count.",
      source: FIGHTER_SOURCE,
      contexts: ["combat"],
      activation: {
        type: "manual",
        actionCost: "quick_action",
        target: "self",
        conditions: [{ path: "self.statusEffects.second_wind.count", operator: "gte", value: 1 }],
      },
      effects: [],
      rules: [],
      mechanics: {
        statusId: SECOND_WIND_STATUS_ID,
        encounterStartCountFormula: "1 + floor(ClassLevel / 20)",
        quickActionSpend: 1,
        quickActionHealPercent: 25,
        turnStartHealPercentPerCount: 2,
      },
    },
    action_surge: {
      schemaVersion: 1,
      id: "action_surge",
      name: "Action Surge",
      description: "Gain 1 additional Action this Turn (Once Per Turn).\n\nUses: (1, Class Level/30)\nRecharge: Short Rest or Long Rest.",
      source: FIGHTER_SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "none", target: "self", uses: { formula: "max(1, floor(ClassLevel / 30))", reset: "short_rest" } },
      effects: [],
      rules: [],
      mechanics: { additionalActions: 1, oncePerTurn: true, recharge: ["short_rest", "long_rest"] },
    },
    indomitable: {
      schemaVersion: 1,
      id: "indomitable",
      name: "Indomitable",
      description: "When you fail a Save Check, reroll failed Coins once (Once per Turn).\n\nUses: (1, Class Level/30)\nRecharge: Long Rest.",
      source: FIGHTER_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "prompt", actionCost: "none", target: "self", uses: { formula: "max(1, floor(ClassLevel / 30))", reset: "long_rest" } },
      effects: [],
      rules: [],
      mechanics: { saveCheckOnly: true, rerollFailedCoins: 1, oncePerTurn: true, recharge: ["long_rest"] },
    },
    additional_attack_plus: {
      schemaVersion: 1, id: "additional_attack_plus", name: "Additional Attack+",
      description: "Melee Attack Skills with 2, 3 or 4 Coins reuse the Skill's last Coin once per Skill.",
      source: FIGHTER_SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [],
      rules: [additionalAttackRule(4)], mechanics: { replacesTraitId: "additional_attack", maximumBaseCoins: 4 },
    },
    additional_attack_plus_plus: {
      schemaVersion: 1, id: "additional_attack_plus_plus", name: "Additional Attack++",
      description: "Melee Attack Skills with 2, 3, 4 or 5 Coins reuse the Skill's last Coin once per Skill.",
      source: FIGHTER_SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [],
      rules: [additionalAttackRule(5)], mechanics: { replacesTraitId: "additional_attack_plus", maximumBaseCoins: 5 },
    },
  });

  const fighterGrant = (level, traitId) => ({
    id: `core_class_fighter_l${level}_${traitId}`,
    sourceType: "class",
    sourceId: CLASS_ID,
    source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level },
    atLevel: level,
    traitId,
    grantType: "trait",
    multiclassPolicy: "allowed",
  });

  const FIGHTER_GRANTS = deepFreeze([
    fighterGrant(1, "second_wind"),
    fighterGrant(10, "fighting_style"),
    fighterGrant(10, "action_surge"),
    fighterGrant(25, "additional_attack"),
    fighterGrant(45, "indomitable"),
    fighterGrant(55, "additional_attack_plus"),
    fighterGrant(100, "additional_attack_plus_plus"),
  ]);

  function fightingStyleOptions() {
    return fightingStyles?.catalog?.forClass?.(CLASS_ID) || global.LuminousFightingStyleCatalog?.forClass?.(CLASS_ID) || [];
  }

  function applyFightingStyleChoice(character = {}, styleId) {
    const runtime = global.LuminousFightingStyleRuntime || fightingStyles;
    if (!runtime?.applyChoice) return { success: false, reason: "fighting_style_runtime_unavailable" };
    return runtime.applyChoice(character, CLASS_ID, styleId);
  }

  function classEntries(character = {}) {
    const candidates = [character.classes, character.characterBuild?.classes, character.dnd?.classes, character.classLevels];
    for (const value of candidates) {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        return Object.entries(value).map(([id, entry]) => typeof entry === "object" ? { id, ...entry } : { id, level: entry });
      }
    }
    return [];
  }

  function fighterClassLevel(character = {}, engine = global.LuminousTraitEngine) {
    if (engine?.getClassLevel) {
      const viaEngine = Number(engine.getClassLevel(character, CLASS_ID));
      if (Number.isFinite(viaEngine) && viaEngine > 0) return Math.max(0, Math.trunc(viaEngine));
    }
    const found = classEntries(character).find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level ?? found?.classLevel, 0));
  }

  function secondWindMaximum(character = {}, engine = global.LuminousTraitEngine) {
    const level = fighterClassLevel(character, engine);
    return level >= 1 ? 1 + Math.floor(level / 20) : 0;
  }

  function fighterScalingUses(character = {}, engine = global.LuminousTraitEngine) {
    return Math.max(1, Math.floor(fighterClassLevel(character, engine) / 30));
  }

  function collapseAdditionalAttackProgression(character = {}, traits = [], engine = global.LuminousTraitEngine) {
    const level = fighterClassLevel(character, engine);
    if (level >= 100) return (traits || []).filter((trait) => !["additional_attack", "additional_attack_plus"].includes(traitBaseId(trait)));
    if (level >= 55) return (traits || []).filter((trait) => traitBaseId(trait) !== "additional_attack");
    return traits || [];
  }

  function actionEconomyTurnKey(runtime = {}, unit = null) {
    const explicit = Number(runtime.turnNumber ?? runtime.TurnNumber);
    if (Number.isFinite(explicit)) return `turn:${Math.trunc(explicit)}`;
    const snapshot = global.LuminousActionEconomy?.snapshot?.(unit || runtime.self || runtime.character, { phase: runtime.phase || "planning" });
    return Number.isFinite(Number(snapshot?.turn)) ? `turn:${Math.trunc(Number(snapshot.turn))}` : null;
  }

  function oncePerTurnBlocked(state, flagId, runtime, unit) {
    const key = actionEconomyTurnKey(runtime, unit);
    return Boolean(key && state?.flags?.[flagId] === key);
  }

  function markOncePerTurn(state, flagId, runtime, unit) {
    const key = actionEconomyTurnKey(runtime, unit);
    if (key && state?.flags) state.flags[flagId] = key;
    return key;
  }

  function saveCheck(check = {}) {
    return [check.kind, check.checkType, check.type, check.category].map(normalizeId).some((id) => ["save", "save_check", "saving_throw", "savingthrow"].includes(id));
  }

  function failedCheck(check = {}) {
    const outcome = normalizeId(check.outcome || check.result);
    return check.passed === false || check.failed === true || ["fail", "failed"].includes(outcome);
  }

  function coinFailed(coin = {}) {
    const side = normalizeId(coin.side || coin.face || coin.result);
    return coin.success === false || coin.passed === false || ["tail", "tails", "fail", "failed"].includes(side);
  }

  function checkCoins(check = {}) {
    if (Array.isArray(check.tosses)) return check.tosses;
    if (Array.isArray(check.coins)) return check.coins;
    return [];
  }

  function rerollFailedSaveCoins(check = {}, rng = Math.random) {
    if (!saveCheck(check)) return { success: false, reason: "save_check_required", rerolled: 0, check };
    if (!failedCheck(check)) return { success: false, reason: "failed_save_required", rerolled: 0, check };
    const coins = checkCoins(check);
    const failed = coins.map((coin, index) => ({ coin, index })).filter(({ coin }) => coinFailed(coin));
    if (!failed.length) return { success: false, reason: "no_failed_coins", rerolled: 0, check };
    const chance = Math.max(0, Math.min(100, numberOr(check.headsChance, 50)));
    failed.forEach(({ coin }) => {
      const side = global.LuminousCoinEngine?.rollSide ? global.LuminousCoinEngine.rollSide(chance, rng) : (Number(rng()) * 100 < chance ? "head" : "tail");
      coin.side = side;
      if (Object.prototype.hasOwnProperty.call(coin, "success")) coin.success = side === "head";
      if (Object.prototype.hasOwnProperty.call(coin, "passed")) coin.passed = side === "head";
      coin.rerolledBy = "indomitable";
    });
    const heads = coins.filter((coin) => normalizeId(coin?.side) === "head").length;
    check.heads = heads;
    check.indomitableReroll = { rerolled: failed.length, failedIndexes: failed.map(({ index }) => index) };
    check.needsOutcomeRecalculation = true;
    return { success: true, rerolled: failed.length, failedIndexes: failed.map(({ index }) => index), heads, check };
  }

  function traitBaseId(trait = {}) {
    return normalizeId(trait.baseTraitId || String(trait.id || trait.name || "").split("__class__")[0]);
  }

  function hasSecondWindTrait(traits = []) {
    return (traits || []).some((trait) => traitBaseId(trait) === "second_wind");
  }

  function statusEngine() {
    return global.LuminousStatusEngine || null;
  }

  function getStatus(unit, statusId) {
    if (!unit) return null;
    const id = normalizeId(statusId);
    const engine = statusEngine();
    if (engine?.getStatus) return engine.getStatus(unit, id);
    const value = unit.statusEffects?.[id];
    return value && typeof value === "object" ? clone(value) : null;
  }

  function applyStatus(unit, statusId, input = {}) {
    if (!unit) return null;
    const id = normalizeId(statusId);
    const engine = statusEngine();
    if (engine?.applyStatus) return engine.applyStatus(unit, id, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    unit.statusEffects[id] = {
      id,
      name: input.name || "Second Wind",
      count: Math.max(0, numberOr(input.count, 0)),
      potency: numberOr(input.potency, 0),
      duration: normalizeId(input.duration || "encounter"),
      sourceTraitId: input.sourceTraitId || "second_wind",
      sourceUnitId: input.sourceUnitId || null,
      data: clone(input.data || {}),
    };
    return clone(unit.statusEffects[id]);
  }

  function removeStatus(unit, statusId) {
    if (!unit) return { removed: false, statusId: normalizeId(statusId) };
    const id = normalizeId(statusId);
    const engine = statusEngine();
    if (engine?.removeStatus) return engine.removeStatus(unit, id, { from: "self", ignoreProtection: true });
    const removed = Boolean(unit.statusEffects && Object.prototype.hasOwnProperty.call(unit.statusEffects, id));
    if (removed) delete unit.statusEffects[id];
    return { removed, statusId: id };
  }

  function secondWindCount(unit) {
    return Math.max(0, intOr(getStatus(unit, SECOND_WIND_STATUS_ID)?.count, 0));
  }

  function setSecondWindCount(unit, count) {
    const next = Math.max(0, intOr(count, 0));
    if (next <= 0) {
      removeStatus(unit, SECOND_WIND_STATUS_ID);
      return null;
    }
    return applyStatus(unit, SECOND_WIND_STATUS_ID, {
      name: "Second Wind",
      count: next,
      potency: 0,
      duration: "encounter",
      sourceTraitId: "second_wind",
      sourceUnitId: unit?.id || unit?.unitId || unit?.characterId || null,
      mode: "set",
    });
  }

  function spendSecondWindCount(unit, amount = 1) {
    const spend = Math.max(0, intOr(amount, 1));
    const before = secondWindCount(unit);
    if (!spend || before < spend) return { success: false, spent: 0, before, after: before };
    const after = before - spend;
    setSecondWindCount(unit, after);
    return { success: true, spent: spend, before, after };
  }

  function readHp(unit = {}) {
    const max = unit.maxHp ?? unit.hp_max ?? unit.combatStats?.hp_max;
    const current = unit.hp ?? unit.currentHp ?? unit.hp_actual ?? unit.combatStats?.hp_actual;
    return {
      current: Number.isFinite(Number(current)) ? Number(current) : null,
      max: Number.isFinite(Number(max)) ? Number(max) : null,
    };
  }

  function writeHp(unit, value) {
    if (!unit) return null;
    const next = Math.max(0, Math.floor(numberOr(value, 0)));
    if (Object.prototype.hasOwnProperty.call(unit, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentHp")) unit.currentHp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "hp_actual")) unit.hp_actual = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "hp_actual")) unit.combatStats.hp_actual = next;
    else unit.currentHp = next;
    return next;
  }

  function healPercent(unit, percent) {
    const hp = readHp(unit);
    if (hp.current == null || hp.max == null) return { amount: 0, before: hp.current, after: hp.current, max: hp.max, percent };
    const requested = Math.max(0, Math.floor(hp.max * Math.max(0, numberOr(percent, 0)) / 100));
    const after = Math.min(hp.max, hp.current + requested);
    writeHp(unit, after);
    return { amount: Math.max(0, after - hp.current), before: hp.current, after, max: hp.max, requested, percent };
  }

  function initializeSecondWind(character, unit, engine = global.LuminousTraitEngine) {
    const target = unit || character;
    const maximum = secondWindMaximum(character || target || {}, engine);
    const status = setSecondWindCount(target, maximum);
    return { count: maximum, maximum, status };
  }

  function applyTurnStartSecondWind(unit) {
    const count = secondWindCount(unit);
    if (count <= 0) return { count: 0, percent: 0, heal: { amount: 0 } };
    const percent = count * 2;
    return { count, percent, heal: healPercent(unit, percent) };
  }

  function grantIdentity(grantValue = {}) {
    return `${grantValue.sourceType}:${grantValue.sourceId}:${grantValue.traitId}:${grantValue.atLevel}`;
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || (typeof require === "function" ? (() => { try { return require("./trait-catalog-core.js"); } catch (_) { return null; } })() : null);
    if (!source) return false;
    if (source.__fighterClassExtended) return true;

    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));

    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(FIGHTER_DEFINITIONS) });
    const allGrants = () => {
      const combined = [...baseGrants(), ...clone(FIGHTER_GRANTS)];
      const seen = new Set();
      return combined.filter((item) => {
        const identity = grantIdentity(item);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
    };
    const getDefinition = (id) => clone(FIGHTER_DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const base = baseValidate(engine);
      const errors = [...(base.errors || [])];
      const warnings = [...(base.warnings || [])];
      Object.entries(FIGHTER_DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) return;
        const validation = engine.validateTrait(definition);
        validation.errors.forEach((message) => errors.push(`${key}: ${message}`));
        validation.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      });
      return { valid: base.valid !== false && !errors.length, errors, warnings };
    };

    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __fighterClassExtended: true,
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

  function applyCombatTrigger(engine, traits, trigger, runtime, outcomes) {
    const normalized = normalizeId(trigger);
    if (!hasSecondWindTrait(traits)) return;
    const unit = runtime.self || runtime.character || null;
    const character = runtime.character || unit || {};
    if (!unit) return;

    if (normalized === "encounter_start") {
      const initialized = initializeSecondWind(character, unit, engine);
      outcomes.push({ type: "fighter_second_wind_encounter_start", traitId: "second_wind", unit, ...initialized });
    } else if (normalized === "turn_start") {
      const result = applyTurnStartSecondWind(unit);
      if (result.count > 0) outcomes.push({ type: "fighter_second_wind_turn_heal", traitId: "second_wind", unit, ...result });
    } else if (normalized === "encounter_end") {
      const removed = removeStatus(unit, SECOND_WIND_STATUS_ID);
      outcomes.push({ type: "fighter_second_wind_encounter_end", traitId: "second_wind", unit, removed });
    }
  }

  function applySecondWindActivation(result) {
    const trait = result?.trait;
    if (traitBaseId(trait) !== "second_wind" || !result?.available || result?.scheduled) return result;
    const runtime = result.runtime || {};
    const unit = runtime.self || runtime.character || null;
    if (!unit) return result;
    const spent = spendSecondWindCount(unit, 1);
    if (!spent.success) {
      return { ...result, available: false, reasons: ["No Second Wind Count remaining."], outcomes: result.outcomes || [] };
    }
    const heal = healPercent(unit, 25);
    result.outcomes = [...(result.outcomes || []), {
      type: "fighter_second_wind_used",
      traitId: trait.id || "second_wind",
      statusId: SECOND_WIND_STATUS_ID,
      spent: spent.spent,
      countBefore: spent.before,
      countAfter: spent.after,
      heal,
    }];
    return result;
  }

  function wrapEngine() {
    const source = global.LuminousTraitEngine || (typeof require === "function" ? (() => { try { return require("./trait-engine.js"); } catch (_) { return null; } })() : null);
    if (!source) return false;
    if (source.__fighterClassRuntimeWrapped) return true;

    const originalDispatchCombatEvent = source.dispatchCombatEvent?.bind(source);
    const originalActivateTrait = source.activateTrait?.bind(source);
    const originalResolveTraitGrants = source.resolveTraitGrants?.bind(source);

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __fighterClassRuntimeWrapped: true,
      dispatchCombatEvent(trigger, input = {}) {
        const result = originalDispatchCombatEvent
          ? originalDispatchCombatEvent(trigger, input)
          : { state: input.state, runtime: input, outcomes: [] };
        if (normalizeId(trigger) === "long_rest" && result.state) source.resetUsage?.(result.state, "short_rest");
        const extras = [];
        applyCombatTrigger(source, input.traits || [], trigger, result.runtime || input, extras);
        result.outcomes = [...(result.outcomes || []), ...extras];
        return result;
      },
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolveTraitGrants ? originalResolveTraitGrants(character, grants, definitions) : [];
        return collapseAdditionalAttackProgression(character, base, source);
      },
      activateTrait(traitInput, runtime = {}, state) {
        const trait = source.normalizeTrait ? source.normalizeTrait(traitInput) : traitInput;
        const traitId = traitBaseId(trait);
        const traitState = state || source.createState?.();
        const unit = runtime.self || runtime.character || null;
        if (traitId === "second_wind" && secondWindCount(unit) <= 0) {
          return { available: false, reasons: ["No Second Wind Count remaining."], maximum: null, remaining: 0, actionCost: "quick_action", trait, state: traitState, runtime, outcomes: [] };
        }
        if (traitId === "action_surge" && oncePerTurnBlocked(traitState, "fighter_action_surge_turn", runtime, unit)) {
          return { available: false, reasons: ["Action Surge can only be used once per Turn."], maximum: fighterScalingUses(runtime.character || unit, source), remaining: null, actionCost: "none", trait, state: traitState, runtime, outcomes: [] };
        }
        if (traitId === "indomitable") {
          if (!saveCheck(runtime.check || {})) return { available: false, reasons: ["Indomitable requires a Save Check."], maximum: fighterScalingUses(runtime.character || unit, source), remaining: null, actionCost: "none", trait, state: traitState, runtime, outcomes: [] };
          if (!failedCheck(runtime.check || {})) return { available: false, reasons: ["Indomitable requires a failed Save Check."], maximum: fighterScalingUses(runtime.character || unit, source), remaining: null, actionCost: "none", trait, state: traitState, runtime, outcomes: [] };
          if (!checkCoins(runtime.check || {}).some(coinFailed)) return { available: false, reasons: ["Indomitable requires at least one failed Coin."], maximum: fighterScalingUses(runtime.character || unit, source), remaining: null, actionCost: "none", trait, state: traitState, runtime, outcomes: [] };
          if (oncePerTurnBlocked(traitState, "fighter_indomitable_turn", runtime, unit)) return { available: false, reasons: ["Indomitable can only be used once per Turn."], maximum: fighterScalingUses(runtime.character || unit, source), remaining: null, actionCost: "none", trait, state: traitState, runtime, outcomes: [] };
        }
        const result = originalActivateTrait ? originalActivateTrait(traitInput, runtime, traitState) : { available: false, reasons: ["Trait Engine activation is unavailable."], trait, runtime, state: traitState, outcomes: [] };
        let resolved = applySecondWindActivation(result);
        if (traitId === "action_surge" && resolved?.available && !resolved?.scheduled) {
          const grant = runtime.actionEconomy?.grantActionSlots?.(1) || global.LuminousActionEconomy?.grantTemporaryActionSlots?.(unit, 1, { phase: runtime.phase || "planning" }) || null;
          if (!grant?.granted) return { ...resolved, available: false, reasons: [grant?.reason || "Action Surge could not grant an Action."], outcomes: resolved.outcomes || [] };
          const turnKey = markOncePerTurn(resolved.state, "fighter_action_surge_turn", runtime, unit);
          resolved.outcomes = [...(resolved.outcomes || []), { type: "fighter_action_surge", traitId: "action_surge", additionalActions: 1, turnKey, grant }];
        }
        if (traitId === "indomitable" && resolved?.available && !resolved?.scheduled) {
          const reroll = rerollFailedSaveCoins(runtime.check || {}, runtime.rng || Math.random);
          if (!reroll.success) return { ...resolved, available: false, reasons: [reroll.reason || "Indomitable reroll failed."], outcomes: resolved.outcomes || [] };
          const turnKey = markOncePerTurn(resolved.state, "fighter_indomitable_turn", runtime, unit);
          resolved.outcomes = [...(resolved.outcomes || []), { type: "fighter_indomitable", traitId: "indomitable", turnKey, ...reroll }];
        }
        return resolved;
      },
    });
    return true;
  }

  function install() {
    const catalog = wrapCatalog();
    const engine = wrapEngine();
    return catalog && engine;
  }

  const api = Object.freeze({
    CLASS_ID,
    CLASS_NAME,
    CATALOG_VERSION,
    SECOND_WIND_STATUS_ID,
    FIGHTER_DEFINITIONS,
    FIGHTER_GRANTS,
    fightingStyleOptions,
    applyFightingStyleChoice,
    fighterClassLevel,
    secondWindMaximum,
    secondWindCount,
    setSecondWindCount,
    spendSecondWindCount,
    healPercent,
    initializeSecondWind,
    applyTurnStartSecondWind,
    fighterScalingUses,
    collapseAdditionalAttackProgression,
    rerollFailedSaveCoins,
    grantIdentity,
    wrapCatalog,
    wrapEngine,
    install,
  });

  global.LuminousFighterClassRuntime = api;
  install();
  if (!global.document && typeof queueMicrotask === "function") queueMicrotask(install);
  if (global.document && global.setInterval) {
    const timer = global.setInterval(() => {
      if (install()) global.clearInterval?.(timer);
    }, 800);
    timer?.unref?.();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
