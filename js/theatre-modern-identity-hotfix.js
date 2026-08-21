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
    legacyActorsLoaded: false,
    modernActors: {},
    legacyActors: {},
    modernActorIds: new Set(),
    location: "",
    rosterObserver: null,
    originalGetAssignedActor: null,
    originalSyncComposer: null,
    originalChangeScene: null,
    identityPatched: false,
    composerPatched: false,
    sceneRefreshQueued: false,
    playerRepairQueued: false,
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

  function addId(result, value) {
    if (value === undefined || value === null || value === false) return;
    const id = String(value).trim();
    if (!id || id === "true" || id === "false" || result.includes(id)) return;
    result.push(id);
  }

  function walkAssignedValue(value, result) {
    if (value === undefined || value === null || value === false) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walkAssignedValue(entry, result));
      return;
    }
    if (typeof value === "object") {
      if (value.actorId !== undefined) addId(result, value.actorId);
      if (value.id !== undefined) addId(result, value.id);
      Object.entries(value).forEach(([key, entry]) => {
        if (entry === true || entry === 1) addId(result, key);
        else if (typeof entry === "string" || typeof entry === "number") addId(result, entry);
        else if (entry && typeof entry === "object") walkAssignedValue(entry, result);
      });
      return;
    }
    addId(result, value);
  }

  function normalizeIds(value) {
    const result = [];
    const theatre = global.LuminousTheatreState;
    try {
      theatre?.normalizeAssignedActorIds?.(value)?.forEach?.((entry) => addId(result, entry));
    } catch (error) {
      // Fallback below handles older assignment shapes.
    }
    walkAssignedValue(value, result);
    return result;
  }

  function resolveCanonicalIdentityText(...values) {
    const resolver = global.LuminousTheatreState?.resolveCanonicalIdentityText;
    if (typeof resolver === "function") return resolver(...values);
    for (const value of values) {
      const candidate = typeof value === "string" ? value.trim() : "";
      if (candidate && !/^\?{3,}$/.test(candidate)) return candidate;
    }
    return "";
  }

  function playerProfile() {
    return global.datosJugador && typeof global.datosJugador === "object"
      ? global.datosJugador
      : {};
  }

  function playerKeys() {
    const data = playerProfile();
    const candidates = [
      global.firebase?.auth?.().currentUser?.uid,
      global.playerId,
      global.localStorage?.getItem?.("playerId"),
      data.playerId,
      data.id,
      data.characterName,
      data.character_name,
      data.nombre,
      data.name,
    ];
    return new Set(candidates
      .filter((value) => value !== undefined && value !== null && String(value).trim())
      .map((value) => String(value).trim()));
  }

  function playerKey() {
    return [...playerKeys()][0] || "";
  }

  function actorRecord(actorId) {
    const id = String(actorId || "");
    if (!id) return null;
    if (state.modernActors[id]) return { actorId: id, source: "modern", data: state.modernActors[id] };
    if (state.legacyActors[id]) return { actorId: id, source: "legacy-assigned", data: state.legacyActors[id] };
    return null;
  }

  function linkedActorIds() {
    const keys = playerKeys();
    if (!keys.size) return [];
    const result = [];
    const inspect = (pool) => {
      Object.entries(pool || {}).forEach(([actorId, actor]) => {
        if (!actor || typeof actor !== "object") return;
        const links = [actor.vinculo_jugador, actor.sourceId, actor.playerId]
          .filter((value) => value !== undefined && value !== null)
          .map(String);
        if (links.some((value) => keys.has(value)) && (actor.tipo === "Jugador" || actor.sourceType === "player-profile")) {
          addId(result, actorId);
        }
      });
    };
    inspect(state.modernActors);
    inspect(state.legacyActors);
    return result;
  }

  function assignedIds() {
    const data = playerProfile();
    const result = [];
    [data.actorIds, data.actores, data.actorId].forEach((value) => {
      normalizeIds(value).forEach((id) => addId(result, id));
    });

    // Some older profiles stored the actor id in vinculo_jugador. Keep it only
    // when that value actually resolves to an actor record.
    normalizeIds(data.vinculo_jugador).forEach((id) => {
      if (actorRecord(id)) addId(result, id);
    });

    linkedActorIds().forEach((id) => addId(result, id));
    return result;
  }

  function selectedActorId() {
    const selected = global.document?.getElementById?.("player-actor-select")?.value;
    return selected ? String(selected) : "";
  }

  function preferredAssignedActorId() {
    const ids = assignedIds();
    const selected = selectedActorId();
    if (selected && ids.includes(selected) && actorRecord(selected)) return selected;
    return ids.find((id) => actorRecord(id)) || ids[0] || "";
  }

  function ensureScalarActorAssignment() {
    const data = playerProfile();
    const actorId = preferredAssignedActorId();
    if (!actorId) return "";

    // hoja_personaje.js still uses actorId as a boolean preflight before it
    // delegates to getAssignedTheatreActor(). Keep this compatibility value in
    // memory only; the actual selected actor continues to come from the resolver.
    if (!data.actorId) data.actorId = actorId;
    return actorId;
  }

  function buildOwnActor() {
    const data = playerProfile();
    const actorId = preferredAssignedActorId();
    if (!actorId && !playerKey()) return null;

    const record = actorRecord(actorId);
    const actor = record?.data || {};
    const sourceId = actor.sourceId || actor.vinculo_jugador || playerKey() || actorId;
    const identityId = actor.identityId || actor.identidadId || actorId || sourceId;

    return {
      ...actor,
      actorId: actorId || identityId,
      id: actor.id || actorId || identityId,
      sourceId,
      sourceType: actor.sourceType || (record?.source === "legacy-assigned" ? "player-profile" : "player-profile"),
      identityId,
      nombre: resolveCanonicalIdentityText(
        actor.nombre,
        data.characterName,
        data.character_name,
        data.nombre,
        data.name
      ) || "Jugador",
      titulo: resolveCanonicalIdentityText(actor.titulo, data.titulo, data.title),
      icono: actor.icono || actor.icono_jugador || data.icono || data.icono_jugador || "",
      icono_jugador: actor.icono_jugador || data.icono_jugador || data.icono || "",
      sprite: actor.sprite || actor.url || "",
      expresiones: actor.expresiones && typeof actor.expresiones === "object" ? actor.expresiones : {},
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

      const own = buildOwnActor();
      if (!own) return existing;
      const ownId = String(own.actorId || own.id || "");
      const existingId = String(existing?.actorId || existing?.id || "");

      if (existing && existingId === ownId) {
        return {
          ...own,
          ...existing,
          actorId: ownId,
          expresiones: Object.keys(own.expresiones || {}).length ? own.expresiones : (existing.expresiones || {}),
        };
      }

      // Self knowledge and assigned expressions must not depend on whether the
      // actor survived the general-purpose sprite cache pruning.
      return own;
    };

    global.getAssignedTheatreActor.__luminousAssignedExpressionsPatched = true;
    state.identityPatched = true;
  }

  function expressionSprite(value) {
    if (typeof value === "string") return value;
    return value?.sprite || value?.url || value?.imagen || "";
  }

  function syncAssignedActorSelector() {
    const select = global.document?.getElementById?.("player-actor-select");
    if (!select) return;

    const ids = assignedIds().filter((id) => actorRecord(id));
    if (!ids.length) return;

    const previous = select.value;
    select.innerHTML = "";
    ids.forEach((actorId) => {
      const record = actorRecord(actorId);
      const option = global.document.createElement("option");
      option.value = actorId;
      option.textContent = record?.data?.nombre || actorId;
      select.appendChild(option);
    });

    if (previous && ids.includes(previous)) select.value = previous;
    else select.value = ids[0];
  }

  function syncAssignedExpressions() {
    const select = global.document?.getElementById?.("player-expression");
    if (!select) return;
    const actor = global.getAssignedTheatreActor?.() || buildOwnActor();
    if (!actor) return;

    const expressions = actor.expresiones && typeof actor.expresiones === "object"
      ? actor.expresiones
      : {};
    const names = Object.keys(expressions);
    const previous = select.value;
    select.innerHTML = "";

    if (!names.length) {
      const option = global.document.createElement("option");
      option.value = "Neutral";
      option.textContent = "Neutral";
      const baseSprite = actor.sprite || actor.url || "";
      if (baseSprite) option.dataset.sprite = baseSprite;
      select.appendChild(option);
      return;
    }

    names.forEach((name) => {
      const option = global.document.createElement("option");
      option.value = name;
      option.textContent = name;
      const sprite = expressionSprite(expressions[name]);
      if (sprite) option.dataset.sprite = sprite;
      select.appendChild(option);
    });

    if (previous && names.includes(previous)) select.value = previous;
  }

  function repairPlayerComposer() {
    if (isDmView()) return;
    ensureScalarActorAssignment();
    syncAssignedActorSelector();
    syncAssignedExpressions();
  }

  function patchPlayerComposer() {
    if (isDmView() || state.composerPatched) return;
    const current = global.syncPlayerTheatreComposer;
    if (typeof current !== "function") return;

    state.originalSyncComposer = current;
    global.syncPlayerTheatreComposer = function () {
      const result = state.originalSyncComposer?.apply(this, arguments);
      repairPlayerComposer();
      return result;
    };
    global.syncPlayerTheatreComposer.__luminousAssignedExpressionsPatched = true;
    state.composerPatched = true;
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

    const assigned = new Set(assignedIds());
    Object.keys(global.actoresJugador).forEach((actorId) => {
      const isModern = state.modernActorIds.has(actorId);
      const isAssignedLegacy = assigned.has(actorId) && Boolean(state.legacyActors[actorId]);
      if (!isModern && !isAssignedLegacy) delete global.actoresJugador[actorId];
    });

    // Rehydrate the modern pool and only the legacy records that are explicitly
    // assigned to this player. This preserves expressions without resurrecting
    // the obsolete global legacy roster.
    Object.entries(state.modernActors).forEach(([actorId, actor]) => {
      global.actoresJugador[actorId] = actor;
    });
    assigned.forEach((actorId) => {
      if (!state.modernActorIds.has(actorId) && state.legacyActors[actorId]) {
        global.actoresJugador[actorId] = state.legacyActors[actorId];
      }
    });

    global.allActoresCache = global.actoresJugador;
    patchOwnIdentityResolver();
    patchPlayerComposer();
    repairPlayerComposer();
    forceTheatreIdentityRefresh();
  }

  function queuePlayerRepair() {
    if (isDmView() || state.playerRepairQueued) return;
    state.playerRepairQueued = true;
    global.setTimeout(() => {
      state.playerRepairQueued = false;
      patchOwnIdentityResolver();
      patchPlayerComposer();
      pruneLegacyPlayerActorCache();
      repairPlayerComposer();
    }, 0);
  }

  function bindSendPreflight() {
    if (isDmView() || global.__luminousAssignedExpressionsSendPreflight) return;
    global.__luminousAssignedExpressionsSendPreflight = true;
    global.document?.addEventListener?.("click", (event) => {
      if (!event.target?.closest?.("#btn-enviar-teatro-modal")) return;
      ensureScalarActorAssignment();
      repairPlayerComposer();
    }, true);
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
      else queuePlayerRepair();
    });
  }

  function subscribeAssignedLegacyActors() {
    if (isDmView()) return;
    const db = getDb();
    if (!db) return;
    db.ref(LEGACY_ACTOR_ROOT).on("value", (snapshot) => {
      state.legacyActors = snapshot.val() || {};
      state.legacyActorsLoaded = true;
      queuePlayerRepair();
    });
  }

  function exposeDiagnostics() {
    global.LuminousTheatreModernIdentityHotfix = Object.freeze({
      modernNpcRoot: MODERN_NPC_ROOT,
      legacyActorRoot: LEGACY_ACTOR_ROOT,
      modernLocationPath: MODERN_LOCATION_PATH,
      getModernActorIds: () => [...state.modernActorIds],
      getAssignedActorIds: () => assignedIds(),
      getAssignedLegacyActorIds: () => assignedIds().filter((id) => !state.modernActorIds.has(id) && Boolean(state.legacyActors[id])),
      getLocation: () => state.location,
      refreshIdentity: forceTheatreIdentityRefresh,
      refreshAssignedExpressions: () => {
        queuePlayerRepair();
        return assignedIds();
      },
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
    patchPlayerComposer();
    patchSceneChangeLocationSync();
    bindLocationButtonTakeover();
    bindSendPreflight();
    bindRosterGuard();
    subscribeModernActors();
    subscribeAssignedLegacyActors();
    subscribeModernLocation();
    seedModernLocation();

    global.addEventListener?.("actoresCacheUpdated", () => {
      if (!isDmView()) queuePlayerRepair();
    });

    global.firebase?.auth?.().onAuthStateChanged?.(() => {
      patchOwnIdentityResolver();
      patchPlayerComposer();
      if (!isDmView()) queuePlayerRepair();
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
