(function (global) {
  "use strict";

  if (global.LuminousDmTabRuntimeV2) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmTabRuntimeV2;
    return;
  }

  function activate(tabId, preferredButton) {
    if (!global.document || !tabId) return false;

    global.document.querySelectorAll(".dm-tab-btn").forEach((button) => {
      button.classList.toggle("active", button === preferredButton || (!preferredButton && button.dataset.tab === tabId));
    });

    global.document.querySelectorAll(".dm-tab-pane").forEach((pane) => {
      const active = pane.id === tabId;
      pane.classList.toggle("active", active);
      pane.style.display = active ? "" : "";
    });

    const pane = global.document.getElementById(tabId);
    if (!pane) return false;
    pane.classList.add("active");
    return true;
  }

  function bind(root) {
    if (!global.document) return 0;
    const scope = root && root.querySelectorAll ? root : global.document;
    let bound = 0;

    scope.querySelectorAll(".dm-tab-btn[data-tab]").forEach((button) => {
      if (button.dataset.dmTabRuntimeV2Bound === "1") return;
      button.dataset.dmTabRuntimeV2Bound = "1";
      button.addEventListener("click", () => activate(button.dataset.tab, button));
      bound += 1;
    });

    return bound;
  }

  const API = Object.freeze({
    version: 2,
    activate,
    bind
  });

  global.LuminousDmTabRuntimeV2 = API;

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", () => bind(global.document), { once: true });
    } else {
      bind(global.document);
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
