(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttWallBuilder = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const DEFAULT_PROFILES = Object.freeze([
    Object.freeze({ id:'concrete', name:'Concrete Wall', materialId:'concrete', thicknessFt:0.75, heightFt:10, visual:Object.freeze({ color:'#8b8f93' }) }),
    Object.freeze({ id:'brick', name:'Brick Wall', materialId:'brick', thicknessFt:0.5, heightFt:10, visual:Object.freeze({ color:'#9a5848' }) }),
    Object.freeze({ id:'metal', name:'Metal Wall', materialId:'metal', thicknessFt:0.5, heightFt:10, visual:Object.freeze({ color:'#64727a' }) }),
    Object.freeze({ id:'wood', name:'Wood Wall', materialId:'wood', thicknessFt:0.5, heightFt:10, visual:Object.freeze({ color:'#7b583d' }) }),
  ]);

  function topologyRuntime() {
    if (root?.LuminousVttTopology) return root.LuminousVttTopology;
    if (typeof require !== 'undefined') {
      try { return require('./topology.js'); } catch (_) {}
    }
    return null;
  }

  function safeId(value, fallback = 'wall') {
    return clean(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
  }

  function normalizeProfile(raw = {}) {
    const id = safeId(raw.id || raw.profileId || raw.name, 'concrete');
    return {
      id,
      name: clean(raw.name || raw.label || id) || id,
      materialId: safeId(raw.materialId || raw.material || id, id),
      thicknessFt: Math.max(0.1, finite(raw.thicknessFt, 0.5)),
      heightFt: Math.max(0.5, finite(raw.heightFt, 10)),
      visual: {
        color: clean(raw.visual?.color || raw.color || '#8b8f93') || '#8b8f93',
      },
    };
  }

  function defaultProfileCatalog() {
    const result = {};
    DEFAULT_PROFILES.forEach((profile) => { const normalized = normalizeProfile(profile); result[normalized.id] = normalized; });
    return result;
  }

  function profileFor(profileId = 'concrete', catalog = null) {
    const profiles = catalog && typeof catalog === 'object' ? catalog : defaultProfileCatalog();
    return normalizeProfile(profiles[safeId(profileId, 'concrete')] || profiles.concrete || DEFAULT_PROFILES[0]);
  }

  function normalizeVertex(vertex = {}) {
    return { col: Math.trunc(finite(vertex.col, 0)), row: Math.trunc(finite(vertex.row, 0)) };
  }

  function compareVertex(a, b) {
    const left = normalizeVertex(a), right = normalizeVertex(b);
    if (left.col !== right.col) return left.col - right.col;
    return left.row - right.row;
  }

  function canonicalEdge(from, to) {
    const a = normalizeVertex(from), b = normalizeVertex(to);
    return compareVertex(a, b) <= 0 ? { from:a, to:b } : { from:b, to:a };
  }

  function isUnitEdge(from, to) {
    const a = normalizeVertex(from), b = normalizeVertex(to);
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
  }

  function edgeKey(from, to, zLayer = 0) {
    const edge = canonicalEdge(from, to);
    return `z${Number(zLayer) || 0}:${edge.from.col},${edge.from.row}>${edge.to.col},${edge.to.row}`;
  }

  function wallId(from, to, zLayer = 0) {
    const edge = canonicalEdge(from, to);
    const z = Number(zLayer) || 0;
    return `wall_z${String(z).replace(/-/g, 'n')}_c${edge.from.col}r${edge.from.row}_c${edge.to.col}r${edge.to.row}`;
  }

  function runEdges(from, to) {
    const start = normalizeVertex(from), end = normalizeVertex(to);
    const horizontal = start.row === end.row;
    const vertical = start.col === end.col;
    if (!horizontal && !vertical) throw new Error('WALL_RUN_MUST_BE_AXIS_ALIGNED');
    if (start.col === end.col && start.row === end.row) return [];
    const edges = [];
    if (horizontal) {
      const direction = end.col > start.col ? 1 : -1;
      for (let col = start.col; col !== end.col; col += direction) {
        edges.push(canonicalEdge({ col, row:start.row }, { col:col + direction, row:start.row }));
      }
    } else {
      const direction = end.row > start.row ? 1 : -1;
      for (let row = start.row; row !== end.row; row += direction) {
        edges.push(canonicalEdge({ col:start.col, row }, { col:start.col, row:row + direction }));
      }
    }
    return edges;
  }

  function createWallRun({ from, to, zLayer = 0, profileId = 'concrete', catalog = null } = {}) {
    const topology = topologyRuntime();
    if (!topology) throw new Error('TOPOLOGY_RUNTIME_REQUIRED');
    const profile = profileFor(profileId, catalog);
    return runEdges(from, to).map((edge) => topology.createElement({
      id: wallId(edge.from, edge.to, zLayer),
      type: 'wall',
      from: edge.from,
      to: edge.to,
      zLayer,
      thicknessFt: profile.thicknessFt,
    })).map((element) => ({
      ...element,
      wallProfileId: profile.id,
      heightFt: profile.heightFt,
      wall: {
        profileId: profile.id,
        materialId: profile.materialId,
        heightFt: profile.heightFt,
        visual: clone(profile.visual),
      },
    }));
  }

  function layerOf(element = {}) {
    const topology = topologyRuntime();
    const layers = topology?.elementLayers?.(element) || (Array.isArray(element.z) ? element.z : [finite(element.z, 0)]);
    return layers.map(Number);
  }

  function orientationOf(from, to) {
    const a = normalizeVertex(from), b = normalizeVertex(to);
    if (a.row === b.row) return 'horizontal';
    if (a.col === b.col) return 'vertical';
    return 'other';
  }

  function elementCoversEdge(rawElement, edge, zLayer = 0) {
    const topology = topologyRuntime();
    if (!rawElement || !topology?.elementOnLayer?.(rawElement, zLayer)) return false;
    const element = topology.normalizeElement(rawElement);
    const target = canonicalEdge(edge.from, edge.to);
    const eo = orientationOf(element.from, element.to), to = orientationOf(target.from, target.to);
    if (eo !== to || eo === 'other') return false;
    if (eo === 'horizontal') {
      if (element.from.row !== target.from.row || element.to.row !== target.to.row) return false;
      const min = Math.min(element.from.col, element.to.col), max = Math.max(element.from.col, element.to.col);
      return target.from.col >= min && target.to.col <= max;
    }
    if (element.from.col !== target.from.col || element.to.col !== target.to.col) return false;
    const min = Math.min(element.from.row, element.to.row), max = Math.max(element.from.row, element.to.row);
    return target.from.row >= min && target.to.row <= max;
  }

  function exactUnitElement(rawElement, edge, zLayer = 0) {
    const topology = topologyRuntime();
    if (!rawElement || !topology?.elementOnLayer?.(rawElement, zLayer)) return false;
    const element = topology.normalizeElement(rawElement);
    if (!isUnitEdge(element.from, element.to)) return false;
    return edgeKey(element.from, element.to, zLayer) === edgeKey(edge.from, edge.to, zLayer);
  }

  function reconcileRun(existing = [], incoming = []) {
    const save = [], skipped = [];
    for (const candidate of Array.isArray(incoming) ? incoming : []) {
      const zLayer = layerOf(candidate)[0] || 0;
      const edge = canonicalEdge(candidate.from, candidate.to);
      const occupants = (Array.isArray(existing) ? existing : []).filter((entry) => elementCoversEdge(entry, edge, zLayer));
      const opening = occupants.find((entry) => String(entry.type) !== 'wall');
      if (opening) {
        skipped.push({ element:candidate, reason:'EDGE_OCCUPIED_BY_OPENING', occupantId:opening.id || null, occupantType:opening.type || null });
        continue;
      }
      const wall = occupants.find((entry) => String(entry.type) === 'wall');
      if (wall && !exactUnitElement(wall, edge, zLayer)) {
        skipped.push({ element:candidate, reason:'EDGE_COVERED_BY_LEGACY_WALL', occupantId:wall.id || null, occupantType:'wall' });
        continue;
      }
      save.push(wall ? { ...candidate, id:String(wall.id || candidate.id) } : candidate);
    }
    return { save, skipped };
  }

  return Object.freeze({
    DEFAULT_PROFILES, safeId, normalizeProfile, defaultProfileCatalog, profileFor,
    normalizeVertex, canonicalEdge, isUnitEdge, edgeKey, wallId, runEdges, createWallRun,
    orientationOf, elementCoversEdge, exactUnitElement, reconcileRun,
  });
});
