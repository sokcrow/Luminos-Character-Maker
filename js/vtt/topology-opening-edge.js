(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttOpeningEdge = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const OPENING_TYPES = Object.freeze(['door', 'window', 'curtain_window']);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function topologyRuntime() {
    if (root?.LuminousVttTopology) return root.LuminousVttTopology;
    if (typeof require !== 'undefined') {
      try { return require('./topology.js'); } catch (_) {}
    }
    return null;
  }

  function builderRuntime() {
    if (root?.LuminousVttWallBuilder) return root.LuminousVttWallBuilder;
    if (typeof require !== 'undefined') {
      try { return require('./wall-builder.js'); } catch (_) {}
    }
    return null;
  }

  function normalizeOpeningType(type) {
    const value = String(type || '').trim().toLowerCase();
    if (!OPENING_TYPES.includes(value)) throw new Error('OPENING_TYPE_REQUIRED');
    return value;
  }

  function layerOf(element = {}) {
    const topology = topologyRuntime();
    return Number(topology?.elementLayers?.(element)?.[0] || 0);
  }

  function openingId(from, to, zLayer = 0) {
    const builder = builderRuntime();
    if (!builder) throw new Error('WALL_BUILDER_REQUIRED');
    const edge = builder.canonicalEdge(from, to);
    const z = Number(zLayer) || 0;
    return `opening_z${String(z).replace(/-/g, 'n')}_c${edge.from.col}r${edge.from.row}_c${edge.to.col}r${edge.to.row}`;
  }

  function isOpening(element = {}) {
    return OPENING_TYPES.includes(String(element?.type || ''));
  }

  function isUnitWall(element = {}) {
    const topology = topologyRuntime();
    const builder = builderRuntime();
    if (!topology || !builder) return false;
    const normalized = topology.normalizeElement(element);
    return normalized.type === 'wall' && builder.isUnitEdge(normalized.from, normalized.to);
  }

  function exactEdgeMatch(a = {}, b = {}, zLayer = null) {
    const topology = topologyRuntime();
    const builder = builderRuntime();
    if (!topology || !builder || !a || !b) return false;
    const az = zLayer == null ? layerOf(a) : Number(zLayer) || 0;
    if (!topology.elementOnLayer(a, az) || !topology.elementOnLayer(b, az)) return false;
    const left = topology.normalizeElement(a);
    const right = topology.normalizeElement(b);
    if (!builder.isUnitEdge(left.from, left.to) || !builder.isUnitEdge(right.from, right.to)) return false;
    return builder.edgeKey(left.from, left.to, az) === builder.edgeKey(right.from, right.to, az);
  }

  function sourceWallSnapshot(rawWall = {}) {
    if (!isUnitWall(rawWall)) throw new Error('UNIT_WALL_REQUIRED');
    const topology = topologyRuntime();
    const wall = topology.normalizeElement(rawWall);
    return clone({
      ...rawWall,
      ...wall,
      state: null,
      thresholds: undefined,
    });
  }

  function createOpeningFromWall(rawWall, type) {
    const topology = topologyRuntime();
    const openingType = normalizeOpeningType(type);
    if (!topology || !isUnitWall(rawWall)) throw new Error('UNIT_WALL_REQUIRED');
    const wall = topology.normalizeElement(rawWall);
    const zLayer = layerOf(wall);
    const opening = topology.createElement({
      id: openingId(wall.from, wall.to, zLayer),
      type: openingType,
      from: wall.from,
      to: wall.to,
      zLayer,
    });
    return {
      ...opening,
      openingEdge: {
        schemaVersion: 1,
        sourceWall: sourceWallSnapshot(rawWall),
      },
    };
  }

  function retypeOpening(rawOpening, type) {
    const topology = topologyRuntime();
    const openingType = normalizeOpeningType(type);
    if (!topology || !isOpening(rawOpening)) throw new Error('OPENING_REQUIRED');
    const current = topology.normalizeElement(rawOpening);
    const sourceWall = clone(rawOpening.openingEdge?.sourceWall || null);
    if (!sourceWall || !isUnitWall(sourceWall)) throw new Error('SOURCE_WALL_REQUIRED');
    const zLayer = layerOf(current);
    return {
      ...topology.createElement({
        id: String(current.id || openingId(current.from, current.to, zLayer)),
        type: openingType,
        from: current.from,
        to: current.to,
        zLayer,
      }),
      openingEdge: {
        schemaVersion: 1,
        sourceWall,
      },
    };
  }

  function restoreWall(rawOpening) {
    const topology = topologyRuntime();
    const builder = builderRuntime();
    if (!topology || !builder || !isOpening(rawOpening)) throw new Error('OPENING_REQUIRED');
    const source = clone(rawOpening.openingEdge?.sourceWall || null);
    if (!source || !isUnitWall(source)) throw new Error('SOURCE_WALL_REQUIRED');
    const normalized = topology.normalizeElement(source);
    const zLayer = layerOf(normalized);
    const id = String(source.id || builder.wallId(normalized.from, normalized.to, zLayer));
    return {
      ...source,
      ...normalized,
      id,
      type: 'wall',
      state: null,
      thresholds: undefined,
      wallProfileId: source.wallProfileId || source.wall?.profileId || 'concrete',
      wall: clone(source.wall || null),
      heightFt: Number(source.heightFt ?? source.wall?.heightFt ?? 10),
    };
  }

  function exactElementAtEdge(elements = [], from, to, zLayer = 0) {
    const topology = topologyRuntime();
    const builder = builderRuntime();
    if (!topology || !builder) return null;
    const key = builder.edgeKey(from, to, zLayer);
    return (Array.isArray(elements) ? elements : []).find((raw) => {
      if (!topology.elementOnLayer(raw, zLayer)) return false;
      const element = topology.normalizeElement(raw);
      if (!builder.isUnitEdge(element.from, element.to)) return false;
      return builder.edgeKey(element.from, element.to, zLayer) === key;
    }) || null;
  }

  function replacementPlan(rawElement, type) {
    const openingType = normalizeOpeningType(type);
    if (isUnitWall(rawElement)) {
      return { oldId:String(rawElement.id), next:createOpeningFromWall(rawElement, openingType), mode:'wall_to_opening' };
    }
    if (isOpening(rawElement)) {
      return { oldId:String(rawElement.id), next:retypeOpening(rawElement, openingType), mode:'opening_retype' };
    }
    throw new Error('REPLACEABLE_EDGE_REQUIRED');
  }

  return Object.freeze({
    OPENING_TYPES,
    normalizeOpeningType,
    layerOf,
    openingId,
    isOpening,
    isUnitWall,
    exactEdgeMatch,
    sourceWallSnapshot,
    createOpeningFromWall,
    retypeOpening,
    restoreWall,
    exactElementAtEdge,
    replacementPlan,
  });
});
