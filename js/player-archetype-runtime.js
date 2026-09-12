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
      "rogue-theatre-runtime-script",
      "js/rogue-theatre-runtime.js",
      () => Boolean(global.LuminousRogueTheatreRuntime),
    ))
    .then(() => ensureScript(
      "fighter-maneuver-catalog-script",
      "js/fighter-maneuver-catalog.js",
      () => Boolean(global.LuminousFighterManeuverCatalog),
    ))
    .then(() => ensureScript(
      "battle-master-archetype-runtime-script",
      "js/battle-master-archetype-runtime.js",
      () => Boolean(global.LuminousBattleMasterArchetypeRuntime),
    ))
    .then(() => ensureScript(
      "mastermind-archetype-runtime-script",
      "js/mastermind-archetype-runtime.js",
      () => Boolean(global.LuminousMastermindArchetypeRuntime),
    ))
    .then(() => ensureScript(
      "mastermind-theatre-runtime-script",
      "js/mastermind-theatre-runtime.js",
      () => Boolean(global.LuminousMastermindTheatreRuntime),
    ))
    .catch((error) => console.error("Player Archetype Bootstrap:", error));
})(window);
