(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerTerminalFullscreen) return;

  const BASE_WIDTH = 400;
  const BASE_HEIGHT = 800;
  const VIEWPORT_MARGIN = 24;

  let installed = false;
  let pseudoFullscreen = false;
  let mobileCellphoneOpen = false;

  function parts() {
    return {
      wrapper: doc.querySelector(".sheet-phone-wrapper"),
      fullscreenButton: doc.getElementById("btn-terminal-fullscreen"),
      backButton: doc.getElementById("btn-cellphone-back"),
    };
  }

  function isPhoneDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(navigator.userAgent || "");
  }

  function fullscreenElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function isRootFullscreen() {
    const current = fullscreenElement();
    return current === doc.documentElement || current === doc.body;
  }

  function isWrapperFullscreen(wrapper) {
    return fullscreenElement() === wrapper;
  }

  async function requestFullscreen(target) {
    const request =
      target?.requestFullscreen
      || target?.webkitRequestFullscreen
      || target?.msRequestFullscreen;

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

  async function exitFullscreen() {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (typeof exit !== "function") return false;

    try {
      await exit.call(doc);
      return true;
    } catch (_) {
      return false;
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

  function updateDesktopScale() {
    const { wrapper } = parts();
    if (!wrapper) return;

    const desktopFullscreen = isWrapperFullscreen(wrapper) || pseudoFullscreen;
    if (!desktopFullscreen || mobileCellphoneOpen) return;

    const vv = global.visualViewport;
    const width = Math.max(1, Number(vv?.width || global.innerWidth || BASE_WIDTH));
    const height = Math.max(1, Number(vv?.height || global.innerHeight || BASE_HEIGHT));
    const usableWidth = Math.max(1, width - VIEWPORT_MARGIN * 2);
    const usableHeight = Math.max(1, height - VIEWPORT_MARGIN * 2);
    const scale = Math.max(0.1, Math.min(usableWidth / BASE_WIDTH, usableHeight / BASE_HEIGHT));

    wrapper.style.setProperty("--terminal-presentation-scale", scale.toFixed(4));
  }

  function syncControls() {
    const { wrapper, fullscreenButton } = parts();
    if (!wrapper || !fullscreenButton) return;

    const nativeFullscreen = Boolean(fullscreenElement());
    doc.body?.classList.toggle("is-native-fullscreen", nativeFullscreen);

    if (mobileCellphoneOpen) {
      fullscreenButton.hidden = isRootFullscreen();
      fullscreenButton.setAttribute("aria-pressed", isRootFullscreen() ? "true" : "false");
      fullscreenButton.setAttribute(
        "aria-label",
        isRootFullscreen() ? "Pantalla completa activa" : "Reintentar pantalla completa"
      );
      fullscreenButton.title = isRootFullscreen() ? "Pantalla completa activa" : "Pantalla completa";
      return;
    }

    const active = isWrapperFullscreen(wrapper) || pseudoFullscreen;
    fullscreenButton.hidden = false;
    fullscreenButton.setAttribute("aria-pressed", active ? "true" : "false");
    fullscreenButton.setAttribute(
      "aria-label",
      active ? "Salir de pantalla completa" : "Abrir Celular en pantalla completa"
    );
    fullscreenButton.title = active ? "Salir de pantalla completa" : "Pantalla completa";

    if (active) updateDesktopScale();
  }

  function syncCellphoneRuntime() {
    global.LuminousPlayerCellphoneRuntime?.sync?.();
  }

  async function openMobileCellphone() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    mobileCellphoneOpen = true;
    pseudoFullscreen = false;

    wrapper.classList.remove("phone-hidden", "terminal-presentation-mode");
    wrapper.classList.add("cellphone-native-surface");
    wrapper.style.removeProperty("--terminal-presentation-scale");
    doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
    doc.body?.classList.add("player-cellphone-surface-open");

    if (!isRootFullscreen()) {
      if (fullscreenElement()) await exitFullscreen();
      await requestFullscreen(doc.documentElement);
    }

    await lockOrientation("portrait");
    syncControls();
    syncCellphoneRuntime();
    return true;
  }

  async function closeMobileCellphone() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    mobileCellphoneOpen = false;
    wrapper.classList.remove("cellphone-native-surface");
    wrapper.classList.add("phone-hidden");
    doc.body?.classList.remove("player-cellphone-surface-open");

    // Keep the game in fullscreen when possible; switch its orientation back to landscape.
    if (isRootFullscreen()) {
      await lockOrientation("landscape");
    } else {
      try { global.screen?.orientation?.unlock?.(); } catch (_) {}
    }

    syncControls();
    syncCellphoneRuntime();
    return true;
  }

  function enterPseudoDesktopFullscreen(wrapper) {
    pseudoFullscreen = true;
    wrapper.classList.add("terminal-presentation-mode");
    doc.body?.classList.add("player-terminal-pseudo-fullscreen");
    updateDesktopScale();
    syncControls();
  }

  function exitPseudoDesktopFullscreen(wrapper) {
    pseudoFullscreen = false;
    wrapper?.classList.remove("terminal-presentation-mode");
    wrapper?.style.removeProperty("--terminal-presentation-scale");
    doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
    syncControls();
  }

  async function enterDesktopFullscreen() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    wrapper.classList.remove("phone-hidden");
    syncCellphoneRuntime();

    const entered = await requestFullscreen(wrapper);
    if (!entered) enterPseudoDesktopFullscreen(wrapper);
    else {
      pseudoFullscreen = false;
      wrapper.classList.remove("terminal-presentation-mode");
      doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
      updateDesktopScale();
      syncControls();
    }
    return true;
  }

  async function exitDesktopFullscreen() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    if (pseudoFullscreen) {
      exitPseudoDesktopFullscreen(wrapper);
      return true;
    }

    if (isWrapperFullscreen(wrapper)) {
      await exitFullscreen();
      return true;
    }

    return false;
  }

  async function closeCellphone() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    if (isPhoneDevice() || mobileCellphoneOpen) {
      return closeMobileCellphone();
    }

    await exitDesktopFullscreen();
    wrapper.classList.add("phone-hidden");
    syncCellphoneRuntime();
    return true;
  }

  async function toggleFullscreen(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const { wrapper } = parts();
    if (!wrapper) return;

    if (mobileCellphoneOpen) {
      if (!isRootFullscreen()) {
        await requestFullscreen(doc.documentElement);
        await lockOrientation("portrait");
        syncControls();
      }
      return;
    }

    if (isWrapperFullscreen(wrapper) || pseudoFullscreen) await exitDesktopFullscreen();
    else await enterDesktopFullscreen();
  }

  function install() {
    if (installed) return true;

    const { wrapper, fullscreenButton, backButton } = parts();
    if (!wrapper || !fullscreenButton || !backButton) return false;

    fullscreenButton.addEventListener("click", toggleFullscreen);
    backButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeCellphone();
    });

    const onFullscreenChange = () => {
      if (!isWrapperFullscreen(wrapper) && !mobileCellphoneOpen) {
        pseudoFullscreen = false;
        wrapper.classList.remove("terminal-presentation-mode");
        wrapper.style.removeProperty("--terminal-presentation-scale");
        doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
      }
      syncControls();
    };

    doc.addEventListener("fullscreenchange", onFullscreenChange);
    doc.addEventListener("webkitfullscreenchange", onFullscreenChange);

    global.addEventListener("resize", updateDesktopScale, { passive: true });
    global.visualViewport?.addEventListener?.("resize", updateDesktopScale, { passive: true });

    doc.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (mobileCellphoneOpen) closeMobileCellphone();
      else if (pseudoFullscreen) exitPseudoDesktopFullscreen(wrapper);
    });

    installed = true;
    syncControls();
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
    openMobileCellphone,
    closeMobileCellphone,
    closeCellphone,
    enter: enterDesktopFullscreen,
    exit: exitDesktopFullscreen,
    toggle: toggleFullscreen,
    isMobileCellphoneOpen: () => mobileCellphoneOpen,
  });
})(window);
