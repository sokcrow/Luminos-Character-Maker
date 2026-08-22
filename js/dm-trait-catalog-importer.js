(function (global) {
  "use strict";

  const doc = global.document || null;
  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const catalog = global.LuminousTraitCatalogCore || (typeof require === "function" ? require("./trait-catalog-core.js") : null);
  const TRAITS_ROOT = "campaña/config/traits";
  const DEFINITIONS_ROOT = `${TRAITS_ROOT}/definitions`;
  const GRANTS_ROOT = `${TRAITS_ROOT}/grants`;

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

  async function readPersistedTraitState(database) {
    if (!database?.ref) throw new Error("Firebase database is not available.");
    const [definitionsSnapshot, grantsSnapshot] = await Promise.all([
      database.ref(DEFINITIONS_ROOT).once("value"),
      database.ref(GRANTS_ROOT).once("value"),
    ]);
    const definitions = definitionsSnapshot?.val?.() || {};
    const rawGrants = grantsSnapshot?.val?.() || {};
    const grants = Object.entries(rawGrants).map(([id, grant]) => ({ id, ...(grant || {}) }));
    return { definitions, grants };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      TRAITS_ROOT,
      DEFINITIONS_ROOT,
      GRANTS_ROOT,
      grantIdentity,
      buildImportPlan,
      readPersistedTraitState,
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

    // Read Firebase directly at click time. The Trait Library UI listeners are
    // asynchronous and may not have delivered their initial snapshots yet.
    // Import planning must never assume an empty library from stale UI state.
    const database = global.firebase.database();
    const persisted = await readPersistedTraitState(database);
    const plan = buildImportPlan(
      persisted.definitions,
      persisted.grants,
      {
        validateDefinitionForPersistence: lib.validateDefinitionForPersistence,
        validateGrant: lib.validateGrant,
        validateFirebaseKey: lib.validateFirebaseKey,
      },
    );
    if (!plan.valid) throw new Error(plan.errors.join(" · "));

    if (!plan.definitionWrites.length && !plan.grantWrites.length) {
      feedback("El catálogo base ya está importado. No hay cambios.", "success");
      return plan;
    }

    const stamp = timestamp();
    const updates = {};
    plan.definitionWrites.forEach(({ id, definition }) => {
      updates[`definitions/${id}`] = { ...definition, createdAt: stamp, updatedAt: stamp, catalogVersion: catalog.CATALOG_VERSION };
    });
    plan.grantWrites.forEach(({ id, grant }) => {
      updates[`grants/${id}`] = { ...grant, createdAt: stamp, updatedAt: stamp, catalogVersion: catalog.CATALOG_VERSION };
    });

    await database.ref(TRAITS_ROOT).update(updates);
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
    readPersistedTraitState,
    importCatalog,
    mountButton,
  });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);
