(function (root) {
  'use strict';

  const base = root?.LuminousVttMovementEngine;
  const pathfinding = root?.LuminousVttPathfinding;
  const rules = root?.LuminousVttMovementRules;
  if (!base || !pathfinding || !rules || base.__doorAwareMovementPatch) return;

  const clean = (value) => String(value ?? '').trim().toLowerCase();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function doorState(door = {}) {
    return clean(door.state || 'closed') || 'closed';
  }

  function closedDoor(door = {}) {
    const state = doorState(door);
    return clean(door.type) === 'door' && state !== 'open' && state !== 'broken';
  }

  function unlockedClosedDoor(door = {}) {
    return closedDoor(door) && doorState(door) === 'closed' && !door.locked;
  }

  function requestedInBounds(target = {}, mapData = {}) {
    const grid = mapData.grid || {};
    const size = Math.max(1, finite(grid.size, 70));
    const cols = Math.max(1, Math.trunc(finite(grid.cols, 1)));
    const rows = Math.max(1, Math.trunc(finite(grid.rows, 1)));
    if (target.col != null || target.row != null) {
      const col = Number(target.col);
      const row = Number(target.row);
      return Number.isFinite(col) && Number.isFinite(row) && col >= 0 && row >= 0 && col < cols && row < rows;
    }
    const x = Number(target.x);
    const y = Number(target.y);
    return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < cols * size && y < rows * size;
  }

  function rejected(reason) {
    return { valid: false, reason, path: [], cells: [], costFt: Infinity, routeCostFt: Infinity, movementCostFt: Infinity };
  }

  function verticalResumePlan(options = {}) {
    const token = options.token || {};
    if (!token.verticalMovement) return null;
    const mapData = options.mapData || {};
    const start = options.start || { x: token.x, y: token.y };
    const zLayer = pathfinding.tokenLayer(token);
    const cell = token.gridPosition
      ? { col: Number(token.gridPosition.col) || 0, row: Number(token.gridPosition.row) || 0 }
      : pathfinding.cellFromPoint(start, mapData);
    const point = {
      x: finite(start.x, token.x),
      y: finite(start.y, token.y),
      col: cell.col,
      row: cell.row,
      z: zLayer,
      elevationFt: finite(token.elevationFt),
    };
    return {
      valid: true,
      reason: null,
      verticalResume: true,
      path: [point],
      cells: [cell],
      costFt: 0,
      routeCostFt: 0,
      movementCostFt: 0,
      movementType: clean(options.movementType || 'normal') || 'normal',
      mode: clean(options.movementMode || token.movementState?.mode || 'walk') || 'walk',
      remainingFt: Number.isFinite(Number(token.movementRemainingFt)) ? Number(token.movementRemainingFt) : Infinity,
    };
  }

  function movementArgs(options = {}, mapData = options.mapData || {}) {
    const token = options.token || {};
    const state = base.currentMovementState(token);
    return {
      token,
      start: options.start,
      target: options.target,
      mapData,
      zLayer: pathfinding.tokenLayer(token),
      movementMode: options.movementMode || state.mode || 'walk',
      blockTokens: options.blockTokens,
      diagonalRule: options.diagonalRule,
    };
  }

  function rawRoute(options = {}, mapData = options.mapData || {}) {
    const args = movementArgs(options, mapData);
    return pathfinding.findPath(args);
  }

  function stopAtFirstDoor(options = {}, originalPlan = null) {
    const mapData = options.mapData || {};
    const planningMap = rules.mapWithPassableDoors(mapData, closedDoor);
    const candidate = rawRoute(options, planningMap);
    if (!candidate.valid) return originalPlan;
    const crossings = rules.doorCrossings(candidate.path, mapData, pathfinding.tokenLayer(options.token));
    const first = crossings.find((entry) => closedDoor(entry.door));
    if (!first) return originalPlan;
    const partialPath = rules.truncateBeforeDoor(candidate.path, first);
    const endpoint = partialPath[partialPath.length - 1];
    if (!endpoint) return originalPlan;
    const partial = base.planMove({ ...options, target: endpoint, mapData });
    if (!partial.valid) return originalPlan;
    const traversal = rules.doorTraversal({ mode: options.token?.activeActionMovementMode || 'walk', door: first.door, remainingFt: partial.remainingFt });
    return {
      ...partial,
      valid: true,
      complete: false,
      requestedTarget: options.target,
      stopAtDoor: {
        doorId: first.door?.id || null,
        state: doorState(first.door),
        reason: traversal.reason || (doorState(first.door) === 'locked' ? 'DOOR_LOCKED' : 'DOOR_ACTION_REQUIRED'),
        actionRequired: true,
      },
    };
  }

  function dashPlan(options = {}, normalPlan = null) {
    const mapData = options.mapData || {};
    const planningMap = rules.mapWithPassableDoors(mapData, unlockedClosedDoor);
    const throughDoors = base.planMove({ ...options, mapData: planningMap });
    if (throughDoors.valid) {
      const crossings = rules.doorCrossings(throughDoors.path, mapData, pathfinding.tokenLayer(options.token));
      const interactions = crossings
        .filter((entry) => unlockedClosedDoor(entry.door))
        .map((entry) => ({
          type: 'door',
          action: 'open',
          doorId: entry.door?.id || null,
          pathIndex: entry.pathIndex,
          burstOpen: true,
          noise: 'high',
          soundEvent: 'DASH_DOOR_BURST',
          pauseMs: 110,
        }));
      return { ...throughDoors, doorInteractions: interactions, dashThroughDoors: interactions.length > 0 };
    }
    if (throughDoors.reason === 'INSUFFICIENT_MOVEMENT') return throughDoors;
    return stopAtFirstDoor(options, normalPlan || throughDoors);
  }

  function planMove(options = {}) {
    if (!requestedInBounds(options.target, options.mapData || {})) return rejected('OUT_OF_BOUNDS');
    const resumed = verticalResumePlan(options);
    if (resumed) return resumed;

    const normalPlan = base.planMove(options);
    const token = options.token || {};
    const actionMode = clean(token.activeActionMovementMode || (token.movementState?.dashed ? 'dash' : '') || 'walk');
    const movementType = clean(options.movementType || 'normal');
    if (movementType === 'forced' || movementType === 'teleport') return normalPlan;
    if (actionMode === 'dash' || actionMode === 'run') return dashPlan(options, normalPlan);
    if (normalPlan.valid || normalPlan.reason === 'INSUFFICIENT_MOVEMENT') return normalPlan;
    return stopAtFirstDoor(options, normalPlan);
  }

  function describeDoorPlan(plan = {}) {
    return {
      stopAtDoor: plan.stopAtDoor || null,
      doorInteractions: Array.isArray(plan.doorInteractions) ? plan.doorInteractions.map((entry) => ({ ...entry })) : [],
      dashThroughDoors: Boolean(plan.dashThroughDoors),
      movementCostFt: Math.max(0, finite(plan.movementCostFt, 0)),
    };
  }

  root.LuminousVttMovementEngine = Object.freeze({
    ...base,
    __doorAwareMovementPatch: true,
    planMove,
    describeDoorPlan,
    requestedInBounds,
    verticalResumePlan,
  });
})(typeof window !== 'undefined' ? window : globalThis);
