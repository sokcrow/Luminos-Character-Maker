(function (root, factory) {
  const api = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const ACTOR_ROOTS = ["campaña/actores", "campaña/base_datos_npcs"];
  const NO_PORTRAIT_TYPES = new Set(["pensamiento", "narracion", "sistema"]);
  const ACTOR_LOG_TYPES = new Set(["dialogo", "actuar"]);

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizedType(message) {
    const raw = clean(message?.mensaje || message?.message);
    if (/^\/em(?:\s+|$)/i.test(raw)) return "actuar";
    const type = clean(message?.tipo_dialogo || message?.dialogueType || message?.type).toLowerCase();
    if (["actuar", "pensamiento", "narracion", "sistema", "dialogo"].includes(type)) return type;
    return "dialogo";
  }

  function iconFromActor(record) {
    return clean(record?.icono)
      || clean(record?.icono_jugador)
      || clean(record?.icon_url)
      || clean(record?.avatar)
      || "";
  }

  function sameAsset(a, b) {
    const left = clean(a);
    const right = clean(b);
    return Boolean(left && right && left === right);
  }

  function normalizeInterventionMessage(message, sceneActor) {
    if (!message || typeof message !== "object") return message;
    const next = { ...message };
    const actor = sceneActor && typeof sceneActor === "object" ? sceneActor : {};
    const type = normalizedType(next);
    next.tipo_dialogo = type;

    if (type === "actuar") {
      const text = clean(next.mensaje || next.message);
      if (text && !/^\/em(?:\s+|$)/i.test(text)) next.mensaje = `/em ${text}`;
      if (!clean(next.sprite)) next.sprite = clean(actor.sprite || actor.url) || null;
      if (!clean(next.expression)) next.expression = clean(actor.expresionPreparada || actor.expresionActiva) || null;
      if (!clean(next.icono)) next.icono = iconFromActor(actor) || null;
    }

    if (type === "narracion" || type === "sistema") {
      next.actorId = null;
      next.sprite = null;
      next.expression = null;
      next.icono = null;
    }

    // Only spoken dialogue may present a nameplate. Actions still keep actor identity
    // in the payload/log, while thoughts, narration and system copy are anonymous rows.
    if (type !== "dialogo") next.mostrar_identidad = false;
    else if (next.mostrar_identidad === undefined) next.mostrar_identidad = true;

    return next;
  }

  function mergeCatalogs(actorCatalogs) {
    return Object.assign({}, ...(actorCatalogs || []).filter((entry) => entry && typeof entry === "object"));
  }

  function resolveCanonicalActorIcon(message, sceneActors, actorCatalogs) {
    const msg = message || {};
    const actors = sceneActors && typeof sceneActors === "object" ? sceneActors : {};
    const catalog = mergeCatalogs(actorCatalogs);
    const actorId = clean(msg.actorId);
    const liveActor = actorId ? actors[actorId] || null : null;

    const stableIds = [
      clean(liveActor?.identityId),
      clean(liveActor?.identidadId),
      clean(liveActor?.sourceActorId),
      clean(liveActor?.sourceId),
      clean(msg.identityId),
      clean(msg.identidadId),
      clean(msg.sourceActorId),
      clean(msg.sourceId),
      actorId,
    ].filter(Boolean);

    for (const stableId of stableIds) {
      const icon = iconFromActor(catalog[stableId]);
      if (icon) return icon;
    }

    const targetName = clean(msg.nombre || liveActor?.nombre).toLowerCase();
    if (targetName) {
      const byName = Object.values(catalog).find((actor) => clean(actor?.nombre).toLowerCase() === targetName);
      const icon = iconFromActor(byName);
      if (icon) return icon;
    }

    const liveIcon = iconFromActor(liveActor);
    if (liveIcon && !sameAsset(liveIcon, liveActor?.sprite || liveActor?.url)) return liveIcon;

    // Archived icon is accepted only as a final historical fallback and never when
    // it is the same asset as the scene sprite. Sprite itself is never a fallback.
    const archivedIcon = iconFromActor(msg);
    if (archivedIcon && !sameAsset(archivedIcon, msg.sprite)) return archivedIcon;
    return "";
  }

  function logPresentation(message) {
    const type = normalizedType(message);
    return {
      type,
      showActor: ACTOR_LOG_TYPES.has(type),
      centered: NO_PORTRAIT_TYPES.has(type),
      showPortrait: ACTOR_LOG_TYPES.has(type),
      showNameplate: type === "dialogo" && message?.mostrar_identidad !== false,
    };
  }

  function initials(name) {
    return (clean(name) || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";
  }

  function initialsIcon(name) {
    const text = initials(name).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="#111111"/><text x="40" y="49" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="#d7c8aa">${text}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  const api = Object.freeze({
    normalizedType,
    normalizeInterventionMessage,
    resolveCanonicalActorIcon,
    logPresentation,
    iconFromActor,
  });

  const doc = global?.document;
  const firebase = global?.firebase;
  if (!doc || !firebase?.database) return api;
  if (global.LuminousTheatreInterventionUx) return global.LuminousTheatreInterventionUx;
  global.LuminousTheatreInterventionUx = api;

  const db = firebase.database();
  const actorCatalogs = {};
  let sceneActors = {};
  let logEntries = [];
  let logRef = null;
  let logListener = null;
  let logPath = null;
  let sceneRef = null;
  let sceneListener = null;
  let scenePath = null;
  let logObserver = null;
  let observedLog = null;
  let decoratingLog = false;
  let repairTimer = null;
  let installTimer = null;

  function isDmView() {
    return Boolean(doc.body?.classList.contains("on-game-dashboard"));
  }

  function theatre() {
    return global.LuminousTheatreState || null;
  }

  function currentPaths() {
    return theatre()?.getPaths?.() || {
      scene: "campaña/estado_mundo/escena_actual",
      queue: "campaña/teatro/cola",
      log: "campaña/teatro/log",
    };
  }

  function ensureStyles() {
    if (doc.getElementById("theatre-intervention-ux-stylesheet")) return;
    const link = doc.createElement("link");
    link.id = "theatre-intervention-ux-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/theatre-intervention-ux.css";
    link.dataset.ui = "theatre-intervention-ux";
    doc.head?.appendChild(link);
  }

  function ensureActuarOption(select) {
    if (!select || Array.from(select.options || []).some((option) => option.value === "actuar")) return select;
    const option = doc.createElement("option");
    option.value = "actuar";
    option.textContent = "Actuar";
    const dialogue = Array.from(select.options || []).find((entry) => entry.value === "dialogo");
    if (dialogue?.nextSibling) select.insertBefore(option, dialogue.nextSibling);
    else select.appendChild(option);
    return select;
  }

  function ensureComposerOptions() {
    ensureActuarOption(doc.getElementById("dm-tipo-dialogo-select"));
    ensureActuarOption(doc.getElementById("player-tipo-dialogo-select"));
  }

  function normalizeComposerBeforeSend(event) {
    const button = event.target?.closest?.("#btn-send-dialogue, #btn-enviar-teatro-modal");
    if (!button) return;
    const dm = Boolean(button.id === "btn-send-dialogue");
    const select = doc.getElementById(dm ? "dm-tipo-dialogo-select" : "player-tipo-dialogo-select");
    const textNode = doc.getElementById(dm ? "theatre-dialogue-input" : "theatre-message-input")
      || (!dm ? doc.querySelector("#modal-escritura textarea") : null);
    const text = clean(textNode?.value);
    if (/^\/em(?:\s+|$)/i.test(text) && select) select.value = "actuar";
  }

  function bindScene() {
    const path = currentPaths().scene;
    if (!path || path === scenePath) return;
    if (sceneRef && sceneListener) sceneRef.off("value", sceneListener);
    scenePath = path;
    sceneRef = db.ref(path);
    sceneListener = (snapshot) => {
      sceneActors = snapshot.val()?.actores || {};
      scheduleLogDecoration();
      scheduleRepair();
    };
    sceneRef.on("value", sceneListener);
  }

  function bindActorCatalogs() {
    ACTOR_ROOTS.forEach((root) => {
      db.ref(root).on("value", (snapshot) => {
        actorCatalogs[root] = snapshot.val() || {};
        scheduleLogDecoration();
        scheduleRepair();
      });
    });
  }

  function catalogs() {
    // Legacy first, modern last: the modern actor database wins collisions.
    return ACTOR_ROOTS.map((root) => actorCatalogs[root] || {});
  }

  function patchEnqueue() {
    const state = theatre();
    if (!state?.enqueueIntervention || state.__luminousInterventionUxPatched) return false;
    const original = state.enqueueIntervention.bind(state);
    state.enqueueIntervention = async function (message) {
      bindScene();
      const actorId = clean(message?.actorId);
      let actor = actorId ? sceneActors[actorId] || null : null;
      if (!actor && actorId) {
        try {
          const snapshot = await db.ref(`${currentPaths().scene}/actores/${actorId}`).once("value");
          actor = snapshot.val() || null;
        } catch (_) {}
      }
      return original(normalizeInterventionMessage(message, actor));
    };
    state.__luminousInterventionUxPatched = true;
    return true;
  }

  function patchDirectQueueWrites() {
    if (db.__luminousInterventionUxRefPatched) return;
    const originalRef = db.ref.bind(db);
    db.ref = function (path) {
      const ref = originalRef.apply(db, arguments);
      const normalized = String(path || "").replace(/^\/+|\/+$/g, "");
      const expected = String(currentPaths().queue || "campaña/teatro/cola").replace(/^\/+|\/+$/g, "");
      if (normalized !== expected || ref.__luminousInterventionUxPushPatched) return ref;
      const originalPush = ref.push.bind(ref);
      ref.push = function (value) {
        const actorId = clean(value?.actorId);
        const actor = actorId ? sceneActors[actorId] || null : null;
        const next = normalizeInterventionMessage(value, actor);
        return originalPush.apply(ref, [next].concat(Array.prototype.slice.call(arguments, 1)));
      };
      ref.__luminousInterventionUxPushPatched = true;
      return ref;
    };
    db.__luminousInterventionUxRefPatched = true;
  }

  function ensureLogObserver() {
    const container = doc.getElementById("theatre-log-container");
    if (!container || isDmView()) return null;
    if (container === observedLog && logObserver) return container;
    logObserver?.disconnect();
    observedLog = container;
    logObserver = new MutationObserver(() => {
      if (!decoratingLog) scheduleLogDecoration();
    });
    logObserver.observe(container, { childList: true, subtree: true });
    return container;
  }

  function decorateLog() {
    if (isDmView()) return;
    const container = ensureLogObserver();
    if (!container || !logEntries.length) return;
    const rows = Array.from(container.querySelectorAll(".dialogue-scroll-area .dialogue-row"));
    if (!rows.length) return;
    decoratingLog = true;
    try {
      logEntries.forEach(([messageId, message], index) => {
        const row = rows[index];
        if (!row) return;
        const presentation = logPresentation(message);
        row.dataset.messageId = messageId;
        row.dataset.dialogueType = presentation.type;
        row.classList.toggle("is-dialogue", presentation.type === "dialogo");
        row.classList.toggle("is-action", presentation.type === "actuar");
        row.classList.toggle("is-thought", presentation.type === "pensamiento");
        row.classList.toggle("is-narration", presentation.type === "narracion");
        row.classList.toggle("is-system", presentation.type === "sistema");
        row.classList.toggle("is-centered-log-entry", presentation.centered);

        const characterCol = row.querySelector(".character-col");
        if (!presentation.showPortrait) {
          characterCol?.remove();
          return;
        }

        const image = characterCol?.querySelector(".hex-portrait img");
        if (!image) return;
        const icon = resolveCanonicalActorIcon(message, sceneActors, catalogs());
        const safeIcon = icon || initialsIcon(message?.nombre || "?");
        if (image.getAttribute("src") !== safeIcon) image.src = safeIcon;
        image.dataset.actorIcon = icon ? "canonical" : "initials";
      });
    } finally {
      decoratingLog = false;
    }
  }

  function scheduleLogDecoration() {
    if (isDmView()) return;
    if (typeof global.queueMicrotask === "function") global.queueMicrotask(decorateLog);
    else global.setTimeout(decorateLog, 0);
    global.setTimeout(decorateLog, 40);
  }

  function repairLogIcons() {
    if (!isDmView() || !logEntries.length) return Promise.resolve();
    const tasks = [];
    logEntries.forEach(([messageId, message]) => {
      if (!ACTOR_LOG_TYPES.has(normalizedType(message))) return;
      const icon = resolveCanonicalActorIcon(message, sceneActors, catalogs());
      if (!icon || clean(message?.icono) === icon) return;
      tasks.push(db.ref(`${currentPaths().log}/${messageId}`).update({ icono: icon }));
    });
    return Promise.all(tasks);
  }

  function scheduleRepair() {
    if (!isDmView()) return;
    global.clearTimeout(repairTimer);
    repairTimer = global.setTimeout(() => {
      repairLogIcons().catch((error) => console.warn("No se pudieron normalizar iconos del Theatre Log:", error));
    }, 120);
  }

  function bindLog() {
    const path = currentPaths().log;
    if (!path || path === logPath) return;
    if (logRef && logListener) logRef.off("value", logListener);
    logPath = path;
    logRef = db.ref(path).limitToLast(20);
    logListener = (snapshot) => {
      logEntries = Object.entries(snapshot.val() || {});
      scheduleLogDecoration();
      scheduleRepair();
    };
    logRef.on("value", logListener);
  }

  function install() {
    ensureStyles();
    ensureComposerOptions();
    bindScene();
    bindLog();
    patchEnqueue();
    patchDirectQueueWrites();
    ensureLogObserver();
    return true;
  }

  bindActorCatalogs();
  doc.addEventListener("click", normalizeComposerBeforeSend, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.id === "dm-tipo-dialogo-select" || event.target?.id === "player-tipo-dialogo-select") ensureComposerOptions();
  });
  global.addEventListener?.("actoresCacheUpdated", scheduleLogDecoration);

  install();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
  installTimer = global.setInterval(() => {
    install();
    if (doc.getElementById("dm-tipo-dialogo-select") || doc.getElementById("player-tipo-dialogo-select")) {
      if (patchEnqueue()) scheduleLogDecoration();
    }
  }, 750);

  return api;
});
