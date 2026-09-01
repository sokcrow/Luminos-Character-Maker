import { installStraightPathfinding } from './movement-navigation-polish.js';

function finalizePathfinding(host = globalThis) {
  const current = host?.LuminousVttPathfinding;
  if (!current || typeof current.findPath !== 'function') return null;
  if (current.__runtimeFinalizedPathfindingV3 === true) return current;

  // Several legacy movement wrappers spread the pathfinder object and then replace
  // findPath. That accidentally preserves the V2 flags even though the V2 function
  // itself is gone. Clear only those ownership flags, then install V2 around the
  // final rule-aware surface (terrain + occupancy + edge legality).
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

  // Movement preview currently has two mousemove consumers: Engine emits the
  // semantic destination-preview event, while movement-bootstrap also plans from
  // window.mousemove. Capture-phase gating removes duplicate same-cell work before
  // either consumer runs, without touching the final mouseup resolver.
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

export function startPathfindingFinalizer(host = globalThis) {
  let attempts = 0;
  let stopped = false;
  let previewGate = null;

  const tick = () => {
    if (stopped) return;
    const engine = host?.LuminousVttRuntime?.engine;
    if (engine?.tokenMoveResolver && host?.LuminousVttPathfinding) {
      finalizePathfinding(host);
      previewGate = installPreviewCellGate(host, engine);
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
    },
    finalize() {
      const result = finalizePathfinding(host);
      const engine = host?.LuminousVttRuntime?.engine;
      if (engine) previewGate = installPreviewCellGate(host, engine);
      return result;
    },
  });
}

if (typeof window !== 'undefined') {
  window.LuminousVttPathfindingFinalizer = startPathfindingFinalizer(window);
}
