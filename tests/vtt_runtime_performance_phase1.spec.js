const { test, expect } = require('@playwright/test');
const lifecycleApi = require('../js/vtt/runtime-lifecycle.js');

function withFakeFrames(run) {
  const previous = {
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
    addEventListener: global.addEventListener,
    removeEventListener: global.removeEventListener,
  };
  const frames = [];
  let nextId = 1;
  global.requestAnimationFrame = (callback) => {
    const frame = { id: nextId++, callback, cancelled: false };
    frames.push(frame);
    return frame.id;
  };
  global.cancelAnimationFrame = (id) => {
    const frame = frames.find((entry) => entry.id === id);
    if (frame) frame.cancelled = true;
  };
  global.addEventListener = () => {};
  global.removeEventListener = () => {};

  const nextFrame = () => {
    while (frames.length) {
      const frame = frames.shift();
      if (frame.cancelled) continue;
      frame.callback(16.7);
      return true;
    }
    return false;
  };

  try {
    return run({ frames, nextFrame });
  } finally {
    global.requestAnimationFrame = previous.requestAnimationFrame;
    global.cancelAnimationFrame = previous.cancelAnimationFrame;
    global.addEventListener = previous.addEventListener;
    global.removeEventListener = previous.removeEventListener;
  }
}

function fakeCanvas() {
  const listeners = new Map();
  return {
    style: {},
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    },
  };
}

function fakeEngine() {
  const canvas = fakeCanvas();
  const viewer = { id: 'viewer', x: 100, y: 100, zLayer: 0, elevationFt: 0 };
  let visionCalls = 0;
  let renderCalls = 0;
  let pointerCalls = 0;
  let lastPointer = null;

  const engine = {
    canvas,
    mapData: {
      grid: { size: 70, distancePerCell: 5 },
      walls: [],
      topology: [],
      verticalPortals: [],
    },
    activeZ: 0,
    isRunning: false,
    isExporting: false,
    tokenDrag: null,
    tokenControlResolver: null,
    tokenMoveResolver: null,
    movementInteractionResolver: null,
    tokenMotion: null,
    camera: { destroy() {} },
    renderer: { render() { renderCalls += 1; } },
    viewerToken() { return viewer; },
    visionProfile() {
      return {
        visible: true,
        radiusPx: 420,
        monochrome: false,
        mode: 'normal',
        crossLayer: false,
        senses: { darkvisionFt: 60 },
      };
    },
    calculateVision() {
      visionCalls += 1;
      return { tokenPos: { x: viewer.x, y: viewer.y }, fovPolygon: [] };
    },
    cancelTokenMotion() {},
    handleResize() {},
    handleTokenMouseDown() {},
    handleTokenMouseMove(event) {
      pointerCalls += 1;
      lastPointer = event;
    },
    handleTokenMouseUp() {},
    loop() {},
  };

  return {
    engine,
    viewer,
    counts: () => ({ visionCalls, renderCalls, pointerCalls, lastPointer }),
  };
}

test('hardened VTT loop reuses vision while viewer and topology stay unchanged', () => {
  withFakeFrames(({ nextFrame }) => {
    const { engine, viewer, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);

    expect(engine.start()).toBe(true);
    expect(nextFrame()).toBe(true);
    expect(counts()).toMatchObject({ visionCalls: 1, renderCalls: 1 });

    expect(nextFrame()).toBe(true);
    expect(nextFrame()).toBe(true);
    expect(counts()).toMatchObject({ visionCalls: 1, renderCalls: 3 });

    viewer.x += 70;
    expect(nextFrame()).toBe(true);
    expect(counts()).toMatchObject({ visionCalls: 2, renderCalls: 4 });

    engine.mapData.topology = [{ id: 'door-1', type: 'door', state: 'closed' }];
    expect(nextFrame()).toBe(true);
    expect(counts()).toMatchObject({ visionCalls: 3, renderCalls: 5 });

    const stats = engine.getPerformanceStats();
    expect(stats.frames).toBe(5);
    expect(stats.visionCalculations).toBe(3);
    expect(stats.visionCacheHits).toBe(2);
    engine.stop();
  });
});

test('explicit vision invalidation forces a fresh visibility calculation', () => {
  withFakeFrames(({ nextFrame }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);
    engine.start();

    nextFrame();
    nextFrame();
    expect(counts().visionCalls).toBe(1);

    engine.invalidateVision();
    nextFrame();
    expect(counts().visionCalls).toBe(2);
    engine.stop();
  });
});

test('token mousemove work is coalesced to the newest pointer position once per frame', () => {
  withFakeFrames(({ nextFrame }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);

    engine.handleTokenMouseMove({ clientX: 10, clientY: 20 });
    engine.handleTokenMouseMove({ clientX: 30, clientY: 40 });
    engine.handleTokenMouseMove({ clientX: 50, clientY: 60 });

    expect(counts().pointerCalls).toBe(0);
    expect(nextFrame()).toBe(true);
    expect(counts().pointerCalls).toBe(1);
    expect(counts().lastPointer).toMatchObject({ clientX: 50, clientY: 60 });

    const stats = engine.getPerformanceStats();
    expect(stats.pointerMovesReceived).toBe(3);
    expect(stats.pointerMovesProcessed).toBe(1);
    engine.destroy();
  });
});
