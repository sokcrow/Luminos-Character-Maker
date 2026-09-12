(function (global) {
  "use strict";

  const CLASS_ID = "fighter";
  const CLASS_NAME = "Fighter";
  const CATALOG_VERSION = 1;
  const SECOND_WIND_STATUS_ID = "second_wind";

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
    fighterGrant(5, "second_wind"),
  ]);

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
    return level >= 5 ? 1 + Math.floor(level / 20) : 0;
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

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __fighterClassRuntimeWrapped: true,
      dispatchCombatEvent(trigger, input = {}) {
        const result = originalDispatchCombatEvent
          ? originalDispatchCombatEvent(trigger, input)
          : { state: input.state, runtime: input, outcomes: [] };
        const extras = [];
        applyCombatTrigger(source, input.traits || [], trigger, result.runtime || input, extras);
        result.outcomes = [...(result.outcomes || []), ...extras];
        return result;
      },
      activateTrait(traitInput, runtime = {}, state) {
        const trait = source.normalizeTrait ? source.normalizeTrait(traitInput) : traitInput;
        if (traitBaseId(trait) === "second_wind" && secondWindCount(runtime.self || runtime.character) <= 0) {
          return {
            available: false,
            reasons: ["No Second Wind Count remaining."],
            maximum: null,
            remaining: 0,
            actionCost: "quick_action",
            trait,
            state: state || source.createState?.(),
            runtime,
            outcomes: [],
          };
        }
        const result = originalActivateTrait
          ? originalActivateTrait(traitInput, runtime, state)
          : { available: false, reasons: ["Trait Engine activation is unavailable."], trait, runtime, state, outcomes: [] };
        return applySecondWindActivation(result);
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
    fighterClassLevel,
    secondWindMaximum,
    secondWindCount,
    setSecondWindCount,
    spendSecondWindCount,
    healPercent,
    initializeSecondWind,
    applyTurnStartSecondWind,
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
