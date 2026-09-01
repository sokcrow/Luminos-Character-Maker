const DEFAULT_ACTIVE_FRAME_MS = 1000 / 30;
const DEFAULT_MOVEMENT_FRAME_MS = 1000 / 20;
const DEFAULT_IDLE_FALLBACK_MS = 500;

const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '');
const clockNow = () => globalThis.performance?.now?.() ?? Date.now();

function hasActiveLightingAnimation(mapData = {}, now = Date.now()) {
  const sources = mapData.lighting?.scene?.sources || [];
  const light = globalThis.LuminousVttLightingEngine;
  return sources.some((source) => {
    if (source?.motion) {
      if (light?.interpolateMotion) {
        try { if (!light.interpolateMotion(source.motion, now)?.complete) return true; } catch (_) { return true; }
      } else return true;
    }
    return Boolean(source?.flicker || source?.visualFlicker || source?.animated);
  });
}

function isDmRuntime(runtime = {}) {
  return Boolean(runtime?.bridge?.isDm || runtime?.tokenState?.isDm || runtime?.tokenStateBridge?.isDm);
}

function dmFreeVision(runtime = {}, mapData = {}) {
  return isDmRuntime(runtime) && !clean(mapData?.lighting?.dmPreviewTokenId);
}

export function dmOmniscientVision(mapData = {}) {
  const size = Math.max(1, numberOr(mapData.grid?.size, 70));
  const width = Math.max(size, numberOr(mapData.grid?.cols, 1) * size);
  const height = Math.max(size, numberOr(mapData.grid?.rows, 1) * size);
  const center = { x: width / 2, y: height / 2 };
  return Object.freeze({
    visible: true,
    dmOmniscient: true,
    perceptionMode: 'dm-omniscient',
    crossLayer: false,
    monochrome: false,
    tokenPos: center,
    visionRadius: Math.hypot(width, height) + Math.max(width, height),
    fovPolygon: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    senses: { dmOmniscient: true },
  });
}

function visualAnimationActive(engine, mapData, now = Date.now()) {
  return Boolean(engine?.tokenMotion || engine?.tokenDrag || engine?.camera?.isDragging)
    || hasActiveLightingAnimation(mapData, now);
}

function activeFrameInterval(engine, activeFrameMs = DEFAULT_ACTIVE_FRAME_MS, movementFrameMs = DEFAULT_MOVEMENT_FRAME_MS) {
  if (engine?.tokenMotion) return Math.max(1, Number(movementFrameMs) || DEFAULT_MOVEMENT_FRAME_MS);
  return Math.max(1, Number(activeFrameMs) || DEFAULT_ACTIVE_FRAME_MS);
}

// Slow compatibility fallback for legacy mutations that do not yet emit a canonical VTT event.
// The normal render path never builds this signature.
export function legacyVisualSignature({ engine = {}, mapData = {} } = {}) {
  const scene = mapData.lighting?.scene || {};
  const camera = engine.camera || {};
  return JSON.stringify({
    camera: [numberOr(camera.x), numberOr(camera.y), numberOr(camera.zoom, 1)],
    canvas: [engine.canvas?.width || 0, engine.canvas?.height || 0],
    z: numberOr(engine.activeZ),
    grid: [mapData.grid?.cols, mapData.grid?.rows, mapData.grid?.size, mapData.grid?.distancePerCell],
    tokens: (mapData.tokens || []).map((token) => [
      token?.id,
      numberOr(token?.x),
      numberOr(token?.y),
      numberOr(token?.zLayer ?? token?.gridPosition?.z ?? token?.z?.[0]),
      numberOr(token?.elevationFt),
      numberOr(token?.lookDeg ?? token?.facingDeg),
      numberOr(token?.visionConeDeg),
      Boolean(token?.verticalMovement),
    ]),
    topology: (mapData.topology || []).map((element) => [
      element?.id,
      element?.type,
      element?.state,
      element?.zLayer ?? element?.z,
      element?.a?.col ?? element?.x1,
      element?.a?.row ?? element?.y1,
      element?.b?.col ?? element?.x2,
      element?.b?.row ?? element?.y2,
    ]),
    walls: (mapData.walls || []).map((wall) => [
      wall?.id, wall?.x1, wall?.y1, wall?.x2, wall?.y2, wall?.z, wall?.blocksVision, wall?.blocksMovement,
    ]),
    portals: (mapData.verticalPortals || []).map((portal) => [
      portal?.id, portal?.type, portal?.from?.z ?? portal?.fromZ, portal?.to?.z ?? portal?.toZ, portal?.state,
    ]),
    lights: (scene.sources || []).map((source) => [
      source?.id, source?.x, source?.y, source?.zLayer, source?.elevationFt, source?.enabled,
      source?.functional, source?.brightFt, source?.dimAdditionalFt, source?.directionDeg,
      source?.coneDeg, source?.shape, source?.color, source?.motion?.startedAt, source?.motion?.durationMs,
    ]),
    interiors: (scene.interiors || []).map((zone) => [
      zone?.id, zone?.x, zone?.y, zone?.w, zone?.h, zone?.zLayer, zone?.roof, zone?.transparent,
    ]),
    roofs: (scene.roofs || []).map((roof) => [
      roof?.id, roof?.x, roof?.y, roof?.w, roof?.h, roof?.zLayer, roof?.elevationFt, roof?.transparent,
    ]),
    switches: (scene.switches || []).map((entry) => [entry?.id, entry?.enabled, entry?.state, entry?.circuitId]),
    transformers: (scene.transformers || []).map((entry) => [entry?.id, entry?.enabled, entry?.functional]),
    environment: mapData.lighting?.environment?.state || mapData.ambientLight || null,
    preview: [
      mapData.lighting?.dmPreviewTokenId || null,
      mapData.topologyPreview || null,
      mapData.verticalPortalEditor?.preview || null,
    ],
    chunk: mapData.procedural?.activeChunkSignature || mapData.procedural?.streaming?.activeChunk || null,
    edit: Boolean(mapData.dmEditMode?.active),
  });
}

export function installPerformanceGuard({
  runtime = globalThis.LuminousVttRuntime,
  activeFrameMs = DEFAULT_ACTIVE_FRAME_MS,
  movementFrameMs = DEFAULT_MOVEMENT_FRAME_MS,
  idleFallbackMs = DEFAULT_IDLE_FALLBACK_MS,
} = {}) {
  const engine = runtime?.engine;
  const renderer = engine?.renderer;
  const mapData = engine?.mapData;
  if (!engine || !renderer || !mapData || renderer.__performanceGuardInstalled) return null;

  const originalRender = renderer.render.bind(renderer);
  const originalCalculateVision = typeof engine.calculateVision === 'function' ? engine.calculateVision.bind(engine) : null;
  const idleInterval = Math.max(
    Math.max(1, Number(activeFrameMs) || DEFAULT_ACTIVE_FRAME_MS),
    Number(idleFallbackMs) || DEFAULT_IDLE_FALLBACK_MS,
  );

  const metrics = {
    calls: 0,
    rendered: 0,
    skipped: 0,
    throttled: 0,
    lastRenderAt: 0,
    visionCalls: 0,
    visionComputed: 0,
    visionSkipped: 0,
    dmVisionBypassed: 0,
    explicitInvalidations: 0,
    idleCleanSkips: 0,
    fallbackScans: 0,
    fallbackChanges: 0,
    fallbackDurationMs: 0,
    maxFallbackDurationMs: 0,
  };

  let lastRenderAt = -Infinity;
  let lastFallbackScanAt = -Infinity;
  let lastFallbackSignature = '';
  let fallbackNeedsRebase = true;
  let lastVisionAt = -Infinity;
  let visionCache = null;
  let hasVisionCache = false;
  let renderDirty = true;
  let visionDirty = true;
  let stopped = false;

  const scanFallback = () => {
    const startedAt = clockNow();
    const signature = legacyVisualSignature({ engine, mapData });
    const durationMs = Math.max(0, clockNow() - startedAt);
    metrics.fallbackScans += 1;
    metrics.fallbackDurationMs += durationMs;
    metrics.maxFallbackDurationMs = Math.max(metrics.maxFallbackDurationMs, durationMs);
    return signature;
  };

  const nextFrameDelayMs = () => {
    if (stopped) return 0;
    const active = visualAnimationActive(engine, mapData, Date.now());
    if (active) return activeFrameInterval(engine, activeFrameMs, movementFrameMs);
    if (renderDirty || visionDirty) return 0;
    return idleInterval;
  };

  const wakeFrame = () => {
    const active = visualAnimationActive(engine, mapData, Date.now());
    engine.requestFrame?.({
      immediate: !active,
      delayMs: active ? activeFrameInterval(engine, activeFrameMs, movementFrameMs) : 0,
    });
  };

  const invalidate = () => {
    renderDirty = true;
    visionDirty = true;
    fallbackNeedsRebase = true;
    metrics.explicitInvalidations += 1;
    wakeFrame();
  };

  const interactionInvalidate = () => {
    if (engine.tokenDrag || engine.tokenMotion || engine.camera?.isDragging || mapData.dmEditMode?.active) invalidate();
  };

  const events = [
    'vtt:token-preview-moved',
    'vtt:token-moved',
    'vtt:token-z-transition',
    'vtt:canonical-tokens-synced',
    'vtt:camera-follow-changed',
    'vtt:dm-observer-changed',
    'vtt:procedural-chunk-loaded',
    'vtt:procedural-chunk-transition',
    'vtt:memory-learn',
  ];
  events.forEach((name) => engine.canvas?.addEventListener?.(name, invalidate));
  globalThis.addEventListener?.('resize', invalidate);
  globalThis.addEventListener?.('wheel', invalidate, { passive: true });
  globalThis.addEventListener?.('keydown', invalidate);
  globalThis.addEventListener?.('keyup', invalidate);
  globalThis.addEventListener?.('mousemove', interactionInvalidate, { passive: true });
  engine.setFrameDelayResolver?.(nextFrameDelayMs);

  if (originalCalculateVision) {
    engine.calculateVision = function guardedCalculateVision(...args) {
      metrics.visionCalls += 1;
      if (dmFreeVision(runtime, mapData)) {
        metrics.dmVisionBypassed += 1;
        visionCache = dmOmniscientVision(mapData);
        hasVisionCache = true;
        visionDirty = false;
        return visionCache;
      }

      const perfNow = clockNow();
      const wallNow = Date.now();
      const active = visualAnimationActive(engine, mapData, wallNow);
      const minimumInterval = active
        ? activeFrameInterval(engine, activeFrameMs, movementFrameMs)
        : idleInterval;
      if (hasVisionCache && (perfNow - lastVisionAt) < minimumInterval) {
        metrics.visionSkipped += 1;
        return visionCache;
      }
      if (hasVisionCache && !visionDirty && !active) {
        metrics.visionSkipped += 1;
        return visionCache;
      }

      visionCache = originalCalculateVision(...args);
      hasVisionCache = true;
      lastVisionAt = perfNow;
      visionDirty = false;
      metrics.visionComputed += 1;
      return visionCache;
    };
  }

  renderer.render = function guardedRender(...args) {
    metrics.calls += 1;
    const perfNow = clockNow();
    const wallNow = Date.now();
    const active = visualAnimationActive(engine, mapData, wallNow);
    const activeInterval = activeFrameInterval(engine, activeFrameMs, movementFrameMs);

    // Active visuals remain cadence-limited. Idle visuals are event-driven; the slow fallback
    // only protects legacy mutations that still bypass canonical VTT events.
    if (active && (perfNow - lastRenderAt) < activeInterval) {
      metrics.throttled += 1;
      return;
    }

    if (!active && !renderDirty) {
      if ((perfNow - lastFallbackScanAt) < idleInterval) {
        metrics.skipped += 1;
        metrics.idleCleanSkips += 1;
        return;
      }

      lastFallbackScanAt = perfNow;
      const fallbackSignature = scanFallback();
      if (fallbackNeedsRebase || !lastFallbackSignature) {
        lastFallbackSignature = fallbackSignature;
        fallbackNeedsRebase = false;
        metrics.skipped += 1;
        metrics.idleCleanSkips += 1;
        return;
      }

      if (fallbackSignature === lastFallbackSignature) {
        metrics.skipped += 1;
        metrics.idleCleanSkips += 1;
        return;
      }

      lastFallbackSignature = fallbackSignature;
      metrics.fallbackChanges += 1;
      renderDirty = true;
      visionDirty = true;
      wakeFrame();
      metrics.skipped += 1;
      return;
    }

    lastRenderAt = perfNow;
    if (!active) lastFallbackScanAt = perfNow;
    metrics.lastRenderAt = perfNow;
    metrics.rendered += 1;
    renderDirty = false;
    return originalRender(...args);
  };
  renderer.__performanceGuardInstalled = true;

  const api = Object.freeze({
    invalidate,
    nextFrameDelayMs,
    snapshot: () => ({
      ...metrics,
      savedFrames: metrics.skipped + metrics.throttled,
      visionSaved: metrics.visionSkipped + metrics.dmVisionBypassed,
      activeFrameMs: Math.max(1, Number(activeFrameMs) || DEFAULT_ACTIVE_FRAME_MS),
      movementFrameMs: Math.max(1, Number(movementFrameMs) || DEFAULT_MOVEMENT_FRAME_MS),
      idleFrameMs: idleInterval,
      fallbackScanMs: idleInterval,
      avgFallbackDurationMs: metrics.fallbackScans > 0
        ? metrics.fallbackDurationMs / metrics.fallbackScans
        : 0,
      input: typeof engine.getInputPerformanceStats === 'function'
        ? engine.getInputPerformanceStats()
        : null,
      scheduler: typeof engine.getFrameSchedulerStats === 'function'
        ? engine.getFrameSchedulerStats()
        : null,
    }),
    resetMetrics() {
      metrics.calls = 0;
      metrics.rendered = 0;
      metrics.skipped = 0;
      metrics.throttled = 0;
      metrics.lastRenderAt = 0;
      metrics.visionCalls = 0;
      metrics.visionComputed = 0;
      metrics.visionSkipped = 0;
      metrics.dmVisionBypassed = 0;
      metrics.explicitInvalidations = 0;
      metrics.idleCleanSkips = 0;
      metrics.fallbackScans = 0;
      metrics.fallbackChanges = 0;
      metrics.fallbackDurationMs = 0;
      metrics.maxFallbackDurationMs = 0;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      renderer.render = originalRender;
      renderer.__performanceGuardInstalled = false;
      if (originalCalculateVision) engine.calculateVision = originalCalculateVision;
      engine.setFrameDelayResolver?.(null);
      events.forEach((name) => engine.canvas?.removeEventListener?.(name, invalidate));
      globalThis.removeEventListener?.('resize', invalidate);
      globalThis.removeEventListener?.('wheel', invalidate);
      globalThis.removeEventListener?.('keydown', invalidate);
      globalThis.removeEventListener?.('keyup', invalidate);
      globalThis.removeEventListener?.('mousemove', interactionInvalidate);
    },
  });

  globalThis.LuminousVttPerformanceGuard = api;
  return api;
}

function startWhenReady() {
  let attempts = 0;
  const tryStart = () => {
    const runtime = globalThis.LuminousVttRuntime;
    if (runtime?.engine?.renderer) {
      installPerformanceGuard({ runtime });
      return;
    }
    attempts += 1;
    if (attempts < 80) globalThis.setTimeout?.(tryStart, 50);
  };
  queueMicrotask(tryStart);
}

if (typeof window !== 'undefined') startWhenReady();
