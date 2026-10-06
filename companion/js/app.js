(function (global) {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const landscapeMedia = global.matchMedia("(orientation: landscape)");
  const fullscreenMedia = global.matchMedia("(display-mode: fullscreen)");
  const standaloneMedia = global.matchMedia("(display-mode: standalone)");

  let deferredInstallPrompt = null;
  let launchAcknowledged = false;

  function isPhone() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    const ua = navigator.userAgent || "";
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(ua);
  }

  function isEmbeddedSurface() {
    const params = new URLSearchParams(global.location.search);
    return params.get("surface") === "desktop";
  }

  function isInstalledDisplayMode() {
    return fullscreenMedia.matches || standaloneMedia.matches || navigator.standalone === true;
  }

  function isFullscreen() {
    return Boolean(document.fullscreenElement) || fullscreenMedia.matches;
  }

  function isLandscape() {
    return landscapeMedia.matches || global.innerWidth > global.innerHeight;
  }

  async function requestFullscreen() {
    if (isFullscreen()) return true;

    const root = document.documentElement;
    const request = root.requestFullscreen
      || root.webkitRequestFullscreen
      || root.msRequestFullscreen;

    if (typeof request !== "function") return false;

    try {
      await request.call(root, { navigationUI: "hide" });
      return true;
    } catch (_) {
      try {
        await request.call(root);
        return true;
      } catch (_) {
        return false;
      }
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

  function syncPresentation() {
    const embedded = isEmbeddedSurface();
    const phone = isPhone();
    const installed = isInstalledDisplayMode();
    const landscape = embedded ? true : isLandscape();
    const needsEntryGesture = !embedded && phone && !installed && !launchAcknowledged;

    byId("device-gate").hidden = embedded || phone;
    byId("mobile-entry-gate").hidden = embedded || !needsEntryGesture;
    byId("orientation-gate").hidden = embedded || !phone || needsEntryGesture || landscape;
    byId("mobile-app").hidden = !embedded && (!phone || needsEntryGesture || !landscape);

    document.documentElement.dataset.companionDevice = embedded ? "desktop-embed" : (phone ? "phone" : "unsupported");
    document.documentElement.dataset.companionSurface = embedded ? "desktop" : "mobile";
    document.documentElement.dataset.companionOrientation = landscape ? "landscape" : "portrait";

    const fullscreenButton = byId("fullscreen-app");
    if (fullscreenButton) {
      fullscreenButton.hidden = embedded || isFullscreen() || installed;
    }
  }

  async function enterPresentation() {
    launchAcknowledged = true;

    await requestFullscreen();
    await lockLandscape();
    syncPresentation();

    if (!isLandscape()) {
      byId("orientation-gate").hidden = false;
      byId("mobile-app").hidden = true;
    }
  }

  function showRoute(route) {
    const allowed = new Set(["home", "economy", "contracts", "stash", "profile"]);
    const next = allowed.has(route) ? route : "home";

    document.querySelectorAll(".route-view").forEach((view) => {
      view.hidden = view.dataset.view !== next;
    });

    document.querySelectorAll("#bottom-nav [data-route]").forEach((button) => {
      if (button.dataset.route === next) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    if (location.hash !== "#" + next) history.replaceState(null, "", "#" + next);
  }

  function bindNavigation() {
    byId("bottom-nav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-route]");
      if (button) showRoute(button.dataset.route);
    });

    global.addEventListener("hashchange", () => showRoute(location.hash.slice(1) || "home"));
    showRoute(location.hash.slice(1) || "home");
  }

  function bindPresentation() {
    if (isEmbeddedSurface()) {
      launchAcknowledged = true;
      syncPresentation();
      return;
    }

    byId("enter-companion").addEventListener("click", enterPresentation);
    byId("retry-landscape").addEventListener("click", enterPresentation);
    byId("fullscreen-app").addEventListener("click", enterPresentation);

    landscapeMedia.addEventListener?.("change", syncPresentation);
    fullscreenMedia.addEventListener?.("change", syncPresentation);
    standaloneMedia.addEventListener?.("change", syncPresentation);

    global.addEventListener("orientationchange", syncPresentation);
    global.addEventListener("resize", syncPresentation);
    document.addEventListener("fullscreenchange", syncPresentation);

    if (isInstalledDisplayMode()) {
      launchAcknowledged = true;
      lockLandscape().finally(syncPresentation);
    } else {
      syncPresentation();
    }
  }

  function bindInstall() {
    const installButton = byId("install-app");

    global.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
    });

    installButton.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });

    global.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    global.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" })
        .catch((error) => console.error("Companion service worker registration failed:", error));
    }, { once: true });
  }

  function boot() {
    bindPresentation();

    const embedded = isEmbeddedSurface();
    if (!embedded && !isPhone()) return;

    bindNavigation();

    if (!embedded) {
      bindInstall();
      registerServiceWorker();
    }
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})(window);
