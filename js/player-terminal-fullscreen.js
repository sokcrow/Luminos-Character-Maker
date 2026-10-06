(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerTerminalFullscreen) return;

  const BASE_WIDTH = 400;
  const BASE_HEIGHT = 800;
  const VIEWPORT_MARGIN = 24;

  let installed = false;
  let pseudoFullscreen = false;
  let resizeBound = false;

  function parts() {
    return {
      wrapper: doc.querySelector(".sheet-phone-wrapper"),
      button: doc.getElementById("btn-terminal-fullscreen"),
    };
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

  function availableViewport() {
    const vv = global.visualViewport;
    return {
      width: Math.max(1, Number(vv?.width || global.innerWidth || BASE_WIDTH)),
      height: Math.max(1, Number(vv?.height || global.innerHeight || BASE_HEIGHT)),
    };
  }

  function updateScale() {
    const { wrapper } = parts();
    if (!wrapper || !isActive(wrapper)) return;

    const viewport = availableViewport();
    const usableWidth = Math.max(1, viewport.width - VIEWPORT_MARGIN * 2);
    const usableHeight = Math.max(1, viewport.height - VIEWPORT_MARGIN * 2);
    const scale = Math.max(0.1, Math.min(usableWidth / BASE_WIDTH, usableHeight / BASE_HEIGHT));

    wrapper.style.setProperty("--terminal-presentation-scale", scale.toFixed(4));
  }

  function syncButton() {
    const { wrapper, button } = parts();
    if (!wrapper || !button) return;

    const active = isActive(wrapper);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute(
      "aria-label",
      active ? "Salir de pantalla completa" : "Abrir Celular en pantalla completa"
    );
    button.title = active ? "Salir de pantalla completa" : "Pantalla completa";

    if (active) updateScale();
  }

  function enterPseudoFullscreen(wrapper) {
    pseudoFullscreen = true;
    wrapper.classList.add("terminal-presentation-mode");
    doc.body?.classList.add("player-terminal-pseudo-fullscreen");
    updateScale();
    syncButton();
  }

  function exitPseudoFullscreen(wrapper) {
    pseudoFullscreen = false;
    wrapper?.classList.remove("terminal-presentation-mode");
    wrapper?.style.removeProperty("--terminal-presentation-scale");
    doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
    syncButton();
  }

  async function requestNativeFullscreen(wrapper) {
    const request =
      wrapper.requestFullscreen
      || wrapper.webkitRequestFullscreen
      || wrapper.msRequestFullscreen;

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
    const exit =
      doc.exitFullscreen
      || doc.webkitExitFullscreen
      || doc.msExitFullscreen;

    if (typeof exit !== "function") return false;

    try {
      await exit.call(doc);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function enter() {
    const { wrapper } = parts();
    if (!wrapper) return false;

    wrapper.classList.remove("phone-hidden");
    global.LuminousPlayerTerminalVisibility?.sync?.();

    const nativeEntered = await requestNativeFullscreen(wrapper);
    if (!nativeEntered) {
      enterPseudoFullscreen(wrapper);
      return true;
    }

    pseudoFullscreen = false;
    wrapper.classList.remove("terminal-presentation-mode");
    doc.body?.classList.remove("player-terminal-pseudo-fullscreen");
    updateScale();
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

  function bindResize() {
    if (resizeBound) return;
    resizeBound = true;

    global.addEventListener("resize", updateScale, { passive: true });
    global.visualViewport?.addEventListener?.("resize", updateScale, { passive: true });
    global.addEventListener("orientationchange", updateScale, { passive: true });
  }

  function install() {
    if (installed) return true;

    const { wrapper, button } = parts();
    if (!wrapper || !button) return false;

    button.addEventListener("click", toggle);

    doc.addEventListener("fullscreenchange", syncButton);
    doc.addEventListener("webkitfullscreenchange", syncButton);

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && pseudoFullscreen) {
        exitPseudoFullscreen(wrapper);
      }
    });

    bindResize();
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
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot, { once: true });
  }

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
