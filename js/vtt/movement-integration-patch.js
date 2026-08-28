(function (root) {
  'use strict';
  const base = root && root.LuminousVttTokenInteraction;
  const pathfinding = root && root.LuminousVttPathfinding;
  const movement = root && root.LuminousVttMovementEngine;
  if (!base || !pathfinding || !movement || base.__pathfindingMovementPatch) return;

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const worldState = (mapData = {}) => movement.normalizeWorldState((mapData.movement && mapData.movement.worldState) || {});

  function requestedInBounds(point, mapData = {}) {
    const bounds = pathfinding.gridBounds(mapData);
    const x = finite(point && point.x, NaN);
    const y = finite(point && point.y, NaN);
    return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
  }

  function resolveDrop(token, from, requestedPoint, mapData = {}) {
    if (!token || !mapData.grid || !requestedInBounds(requestedPoint, mapData)) return { valid: false, reason: 'OUT_OF_BOUNDS' };
    if (token.verticalMovement) return base.resolveDrop(token, from, requestedPoint, mapData);

    const movementMode = (token.movementState && token.movementState.mode) || token.activeMovementMode || 'walk';
    const movementType = token.pendingMovementType || 'normal';
    const plan = movement.planMove({
      token,
      start: from,
      target: requestedPoint,
      mapData,
      worldState: worldState(mapData),
      movementMode,
      movementType,
      blockTokens: mapData.movement && mapData.movement.blockTokens,
      diagonalRule: mapData.movement && mapData.movement.diagonalRule,
    });
    const snappedCell = pathfinding.cellFromPoint(requestedPoint, mapData);
    const snapped = pathfinding.pointForCell(snappedCell, mapData, pathfinding.tokenLayer(token));
    mapData.movement ||= {};

    if (!plan.valid) {
      mapData.movement.lastRejectedPlan = { tokenId: token.id, reason: plan.reason, requested: snappedCell, costFt: plan.movementCostFt ?? plan.costFt ?? null };
      return { ...snapped, valid: false, reason: plan.reason || 'NO_PATH', path: plan.path || [], costFt: plan.movementCostFt ?? plan.costFt ?? Infinity };
    }

    const committed = movement.commitMove(token, plan, worldState(mapData));
    if (!committed.valid) return { ...snapped, valid: false, reason: committed.reason || 'MOVEMENT_COMMIT_FAILED' };
    const endpoint = (plan.path && plan.path[plan.path.length - 1]) || snapped;
    mapData.movement.lastPlan = {
      tokenId: token.id,
      path: plan.path || [],
      routeCostFt: plan.routeCostFt ?? plan.costFt ?? 0,
      movementCostFt: plan.movementCostFt ?? 0,
      mode: plan.mode,
      movementType: plan.movementType,
    };
    delete token.pendingMovementType;
    return {
      x: endpoint.x,
      y: endpoint.y,
      col: endpoint.col,
      row: endpoint.row,
      valid: true,
      reason: null,
      path: plan.path || [],
      routeCostFt: plan.routeCostFt ?? plan.costFt ?? 0,
      costFt: plan.movementCostFt ?? 0,
      movementMode: plan.mode,
      movementType: plan.movementType,
      remainingFt: committed.remainingFt,
    };
  }

  root.LuminousVttTokenInteraction = Object.freeze({
    ...base,
    __pathfindingMovementPatch: true,
    baseResolveDrop: base.resolveDrop,
    resolveDrop,
  });
})(typeof window !== 'undefined' ? window : globalThis);