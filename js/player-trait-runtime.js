(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerTraitRuntime) return;

  const DEFINITIONS_ROOT = "campaña/config/traits/definitions";
  const GRANTS_ROOT = "campaña/config/traits/grants";
  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
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
    combatEngineSource: null,
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
    return { context, character, self, level, ...input };
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
        onActivated: (result) => emit("luminous:trait-activated", result),
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
    return traitEngine.dispatchCombatEvent(trigger, {
      ...runtime,
      traits: resolveTraits(),
      state: state.traitState,
    });
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
        dispatchCombatEvent("encounter_start", { context: "combat", self: currentCombatUnit() });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        const unit = currentPlayerUnit(allUnits || []);
        if (unit && phaseTag === "[Round Start]") {
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
    installTheatreBridge,
    installCombatBridge,
    refresh,
  });

  ensureDependencies()
    .then(bootRuntime)
    .catch((error) => console.error("Player Trait Runtime:", error));
})(window);
