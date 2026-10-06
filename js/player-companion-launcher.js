(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerCompanionLauncher) return;

  const COMPANION_URL = "companion/?surface=desktop";
  let overlay = null;
  let frame = null;
  let opener = null;

  function isPhone() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(navigator.userAgent || "");
  }

  function ensureOverlay() {
    if (overlay) return overlay;

    overlay = doc.createElement("section");
    overlay.id = "player-companion-overlay";
    overlay.className = "player-companion-overlay";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Celular");

    const toolbar = doc.createElement("div");
    toolbar.className = "player-companion-toolbar";

    const title = doc.createElement("div");
    title.className = "player-companion-title";
    title.textContent = "CELULAR";

    const close = doc.createElement("button");
    close.type = "button";
    close.className = "player-companion-close";
    close.setAttribute("aria-label", "Cerrar Celular");
    close.textContent = "Cerrar";
    close.addEventListener("click", closeCompanion);

    frame = doc.createElement("iframe");
    frame.id = "player-companion-frame";
    frame.className = "player-companion-frame";
    frame.title = "Limbus Companion";
    frame.src = COMPANION_URL;
    frame.allow = "fullscreen; screen-wake-lock";
    frame.setAttribute("allowfullscreen", "");

    toolbar.append(title, close);
    overlay.append(toolbar, frame);
    doc.body.appendChild(overlay);
    return overlay;
  }

  async function requestFullscreen(target) {
    const request = target?.requestFullscreen
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

  async function openCompanion(event) {
    event?.preventDefault?.();

    if (isPhone()) {
      global.location.assign("companion/");
      return;
    }

    const surface = ensureOverlay();
    surface.hidden = false;
    doc.body.classList.add("player-companion-open");
    opener = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    surface.querySelector(".player-companion-close")?.focus({ preventScroll: true });
    await requestFullscreen(surface);
  }

  async function closeCompanion() {
    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;
    doc.body.classList.remove("player-companion-open");

    if (doc.fullscreenElement === overlay && typeof doc.exitFullscreen === "function") {
      try { await doc.exitFullscreen(); } catch (_) {}
    }

    opener?.focus?.({ preventScroll: true });
    opener = null;
  }

  function install() {
    const button = doc.getElementById("btn-open-companion");
    if (!button || button.dataset.companionLauncherBound === "true") return false;

    button.dataset.companionLauncherBound = "true";
    button.addEventListener("click", openCompanion);
    button.setAttribute("aria-haspopup", "dialog");

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay && !overlay.hidden && !doc.fullscreenElement) {
        closeCompanion();
      }
    });

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

  global.LuminousPlayerCompanionLauncher = Object.freeze({
    open: openCompanion,
    close: closeCompanion,
    isOpen: () => Boolean(overlay && !overlay.hidden),
  });
})(window);
