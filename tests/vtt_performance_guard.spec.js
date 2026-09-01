const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

async function loadGuard() {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

function canvasStub() {
  const listeners = new Map();
  return {
    width: 1920,
    height: 1080,
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, detail = {}) { for (const fn of listeners.get(name) || []) fn({ type: name, detail }); },
  };
}

function mapStub() {
  return {
    grid: { cols: 40, rows: 40, size: 70, distancePerCell: 5 },
    tokens: [{ id: 'p1', x: 350, y: 350, zLayer: 0, lookDeg: 0, visionConeDeg: 120 }],
    topology: [], walls: [], verticalPortals: [],
    lighting: { scene: { sources: [], interiors: [], roofs: [], switches: [], transformers: [] }, environment: { state: { light: 'bright' } } },
    dmEditMode: { active: false },
  };
}

async function withFakeClock(run) {
  const previous = Object.getOwnPropertyDescriptor(global, 'performance');
  let now = 0;
  Object.defineProperty(global, 'performance', {
    configurable: true,
    value: { now: () => now },
  });
  try {
    return await run({ advance(ms) { now += Math.max(0, Number(ms) || 0); }, now: () => now });
  } finally {
    if (previous) Object.defineProperty(global, 'performance', previous);
    else delete global.performance;
  }
}

test('idle VTT uses dirty state: explicit invalidation redraws without scanning the map every wake', async () => {
  await withFakeClock(async () => {
    const { mod, tmp } = await loadGuard();
    try {
      let realRenders = 0;
      const canvas = canvasStub();
      const renderer = { render() { realRenders += 1; } };
      const mapData = mapStub();
      const engine = { renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null, tokenMotion: null };
      const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });
      expect(api).toBeTruthy();

      for (let i = 0; i < 120; i += 1) renderer.render();
      expect(realRenders).toBe(1);
      expect(api.snapshot().rendered).toBe(1);
      expect(api.snapshot().fallbackScans).toBe(1);
      expect(api.snapshot().skipped).toBe(119);

      mapData.tokens[0].x += 70;
      canvas.emit('vtt:token-moved', { tokenId: 'p1' });
      renderer.render();
      expect(realRenders).toBe(2);
      expect(api.snapshot().explicitInvalidations).toBeGreaterThanOrEqual(1);
      expect(api.snapshot().fallbackScans).toBe(1);

      mapData.topology.push({ id: 'door-1', type: 'door', state: 'closed', a: { col: 1, row: 1 }, b: { col: 2, row: 1 } });
      api.invalidate();
      renderer.render();
      expect(realRenders).toBe(3);
      expect(api.snapshot().fallbackScans).toBe(1);
      expect(api.snapshot().savedFrames).toBeGreaterThanOrEqual(119);

      api.stop();
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

test('slow fallback detects legacy in-place mutations that bypass canonical VTT events', async () => {
  await withFakeClock(async ({ advance }) => {
    const { mod, tmp } = await loadGuard();
    try {
      let realRenders = 0;
      const wakeCalls = [];
      const canvas = canvasStub();
      const renderer = { render() { realRenders += 1; } };
      const mapData = mapStub();
      const engine = {
        renderer,
        mapData,
        canvas,
        camera: { x: 0, y: 0, zoom: 1 },
        activeZ: 0,
        tokenDrag: null,
        tokenMotion: null,
        requestFrame(options) { wakeCalls.push(options); return true; },
      };
      const api = mod.installPerformanceGuard({
        runtime: { engine, bridge: { isDm: false } },
        idleFallbackMs: 500,
      });

      renderer.render();
      expect(realRenders).toBe(1);
      expect(api.snapshot().fallbackScans).toBe(1);

      advance(500);
      renderer.render();
      expect(api.snapshot().fallbackScans).toBe(2);
      expect(realRenders).toBe(1);

      mapData.topology.push({ id: 'legacy-door', type: 'door', state: 'closed' });
      advance(500);
      renderer.render();
      expect(api.snapshot().fallbackScans).toBe(3);
      expect(api.snapshot().fallbackChanges).toBe(1);
      expect(wakeCalls.at(-1)).toMatchObject({ immediate: true, delayMs: 0 });
      expect(realRenders).toBe(1);

      renderer.render();
      expect(realRenders).toBe(2);

      api.stop();
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

test('a short confirmed token traversal cannot recalculate FOV and render on every animation frame', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realRenders = 0;
    let realVision = 0;
    const canvas = canvasStub();
    const renderer = { render() { realRenders += 1; } };
    const mapData = mapStub();
    const engine = {
      renderer,
      mapData,
      canvas,
      camera: { x: 0, y: 0, zoom: 1 },
      activeZ: 0,
      tokenDrag: null,
      tokenMotion: { tokenId: 'p1' },
      calculateVision() { realVision += 1; return { visible: true, fovPolygon: [], visionRadius: 0 }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });

    for (let frame = 0; frame < 120; frame += 1) {
      mapData.tokens[0].x = 350 + (frame * (70 / 119));
      canvas.emit('vtt:token-preview-moved', { tokenId: 'p1', traversing: true });
      engine.calculateVision();
      renderer.render();
    }

    const stats = api.snapshot();
    expect(realVision).toBeLessThan(20);
    expect(realRenders).toBeLessThan(20);
    expect(stats.visionSaved).toBeGreaterThan(100);
    expect(stats.savedFrames).toBeGreaterThan(100);
    expect(stats.movementFrameMs).toBeCloseTo(50, 4);
    expect(stats.fallbackScans).toBe(0);
    api.stop();
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('DM FREE gets an omniscient render frame without invoking Player FOV calculation', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realVision = 0;
    const canvas = canvasStub();
    const renderer = { render() {} };
    const mapData = mapStub();
    const engine = {
      renderer,
      mapData,
      canvas,
      camera: { x: 0, y: 0, zoom: 1 },
      activeZ: 0,
      tokenDrag: null,
      tokenMotion: null,
      calculateVision() { realVision += 1; return { visible: false }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: true } } });
    const dmVision = engine.calculateVision();
    expect(realVision).toBe(0);
    expect(dmVision).toMatchObject({ visible: true, dmOmniscient: true, perceptionMode: 'dm-omniscient' });
    expect(dmVision.fovPolygon).toHaveLength(4);
    expect(dmVision.visionRadius).toBeGreaterThan(0);
    expect(api.snapshot().dmVisionBypassed).toBe(1);

    mapData.lighting.dmPreviewTokenId = 'p1';
    api.invalidate();
    const playerPov = engine.calculateVision();
    expect(realVision).toBe(1);
    expect(playerPov.dmOmniscient).not.toBe(true);
    api.stop();
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('idle dirty invalidation recomputes FOV immediately instead of waiting for the fallback interval', async () => {
  await withFakeClock(async ({ advance }) => {
    const { mod, tmp } = await loadGuard();
    try {
      let realVision = 0;
      const canvas = canvasStub();
      const renderer = { render() {} };
      const mapData = mapStub();
      const engine = {
        renderer,
        mapData,
        canvas,
        camera: { x: 0, y: 0, zoom: 1 },
        activeZ: 0,
        tokenDrag: null,
        tokenMotion: null,
        calculateVision() {
          realVision += 1;
          return { visible: true, generation: realVision };
        },
      };
      const api = mod.installPerformanceGuard({
        runtime: { engine, bridge: { isDm: false } },
        idleFallbackMs: 500,
      });

      const first = engine.calculateVision();
      expect(realVision).toBe(1);
      expect(first.generation).toBe(1);

      advance(10);
      api.invalidate();
      const second = engine.calculateVision();
      expect(realVision).toBe(2);
      expect(second.generation).toBe(2);

      api.stop();
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

test('performance guard reports dirty/fallback costs instead of fingerprint and static-signature churn', async () => {
  await withFakeClock(async ({ advance }) => {
    const { mod, tmp } = await loadGuard();
    try {
      let realRenders = 0;
      const canvas = canvasStub();
      const renderer = { render() { realRenders += 1; } };
      const mapData = mapStub();
      const engine = {
        renderer,
        mapData,
        canvas,
        camera: { x: 0, y: 0, zoom: 1 },
        activeZ: 0,
        tokenDrag: null,
        tokenMotion: null,
        getInputPerformanceStats() {
          return { pointerMovesReceived: 9, pointerMovesProcessed: 3, pointerMovesCoalesced: 6, pointerMovePending: false };
        },
      };
      const api = mod.installPerformanceGuard({
        runtime: { engine, bridge: { isDm: false } },
        idleFallbackMs: 500,
      });

      renderer.render();
      let stats = api.snapshot();
      expect(realRenders).toBe(1);
      expect(stats.fallbackScans).toBe(1);
      expect(stats.fallbackChanges).toBe(0);
      expect(stats.input).toEqual({ pointerMovesReceived: 9, pointerMovesProcessed: 3, pointerMovesCoalesced: 6, pointerMovePending: false });

      for (let i = 0; i < 20; i += 1) renderer.render();
      stats = api.snapshot();
      expect(stats.fallbackScans).toBe(1);

      advance(500);
      renderer.render();
      stats = api.snapshot();
      expect(stats.fallbackScans).toBe(2);
      expect(stats.fallbackDurationMs).toBeGreaterThanOrEqual(0);
      expect(stats.maxFallbackDurationMs).toBeGreaterThanOrEqual(0);
      expect(stats.avgFallbackDurationMs).toBeGreaterThanOrEqual(0);

      const scansBeforeExplicitChange = stats.fallbackScans;
      api.invalidate();
      renderer.render();
      stats = api.snapshot();
      expect(realRenders).toBe(2);
      expect(stats.explicitInvalidations).toBe(1);
      expect(stats.fallbackScans).toBe(scansBeforeExplicitChange);

      api.resetMetrics();
      stats = api.snapshot();
      expect(stats.explicitInvalidations).toBe(0);
      expect(stats.idleCleanSkips).toBe(0);
      expect(stats.fallbackScans).toBe(0);
      expect(stats.fallbackChanges).toBe(0);
      expect(stats.fallbackDurationMs).toBe(0);
      api.stop();
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

test('performance guard publishes adaptive active cadence, slow idle fallback, and scheduler metrics', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    const canvas = canvasStub();
    const renderer = { render() {} };
    const mapData = mapStub();
    let resolver = null;
    const wakeCalls = [];
    const engine = {
      renderer,
      mapData,
      canvas,
      camera: { x: 0, y: 0, zoom: 1, isDragging: false },
      activeZ: 0,
      tokenDrag: null,
      tokenMotion: null,
      calculateVision() { return { visible: true }; },
      setFrameDelayResolver(next) { resolver = typeof next === 'function' ? next : null; return Boolean(resolver); },
      requestFrame(options) { wakeCalls.push(options); return true; },
      getFrameSchedulerStats() { return { framesScheduled: 8, framesExecuted: 6, delayedWakePending: true }; },
    };
    const api = mod.installPerformanceGuard({
      runtime: { engine, bridge: { isDm: false } },
      idleFallbackMs: 500,
    });
    expect(resolver).toBeTruthy();

    engine.calculateVision();
    renderer.render();
    expect(api.nextFrameDelayMs()).toBeCloseTo(500, 4);

    engine.camera.isDragging = true;
    expect(api.nextFrameDelayMs()).toBeCloseTo(1000 / 30, 4);

    engine.tokenMotion = { tokenId: 'p1' };
    expect(api.nextFrameDelayMs()).toBeCloseTo(1000 / 20, 4);

    engine.tokenMotion = null;
    engine.camera.isDragging = false;
    api.invalidate();
    expect(wakeCalls.at(-1)).toMatchObject({ immediate: true, delayMs: 0 });

    const stats = api.snapshot();
    expect(stats.idleFrameMs).toBeCloseTo(500, 4);
    expect(stats.fallbackScanMs).toBeCloseTo(500, 4);
    expect(stats.scheduler).toMatchObject({ framesScheduled: 8, framesExecuted: 6, delayedWakePending: true });

    api.stop();
    expect(resolver).toBeNull();
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('performance guard loads after Dynamic Lighting and Fog Memory', () => {
  const html = read('vtt.html');
  const lighting = html.indexOf('js/vtt/dynamic-lighting-bootstrap.js');
  const fog = html.indexOf('js/vtt/fog-memory-bootstrap.js');
  const guard = html.indexOf('js/vtt/performance-guard.js');
  expect(lighting).toBeGreaterThan(0);
  expect(fog).toBeGreaterThan(lighting);
  expect(guard).toBeGreaterThan(fog);
});

test('performance guard keeps the legacy safety signature but removes per-wake fingerprint machinery', () => {
  const source = read('js/vtt/performance-guard.js');
  expect(source).toContain('legacyVisualSignature');
  expect(source).toContain('DEFAULT_IDLE_FALLBACK_MS = 500');
  expect(source).toContain('engine?.tokenMotion || engine?.tokenDrag || engine?.camera?.isDragging');
  expect(source).toContain('engine.setFrameDelayResolver?.(nextFrameDelayMs)');
  expect(source).toContain('engine.requestFrame?.({');
  expect(source).toContain('Idle visuals are event-driven');
  expect(source).not.toContain('createStaticSignatureCache');
  expect(source).not.toContain('frameFingerprint');
  expect(source).not.toContain('STATIC_SIGNATURE_TTL_MS');
});

test('performance guard parses as an ES module', () => {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-syntax-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});
