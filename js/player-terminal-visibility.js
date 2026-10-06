(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || doc.body?.classList.contains("on-game-dashboard")) return;
  if (global.LuminousPlayerTerminalVisibility) return;

  let installed = false;
  let classObserver = null;
  let bootstrapTimer = null;

  function isPhoneDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }
    return /iPhone|iPod|Windows Phone|Mobi|Android.+Mobile/i.test(navigator.userAgent || "");
  }

  function getParts() {
    return {
      wrapper: doc.querySelector(".sheet-phone-wrapper"),
      toggle: doc.getElementById("btn-toggle-phone"),
    };
  }

  function syncState() {
    const { wrapper, toggle } = getParts();
    if (!wrapper || !toggle) return false;

    const open = !wrapper.classList.contains("phone-hidden");
    wrapper.setAttribute("aria-hidden", open ? "false" : "true");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.dataset.terminalOpen = open ? "true" : "false";
    toggle.classList.toggle("is-terminal-open", open);
    doc.body?.classList.toggle("player-terminal-open", open);

    if (isPhoneDevice()) doc.body?.classList.add("player-phone-device");
    return true;
  }

  function applyDefaultVisibility() {
    const { wrapper, toggle } = getParts();
    if (!wrapper || !toggle) return false;

    if (!wrapper.id) wrapper.id = "player-personal-terminal";
    toggle.setAttribute("aria-controls", wrapper.id);
    toggle.setAttribute("aria-label", "Abrir celular");
    toggle.title = "Celular";

    if (wrapper.dataset.defaultVisibilityApplied !== "true") {
      wrapper.dataset.defaultVisibilityApplied = "true";
      if (isPhoneDevice()) {
        wrapper.classList.remove("phone-hidden");
        doc.body?.classList.add("player-phone-device");
      } else {
        wrapper.classList.add("phone-hidden");
      }
    }

    syncState();
    doc.body?.classList.add("player-terminal-visibility-ready");
    return true;
  }

  function install() {
    if (installed) return true;

    const { wrapper, toggle } = getParts();
    if (!wrapper || !toggle) return false;

    applyDefaultVisibility();

    toggle.addEventListener("click", () => {
      global.setTimeout(syncState, 0);
    });

    classObserver = new MutationObserver(syncState);
    classObserver.observe(wrapper, { attributes: true, attributeFilter: ["class"] });
    installed = true;
    return true;
  }

  function boot() {
    if (install()) return;
    if (bootstrapTimer) return;

    bootstrapTimer = global.setInterval(() => {
      if (install()) {
        global.clearInterval(bootstrapTimer);
        bootstrapTimer = null;
      }
    }, 100);
  }

  boot();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });

  global.LuminousPlayerTerminalVisibility = Object.freeze({
    close: () => {
      const { wrapper } = getParts();
      if (isPhoneDevice()) {
        wrapper?.classList.remove("phone-hidden");
        syncState();
        return false;
      }
      wrapper?.classList.add("phone-hidden");
      syncState();
      return true;
    },
    sync: syncState,
    isOpen: () => {
      const { wrapper } = getParts();
      return Boolean(wrapper && !wrapper.classList.contains("phone-hidden"));
    },
  });
})(window);
