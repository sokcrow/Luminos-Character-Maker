(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMapAuthoring = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const DEFAULT_GRID = Object.freeze({ cols: 30, rows: 30, size: 70, distancePerCell: 5, distanceUnit: 'ft' });
  const DEFAULT_Z_STEP_FT = 15;
  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const firebaseKey = (value, fallback = 'map') => clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;

  function levelEntries(zLevels = {}) {
    const rows = Array.isArray(zLevels)
      ? zLevels
      : Object.entries(zLevels || {}).map(([key, value]) => ({ ...(value || {}), zLayer: finite(value?.zLayer, finite(key, 0)) }));
    return rows
      .filter(Boolean)
      .map((entry) => ({
        zLayer: finite(entry.zLayer ?? entry.z, 0),
        elevationFt: finite(entry.elevationFt, finite(entry.zLayer ?? entry.z, 0) * DEFAULT_Z_STEP_FT),
        label: clean(entry.label) || `Z${finite(entry.zLayer ?? entry.z, 0)}`,
        background: normalizeBackground(entry.background || entry.image || null),
      }))
      .sort((a, b) => a.zLayer - b.zLayer);
  }

  function levelsRecord(levels) {
    const record = {};
    levelEntries(levels).forEach((level) => { record[String(level.zLayer)] = level; });
    return record;
  }

  function normalizeBackground(value) {
    if (!value) return { url: '', storagePath: '', fit: 'stretch', opacity: 1 };
    if (typeof value === 'string') return { url: clean(value), storagePath: '', fit: 'stretch', opacity: 1 };
    return {
      url: clean(value.url),
      storagePath: clean(value.storagePath),
      fit: ['stretch', 'contain', 'cover'].includes(value.fit) ? value.fit : 'stretch',
      opacity: Math.max(0, Math.min(1, finite(value.opacity, 1))),
    };
  }

  function normalizeDefinition(raw = {}, fallback = {}) {
    const fallbackGrid = fallback.grid || DEFAULT_GRID;
    const grid = raw.grid || fallbackGrid;
    let levels = levelEntries(raw.zLevels || raw.floors || fallback.zLevels || { 0: { zLayer: 0, elevationFt: 0, label: 'Ground Floor' } });
    if (!levels.length) levels = [{ zLayer: 0, elevationFt: 0, label: 'Ground Floor', background: normalizeBackground(null) }];
    const floorBackgrounds = raw.floorBackgrounds || {};
    levels = levels.map((level) => ({
      ...level,
      background: normalizeBackground(floorBackgrounds[level.zLayer] || floorBackgrounds[String(level.zLayer)] || level.background),
    }));
    return {
      schemaVersion: SCHEMA_VERSION,
      id: firebaseKey(raw.id || raw.mapId || fallback.id || 'default', 'default'),
      name: clean(raw.name || raw.label || fallback.name || raw.id || fallback.id || 'Map') || 'Map',
      environmentTags: [...new Set((Array.isArray(raw.environmentTags) ? raw.environmentTags : Array.isArray(fallback.environmentTags) ? fallback.environmentTags : ['dungeon'])
        .map((tag) => clean(tag).toLowerCase()).filter(Boolean))],
      grid: {
        cols: Math.max(1, Math.trunc(finite(grid.cols, DEFAULT_GRID.cols))),
        rows: Math.max(1, Math.trunc(finite(grid.rows, DEFAULT_GRID.rows))),
        size: Math.max(8, finite(grid.size, DEFAULT_GRID.size)),
        distancePerCell: Math.max(0.1, finite(grid.distancePerCell, DEFAULT_GRID.distancePerCell)),
        distanceUnit: clean(grid.distanceUnit || DEFAULT_GRID.distanceUnit) || 'ft',
      },
      defaultZStepFt: Math.max(1, finite(raw.defaultZStepFt, finite(fallback.defaultZStepFt, DEFAULT_Z_STEP_FT))),
      zLevels: levelsRecord(levels),
      memoryRules: clone(raw.memoryRules || fallback.memoryRules || null),
      createdAt: raw.createdAt || null,
      updatedAt: raw.updatedAt || null,
    };
  }

  function definitionFromMapData(mapData = {}) {
    return normalizeDefinition({
      id: mapData.id || mapData.mapId,
      name: mapData.name || mapData.label,
      environmentTags: mapData.environmentTags,
      grid: mapData.grid,
      defaultZStepFt: mapData.defaultZStepFt,
      zLevels: mapData.zLevels,
      memoryRules: mapData.memoryRules,
    }, mapData);
  }

  function currentPlayerTemplates(tokens = []) {
    return (Array.isArray(tokens) ? tokens : []).filter((token) => token?.characterLink?.mode === 'current_player').map(clone);
  }

  function applyDefinition(mapData, rawDefinition, options = {}) {
    if (!mapData || !rawDefinition) return mapData;
    const previousId = clean(mapData.id || mapData.mapId || 'default');
    const definition = normalizeDefinition(rawDefinition, mapData);
    const switchingMap = previousId && previousId !== definition.id;
    const playerTemplates = currentPlayerTemplates(mapData.tokens);

    mapData.id = definition.id;
    mapData.mapId = definition.id;
    mapData.name = definition.name;
    mapData.grid = clone(definition.grid);
    mapData.environmentTags = [...definition.environmentTags];
    mapData.defaultZStepFt = definition.defaultZStepFt;
    mapData.zLevels = clone(definition.zLevels);
    mapData.memoryRules = clone(definition.memoryRules);
    mapData.floorBackgrounds = {};
    levelEntries(definition.zLevels).forEach((level) => { mapData.floorBackgrounds[String(level.zLayer)] = clone(level.background); });

    if (switchingMap && options.keepSceneState !== true) {
      mapData.walls = [];
      mapData.topology = [];
      mapData.verticalPortals = [];
      mapData.tokens = playerTemplates;
      mapData.lighting ||= {};
      mapData.lighting.scene = { sources: [], interiors: [], transformers: [], switches: [], roofs: [] };
    }
    return mapData;
  }

  function nextLayer(levels, activeZ, direction) {
    const entries = levelEntries(levels);
    const active = finite(activeZ, 0);
    if (direction > 0) {
      const higher = entries.filter((entry) => entry.zLayer > active).map((entry) => entry.zLayer);
      if (higher.length) return Math.min(...higher);
      return active + 1;
    }
    const lower = entries.filter((entry) => entry.zLayer < active).map((entry) => entry.zLayer);
    if (lower.length) return Math.max(...lower);
    return active - 1;
  }

  function addLevel(rawDefinition, activeZ = 0, direction = 1, patch = {}) {
    const definition = normalizeDefinition(rawDefinition);
    const zLayer = nextLayer(definition.zLevels, activeZ, direction);
    if (definition.zLevels[String(zLayer)]) return definition;
    const active = definition.zLevels[String(finite(activeZ, 0))];
    const elevationFt = Number.isFinite(Number(patch.elevationFt))
      ? Number(patch.elevationFt)
      : finite(active?.elevationFt, finite(activeZ, 0) * definition.defaultZStepFt) + (direction > 0 ? definition.defaultZStepFt : -definition.defaultZStepFt);
    definition.zLevels[String(zLayer)] = {
      zLayer,
      elevationFt,
      label: clean(patch.label) || (zLayer < 0 ? `Basement ${Math.abs(zLayer)}` : `Floor ${zLayer}`),
      background: normalizeBackground(patch.background),
    };
    return normalizeDefinition(definition);
  }

  function updateLevel(rawDefinition, zLayer, patch = {}) {
    const definition = normalizeDefinition(rawDefinition);
    const key = String(finite(zLayer, 0));
    if (!definition.zLevels[key]) throw new Error('FLOOR_NOT_FOUND');
    const current = definition.zLevels[key];
    definition.zLevels[key] = {
      ...current,
      label: patch.label === undefined ? current.label : (clean(patch.label) || current.label),
      elevationFt: patch.elevationFt === undefined ? current.elevationFt : finite(patch.elevationFt, current.elevationFt),
      background: patch.background === undefined ? current.background : normalizeBackground({ ...current.background, ...patch.background }),
    };
    return normalizeDefinition(definition);
  }

  function dependenciesForLayer(mapData = {}, zLayer = 0) {
    const z = finite(zLayer, 0);
    const topologyRuntime = typeof globalThis !== 'undefined' ? globalThis.LuminousVttTopology : null;
    const topology = (mapData.topology || []).filter((element) => topologyRuntime?.elementOnLayer ? topologyRuntime.elementOnLayer(element, z) : (element.z || []).map(Number).includes(z));
    const walls = (mapData.walls || []).filter((wall) => (Array.isArray(wall.z) ? wall.z : [wall.z]).map(Number).includes(z));
    const portals = (mapData.verticalPortals || []).filter((portal) => (portal.between || []).map(Number).includes(z));
    const tokens = (mapData.tokens || []).filter((token) => finite(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0], 0) === z && token.characterLink?.mode !== 'current_player');
    const scene = mapData.lighting?.scene || {};
    const roofs = (scene.roofs || []).filter((roof) => finite(roof.zLayer, 0) === z);
    const sources = (scene.sources || []).filter((source) => finite(source.zLayer, 0) === z);
    return { topology, walls, portals, tokens, roofs, sources };
  }

  function canDeleteLevel(mapData = {}, zLayer = 0) {
    const levels = levelEntries(mapData.zLevels);
    if (levels.length <= 1) return { valid: false, reason: 'LAST_FLOOR' };
    const dependencies = dependenciesForLayer(mapData, zLayer);
    const count = Object.values(dependencies).reduce((total, entries) => total + entries.length, 0);
    return count ? { valid: false, reason: 'FLOOR_IN_USE', dependencies } : { valid: true, dependencies };
  }

  function removeLevel(rawDefinition, zLayer) {
    const definition = normalizeDefinition(rawDefinition);
    const entries = levelEntries(definition.zLevels);
    if (entries.length <= 1) throw new Error('LAST_FLOOR');
    delete definition.zLevels[String(finite(zLayer, 0))];
    return normalizeDefinition(definition);
  }

  function floor(rawDefinition, zLayer) {
    const definition = normalizeDefinition(rawDefinition);
    return definition.zLevels[String(finite(zLayer, 0))] || null;
  }

  function createDefinition({ id, name, grid, environmentTags, defaultZStepFt, background } = {}) {
    const safeId = firebaseKey(id || `map_${Date.now().toString(36)}`, 'map');
    return normalizeDefinition({
      id: safeId,
      name: name || safeId,
      grid: grid || DEFAULT_GRID,
      environmentTags: environmentTags || ['dungeon'],
      defaultZStepFt: defaultZStepFt || DEFAULT_Z_STEP_FT,
      zLevels: { 0: { zLayer: 0, elevationFt: 0, label: 'Ground Floor', background: normalizeBackground(background) } },
    });
  }

  return Object.freeze({
    SCHEMA_VERSION, DEFAULT_GRID, DEFAULT_Z_STEP_FT, firebaseKey, normalizeBackground, levelEntries, levelsRecord,
    normalizeDefinition, definitionFromMapData, applyDefinition, nextLayer, addLevel, updateLevel, dependenciesForLayer,
    canDeleteLevel, removeLevel, floor, createDefinition,
  });
});