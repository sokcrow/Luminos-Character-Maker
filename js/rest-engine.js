(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const REST_STATE_KEY = "restResources";
  const RECOVER_LEVEL_INTERVAL = 5;
  const RECOVER_FLAT_BONUS = 5;
  const SHORT_REST_MIN_HOURS = 1;
  const SHORT_REST_MAX_HOURS = 2;
  const LONG_REST_MIN_HOURS = 6;
  const LONG_REST_MAX_HOURS = 8;
  const SHORT_REST_AUGMENT_MAX_HP_PERCENT_CAP = 5;

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function buildRules() {
    if (global.LuminousCharacterBuildRules) return global.LuminousCharacterBuildRules;
    if (typeof require === "function") {
      try { return require("./character-build-rules.js"); } catch (_) {}
    }
    return null;
  }

  function traitEngine() {
    if (global.LuminousTraitEngine) return global.LuminousTraitEngine;
    if (typeof require === "function") {
      try { return require("./trait-engine.js"); } catch (_) {}
    }
    return null;
  }

  function classEntries(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = Array.isArray(character.classes)
      ? character.classes
      : (Array.isArray(build.classes) ? build.classes : []);
    if (source.length) {
      return source
        .map((entry) => ({
          classId: normalizeId(entry?.classId || entry?.id),
          levels: Math.max(0, integerOr(entry?.levels ?? entry?.level, 0)),
        }))
        .filter((entry) => entry.classId && entry.levels > 0);
    }
    const map = character.classLevels || character.classesById || build.classLevels || {};
    return Object.entries(map)
      .map(([classId, value]) => ({
        classId: normalizeId(classId),
        levels: Math.max(0, integerOr(value?.levels ?? value?.level ?? value, 0)),
      }))
      .filter((entry) => entry.classId && entry.levels > 0);
  }

  function getClassLevel(character, classId) {
    const id = normalizeId(classId);
    return classEntries(character).find((entry) => entry.classId === id)?.levels || 0;
  }

  function getClassDefinition(classId) {
    const rules = buildRules();
    const id = normalizeId(classId);
    if (rules?.getClass) return rules.getClass(id);
    if (Array.isArray(rules?.CLASSES)) return rules.CLASSES.find((entry) => normalizeId(entry?.id) === id) || null;
    return null;
  }

  function getClassBaseHp(classId) {
    const definition = getClassDefinition(classId);
    const value = numberOr(definition?.hpPer5, NaN);
    return Number.isFinite(value) ? value : null;
  }

  function maxRecoverSlots(character, classId) {
    return Math.max(0, Math.floor(getClassLevel(character, classId) / RECOVER_LEVEL_INTERVAL));
  }

  function ensureRestState(character) {
    if (!character || typeof character !== "object") throw new Error("Rest Engine requires a character object.");
    if (!character[REST_STATE_KEY] || typeof character[REST_STATE_KEY] !== "object" || Array.isArray(character[REST_STATE_KEY])) {
      character[REST_STATE_KEY] = {};
    }
    const state = character[REST_STATE_KEY];
    state.schemaVersion = SCHEMA_VERSION;
    if (!state.recoverByClass || typeof state.recoverByClass !== "object" || Array.isArray(state.recoverByClass)) state.recoverByClass = {};
    if (!Array.isArray(state.history)) state.history = [];
    classEntries(character).forEach(({ classId }) => reconcileRecoverPool(character, classId, state));
    return state;
  }

  function reconcileRecoverPool(character, classId, stateInput) {
    const state = stateInput || ensureRestState(character);
    const id = normalizeId(classId);
    if (!id) throw new Error("Recover requires a classId.");
    if (!state.recoverByClass[id] || typeof state.recoverByClass[id] !== "object" || Array.isArray(state.recoverByClass[id])) {
      state.recoverByClass[id] = { spent: 0, blocked: [] };
    }
    const pool = state.recoverByClass[id];
    pool.spent = Math.max(0, integerOr(pool.spent, 0));
    if (!Array.isArray(pool.blocked)) pool.blocked = [];
    pool.blocked = pool.blocked
      .map((entry) => ({
        remainingLongRests: Math.max(0, integerOr(entry?.remainingLongRests ?? entry?.longRests, 0)),
        sourceTraitId: normalizeId(entry?.sourceTraitId) || null,
        blockedAt: Number.isFinite(Number(entry?.blockedAt)) ? Number(entry.blockedAt) : null,
      }))
      .filter((entry) => entry.remainingLongRests > 0);
    const maximum = maxRecoverSlots(character, id);
    pool.spent = Math.min(pool.spent, Math.max(0, maximum - pool.blocked.length));
    return pool;
  }

  function recoverPool(character, classId) {
    const state = ensureRestState(character);
    const id = normalizeId(classId);
    const pool = reconcileRecoverPool(character, id, state);
    const maximum = maxRecoverSlots(character, id);
    const blocked = pool.blocked.length;
    const spent = Math.min(pool.spent, Math.max(0, maximum - blocked));
    return {
      classId: id,
      classLevel: getClassLevel(character, id),
      classBaseHp: getClassBaseHp(id),
      maximum,
      spent,
      blocked,
      blockedSlots: clone(pool.blocked),
      available: Math.max(0, maximum - spent - blocked),
    };
  }

  function listRecoverPools(character) {
    ensureRestState(character);
    return classEntries(character).map(({ classId }) => recoverPool(character, classId));
  }

  function canSpendRecoverSlots(character, classId, count = 1) {
    const requested = Math.max(0, integerOr(count, 0));
    const pool = recoverPool(character, classId);
    return {
      available: requested > 0 && pool.available >= requested,
      requested,
      pool,
      reason: requested <= 0
        ? "Recover requires at least 1 slot."
        : (pool.available < requested ? `Only ${pool.available} Recover Slot(s) available for ${pool.classId}.` : null),
    };
  }

  function spendRecoverSlots(character, classId, count = 1, options = {}) {
    const check = canSpendRecoverSlots(character, classId, count);
    if (!check.available) return { ...check, spent: 0 };
    const state = ensureRestState(character);
    const pool = reconcileRecoverPool(character, classId, state);
    const blockLongRests = Math.max(0, integerOr(options.blockLongRests, 0));
    if (blockLongRests > 0) {
      for (let index = 0; index < check.requested; index += 1) {
        pool.blocked.push({
          remainingLongRests: blockLongRests,
          sourceTraitId: normalizeId(options.sourceTraitId) || null,
          blockedAt: Date.now(),
        });
      }
    } else {
      pool.spent += check.requested;
    }
    return {
      available: true,
      spent: check.requested,
      blockedForLongRests: blockLongRests,
      pool: recoverPool(character, classId),
      reason: null,
    };
  }

  function augmentationCandidates(character = {}, extra = []) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const inventory = character?.inventory && typeof character.inventory === "object" ? character.inventory : {};
    const sources = [character.augmentations, character.augments, build.augmentations, inventory.augmentations, extra];
    const seenObjects = new Set();
    const result = [];
    sources.forEach((source) => {
      (Array.isArray(source) ? source : []).forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        if (seenObjects.has(entry)) return;
        seenObjects.add(entry);
        result.push(entry);
      });
    });
    return result;
  }

  function augmentationShortRestPercent(augmentation = {}) {
    const mechanics = augmentation?.mechanics && typeof augmentation.mechanics === "object" ? augmentation.mechanics : {};
    const rest = augmentation?.rest && typeof augmentation.rest === "object" ? augmentation.rest : {};
    return Math.max(0, numberOr(
      mechanics.shortRestRecoveryPercent
      ?? mechanics.shortRestRecoverMaxHpPercent
      ?? rest.shortRestRecoveryPercent
      ?? augmentation.shortRestRecoveryPercent,
      0,
    ));
  }

  function shortRestAugmentPercent(character, extraAugmentations = []) {
    const raw = augmentationCandidates(character, extraAugmentations)
      .reduce((sum, augmentation) => sum + augmentationShortRestPercent(augmentation), 0);
    return {
      rawPercent: raw,
      appliedPercent: clamp(raw, 0, SHORT_REST_AUGMENT_MAX_HP_PERCENT_CAP),
      capPercent: SHORT_REST_AUGMENT_MAX_HP_PERCENT_CAP,
    };
  }

  function readMaxHp(entity = {}) {
    const combat = entity?.combatStats && typeof entity.combatStats === "object" ? entity.combatStats : {};
    const candidates = [entity.maxHp, entity.maxHP, entity.hp_max, combat.hp_max, combat.maxHp];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return found == null ? null : Math.max(0, Number(found));
  }

  function readCurrentHp(entity = {}) {
    const combat = entity?.combatStats && typeof entity.combatStats === "object" ? entity.combatStats : {};
    const candidates = [entity.hp, entity.currentHp, entity.currentHP, entity.hp_actual, combat.hp_actual, combat.currentHp];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return found == null ? null : Math.max(0, Number(found));
  }

  function writeCurrentHp(entity, value) {
    if (!entity || typeof entity !== "object") return null;
    const next = Math.max(0, numberOr(value, 0));
    let wrote = false;
    if (Object.prototype.hasOwnProperty.call(entity, "hp")) { entity.hp = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "currentHp")) { entity.currentHp = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "currentHP")) { entity.currentHP = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "hp_actual")) { entity.hp_actual = next; wrote = true; }
    if (entity.combatStats && typeof entity.combatStats === "object") {
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "hp_actual")) { entity.combatStats.hp_actual = next; wrote = true; }
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "currentHp")) { entity.combatStats.currentHp = next; wrote = true; }
    }
    if (!wrote) entity.currentHp = next;
    return next;
  }

  function healEntity(entity, amount) {
    const requested = Math.max(0, Math.floor(numberOr(amount, 0)));
    const before = readCurrentHp(entity);
    const maximum = readMaxHp(entity);
    if (before == null) return { requested, amount: 0, before: null, after: null, maximum };
    const after = maximum == null ? before + requested : Math.min(maximum, before + requested);
    writeCurrentHp(entity, after);
    return { requested, amount: Math.max(0, after - before), before, after, maximum };
  }

  function fullHeal(entity) {
    const before = readCurrentHp(entity);
    const maximum = readMaxHp(entity);
    if (maximum == null) return { amount: 0, before, after: before, maximum: null };
    writeCurrentHp(entity, maximum);
    return { amount: before == null ? 0 : Math.max(0, maximum - before), before, after: maximum, maximum };
  }

  function performRecover(character, classId, slots = 1, options = {}) {
    const count = Math.max(1, integerOr(slots, 1));
    const id = normalizeId(classId);
    const classBaseHp = getClassBaseHp(id);
    if (classBaseHp == null) return { success: false, reason: `Unknown Class Base HP for ${id || "<missing class>"}.` };
    const availability = canSpendRecoverSlots(character, id, count);
    if (!availability.available) return { success: false, reason: availability.reason, pool: availability.pool };

    const context = normalizeId(options.context || "recover");
    const usesShortRestAugments = context === "short_rest" && options.includeAugments !== false;
    const augment = usesShortRestAugments
      ? shortRestAugmentPercent(character, options.augmentations || [])
      : { rawPercent: 0, appliedPercent: 0, capPercent: SHORT_REST_AUGMENT_MAX_HP_PERCENT_CAP };
    const healTarget = options.healTarget || character;
    const maxHp = readMaxHp(healTarget) ?? readMaxHp(character) ?? 0;
    const flatHp = RECOVER_FLAT_BONUS + (classBaseHp * count);
    const augmentHp = Math.floor(maxHp * augment.appliedPercent / 100);
    const totalHp = Math.max(0, Math.floor(flatHp + augmentHp));

    const spent = spendRecoverSlots(character, id, count, {
      blockLongRests: options.blockLongRests,
      sourceTraitId: options.sourceTraitId,
    });
    if (!spent.available) return { success: false, reason: spent.reason, pool: spent.pool };
    const healing = healEntity(healTarget, totalHp);

    return {
      success: true,
      context,
      classId: id,
      classBaseHp,
      slotsUsed: count,
      flatBonus: RECOVER_FLAT_BONUS,
      flatHp,
      augmentPercentRaw: augment.rawPercent,
      augmentPercentApplied: augment.appliedPercent,
      augmentPercentCap: augment.capPercent,
      augmentHp,
      calculatedHp: totalHp,
      healedHp: healing.amount,
      hpBefore: healing.before,
      hpAfter: healing.after,
      maxHp: healing.maximum,
      blockedForLongRests: spent.blockedForLongRests,
      pool: spent.pool,
    };
  }

  function validateRestHours(type, value) {
    const restType = normalizeId(type);
    const min = restType === "short_rest" ? SHORT_REST_MIN_HOURS : LONG_REST_MIN_HOURS;
    const max = restType === "short_rest" ? SHORT_REST_MAX_HOURS : LONG_REST_MAX_HOURS;
    const fallback = min;
    const hours = numberOr(value, fallback);
    if (hours < min || hours > max) return { valid: false, hours, min, max, reason: `${restType} must last between ${min} and ${max} hours.` };
    return { valid: true, hours, min, max, reason: null };
  }

  function traitId(trait = {}) {
    return normalizeId(trait?.id || trait?.name);
  }

  function shortRestUseRecoverySpec(trait = {}) {
    const uses = trait?.activation?.uses || {};
    if (normalizeId(uses.reset) === "short_rest") return "all";
    const explicit = uses.recoverOnShortRest
      ?? uses.shortRestRecover
      ?? trait?.mechanics?.shortRestRecoverUses
      ?? trait?.rest?.shortRest?.recoverUses;
    if (normalizeId(explicit) === "all") return "all";
    const amount = Math.max(0, integerOr(explicit, 0));
    return amount > 0 ? amount : null;
  }

  function recoverShortRestTraitUses(traits = [], state = null) {
    if (!state?.usages || typeof state.usages !== "object") return [];
    const changes = [];
    (Array.isArray(traits) ? traits : []).forEach((trait) => {
      const id = traitId(trait);
      const record = state.usages[id];
      if (!id || !record || typeof record !== "object") return;
      const spec = shortRestUseRecoverySpec(trait);
      if (spec == null) return;
      const before = Math.max(0, integerOr(record.used, 0));
      record.used = spec === "all" ? 0 : Math.max(0, before - spec);
      changes.push({ traitId: id, recovered: before - record.used, before, after: record.used, spec });
    });
    return changes;
  }

  function recoverAllTraitUses(state = null) {
    if (!state?.usages || typeof state.usages !== "object") return [];
    return Object.entries(state.usages).map(([id, record]) => {
      const before = Math.max(0, integerOr(record?.used, 0));
      if (record && typeof record === "object") record.used = 0;
      return { traitId: normalizeId(id), recovered: before, before, after: 0, spec: "all" };
    });
  }

  function dispatchRestTraits(type, character, traits, state, runtime = {}) {
    const engine = traitEngine();
    if (!engine || !Array.isArray(traits) || !traits.length || !state) return null;
    const trigger = normalizeId(type);
    engine.resetStateScope?.(state, trigger);
    return engine.dispatchTraits?.(traits, trigger, {
      context: "any",
      character,
      self: runtime.self || character,
      ...(runtime || {}),
    }, state) || null;
  }

  function recordRest(character, entry) {
    const state = ensureRestState(character);
    state.history.push({ at: Date.now(), ...clone(entry) });
    if (state.history.length > 50) state.history.splice(0, state.history.length - 50);
    return state.history.at(-1);
  }

  function performShortRest(character, options = {}) {
    const duration = validateRestHours("short_rest", options.hours);
    if (!duration.valid) return { success: false, type: "short_rest", reason: duration.reason, duration };
    const traitState = options.traitState || null;
    const traits = Array.isArray(options.traits) ? options.traits : [];
    const requests = Array.isArray(options.recovers) ? options.recovers : [];
    const requestedByClass = new Map();
    for (const request of requests) {
      const classId = normalizeId(request?.classId);
      const slots = Math.max(1, integerOr(request?.slots, 1));
      if (getClassBaseHp(classId) == null) return { success: false, type: "short_rest", reason: `Unknown Class Base HP for ${classId || "<missing class>"}.`, duration, recovers: [] };
      requestedByClass.set(classId, (requestedByClass.get(classId) || 0) + slots);
    }
    for (const [classId, slots] of requestedByClass) {
      const check = canSpendRecoverSlots(character, classId, slots);
      if (!check.available) return { success: false, type: "short_rest", reason: check.reason, duration, recovers: [] };
    }

    const recovers = [];
    for (const request of requests) {
      const result = performRecover(character, request?.classId, request?.slots, {
        context: "short_rest",
        healTarget: options.healTarget || character,
        augmentations: request?.augmentations || options.augmentations || [],
        includeAugments: true,
      });
      recovers.push(result);
      if (!result.success) return { success: false, type: "short_rest", reason: result.reason, duration, recovers };
    }
    const traitUseRecovery = recoverShortRestTraitUses(traits, traitState);
    const traitDispatch = dispatchRestTraits("short_rest", character, traits, traitState, options.runtime || {});
    const result = {
      success: true,
      type: "short_rest",
      hours: duration.hours,
      worldHoursAdvanced: duration.hours,
      recovers,
      traitUseRecovery,
      traitDispatch,
      pools: listRecoverPools(character),
    };
    recordRest(character, { type: result.type, hours: result.hours, recovers: recovers.map((entry) => ({ classId: entry.classId, slotsUsed: entry.slotsUsed, healedHp: entry.healedHp })) });
    return result;
  }

  function restoreRecoverSlotsOnLongRest(character) {
    const state = ensureRestState(character);
    const changes = [];
    Object.keys(state.recoverByClass).forEach((classId) => {
      const pool = reconcileRecoverPool(character, classId, state);
      const spentBefore = pool.spent;
      const blockedBefore = clone(pool.blocked);
      pool.spent = 0;
      pool.blocked = pool.blocked
        .map((entry) => ({ ...entry, remainingLongRests: Math.max(0, integerOr(entry.remainingLongRests, 0) - 1) }))
        .filter((entry) => entry.remainingLongRests > 0);
      changes.push({ classId, spentRestored: spentBefore, blockedBefore, blockedAfter: clone(pool.blocked), pool: recoverPool(character, classId) });
    });
    return changes;
  }

  function performLongRest(character, options = {}) {
    const duration = validateRestHours("long_rest", options.hours);
    if (!duration.valid) return { success: false, type: "long_rest", reason: duration.reason, duration };
    const healTarget = options.healTarget || character;
    const healing = fullHeal(healTarget);
    if (character !== healTarget && options.fullHealCharacter !== false) fullHeal(character);
    const recoverChanges = restoreRecoverSlotsOnLongRest(character);
    const traitState = options.traitState || null;
    const traits = Array.isArray(options.traits) ? options.traits : [];
    const traitUseRecovery = recoverAllTraitUses(traitState);
    const traitDispatch = dispatchRestTraits("long_rest", character, traits, traitState, options.runtime || {});
    const result = {
      success: true,
      type: "long_rest",
      hours: duration.hours,
      worldHoursAdvanced: duration.hours,
      healing,
      recoverChanges,
      traitUseRecovery,
      traitDispatch,
      pools: listRecoverPools(character),
    };
    recordRest(character, { type: result.type, hours: result.hours, healedHp: healing.amount, recoverSlotsRestored: recoverChanges.reduce((sum, entry) => sum + entry.spentRestored, 0) });
    return result;
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    REST_STATE_KEY,
    RECOVER_LEVEL_INTERVAL,
    RECOVER_FLAT_BONUS,
    SHORT_REST_MIN_HOURS,
    SHORT_REST_MAX_HOURS,
    LONG_REST_MIN_HOURS,
    LONG_REST_MAX_HOURS,
    SHORT_REST_AUGMENT_MAX_HP_PERCENT_CAP,
    classEntries,
    getClassLevel,
    getClassDefinition,
    getClassBaseHp,
    maxRecoverSlots,
    ensureRestState,
    recoverPool,
    listRecoverPools,
    canSpendRecoverSlots,
    spendRecoverSlots,
    shortRestAugmentPercent,
    readMaxHp,
    readCurrentHp,
    writeCurrentHp,
    performRecover,
    validateRestHours,
    shortRestUseRecoverySpec,
    recoverShortRestTraitUses,
    recoverAllTraitUses,
    restoreRecoverSlotsOnLongRest,
    performShortRest,
    performLongRest,
  });

  global.LuminousRestEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
