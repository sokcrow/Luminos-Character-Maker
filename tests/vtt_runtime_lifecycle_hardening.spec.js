const { test, expect } = require('@playwright/test');

const lifecycleApi = require('../js/vtt/runtime-lifecycle.js');

function createEngineStub() {
  const canvasRemoved = [];
  let cameraDestroyCalls = 0;
  let renders = 0;
  let visionCalls = 0;
  let motionCancels = 0;

  const engine = {
    isRunning: true,
    isExporting: false,
    activeZ: 0,
    tokenDrag: { token: { id: 'p1' } },
    tokenMotion: { tokenId: 'p1' },
    tokenControlResolver() {},
    tokenMoveResolver() {},
    movementInteractionResolver() {},
    handleResize() {},
    handleTokenMouseDown() {},
    handleTokenMouseMove() {},
    handleTokenMouseUp() {},
    canvas: {
      style: { cursor: 'grabbing' },
      removeEventListener(name, fn) { canvasRemoved.push([name, fn]); },
    },
    camera: {
      destroy() { cameraDestroyCalls += 1; },
    },
    renderer: {
      render() { renders += 1; },
    },
    calculateVision() {
      visionCalls += 1;
      return { visible: true };
    },
    cancelTokenMotion() {
      motionCancels += 1;
      this.tokenMotion = null;
      return true;
    },
  };

  return {
    engine,
    canvasRemoved,
    cameraDestroyCalls: () => cameraDestroyCalls,
    renders: () => renders,
    visionCalls: () => visionCalls,
    motionCancels: () => motionCancels,
  };
}

test('hardened Engine owns exactly one RAF and stop cancels it', () => {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCaf = globalThis.cancelAnimationFrame;
  const frames = new Map();
  const cancelled = [];
  let nextFrameId = 1;

  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
    frames.delete(id);
  };

  const state = createEngineStub();
  try {
    lifecycleApi.hardenEngineRuntime(state.engine, { isDisposed: () => false });

    expect(state.engine.__lifecycleHardened).toBe(true);
    expect(state.engine.frameId).toBeNull();
    expect(state.engine.isRunning).toBe(false);

    const handoffId = [...frames.keys()][0];
    const handoff = frames.get(handoffId);
    frames.delete(handoffId);
    handoff();

    expect(state.engine.isRunning).toBe(true);
    expect(state.engine.frameId).not.toBeNull();
    const ownedFrameId = state.engine.frameId;
    expect(frames.has(ownedFrameId)).toBe(true);

    expect(state.engine.start()).toBe(false);
    expect(state.engine.frameId).toBe(ownedFrameId);

    const frame = frames.get(ownedFrameId);
    frames.delete(ownedFrameId);
    frame();
    expect(state.visionCalls()).toBe(1);
    expect(state.renders()).toBe(1);
    expect(state.engine.frameId).not.toBeNull();
    expect(state.engine.frameId).not.toBe(ownedFrameId);

    const pendingFrame = state.engine.frameId;
    expect(state.engine.stop()).toBe(true);
    expect(state.engine.isRunning).toBe(false);
    expect(state.engine.frameId).toBeNull();
    expect(cancelled).toContain(pendingFrame);
    expect(state.motionCancels()).toBe(1);
  } finally {
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCaf;
  }
});

test('Engine destroy is idempotent and owns listener/camera cleanup', () => {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCaf = globalThis.cancelAnimationFrame;
  const previousRemove = globalThis.removeEventListener;
  const removed = [];
  let nextFrameId = 1;

  globalThis.requestAnimationFrame = () => nextFrameId++;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.removeEventListener = (name, fn) => removed.push([name, fn]);

  const state = createEngineStub();
  state.engine.isRunning = false;
  try {
    lifecycleApi.hardenEngineRuntime(state.engine, { isDisposed: () => false });
    expect(state.engine.destroy()).toBe(true);
    expect(state.engine.destroy()).toBe(false);

    expect(state.engine.destroyed).toBe(true);
    expect(state.engine.isRunning).toBe(false);
    expect(state.engine.frameId).toBeNull();
    expect(state.cameraDestroyCalls()).toBe(1);
    expect(state.canvasRemoved.some(([name]) => name === 'mousedown')).toBe(true);
    expect(removed.map(([name]) => name)).toEqual(expect.arrayContaining(['resize', 'mousemove', 'mouseup']));
    expect(state.engine.tokenControlResolver).toBeNull();
    expect(state.engine.tokenMoveResolver).toBeNull();
    expect(state.engine.movementInteractionResolver).toBeNull();
    expect(state.engine.tokenDrag).toBeNull();
    expect(state.engine.tokenMotion).toBeNull();
    expect(state.engine.canvas.style.cursor).toBe('default');
  } finally {
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCaf;
    globalThis.removeEventListener = previousRemove;
  }
});

test('lifecycle dispose stops performance guard and destroys Engine exactly once', async () => {
  const previousRuntime = globalThis.LuminousVttRuntime;
  const previousGuard = globalThis.LuminousVttPerformanceGuard;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCaf = globalThis.cancelAnimationFrame;

  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  const state = createEngineStub();
  state.engine.isRunning = false;
  let guardStops = 0;
  globalThis.LuminousVttRuntime = { engine: state.engine };
  globalThis.LuminousVttPerformanceGuard = { stop() { guardStops += 1; } };

  try {
    const lifecycle = lifecycleApi.createLifecycle({ log: console });
    await Promise.resolve();

    expect(state.engine.__lifecycleHardened).toBe(true);
    expect(lifecycle.dispose('test-dispose')).toBe(true);
    expect(lifecycle.dispose('second-dispose')).toBe(false);
    expect(lifecycle.isDisposed()).toBe(true);
    expect(lifecycle.getReason()).toBe('test-dispose');
    expect(guardStops).toBe(1);
    expect(state.engine.destroyed).toBe(true);
    expect(state.cameraDestroyCalls()).toBe(1);
  } finally {
    globalThis.LuminousVttRuntime = previousRuntime;
    globalThis.LuminousVttPerformanceGuard = previousGuard;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCaf;
  }
});
