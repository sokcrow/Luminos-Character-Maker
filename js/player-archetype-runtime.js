(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = doc.getElementById(id);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (ready?.()) return resolve();
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
      doc.head?.appendChild(script);
    });
  }

  Promise.resolve()
    .then(() => ensureScript(
      "player-archetype-runtime-core-script",
      "js/player-archetype-runtime-core.js",
      () => Boolean(global.LuminousArchetypeRuntime),
    ))
    .then(() => ensureScript(
      "orosh-lineage-runtime-script",
      "js/orosh-lineage-runtime.js",
      () => Boolean(global.LuminousOroshLineageRuntime),
    ))
    .catch((error) => console.error("Player Archetype Bootstrap:", error));
})(window);
