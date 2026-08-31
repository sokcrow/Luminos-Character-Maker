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
  });
})(typeof window !== 'undefined' ? window : globalThis);
