(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttSurfaceAuthoringPatch = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function install() {
    const base = root?.LuminousVttMapAuthoring;
    const core = root?.LuminousVttSurfaceCore;
    if (!base || !core) return null;
    if (base.__surfaceAware === true) return base;

    function surfacePayload(raw = {}, fallback = {}) {
      const materials = core.normalizeMaterialCatalog(raw.surfaceMaterials || fallback.surfaceMaterials || null);
      const grid = raw.grid || fallback.grid || base.DEFAULT_GRID || {};
      const layers = core.normalizeLayers(raw.surfaceLayers || fallback.surfaceLayers || {}, grid, materials);
      return { surfaceMaterials: materials, surfaceLayers: layers };
    }

    function attachSurfaces(definition, raw = {}, fallback = {}) {
      return { ...definition, ...surfacePayload(raw, fallback) };
    }

    function normalizeDefinition(raw = {}, fallback = {}) {
      return attachSurfaces(base.normalizeDefinition(raw, fallback), raw, fallback);
    }

    function definitionFromMapData(mapData = {}) {
      return attachSurfaces(base.definitionFromMapData(mapData), mapData, mapData);
    }

    function applyDefinition(mapData, rawDefinition, options = {}) {
      const normalized = normalizeDefinition(rawDefinition, mapData || {});
      base.applyDefinition(mapData, normalized, options);
      mapData.surfaceMaterials = clone(normalized.surfaceMaterials);
      mapData.surfaceLayers = clone(normalized.surfaceLayers);
      core.ensureMapState(mapData);
      return mapData;
    }

    function preserveSurfaces(fn) {
      return function wrapped(rawDefinition, ...args) {
        const result = fn(rawDefinition, ...args);
        return attachSurfaces(result, rawDefinition || {}, rawDefinition || {});
      };
    }

    function canDeleteLevel(mapData = {}, zLayer = 0) {
      const gate = base.canDeleteLevel(mapData, zLayer);
      if (!gate.valid) return gate;
      const surfaces = core.cellsOnLayer(mapData, zLayer);
      if (surfaces.length) return { valid:false, reason:'FLOOR_IN_USE', dependencies:{ ...(gate.dependencies || {}), surfaces } };
      return { ...gate, dependencies:{ ...(gate.dependencies || {}), surfaces:[] } };
    }

    function createDefinition(options = {}) {
      const definition = base.createDefinition(options);
      return attachSurfaces(definition, options, { grid: definition.grid });
    }

    const patched = Object.freeze({
      ...base,
      __surfaceAware: true,
      normalizeDefinition,
      definitionFromMapData,
      applyDefinition,
      addLevel: preserveSurfaces(base.addLevel),
      updateLevel: preserveSurfaces(base.updateLevel),
      removeLevel: preserveSurfaces(base.removeLevel),
      canDeleteLevel,
      createDefinition,
    });
    root.LuminousVttMapAuthoring = patched;
    return patched;
  }

  const installed = install();
  return Object.freeze({ install, installed });
});
