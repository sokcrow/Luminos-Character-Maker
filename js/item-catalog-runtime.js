(function (global) {
  "use strict";

  if (global.LuminousItemCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemCatalog;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const registry = () => global.LuminousContentRegistry || safeRequire("./content-registry.js");
  const icons = () => global.LuminousItemIconRegistry || safeRequire("./item-icon-registry.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, "_").replace(/^_+|_+$/g, "");
  const base = new Map();
  const overrides = new Map();
  let firebaseBinding = null;

  const RUNTIME_CATEGORY = Object.freeze({
    weapon_chassis: "weapon",
    armor_chassis: "armor",
    accessory_chassis: "accessory",
    food_drink: "consumable",
    module: "upgrade"
  });

  function allData() {
    const chunks = Array.isArray(global.LuminousItemCatalogV10Chunks) ? global.LuminousItemCatalogV10Chunks : [];
    return chunks.flatMap((chunk) => Array.isArray(chunk) ? chunk : []);
  }

  function canonicalIdOf(definition = {}, fallback = "") {
    const raw = String(definition.canonicalId || definition.definitionId || definition.definition_id || definition.id || fallback || "").trim();
    if (!raw) return "";
    if (raw.includes(":")) return raw;
    const category = String(definition.category || definition.tipo_categoria || "item").toLowerCase();
    const type = category === "module" || category === "upgrade" ? "module" : "item";
    return `${type}:${normalize(raw)}`;
  }

  function runtimeCategoryOf(definition = {}) {
    const category = String(definition.category || definition.tipo_categoria || "item").trim().toLowerCase();
    return RUNTIME_CATEGORY[category] || category || "item";
  }

  function normalizeDefinition(input = {}, fallbackId = "") {
    const definition = clone(input) || {};
    const canonicalId = canonicalIdOf(definition, fallbackId);
    if (!canonicalId) return null;
    definition.canonicalId = canonicalId;
    definition.definitionId = canonicalId;
    definition.displayName = String(definition.displayName || definition.nombre || definition.name || canonicalId).trim();
    definition.name = definition.displayName;
    definition.nombre = definition.displayName;
    definition.description = String(definition.description || definition.descripcion || "");
    definition.descripcion = definition.description;
    definition.price = Number(definition.price ?? definition.basePriceAhn ?? definition.valorBase ?? 0) || 0;
    definition.basePriceAhn = Number(definition.basePriceAhn ?? definition.price ?? 0) || 0;
    definition.valorBase = definition.price;
    definition.stashStackLimit = Math.max(1, Number(definition.stashStackLimit ?? definition.stackMax ?? definition.max_stash ?? 99) || 99);
    definition.activeStackLimit = Math.max(1, Number(definition.activeStackLimit ?? definition.inventoryMax ?? definition.max_inventory ?? 2) || 2);
    definition.stackMax = definition.stashStackLimit;
    definition.inventoryMax = definition.activeStackLimit;
    definition.max_stash = definition.stashStackLimit;
    definition.max_inventory = definition.activeStackLimit;
    definition.tipo_categoria = runtimeCategoryOf(definition);
    if (typeof definition.tags === "string") definition.tags = definition.tags.split(/[|,]/g).map((tag) => tag.trim()).filter(Boolean);
    if (!Array.isArray(definition.tags)) definition.tags = [];
    const iconRegistry = icons();
    if (iconRegistry) {
      definition.iconGroup = iconRegistry.groupOf(definition);
      definition.icon = iconRegistry.resolve(definition);
      definition.icono = definition.icon;
    }
    return definition;
  }

  function registerBaseDefinition(raw) {
    const definition = normalizeDefinition(raw);
    if (!definition) return null;
    base.set(definition.canonicalId, definition);
    const content = registry();
    const parsed = content?.parseCanonicalId?.(definition.canonicalId);
    if (content?.register && parsed && !content.has?.(definition.canonicalId)) {
      try {
        content.register({
          type: parsed.type,
          id: parsed.id,
          name: definition.displayName,
          definition,
          aliases: [definition.displayName],
          sourceKey: "luminous-item-db-v10"
        }, { source: "luminous-item-db-v10", nameAliases: true });
      } catch (error) {
        if (!/already registered|Alias collision/i.test(String(error?.message || error))) throw error;
      }
    }
    return definition;
  }

  function installBaseCatalog() {
    allData().forEach(registerBaseDefinition);
    return base.size;
  }

  function setOverride(key, raw) {
    if (!raw || typeof raw !== "object") return false;
    const definition = normalizeDefinition(raw, key);
    if (!definition) return false;
    const original = base.get(definition.canonicalId) || {};
    overrides.set(definition.canonicalId, normalizeDefinition({ ...clone(original), ...definition }, definition.canonicalId));
    return true;
  }

  function clearOverrides() {
    overrides.clear();
  }

  function get(ref) {
    const id = typeof ref === "object" ? canonicalIdOf(ref) : String(ref || "").trim();
    if (!id) return null;
    const direct = overrides.get(id) || base.get(id);
    if (direct) return clone(direct);
    const content = registry();
    const resolved = content?.get?.(id) || content?.get?.("item", id) || content?.get?.("module", id);
    if (resolved) return normalizeDefinition(resolved.definition || resolved, id);
    return null;
  }

  function resolveDefinition(ref) {
    if (ref && typeof ref === "object") {
      const id = canonicalIdOf(ref);
      const definition = id ? get(id) : null;
      return definition ? normalizeDefinition({ ...definition, ...clone(ref), canonicalId: id, definitionId: id }, id) : normalizeDefinition(ref, id);
    }
    return get(ref);
  }

  function list(options = {}) {
    const category = String(options.category || "").trim().toLowerCase();
    const subtype = String(options.subtype || "").trim().toLowerCase();
    const query = String(options.query || "").trim().toLowerCase();
    const merged = new Map(base);
    overrides.forEach((value, key) => merged.set(key, value));
    return [...merged.values()].filter((definition) => {
      if (category && String(definition.category || "").toLowerCase() !== category) return false;
      if (subtype && String(definition.subtype || "").toLowerCase() !== subtype) return false;
      if (query) {
        const haystack = [definition.canonicalId, definition.displayName, definition.category, definition.subtype, ...(definition.tags || [])].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    }).map(clone).sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
  }

  function categories() {
    const counts = {};
    list().forEach((definition) => { counts[definition.category || "item"] = (counts[definition.category || "item"] || 0) + 1; });
    return counts;
  }

  function firebaseKeyFor(canonicalId) {
    return String(canonicalId || "").trim();
  }

  function emitUpdate(reason, detail = {}) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent("luminous:item-catalog-updated", { detail: { reason, size: base.size, overrides: overrides.size, ...detail } }));
      }
    } catch (_) {}
  }

  function applyFirebaseSnapshot(value) {
    clearOverrides();
    Object.entries(value && typeof value === "object" ? value : {}).forEach(([key, raw]) => setOverride(key, raw));
    emitUpdate("firebase_snapshot");
    return overrides.size;
  }

  function bindFirebase(db, path = "campaña/base_datos_items") {
    if (!db?.ref) return { bound: false, reason: "database_unavailable" };
    firebaseBinding?.dispose?.();
    const ref = db.ref(path);
    const handler = (snapshot) => applyFirebaseSnapshot(snapshot?.val?.() || {});
    const errorHandler = (error) => console.error("[Luminous] Item catalog override sync failed:", error);
    ref.on("value", handler, errorHandler);
    firebaseBinding = { bound: true, path, dispose() { try { ref.off("value", handler); } catch (_) {} } };
    return firebaseBinding;
  }

  function autoBindFirebase() {
    try {
      const db = global.firebase?.database?.();
      if (db?.ref) return bindFirebase(db);
    } catch (_) {}
    return { bound: false, reason: "firebase_not_ready" };
  }

  async function saveOverride(db, definition, options = {}) {
    if (!db?.ref) return { saved: false, reason: "database_unavailable" };
    const normalized = normalizeDefinition(definition);
    if (!normalized) return { saved: false, reason: "invalid_definition" };
    const path = options.path || "campaña/base_datos_items";
    const key = firebaseKeyFor(normalized.canonicalId);
    const payload = { ...clone(normalized), catalogOverride: true, catalogVersion: "V10" };
    await db.ref(`${path}/${key}`).set(payload);
    setOverride(key, payload);
    emitUpdate("override_saved", { canonicalId: normalized.canonicalId });
    return { saved: true, definition: clone(payload), canonicalId: normalized.canonicalId };
  }

  async function removeOverride(db, canonicalId, options = {}) {
    if (!db?.ref) return { removed: false, reason: "database_unavailable" };
    const id = String(canonicalId || "").trim();
    if (!id) return { removed: false, reason: "missing_canonical_id" };
    const path = options.path || "campaña/base_datos_items";
    await db.ref(`${path}/${firebaseKeyFor(id)}`).remove();
    overrides.delete(id);
    emitUpdate("override_removed", { canonicalId: id });
    return { removed: true, canonicalId: id };
  }

  function stats() {
    return { baseDefinitions: base.size, overrides: overrides.size, total: list().length, categories: categories() };
  }

  installBaseCatalog();

  const api = Object.freeze({
    version: 10,
    source: "Luminous_Item_Database_Runtime_V10.xlsx",
    runtimeCategoryOf,
    normalizeDefinition,
    installBaseCatalog,
    resolveDefinition,
    get,
    list,
    categories,
    stats,
    setOverride,
    applyFirebaseSnapshot,
    bindFirebase,
    autoBindFirebase,
    saveOverride,
    removeOverride,
    firebaseKeyFor
  });

  global.LuminousItemCatalog = api;
  if (global.document) global.setTimeout?.(autoBindFirebase, 0);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
