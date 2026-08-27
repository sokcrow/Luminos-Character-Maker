(function (global) {
  "use strict";

  if (global.LuminousCharacterPersistence) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCharacterPersistence;
    return;
  }

  const CURRENT_SCHEMA_VERSION = 1;
  const migrations = new Map();

  const TRANSIENT_TOP_LEVEL_KEYS = Object.freeze([
    "abilityMods",
    "abilityModifiers",
    "derivedStats",
    "statBreakdown",
    "statBreakdowns",
    "traitEngineCache",
    "runtimeCache",
    "actionEconomy",
    "encounterState",
    "combatRuntime",
    "uiBreakdown",
    "uiState",
  ]);

  // Verified aliases from the legacy character-creation IDs to current Race IDs.
  // Anything without a proven equivalent is preserved as legacy input and diagnosed.
  const LEGACY_CONTENT_ALIASES = Object.freeze({
    race: Object.freeze({
      humano: "human",
      centauro: "centaur",
      goliat: "goliath",
      hada: "fairy",
      semi_dragon: "half_dragon",
      yuanti_pura_sangre: "yuan_ti_pureblood",
    }),
  });

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function owns(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function firstOwned(object, keys, fallback) {
    for (const key of keys) if (owns(object, key)) return object[key];
    return fallback;
  }

  function toInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function newDiagnostics() {
    return { errors: [], warnings: [] };
  }

  function pushDiagnostic(bucket, severity, code, message, details = {}) {
    const entry = { code, message, ...clone(details) };
    bucket[severity === "error" ? "errors" : "warnings"].push(entry);
    return entry;
  }

  function detectVersion(raw) {
    if (!isObject(raw)) return 0;
    if (raw.schemaVersion === undefined || raw.schemaVersion === null || raw.schemaVersion === "") return 0;
    const version = Number(raw.schemaVersion);
    return Number.isInteger(version) && version >= 0 ? version : 0;
  }

  function ensureRegistry(customRegistry) {
    if (customRegistry) return customRegistry;
    let registry = global.LuminousContentRegistry || null;
    if (!registry && typeof require === "function") {
      try { registry = require("./content-registry.js"); } catch (_) {}
    }

    let bootstrap = global.LuminousContentRegistryBootstrap || null;
    if (!bootstrap && typeof require === "function") {
      try { bootstrap = require("./content-registry-bootstrap.js"); } catch (_) {}
    }
    try { bootstrap?.registerAvailableCore?.(); } catch (_) {}
    return registry;
  }

  function registeredTypeAvailable(registry, type) {
    try { return Boolean(registry?.list?.({ type })?.length); } catch (_) { return false; }
  }

  function localIdFromCanonical(registry, type, canonical) {
    try {
      const entry = registry?.get?.(canonical);
      if (entry?.type === type && entry.id) return entry.id;
    } catch (_) {}
    const prefix = `${type}:`;
    return String(canonical || "").startsWith(prefix) ? String(canonical).slice(prefix.length) : null;
  }

  function resolveContentLocalId(type, value, options = {}, bucket = newDiagnostics()) {
    const raw = cleanString(value);
    if (!raw) return null;
    const registry = ensureRegistry(options.registry);

    if (registry) {
      try {
        const canonical = raw.startsWith(`${type}:`) ? registry.resolve(raw) : registry.resolve(type, raw);
        if (canonical) return localIdFromCanonical(registry, type, canonical);
      } catch (_) {}
    }

    const aliasTarget = LEGACY_CONTENT_ALIASES[type]?.[raw.toLowerCase()] || null;
    if (aliasTarget) {
      if (!registry || !registeredTypeAvailable(registry, type)) return aliasTarget;
      try {
        const canonical = registry.resolve(type, aliasTarget);
        if (canonical) return localIdFromCanonical(registry, type, canonical) || aliasTarget;
      } catch (_) {}
    }

    if (!registry || !registeredTypeAvailable(registry, type)) {
      pushDiagnostic(bucket, "warning", "REGISTRY_TYPE_UNAVAILABLE", `Cannot validate ${type} '${raw}' because that Registry type is not loaded.`, { type, value: raw });
      return raw;
    }

    if (options.legacyMode === true) {
      pushDiagnostic(bucket, "warning", "UNRESOLVED_LEGACY_CONTENT_ID", `Legacy ${type} '${raw}' has no verified canonical mapping.`, { type, value: raw });
      return null;
    }

    return raw;
  }

  function normalizeClassEntries(raw, options, bucket) {
    const build = isObject(raw.characterBuild) ? raw.characterBuild : {};
    const source = owns(build, "classes") ? build.classes : (Array.isArray(raw.classes) ? raw.classes : null);
    const entries = [];

    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (!entry) return;
        const value = typeof entry === "string" ? { classId: entry, levels: 1 } : entry;
        const classId = resolveContentLocalId("class", value.classId || value.id || value.clase || value.name, options, bucket);
        if (!classId) return;
        entries.push({ classId, levels: Math.max(1, toInteger(value.levels ?? value.level ?? value.classLevel ?? 1, 1)) });
      });
    } else {
      const byId = firstOwned(build, ["classLevels"], raw.classLevels || raw.classesById);
      if (isObject(byId)) {
        Object.entries(byId).forEach(([id, amount]) => {
          const classId = resolveContentLocalId("class", id, options, bucket);
          if (!classId) return;
          entries.push({ classId, levels: Math.max(1, toInteger(amount?.levels ?? amount?.level ?? amount, 1)) });
        });
      } else {
        const legacyClass = raw.clase || raw.classId || raw.className;
        if (legacyClass) {
          const classId = resolveContentLocalId("class", legacyClass, options, bucket);
          if (classId) entries.push({ classId, levels: Math.max(1, toInteger(raw.classLevel ?? raw.nivelClase ?? 1, 1)) });
        }
      }
    }

    const merged = new Map();
    entries.forEach((entry) => merged.set(entry.classId, (merged.get(entry.classId) || 0) + entry.levels));
    return [...merged.entries()].map(([classId, levels]) => ({ classId, levels })).sort((a, b) => a.classId.localeCompare(b.classId));
  }

  function normalizeArchetypes(raw, options, bucket) {
    const build = isObject(raw.characterBuild) ? raw.characterBuild : {};
    const source = owns(build, "archetypes") ? build.archetypes : (raw.archetypes ?? []);
    const list = Array.isArray(source)
      ? source
      : isObject(source)
        ? Object.entries(source).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) })
        : [];

    return list.map((entry) => {
      const classId = resolveContentLocalId("class", entry?.classId || entry?.parentClassId, options, bucket);
      const archetypeId = resolveContentLocalId("archetype", entry?.archetypeId || entry?.subclassId || entry?.id, options, bucket);
      if (!classId || !archetypeId) return null;
      const normalized = { classId, archetypeId };
      const selectedAt = toInteger(entry?.selectedAtClassLevel ?? entry?.selectedAtLevel, 0);
      if (selectedAt > 0) normalized.selectedAtClassLevel = selectedAt;
      return normalized;
    }).filter(Boolean).sort((a, b) => a.classId.localeCompare(b.classId));
  }

  function normalizeStringSelections(value) {
    const list = Array.isArray(value) ? value : isObject(value) ? Object.keys(value) : [];
    return [...new Set(list.map((entry) => cleanString(entry?.id || entry?.traitId || entry?.skillId || entry?.spellId || entry)).filter(Boolean))];
  }

  function normalizeCanonicalCharacter(input, options = {}) {
    const raw = clone(input || {});
    const bucket = options.diagnostics || newDiagnostics();
    const build = isObject(raw.characterBuild) ? raw.characterBuild : {};

    const raceRaw = firstOwned(build, ["raceId"], raw.raceId ?? raw.originId ?? raw.razaId ?? raw.raza);
    const raceId = raceRaw ? resolveContentLocalId("race", raceRaw, options, bucket) : null;

    let raceSubtypeId = cleanString(firstOwned(build, ["raceSubtypeId", "subraceId"], raw.raceSubtypeId ?? raw.subraceId));
    if (raceSubtypeId && raceId) {
      const registry = ensureRegistry(options.registry);
      const candidate = `${raceId}:${raceSubtypeId}`;
      if (registry && registeredTypeAvailable(registry, "subrace") && !registry.resolve("subrace", candidate)) {
        const legacyCandidate = registry.resolve("subrace", `${raceId}_${raceSubtypeId}`);
        if (legacyCandidate) raceSubtypeId = localIdFromCanonical(registry, "subrace", legacyCandidate)?.split(":").pop() || raceSubtypeId;
      }
    }

    const backgroundRaw = firstOwned(build, ["backgroundId"], raw.backgroundId ?? raw.trasfondoId);
    const backgroundId = backgroundRaw ? resolveContentLocalId("background", backgroundRaw, options, bucket) : null;
    const baseStats = clone(firstOwned(build, ["baseStats"], raw.baseStats ?? {}));
    const racialStatChoices = clone(firstOwned(build, ["racialStatChoices"], raw.racialStatChoices ?? []));
    const milestoneSelections = clone(firstOwned(build, ["milestoneSelections"], raw.milestoneSelections ?? []));
    const traitSelections = normalizeStringSelections(firstOwned(build, ["traitSelections"], raw.traitSelections ?? []));
    const skillSelections = normalizeStringSelections(firstOwned(build, ["skillSelections"], raw.skillSelections ?? []));
    const spellSelections = normalizeStringSelections(firstOwned(build, ["spellSelections"], raw.spellSelections ?? []));

    const next = { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION };
    next.characterBuild = {
      ...clone(build),
      raceId,
      raceSubtypeId: raceSubtypeId || null,
      backgroundId,
      classes: normalizeClassEntries(raw, options, bucket),
      archetypes: normalizeArchetypes(raw, options, bucket),
      baseStats: isObject(baseStats) ? baseStats : {},
      racialStatChoices: Array.isArray(racialStatChoices) ? racialStatChoices : [],
      milestoneSelections: Array.isArray(milestoneSelections) ? milestoneSelections : [],
      traitSelections,
      skillSelections,
      spellSelections,
    };

    const name = cleanString(raw.characterIdentity?.name || raw.characterName || raw.character_name || raw.nombre || raw.name);
    const characterId = cleanString(raw.characterIdentity?.characterId || raw.characterId || raw.identityId || raw.id);
    next.characterIdentity = {
      ...(isObject(raw.characterIdentity) ? clone(raw.characterIdentity) : {}),
      characterId: characterId || null,
      name: name || null,
    };

    return { character: next, diagnostics: bucket };
  }

  function validateTypedReference(registry, type, id, bucket, path) {
    if (!id) return;
    if (!registry || !registeredTypeAvailable(registry, type)) {
      pushDiagnostic(bucket, "warning", "REGISTRY_TYPE_UNAVAILABLE", `Cannot validate ${path}; Registry type '${type}' is not loaded.`, { type, id, path });
      return;
    }
    const result = registry.validateReference(id, type);
    if (!result.valid) {
      pushDiagnostic(bucket, "error", "UNKNOWN_CANONICAL_CONTENT_ID", `Unknown canonical ${type} id '${id}' at ${path}.`, { type, id, path, reason: result.reason });
    }
  }

  function validateCanonicalCharacter(character, options = {}) {
    const bucket = options.diagnostics || newDiagnostics();
    const registry = ensureRegistry(options.registry);
    if (!isObject(character)) {
      pushDiagnostic(bucket, "error", "INVALID_CHARACTER_DOCUMENT", "Character save must be an object.");
      return { valid: false, diagnostics: bucket };
    }
    if (detectVersion(character) !== CURRENT_SCHEMA_VERSION) {
      pushDiagnostic(bucket, "error", "INVALID_SCHEMA_VERSION", `Expected schemaVersion ${CURRENT_SCHEMA_VERSION}.`, { actual: character.schemaVersion });
    }
    if (!isObject(character.characterBuild)) {
      pushDiagnostic(bucket, "error", "MISSING_CHARACTER_BUILD", "Character save requires characterBuild.");
      return { valid: false, diagnostics: bucket };
    }

    const build = character.characterBuild;
    validateTypedReference(registry, "race", build.raceId, bucket, "characterBuild.raceId");
    validateTypedReference(registry, "background", build.backgroundId, bucket, "characterBuild.backgroundId");
    if (build.raceId && build.raceSubtypeId) validateTypedReference(registry, "subrace", `${build.raceId}:${build.raceSubtypeId}`, bucket, "characterBuild.raceSubtypeId");

    if (!Array.isArray(build.classes)) {
      pushDiagnostic(bucket, "error", "INVALID_CLASSES", "characterBuild.classes must be an array.");
    } else {
      const seen = new Set();
      build.classes.forEach((entry, index) => {
        if (!entry?.classId || toInteger(entry.levels, 0) <= 0) {
          pushDiagnostic(bucket, "error", "INVALID_CLASS_ENTRY", `Invalid class entry at index ${index}.`, { index });
          return;
        }
        if (seen.has(entry.classId)) pushDiagnostic(bucket, "error", "DUPLICATE_CLASS_ENTRY", `Duplicate class '${entry.classId}'.`, { classId: entry.classId });
        seen.add(entry.classId);
        validateTypedReference(registry, "class", entry.classId, bucket, `characterBuild.classes[${index}].classId`);
      });
    }

    if (Array.isArray(build.archetypes)) {
      build.archetypes.forEach((entry, index) => {
        validateTypedReference(registry, "class", entry?.classId, bucket, `characterBuild.archetypes[${index}].classId`);
        validateTypedReference(registry, "archetype", entry?.archetypeId, bucket, `characterBuild.archetypes[${index}].archetypeId`);
      });
    }

    [["traitSelections", "trait"], ["skillSelections", "skill"], ["spellSelections", "spell"]].forEach(([field, type]) => {
      if (!Array.isArray(build[field])) return;
      build[field].forEach((id, index) => validateTypedReference(registry, type, id, bucket, `characterBuild.${field}[${index}]`));
    });

    return { valid: bucket.errors.length === 0, diagnostics: bucket };
  }

  function registerMigration(fromVersion, migration) {
    const from = toInteger(fromVersion, -1);
    if (from < 0 || typeof migration !== "function") throw new Error("Migration requires a non-negative fromVersion and a function.");
    if (migrations.has(from)) throw new Error(`Migration from v${from} is already registered.`);
    migrations.set(from, migration);
    return migration;
  }

  function runMigrations(raw, options = {}) {
    const rawBackup = clone(raw);
    const bucket = newDiagnostics();
    if (!isObject(raw)) {
      pushDiagnostic(bucket, "error", "INVALID_CHARACTER_DOCUMENT", "Raw character must be an object.");
      return { ok: false, character: null, rawBackup, diagnostics: bucket, fromVersion: 0, toVersion: null };
    }

    const fromVersion = detectVersion(raw);
    if (fromVersion > CURRENT_SCHEMA_VERSION) {
      pushDiagnostic(bucket, "error", "UNSUPPORTED_FUTURE_SCHEMA", `Save schema v${fromVersion} is newer than supported v${CURRENT_SCHEMA_VERSION}.`, { fromVersion, supportedVersion: CURRENT_SCHEMA_VERSION });
      return { ok: false, character: null, rawBackup, diagnostics: bucket, fromVersion, toVersion: null };
    }

    let version = fromVersion;
    let current = clone(raw);
    try {
      while (version < CURRENT_SCHEMA_VERSION) {
        const migration = migrations.get(version);
        if (!migration) throw new Error(`Missing migration v${version} -> v${version + 1}.`);
        current = migration(current, { ...options, diagnostics: bucket });
        if (!isObject(current)) throw new Error(`Migration v${version} did not return a character object.`);
        const detected = detectVersion(current);
        if (detected !== version + 1) throw new Error(`Migration v${version} must produce schemaVersion ${version + 1}, got ${current.schemaVersion}.`);
        version = detected;
      }
    } catch (error) {
      pushDiagnostic(bucket, "error", "MIGRATION_FAILED", error?.message || String(error), { fromVersion: version });
      return { ok: false, character: null, rawBackup, diagnostics: bucket, fromVersion, toVersion: null };
    }

    const normalized = normalizeCanonicalCharacter(current, { ...options, diagnostics: bucket, legacyMode: false });
    const validation = validateCanonicalCharacter(normalized.character, { ...options, diagnostics: bucket });
    return {
      ok: validation.valid,
      character: validation.valid ? normalized.character : null,
      candidate: normalized.character,
      rawBackup,
      diagnostics: bucket,
      fromVersion,
      toVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  function stripTransientState(character) {
    const next = clone(character || {});
    TRANSIENT_TOP_LEVEL_KEYS.forEach((key) => { delete next[key]; });
    if (isObject(next.characterBuild)) {
      ["effectiveStats", "derivedStats", "abilityMods", "breakdowns", "runtime", "cache"].forEach((key) => { delete next.characterBuild[key]; });
    }
    return next;
  }

  function prepareForSave(input, options = {}) {
    const loaded = runMigrations(input, options);
    if (!loaded.ok) return loaded;
    const stripped = stripTransientState(loaded.character);
    const bucket = newDiagnostics();
    bucket.warnings.push(...clone(loaded.diagnostics.warnings));
    const normalized = normalizeCanonicalCharacter(stripped, { ...options, diagnostics: bucket, legacyMode: false });
    const validation = validateCanonicalCharacter(normalized.character, { ...options, diagnostics: bucket });
    return {
      ...loaded,
      ok: validation.valid,
      character: validation.valid ? normalized.character : null,
      candidate: normalized.character,
      diagnostics: bucket,
    };
  }

  function load(raw, options = {}) {
    return runMigrations(raw, options);
  }

  registerMigration(0, (raw, options = {}) => {
    const normalized = normalizeCanonicalCharacter({ ...clone(raw), schemaVersion: CURRENT_SCHEMA_VERSION }, { ...options, legacyMode: true });
    return normalized.character;
  });

  const api = Object.freeze({
    CURRENT_SCHEMA_VERSION,
    TRANSIENT_TOP_LEVEL_KEYS,
    LEGACY_CONTENT_ALIASES,
    detectVersion,
    normalizeCanonicalCharacter,
    validateCanonicalCharacter,
    registerMigration,
    runMigrations,
    load,
    prepareForSave,
    stripTransientState,
  });

  global.LuminousCharacterPersistence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
