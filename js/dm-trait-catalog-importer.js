(function (global) {
  "use strict";

  const doc = global.document || null;
  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const catalog = global.LuminousTraitCatalogCore || (typeof require === "function" ? require("./trait-catalog-core.js") : null);
  const TRAITS_ROOT = "campaña/config/traits";
  const DEFINITIONS_ROOT = `${TRAITS_ROOT}/definitions`;
  const GRANTS_ROOT = `${TRAITS_ROOT}/grants`;

  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function grantIdentity(grant = {}) {
    const type = engine?.normalizeId ? engine.normalizeId(grant.sourceType || grant.source?.type) : String(grant.sourceType || "").trim().toLowerCase();
    const sourceId = engine?.normalizeId ? engine.normalizeId(grant.sourceId || grant.source?.id || grant.source?.classId) : String(grant.sourceId || "").trim().toLowerCase();
    const traitId = engine?.normalizeId ? engine.normalizeId(grant.traitId || grant.id) : String(grant.traitId || "").trim().toLowerCase();
    const level = type === "class" ? Number(grant.atLevel ?? grant.level ?? 0) : 0;
    return `${type}:${sourceId}:${traitId}:${level}`;
  }

  function buildImportPlan(existingDefinitions = {}, existingGrants = [], helpers = {}) {
    const definitions = catalog?.allDefinitions?.() || {};
    const grants = catalog?.allGrants?.() || [];
    const errors = [];
    const definitionWrites = [];
    const grantWrites = [];
    const existingIdentities = new Set((existingGrants || []).map(grantIdentity));

    Object.entries(definitions).forEach(([id, definition]) => {
      const validation = helpers.validateDefinitionForPersistence
        ? helpers.validateDefinitionForPersistence(definition)
        : engine?.validateTrait?.(definition);
      if (!validation?.valid) {
        (validation?.errors || ["Invalid Trait definition."]).forEach((message) => errors.push(`${id}: ${message}`));
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(existingDefinitions || {}, id)) {
        definitionWrites.push({ id, definition: validation.trait });
      }
    });

    grants.forEach((grant) => {
      const idValidation = helpers.validateFirebaseKey ? helpers.validateFirebaseKey(grant.id) : { valid: Boolean(grant.id), errors: [] };
      const validation = helpers.validateGrant ? helpers.validateGrant(grant) : { valid: true, grant };
      if (!idValidation.valid) {
        (idValidation.errors || ["Invalid Firebase key."]).forEach((message) => errors.push(`${grant.id || "<grant>"}: ${message}`));
        return;
      }
      if (!validation.valid) {
        (validation.errors || ["Invalid Grant."]).forEach((message) => errors.push(`${grant.id}: ${message}`));
        return;
      }
      const identity = grantIdentity(validation.grant);
      if (!existingIdentities.has(identity)) {
        grantWrites.push({ id: grant.id, grant: validation.grant });
        existingIdentities.add(identity);
      }
    });

    return {
      valid: !errors.length,
      errors,
      definitionWrites,
      grantWrites,
      skippedDefinitions: Math.max(0, Object.keys(definitions).length - definitionWrites.length),
      skippedGrants: Math.max(0, grants.length - grantWrites.length),
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

    plan.definitionWrites.forEach(({ id, definition }) => {
      nextDefinitions[id] = {
        ...definition,
        createdAt: stamp,
        updatedAt: stamp,
        catalogVersion: catalog.CATALOG_VERSION,
      };
    });
    plan.grantWrites.forEach(({ id, grant }) => {
      nextGrants[id] = {
        ...grant,
        createdAt: stamp,
        updatedAt: stamp,
        catalogVersion: catalog.CATALOG_VERSION,
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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      TRAITS_ROOT,
      DEFINITIONS_ROOT,
      GRANTS_ROOT,
      grantIdentity,
      buildImportPlan,
      buildAtomicImportMutation,
      runAtomicImport,
    };
  }

  if (!doc || !engine || !catalog || global.LuminousTraitCatalogImporter) return;

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

    const catalogValidation = catalog.validateAll(engine);
    if (!catalogValidation.valid) throw new Error(catalogValidation.errors.join(" · "));

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
      feedback("El catálogo base ya está importado. No hay cambios.", "success");
      return plan;
    }

    feedback(`Catálogo base importado: ${plan.definitionWrites.length} Traits · ${plan.grantWrites.length} Grants.`, "success");
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
    button.textContent = "IMPORTAR CATÁLOGO BASE";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = "IMPORTANDO...";
      try {
        await importCatalog();
      } catch (error) {
        console.error("Core Trait Catalog Import:", error);
        feedback(error.message || "No se pudo importar el catálogo base.", "error");
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
    buildImportPlan,
    buildAtomicImportMutation,
    runAtomicImport,
    importCatalog,
    mountButton,
  });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);
