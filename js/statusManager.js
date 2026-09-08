(function (global) {
  "use strict";

  function loadOnce(id, src, ready) {
    if (ready?.()) return Promise.resolve(ready());
    const doc = global.document;
    if (!doc) return Promise.resolve(null);
    const existing = doc.getElementById(id);
    if (existing) return new Promise((resolve) => {
      const finish = () => resolve(ready?.() || null);
      existing.addEventListener?.("load", finish, { once:true });
      global.setTimeout?.(finish, 0);
    });
    return new Promise((resolve) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => resolve(ready?.() || null), { once:true });
      script.addEventListener("error", () => resolve(null), { once:true });
      doc.head?.appendChild(script);
    });
  }

  function installLibrary(library) {
    if (!library) return null;
    library.install?.();
    library.installStatusEngineBridge?.();
    return library.registry || global.STATUS_REGISTRY || null;
  }

  function installClassStatusClassification() {
    if (global.LuminousClassStatusClassification) {
      global.LuminousClassStatusClassification.install?.();
      return Promise.resolve(global.LuminousClassStatusClassification);
    }
    if (typeof require === "function") {
      try {
        const classification = require("./class-status-classification.js");
        classification?.install?.();
        return Promise.resolve(classification || null);
      } catch (_) {}
    }
    if (!global.document) return Promise.resolve(null);
    return loadOnce(
      "class-status-classification-script",
      "js/class-status-classification.js",
      () => global.LuminousClassStatusClassification,
    ).then((classification) => {
      classification?.install?.();
      return classification || null;
    });
  }

  function ensureElementalRuntime() {
    if (global.LuminousElementalStatusRuntime) {
      global.LuminousElementalStatusRuntime.install?.();
      return;
    }
    if (!global.document) return;
    loadOnce("elemental-status-runtime-script", "js/elemental-status-runtime.js", () => global.LuminousElementalStatusRuntime)
      .then((runtime) => runtime?.install?.());
  }

  function finishInstall(library) {
    const registry = installLibrary(library);
    installClassStatusClassification().then(() => ensureElementalRuntime());
    return registry;
  }

  let library = global.LuminousStatusLibrary || null;
  if (!library && typeof require === "function") {
    try { library = require("./status-library.js"); } catch (_) {}
  }

  if (library) {
    finishInstall(library);
  } else if (global.document) {
    loadOnce("status-library-script", "js/status-library.js", () => global.LuminousStatusLibrary)
      .then((loaded) => finishInstall(loaded));
  }

  // Compatibility export only.  statusManager no longer owns a registry.
  const api = Object.freeze({
    version:"0.7.4-unified-compat",
    get library() { return global.LuminousStatusLibrary || null; },
    get registry() { return global.LuminousStatusLibrary?.registry || global.STATUS_REGISTRY || null; },
    install() {
      const active = installLibrary(global.LuminousStatusLibrary);
      installClassStatusClassification().then(() => ensureElementalRuntime());
      return active;
    }
  });

  global.LuminousStatusManager = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);