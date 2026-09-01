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

export function startPathfindingFinalizer(host = globalThis) {
  let attempts = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const engine = host?.LuminousVttRuntime?.engine;
    if (engine?.tokenMoveResolver && host?.LuminousVttPathfinding) {
      finalizePathfinding(host);
      return;
    }
    attempts += 1;
    if (attempts < 240) host?.setTimeout?.(tick, 25);
  };

  tick();
  return Object.freeze({
    stop() { stopped = true; },
    finalize() { return finalizePathfinding(host); },
  });
}

if (typeof window !== 'undefined') {
  window.LuminousVttPathfindingFinalizer = startPathfindingFinalizer(window);
}
