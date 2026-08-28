(function (root) {
  'use strict';

  const interactionBase = root && root.LuminousVttTokenInteraction;
  const pathfindingBase = root && root.LuminousVttPathfinding;
  const movementBase = root && root.LuminousVttMovementEngine;
  const tokenStateBase = root && root.LuminousVttTokenState;
  if (!pathfindingBase || !movementBase) return;

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim().toLowerCase();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const MIN_TERRAIN_MULTIPLIER = 0.05;

  function installOptimalPathfinding(base) {
    if (base.__cheapTerrainHeuristicPatch) return base;

    function admissibleHeuristicFt(a, b, mapData = {}, options = {}) {
      return base.heuristicFt(a, b, mapData, options) * MIN_TERRAIN_MULTIPLIER;
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
      return cells.map((cell) => base.pointForCell(cell, mapData, zLayer));
    }

    function findPath({ token, start, target, mapData = {}, zLayer = base.tokenLayer(token), movementMode = 'walk', blockTokens, diagonalRule: rule, maxVisited = 20000 } = {}) {
      if (!token || !mapData.grid || !start || !target) return { valid: false, reason: 'INVALID_INPUT', path: [], costFt: Infinity };
      const startCell = start.col != null && start.row != null
        ? { col: Math.trunc(Number(start.col)), row: Math.trunc(Number(start.row)) }
        : base.cellFromPoint(start, mapData);
      const targetCell = target.col != null && target.row != null
        ? { col: Math.trunc(Number(target.col)), row: Math.trunc(Number(target.row)) }
        : base.cellFromPoint(target, mapData);
      const options = { movementMode, blockTokens, diagonalRule: rule };
      const targetPoint = base.pointForCell(targetCell, mapData, zLayer);
      const targetGate = base.pointPassable(token, targetPoint, mapData, zLayer, options);
      if (!targetGate.valid) return { valid: false, reason: targetGate.reason || 'TARGET_BLOCKED', path: [], costFt: Infinity, blocker: targetGate };

      const startKey = base.cellKey(startCell.col, startCell.row);
      const goalKey = base.cellKey(targetCell.col, targetCell.row);
      if (startKey === goalKey) {
        return { valid: true, reason: null, path: [base.pointForCell(startCell, mapData, zLayer)], cells: [startCell], costFt: 0, visited: 0 };
      }

      const open = new Set([startKey]);
      const nodes = new Map([[startKey, startCell]]);
      const cameFrom = new Map();
      const g = new Map([[startKey, 0]]);
      const f = new Map([[startKey, admissibleHeuristicFt(startCell, targetCell, mapData, options)]]);
      let visited = 0;
      const limit = Math.max(1, Math.trunc(finite(maxVisited, 20000)));

      while (open.size && visited < limit) {
        let currentKey = null;
        let currentScore = Infinity;
        for (const key of open) {
          const score = f.get(key) ?? Infinity;
          if (score < currentScore) {
            currentScore = score;
            currentKey = key;
          }
        }
        if (!currentKey) break;
        const current = nodes.get(currentKey);
        if (currentKey === goalKey) {
          const path = reconstruct(cameFrom, nodes, currentKey, mapData, zLayer);
          return {
            valid: true,
            reason: null,
            path,
            cells: path.map((point) => ({ col: point.col, row: point.row })),
            costFt: g.get(currentKey) || 0,
            visited,
          };
        }

        open.delete(currentKey);
        visited += 1;
        for (const next of base.neighbors(current, mapData)) {
          const edge = base.edgePassable(token, current, next, mapData, zLayer, options);
          if (!edge.valid) continue;
          const nextKey = base.cellKey(next.col, next.row);
          const tentative = (g.get(currentKey) ?? Infinity) + base.stepCostFt(current, next, mapData, zLayer, options);
          if (tentative + 1e-9 >= (g.get(nextKey) ?? Infinity)) continue;
          cameFrom.set(nextKey, currentKey);
          nodes.set(nextKey, next);
          g.set(nextKey, tentative);
          f.set(nextKey, tentative + admissibleHeuristicFt(next, targetCell, mapData, options));
          open.add(nextKey);
        }
      }

      return { valid: false, reason: visited >= limit ? 'SEARCH_LIMIT' : 'NO_PATH', path: [], cells: [], costFt: Infinity, visited };
    }

    const patched = Object.freeze({
      ...base,
      __cheapTerrainHeuristicPatch: true,
      MIN_TERRAIN_MULTIPLIER,
      heuristicFt: admissibleHeuristicFt,
      findPath,
    });
    root.LuminousVttPathfinding = patched;
    return patched;
  }

  function movementSnapshot(token = {}) {
    const raw = token.movementState;
    if (!raw || typeof raw !== 'object') return { state: null, remainingFt: null };
    const remaining = Number.isFinite(Number(token.movementRemainingFt))
      ? Number(token.movementRemainingFt)
      : (Number.isFinite(Number(raw.remainingFt)) ? Number(raw.remainingFt) : null);
    const state = {
      roundId: Math.max(0, Math.trunc(finite(raw.roundId, 0))),
      speedFt: Math.max(0, finite(raw.speedFt, 0)),
      mode: clean(raw.mode || 'walk') || 'walk',
      dashed: Boolean(raw.dashed),
      prone: Boolean(raw.prone),
    };
    if (remaining != null) state.remainingFt = Math.max(0, remaining);
    return { state, remainingFt: remaining == null ? null : Math.max(0, remaining) };
  }

  function applyMovementSnapshot(token, position = {}) {
    if (!token || !position || typeof position !== 'object') return token;
    const raw = position.movementState;
    const positionRemaining = Number.isFinite(Number(position.movementRemainingFt)) ? Number(position.movementRemainingFt) : null;
    if (raw && typeof raw === 'object') {
      const remaining = positionRemaining != null
        ? positionRemaining
        : (Number.isFinite(Number(raw.remainingFt)) ? Number(raw.remainingFt) : null);
      token.movementState = {
        ...clone(raw),
        roundId: Math.max(0, Math.trunc(finite(raw.roundId, 0))),
        speedFt: Math.max(0, finite(raw.speedFt, 0)),
        mode: clean(raw.mode || 'walk') || 'walk',
        dashed: Boolean(raw.dashed),
        prone: Boolean(raw.prone),
      };
      if (remaining != null) token.movementState.remainingFt = Math.max(0, remaining);
      else delete token.movementState.remainingFt;
    }
    if (positionRemaining != null) token.movementRemainingFt = Math.max(0, positionRemaining);
    else if (Number.isFinite(Number(token.movementState?.remainingFt))) token.movementRemainingFt = Math.max(0, Number(token.movementState.remainingFt));
    return token;
  }

  function installTokenMovementPersistence(base) {
    if (!base || base.__movementBudgetPersistencePatch) return base;
    const createBridgeBase = base.createBridge;

    function createBridge(options = {}) {
      const bridge = createBridgeBase(options);
      const mapData = options.mapData;
      const firebase = base.hostFirebase?.(root);
      const db = firebase?.database?.() || null;
      const playersPath = base.PLAYER_ROOT;
      const worldPath = `${base.WORLD_ROOT}/${bridge.mapId}`;
      let extraStarted = false;
      let playerHandler = null;
      let worldHandler = null;

      function applyPlayerRecords(rawPlayers = {}) {
        Object.entries(rawPlayers || {}).forEach(([playerKey, playerData]) => {
          const record = playerData?.vttTokenState?.[bridge.mapId];
          if (!record?.position) return;
          const recordPlayerId = String(record.playerId || playerKey);
          const token = (mapData.tokens || []).find((entry) => {
            if (entry.canonicalScope === 'player') {
              return String(entry.canonicalPlayerKey || '') === String(playerKey)
                || String(entry.playerId || '') === recordPlayerId;
            }
            return String(bridge.identity?.playerId || '') === recordPlayerId
              && (entry.viewer === true || entry.characterLink?.mode === 'current_player');
          });
          if (token) applyMovementSnapshot(token, record.position);
        });
      }

      function applyWorldRecords(rawWorld = {}) {
        Object.entries(rawWorld || {}).forEach(([key, record]) => {
          if (!record?.position) return;
          const tokenId = String(record.tokenId || key);
          const token = (mapData.tokens || []).find((entry) => String(entry.id) === tokenId);
          if (token) applyMovementSnapshot(token, record.position);
        });
      }

      function start() {
        const result = bridge.start();
        if (extraStarted || !db) return result;
        extraStarted = true;
        playerHandler = (snapshot) => {
          const raw = snapshot.val() || {};
          applyPlayerRecords(raw);
          Promise.resolve().then(() => applyPlayerRecords(raw));
        };
        worldHandler = (snapshot) => {
          const raw = snapshot.val() || {};
          applyWorldRecords(raw);
          Promise.resolve().then(() => applyWorldRecords(raw));
        };
        db.ref(playersPath).on('value', playerHandler);
        db.ref(worldPath).on('value', worldHandler);
        return result;
      }

      function stop() {
        if (db && playerHandler) db.ref(playersPath).off('value', playerHandler);
        if (db && worldHandler) db.ref(worldPath).off('value', worldHandler);
        playerHandler = null;
        worldHandler = null;
        extraStarted = false;
        bridge.stop();
      }

      async function persistMovement(token, result) {
        const snapshot = movementSnapshot(token);
        if (!db || !result?.scope || !result?.key) return snapshot;
        const updates = {
          'position/movementState': snapshot.state,
          'position/movementRemainingFt': snapshot.remainingFt,
        };
        if (result.scope === 'player') {
          await db.ref(`${base.PLAYER_ROOT}/${base.firebaseKey(result.key, 'player')}/vttTokenState/${bridge.mapId}`).update(updates);
        } else if (result.scope === 'world') {
          await db.ref(worldPath).child(base.firebaseKey(result.key)).update(updates);
        }
        return snapshot;
      }

      async function saveToken(token) {
        const result = await bridge.saveToken(token);
        await persistMovement(token, result);
        return { ...result, movement: movementSnapshot(token) };
      }

      async function createWorldToken(token) {
        if (typeof bridge.createWorldToken !== 'function') return saveToken(token);
        const result = await bridge.createWorldToken(token);
        await persistMovement(token, result);
        return { ...result, movement: movementSnapshot(token) };
      }

      return Object.freeze({
        ...bridge,
        start,
        stop,
        saveToken,
        createWorldToken,
        applyPlayerMovementRecords: applyPlayerRecords,
        applyWorldMovementRecords: applyWorldRecords,
      });
    }

    const patched = Object.freeze({
      ...base,
      __movementBudgetPersistencePatch: true,
      movementSnapshot,
      applyMovementSnapshot,
      createBridge,
    });
    root.LuminousVttTokenState = patched;
    return patched;
  }

  function persistRuntimeToken(token) {
    const bridge = root?.LuminousVttRuntime?.tokenStateBridge;
    if (!token || typeof bridge?.saveToken !== 'function') return;
    Promise.resolve(bridge.saveToken(token)).catch((error) => console.error('VTT movement-state persistence failed:', error));
  }

  function installMovementHardening(base) {
    if (base.__movementModeHardeningPatch) return base;

    function setMovementMode(token = {}, mode = 'walk', worldState = {}) {
      const nextMode = clean(mode || 'walk') || 'walk';
      if (!['walk', 'climb', 'swim', 'fly', 'burrow'].includes(nextMode)) throw new Error('MOVEMENT_MODE_UNSUPPORTED');
      const nextSpeed = base.modeSpeedFt(token, nextMode);
      if (nextSpeed <= 0) throw new Error('MOVEMENT_MODE_UNAVAILABLE');
      const world = base.normalizeWorldState(worldState);
      if (world.mode === 'round') {
        const state = base.ensureRound(token, world);
        const oldCapacity = Math.max(0, finite(state.speedFt, 0)) * (state.dashed ? 2 : 1);
        const spentFt = Math.max(0, oldCapacity - Math.max(0, finite(state.remainingFt, 0)));
        const nextCapacity = nextSpeed * (state.dashed ? 2 : 1);
        state.mode = nextMode;
        state.speedFt = nextSpeed;
        state.remainingFt = Math.max(0, nextCapacity - spentFt);
        token.movementState = state;
        token.movementRemainingFt = state.remainingFt;
        persistRuntimeToken(token);
        return state;
      }
      const state = base.currentMovementState(token);
      state.mode = nextMode;
      state.speedFt = nextSpeed;
      token.movementState = state;
      persistRuntimeToken(token);
      return state;
    }

    function planMove(options = {}) {
      const token = options.token || {};
      const state = base.currentMovementState(token);
      const mode = clean(options.movementMode || state.mode || 'walk') || 'walk';
      const movementType = clean(options.movementType || 'normal') || 'normal';
      if (movementType !== 'forced' && movementType !== 'teleport' && base.modeSpeedFt(token, mode) <= 0) {
        return { valid: false, reason: 'MOVEMENT_MODE_UNAVAILABLE', path: [], cells: [], costFt: Infinity, movementCostFt: Infinity, mode, movementType };
      }
      return base.planMove(options);
    }

    function dash(token = {}, worldState = {}, options = {}) {
      const world = base.normalizeWorldState(worldState);
      if (world.mode !== 'round') return base.dash(token, worldState, options);
      const state = base.ensureRound(token, world);
      if (base.modeSpeedFt(token, state.mode) <= 0) return { valid: false, reason: 'MOVEMENT_MODE_UNAVAILABLE', remainingFt: state.remainingFt };
      const result = base.dash(token, worldState, options);
      if (result.valid) persistRuntimeToken(token);
      return result;
    }

    function spend(token = {}, costFt = 0, worldState = {}) {
      const result = base.spend(token, costFt, worldState);
      if (result.valid && base.normalizeWorldState(worldState).mode === 'round') persistRuntimeToken(token);
      return result;
    }

    function setProne(token = {}, value = true) {
      const result = base.setProne(token, value);
      persistRuntimeToken(token);
      return result;
    }

    function standUp(token = {}, worldState = {}) {
      const result = base.standUp(token, worldState);
      if (result.valid) persistRuntimeToken(token);
      return result;
    }

    function reconcileVertical(token = {}, worldState = {}) {
      const result = base.reconcileVertical(token, worldState);
      if (base.normalizeWorldState(worldState).mode === 'round') persistRuntimeToken(token);
      return result;
    }

    const patched = Object.freeze({
      ...base,
      __movementModeHardeningPatch: true,
      setMovementMode,
      planMove,
      dash,
      spend,
      setProne,
      standUp,
      reconcileVertical,
    });
    root.LuminousVttMovementEngine = patched;
    return patched;
  }

  const pathfinding = installOptimalPathfinding(pathfindingBase);
  installTokenMovementPersistence(tokenStateBase);
  const movement = installMovementHardening(movementBase);

  if (!interactionBase || interactionBase.__pathfindingMovementPatch) return;

  const worldState = (mapData = {}) => movement.normalizeWorldState((mapData.movement && mapData.movement.worldState) || {});

  function requestedInBounds(point, mapData = {}) {
    const bounds = pathfinding.gridBounds(mapData);
    const x = finite(point && point.x, NaN);
    const y = finite(point && point.y, NaN);
    return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
  }

  function resolveDrop(token, from, requestedPoint, mapData = {}) {
    if (!token || !mapData.grid || !requestedInBounds(requestedPoint, mapData)) return { valid: false, reason: 'OUT_OF_BOUNDS' };
    if (token.verticalMovement) return interactionBase.resolveDrop(token, from, requestedPoint, mapData);

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

    const committed = movementBase.commitMove(token, plan, worldState(mapData));
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
    ...interactionBase,
    __pathfindingMovementPatch: true,
    baseResolveDrop: interactionBase.resolveDrop,
    resolveDrop,
  });
})(typeof window !== 'undefined' ? window : globalThis);