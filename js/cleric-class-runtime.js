(function (global) {
  "use strict";

  if (global.LuminousClericClassRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousClericClassRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const spellcasting = global.LuminousSpellcastingRuntime || safeRequire("./spellcasting-runtime.js");
  const creatureTypes = global.LuminousCreatureTypeCatalog || safeRequire("./creature-type-catalog.js");

  const CLASS_ID = "cleric";
  const CLASS_NAME = "Cleric";
  const CATALOG_VERSION = 6;
  const STATE_ROOT = "classResources";
  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
  const TURN_UNDEAD_ROUNDS = 10;
  const TURN_UNDEAD_RANGE_FEET = 30;
  const DIVINE_INTERVENTION_SUCCESS_COOLDOWN_DAYS = 7;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function standardRuntime() {
    return global.LuminousTraitStandardizationRuntime || safeRequire("./trait-standardization-runtime.js");
  }

  function identityValues(entity = {}) {
    return [
      entity?.id, entity?.playerId, entity?.player_id, entity?.characterId, entity?.character_id,
      entity?.actorId, entity?.actor_id, entity?.uid, entity?.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function sameEntity(left, right) {
    if (!left || !right) return false;
    if (left === right) return true;
    const rightIds = new Set(identityValues(right));
    return identityValues(left).some((id) => rightIds.has(id));
  }

  function persistClericState(character = {}) {
    const player = global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
    if (!character || !player || !sameEntity(character, player)) return null;
    const db = global.firebase?.database?.();
    const playerId = String(global.localStorage?.getItem?.(PLAYER_ID_STORAGE_KEY) || character.playerId || character.player_id || "").trim();
    if (!db || !playerId) return null;
    const state = clone(character?.[STATE_ROOT]?.[CLASS_ID] || {});
    const promise = db.ref(`${PLAYER_ROOT}/${playerId}/${STATE_ROOT}/${CLASS_ID}`).set(state);
    promise?.catch?.((error) => console.warn("Cleric Runtime persistence:", error));
    return promise;
  }

  function emit(name, detail) {
    if (typeof global.CustomEvent !== "function") return;
    global.dispatchEvent?.(new global.CustomEvent(name, { detail }));
  }

  const CLASS_ALIASES = Object.freeze(new Set(["cleric", "clerigo", "clérigo"]));

  function canonicalClassId(value) {
    const id = normalizeId(value);
    return CLASS_ALIASES.has(id) ? CLASS_ID : id;
  }

  function classEntries(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = Array.isArray(character.classes)
      ? character.classes
      : (Array.isArray(build.classes) ? build.classes : []);
    if (source.length) return source.filter((entry) => entry && typeof entry === "object");
    const map = character.classLevels || character.classesById || build.classLevels || {};
    return Object.entries(map).map(([id, entry]) => typeof entry === "object" ? { id, ...entry } : { id, level: entry });
  }

  function clericClassLevel(character = {}) {
    const found = classEntries(character).find((entry) => canonicalClassId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.classLevel ?? found?.levels ?? found?.level ?? found?.class_level, 0));
  }

  function effectiveDndLevel(character = {}) {
    const level = clericClassLevel(character);
    if (spellcasting?.limbusClassLevelToDndLevel) return spellcasting.limbusClassLevelToDndLevel(level);
    if (level <= 0) return 0;
    return Math.min(20, Math.max(1, Math.floor(level / 5)));
  }

  function channelDivinityMaximum(character = {}) {
    const level = clericClassLevel(character);
    if (level < 10) return 0;
    if (level >= 90) return 3;
    if (level >= 30) return 2;
    return 1;
  }

  function ensureClericState(character = {}) {
    if (!character || typeof character !== "object") throw new Error("Cleric Runtime requires a character object.");
    if (!character[STATE_ROOT] || typeof character[STATE_ROOT] !== "object" || Array.isArray(character[STATE_ROOT])) character[STATE_ROOT] = {};
    if (!character[STATE_ROOT][CLASS_ID] || typeof character[STATE_ROOT][CLASS_ID] !== "object" || Array.isArray(character[STATE_ROOT][CLASS_ID])) {
      character[STATE_ROOT][CLASS_ID] = {};
    }
    const state = character[STATE_ROOT][CLASS_ID];
    const maximum = channelDivinityMaximum(character);
    if (!state.channelDivinity || typeof state.channelDivinity !== "object" || Array.isArray(state.channelDivinity)) {
      state.channelDivinity = { current: maximum, maximum };
    }
    state.channelDivinity.maximum = maximum;
    if (!Number.isFinite(Number(state.channelDivinity.current))) state.channelDivinity.current = maximum;
    state.channelDivinity.current = Math.max(0, Math.min(maximum, intOr(state.channelDivinity.current, maximum)));

    if (!state.divineIntervention || typeof state.divineIntervention !== "object" || Array.isArray(state.divineIntervention)) {
      state.divineIntervention = { failedUntilLongRest: false, cooldownDays: 0, lastRoll: null, lastSuccess: null };
    }
    state.divineIntervention.failedUntilLongRest = state.divineIntervention.failedUntilLongRest === true;
    state.divineIntervention.cooldownDays = Math.max(0, intOr(state.divineIntervention.cooldownDays, 0));
    return state;
  }

  function channelDivinityPool(character = {}) {
    const pool = ensureClericState(character).channelDivinity;
    return { current: pool.current, maximum: pool.maximum };
  }

  function spendChannelDivinity(character = {}, amount = 1) {
    const requested = Math.max(1, intOr(amount, 1));
    const pool = ensureClericState(character).channelDivinity;
    if (pool.current < requested) {
      return { success: false, spent: 0, reason: "No Channel Divinity uses available.", pool: channelDivinityPool(character) };
    }
    pool.current -= requested;
    const result = { success: true, spent: requested, pool: channelDivinityPool(character) };
    persistClericState(character);
    emit("luminous:cleric-channel-divinity-changed", { character, reason: "spent", ...result });
    return result;
  }

  function recoverChannelDivinity(character = {}) {
    const pool = ensureClericState(character).channelDivinity;
    const before = pool.current;
    pool.current = pool.maximum;
    const result = { recovered: pool.current - before, pool: channelDivinityPool(character) };
    persistClericState(character);
    if (result.recovered > 0) emit("luminous:cleric-channel-divinity-changed", { character, reason: "rest", ...result });
    return result;
  }

  function destroyUndeadThreshold(character = {}) {
    const level = clericClassLevel(character);
    if (level >= 85) return 4;
    if (level >= 70) return 3;
    if (level >= 55) return 2;
    if (level >= 40) return 1;
    if (level >= 25) return 0.5;
    return null;
  }

  function challengeRatingOf(unit = {}) {
    const raw = unit.challengeRating
      ?? unit.challenge_rating
      ?? unit.cr
      ?? unit.metadata?.challengeRating
      ?? unit.metadata?.cr
      ?? unit.mechanics?.challengeRating
      ?? unit.mechanics?.cr;
    if (raw == null || raw === "") return null;
    if (typeof raw === "string" && raw.includes("/")) {
      const parts = raw.split("/").map(Number);
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && parts[1] !== 0) return parts[0] / parts[1];
    }
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function isUndead(unit = {}) {
    if (creatureTypes?.creatureTypeOf) {
      try { return creatureTypes.creatureTypeOf(unit) === "undead"; } catch (_) {}
    }
    return canonicalClassId(unit.creatureType ?? unit.metadata?.creatureType) === "undead";
  }

  function turnUndeadSaveDC(character = {}, runtime = {}, variables = {}) {
    return spellcasting?.resolveSpellcasting?.(character, CLASS_ID, runtime, variables)?.spellDC
      ?? numberOr(runtime.SpellDC ?? runtime.spellDC, 8);
  }

  function saveResultForTarget(target, dc, options = {}) {
    if (typeof options.saveResolver === "function") {
      const resolved = options.saveResolver(target, dc);
      if (typeof resolved === "boolean") return { resolved: true, passed: resolved };
      if (resolved && typeof resolved === "object" && typeof resolved.passed === "boolean") return { resolved: true, passed: resolved.passed, detail: resolved };
    }
    const key = String(target?.id ?? target?.unitId ?? target?.name ?? "");
    const table = options.saveResults || {};
    if (Object.prototype.hasOwnProperty.call(table, key)) {
      const value = table[key];
      if (typeof value === "boolean") return { resolved: true, passed: value };
      if (value && typeof value === "object" && typeof value.passed === "boolean") return { resolved: true, passed: value.passed, detail: value };
    }
    if (typeof target?.turnUndeadSavePassed === "boolean") return { resolved: true, passed: target.turnUndeadSavePassed };

    const resolver = standardRuntime()?.resolveCombatCheck;
    if (typeof resolver === "function") {
      const detail = resolver(target, { abilityId: "wis", threshold: dc, target: options.character || null });
      if (detail && typeof detail.passed === "boolean") return { resolved: true, passed: detail.passed, detail };
    }
    return { resolved: false, passed: null };
  }

  function applyTurnedState(target = {}, source = {}, options = {}) {
    const state = {
      active: true,
      sourceClericId: source.id || source.characterId || null,
      remainingRounds: Math.max(1, intOr(options.durationRounds, TURN_UNDEAD_ROUNDS)),
      endsOnDamage: true,
      blocksReactions: true,
      requiredBehavior: "move_away",
      allowedPrimaryActions: ["dash", "escape", "dodge_if_trapped"],
    };
    if (options.mutate !== false && target && typeof target === "object") target.turnUndead = state;
    return state;
  }

  function clearTurnedState(target = {}, reason = "ended") {
    const previous = target?.turnUndead ? clone(target.turnUndead) : null;
    if (target && typeof target === "object") delete target.turnUndead;
    return { cleared: Boolean(previous), reason, previous };
  }

  function onTurnedTargetDamaged(target = {}) {
    if (!target?.turnUndead?.active || target.turnUndead.endsOnDamage !== true) return { cleared: false, reason: "not_turned" };
    return clearTurnedState(target, "damage");
  }

  function tickTurnedTarget(target = {}) {
    if (!target?.turnUndead?.active) return { active: false, remainingRounds: 0 };
    target.turnUndead.remainingRounds = Math.max(0, intOr(target.turnUndead.remainingRounds, 0) - 1);
    if (target.turnUndead.remainingRounds <= 0) {
      clearTurnedState(target, "duration");
      return { active: false, remainingRounds: 0 };
    }
    return { active: true, remainingRounds: target.turnUndead.remainingRounds };
  }

  function canSeeOrHearCleric(target = {}) {
    const status = global.LuminousStatusEngine;
    const blinded = target.blinded === true || status?.hasStatus?.(target, "blinded") === true;
    const deafened = target.deafened === true || status?.hasStatus?.(target, "deafened") === true;
    const cannotSee = target.canSeeSource === false || target.canSee === false || blinded;
    const cannotHear = target.canHearSource === false || target.canHear === false || deafened;
    return !(cannotSee && cannotHear);
  }

  function eligibleTurnUndeadTargets(character = {}, runtime = {}) {
    const standard = standardRuntime();
    const source = Array.isArray(runtime.targets) && runtime.targets.length
      ? runtime.targets
      : (standard?.resolveTraitTargets?.(runtime.self || character, "all_enemies", runtime) || []);
    return source.filter((target) => {
      if (!isUndead(target) || !canSeeOrHearCleric(target)) return false;
      const distance = standard?.unitDistanceFeet?.(runtime.self || character, target);
      return distance == null || distance <= TURN_UNDEAD_RANGE_FEET;
    });
  }

  function resolveTurnUndead(character = {}, targets = [], options = {}) {
    if (clericClassLevel(character) < 10) return { success: false, reason: "turn_undead_locked", outcomes: [] };
    const spend = options.spendUse === false ? { success: true, spent: 0, pool: channelDivinityPool(character) } : spendChannelDivinity(character, 1);
    if (!spend.success) return { success: false, reason: spend.reason, spend, outcomes: [] };

    const dc = turnUndeadSaveDC(character, options.runtime || {}, options.variables || {});
    const threshold = destroyUndeadThreshold(character);
    const outcomes = [];

    for (const target of Array.isArray(targets) ? targets : []) {
      if (!isUndead(target)) {
        outcomes.push({ target, affected: false, reason: "not_undead" });
        continue;
      }

      const save = saveResultForTarget(target, dc, { ...options, character });
      if (!save.resolved) {
        outcomes.push({ target, affected: false, pendingSave: true, saveAbility: "wis", dc });
        continue;
      }
      if (save.passed) {
        outcomes.push({ target, affected: false, savePassed: true, saveAbility: "wis", dc });
        continue;
      }

      const cr = challengeRatingOf(target);
      const destroyed = threshold != null && cr != null && cr <= threshold;
      if (destroyed) {
        if (options.mutate !== false) {
          if ("hp" in target) target.hp = 0;
          if ("currentHp" in target) target.currentHp = 0;
          target.isDead = true;
          target.lifeState = "dead";
          delete target.turnUndead;
        }
        outcomes.push({ target, affected: true, savePassed: false, destroyed: true, challengeRating: cr, threshold });
        continue;
      }

      const turned = applyTurnedState(target, character, options);
      outcomes.push({ target, affected: true, savePassed: false, destroyed: false, challengeRating: cr, threshold, turned });
    }

    return { success: true, dc, threshold, spend, outcomes };
  }

  function divineInterventionChance(character = {}) {
    const level = clericClassLevel(character);
    if (level < 50) return 0;
    if (level >= 100) return 100;
    return effectiveDndLevel(character);
  }

  function divineInterventionState(character = {}) {
    return clone(ensureClericState(character).divineIntervention);
  }

  function canAttemptDivineIntervention(character = {}) {
    const level = clericClassLevel(character);
    const state = ensureClericState(character).divineIntervention;
    if (level < 50) return { available: false, reason: "divine_intervention_locked", chance: 0, state: clone(state) };
    if (state.cooldownDays > 0) return { available: false, reason: "divine_intervention_cooldown", chance: divineInterventionChance(character), state: clone(state) };
    if (state.failedUntilLongRest) return { available: false, reason: "divine_intervention_failed_until_long_rest", chance: divineInterventionChance(character), state: clone(state) };
    return { available: true, reason: null, chance: divineInterventionChance(character), state: clone(state) };
  }

  function attemptDivineIntervention(character = {}, options = {}) {
    const gate = canAttemptDivineIntervention(character);
    if (!gate.available) return { success: false, intervened: false, ...gate };

    const state = ensureClericState(character).divineIntervention;
    const automatic = clericClassLevel(character) >= 100;
    const roll = automatic ? null : Math.max(1, Math.min(100, intOr(options.roll, Math.ceil(Math.random() * 100))));
    const chance = divineInterventionChance(character);
    const intervened = automatic || roll <= chance;

    state.lastRoll = roll;
    state.lastSuccess = intervened;
    if (intervened) {
      state.cooldownDays = DIVINE_INTERVENTION_SUCCESS_COOLDOWN_DAYS;
      state.failedUntilLongRest = false;
    } else {
      state.failedUntilLongRest = true;
    }

    const result = {
      success: true,
      intervened,
      automatic,
      roll,
      chance,
      request: String(options.request || "").trim() || null,
      dmResolutionRequired: intervened,
      suggestedScope: intervened ? "cleric_spell_or_domain_spell_effect" : null,
      state: clone(state),
    };
    persistClericState(character);
    emit("luminous:cleric-divine-intervention-attempted", { character, ...result });
    return result;
  }

  function handleRest(character = {}, restType) {
    const type = normalizeId(restType);
    const state = ensureClericState(character);
    const result = { type, channelDivinityRecovered: 0, divineInterventionFailureReset: false };
    if (type === "short_rest" || type === "long_rest") {
      result.channelDivinityRecovered = recoverChannelDivinity(character).recovered;
    }
    if (type === "long_rest" && state.divineIntervention.failedUntilLongRest) {
      state.divineIntervention.failedUntilLongRest = false;
      result.divineInterventionFailureReset = true;
    }
    if (result.channelDivinityRecovered > 0 || result.divineInterventionFailureReset) persistClericState(character);
    return result;
  }

  function handleDayStart(character = {}) {
    const state = ensureClericState(character).divineIntervention;
    const before = state.cooldownDays;
    state.cooldownDays = Math.max(0, before - 1);
    const result = { before, after: state.cooldownDays, reduced: before - state.cooldownDays };
    if (result.reduced > 0) persistClericState(character);
    return result;
  }

  function passiveTrait(id, name, description, mechanics = {}) {
    return {
      schemaVersion: 1,
      id,
      name,
      description,
      source: { type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME },
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics,
    };
  }

  const DEFINITIONS = Object.freeze({
    channel_divinity: passiveTrait(
      "channel_divinity",
      "Channel Divinity",
      "Gain a divine resource used by Turn Undead and Domain effects. Maximum uses are 1 at Cleric Level 10, 2 at Level 30, and 3 at Level 90. Recover all uses on Short Rest or Long Rest.",
      { channelDivinity: true, resourceId: "channel_divinity", maximumSchedule: { 10: 1, 30: 2, 90: 3 }, recovery: "short_or_long_rest" },
    ),
    turn_undead: {
      schemaVersion: 1,
      id: "turn_undead",
      name: "Turn Undead",
      description: "Action. Spend 1 Channel Divinity. Undead in the effect make a Wisdom Save against your Cleric Spell DC. On failure they must withdraw for up to 10 rounds or until damaged. Destroy Undead may replace the withdrawal for sufficiently weak Undead.",
      source: { type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME },
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action", target: "all_enemies" },
      effects: [],
      rules: [],
      mechanics: {
        channelDivinityCost: 1,
        creatureType: "undead",
        saveAbilityId: "wis",
        saveDc: "SpellDC",
        durationRounds: TURN_UNDEAD_ROUNDS,
        rangeFeet: TURN_UNDEAD_RANGE_FEET,
        endsOnDamage: true,
        blocksReactions: true,
        behavior: "move_away",
      },
    },
    destroy_undead: passiveTrait(
      "destroy_undead",
      "Destroy Undead",
      "When an Undead fails its Save against Turn Undead, destroy it instead if its Challenge Rating is at or below the threshold for your Cleric Class Level.",
      { destroyUndead: true, thresholdSchedule: { 25: 0.5, 40: 1, 55: 2, 70: 3, 85: 4 }, requiresChallengeRating: true },
    ),
    divine_intervention: {
      schemaVersion: 1,
      id: "divine_intervention",
      name: "Divine Intervention",
      description: "Action. Request divine aid. Success chance uses effective D&D Cleric Level as a percentile chance. On failure, retry after a Long Rest. On success, the DM resolves the intervention and the feature enters a 7-day cooldown.",
      source: { type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME },
      contexts: ["any"],
      activation: { type: "manual", actionCost: "action", target: "special" },
      effects: [],
      rules: [],
      mechanics: {
        divineIntervention: true,
        chanceFormula: "EffectiveDndClericLevelPercent",
        failureRecovery: "long_rest",
        successCooldownDays: DIVINE_INTERVENTION_SUCCESS_COOLDOWN_DAYS,
        dmResolutionRequired: true,
      },
    },
    divine_intervention_improvement: passiveTrait(
      "divine_intervention_improvement",
      "Divine Intervention Improvement",
      "Divine Intervention succeeds automatically at Cleric Class Level 100. A successful intervention still enters its normal 7-day cooldown.",
      { upgradesTraitId: "divine_intervention", automaticSuccessAtClassLevel: 100 },
    ),
  });

  function grant(level, traitId) {
    return {
      id: "core_class_" + CLASS_ID + "_l" + level + "_" + traitId,
      sourceType: "class",
      sourceId: CLASS_ID,
      source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level },
      atLevel: level,
      traitId,
      grantType: "trait",
      multiclassPolicy: "allowed",
    };
  }

  const GRANTS = Object.freeze([
    grant(10, "channel_divinity"),
    grant(10, "turn_undead"),
    grant(25, "destroy_undead"),
    grant(50, "divine_intervention"),
    grant(100, "divine_intervention_improvement"),
  ]);

  function grantIdentity(grantValue = {}) {
    return String(grantValue.sourceType || "") + ":" + String(grantValue.sourceId || "") + ":" + String(grantValue.traitId || "") + ":" + String(grantValue.atLevel || 0);
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || safeRequire("./trait-catalog-core.js");
    if (!source) return false;
    if (source.__clericClassExtended) return true;

    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));

    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(DEFINITIONS) });
    const allGrants = () => {
      const seen = new Set();
      return [...baseGrants(), ...clone(GRANTS)].filter((entry) => {
        const key = grantIdentity(entry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const getDefinition = (id) => clone(DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const base = baseValidate(engine);
      const errors = [...(base.errors || [])];
      const warnings = [...(base.warnings || [])];
      Object.entries(DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) return;
        const validation = engine.validateTrait(definition);
        (validation.errors || []).forEach((message) => errors.push(key + ": " + message));
        (validation.warnings || []).forEach((message) => warnings.push(key + ": " + message));
      });
      return { valid: base.valid !== false && errors.length === 0, errors, warnings };
    };

    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __clericClassExtended: true,
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

  function traitBaseId(trait = {}) {
    return normalizeId(trait.baseTraitId || String(trait.id || trait.name || "").split("__class__")[0]);
  }

  function channelDivinityCostForTrait(trait = {}) {
    return Math.max(0, intOr(trait?.mechanics?.channelDivinityCost, 0));
  }

  function wrapTraitEngine() {
    const source = global.LuminousTraitEngine || safeRequire("./trait-engine.js");
    if (!source) return false;
    if (source.__clericClassRuntimeWrapped) return true;

    const originalCanActivateTrait = source.canActivateTrait?.bind(source);
    const originalActivateTrait = source.activateTrait?.bind(source);

    function clericCanActivateTrait(trait = {}, runtime = {}, state) {
      const result = originalCanActivateTrait
        ? originalCanActivateTrait(trait, runtime, state)
        : { available: true, reasons: [], trait, state };
      const id = traitBaseId(trait);
      const character = runtime.character || runtime.self || {};
      const reasons = [...(result.reasons || [])];

      const channelCost = channelDivinityCostForTrait(trait);
      const channelPool = channelCost > 0 ? channelDivinityPool(character) : null;
      if (channelCost > 0 && channelPool.current < channelCost && !reasons.includes("channel_divinity_empty")) reasons.push("channel_divinity_empty");

      if (id === "turn_undead") {
        if (clericClassLevel(character) < 10 && !reasons.includes("turn_undead_locked")) reasons.push("turn_undead_locked");
        const targets = eligibleTurnUndeadTargets(character, runtime);
        if (!targets.length && !reasons.includes("no_eligible_undead")) reasons.push("no_eligible_undead");
      }

      if (id === "divine_intervention") {
        const gate = canAttemptDivineIntervention(character);
        if (!gate.available && !reasons.includes(gate.reason)) reasons.push(gate.reason);
      }

      return {
        ...result,
        available: reasons.length === 0,
        reasons,
        maximum: channelPool ? channelPool.maximum : result.maximum,
        remaining: channelPool ? channelPool.current : result.remaining,
      };
    }

    function clericActivateTrait(trait = {}, runtime = {}, state) {
      const gate = clericCanActivateTrait(trait, runtime, state);
      if (!gate.available) return { ...gate, outcomes: [] };

      const result = originalActivateTrait
        ? originalActivateTrait(trait, runtime, state)
        : { available: true, trait, runtime, state, outcomes: [] };
      if (result.available === false || result.scheduled === true) return result;

      const id = traitBaseId(trait);
      const character = result.runtime?.character || result.runtime?.self || runtime.character || runtime.self || {};
      const activeRuntime = result.runtime || runtime;

      if (id === "turn_undead") {
        const targets = eligibleTurnUndeadTargets(character, activeRuntime);
        const resolved = resolveTurnUndead(character, targets, {
          runtime: activeRuntime,
          variables: source.buildVariables?.(character, activeRuntime, trait) || {},
          durationRounds: TURN_UNDEAD_ROUNDS,
        });
        if (!resolved.success) return { ...result, available: false, reasons: [resolved.reason], outcomes: [] };
        result.outcomes = [...(result.outcomes || []), { type: "cleric_turn_undead", traitId: id, ...resolved }];
      }

      const channelCost = channelDivinityCostForTrait(trait);
      if (id !== "turn_undead" && channelCost > 0) {
        const spent = spendChannelDivinity(character, channelCost);
        if (!spent.success) return { ...result, available: false, reasons: [spent.reason], outcomes: [] };
        result.outcomes = [...(result.outcomes || []), { type: "cleric_channel_divinity_spent", traitId: id, cost: channelCost, ...spent }];
      }

      if (id === "divine_intervention") {
        const request = activeRuntime.inputs?.request
          ?? activeRuntime.choice?.request
          ?? activeRuntime.request
          ?? null;
        const intervention = attemptDivineIntervention(character, { request, roll: activeRuntime.divineInterventionRoll });
        if (!intervention.success) return { ...result, available: false, reasons: [intervention.reason], outcomes: [] };
        let dmRequest = null;
        if (intervention.intervened && typeof activeRuntime.registerDmEffect === "function") {
          dmRequest = activeRuntime.registerDmEffect({
            effectId: "divine_intervention",
            name: "Divine Intervention",
            kind: "request",
            prompt: intervention.request || "Resolve the Cleric's Divine Intervention.",
            durationHours: 0,
            sourceTraitId: id,
            note: "Successful Divine Intervention. DM chooses an appropriate Cleric spell or Divine Domain spell effect.",
          });
        }
        result.outcomes = [...(result.outcomes || []), { type: "cleric_divine_intervention", traitId: id, dmRequest, ...intervention }];
        if (intervention.intervened) emit("luminous:cleric-divine-intervention", { character, traitId: id, dmRequest, ...intervention });
      }

      return result;
    }

    function clericListAvailableTraitActions(traits = [], runtime = {}, state) {
      return (traits || []).map((trait) => clericCanActivateTrait(trait, runtime, state))
        .filter((entry) => ["manual", "prompt", "choice"].includes(normalizeId(entry.trait?.activation?.type)))
        .map((entry) => ({
          traitId: entry.trait.id,
          name: entry.trait.name,
          activationType: entry.trait.activation.type,
          actionCost: entry.trait.activation.actionCost,
          available: entry.available,
          reasons: entry.reasons,
          maximum: entry.maximum,
          remaining: entry.remaining,
          target: entry.trait.activation.target || "self",
          inputs: clone(entry.trait.activation.inputs || []),
        }));
    }

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __clericClassRuntimeWrapped: true,
      canActivateTrait: clericCanActivateTrait,
      activateTrait: clericActivateTrait,
      listAvailableTraitActions: clericListAvailableTraitActions,
    });
    return true;
  }

  function wrapCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    if (engine.__clericTurnUndeadWrapped) return true;

    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, ...args) {
        const before = numberOr(unit?.hp ?? unit?.currentHp, 0);
        const result = originalApplyDamage.call(this, unit, ...args);
        const after = numberOr(unit?.hp ?? unit?.currentHp, before);
        if (before > after) onTurnedTargetDamaged(unit);
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phaseTag === "[Round Start]") {
          (allUnits || []).forEach((unit) => tickTurnedTarget(unit));
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__clericTurnUndeadWrapped", { value: true, configurable: true });
    return true;
  }

  let restListenerBound = false;
  let dayListenerBound = false;

  function currentCharacter(detail = {}) {
    return detail.character || global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function bindRestIntegration() {
    if (restListenerBound || !global.addEventListener) return false;
    global.addEventListener("luminous:rest-completed", (event) => {
      const character = currentCharacter(event?.detail || {});
      if (character && clericClassLevel(character) > 0) handleRest(character, event?.detail?.type);
    });
    restListenerBound = true;
    return true;
  }

  function bindDayIntegration() {
    if (dayListenerBound || !global.addEventListener) return false;
    global.addEventListener("luminous:day-start", (event) => {
      const character = currentCharacter(event?.detail || {});
      if (character && clericClassLevel(character) >= 50) handleDayStart(character);
    });
    dayListenerBound = true;
    return true;
  }

  function install() {
    const catalogReady = wrapCatalog();
    wrapTraitEngine();
    wrapCombatEngine();
    bindRestIntegration();
    bindDayIntegration();
    return catalogReady;
  }

  const api = Object.freeze({
    CLASS_ID,
    CLASS_NAME,
    CATALOG_VERSION,
    TURN_UNDEAD_ROUNDS,
    TURN_UNDEAD_RANGE_FEET,
    DIVINE_INTERVENTION_SUCCESS_COOLDOWN_DAYS,
    DEFINITIONS,
    GRANTS,
    canonicalClassId,
    clericClassLevel,
    effectiveDndLevel,
    channelDivinityMaximum,
    channelDivinityCostForTrait,
    ensureClericState,
    persistClericState,
    channelDivinityPool,
    spendChannelDivinity,
    recoverChannelDivinity,
    destroyUndeadThreshold,
    challengeRatingOf,
    isUndead,
    turnUndeadSaveDC,
    canSeeOrHearCleric,
    eligibleTurnUndeadTargets,
    applyTurnedState,
    clearTurnedState,
    onTurnedTargetDamaged,
    tickTurnedTarget,
    resolveTurnUndead,
    divineInterventionChance,
    divineInterventionState,
    canAttemptDivineIntervention,
    attemptDivineIntervention,
    handleRest,
    handleDayStart,
    grantIdentity,
    wrapCatalog,
    wrapTraitEngine,
    wrapCombatEngine,
    bindRestIntegration,
    bindDayIntegration,
    install,
  });

  global.LuminousClericClassRuntime = api;
  install();
  if (!global.document && typeof queueMicrotask === "function") queueMicrotask(install);
  if (global.document && global.setInterval) {
    const timer = global.setInterval(install, 800);
    timer?.unref?.();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
