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

function installPreviewCellDedupe(host = globalThis, engine = host?.LuminousVttRuntime?.engine) {
  if (!engine?.canvas || engine.__movementPreviewCellDedupe) return engine?.__movementPreviewCellDedupe || null;

  const canvas = engine.canvas;
  let lastKey = null;

  const reset = () => { lastKey = null; };
  const onPreview = (event) => {
    const detail = event?.detail || {};
    const pathfinding = host?.LuminousVttPathfinding;
    const target = detail.target;
    if (!pathfinding?.cellFromPoint || !target) return;

    const cell = pathfinding.cellFromPoint(target, engine.mapData);
    if (!cell || !Number.isFinite(Number(cell.col)) || !Number.isFinite(Number(cell.row))) return;

    const from = detail.from || {};
    const key = [
      String(detail.tokenId || ''),
      Number(from.x) || 0,
      Number(from.y) || 0,
      Number(from.z ?? engine.activeZ) || 0,
      Number(cell.col),
      Number(cell.row),
    ].join(':');

    if (key === lastKey) {
      event.stopImmediatePropagation();
      return;
    }
    lastKey = key;
  };

  // Capture phase lets this run before the existing preview planners on the canvas,
  // even though the finalizer is loaded after main.js.
  canvas.addEventListener('vtt:movement-destination-preview', onPreview, true);
  host.addEventListener?.('mousedown', reset, true);
  host.addEventListener?.('mouseup', reset, true);
  host.addEventListener?.('blur', reset, true);

  const api = Object.freeze({
    reset,
    stop() {
      canvas.removeEventListener('vtt:movement-destination-preview', onPreview, true);
      host.removeEventListener?.('mousedown', reset, true);
      host.removeEventListener?.('mouseup', reset, true);
      host.removeEventListener?.('blur', reset, true);
      if (engine.__movementPreviewCellDedupe === api) delete engine.__movementPreviewCellDedupe;
      if (host.LuminousVttMovementPreviewDedupe === api) delete host.LuminousVttMovementPreviewDedupe;
    },
  });

  engine.__movementPreviewCellDedupe = api;
  host.LuminousVttMovementPreviewDedupe = api;
  return api;
}

export function startPathfindingFinalizer(host = globalThis) {
  let attempts = 0;
  let stopped = false;
  let previewDedupe = null;

  const tick = () => {
    if (stopped) return;
    const engine = host?.LuminousVttRuntime?.engine;
    if (engine?.tokenMoveResolver && host?.LuminousVttPathfinding) {
      finalizePathfinding(host);
      previewDedupe = installPreviewCellDedupe(host, engine);
      return;
    }
    attempts += 1;
    if (attempts < 240) host?.setTimeout?.(tick, 25);
  };

  tick();
  return Object.freeze({
    stop() {
      stopped = true;
      previewDedupe?.stop?.();
    },
    finalize() {
      const result = finalizePathfinding(host);
      const engine = host?.LuminousVttRuntime?.engine;
      if (engine) previewDedupe = installPreviewCellDedupe(host, engine);
      return result;
    },
  });
}

if (typeof window !== 'undefined') {
  window.LuminousVttPathfindingFinalizer = startPathfindingFinalizer(window);
}
