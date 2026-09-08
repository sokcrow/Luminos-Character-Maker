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

  function ensureClassStatusSemantics() {
    if (global.LuminousClassStatusSemantics) {
      global.LuminousClassStatusSemantics.install?.();
      return Promise.resolve(global.LuminousClassStatusSemantics);
    }
    if (typeof require === "function") {
      try {
        const runtime = require("./class-status-semantics.js");
        runtime?.install?.();
        if (runtime) return Promise.resolve(runtime);
      } catch (_) {}
    }
    if (!global.document) return Promise.resolve(null);
    return loadOnce("class-status-semantics-script", "js/class-status-semantics.js", () => global.LuminousClassStatusSemantics)
      .then((runtime) => {
        runtime?.install?.();
        return runtime;
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

  let library = global.LuminousStatusLibrary || null;
  if (!library && typeof require === "function") {
    try { library = require("./status-library.js"); } catch (_) {}
  }

  if (library) {
    installLibrary(library);
    ensureClassStatusSemantics();
    ensureElementalRuntime();
  } else if (global.document) {
    loadOnce("status-library-script", "js/status-library.js", () => global.LuminousStatusLibrary)
      .then((loaded) => {
        installLibrary(loaded);
        ensureClassStatusSemantics();
        ensureElementalRuntime();
      });
  }

  // Compatibility export only.  statusManager no longer owns a registry.
  const api = Object.freeze({
    version:"0.7.4-unified-compat",
    get library() { return global.LuminousStatusLibrary || null; },
    get registry() { return global.LuminousStatusLibrary?.registry || global.STATUS_REGISTRY || null; },
    install() {
      const active = installLibrary(global.LuminousStatusLibrary);
      ensureClassStatusSemantics();
      ensureElementalRuntime();
      return active;
    }
  });

  global.LuminousStatusManager = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
