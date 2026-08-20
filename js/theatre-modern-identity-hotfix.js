(function (global) {
  "use strict";

  if (global.LuminousTheatreModernIdentityHotfix) return;

  const MODERN_NPC_ROOT = "campaña/base_datos_npcs";
  const MODERN_LOCATION_PATH = "campaña/teatro/estado/locacion_actual";
  const LEGACY_ACTOR_ROOT = "campaña/actores";
  const MAX_BOOT_ATTEMPTS = 80;

  const state = {
    initialized: false,
    modernActorsLoaded: false,
    modernActors: {},
    modernActorIds: new Set(),
    location: "",
    rosterObserver: null,
    originalGetAssignedActor: null,
    originalChangeScene: null,
    identityPatched: false,
    sceneRefreshQueued: false,
  };

  function getDb() {
    try {
      return global.firebase?.database?.() || null;
    } catch (error) {
      return null;
    }
  }

  function isDmView() {
    return Boolean(global.document?.body?.classList?.contains("on-game-dashboard"));
  }

  function normalizeIds(value) {
    const theatre = global.LuminousTheatreState;
    if (theatre?.normalizeAssignedActorIds) {
      return theatre.normalizeAssignedActorIds(value).map(String).filter(Boolean);
    }
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "object") return Object.values(value).map(String).filter(Boolean);
    return [String(value)].filter(Boolean);
  }

  function playerProfile() {
    return global.datosJugador && typeof global.datosJugador === "object"
      ? global.datosJugador
      : {};
  }

  function playerKey() {
    const data = playerProfile();
    const candidates = [
      global.playerId,
      global.localStorage?.getItem?.("playerId"),
      data.playerId,
      data.id,
      data.characterName,
      data.character_name,
      data.nombre,
      data.name,
    ];
    return String(candidates.find((value) => value !== undefined && value !== null && String(value).trim()) || "").trim();
  }

  function assignedIds() {
    const data = playerProfile();
    const values = [data.actorIds, data.actores, data.actorId, data.vinculo_jugador];
    const result = [];
    values.forEach((value) => normalizeIds(value).forEach((id) => {
      if (!result.includes(id)) result.push(id);
    }));
    return result;
  }

  function selectedActorId() {
    const selected = global.document?.getElementById?.("player-actor-select")?.value;
    return selected ? String(selected) : "";
  }

  function buildOwnActor() {
    const data = playerProfile();
    const ids = assignedIds();
    const selected = selectedActorId();
    const modernSelected = selected && state.modernActorIds.has(selected) ? selected : "";
    const modernAssigned = ids.find((id) => state.modernActorIds.has(id)) || "";
    const actorId = modernSelected || modernAssigned || selected || ids[0] || "";
    if (!actorId && !playerKey()) return null;

    const actor = state.modernActors[actorId] || {};
    const sourceId = actor.sourceId || actor.vinculo_jugador || playerKey() || actorId;
    const identityId = actor.identityId || actor.identidadId || actorId || sourceId;

    return {
      ...actor,
      actorId: actorId || identityId,
      id: actor.id || actorId || identityId,
      sourceId,
      sourceType: actor.sourceType || "player-profile",
      identityId,
      nombre:
        actor.nombre ||
        data.characterName ||
        data.character_name ||
        data.nombre ||
        data.name ||
        "Jugador",
      titulo: actor.titulo || data.titulo || data.title || "",
      icono: actor.icono || actor.icono_jugador || data.icono || data.icono_jugador || "",
      icono_jugador: actor.icono_jugador || data.icono_jugador || data.icono || "",
      sprite: actor.sprite || actor.url || "",
      color_nombre: actor.color_nombre || data.color_nombre || "#4a4a4a",
      color_titulo: actor.color_titulo || data.color_titulo || "#4a4a4a",
    };
  }

  function patchOwnIdentityResolver() {
    if (isDmView() || state.identityPatched) return;
    const current = global.getAssignedTheatreActor;
    if (typeof current !== "function") return;

    state.originalGetAssignedActor = current;
    global.getAssignedTheatreActor = function () {
      let existing = null;
      try {
        existing = state.originalGetAssignedActor?.apply(this, arguments) || null;
      } catch (error) {
        existing = null;
      }

      const existingId = String(existing?.actorId || existing?.id || "");
      if (existing && existingId && state.modernActorIds.has(existingId)) {
        return { ...buildOwnActor(), ...existing, actorId: existingId };
      }

      // Self knowledge must not depend on the sprite cache or the local
      // "Mostrar mi personaje" preference. The player's profile is enough.
      return buildOwnActor();
    };

    state.identityPatched = true;
  }

  function forceTheatreIdentityRefresh() {
    if (isDmView() || state.sceneRefreshQueued) return;
    const theatre = global.LuminousTheatreState;
    if (!theatre?.setShowOwnActor || !theatre?.getShowOwnActor) return;

    state.sceneRefreshQueued = true;
    const render = () => {
      state.sceneRefreshQueued = false;
      try {
        theatre.setShowOwnActor(theatre.getShowOwnActor());
      } catch (error) {
        console.warn("No se pudo refrescar la identidad propia del Theatre:", error);
      }
    };
    if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(render);
    else global.setTimeout(render, 0);
  }

  function pruneLegacyPlayerActorCache() {
    if (!state.modernActorsLoaded || !global.actoresJugador || typeof global.actoresJugador !== "object") return;

    Object.keys(global.actoresJugador).forEach((actorId) => {
      if (!state.modernActorIds.has(actorId)) delete global.actoresJugador[actorId];
    });
    global.allActoresCache = global.actoresJugador;

    patchOwnIdentityResolver();
    try {
      global.syncPlayerTheatreComposer?.();
    } catch (error) {
      console.warn("No se pudo resincronizar el compositor del jugador:", error);
    }
    forceTheatreIdentityRefresh();
  }

  function pruneDmRoster() {
    if (!state.modernActorsLoaded) return;
    const select = global.document?.getElementById?.("select-npc-roster");
    if (!select) return;

    select.querySelectorAll("option").forEach((option) => {
      const actorId = String(option.value || "");
      if (!actorId) return;
      const sourceType = option.dataset?.sourceType || "";
      if ((sourceType === "npc" || sourceType === "player-profile") && !state.modernActorIds.has(actorId)) {
        option.remove();
      }
    });
  }

  function bindRosterGuard() {
    if (!isDmView()) return;
    const attach = () => {
      const select = global.document?.getElementById?.("select-npc-roster");
      if (!select) return false;
      pruneDmRoster();
      state.rosterObserver?.disconnect?.();
      state.rosterObserver = new MutationObserver(() => pruneDmRoster());
      state.rosterObserver.observe(select, { childList: true, subtree: true });
      return true;
    };

    if (attach()) return;
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (attach() || attempts >= 40) global.clearInterval(timer);
    }, 100);
  }

  function paintLocation(location) {
    const normalized = String(location || "").trim();
    if (!normalized) return;
    const element = global.document?.getElementById?.("theatre-location");
    if (element) element.textContent = normalized;
  }

  async function writeModernLocation(location, button) {
    const db = getDb();
    const theatre = global.LuminousTheatreState;
    const normalized = String(location || "").trim();
    if (!db || !theatre || !normalized) return false;

    const scenePath = theatre.getPaths?.().scene;
    const updates = { [MODERN_LOCATION_PATH]: normalized };
    if (scenePath) updates[`${scenePath}/locacion`] = normalized;

    const previousText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = "ACTUALIZANDO...";
    }

    try {
      await db.ref().update(updates);
      state.location = normalized;
      paintLocation(normalized);
      if (button) {
        button.textContent = "LOCALIZACIÓN ACTUALIZADA";
        global.setTimeout(() => {
          if (button.isConnected) button.textContent = previousText || "ACTUALIZAR LOCALIZACIÓN";
        }, 1200);
      }
      return true;
    } catch (error) {
      console.error("No se pudo actualizar la localización moderna del Theatre:", error);
      if (button) button.textContent = previousText || "ACTUALIZAR LOCALIZACIÓN";
      global.alert?.("No se pudo actualizar la localización.");
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindLocationButtonTakeover() {
    if (!isDmView() || global.__luminousModernLocationTakeover) return;
    global.__luminousModernLocationTakeover = true;

    global.document?.addEventListener?.("click", (event) => {
      const button = event.target?.closest?.("#btn-update-theatre-location");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const input = global.document.getElementById("theatre-location-input");
      const location = String(input?.value || "").trim();
      if (!location) {
        global.alert?.("Escribe una localización antes de actualizarla.");
        return;
      }
      writeModernLocation(location, button);
    }, true);
  }

  function patchSceneChangeLocationSync() {
    const theatre = global.LuminousTheatreState;
    if (!theatre?.changeScene || state.originalChangeScene) return;
    state.originalChangeScene = theatre.changeScene.bind(theatre);

    theatre.changeScene = async function (nextScene) {
      const result = await state.originalChangeScene(nextScene);
      const location = String(nextScene?.locacion || "").trim();
      if (location) {
        const db = getDb();
        if (db) await db.ref(MODERN_LOCATION_PATH).set(location);
      }
      return result;
    };
  }

  async function seedModernLocation() {
    if (!isDmView()) return;
    const db = getDb();
    const theatre = global.LuminousTheatreState;
    if (!db || !theatre?.getPaths) return;

    try {
      const modern = await db.ref(MODERN_LOCATION_PATH).once("value");
      if (String(modern.val() || "").trim()) return;
      const scenePath = theatre.getPaths().scene;
      const legacyLocation = await db.ref(`${scenePath}/locacion`).once("value");
      const location = String(legacyLocation.val() || "").trim();
      if (location) await db.ref(MODERN_LOCATION_PATH).set(location);
    } catch (error) {
      console.warn("No se pudo sembrar la localización moderna del Theatre:", error);
    }
  }

  function subscribeModernLocation() {
    const db = getDb();
    if (!db) return;
    db.ref(MODERN_LOCATION_PATH).on("value", (snapshot) => {
      const location = String(snapshot.val() || "").trim();
      state.location = location;
      if (location) paintLocation(location);
    });
  }

  function subscribeModernActors() {
    const db = getDb();
    if (!db) return;
    db.ref(MODERN_NPC_ROOT).on("value", (snapshot) => {
      state.modernActors = snapshot.val() || {};
      state.modernActorIds = new Set(Object.keys(state.modernActors));
      state.modernActorsLoaded = true;

      if (isDmView()) pruneDmRoster();
      else pruneLegacyPlayerActorCache();
    });
  }

  function exposeDiagnostics() {
    global.LuminousTheatreModernIdentityHotfix = Object.freeze({
      modernNpcRoot: MODERN_NPC_ROOT,
      legacyActorRoot: LEGACY_ACTOR_ROOT,
      modernLocationPath: MODERN_LOCATION_PATH,
      getModernActorIds: () => [...state.modernActorIds],
      getLocation: () => state.location,
      refreshIdentity: forceTheatreIdentityRefresh,
      pruneLegacyActors: () => isDmView() ? pruneDmRoster() : pruneLegacyPlayerActorCache(),
    });
  }

  function initialize() {
    if (state.initialized) return true;
    const db = getDb();
    const theatre = global.LuminousTheatreState;
    if (!db || !theatre?.getPaths) return false;

    state.initialized = true;
    exposeDiagnostics();
    patchOwnIdentityResolver();
    patchSceneChangeLocationSync();
    bindLocationButtonTakeover();
    bindRosterGuard();
    subscribeModernActors();
    subscribeModernLocation();
    seedModernLocation();

    global.addEventListener?.("actoresCacheUpdated", () => {
      if (!isDmView()) pruneLegacyPlayerActorCache();
    });

    global.firebase?.auth?.().onAuthStateChanged?.(() => {
      patchOwnIdentityResolver();
      forceTheatreIdentityRefresh();
    });

    return true;
  }

  let attempts = 0;
  const boot = () => {
    attempts += 1;
    if (initialize() || attempts >= MAX_BOOT_ATTEMPTS) return;
    global.setTimeout(boot, 50);
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window);
