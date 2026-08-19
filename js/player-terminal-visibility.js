(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || doc.body?.classList.contains("on-game-dashboard")) return;
  if (global.LuminousPlayerTerminalVisibility) return;

  let installed = false;
  let classObserver = null;
  let bootstrapTimer = null;

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
    return true;
  }

  function closeByDefault() {
    const { wrapper, toggle } = getParts();
    if (!wrapper || !toggle) return false;

    if (!wrapper.id) wrapper.id = "player-personal-terminal";
    toggle.setAttribute("aria-controls", wrapper.id);
    toggle.setAttribute("aria-label", "Abrir terminal");
    toggle.title = "Terminal";

    if (wrapper.dataset.defaultVisibilityApplied !== "true") {
      wrapper.dataset.defaultVisibilityApplied = "true";
      wrapper.classList.add("phone-hidden");
    }

    syncState();
    doc.body?.classList.add("player-terminal-visibility-ready");
    return true;
  }

  function install() {
    if (installed) return true;
    const { wrapper, toggle } = getParts();
    if (!wrapper || !toggle) return false;

    closeByDefault();

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
      wrapper?.classList.add("phone-hidden");
      syncState();
    },
    sync: syncState,
    isOpen: () => {
      const { wrapper } = getParts();
      return Boolean(wrapper && !wrapper.classList.contains("phone-hidden"));
    },
  });
})(window);
