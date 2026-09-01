const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '').trim();

export function installZeroWorkDrag(host = globalThis) {
  if (host?.LuminousVttZeroWorkDrag?.__v2) return host.LuminousVttZeroWorkDrag;
  if (host?.LuminousVttZeroWorkDrag?.stop) host.LuminousVttZeroWorkDrag.stop();

  let stopped = false;
  let lastCellKey = '';
  let hud = null;
  let previewFrame = null;
  let pendingPreview = null;
  let activePreviewTokenId = '';
  const metrics = {
    pointerMoves: 0,
    cellChanges: 0,
    blockedLegacyMouseMoves: 0,
    worldPreviewCalls: 0,
    pathfindingCalls: 0,
    visualPreviewFrames: 0,
    coalescedPointerMoves: 0,
    renderRequests: 0,
    cameraPreviewFrames: 0,
    previewClears: 0,
    handlerTotalMs: 0,
    handlerMaxMs: 0,
  };

  const runtime = () => host?.LuminousVttRuntime || null;
  const now = () => host?.performance?.now?.() ?? Date.now();
  const raf = host?.requestAnimationFrame?.bind(host) || ((fn) => host?.setTimeout?.(() => fn(now()), 16));
  const caf = host?.cancelAnimationFrame?.bind(host) || host?.clearTimeout?.bind(host);

  function eventCtor() {
    return host?.CustomEvent || globalThis.CustomEvent;
  }

  function dispatch(canvas, type, detail) {
    const EventCtor = eventCtor();
    if (!canvas?.dispatchEvent || typeof EventCtor !== 'function') return false;
    canvas.dispatchEvent(new EventCtor(type, { detail }));
    return true;
  }

  function requestRender(engine, detail) {
    const canvas = engine?.canvas;
    const dirty = host?.LuminousVttSceneDirty;
    if (!canvas || !dirty?.emit) return false;
    metrics.renderRequests += 1;
    dirty.emit(canvas, {
      reason: 'token',
      render: true,
      vision: false,
      active: true,
      sourceEvent: 'vtt:token-drag-preview',
      tokenId: detail.tokenId,
      meta: detail,
    });
    return true;
  }

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

  function scheduleVisualPreview(engine, drag, target, event) {
    const tokenId = clean(drag?.token?.id);
    if (!tokenId) return;
    pendingPreview = {
      tokenId,
      x: finite(target?.x),
      y: finite(target?.y),
      z: finite(drag?.originZ ?? drag?.token?.zLayer ?? drag?.token?.gridPosition?.z ?? drag?.token?.z?.[0], 0),
      clientX: finite(event?.clientX),
      clientY: finite(event?.clientY),
    };
    if (previewFrame != null) {
      metrics.coalescedPointerMoves += 1;
      return;
    }

    previewFrame = raf(() => {
      previewFrame = null;
      const next = pendingPreview;
      pendingPreview = null;
      if (!next || stopped) return;
      const liveEngine = runtime()?.engine || engine;
      const liveDrag = liveEngine?.tokenDrag;
      if (!liveEngine || clean(liveDrag?.token?.id) !== next.tokenId) return;

      const detail = {
        tokenId: next.tokenId,
        x: next.x,
        y: next.y,
        z: next.z,
        transient: true,
        drag: true,
      };
      const changed = liveEngine.renderer?.previewToken?.(next.tokenId, {
        x: next.x,
        y: next.y,
        zLayer: next.z,
      }) === true;
      activePreviewTokenId = next.tokenId;
      metrics.visualPreviewFrames += 1;

      if (liveEngine.cameraFollowActive && liveEngine.camera?.centerOnWorldPoint) {
        liveEngine.camera.centerOnWorldPoint({ x: next.x, y: next.y });
        metrics.cameraPreviewFrames += 1;
      }

      dispatch(liveEngine.canvas, 'vtt:token-drag-preview', detail);
      if (changed) requestRender(liveEngine, detail);
    });
  }

  function clearVisualPreview(reason = 'clear') {
    if (previewFrame != null) caf?.(previewFrame);
    previewFrame = null;
    const pendingId = clean(pendingPreview?.tokenId);
    pendingPreview = null;

    const engine = runtime()?.engine;
    const tokenId = clean(activePreviewTokenId || pendingId || engine?.tokenDrag?.token?.id);
    activePreviewTokenId = '';
    if (!engine || !tokenId) return false;

    const cleared = engine.renderer?.clearTokenPreview?.(tokenId) === true;
    if (!cleared) return false;
    metrics.previewClears += 1;
    const detail = { tokenId, transient: true, drag: true, cleared: true, reason };
    dispatch(engine.canvas, 'vtt:token-drag-preview-clear', detail);
    requestRender(engine, detail);
    return true;
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

      // Keep the zero-work contract for expensive movement logic: raw mousemove
      // never reaches pathfinding/claims/Firebase. Only the latest pointer target
      // is promoted to one transient visual update per animation frame.
      scheduleVisualPreview(engine, drag, target, event);
      metrics.blockedLegacyMouseMoves += 1;
      event.stopImmediatePropagation?.();
    } finally {
      const elapsed = Math.max(0, now() - startedAt);
      metrics.handlerTotalMs += elapsed;
      metrics.handlerMaxMs = Math.max(metrics.handlerMaxMs, elapsed);
    }
  }

  function reset(event) {
    clearVisualPreview(event?.type || 'reset');
    lastCellKey = '';
    hideHud();
  }

  // Capture owns token drag mousemove before legacy listeners. Expensive movement
  // validation remains a one-shot mouseup operation; visuals are RAF-coalesced.
  host?.addEventListener?.('mousemove', onMouseMove, true);
  host?.addEventListener?.('mouseup', reset, true);
  host?.addEventListener?.('blur', reset, true);

  const api = Object.freeze({
    __v1: true,
    __v2: true,
    snapshot() {
      return Object.freeze({
        ...metrics,
        handlerAvgMs: metrics.pointerMoves ? metrics.handlerTotalMs / metrics.pointerMoves : 0,
        active: Boolean(runtime()?.engine?.tokenDrag),
        previewPending: previewFrame != null,
        previewTokenId: activePreviewTokenId || clean(pendingPreview?.tokenId) || null,
        hudVisible: Boolean(hud && !hud.hidden),
      });
    },
    clearPreview: clearVisualPreview,
    stop() {
      if (stopped) return false;
      stopped = true;
      clearVisualPreview('stop');
      host?.removeEventListener?.('mousemove', onMouseMove, true);
      host?.removeEventListener?.('mouseup', reset, true);
      host?.removeEventListener?.('blur', reset, true);
      lastCellKey = '';
      hideHud();
      if (host.LuminousVttZeroWorkDrag === api) delete host.LuminousVttZeroWorkDrag;
      return true;
    },
  });

  host.LuminousVttZeroWorkDrag = api;
  return api;
}

if (typeof window !== 'undefined') installZeroWorkDrag(window);
