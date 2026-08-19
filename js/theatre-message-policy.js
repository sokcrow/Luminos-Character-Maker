(function (global) {
  "use strict";

  const theatre = global.LuminousTheatreState;
  const firebase = global.firebase;
  if (!theatre || !firebase?.database || typeof theatre.publishIntervention !== "function") return;
  if (global.LuminousTheatreMessagePolicy) return;

  const db = firebase.database();
  const CONFIG_PATH = "campaña/config/theatre_messages";
  const DEFAULTS = Object.freeze({ mode: "auto", speedMs: 30, holdMs: 3000 });
  let config = { ...DEFAULTS };
  let releaseCurrent = null;
  let currentMessage = null;
  const originalPublish = theatre.publishIntervention.bind(theatre);

  function clamp(value, min, max, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }

  function normalize(next) {
    const mode = String(next?.mode || next?.modo || DEFAULTS.mode).toLowerCase() === "manual" ? "manual" : "auto";
    return {
      mode,
      speedMs: Math.round(clamp(next?.speedMs, 1, 250, DEFAULTS.speedMs)),
      holdMs: Math.round(clamp(next?.holdMs, 0, 30000, DEFAULTS.holdMs)),
    };
  }

  function calculateDuration(message) {
    return (String(message?.mensaje || "").length * config.speedMs) + config.holdMs;
  }

  function refreshUi() {
    const mode = document.getElementById("theatre-message-policy-mode");
    const speed = document.getElementById("theatre-message-policy-speed");
    const hold = document.getElementById("theatre-message-policy-hold");
    const next = document.getElementById("btn-theatre-message-next");
    const status = document.getElementById("theatre-message-policy-status");
    if (mode) mode.value = config.mode;
    if (speed) speed.value = config.speedMs;
    if (hold) hold.value = (config.holdMs / 1000).toFixed(1).replace(/\.0$/, "");
    if (next) next.disabled = !releaseCurrent;
    if (status) status.textContent = releaseCurrent ? "WAIT" : (config.mode === "manual" ? "MANUAL" : "AUTO");
  }

  function advance() {
    if (!releaseCurrent) return false;
    const release = releaseCurrent;
    releaseCurrent = null;
    currentMessage = null;
    release();
    refreshUi();
    return true;
  }

  theatre.publishIntervention = async function (messageKey, message) {
    if (!message || typeof message !== "object") return originalPublish(messageKey, message);
    message.speedMs = config.speedMs;
    message.durationMs = config.mode === "manual" ? 0 : calculateDuration(message);
    const result = await originalPublish(messageKey, message);

    if (result?.published && config.mode === "manual") {
      currentMessage = { messageKey, message };
      await new Promise((resolve) => {
        releaseCurrent = resolve;
        refreshUi();
      });
    }
    return result;
  };

  function saveConfig() {
    const mode = document.getElementById("theatre-message-policy-mode")?.value || DEFAULTS.mode;
    const speedMs = clamp(document.getElementById("theatre-message-policy-speed")?.value, 1, 250, DEFAULTS.speedMs);
    const holdSeconds = clamp(document.getElementById("theatre-message-policy-hold")?.value, 0, 30, DEFAULTS.holdMs / 1000);
    return db.ref(CONFIG_PATH).set({ mode, speedMs: Math.round(speedMs), holdMs: Math.round(holdSeconds * 1000) });
  }

  function ensureUi() {
    if (!document.body?.classList.contains("on-game-dashboard")) return;
    const host = document.querySelector("#modulo-teatro .theatre-controls");
    if (!host || document.getElementById("theatre-message-policy")) return;

    const panel = document.createElement("section");
    panel.id = "theatre-message-policy";
    panel.className = "theatre-message-policy";
    panel.innerHTML = `
      <div class="tmp-head"><span>MESSAGE FLOW</span><code id="theatre-message-policy-status">AUTO</code></div>
      <div class="tmp-grid">
        <label><span>MODO</span><select id="theatre-message-policy-mode"><option value="auto">AUTO</option><option value="manual">MANUAL</option></select></label>
        <label><span>TYPE / MS</span><input id="theatre-message-policy-speed" type="number" min="1" max="250" step="1"></label>
        <label><span>HOLD / S</span><input id="theatre-message-policy-hold" type="number" min="0" max="30" step="0.5"></label>
        <button id="btn-theatre-message-next" type="button" aria-label="Avanzar al siguiente mensaje" title="Avanzar al siguiente mensaje" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l10 8L5 20z"/><path d="M18 5v14"/></svg>
          <span>NEXT</span>
        </button>
      </div>
    `;
    host.insertBefore(panel, host.querySelector("textarea") || host.firstChild);
    panel.querySelector("#btn-theatre-message-next")?.addEventListener("click", advance);
    ["theatre-message-policy-mode", "theatre-message-policy-speed", "theatre-message-policy-hold"].forEach((id) => {
      panel.querySelector(`#${id}`)?.addEventListener("change", saveConfig);
    });
    refreshUi();
  }

  db.ref(CONFIG_PATH).on("value", (snapshot) => {
    const previousMode = config.mode;
    config = normalize(snapshot.val() || DEFAULTS);
    if (previousMode === "manual" && config.mode !== "manual" && releaseCurrent) advance();
    refreshUi();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureUi, { once: true });
  else ensureUi();

  global.LuminousTheatreMessagePolicy = Object.freeze({
    CONFIG_PATH,
    defaults: DEFAULTS,
    getConfig: () => ({ ...config }),
    calculateDuration,
    advance,
    getCurrentMessage: () => currentMessage,
  });
})(window);
