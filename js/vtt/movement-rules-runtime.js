(function (root) {
  'use strict';

  const rules = root?.LuminousVttMovementRules;
  const basePathfinding = root?.LuminousVttPathfinding;
  const baseMovement = root?.LuminousVttMovementEngine;
  if (!rules || !basePathfinding || !baseMovement) return;

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const EPS = 1e-9;

  function occupantAt(token, point, mapData = {}, zLayer = basePathfinding.tokenLayer(token)) {
    return (mapData.tokens || []).filter((other) => {
      if (!other || String(other.id || '') === String(token?.id || '')) return false;
      if (basePathfinding.tokenLayer(other) !== Number(zLayer)) return false;
      if (other.blocksMovement === false || other.intangible === true) return false;
      const distance = Math.hypot(finite(other.x) - finite(point.x), finite(other.y) - finite(point.y));
      const tokenRadius = root?.LuminousVttTokenInteraction?.tokenRadius?.(token, mapData.grid || {}) || Math.max(4, finite(token?.radius, basePathfinding.gridBounds(mapData).size * 0.4));
      const otherRadius = root?.LuminousVttTokenInteraction?.tokenRadius?.(other, mapData.grid || {}) || Math.max(4, finite(other?.radius, basePathfinding.gridBounds(mapData).size * 0.4));
      return distance + EPS < tokenRadius + otherRadius;
    });
  }

  function pointPassable(token, point, mapData = {}, zLayer = basePathfinding.tokenLayer(token), options = {}) {
    const baseGate = basePathfinding.pointPassable(token, point, mapData, zLayer, { ...options, blockTokens: false });
    if (!baseGate.valid) return baseGate;
    if ((options.blockTokens ?? mapData.movement?.blockTokens ?? true) === false) return baseGate;
    const occupants = occupantAt(token, point, mapData, zLayer);
    if (!occupants.length) return baseGate;
    if (options.allowOccupiedTransit === true) {
      for (const occupant of occupants) {
        const traversal = rules.canTraverseOccupiedSpace(token, occupant, { relationResolver: options.relationResolver || mapData.movement?.relationResolver });
        if (!traversal.valid) return { valid: false, reason: traversal.reason, token: occupant, relation: traversal.relation };
      }
      return { ...baseGate, transitOccupants: occupants };
    }
    return { valid: false, reason: 'OCCUPIED_DESTINATION', token: occupants[0] };
  }

  function edgePassable(token, fromCell, toCell, mapData = {}, zLayer = basePathfinding.tokenLayer(token), options = {}) {
    const from = basePathfinding.pointForCell(fromCell, mapData, zLayer);
    const to = basePathfinding.pointForCell(toCell, mapData, zLayer);
    const destination = pointPassable(token, to, mapData, zLayer, { ...options, allowOccupiedTransit: true });
    if (!destination.valid) return destination;
    const dx = toCell.col - fromCell.col;
    const dy = toCell.row - fromCell.row;
    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
      const a = { col: fromCell.col + dx, row: fromCell.row };
      const b = { col: fromCell.col, row: fromCell.row + dy };
      const ap = pointPassable(token, basePathfinding.pointForCell(a, mapData, zLayer), mapData, zLayer, { ...options, allowOccupiedTransit: true });
      const bp = pointPassable(token, basePathfinding.pointForCell(b, mapData, zLayer), mapData, zLayer, { ...options, allowOccupiedTransit: true });
      if (!ap.valid || !bp.valid) return { valid: false, reason: 'CORNER_CUT_BLOCKED' };
    }
    const interaction = root?.LuminousVttTokenInteraction;
    const path = interaction?.isPathClear?.(token, from, to, mapData) || { valid: true };
    return path.valid ? { valid: true, terrain: destination.terrain } : path;
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
    return cells.map((cell) => basePathfinding.pointForCell(cell, mapData, zLayer));
  }

  function findPath({ token, start, target, mapData = {}, zLayer = basePathfinding.tokenLayer(token), movementMode = 'walk', blockTokens, diagonalRule: rule, maxVisited = 20000 } = {}) {
    if (!token || !mapData.grid || !start || !target) return { valid: false, reason: 'INVALID_INPUT', path: [], costFt: Infinity };
    const startCell = start.col != null && start.row != null ? { col: Math.trunc(Number(start.col)), row: Math.trunc(Number(start.row)) } : basePathfinding.cellFromPoint(start, mapData);
    const targetCell = target.col != null && target.row != null ? { col: Math.trunc(Number(target.col)), row: Math.trunc(Number(target.row)) } : basePathfinding.cellFromPoint(target, mapData);
    const options = { movementMode, blockTokens, diagonalRule: rule };
    const targetPoint = basePathfinding.pointForCell(targetCell, mapData, zLayer);
    const targetGate = pointPassable(token, targetPoint, mapData, zLayer, { ...options, allowOccupiedTransit: false });
    if (!targetGate.valid) return { valid: false, reason: targetGate.reason || 'TARGET_BLOCKED', path: [], costFt: Infinity, blocker: targetGate };
    const startKey = basePathfinding.cellKey(startCell.col, startCell.row);
    const goalKey = basePathfinding.cellKey(targetCell.col, targetCell.row);
    if (startKey === goalKey) return { valid: true, reason: null, path: [basePathfinding.pointForCell(startCell, mapData, zLayer)], cells: [startCell], costFt: 0, visited: 0 };

    const open = new Set([startKey]);
    const nodes = new Map([[startKey, startCell]]);
    const cameFrom = new Map();
    const g = new Map([[startKey, 0]]);
    const minTerrainMultiplier = Math.max(0.001, finite(basePathfinding.MIN_TERRAIN_MULTIPLIER, 0.05));
    const heuristic = (cell) => basePathfinding.heuristicFt(cell, targetCell, mapData, options) * (basePathfinding.__cheapTerrainHeuristicPatch ? 1 : minTerrainMultiplier);
    const f = new Map([[startKey, heuristic(startCell)]]);
    let visited = 0;
    const limit = Math.max(1, Math.trunc(finite(maxVisited, 20000)));

    while (open.size && visited < limit) {
      let currentKey = null;
      let currentScore = Infinity;
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
      for (const next of basePathfinding.neighbors(current, mapData)) {
        const edge = edgePassable(token, current, next, mapData, zLayer, options);
        if (!edge.valid) continue;
        const nextKey = basePathfinding.cellKey(next.col, next.row);
        const tentative = (g.get(currentKey) ?? Infinity) + basePathfinding.stepCostFt(current, next, mapData, zLayer, options);
        if (tentative + EPS >= (g.get(nextKey) ?? Infinity)) continue;
        cameFrom.set(nextKey, currentKey);
        nodes.set(nextKey, next);
        g.set(nextKey, tentative);
        f.set(nextKey, tentative + heuristic(next));
        open.add(nextKey);
      }
    }
    return { valid: false, reason: visited >= limit ? 'SEARCH_LIMIT' : 'NO_PATH', path: [], cells: [], costFt: Infinity, visited };
  }

  root.LuminousVttPathfinding = Object.freeze({
    ...basePathfinding,
    __occupancyRulesPatch: true,
    occupantAt,
    pointPassable,
    edgePassable,
    findPath,
  });

  function captureTurnStart(token = {}) {
    token.movementTurnStart = rules.snapshotTurnStart(token);
    token.movementTurnHistory = [];
    return clone(token.movementTurnStart);
  }

  function beginRound(token = {}, roundId = 0, mode = null) {
    const state = baseMovement.beginRound(token, roundId, mode);
    captureTurnStart(token);
    return state;
  }

  function ensureRound(token = {}, worldState = {}, mode = null) {
    const world = baseMovement.normalizeWorldState(worldState);
    if (world.mode !== 'round') return baseMovement.setFreeMode(token);
    const current = baseMovement.currentMovementState(token);
    if (current.roundId !== world.roundId || !Number.isFinite(Number(token.movementRemainingFt))) return beginRound(token, world.roundId, mode || current.mode);
    if (!token.movementTurnStart) captureTurnStart(token);
    return current;
  }

  function commitMove(token = {}, plan = {}, worldState = {}) {
    const result = baseMovement.commitMove(token, plan, worldState);
    if (!result.valid) return result;
    const world = baseMovement.normalizeWorldState(worldState);
    if (world.mode === 'round') {
      if (!token.movementTurnStart) captureTurnStart(token);
      token.movementTurnHistory ||= [];
      token.movementTurnHistory.push({
        path: clone(result.path || []),
        costFt: Math.max(0, finite(result.costFt)),
        movementType: plan.movementType || 'normal',
      });
    }
    return result;
  }

  function dash(token = {}, worldState = {}, options = {}) {
    const result = baseMovement.dash(token, worldState, options);
    if (!result.valid) return result;
    token.activeActionMovementMode = 'dash';
    token.dashActionType = String(options.actionType || options.cost || 'action');
    return { ...result, actionType: token.dashActionType, noise: 'high' };
  }

  function resetMovement(token = {}, worldState = {}) {
    const world = baseMovement.normalizeWorldState(worldState);
    if (world.mode !== 'round') return { valid: false, reason: 'ROUND_MODE_REQUIRED' };
    const state = ensureRound(token, world);
    const start = token.movementTurnStart;
    if (!start) return { valid: false, reason: 'TURN_START_UNAVAILABLE' };
    token.x = finite(start.x);
    token.y = finite(start.y);
    token.zLayer = finite(start.zLayer);
    token.z = [token.zLayer];
    token.elevationFt = finite(start.elevationFt);
    if (start.gridPosition) token.gridPosition = clone(start.gridPosition);
    state.remainingFt = Math.max(0, finite(state.speedFt));
    state.dashed = false;
    token.movementState = state;
    token.movementRemainingFt = state.remainingFt;
    token.movementTurnHistory = [];
    delete token.activeActionMovementMode;
    const actionType = token.dashActionType || null;
    delete token.dashActionType;
    return { valid: true, position: clone(start), remainingFt: state.remainingFt, refundActionType: actionType };
  }

  function movementStart(token = {}) { return clone(token.movementTurnStart || null); }

  root.LuminousVttMovementEngine = Object.freeze({
    ...baseMovement,
    __movementRulesClosurePatch: true,
    beginRound,
    ensureRound,
    commitMove,
    dash,
    resetMovement,
    movementStart,
    captureTurnStart,
  });
})(typeof window !== 'undefined' ? window : globalThis);
