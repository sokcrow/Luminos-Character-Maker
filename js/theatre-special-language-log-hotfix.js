(function (root, factory) {
  const api = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function resolveLogMessageText(message, definitions, profiles, rules) {
    const raw = String(message?.mensaje || message?.message || "");
    const languageId = clean(message?.idiomaId || message?.languageId || message?.idioma);
    if (!languageId || !rules) return raw;
    const definition = definitions?.[languageId] || {};
    if (!rules.isSpecialLanguage?.(languageId, definition)) return raw;
    return rules.resolveSpecialUnderstanding?.(profiles, languageId)
      ? raw
      : rules.unknownTextForDefinition?.(definition) || "[No comprendes este lenguaje especial.]";
  }

  const api = Object.freeze({ resolveLogMessageText });
  if (!global?.document || !global?.firebase?.database) return api;
  if (global.LuminousSpecialLanguageLogEnforcement) return global.LuminousSpecialLanguageLogEnforcement;
  global.LuminousSpecialLanguageLogEnforcement = api;

  const doc = global.document;
  const db = global.firebase.database();
  const languageRoots = ["campaña/idiomas", "campaña/teatro/idiomas"];
  const languageSources = {};
  let definitions = {};
  let players = {};
  let logEntries = [];
  let logRef = null;
  let logListener = null;
  let boundLogPath = null;
  let observer = null;
  let observedContainer = null;
  let applying = false;
  let timer = null;

  function isDmView() {
    return Boolean(doc.body?.classList.contains("on-game-dashboard"));
  }

  function normalizeIdList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === "object") return Object.keys(value).sort().map((key) => value[key]).filter(Boolean).map(String);
    return [String(value)];
  }

  function authUser() {
    try { return global.firebase.auth?.().currentUser || null; } catch (_) { return null; }
  }

  function playerMatchesAuth(playerId, player, user) {
    if (!player || !user) return false;
    return playerId === user.uid
      || player.uid === user.uid
      || player.userId === user.uid
      || player.authUid === user.uid
      || Boolean(user.email && (player.email === user.email || player.correo === user.email));
  }

  function assignedActor() {
    try { return global.getAssignedTheatreActor?.() || null; } catch (_) { return null; }
  }

  function viewerProfiles() {
    const result = [];
    const seen = new Set();
    const push = (profile) => {
      if (!profile || typeof profile !== "object" || seen.has(profile)) return;
      seen.add(profile);
      result.push(profile);
    };

    const user = authUser();
    let matched = null;
    for (const [playerId, player] of Object.entries(players)) {
      if (playerMatchesAuth(playerId, player, user)) {
        matched = player;
        break;
      }
    }

    const actor = assignedActor();
    const actorIds = [actor?.actorId, actor?.id, actor?.identityId, actor?.identidadId].filter(Boolean).map(String);
    if (!matched && actor?.sourceId && players[actor.sourceId]) matched = players[actor.sourceId];
    if (!matched && actorIds.length) {
      for (const player of Object.values(players)) {
        const assigned = normalizeIdList(player?.actorIds || player?.actores || player?.actorId);
        if (actorIds.some((id) => assigned.includes(id))) {
          matched = player;
          break;
        }
      }
    }

    push(matched);
    push(actor);
    push(global.datosJugador);
    push(global.currentCharacterData);
    push(global.currentPlayerData);
    push(global.playerData);
    return result;
  }

  function rules() {
    return global.LuminousSpecialLanguageEnforcement || null;
  }

  function ensureObserver() {
    const container = doc.getElementById("theatre-log-container");
    if (!container) return null;
    if (observedContainer === container && observer) return container;
    observer?.disconnect();
    observedContainer = container;
    observer = new MutationObserver(() => {
      if (!applying) applyPrivacy();
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return container;
  }

  function applyPrivacy() {
    if (isDmView()) return;
    const activeRules = rules();
    const container = ensureObserver();
    if (!activeRules || !container || !logEntries.length) return;
    const rows = Array.from(container.querySelectorAll(".dialogue-scroll-area .dialogue-row"));
    if (!rows.length) return;
    const profiles = viewerProfiles();

    applying = true;
    try {
      logEntries.forEach(([messageId, message], index) => {
        const row = rows[index];
        if (!row) return;
        row.dataset.messageId = messageId;
        const paragraph = row.querySelector(".text-col p");
        if (!paragraph) return;
        const safeText = resolveLogMessageText(message, definitions, profiles, activeRules);
        if (paragraph.textContent !== safeText) paragraph.textContent = safeText;
        const languageId = clean(message?.idiomaId || message?.languageId || message?.idioma);
        const definition = definitions[languageId] || {};
        const blocked = Boolean(
          languageId
          && activeRules.isSpecialLanguage?.(languageId, definition)
          && !activeRules.resolveSpecialUnderstanding?.(profiles, languageId)
        );
        row.dataset.specialLanguageBlocked = blocked ? "true" : "false";
      });
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    if (isDmView()) return;
    if (typeof global.queueMicrotask === "function") global.queueMicrotask(applyPrivacy);
    else global.setTimeout(applyPrivacy, 0);
    global.setTimeout(applyPrivacy, 40);
  }

  function bindLog() {
    const path = global.LuminousTheatreState?.getPaths?.().log || "campaña/teatro/log";
    if (path === boundLogPath) return;
    if (logRef && logListener) logRef.off("value", logListener);
    boundLogPath = path;
    logRef = db.ref(path).limitToLast(20);
    logListener = (snapshot) => {
      logEntries = Object.entries(snapshot.val() || {});
      scheduleApply();
    };
    logRef.on("value", logListener);
  }

  languageRoots.forEach((root) => {
    db.ref(root).on("value", (snapshot) => {
      languageSources[root] = snapshot.val() || {};
      definitions = Object.assign({}, ...languageRoots.map((key) => languageSources[key] || {}));
      scheduleApply();
    });
  });

  db.ref("campaña/jugadores").on("value", (snapshot) => {
    players = snapshot.val() || {};
    scheduleApply();
  });

  function boot() {
    if (isDmView()) return;
    bindLog();
    ensureObserver();
    scheduleApply();
    if (!timer) {
      timer = global.setInterval(() => {
        bindLog();
        scheduleApply();
      }, 750);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  try { global.firebase.auth?.().onAuthStateChanged?.(scheduleApply); } catch (_) {}

  return api;
});
