const DEFAULT_ACTIVE_FRAME_MS = 1000 / 30;
const STATIC_SIGNATURE_TTL_MS = 100;

const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '');

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

export function createStaticSignatureCache(mapData, ttlMs = STATIC_SIGNATURE_TTL_MS) {
  let at = -Infinity;
  let value = '';
  let forceSerial = 0;
  return Object.freeze({
    invalidate() { forceSerial += 1; at = -Infinity; },
    value(now = performance.now()) {
      if ((now - at) < ttlMs) return value;
      at = now;
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

export function installPerformanceGuard({ runtime = globalThis.LuminousVttRuntime, activeFrameMs = DEFAULT_ACTIVE_FRAME_MS } = {}) {
  const engine = runtime?.engine;
  const renderer = engine?.renderer;
  const mapData = engine?.mapData;
  if (!engine || !renderer || !mapData || renderer.__performanceGuardInstalled) return null;

  const originalRender = renderer.render.bind(renderer);
  const signatureCache = createStaticSignatureCache(mapData);
  const metrics = { calls: 0, rendered: 0, skipped: 0, throttled: 0, lastRenderAt: 0 };
  let lastFingerprint = '';
  let lastRenderAt = -Infinity;
  let stopped = false;

  const invalidate = () => {
    lastFingerprint = '';
    signatureCache.invalidate();
  };

  const interactionInvalidate = () => {
    if (engine.tokenDrag || mapData.dmEditMode?.active) invalidate();
  };

  const events = [
    'vtt:token-moved',
    'vtt:token-z-transition',
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

  renderer.render = function guardedRender(...args) {
    metrics.calls += 1;
    const perfNow = globalThis.performance?.now?.() ?? Date.now();
    const wallNow = Date.now();
    const fingerprint = frameFingerprint({ engine, mapData, now: wallNow, staticSignature: signatureCache.value(perfNow) });
    const changed = fingerprint !== lastFingerprint;
    const active = Boolean(engine.tokenDrag) || hasActiveLightingAnimation(mapData, wallNow);

    if (!changed && !active) {
      metrics.skipped += 1;
      return;
    }
    if (active && (perfNow - lastRenderAt) < activeFrameMs) {
      metrics.throttled += 1;
      return;
    }

    lastFingerprint = fingerprint;
    lastRenderAt = perfNow;
    metrics.lastRenderAt = perfNow;
    metrics.rendered += 1;
    return originalRender(...args);
  };
  renderer.__performanceGuardInstalled = true;

  const api = Object.freeze({
    invalidate,
    snapshot: () => ({ ...metrics, savedFrames: metrics.skipped + metrics.throttled }),
    resetMetrics() { metrics.calls = 0; metrics.rendered = 0; metrics.skipped = 0; metrics.throttled = 0; metrics.lastRenderAt = 0; },
    stop() {
      if (stopped) return;
      stopped = true;
      renderer.render = originalRender;
      renderer.__performanceGuardInstalled = false;
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
