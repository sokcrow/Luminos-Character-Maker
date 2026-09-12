(function (global) {
  "use strict";

  if (global.LuminousClassRuntimeRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousClassRuntimeRegistry;
    return;
  }

  const entries = new Map();
  const states = new Map();
  const loadPromises = new Map();
  const scriptPromises = new Map();

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function normalizeContext(value) {
    const context = normalizeId(value || "any");
    if (["battle", "combat"].includes(context)) return "combat";
    if (["sheet", "character", "theater", "theatre"].includes(context)) return "theatre";
    return "any";
  }

  function normalizeEntry(input = {}) {
    const id = normalizeId(input.id);
    const path = String(input.path || "").trim();
    if (!id) throw new Error("Class Runtime Registry: runtime id is required.");
    if (!path) throw new Error(`Class Runtime Registry: path is required for ${id}.`);
    const contexts = [...new Set((Array.isArray(input.contexts) ? input.contexts : [input.contexts || "any"]).map(normalizeContext))];
    const dependsOn = [...new Set((input.dependsOn || []).map(normalizeId).filter(Boolean))];
    return Object.freeze({
      id,
      path,
      kind: normalizeId(input.kind || "runtime"),
      contexts,
      dependsOn,
      globalName: input.globalName ? String(input.globalName) : null,
      autoload: input.autoload !== false,
      metadata: clone(input.metadata || {}),
    });
  }

  function register(input) {
    const entry = normalizeEntry(input);
    const existing = entries.get(entry.id);
    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(entry)) return clone(existing);
      throw new Error(`Class Runtime Registry: duplicate runtime id '${entry.id}'.`);
    }
    entries.set(entry.id, entry);
    states.set(entry.id, { status: "registered", error: null });
    return clone(entry);
  }

  function registerManifest(manifest) {
    const list = Array.isArray(manifest) ? manifest : manifest?.entries;
    if (!Array.isArray(list)) throw new TypeError("Class Runtime Registry: manifest entries must be an array.");
    return list.map(register);
  }

  function matchesContext(entry, context) {
    const requested = normalizeContext(context);
    return entry.contexts.includes("any") || requested === "any" || entry.contexts.includes(requested);
  }

  function runtimeGlobal(entry) {
    return entry.globalName ? global[entry.globalName] : null;
  }

  function scriptIdFor(entry) {
    return `luminous-runtime-${entry.id.replace(/[^a-z0-9_-]+/g, "-")}`;
  }

  function findExistingScript(entry) {
    if (!global.document) return null;
    const byId = global.document.getElementById(scriptIdFor(entry));
    if (byId) return byId;
    const scripts = [...global.document.querySelectorAll("script[src]")];
    const expected = entry.path.replace(/^\.\//, "");
    return scripts.find((script) => {
      const raw = String(script.getAttribute("src") || "").split(/[?#]/)[0].replace(/^\.\//, "");
      return raw === expected || raw.endsWith(`/${expected}`);
    }) || null;
  }

  function emit(name, detail) {
    if (!global.dispatchEvent || typeof global.CustomEvent !== "function") return;
    global.dispatchEvent(new global.CustomEvent(name, { detail }));
  }

  function loadScript(entry) {
    if (runtimeGlobal(entry)) return Promise.resolve({ entry, reused: true, runtime: runtimeGlobal(entry) });
    if (scriptPromises.has(entry.path)) return scriptPromises.get(entry.path);

    const promise = new Promise((resolve, reject) => {
      if (!global.document) {
        reject(new Error(`Class Runtime Registry: document is unavailable while loading ${entry.path}.`));
        return;
      }

      const existing = findExistingScript(entry);
      if (existing) {
        const runtime = runtimeGlobal(entry);
        resolve({ entry, reused: true, runtime: runtime || null });
        return;
      }

      const script = global.document.createElement("script");
      script.id = scriptIdFor(entry);
      script.src = entry.path;
      script.async = false;
      script.dataset.luminousRuntimeId = entry.id;
      script.addEventListener("load", () => {
        const runtime = runtimeGlobal(entry);
        if (entry.globalName && !runtime) {
          reject(new Error(`Class Runtime Registry: ${entry.id} loaded but ${entry.globalName} was not exposed.`));
          return;
        }
        resolve({ entry, reused: false, runtime: runtime || null });
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Class Runtime Registry: failed to load ${entry.path}.`)), { once: true });
      (global.document.head || global.document.documentElement).appendChild(script);
    });

    scriptPromises.set(entry.path, promise);
    return promise;
  }

  async function load(id, options = {}, stack = []) {
    const runtimeId = normalizeId(id);
    const entry = entries.get(runtimeId);
    if (!entry) throw new Error(`Class Runtime Registry: unknown runtime '${runtimeId}'.`);
    const context = normalizeContext(options.context || "any");
    if (!matchesContext(entry, context) && options.asDependency !== true) {
      return { id: runtimeId, status: "skipped", reason: "context_mismatch" };
    }
    if (states.get(runtimeId)?.status === "loaded") return { id: runtimeId, status: "loaded", reused: true };
    if (loadPromises.has(runtimeId)) return loadPromises.get(runtimeId);
    if (stack.includes(runtimeId)) throw new Error(`Class Runtime Registry: dependency cycle ${[...stack, runtimeId].join(" -> ")}.`);

    const promise = (async () => {
      states.set(runtimeId, { status: "loading", error: null });
      try {
        for (const dependencyId of entry.dependsOn) {
          await load(dependencyId, { context, asDependency: true }, [...stack, runtimeId]);
        }
        const result = await loadScript(entry);
        const runtime = runtimeGlobal(entry) || result.runtime;
        if (runtime && typeof runtime.install === "function") runtime.install();
        states.set(runtimeId, { status: "loaded", error: null });
        const detail = { id: runtimeId, entry: clone(entry), context, reused: result.reused === true };
        emit("luminous:class-runtime-loaded", detail);
        return { ...detail, status: "loaded" };
      } catch (error) {
        states.set(runtimeId, { status: "error", error: String(error?.message || error) });
        emit("luminous:class-runtime-error", { id: runtimeId, entry: clone(entry), context, error });
        throw error;
      }
    })();

    loadPromises.set(runtimeId, promise);
    return promise;
  }

  async function loadAll(options = {}) {
    const context = normalizeContext(options.context || "any");
    const selected = [...entries.values()]
      .filter((entry) => entry.autoload !== false && matchesContext(entry, context))
      .sort((a, b) => a.id.localeCompare(b.id));
    const loaded = [];
    const errors = [];
    for (const entry of selected) {
      try { loaded.push(await load(entry.id, { context })); }
      catch (error) { errors.push({ id: entry.id, error: String(error?.message || error) }); }
    }
    const result = { context, loaded, errors, ok: errors.length === 0 };
    emit("luminous:class-runtimes-ready", result);
    return result;
  }

  function get(id) {
    const entry = entries.get(normalizeId(id));
    return entry ? clone(entry) : null;
  }

  function list(options = {}) {
    const context = options.context ? normalizeContext(options.context) : null;
    return [...entries.values()]
      .filter((entry) => !context || matchesContext(entry, context))
      .map((entry) => ({ ...clone(entry), state: clone(states.get(entry.id) || { status: "registered", error: null }) }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function status(id) {
    const runtimeId = normalizeId(id);
    return clone(states.get(runtimeId) || null);
  }

  const api = Object.freeze({
    version: 1,
    normalizeContext,
    register,
    registerManifest,
    get,
    list,
    status,
    load,
    loadAll,
  });

  global.LuminousClassRuntimeRegistry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
