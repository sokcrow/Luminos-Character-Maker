(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  function scriptExists(src) {
    const expected = String(src || "").split(/[?#]/)[0].replace(/^\.\//, "");
    return [...doc.querySelectorAll("script[src]")].find((script) => {
      const raw = String(script.getAttribute("src") || "").split(/[?#]/)[0].replace(/^\.\//, "");
      return raw === expected || raw.endsWith(`/${expected}`);
    }) || null;
  }

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = doc.getElementById(id) || scriptExists(src);
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
      doc.head?.appendChild(script);
    });
  }

  Promise.resolve()
    .then(() => ensureScript(
      "archetype-combat-event-runtime-core-script",
      "js/archetype-combat-event-runtime-core.js",
      () => Boolean(global.LuminousArchetypeCombatEventRuntime),
    ))
    // Orosh is still a legacy lineage runtime and does not yet follow the
    // universal class/archetype filename convention, so keep it here only.
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
    // Class/archetype runtimes and their combat adapters are owned exclusively
    // by the universal bootstrap. Do not hardcode Rogue/Mastermind here.
    .then(() => ensureScript(
      "class-runtime-bootstrap-script",
      "js/class-runtime-bootstrap.js",
      () => Boolean(global.LuminousClassRuntimeBootstrap),
    ))
    .then(() => global.LuminousClassRuntimeBootstrap?.boot?.({ context: "combat" }))
    .catch((error) => console.error("Archetype Combat Event Bootstrap:", error));
})(typeof window !== "undefined" ? window : globalThis);
