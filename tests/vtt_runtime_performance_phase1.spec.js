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

function fakeEngine() {
  let pointerCalls = 0;
  let lastPointer = null;
  const engine = {
    canvas: { style: {}, addEventListener() {}, removeEventListener() {} },
    isRunning: false,
    isExporting: false,
    tokenDrag: null,
    tokenControlResolver: null,
    tokenMoveResolver: null,
    movementInteractionResolver: null,
    tokenMotion: null,
    camera: { destroy() {} },
    renderer: { render() {} },
    calculateVision() { return null; },
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
    counts: () => ({ pointerCalls, lastPointer }),
  };
}

test('token mousemove work is coalesced to the newest native event once per frame', () => {
  withFakeFrames(({ nextFrame }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);

    const first = { clientX: 10, clientY: 20, marker: 'first' };
    const second = { clientX: 30, clientY: 40, marker: 'second' };
    const latest = { clientX: 50, clientY: 60, marker: 'latest' };
    engine.handleTokenMouseMove(first);
    engine.handleTokenMouseMove(second);
    engine.handleTokenMouseMove(latest);

    expect(counts().pointerCalls).toBe(0);
    expect(engine.getInputPerformanceStats()).toEqual({
      pointerMovesReceived: 3,
      pointerMovesProcessed: 0,
      pointerMovesCoalesced: 2,
      pointerMovePending: true,
    });

    expect(nextFrame()).toBe(true);
    expect(counts().pointerCalls).toBe(1);
    expect(counts().lastPointer).toBe(latest);
    expect(engine.getInputPerformanceStats()).toEqual({
      pointerMovesReceived: 3,
      pointerMovesProcessed: 1,
      pointerMovesCoalesced: 2,
      pointerMovePending: false,
    });

    engine.destroy();
  });
});

test('stop cancels pending pointer work instead of processing stale drag input', () => {
  withFakeFrames(({ nextFrame }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);

    engine.handleTokenMouseMove({ clientX: 100, clientY: 200 });
    expect(engine.getInputPerformanceStats().pointerMovePending).toBe(true);

    engine.stop();
    expect(engine.getInputPerformanceStats().pointerMovePending).toBe(false);
    expect(nextFrame()).toBe(false);
    expect(counts().pointerCalls).toBe(0);
  });
});

test('destroy cancels pending pointer work and ignores later pointer input', () => {
  withFakeFrames(({ nextFrame }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);

    engine.handleTokenMouseMove({ clientX: 120, clientY: 220 });
    expect(engine.destroy()).toBe(true);
    expect(nextFrame()).toBe(false);
    expect(counts().pointerCalls).toBe(0);

    engine.handleTokenMouseMove({ clientX: 140, clientY: 240 });
    expect(engine.getInputPerformanceStats()).toEqual({
      pointerMovesReceived: 1,
      pointerMovesProcessed: 0,
      pointerMovesCoalesced: 0,
      pointerMovePending: false,
    });
  });
});
