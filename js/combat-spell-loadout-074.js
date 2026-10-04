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
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function contentRegistry() {
    if (global?.LuminousContentRegistry) return global.LuminousContentRegistry;
    if (typeof require === "function") { try { return require("./content-registry.js"); } catch (_) {} }
    return null;
  }
  function contentBootstrap() {
    if (global?.LuminousContentRegistryBootstrap) return global.LuminousContentRegistryBootstrap;
    if (typeof require === "function") { try { return require("./content-registry-bootstrap.js"); } catch (_) {} }
    return null;
  }
  function ensureSpellCatalog() {
    if (global?.LuminousSpellCatalog) return global.LuminousSpellCatalog;
    if (typeof require === "function") {
      try {
        const catalog = require("./spell-catalog-core.js");
        if (global && catalog) global.LuminousSpellCatalog = catalog;
        return catalog;
      } catch (_) {}
    }
    return null;
  }
  function spellcastingRuntime() {
    if (global?.LuminousSpellcastingRuntime) return global.LuminousSpellcastingRuntime;
    if (typeof require === "function") {
      try { return require("./spellcasting-runtime.js"); } catch (_) {}
      try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
    }
    return null;
  }
  function wizardRuntime() {
    if (global?.LuminousWizardClassRuntime) return global.LuminousWizardClassRuntime;
    if (typeof require === "function") { try { return require("./wizard-class-runtime.js"); } catch (_) {} }
    return null;
  }

  function selectionSource(source = {}) {
    const directLists = [
      source.spellIds,
      source.spells,
      source.spell_ids,
      source.spellSelections,
      source.knownSpellIds,
      source.preparedSpellIds,
      source.characterBuild?.spellIds,
      source.characterBuild?.spells,
      source.characterBuild?.spellSelections,
      source.characterBuild?.knownSpellIds,
      source.characterBuild?.preparedSpellIds,
    ];
    for (const list of directLists) if (Array.isArray(list) && list.length) return list;

    const indexes = [
      source.spellSelectionIndex,
      source.knownSpellIndex,
      source.preparedSpellIndex,
      source.characterBuild?.spellSelectionIndex,
      source.characterBuild?.knownSpellIndex,
      source.characterBuild?.preparedSpellIndex,
    ];
    for (const index of indexes) {
      if (index && typeof index === "object" && !Array.isArray(index)) {
        const ids = Object.entries(index).filter(([, enabled]) => enabled === true).map(([id]) => id);
        if (ids.length) return ids;
      }
    }
    return [];
  }

  function rawSpellIdsFor(source = {}) {
    const selected = selectionSource(source).map((entry) => clean(entry?.spellId || entry?.id || entry)).filter(Boolean);
    const wizardIds = wizardRuntime()?.spellIdsForCombat?.(source) || [];
    return [...new Set([...selected, ...wizardIds].map(clean).filter(Boolean))];
  }

  function classIdsFor(source = {}) {
    const ids = [];
    const add = (value) => { const id = normalizeId(value); if (id && !ids.includes(id)) ids.push(id); };
    add(source.classId || source.class_id || source.class);
    add(source.characterBuild?.classId || source.characterBuild?.class_id);
    const lists = [source.classIds, source.classes, source.multiclass, source.characterBuild?.classIds, source.characterBuild?.classes];
    lists.forEach((list) => (Array.isArray(list) ? list : []).forEach((entry) => add(entry?.classId || entry?.class_id || entry?.id || entry)));
    if (source.classLevels && typeof source.classLevels === "object") Object.keys(source.classLevels).forEach(add);
    return ids;
  }

  function isCastingClass(classId) {
    const id = normalizeId(classId);
    if (!id) return false;
    const runtime = spellcastingRuntime();
    if (typeof runtime?.getClassSpellcastingAbility === "function") {
      try { return Boolean(runtime.getClassSpellcastingAbility(id)); } catch (_) { return false; }
    }
    if (typeof runtime?.classSpellcastingAbility === "function") {
      try { return Boolean(runtime.classSpellcastingAbility({}, id)); } catch (_) { return false; }
    }
    return false;
  }

  function castingClassIdsFor(source = {}) { return classIdsFor(source).filter(isCastingClass); }
  function canCastSpells(source = {}) { return castingClassIdsFor(source).length > 0; }

  function registerAvailableSpellCatalog() {
    ensureSpellCatalog();
    const bootstrap = contentBootstrap();
    try { bootstrap?.registerAvailableCore?.(); } catch (_) {}
    return contentRegistry();
  }

  function spellEntry(spellId) {
    const id = clean(spellId);
    if (!id) return null;
    const registry = registerAvailableSpellCatalog();
    if (!registry) return null;
    try { return registry.get?.("spell", id) || registry.get?.(`spell:${id}`) || null; } catch (_) { return null; }
  }

  function normalizeSpellDefinition(spellId, definition = {}) {
    const id = normalizeId(spellId);
    const spell = clone(definition || {}) || {};
    const levelRaw = spell.level ?? spell.spellLevel ?? spell.slotLevel ?? 0;
    const level = Number.isFinite(Number(levelRaw)) ? Math.max(0, Math.trunc(Number(levelRaw))) : 0;
    return { ...spell, id, spellId: id, name: clean(spell.name || spell.nombre) || id, level, spellLevel: level, cantrip: spell.cantrip === true || level === 0, canonicalContentId: `spell:${id}` };
  }

  function resolveSpellDefinition(spellId) {
    const id = normalizeId(spellId);
    if (!id) return { ok: false, reason: "SPELL_ID_REQUIRED", spellId: id, spell: null, entry: null };
    const registry = registerAvailableSpellCatalog();
    if (!registry) return { ok: false, reason: "CONTENT_REGISTRY_REQUIRED", spellId: id, spell: null, entry: null };
    const entry = spellEntry(id);
    if (!entry?.definition) return { ok: false, reason: "SPELL_DEFINITION_NOT_FOUND", spellId: id, spell: null, entry: null };
    return { ok: true, reason: null, spellId: id, spell: normalizeSpellDefinition(id, entry.definition), entry };
  }

  function spellAllowedClassIds(spell = {}) {
    const values = [];
    const add = (value) => { const id = normalizeId(value); if (id && !values.includes(id)) values.push(id); };
    add(spell.sourceClassId || spell.classId || spell.class_id);
    [spell.classIds, spell.classes, spell.allowedClasses, spell.allowedClassIds].forEach((list) => (Array.isArray(list) ? list : []).forEach((entry) => add(entry?.classId || entry?.id || entry)));
    return values;
  }

  function spellCastOverrideFor(source = {}, spellId = "") {
    const id = normalizeId(spellId);
    if (!id) return null;
    const maps = [source.spellCastOverrides, source.characterBuild?.spellCastOverrides];
    for (const map of maps) {
      if (!map || typeof map !== "object" || Array.isArray(map)) continue;
      const raw = map[id] ?? map[spellId];
      if (typeof raw === "string") {
        const classId = normalizeId(raw);
        if (classId) return { classId, abilityId: null, source: null };
      }
      if (raw && typeof raw === "object") {
        const classId = normalizeId(raw.classId || raw.class_id || raw.sourceClassId);
        const abilityId = normalizeId(raw.abilityId || raw.ability || raw.stat);
        if (classId || abilityId) return { ...clone(raw), classId: classId || null, abilityId: abilityId || null };
      }
    }
    return null;
  }

  function resolveCastClass(source = {}, spell = {}, requestedClassId = null) {
    const owned = castingClassIdsFor(source);
    const allowed = spellAllowedClassIds(spell);
    const requested = normalizeId(requestedClassId);
    const override = spellCastOverrideFor(source, spell.id || spell.spellId || spell.name);
    if (override?.classId) {
      const forced = normalizeId(override.classId);
      if (requested && requested !== forced) return { ok: false, reason: "SPELL_CLASS_NOT_AVAILABLE", classId: null };
      if (!owned.includes(forced)) return { ok: false, reason: "SPELL_CASTING_CLASS_NOT_FOUND", classId: null };
      return { ok: true, reason: null, classId: forced, override: true, abilityId: override.abilityId || null };
    }
    const legal = (id) => Boolean(id && owned.includes(id) && (!allowed.length || allowed.includes(id)));
    if (requested) return legal(requested) ? { ok: true, reason: null, classId: requested } : { ok: false, reason: "SPELL_CLASS_NOT_AVAILABLE", classId: null };
    const sourceClass = normalizeId(spell.sourceClassId || spell.classId || spell.class_id);
    if (legal(sourceClass)) return { ok: true, reason: null, classId: sourceClass };
    const candidates = owned.filter(legal);
    if (candidates.length === 1) return { ok: true, reason: null, classId: candidates[0] };
    if (!candidates.length) return { ok: false, reason: "SPELL_CASTING_CLASS_NOT_FOUND", classId: null };
    return { ok: false, reason: "SPELL_CLASS_AMBIGUOUS", classId: null, candidates };
  }

  function resolveSpellForCombatant(combatant = {}, spellId, options = {}) {
    const id = normalizeId(spellId);
    if (!id) return { ok: false, reason: "SPELL_ID_REQUIRED", spellId: id, spell: null };
    if (!canCastSpells(combatant)) return { ok: false, reason: "SPELLCASTING_ABILITY_REQUIRED", spellId: id, spell: null };
    if (!rawSpellIdsFor(combatant).map(normalizeId).includes(id)) return { ok: false, reason: "SPELL_NOT_SELECTED", spellId: id, spell: null };
    const definition = resolveSpellDefinition(id);
    if (!definition.ok) return definition;
    const castClass = resolveCastClass(combatant, definition.spell, options.classId);
    if (!castClass.ok) return { ...definition, ok: false, reason: castClass.reason, classId: null, candidates: castClass.candidates || [] };
    const castOverride = spellCastOverrideFor(combatant, id);
    const spell = castOverride?.abilityId
      ? { ...definition.spell, castAbilityId: castOverride.abilityId, castOverrideSource: castOverride.source || null }
      : definition.spell;
    return { ...definition, spell, ok: true, reason: null, classId: castClass.classId, castOverride };
  }

  function spellIdsFor(source = {}) {
    if (!canCastSpells(source)) return [];
    return rawSpellIdsFor(source)
      .map(normalizeId)
      .filter((id) => resolveSpellForCombatant(source, id).ok);
  }

  function buildSpellSelectionIndex(sourceOrIds = {}) {
    const ids = Array.isArray(sourceOrIds) ? sourceOrIds.map(normalizeId).filter(Boolean) : spellIdsFor(sourceOrIds);
    return Object.fromEntries([...new Set(ids)].map((id) => [id, true]));
  }

  function ownsSpell(source = {}, spellId) {
    const id = normalizeId(spellId);
    return Boolean(id && spellIdsFor(source).includes(id));
  }

  function hydrateSpellSelections(source = {}) {
    const ids = spellIdsFor(source);
    const spellsById = {};
    const entries = [];
    ids.forEach((id) => {
      const definition = resolveSpellDefinition(id);
      if (!definition.ok) return;
      spellsById[id] = definition.spell;
      entries.push({ spellId: id, status: "ready", reason: null, spell: definition.spell });
    });
    return {
      canCastSpells: canCastSpells(source),
      castingClassIds: castingClassIdsFor(source),
      spellIds: ids,
      spellSelectionIndex: buildSpellSelectionIndex(ids),
      spellsById,
      spells: ids.map((id) => spellsById[id]).filter(Boolean),
      entries,
      missingIds: [],
      invalidIds: [],
      ready: true,
      hasErrors: false
    };
  }

  return Object.freeze({
    version: VERSION,
    rawSpellIdsFor,
    spellIdsFor,
    buildSpellSelectionIndex,
    ownsSpell,
    spellEntry,
    normalizeSpellDefinition,
    resolveSpellDefinition,
    wizardRuntime,
    classIdsFor,
    spellAllowedClassIds,
    spellCastOverrideFor,
    isCastingClass,
    castingClassIdsFor,
    canCastSpells,
    resolveCastClass,
    resolveSpellForCombatant,
    hydrateSpellSelections
  });
});
