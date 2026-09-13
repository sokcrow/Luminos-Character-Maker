(function (global) {
  "use strict";

  const doc = global.document;
  const firebase = global.firebase;
  if (!doc?.body?.classList?.contains("on-game-dashboard")) return;
  if (!firebase?.database || global.LuminousDmStartupGate) return;

  const db = firebase.database();
  if (!db?.ref || db.__luminousDmStartupGateInstalled) return;

  const originalRef = db.ref.bind(db);
  const queued = [];
  let opened = false;

  const ALWAYS_LIVE_PATHS = new Set([
    ".info/connected",
    "campaña/estado_mundo/instancia_activa",
  ]);

  function normalizePath(value) {
    return String(value ?? "")
      .replace(/^https?:\/\/[^/]+\//i, "")
      .replace(/^\/+|\/+$/g, "");
  }

  function shouldPass(path) {
    return opened || ALWAYS_LIVE_PATHS.has(normalizePath(path));
  }

  function removeQueued(query, eventType, callback) {
    for (let index = queued.length - 1; index >= 0; index -= 1) {
      const entry = queued[index];
      if (entry.query !== query) continue;
      if (eventType && entry.args[0] !== eventType) continue;
      if (callback && entry.args[1] !== callback) continue;
      queued.splice(index, 1);
    }
  }

  const CHAIN_METHODS = [
    "orderByChild",
    "orderByKey",
    "orderByPriority",
    "orderByValue",
    "startAt",
    "startAfter",
    "endAt",
    "endBefore",
    "equalTo",
    "limitToFirst",
    "limitToLast",
  ];

  function wrapQuery(query, path) {
    if (!query || query.__luminousDmStartupGateWrapped) return query;

    const originalOn = typeof query.on === "function" ? query.on.bind(query) : null;
    const originalOff = typeof query.off === "function" ? query.off.bind(query) : null;
    if (!originalOn) return query;

    try {
      Object.defineProperty(query, "__luminousDmStartupGateWrapped", {
        value: true,
        configurable: true,
      });

      query.on = function () {
        const args = Array.from(arguments);
        if (shouldPass(path)) return originalOn.apply(query, args);
        queued.push({ query, path, originalOn, args });
        return args[1];
      };

      if (originalOff) {
        query.off = function (eventType, callback, context) {
          removeQueued(query, eventType, callback);
          return originalOff(eventType, callback, context);
        };
      }

      CHAIN_METHODS.forEach((method) => {
        if (typeof query[method] !== "function") return;
        const originalMethod = query[method].bind(query);
        query[method] = function () {
          return wrapQuery(originalMethod.apply(query, arguments), path);
        };
      });
    } catch (error) {
      console.warn("DM startup gate could not wrap a Firebase query:", error);
    }
    return query;
  }

  db.ref = function (path) {
    return wrapQuery(originalRef.apply(db, arguments), normalizePath(path));
  };
  db.__luminousDmStartupGateInstalled = true;

  function flush() {
    if (opened) return 0;
    opened = true;
    const pending = queued.splice(0);
    pending.forEach((entry) => {
      try {
        entry.originalOn.apply(entry.query, entry.args);
      } catch (error) {
        console.error("DM startup gate could not attach a deferred Firebase listener:", error);
      }
    });
    console.info(`[DM Startup Gate] Theatre runtime released ${pending.length} deferred listener(s).`);
    return pending.length;
  }

  function theatreIsActive() {
    return Boolean(doc.getElementById("modulo-teatro")?.classList?.contains("active-module"));
  }

  const theatreModule = doc.getElementById("modulo-teatro");
  if (theatreModule) {
    const observer = new MutationObserver(() => {
      if (theatreIsActive()) {
        flush();
        observer.disconnect();
      }
    });
    observer.observe(theatreModule, { attributes: true, attributeFilter: ["class"] });
  }

  if (theatreIsActive()) flush();

  global.LuminousDmStartupGate = Object.freeze({
    flush,
    isOpen: () => opened,
    queuedCount: () => queued.length,
  });
})(window);
