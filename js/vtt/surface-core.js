(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttSurfaceCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const DEFAULT_MATERIALS = Object.freeze([
    { id:'concrete', name:'Concrete', visual:{ color:'#5b5e61', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['urban','hard_surface','interior'] },
    { id:'asphalt', name:'Asphalt', visual:{ color:'#282b2f', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['urban','road','hard_surface'] },
    { id:'sidewalk', name:'Sidewalk', visual:{ color:'#7a7d80', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['urban','sidewalk','hard_surface'] },
    { id:'tile', name:'Tile', visual:{ color:'#6e665d', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['interior','hard_surface'] },
    { id:'metal', name:'Metal', visual:{ color:'#4e5960', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['industrial','hard_surface'] },
    { id:'wood', name:'Wood', visual:{ color:'#6a4c35', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['interior','wood'] },
    { id:'dirt', name:'Dirt', visual:{ color:'#58412f', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['outdoor','soil'] },
    { id:'mud', name:'Mud', visual:{ color:'#3d3328', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:2, difficultTerrain:true }, tags:['outdoor','soil','wet'] },
    { id:'grass', name:'Grass', visual:{ color:'#334b31', image:'', opacity:1, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false }, tags:['outdoor','vegetation'] },
    { id:'shallow_water', name:'Shallow Water', visual:{ color:'#315a6a', image:'', opacity:0.9, scale:1 }, movement:{ costMultiplier:2, difficultTerrain:true }, tags:['water','wet','shallow'] },
    { id:'deep_water', name:'Deep Water', visual:{ color:'#193c50', image:'', opacity:0.92, scale:1 }, movement:{ costMultiplier:1, difficultTerrain:false, requiredMode:'swim' }, tags:['water','wet','deep'] },
  ]);

  function safeId(value, fallback = 'surface') {
    return clean(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
  }

  function normalizeMaterial(raw = {}) {
    const id = safeId(raw.id || raw.materialId || raw.name);
    const visual = raw.visual || {};
    const movement = raw.movement || {};
    const requiredMode = clean(movement.requiredMode || raw.requiredMode).toLowerCase();
    const allowedModes = Array.isArray(movement.allowedModes || raw.allowedModes)
      ? [...new Set((movement.allowedModes || raw.allowedModes).map((mode) => clean(mode).toLowerCase()).filter(Boolean))]
      : [];
    const difficultTerrain = Boolean(movement.difficultTerrain ?? movement.difficult ?? raw.difficultTerrain ?? raw.difficult);
    return {
      schemaVersion: SCHEMA_VERSION,
      id,
      name: clean(raw.name || raw.label || id) || id,
      visual: {
        color: clean(visual.color || raw.color || '#444444') || '#444444',
        image: clean(visual.image || visual.url || raw.image || ''),
        opacity: Math.max(0, Math.min(1, finite(visual.opacity, 1))),
        scale: Math.max(0.05, finite(visual.scale, 1)),
      },
      movement: {
        costMultiplier: Math.max(0.05, finite(movement.costMultiplier ?? movement.multiplier ?? raw.costMultiplier, difficultTerrain ? 2 : 1)),
        difficultTerrain,
        blocked: Boolean(movement.blocked ?? raw.blocked),
        requiredMode: requiredMode || null,
        allowedModes,
      },
      tags: [...new Set((Array.isArray(raw.tags) ? raw.tags : []).map((tag) => clean(tag).toLowerCase()).filter(Boolean))],
    };
  }

  function defaultMaterialCatalog() {
    const record = {};
    DEFAULT_MATERIALS.forEach((entry) => { const material = normalizeMaterial(entry); record[material.id] = material; });
    return record;
  }

  function normalizeMaterialCatalog(raw = null) {
    const record = {};
    const rows = Array.isArray(raw) ? raw : Object.values(raw || {});
    rows.forEach((entry) => {
      if (!entry) return;
      const material = normalizeMaterial(entry);
      record[material.id] = material;
    });
    const defaults = defaultMaterialCatalog();
    Object.entries(defaults).forEach(([id, material]) => { if (!record[id]) record[id] = material; });
    return record;
  }

  function cellKey(col, row) {
    return `${Math.trunc(finite(col, 0))}_${Math.trunc(finite(row, 0))}`;
  }

  function parseCellKey(key) {
    const [col, row] = String(key || '').split('_').map(Number);
    return Number.isFinite(col) && Number.isFinite(row) ? { col, row } : null;
  }

  function normalizeCell(raw = {}, fallbackMaterialId = 'concrete') {
    if (typeof raw === 'string') raw = { materialId: raw };
    return {
      materialId: safeId(raw.materialId || raw.material || fallbackMaterialId, fallbackMaterialId),
      elevationOffsetFt: finite(raw.elevationOffsetFt ?? raw.elevationFt, 0),
    };
  }

  function normalizeLayers(raw = {}, grid = {}, catalog = {}) {
    const result = {};
    const cols = Math.max(1, Math.trunc(finite(grid.cols, 1)));
    const rows = Math.max(1, Math.trunc(finite(grid.rows, 1)));
    Object.entries(raw || {}).forEach(([zKey, layer]) => {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return;
      const target = {};
      Object.entries(layer).forEach(([key, value]) => {
        const cell = parseCellKey(key);
        if (!cell || cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) return;
        const normalized = normalizeCell(value);
        if (!catalog[normalized.materialId]) return;
        target[cellKey(cell.col, cell.row)] = normalized;
      });
      if (Object.keys(target).length) result[String(Number(zKey) || 0)] = target;
    });
    return result;
  }

  function ensureMapState(mapData = {}) {
    mapData.surfaceMaterials = normalizeMaterialCatalog(mapData.surfaceMaterials);
    mapData.surfaceLayers = normalizeLayers(mapData.surfaceLayers || {}, mapData.grid || {}, mapData.surfaceMaterials);
    mapData.movement ||= {};
    mapData.movement.terrain ||= {};
    syncMovementTerrain(mapData);
    return mapData;
  }

  function materialFor(mapData = {}, materialId) {
    const catalog = mapData.surfaceMaterials || defaultMaterialCatalog();
    return catalog[safeId(materialId)] || null;
  }

  function layerRecord(mapData = {}, zLayer = 0, create = false) {
    mapData.surfaceLayers ||= {};
    const key = String(Number(zLayer) || 0);
    if (!mapData.surfaceLayers[key] && create) mapData.surfaceLayers[key] = {};
    return mapData.surfaceLayers[key] || null;
  }

  function getCell(mapData = {}, zLayer = 0, col = 0, row = 0) {
    const layer = layerRecord(mapData, zLayer, false);
    return layer?.[cellKey(col, row)] || null;
  }

  function terrainRecordForCell(mapData = {}, cell = null) {
    if (!cell) return null;
    const material = materialFor(mapData, cell.materialId);
    if (!material) return null;
    const movement = material.movement || {};
    return {
      multiplier: Math.max(0.05, finite(movement.costMultiplier, movement.difficultTerrain ? 2 : 1)),
      costMultiplier: Math.max(0.05, finite(movement.costMultiplier, movement.difficultTerrain ? 2 : 1)),
      difficult: Boolean(movement.difficultTerrain),
      blocked: Boolean(movement.blocked),
      requiredMode: movement.requiredMode || null,
      allowedModes: Array.isArray(movement.allowedModes) ? [...movement.allowedModes] : [],
      surfaceMaterialId: material.id,
      surfaceTags: [...(material.tags || [])],
      elevationOffsetFt: finite(cell.elevationOffsetFt, 0),
      _surface: true,
    };
  }

  function terrainLayer(mapData = {}, zLayer = 0, create = false) {
    mapData.movement ||= {};
    mapData.movement.terrain ||= {};
    const key = String(Number(zLayer) || 0);
    if (!mapData.movement.terrain[key] && create) mapData.movement.terrain[key] = {};
    return mapData.movement.terrain[key] || null;
  }

  function projectCell(mapData, zLayer, col, row) {
    const key = cellKey(col, row);
    const terrain = terrainLayer(mapData, zLayer, true);
    const cell = getCell(mapData, zLayer, col, row);
    if (!cell) {
      if (terrain[key]?._surface) delete terrain[key];
      return null;
    }
    const record = terrainRecordForCell(mapData, cell);
    terrain[key] = record;
    return record;
  }

  function syncMovementTerrain(mapData = {}) {
    mapData.movement ||= {};
    mapData.movement.terrain ||= {};
    Object.values(mapData.movement.terrain).forEach((layer) => {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return;
      Object.keys(layer).forEach((key) => { if (layer[key]?._surface) delete layer[key]; });
    });
    Object.entries(mapData.surfaceLayers || {}).forEach(([zKey, layer]) => {
      Object.keys(layer || {}).forEach((key) => {
        const cell = parseCellKey(key);
        if (cell) projectCell(mapData, Number(zKey) || 0, cell.col, cell.row);
      });
    });
    return mapData.movement.terrain;
  }

  function setCell(mapData = {}, zLayer = 0, col = 0, row = 0, materialId = 'concrete', patch = {}) {
    ensureMapState(mapData);
    const cols = Math.max(1, Math.trunc(finite(mapData.grid?.cols, 1)));
    const rows = Math.max(1, Math.trunc(finite(mapData.grid?.rows, 1)));
    const c = Math.trunc(finite(col, -1)), r = Math.trunc(finite(row, -1));
    if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
    const material = materialFor(mapData, materialId);
    if (!material) throw new Error('SURFACE_MATERIAL_NOT_FOUND');
    const layer = layerRecord(mapData, zLayer, true);
    const key = cellKey(c, r);
    layer[key] = normalizeCell({ ...(layer[key] || {}), ...patch, materialId: material.id }, material.id);
    projectCell(mapData, zLayer, c, r);
    return clone(layer[key]);
  }

  function eraseCell(mapData = {}, zLayer = 0, col = 0, row = 0) {
    ensureMapState(mapData);
    const layer = layerRecord(mapData, zLayer, false);
    const key = cellKey(col, row);
    if (!layer?.[key]) return false;
    delete layer[key];
    if (!Object.keys(layer).length) delete mapData.surfaceLayers[String(Number(zLayer) || 0)];
    projectCell(mapData, zLayer, col, row);
    return true;
  }

  function paintRect(mapData = {}, zLayer = 0, from = {}, to = {}, materialId = 'concrete') {
    const minCol = Math.min(Math.trunc(finite(from.col)), Math.trunc(finite(to.col)));
    const maxCol = Math.max(Math.trunc(finite(from.col)), Math.trunc(finite(to.col)));
    const minRow = Math.min(Math.trunc(finite(from.row)), Math.trunc(finite(to.row)));
    const maxRow = Math.max(Math.trunc(finite(from.row)), Math.trunc(finite(to.row)));
    let changed = 0;
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        if (setCell(mapData, zLayer, col, row, materialId)) changed += 1;
      }
    }
    return changed;
  }

  function eraseRect(mapData = {}, zLayer = 0, from = {}, to = {}) {
    const minCol = Math.min(Math.trunc(finite(from.col)), Math.trunc(finite(to.col)));
    const maxCol = Math.max(Math.trunc(finite(from.col)), Math.trunc(finite(to.col)));
    const minRow = Math.min(Math.trunc(finite(from.row)), Math.trunc(finite(to.row)));
    const maxRow = Math.max(Math.trunc(finite(from.row)), Math.trunc(finite(to.row)));
    let changed = 0;
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) if (eraseCell(mapData, zLayer, col, row)) changed += 1;
    }
    return changed;
  }

  function cellsOnLayer(mapData = {}, zLayer = 0) {
    const layer = layerRecord(mapData, zLayer, false) || {};
    return Object.entries(layer).map(([key, value]) => ({ ...parseCellKey(key), ...clone(value) })).filter((entry) => Number.isFinite(entry.col) && Number.isFinite(entry.row));
  }

  return Object.freeze({
    SCHEMA_VERSION, DEFAULT_MATERIALS, safeId, normalizeMaterial, defaultMaterialCatalog, normalizeMaterialCatalog,
    cellKey, parseCellKey, normalizeCell, normalizeLayers, ensureMapState, materialFor, layerRecord, getCell,
    terrainRecordForCell, projectCell, syncMovementTerrain, setCell, eraseCell, paintRect, eraseRect, cellsOnLayer,
  });
});
