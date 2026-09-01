const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const sceneDirty = require('../js/vtt/scene-dirty.js');

async function loadGuard() {
  global.LuminousVttSceneDirty = sceneDirty;
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

function canvasStub() {
  const listeners = new Map();
  const canvas = {
    width: 1920,
    height: 1080,
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) {
      for (const fn of listeners.get(event?.type) || []) fn(event);
      return true;
    },
    emit(name, detail = {}) { return this.dispatchEvent({ type: name, detail }); },
  };
  return canvas;
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
  Object.defineProperty(global, 'performance', { configurable: true, value: { now: () => now } });
  try { return await run({ advance(ms) { now += Math.max(0, Number(ms) || 0); }, now: () => now }); }
  finally {
    if (previous) Object.defineProperty(global, 'performance', previous);
    else delete global.performance;
  }
}

test('direct canonical token dirty invalidates without using the legacy bridge', async () => {
  await withFakeClock(async () => {
    const { mod, tmp } = await loadGuard();
    try {
      let renders = 0;
      const canvas = canvasStub();
      const mapData = mapStub();
      const renderer = { render() { renders += 1; } };
      const engine = { renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null, tokenMotion: null };
      const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });

      renderer.render();
      for (let i = 0; i < 40; i += 1) renderer.render();
      expect(renders).toBe(1);
      expect(api.snapshot().fallbackScans).toBe(1);

      mapData.tokens[0].x += 70;
      sceneDirty.emit(canvas, { reason: 'token', render: true, vision: true, tokenId: 'p1', sourceEvent: 'vtt:token-moved' });
      renderer.render();
      const stats = api.snapshot();
      expect(renders).toBe(2);
      expect(stats.canonicalInvalidations).toBe(1);
      expect(stats.visionInvalidations).toBe(1);
      expect(stats.dirtyByReason.token).toBe(1);
      expect(stats.sceneDirtyBridge.bridgedEvents).toBe(0);
      api.stop();
    } finally { fs.unlinkSync(tmp); }
  });
});

test('render-only canonical camera dirty redraws without recalculating FOV', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let renders = 0;
    let visions = 0;
    const canvas = canvasStub();
    const mapData = mapStub();
    const renderer = { render() { renders += 1; } };
    const engine = {
      renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null, tokenMotion: null,
      calculateVision() { visions += 1; return { generation: visions }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });
    engine.calculateVision();
    renderer.render();
    expect(visions).toBe(1);
    expect(renders).toBe(1);

    sceneDirty.emit(canvas, { reason: 'camera', render: true, vision: false });
    engine.calculateVision();
    renderer.render();
    expect(visions).toBe(1);
    expect(renders).toBe(2);
    expect(api.snapshot().renderOnlyInvalidations).toBe(1);

    sceneDirty.emit(canvas, { reason: 'token', render: true, vision: true, tokenId: 'p1' });
    engine.calculateVision();
    renderer.render();
    expect(visions).toBe(2);
    expect(renders).toBe(3);
    expect(api.snapshot().visionInvalidations).toBe(1);
    api.stop();
  } finally { fs.unlinkSync(tmp); }
});

test('slow fallback still detects silent legacy in-place mutations', async () => {
  await withFakeClock(async ({ advance }) => {
    const { mod, tmp } = await loadGuard();
    try {
      let renders = 0;
      const wakeCalls = [];
      const canvas = canvasStub();
      const mapData = mapStub();
      const renderer = { render() { renders += 1; } };
      const engine = {
        renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null, tokenMotion: null,
        requestFrame(options) { wakeCalls.push(options); return true; },
      };
      const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } }, idleFallbackMs: 500 });
      renderer.render();
      advance(500);
      renderer.render();
      mapData.topology.push({ id: 'legacy-door', type: 'door', state: 'closed' });
      advance(500);
      renderer.render();
      expect(api.snapshot().fallbackChanges).toBe(1);
      expect(wakeCalls.at(-1)).toMatchObject({ immediate: true, delayMs: 0 });
      expect(renders).toBe(1);
      renderer.render();
      expect(renders).toBe(2);
      api.stop();
    } finally { fs.unlinkSync(tmp); }
  });
});

test('active token traversal keeps 20 Hz guard budget through direct canonical dirty events', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let renders = 0;
    let visions = 0;
    const canvas = canvasStub();
    const mapData = mapStub();
    const renderer = { render() { renders += 1; } };
    const engine = {
      renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null,
      tokenMotion: { tokenId: 'p1' },
      calculateVision() { visions += 1; return { visible: true }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });
    for (let frame = 0; frame < 120; frame += 1) {
      mapData.tokens[0].x += 0.5;
      sceneDirty.emit(canvas, { reason: 'token', render: true, vision: true, active: true, tokenId: 'p1', sourceEvent: 'vtt:token-preview-moved' });
      engine.calculateVision();
      renderer.render();
    }
    const stats = api.snapshot();
    expect(visions).toBeLessThan(20);
    expect(renders).toBeLessThan(20);
    expect(stats.movementFrameMs).toBeCloseTo(50, 4);
    expect(stats.fallbackScans).toBe(0);
    expect(stats.canonicalInvalidations).toBe(120);
    expect(stats.sceneDirtyBridge.bridgedEvents).toBe(0);
    api.stop();
  } finally { fs.unlinkSync(tmp); }
});

test('DM FREE remains omniscient without invoking Player FOV', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realVision = 0;
    const canvas = canvasStub();
    const mapData = mapStub();
    const engine = {
      renderer: { render() {} }, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null, tokenMotion: null,
      calculateVision() { realVision += 1; return { visible: false }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: true } } });
    expect(engine.calculateVision()).toMatchObject({ visible: true, dmOmniscient: true });
    expect(realVision).toBe(0);
    mapData.lighting.dmPreviewTokenId = 'p1';
    api.invalidate();
    expect(engine.calculateVision().dmOmniscient).not.toBe(true);
    expect(realVision).toBe(1);
    api.stop();
  } finally { fs.unlinkSync(tmp); }
});

test('adaptive cadence remains 30 Hz active, 20 Hz token motion, 500 ms idle', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    const canvas = canvasStub();
    const mapData = mapStub();
    let resolver = null;
    const wakeCalls = [];
    const engine = {
      renderer: { render() {} }, mapData, canvas,
      camera: { x: 0, y: 0, zoom: 1, isDragging: false }, activeZ: 0, tokenDrag: null, tokenMotion: null,
      calculateVision() { return { visible: true }; },
      setFrameDelayResolver(next) { resolver = typeof next === 'function' ? next : null; return Boolean(resolver); },
      requestFrame(options) { wakeCalls.push(options); return true; },
      getFrameSchedulerStats() { return { framesScheduled: 8, framesExecuted: 6 }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } }, idleFallbackMs: 500 });
    engine.calculateVision();
    engine.renderer.render();
    expect(api.nextFrameDelayMs()).toBeCloseTo(500, 4);
    engine.camera.isDragging = true;
    expect(api.nextFrameDelayMs()).toBeCloseTo(1000 / 30, 4);
    engine.tokenMotion = { tokenId: 'p1' };
    expect(api.nextFrameDelayMs()).toBeCloseTo(1000 / 20, 4);
    engine.tokenMotion = null;
    engine.camera.isDragging = false;
    sceneDirty.emit(canvas, { reason: 'camera', render: true, vision: false });
    expect(wakeCalls.at(-1)).toMatchObject({ immediate: true, delayMs: 0 });
    expect(api.snapshot().scheduler).toMatchObject({ framesScheduled: 8, framesExecuted: 6 });
    api.stop();
    expect(resolver).toBeNull();
  } finally { fs.unlinkSync(tmp); }
});

test('performance guard owns one canonical dirty listener instead of raw input listeners', () => {
  const source = read('js/vtt/performance-guard.js');
  expect(source).toContain("'vtt:scene-dirty'");
  expect(source).toContain('handleSceneDirty');
  expect(source).toContain('installLegacyBridge');
  expect(source).not.toContain("globalThis.addEventListener?.('wheel'");
  expect(source).not.toContain("globalThis.addEventListener?.('keydown'");
  expect(source).not.toContain("globalThis.addEventListener?.('keyup'");
  expect(source).not.toContain("globalThis.addEventListener?.('mousemove'");
  expect(source).not.toContain('createStaticSignatureCache');
  expect(source).not.toContain('frameFingerprint');
});

test('scene dirty loads before main and performance guard after lighting/fog', () => {
  const html = read('vtt.html');
  const dirty = html.indexOf('js/vtt/scene-dirty.js');
  const tokenPatch = html.indexOf('js/vtt/scene-dirty-token-state-patch.js');
  const main = html.indexOf('js/vtt/main.js');
  const lighting = html.indexOf('js/vtt/dynamic-lighting-bootstrap.js');
  const fog = html.indexOf('js/vtt/fog-memory-bootstrap.js');
  const guard = html.indexOf('js/vtt/performance-guard.js');
  expect(dirty).toBeGreaterThan(0);
  expect(tokenPatch).toBeGreaterThan(dirty);
  expect(main).toBeGreaterThan(tokenPatch);
  expect(lighting).toBeGreaterThan(main);
  expect(fog).toBeGreaterThan(lighting);
  expect(guard).toBeGreaterThan(fog);
});

test('performance guard parses as an ES module', () => {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-syntax-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});
