(function (global) {
  "use strict";

  if (global.LuminousContentRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousContentRegistry;
    return;
  }

  const FIREBASE_FORBIDDEN = /[.#$\[\]\/\u0000-\u001F\u007F]/;
  const TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;
  const ID_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
  const entries = new Map();
  const aliases = new Map();

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeType(value) {
    const type = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!TYPE_PATTERN.test(type)) throw new Error(`Invalid content type: ${value}`);
    return type;
  }

  function validateLocalId(value) {
    const id = String(value ?? "").trim();
    if (!id) return { valid: false, reason: "empty" };
    if (FIREBASE_FORBIDDEN.test(id)) return { valid: false, reason: "firebase_forbidden_character" };
    const parts = id.split(":");
    if (!parts.every((part) => ID_SEGMENT_PATTERN.test(part))) return { valid: false, reason: "invalid_segment" };
    return { valid: true, id };
  }

  function assertLocalId(value) {
    const result = validateLocalId(value);
    if (!result.valid) throw new Error(`Invalid canonical content id '${value}': ${result.reason}`);
    return result.id;
  }

  function canonicalId(type, id) {
    return `${normalizeType(type)}:${assertLocalId(id)}`;
  }

  function parseCanonicalId(value) {
    const text = String(value ?? "").trim();
    const index = text.indexOf(":");
    if (index <= 0) return null;
    const type = text.slice(0, index);
    const id = text.slice(index + 1);
    try {
      return { type: normalizeType(type), id: assertLocalId(id), canonicalId: canonicalId(type, id) };
    } catch (_) {
      return null;
    }
  }

  function isFirebaseSafeId(value) {
    const text = String(value ?? "");
    return Boolean(text) && !FIREBASE_FORBIDDEN.test(text);
  }

  function legacyAliasToken(value) {
    return String(value ?? "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
  }

  function aliasKey(type, alias) {
    const token = legacyAliasToken(alias);
    if (!token) throw new Error(`Invalid legacy alias: ${alias}`);
    return `${normalizeType(type)}:${token}`;
  }

  function registerAlias(type, alias, target, metadata = {}) {
    const parsedTarget = parseCanonicalId(target) || parseCanonicalId(canonicalId(type, target));
    if (!parsedTarget) throw new Error(`Invalid alias target: ${target}`);
    if (parsedTarget.type !== normalizeType(type)) throw new Error(`Alias type mismatch: ${type} -> ${target}`);
    if (!entries.has(parsedTarget.canonicalId)) throw new Error(`Alias target is not registered: ${parsedTarget.canonicalId}`);
    const key = aliasKey(type, alias);
    const existing = aliases.get(key);
    if (existing && existing.target !== parsedTarget.canonicalId) {
      throw new Error(`Alias collision for ${type}:${alias}: ${existing.target} vs ${parsedTarget.canonicalId}`);
    }
    aliases.set(key, { target: parsedTarget.canonicalId, alias: String(alias), metadata: clone(metadata) || {} });
    return parsedTarget.canonicalId;
  }

  function register(input = {}, options = {}) {
    if (!input || typeof input !== "object") throw new Error("Content definition must be an object.");
    const type = normalizeType(input.type || options.type);
    const id = assertLocalId(input.id);
    const key = canonicalId(type, id);
    const source = String(input.sourceKey || options.source || input.source?.id || input.source?.type || "core");
    const normalized = Object.freeze({
      canonicalId: key,
      type,
      id,
      name: input.name ?? input.nombre ?? null,
      labelKey: input.labelKey ?? input.localizationKey ?? null,
      source,
      definition: clone(input.definition ?? input),
    });

    const existing = entries.get(key);
    if (existing) {
      if (options.allowSameDefinition === true && JSON.stringify(existing.definition) === JSON.stringify(normalized.definition)) return clone(existing);
      throw new Error(`Canonical content collision: ${key} is already registered by ${existing.source}.`);
    }
    entries.set(key, normalized);

    const explicitAliases = Array.isArray(input.aliases) ? input.aliases : [];
    explicitAliases.forEach((alias) => registerAlias(type, alias, key, { source, explicit: true }));
    if (options.nameAliases === true && normalized.name) {
      registerAlias(type, normalized.name, key, { source, legacyDisplayName: true });
    }
    return clone(normalized);
  }

  function registerCatalog(type, catalog, options = {}) {
    const source = options.source || "catalog";
    const raw = Array.isArray(catalog)
      ? catalog
      : Object.entries(catalog || {}).map(([key, value]) => ({ ...(value || {}), id: value?.id || key }));
    const registered = [];
    raw.filter(Boolean).forEach((definition) => {
      const id = definition.id;
      if (!id) throw new Error(`Catalog ${source} contains a definition without explicit id.`);
      registered.push(register({ ...definition, type, id }, { source, nameAliases: options.nameAliases === true, allowSameDefinition: options.allowSameDefinition === true }));
    });
    return registered;
  }

  function resolve(typeOrCanonicalId, maybeLegacyId) {
    if (maybeLegacyId === undefined) {
      const parsed = parseCanonicalId(typeOrCanonicalId);
      if (parsed && entries.has(parsed.canonicalId)) return parsed.canonicalId;
      return null;
    }
    const type = normalizeType(typeOrCanonicalId);
    const raw = String(maybeLegacyId ?? "").trim();
    try {
      const exact = canonicalId(type, raw);
      if (entries.has(exact)) return exact;
    } catch (_) {}
    return aliases.get(aliasKey(type, raw))?.target || null;
  }

  function get(typeOrCanonicalId, maybeId) {
    const key = maybeId === undefined ? resolve(typeOrCanonicalId) : resolve(typeOrCanonicalId, maybeId);
    const found = key ? entries.get(key) : null;
    return found ? clone(found) : null;
  }

  function has(typeOrCanonicalId, maybeId) {
    return Boolean(maybeId === undefined ? resolve(typeOrCanonicalId) : resolve(typeOrCanonicalId, maybeId));
  }

  function list(options = {}) {
    const type = options.type ? normalizeType(options.type) : null;
    const source = options.source ? String(options.source) : null;
    return [...entries.values()]
      .filter((entry) => (!type || entry.type === type) && (!source || entry.source === source))
      .map(clone)
      .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  }

  function validateReference(reference, expectedType = null) {
    const key = expectedType && !parseCanonicalId(reference)
      ? resolve(expectedType, reference)
      : resolve(reference);
    if (!key) return { valid: false, canonicalId: null, reason: "unknown_content_id" };
    const entry = entries.get(key);
    if (expectedType && entry.type !== normalizeType(expectedType)) {
      return { valid: false, canonicalId: key, reason: "type_mismatch", actualType: entry.type };
    }
    return { valid: true, canonicalId: key, entry: clone(entry) };
  }

  function clear(options = {}) {
    if (options.type) {
      const type = normalizeType(options.type);
      [...entries.keys()].filter((key) => entries.get(key)?.type === type).forEach((key) => entries.delete(key));
      [...aliases.keys()].filter((key) => key.startsWith(`${type}:`)).forEach((key) => aliases.delete(key));
      return;
    }
    entries.clear();
    aliases.clear();
  }

  const api = Object.freeze({
    version: 1,
    canonicalId,
    parseCanonicalId,
    validateLocalId,
    isFirebaseSafeId,
    legacyAliasToken,
    register,
    registerCatalog,
    registerAlias,
    resolve,
    get,
    has,
    list,
    validateReference,
    clear,
  });

  global.LuminousContentRegistry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
