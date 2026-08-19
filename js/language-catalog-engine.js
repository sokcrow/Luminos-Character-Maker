(function (global) {
  "use strict";

  if (global.LuminousLanguageCatalog) return;

  const ROOT = "campaña/teatro/idiomas";
  const READ_ROOTS = ["campaña/idiomas", ROOT];
  const DND_DEFAULTS = Object.freeze({
    common: { nombre: "Común", universal: true, sistema: "dnd", tipo: "standard", estilo_ofuscacion: "ellipsis" },
    dwarvish: { nombre: "Enano", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "runes" },
    elvish: { nombre: "Élfico", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "ellipsis" },
    giant: { nombre: "Gigante", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "runes" },
    gnomish: { nombre: "Gnómico", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "ellipsis" },
    goblin: { nombre: "Goblin", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "ellipsis" },
    halfling: { nombre: "Mediano", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "ellipsis" },
    orc: { nombre: "Orco", sistema: "dnd", tipo: "standard", estilo_ofuscacion: "ellipsis" },
    abyssal: { nombre: "Abisal", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "runes" },
    celestial: { nombre: "Celestial", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "runes" },
    draconic: { nombre: "Dracónico", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "runes" },
    deep_speech: { nombre: "Habla Profunda", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "runes" },
    infernal: { nombre: "Infernal", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "runes" },
    primordial: { nombre: "Primordial", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "runes" },
    sylvan: { nombre: "Silvano", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "ellipsis" },
    undercommon: { nombre: "Infracomún", sistema: "dnd", tipo: "exotic", estilo_ofuscacion: "ellipsis" },
    dante_clock: {
      nombre: "Reloj de Dante",
      sistema: "special",
      tipo: "distortion",
      distortion: true,
      texto_desconocido: "Tik... Tok...",
      estilo_ofuscacion: "ellipsis"
    }
  });

  let db = null;
  const sourceCache = {};
  let definitions = {};
  let seedRequested = false;
  const subscribers = new Set();
  let retryTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function getDb() {
    try {
      if (!global.firebase?.database || !global.firebase.apps?.length) return null;
      return global.firebase.database();
    } catch (_) {
      return null;
    }
  }

  function rebuild() {
    definitions = Object.assign({}, ...READ_ROOTS.map((root) => sourceCache[root] || {}));
    const snapshot = clone(definitions);
    subscribers.forEach((callback) => {
      try { callback(snapshot); } catch (error) { console.error("Language catalog subscriber failed:", error); }
    });
  }

  async function ensureDefaults() {
    if (!db) return false;
    const snapshots = await Promise.all(READ_ROOTS.map((root) => db.ref(root).once("value")));
    const merged = Object.assign({}, ...snapshots.map((snapshot) => snapshot.val() || {}));
    const updates = {};
    Object.entries(DND_DEFAULTS).forEach(([languageId, definition]) => {
      if (!Object.prototype.hasOwnProperty.call(merged, languageId)) updates[languageId] = definition;
    });
    if (Object.keys(updates).length) await db.ref(ROOT).update(updates);
    return true;
  }

  function init(options = {}) {
    seedRequested = seedRequested || options.seedDefaults === true;
    if (db) {
      if (seedRequested) ensureDefaults().catch((error) => console.error("Language catalog seed failed:", error));
      return api;
    }

    db = getDb();
    if (!db) {
      if (!retryTimer) {
        retryTimer = global.setTimeout(() => {
          retryTimer = null;
          init(options);
        }, 100);
      }
      return api;
    }

    READ_ROOTS.forEach((root) => {
      db.ref(root).on("value", (snapshot) => {
        sourceCache[root] = snapshot.val() || {};
        rebuild();
      });
    });
    if (seedRequested) ensureDefaults().catch((error) => console.error("Language catalog seed failed:", error));
    return api;
  }

  function list() {
    return Object.entries(definitions).map(([languageId, definition]) => ({ languageId, definition: clone(definition) }));
  }

  function get(languageId) {
    return definitions[languageId] ? clone(definitions[languageId]) : null;
  }

  function subscribe(callback, options = {}) {
    if (typeof callback !== "function") return () => {};
    subscribers.add(callback);
    if (options.immediate !== false) callback(clone(definitions));
    return () => subscribers.delete(callback);
  }

  const api = Object.freeze({ ROOT, READ_ROOTS, DND_DEFAULTS, init, ensureDefaults, list, get, subscribe });
  global.LuminousLanguageCatalog = api;

  const isDm = Boolean(document.body?.classList.contains("on-game-dashboard") || document.getElementById("dashboard-actores"));
  init({ seedDefaults: isDm });
})(window);
