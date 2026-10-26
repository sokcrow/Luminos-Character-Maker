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
  let playerDataListenerBound = false;

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
    if (/hoja_personaje/.test(pathname)) return "player";
    if (/theatre|theater/.test(pathname)) return "theatre";
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

  const runtimeSlug = (value) => String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "");

  function playerBuildRuntimeIds(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object"
      ? character.characterBuild
      : {};
    const classSource = [build.classes, character.classes, character.classLevels, character.classesById, character?.dnd?.classes]
      .find((value) => Array.isArray(value)
        ? value.length > 0
        : (value && typeof value === "object" && Object.keys(value).length > 0));

    const classRows = Array.isArray(classSource)
      ? classSource
      : Object.entries(classSource || {}).map(([classId, value]) =>
          typeof value === "object" ? { classId, ...value } : { classId, levels: value });

    const classIds = classRows
      .filter((entry) => Number(entry?.levels ?? entry?.level ?? entry?.classLevel ?? 0) > 0)
      .map((entry) => runtimeSlug(entry?.classId || entry?.id || entry?.name))
      .filter(Boolean);

    const archetypeSource = build.archetypes || character.archetypes || character.subclasses || [];
    const archetypeRows = Array.isArray(archetypeSource)
      ? archetypeSource
      : Object.entries(archetypeSource || {}).map(([classId, value]) =>
          typeof value === "object" ? { classId, ...value } : { classId, archetypeId: value });

    const archetypeIds = archetypeRows
      .map((entry) => runtimeSlug(entry?.archetypeId || entry?.subclassId || entry?.id))
      .filter(Boolean);

    return [...new Set([
      ...classIds.map((id) => `class:${id}`),
      ...archetypeIds.map((id) => `archetype:${id}`),
    ])];
  }

  function bindPlayerDataBoot() {
    if (playerDataListenerBound || !global.addEventListener) return;
    playerDataListenerBound = true;
    global.addEventListener("luminous:player-data", (event) => {
      boot({ context: "player", character: event?.detail?.data || global.datosJugador || {} })
        .catch((error) => console.error("Class Runtime Bootstrap:", error));
    });
  }

  async function loadPlayerBuild(registry, manifest, character = {}) {
    bindPlayerDataBoot();
    const requested = playerBuildRuntimeIds(character);
    const available = requested.filter((id) => Boolean(registry.get(id)));
    const missing = requested.filter((id) => !registry.get(id));
    const signature = available.slice().sort().join("|") || "empty";
    const key = `player:${signature}`;
    if (bootPromises.has(key)) return bootPromises.get(key);

    const promise = (async () => {
      const loaded = [];
      const errors = [];
      for (const id of available) {
        try { loaded.push(await registry.load(id, { context: "any" })); }
        catch (error) { errors.push({ id, error: String(error?.message || error) }); }
      }
      const result = {
        context: "player",
        loaded,
        errors,
        missing,
        ok: errors.length === 0,
        manifestVersion: manifest.version,
        manifestEntries: manifest.entries.length,
        selectedRuntimeIds: available,
      };
      if (global.dispatchEvent && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent("luminous:class-runtimes-ready", { detail: result }));
      }
      if (!result.ok) console.error("Class Runtime Bootstrap:", result.errors);
      return result;
    })();

    bootPromises.set(key, promise);
    return promise;
  }

  async function boot(options = {}) {
    // Resolve context synchronously, before awaiting infrastructure. Otherwise
    // document.currentScript may become null and context-specific adapters vanish.
    const requestedContext = detectContext(options.context);
    const { registry, manifest } = await ensureInfrastructure();

    // The Player sheet must never load every class/archetype runtime. Its build
    // arrives through the canonical player-data stream, so load only the active
    // class/archetype graph and let registry dependencies follow from there.
    if (requestedContext === "player") {
      return loadPlayerBuild(registry, manifest, options.character || global.datosJugador || {});
    }

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
    playerBuildRuntimeIds,
    loadPlayerBuild,
    boot,
    ready,
  });

  global.LuminousClassRuntimeBootstrap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (doc) boot({ context: initialScriptContext || detectContext() }).catch((error) => console.error("Class Runtime Bootstrap:", error));
})(typeof window !== "undefined" ? window : globalThis);
