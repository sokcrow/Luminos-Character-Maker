import './movement-zero-work-drag.js';
import './movement-long-drag-hotfix.js';
import './movement-direct-route-hotfix.js';
import { installStraightPathfinding } from './movement-navigation-polish.js';

const EPS = 1e-9;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function finalizePathfinding(host = globalThis) {
  const current = host?.LuminousVttPathfinding;
  if (!current || typeof current.findPath !== 'function') return null;
  if (current.__runtimeFinalizedPathfindingV3 === true) return current;

  host.LuminousVttPathfinding = Object.freeze({
    ...current,
    __straightRouteTieBreakPatch: false,
    __straightRouteTieBreakPatchV2: false,
  });

  const straight = installStraightPathfinding(host);
  if (!straight) return null;

  const finalized = Object.freeze({
    ...straight,
    __runtimeFinalizedPathfindingV3: true,
  });
  host.LuminousVttPathfinding = finalized;
  return finalized;
}

function installPreviewCellGate(host = globalThis, engine = host?.LuminousVttRuntime?.engine) {
  if (!engine?.canvas || engine.__movementPreviewCellGate) return engine?.__movementPreviewCellGate || null;

  let lastKey = null;
  const reset = () => { lastKey = null; };

  const onMouseMove = (event) => {
    const drag = engine.tokenDrag;
    if (!drag?.token) {
      lastKey = null;
      return;
    }

    const pathfinding = host?.LuminousVttPathfinding;
    if (!pathfinding?.cellFromPoint || typeof engine.eventWorldPoint !== 'function') return;

    const world = engine.eventWorldPoint(event);
    const target = {
      x: Number(world?.x) - Number(drag.grabOffsetX || 0),
      y: Number(world?.y) - Number(drag.grabOffsetY || 0),
    };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return;

    const cell = pathfinding.cellFromPoint(target, engine.mapData);
    if (!cell || !Number.isFinite(Number(cell.col)) || !Number.isFinite(Number(cell.row))) return;

    const key = [
      String(drag.token.id || ''),
      Number(drag.originX) || 0,
      Number(drag.originY) || 0,
      Number(drag.originZ ?? engine.activeZ) || 0,
      Number(cell.col),
      Number(cell.row),
    ].join(':');

    if (key === lastKey) {
      event.stopImmediatePropagation();
      return;
    }
    lastKey = key;
  };

  host.addEventListener?.('mousemove', onMouseMove, true);
  host.addEventListener?.('mousedown', reset, true);
  host.addEventListener?.('mouseup', reset, true);
  host.addEventListener?.('blur', reset, true);

  const api = Object.freeze({
    reset,
    stop() {
      host.removeEventListener?.('mousemove', onMouseMove, true);
      host.removeEventListener?.('mousedown', reset, true);
      host.removeEventListener?.('mouseup', reset, true);
      host.removeEventListener?.('blur', reset, true);
      if (engine.__movementPreviewCellGate === api) delete engine.__movementPreviewCellGate;
      if (host.LuminousVttMovementPreviewCellGate === api) delete host.LuminousVttMovementPreviewCellGate;
    },
  });

  engine.__movementPreviewCellGate = api;
  host.LuminousVttMovementPreviewCellGate = api;
  return api;
}

function normalizedPoints(path = []) {
  return Array.isArray(path)
    ? path
      .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
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
    if (wanted <= candidate.end + EPS) {
      segment = candidate;
      break;
    }
  }
  const t = segment.length > EPS
    ? Math.max(0, Math.min(1, (wanted - segment.start) / segment.length))
    : 1;
  return {
    x: segment.from.x + ((segment.to.x - segment.from.x) * t),
    y: segment.from.y + ((segment.to.y - segment.from.y) * t),
  };
}

function installRealtimeTraversalSimplifier(host = globalThis, engine = host?.LuminousVttRuntime?.engine) {
  if (!engine || typeof engine.animateTokenPath !== 'function') return null;
  if (engine.__realtimeTraversalSimplifierV1) return engine.__realtimeTraversalSimplifierV1;

  const originalAnimate = engine.animateTokenPath;
  const mapData = engine.mapData || {};
  const raf = host?.requestAnimationFrame?.bind(host) || ((fn) => host?.setTimeout?.(() => fn(Date.now()), 16));
  const caf = host?.cancelAnimationFrame?.bind(host) || host?.clearTimeout?.bind(host);

  const patchedAnimate = async function realtimeAnimateTokenPath(token, path = [], options = {}) {
    const points = normalizedPoints(path);
    const interactions = Array.isArray(options.doorInteractions) ? options.doorInteractions : [];
    if (!token || points.length < 2 || interactions.length) {
      return originalAnimate.call(engine, token, path, options);
    }

    const metrics = polylineMetrics(points);
    if (!(metrics.total > EPS)) return { valid: true, complete: true };

    const movement = mapData.movement || {};
    const mode = String(options.actionMode || token.activeActionMovementMode || 'walk').toLowerCase();
    const running = mode === 'dash' || mode === 'run';
    const gridSize = Math.max(1, finite(mapData.grid?.size, 70));
    const cells = metrics.total / gridSize;
    const defaultPerCell = running ? 9 : 14;
    const defaultMinMs = running ? 55 : 70;
    const defaultMaxMs = running ? 120 : 180;
    const perCell = Math.max(1, finite(movement.realtimeAnimationMsPerCell, defaultPerCell));
    const minMs = Math.max(16, finite(movement.realtimeAnimationMinMs, defaultMinMs));
    const maxMs = Math.max(minMs, finite(movement.realtimeAnimationMaxMs, defaultMaxMs));
    const durationMs = Math.min(maxMs, Math.max(minMs, cells * perCell));

    const endpoint = points[points.length - 1];
    const destination = {
      x: endpoint.x,
      y: endpoint.y,
      z: Number(endpoint.z ?? endpoint.zLayer ?? token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) || 0,
    };
    const motion = {
      cancelled: false,
      irreversible: false,
      frameId: null,
      tokenId: token.id,
      destination,
      realtimeVisual: true,
      durationMs,
    };

    engine.tokenMotion = motion;
    host?.LuminousVttNavigationPolishRuntime?.setMarker?.(token.id, destination, 'committed');
    token.x = points[0].x;
    token.y = points[0].y;
    const startedAt = host?.performance?.now?.() ?? Date.now();

    try {
      const complete = await new Promise((resolve) => {
        const step = (nowValue) => {
          if (motion.cancelled) return resolve(false);
          const elapsed = Math.max(0, Number(nowValue) - startedAt);
          const t = Math.min(1, elapsed / durationMs);
          const next = pointAlongPolyline(metrics, metrics.total * t) || endpoint;
          token.x = next.x;
          token.y = next.y;

          engine.emitSemanticEvent?.('vtt:token-preview-moved', {
            tokenId: token.id,
            x: token.x,
            y: token.y,
            z: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0),
            traversing: true,
            actionMode: mode,
            destination,
            realtimeVisual: true,
          }, {
            reason: 'token',
            render: true,
            vision: false,
            active: true,
          });

          if (t >= 1) return resolve(true);
          motion.frameId = raf(step);
        };
        motion.frameId = raf(step);
      });

      if (!complete) host?.LuminousVttNavigationPolishRuntime?.clearMarker?.(token.id);
      return complete
        ? { valid: true, complete: true, irreversible: false, realtimeVisual: true, durationMs }
        : { valid: false, reason: 'MOVEMENT_CANCELLED', complete: false, realtimeVisual: true };
    } finally {
      if (motion.frameId != null && motion.cancelled) caf?.(motion.frameId);
      if (engine.tokenMotion === motion) engine.tokenMotion = null;
    }
  };

  engine.animateTokenPath = patchedAnimate;

  const api = Object.freeze({
    originalAnimate,
    stop() {
      if (engine.animateTokenPath === patchedAnimate) engine.animateTokenPath = originalAnimate;
      if (engine.__realtimeTraversalSimplifierV1 === api) delete engine.__realtimeTraversalSimplifierV1;
      if (host.LuminousVttRealtimeTraversalSimplifier === api) delete host.LuminousVttRealtimeTraversalSimplifier;
    },
  });

  engine.__realtimeTraversalSimplifierV1 = api;
  host.LuminousVttRealtimeTraversalSimplifier = api;
  return api;
}

export function startPathfindingFinalizer(host = globalThis) {
  let attempts = 0;
  let stopped = false;
  let previewGate = null;
  let traversalSimplifier = null;

  const tick = () => {
    if (stopped) return;
    const engine = host?.LuminousVttRuntime?.engine;
    if (engine?.tokenMoveResolver && host?.LuminousVttPathfinding) {
      finalizePathfinding(host);
      host?.LuminousVttDirectRouteHotfix?.ensure?.();
      previewGate = installPreviewCellGate(host, engine);
      traversalSimplifier = installRealtimeTraversalSimplifier(host, engine);
      return;
    }
    attempts += 1;
    if (attempts < 240) host?.setTimeout?.(tick, 25);
  };

  tick();
  return Object.freeze({
    stop() {
      stopped = true;
      previewGate?.stop?.();
      traversalSimplifier?.stop?.();
    },
    finalize() {
      const result = finalizePathfinding(host);
      host?.LuminousVttDirectRouteHotfix?.ensure?.();
      const engine = host?.LuminousVttRuntime?.engine;
      if (engine) {
        previewGate = installPreviewCellGate(host, engine);
        traversalSimplifier = installRealtimeTraversalSimplifier(host, engine);
      }
      return result;
    },
  });
}

if (typeof window !== 'undefined') {
  window.LuminousVttPathfindingFinalizer = startPathfindingFinalizer(window);
}
