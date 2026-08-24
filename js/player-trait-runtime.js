(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerTraitRuntime) return;

  const DEFINITIONS_ROOT = "campaña/config/traits/definitions";
  const GRANTS_ROOT = "campaña/config/traits/grants";
  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
  const SHARED_PLANNED_ACTIONS_ROOT = "campaña/combate/plannedActions";
  const DM_MANAGED_EFFECTS_ROOT = "campaña/efectos_dm";
  const COMBAT_EVENT_MAP = Object.freeze({
    "[Before Use]": { trigger: "before_skill", timing: "before" },
    "[Before Attack]": { trigger: "before_attack", timing: "before" },
    "[Before Clash]": { trigger: "before_clash", timing: "before" },
    "[On Hit]": { trigger: "on_hit", timing: "after" },
    "[On Crit]": { trigger: "on_crit", timing: "after" },
    "[On Kill]": { trigger: "on_kill", timing: "after" },
    "[On Clash Win]": { trigger: "clash_win", timing: "after" },
    "[On Clash Lose]": { trigger: "clash_lose", timing: "after" },
    "[On Evade]": { trigger: "on_evade", timing: "after" },
    "[Attack End]": { trigger: "attack_end", timing: "after" },
  });

  const state = {
    db: null,
    definitions: {},
    grants: {},
    character: null,
    playerId: null,
    playerRef: null,
    playerListener: null,
    definitionsBound: false,
    grantsBound: false,
    traitState: null,
    tray: null,
    host: null,
    dependencyPromise: null,
    theatreBridgeBound: false,
    theatreRollsSource: null,
    theatreArmedCheck: null,
    lastCompletedCheck: null,
    theatreTarget: null,
    combatEngineSource: null,
    dmEffects: {},
    dmEffectsBound: false,
    sharedActions: {},
    sharedActionsBound: false,
    seenSharedActionResolutions: new Set(),
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = doc.getElementById(id);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (ready?.()) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      doc.head?.appendChild(script);
    });
  }

  function ensureDependencies() {
    if (state.dependencyPromise) return state.dependencyPromise;
    state.dependencyPromise = Promise.resolve()
      .then(() => ensureScript("trait-engine-script", "js/trait-engine.js", () => Boolean(global.LuminousTraitEngine)))
      .then(() => Promise.all([
        ensureScript("trait-catalog-core-script", "js/trait-catalog-core.js", () => Boolean(global.LuminousTraitCatalogCore)),
        ensureScript("racial-trait-catalog-script", "js/racial-trait-catalog.js", () => Boolean(global.LuminousRacialTraitCatalog)),
        ensureScript("class-milestone-engine-script", "js/class-milestone-engine.js", () => Boolean(global.LuminousClassMilestones)),
        ensureScript("trait-player-tray-script", "js/trait-player-tray.js", () => Boolean(global.LuminousTraitPlayerTray)),
        ensureScript("universal-action-economy-script", "js/universal-action-economy.js", () => Boolean(global.LuminousActionEconomy)),
      ]));
    return state.dependencyPromise;
  }

  function normalizeCharacterForGrantResolution(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const resolved = { ...(character || {}) };
    if (Array.isArray(build.classes)) resolved.classes = build.classes;
    if (Object.prototype.hasOwnProperty.call(build, "raceId")) resolved.raceId = build.raceId;
    if (Object.prototype.hasOwnProperty.call(build, "raceSubtypeId")) resolved.raceSubtypeId = build.raceSubtypeId;
    if (Object.prototype.hasOwnProperty.call(build, "backgroundId")) resolved.backgroundId = build.backgroundId;
    if (Object.prototype.hasOwnProperty.call(build, "calculatedAtLevel")) resolved.level = build.calculatedAtLevel;
    if (Array.isArray(build.lineages)) resolved.lineages = build.lineages;
    if (Object.prototype.hasOwnProperty.call(build, "lineageId")) resolved.lineageId = build.lineageId;
    return resolved;
  }

  function getCharacter() {
    return state.character || global.datosJugador || {};
  }

  function mergedDefinitions() {
    const core = global.LuminousTraitCatalogCore?.allDefinitions?.() || {};
    const racial = global.LuminousRacialTraitCatalog?.allDefinitions?.() || {};
    return { ...core, ...racial, ...(state.definitions || {}) };
  }

  function mergedGrants() {
    const core = global.LuminousTraitCatalogCore?.allGrants?.() || [];
    return [...core, ...Object.values(state.grants || {})];
  }

  function mergeTraitLists(granted = [], selected = []) {
    const traitEngine = global.LuminousTraitEngine;
    const byId = new Map();
    [...granted, ...selected].forEach((definition) => {
      if (!definition) return;
      const trait = traitEngine?.normalizeTrait ? traitEngine.normalizeTrait(definition) : definition;
      const id = normalizeId(trait?.id || trait?.name);
      if (!id || byId.has(id)) return;
      byId.set(id, trait);
    });
    return [...byId.values()];
  }

  function resolveTraits() {
    const traitEngine = global.LuminousTraitEngine;
    const racialCatalog = global.LuminousRacialTraitCatalog;
    const milestones = global.LuminousClassMilestones;
    if (!traitEngine?.resolveTraitGrants || !milestones?.resolveSelectedGeneralTraits) return [];
    const character = getCharacter();
    const normalizedCharacter = normalizeCharacterForGrantResolution(character);
    const definitions = mergedDefinitions();
    const granted = traitEngine.resolveTraitGrants(
      normalizedCharacter,
      mergedGrants(),
      definitions,
    );
    const racialGranted = racialCatalog?.resolveTraitGrants?.(normalizedCharacter, definitions) || [];
    const selected = milestones.resolveSelectedGeneralTraits(character, definitions);
    return mergeTraitLists([...granted, ...racialGranted], selected);
  }

  function inferContext() {
    const explicit = normalizeId(global.LuminousGameContext || doc.body?.dataset?.traitContext);
    if (["combat", "theatre", "any"].includes(explicit)) return explicit;
    const combat = doc.querySelector("[data-combat-active='true'], .combat-active, #combat-view:not([hidden]), #combat-modal[open]");
    if (combat) return "combat";
    const theatre = doc.querySelector("#theatre-view-player:not([hidden]), #theatre-stage:not([hidden])");
    if (theatre) return "theatre";
    return "any";
  }

  function getRuntime(overrides = {}) {
    const character = getCharacter();
    const input = overrides || {};
    const context = normalizeId(input.context || inferContext()) || "any";
    const self = Object.prototype.hasOwnProperty.call(input, "self")
      ? input.self
      : (context === "combat" ? currentCombatUnit() : character);
    const level = Number(input.Level ?? input.level ?? character?.level ?? character?.characterBuild?.calculatedAtLevel ?? 0) || 0;
    const completed = context === "theatre" ? state.lastCompletedCheck : null;
    const check = Object.prototype.hasOwnProperty.call(input, "check") ? input.check : completed?.check;
    const target = Object.prototype.hasOwnProperty.call(input, "target") ? input.target : (completed?.target || state.theatreTarget || null);
    const standard = global.LuminousTraitStandardizationRuntime;
    const allies = context === "combat" && standard?.liveCombatUnits ? standard.liveCombatUnits({ self }).filter((unit) => unit !== self && Number(unit?.hp ?? 1) > 0 && String(unit?.faction ?? "") === String(self?.faction ?? "")) : [];
    const actionEconomy = context === "combat"
      ? (input.actionEconomy || global.LuminousActionEconomy?.runtimeFor?.(self, { phase: input.phase || global.CombatEngine?.currentState }))
      : input.actionEconomy;
    const runtime = { context, character, self, level, check, target, actionEconomy, AliveAllies: input.AliveAllies ?? completed?.AliveAllies ?? allies.length, ...input };
    if (context === "theatre") runtime.registerDmEffect = (descriptor) => registerDmManagedEffect(descriptor, runtime);
    return runtime;
  }


  function prepareTraitRuntime({ trait, runtime } = {}) {
    const resolved = getRuntime(runtime || {});
    const targetSpec = normalizeId(trait?.activation?.target || "");
    if (resolved.context !== "combat" || !targetSpec) return { runtime: resolved };
    const standard = global.LuminousTraitStandardizationRuntime;
    if (!standard?.resolveTraitTargets) return { runtime: resolved };
    const targets = standard.resolveTraitTargets(resolved.self, targetSpec, resolved);
    if (targets.length) {
      resolved.targets = targets;
      resolved.target = targets[0];
      resolved.defender = resolved.defender || resolved.target;
      return { runtime: resolved };
    }
    if (["random_enemy", "enemy", "selected_enemy", "ally"].includes(targetSpec)) {
      return { available: false, blocked: true, reason: `No live ${targetSpec.replaceAll("_", " ")} target is available.` };
    }
    return { runtime: resolved };
  }

  function sharedUnitId(unit = {}) {
    return String(unit?.id || unit?.unitId || unit?.characterId || unit?.actorId || state.playerId || "").trim();
  }

  function persistScheduledAction(result, meta = {}) {
    if (!state.db || !result?.scheduled) return null;
    const runtime = result.runtime || meta.runtime || {};
    const unit = runtime.self || runtime.character || currentCombatUnit();
    const unitId = sharedUnitId(unit);
    const slotIndex = Number(result.slotIndex);
    if (!unitId || !Number.isInteger(slotIndex)) return null;
    const local = global.LuminousActionEconomy?.getPlannedAction?.(unit, slotIndex) || {};
    const trait = result.trait || meta.trait || null;
    const payload = {
      ...local,
      kind: "trait",
      traitId: trait?.id || local.traitId || null,
      sourceId: trait?.id || local.sourceId || null,
      unitId, slotIndex,
      slotId: result.slotId || `${unitId}_slot_${slotIndex}`,
      targetId: local.targetId || runtime.target?.id || runtime.defender?.id || null,
      data: { ...(local.data || {}), trait },
      scheduledBy: state.playerId || null,
      status: "planned",
      scheduledAt: global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
    };
    state.db.ref(`${SHARED_PLANNED_ACTIONS_ROOT}/${unitId}/${slotIndex}`).set(payload).catch((error) => console.error("No se pudo compartir el Action Slot planeado:", error));
    return payload;
  }

  function processSharedActionResolutions() {
    const playerId = String(state.playerId || "").trim();
    if (!playerId) return 0;
    let changed = 0;
    const unit = currentCombatUnit();
    Object.entries(state.sharedActions || {}).forEach(([unitId, slots]) => {
      Object.entries(slots || {}).forEach(([slotIndexRaw, action]) => {
        if (!action || action.status !== "resolved" || !action.traitId) return;
        if (String(action.scheduledBy || "") !== playerId) return;
        const resolutionKey = `${unitId}:${slotIndexRaw}:${action.resolvedAt || "resolved"}`;
        if (state.seenSharedActionResolutions.has(resolutionKey)) return;
        state.seenSharedActionResolutions.add(resolutionKey);

        const trait = resolveTraits().find((entry) => normalizeId(entry?.id || entry?.name) === normalizeId(action.traitId));
        if (trait?.activation?.uses) {
          if (!state.traitState) state.traitState = global.LuminousTraitEngine?.createState?.() || { usages: {} };
          if (!state.traitState.usages) state.traitState.usages = {};
          const traitId = normalizeId(trait.id || trait.name);
          const record = state.traitState.usages[traitId] || (state.traitState.usages[traitId] = {
            used: 0,
            reset: normalizeId(trait.activation.uses.reset || "never"),
          });
          record.used = Math.max(0, Number(record.used || 0)) + 1;
          changed += 1;
        }

        if (unit && sharedUnitId(unit) === String(unitId)) {
          const slotIndex = Number(slotIndexRaw);
          if (Number.isInteger(slotIndex)) global.LuminousActionEconomy?.cancelAction?.(unit, slotIndex);
        }
      });
    });
    if (changed) refresh();
    return changed;
  }

  function targetMatchesDmEffect(target, effect = {}) {
    if (!target) return !effect?.check?.targetScoped;
    const ids = new Set(identityValues(target));
    const effectId = String(effect.targetId || "").trim();
    if (effectId && ids.has(effectId)) return true;
    return Boolean(entityName(target) && normalizeId(effect.targetName || "") && entityName(target) === normalizeId(effect.targetName || ""));
  }

  function registerDmManagedEffect(descriptor = {}, runtime = {}) {
    if (!state.db) return null;
    const ref = state.db.ref(DM_MANAGED_EFFECTS_ROOT).push();
    const now = Date.now();
    const hours = Math.max(0, Number(descriptor.durationHours ?? 1) || 0);
    const target = runtime.target || runtime.defender || null;
    const character = runtime.character || getCharacter();
    const record = { id: ref.key, effectId: descriptor.effectId || descriptor.sourceTraitId || "dm_effect", name: descriptor.name || "DM Managed Effect", sourceTraitId: descriptor.sourceTraitId || null, subjectPlayerId: state.playerId || null, subjectName: character?.characterName || character?.nombre || character?.name || state.playerId || "Player", targetId: descriptor.targetId || target?.id || target?.actorId || target?.characterId || null, targetName: descriptor.targetName || target?.name || target?.nombre || target?.characterName || "Target", check: { ...(descriptor.check || {}) }, modifier: { ...(descriptor.modifier || {}) }, note: descriptor.note || "", active: true, approved: false, startsAt: now, expiresAt: now + Math.round(hours * 3600000), durationHours: hours };
    ref.set(record).catch((error) => console.error("No se pudo registrar el efecto administrado por DM:", error));
    return record;
  }

  function applyApprovedDmEffects(check = {}, runtimeInput = {}) {
    const target = runtimeInput.target || state.theatreTarget || null;
    const abilityId = normalizeId(check.abilityId || check.statId || "");
    const now = Date.now();
    let bonus = 0;
    Object.values(state.dmEffects || {}).forEach((effect) => {
      if (!effect || effect.active === false || effect.approved !== true) return;
      if (Number(effect.expiresAt || 0) && Number(effect.expiresAt) <= now) return;
      if (effect.subjectPlayerId && state.playerId && String(effect.subjectPlayerId) !== String(state.playerId)) return;
      const requiredAbility = normalizeId(effect.check?.abilityId || "");
      if (requiredAbility && requiredAbility !== abilityId) return;
      if (!targetMatchesDmEffect(target, effect)) return;
      const modifier = effect.modifier || {};
      if (normalizeId(modifier.channel || "final_power") !== "final_power") return;
      bonus += Number(modifier.value || 0) || 0;
      if (state.db && effect.id) state.db.ref(`${DM_MANAGED_EFFECTS_ROOT}/${effect.id}`).update({ approved: false, lastConsumedAt: now }).catch(() => {});
    });
    if (bonus) check.finalPower = (Number(check.finalPower || 0) || 0) + bonus;
    return bonus;
  }

  function recalculateCompletedCheck(result) {
    const check = result?.runtime?.check;
    if (!check || !state.lastCompletedCheck) return null;
    const original = state.lastCompletedCheck.check || {};
    const previousFinalPower = Number(original.finalPower ?? 0) || 0;
    const previousTotal = Number(original.total ?? original.result ?? state.lastCompletedCheck.total ?? 0) || 0;
    const baseRollTotal = Number.isFinite(Number(state.lastCompletedCheck.baseRollTotal))
      ? Number(state.lastCompletedCheck.baseRollTotal)
      : previousTotal - previousFinalPower;
    const total = baseRollTotal + (Number(check.finalPower ?? 0) || 0);
    const rolls = global.LuminousTheatreRolls;
    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);
    const nextCheck = { ...original, ...check, total, result: total, outcome, passed: outcome === "passed", failed: outcome === "failed", recalculate: 0 };
    state.lastCompletedCheck = { ...state.lastCompletedCheck, check: nextCheck, total, baseRollTotal, outcome };
    const totalNode = doc.getElementById("roll-total-score");
    if (totalNode) {
      const safe = global.LuminousPlayerStats?.setRollTotalWithoutAdjustment?.(total, totalNode);
      if (!safe) totalNode.textContent = String(total);
    }
    emit("luminous:theatre-check-recalculated", state.lastCompletedCheck);
    return state.lastCompletedCheck;
  }

  function handleTraitActivated(result, meta = {}) {
    const runtime = result?.runtime || meta.runtime || getRuntime();
    if (result?.scheduled) {
      persistScheduledAction(result, meta);
      emit("luminous:trait-action-scheduled", result);
      emit("luminous:trait-activated", result);
      return;
    }
    global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.([meta.trait].filter(Boolean), "on_use", runtime, result);
    recalculateCompletedCheck(result);
    emit("luminous:trait-activated", result);
  }

  function executePlannedTraitAction(unit, slotIndex, context = {}) {
    const actionEconomy = global.LuminousActionEconomy;
    const traitEngine = global.LuminousTraitEngine;
    if (!actionEconomy?.getPlannedAction || !traitEngine?.activateTrait) return { handled: false, reason: "action_economy_unavailable" };
    const planned = actionEconomy.getPlannedAction(unit, slotIndex);
    if (!planned || planned.kind !== "trait" || !planned.traitId) return { handled: false, reason: "no_planned_trait" };
    const trait = resolveTraits().find((entry) => normalizeId(entry?.id || entry?.name) === normalizeId(planned.traitId));
    if (!trait) return { handled: false, reason: "planned_trait_missing", planned };
    const standard = global.LuminousTraitStandardizationRuntime;
    const units = standard?.liveCombatUnits?.({ self: unit }) || [];
    const target = planned.targetId
      ? units.find((candidate) => identityValues(candidate).includes(String(planned.targetId)) || String(candidate?.id || "") === String(planned.targetId)) || null
      : null;
    const taken = actionEconomy.takePlannedAction(unit, slotIndex, { phase: "combat" });
    if (!taken) return { handled: false, reason: "planned_action_not_in_combat_phase", planned };
    const runtime = getRuntime({
      context: "combat",
      self: unit,
      target,
      defender: target,
      executePlannedAction: true,
      actionEconomy: actionEconomy.runtimeFor(unit, { phase: "combat" }),
      ...(context || {}),
    });
    const result = traitEngine.activateTrait(trait, runtime, state.traitState || (state.traitState = traitEngine.createState()));
    if (result?.available) {
      global.LuminousTraitPlayerTray?.syncActivationStatuses?.(result, runtime);
      handleTraitActivated(result, { trait, runtime });
    }
    return { handled: true, planned: taken, result };
  }

  function recordCompletedTheatreCheck(detail = {}) {
    const check = { ...(detail.check || {}), passed: detail.outcome === "passed" || detail.check?.passed === true, failed: detail.outcome === "failed" || detail.check?.failed === true };
    state.lastCompletedCheck = { ...detail, check, target: detail.target || state.theatreTarget || null };
    dispatch("after_check", { context: "theatre", check, target: state.lastCompletedCheck.target });
    refresh();
    return state.lastCompletedCheck;
  }

  function setTheatreTarget(target) {
    state.theatreTarget = target || null;
    return state.theatreTarget;
  }

  function emit(name, detail) {
    if (typeof global.CustomEvent !== "function") return;
    global.dispatchEvent?.(new global.CustomEvent(name, { detail }));
  }

  function ensureHost() {
    if (state.host?.isConnected) return state.host;
    const statsContainer = doc.querySelector("#stats-modal #stats-container");
    if (!statsContainer) return null;
    let host = doc.getElementById("player-trait-runtime-host");
    if (!host) {
      host = doc.createElement("div");
      host.id = "player-trait-runtime-host";
      host.className = "player-trait-runtime-host";
      const abilityConsole = statsContainer.querySelector(":scope > .player-ability-console");
      if (abilityConsole?.nextSibling) statsContainer.insertBefore(host, abilityConsole.nextSibling);
      else statsContainer.appendChild(host);
    }
    state.host = host;
    return host;
  }

  function mountTray() {
    const host = ensureHost();
    const traitEngine = global.LuminousTraitEngine;
    const trayApi = global.LuminousTraitPlayerTray;
    if (!host || !traitEngine || !trayApi?.mount) return false;
    if (!state.traitState) state.traitState = traitEngine.createState();
    if (!state.tray) {
      state.tray = trayApi.mount({
        host,
        title: "TRAITS",
        state: state.traitState,
        getTraits: resolveTraits,
        getRuntime: () => getRuntime(),
        prepareRuntime: prepareTraitRuntime,
        onActivated: handleTraitActivated,
        onBlocked: (result) => emit("luminous:trait-blocked", result),
      });
    } else {
      state.tray.refresh?.();
    }
    return Boolean(state.tray);
  }

  function refresh() {
    mountTray();
    state.tray?.refresh?.();
    emit("luminous:traits-refreshed", { playerId: state.playerId, traits: resolveTraits() });
  }

  function bindPlayer() {
    if (!state.db) return false;
    const nextId = String(global.localStorage?.getItem?.(PLAYER_ID_STORAGE_KEY) || "").trim();
    if (!nextId) return false;
    if (nextId === state.playerId && state.playerRef) return true;

    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);
    state.playerId = nextId;
    state.character = global.datosJugador || null;
    state.traitState = global.LuminousTraitEngine?.createState?.() || null;
    state.playerRef = state.db.ref(`${PLAYER_ROOT}/${nextId}`);
    state.playerListener = (snapshot) => {
      state.character = snapshot.val() || global.datosJugador || null;
      refresh();
    };
    state.playerRef.on("value", state.playerListener);
    processSharedActionResolutions();
    return true;
  }

  function connectFirebase() {
    if (state.db) return true;
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    state.db = global.firebase.database();

    if (!state.definitionsBound) {
      state.definitionsBound = true;
      state.db.ref(DEFINITIONS_ROOT).on("value", (snapshot) => {
        state.definitions = snapshot.val() || {};
        refresh();
      });
    }
    if (!state.grantsBound) {
      state.grantsBound = true;
      state.db.ref(GRANTS_ROOT).on("value", (snapshot) => {
        state.grants = snapshot.val() || {};
        refresh();
      });
    }
    if (!state.dmEffectsBound) {
      state.dmEffectsBound = true;
      state.db.ref(DM_MANAGED_EFFECTS_ROOT).on("value", (snapshot) => { state.dmEffects = snapshot.val() || {}; });
    }
    if (!state.sharedActionsBound) {
      state.sharedActionsBound = true;
      state.db.ref(SHARED_PLANNED_ACTIONS_ROOT).on("value", (snapshot) => {
        state.sharedActions = snapshot.val() || {};
        processSharedActionResolutions();
      });
    }
    return true;
  }

  function dispatch(trigger, runtimeInput = {}) {
    const traitEngine = global.LuminousTraitEngine;
    if (!traitEngine?.dispatchTraits) return null;
    if (!state.traitState) state.traitState = traitEngine.createState();
    return traitEngine.dispatchTraits(resolveTraits(), trigger, getRuntime(runtimeInput), state.traitState);
  }

  function normalizeTheatreCheckInput(check = {}, runtimeInput = {}) {
    const merged = { ...(check || {}), ...(runtimeInput?.check || {}) };
    const threshold = finiteNumber(merged.thresholdRaw ?? merged.threshold);
    if (merged.difficulty == null && threshold != null) merged.difficulty = threshold;
    return merged;
  }

  function resolveTheatreCheck(check = {}, runtimeInput = {}) {
    const traitEngine = global.LuminousTraitEngine;
    if (!traitEngine?.resolveTheatreCheck) return null;
    if (!state.traitState) state.traitState = traitEngine.createState();
    const character = getCharacter();
    const preparedCheck = normalizeTheatreCheckInput(check, runtimeInput);
    applyApprovedDmEffects(preparedCheck, runtimeInput);
    const hadThreshold = finiteNumber(preparedCheck.thresholdRaw ?? preparedCheck.threshold) != null;
    const result = traitEngine.resolveTheatreCheck({
      character,
      traits: resolveTraits(),
      check: preparedCheck,
      state: state.traitState,
    });
    if (hadThreshold && finiteNumber(result?.check?.difficulty) != null) {
      result.check.thresholdRaw = Number(result.check.difficulty);
    }
    return result;
  }

  function dispatchCombatEvent(trigger, input = {}) {
    const traitEngine = global.LuminousTraitEngine;
    if (!traitEngine?.dispatchCombatEvent) return null;
    if (!state.traitState) state.traitState = traitEngine.createState();
    const runtime = getRuntime({ context: "combat", ...(input || {}) });
    const traits = resolveTraits();
    const result = traitEngine.dispatchCombatEvent(trigger, {
      ...runtime,
      traits,
      state: state.traitState,
    });
    global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.(traits, trigger, result?.runtime || runtime, result);
    return result;
  }

  function identityValues(entity = {}) {
    return [
      entity?.id,
      entity?.playerId,
      entity?.player_id,
      entity?.ownerPlayerId,
      entity?.owner_player_id,
      entity?.actorId,
      entity?.actor_id,
      entity?.characterId,
      entity?.character_id,
      entity?.uid,
      entity?.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity?.characterName || entity?.character_name || entity?.nombre || entity?.name || "");
  }

  function currentPlayerUnit(units = []) {
    const list = Array.isArray(units) ? units.filter(Boolean) : [];
    const character = getCharacter();
    const byReference = list.find((unit) => unit === character);
    if (byReference) return byReference;

    const characterIds = new Set([state.playerId, ...identityValues(character)].filter(Boolean).map(String));
    const byId = list.find((unit) => identityValues(unit).some((value) => characterIds.has(value)));
    if (byId) return byId;

    const name = entityName(character);
    if (name) {
      const matches = list.filter((unit) => entityName(unit) === name);
      if (matches.length === 1) return matches[0];
    }
    return null;
  }

  function currentCombatUnit() {
    let data = global.combatData && typeof global.combatData === "object" ? global.combatData : null;
    if (!data) {
      try {
        if (typeof global.eval === "function") data = global.eval("typeof combatData !== 'undefined' ? combatData : null");
      } catch (_) {}
    }
    const source = data && typeof data === "object" ? Object.values(data) : [];
    return currentPlayerUnit(source) || getCharacter();
  }

  function combatRuntimeInput(context = {}, targetsHit = []) {
    const attacker = context?.attacker || context?.unitAttacker || currentCombatUnit();
    return {
      context: "combat",
      self: attacker,
      attacker,
      target: context?.defender || context?.unitDefender || targetsHit?.[0] || null,
      defender: context?.defender || context?.unitDefender || targetsHit?.[0] || null,
      skill: context?.skill || null,
      targetsHit: targetsHit || context?.targetsHit || [],
      currentCoin: context?.currentCoin || null,
      damageDealt: context?.damageDealt,
    };
  }

  function installTheatreBridge() {
    const rolls = global.LuminousTheatreRolls;
    if (!rolls?.armCheck) return false;
    if (state.theatreRollsSource === rolls || rolls.__playerTraitRuntimeIntegrated) return true;

    const originalArmCheck = rolls.armCheck.bind(rolls);
    const wrapped = Object.freeze({
      ...rolls,
      __playerTraitRuntimeIntegrated: true,
      armCheck(check = {}) {
        state.theatreArmedCheck = { ...(check || {}) };
        return originalArmCheck(check);
      },
    });
    global.LuminousTheatreRolls = wrapped;
    state.theatreRollsSource = wrapped;

    if (!state.theatreBridgeBound) {
      state.theatreBridgeBound = true;
      doc.addEventListener("click", (event) => {
        const target = event.target?.closest?.(".player-dnd-roll");
        if (!target || !state.theatreArmedCheck) return;
        const panel = target.closest?.(".player-ability-console") || doc.querySelector("#stats-modal .player-ability-console");
        const enrichedCheck = {
          ...state.theatreArmedCheck,
          kind: target.dataset?.dndRoll || null,
          abilityId: panel?.dataset?.activeStat || null,
          skillId: target.dataset?.skillId || null,
        };
        const resolved = resolveTheatreCheck(enrichedCheck);
        if (!resolved?.check) return;
        originalArmCheck(resolved.check);
        state.theatreArmedCheck = null;
        emit("luminous:theatre-traits-applied", resolved);
      }, true);
    }
    return true;
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    if (!engine || engine.__playerTraitRuntimeIntegrated) return Boolean(engine);
    if (state.combatEngineSource === engine) return true;

    const originalEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;

    if (originalEncounterStart) {
      engine.triggerEncounterStart = function (...args) {
        const result = originalEncounterStart.apply(this, args);
        const unit = currentCombatUnit();
        global.LuminousActionEconomy?.beginCombat?.(unit);
        dispatchCombatEvent("encounter_start", { context: "combat", self: unit });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        const unit = currentPlayerUnit(allUnits || []);
        if (unit && phaseTag === "[Round Start]") {
          global.LuminousActionEconomy?.resetTurnResources?.(unit);
          dispatchCombatEvent("turn_start", { context: "combat", self: unit, units: allUnits });
        } else if (unit && phaseTag === "[Round End]") {
          dispatchCombatEvent("turn_end", { context: "combat", self: unit, units: allUnits });
        }
        return result;
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const mapping = COMBAT_EVENT_MAP[tag];
        const attacker = context?.attacker || context?.unitAttacker || null;
        const activeUnit = currentPlayerUnit(attacker ? [attacker] : []);
        const traitInput = activeUnit ? combatRuntimeInput(context, targetsHit) : null;
        if (mapping?.timing === "before" && traitInput) dispatchCombatEvent(mapping.trigger, traitInput);
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        if (mapping?.timing === "after" && traitInput) dispatchCombatEvent(mapping.trigger, traitInput);
        return result;
      };
    }

    Object.defineProperty(engine, "__playerTraitRuntimeIntegrated", { value: true, configurable: true });
    state.combatEngineSource = engine;
    return true;
  }

  function installLifecycleBridges() {
    installTheatreBridge();
    installCombatBridge();
  }

  function bootRuntime() {
    global.addEventListener?.("luminous:theatre-check-completed", (event) => recordCompletedTheatreCheck(event?.detail || {}));
    global.addEventListener?.("luminous:theatre-target-selected", (event) => setTheatreTarget(event?.detail?.target || event?.detail || null));
    connectFirebase();
    bindPlayer();
    refresh();
    installLifecycleBridges();
    global.setInterval(() => {
      if (!state.db) connectFirebase();
      bindPlayer();
      mountTray();
      installLifecycleBridges();
    }, 1000);
  }

  global.LuminousPlayerTraitRuntime = Object.freeze({
    getCharacter,
    getTraits: resolveTraits,
    getRuntime,
    dispatch,
    resolveTheatreCheck,
    dispatchCombatEvent,
    prepareTraitRuntime,
    executePlannedTraitAction,
    recordCompletedTheatreCheck,
    setTheatreTarget,
    getLastCompletedCheck: () => state.lastCompletedCheck,
    installTheatreBridge,
    installCombatBridge,
    refresh,
  });

  ensureDependencies()
    .then(bootRuntime)
    .catch((error) => console.error("Player Trait Runtime:", error));
})(window);
