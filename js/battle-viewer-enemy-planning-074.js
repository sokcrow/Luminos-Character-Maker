(function (global) {
  "use strict";

  if (global.LuminousBattleViewerEnemyPlanning074) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerEnemyPlanning074;
    return;
  }

  const VERSION = "0.7.6";
  const STATE_KEY = "__luminousEnemyPlanning074State";
  const BOOTSTRAP_TIMEOUT_MS = 5000;
  const BOOTSTRAP_INTERVAL_MS = 25;

  const safeRequire = (path) => {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  };
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  const state = global[STATE_KEY] || {
    installed: false,
    originalSyncCombatEnginePhase: null,
    lastResult: null,
    appliedVectorSlots: new Set(),
    intelByUnitId: {},
  };
  global[STATE_KEY] = state;

  function allocator() { return global.LuminousEnemyActionSlotAllocator || safeRequire("./enemy-action-slot-allocator.js"); }
  function kitAdapter() { return global.LuminousUnitAiKitAdapter || safeRequire("./unit-ai-kit-adapter.js"); }
  function profileCatalog() { return global.LuminousUnitActionEconomyCatalog || safeRequire("./unit-action-economy-catalog.js"); }
  function economy() { return global.LuminousActionEconomy || safeRequire("./universal-action-economy.js"); }

  function lexical(name, fallback = null) {
    try {
      return typeof global.eval === "function"
        ? (global.eval(`typeof ${name} !== 'undefined' ? ${name} : undefined`) ?? fallback)
        : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function viewerFunction(name) {
    const fn = global[name] || lexical(name, null);
    return typeof fn === "function" ? fn : null;
  }

  function combatDataRef() {
    return global.combatData || lexical("combatData", {}) || {};
  }

  function attackVectorsRef() {
    return global.attackVectors || lexical("attackVectors", {}) || {};
  }

  function slotTargetsRef() {
    return global.slotTargets || lexical("slotTargets", {}) || {};
  }

  function unitIdOf(unit = {}) {
    return clean(unit.id ?? unit.unitId ?? unit.characterId ?? unit.actorId);
  }

  function sideOf(unit = {}) {
    if (unit.isPlayer === true) return "ally";
    const raw = normalizeId(unit.faction ?? unit.faccion ?? unit.side ?? unit.team ?? unit.actorCategory ?? unit.unitType ?? unit.type);
    if (["ally", "allies", "friendly", "player", "players", "aliado", "aliados"].includes(raw)) return "ally";
    if (["enemy", "enemies", "hostile", "boss", "enemigo", "enemigos"].includes(raw)) return "enemy";
    return "neutral";
  }

  function isActiveTarget(unit = {}) {
    if (!unit || typeof unit !== "object") return false;
    if (unit.dead === true || unit.defeated === true || unit.isDead === true || unit.removed === true || unit.escaped === true || unit.annihilated === true) return false;
    const hp = [unit.hp, unit.currentHp, unit.currentHP, unit.mechanics?.hp].map(finite).find((value) => value != null);
    return hp == null || hp > 0;
  }

  function activeAllyIdentities(units = []) {
    return (Array.isArray(units) ? units : [])
      .filter((unit) => sideOf(unit) === "ally" && isActiveTarget(unit))
      .map((unit) => ({ id: unitIdOf(unit) }))
      .filter((unit) => unit.id);
  }

  function roundSpeedByUnitId(units = []) {
    const result = {};
    for (const unit of Array.isArray(units) ? units : []) {
      if (sideOf(unit) !== "enemy") continue;
      const id = unitIdOf(unit);
      if (!id) continue;
      const value = [unit.resolvedSpeed, unit.currentSpeed, unit.speedRoll, unit.speedValue, unit.speed]
        .map(finite)
        .find((candidate) => candidate != null);
      if (value != null) result[id] = value;
    }
    return result;
  }

  function canonicalUnitIdForCombatant(unit = {}) {
    const actorRef = unit.actorRef && typeof unit.actorRef === "object" ? unit.actorRef : null;
    if (normalizeId(actorRef?.scope) === "units" && clean(actorRef?.id)) return normalizeId(actorRef.id);
    return normalizeId(
      unit.canonicalUnitId
      ?? unit.definitionId
      ?? unit.catalogId
      ?? unit.baseUnitId
      ?? unit.actionSlotProfileId
      ?? unit.actionEconomy?.profileId
      ?? unit.metadata?.canonicalUnitId
      ?? unit.metadata?.definitionId
      ?? unit.metadata?.catalogId
      ?? unit.metadata?.actionEconomyProfileId
    );
  }

  function unitCatalogForId(canonicalId) {
    const id = normalizeId(canonicalId);
    const catalogs = [global.LuminousKoboldUnitCatalog, global.LuminousGoblinUnitCatalog].filter(Boolean);
    return catalogs.find((catalog) => {
      try { return Boolean(catalog?.get?.(id)); } catch (_) { return false; }
    }) || null;
  }

  function runtimeLevelFor(unit = {}, definition = {}) {
    const candidates = [
      unit.runtimeLevel,
      unit.baseLevelSelected,
      unit.baseLevel,
      unit.level,
      unit.mechanics?.runtimeLevel,
      unit.mechanics?.baseLevel,
      unit.mechanics?.level,
    ];
    const found = candidates.map(finite).find((value) => value != null && value >= 1);
    if (found != null) return Math.max(1, Math.trunc(found));
    const natural = finite(definition.naturalWorldLevel?.min ?? definition.baseLevel?.min);
    return Math.max(1, Math.trunc(natural ?? 1));
  }

  function runtimeRankFor(unit = {}, definition = {}) {
    const explicit = clean(unit.rank ?? unit.unitRank ?? unit.mechanics?.rank ?? unit.metadata?.unitRank);
    if (explicit) return explicit;
    return clean(Array.isArray(definition.allowedRanks) ? definition.allowedRanks[0] : "normal", "normal");
  }

  function mergePlanningDefinition(unit, resolved, canonicalId) {
    if (!unit || !resolved) return;
    if (!unit.canonicalUnitId) unit.canonicalUnitId = canonicalId;
    unit.metadata = {
      ...(resolved.metadata && typeof resolved.metadata === "object" ? clone(resolved.metadata) : {}),
      ...(unit.metadata && typeof unit.metadata === "object" ? unit.metadata : {}),
      canonicalUnitId: canonicalId,
    };
    if (!unit.scores && resolved.scores) unit.scores = clone(resolved.scores);
    if (!unit.abilityScores && resolved.abilityScores) unit.abilityScores = clone(resolved.abilityScores);
    if (!Array.isArray(unit.resolvedSkills) && Array.isArray(resolved.resolvedSkills)) unit.resolvedSkills = clone(resolved.resolvedSkills);
    if (!Array.isArray(unit.resolvedSpells) && Array.isArray(resolved.resolvedSpells)) unit.resolvedSpells = clone(resolved.resolvedSpells);
    if (!Array.isArray(unit.traits) && Array.isArray(resolved.traits)) unit.traits = clone(resolved.traits);
    if (!Array.isArray(unit.traitIds) && Array.isArray(resolved.traitIds)) unit.traitIds = clone(resolved.traitIds);
    if (!Array.isArray(unit.action_slots) && Array.isArray(resolved.action_slots)) unit.action_slots = clone(resolved.action_slots);
    unit.mechanics = {
      ...(resolved.mechanics && typeof resolved.mechanics === "object" ? clone(resolved.mechanics) : {}),
      ...(unit.mechanics && typeof unit.mechanics === "object" ? unit.mechanics : {}),
    };
  }

  function hydrateEnemyCombatant(unit = {}) {
    if (sideOf(unit) !== "enemy" || !isActiveTarget(unit)) return { hydrated: false, reason: "not_active_enemy", unitId: unitIdOf(unit) || null };
    const unitId = unitIdOf(unit);
    const canonicalId = canonicalUnitIdForCombatant(unit);
    if (!canonicalId) return { hydrated: false, reason: "canonical_unit_reference_missing", unitId };

    const catalog = unitCatalogForId(canonicalId);
    if (!catalog?.resolve) {
      const profileResult = profileCatalog()?.applyToUnit?.(unit, canonicalId) || null;
      return {
        hydrated: false,
        reason: "canonical_unit_catalog_unavailable",
        unitId,
        canonicalUnitId: canonicalId,
        profileApplied: profileResult?.applied === true,
      };
    }

    let definition = null;
    let resolved = null;
    try {
      definition = catalog.get(canonicalId);
      resolved = catalog.resolve(canonicalId, {
        level: runtimeLevelFor(unit, definition || {}),
        rank: runtimeRankFor(unit, definition || {}),
        initializeEncounter: false,
      });
    } catch (error) {
      return { hydrated: false, reason: "canonical_unit_resolution_failed", unitId, canonicalUnitId: canonicalId, error: clean(error?.message || error) };
    }

    mergePlanningDefinition(unit, resolved, canonicalId);
    const profileResult = profileCatalog()?.applyToUnit?.(unit, canonicalId) || null;
    return {
      hydrated: true,
      unitId,
      canonicalUnitId: canonicalId,
      profileApplied: profileResult?.applied === true,
      resolvedSkillCount: Array.isArray(unit.resolvedSkills) ? unit.resolvedSkills.length : 0,
    };
  }

  function hydrateEnemiesForPlanning(units = []) {
    const results = [];
    for (const unit of Array.isArray(units) ? units : []) {
      if (sideOf(unit) !== "enemy" || !isActiveTarget(unit)) continue;
      results.push(hydrateEnemyCombatant(unit));
    }
    return results;
  }

  function ensureCanonicalEnemyProfiles(units = []) {
    const catalog = profileCatalog();
    if (!catalog?.applyToUnit) return [];
    const applied = [];
    for (const unit of Array.isArray(units) ? units : []) {
      if (sideOf(unit) !== "enemy" || !isActiveTarget(unit)) continue;
      if (unit.actionEconomy?.minSlots != null && unit.actionEconomy?.maxSlots != null) continue;
      const canonicalId = canonicalUnitIdForCombatant(unit);
      const profile = catalog.get?.(canonicalId || unit);
      if (!profile) continue;
      const result = catalog.applyToUnit(unit, profile.id);
      if (result?.applied) applied.push({ unitId: unitIdOf(unit), profileId: profile.id });
    }
    return applied;
  }

  function firstSlotIdForUnit(unit = {}) {
    const id = unitIdOf(unit);
    if (!id) return null;
    if (Array.isArray(unit.slots) && unit.slots[0]?.id) return clean(unit.slots[0].id);
    return `${id}_slot_0`;
  }

  function targetSlotForAction(action = {}, units = []) {
    const targetId = clean(action.targeting?.mainTargetId || action.targetId);
    if (!targetId) return null;
    const target = (Array.isArray(units) ? units : []).find((unit) => unitIdOf(unit) === targetId);
    return target ? firstSlotIdForUnit(target) : `${targetId}_slot_0`;
  }

  function isDefenseAction(action = {}) {
    const definition = action.metadata?.sourceDefinition || {};
    const subtype = normalizeId(action.metadata?.defenseSubtype || definition.defenseSubtype || definition.defense_subtype);
    const type = normalizeId(definition.type || definition.actionType || definition.action_type);
    return definition.isDefense === true || type === "defense" || ["guard", "evade", "counter", "clashable_guard", "clashable_counter"].includes(subtype);
  }

  function defenseViewerPlan(action = {}) {
    const definition = clone(action.metadata?.sourceDefinition || {});
    definition.id = definition.id || action.source?.id || "defense";
    return {
      type: "defense",
      kind: "defense",
      sourceId: definition.id,
      data: definition,
      metadata: {
        individualGoap: true,
        aiGoal: action.metadata?.aiGoal || null,
        bridge: "battle-viewer-enemy-planning-074",
      },
    };
  }

  function planExistingPlanningPhase(options = {}) {
    const units = Array.isArray(options.units) ? options.units : Object.values(options.combatData || combatDataRef()).filter(Boolean);
    const slotAllocator = allocator();
    const adapter = kitAdapter();
    const actionEconomy = economy();
    if (!slotAllocator?.allocateEnemySlots) return { planned: false, reason: "enemy_action_slot_allocator_unavailable", allocation: null, plans: [] };
    if (!adapter?.planUnitTurn) return { planned: false, reason: "unit_ai_kit_adapter_unavailable", allocation: null, plans: [] };

    const hydration = hydrateEnemiesForPlanning(units);
    const profileApplications = ensureCanonicalEnemyProfiles(units);
    const speeds = options.speedByUnitId || roundSpeedByUnitId(units);
    const allocation = slotAllocator.allocateEnemySlots(units, {
      ...(options.allocationOptions || {}),
      roundId: options.roundId ?? null,
      speedByUnitId: speeds,
      apply: true,
    });
    if (!allocation.allocated) return { planned: false, reason: allocation.reason, allocation, plans: [], hydration, profileApplications };

    const unitById = new Map(units.map((unit) => [unitIdOf(unit), unit]).filter(([id]) => id));
    const targets = Array.isArray(options.targets) ? options.targets : activeAllyIdentities(units);
    const targetIds = Array.isArray(options.targetIds) ? options.targetIds.map(clean).filter(Boolean) : targets.map((target) => unitIdOf(target)).filter(Boolean);
    const plans = [];
    const alliedCommittedActions = [];

    for (const row of allocation.rows) {
      const actor = unitById.get(row.unitId);
      if (!actor) continue;
      const economyState = actionEconomy?.ensureState?.(actor) || null;
      const planningPhaseReady = !economyState || economyState.phase === "planning";
      if (!planningPhaseReady) {
        plans.push({ unitId: row.unitId, slots: row.slots, slotIds: row.slotIds.slice(), plan: { planned: false, reason: "viewer_not_in_planning_phase", actions: [], sequence: [] } });
        continue;
      }

      if (!targetIds.length) {
        plans.push({ unitId: row.unitId, slots: row.slots, slotIds: row.slotIds.slice(), plan: { planned: false, reason: "no_active_player_targets", actorId: row.unitId, actions: [], sequence: [] } });
        continue;
      }

      const intel = options.intelByUnitId?.[row.unitId] || state.intelByUnitId[row.unitId] || {};
      const plan = adapter.planUnitTurn({
        ...(options.planOptions || {}),
        actor,
        slotIds: row.slotIds.slice(),
        availableSlots: row.slots,
        targets: targets.length ? targets : undefined,
        targetIds: targets.length ? undefined : targetIds,
        alliedCommittedActions: alliedCommittedActions.slice(),
        intel,
      });
      plans.push({
        unitId: row.unitId,
        slots: row.slots,
        slotIds: row.slotIds.slice(),
        plannedActions: Array.isArray(plan?.actions) ? plan.actions.length : 0,
        unusedSlots: Math.max(0, row.slots - (Array.isArray(plan?.actions) ? plan.actions.length : 0)),
        plan,
      });
      if (Array.isArray(plan?.actions)) alliedCommittedActions.push(...plan.actions);
    }

    return {
      planned: true,
      reason: null,
      allocation,
      plans,
      targets: targetIds,
      speedByUnitId: { ...speeds },
      hydration,
      profileApplications,
    };
  }

  function slotMarkup(slotId, faction = "enemy") {
    return `<div class="action-slot-wrapper" id="${slotId}" data-faction="${faction}"><svg class="action-slot-svg" viewBox="0 0 100 100"><polygon class="slot-heptagon-bg" points="50,95 15,78 6,40 30,9 70,9 94,40 85,78" /><line class="slot-center-line" x1="25" y1="50" x2="75" y2="50" /></svg></div>`;
  }

  function escapeCss(value) {
    return global.CSS?.escape ? global.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function renderEnemySlots(unit = {}) {
    if (!global.document) return false;
    const id = unitIdOf(unit);
    if (!id) return false;
    const panel = global.document.querySelector?.(`#ui-panel-${escapeCss(id)} .action-slots`);
    if (!panel) return false;
    const ids = allocator()?.slotIdsFor?.(unit) || [];
    panel.innerHTML = ids.map((slotId) => slotMarkup(slotId, "enemy")).join("");
    return true;
  }

  function clearPreviousAiVectors(vectors) {
    for (const slotId of state.appliedVectorSlots) {
      if (vectors?.[slotId]?.__luminousEnemyGoap074 === true) delete vectors[slotId];
    }
    state.appliedVectorSlots = new Set();
  }

  function pruneStaleEnemySlotTargets(slotTargets, allocation) {
    if (!slotTargets || typeof slotTargets !== "object" || !allocation?.rows) return [];
    const validByUnit = new Map(allocation.rows.map((row) => [row.unitId, new Set(row.slotIds || [])]));
    const removed = [];
    for (const slotId of Object.keys(slotTargets)) {
      const marker = "_slot_";
      const splitAt = slotId.lastIndexOf(marker);
      if (splitAt < 0) continue;
      const unitId = slotId.slice(0, splitAt);
      const valid = validByUnit.get(unitId);
      if (!valid || valid.has(slotId)) continue;
      delete slotTargets[slotId];
      removed.push(slotId);
    }
    return removed;
  }

  function applyPlanningToViewer(result = {}, options = {}) {
    const units = Array.isArray(options.units) ? options.units : Object.values(options.combatData || combatDataRef()).filter(Boolean);
    const unitById = new Map(units.map((unit) => [unitIdOf(unit), unit]).filter(([id]) => id));
    const vectors = options.attackVectors || attackVectorsRef();
    const slotTargets = options.slotTargets || slotTargetsRef();
    if (!vectors || typeof vectors !== "object") return { applied: false, reason: "viewer_attack_vectors_unavailable", result };

    clearPreviousAiVectors(vectors);
    const staleSlotTargetsRemoved = pruneStaleEnemySlotTargets(slotTargets, result.allocation);
    const entriesApplied = [];
    const deferred = [];

    for (const row of result.allocation?.rows || []) {
      const unit = unitById.get(row.unitId);
      if (unit) {
        if (typeof options.renderSlots === "function") options.renderSlots(unit, row);
        else renderEnemySlots(unit);
      }
    }

    for (const entry of result.plans || []) {
      const actor = unitById.get(entry.unitId);
      const actions = Array.isArray(entry.plan?.actions) ? entry.plan.actions : [];
      const actorDeferred = [];
      for (const action of actions) {
        const slotId = clean(action.actionSlotId);
        if (!slotId) continue;
        if (action.phase?.executesAt && action.phase.executesAt !== "combat_phase") {
          actorDeferred.push(action);
          deferred.push({ unitId: entry.unitId, slotId, action });
          continue;
        }

        const targetSlotId = targetSlotForAction(action, units);
        if (isDefenseAction(action)) {
          vectors[slotId] = {
            target: null,
            plan: defenseViewerPlan(action),
            __luminousEnemyGoap074: true,
            aiGoal: action.metadata?.aiGoal || null,
          };
        } else {
          vectors[slotId] = {
            target: targetSlotId,
            combatAction: action,
            __luminousEnemyGoap074: true,
            aiGoal: action.metadata?.aiGoal || null,
          };
        }
        state.appliedVectorSlots.add(slotId);
        entriesApplied.push({ unitId: entry.unitId, slotId, targetSlotId, defense: isDefenseAction(action), sourceId: action.source?.id || null });
      }
      if (actor) {
        try {
          Object.defineProperty(actor, "__luminousEnemyDeferredActions074", { value: actorDeferred, writable: true, configurable: true, enumerable: false });
        } catch (_) {
          actor.__luminousEnemyDeferredActions074 = actorDeferred;
        }
      }
    }

    const appliedResult = { applied: true, result, entriesApplied, deferred, staleSlotTargetsRemoved };
    state.lastResult = appliedResult;
    try {
      global.dispatchEvent?.(new global.CustomEvent("luminous:enemy-planning-ready", { detail: { allocation: clone(result.allocation), applied: clone(entriesApplied), deferredCount: deferred.length } }));
    } catch (_) {}
    return appliedResult;
  }

  function runViewerPlanning(options = {}) {
    const units = Array.isArray(options.units) ? options.units : Object.values(combatDataRef()).filter(Boolean);
    const result = planExistingPlanningPhase({ ...options, units });
    if (!result.planned) {
      state.lastResult = { applied: false, result };
      return state.lastResult;
    }
    return applyPlanningToViewer(result, { ...options, units });
  }

  function reaffirmCanonicalTimelineAuthority() {
    const timeline = global.LuminousBattleViewerRuntime073?.executeCombatTimeline
      || global.LuminousBattleViewerTimeline073?.executeCombatTimeline;
    if (typeof timeline !== "function") return false;
    global.executeCombatTimeline = timeline;
    try { delete global.__luminousLegacyExecuteCombatTimeline; }
    catch (_) { global.__luminousLegacyExecuteCombatTimeline = undefined; }
    global.__luminousCombatTimelineAuthority = "v0.7.3-combat-action-runtime";
    return true;
  }

  function installPhaseHook() {
    const current = viewerFunction("syncCombatEnginePhase");
    if (!current) return false;
    if (current.__luminousEnemyPlanning074Wrapped === true) {
      reaffirmCanonicalTimelineAuthority();
      state.installed = true;
      return true;
    }

    state.originalSyncCombatEnginePhase = current;
    const wrapped = function (rawState, ...rest) {
      const result = current.call(this, rawState, ...rest);
      reaffirmCanonicalTimelineAuthority();
      const normalized = clean(rawState).toUpperCase();
      if (normalized === "PRE_COMBAT_PLANNING") {
        try { runViewerPlanning(); }
        catch (error) { global.console?.error?.("[EnemyPlanning074] Planning bridge failed", error); }
      }
      return result;
    };
    Object.defineProperty(wrapped, "__luminousEnemyPlanning074Wrapped", { value: true });
    global.syncCombatEnginePhase = wrapped;
    reaffirmCanonicalTimelineAuthority();
    state.installed = true;

    const currentPhase = clean(global.LuminousCombatPhaseState).toUpperCase();
    if (currentPhase === "PRE_COMBAT_PLANNING") {
      try { runViewerPlanning(); } catch (_) {}
    }
    return true;
  }

  function loadScript(id, src, globalName) {
    if (global[globalName]) return Promise.resolve(global[globalName]);
    if (!global.document) return Promise.resolve(null);
    let script = global.document.getElementById(id);
    if (!script) {
      script = global.document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      global.document.head?.appendChild(script);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(global[globalName] || null);
      };
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", finish, { once: true });
      if (global[globalName]) finish();
    });
  }

  async function ensureDependencies() {
    if (!global.LuminousBattleViewerRuntime073) {
      await loadScript("battle-viewer-runtime-073-script", "js/battle-viewer-runtime-073.js", "LuminousBattleViewerRuntime073");
      try { await global.LuminousBattleViewerRuntime073Ready; } catch (_) {}
    }
    if (!global.LuminousUniversalRangedAmmoRuntime) await loadScript("universal-ranged-ammo-runtime-script", "js/universal-ranged-ammo-runtime.js", "LuminousUniversalRangedAmmoRuntime");
    if (!global.LuminousUnitRankRuntime) await loadScript("unit-rank-runtime-script", "js/unit-rank-runtime.js", "LuminousUnitRankRuntime");
    if (!global.LuminousKoboldTier1SkillCatalog) await loadScript("kobold-tier1-skill-catalog-script", "js/skill-catalog-kobold-tier1.js", "LuminousKoboldTier1SkillCatalog");
    if (!global.LuminousUnitCombatMechanics) await loadScript("unit-combat-mechanics-runtime-script", "js/unit-combat-mechanics-runtime.js", "LuminousUnitCombatMechanics");
    if (!global.LuminousKoboldUnitCatalog) await loadScript("kobold-unit-catalog-script", "js/unit-catalog-kobold-tier1.js", "LuminousKoboldUnitCatalog");
    if (!global.LuminousGoblinUnitCatalog) await loadScript("goblin-unit-catalog-script", "js/unit-catalog-goblin.js", "LuminousGoblinUnitCatalog");
    if (!global.LuminousUnitActionEconomyCatalog) await loadScript("unit-action-economy-catalog-script", "js/unit-action-economy-catalog.js", "LuminousUnitActionEconomyCatalog");
    if (!global.LuminousIndividualGoapCombatAI) await loadScript("individual-goap-combat-ai-script", "js/individual-goap-combat-ai.js", "LuminousIndividualGoapCombatAI");
    if (!global.LuminousUnitAiKitAdapter) await loadScript("unit-ai-kit-adapter-script", "js/unit-ai-kit-adapter.js", "LuminousUnitAiKitAdapter");
    if (!global.LuminousUnitAiUniversalActions) await loadScript("unit-ai-universal-actions-script", "js/unit-ai-universal-actions.js", "LuminousUnitAiUniversalActions");
    if (!global.LuminousEnemyActionSlotAllocator) await loadScript("enemy-action-slot-allocator-script", "js/enemy-action-slot-allocator.js", "LuminousEnemyActionSlotAllocator");
    return Boolean(allocator()?.allocateEnemySlots && kitAdapter()?.planUnitTurn && global.LuminousUnitAiUniversalActions && global.LuminousBattleViewerRuntime073);
  }

  function waitForPhaseHook() {
    if (installPhaseHook()) return Promise.resolve(true);
    if (typeof global.setInterval !== "function") return Promise.resolve(false);
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = global.setInterval(() => {
        if (installPhaseHook()) {
          global.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started >= BOOTSTRAP_TIMEOUT_MS) {
          global.clearInterval(timer);
          resolve(false);
        }
      }, BOOTSTRAP_INTERVAL_MS);
      timer?.unref?.();
    });
  }

  async function install() {
    const ready = await ensureDependencies();
    if (!ready && global.document) return { installed: false, reason: "enemy_planning_dependencies_unavailable" };
    const hooked = await waitForPhaseHook();
    return { installed: hooked, reason: hooked ? null : "viewer_phase_hook_unavailable" };
  }

  const api = Object.freeze({
    version: VERSION,
    state,
    sideOf,
    isActiveTarget,
    activeAllyIdentities,
    roundSpeedByUnitId,
    canonicalUnitIdForCombatant,
    hydrateEnemyCombatant,
    hydrateEnemiesForPlanning,
    ensureCanonicalEnemyProfiles,
    isDefenseAction,
    defenseViewerPlan,
    planExistingPlanningPhase,
    applyPlanningToViewer,
    runViewerPlanning,
    renderEnemySlots,
    reaffirmCanonicalTimelineAuthority,
    installPhaseHook,
    ensureDependencies,
    install,
  });

  global.LuminousBattleViewerEnemyPlanning074 = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (global.document) {
    global.LuminousBattleViewerEnemyPlanning074Ready = install();
  }
})(typeof window !== "undefined" ? window : globalThis);
