import './wall-auto-tile.js';
import './wall-auto-tile-renderer.js';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine?.renderer || !runtime?.controller || !mapData) return null;
  if (window.LuminousVttWallAutoTileRuntime?.api) return window.LuminousVttWallAutoTileRuntime.api;

  const autoTile = window.LuminousVttWallAutoTile;
  const tileRenderer = window.LuminousVttWallAutoTileRenderer;
  const topology = window.LuminousVttTopology;
  if (!autoTile || !tileRenderer || !topology) throw new Error('WALL_AUTO_TILE_DEPENDENCY_REQUIRED');

  const renderer = runtime.engine.renderer;
  const controller = runtime.controller;
  const originalDrawTopologyElement = renderer.drawTopologyElement.bind(renderer);
  const originalHandleTopologyChanged = controller.handleTopologyChanged.bind(controller);
  const cache = new Map();
  let topologySnapshot = clone(mapData.topology || []);
  let stopped = false;

  const cacheKey = (element, zLayer) => `${Number(zLayer) || 0}:${String(element?.id || '')}`;

  function layersOf(element = {}) {
    return (topology.elementLayers?.(element) || [0]).map(Number);
  }

  function descriptorFor(rawElement, zLayer = null) {
    if (!rawElement || String(rawElement.type) !== 'wall') return null;
    const layer = zLayer == null ? Number(layersOf(rawElement)[0] || 0) : Number(zLayer) || 0;
    const key = cacheKey(rawElement, layer);
    if (!cache.has(key)) cache.set(key, autoTile.tileForEdge(rawElement, mapData, layer));
    return cache.get(key) || null;
  }

  function invalidateAll() {
    cache.clear();
  }

  function invalidateChanges(previous = [], next = []) {
    const changed = autoTile.changedElements(previous, next);
    if (!changed.length) return [];
    const layers = new Set();
    changed.forEach((element) => layersOf(element).forEach((z) => layers.add(Number(z) || 0)));
    const affected = new Set();

    for (const layer of layers) {
      for (const id of autoTile.affectedWallIds(mapData, layer, changed)) {
        affected.add(`${layer}:${id}`);
        cache.delete(`${layer}:${id}`);
      }
    }

    for (const raw of changed) {
      if (!raw?.id) continue;
      layersOf(raw).forEach((layer) => {
        affected.add(`${layer}:${String(raw.id)}`);
        cache.delete(`${layer}:${String(raw.id)}`);
      });
    }
    return [...affected].sort();
  }

  renderer.drawTopologyElement = function wallAutoTileDrawTopologyElement(element, isOnionSkin = false, preview = false) {
    if (preview || String(element?.type) !== 'wall') return originalDrawTopologyElement(element, isOnionSkin, preview);
    const normalized = topology.normalizeElement(element);
    const builder = window.LuminousVttWallBuilder;
    if (!builder?.isUnitEdge?.(normalized.from, normalized.to)) return originalDrawTopologyElement(element, isOnionSkin, preview);
    const layer = Number(topology.elementLayers(normalized)[0] || 0);
    const tile = descriptorFor(element, layer);
    if (!tile) return originalDrawTopologyElement(element, isOnionSkin, preview);
    return tileRenderer.drawWallTile(renderer.ctx, mapData, element, tile, { onion:isOnionSkin });
  };

  controller.handleTopologyChanged = function wallAutoTileTopologyChanged(...args) {
    const next = clone(mapData.topology || []);
    invalidateChanges(topologySnapshot, next);
    topologySnapshot = next;
    return originalHandleTopologyChanged(...args);
  };

  function inspectWall(elementId, zLayer = runtime.engine.activeZ) {
    const wall = (mapData.topology || []).find((entry) => String(entry.id) === String(elementId));
    return wall ? descriptorFor(wall, zLayer) : null;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    renderer.drawTopologyElement = originalDrawTopologyElement;
    controller.handleTopologyChanged = originalHandleTopologyChanged;
    cache.clear();
  }

  const api = Object.freeze({ autoTile, descriptorFor, inspectWall, invalidateAll, invalidateChanges, cache, stop });
  window.LuminousVttWallAutoTileRuntime = Object.freeze({ api, stop });
  window.LuminousVttRuntime = Object.freeze({ ...window.LuminousVttRuntime, wallAutoTile:api });
  return api;
}
