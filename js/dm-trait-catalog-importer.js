(function (global) {
  "use strict";

  const doc = global.document || null;
  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);

  function optionalRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const initialCoreCatalog = global.LuminousTraitCatalogCore || optionalRequire("./trait-catalog-core.js");
  const initialBardRuntime = global.LuminousBardClassRuntime || optionalRequire("./bard-class-runtime.js");
  initialBardRuntime?.wrapCatalog?.();
  const initialRacialCatalog = global.LuminousRacialTraitCatalog || optionalRequire("./racial-trait-catalog.js");
  const initialArchetypeCatalog = global.LuminousArchetypeTraitCatalog || optionalRequire("./archetype-trait-catalog.js");

  const TRAITS_ROOT = "campaña/config/traits";
  const DEFINITIONS_ROOT = `${TRAITS_ROOT}/definitions`;
  const GRANTS_ROOT = `${TRAITS_ROOT}/grants`;

  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }

  function comparableDefinition(value = {}) {
    const copy = { ...(value || {}) };
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy.catalogSource;
    delete copy.catalogVersion;
    return stableValue(copy);
  }

  function definitionsEqual(left, right) {
    return JSON.stringify(comparableDefinition(left)) === JSON.stringify(comparableDefinition(right));
  }

  function providerVersion(catalog) {
    const value = Number(catalog?.CATALOG_VERSION || 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function catalogProviders() {
    const core = global.LuminousTraitCatalogCore || initialCoreCatalog;
    const racial = global.LuminousRacialTraitCatalog || initialRacialCatalog;
    const archetype = global.LuminousArchetypeTraitCatalog || initialArchetypeCatalog;
    return [
      { key: "core", catalog: core, includeGrants: true },
      { key: "racial", catalog: racial, includeGrants: false },
      { key: "archetype", catalog: archetype, includeGrants: false },
    ].filter((entry) => entry.catalog?.allDefinitions);
  }

  function collectCatalog() {
    const definitions = {};
    const grants = [];
    const grantIdentities = new Set();
    const errors = [];
    const providers = catalogProviders();

    providers.forEach(({ key, catalog, includeGrants }) => {
      const version = providerVersion(catalog);
      Object.entries(catalog.allDefinitions?.() || {}).forEach(([rawId, definition]) => {
        const id = engine?.normalizeId ? engine.normalizeId(rawId) : String(rawId || "").trim().toLowerCase();
        if (!id) {
          errors.push(`${key}: Trait definition is missing an id.`);
          return;
        }

        if (definitions[id]) {
          if (!definitionsEqual(definitions[id].definition, definition)) {
            errors.push(`${id}: conflicting Trait definitions from ${definitions[id].catalogSource} and ${key}.`);
          }
          return;
        }

        definitions[id] = {
          id,
          definition,
          catalogSource: key,
          catalogVersion: version,
        };
      });

      if (!includeGrants) return;
      (catalog.allGrants?.() || []).forEach((grant) => {
        const identity = grantIdentity(grant);
        if (grantIdentities.has(identity)) return;
        grantIdentities.add(identity);
        grants.push({
          id: grant?.id,
          grant,
          catalogSource: key,
          catalogVersion: version,
        });
      });
    });

    return { definitions, grants, providers, errors };
  }

  function grantIdentity(grant = {}) {
    const type = engine?.normalizeId ? engine.normalizeId(grant.sourceType || grant.source?.type) : String(grant.sourceType || "").trim().toLowerCase();
    const sourceId = engine?.normalizeId ? engine.normalizeId(grant.sourceId || grant.source?.id || grant.source?.classId) : String(grant.sourceId || "").trim().toLowerCase();
    const traitId = engine?.normalizeId ? engine.normalizeId(grant.traitId || grant.id) : String(grant.traitId || "").trim().toLowerCase();
    const level = type === "class" ? Number(grant.atLevel ?? grant.level ?? 0) : 0;
    return `${type}:${sourceId}:${traitId}:${level}`;
  }

  function buildImportPlan(existingDefinitions = {}, existingGrants = [], helpers = {}) {
    const collected = collectCatalog();
    const errors = [...collected.errors];
    const definitionWrites = [];
    const grantWrites = [];
    const existingIdentities = new Set((existingGrants || []).map(grantIdentity));

    Object.values(collected.definitions).forEach(({ id, definition, catalogSource, catalogVersion }) => {
      const validation = helpers.validateDefinitionForPersistence
        ? helpers.validateDefinitionForPersistence(definition)
        : engine?.validateTrait?.(definition);
      if (!validation?.valid) {
        (validation?.errors || ["Invalid Trait definition."]).forEach((message) => errors.push(`${id}: ${message}`));
        return;
      }

      const existing = existingDefinitions?.[id];
      const existingSource = String(existing?.catalogSource || "").trim().toLowerCase();
      const existingCatalogVersion = Number(existing?.catalogVersion || 0);
      const legacyCoreManaged = !existingSource && catalogSource === "core" && existingCatalogVersion > 0;
      const managedByProvider = existingSource === catalogSource || legacyCoreManaged;
      const needsCatalogUpgrade = Boolean(existing && managedByProvider && (
        existingCatalogVersion < catalogVersion ||
        !definitionsEqual(existing, validation.trait)
      ));

      if (!existing || needsCatalogUpgrade) {
        definitionWrites.push({
          id,
          definition: validation.trait,
          replace: Boolean(existing),
          previous: existing || null,
          catalogSource,
          catalogVersion,
        });
      }
    });

    collected.grants.forEach(({ id, grant, catalogSource, catalogVersion }) => {
      const idValidation = helpers.validateFirebaseKey ? helpers.validateFirebaseKey(id) : { valid: Boolean(id), errors: [] };
      const validation = helpers.validateGrant ? helpers.validateGrant(grant) : { valid: true, grant };
      if (!idValidation.valid) {
        (idValidation.errors || ["Invalid Firebase key."]).forEach((message) => errors.push(`${id || "<grant>"}: ${message}`));
        return;
      }
      if (!validation.valid) {
        (validation.errors || ["Invalid Grant."]).forEach((message) => errors.push(`${id}: ${message}`));
        return;
      }
      const identity = grantIdentity(validation.grant);
      if (!existingIdentities.has(identity)) {
        grantWrites.push({ id, grant: validation.grant, catalogSource, catalogVersion });
        existingIdentities.add(identity);
      }
    });

    return {
      valid: !errors.length,
      errors,
      definitionWrites,
      grantWrites,
      skippedDefinitions: Math.max(0, Object.keys(collected.definitions).length - definitionWrites.length),
      skippedGrants: Math.max(0, collected.grants.length - grantWrites.length),
      providerKeys: collected.providers.map((entry) => entry.key),
    };
  }

  function buildAtomicImportMutation(currentTree = {}, helpers = {}, stamp = Date.now()) {
    const root = asRecord(currentTree);
    const definitions = asRecord(root.definitions);
    const grantMap = asRecord(root.grants);
    const existingGrants = Object.entries(grantMap).map(([id, grant]) => ({ id, ...(grant || {}) }));
    const plan = buildImportPlan(definitions, existingGrants, helpers);

    if (!plan.valid) {
      return { valid: false, changed: false, errors: plan.errors, plan, next: root };
    }

    const changed = Boolean(plan.definitionWrites.length || plan.grantWrites.length);
    if (!changed) return { valid: true, changed: false, errors: [], plan, next: root };

    const nextDefinitions = { ...definitions };
    const nextGrants = { ...grantMap };

    plan.definitionWrites.forEach(({ id, definition, previous, catalogSource, catalogVersion }) => {
      nextDefinitions[id] = {
        ...definition,
        createdAt: previous?.createdAt ?? stamp,
        updatedAt: stamp,
        catalogSource,
        catalogVersion,
      };
    });
    plan.grantWrites.forEach(({ id, grant, catalogSource, catalogVersion }) => {
      nextGrants[id] = {
        ...grant,
        createdAt: stamp,
        updatedAt: stamp,
        catalogSource,
        catalogVersion,
      };
    });

    return {
      valid: true,
      changed: true,
      errors: [],
      plan,
      next: { ...root, definitions: nextDefinitions, grants: nextGrants },
    };
  }

  async function runAtomicImport(database, helpers = {}, stamp = Date.now()) {
    if (!database?.ref) throw new Error("Firebase database is not available.");
    const rootRef = database.ref(TRAITS_ROOT);
    if (!rootRef?.transaction) throw new Error("Firebase transaction API is not available.");

    let lastMutation = null;
    let planningErrors = null;

    const result = await rootRef.transaction((currentTree) => {
      const mutation = buildAtomicImportMutation(currentTree, helpers, stamp);
      lastMutation = mutation;

      if (!mutation.valid) {
        planningErrors = mutation.errors;
        return undefined;
      }

      // A no-op still returns the unchanged tree. In Firebase 8, returning
      // undefined aborts locally and can accept a stale cache as authoritative.
      // Returning the tree forces the transaction to confirm against the server;
      // if another DM deleted or changed catalog data, Firebase retries this
      // callback with the newest server state before declaring the import done.
      return mutation.next;
    });

    if (planningErrors?.length) throw new Error(planningErrors.join(" · "));
    if (!lastMutation) throw new Error("Firebase transaction did not evaluate the Trait catalog.");
    if (!result?.committed) {
      throw new Error("Trait catalog transaction was not committed or server-confirmed.");
    }

    return { ...lastMutation.plan, committed: true };
  }

  function ensureScript(id, src, ready) {
    if (!doc || ready?.()) return Promise.resolve();
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
      doc.head?.appendChild(script);
    });
  }

  async function ensureBuiltInCatalogs() {
    initialBardRuntime?.wrapCatalog?.();
    if (!doc) return catalogProviders();

    await ensureScript("bard-class-runtime-script", "js/bard-class-runtime.js", () => Boolean(global.LuminousBardClassRuntime));
    global.LuminousBardClassRuntime?.wrapCatalog?.();

    await Promise.all([
      ensureScript("racial-trait-catalog-script", "js/racial-trait-catalog.js", () => Boolean(global.LuminousRacialTraitCatalog)),
      ensureScript("archetype-engine-script", "js/archetype-engine.js", () => Boolean(global.LuminousArchetypeEngine)),
    ]);
    await ensureScript("archetype-trait-catalog-script", "js/archetype-trait-catalog.js", () => Boolean(global.LuminousArchetypeTraitCatalog));

    return catalogProviders();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      TRAITS_ROOT,
      DEFINITIONS_ROOT,
      GRANTS_ROOT,
      grantIdentity,
      catalogProviders,
      collectCatalog,
      buildImportPlan,
      buildAtomicImportMutation,
      runAtomicImport,
      ensureBuiltInCatalogs,
    };
  }

  if (!doc || !engine || global.LuminousTraitCatalogImporter) return;

  function timestamp() {
    return global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now();
  }

  function feedback(message, kind = "") {
    const node = doc.getElementById("dm-trait-feedback");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
  }

  function library() {
    return global.LuminousDmTraitLibrary || null;
  }

  async function importCatalog() {
    const lib = library();
    if (!lib) throw new Error("Trait Library no está lista.");
    if (!global.firebase?.database || !global.firebase?.apps?.length) throw new Error("Firebase no está disponible.");

    const providers = await ensureBuiltInCatalogs();
    const validationErrors = [];
    providers.forEach(({ key, catalog }) => {
      if (!catalog?.validateAll) return;
      const validation = catalog.validateAll(engine);
      if (!validation?.valid) {
        (validation?.errors || ["Invalid catalog."]).forEach((message) => validationErrors.push(`${key}: ${message}`));
      }
    });
    if (validationErrors.length) throw new Error(validationErrors.join(" · "));

    const plan = await runAtomicImport(
      global.firebase.database(),
      {
        validateDefinitionForPersistence: lib.validateDefinitionForPersistence,
        validateGrant: lib.validateGrant,
        validateFirebaseKey: lib.validateFirebaseKey,
      },
      timestamp(),
    );

    if (!plan.definitionWrites.length && !plan.grantWrites.length) {
      feedback("Los catálogos integrados ya están sincronizados. No hay cambios.", "success");
      return plan;
    }

    const upgraded = plan.definitionWrites.filter((entry) => entry.replace).length;
    const created = plan.definitionWrites.length - upgraded;
    feedback(`Catálogos sincronizados: ${created} Traits nuevos · ${upgraded} actualizados · ${plan.grantWrites.length} Grants genéricos.`, "success");
    return plan;
  }

  function mountButton() {
    if (doc.getElementById("dm-trait-import-core")) return true;
    const create = doc.getElementById("dm-trait-create");
    if (!create?.parentElement) return false;

    const button = doc.createElement("button");
    button.id = "dm-trait-import-core";
    button.className = "btn-cyber";
    button.type = "button";
    button.textContent = "SINCRONIZAR CATÁLOGOS";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = "SINCRONIZANDO...";
      try {
        await importCatalog();
      } catch (error) {
        console.error("Trait Catalog Sync:", error);
        feedback(error.message || "No se pudieron sincronizar los catálogos.", "error");
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    });

    create.parentElement.insertBefore(button, create);
    return true;
  }

  function start() {
    if (mountButton()) return;
    const observer = new MutationObserver(() => {
      if (mountButton()) observer.disconnect();
    });
    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
  }

  global.LuminousTraitCatalogImporter = Object.freeze({
    TRAITS_ROOT,
    DEFINITIONS_ROOT,
    GRANTS_ROOT,
    grantIdentity,
    catalogProviders,
    collectCatalog,
    buildImportPlan,
    buildAtomicImportMutation,
    runAtomicImport,
    ensureBuiltInCatalogs,
    importCatalog,
    mountButton,
  });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);