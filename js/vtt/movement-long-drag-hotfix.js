const EPS = 1e-7;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '').trim();

function tokenLayer(token = {}) {
  if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
  if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
  if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
  return 0;
}

function bucketKey(col, row) {
  return `${Math.trunc(finite(col))}_${Math.trunc(finite(row))}`;
}

function addToBuckets(buckets, item, bounds, grid) {
  const size = Math.max(1, finite(grid?.size, 70));
  const cols = Math.max(1, Math.trunc(finite(grid?.cols, 1)));
  const rows = Math.max(1, Math.trunc(finite(grid?.rows, 1)));
  const minCol = Math.max(0, Math.min(cols - 1, Math.floor(finite(bounds.minX) / size)));
  const maxCol = Math.max(0, Math.min(cols - 1, Math.floor(finite(bounds.maxX) / size)));
  const minRow = Math.max(0, Math.min(rows - 1, Math.floor(finite(bounds.minY) / size)));
  const maxRow = Math.max(0, Math.min(rows - 1, Math.floor(finite(bounds.maxY) / size)));
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const key = bucketKey(col, row);
      const list = buckets.get(key) || [];
      list.push(item);
      buckets.set(key, list);
    }
  }
}

function pointSegmentDistance(point, wall) {
  const px = finite(point?.x);
  const py = finite(point?.y);
  const ax = finite(wall?.x1);
  const ay = finite(wall?.y1);
  const bx = finite(wall?.x2);
  const by = finite(wall?.y2);
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = (abx * abx) + (aby * aby);
  if (lengthSq <= EPS) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, (((px - ax) * abx) + ((py - ay) * aby)) / lengthSq));
  return Math.hypot(px - (ax + (abx * t)), py - (ay + (aby * t)));
}

function circleIntersectsRect(point, radius, rect) {
  const x = Math.max(finite(rect?.x), Math.min(finite(point?.x), finite(rect?.x) + finite(rect?.width)));
  const y = Math.max(finite(rect?.y), Math.min(finite(point?.y), finite(rect?.y) + finite(rect?.height)));
  return Math.hypot(finite(point?.x) - x, finite(point?.y) - y) < Math.max(0, finite(radius));
}

export function installLongDragHotfix(host = globalThis) {
  if (host?.LuminousVttLongDragHotfix?.__v1) return host.LuminousVttLongDragHotfix;

  let stopped = false;
  let interactionBase = null;
  let interactionPatched = null;
  let pathfindingBase = null;
  let pathfindingPatched = null;
  let activeCollision = null;
  let lastDragCellKey = '';
  let dragHud = null;

  const metrics = {
    dragMouseMoves: 0,
    dragCellUpdates: 0,
    suppressedMouseMoves: 0,
    pathCalls: 0,
    alignedDirectPaths: 0,
    collisionContexts: 0,
    collisionBuildTotalMs: 0,
    collisionBuildMaxMs: 0,
    wallCandidates: 0,
    objectCandidates: 0,
  };

  function liveRuntime() {
    return host?.LuminousVttRuntime || null;
  }

  function ensureHud() {
    if (dragHud?.isConnected) return dragHud;
    const doc = host?.document;
    if (!doc?.body) return null;
    const node = doc.createElement('div');
    node.id = 'vtt-fast-drag-hud';
    node.hidden = true;
    node.style.cssText = 'position:fixed;z-index:36050;pointer-events:none;padding:4px 7px;border:1px solid #fff;background:#090909;color:#fff;font:700 11px monospace;box-shadow:2px 2px 0 #000;transform:translate(12px,12px);will-change:left,top;';
    doc.body.appendChild(node);
    dragHud = node;
    return node;
  }

  function hideHud() {
    if (dragHud) dragHud.hidden = true;
  }

  function cheapDistanceFt(engine, drag, targetCell) {
    const pathfinding = host?.LuminousVttPathfinding;
    if (!pathfinding?.cellFromPoint) return 0;
    const mapData = engine.mapData || {};
    const startCell = pathfinding.cellFromPoint({ x: drag.originX, y: drag.originY }, mapData);
    const dx = Math.abs(finite(targetCell?.col) - finite(startCell?.col));
    const dy = Math.abs(finite(targetCell?.row) - finite(startCell?.row));
    const feet = Math.max(0.001, finite(mapData.grid?.distancePerCell, 5));
    const diagonal = clean(mapData.movement?.diagonalRule).toLowerCase();
    return ['euclidean', 'sqrt2', 'real'].includes(diagonal)
      ? Math.hypot(dx, dy) * feet
      : Math.max(dx, dy) * feet;
  }

  function updateCheapHud(engine, drag, event, cell) {
    const hud = ensureHud();
    if (!hud) return;
    const distance = cheapDistanceFt(engine, drag, cell);
    hud.textContent = `${Math.round(distance)} ft`;
    hud.style.left = `${Math.round(finite(event?.clientX))}px`;
    hud.style.top = `${Math.round(finite(event?.clientY))}px`;
    hud.hidden = false;
  }

  function buildCollisionContext(token, mapData, base) {
    const startedAt = host?.performance?.now?.() ?? Date.now();
    const grid = mapData?.grid || {};
    const layer = tokenLayer(token);
    const radius = Math.max(4, finite(base?.tokenRadius?.(token, grid), finite(grid.size, 70) * 0.4));
    const walls = typeof base?.movementWalls === 'function' ? base.movementWalls(mapData, token) : [];
    const wallBuckets = new Map();

    for (const wall of walls || []) {
      const extra = radius + (Math.max(0, finite(wall?.thicknessPx)) / 2);
      addToBuckets(wallBuckets, wall, {
        minX: Math.min(finite(wall?.x1), finite(wall?.x2)) - extra,
        maxX: Math.max(finite(wall?.x1), finite(wall?.x2)) + extra,
        minY: Math.min(finite(wall?.y1), finite(wall?.y2)) - extra,
        maxY: Math.max(finite(wall?.y1), finite(wall?.y2)) + extra,
      }, grid);
    }

    const objectBuckets = new Map();
    const core = host?.LuminousVttWorldObjectCore;
    const definitions = {
      ...(host?.LuminousVttWorldObjectCatalog?.byId || {}),
      ...(mapData?.worldObjectDefinitions || {}),
    };
    if (core) {
      for (const instance of mapData?.worldObjects || []) {
        if (finite(instance?.position?.zLayer) !== layer) continue;
        const definition = core.resolveDefinition?.(instance, definitions) || null;
        if (!definition || core.blocksMovement?.(instance, definition) === false) continue;
        const rect = core.footprintRect?.(instance, definition, grid);
        if (!rect) continue;
        const blocker = { instance, definition, rect };
        addToBuckets(objectBuckets, blocker, {
          minX: finite(rect.x) - radius,
          maxX: finite(rect.x) + finite(rect.width) + radius,
          minY: finite(rect.y) - radius,
          maxY: finite(rect.y) + finite(rect.height) + radius,
        }, grid);
      }
    }

    const elapsed = Math.max(0, (host?.performance?.now?.() ?? Date.now()) - startedAt);
    metrics.collisionContexts += 1;
    metrics.collisionBuildTotalMs += elapsed;
    metrics.collisionBuildMaxMs = Math.max(metrics.collisionBuildMaxMs, elapsed);
    return { mapData, tokenId: clean(token?.id), layer, radius, walls, wallBuckets, objectBuckets };
  }

  function contextFor(token, mapData) {
    if (!activeCollision || activeCollision.mapData !== mapData) return null;
    if (activeCollision.tokenId && clean(token?.id) !== activeCollision.tokenId) return null;
    if (tokenLayer(token) !== activeCollision.layer) return null;
    return activeCollision;
  }

  function optimizedCanOccupy(base, token, point, mapData = {}) {
    const ctx = contextFor(token, mapData);
    if (!ctx) return base.canOccupy(token, point, mapData);
    const bounds = base.gridBounds?.(mapData.grid || {}) || { width: 0, height: 0 };
    const x = finite(point?.x, NaN);
    const y = finite(point?.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { valid: false, reason: 'INVALID_INPUT' };
    if (x - ctx.radius < 0 || y - ctx.radius < 0 || x + ctx.radius > finite(bounds.width) || y + ctx.radius > finite(bounds.height)) {
      return { valid: false, reason: 'OUT_OF_BOUNDS' };
    }

    const size = Math.max(1, finite(mapData.grid?.size, 70));
    const key = bucketKey(Math.floor(x / size), Math.floor(y / size));
    const nearbyWalls = ctx.wallBuckets.get(key) || [];
    metrics.wallCandidates += nearbyWalls.length;
    for (const wall of nearbyWalls) {
      const extra = Math.max(0, finite(wall?.thicknessPx)) / 2;
      if (pointSegmentDistance({ x, y }, wall) < ctx.radius + extra) {
        return { valid: false, reason: 'BLOCKED_BY_WALL', wall };
      }
    }

    const nearbyObjects = ctx.objectBuckets.get(key) || [];
    metrics.objectCandidates += nearbyObjects.length;
    for (const blocker of nearbyObjects) {
      if (circleIntersectsRect({ x, y }, ctx.radius, blocker.rect)) {
        return {
          valid: false,
          reason: 'BLOCKED_BY_WORLD_OBJECT',
          worldObject: blocker.instance,
          definition: blocker.definition,
        };
      }
    }
    return { valid: true, reason: null };
  }

  function optimizedIsPathClear(base, token, from, to, mapData = {}) {
    const ctx = contextFor(token, mapData);
    if (!ctx) return base.isPathClear(token, from, to, mapData);
    const grid = mapData.grid || {};
    const dx = finite(to?.x) - finite(from?.x);
    const dy = finite(to?.y) - finite(from?.y);
    const distance = Math.hypot(dx, dy);
    const sampleStep = Math.max(4, Math.min(ctx.radius * 0.5, finite(grid.size, 70) * 0.2));
    const steps = Math.max(1, Math.ceil(distance / sampleStep));
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const point = { x: finite(from?.x) + (dx * t), y: finite(from?.y) + (dy * t) };
      const gate = optimizedCanOccupy(base, token, point, mapData);
      if (!gate.valid) return gate;
    }
    return { valid: true, reason: null };
  }

  function ensureInteraction() {
    const current = host?.LuminousVttTokenInteraction;
    if (!current) return null;
    if (current === interactionPatched) return interactionPatched;
    if (current.__longDragCollisionBroadphaseV1 && current.__longDragCollisionBase) {
      interactionBase = current.__longDragCollisionBase;
      interactionPatched = current;
      return current;
    }

    interactionBase = current;
    const patched = Object.freeze({
      ...current,
      __longDragCollisionBroadphaseV1: true,
      __longDragCollisionBase: current,
      canOccupy(token, point, mapData = {}) {
        return optimizedCanOccupy(current, token, point, mapData);
      },
      isPathClear(token, from, to, mapData = {}) {
        return optimizedIsPathClear(current, token, from, to, mapData);
      },
    });
    host.LuminousVttTokenInteraction = patched;
    interactionPatched = patched;
    return patched;
  }

  function alignedDirectRoute(base, options = {}) {
    const { token, start, target, mapData = {} } = options;
    if (!token || !start || !target || !mapData.grid) return null;
    const zLayer = Number.isFinite(Number(options.zLayer)) ? Number(options.zLayer) : base.tokenLayer(token);
    const startCell = start.col != null && start.row != null
      ? { col: Math.trunc(Number(start.col)), row: Math.trunc(Number(start.row)) }
      : base.cellFromPoint(start, mapData);
    const targetCell = target.col != null && target.row != null
      ? { col: Math.trunc(Number(target.col)), row: Math.trunc(Number(target.row)) }
      : base.cellFromPoint(target, mapData);
    const dc = targetCell.col - startCell.col;
    const dr = targetCell.row - startCell.row;
    if (!(dc === 0 || dr === 0 || Math.abs(dc) === Math.abs(dr))) return null;

    const passOptions = {
      movementMode: options.movementMode || 'walk',
      blockTokens: options.blockTokens,
      diagonalRule: options.diagonalRule,
    };
    const targetPoint = base.pointForCell(targetCell, mapData, zLayer);
    const targetGate = base.pointPassable(token, targetPoint, mapData, zLayer, passOptions);
    if (!targetGate.valid) return null;

    const stepCol = Math.sign(dc);
    const stepRow = Math.sign(dr);
    const steps = Math.max(Math.abs(dc), Math.abs(dr));
    const cells = [{ ...startCell }];
    let current = { ...startCell };
    let costFt = 0;
    for (let index = 0; index < steps; index += 1) {
      const next = { col: current.col + stepCol, row: current.row + stepRow };
      const edge = base.edgePassable(token, current, next, mapData, zLayer, passOptions);
      if (!edge.valid) return null;
      costFt += base.stepCostFt(current, next, mapData, zLayer, passOptions);
      cells.push(next);
      current = next;
    }
    return {
      valid: true,
      reason: null,
      path: cells.map((cell) => base.pointForCell(cell, mapData, zLayer)),
      cells,
      costFt,
      visited: 0,
      fastPath: 'aligned-broadphase',
    };
  }

  function ensurePathfinding() {
    const current = host?.LuminousVttPathfinding;
    if (!current?.findPath) return null;
    if (current === pathfindingPatched) return current;
    if (current.__longDragPathfindingV1 && current.__longDragPathfindingBase) {
      pathfindingBase = current.__longDragPathfindingBase;
      pathfindingPatched = current;
      return current;
    }

    pathfindingBase = current;
    const patched = Object.freeze({
      ...current,
      __longDragPathfindingV1: true,
      __longDragPathfindingBase: current,
      findPath(options = {}) {
        metrics.pathCalls += 1;
        const interaction = ensureInteraction();
        const token = options.token;
        const mapData = options.mapData || {};
        if (!interaction || !token || !mapData.grid) return current.findPath(options);
        const previousContext = activeCollision;
        activeCollision = buildCollisionContext(token, mapData, interaction.__longDragCollisionBase || interactionBase || interaction);
        try {
          const direct = alignedDirectRoute(current, options);
          if (direct) {
            metrics.alignedDirectPaths += 1;
            return direct;
          }
          return current.findPath(options);
        } finally {
          activeCollision = previousContext;
        }
      },
    });
    host.LuminousVttPathfinding = patched;
    pathfindingPatched = patched;
    return patched;
  }

  function ensureOptimizers() {
    ensureInteraction();
    ensurePathfinding();
  }

  function dragCell(engine, drag, event) {
    const pathfinding = host?.LuminousVttPathfinding;
    if (!pathfinding?.cellFromPoint || typeof engine?.eventWorldPoint !== 'function') return null;
    const world = engine.eventWorldPoint(event);
    const target = {
      x: finite(world?.x) - finite(drag?.grabOffsetX),
      y: finite(world?.y) - finite(drag?.grabOffsetY),
    };
    const cell = pathfinding.cellFromPoint(target, engine.mapData || {});
    return { cell, target };
  }

  function onMouseDownCapture() {
    lastDragCellKey = '';
    ensureOptimizers();
  }

  function onMouseMoveCapture(event) {
    const engine = liveRuntime()?.engine;
    const drag = engine?.tokenDrag;
    if (!engine || !drag?.token) return;
    metrics.dragMouseMoves += 1;
    ensureOptimizers();
    const resolved = dragCell(engine, drag, event);
    if (!resolved?.cell) return;
    const key = [clean(drag.token.id), finite(drag.originX), finite(drag.originY), resolved.cell.col, resolved.cell.row].join(':');
    if (key !== lastDragCellKey) {
      lastDragCellKey = key;
      metrics.dragCellUpdates += 1;
      updateCheapHud(engine, drag, event, resolved.cell);
      // Run the canonical engine preview exactly once for the new cell. The original
      // window mousemove listener and movement-bootstrap planner are blocked below.
      engine.handleTokenMouseMove?.(event);
    } else {
      metrics.suppressedMouseMoves += 1;
    }
    // The expensive legacy movement-bootstrap mousemove listener performs a full
    // planMove from the drag origin on every preview update. Do not let it run.
    event.stopImmediatePropagation?.();
  }

  function onMouseUpCapture() {
    ensureOptimizers();
    lastDragCellKey = '';
    hideHud();
  }

  function onBlur() {
    lastDragCellKey = '';
    hideHud();
  }

  host?.addEventListener?.('mousedown', onMouseDownCapture, true);
  host?.addEventListener?.('mousemove', onMouseMoveCapture, true);
  host?.addEventListener?.('mouseup', onMouseUpCapture, true);
  host?.addEventListener?.('blur', onBlur, true);

  // Prime the wrappers after the initial modules settle. Every drag also refreshes
  // them because world-object/pathfinding patches can replace the frozen runtimes.
  const prime = () => { if (!stopped) ensureOptimizers(); };
  host?.setTimeout?.(prime, 0);
  host?.setTimeout?.(prime, 250);
  host?.setTimeout?.(prime, 1000);

  const api = Object.freeze({
    __v1: true,
    ensure: ensureOptimizers,
    snapshot() {
      return Object.freeze({
        ...metrics,
        avgCollisionBuildMs: metrics.collisionContexts
          ? metrics.collisionBuildTotalMs / metrics.collisionContexts
          : 0,
        dragActive: Boolean(liveRuntime()?.engine?.tokenDrag),
        pathfindingInstalled: host?.LuminousVttPathfinding?.__longDragPathfindingV1 === true,
        collisionBroadphaseInstalled: host?.LuminousVttTokenInteraction?.__longDragCollisionBroadphaseV1 === true,
      });
    },
    stop() {
      if (stopped) return false;
      stopped = true;
      host?.removeEventListener?.('mousedown', onMouseDownCapture, true);
      host?.removeEventListener?.('mousemove', onMouseMoveCapture, true);
      host?.removeEventListener?.('mouseup', onMouseUpCapture, true);
      host?.removeEventListener?.('blur', onBlur, true);
      hideHud();
      dragHud?.remove?.();
      dragHud = null;
      if (host.LuminousVttPathfinding === pathfindingPatched && pathfindingBase) host.LuminousVttPathfinding = pathfindingBase;
      if (host.LuminousVttTokenInteraction === interactionPatched && interactionBase) host.LuminousVttTokenInteraction = interactionBase;
      if (host.LuminousVttLongDragHotfix === api) delete host.LuminousVttLongDragHotfix;
      return true;
    },
  });

  host.LuminousVttLongDragHotfix = api;
  return api;
}

if (typeof window !== 'undefined') installLongDragHotfix(window);
