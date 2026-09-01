const DEFAULT_ACTIVE_FRAME_MS = 1000 / 30;
const DEFAULT_MOVEMENT_FRAME_MS = 1000 / 20;
const DEFAULT_IDLE_SCAN_MS = 1000 / 15;
const STATIC_SIGNATURE_TTL_MS = 100;

const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '');
const clockNow = () => globalThis.performance?.now?.() ?? Date.now();

function tokenSignature(tokens = []) {
  return (Array.isArray(tokens) ? tokens : []).map((token) => [
    token?.id,
    numberOr(token?.x),
    numberOr(token?.y),
    numberOr(token?.zLayer ?? token?.gridPosition?.z ?? token?.z?.[0]),
    numberOr(token?.elevationFt),
    numberOr(token?.lookDeg ?? token?.facingDeg),
    numberOr(token?.visionConeDeg),
    Boolean(token?.verticalMovement),
  ]);
}

function topologySignature(mapData = {}) {
  return (Array.isArray(mapData.topology) ? mapData.topology : []).map((element) => [
    element?.id,
    element?.type,
    element?.state,
    element?.zLayer ?? element?.z,
    element?.a?.col ?? element?.x1,
    element?.a?.row ?? element?.y1,
    element?.b?.col ?? element?.x2,
    element?.b?.row ?? element?.y2,
  ]);
}

function portalSignature(mapData = {}) {
  return (Array.isArray(mapData.verticalPortals) ? mapData.verticalPortals : []).map((portal) => [
    portal?.id,
    portal?.type,
    portal?.from?.z ?? portal?.fromZ,
    portal?.to?.z ?? portal?.toZ,
    portal?.state,
  ]);
}

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

export function createStaticSignatureCache(mapData, ttlMs = STATIC_SIGNATURE_TTL_MS, onScan = null) {
  let at = -Infinity;
  let value = '';
  let forceSerial = 0;
  return Object.freeze({
    invalidate() { forceSerial += 1; at = -Infinity; },
    value(now = clockNow()) {
      if ((now - at) < ttlMs) return value;
      at = now;
      const scanStartedAt = clockNow();
      const scene = mapData.lighting?.scene || {};
      value = JSON.stringify({
        serial: forceSerial,
        grid: [mapData.grid?.cols, mapData.grid?.rows, mapData.grid?.size, mapData.grid?.distancePerCell],
        topology: topologySignature(mapData),
        walls: (mapData.walls || []).map((wall) => [wall.id, wall.x1, wall.y1, wall.x2, wall.y2, wall.z, wall.blocksVision, wall.blocksMovement]),
        portals: portalSignature(mapData),
        lights: (scene.sources || []).map((source) => [source.id, source.x, source.y, source.zLayer, source.elevationFt, source.enabled, source.functional, source.brightFt, source.dimAdditionalFt, source.directionDeg, source.coneDeg, source.shape, source.color, source.motion?.startedAt, source.motion?.durationMs]),
        interiors: (scene.interiors || []).map((zone) => [zone.id, zone.x, zone.y, zone.w, zone.h, zone.zLayer, zone.roof, zone.transparent]),
        roofs: (scene.roofs || []).map((roof) => [roof.id, roof.x, roof.y, roof.w, roof.h, roof.zLayer, roof.elevationFt, roof.transparent]),
        switches: (scene.switches || []).map((entry) => [entry.id, entry.enabled, entry.state, entry.circuitId]),
        transformers: (scene.transformers || []).map((entry) => [entry.id, entry.enabled, entry.functional]),
        environment: mapData.lighting?.environment?.state || mapData.ambientLight || null,
        preview: [mapData.lighting?.dmPreviewTokenId || null, mapData.topologyPreview || null, mapData.verticalPortalEditor?.preview || null],
        chunk: mapData.procedural?.activeChunkSignature || mapData.procedural?.streaming?.activeChunk || null,
        edit: Boolean(mapData.dmEditMode?.active),
      });
      if (typeof onScan === 'function') {
        try { onScan(Math.max(0, clockNow() - scanStartedAt)); } catch (_) {}
      }
      return value;
    },
  });
}

export function frameFingerprint({ engine, mapData, now = Date.now(), staticSignature = '' } = {}) {
  const camera = engine?.camera || {};
  const activeZ = numberOr(engine?.activeZ);
  const animated = hasActiveLightingAnimation(mapData, now);
  return JSON.stringify({
    camera: [numberOr(camera.x), numberOr(camera.y), numberOr(camera.zoom, 1)],
    canvas: [engine?.canvas?.width || 0, engine?.canvas?.height || 0],
    z: activeZ,
    tokens: tokenSignature(mapData?.tokens),
    staticSignature,
    animationTick: animated ? Math.floor(now / DEFAULT_ACTIVE_FRAME_MS) : 0,
  });
}

export function installPerformanceGuard({
  runtime = globalThis.LuminousVttRuntime,
  activeFrameMs = DEFAULT_ACTIVE_FRAME_MS,
  movementFrameMs = DEFAULT_MOVEMENT_FRAME_MS,
  idleScanMs = DEFAULT_IDLE_SCAN_MS,
} = {}) {
  const engine = runtime?.engine;
  const renderer = engine?.renderer;
  const mapData = engine?.mapData;
  if (!engine || !renderer || !mapData || renderer.__performanceGuardInstalled) return null;

  const originalRender = renderer.render.bind(renderer);
  const originalCalculateVision = typeof engine.calculateVision === 'function' ? engine.calculateVision.bind(engine) : null;
  const idleInterval = Math.max(
    Math.max(1, Number(activeFrameMs) || DEFAULT_ACTIVE_FRAME_MS),
    Number(idleScanMs) || DEFAULT_IDLE_SCAN_MS,
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
    staticSignatureRequests: 0,
    staticSignatureScans: 0,
    staticSignatureDurationMs: 0,
    maxStaticSignatureDurationMs: 0,
    fingerprintCalls: 0,
    fingerprintDurationMs: 0,
    maxFingerprintDurationMs: 0,
  };
  const signatureCache = createStaticSignatureCache(mapData, STATIC_SIGNATURE_TTL_MS, (durationMs) => {
    metrics.staticSignatureScans += 1;
    metrics.staticSignatureDurationMs += durationMs;
    metrics.maxStaticSignatureDurationMs = Math.max(metrics.maxStaticSignatureDurationMs, durationMs);
  });
  let lastFingerprint = '';
  let lastRenderAt = -Infinity;
  let lastIdleScanAt = -Infinity;
  let lastVisionAt = -Infinity;
  let visionCache = null;
  let hasVisionCache = false;
  let renderDirty = true;
  let visionDirty = true;
  let stopped = false;

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
    signatureCache.invalidate();
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
        : Math.max(1, Number(idleScanMs) || DEFAULT_IDLE_SCAN_MS);
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

    // The lifecycle scheduler already targets these cadences. Keep these checks as a safety net
    // for explicit wakeups and runtimes that do not expose the adaptive scheduler yet.
    if (active && (perfNow - lastRenderAt) < activeInterval) {
      metrics.throttled += 1;
      return;
    }
    if (!active && !renderDirty && (perfNow - lastIdleScanAt) < idleInterval) {
      metrics.skipped += 1;
      return;
    }

    lastIdleScanAt = perfNow;
    metrics.staticSignatureRequests += 1;
    const staticSignature = signatureCache.value(perfNow);
    const fingerprintStartedAt = clockNow();
    const fingerprint = frameFingerprint({ engine, mapData, now: wallNow, staticSignature });
    const fingerprintDurationMs = Math.max(0, clockNow() - fingerprintStartedAt);
    metrics.fingerprintCalls += 1;
    metrics.fingerprintDurationMs += fingerprintDurationMs;
    metrics.maxFingerprintDurationMs = Math.max(metrics.maxFingerprintDurationMs, fingerprintDurationMs);
    const changed = renderDirty || fingerprint !== lastFingerprint;
    if (!changed && !active) {
      metrics.skipped += 1;
      return;
    }

    lastFingerprint = fingerprint;
    lastRenderAt = perfNow;
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
      avgStaticSignatureDurationMs: metrics.staticSignatureScans > 0
        ? metrics.staticSignatureDurationMs / metrics.staticSignatureScans
        : 0,
      avgFingerprintDurationMs: metrics.fingerprintCalls > 0
        ? metrics.fingerprintDurationMs / metrics.fingerprintCalls
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
      metrics.staticSignatureRequests = 0;
      metrics.staticSignatureScans = 0;
      metrics.staticSignatureDurationMs = 0;
      metrics.maxStaticSignatureDurationMs = 0;
      metrics.fingerprintCalls = 0;
      metrics.fingerprintDurationMs = 0;
      metrics.maxFingerprintDurationMs = 0;
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
