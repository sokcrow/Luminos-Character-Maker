(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerTerminalFullscreen) return;

  let installed = false;
  let pseudoFullscreen = false;

  function parts() {
    return {
      wrapper: doc.querySelector(".sheet-phone-wrapper"),
      button: doc.getElementById("btn-terminal-fullscreen"),
    };
  }

  function isPhoneDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(navigator.userAgent || "");
  }

  function nativeFullscreenElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function isNativeFullscreen(wrapper) {
    return nativeFullscreenElement() === wrapper;
  }

  function isActive(wrapper) {
    return Boolean(wrapper && (isNativeFullscreen(wrapper) || pseudoFullscreen));
  }

  async function requestNativeFullscreen(wrapper) {
    const request = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen || wrapper.msRequestFullscreen;
    if (typeof request !== "function") return false;

    try {
      await request.call(wrapper, { navigationUI: "hide" });
      return true;
    } catch (_) {
      try {
        await request.call(wrapper);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  async function exitNativeFullscreen() {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (typeof exit !== "function") return false;
    try {
      await exit.call(doc);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function lockLandscape() {
    const orientation = global.screen?.orientation;
    if (!orientation || typeof orientation.lock !== "function") return false;
    try {
      await orientation.lock("landscape");
      return true;
    } catch (_) {
      return false;
    }
  }

  function unlockOrientation() {
    try {
      global.screen?.orientation?.unlock?.();
    } catch (_) {}
  }

  function syncButton() {
    const { wrapper, button } = parts();
    if (!wrapper || !button) return;

    const active = isActive(wrapper);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", active ? "Salir de pantalla completa" : "Abrir Celular en pantalla completa");
    button.title = active ? "Salir de pantalla completa" : "Pantalla completa";
  }

  function enterPseudoFullscreen(wrapper) {
    pseudoFullscreen = true;
    wrapper.classList.add("terminal-presentation-mode");
    doc.body?.classList.add("player-terminal-pseudo-fullscreen");
    syncButton();
  }

  function exitPseudoFullscreen(wrapper) {
    pseudoFullscreen = false;
    wrapper?.classList.remove("terminal-presentation-mode");
    doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
    unlockOrientation();
    syncButton();
  }

  async function enter() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    wrapper.classList.remove("phone-hidden");
    global.LuminousPlayerTerminalVisibility?.sync?.();

    const nativeEntered = await requestNativeFullscreen(wrapper);
    if (!nativeEntered) {
      enterPseudoFullscreen(wrapper);
    } else {
      pseudoFullscreen = false;
      wrapper.classList.remove("terminal-presentation-mode");
      doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
    }

    if (isPhoneDevice()) await lockLandscape();
    syncButton();
    return true;
  }

  async function exit() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    if (pseudoFullscreen) {
      exitPseudoFullscreen(wrapper);
      return true;
    }

    if (isNativeFullscreen(wrapper)) {
      await exitNativeFullscreen();
      unlockOrientation();
      return true;
    }

    return false;
  }

  async function toggle(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const { wrapper } = parts();
    if (!wrapper) return;

    if (isActive(wrapper)) await exit();
    else await enter();
  }

  function install() {
    if (installed) return true;

    const { wrapper, button } = parts();
    if (!wrapper || !button) return false;

    button.addEventListener("click", toggle);

    const onFullscreenChange = () => {
      if (!isNativeFullscreen(wrapper) && !pseudoFullscreen) unlockOrientation();
      syncButton();
    };

    doc.addEventListener("fullscreenchange", onFullscreenChange);
    doc.addEventListener("webkitfullscreenchange", onFullscreenChange);

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && pseudoFullscreen) exitPseudoFullscreen(wrapper);
    });

    installed = true;
    syncButton();
    return true;
  }

  function boot() {
    if (install()) return;
    const timer = global.setInterval(() => {
      if (install()) global.clearInterval(timer);
    }, 100);
  }

  boot();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });

  global.LuminousPlayerTerminalFullscreen = Object.freeze({
    enter,
    exit,
    toggle,
    isActive: () => {
      const { wrapper } = parts();
      return isActive(wrapper);
    },
  });
})(window);
