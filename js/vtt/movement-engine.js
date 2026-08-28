(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMovementEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const ROUND_SECONDS = 6;
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim().toLowerCase();

  function pathfindingRuntime() {
    if (root?.LuminousVttPathfinding) return root.LuminousVttPathfinding;
    if (typeof require !== 'undefined') {
      try { return require('./pathfinding.js'); } catch (_) {}
    }
    return null;
  }

  function normalizeWorldState(raw = {}) {
    const mode = clean(raw.mode || raw.worldMode) === 'round' ? 'round' : 'free';
    return {
      schemaVersion: 1,
      mode,
      roundId: Math.max(0, Math.trunc(finite(raw.roundId, 0))),
      roundSeconds: Math.max(1, finite(raw.roundSeconds, ROUND_SECONDS)),
      worldSeconds: Math.max(0, finite(raw.worldSeconds, 0)),
      updatedAt: raw.updatedAt || null,
      updatedByUid: raw.updatedByUid || null,
    };
  }

  function modeSpeedFt(token = {}, mode = 'walk') {
    const movementMode = clean(mode || 'walk') || 'walk';
    const movement = token.movement || {};
    const speed = token.speed || {};
    const candidates = {
      walk: [token.speedFt, movement.walkFt, movement.walk, speed.walk, speed.walking, token.walkSpeedFt],
      climb: [token.climbSpeedFt, movement.climbFt, movement.climb, speed.climb],
      swim: [token.swimSpeedFt, movement.swimFt, movement.swim, speed.swim],
      fly: [token.flySpeedFt, movement.flyFt, movement.fly, speed.fly],
      burrow: [token.burrowSpeedFt, movement.burrowFt, movement.burrow, speed.burrow],
    }[movementMode] || [];
    const direct = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
    if (direct != null) return Number(direct);
    if (movementMode === 'climb' || movementMode === 'swim') return modeSpeedFt(token, 'walk');
    return movementMode === 'walk' ? 30 : 0;
  }

  function hasDedicatedSpeed(token = {}, mode = 'walk') {
    const movementMode = clean(mode || 'walk');
    if (movementMode === 'walk') return true;
    const movement = token.movement || {}, speed = token.speed || {};
    const direct = {
      climb: [token.climbSpeedFt, movement.climbFt, movement.climb, speed.climb],
      swim: [token.swimSpeedFt, movement.swimFt, movement.swim, speed.swim],
      fly: [token.flySpeedFt, movement.flyFt, movement.fly, speed.fly],
      burrow: [token.burrowSpeedFt, movement.burrowFt, movement.burrow, speed.burrow],
    }[movementMode] || [];
    return direct.some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  }

  function modeCostMultiplier(token = {}, mode = 'walk') {
    const movementMode = clean(mode || 'walk');
    if ((movementMode === 'climb' || movementMode === 'swim') && !hasDedicatedSpeed(token, movementMode)) return 2;
    return 1;
  }

  function currentMovementState(token = {}) {
    const raw = token.movementState || {};
    return {
      roundId: Math.max(0, Math.trunc(finite(raw.roundId, 0))),
      speedFt: Math.max(0, finite(raw.speedFt, modeSpeedFt(token, raw.mode || 'walk'))),
      remainingFt: Math.max(0, finite(raw.remainingFt, Number.isFinite(Number(token.movementRemainingFt)) ? Number(token.movementRemainingFt) : 0)),
      mode: clean(raw.mode || 'walk') || 'walk',
      dashed: Boolean(raw.dashed),
      prone: Boolean(raw.prone),
    };
  }

  function setFreeMode(token = {}) {
    const previous = currentMovementState(token);
    token.movementState = { ...previous, remainingFt: Infinity, dashed: false };
    delete token.movementRemainingFt;
    return token.movementState;
  }

  function beginRound(token = {}, roundId = 0, mode = null) {
    const prior = currentMovementState(token);
    const movementMode = clean(mode || prior.mode || 'walk') || 'walk';
    const speedFt = modeSpeedFt(token, movementMode);
    token.movementState = {
      roundId: Math.max(0, Math.trunc(finite(roundId, 0))),
      speedFt,
      remainingFt: speedFt,
      mode: movementMode,
      dashed: false,
      prone: prior.prone,
    };
    token.movementRemainingFt = speedFt;
    return token.movementState;
  }

  function ensureRound(token = {}, worldState = {}, mode = null) {
    const world = normalizeWorldState(worldState);
    if (world.mode !== 'round') return setFreeMode(token);
    const current = currentMovementState(token);
    if (current.roundId !== world.roundId || !Number.isFinite(Number(token.movementRemainingFt))) return beginRound(token, world.roundId, mode || current.mode);
    return current;
  }

  function setMovementMode(token = {}, mode = 'walk', worldState = {}) {
    const nextMode = clean(mode || 'walk') || 'walk';
    if (!['walk', 'climb', 'swim', 'fly', 'burrow'].includes(nextMode)) throw new Error('MOVEMENT_MODE_UNSUPPORTED');
    const world = normalizeWorldState(worldState);
    if (world.mode === 'round') {
      const state = ensureRound(token, world, nextMode);
      state.mode = nextMode;
      state.speedFt = modeSpeedFt(token, nextMode);
      token.movementState = state;
      return state;
    }
    const state = currentMovementState(token);
    state.mode = nextMode;
    state.speedFt = modeSpeedFt(token, nextMode);
    token.movementState = state;
    return state;
  }

  function canSpend(token = {}, costFt = 0, worldState = {}) {
    const world = normalizeWorldState(worldState);
    const cost = Math.max(0, finite(costFt, 0));
    if (world.mode !== 'round') return { valid: true, remainingFt: Infinity, costFt: cost };
    const state = ensureRound(token, world);
    if (state.remainingFt + 1e-9 < cost) return { valid: false, reason: 'INSUFFICIENT_MOVEMENT', remainingFt: state.remainingFt, costFt: cost };
    return { valid: true, remainingFt: state.remainingFt, costFt: cost };
  }

  function spend(token = {}, costFt = 0, worldState = {}) {
    const check = canSpend(token, costFt, worldState);
    if (!check.valid) return check;
    const world = normalizeWorldState(worldState);
    if (world.mode !== 'round') return check;
    const state = ensureRound(token, world);
    state.remainingFt = Math.max(0, state.remainingFt - check.costFt);
    token.movementState = state;
    token.movementRemainingFt = state.remainingFt;
    return { valid: true, costFt: check.costFt, remainingFt: state.remainingFt };
  }

  function dash(token = {}, worldState = {}, options = {}) {
    const world = normalizeWorldState(worldState);
    if (world.mode !== 'round') return { valid: false, reason: 'ROUND_MODE_REQUIRED' };
    const state = ensureRound(token, world);
    if (state.dashed && options.allowMultiple !== true) return { valid: false, reason: 'DASH_ALREADY_USED', remainingFt: state.remainingFt };
    const amount = Math.max(0, modeSpeedFt(token, state.mode));
    state.remainingFt += amount;
    state.dashed = true;
    token.movementState = state;
    token.movementRemainingFt = state.remainingFt;
    return { valid: true, addedFt: amount, remainingFt: state.remainingFt };
  }

  function setProne(token = {}, value = true) {
    const state = currentMovementState(token);
    state.prone = Boolean(value);
    token.movementState = state;
    return state;
  }

  function standUp(token = {}, worldState = {}) {
    const world = normalizeWorldState(worldState);
    const state = world.mode === 'round' ? ensureRound(token, world) : currentMovementState(token);
    if (!state.prone) return { valid: true, costFt: 0, remainingFt: state.remainingFt };
    const costFt = Math.max(0, state.speedFt / 2);
    const result = spend(token, costFt, world);
    if (!result.valid) return result;
    const next = currentMovementState(token);
    next.prone = false;
    token.movementState = next;
    return { valid: true, costFt, remainingFt: result.remainingFt };
  }

  function reconcileVertical(token = {}, worldState = {}) {
    const world = normalizeWorldState(worldState);
    if (world.mode !== 'round') return setFreeMode(token);
    const state = ensureRound(token, world);
    if (Number.isFinite(Number(token.movementRemainingFt))) state.remainingFt = Math.max(0, Number(token.movementRemainingFt));
    token.movementState = state;
    return state;
  }

  function planMove({ token, start, target, mapData = {}, worldState = {}, movementMode = null, movementType = 'normal', blockTokens, diagonalRule } = {}) {
    const pathfinding = pathfindingRuntime();
    if (!pathfinding) return { valid: false, reason: 'PATHFINDING_UNAVAILABLE' };
    const world = normalizeWorldState(worldState);
    const state = world.mode === 'round' ? ensureRound(token, world, movementMode) : currentMovementState(token);
    const mode = clean(movementMode || state.mode || 'walk') || 'walk';
    if (movementType === 'teleport') {
      const targetCell = pathfinding.cellFromPoint(target, mapData);
      const targetPoint = pathfinding.pointForCell(targetCell, mapData, pathfinding.tokenLayer(token));
      const gate = pathfinding.pointPassable(token, targetPoint, mapData, pathfinding.tokenLayer(token), { movementMode: mode, blockTokens });
      return gate.valid ? { valid: true, path: [targetPoint], cells: [targetCell], costFt: 0, movementCostFt: 0, movementType, mode } : { valid: false, reason: gate.reason || 'TARGET_BLOCKED', blocker: gate };
    }
    const route = pathfinding.findPath({ token, start, target, mapData, zLayer: pathfinding.tokenLayer(token), movementMode: mode, blockTokens, diagonalRule });
    if (!route.valid) return route;
    const multiplier = movementType === 'forced' ? 0 : modeCostMultiplier(token, mode);
    const movementCostFt = route.costFt * multiplier;
    const budget = movementType === 'forced' ? { valid: true, remainingFt: state.remainingFt } : canSpend(token, movementCostFt, world);
    if (!budget.valid) return { ...route, valid: false, reason: budget.reason, routeCostFt: route.costFt, movementCostFt, remainingFt: budget.remainingFt };
    return { ...route, valid: true, routeCostFt: route.costFt, movementCostFt, movementType, mode, remainingFt: budget.remainingFt };
  }

  function commitMove(token = {}, plan = {}, worldState = {}) {
    if (!plan?.valid) return { valid: false, reason: plan?.reason || 'INVALID_PLAN' };
    if (plan.movementType !== 'forced' && plan.movementType !== 'teleport') {
      const spent = spend(token, plan.movementCostFt, worldState);
      if (!spent.valid) return spent;
    }
    token.lastMovementPath = Array.isArray(plan.path) ? plan.path.map((point) => ({ x: point.x, y: point.y, col: point.col, row: point.row, z: point.z })) : [];
    token.lastMovementCostFt = Math.max(0, finite(plan.movementCostFt, 0));
    token.lastMovementType = plan.movementType || 'normal';
    return { valid: true, path: token.lastMovementPath, costFt: token.lastMovementCostFt, remainingFt: Number.isFinite(Number(token.movementRemainingFt)) ? Number(token.movementRemainingFt) : Infinity };
  }

  function distanceAlongPath(path = [], maxCostFt = Infinity, mapData = {}, options = {}) {
    const pathfinding = pathfindingRuntime();
    if (!pathfinding || !Array.isArray(path) || !path.length) return { path: [], costFt: 0, complete: true };
    if (!Number.isFinite(Number(maxCostFt))) return { path: [...path], costFt: pathfinding.pathCostFt(path, mapData, options.zLayer || 0, options), complete: true };
    const result = [path[0]];
    let cost = 0;
    for (let i = 1; i < path.length; i += 1) {
      const step = pathfinding.pathCostFt([path[i - 1], path[i]], mapData, options.zLayer || 0, options);
      if (cost + step > Number(maxCostFt) + 1e-9) return { path: result, costFt: cost, complete: false };
      cost += step;
      result.push(path[i]);
    }
    return { path: result, costFt: cost, complete: true };
  }

  return Object.freeze({
    ROUND_SECONDS, normalizeWorldState, modeSpeedFt, hasDedicatedSpeed, modeCostMultiplier, currentMovementState,
    setFreeMode, beginRound, ensureRound, setMovementMode, canSpend, spend, dash, setProne, standUp,
    reconcileVertical, planMove, commitMove, distanceAlongPath,
  });
});