(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = doc.getElementById(id);
    if (existing) {
      if (ready?.()) return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      (doc.head || doc.documentElement).appendChild(script);
    });
  }

  function context() {
    const pathname = String(global.location?.pathname || "").toLowerCase();
    if (/battle|combat/.test(pathname)) return "combat";
    if (/hoja_personaje|theatre|theater|character/.test(pathname)) return "theatre";
    return "any";
  }

  Promise.resolve()
    .then(() => ensureScript(
      "player-archetype-runtime-core-script",
      "js/player-archetype-runtime-core.js",
      () => Boolean(global.LuminousArchetypeRuntime),
    ))
    .then(() => ensureScript(
      "class-runtime-bootstrap-script",
      "js/class-runtime-bootstrap.js",
      () => Boolean(global.LuminousClassRuntimeBootstrap),
    ))
    .then(() => global.LuminousClassRuntimeBootstrap?.boot?.({ context: context() }))
    .catch((error) => console.error("Player Archetype Bootstrap:", error));
})(typeof window !== "undefined" ? window : globalThis);
