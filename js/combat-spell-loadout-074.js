(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousCombatSpellLoadout074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => clean(value).toLowerCase().replace(/\s+/g, "_");

  function contentRegistry() {
    if (global?.LuminousContentRegistry) return global.LuminousContentRegistry;
    if (typeof require === "function") {
      try { return require("./content-registry.js"); } catch (_) {}
    }
    return null;
  }

  function contentBootstrap() {
    if (global?.LuminousContentRegistryBootstrap) return global.LuminousContentRegistryBootstrap;
    if (typeof require === "function") {
      try { return require("./content-registry-bootstrap.js"); } catch (_) {}
    }
    return null;
  }

  function spellcastingRuntime() {
    if (global?.LuminousSpellcastingRuntime) return global.LuminousSpellcastingRuntime;
    if (typeof require === "function") {
      try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
      try { return require("./spellcasting-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function selectionSource(source = {}) {
    if (Array.isArray(source.spellIds)) return source.spellIds;
    if (Array.isArray(source.spellSelections)) return source.spellSelections;
    if (Array.isArray(source.characterBuild?.spellSelections)) return source.characterBuild.spellSelections;
    if (source.spellSelectionIndex && typeof source.spellSelectionIndex === "object") {
      return Object.entries(source.spellSelectionIndex).filter(([, enabled]) => enabled === true).map(([id]) => id);
    }
    return [];
  }

  function spellIdsFor(source = {}) {
    return [...new Set(selectionSource(source).map((entry) => clean(entry?.spellId || entry?.id || entry)).filter(Boolean))];
  }

  function buildSpellSelectionIndex(sourceOrIds = {}) {
    const ids = Array.isArray(sourceOrIds) ? sourceOrIds.map(clean).filter(Boolean) : spellIdsFor(sourceOrIds);
    return Object.fromEntries([...new Set(ids)].map((id) => [id, true]));
  }

  function ownsSpell(source = {}, spellId) {
    const id = clean(spellId);
    if (!id) return false;
    if (source.spellSelectionIndex && typeof source.spellSelectionIndex === "object") return source.spellSelectionIndex[id] === true;
    return spellIdsFor(source).includes(id);
  }

  function registerAvailableSpellCatalog() {
    const bootstrap = contentBootstrap();
    try { bootstrap?.registerAvailableCore?.(); } catch (_) {}
    return contentRegistry();
  }

  function spellEntry(spellId) {
    const id = clean(spellId);
    if (!id) return null;
    const registry = registerAvailableSpellCatalog();
    if (!registry) return null;
    try {
      return registry.get?.("spell", id) || registry.get?.(`spell:${id}`) || null;
    } catch (_) {
      return null;
    }
  }

  function normalizeSpellDefinition(spellId, definition = {}) {
    const id = clean(spellId);
    const spell = clone(definition || {}) || {};
    const levelRaw = spell.level ?? spell.spellLevel ?? spell.slotLevel ?? 0;
    const level = Number.isFinite(Number(levelRaw)) ? Math.max(0, Math.trunc(Number(levelRaw))) : 0;
    return {
      ...spell,
      id,
      spellId: id,
      name: clean(spell.name || spell.nombre) || id,
      level,
      spellLevel: level,
      cantrip: spell.cantrip === true || level === 0,
      canonicalContentId: `spell:${id}`,
    };
  }

  function resolveSpellDefinition(spellId) {
    const id = clean(spellId);
    if (!id) return { ok: false, reason: "SPELL_ID_REQUIRED", spellId: id, spell: null, entry: null };
    const registry = registerAvailableSpellCatalog();
    if (!registry) return { ok: false, reason: "CONTENT_REGISTRY_REQUIRED", spellId: id, spell: null, entry: null };
    const entry = spellEntry(id);
    if (!entry?.definition) return { ok: false, reason: "SPELL_DEFINITION_NOT_FOUND", spellId: id, spell: null, entry: null };
    return { ok: true, reason: null, spellId: id, spell: normalizeSpellDefinition(id, entry.definition), entry };
  }

  function classIdsFor(source = {}) {
    const classes = Array.isArray(source.characterBuild?.classes) ? source.characterBuild.classes : Array.isArray(source.classes) ? source.classes : [];
    return [...new Set(classes.map((entry) => normalizeId(entry?.classId || entry?.id || entry)).filter(Boolean))];
  }

  function spellAllowedClassIds(spell = {}) {
    const values = [];
    const add = (value) => { const id = normalizeId(value); if (id && !values.includes(id)) values.push(id); };
    add(spell.sourceClassId || spell.classId || spell.class_id);
    const lists = [spell.classIds, spell.classes, spell.allowedClasses, spell.allowedClassIds];
    lists.forEach((list) => (Array.isArray(list) ? list : []).forEach((entry) => add(entry?.classId || entry?.id || entry)));
    return values;
  }

  function isCastingClass(classId) {
    const id = normalizeId(classId);
    if (!id) return false;
    const runtime = spellcastingRuntime();
    if (typeof runtime?.getClassSpellcastingAbility === "function") {
      try { return Boolean(runtime.getClassSpellcastingAbility(id)); } catch (_) {}
    }
    if (typeof runtime?.classSpellcastingAbility === "function") {
      try { return Boolean(runtime.classSpellcastingAbility({}, id)); } catch (_) {}
    }
    return true;
  }

  function resolveCastClass(source = {}, spell = {}, requestedClassId = null) {
    const owned = classIdsFor(source);
    const allowed = spellAllowedClassIds(spell);
    const requested = normalizeId(requestedClassId);
    const legal = (id) => Boolean(id && owned.includes(id) && isCastingClass(id) && (!allowed.length || allowed.includes(id)));

    if (requested) return legal(requested)
      ? { ok: true, reason: null, classId: requested }
      : { ok: false, reason: "SPELL_CLASS_NOT_AVAILABLE", classId: null };

    const sourceClass = normalizeId(spell.sourceClassId || spell.classId || spell.class_id);
    if (legal(sourceClass)) return { ok: true, reason: null, classId: sourceClass };

    const candidates = owned.filter(legal);
    if (candidates.length === 1) return { ok: true, reason: null, classId: candidates[0] };
    if (!candidates.length) return { ok: false, reason: "SPELL_CASTING_CLASS_NOT_FOUND", classId: null };
    return { ok: false, reason: "SPELL_CLASS_AMBIGUOUS", classId: null, candidates };
  }

  function resolveSpellForCombatant(combatant = {}, spellId, options = {}) {
    const id = clean(spellId);
    if (!id) return { ok: false, reason: "SPELL_ID_REQUIRED", spellId: id, spell: null };
    if (!ownsSpell(combatant, id)) return { ok: false, reason: "SPELL_NOT_SELECTED", spellId: id, spell: null };
    const definition = resolveSpellDefinition(id);
    if (!definition.ok) return definition;
    const castClass = resolveCastClass(combatant, definition.spell, options.classId);
    if (!castClass.ok) return { ...definition, ok: false, reason: castClass.reason, classId: null, candidates: castClass.candidates || [] };
    return { ...definition, ok: true, reason: null, classId: castClass.classId };
  }

  function hydrateSpellSelections(source = {}) {
    const ids = spellIdsFor(source);
    const spellsById = {};
    const missingIds = [];
    const invalidIds = [];
    const entries = ids.map((id) => {
      const definition = resolveSpellDefinition(id);
      if (!definition.ok) {
        if (definition.reason === "SPELL_DEFINITION_NOT_FOUND") missingIds.push(id);
        else invalidIds.push(id);
        return { spellId: id, status: "invalid", reason: definition.reason, spell: null };
      }
      spellsById[id] = definition.spell;
      return { spellId: id, status: "ready", reason: null, spell: definition.spell };
    });
    return {
      spellIds: ids,
      spellSelectionIndex: buildSpellSelectionIndex(ids),
      spellsById,
      spells: ids.map((id) => spellsById[id]).filter(Boolean),
      entries,
      missingIds,
      invalidIds,
      ready: missingIds.length === 0 && invalidIds.length === 0,
      hasErrors: missingIds.length > 0 || invalidIds.length > 0,
    };
  }

  return Object.freeze({
    version: VERSION,
    spellIdsFor,
    buildSpellSelectionIndex,
    ownsSpell,
    spellEntry,
    normalizeSpellDefinition,
    resolveSpellDefinition,
    classIdsFor,
    spellAllowedClassIds,
    isCastingClass,
    resolveCastClass,
    resolveSpellForCombatant,
    hydrateSpellSelections,
  });
});