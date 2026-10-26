(function (global) {
  "use strict";

  if (global.LuminousPlayerProgressionTreeCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPlayerProgressionTreeCore;
    return;
  }

  const VERSION = "0.1.0";
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const int = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function normalizeClasses(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const candidates = [
      build.classes, build.classLevels, build.classesById,
      character.classes, character.classLevels, character.classesById,
      character?.dnd?.classes,
    ];
    let source = candidates.find((value) => Array.isArray(value) ? value.length > 0 : (value && typeof value === "object" && Object.keys(value).length > 0));
    if (!source) return [];

    const rows = Array.isArray(source)
      ? source
      : Object.entries(source).map(([classId, value]) => typeof value === "object" ? { classId, ...value } : { classId, levels: value });

    const totals = new Map();
    rows.forEach((entry) => {
      const classId = normalizeId(entry?.classId || entry?.id || entry?.name);
      const levels = Math.max(0, int(entry?.levels ?? entry?.level ?? entry?.classLevel, 0));
      if (!classId || levels <= 0) return;
      totals.set(classId, (totals.get(classId) || 0) + levels);
    });
    return [...totals.entries()].map(([classId, levels]) => ({ classId, levels }));
  }

  function normalizeSelections(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = build.archetypes || character.archetypes || character.subclasses || [];
    const rows = Array.isArray(source)
      ? source
      : Object.entries(source || {}).map(([classId, value]) => typeof value === "object" ? { classId, ...value } : { classId, archetypeId: value });

    return rows.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.parentClassId),
      archetypeId: normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id),
      selectedAtClassLevel: Math.max(0, int(entry?.selectedAtClassLevel ?? entry?.selectedAtLevel, 0)),
    })).filter((entry) => entry.classId && entry.archetypeId);
  }

  function selectedArchetypeForClass(character = {}, classId) {
    const id = normalizeId(classId);
    return normalizeSelections(character).find((entry) => entry.classId === id) || null;
  }

  function grantSourceType(grant = {}) {
    return normalizeId(grant.sourceType || grant?.source?.type || grant.type);
  }

  function grantClassId(grant = {}, definition = {}, archetype = {}) {
    return normalizeId(
      grant.classId
      || grant.parentClassId
      || (grantSourceType(grant) === "class" ? grant.sourceId : "")
      || grant?.source?.classId
      || grant?.source?.parentClassId
      || definition?.source?.classId
      || definition?.source?.parentClassId
      || archetype?.classId
    );
  }

  function grantArchetypeId(grant = {}, definition = {}) {
    return normalizeId(
      grant.archetypeId
      || (grantSourceType(grant) === "archetype" ? grant.sourceId : "")
      || grant?.source?.archetypeId
      || grant?.source?.subclassId
      || definition?.source?.archetypeId
      || definition?.source?.subclassId
    );
  }

  function grantLevel(grant = {}) {
    return Math.max(0, int(grant.atLevel ?? grant.level ?? grant?.source?.atLevel ?? grant?.source?.requiredClassLevel, 0));
  }

  function grantContentId(grant = {}) {
    return normalizeId(grant.traitId || grant.skillId || grant.spellId || grant.featureId || grant.definitionId || grant.id);
  }

  function grantKind(grant = {}) {
    if (grant.traitId) return "trait";
    if (grant.skillId) return "skill";
    if (grant.spellId) return "spell";
    return normalizeId(grant.grantType || grant.kind || "feature") || "feature";
  }

  function definitionForGrant(grant, definitions = {}) {
    const id = grantContentId(grant);
    return id && definitions ? clone(definitions[id] || null) : null;
  }

  function className(classId, classDefinitions = []) {
    const id = normalizeId(classId);
    const list = Array.isArray(classDefinitions) ? classDefinitions : Object.values(classDefinitions || {});
    const found = list.find((entry) => normalizeId(entry?.id || entry?.classId) === id);
    return String(found?.name || found?.label || classId || "Class");
  }

  function groupByLevel(grants = [], definitions = {}) {
    const groups = new Map();
    (grants || []).forEach((grant) => {
      const level = grantLevel(grant);
      if (!level) return;
      if (!groups.has(level)) groups.set(level, []);
      const definition = definitionForGrant(grant, definitions);
      groups.get(level).push({
        id: grantContentId(grant),
        kind: grantKind(grant),
        grant: clone(grant),
        definition,
        name: String(definition?.name || definition?.label || grant.name || grantContentId(grant) || "Feature"),
        description: String(definition?.description || grant.description || ""),
      });
    });
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, items]) => ({ level, items }));
  }

  function snapshotCharacterAtClassLevel(character = {}, classId, classLevel) {
    const id = normalizeId(classId);
    const level = Math.max(0, int(classLevel, 0));
    const next = clone(character || {}) || {};
    const classes = normalizeClasses(character).map((entry) => ({ ...entry }));
    const found = classes.find((entry) => entry.classId === id);
    if (found) found.levels = level;
    else if (id && level > 0) classes.push({ classId: id, levels: level });

    next.classes = classes.map((entry) => ({ classId: entry.classId, levels: entry.levels }));
    next.classLevels = Object.fromEntries(classes.map((entry) => [entry.classId, entry.levels]));
    next.characterBuild = next.characterBuild && typeof next.characterBuild === "object" ? next.characterBuild : {};
    next.characterBuild.classes = clone(next.classes);
    next.characterBuild.calculatedAtLevel = level;
    next.level = level;
    return next;
  }

  function collectFormulas(value, path = "", output = []) {
    if (!value || typeof value !== "object") return output;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => collectFormulas(entry, path ? `${path}.${index}` : String(index), output));
      return output;
    }
    Object.entries(value).forEach(([key, entry]) => {
      const nextPath = path ? `${path}.${key}` : key;
      if ((/formula$/i.test(key) || key === "formula") && (typeof entry === "string" || typeof entry === "number")) {
        output.push({ path: nextPath, formula: entry });
        return;
      }
      if (entry && typeof entry === "object") collectFormulas(entry, nextPath, output);
    });
    return output;
  }

  function previewFormulas(definition = {}, character = {}, classId, nodeLevel, traitEngine = global.LuminousTraitEngine) {
    if (!definition || !traitEngine?.buildVariables || !traitEngine?.evaluateFormula) return [];
    const level = Math.max(0, int(nodeLevel, 0));
    const snapshot = snapshotCharacterAtClassLevel(character, classId, level);
    const runtime = { Level: level, level, ClassLevel: level, classLevel: level, sourceClassId: normalizeId(classId) };
    let variables;
    try {
      variables = traitEngine.buildVariables(snapshot, runtime, definition);
    } catch (_) {
      variables = { Level: level, ClassLevel: level };
    }

    return collectFormulas(definition).map((entry) => {
      try {
        const value = traitEngine.evaluateFormula(entry.formula, variables);
        return { ...entry, value, variables: { Level: level, ClassLevel: level } };
      } catch (error) {
        return { ...entry, value: null, error: String(error?.message || error), variables: { Level: level, ClassLevel: level } };
      }
    });
  }

  function decorateNodePreviews(nodes, character, classId, traitEngine) {
    return nodes.map((node) => ({
      ...node,
      items: node.items.map((item) => ({
        ...item,
        formulas: previewFormulas(item.definition || {}, character, classId, node.level, traitEngine),
      })),
    }));
  }

  function resolvedCatalogSources(options = {}) {
    const traitCatalog = options.traitCatalog || global.LuminousTraitCatalogCore || null;
    const archetypeCatalog = options.archetypeCatalog || global.LuminousArchetypeTraitCatalog || null;
    // Separate preview source: these feature descriptions NEVER enter the live
    // trait grant catalog and cannot grant a non-selected archetype's effects.
    const previews = options.progressionPreviews || global.LuminousArchetypeProgressionPreviews || null;
    const definitions = {
      ...(previews?.allDefinitions?.() || {}),
      ...(global.LuminousSpellCatalog || {}),
      ...(global.LuminousPlayerSignatureSkillCatalog?.DEFINITIONS || {}),
      ...(traitCatalog?.allDefinitions?.() || traitCatalog?.DEFINITIONS || {}),
      ...(archetypeCatalog?.allDefinitions?.() || archetypeCatalog?.DEFINITIONS || {}),
      ...(options.definitions || {}),
    };
    const traitGrants = options.traitGrants || traitCatalog?.allGrants?.() || traitCatalog?.GRANTS || [];
    const liveArchetypeGrants = options.archetypeGrants || archetypeCatalog?.allGrants?.() || archetypeCatalog?.GRANTS || [];
    const uniqueGrants = new Map();
    [...(previews?.allGrants?.() || []), ...liveArchetypeGrants].forEach((grant) => {
      const key = [normalizeId(grant.archetypeId || grant.sourceId), int(grant.atLevel ?? grant.level,0),normalizeId(grant.traitId || grant.id)].join(":");
      if (key) uniqueGrants.set(key, grant);
    });
    const archetypeGrants = [...uniqueGrants.values()];
    const archetypes = options.archetypes || archetypeCatalog?.allArchetypes?.() || archetypeCatalog?.ARCHETYPES || {};
    const classDefinitions = options.classDefinitions || global.LuminousCharacterBuildRules?.CLASSES || [];
    return { definitions, traitGrants, archetypeGrants, archetypes, classDefinitions };
  }

  function buildProgressionModel(character = {}, options = {}) {
    const sources = resolvedCatalogSources(options);
    const traitEngine = options.traitEngine || global.LuminousTraitEngine || null;
    const classes = normalizeClasses(character);
    const selections = normalizeSelections(character);
    const archetypeList = Array.isArray(sources.archetypes) ? sources.archetypes : Object.values(sources.archetypes || {});

    const classModels = classes.map((entry) => {
      const classId = entry.classId;
      const classLevel = entry.levels;
      const commonGrants = (sources.traitGrants || []).filter((grant) => {
        if (grantSourceType(grant) !== "class") return false;
        const definition = definitionForGrant(grant, sources.definitions) || {};
        return grantClassId(grant, definition) === classId;
      });
      const commonNodes = decorateNodePreviews(groupByLevel(commonGrants, sources.definitions), character, classId, traitEngine)
        .map((node) => ({ ...node, status: node.level <= classLevel ? "earned" : "future" }));

      const selected = selections.find((selection) => selection.classId === classId) || null;
      const branches = archetypeList
        .filter((archetype) => normalizeId(archetype?.classId) === classId)
        .map((archetype) => {
          const archetypeId = normalizeId(archetype.id);
          const unlockLevel = Math.max(0, int(archetype.unlockLevel ?? archetype.selectAtLevel ?? 15, 15));
          const isSelected = selected?.archetypeId === archetypeId;
          const branchStatus = isSelected
            ? "selected"
            : selected
              ? "locked"
              : classLevel >= unlockLevel
                ? "available"
                : "future";
          const grants = (sources.archetypeGrants || []).filter((grant) => {
            if (grantSourceType(grant) !== "archetype") return false;
            const definition = definitionForGrant(grant, sources.definitions) || {};
            return grantArchetypeId(grant, definition) === archetypeId
              && grantClassId(grant, definition, archetype) === classId;
          });
          const nodes = decorateNodePreviews(groupByLevel(grants, sources.definitions), character, classId, traitEngine)
            .map((node) => ({
              ...node,
              status: branchStatus === "locked"
                ? "locked"
                : isSelected
                  ? (node.level <= classLevel ? "earned" : "future")
                  : "preview",
            }));
          return {
            id: archetypeId,
            name: String(archetype.name || archetypeId),
            description: String(archetype.description || ""),
            classId,
            unlockLevel,
            traitLevels: clone(archetype.traitLevels || []),
            status: branchStatus,
            selectedAtClassLevel: isSelected ? selected?.selectedAtClassLevel || null : null,
            nodes,
          };
        })
        .sort((a, b) => a.unlockLevel - b.unlockLevel || a.name.localeCompare(b.name));

      const levels = [...new Set([
        ...commonNodes.map((node) => node.level),
        ...branches.map((branch) => branch.unlockLevel),
        ...branches.flatMap((branch) => branch.nodes.map((node) => node.level)),
      ])].filter((level) => level > 0).sort((a, b) => a - b);

      return {
        classId,
        className: className(classId, sources.classDefinitions),
        classLevel,
        commonNodes,
        branches,
        selectedArchetypeId: selected?.archetypeId || null,
        levels,
      };
    });

    return {
      version: VERSION,
      characterLevel: Math.max(0, int(character.level ?? character?.characterBuild?.calculatedAtLevel, 0)),
      classes: classModels,
      hasProgressionData: classModels.some((entry) => entry.commonNodes.length || entry.branches.length),
    };
  }

  function earnedCharacterLevel(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    return Math.max(0, int(character.level ?? build.calculatedAtLevel, 0));
  }

  function classDefinitionMap(classDefinitions = global.LuminousCharacterBuildRules?.CLASSES || []) {
    const list = Array.isArray(classDefinitions) ? classDefinitions : Object.values(classDefinitions || {});
    return new Map(list.map((entry) => [normalizeId(entry?.id || entry?.classId), clone(entry)]).filter(([id]) => id));
  }

  function classAllocationSummary(character = {}) {
    const classes = normalizeClasses(character);
    const earnedLevel = earnedCharacterLevel(character);
    const allocatedLevel = classes.reduce((sum, entry) => sum + Math.max(0, int(entry.levels, 0)), 0);
    return {
      earnedLevel,
      allocatedLevel,
      pendingLevels: Math.max(0, earnedLevel - allocatedLevel),
      overAllocatedLevels: Math.max(0, allocatedLevel - earnedLevel),
      classes,
    };
  }

  function normalizeAllocationDraft(value = [], classDefinitions = global.LuminousCharacterBuildRules?.CLASSES || [], currentClasses = []) {
    const definitions = classDefinitionMap(classDefinitions);
    const currentIds = new Set((currentClasses || []).map((entry) => normalizeId(entry?.classId || entry?.id)).filter(Boolean));
    const rows = Array.isArray(value)
      ? value
      : Object.entries(value || {}).map(([classId, levels]) => ({ classId, levels }));
    const totals = new Map();

    rows.forEach((entry) => {
      const classId = normalizeId(entry?.classId || entry?.id || entry?.name);
      const levels = Math.max(0, int(entry?.levels ?? entry?.level ?? entry?.classLevel, 0));
      if (!classId || levels <= 0) return;
      if (!definitions.has(classId) && !currentIds.has(classId)) return;
      totals.set(classId, (totals.get(classId) || 0) + levels);
    });

    return [...totals.entries()]
      .map(([classId, levels]) => ({ classId, levels }))
      .sort((a, b) => a.classId.localeCompare(b.classId));
  }

  function validateClassAllocation(character = {}, proposed = [], classDefinitions = global.LuminousCharacterBuildRules?.CLASSES || [], options = {}) {
    const current = classAllocationSummary(character);
    const definitions = classDefinitionMap(classDefinitions);
    const currentById = new Map(current.classes.map((entry) => [entry.classId, entry.levels]));
    const rawRows = Array.isArray(proposed)
      ? proposed
      : Object.entries(proposed || {}).map(([classId, levels]) => ({ classId, levels }));
    const errors = [];
    const seen = new Set();

    rawRows.forEach((entry) => {
      const classId = normalizeId(entry?.classId || entry?.id || entry?.name);
      const rawLevels = entry?.levels ?? entry?.level ?? entry?.classLevel;
      const levels = Number(rawLevels);
      if (!classId) {
        errors.push("Hay una clase sin identificador.");
        return;
      }
      if (seen.has(classId)) {
        errors.push(`La clase ${classId} aparece más de una vez.`);
        return;
      }
      seen.add(classId);
      if (!definitions.has(classId) && !currentById.has(classId)) errors.push(`Clase desconocida: ${classId}.`);
      if (!Number.isInteger(levels) || levels < 0) errors.push(`Los niveles de ${classId} deben ser un entero no negativo.`);
    });

    const classes = normalizeAllocationDraft(rawRows, classDefinitions, current.classes);
    const proposedById = new Map(classes.map((entry) => [entry.classId, entry.levels]));

    current.classes.forEach((entry) => {
      const next = proposedById.get(entry.classId) || 0;
      if (next < entry.levels) {
        errors.push(`No puedes reducir ${entry.classId} de ${entry.levels} a ${next}. Usa el reset del DM para corregir niveles ya confirmados.`);
      }
    });

    const proposedTotal = classes.reduce((sum, entry) => sum + entry.levels, 0);
    const maxLevel = Math.max(1, int(global.LuminousCharacterBuildRules?.SETTINGS?.maxCharacterLevel, 100));
    if (current.earnedLevel > maxLevel) errors.push(`El nivel del personaje (${current.earnedLevel}) supera el máximo soportado (${maxLevel}).`);
    if (proposedTotal > current.earnedLevel) errors.push(`Intentas asignar ${proposedTotal} niveles, pero el personaje sólo tiene ${current.earnedLevel}.`);
    if (options.requireAll !== false && proposedTotal !== current.earnedLevel) {
      errors.push(`Debes asignar todos los niveles disponibles antes de confirmar: ${Math.max(0, current.earnedLevel - proposedTotal)} pendientes.`);
    }

    const changed = classes.some((entry) => currentById.get(entry.classId) !== entry.levels)
      || current.classes.some((entry) => !proposedById.has(entry.classId));

    return {
      valid: errors.length === 0,
      errors,
      earnedLevel: current.earnedLevel,
      allocatedBefore: current.allocatedLevel,
      allocatedAfter: proposedTotal,
      pendingAfter: Math.max(0, current.earnedLevel - proposedTotal),
      classes,
      changed,
      before: current.classes,
    };
  }

  function allocationChanges(character = {}, proposed = [], classDefinitions = global.LuminousCharacterBuildRules?.CLASSES || []) {
    const validation = validateClassAllocation(character, proposed, classDefinitions, { requireAll: false });
    const before = new Map(validation.before.map((entry) => [entry.classId, entry.levels]));
    return validation.classes
      .map((entry) => ({
        classId: entry.classId,
        before: before.get(entry.classId) || 0,
        after: entry.levels,
        delta: entry.levels - (before.get(entry.classId) || 0),
      }))
      .filter((entry) => entry.delta !== 0);
  }

  const api = Object.freeze({
    VERSION,
    normalizeId,
    normalizeClasses,
    normalizeSelections,
    selectedArchetypeForClass,
    grantSourceType,
    grantClassId,
    grantArchetypeId,
    grantLevel,
    grantContentId,
    grantKind,
    groupByLevel,
    snapshotCharacterAtClassLevel,
    collectFormulas,
    previewFormulas,
    buildProgressionModel,
    earnedCharacterLevel,
    classDefinitionMap,
    classAllocationSummary,
    normalizeAllocationDraft,
    validateClassAllocation,
    allocationChanges,
  });

  global.LuminousPlayerProgressionTreeCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
