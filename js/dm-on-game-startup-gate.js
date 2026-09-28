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
  const LAST_MARKER_KEY = "luminous.dm.theatre.last-listener";
  const GATE_SCRIPT = "dm-on-game-startup-gate.js";
  let coreOpen = false;
  let allOpen = false;
  let coreReleaseRunning = false;
  let optionalReleaseRunning = false;

  const ALWAYS_LIVE_PATHS = new Set([
    ".info/connected",
    "campaña/estado_mundo/instancia_activa",
  ]);

  function normalizePath(value) {
    return String(value ?? "")
      .replace(/^https?:\/\/[^/]+\//i, "")
      .replace(/^\/+|\/+$/g, "");
  }

  function sourceFromStack() {
    try {
      const stack = String(new Error().stack || "");
      for (const line of stack.split("\n")) {
        const match = line.match(/\/js\/([^/?#:()\s]+\.js)/i);
        if (!match) continue;
        if (match[1] === GATE_SCRIPT) continue;
        return match[1];
      }
    } catch (_) {}
    return "unknown";
  }

  function isCorePath(path) {
    const normalized = normalizePath(path);
    if (normalized === "campaña/estado_mundo/escena_actual") return true;
    if (normalized === "campaña/estado_mundo/dialogo_activo") return true;
    if (normalized === "campaña/teatro/cola") return true;
    return /^campaña\/teatro\/salas\/[^/]+\/(?:escena|dialogo_activo|cola)$/.test(normalized);
  }

  function isCoreEntry(entry) {
    if (!entry) return false;
    if (!isCorePath(entry.path)) return false;
    if (entry.source === "theatre-engine.js") return true;
    if (entry.source === "on-game-dashboard.js") return true;
    // Keep exact scene/dialogue/queue listeners usable even if a browser omits the
    // caller URL from Error.stack. Child paths stay quarantined as auxiliary UI.
    return entry.source === "unknown";
  }

  function shouldPass(path, source) {
    const normalized = normalizePath(path);
    if (ALWAYS_LIVE_PATHS.has(normalized)) return true;
    if (allOpen) return true;
    if (!coreOpen) return false;
    return isCoreEntry({ path: normalized, source });
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
        const source = sourceFromStack();
        if (shouldPass(path, source)) return originalOn.apply(query, args);
        queued.push({ query, path: normalizePath(path), source, originalOn, args });
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

  function runtimeStatusNode() {
    let node = doc.getElementById("dm-runtime-status");
    if (node) return node;
    const host = doc.querySelector(".status-container");
    if (!host) return null;
    node = doc.createElement("span");
    node.id = "dm-runtime-status";
    node.style.cssText = "font:700 10px 'Share Tech Mono',monospace;color:#8a96a3;letter-spacing:.05em;white-space:nowrap;";
    host.appendChild(node);
    return node;
  }

  function setStatus(text, tone) {
    const node = runtimeStatusNode();
    if (!node) return;
    node.textContent = text || "";
    node.style.color = tone === "ok" ? "#7aff9b" : tone === "warn" ? "#e6c56c" : tone === "error" ? "#ff6575" : "#8a96a3";
  }

  function markEntry(entry, phase) {
    const marker = {
      phase,
      source: entry?.source || "unknown",
      path: entry?.path || "",
      event: entry?.args?.[0] || "",
      at: Date.now(),
    };
    try {
      global.localStorage?.setItem(LAST_MARKER_KEY, JSON.stringify(marker));
    } catch (_) {}
    setStatus(`${phase.toUpperCase()}: ${marker.source} · ${marker.path}`, "warn");
  }

  function markPhaseComplete(phase) {
    try {
      global.localStorage?.setItem(LAST_MARKER_KEY, JSON.stringify({ phase: `${phase}-complete`, at: Date.now() }));
    } catch (_) {}
  }

  function reportPreviousMarker() {
    try {
      const raw = global.localStorage?.getItem(LAST_MARKER_KEY);
      if (!raw) return;
      const marker = JSON.parse(raw);
      if (!marker?.source || String(marker.phase || "").endsWith("-complete")) return;
      setStatus(`ÚLTIMO: ${marker.source} · ${marker.path}`, "error");
      console.warn("[DM Startup Gate] Último listener marcado antes de la recarga/crash:", marker);
    } catch (_) {}
  }

  function attachEntry(entry, phase) {
    markEntry(entry, phase);
    try {
      entry.originalOn.apply(entry.query, entry.args);
      return true;
    } catch (error) {
      console.error("DM startup gate could not attach a deferred Firebase listener:", entry.source, entry.path, error);
      return false;
    }
  }

  function takeNext(predicate) {
    const index = queued.findIndex(predicate);
    if (index < 0) return null;
    return queued.splice(index, 1)[0];
  }

  function releaseCoreStaged() {
    if (coreReleaseRunning || coreOpen) return;
    coreReleaseRunning = true;
    coreOpen = true;
    setStatus("THEATRE CORE · INICIANDO", "warn");

    const step = () => {
      const entry = takeNext(isCoreEntry);
      if (!entry) {
        coreReleaseRunning = false;
        markPhaseComplete("core");
        setStatus(`THEATRE CORE OK · ${queued.length} AUX EN PAUSA`, "ok");
        console.info(`[DM Startup Gate] Theatre core activo. ${queued.length} listener(s) auxiliares siguen en cuarentena.`);
        return;
      }
      attachEntry(entry, "core");
      global.setTimeout(step, 350);
    };
    step();
  }

  function releaseOptionalStaged() {
    if (optionalReleaseRunning || allOpen) return;
    optionalReleaseRunning = true;
    setStatus(`THEATRE AUX · ${queued.length} PENDIENTES`, "warn");

    const step = () => {
      const entry = queued.shift() || null;
      if (!entry) {
        optionalReleaseRunning = false;
        allOpen = true;
        markPhaseComplete("aux");
        setStatus("THEATRE READY", "ok");
        console.info("[DM Startup Gate] Todos los listeners auxiliares de Theatre fueron liberados de forma escalonada.");
        return;
      }
      attachEntry(entry, "aux");
      global.setTimeout(step, 250);
    };
    step();
  }

  function flush() {
    coreOpen = true;
    allOpen = true;
    coreReleaseRunning = false;
    optionalReleaseRunning = false;
    const pending = queued.splice(0);
    pending.forEach((entry) => attachEntry(entry, "manual"));
    markPhaseComplete("manual");
    setStatus("THEATRE READY", "ok");
    return pending.length;
  }

  function theatreIsActive() {
    return Boolean(doc.getElementById("modulo-teatro")?.classList?.contains("active-module"));
  }

  function bindDirectorMenuRelease() {
    const menu = doc.querySelector("#modulo-teatro > .theatre-dm-menu");
    if (!menu || menu.dataset.startupGateBound === "true") return;
    menu.dataset.startupGateBound = "true";
    menu.addEventListener("toggle", () => {
      if (menu.open) releaseOptionalStaged();
    });
  }

  reportPreviousMarker();
  bindDirectorMenuRelease();

  const theatreModule = doc.getElementById("modulo-teatro");
  if (theatreModule) {
    const observer = new MutationObserver(() => {
      if (theatreIsActive()) releaseCoreStaged();
    });
    observer.observe(theatreModule, { attributes: true, attributeFilter: ["class"] });
  }

  if (theatreIsActive()) releaseCoreStaged();

  global.LuminousDmStartupGate = Object.freeze({
    flush,
    releaseCore: releaseCoreStaged,
    releaseAux: releaseOptionalStaged,
    isCoreOpen: () => coreOpen,
    isOpen: () => allOpen,
    queuedCount: () => queued.length,
  });
})(window);
