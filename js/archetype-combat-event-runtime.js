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
      "archetype-combat-event-runtime-core-script",
      "js/archetype-combat-event-runtime-core.js",
      () => Boolean(global.LuminousArchetypeCombatEventRuntime),
    ))
    .then(() => ensureScript(
      "orosh-lineage-runtime-script",
      "js/orosh-lineage-runtime.js",
      () => Boolean(global.LuminousOroshLineageRuntime),
    ))
    .then(() => ensureScript(
      "orosh-lineage-complete-runtime-script",
      "js/orosh-lineage-complete-runtime.js",
      () => Boolean(global.LuminousOroshLineageCompleteRuntime),
    ))
    .then(() => ensureScript(
      "rogue-class-runtime-script",
      "js/rogue-class-runtime.js",
      () => Boolean(global.LuminousRogueClassRuntime),
    ))
    .then(() => ensureScript(
      "rogue-combat-runtime-script",
      "js/rogue-combat-runtime.js",
      () => Boolean(global.LuminousRogueCombatRuntime),
    ))
    .catch((error) => console.error("Archetype Combat Event Bootstrap:", error));
})(typeof window !== "undefined" ? window : globalThis);