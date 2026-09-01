const EPS = 1e-7;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '').trim();

function layerOf(token = {}) {
  if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
  if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
  if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
  return 0;
}

function bucketKey(col, row) {
  return `${Math.trunc(finite(col))}_${Math.trunc(finite(row))}`;
}

function addBucketRange(buckets, item, bounds, grid = {}) {
  const size = Math.max(1, finite(grid.size, 70));
  const cols = Math.max(1, Math.trunc(finite(grid.cols, 1)));
  const rows = Math.max(1, Math.trunc(finite(grid.rows, 1)));
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

function pointSegmentDistance(point = {}, segment = {}) {
  const px = finite(point.x);
  const py = finite(point.y);
  const ax = finite(segment.x1);
  const ay = finite(segment.y1);
  const bx = finite(segment.x2);
  const by = finite(segment.y2);
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = (abx * abx) + (aby * aby);
  if (lengthSq <= EPS) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, (((px - ax) * abx) + ((py - ay) * aby)) / lengthSq));
  return Math.hypot(px - (ax + (abx * t)), py - (ay + (aby * t)));
}

function circleIntersectsRect(point = {}, radius = 0, rect = {}) {
  const x = Math.max(finite(rect.x), Math.min(finite(point.x), finite(rect.x) + finite(rect.width)));
  const y = Math.max(finite(rect.y), Math.min(finite(point.y), finite(rect.y) + finite(rect.height)));
  return Math.hypot(finite(point.x) - x, finite(point.y) - y) < Math.max(0, finite(radius));
}

function tokenRadius(interaction, token, grid) {
  return Math.max(4, finite(interaction?.tokenRadius?.(token, grid), finite(grid?.size, 70) * 0.4));
}

function buildDirectContext(host, interaction, token, mapData = {}) {
  const startedAt = host?.performance?.now?.() ?? Date.now();
  const grid = mapData.grid || {};
  const layer = layerOf(token);
  const radius = tokenRadius(interaction, token, grid);
  const walls = typeof interaction?.movementWalls === 'function' ? interaction.movementWalls(mapData, token) : [];
  const wallBuckets = new Map();
  for (const wall of walls || []) {
    const extra = radius + (Math.max(0, finite(wall?.thicknessPx)) / 2);
    addBucketRange(wallBuckets, wall, {
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
    ...(mapData.worldObjectDefinitions || {}),
  };
  if (core) {
    for (const instance of mapData.worldObjects || []) {
      if (finite(instance?.position?.zLayer) !== layer) continue;
      const definition = core.resolveDefinition?.(instance, definitions) || null;
      if (!definition || core.blocksMovement?.(instance, definition) === false) continue;
      const rect = core.footprintRect?.(instance, definition, grid);
      if (!rect) continue;
      const blocker = { instance, definition, rect };
      addBucketRange(objectBuckets, blocker, {
        minX: finite(rect.x) - radius,
        maxX: finite(rect.x) + finite(rect.width) + radius,
        minY: finite(rect.y) - radius,
        maxY: finite(rect.y) + finite(rect.height) + radius,
      }, grid);
    }
  }

  const tokens = (mapData.tokens || []).filter((other) => {
    if (!other || clean(other.id) === clean(token?.id)) return false;
    if (layerOf(other) !== layer) return false;
    if (other.blocksMovement === false || other.intangible === true) return false;
    return true;
  }).map((other) => ({ token: other, radius: tokenRadius(interaction, other, grid) }));

  return {
    grid,
    layer,
    radius,
    wallBuckets,
    objectBuckets,
    tokens,
    buildMs: Math.max(0, (host?.performance?.now?.() ?? Date.now()) - startedAt),
  };
}

function pointGate(context, token, point, mapData = {}, blockTokens = true) {
  const grid = context.grid;
  const size = Math.max(1, finite(grid.size, 70));
  const cols = Math.max(1, Math.trunc(finite(grid.cols, 1)));
  const rows = Math.max(1, Math.trunc(finite(grid.rows, 1)));
  const width = cols * size;
  const height = rows * size;
  const x = finite(point?.x, NaN);
  const y = finite(point?.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { valid: false, reason: 'INVALID_INPUT' };
  if (x - context.radius < 0 || y - context.radius < 0 || x + context.radius > width || y + context.radius > height) {
    return { valid: false, reason: 'OUT_OF_BOUNDS' };
  }

  const key = bucketKey(Math.floor(x / size), Math.floor(y / size));
  for (const wall of context.wallBuckets.get(key) || []) {
    const extra = Math.max(0, finite(wall?.thicknessPx)) / 2;
    if (pointSegmentDistance({ x, y }, wall) < context.radius + extra) {
      return { valid: false, reason: 'BLOCKED_BY_WALL', wall };
    }
  }
  for (const blocker of context.objectBuckets.get(key) || []) {
    if (circleIntersectsRect({ x, y }, context.radius, blocker.rect)) {
      return {
        valid: false,
        reason: 'BLOCKED_BY_WORLD_OBJECT',
        worldObject: blocker.instance,
        definition: blocker.definition,
      };
    }
  }
  if (blockTokens !== false) {
    for (const entry of context.tokens) {
      const other = entry.token;
      if (Math.hypot(finite(other.x) - x, finite(other.y) - y) + EPS < context.radius + entry.radius) {
        return { valid: false, reason: 'BLOCKED_BY_TOKEN', token: other };
      }
    }
  }
  return { valid: true };
}

function directRoute(host, pathfinding, interaction, options = {}, metrics = null) {
  const { token, start, target, mapData = {} } = options;
  if (!token || !start || !target || !mapData.grid) return null;
  const zLayer = Number.isFinite(Number(options.zLayer)) ? Number(options.zLayer) : pathfinding.tokenLayer(token);
  const startCell = start.col != null && start.row != null
    ? { col: Math.trunc(Number(start.col)), row: Math.trunc(Number(start.row)) }
    : pathfinding.cellFromPoint(start, mapData);
  const targetCell = target.col != null && target.row != null
    ? { col: Math.trunc(Number(target.col)), row: Math.trunc(Number(target.row)) }
    : pathfinding.cellFromPoint(target, mapData);
  const dc = targetCell.col - startCell.col;
  const dr = targetCell.row - startCell.row;
  if (!(dc === 0 || dr === 0 || Math.abs(dc) === Math.abs(dr))) return null;

  const context = buildDirectContext(host, interaction, token, mapData);
  if (metrics) {
    metrics.contexts += 1;
    metrics.contextBuildTotalMs += context.buildMs;
    metrics.contextBuildMaxMs = Math.max(metrics.contextBuildMaxMs, context.buildMs);
  }
  const movementMode = options.movementMode || token.movementState?.mode || 'walk';
  const blockTokens = options.blockTokens ?? mapData.movement?.blockTokens ?? true;
  const costOptions = { movementMode, blockTokens, diagonalRule: options.diagonalRule };
  const stepCol = Math.sign(dc);
  const stepRow = Math.sign(dr);
  const steps = Math.max(Math.abs(dc), Math.abs(dr));
  const cells = [{ ...startCell }];
  let current = { ...startCell };
  let costFt = 0;

  // Validate terrain/cost once per crossed grid cell. This is dictionary work only;
  // it deliberately avoids edgePassable/isPathClear and their legacy nested sampling.
  for (let index = 0; index < steps; index += 1) {
    const next = { col: current.col + stepCol, row: current.row + stepRow };
    const terrain = pathfinding.terrainRecord?.(mapData, zLayer, next.col, next.row) || { multiplier: 1 };
    if (pathfinding.terrainAllows?.(terrain, movementMode) === false) return null;
    costFt += pathfinding.stepCostFt(current, next, mapData, zLayer, costOptions);
    cells.push(next);
    current = next;
  }

  const fromPoint = pathfinding.pointForCell(startCell, mapData, zLayer);
  const toPoint = pathfinding.pointForCell(targetCell, mapData, zLayer);
  const dx = finite(toPoint.x) - finite(fromPoint.x);
  const dy = finite(toPoint.y) - finite(fromPoint.y);
  const distance = Math.hypot(dx, dy);
  const sampleStep = Math.max(6, Math.min(context.radius * 0.65, finite(mapData.grid?.size, 70) * 0.25));
  const samples = Math.max(1, Math.ceil(distance / sampleStep));
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = { x: finite(fromPoint.x) + (dx * t), y: finite(fromPoint.y) + (dy * t) };
    const gate = pointGate(context, token, point, mapData, blockTokens);
    if (!gate.valid) return null;
  }

  return {
    valid: true,
    reason: null,
    path: cells.map((cell) => pathfinding.pointForCell(cell, mapData, zLayer)),
    cells,
    costFt,
    visited: 0,
    fastPath: 'direct-corridor',
  };
}

export function installDirectRouteHotfix(host = globalThis) {
  if (host?.LuminousVttDirectRouteHotfix?.__v1) return host.LuminousVttDirectRouteHotfix;

  let stopped = false;
  let wrapped = null;
  let base = null;
  const metrics = {
    ensureCalls: 0,
    findPathCalls: 0,
    directAttempts: 0,
    directHits: 0,
    fallbackCalls: 0,
    contexts: 0,
    contextBuildTotalMs: 0,
    contextBuildMaxMs: 0,
    directTotalMs: 0,
    directMaxMs: 0,
    fallbackTotalMs: 0,
    fallbackMaxMs: 0,
  };

  function ensure() {
    if (stopped) return null;
    metrics.ensureCalls += 1;
    const current = host?.LuminousVttPathfinding;
    if (!current?.findPath) return null;
    if (current === wrapped) return wrapped;
    if (current.__directCorridorHotfixV1 && current.__directCorridorBase) {
      wrapped = current;
      base = current.__directCorridorBase;
      return current;
    }

    base = current;
    const next = Object.freeze({
      ...current,
      __directCorridorHotfixV1: true,
      __directCorridorBase: current,
      findPath(options = {}) {
        metrics.findPathCalls += 1;
        const interaction = host?.LuminousVttTokenInteraction;
        const start = host?.performance?.now?.() ?? Date.now();
        metrics.directAttempts += 1;
        const direct = interaction ? directRoute(host, current, interaction, options, metrics) : null;
        const directMs = Math.max(0, (host?.performance?.now?.() ?? Date.now()) - start);
        metrics.directTotalMs += directMs;
        metrics.directMaxMs = Math.max(metrics.directMaxMs, directMs);
        if (direct) {
          metrics.directHits += 1;
          return direct;
        }
        metrics.fallbackCalls += 1;
        const fallbackAt = host?.performance?.now?.() ?? Date.now();
        const result = current.findPath(options);
        const fallbackMs = Math.max(0, (host?.performance?.now?.() ?? Date.now()) - fallbackAt);
        metrics.fallbackTotalMs += fallbackMs;
        metrics.fallbackMaxMs = Math.max(metrics.fallbackMaxMs, fallbackMs);
        return result;
      },
    });
    host.LuminousVttPathfinding = next;
    wrapped = next;
    return next;
  }

  const refresh = () => ensure();
  host?.addEventListener?.('mousedown', refresh, true);
  // This runs after movement-long-drag-hotfix's capture listener because this module
  // is imported second. It therefore wraps the final pathfinder immediately before
  // Engine's bubble-phase mouseup resolver executes.
  host?.addEventListener?.('mouseup', refresh, true);
  host?.addEventListener?.('vtt:topology-changed', refresh);
  host?.setTimeout?.(refresh, 0);
  host?.setTimeout?.(refresh, 250);
  host?.setTimeout?.(refresh, 1000);

  const api = Object.freeze({
    __v1: true,
    ensure,
    snapshot() {
      return Object.freeze({
        ...metrics,
        avgContextBuildMs: metrics.contexts ? metrics.contextBuildTotalMs / metrics.contexts : 0,
        avgDirectMs: metrics.directAttempts ? metrics.directTotalMs / metrics.directAttempts : 0,
        avgFallbackMs: metrics.fallbackCalls ? metrics.fallbackTotalMs / metrics.fallbackCalls : 0,
        installed: host?.LuminousVttPathfinding?.__directCorridorHotfixV1 === true,
      });
    },
    stop() {
      if (stopped) return false;
      stopped = true;
      host?.removeEventListener?.('mousedown', refresh, true);
      host?.removeEventListener?.('mouseup', refresh, true);
      host?.removeEventListener?.('vtt:topology-changed', refresh);
      if (host.LuminousVttPathfinding === wrapped && base) host.LuminousVttPathfinding = base;
      if (host.LuminousVttDirectRouteHotfix === api) delete host.LuminousVttDirectRouteHotfix;
      return true;
    },
  });

  host.LuminousVttDirectRouteHotfix = api;
  ensure();
  return api;
}

if (typeof window !== 'undefined') installDirectRouteHotfix(window);
