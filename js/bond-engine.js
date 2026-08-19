(function (global) {
  "use strict";

  if (global.LuminousBondManager) return;

  const ROOT = "campaña/teatro/vinculos";
  const IDENTITY_ROOT = "campaña/teatro/conocimiento_identidad";
  const subscribers = new Set();
  let db = null;
  let cache = {};
  let listener = null;
  let retryTimer = null;

  function getDb() {
    try {
      if (!global.firebase?.database || !global.firebase.apps?.length) return null;
      return global.firebase.database();
    } catch (_) {
      return null;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function normalizeBond(value = {}) {
    const nivelRaw = Number(value.nivel ?? value.level ?? 0);
    return {
      conocido: Boolean(value.conocido ?? value.known ?? false),
      nivel: Number.isFinite(nivelRaw) ? Math.max(0, Math.min(5, Math.round(nivelRaw))) : 0,
      estado: String(value.estado || value.state || "neutral").trim().toLowerCase() || "neutral",
      notas: String(value.notas || value.notes || "").trim(),
    };
  }

  function emit() {
    const snapshot = clone(cache);
    subscribers.forEach((callback) => {
      try { callback(snapshot); } catch (error) { console.error("Bond subscriber failed:", error); }
    });
  }

  function init() {
    if (db) return api;
    db = getDb();
    if (!db) {
      if (!retryTimer) {
        retryTimer = global.setTimeout(() => {
          retryTimer = null;
          init();
        }, 100);
      }
      return api;
    }

    listener = (snapshot) => {
      cache = snapshot.val() || {};
      emit();
    };
    db.ref(ROOT).on("value", listener);
    return api;
  }

  function getBond(playerId, actorId) {
    return normalizeBond(cache?.[playerId]?.[actorId] || {});
  }

  function listForActor(actorId) {
    const result = {};
    Object.entries(cache || {}).forEach(([playerId, actors]) => {
      if (actors?.[actorId]) result[playerId] = normalizeBond(actors[actorId]);
    });
    return result;
  }

  async function setBond(playerId, actorId, next) {
    init();
    if (!db) throw new Error("Firebase no está disponible para Vínculos.");
    if (!playerId || !actorId) throw new Error("playerId y actorId son obligatorios.");
    const bond = normalizeBond(next);
    const timestamp = global.firebase.database.ServerValue.TIMESTAMP;
    const updates = {
      [`${ROOT}/${playerId}/${actorId}`]: { ...bond, updatedAt: timestamp },
      [`${IDENTITY_ROOT}/${playerId}/${actorId}`]: {
        known: bond.conocido,
        conocida: bond.conocido,
        bondLevel: bond.nivel,
        estado: bond.estado,
        updatedAt: timestamp,
      },
    };
    await db.ref().update(updates);
    return bond;
  }

  async function clearBond(playerId, actorId) {
    init();
    if (!db) throw new Error("Firebase no está disponible para Vínculos.");
    await db.ref().update({
      [`${ROOT}/${playerId}/${actorId}`]: null,
      [`${IDENTITY_ROOT}/${playerId}/${actorId}`]: null,
    });
  }

  function subscribe(callback, options = {}) {
    init();
    if (typeof callback !== "function") return () => {};
    subscribers.add(callback);
    if (options.immediate !== false) callback(clone(cache));
    return () => subscribers.delete(callback);
  }

  const api = Object.freeze({ ROOT, IDENTITY_ROOT, init, getBond, listForActor, setBond, clearBond, subscribe, normalizeBond });
  global.LuminousBondManager = api;
  init();
})(window);
