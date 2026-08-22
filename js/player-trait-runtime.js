(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerTraitRuntime) return;

  const DEFINITIONS_ROOT = "campaña/config/traits/definitions";
  const GRANTS_ROOT = "campaña/config/traits/grants";
  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";

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
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

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
    return { ...core, ...(state.definitions || {}) };
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
    const milestones = global.LuminousClassMilestones;
    if (!traitEngine?.resolveTraitGrants || !milestones?.resolveSelectedGeneralTraits) return [];
    const character = getCharacter();
    const definitions = mergedDefinitions();
    const granted = traitEngine.resolveTraitGrants(
      normalizeCharacterForGrantResolution(character),
      mergedGrants(),
      definitions,
    );
    const selected = milestones.resolveSelectedGeneralTraits(character, definitions);
    return mergeTraitLists(granted, selected);
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
    return {
      context: inferContext(),
      character,
      self: character,
      level: Number(character?.level ?? character?.characterBuild?.calculatedAtLevel ?? 0) || 0,
      ...(overrides || {}),
    };
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

  function resolveTheatreCheck(check = {}, runtimeInput = {}) {
    const traitEngine = global.LuminousTraitEngine;
    if (!traitEngine?.resolveTheatreCheck) return null;
    if (!state.traitState) state.traitState = traitEngine.createState();
    const character = getCharacter();
    const result = traitEngine.resolveTheatreCheck({
      character,
      traits: resolveTraits(),
      check,
      state: state.traitState,
    });
    Object.assign(result.check, runtimeInput?.check || {});
    return result;
  }

  function dispatchCombatEvent(trigger, input = {}) {
    const traitEngine = global.LuminousTraitEngine;
    if (!traitEngine?.dispatchCombatEvent) return null;
    if (!state.traitState) state.traitState = traitEngine.createState();
    return traitEngine.dispatchCombatEvent(trigger, {
      character: getCharacter(),
      traits: resolveTraits(),
      state: state.traitState,
      ...(input || {}),
    });
  }

  function bootRuntime() {
    connectFirebase();
    bindPlayer();
    refresh();
    global.setInterval(() => {
      if (!state.db) connectFirebase();
      bindPlayer();
      mountTray();
    }, 1000);
  }

  global.LuminousPlayerTraitRuntime = Object.freeze({
    getCharacter,
    getTraits: resolveTraits,
    getRuntime,
    dispatch,
    resolveTheatreCheck,
    dispatchCombatEvent,
    refresh,
  });

  ensureDependencies()
    .then(bootRuntime)
    .catch((error) => console.error("Player Trait Runtime:", error));
})(window);
