const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const sceneDirty = require('../js/vtt/scene-dirty.js');
const cameraFollow = require('../js/vtt/camera-follow.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

async function loadGuard() {
  global.LuminousVttSceneDirty = sceneDirty;
  const tmp = path.join(os.tmpdir(), `luminous-vtt-follow-performance-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

function eventTargetStub() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatchEvent(event) {
      for (const handler of [...(listeners.get(event.type) || [])]) handler(event);
      return true;
    },
  };
}

class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

test('followed traversal renders at display cadence while vision stays on the 20 Hz movement budget', async () => {
  const previousPerformance = Object.getOwnPropertyDescriptor(global, 'performance');
  let now = 0;
  Object.defineProperty(global, 'performance', { configurable: true, value: { now: () => now } });
  const { mod, tmp } = await loadGuard();
  try {
    let renders = 0;
    let visions = 0;
    let resolver = null;
    const canvas = eventTargetStub();
    const mapData = {
      grid: { cols: 20, rows: 20, size: 70 },
      tokens: [{ id: 'p1', x: 350, y: 350, zLayer: 0 }],
      topology: [], walls: [], verticalPortals: [],
      lighting: { scene: { sources: [], interiors: [], roofs: [], switches: [], transformers: [] } },
      dmEditMode: { active: false },
    };
    const renderer = { render() { renders += 1; } };
    const engine = {
      renderer,
      mapData,
      canvas,
      activeZ: 0,
      tokenDrag: null,
      tokenMotion: { tokenId: 'p1' },
      cameraFollowActive: true,
      camera: { x: 0, y: 0, zoom: 1, isDragging: false },
      calculateVision() { visions += 1; return { generation: visions }; },
      setFrameDelayResolver(next) { resolver = typeof next === 'function' ? next : null; },
      requestFrame() { return true; },
    };

    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });
    engine.calculateVision();
    renderer.render();
    for (let frame = 0; frame < 12; frame += 1) {
      now += 17;
      mapData.tokens[0].x += 1;
      sceneDirty.emit(canvas, { reason: 'token', render: true, vision: true, active: true, tokenId: 'p1' });
      engine.calculateVision();
      renderer.render();
    }

    expect(renders).toBeGreaterThanOrEqual(12);
    expect(visions).toBeLessThanOrEqual(5);
    expect(api.nextFrameDelayMs()).toBeCloseTo(1000 / 60, 3);
    expect(api.snapshot().movementFrameMs).toBeCloseTo(1000 / 20, 3);
    expect(api.snapshot().followMovementFrameMs).toBeCloseTo(1000 / 60, 3);

    engine.cameraFollowActive = false;
    expect(api.nextFrameDelayMs()).toBeCloseTo(1000 / 20, 3);
    api.stop();
    expect(resolver).toBeNull();
  } finally {
    fs.unlinkSync(tmp);
    if (previousPerformance) Object.defineProperty(global, 'performance', previousPerformance);
    else delete global.performance;
  }
});

test('confirmed traversal centers camera without emitting a follow state-change event every frame', () => {
  const canvas = eventTargetStub();
  const frames = [];
  const token = { id: 'p1', x: 100, y: 100, zLayer: 0, viewer: true };
  const mapData = { grid: { size: 70, distancePerCell: 5 }, tokens: [token], lighting: {} };
  const centers = [];
  const camera = {
    x: 0, y: 0, zoom: 1,
    setZoomBounds() {},
    setCenterConstraint() {},
    enforceCenterConstraint() { return false; },
    setManualPanListener(handler) { this.manualPan = handler; },
    centerOnWorldPoint(point) { centers.push({ ...point }); return true; },
  };
  const engine = { camera, canvas, mapData, cameraFollowActive: false };
  const runtime = { engine, bridge: { isDm: false } };
  const host = {
    LuminousVttRuntime: runtime,
    CustomEvent: FakeCustomEvent,
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout(callback) { callback(); return 1; },
    addEventListener() {},
    removeEventListener() {},
  };

  let followEvents = 0;
  canvas.addEventListener('vtt:camera-follow-changed', () => { followEvents += 1; });
  const controller = cameraFollow.createController({ runtime, mapData, root: host });
  const baselineEvents = followEvents;
  const baselineCenters = centers.length;
  expect(engine.cameraFollowActive).toBe(true);

  for (let i = 0; i < 8; i += 1) {
    token.x += 5;
    canvas.dispatchEvent(new FakeCustomEvent('vtt:token-preview-moved', {
      detail: { tokenId: 'p1', traversing: true },
    }));
    const frame = frames.shift();
    frame?.();
  }

  expect(centers.length).toBeGreaterThan(baselineCenters);
  expect(followEvents).toBe(baselineEvents);

  controller.toggle();
  expect(engine.cameraFollowActive).toBe(false);
  expect(followEvents).toBe(baselineEvents + 1);
  controller.stop();
  expect(engine.cameraFollowActive).toBe(false);
});
