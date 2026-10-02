(function (global) {
  "use strict";

  if (global.LuminousTheatrePlayerNotifications) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousTheatrePlayerNotifications;
    return;
  }

  const EFFECT_ROOT = "campaña/efectos_dm";
  const PLAYERS_ROOT = "campaña/jugadores";
  const TOAST_ID = "luminous-player-notification-toast";
  const state = { db: null, auth: null, players: {}, effects: {}, started: false };

  const clean = (value) => String(value ?? "").trim();

  function playerUid(player = {}) {
    return clean(player.uid || player.authUid || player.auth_uid || player.firebaseUid || player.firebase_uid);
  }

  function currentPlayerId() {
    const direct = global.datosJugador || global.playerData || {};
    const candidate = clean(
      direct.playerId
      || direct.player_id
      || direct.idJugador
      || direct.id_jugador
      || direct.canonicalPlayerKey
      || direct.vinculo_jugador
    );
    if (candidate && state.players[candidate]) return candidate;

    const uid = clean(state.auth?.currentUser?.uid || global.firebase?.auth?.()?.currentUser?.uid);
    if (uid) {
      const match = Object.entries(state.players).find(([, player]) => playerUid(player) === uid);
      if (match) return match[0];
    }
    return candidate || null;
  }

  function seenKey(effect = {}) {
    return `luminous.alarm.seen.${clean(effect.id)}.${Number(effect.consumedAt || 0)}`;
  }

  function wasSeen(effect) {
    try { return global.localStorage?.getItem(seenKey(effect)) === "1"; } catch (_) { return false; }
  }

  function markSeen(effect) {
    try { global.localStorage?.setItem(seenKey(effect), "1"); } catch (_) {}
  }

  function ensureToast() {
    const doc = global.document;
    if (!doc?.body) return null;
    let toast = doc.getElementById(TOAST_ID);
    if (toast) return toast;
    toast = doc.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "assertive");
    toast.style.cssText = "position:fixed;right:18px;top:18px;z-index:25000;max-width:min(420px,calc(100vw - 36px));padding:14px 16px;border:1px solid #d3ad58;background:#090d14;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.7);font:700 14px Arial,sans-serif;display:none;";
    doc.body.appendChild(toast);
    return toast;
  }

  function showNotification(message) {
    const text = clean(message);
    if (!text) return false;
    const toast = ensureToast();
    if (!toast) return false;
    toast.textContent = text;
    toast.style.display = "block";
    global.clearTimeout?.(toast.__luminousHideTimer);
    toast.__luminousHideTimer = global.setTimeout?.(() => { toast.style.display = "none"; }, 8000);
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:player-notification", { detail: { message: text } })); } catch (_) {}
    return true;
  }

  function notificationForEffect(effect = {}, playerId = currentPlayerId()) {
    if (clean(effect.kind).toLowerCase() !== "alarm") return null;
    if (!effect.triggered || !Number(effect.consumedAt || 0)) return null;
    if (!playerId || clean(effect.subjectPlayerId) !== clean(playerId)) return null;
    return clean(effect.triggerMessage) || (clean(effect.mode).toLowerCase() === "audible"
      ? "Your audible Alarm was triggered."
      : "Your Alarm was triggered.");
  }

  function processEffects() {
    const playerId = currentPlayerId();
    if (!playerId) return 0;
    let shown = 0;
    for (const effect of Object.values(state.effects || {})) {
      const message = notificationForEffect(effect, playerId);
      if (!message || wasSeen(effect)) continue;
      if (showNotification(message)) {
        markSeen(effect);
        shown += 1;
      }
    }
    return shown;
  }

  function init(options = {}) {
    if (state.started) return true;
    state.db = options.db || (global.firebase?.database && global.firebase.apps?.length ? global.firebase.database() : null);
    state.auth = options.auth || (global.firebase?.auth && global.firebase.apps?.length ? global.firebase.auth() : null);
    if (!state.db?.ref) return false;
    state.started = true;
    state.db.ref(PLAYERS_ROOT).on("value", (snapshot) => {
      state.players = snapshot.val() || {};
      processEffects();
    });
    state.db.ref(EFFECT_ROOT).on("value", (snapshot) => {
      state.effects = snapshot.val() || {};
      processEffects();
    });
    state.auth?.onAuthStateChanged?.(() => processEffects());
    return true;
  }

  const api = Object.freeze({
    EFFECT_ROOT,
    PLAYERS_ROOT,
    state,
    playerUid,
    currentPlayerId,
    notificationForEffect,
    processEffects,
    showNotification,
    init
  });

  global.LuminousTheatrePlayerNotifications = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    const boot = () => init();
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
