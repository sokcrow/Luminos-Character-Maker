(function (global) {
  "use strict";

  const PATHS = Object.freeze({
    actors: Object.freeze(["campaña/base_datos_npcs", "campaña/actores"]),
    players: "campaña/jugadores",
    languages: Object.freeze(["campaña/idiomas", "campaña/teatro/idiomas"]),
  });

  const state = {
    initialized: false,
    db: null,
    actorsByRoot: {},
    players: {},
    languagesByRoot: {},
    actorSources: {},
    listeners: [],
    subscribers: {
      actors: new Set(),
      players: new Set(),
      languages: new Set(),
      change: new Set(),
    },
  };

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizePercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function slug(value) {
    return String(value || "actor")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "actor";
  }

  function playerLabel(playerId, player) {
    return cleanString(player?.characterName)
      || cleanString(player?.character_name)
      || cleanString(player?.nombre)
      || cleanString(player?.name)
      || playerId;
  }

  function normalizeLanguageEntry(value) {
    if (typeof value === "number" || typeof value === "string") {
      return { porcentaje: normalizePercent(value), comprendido: false };
    }
    if (!value || typeof value !== "object") {
      return { porcentaje: 0, comprendido: false };
    }
    const percentage = value.porcentaje
      ?? value.percent
      ?? value.conocimiento
      ?? value.knowledge
      ?? 0;
    const understood = value.comprendido
      ?? value.understood
      ?? value.distortionUnderstood
      ?? false;
    return {
      porcentaje: normalizePercent(percentage),
      comprendido: Boolean(understood),
    };
  }

  function normalizeLanguagesMap(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value).map(([languageId, knowledge]) => [
        languageId,
        normalizeLanguageEntry(knowledge),
      ]),
    );
  }

  function normalizeExpressionValue(value) {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object") return "";
    return cleanString(value.sprite) || cleanString(value.url) || cleanString(value.imagen);
  }

  function normalizeExpressions(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([name, expression]) => [cleanString(name), normalizeExpressionValue(expression)])
        .filter(([name, sprite]) => name && sprite),
    );
  }

  function mergedActors() {
    // Legacy first, modern base last: modern records win on duplicate IDs.
    const legacy = state.actorsByRoot[PATHS.actors[1]] || {};
    const base = state.actorsByRoot[PATHS.actors[0]] || {};
    return Object.assign({}, legacy, base);
  }

  function rebuildActorSources() {
    const sources = {};
    PATHS.actors.slice().reverse().forEach((root) => {
      Object.keys(state.actorsByRoot[root] || {}).forEach((actorId) => {
        sources[actorId] = root;
      });
    });
    state.actorSources = sources;
  }

  function mergedLanguages() {
    return Object.assign(
      {},
      ...PATHS.languages.map((root) => state.languagesByRoot[root] || {}),
    );
  }

  function emit(kind) {
    const payload = snapshot();
    const selected = state.subscribers[kind];
    if (selected) {
      selected.forEach((callback) => {
        try { callback(payload); } catch (error) { console.error("CharacterManager subscriber failed:", error); }
      });
    }
    if (kind !== "change") {
      state.subscribers.change.forEach((callback) => {
        try { callback(payload); } catch (error) { console.error("CharacterManager subscriber failed:", error); }
      });
    }
    if (global.document?.dispatchEvent && typeof global.CustomEvent === "function") {
      global.document.dispatchEvent(new global.CustomEvent("luminous:character-manager-change", {
        detail: { kind, snapshot: payload },
      }));
    }
  }

  function snapshot() {
    return {
      actors: clone(mergedActors()),
      players: clone(state.players),
      languages: clone(mergedLanguages()),
      actorSources: clone(state.actorSources),
    };
  }

  function requireDatabase(db) {
    const resolved = db || state.db || global.firebase?.database?.();
    if (!resolved?.ref) throw new Error("Firebase Realtime Database no está disponible.");
    return resolved;
  }

  function bindValue(path, setter, kind) {
    const ref = state.db.ref(path);
    const handler = (snapshotValue) => {
      setter(snapshotValue.val() || {});
      emit(kind);
    };
    ref.on("value", handler);
    state.listeners.push(() => ref.off("value", handler));
  }

  function init(options = {}) {
    if (state.initialized) return api;
    state.db = requireDatabase(options.db);

    PATHS.actors.forEach((root) => {
      bindValue(root, (value) => {
        state.actorsByRoot[root] = value;
        rebuildActorSources();
      }, "actors");
    });

    bindValue(PATHS.players, (value) => {
      state.players = value;
    }, "players");

    PATHS.languages.forEach((root) => {
      bindValue(root, (value) => {
        state.languagesByRoot[root] = value;
      }, "languages");
    });

    state.initialized = true;
    return api;
  }

  function destroy() {
    state.listeners.splice(0).forEach((unsubscribe) => unsubscribe());
    Object.values(state.subscribers).forEach((bucket) => bucket.clear());
    state.initialized = false;
    state.db = null;
  }

  function ensureInit() {
    if (!state.initialized) init();
  }

  function getActor(actorId) {
    ensureInit();
    const actors = mergedActors();
    const actor = actors[actorId];
    if (!actor) return null;
    return {
      actorId,
      root: state.actorSources[actorId] || PATHS.actors[0],
      kind: actor.tipo === "Jugador" || actor.vinculo_jugador ? "player" : "npc",
      playerId: actorLinkedPlayerId(actorId, actor),
      actor: clone(actor),
    };
  }

  function listActors() {
    ensureInit();
    return Object.entries(mergedActors()).map(([actorId]) => getActor(actorId));
  }

  function getPlayer(playerId) {
    ensureInit();
    const player = state.players[playerId];
    return player ? { playerId, player: clone(player), label: playerLabel(playerId, player) } : null;
  }

  function listPlayers() {
    ensureInit();
    return Object.entries(state.players).map(([playerId, player]) => ({
      playerId,
      label: playerLabel(playerId, player),
      player: clone(player),
      actorId: linkedActorId(playerId, player),
    }));
  }

  function acceptedPlayerLinks(playerId, player) {
    return new Set([
      playerId,
      cleanString(player?.id),
      playerLabel(playerId, player),
      cleanString(player?.characterName),
      cleanString(player?.character_name),
      cleanString(player?.nombre),
      cleanString(player?.name),
    ].filter(Boolean));
  }

  function linkedActorId(playerId, player) {
    const actors = mergedActors();
    if (player?.actorId && actors[player.actorId]) return player.actorId;
    const acceptedLinks = acceptedPlayerLinks(playerId, player);
    return Object.keys(actors).find((actorId) => {
      const actor = actors[actorId] || {};
      return acceptedLinks.has(cleanString(actor.vinculo_jugador));
    }) || null;
  }

  function actorLinkedPlayerId(actorId, actor) {
    const direct = cleanString(actor?.vinculo_jugador);
    if (direct && state.players[direct]) return direct;
    return Object.keys(state.players).find((playerId) => {
      const player = state.players[playerId] || {};
      if (player.actorId === actorId) return true;
      return acceptedPlayerLinks(playerId, player).has(direct);
    }) || null;
  }

  function resolvePlayerCharacter(playerId) {
    ensureInit();
    const player = state.players[playerId];
    if (!player) return null;
    const actorId = linkedActorId(playerId, player);
    const record = actorId ? getActor(actorId) : null;
    return {
      playerId,
      player: clone(player),
      actorId: actorId || null,
      actorRoot: record?.root || PATHS.actors[0],
      actor: record?.actor || null,
      kind: "player",
    };
  }

  function resolveCharacter(idOrPlayerId) {
    ensureInit();
    const direct = getActor(idOrPlayerId);
    if (direct) return direct;
    return resolvePlayerCharacter(idOrPlayerId);
  }

  function listLanguages() {
    ensureInit();
    return Object.entries(mergedLanguages()).map(([languageId, language]) => ({
      languageId,
      language: clone(language),
      label: cleanString(language?.nombre) || cleanString(language?.name) || languageId,
    }));
  }

  function languageKnowledgeForActor(actorId) {
    const record = getActor(actorId);
    return normalizeLanguagesMap(record?.actor?.idiomas || record?.actor?.languages || {});
  }

  function languageKnowledgeForPlayer(playerId) {
    ensureInit();
    const player = state.players[playerId] || {};
    return normalizeLanguagesMap(
      player.idiomas
      || player.lenguajes
      || player.languages
      || player.conocimiento_idiomas
      || player.languageKnowledge
      || {},
    );
  }

  function buildActorFieldUpdates(path, actorChanges) {
    const updates = {};
    const allowed = [
      "nombre", "titulo", "tipo", "faccion", "alineamiento", "escala",
      "color_nombre", "color_titulo", "icono", "sprite", "tags", "etiquetas",
      "combate", "identityId", "vinculo_jugador",
    ];
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(actorChanges, key)) {
        updates[`${path}/${key}`] = actorChanges[key] ?? null;
      }
    });
    if (Object.prototype.hasOwnProperty.call(actorChanges, "expresiones")) {
      updates[`${path}/expresiones`] = normalizeExpressions(actorChanges.expresiones);
    }
    if (Object.prototype.hasOwnProperty.call(actorChanges, "idiomas")) {
      updates[`${path}/idiomas`] = normalizeLanguagesMap(actorChanges.idiomas);
    }
    return updates;
  }

  async function saveActor(options = {}) {
    ensureInit();
    const actorChanges = options.actor || {};
    let actorId = cleanString(options.actorId);
    const existing = actorId ? getActor(actorId) : null;
    if (!actorId) actorId = slug(actorChanges.nombre || options.name || "actor");
    const root = options.root || existing?.root || PATHS.actors[0];
    const actorPath = `${root}/${actorId}`;
    const updates = buildActorFieldUpdates(actorPath, actorChanges);
    updates[`${actorPath}/identityId`] = actorId;

    if (options.playerId !== undefined) {
      Object.assign(updates, buildPlayerLinkUpdates(actorId, options.playerId || null, root));
      if (Object.prototype.hasOwnProperty.call(actorChanges, "idiomas") && options.playerId) {
        updates[`${PATHS.players}/${options.playerId}/idiomas`] = normalizeLanguagesMap(actorChanges.idiomas);
      }
    }

    await state.db.ref().update(updates);
    return { actorId, root };
  }

  function buildPlayerLinkUpdates(actorId, playerId, actorRootOverride) {
    const updates = {};
    const actor = mergedActors()[actorId] || {};
    const actorRoot = actorRootOverride || state.actorSources[actorId] || PATHS.actors[0];
    const previousPlayerId = actorLinkedPlayerId(actorId, actor);

    if (previousPlayerId && previousPlayerId !== playerId) {
      updates[`${PATHS.players}/${previousPlayerId}/actorId`] = null;
    }

    if (!playerId) {
      updates[`${actorRoot}/${actorId}/vinculo_jugador`] = null;
      return updates;
    }

    const player = state.players[playerId];
    if (!player) throw new Error(`Jugador no encontrado: ${playerId}`);

    const previousActorId = linkedActorId(playerId, player);
    if (previousActorId && previousActorId !== actorId) {
      const previousActorRoot = state.actorSources[previousActorId] || PATHS.actors[0];
      updates[`${previousActorRoot}/${previousActorId}/vinculo_jugador`] = null;
    }

    updates[`${PATHS.players}/${playerId}/actorId`] = actorId;
    updates[`${actorRoot}/${actorId}/vinculo_jugador`] = playerId;
    updates[`${actorRoot}/${actorId}/tipo`] = "Jugador";
    return updates;
  }

  async function linkPlayer(actorId, playerId) {
    ensureInit();
    if (!getActor(actorId)) throw new Error(`Actor no encontrado: ${actorId}`);
    await state.db.ref().update(buildPlayerLinkUpdates(actorId, playerId || null));
    return { actorId, playerId: playerId || null };
  }

  async function setLanguageKnowledge(target = {}, languageId, knowledge) {
    ensureInit();
    if (!cleanString(languageId)) throw new Error("languageId es obligatorio.");
    const normalized = normalizeLanguageEntry(knowledge);

    if (target.playerId) {
      await state.db.ref(`${PATHS.players}/${target.playerId}/idiomas/${languageId}`).set(normalized);
      return normalized;
    }

    const actorId = target.actorId;
    const record = getActor(actorId);
    if (!record) throw new Error(`Actor no encontrado: ${actorId}`);
    await state.db.ref(`${record.root}/${actorId}/idiomas/${languageId}`).set(normalized);
    return normalized;
  }

  async function setExpressions(actorId, expressions) {
    ensureInit();
    const record = getActor(actorId);
    if (!record) throw new Error(`Actor no encontrado: ${actorId}`);
    const normalized = normalizeExpressions(expressions);
    await state.db.ref(`${record.root}/${actorId}/expresiones`).set(normalized);
    return normalized;
  }

  async function deleteActor(actorId) {
    ensureInit();
    const record = getActor(actorId);
    if (!record) return false;
    const updates = { [`${record.root}/${actorId}`]: null };
    const playerId = record.playerId || actorLinkedPlayerId(actorId, record.actor);
    if (playerId) updates[`${PATHS.players}/${playerId}/actorId`] = null;
    await state.db.ref().update(updates);
    return true;
  }

  function subscribe(kind, callback, options = {}) {
    ensureInit();
    if (!state.subscribers[kind]) throw new Error(`Suscripción desconocida: ${kind}`);
    if (typeof callback !== "function") throw new Error("callback debe ser una función.");
    state.subscribers[kind].add(callback);
    if (options.immediate !== false) callback(snapshot());
    return () => state.subscribers[kind].delete(callback);
  }

  function subscribeActors(callback, options) { return subscribe("actors", callback, options); }
  function subscribePlayers(callback, options) { return subscribe("players", callback, options); }
  function subscribeLanguages(callback, options) { return subscribe("languages", callback, options); }
  function subscribeAll(callback, options) { return subscribe("change", callback, options); }

  const api = Object.freeze({
    PATHS,
    init,
    destroy,
    snapshot,
    listActors,
    getActor,
    resolveCharacter,
    listPlayers,
    getPlayer,
    resolvePlayerCharacter,
    listLanguages,
    languageKnowledgeForActor,
    languageKnowledgeForPlayer,
    saveActor,
    linkPlayer,
    setLanguageKnowledge,
    setExpressions,
    deleteActor,
    subscribeActors,
    subscribePlayers,
    subscribeLanguages,
    subscribeAll,
    normalizeLanguageEntry,
    normalizeLanguagesMap,
    normalizeExpressions,
  });

  global.LuminousCharacterManager = api;
})(window);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
