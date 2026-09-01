const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '').trim();

export function installZeroWorkDrag(host = globalThis) {
  if (host?.LuminousVttZeroWorkDrag?.__v1) return host.LuminousVttZeroWorkDrag;

  let stopped = false;
  let lastCellKey = '';
  let hud = null;
  const metrics = {
    pointerMoves: 0,
    cellChanges: 0,
    blockedLegacyMouseMoves: 0,
    worldPreviewCalls: 0,
    pathfindingCalls: 0,
    handlerTotalMs: 0,
    handlerMaxMs: 0,
  };

  const runtime = () => host?.LuminousVttRuntime || null;
  const now = () => host?.performance?.now?.() ?? Date.now();

  function ensureHud() {
    if (hud?.isConnected) return hud;
    hud = host?.document?.getElementById?.('vtt-fast-drag-hud') || null;
    if (hud) return hud;
    const doc = host?.document;
    if (!doc?.body) return null;
    hud = doc.createElement('div');
    hud.id = 'vtt-fast-drag-hud';
    hud.hidden = true;
    hud.style.cssText = 'position:fixed;z-index:36050;pointer-events:none;padding:4px 7px;border:1px solid #fff;background:#090909;color:#fff;font:700 11px monospace;box-shadow:2px 2px 0 #000;transform:translate(12px,12px);will-change:left,top;';
    doc.body.appendChild(hud);
    return hud;
  }

  function hideHud() {
    if (hud) hud.hidden = true;
  }

  function distanceFt(engine, drag, targetCell) {
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

  function onMouseMove(event) {
    const engine = runtime()?.engine;
    const drag = engine?.tokenDrag;
    if (!engine || !drag?.token || typeof engine.eventWorldPoint !== 'function') return;

    const startedAt = now();
    try {
      metrics.pointerMoves += 1;
      const pathfinding = host?.LuminousVttPathfinding;
      if (!pathfinding?.cellFromPoint) return;
      const world = engine.eventWorldPoint(event);
      const target = {
        x: finite(world?.x) - finite(drag.grabOffsetX),
        y: finite(world?.y) - finite(drag.grabOffsetY),
      };
      const cell = pathfinding.cellFromPoint(target, engine.mapData || {});
      const key = `${clean(drag.token.id)}:${cell.col}:${cell.row}`;
      const node = ensureHud();
      if (node) {
        node.style.left = `${Math.round(finite(event.clientX))}px`;
        node.style.top = `${Math.round(finite(event.clientY))}px`;
        if (key !== lastCellKey) {
          node.textContent = `${Math.round(distanceFt(engine, drag, cell))} ft`;
          metrics.cellChanges += 1;
          lastCellKey = key;
        }
        node.hidden = false;
      }

      // Intentionally kill every downstream token-drag mousemove consumer.
      // Final validation still runs on mouseup. During drag we need cursor feedback,
      // not pathfinding, world render, FOV, scene-dirty, or route reconstruction.
      metrics.blockedLegacyMouseMoves += 1;
      event.stopImmediatePropagation?.();
    } finally {
      const elapsed = Math.max(0, now() - startedAt);
      metrics.handlerTotalMs += elapsed;
      metrics.handlerMaxMs = Math.max(metrics.handlerMaxMs, elapsed);
    }
  }

  function reset() {
    lastCellKey = '';
    hideHud();
  }

  // Loaded before all other movement drag capture patches. This listener owns token
  // drag mousemove and prevents legacy listeners from reaching the main thread.
  host?.addEventListener?.('mousemove', onMouseMove, true);
  host?.addEventListener?.('mouseup', reset, true);
  host?.addEventListener?.('blur', reset, true);

  const api = Object.freeze({
    __v1: true,
    snapshot() {
      return Object.freeze({
        ...metrics,
        handlerAvgMs: metrics.pointerMoves ? metrics.handlerTotalMs / metrics.pointerMoves : 0,
        active: Boolean(runtime()?.engine?.tokenDrag),
        hudVisible: Boolean(hud && !hud.hidden),
      });
    },
    stop() {
      if (stopped) return false;
      stopped = true;
      host?.removeEventListener?.('mousemove', onMouseMove, true);
      host?.removeEventListener?.('mouseup', reset, true);
      host?.removeEventListener?.('blur', reset, true);
      reset();
      if (host.LuminousVttZeroWorkDrag === api) delete host.LuminousVttZeroWorkDrag;
      return true;
    },
  });

  host.LuminousVttZeroWorkDrag = api;
  return api;
}

if (typeof window !== 'undefined') installZeroWorkDrag(window);
