(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttWallAutoTile = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const DIRECTIONS = Object.freeze({ N:'N', E:'E', S:'S', W:'W' });
  const DIRECTION_ORDER = Object.freeze(['N','E','S','W']);
  const ANGLES = Object.freeze({ E:0, S:90, W:180, N:270 });
  const SHAPE_PRIORITY = Object.freeze({ isolated:0, end:1, straight:2, corner:3, t:4, cross:5 });
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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

  function vertex(value = {}) {
    return { col:Math.trunc(finite(value.col, 0)), row:Math.trunc(finite(value.row, 0)) };
  }

  function vertexKey(value = {}) {
    const v = vertex(value);
    return `${v.col},${v.row}`;
  }

  function sameVertex(a, b) { return vertexKey(a) === vertexKey(b); }

  function directionBetween(from, to) {
    const a = vertex(from), b = vertex(to);
    const dc = b.col - a.col, dr = b.row - a.row;
    if (dc === 1 && dr === 0) return DIRECTIONS.E;
    if (dc === -1 && dr === 0) return DIRECTIONS.W;
    if (dc === 0 && dr === 1) return DIRECTIONS.S;
    if (dc === 0 && dr === -1) return DIRECTIONS.N;
    return null;
  }

  function opposite(direction) {
    return ({ N:'S', S:'N', E:'W', W:'E' })[direction] || null;
  }

  function normalizedWall(raw = null) {
    const topology = topologyRuntime();
    const builder = builderRuntime();
    if (!raw || !topology) return null;
    const element = topology.normalizeElement(raw);
    if (element.type !== 'wall' || !builder?.isUnitEdge?.(element.from, element.to)) return null;
    return { ...element, wallProfileId:raw.wallProfileId, wall:clone(raw.wall) };
  }

  function wallsOnLayer(mapData = {}, zLayer = 0) {
    const topology = topologyRuntime();
    if (!topology) return [];
    return (Array.isArray(mapData.topology) ? mapData.topology : [])
      .filter((entry) => topology.elementOnLayer(entry, zLayer))
      .map(normalizedWall)
      .filter(Boolean);
  }

  function otherVertex(edge, atVertex) {
    if (sameVertex(edge.from, atVertex)) return vertex(edge.to);
    if (sameVertex(edge.to, atVertex)) return vertex(edge.from);
    return null;
  }

  function incidentWalls(mapData = {}, zLayer = 0, atVertex = {}) {
    return wallsOnLayer(mapData, zLayer).filter((edge) => sameVertex(edge.from, atVertex) || sameVertex(edge.to, atVertex));
  }

  function directionsAtVertex(mapData = {}, zLayer = 0, atVertex = {}) {
    const result = [];
    for (const edge of incidentWalls(mapData, zLayer, atVertex)) {
      const other = otherVertex(edge, atVertex);
      const direction = directionBetween(atVertex, other);
      if (direction && !result.includes(direction)) result.push(direction);
    }
    return result.sort((a, b) => DIRECTION_ORDER.indexOf(a) - DIRECTION_ORDER.indexOf(b));
  }

  function cornerOrientation(directions) {
    const key = [...directions].sort().join('');
    if (key === 'ES') return 0;
    if (key === 'SW') return 90;
    if (key === 'NW') return 180;
    if (key === 'EN') return 270;
    return 0;
  }

  function classifyDirections(rawDirections = []) {
    const directions = [...new Set(rawDirections.filter((entry) => DIRECTION_ORDER.includes(entry)))]
      .sort((a, b) => DIRECTION_ORDER.indexOf(a) - DIRECTION_ORDER.indexOf(b));
    const degree = directions.length;
    if (degree <= 0) return { shape:'isolated', degree:0, orientationDeg:0, directions };
    if (degree === 1) return { shape:'end', degree, orientationDeg:ANGLES[directions[0]], directions };
    if (degree === 2) {
      const isStraight = opposite(directions[0]) === directions[1];
      if (isStraight) {
        const horizontal = directions.includes('E') || directions.includes('W');
        return { shape:'straight', degree, orientationDeg:horizontal ? 0 : 90, directions };
      }
      return { shape:'corner', degree, orientationDeg:cornerOrientation(directions), directions };
    }
    if (degree === 3) {
      const missing = DIRECTION_ORDER.find((direction) => !directions.includes(direction)) || 'N';
      return { shape:'t', degree, orientationDeg:ANGLES[missing], directions, missingDirection:missing };
    }
    return { shape:'cross', degree:4, orientationDeg:0, directions:DIRECTION_ORDER.slice() };
  }

  function junctionAt(mapData = {}, zLayer = 0, atVertex = {}) {
    const directions = directionsAtVertex(mapData, zLayer, atVertex);
    const walls = incidentWalls(mapData, zLayer, atVertex);
    const profiles = [...new Set(walls.map((wall) => String(wall.wallProfileId || wall.wall?.profileId || 'legacy')).filter(Boolean))];
    return {
      vertex:vertex(atVertex),
      vertexKey:vertexKey(atVertex),
      ...classifyDirections(directions),
      wallIds:walls.map((wall) => String(wall.id || '')).filter(Boolean).sort(),
      profileIds:profiles.sort(),
      mixedProfiles:profiles.length > 1,
    };
  }

  function dominantShape(a, b) {
    const left = a?.shape || 'isolated', right = b?.shape || 'isolated';
    return SHAPE_PRIORITY[right] > SHAPE_PRIORITY[left] ? right : left;
  }

  function edgeOrientation(element = {}) {
    const builder = builderRuntime();
    const orientation = builder?.orientationOf?.(element.from, element.to);
    return orientation === 'vertical' ? 90 : 0;
  }

  function tileForEdge(rawElement, mapData = {}, zLayer = null) {
    const topology = topologyRuntime();
    const edge = normalizedWall(rawElement);
    if (!edge || !topology) return null;
    const layer = zLayer == null ? Number(topology.elementLayers(edge)[0] || 0) : Number(zLayer) || 0;
    const fromJunction = junctionAt(mapData, layer, edge.from);
    const toJunction = junctionAt(mapData, layer, edge.to);
    const bothEnds = fromJunction.shape === 'end' && toJunction.shape === 'end';
    const shape = bothEnds ? 'isolated' : dominantShape(fromJunction, toJunction);
    return {
      id:String(edge.id || ''),
      zLayer:layer,
      shape,
      orientationDeg:edgeOrientation(edge),
      variantKey:`wall.${shape}`,
      from:fromJunction,
      to:toJunction,
      profileId:String(edge.wallProfileId || edge.wall?.profileId || 'legacy'),
      materialId:String(edge.wall?.materialId || edge.wallProfileId || 'wall'),
      color:String(edge.wall?.visual?.color || '#8b8f93'),
      thicknessFt:finite(edge.thicknessFt, 0.5),
      heightFt:finite(edge.heightFt ?? edge.wall?.heightFt, 10),
    };
  }

  function elementFingerprint(raw = {}) {
    const topology = topologyRuntime();
    if (!topology) return '';
    const element = topology.normalizeElement(raw);
    return JSON.stringify({
      id:String(element.id || ''), type:element.type, from:element.from, to:element.to, z:element.z,
      state:element.state, thicknessFt:element.thicknessFt,
      wallProfileId:raw.wallProfileId || null, wall:raw.wall || null,
    });
  }

  function changedElements(previous = [], next = []) {
    const before = new Map((Array.isArray(previous) ? previous : []).map((entry) => [String(entry.id || ''), entry]));
    const after = new Map((Array.isArray(next) ? next : []).map((entry) => [String(entry.id || ''), entry]));
    const ids = new Set([...before.keys(), ...after.keys()]);
    const changed = [];
    for (const id of ids) {
      const a = before.get(id), b = after.get(id);
      if (!a || !b || elementFingerprint(a) !== elementFingerprint(b)) {
        if (a) changed.push(a);
        if (b) changed.push(b);
      }
    }
    return changed;
  }

  function touchedVertices(elements = []) {
    const result = new Map();
    for (const raw of Array.isArray(elements) ? elements : []) {
      const topology = topologyRuntime();
      const element = topology?.normalizeElement?.(raw);
      if (!element || !['wall','door','window','curtain_window'].includes(element.type)) continue;
      result.set(vertexKey(element.from), vertex(element.from));
      result.set(vertexKey(element.to), vertex(element.to));
    }
    return [...result.values()];
  }

  function affectedWallIds(mapData = {}, zLayer = 0, changed = []) {
    const touched = touchedVertices(changed);
    const ids = new Set();
    for (const at of touched) {
      for (const wall of incidentWalls(mapData, zLayer, at)) if (wall.id) ids.add(String(wall.id));
    }
    for (const raw of changed) {
      const topology = topologyRuntime();
      if (!topology?.elementOnLayer?.(raw, zLayer)) continue;
      if (String(raw.type) === 'wall' && raw.id) ids.add(String(raw.id));
    }
    return [...ids].sort();
  }

  return Object.freeze({
    DIRECTIONS, DIRECTION_ORDER, ANGLES, SHAPE_PRIORITY,
    vertex, vertexKey, sameVertex, directionBetween, opposite, normalizedWall, wallsOnLayer,
    otherVertex, incidentWalls, directionsAtVertex, classifyDirections, junctionAt, dominantShape,
    edgeOrientation, tileForEdge, elementFingerprint, changedElements, touchedVertices, affectedWallIds,
  });
});
