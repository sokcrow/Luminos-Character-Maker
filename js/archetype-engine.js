(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const toInt = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function classEntries(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const list = Array.isArray(build.classes) ? build.classes : Array.isArray(character.classes) ? character.classes : null;
    if (list) {
      return list
        .map((entry) => ({
          classId: normalizeId(entry?.classId || entry?.id),
          levels: Math.max(0, toInt(entry?.levels ?? entry?.level)),
        }))
        .filter((entry) => entry.classId && entry.levels > 0);
    }

    const source = build.classLevels || character.classLevels || character.classesById || {};
    return Object.entries(source)
      .map(([classId, levels]) => ({
        classId: normalizeId(classId),
        levels: Math.max(0, toInt(levels?.levels ?? levels?.level ?? levels)),
      }))
      .filter((entry) => entry.classId && entry.levels > 0);
  }

  function getClassLevel(character = {}, classId) {
    const id = normalizeId(classId);
    return classEntries(character).find((entry) => entry.classId === id)?.levels || 0;
  }

  function normalizeSelections(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const raw = build.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw)
      ? raw
      : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string"
        ? { classId, archetypeId: value }
        : { classId, ...(value || {}) });

    // Intentionally preserve duplicate Class entries here. Validation must see malformed
    // persisted input instead of silently normalizing it into a valid one. Callers that
    // select/replace an Archetype canonicalize the chosen Class by filtering and re-adding it.
    return list.map((entry) => {
      const classId = normalizeId(entry?.classId || entry?.parentClassId || entry?.class);
      const archetypeId = normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id || entry?.archetype);
      if (!classId || !archetypeId) return null;
      return {
        classId,
        archetypeId,
        selectedAtClassLevel: Math.max(0, toInt(entry?.selectedAtClassLevel ?? entry?.selectedAtLevel)),
      };
    }).filter(Boolean);
  }

  function catalogEntries(catalog = {}) {
    if (Array.isArray(catalog)) return catalog.filter(Boolean);
    return Object.values(catalog || {}).filter(Boolean);
  }

  function normalizeArchetype(entry = {}) {
    const id = normalizeId(entry.id || entry.archetypeId || entry.name);
    const classId = normalizeId(entry.classId || entry.parentClassId || entry.parentClass);
    return {
      ...clone(entry),
      id,
      archetypeId: id,
      classId,
      name: String(entry.name || entry.archetypeName || id || "Archetype"),
      className: String(entry.className || entry.parentClassName || classId || "Class"),
      unlockLevel: Math.max(0, toInt(entry.unlockLevel ?? entry.selectAtLevel ?? 15, 15)),
    };
  }

  function archetypeMap(catalog = {}) {
    return new Map(catalogEntries(catalog).map(normalizeArchetype).filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  }

  function selectedForClass(character = {}, classId) {
    const id = normalizeId(classId);
    return normalizeSelections(character).find((entry) => entry.classId === id) || null;
  }

  function isSelected(character = {}, archetypeId, classId = null) {
    const archetype = normalizeId(archetypeId);
    const parent = normalizeId(classId);
    return normalizeSelections(character).some((entry) => entry.archetypeId === archetype && (!parent || entry.classId === parent));
  }

  function eligibleArchetypes(character = {}, catalog = {}, classId = null) {
    const parent = normalizeId(classId);
    return [...archetypeMap(catalog).values()].filter((archetype) => {
      if (parent && archetype.classId !== parent) return false;
      return getClassLevel(character, archetype.classId) >= archetype.unlockLevel;
    });
  }

  function validateSelections(character = {}, catalog = {}) {
    const definitions = archetypeMap(catalog);
    const raw = normalizeSelections(character);
    const errors = [];
    const seenClasses = new Set();

    raw.forEach((selection) => {
      if (seenClasses.has(selection.classId)) errors.push(`Only one Archetype can be selected for ${selection.classId}.`);
      seenClasses.add(selection.classId);
      const archetype = definitions.get(selection.archetypeId);
      if (!archetype) {
        errors.push(`Unknown Archetype: ${selection.archetypeId}.`);
        return;
      }
      if (archetype.classId !== selection.classId) {
        errors.push(`${archetype.name} belongs to ${archetype.classId}, not ${selection.classId}.`);
      }
      const classLevel = getClassLevel(character, archetype.classId);
      if (classLevel < archetype.unlockLevel) {
        errors.push(`${archetype.name} requires ${archetype.className} Class Level ${archetype.unlockLevel}.`);
      }
    });

    return { valid: errors.length === 0, errors, selections: raw };
  }

  function selectArchetype(character = {}, classId, archetypeId, catalog = {}, options = {}) {
    const parent = normalizeId(classId);
    const id = normalizeId(archetypeId);
    const archetype = archetypeMap(catalog).get(id);
    if (!archetype) throw new Error(`Unknown Archetype: ${id}.`);
    if (archetype.classId !== parent) throw new Error(`${archetype.name} cannot be selected for ${parent}.`);
    const classLevel = getClassLevel(character, parent);
    if (classLevel < archetype.unlockLevel) throw new Error(`${archetype.name} requires Class Level ${archetype.unlockLevel}.`);

    const current = normalizeSelections(character);
    const existing = current.find((entry) => entry.classId === parent);
    if (existing && existing.archetypeId !== id && options.allowReplace !== true) {
      throw new Error(`${parent} already has Archetype ${existing.archetypeId}.`);
    }

    const next = current.filter((entry) => entry.classId !== parent);
    next.push({ classId: parent, archetypeId: id, selectedAtClassLevel: classLevel });
    return next.sort((a, b) => a.classId.localeCompare(b.classId));
  }

  function grantSourceType(grant = {}) {
    return normalizeId(grant.sourceType || grant.source?.type);
  }

  function grantArchetypeId(grant = {}) {
    return normalizeId(grant.archetypeId || grant.sourceId || grant.source?.archetypeId || grant.source?.id);
  }

  function grantClassId(grant = {}, definition = {}, archetype = {}) {
    return normalizeId(
      grant.classId || grant.parentClassId || grant.source?.classId || grant.source?.parentClassId ||
      definition?.source?.classId || definition?.source?.parentClassId || archetype.classId,
    );
  }

  function resolveTraitGrants(character = {}, grants = [], catalog = {}, archetypes = {}, traitEngine = global.LuminousTraitEngine) {
    const definitionMap = catalog instanceof Map
      ? catalog
      : new Map(Object.entries(catalog || {}).map(([key, value]) => [normalizeId(key), value]));
    const archetypeDefinitions = archetypeMap(archetypes);
    const selections = normalizeSelections(character);

    return (Array.isArray(grants) ? grants : Object.values(grants || {}))
      .filter((grant) => grantSourceType(grant) === "archetype")
      .map((grant) => {
        const traitId = normalizeId(grant.traitId || grant.id);
        const definition = definitionMap.get(traitId);
        if (!definition) return null;
        const archetypeId = grantArchetypeId(grant) || normalizeId(definition?.source?.archetypeId || definition?.source?.id);
        const archetype = archetypeDefinitions.get(archetypeId) || normalizeArchetype({
          id: archetypeId,
          classId: grantClassId(grant, definition),
          name: definition?.source?.archetypeName || archetypeId,
          className: definition?.source?.className || grantClassId(grant, definition),
          unlockLevel: 0,
        });
        const classId = grantClassId(grant, definition, archetype);
        const selected = selections.some((entry) => entry.classId === classId && entry.archetypeId === archetypeId);
        const atLevel = Math.max(0, toInt(grant.atLevel ?? grant.level));
        if (!selected || getClassLevel(character, classId) < atLevel) return null;

        const normalized = traitEngine?.normalizeTrait ? traitEngine.normalizeTrait(definition) : clone(definition);
        normalized.source = {
          ...(normalized.source || {}),
          ...(grant.source || {}),
          type: "archetype",
          id: archetypeId,
          archetypeId,
          archetypeName: archetype.name,
          classId,
          className: archetype.className,
          atLevel,
          requiredClassLevel: atLevel,
        };
        return normalized;
      })
      .filter(Boolean);
  }

  function groupTraitsByArchetype(traits = []) {
    const groups = new Map();
    (traits || []).forEach((trait) => {
      const source = trait?.source || {};
      const type = normalizeId(source.type || trait?.sourceType);
      if (!["archetype", "subclass", "class_archetype"].includes(type)) return;
      const archetypeId = normalizeId(source.archetypeId || source.subclassId || source.id);
      if (!archetypeId) return;
      if (!groups.has(archetypeId)) {
        groups.set(archetypeId, {
          archetypeId,
          name: String(source.archetypeName || source.subclassName || source.name || archetypeId),
          classId: normalizeId(source.classId || source.parentClassId || source.parentClass),
          className: String(source.className || source.parentClassName || source.classId || ""),
          traits: [],
        });
      }
      groups.get(archetypeId).traits.push(trait);
    });
    return [...groups.values()];
  }

  const api = Object.freeze({
    normalizeId,
    classEntries,
    getClassLevel,
    normalizeSelections,
    normalizeArchetype,
    archetypeMap,
    selectedForClass,
    isSelected,
    eligibleArchetypes,
    validateSelections,
    selectArchetype,
    resolveTraitGrants,
    groupTraitsByArchetype,
  });

  global.LuminousArchetypeEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
