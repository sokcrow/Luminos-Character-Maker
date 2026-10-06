(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerMobileRuntime) return;

  const state = {
    installed: false,
    entered: false,
    mode: "game",
    gate: null,
    title: null,
    copy: null,
    button: null,
    standby: null,
    instance: "ninguno",
  };

  const fullscreenMedia = global.matchMedia?.("(display-mode: fullscreen)") || null;
  const standaloneMedia = global.matchMedia?.("(display-mode: standalone)") || null;

  function isPhoneDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(navigator.userAgent || "");
  }

  function isLandscape() {
    return global.matchMedia?.("(orientation: landscape)")?.matches === true;
  }

  function isPortrait() {
    return global.matchMedia?.("(orientation: portrait)")?.matches === true;
  }

  function fullscreenElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function isFullscreenLike() {
    return Boolean(
      fullscreenElement()
      || fullscreenMedia?.matches
      || standaloneMedia?.matches
      || navigator.standalone === true
    );
  }

  async function requestFullscreen() {
    if (isFullscreenLike()) return true;

    const target = doc.documentElement;
    const request =
      target.requestFullscreen
      || target.webkitRequestFullscreen
      || target.msRequestFullscreen;

    if (typeof request !== "function") return false;

    try {
      await request.call(target, { navigationUI: "hide" });
      return true;
    } catch (_) {
      try {
        await request.call(target);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  async function lockOrientation(mode) {
    const orientation = global.screen?.orientation;
    if (!orientation || typeof orientation.lock !== "function") return false;

    try {
      await orientation.lock(mode);
      return true;
    } catch (_) {
      return false;
    }
  }

  function buildGate() {
    if (state.gate) return state.gate;

    const gate = doc.createElement("section");
    gate.id = "player-mobile-entry-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-label", "Preparar juego en pantalla completa");

    const card = doc.createElement("div");
    card.className = "player-mobile-entry-card";

    const title = doc.createElement("h1");
    title.className = "player-mobile-entry-title";

    const copy = doc.createElement("p");
    copy.className = "player-mobile-entry-copy";

    const button = doc.createElement("button");
    button.id = "player-mobile-enter-game";
    button.type = "button";

    card.append(title, copy, button);
    gate.appendChild(card);
    doc.body.appendChild(gate);

    state.gate = gate;
    state.title = title;
    state.copy = copy;
    state.button = button;

    button.addEventListener("click", enterGame);
    return gate;
  }

  function buildStandby() {
    if (state.standby) return state.standby;

    const existing = doc.getElementById("player-mobile-standby");
    if (existing) {
      state.standby = existing;
      return existing;
    }

    const standby = doc.createElement("section");
    standby.id = "player-mobile-standby";
    standby.hidden = true;
    standby.setAttribute("aria-live", "polite");

    const card = doc.createElement("div");
    card.className = "player-mobile-standby-card";

    const title = doc.createElement("h2");
    title.className = "player-mobile-standby-title";
    title.textContent = "Esperando escena";

    const copy = doc.createElement("p");
    copy.className = "player-mobile-standby-copy";
    copy.textContent = "Cuando el Director active Teatro o Combate, aparecerá aquí.";

    card.append(title, copy);
    standby.appendChild(card);
    doc.body.appendChild(standby);
    state.standby = standby;
    return standby;
  }

  function syncStandby() {
    if (!isPhoneDevice()) return;
    const standby = buildStandby();
    const show = state.mode === "game" && state.entered && state.instance === "ninguno";
    standby.hidden = !show;

    const blackout = doc.getElementById("player-instance-blackout");
    if (blackout) {
      blackout.classList.remove("active");
      blackout.setAttribute("aria-hidden", "true");
    }
    doc.body?.classList.remove("player-instance-blackout");
  }

  function syncGate() {
    if (!isPhoneDevice()) return;

    buildGate();
    doc.body.classList.add("player-mobile-runtime");

    if (state.mode === "cellphone") {
      state.gate.hidden = true;
      syncStandby();
      return;
    }

    const fullscreenReady = isFullscreenLike();
    const landscapeReady = isLandscape();

    if (fullscreenReady && landscapeReady) {
      state.entered = true;
      state.gate.hidden = true;
      syncStandby();
      return;
    }

    state.gate.hidden = false;
    syncStandby();

    if (!fullscreenReady) {
      state.title.textContent = state.entered ? "Volver a pantalla completa" : "Entrar al juego";
      state.copy.textContent = "Limbus usa la pantalla completa del teléfono para el Teatro y el Combate.";
      state.button.textContent = state.entered ? "Volver a pantalla completa" : "Entrar al juego";
      return;
    }

    state.title.textContent = "Gira tu teléfono";
    state.copy.textContent = "El juego se usa en horizontal. Al abrir el Celular, cambiará a vertical.";
    state.button.textContent = "Usar en horizontal";
  }

  async function enterGame(event) {
    event?.preventDefault?.();

    state.entered = true;
    state.mode = "game";

    await requestFullscreen();
    await lockOrientation("landscape");

    global.setTimeout(syncGate, 0);
    global.setTimeout(syncGate, 240);
    return isFullscreenLike() && isLandscape();
  }

  async function setMode(mode, options = {}) {
    if (!isPhoneDevice()) return false;

    state.mode = mode === "cellphone" ? "cellphone" : "game";

    if (state.mode === "cellphone") {
      doc.body.classList.add("player-cellphone-surface-open");
      if (options.requestFullscreen !== false) await requestFullscreen();
      await lockOrientation("portrait");
    } else {
      doc.body.classList.remove("player-cellphone-surface-open");
      if (options.requestFullscreen === true) await requestFullscreen();
      await lockOrientation("landscape");
    }

    syncGate();
    global.setTimeout(syncGate, 220);
    return true;
  }

  function install() {
    if (state.installed || !isPhoneDevice()) return state.installed;

    state.installed = true;
    doc.body.classList.add("player-mobile-runtime");
    buildGate();
    buildStandby();

    global.addEventListener("luminous:player-instance-changed", (event) => {
      state.instance = String(event?.detail?.instance || "ninguno");
      syncStandby();
    });

    if (doc.body?.classList?.contains("player-instance-theatre")) state.instance = "teatro";
    else if (doc.body?.classList?.contains("player-instance-combat")) state.instance = "combate";
    else state.instance = "ninguno";

    doc.addEventListener("fullscreenchange", syncGate);
    doc.addEventListener("webkitfullscreenchange", syncGate);
    global.addEventListener("orientationchange", () => global.setTimeout(syncGate, 60), { passive: true });
    global.addEventListener("resize", syncGate, { passive: true });
    global.visualViewport?.addEventListener?.("resize", syncGate, { passive: true });
    fullscreenMedia?.addEventListener?.("change", syncGate);
    standaloneMedia?.addEventListener?.("change", syncGate);

    if (isFullscreenLike() && isLandscape()) {
      state.entered = true;
    }

    syncGate();
    return true;
  }

  function boot() {
    if (!isPhoneDevice()) return;
    if (doc.body) install();
    else doc.addEventListener("DOMContentLoaded", install, { once: true });
  }

  boot();

  global.LuminousPlayerMobileRuntime = Object.freeze({
    enterGame,
    setMode,
    sync: syncGate,
    requestFullscreen,
    lockOrientation,
    isPhoneDevice,
    isFullscreenLike,
    isLandscape,
    isPortrait,
    mode: () => state.mode,
    instance: () => state.instance,
  });
})(window);
