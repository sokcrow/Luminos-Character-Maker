(function (global) {
  "use strict";

  if (global.LuminousClassRuntimeBootstrap) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousClassRuntimeBootstrap;
    return;
  }

  const doc = global.document;
  // document.currentScript is only reliable during synchronous script evaluation.
  // Capture its context now so the automatic async boot cannot lose Combat/Theatre.
  const initialScriptContext = doc?.currentScript?.dataset?.luminousContext || null;
  let infrastructurePromise = null;
  const bootPromises = new Map();

  function scriptExists(src) {
    if (!doc) return null;
    const expected = String(src || "").split(/[?#]/)[0].replace(/^\.\//, "");
    return [...doc.querySelectorAll("script[src]")].find((script) => {
      const raw = String(script.getAttribute("src") || "").split(/[?#]/)[0].replace(/^\.\//, "");
      return raw === expected || raw.endsWith(`/${expected}`);
    }) || null;
  }

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    if (!doc) return Promise.reject(new Error(`Class Runtime Bootstrap: document is unavailable while loading ${src}.`));
    const existing = doc.getElementById(id) || scriptExists(src);
    if (existing) {
      if (ready?.()) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const onLoad = () => ready?.() ? resolve() : reject(new Error(`Class Runtime Bootstrap: ${src} loaded without exposing its API.`));
        existing.addEventListener?.("load", onLoad, { once: true });
        existing.addEventListener?.("error", () => reject(new Error(`Class Runtime Bootstrap: failed to load ${src}.`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => {
        if (!ready || ready()) resolve();
        else reject(new Error(`Class Runtime Bootstrap: ${src} loaded without exposing its API.`));
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Class Runtime Bootstrap: failed to load ${src}.`)), { once: true });
      (doc.head || doc.documentElement).appendChild(script);
    });
  }

  function detectContext(explicit) {
    if (explicit) return String(explicit);
    const fromCurrentScript = doc?.currentScript?.dataset?.luminousContext;
    if (fromCurrentScript) return fromCurrentScript;
    if (initialScriptContext) return initialScriptContext;
    if (global.LUMINOUS_RUNTIME_CONTEXT) return global.LUMINOUS_RUNTIME_CONTEXT;
    const pathname = String(global.location?.pathname || "").toLowerCase();
    if (/battle|combat/.test(pathname)) return "combat";
    if (/hoja_personaje|theatre|theater|character/.test(pathname)) return "theatre";
    return "any";
  }

  function ensureInfrastructure() {
    if (infrastructurePromise) return infrastructurePromise;
    infrastructurePromise = (async () => {
      await ensureScript(
        "class-runtime-registry-script",
        "js/class-runtime-registry.js",
        () => Boolean(global.LuminousClassRuntimeRegistry),
      );
      await ensureScript(
        "class-runtime-manifest-script",
        "js/class-runtime-manifest.js",
        () => Boolean(global.LuminousClassRuntimeManifest),
      );
      const registry = global.LuminousClassRuntimeRegistry;
      const manifest = global.LuminousClassRuntimeManifest;
      if (!registry || !manifest) throw new Error("Class Runtime Bootstrap: registry or manifest is unavailable.");
      manifest.entries.forEach((entry) => {
        if (!registry.get(entry.id)) registry.register(entry);
      });
      return { registry, manifest };
    })();
    return infrastructurePromise;
  }

  async function boot(options = {}) {
    // Resolve context synchronously, before awaiting infrastructure. Otherwise
    // document.currentScript may become null and context-specific adapters vanish.
    const requestedContext = detectContext(options.context);
    const { registry, manifest } = await ensureInfrastructure();
    const context = registry.normalizeContext(requestedContext);
    if (bootPromises.has(context) && options.force !== true) return bootPromises.get(context);

    const promise = (async () => {
      const result = await registry.loadAll({ context });
      const detail = { ...result, manifestVersion: manifest.version, manifestEntries: manifest.entries.length };
      if (global.dispatchEvent && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent("luminous:class-runtime-bootstrap-ready", { detail }));
      }
      if (!result.ok) console.error("Class Runtime Bootstrap:", result.errors);
      return detail;
    })();
    bootPromises.set(context, promise);
    return promise;
  }

  function ready(context) {
    return boot({ context: context || detectContext() });
  }

  const api = Object.freeze({
    version: 1,
    detectContext,
    ensureInfrastructure,
    boot,
    ready,
  });

  global.LuminousClassRuntimeBootstrap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (doc) boot({ context: initialScriptContext || detectContext() }).catch((error) => console.error("Class Runtime Bootstrap:", error));
})(typeof window !== "undefined" ? window : globalThis);
