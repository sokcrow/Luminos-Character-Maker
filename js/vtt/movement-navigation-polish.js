const EPS = 1e-9;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '').trim();

function lineDeviation(cell = {}, start = {}, target = {}) {
  const routeDx = finite(target.col) - finite(start.col);
  const routeDy = finite(target.row) - finite(start.row);
  if (Math.abs(routeDx) < EPS && Math.abs(routeDy) < EPS) return 0;
  const cellDx = finite(cell.col) - finite(start.col);
  const cellDy = finite(cell.row) - finite(start.row);
  return Math.abs((cellDx * routeDy) - (cellDy * routeDx)) / Math.max(1, Math.hypot(routeDx, routeDy));
}

function goalDistance(cell = {}, target = {}) {
  return Math.hypot(finite(target.col) - finite(cell.col), finite(target.row) - finite(cell.row));
}

function preferCandidate(base, candidate, current, start, target, f) {
  if (!current) return true;
  const candidateKey = base.cellKey(candidate.col, candidate.row);
  const currentKey = base.cellKey(current.col, current.row);
  const candidateF = f.get(candidateKey) ?? Infinity;
  const currentF = f.get(currentKey) ?? Infinity;
  if (candidateF < currentF - EPS) return true;
  if (candidateF > currentF + EPS) return false;

  const candidateDeviation = lineDeviation(candidate, start, target);
  const currentDeviation = lineDeviation(current, start, target);
  if (candidateDeviation < currentDeviation - EPS) return true;
  if (candidateDeviation > currentDeviation + EPS) return false;

  const candidateGoal = goalDistance(candidate, target);
  const currentGoal = goalDistance(current, target);
  if (candidateGoal < currentGoal - EPS) return true;
  if (candidateGoal > currentGoal + EPS) return false;

  if (candidate.row !== current.row) return candidate.row < current.row;
  return candidate.col < current.col;
}

export function installStraightPathfinding(host = globalThis) {
  const base = host?.LuminousVttPathfinding;
  if (!base || base.__straightRouteTieBreakPatch) return base || null;

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
    const f = new Map([[startKey, base.heuristicFt(startCell, targetCell, mapData, options)]]);
    const limit = Math.max(1, Math.trunc(finite(maxVisited, 20000)));
    let visited = 0;

    while (open.size && visited < limit) {
      let currentKey = null;
      let current = null;
      for (const key of open) {
        const candidate = nodes.get(key);
        if (candidate && preferCandidate(base, candidate, current, startCell, targetCell, f)) {
          current = candidate;
          currentKey = key;
        }
      }
      if (!currentKey || !current) break;
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
        if (tentative + EPS >= (g.get(nextKey) ?? Infinity)) continue;
        cameFrom.set(nextKey, currentKey);
        nodes.set(nextKey, next);
        g.set(nextKey, tentative);
        f.set(nextKey, tentative + base.heuristicFt(next, targetCell, mapData, options));
        open.add(nextKey);
      }
    }

    return { valid: false, reason: visited >= limit ? 'SEARCH_LIMIT' : 'NO_PATH', path: [], cells: [], costFt: Infinity, visited };
  }

  const patched = Object.freeze({
    ...base,
    __straightRouteTieBreakPatch: true,
    findPath,
  });
  host.LuminousVttPathfinding = patched;
  return patched;
}

function normalizedPoints(path = []) {
  return Array.isArray(path)
    ? path.filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
      .map((point) => ({ ...point, x: Number(point.x), y: Number(point.y) }))
    : [];
}

function polylineMetrics(points = []) {
  const segments = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (!(length > EPS)) continue;
    const start = total;
    total += length;
    segments.push({ from, to, length, start, end: total });
  }
  return { segments, total };
}

function pointAlongPolyline(metrics, distance) {
  const segments = metrics?.segments || [];
  if (!segments.length) return null;
  const wanted = Math.max(0, Math.min(finite(distance), finite(metrics.total)));
  let segment = segments[segments.length - 1];
  for (const candidate of segments) {
    if (wanted <= candidate.end + EPS) { segment = candidate; break; }
  }
  const local = segment.length > EPS ? Math.max(0, Math.min(1, (wanted - segment.start) / segment.length)) : 1;
  return {
    x: segment.from.x + ((segment.to.x - segment.from.x) * local),
    y: segment.from.y + ((segment.to.y - segment.from.y) * local),
  };
}

function emitDirty(host, engine, tokenId, sourceEvent = 'navigation-target-marker') {
  host?.LuminousVttSceneDirty?.emit?.(engine?.canvas, {
    reason: 'token',
    render: true,
    vision: false,
    active: Boolean(engine?.tokenMotion || engine?.tokenDrag),
    sourceEvent,
    tokenId,
  });
}

function drawCanvasMarker(renderer, camera, marker) {
  const ctx = renderer?.ctx;
  if (!ctx || !camera?.applyTransformSimple) return;
  const zoom = Math.max(0.01, finite(camera.zoom, 1));
  const outer = 13 / zoom;
  const inner = 4 / zoom;
  ctx.save();
  camera.applyTransformSimple(ctx);
  ctx.strokeStyle = marker.phase === 'preview' ? '#ffffff' : '#d7b151';
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash(marker.phase === 'preview' ? [4 / zoom, 3 / zoom] : []);
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, outer, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, inner, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(marker.x - outer * 1.35, marker.y);
  ctx.lineTo(marker.x - outer * 0.65, marker.y);
  ctx.moveTo(marker.x + outer * 0.65, marker.y);
  ctx.lineTo(marker.x + outer * 1.35, marker.y);
  ctx.moveTo(marker.x, marker.y - outer * 1.35);
  ctx.lineTo(marker.x, marker.y - outer * 0.65);
  ctx.moveTo(marker.x, marker.y + outer * 0.65);
  ctx.lineTo(marker.x, marker.y + outer * 1.35);
  ctx.stroke();
  ctx.restore();
}

function drawWebGlMarker(renderer, camera, marker) {
  if (typeof renderer?.drawDmObserverOutlines !== 'function') return;
  const zoom = Math.max(0.01, finite(camera?.zoom, 1));
  const color = marker.phase === 'preview' ? '#ffffff' : '#d7b151';
  renderer.drawDmObserverOutlines([
    { x: marker.x, y: marker.y, radius: 13 / zoom, coneDeg: 360, facingDeg: 0, color, selected: true },
    { x: marker.x, y: marker.y, radius: 4 / zoom, coneDeg: 360, facingDeg: 0, color, selected: true },
  ], camera);
}

export function installRuntimeNavigationPolish({ host = globalThis, runtime = host?.LuminousVttRuntime } = {}) {
  const engine = runtime?.engine;
  const mapData = engine?.mapData;
  const renderer = engine?.renderer;
  const canvas = engine?.canvas;
  if (!engine || !mapData || !renderer || !canvas) return null;
  if (engine.__navigationPolishRuntime) return engine.__navigationPolishRuntime;

  const markers = new Map();
  const originalAnimate = engine.animateTokenPath.bind(engine);
  const originalRender = renderer.render.bind(renderer);
  let stopped = false;

  function setMarker(tokenId, point, phase = 'committed') {
    const id = clean(tokenId);
    if (!id || !Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) return false;
    const next = {
      tokenId: id,
      x: Number(point.x),
      y: Number(point.y),
      zLayer: Number(point.zLayer ?? point.z ?? engine.activeZ) || 0,
      phase,
    };
    const previous = markers.get(id);
    if (previous
      && Math.abs(previous.x - next.x) < 0.01
      && Math.abs(previous.y - next.y) < 0.01
      && previous.zLayer === next.zLayer
      && previous.phase === next.phase) return previous;
    markers.set(id, next);
    emitDirty(host, engine, id, 'navigation-target-marker:set');
    return next;
  }

  function clearMarker(tokenId) {
    const id = clean(tokenId);
    if (!id || !markers.delete(id)) return false;
    emitDirty(host, engine, id, 'navigation-target-marker:clear');
    return true;
  }

  function targetPoint(raw = {}) {
    const pathfinding = host?.LuminousVttPathfinding;
    if (!pathfinding || !Number.isFinite(Number(raw?.x)) || !Number.isFinite(Number(raw?.y))) return null;
    const bounds = pathfinding.gridBounds(mapData);
    if (Number(raw.x) < 0 || Number(raw.y) < 0 || Number(raw.x) >= bounds.width || Number(raw.y) >= bounds.height) return null;
    const cell = pathfinding.cellFromPoint(raw, mapData);
    return pathfinding.pointForCell(cell, mapData, engine.activeZ);
  }

  function onDestinationPreview(event) {
    const detail = event?.detail || {};
    const point = targetPoint(detail.target);
    if (!point) return clearMarker(detail.tokenId);
    setMarker(detail.tokenId, point, 'preview');
  }

  function onTokenPreview(event) {
    const detail = event?.detail || {};
    if (detail.reverted || detail.cancelled || detail.expired || detail.cleared) {
      clearMarker(detail.tokenId);
      return;
    }
    if (detail.destination) {
      setMarker(detail.tokenId, detail.destination, detail.traversing ? 'committed' : 'preview');
    }
  }

  function onRejected(event) { clearMarker(event?.detail?.tokenId); }
  function onMoved(event) { clearMarker(event?.detail?.tokenId); }

  const patchedAnimate = async function polishedAnimateTokenPath(token, path = [], options = {}) {
    const points = normalizedPoints(path);
    const interactions = Array.isArray(options.doorInteractions) ? options.doorInteractions : [];
    if (!token || points.length < 2 || interactions.length) {
      if (token && points.length) setMarker(token.id, points[points.length - 1], 'committed');
      const result = await originalAnimate(token, path, options);
      if (token && result?.valid === false) clearMarker(token.id);
      return result;
    }

    const metrics = polylineMetrics(points);
    if (!(metrics.total > EPS)) return { valid: true, complete: true };

    const movement = mapData.movement || {};
    const mode = String(options.actionMode || token.activeActionMovementMode || 'walk').toLowerCase();
    const defaultMs = mode === 'dash' || mode === 'run' ? 55 : 90;
    const msPerCell = Math.max(20, Number(movement.animationMsPerCell) || defaultMs);
    const gridSize = Math.max(1, Number(mapData.grid?.size) || 70);
    const durationMs = Math.max(8, msPerCell * (metrics.total / gridSize));
    const raf = host?.requestAnimationFrame?.bind(host) || ((fn) => host?.setTimeout?.(() => fn(Date.now()), 16));
    const caf = host?.cancelAnimationFrame?.bind(host) || host?.clearTimeout?.bind(host);
    const endpoint = points[points.length - 1];
    const destination = { x: endpoint.x, y: endpoint.y, z: Number(endpoint.z ?? endpoint.zLayer ?? token.zLayer ?? 0) || 0 };
    const motion = { cancelled: false, irreversible: false, frameId: null, tokenId: token.id, destination };
    engine.tokenMotion = motion;
    setMarker(token.id, destination, 'committed');

    token.x = points[0].x;
    token.y = points[0].y;
    const startAt = host?.performance?.now?.() ?? Date.now();

    try {
      const complete = await new Promise((resolve) => {
        const step = (nowValue) => {
          if (motion.cancelled) return resolve(false);
          const elapsed = Math.max(0, Number(nowValue) - startAt);
          const t = Math.min(1, elapsed / durationMs);
          const next = pointAlongPolyline(metrics, metrics.total * t) || endpoint;
          token.x = next.x;
          token.y = next.y;
          const detail = {
            tokenId: token.id,
            x: token.x,
            y: token.y,
            z: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0),
            traversing: true,
            actionMode: mode,
            destination,
          };
          engine.emitSemanticEvent?.('vtt:token-preview-moved', detail, {
            reason: 'token', render: true, vision: true, active: true,
          });
          if (t >= 1) return resolve(true);
          motion.frameId = raf(step);
        };
        motion.frameId = raf(step);
      });
      if (!complete) clearMarker(token.id);
      return complete
        ? { valid: true, complete: true, irreversible: false }
        : { valid: false, reason: 'MOVEMENT_CANCELLED', complete: false };
    } finally {
      if (motion.frameId != null && motion.cancelled) caf?.(motion.frameId);
      if (engine.tokenMotion === motion) engine.tokenMotion = null;
    }
  };
  engine.animateTokenPath = patchedAnimate;

  renderer.render = function navigationMarkerRender(...args) {
    const result = originalRender(...args);
    if (stopped || !markers.size) return result;
    const visible = [...markers.values()].filter((marker) => Number(marker.zLayer) === Number(engine.activeZ));
    for (const marker of visible) {
      if (renderer.backend === 'webgl2') drawWebGlMarker(renderer, engine.camera, marker);
      else drawCanvasMarker(renderer, engine.camera, marker);
    }
    return result;
  };

  canvas.addEventListener('vtt:movement-destination-preview', onDestinationPreview);
  canvas.addEventListener('vtt:token-preview-moved', onTokenPreview);
  canvas.addEventListener('vtt:movement-order-rejected', onRejected);
  canvas.addEventListener('vtt:token-moved', onMoved);

  const api = Object.freeze({
    markers,
    setMarker,
    clearMarker,
    stop() {
      if (stopped) return false;
      stopped = true;
      markers.clear();
      canvas.removeEventListener('vtt:movement-destination-preview', onDestinationPreview);
      canvas.removeEventListener('vtt:token-preview-moved', onTokenPreview);
      canvas.removeEventListener('vtt:movement-order-rejected', onRejected);
      canvas.removeEventListener('vtt:token-moved', onMoved);
      if (engine.animateTokenPath === patchedAnimate) engine.animateTokenPath = originalAnimate;
      return true;
    },
  });

  engine.__navigationPolishRuntime = api;
  host.LuminousVttNavigationPolishRuntime = api;
  return api;
}

function startWhenRuntimeReady(host = globalThis) {
  let attempts = 0;
  const tryStart = () => {
    const runtime = host?.LuminousVttRuntime;
    if (runtime?.engine?.renderer) {
      installRuntimeNavigationPolish({ host, runtime });
      return;
    }
    attempts += 1;
    if (attempts < 160) host?.setTimeout?.(tryStart, 25);
  };
  tryStart();
}

installStraightPathfinding(globalThis);
if (typeof window !== 'undefined') startWhenRuntimeReady(window);
