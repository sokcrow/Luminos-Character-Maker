(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve(ready());
    const existing = doc.getElementById(id);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (ready?.()) return resolve(ready());
        const finish = () => resolve(ready?.() || true);
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => resolve(ready?.() || true), { once: true });
      script.addEventListener("error", reject, { once: true });
      doc.head?.appendChild(script);
    });
  }

  function ensureBattleOnlyRuntimes() {
    if (!global.CombatEngine) return false;
    ensureScript(
      "rogue-combat-runtime-script",
      "js/rogue-combat-runtime.js",
      () => global.LuminousRogueCombatRuntime,
    ).then((runtime) => runtime?.install?.())
      .catch((error) => console.error("Player Runtime Bootstrap / Rogue Combat:", error));
    return true;
  }

  function watchBattleOnlyRuntimes() {
    if (ensureBattleOnlyRuntimes()) return;
    let attempts = 0;
    const timer = global.setInterval?.(() => {
      attempts += 1;
      if (ensureBattleOnlyRuntimes() || attempts >= 40) global.clearInterval?.(timer);
    }, 250);
    timer?.unref?.();
  }

  Promise.resolve()
    .then(() => ensureScript(
      "status-library-script",
      "js/status-library.js",
      () => global.LuminousStatusLibrary,
    ))
    .then(() => ensureScript(
      "class-status-semantics-script",
      "js/class-status-semantics.js",
      () => global.LuminousClassStatusSemantics,
    ))
    .then(() => ensureScript(
      "fighter-class-runtime-script",
      "js/fighter-class-runtime.js",
      () => global.LuminousFighterClassRuntime,
    ))
    .then(() => ensureScript(
      "player-trait-runtime-script",
      "js/player-trait-runtime.js",
      () => global.LuminousPlayerTraitRuntime,
    ))
    .then(() => ensureScript(
      "player-archetype-runtime-core-script",
      "js/player-archetype-runtime-core.js",
      () => global.LuminousArchetypeRuntime,
    ))
    .then(() => ensureScript(
      "orosh-lineage-runtime-script",
      "js/orosh-lineage-runtime.js",
      () => global.LuminousOroshLineageRuntime,
    ))
    .then(() => ensureScript(
      "orosh-lineage-complete-runtime-script",
      "js/orosh-lineage-complete-runtime.js",
      () => global.LuminousOroshLineageCompleteRuntime,
    ))
    .then(() => ensureScript(
      "rogue-class-runtime-script",
      "js/rogue-class-runtime.js",
      () => global.LuminousRogueClassRuntime,
    ))
    .then(() => ensureScript(
      "rogue-theatre-runtime-script",
      "js/rogue-theatre-runtime.js",
      () => global.LuminousRogueTheatreRuntime,
    ))
    .then(() => ensureScript(
      "spellcasting-runtime-script",
      "js/spellcasting-runtime.js",
      () => global.LuminousSpellcastingRuntime,
    ))
    .then(() => ensureScript(
      "sorcerer-class-runtime-script",
      "js/sorcerer-class-runtime.js",
      () => global.LuminousSorcererClassRuntime,
    ))
    .then(() => ensureScript(
      "fighter-maneuver-catalog-script",
      "js/fighter-maneuver-catalog.js",
      () => global.LuminousFighterManeuverCatalog,
    ))
    .then(() => ensureScript(
      "battle-master-archetype-runtime-script",
      "js/battle-master-archetype-runtime.js",
      () => global.LuminousBattleMasterArchetypeRuntime,
    ))
    .then(() => ensureScript(
      "mastermind-archetype-runtime-script",
      "js/mastermind-archetype-runtime.js",
      () => global.LuminousMastermindArchetypeRuntime,
    ))
    .then(() => ensureScript(
      "mastermind-theatre-runtime-script",
      "js/mastermind-theatre-runtime.js",
      () => global.LuminousMastermindTheatreRuntime,
    ))
    .then(() => {
      global.LuminousClassStatusSemantics?.install?.();
      global.LuminousFighterClassRuntime?.install?.();
      global.LuminousSorcererClassRuntime?.install?.();
      watchBattleOnlyRuntimes();
    })
    .catch((error) => console.error("Player Runtime Bootstrap:", error));
})(window);
