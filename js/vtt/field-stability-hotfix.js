const clean = (value) => String(value ?? '').trim();

function hostWindow(root = globalThis) {
  if (!root) return null;
  try {
    if (root.parent && root.parent !== root && root.parent.document) return root.parent;
  } catch (_) {}
  return root;
}

function hostFirebase(root = globalThis) {
  const host = hostWindow(root);
  return host?.firebase || root?.firebase || null;
}

function actorIdForToken(token = {}) {
  return clean(token.actorId || token.characterLink?.actorId || token.actorRef?.id);
}

function isPlayerToken(token = {}) {
  return token.canonicalScope === 'player'
    || token.actorCategory === 'player'
    || token.characterLink?.mode === 'player'
    || String(token.id || '').startsWith('player:');
}

function actorRecordById(actors = {}, actorId = '') {
  const wanted = clean(actorId);
  if (!wanted) return null;
  if (actors && typeof actors === 'object' && actors[wanted]) return actors[wanted];
  for (const [key, value] of Object.entries(actors || {})) {
    const candidate = clean(value?.actorId || value?.id || key);
    if (candidate === wanted) return value || null;
  }
  return null;
}

/**
 * Field-stability hotfix for the WebGL2 token branch.
 *
 * Goals:
 * - Raw drag previews never drive camera follow directly.
 * - Traversal frames render smoothly without recalculating FOV every frame.
 * - Camera centering during traversal does not emit a duplicate dirty pulse.
 * - Player tokens inherit Actor.icono from campaña/actores on every client.
 *
 * This module is intentionally runtime-side and idempotent so it can be removed
 * once these guards are folded into Engine/Camera/TokenState proper.
 */
export function installFieldStabilityHotfix(root = globalThis) {
  if (root?.LuminousVttFieldStabilityHotfix?.__v1) return root.LuminousVttFieldStabilityHotfix;

  const metrics = {
    enginesPatched: 0,
    rawDragFollowSuspends: 0,
    traversalVisionSuppressions: 0,
    traversalCameraDirtySuppressions: 0,
    visionCacheHits: 0,
    visionRecomputes: 0,
    playerIconsHydrated: 0,
  };

  let stopped = false;
  let currentEngine = null;
  let detachEngine = null;
  let pollTimer = null;
  let actorRef = null;
  let actorHandler = null;
  let actors = {};
  let dragFollowState = null;
  let hydrationQueued = false;

  const runtime = () => root?.LuminousVttRuntime || null;

  function emitTokenDirty(engine, tokenId, sourceEvent = 'field-stability:actor-icon') {
    const dirty = root?.LuminousVttSceneDirty;
    if (!dirty?.emit || !engine?.canvas) return false;
    return dirty.emit(engine.canvas, {
      reason: 'token',
      render: true,
      vision: false,
      active: false,
      sourceEvent,
      tokenId: clean(tokenId) || null,
      meta: { appearance: true },
    });
  }

  function hydratePlayerIcons(engine = currentEngine) {
    if (!engine || stopped) return 0;
    let changed = 0;
    for (const token of engine.mapData?.tokens || []) {
      if (!isPlayerToken(token)) continue;
      const actorId = actorIdForToken(token);
      const actor = actorRecordById(actors, actorId);
      const icono = clean(actor?.icono);
      if (!icono || clean(token.icono) === icono) continue;
      token.icono = icono;
      token.tokenImage = icono;
      token.portrait = icono;
      engine.renderer?.syncTokenView?.(token.id);
      emitTokenDirty(engine, token.id);
      changed += 1;
      metrics.playerIconsHydrated += 1;
    }
    return changed;
  }

  function queueHydration() {
    if (hydrationQueued || stopped) return;
    hydrationQueued = true;
    const schedule = root?.queueMicrotask?.bind(root) || ((fn) => Promise.resolve().then(fn));
    schedule(() => {
      hydrationQueued = false;
      hydratePlayerIcons();
    });
  }

  function ensureActorSubscription() {
    if (actorRef || stopped) return;
    let db = null;
    try { db = hostFirebase(root)?.database?.() || null; } catch (_) {}
    if (!db?.ref) return;
    actorRef = db.ref('campaña/actores');
    actorHandler = (snapshot) => {
      actors = snapshot?.val?.() || {};
      queueHydration();
    };
    actorRef.on?.('value', actorHandler);
  }

  function unpatchEngine() {
    if (typeof detachEngine === 'function') {
      try { detachEngine(); } catch (_) {}
    }
    detachEngine = null;
    currentEngine = null;
  }

  function patchEngine(engine) {
    if (!engine || engine === currentEngine || engine.__fieldStabilityHotfixV1) return engine;
    unpatchEngine();

    const canvas = engine.canvas;
    const camera = engine.camera;
    const originalEmitSemanticEvent = typeof engine.emitSemanticEvent === 'function'
      ? engine.emitSemanticEvent.bind(engine)
      : null;
    const originalCalculateVision = typeof engine.calculateVision === 'function'
      ? engine.calculateVision.bind(engine)
      : null;
    const originalSetZLayer = typeof engine.setZLayer === 'function'
      ? engine.setZLayer.bind(engine)
      : null;
    const originalCameraNotify = typeof camera?.notifyVisualChange === 'function'
      ? camera.notifyVisualChange.bind(camera)
      : null;

    let visionDirty = true;
    let cachedVision = null;
    let lastActiveZ = Number(engine.activeZ) || 0;

    if (originalEmitSemanticEvent) {
      engine.emitSemanticEvent = function fieldStableSemanticEvent(type, detail = {}, dirty = null) {
        let nextDirty = dirty;
        if (type === 'vtt:token-preview-moved'
          && (detail?.traversing === true || detail?.drag === true || detail?.remote === true)) {
          if (dirty && dirty.vision === true) metrics.traversalVisionSuppressions += 1;
          nextDirty = dirty ? { ...dirty, vision: false } : dirty;
        }
        return originalEmitSemanticEvent(type, detail, nextDirty);
      };
    }

    if (originalCalculateVision) {
      engine.calculateVision = function cachedFieldVision() {
        const activeZ = Number(engine.activeZ) || 0;
        if (activeZ !== lastActiveZ) {
          lastActiveZ = activeZ;
          visionDirty = true;
        }
        if (!visionDirty && cachedVision !== null) {
          metrics.visionCacheHits += 1;
          return cachedVision;
        }
        cachedVision = originalCalculateVision();
        visionDirty = false;
        metrics.visionRecomputes += 1;
        return cachedVision;
      };
    }

    if (originalSetZLayer) {
      engine.setZLayer = function fieldStableSetZLayer(z) {
        const before = Number(engine.activeZ) || 0;
        const result = originalSetZLayer(z);
        if ((Number(engine.activeZ) || 0) !== before) visionDirty = true;
        return result;
      };
    }

    if (camera && originalCameraNotify) {
      camera.notifyVisualChange = function fieldStableCameraNotify(kind, active = false, meta = null) {
        // Traversal already emits one token dirty pulse per RAF. Emitting a second
        // camera dirty pulse from centerOnWorldPoint doubles render pressure and
        // caused the field-test snowball on long paths.
        if (kind === 'center' && engine.tokenMotion) {
          metrics.traversalCameraDirtySuppressions += 1;
          return undefined;
        }
        return originalCameraNotify(kind, active, meta);
      };
    }

    const onSceneDirty = (event) => {
      const detail = event?.detail || {};
      if (detail.vision === true) visionDirty = true;
      if (detail.reason === 'token') queueHydration();
    };
    const onCanonicalSync = () => {
      visionDirty = true;
      queueHydration();
    };
    canvas?.addEventListener?.('vtt:scene-dirty', onSceneDirty);
    canvas?.addEventListener?.('vtt:canonical-tokens-synced', onCanonicalSync);

    Object.defineProperty(engine, '__fieldStabilityHotfixV1', {
      configurable: true,
      value: true,
    });

    currentEngine = engine;
    metrics.enginesPatched += 1;
    ensureActorSubscription();
    queueHydration();

    detachEngine = () => {
      canvas?.removeEventListener?.('vtt:scene-dirty', onSceneDirty);
      canvas?.removeEventListener?.('vtt:canonical-tokens-synced', onCanonicalSync);
      if (engine.emitSemanticEvent?.name === 'fieldStableSemanticEvent' && originalEmitSemanticEvent) {
        engine.emitSemanticEvent = originalEmitSemanticEvent;
      }
      if (engine.calculateVision?.name === 'cachedFieldVision' && originalCalculateVision) {
        engine.calculateVision = originalCalculateVision;
      }
      if (engine.setZLayer?.name === 'fieldStableSetZLayer' && originalSetZLayer) {
        engine.setZLayer = originalSetZLayer;
      }
      if (camera?.notifyVisualChange?.name === 'fieldStableCameraNotify' && originalCameraNotify) {
        camera.notifyVisualChange = originalCameraNotify;
      }
      try { delete engine.__fieldStabilityHotfixV1; } catch (_) {}
    };

    return engine;
  }

  function ensureEngine() {
    const engine = runtime()?.engine || null;
    if (engine && engine !== currentEngine) patchEngine(engine);
    return engine;
  }

  function suspendRawDragFollow() {
    const engine = ensureEngine();
    if (!engine?.tokenDrag || dragFollowState) return false;
    dragFollowState = {
      engine,
      enabled: Boolean(engine.cameraFollowActive),
    };
    if (dragFollowState.enabled) {
      engine.cameraFollowActive = false;
      metrics.rawDragFollowSuspends += 1;
    }
    return true;
  }

  function restoreRawDragFollow() {
    const state = dragFollowState;
    dragFollowState = null;
    if (!state?.engine) return false;
    // Restore only the performance hint. CameraFollow remains the authority for
    // enabled/disabled state and will continue following confirmed traversal.
    state.engine.cameraFollowActive = Boolean(state.enabled);
    return true;
  }

  const onMouseDown = () => {
    ensureEngine();
    // Engine creates tokenDrag on the canvas target before this window bubble
    // listener runs. A microtask also covers alternate listener ordering.
    const schedule = root?.queueMicrotask?.bind(root) || ((fn) => Promise.resolve().then(fn));
    schedule(suspendRawDragFollow);
  };
  const onMouseUp = () => restoreRawDragFollow();
  const onBlur = () => restoreRawDragFollow();
  const onFocus = () => ensureEngine();

  root?.addEventListener?.('mousedown', onMouseDown, false);
  root?.addEventListener?.('mouseup', onMouseUp, false);
  root?.addEventListener?.('blur', onBlur, false);
  root?.addEventListener?.('focus', onFocus, false);

  // Runtime is usually published shortly after renderer construction. Poll only
  // during bootstrap; user interaction/focus calls ensureEngine afterward.
  let attempts = 0;
  const timerApi = root?.setInterval?.bind(root) || setInterval;
  const clearTimerApi = root?.clearInterval?.bind(root) || clearInterval;
  pollTimer = timerApi(() => {
    attempts += 1;
    ensureEngine();
    if (currentEngine || attempts >= 120) {
      clearTimerApi(pollTimer);
      pollTimer = null;
    }
  }, 50);

  const api = Object.freeze({
    __v1: true,
    ensure: ensureEngine,
    hydratePlayerIcons: () => hydratePlayerIcons(ensureEngine()),
    snapshot: () => Object.freeze({
      ...metrics,
      enginePatched: Boolean(currentEngine),
      rawDragFollowSuspended: Boolean(dragFollowState),
      actorRecords: Object.keys(actors || {}).length,
    }),
    stop() {
      if (stopped) return false;
      stopped = true;
      restoreRawDragFollow();
      if (pollTimer != null) clearTimerApi(pollTimer);
      pollTimer = null;
      root?.removeEventListener?.('mousedown', onMouseDown, false);
      root?.removeEventListener?.('mouseup', onMouseUp, false);
      root?.removeEventListener?.('blur', onBlur, false);
      root?.removeEventListener?.('focus', onFocus, false);
      unpatchEngine();
      if (actorRef && actorHandler) actorRef.off?.('value', actorHandler);
      actorRef = null;
      actorHandler = null;
      actors = {};
      if (root.LuminousVttFieldStabilityHotfix === api) delete root.LuminousVttFieldStabilityHotfix;
      return true;
    },
  });

  root.LuminousVttFieldStabilityHotfix = api;
  return api;
}

if (typeof window !== 'undefined') installFieldStabilityHotfix(window);
