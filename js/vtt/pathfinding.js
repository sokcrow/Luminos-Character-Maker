(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttPathfinding = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const EPS = 1e-9;

  function interactionRuntime() {
    if (root?.LuminousVttTokenInteraction) return root.LuminousVttTokenInteraction;
    if (typeof require !== 'undefined') {
      try { return require('./token-interaction.js'); } catch (_) {}
    }
    return null;
  }

  function gridBounds(mapData = {}) {
    const grid = mapData.grid || {};
    const size = Math.max(1, finite(grid.size, 70));
    const cols = Math.max(1, Math.trunc(finite(grid.cols, 1)));
    const rows = Math.max(1, Math.trunc(finite(grid.rows, 1)));
    const feetPerCell = Math.max(0.001, finite(grid.distancePerCell, 5));
    return { size, cols, rows, feetPerCell, width: cols * size, height: rows * size };
  }

  function cellKey(col, row) { return `${Math.trunc(finite(col))}_${Math.trunc(finite(row))}`; }

  function cellFromPoint(point, mapData = {}) {
    const { size, cols, rows } = gridBounds(mapData);
    return {
      col: Math.max(0, Math.min(cols - 1, Math.floor(finite(point?.x) / size))),
      row: Math.max(0, Math.min(rows - 1, Math.floor(finite(point?.y) / size))),
    };
  }

  function pointForCell(cell, mapData = {}, zLayer = 0) {
    const { size } = gridBounds(mapData);
    return { x: (finite(cell?.col) + 0.5) * size, y: (finite(cell?.row) + 0.5) * size, col: Math.trunc(finite(cell?.col)), row: Math.trunc(finite(cell?.row)), z: Number(zLayer) || 0, zLayer: Number(zLayer) || 0 };
  }

  function tokenLayer(token = {}) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
    return 0;
  }

  function terrainRecord(mapData = {}, zLayer = 0, col = 0, row = 0) {
    const movement = mapData.movement || {};
    const key = cellKey(col, row);
    const sources = [movement.terrain?.[zLayer], movement.terrain?.[String(zLayer)], movement.terrainCells?.[zLayer], movement.terrainCells?.[String(zLayer)], movement.terrain];
    for (const source of sources) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
      const raw = source[key];
      if (raw == null) continue;
      if (typeof raw === 'number') return { multiplier: Math.max(0.05, raw) };
      if (typeof raw === 'string') return { type: clean(raw).toLowerCase(), multiplier: clean(raw).toLowerCase() === 'difficult' ? 2 : 1 };
      if (typeof raw === 'object') return { ...raw, multiplier: Math.max(0.05, finite(raw.multiplier ?? raw.costMultiplier, raw.difficult ? 2 : 1)) };
    }
    return { multiplier: 1 };
  }

  function terrainAllows(record = {}, movementMode = 'walk') {
    if (record.blocked === true) return false;
    const mode = clean(movementMode || 'walk').toLowerCase();
    const allowed = record.allowedModes || record.modes;
    if (Array.isArray(allowed) && allowed.length && !allowed.map((entry) => clean(entry).toLowerCase()).includes(mode)) return false;
    const required = clean(record.requiredMode).toLowerCase();
    if (required && required !== mode) return false;
    return true;
  }

  function tokenRadius(token, mapData) {
    const interaction = interactionRuntime();
    return interaction?.tokenRadius?.(token, mapData.grid || {}) || Math.max(4, finite(token?.radius, gridBounds(mapData).size * 0.4));
  }

  function tokenOccupiesPoint(other, point, token, mapData, zLayer) {
    if (!other || String(other.id || '') === String(token?.id || '')) return false;
    if (tokenLayer(other) !== Number(zLayer)) return false;
    if (other.blocksMovement === false || other.intangible === true) return false;
    const distance = Math.hypot(finite(other.x) - finite(point.x), finite(other.y) - finite(point.y));
    return distance + EPS < tokenRadius(other, mapData) + tokenRadius(token, mapData);
  }

  function pointPassable(token, point, mapData = {}, zLayer = tokenLayer(token), options = {}) {
    const interaction = interactionRuntime();
    const cell = cellFromPoint(point, mapData);
    const terrain = terrainRecord(mapData, zLayer, cell.col, cell.row);
    if (!terrainAllows(terrain, options.movementMode || 'walk')) return { valid: false, reason: 'TERRAIN_MODE_BLOCKED', terrain };
    const occupancy = interaction?.canOccupy?.(token, point, mapData) || { valid: true };
    if (!occupancy.valid) return occupancy;
    const blockTokens = options.blockTokens ?? mapData.movement?.blockTokens ?? true;
    if (blockTokens) {
      const blocker = (mapData.tokens || []).find((other) => tokenOccupiesPoint(other, point, token, mapData, zLayer));
      if (blocker) return { valid: false, reason: 'BLOCKED_BY_TOKEN', token: blocker };
    }
    return { valid: true, terrain };
  }

  function edgePassable(token, fromCell, toCell, mapData = {}, zLayer = tokenLayer(token), options = {}) {
    const interaction = interactionRuntime();
    const from = pointForCell(fromCell, mapData, zLayer);
    const to = pointForCell(toCell, mapData, zLayer);
    const destination = pointPassable(token, to, mapData, zLayer, options);
    if (!destination.valid) return destination;
    const dx = toCell.col - fromCell.col;
    const dy = toCell.row - fromCell.row;
    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
      const a = { col: fromCell.col + dx, row: fromCell.row };
      const b = { col: fromCell.col, row: fromCell.row + dy };
      const ap = pointPassable(token, pointForCell(a, mapData, zLayer), mapData, zLayer, options);
      const bp = pointPassable(token, pointForCell(b, mapData, zLayer), mapData, zLayer, options);
      if (!ap.valid || !bp.valid) return { valid: false, reason: 'CORNER_CUT_BLOCKED' };
      if (interaction?.isPathClear) {
        const pathA = interaction.isPathClear(token, from, pointForCell(a, mapData, zLayer), mapData);
        const pathB = interaction.isPathClear(token, from, pointForCell(b, mapData, zLayer), mapData);
        if (!pathA.valid || !pathB.valid) return { valid: false, reason: 'CORNER_CUT_BLOCKED' };
      }
    }
    const path = interaction?.isPathClear?.(token, from, to, mapData) || { valid: true };
    if (!path.valid) return path;
    return { valid: true, terrain: destination.terrain };
  }

  function diagonalRule(mapData = {}, options = {}) {
    const raw = clean(options.diagonalRule || mapData.movement?.diagonalRule || '5e').toLowerCase();
    return ['euclidean', 'sqrt2', 'real'].includes(raw) ? 'euclidean' : '5e';
  }

  function baseStepCostFt(fromCell, toCell, mapData = {}, options = {}) {
    const { feetPerCell } = gridBounds(mapData);
    const diagonal = fromCell.col !== toCell.col && fromCell.row !== toCell.row;
    return diagonal && diagonalRule(mapData, options) === 'euclidean' ? feetPerCell * Math.SQRT2 : feetPerCell;
  }

  function stepCostFt(fromCell, toCell, mapData = {}, zLayer = 0, options = {}) {
    const terrain = terrainRecord(mapData, zLayer, toCell.col, toCell.row);
    return baseStepCostFt(fromCell, toCell, mapData, options) * Math.max(0.05, finite(terrain.multiplier, 1));
  }

  function heuristicFt(a, b, mapData = {}, options = {}) {
    const { feetPerCell } = gridBounds(mapData);
    const dx = Math.abs(a.col - b.col), dy = Math.abs(a.row - b.row);
    if (diagonalRule(mapData, options) === 'euclidean') return Math.hypot(dx, dy) * feetPerCell;
    return Math.max(dx, dy) * feetPerCell;
  }

  function neighbors(cell, mapData = {}) {
    const { cols, rows } = gridBounds(mapData);
    const result = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const col = cell.col + dx, row = cell.row + dy;
        if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
        result.push({ col, row });
      }
    }
    return result;
  }

  function reconstruct(cameFrom, nodes, endKey, mapData, zLayer) {
    const cells = [];
    let key = endKey;
    while (key) {
      const cell = nodes.get(key);
      if (!cell) break;
      cells.push(cell);
      key = cameFrom.get(key) || null;
    }
    cells.reverse();
    return cells.map((cell) => pointForCell(cell, mapData, zLayer));
  }

  function findPath({ token, start, target, mapData = {}, zLayer = tokenLayer(token), movementMode = 'walk', blockTokens, diagonalRule: rule, maxVisited = 20000 } = {}) {
    if (!token || !mapData.grid || !start || !target) return { valid: false, reason: 'INVALID_INPUT', path: [], costFt: Infinity };
    const startCell = start.col != null && start.row != null ? { col: Math.trunc(Number(start.col)), row: Math.trunc(Number(start.row)) } : cellFromPoint(start, mapData);
    const targetCell = target.col != null && target.row != null ? { col: Math.trunc(Number(target.col)), row: Math.trunc(Number(target.row)) } : cellFromPoint(target, mapData);
    const options = { movementMode, blockTokens, diagonalRule: rule };
    const targetPoint = pointForCell(targetCell, mapData, zLayer);
    const targetGate = pointPassable(token, targetPoint, mapData, zLayer, options);
    if (!targetGate.valid) return { valid: false, reason: targetGate.reason || 'TARGET_BLOCKED', path: [], costFt: Infinity, blocker: targetGate };
    const startKey = cellKey(startCell.col, startCell.row), goalKey = cellKey(targetCell.col, targetCell.row);
    if (startKey === goalKey) return { valid: true, reason: null, path: [pointForCell(startCell, mapData, zLayer)], cells: [startCell], costFt: 0, visited: 0 };

    const open = new Set([startKey]);
    const nodes = new Map([[startKey, startCell]]);
    const cameFrom = new Map();
    const g = new Map([[startKey, 0]]);
    const f = new Map([[startKey, heuristicFt(startCell, targetCell, mapData, options)]]);
    let visited = 0;

    while (open.size && visited < Math.max(1, Math.trunc(finite(maxVisited, 20000)))) {
      let currentKey = null, currentScore = Infinity;
      for (const key of open) {
        const score = f.get(key) ?? Infinity;
        if (score < currentScore) { currentScore = score; currentKey = key; }
      }
      if (!currentKey) break;
      const current = nodes.get(currentKey);
      if (currentKey === goalKey) {
        const path = reconstruct(cameFrom, nodes, currentKey, mapData, zLayer);
        return { valid: true, reason: null, path, cells: path.map((point) => ({ col: point.col, row: point.row })), costFt: g.get(currentKey) || 0, visited };
      }
      open.delete(currentKey);
      visited += 1;
      for (const next of neighbors(current, mapData)) {
        const edge = edgePassable(token, current, next, mapData, zLayer, options);
        if (!edge.valid) continue;
        const nextKey = cellKey(next.col, next.row);
        const tentative = (g.get(currentKey) ?? Infinity) + stepCostFt(current, next, mapData, zLayer, options);
        if (tentative + EPS >= (g.get(nextKey) ?? Infinity)) continue;
        cameFrom.set(nextKey, currentKey);
        nodes.set(nextKey, next);
        g.set(nextKey, tentative);
        f.set(nextKey, tentative + heuristicFt(next, targetCell, mapData, options));
        open.add(nextKey);
      }
    }
    return { valid: false, reason: visited >= maxVisited ? 'SEARCH_LIMIT' : 'NO_PATH', path: [], cells: [], costFt: Infinity, visited };
  }

  function pathCostFt(path = [], mapData = {}, zLayer = 0, options = {}) {
    if (!Array.isArray(path) || path.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1].col == null ? cellFromPoint(path[i - 1], mapData) : path[i - 1];
      const b = path[i].col == null ? cellFromPoint(path[i], mapData) : path[i];
      total += stepCostFt(a, b, mapData, zLayer, options);
    }
    return total;
  }

  return Object.freeze({
    gridBounds, cellKey, cellFromPoint, pointForCell, tokenLayer, terrainRecord, terrainAllows, pointPassable,
    edgePassable, diagonalRule, baseStepCostFt, stepCostFt, heuristicFt, neighbors, findPath, pathCostFt,
  });
});