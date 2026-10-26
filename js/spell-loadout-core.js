/* One character spell assignment; context-specific definitions remain catalog data. */
(function (global) {
  'use strict';
  const clean = value => String(value ?? '').trim();
  const idOf = value => clean(value?.spellId || value?.id || value).replace(/^(?:role_)?spell:/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const ids = values => [...new Set((Array.isArray(values) ? values : []).map(idOf).filter(Boolean))];
  const copy = value => JSON.parse(JSON.stringify(value));
  const contextOf = value => ['role', 'theatre', 'theater'].includes(value) ? 'theater' : value;
  let cache = null;
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };

  function catalog() {
    const core = global.LuminousSpellCatalog, role = global.LuminousRoleSpellCatalog, registry = global.LuminousContentRegistry;
    const revision = registry?.revision;
    const cacheable = !registry || Number.isInteger(revision);
    if (cacheable && cache?.core === core && cache?.role === role && cache?.registry === registry && cache?.revision === revision) return cache.rows;
    const rows = new Map();
    function add(raw, key, fallback) {
      const id = idOf(raw?.id || key);
      if (!id || !raw) return;
      const contexts = (Array.isArray(raw.contexts) && raw.contexts.length ? raw.contexts : [fallback]).map(contextOf);
      const previous = rows.get(id);
      const merged = previous && fallback === 'theater' ? { ...copy(raw), ...previous } : { ...(previous || {}), ...copy(raw) };
      rows.set(id, { ...merged, id,
        classIds: [...new Set([...(previous?.classIds || []), ...(raw.classIds || [])])],
        contexts: [...new Set([...(previous?.contexts || []), ...contexts])],
        ...(raw.theater ? { theater: copy(raw.theater) } : {}) });
    }
    Object.entries(global.LuminousSpellCatalog || {}).forEach(([id, spell]) => add(spell, id, 'combat'));
    Object.entries(global.LuminousRoleSpellCatalog || {}).forEach(([id, spell]) => add(spell, id, 'theater'));
    for (const [type, fallback] of [['spell', 'combat'], ['role_spell', 'theater']]) {
      try {
        for (const entry of global.LuminousContentRegistry?.list?.({ type }) || []) {
          // Registered campaign content overrides the corresponding core definition.
          add(entry.definition, entry.id, fallback);
        }
      } catch (_) {}
    }
    const result = freeze([...rows.values()]);
    if (cacheable) cache = { core, role, registry, revision, rows: result };
    return result;
  }

  function supports(spell, context) {
    return !context || context === 'all' || spell?.contexts?.includes('any') || spell?.contexts?.includes(contextOf(context));
  }
  function definition(id, context = null) {
    const spell = catalog().find(row => row.id === idOf(id));
    return spell && supports(spell, context) ? spell : null;
  }
  function canonical(source = {}) {
    // A versioned empty assignment survives RTDB's removal of empty arrays.
    // V2 read compatibility does not itself authorize any DM exception.
    return [source.spellLoadout,source.characterBuild?.spellLoadout]
      .find(row=>[1,2].includes(Number(row?.schemaVersion)))||null;
  }
  function hasSelection(source = {}) {
    return Boolean(canonical(source)) || [source, source.characterBuild || {}].some(record =>
      ['spellIds', 'spellSelections', 'spellSelectionIndex', 'spells', 'spell_ids', 'roleSpellSelections'].some(key => record[key] != null));
  }
  function legacySelection(source, keys) {
    for (const record of [source, source.characterBuild || {}]) {
      for (const key of keys) {
        if (record[key] == null) continue;
        if (key === 'spellSelectionIndex') return Object.entries(record[key]).filter(([, enabled]) => enabled === true).map(([id]) => id);
        return ids(record[key]);
      }
    }
    return [];
  }
  function selectedIds(source = {}, context = null) {
    const saved = canonical(source);
    const selected = saved ? ids(saved.spellIds) : ids([
      ...legacySelection(source, ['spellIds', 'spells', 'spell_ids', 'spellSelections', 'spellSelectionIndex']),
      ...legacySelection(source, ['roleSpellSelections'])
    ]);
    // Unknown old IDs stay visible to migration/save; no fabricated definition.
    if (!context || context === 'all') return selected;
    const available = new Set(catalog().filter(spell => supports(spell, context)).map(spell => spell.id));
    return selected.filter(id => available.has(id));
  }
  function buildUpdates(selected = [], source = 'dm_loadout_manager') {
    const all = ids(selected).sort();
    const definitions = new Map(catalog().map(spell => [spell.id, spell]));
    const combat = all.filter(id => supports(definitions.get(id), 'combat'));
    const theater = all.filter(id => supports(definitions.get(id), 'theater'));
    const loadout = { schemaVersion: 1, spellIds: all, source };
    const mirrors = { spellLoadout: loadout, spellIds: combat, spellSelections: combat,
      spellSelectionIndex: Object.fromEntries(combat.map(id => [id, true])), roleSpellSelections: theater };
    return { ...mirrors, ...Object.fromEntries(Object.entries(mirrors).map(([key, value]) => [`characterBuild/${key}`, value])),
      'characterBuild/spellLoadoutSource': source };
  }

  global.LuminousSpellLoadout = Object.freeze({ version: '1.0.0', idOf, ids, catalog, definition, supports, canonical, hasSelection, selectedIds, buildUpdates });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LuminousSpellLoadout;
})(typeof window === 'undefined' ? globalThis : window);
