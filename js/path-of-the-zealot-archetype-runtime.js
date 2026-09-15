(function (global) {
  "use strict";

  if (global.LuminousPathOfTheZealotArchetypeRuntime) return;

  const ARCHETYPE_ID = "path_of_the_zealot";
  const ARCHETYPE_NAME = "Path of the Zealot";
  const CLASS_ID = "barbarian";
  const CLASS_NAME = "Barbarian";
  const PATCH_INTERVAL_MS = 250;
  const FANATICAL_READY_STATUS = "zealot_fanatical_focus_ready";
  const ZEALOUS_PRESENCE_STATUS = "zealot_zealous_presence";
  const DIVINE_FURY_TYPES = Object.freeze(["Radiant", "Necrotic"]);

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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
      description: "While having Rage, the first Skill that hits an enemy each Turn deals (5 + floor(Barbarian Class Level / 10))% additional Fixed Damage. Choose Radiant or Necrotic when gaining this Trait.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        trigger: "on_hit",
        whileStatus: "rage",
        scope: "once_per_turn",
        fixedDamagePercentFormula: "5 + floor(ClassLevel / 10)",
        damageTypeChoices: DIVINE_FURY_TYPES,
      },
    }),

    warrior_of_the_gods: Object.freeze({
      schemaVersion: 1,
      id: "warrior_of_the_gods",
      name: "Warrior of the Gods",
      description: "Revival and Resurrection effects that restore you waive their material or revival-resource cost for you. This Trait does not revive you by itself and does not make normal Healing restore a Dead Unit.",
      source: SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        revivalCostMultiplier: 0,
        waiveMaterialCost: true,
        waiveRevivalResourceCost: true,
        bypassDeadHealingRestriction: false,
      },
    }),

    fanatical_focus: Object.freeze({
      schemaVersion: 1,
      id: "fanatical_focus",
      name: "Fanatical Focus",
      description: "Once per Rage, when a Coin fails during a Saving Throw, re-toss that failed Coin once.",
      source: SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "coin",
        trigger: "check_coin_fail",
        action: "retoss_last",
        target: "self",
        count: 1,
        whileStatus: FANATICAL_READY_STATUS,
        conditions: [{
          any: [
            { path: "check.kind", operator: "in", value: ["save", "saving_throw", "savingthrow"] },
            { path: "check.checkType", operator: "in", value: ["save", "saving_throw", "savingthrow"] },
            { path: "check.isSavingThrow", operator: "truthy" },
          ],
        }],
      }],
      mechanics: {
        scope: "once_per_rage",
        readyStatusId: FANATICAL_READY_STATUS,
        reTossFailedCoins: 1,
      },
    }),

    zealous_presence: Object.freeze({
      schemaVersion: 1,
      id: "zealous_presence",
      name: "Zealous Presence",
      description: "Quick Action, once per Long Rest. You and your Allies gain +2 Final Power until Round End. The same bonus applies to Saving Throws made while the effect is active.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "quick_action", uses: { max: 1, reset: "long_rest" } },
      effects: [],
      rules: [],
      mechanics: {
        statusId: ZEALOUS_PRESENCE_STATUS,
        finalPowerBonus: 2,
        savingThrowPowerBonus: 2,
        targets: "self_and_allies",
        duration: "next_turn_end",
      },
    }),

    rage_beyond_death: Object.freeze({
      schemaVersion: 1,
      id: "rage_beyond_death",
      name: "Rage Beyond Death",
      description: "While having Rage, being Downed at 0 HP does not prevent you from acting. You still make Death Saves and suffer Death Save Failures normally. If a third Failure would kill you, Death is deferred until Rage ends. If valid Healing restores you above 0 HP before then, the deferred Death is cleared.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        whileStatus: "rage",
        canActWhileDowned: true,
        continueDeathSaves: true,
        deferDeathAtFailures: 3,
        clearDeferredDeathOnHealing: true,
        finalizeDeferredDeathWhenRageEnds: true,
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
    divineFuryByKey: new Set(),
    divineFuryByObject: typeof WeakSet === "function" ? new WeakSet() : null,
    skillTokens: typeof WeakMap === "function" ? new WeakMap() : null,
    nextSkillToken: 1,
    combatSource: null,
    originalDeathApi: null,
  };

  function classEntries(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = Array.isArray(character.classes) ? character.classes : (Array.isArray(build.classes) ? build.classes : []);
    return source.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.id || entry?.className || entry?.name),
      level: Math.max(0, Number.parseInt(entry?.level ?? entry?.levels ?? entry?.classLevel, 10) || 0),
    })).filter((entry) => entry.classId);
  }

  function archetypeSelections(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const raw = build.archetypes ?? character.archetypes ?? [];
    const source = Array.isArray(raw)
      ? raw
      : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return source.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.parentClassId),
      archetypeId: normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id),
    }));
  }

  function normalizedCharacter(character = {}) {
    if (Array.isArray(character.classes)) return character;
    if (Array.isArray(character.characterBuild?.classes)) return { ...character, classes: character.characterBuild.classes };
    return character;
  }

  function barbarianLevel(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.getClassLevel) {
      try { return Math.max(0, numberOr(engine.getClassLevel(normalizedCharacter(character), CLASS_ID), 0)); } catch (_) {}
    }
    return classEntries(character).find((entry) => entry.classId === CLASS_ID)?.level || 0;
  }

  function selectedZealot(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) {
      try { return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID)); } catch (_) {}
    }
    return archetypeSelections(character).some((entry) => entry.classId === CLASS_ID && entry.archetypeId === ARCHETYPE_ID);
  }

  function hasZealotLevel(character = {}, level = 1) {
    return selectedZealot(character) && barbarianLevel(character) >= Number(level || 0);
  }

  function unitIds(unit = {}) {
    return [
      unit.combatId, unit.combat_id, unit.id, unit.unitId, unit.unit_id,
      unit.characterId, unit.character_id, unit.playerId, unit.player_id,
      unit.actorId, unit.actor_id, unit.uid, unit.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function unitKey(unit = {}) {
    return unitIds(unit)[0] || normalizeId(unit.characterName || unit.character_name || unit.nombre || unit.name || "") || null;
  }

  function hasStatus(unit, statusId) {
    const id = normalizeId(statusId);
    try {
      if (global.LuminousStatusEngine?.hasStatus?.(unit, id)) return true;
    } catch (_) {}
    const statuses = unit?.statusEffects;
    if (statuses && typeof statuses === "object") {
      return Boolean(statuses[id] || Object.values(statuses).some((entry) => normalizeId(entry?.id || entry?.name) === id));
    }
    return false;
  }

  function hasRage(unit) {
    return hasStatus(unit, "rage");
  }

  function rageBeyondDeathActive(unit = {}) {
    return hasZealotLevel(unit, 70) && hasRage(unit);
  }

  function ensureStatuses() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    if (!global.STATUS_REGISTRY[FANATICAL_READY_STATUS]) {
      global.STATUS_REGISTRY[FANATICAL_READY_STATUS] = {
        id: FANATICAL_READY_STATUS,
        name: "Fanatical Focus Ready",
        type: "neutral",
        mode: "single",
        icon: null,
        rules: [],
        runtimeOnly: true,
      };
    }
    if (!global.STATUS_REGISTRY[ZEALOUS_PRESENCE_STATUS]) {
      global.STATUS_REGISTRY[ZEALOUS_PRESENCE_STATUS] = {
        id: ZEALOUS_PRESENCE_STATUS,
        name: "Zealous Presence",
        type: "positive",
        mode: "single",
        icon: null,
        rules: [{
          trigger: "passive",
          cond_type: "count",
          cond_input: 1,
          affectation: "final_power",
          operation: "add",
          aff_input: 2,
        }],
        runtimeOnly: true,
      };
    }
    return true;
  }

  function divineFuryPercent(character = {}) {
    return 5 + Math.floor(barbarianLevel(character) / 10);
  }

  function divineFuryDamageType(character = {}) {
    const raw = character.zealotDivineFuryDamageType
      ?? character.characterBuild?.archetypeChoices?.[ARCHETYPE_ID]?.divineFuryDamageType
      ?? character.characterBuild?.archetypeChoices?.[ARCHETYPE_ID]?.divine_fury_damage_type;
    const wanted = DIVINE_FURY_TYPES.find((entry) => normalizeId(entry) === normalizeId(raw));
    return wanted || "Radiant";
  }

  function setDivineFuryDamageType(character, damageType) {
    if (!character || typeof character !== "object") return null;
    const selected = DIVINE_FURY_TYPES.find((entry) => normalizeId(entry) === normalizeId(damageType));
    if (!selected) return null;
    character.zealotDivineFuryDamageType = selected;
    const build = character.characterBuild;
    if (build && typeof build === "object") {
      if (!build.archetypeChoices || typeof build.archetypeChoices !== "object") build.archetypeChoices = {};
      if (!build.archetypeChoices[ARCHETYPE_ID] || typeof build.archetypeChoices[ARCHETYPE_ID] !== "object") build.archetypeChoices[ARCHETYPE_ID] = {};
      build.archetypeChoices[ARCHETYPE_ID].divineFuryDamageType = selected;
    }
    return selected;
  }

  function divineFuryUsed(unit = {}) {
    const key = unitKey(unit);
    if (key) return state.divineFuryByKey.has(key);
    return Boolean(state.divineFuryByObject?.has(unit));
  }

  function markDivineFuryUsed(unit = {}) {
    const key = unitKey(unit);
    if (key) state.divineFuryByKey.add(key);
    else state.divineFuryByObject?.add(unit);
  }

  function resetTurnState(units = null) {
    if (units == null) {
      state.divineFuryByKey.clear();
      state.divineFuryByObject = typeof WeakSet === "function" ? new WeakSet() : null;
      return true;
    }
    (Array.isArray(units) ? units : [units]).filter(Boolean).forEach((unit) => {
      const key = unitKey(unit);
      if (key) state.divineFuryByKey.delete(key);
      else if (state.divineFuryByObject) state.divineFuryByObject.delete(unit);
    });
    return true;
  }

  function resolveDivineFury(traits = [], trigger, runtime = {}, result = null) {
    if (normalizeId(trigger) !== "on_hit") return null;
    const actor = runtime.self || runtime.attacker || runtime.character || null;
    const target = runtime.target || runtime.defender || null;
    if (!actor || !target || !hasZealotLevel(actor, 15) || !hasRage(actor) || divineFuryUsed(actor)) return null;

    const includesTrait = (Array.isArray(traits) ? traits : Object.values(traits || {}))
      .some((trait) => normalizeId(trait?.id || trait?.name) === "divine_fury");
    if (!includesTrait) return null;

    const baseDamage = Math.max(0, numberOr(runtime.damageDealt, 0));
    if (baseDamage <= 0) return null;

    markDivineFuryUsed(actor);
    const percent = divineFuryPercent(actor);
    const amount = Math.max(0, Math.floor(baseDamage * percent / 100));
    const damageType = divineFuryDamageType(actor);
    let applied = null;
    if (amount > 0) {
      applied = global.LuminousFixedDamageRuntime?.applyFixedDamage?.(target, amount, {
        damageKind: "directo",
        skillUsed: null,
      }) || null;
    }
    const outcome = {
      type: "zealot_divine_fury",
      traitId: "divine_fury",
      percent,
      amount,
      damageType,
      fixedDamage: true,
      applied,
    };
    runtime.fixedDamageDealt = numberOr(runtime.fixedDamageDealt, 0) + amount;
    runtime.divineFury = outcome;
    if (Array.isArray(result?.outcomes)) result.outcomes.push(outcome);
    return outcome;
  }

  function factionId(unit = {}) {
    const explicit = unit.faction ?? unit.faccion ?? unit.team ?? unit.side;
    if (explicit != null && String(explicit).trim() !== "") return normalizeId(explicit);
    if (unit.isPlayer != null) return unit.isPlayer ? "player" : "enemy";
    return null;
  }

  function sameFaction(a, b) {
    if (!a || !b) return false;
    const left = factionId(a);
    const right = factionId(b);
    if (left && right) return left === right;
    return a === b;
  }

  function uniqueUnits(values = []) {
    const seen = new Set();
    return values.filter((unit) => {
      if (!unit || typeof unit !== "object") return false;
      const key = unitKey(unit) || unit;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function combatUnits(runtime = {}) {
    const explicit = Array.isArray(runtime.units) ? runtime.units : [];
    let standard = [];
    try { standard = global.LuminousTraitStandardizationRuntime?.liveCombatUnits?.(runtime) || []; } catch (_) {}
    const world = global.combatData && typeof global.combatData === "object" ? Object.values(global.combatData) : [];
    return uniqueUnits([...explicit, ...standard, ...world]);
  }

  function applyZealousPresence(actor, runtime = {}) {
    if (!actor || !hasZealotLevel(actor, 50)) return { applied: false, reason: "not_eligible", targets: [] };
    ensureStatuses();
    const statusEngine = global.LuminousStatusEngine;
    if (!statusEngine?.applyStatus) return { applied: false, reason: "status_engine_unavailable", targets: [] };
    const allies = combatUnits({ ...runtime, self: actor }).filter((unit) => unit === actor || sameFaction(unit, actor));
    const targets = uniqueUnits([actor, ...allies]);
    targets.forEach((unit) => statusEngine.applyStatus(unit, ZEALOUS_PRESENCE_STATUS, {
      count: 1,
      potency: 0,
      duration: "next_turn_end",
      sourceTraitId: "zealous_presence",
      sourceUnitId: unitKey(actor),
      mode: "set",
    }));
    return { applied: true, actor, targets, statusId: ZEALOUS_PRESENCE_STATUS, finalPowerBonus: 2, savingThrowPowerBonus: 2 };
  }

  function isSavingThrowRequest(request = {}) {
    if (request.isSavingThrow === true || request.savingThrow === true) return true;
    return ["save", "saving_throw", "savingthrow"].includes(normalizeId(request.kind || request.checkType || request.type));
  }

  function applyZealousSavingThrowBonus(unit, request = {}, result = {}) {
    if (!unit || !hasStatus(unit, ZEALOUS_PRESENCE_STATUS) || !isSavingThrowRequest(request)) return result;
    const bonus = 2;
    const threshold = numberOr(result.threshold ?? request.threshold, 0);
    const total = numberOr(result.total, 0) + bonus;
    return { ...result, total, zealotZealousPresenceBonus: bonus, passed: total >= threshold, failed: total < threshold };
  }

  function revivalOptionsFor(unit, options = {}) {
    if (!hasZealotLevel(unit, 15)) return { ...(options || {}) };
    return {
      ...(options || {}),
      warriorOfTheGods: true,
      waiveMaterialCost: true,
      waiveRevivalResourceCost: true,
      revivalCostMultiplier: 0,
    };
  }

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function markDeferredDeath(unit, options = {}) {
    if (!unit || typeof unit !== "object") return null;
    unit.__zealotDeferredDeath = {
      pending: true,
      reason: options.reason || "three_failed_death_saves",
      at: Date.now(),
    };
    emit("luminous:death-deferred", { unit, reason: unit.__zealotDeferredDeath.reason, sourceTraitId: "rage_beyond_death" });
    return unit.__zealotDeferredDeath;
  }

  function clearDeferredDeath(unit, reason = "cleared") {
    if (!unit?.__zealotDeferredDeath) return false;
    const previous = unit.__zealotDeferredDeath;
    delete unit.__zealotDeferredDeath;
    emit("luminous:death-deferral-cleared", { unit, reason, previous });
    return true;
  }

  function originalDeathApi() {
    return state.originalDeathApi || global.LuminousDeathSaveRuntime || null;
  }

  function addDeathSaveFailure(unit, options = {}) {
    const death = originalDeathApi();
    if (!unit || !death?.isDowned?.(unit) || death?.isDead?.(unit)) return { changed: false, unit, reason: "not_downed" };
    if (!rageBeyondDeathActive(unit)) return death.addFailure?.(unit, options) || { changed: false, unit, reason: "death_runtime_unavailable" };

    const saves = death.ensureDeathState?.(unit) || unit.deathSaves || (unit.deathSaves = { successes: 0, failures: 0 });
    const failures = Math.max(0, Math.trunc(numberOr(saves.failures, 0)));
    if (failures >= 3 && unit.__zealotDeferredDeath) {
      return { changed: false, unit, failures: 3, successes: numberOr(saves.successes, 0), deathDeferred: true, reason: options.reason || "failure" };
    }
    if (failures < 2) return death.addFailure?.(unit, options) || { changed: false, unit };

    saves.failures = 3;
    const result = {
      changed: true,
      unit,
      failures: 3,
      successes: numberOr(saves.successes, 0),
      deathDeferred: true,
      reason: options.reason || "failure",
    };
    markDeferredDeath(unit, result);
    emit("luminous:death-save-failure", result);
    return result;
  }

  function resolveZealotDeathSave(unit, options = {}) {
    const death = originalDeathApi();
    if (!death || !rageBeyondDeathActive(unit)) return death?.resolveDeathSave?.(unit, options) || { resolved: false, reason: "death_runtime_unavailable", unit };
    if (!death.isDowned?.(unit) || death.isDead?.(unit)) return { resolved: false, reason: "not_downed", unit };
    if (unit.__zealotDeferredDeath) return { resolved: false, reason: "death_deferred", unit, deathDeferred: true };

    const check = options.checkResult
      ? { ...(options.checkResult || {}) }
      : death.rollDeathSave?.({ ...options, unit });
    if (!check) return { resolved: false, reason: "death_save_unavailable", unit };

    const outcome = check.passed
      ? death.addSuccess?.(unit, { reason: "death_save", check })
      : addDeathSaveFailure(unit, { reason: "death_save", check });
    const result = { resolved: true, unit, check, outcome };
    emit("luminous:death-save-resolved", result);
    return result;
  }

  function settleDeferredDeath(unit, reason = "rage_ended") {
    const death = originalDeathApi();
    if (!unit?.__zealotDeferredDeath) return { settled: false, unit, reason: "not_deferred" };
    if (numberOr(unit.hp, 0) > 0 || !death?.isDowned?.(unit)) {
      clearDeferredDeath(unit, "healed");
      return { settled: true, survived: true, unit };
    }
    if (hasRage(unit)) return { settled: false, deferred: true, unit, reason: "rage_active" };
    clearDeferredDeath(unit, reason);
    const resolved = death?.resolveDeath?.(unit, { reason: `rage_beyond_death_${reason}`, sourceTraitId: "rage_beyond_death" }) || null;
    return { settled: true, died: Boolean(resolved?.died), unit, resolved };
  }

  function armFanaticalFocus(unit) {
    if (!hasZealotLevel(unit, 30)) return null;
    ensureStatuses();
    return global.LuminousStatusEngine?.applyStatus?.(unit, FANATICAL_READY_STATUS, {
      count: 1,
      potency: 0,
      duration: "until_removed",
      sourceTraitId: "fanatical_focus",
      mode: "set",
    }) || null;
  }

  function consumeFanaticalFocus(trigger, traitOrTraits, runtime, result) {
    if (normalizeId(trigger) !== "check_coin_fail" || !result?.outcomes?.length) return false;
    const traits = Array.isArray(traitOrTraits) ? traitOrTraits : [traitOrTraits];
    if (!traits.some((trait) => normalizeId(trait?.id || trait?.name) === "fanatical_focus")) return false;
    const unit = runtime?.self || runtime?.character || null;
    if (!unit || !hasStatus(unit, FANATICAL_READY_STATUS)) return false;
    global.LuminousStatusEngine?.removeStatus?.(unit, FANATICAL_READY_STATUS, { from: "self", ignoreProtection: true });
    return true;
  }

  function isZealotTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType))
      && normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID;
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__pathOfTheZealotIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;

    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      PATH_OF_THE_ZEALOT_ID: ARCHETYPE_ID,
      PATH_OF_THE_ZEALOT_CLASS_ID: CLASS_ID,
      ARCHETYPES: Object.freeze({ ...(source.ARCHETYPES || {}), [ARCHETYPE_ID]: ARCHETYPE }),
      DEFINITIONS: Object.freeze({ ...(source.DEFINITIONS || {}), ...DEFINITIONS }),
      GRANTS: Object.freeze([...(source.GRANTS || []), ...GRANTS]),
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS.map((entry) => ({ ...entry, source: { ...(entry.source || {}) } }))]; },
      allArchetypes() { return { ...originalArchetypes(), [ARCHETYPE_ID]: { ...ARCHETYPE } }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
      resolveTraitGrants(character = {}, definitions) {
        const base = originalResolve ? originalResolve(character, definitions) || [] : [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, definitions ? { ...definitions, ...DEFINITIONS } : DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        return [...byId.values()];
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || source.__pathOfTheZealotIntegrated) return Boolean(source?.__pathOfTheZealotIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;

    // Definitions belong in the merged Player catalog, but Archetype grants do not:
    // TraitEngine V1 treats unknown grant source types as generic, so publishing Archetype
    // grants through Core would leak them to characters that did not select the Archetype.
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__pathOfTheZealotIntegrated) return Boolean(source?.__pathOfTheZealotIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    const originalActivate = typeof source.activateTrait === "function" ? source.activateTrait.bind(source) : null;
    const originalDispatchTrait = typeof source.dispatchTrait === "function" ? source.dispatchTrait.bind(source) : null;
    const originalDispatchTraits = typeof source.dispatchTraits === "function" ? source.dispatchTraits.bind(source) : null;
    const originalDispatchCombatEvent = typeof source.dispatchCombatEvent === "function" ? source.dispatchCombatEvent.bind(source) : null;

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        return [...byId.values()];
      },
      activateTrait(trait, runtime = {}, traitState) {
        const result = originalActivate ? originalActivate(trait, runtime, traitState) : { available: false, outcomes: [] };
        if (result?.available && !result?.scheduled && normalizeId(result?.trait?.id || trait?.id || trait?.name) === "zealous_presence") {
          result.zealousPresence = applyZealousPresence(runtime.self || runtime.character, runtime);
        }
        return result;
      },
      dispatchTrait(trait, trigger, runtime = {}, traitState) {
        const result = originalDispatchTrait ? originalDispatchTrait(trait, trigger, runtime, traitState) : null;
        consumeFanaticalFocus(trigger, trait, runtime, result);
        return result;
      },
      dispatchTraits(traits, trigger, runtime = {}, traitState) {
        const result = originalDispatchTraits ? originalDispatchTraits(traits, trigger, runtime, traitState) : null;
        consumeFanaticalFocus(trigger, traits, runtime, result);
        return result;
      },
      dispatchCombatEvent(trigger, input = {}) {
        const result = originalDispatchCombatEvent ? originalDispatchCombatEvent(trigger, input) : null;
        consumeFanaticalFocus(trigger, input.traits || [], result?.runtime || input, result);
        return result;
      },
    });
    return true;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__pathOfTheZealotIntegrated) return Boolean(source?.__pathOfTheZealotIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);

    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const granted = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isZealotTrait(trait)), ...granted].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        return [...base, ...granted];
      },
    });
    return true;
  }

  function patchStatusEngine() {
    const source = global.LuminousStatusEngine;
    if (!source?.applyStatus || !source?.removeStatus || source.__pathOfTheZealotIntegrated) return Boolean(source?.__pathOfTheZealotIntegrated);
    ensureStatuses();
    const originalApply = source.applyStatus.bind(source);
    const originalRemove = source.removeStatus.bind(source);

    global.LuminousStatusEngine = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      applyStatus(unit, statusId, input = {}) {
        const result = originalApply(unit, statusId, input);
        if (normalizeId(statusId) === "rage" && result && hasZealotLevel(unit, 30)) {
          originalApply(unit, FANATICAL_READY_STATUS, {
            count: 1,
            potency: 0,
            duration: "until_removed",
            sourceTraitId: "fanatical_focus",
            mode: "set",
          });
        }
        return result;
      },
      removeStatus(unit, statusId, options = {}) {
        const result = originalRemove(unit, statusId, options);
        if (normalizeId(statusId) === "rage" && result?.removed) {
          originalRemove(unit, FANATICAL_READY_STATUS, { from: "self", ignoreProtection: true });
          settleDeferredDeath(unit, "rage_ended");
        }
        return result;
      },
    });
    return true;
  }

  function patchTraitStandardizationRuntime() {
    const source = global.LuminousTraitStandardizationRuntime;
    if (!source?.resolveTraitRuntimeResolutions || source.__pathOfTheZealotIntegrated) return Boolean(source?.__pathOfTheZealotIntegrated);
    const originalResolve = source.resolveTraitRuntimeResolutions.bind(source);
    const originalCombatCheck = typeof source.resolveCombatCheck === "function" ? source.resolveCombatCheck.bind(source) : null;

    global.LuminousTraitStandardizationRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      resolveTraitRuntimeResolutions(traits = [], trigger, runtime = {}, result = null) {
        const resolved = originalResolve(traits, trigger, runtime, result);
        resolveDivineFury(traits, trigger, runtime, result);
        return resolved;
      },
      resolveCombatCheck(unit, request = {}) {
        const result = originalCombatCheck ? originalCombatCheck(unit, request) : {};
        return applyZealousSavingThrowBonus(unit, request, result);
      },
    });
    return true;
  }

  function patchDeathSaveRuntime() {
    const source = global.LuminousDeathSaveRuntime;
    if (!source?.addFailure || !source?.resolveDeathSave || source.__pathOfTheZealotIntegrated) return Boolean(source?.__pathOfTheZealotIntegrated);
    if (!state.originalDeathApi) state.originalDeathApi = source;
    const originalAddFailure = source.addFailure.bind(source);
    const originalResolveDeathSave = source.resolveDeathSave.bind(source);
    const originalHeal = typeof source.heal === "function" ? source.heal.bind(source) : null;

    global.LuminousDeathSaveRuntime = Object.freeze({
      ...source,
      __pathOfTheZealotIntegrated: true,
      addFailure(unit, options = {}) {
        if (rageBeyondDeathActive(unit)) return addDeathSaveFailure(unit, options);
        return originalAddFailure(unit, options);
      },
      resolveDeathSave(unit, options = {}) {
        if (rageBeyondDeathActive(unit)) return resolveZealotDeathSave(unit, options);
        return originalResolveDeathSave(unit, options);
      },
      heal(unit, amount, options = {}) {
        const result = originalHeal ? originalHeal(unit, amount, options) : { applied: 0, unit };
        if (numberOr(unit?.hp, 0) > 0) clearDeferredDeath(unit, "healed");
        return result;
      },
    });
    return true;
  }

  function skillToken(skill) {
    if (!skill || typeof skill !== "object" || !state.skillTokens) return `skill_${state.nextSkillToken++}`;
    let token = state.skillTokens.get(skill);
    if (!token) {
      token = `skill_${state.nextSkillToken++}`;
      state.skillTokens.set(skill, token);
    }
    return token;
  }

  function noteZealotSkillHit(unit, skill, context = {}) {
    if (!rageBeyondDeathActive(unit) || !originalDeathApi()?.isDowned?.(unit)) return { changed: false, unit, reason: "not_eligible" };
    const token = context.__zealotSkillToken || skillToken(skill);
    if (unit.__zealotLastDownedFailureSkillToken === token) return { changed: false, deduped: true, unit };
    unit.__zealotLastDownedFailureSkillToken = token;
    return addDeathSaveFailure(unit, { reason: "skill_hit_while_downed", context });
  }

  function clearZealotSkillToken(unit) {
    if (unit) delete unit.__zealotLastDownedFailureSkillToken;
  }

  function proxyDownedUnit(unit) {
    const death = originalDeathApi();
    if (!unit || !rageBeyondDeathActive(unit) || !death?.isDowned?.(unit) || death?.isDead?.(unit)) return null;
    const snapshot = {
      lifeState: unit.lifeState,
      isDowned: unit.isDowned,
      hp: unit.hp,
    };
    unit.lifeState = "alive";
    unit.isDowned = false;
    unit.hp = 0;
    unit.__zealotDownedPhaseProxy = true;
    return snapshot;
  }

  function restoreDownedUnit(unit, snapshot) {
    if (!unit || !snapshot) return;
    delete unit.__zealotDownedPhaseProxy;
    const death = originalDeathApi();
    if (death?.isDead?.(unit) || death?.isRetreated?.(unit)) return;
    if (numberOr(unit.hp, 0) > 0) {
      emit("luminous:downed-self-heal-negated", { unit, requested: numberOr(unit.hp, 0), source: "status_or_passive" });
    }
    unit.hp = 0;
    unit.lifeState = snapshot.lifeState || "downed";
    unit.isDowned = snapshot.isDowned !== false;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    const death = global.LuminousDeathSaveRuntime;
    if (!engine || !death || !engine.__deathSaveRuntimeIntegrated) return false;
    if (engine.__pathOfTheZealotIntegrated) {
      state.combatSource = engine;
      return true;
    }

    const originalCanAct = typeof engine.canUnitAct === "function" ? engine.canUnitAct : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalApplyHealing = typeof engine.applyHealing === "function" ? engine.applyHealing : null;
    const originalReviveUnit = typeof engine.reviveUnit === "function" ? engine.reviveUnit : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalGetAllAliveUnits = typeof engine.getAllAliveUnits === "function" ? engine.getAllAliveUnits : null;

    engine.canUnitAct = function (unit, ...rest) {
      if (rageBeyondDeathActive(unit) && originalDeathApi()?.isDowned?.(unit) && !originalDeathApi()?.isDead?.(unit)) return true;
      return originalCanAct ? originalCanAct.call(this, unit, ...rest) : Boolean(unit);
    };

    if (originalGetAllAliveUnits) {
      engine.getAllAliveUnits = function (...args) {
        const units = originalGetAllAliveUnits.apply(this, args) || [];
        const world = global.combatData && typeof global.combatData === "object" ? Object.values(global.combatData) : [];
        return uniqueUnits([
          ...(Array.isArray(units) ? units : []),
          ...world.filter((unit) => rageBeyondDeathActive(unit) && originalDeathApi()?.isDowned?.(unit) && !originalDeathApi()?.isDead?.(unit)),
        ]);
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, damageType = "directo", isCritical = false, skillUsed = null, ...rest) {
        const deathApi = originalDeathApi();
        const wasDowned = Boolean(unit && deathApi?.isDowned?.(unit) && !deathApi?.isDead?.(unit));
        const active = wasDowned && rageBeyondDeathActive(unit);
        const statusDamage = ["efecto_estado", "status", "status_effect", "dot"].includes(normalizeId(damageType));

        if (active && statusDamage) {
          const failure = addDeathSaveFailure(unit, { reason: "status_damage_while_downed" });
          return { hp: 0, shield: unit.shield, deathSave: failure, rageBeyondDeath: true };
        }

        const queueSnapshot = !wasDowned && Array.isArray(unit?.actionQueue) ? unit.actionQueue.slice() : null;
        const result = originalApplyDamage.call(this, unit, damage, damageType, isCritical, skillUsed, ...rest);
        if (unit && queueSnapshot && rageBeyondDeathActive(unit) && deathApi?.isDowned?.(unit) && !deathApi?.isDead?.(unit)) {
          unit.actionQueue = queueSnapshot;
        }
        return result;
      };
    }

    if (originalApplyHealing) {
      engine.applyHealing = function (unit, amount, options = {}) {
        const result = originalApplyHealing.call(this, unit, amount, options);
        if (numberOr(unit?.hp, 0) > 0) clearDeferredDeath(unit, "healed");
        return result;
      };
    }

    if (originalReviveUnit) {
      engine.reviveUnit = function (unit, amount = 1, options = {}) {
        const result = originalReviveUnit.call(this, unit, amount, revivalOptionsFor(unit, options));
        if (numberOr(unit?.hp, 0) > 0) clearDeferredDeath(unit, "revived");
        return result;
      };
    }

    engine.resolveDeathSave = function (unit, options = {}) {
      if (rageBeyondDeathActive(unit)) return resolveZealotDeathSave(unit, options);
      return originalDeathApi()?.resolveDeathSave?.(unit, options);
    };

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context = {}, targetsHit = [], ...rest) {
        const targets = Array.isArray(targetsHit) && targetsHit.length
          ? targetsHit
          : [context?.defender || context?.currentTarget].filter(Boolean);
        const proxyStates = [];

        if (tag === "[On Hit]" && context?.skill) {
          targets.forEach((target) => {
            if (!target || !rageBeyondDeathActive(target) || !originalDeathApi()?.isDowned?.(target)) return;
            if (target.__luminousDownedHitPending || target.__luminousDownedAttackProxy) {
              noteZealotSkillHit(target, context.skill, context);
              const hadProxy = target.__luminousDownedAttackProxy;
              proxyStates.push({ target, hadProxy });
              delete target.__luminousDownedHitPending;
              target.__luminousDownedAttackProxy = false;
            }
          });
        }

        let result;
        try {
          result = originalTriggerEvent.call(this, tag, context, targetsHit, ...rest);
        } finally {
          proxyStates.forEach(({ target, hadProxy }) => {
            if (hadProxy) target.__luminousDownedAttackProxy = true;
            else delete target.__luminousDownedAttackProxy;
          });
          if (tag === "[Attack End]") targets.forEach(clearZealotSkillToken);
        }
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        if (phaseTag === "[Round Start]") resetTurnState(units);

        if (phaseTag === "[Round End]") {
          units.forEach((unit) => {
            if (rageBeyondDeathActive(unit) && originalDeathApi()?.isDowned?.(unit) && !originalDeathApi()?.isDead?.(unit)) {
              resolveZealotDeathSave(unit);
            }
          });
        }

        const shouldProxy = phaseTag === "[Round Start]" || phaseTag === "[Round End]";
        const proxies = shouldProxy
          ? units.map((unit) => ({ unit, snapshot: proxyDownedUnit(unit) })).filter((entry) => entry.snapshot)
          : [];

        let result;
        try {
          result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        } finally {
          proxies.forEach(({ unit, snapshot }) => restoreDownedUnit(unit, snapshot));
          units.forEach((unit) => {
            if (unit?.__zealotDeferredDeath) settleDeferredDeath(unit, phaseTag === "[Round End]" ? "round_end_rage_check" : "rage_check");
          });
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__pathOfTheZealotIntegrated", { value: true, configurable: true });
    state.combatSource = engine;
    return true;
  }

  function install() {
    ensureStatuses();
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    patchStatusEngine();
    patchTraitStandardizationRuntime();
    patchDeathSaveRuntime();
    patchCombatEngine();

    const world = global.combatData && typeof global.combatData === "object" ? Object.values(global.combatData) : [];
    world.forEach((unit) => {
      if (unit?.__zealotDeferredDeath) settleDeferredDeath(unit, "runtime_check");
    });
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    ARCHETYPE_NAME,
    CLASS_ID,
    CLASS_NAME,
    ARCHETYPE,
    SOURCE,
    DEFINITIONS,
    GRANTS,
    FANATICAL_READY_STATUS,
    ZEALOUS_PRESENCE_STATUS,
    DIVINE_FURY_TYPES,
    barbarianLevel,
    selectedZealot,
    hasZealotLevel,
    hasStatus,
    hasRage,
    rageBeyondDeathActive,
    ensureStatuses,
    divineFuryPercent,
    divineFuryDamageType,
    setDivineFuryDamageType,
    divineFuryUsed,
    resetTurnState,
    resolveDivineFury,
    applyZealousPresence,
    applyZealousSavingThrowBonus,
    revivalOptionsFor,
    markDeferredDeath,
    clearDeferredDeath,
    addDeathSaveFailure,
    resolveZealotDeathSave,
    settleDeferredDeath,
    armFanaticalFocus,
    consumeFanaticalFocus,
    patchArchetypeCatalog,
    patchCoreCatalog,
    patchTraitEngine,
    patchArchetypeRuntime,
    patchStatusEngine,
    patchTraitStandardizationRuntime,
    patchDeathSaveRuntime,
    patchCombatEngine,
    install,
  });

  global.LuminousPathOfTheZealotArchetypeRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
