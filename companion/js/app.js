(function (global) {
  "use strict";

  const byId = (id) => document.getElementById(id);
  let deferredInstallPrompt = null;

  function isPhone() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    const ua = navigator.userAgent || "";
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(ua);
  }

  function setDeviceMode() {
    const phone = isPhone();
    byId("device-gate").hidden = phone;
    byId("mobile-app").hidden = !phone;
    document.documentElement.dataset.companionDevice = phone ? "phone" : "unsupported";
    return phone;
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
    if (!setDeviceMode()) return;
    bindNavigation();
    bindInstall();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})(window);
