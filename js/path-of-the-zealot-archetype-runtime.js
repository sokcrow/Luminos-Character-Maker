(function (global) {
  "use strict";

  if (global.LuminousPathOfTheZealotArchetypeRuntime) return;

  const ARCHETYPE_ID = "path_of_the_zealot";
  const ARCHETYPE_NAME = "Path of the Zealot";
  const CLASS_ID = "barbarian";
  const CLASS_NAME = "Barbarian";
  const PATCH_INTERVAL_MS = 250;
  const FANATICAL_READY_STATUS = "zealot_fanatical_focus_ready";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const ARCHETYPE = Object.freeze({
    id: ARCHETYPE_ID,
    name: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    unlockLevel: 15,
    traitLevels: [15, 30, 50, 70],
  });

  const SOURCE = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
  });

  const DEFINITIONS = Object.freeze({
    divine_fury: Object.freeze({
      schemaVersion: 1,
      id: "divine_fury",
      name: "Divine Fury",
      description: "While having Rage, Radiance deals +1% Fixed Damage.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { whileStatus: "rage", radianceFixedDamageBonusPercent: 1 },
    }),

    warrior_of_the_gods: Object.freeze({
      schemaVersion: 1,
      id: "warrior_of_the_gods",
      name: "Warrior of the Gods",
      description: "When you are Revived or Resurrected, gain Rage without spending a use. When you are reduced to 0 HP, Inflict 4 Radiance on 3 random enemies.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        onReviveGainStatus: "rage",
        spendRageUse: false,
        onZeroHpRadianceCount: 4,
        onZeroHpRandomEnemies: 3,
      },
    }),

    fanatical_focus: Object.freeze({
      schemaVersion: 1,
      id: "fanatical_focus",
      name: "Fanatical Focus",
      description: "While having Rage, when you fail a Check, re-toss all Coins that rolled Tails once. This effect can only trigger once per Rage.",
      source: SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        whileStatus: "rage",
        trigger: "failed_check",
        reTossAllTails: true,
        scope: "once_per_rage",
      },
    }),

    zealous_presence: Object.freeze({
      schemaVersion: 1,
      id: "zealous_presence",
      name: "Zealous Presence",
      description: "At Turn Start, all Allies gain Shield equal to floor(Class Level / 4) and recover 4 SP. Quick Action — Once per Long Rest: Triple the amount of Shield gained and SP recovered by this Trait at your next Turn Start.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "quick_action", uses: { max: 1, reset: "long_rest" } },
      effects: [],
      rules: [],
      mechanics: {
        trigger: "turn_start",
        targets: "all_allies",
        shieldFormula: "floor(ClassLevel / 4)",
        spRecovery: 4,
        empoweredMultiplier: 3,
      },
    }),

    rage_beyond_death: Object.freeze({
      schemaVersion: 1,
      id: "rage_beyond_death",
      name: "Rage Beyond Death",
      description: "While having Rage, being reduced to 0 HP does not prevent you from acting while Downed. You continue making Death Saves normally. If you would die from failed Death Saves while having Rage, your Death is delayed until Rage ends. When Rage ends, you die only if you still have 0 HP.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        whileStatus: "rage",
        canActWhileDowned: true,
        continueDeathSaves: true,
        deferDeathUntilRageEnds: true,
      },
    }),
  });

  const grant = (level, traitId) => Object.freeze({
    sourceType: "archetype",
    sourceId: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    classId: CLASS_ID,
    atLevel: level,
    traitId,
    source: { ...SOURCE, atLevel: level, requiredClassLevel: level },
  });

  const GRANTS = Object.freeze([
    grant(15, "divine_fury"),
    grant(15, "warrior_of_the_gods"),
    grant(30, "fanatical_focus"),
    grant(50, "zealous_presence"),
    grant(70, "rage_beyond_death"),
  ]);

  const state = {
    statusSource: null,
    traitEngineSource: null,
    archetypeCatalogSource: null,
    coreCatalogSource: null,
    archetypeRuntimeSource: null,
    standardizationSource: null,
    conditionBridgeSource: null,
    dmConsoleSource: null,
    deathSource: null,
    combatSource: null,
  };

  function classEntries(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const entries = Array.isArray(character.classes) ? character.classes : (Array.isArray(build.classes) ? build.classes : []);
    return entries.map((entry) => ({
      id: normalizeId(entry?.classId || entry?.id || entry?.className || entry?.name),
      level: Math.max(0, Math.trunc(numberOr(entry?.level ?? entry?.levels ?? entry?.classLevel, 0))),
    }));
  }

  function barbarianLevel(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    try {
      if (engine?.getClassLevel) return Math.max(0, numberOr(engine.getClassLevel(character, CLASS_ID), 0));
    } catch (_) {}
    return classEntries(character).find((entry) => entry.id === CLASS_ID)?.level || 0;
  }

  function archetypeSelections(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const raw = build.archetypes ?? character.archetypes ?? [];
    const entries = Array.isArray(raw)
      ? raw
      : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return entries.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.parentClassId),
      archetypeId: normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id),
    }));
  }

  function selectedZealot(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    try {
      if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    } catch (_) {}
    return archetypeSelections(character).some((entry) => entry.classId === CLASS_ID && entry.archetypeId === ARCHETYPE_ID);
  }

  function hasZealotLevel(character = {}, level = 1) {
    return selectedZealot(character) && barbarianLevel(character) >= Math.max(0, numberOr(level, 0));
  }

  function ownTraits(character = {}) {
    if (!selectedZealot(character)) return [];
    const level = barbarianLevel(character);
    return GRANTS
      .filter((entry) => level >= entry.atLevel)
      .map((entry) => ({
        ...clone(DEFINITIONS[entry.traitId]),
        source: { ...clone(DEFINITIONS[entry.traitId].source), ...clone(entry.source) },
      }));
  }

  function unitIds(unit = {}) {
    return [
      unit.combatId, unit.combat_id, unit.id, unit.unitId, unit.unit_id,
      unit.characterId, unit.character_id, unit.playerId, unit.player_id,
      unit.actorId, unit.actor_id, unit.uid, unit.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function sameUnit(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ids = new Set(unitIds(a));
    return unitIds(b).some((id) => ids.has(id));
  }

  function factionId(unit = {}) {
    const value = unit.faction ?? unit.faccion ?? unit.team ?? unit.side;
    if (value != null && String(value).trim()) return normalizeId(value);
    if (unit.isPlayer != null) return unit.isPlayer ? "player" : "enemy";
    return "";
  }

  function sameFaction(a, b) {
    if (!a || !b) return false;
    const left = factionId(a);
    const right = factionId(b);
    return left && right ? left === right : sameUnit(a, b);
  }

  function statusEntry(unit, id) {
    const key = normalizeId(id);
    try {
      const value = global.LuminousStatusEngine?.getStatus?.(unit, key);
      if (value) return value;
    } catch (_) {}
    const statuses = unit?.statusEffects || unit?.statuses || {};
    if (Array.isArray(statuses)) return statuses.find((entry) => normalizeId(entry?.id || entry?.name || entry) === key) || null;
    return statuses?.[key] || Object.values(statuses || {}).find((entry) => normalizeId(entry?.id || entry?.name) === key) || null;
  }

  function hasStatus(unit, id) {
    try {
      if (global.LuminousStatusEngine?.hasStatus?.(unit, normalizeId(id))) return true;
    } catch (_) {}
    return Boolean(statusEntry(unit, id));
  }

  function statusCount(unit, id) {
    const entry = statusEntry(unit, id);
    if (entry == null) return 0;
    return Math.max(0, numberOr(typeof entry === "number" ? entry : entry.count, 0));
  }

  function hasRage(unit) {
    return hasStatus(unit, "rage");
  }

  function applyStatus(unit, id, input = {}) {
    return global.LuminousStatusEngine?.applyStatus?.(unit, normalizeId(id), input) || null;
  }

  function removeStatus(unit, id, input = {}) {
    return global.LuminousStatusEngine?.removeStatus?.(unit, normalizeId(id), input) || null;
  }

  function ensureRuntimeStatuses() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    if (!global.STATUS_REGISTRY[FANATICAL_READY_STATUS]) {
      global.STATUS_REGISTRY[FANATICAL_READY_STATUS] = {
        id: FANATICAL_READY_STATUS,
        name: "Fanatical Focus Ready",
        type: "neutral",
        mode: "single",
        rules: [],
        runtimeOnly: true,
      };
    }
  }

  function armFanaticalFocus(unit) {
    if (!hasZealotLevel(unit, 30)) return false;
    unit.__zealotFanaticalConsumedThisRage = false;
    ensureRuntimeStatuses();
    applyStatus(unit, FANATICAL_READY_STATUS, {
      mode: "set",
      count: 1,
      duration: "until_removed",
      sourceTraitId: "fanatical_focus",
    });
    return true;
  }

  function disarmFanaticalFocus(unit) {
    if (!unit) return false;
    delete unit.__zealotFanaticalConsumedThisRage;
    removeStatus(unit, FANATICAL_READY_STATUS, { from: "self", ignoreProtection: true });
    return true;
  }

  function fanaticalReady(unit) {
    if (!unit || !hasZealotLevel(unit, 30) || !hasRage(unit)) return false;
    if (unit.__zealotFanaticalConsumedThisRage === true) return false;
    return true;
  }

  function readSp(unit = {}) {
    const value = [unit.sp, unit.currentSp, unit.currentSP, unit.sp_actual, unit.combatStats?.sp_actual]
      .find((entry) => Number.isFinite(Number(entry)));
    return value == null ? 0 : Number(value);
  }

  function writeSp(unit, value) {
    const maxSp = Number.isFinite(Number(unit?.maxSp ?? unit?.maxSP ?? unit?.sp_max)) ? Number(unit.maxSp ?? unit.maxSP ?? unit.sp_max) : 45;
    const next = clamp(Math.floor(numberOr(value, 0)), -45, maxSp);
    if (Object.prototype.hasOwnProperty.call(unit, "sp")) unit.sp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSP")) unit.currentSP = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "sp_actual")) unit.combatStats.sp_actual = next;
    else unit.sp = next;
    return next;
  }

  function addShield(unit, amount) {
    const gain = Math.max(0, Math.floor(numberOr(amount, 0)));
    unit.shield = Math.max(0, numberOr(unit.shield, 0)) + gain;
    return gain;
  }

  function combatUnits(runtime = {}, engine = null) {
    const values = [];
    if (Array.isArray(runtime.units)) values.push(...runtime.units);
    if (Array.isArray(runtime.allUnits)) values.push(...runtime.allUnits);
    try {
      const fromEngine = (engine || global.CombatEngine)?.getAllAliveUnits?.();
      if (Array.isArray(fromEngine)) values.push(...fromEngine);
    } catch (_) {}
    if (global.combatData && typeof global.combatData === "object") values.push(...Object.values(global.combatData));
    const seen = new Set();
    return values.filter((unit) => {
      if (!unit || typeof unit !== "object") return false;
      const key = unitIds(unit)[0] || unit;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function randomEnemies(actor, runtime = {}, count = 3, rng = Math.random) {
    const candidates = combatUnits(runtime, runtime.engine)
      .filter((unit) => unit && !sameUnit(unit, actor) && !sameFaction(unit, actor) && numberOr(unit.hp, 1) > 0);
    const pool = [...candidates];
    const selected = [];
    while (pool.length && selected.length < count) {
      const index = Math.min(pool.length - 1, Math.floor(clamp(numberOr(rng(), 0), 0, 0.999999) * pool.length));
      selected.push(pool.splice(index, 1)[0]);
    }
    return selected;
  }

  function inflictWarriorRadiance(unit, runtime = {}) {
    if (!hasZealotLevel(unit, 15)) return [];
    const targets = randomEnemies(unit, runtime, 3, typeof runtime.random === "function" ? runtime.random : Math.random);
    targets.forEach((target) => applyStatus(target, "radiance", {
      mode: "gain",
      count: 4,
      potency: 0,
      sourceTraitId: "warrior_of_the_gods",
      sourceUnitId: unitIds(unit)[0] || null,
    }));
    return targets;
  }

  function gainFreeRage(unit) {
    if (!hasZealotLevel(unit, 15)) return null;
    return applyStatus(unit, "rage", {
      mode: "set",
      count: 1,
      duration: "until_removed",
      sourceTraitId: "warrior_of_the_gods",
      data: { freeRage: true, spendUse: false },
    });
  }

  function coinSide(value) {
    if (typeof value === "boolean") return value ? "head" : "tail";
    if (typeof value === "string") return normalizeId(value).startsWith("head") ? "head" : "tail";
    if (value && typeof value === "object") return coinSide(value.side ?? value.result ?? value.face ?? value.heads);
    return null;
  }

  function writeCoinSide(array, index, side) {
    const current = array[index];
    if (typeof current === "boolean") array[index] = side === "head";
    else if (typeof current === "string") array[index] = side;
    else if (current && typeof current === "object") array[index] = { ...current, side };
  }

  function resultFailed(result = {}) {
    if (result.failed === true || result.passed === false) return true;
    const threshold = Number(result.threshold ?? result.difficulty ?? result.deathSaveThreshold);
    const total = Number(result.total);
    return Number.isFinite(total) && Number.isFinite(threshold) ? total < threshold : false;
  }

  function rollSide(headsChance, rng = Math.random) {
    const chance = clamp(numberOr(headsChance, 50), 5, 95);
    try {
      if (global.LuminousCoinEngine?.rollSide) return normalizeId(global.LuminousCoinEngine.rollSide(chance, rng)).startsWith("head") ? "head" : "tail";
    } catch (_) {}
    return numberOr(rng(), 1) * 100 < chance ? "head" : "tail";
  }

  function resolveFanaticalFocus(unit, request = {}, result = {}, rng = Math.random) {
    if (!fanaticalReady(unit) || !resultFailed(result)) return result;
    const field = Array.isArray(result.tosses) ? "tosses" : (Array.isArray(result.coins) ? "coins" : null);
    if (!field) return result;
    const coins = result[field];
    const tails = [];
    coins.forEach((coin, index) => { if (coinSide(coin) === "tail") tails.push(index); });
    if (!tails.length) return result;

    const headsChance = numberOr(result.headsChance ?? request.headsChance, 50 + readSp(unit));
    const coinPower = numberOr(result.coinPower ?? request.coinPower, 4);
    let gainedHeads = 0;
    const rerolls = [];
    tails.forEach((index) => {
      const side = rollSide(headsChance, rng);
      rerolls.push({ index, side });
      writeCoinSide(coins, index, side);
      if (side === "head") gainedHeads += 1;
    });

    const total = numberOr(result.total, 0) + gainedHeads * coinPower;
    const threshold = numberOr(result.threshold ?? result.difficulty ?? result.deathSaveThreshold ?? request.threshold, 0);
    result.heads = coins.filter((coin) => coinSide(coin) === "head").length;
    result.total = total;
    result.passed = total >= threshold;
    result.failed = total < threshold;
    result.fanaticalFocus = { triggered: true, reTossed: tails.length, gainedHeads, rerolls };
    unit.__zealotFanaticalConsumedThisRage = true;
    removeStatus(unit, FANATICAL_READY_STATUS, { from: "self", ignoreProtection: true });
    return result;
  }

  function zealousPresenceAtTurnStart(actor, units = []) {
    if (!hasZealotLevel(actor, 50)) return { applied: false, targets: [] };
    const multiplier = actor.__zealotPresenceTriplePending ? 3 : 1;
    const shield = Math.max(0, Math.floor(barbarianLevel(actor) / 4)) * multiplier;
    const sp = 4 * multiplier;
    const allies = (units || []).filter((unit) => unit && !sameUnit(unit, actor) && sameFaction(unit, actor) && numberOr(unit.hp, 1) > 0);
    allies.forEach((unit) => {
      addShield(unit, shield);
      writeSp(unit, readSp(unit) + sp);
    });
    if (actor.__zealotPresenceTriplePending) delete actor.__zealotPresenceTriplePending;
    return { applied: true, actor, targets: allies, shield, sp, multiplier };
  }

  function rageBeyondDeathActive(unit) {
    return hasZealotLevel(unit, 70) && hasRage(unit);
  }

  function markDeferredDeath(unit, reason = "three_failed_death_saves") {
    if (!unit) return null;
    unit.__zealotDeferredDeath = { pending: true, reason, at: Date.now() };
    return unit.__zealotDeferredDeath;
  }

  function clearDeferredDeath(unit) {
    if (!unit?.__zealotDeferredDeath) return false;
    delete unit.__zealotDeferredDeath;
    return true;
  }

  function settleDeferredDeath(unit, reason = "rage_ended") {
    if (!unit?.__zealotDeferredDeath) return { settled: false, reason: "not_deferred", unit };
    const death = state.deathSource || global.LuminousDeathSaveRuntime;
    if (numberOr(unit.hp, 0) > 0 || !death?.isDowned?.(unit)) {
      clearDeferredDeath(unit);
      return { settled: true, survived: true, unit };
    }
    if (hasRage(unit)) return { settled: false, deferred: true, unit };
    clearDeferredDeath(unit);
    const resolved = death?.resolveDeath?.(unit, { reason: `rage_beyond_death_${reason}`, sourceTraitId: "rage_beyond_death" }) || null;
    return { settled: true, died: Boolean(resolved?.died), unit, resolved };
  }

  function addDeferredFailure(unit, options = {}) {
    const death = state.deathSource;
    if (!death?.isDowned?.(unit) || death?.isDead?.(unit)) return { changed: false, reason: "not_downed", unit };
    if (!rageBeyondDeathActive(unit)) return death.addFailure?.(unit, options) || { changed: false, unit };

    const saves = death.ensureDeathState?.(unit) || unit.deathSaves || (unit.deathSaves = { successes: 0, failures: 0 });
    const failures = Math.max(0, Math.trunc(numberOr(saves.failures, 0)));
    if (failures < 2) return death.addFailure?.(unit, options) || { changed: false, unit };
    saves.failures = 3;
    markDeferredDeath(unit, options.reason || "three_failed_death_saves");
    return {
      changed: true,
      unit,
      failures: 3,
      successes: Math.max(0, Math.trunc(numberOr(saves.successes, 0))),
      deathDeferred: true,
      reason: options.reason || "failure",
    };
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.archetypeCatalogSource = source;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;

    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      PATH_OF_THE_ZEALOT_ID: ARCHETYPE_ID,
      PATH_OF_THE_ZEALOT_CLASS_ID: CLASS_ID,
      ARCHETYPES: Object.freeze({ ...(source.ARCHETYPES || {}), [ARCHETYPE_ID]: ARCHETYPE }),
      DEFINITIONS: Object.freeze({ ...(source.DEFINITIONS || {}), ...DEFINITIONS }),
      GRANTS: Object.freeze([...(source.GRANTS || []).filter((entry) => normalizeId(entry?.archetypeId || entry?.sourceId) !== ARCHETYPE_ID), ...GRANTS]),
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() {
        const base = originalGrants().filter((entry) => normalizeId(entry?.archetypeId || entry?.sourceId) !== ARCHETYPE_ID);
        return [...base, ...GRANTS.map((entry) => clone(entry))];
      },
      allArchetypes() { return { ...originalArchetypes(), [ARCHETYPE_ID]: { ...ARCHETYPE } }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
      resolveTraitGrants(character = {}, definitions) {
        const base = originalResolve ? (originalResolve(character, definitions) || []).filter((trait) => !DEFINITIONS[normalizeId(trait?.id || trait?.name)]) : [];
        return [...base, ...ownTraits(character)];
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.coreCatalogSource = source;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.traitEngineSource = source;
    const originalResolve = source.resolveTraitGrants.bind(source);
    const originalActivate = typeof source.activateTrait === "function" ? source.activateTrait.bind(source) : null;

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = (originalResolve(character, grants, definitions) || []).filter((trait) => !DEFINITIONS[normalizeId(trait?.id || trait?.name)]);
        return [...base, ...ownTraits(character)];
      },
      activateTrait(trait, runtime = {}, traitState) {
        const result = originalActivate ? originalActivate(trait, runtime, traitState) : { available: false, outcomes: [] };
        if (result?.available && !result?.scheduled && normalizeId(result?.trait?.id || trait?.id || trait?.name) === "zealous_presence") {
          const actor = runtime.self || runtime.character || null;
          if (actor && hasZealotLevel(actor, 50)) {
            actor.__zealotPresenceTriplePending = true;
            result.zealousPresence = { empoweredNextTurnStart: true, multiplier: 3 };
          }
        }
        return result;
      },
    });
    return true;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.archetypeRuntimeSource = source;
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const own = ownTraits(unit);
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing, ...own].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (!id) return;
          if (DEFINITIONS[id]) byId.set(id, clone(DEFINITIONS[id]));
          else if (!byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        return [...base.filter((trait) => !DEFINITIONS[normalizeId(trait?.id || trait?.name)]), ...own];
      },
    });
    return true;
  }

  function patchStatusEngine() {
    const source = global.LuminousStatusEngine;
    if (!source?.applyStatus || !source?.removeStatus || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.statusSource = source;
    ensureRuntimeStatuses();
    const originalApply = source.applyStatus.bind(source);
    const originalRemove = source.removeStatus.bind(source);

    global.LuminousStatusEngine = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      applyStatus(unit, statusId, input = {}) {
        const result = originalApply(unit, statusId, input);
        if (normalizeId(statusId) === "rage" && result && hasZealotLevel(unit, 30)) {
          unit.__zealotFanaticalConsumedThisRage = false;
          originalApply(unit, FANATICAL_READY_STATUS, {
            mode: "set",
            count: 1,
            duration: "until_removed",
            sourceTraitId: "fanatical_focus",
          });
        }
        return result;
      },
      removeStatus(unit, statusId, input = {}) {
        const result = originalRemove(unit, statusId, input);
        const removed = typeof result === "object" ? Boolean(result?.removed) : Boolean(result);
        if (normalizeId(statusId) === "rage" && removed) {
          delete unit.__zealotFanaticalConsumedThisRage;
          originalRemove(unit, FANATICAL_READY_STATUS, { from: "self", ignoreProtection: true });
          settleDeferredDeath(unit, "rage_ended");
        }
        return result;
      },
    });
    return true;
  }

  function patchStandardization() {
    const source = global.LuminousTraitStandardizationRuntime;
    if (!source?.resolveCombatCheck || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.standardizationSource = source;
    const originalCheck = source.resolveCombatCheck.bind(source);
    global.LuminousTraitStandardizationRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      resolveCombatCheck(unit, request = {}) {
        const result = originalCheck(unit, request);
        return resolveFanaticalFocus(unit, request, result);
      },
    });
    return true;
  }

  function patchConditionRuntime() {
    const source = global.LuminousConditionRuntime;
    if (!source?.turnEnd || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    const originalTurnEnd = source.turnEnd.bind(source);
    global.LuminousConditionRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      turnEnd(unit, options = {}) {
        const originalResolver = typeof options.resolveCheck === "function" ? options.resolveCheck : null;
        if (!originalResolver) return originalTurnEnd(unit, options);
        return originalTurnEnd(unit, {
          ...options,
          resolveCheck(request) {
            const result = originalResolver(request);
            const subject = request?.unit || request?.actor || unit;
            return resolveFanaticalFocus(
              subject,
              request?.check || request || {},
              result || {},
              typeof options.random === "function" ? options.random : Math.random,
            );
          },
        });
      },
    });
    return true;
  }

  function patchConditionBridge() {
    const source = global.LuminousConditionCombatBridge;
    if (!source?.rollCheck || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.conditionBridgeSource = source;
    const originalRoll = source.rollCheck.bind(source);
    global.LuminousConditionCombatBridge = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      rollCheck(engine, unit, request = {}, options = {}) {
        const result = originalRoll(engine, unit, request, options);
        return resolveFanaticalFocus(unit, request, result, typeof options.rng === "function" ? options.rng : Math.random);
      },
    });
    return true;
  }

  function patchDmConsole() {
    const source = global.LuminousBattleViewerDmConsole074;
    if (!source?.rollCheck || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.dmConsoleSource = source;
    const originalRoll = source.rollCheck.bind(source);
    global.LuminousBattleViewerDmConsole074 = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      rollCheck(unit, player, request = {}, random = Math.random) {
        const result = originalRoll(unit, player, request, random);
        return resolveFanaticalFocus(unit, request, result, typeof random === "function" ? random : Math.random);
      },
    });
    return true;
  }

  function patchDeathSaveRuntime() {
    const source = global.LuminousDeathSaveRuntime;
    if (!source?.resolveDeathSave || !source?.addFailure || source.__pathOfTheZealotApproved) return Boolean(source?.__pathOfTheZealotApproved);
    state.deathSource = source;
    const originalResolve = source.resolveDeathSave.bind(source);
    const originalRoll = typeof source.rollDeathSave === "function" ? source.rollDeathSave.bind(source) : null;
    const originalAddFailure = source.addFailure.bind(source);
    const originalHeal = typeof source.heal === "function" ? source.heal.bind(source) : null;
    const originalCanAct = typeof source.canAct === "function" ? source.canAct.bind(source) : null;

    global.LuminousDeathSaveRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotApproved: true,
      addFailure(unit, options = {}) {
        if (rageBeyondDeathActive(unit)) return addDeferredFailure(unit, options);
        return originalAddFailure(unit, options);
      },
      rollDeathSave(options = {}) {
        const check = originalRoll ? originalRoll(options) : null;
        return options.unit && check ? resolveFanaticalFocus(options.unit, check, check, typeof options.rng === "function" ? options.rng : Math.random) : check;
      },
      resolveDeathSave(unit, options = {}) {
        const needsCustom = rageBeyondDeathActive(unit) || fanaticalReady(unit);
        if (!needsCustom) return originalResolve(unit, options);
        if (!source.isDowned?.(unit) || source.isDead?.(unit)) return { resolved: false, reason: "not_downed", unit };
        const check = options.checkResult
          ? resolveFanaticalFocus(unit, options.checkResult, { ...(options.checkResult || {}) }, typeof options.rng === "function" ? options.rng : Math.random)
          : resolveFanaticalFocus(unit, {}, originalRoll?.({ ...options, unit }) || {}, typeof options.rng === "function" ? options.rng : Math.random);
        const outcome = check?.passed
          ? source.addSuccess?.(unit, { reason: "death_save", check })
          : addDeferredFailure(unit, { reason: "death_save", check });
        return { resolved: true, unit, check, outcome };
      },
      heal(unit, amount, options = {}) {
        const wasRevival = Boolean(options.revive || options.resurrection || ["revival", "resurrection"].includes(normalizeId(options.source || options.healSource)));
        const result = originalHeal ? originalHeal(unit, amount, options) : { applied: 0, unit };
        if (numberOr(unit?.hp, 0) > 0) clearDeferredDeath(unit);
        if (wasRevival && numberOr(unit?.hp, 0) > 0) gainFreeRage(unit);
        return result;
      },
      canAct(unit = {}) {
        if (rageBeyondDeathActive(unit) && source.isDowned?.(unit) && !source.isDead?.(unit)) return true;
        return originalCanAct ? originalCanAct(unit) : numberOr(unit.hp, 0) > 0;
      },
    });
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || typeof engine.applyDamage !== "function" || engine.__pathOfTheZealotApproved) return Boolean(engine?.__pathOfTheZealotApproved);
    state.combatSource = engine;
    const originalApplyDamage = engine.applyDamage;
    const originalCanAct = typeof engine.canUnitAct === "function" ? engine.canUnitAct : null;
    const originalRevive = typeof engine.reviveUnit === "function" ? engine.reviveUnit : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;

    engine.applyDamage = function (unit, damage, damageType = "directo", isCritical = false, skillUsed = null, damageContext = null, ...rest) {
      const beforeHp = numberOr(unit?.hp, 0);
      const result = originalApplyDamage.call(this, unit, damage, damageType, isCritical, skillUsed, damageContext, ...rest);
      const afterHp = numberOr(unit?.hp, beforeHp);
      const context = damageContext && typeof damageContext === "object" ? damageContext : {};
      const attacker = context.attacker || context.sourceUnit || context.source || context.self || null;

      if (beforeHp > 0 && afterHp <= 0 && hasZealotLevel(unit, 15)) {
        const targets = inflictWarriorRadiance(unit, {
          units: context.units || context.allUnits || combatUnits({}, this),
          engine: this,
          random: context.random,
        });
        if (result && typeof result === "object") result.warriorOfTheGods = { radiance: 4, targets };
      }

      if (
        normalizeId(damageType) === "directo"
        && attacker
        && hasZealotLevel(attacker, 15)
        && hasRage(attacker)
        && statusCount(unit, "radiance") > 0
        && !context.suppressRadianceTrigger
        && !context.__zealotDivineFury
      ) {
        const finalDamage = Math.max(0, numberOr(result?.damageTaken ?? result?.damage ?? result?.hpDamage, damage));
        const extra = Math.max(0, Math.floor(finalDamage * 0.01));
        if (extra > 0) {
          const applied = global.LuminousFixedDamageRuntime?.applyFixedDamage?.(unit, extra, {
            damageKind: "directo",
            skillUsed: null,
            __zealotDivineFury: true,
          }) || null;
          if (result && typeof result === "object") result.divineFury = { fixedDamage: extra, percent: 1, applied };
        }
      }
      return result;
    };

    if (originalCanAct) {
      engine.canUnitAct = function (unit, ...args) {
        if (rageBeyondDeathActive(unit) && (global.LuminousDeathSaveRuntime?.isDowned?.(unit) || unit?.isDowned)) return true;
        return originalCanAct.call(this, unit, ...args);
      };
    }

    if (originalRevive) {
      engine.reviveUnit = function (unit, amount = 1, options = {}) {
        const result = originalRevive.call(this, unit, amount, options);
        if (numberOr(unit?.hp, 0) > 0 && hasZealotLevel(unit, 15)) gainFreeRage(unit);
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...args) {
        const phase = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        const units = Array.isArray(allUnits) ? allUnits.filter(Boolean) : [];
        const proxies = [];

        if (["turn_start", "round_start"].includes(phase)) {
          units.forEach((unit) => {
            if (rageBeyondDeathActive(unit) && global.LuminousDeathSaveRuntime?.isDowned?.(unit)) {
              proxies.push({ unit, lifeState: unit.lifeState, isDowned: unit.isDowned, hp: unit.hp });
              unit.lifeState = "alive";
              unit.isDowned = false;
              unit.hp = 0;
            }
          });
        }

        let result;
        try { result = originalTriggerPhase.call(this, phaseTag, allUnits, ...args); }
        finally {
          proxies.forEach((snapshot) => {
            if (global.LuminousDeathSaveRuntime?.isDead?.(snapshot.unit) || numberOr(snapshot.unit.hp, 0) > 0) return;
            snapshot.unit.lifeState = snapshot.lifeState || "downed";
            snapshot.unit.isDowned = true;
            snapshot.unit.hp = 0;
          });
        }

        if (phase === "turn_start") {
          units.filter((unit) => hasZealotLevel(unit, 50)).forEach((actor) => zealousPresenceAtTurnStart(actor, units));
        }
        units.forEach((unit) => {
          if (unit?.__zealotDeferredDeath && !hasRage(unit)) settleDeferredDeath(unit, "rage_missing");
        });
        return result;
      };
    }

    Object.defineProperty(engine, "__pathOfTheZealotApproved", { value: true, configurable: true });
    return true;
  }

  function patchAll() {
    ensureRuntimeStatuses();
    return {
      archetypeCatalog: patchArchetypeCatalog(),
      coreCatalog: patchCoreCatalog(),
      traitEngine: patchTraitEngine(),
      archetypeRuntime: patchArchetypeRuntime(),
      statusEngine: patchStatusEngine(),
      standardization: patchStandardization(),
      conditionRuntime: patchConditionRuntime(),
      conditionBridge: patchConditionBridge(),
      dmConsole: patchDmConsole(),
      deathSave: patchDeathSaveRuntime(),
      combat: patchCombatEngine(),
    };
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    ARCHETYPE_NAME,
    CLASS_ID,
    CLASS_NAME,
    ARCHETYPE,
    DEFINITIONS,
    GRANTS,
    FANATICAL_READY_STATUS,
    barbarianLevel,
    selectedZealot,
    hasZealotLevel,
    ownTraits,
    hasRage,
    armFanaticalFocus,
    disarmFanaticalFocus,
    fanaticalReady,
    resolveFanaticalFocus,
    inflictWarriorRadiance,
    gainFreeRage,
    zealousPresenceAtTurnStart,
    rageBeyondDeathActive,
    markDeferredDeath,
    clearDeferredDeath,
    settleDeferredDeath,
    patchAll,
  });

  global.LuminousPathOfTheZealotArchetypeRuntime = api;
  patchAll();
  const timer = typeof global.setInterval === "function" ? global.setInterval(patchAll, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
