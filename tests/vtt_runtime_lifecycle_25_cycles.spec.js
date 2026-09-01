const { test, expect } = require('@playwright/test');
const lifecycleApi = require('../js/vtt/runtime-lifecycle.js');

function engineStub() {
  return {
    isRunning: false,
    isExporting: false,
    activeZ: 0,
    tokenDrag: null,
    tokenMotion: null,
    handleResize() {},
    handleTokenMouseDown() {},
    handleTokenMouseMove() {},
    handleTokenMouseUp() {},
    cancelTokenMotion() { this.tokenMotion = null; return true; },
    calculateVision() { return null; },
    renderer: { render() {} },
    canvas: {
      style: { cursor: 'default' },
      removeEventListener() {},
    },
    camera: { destroy() {} },
  };
}

test('25 lifecycle cycles leave no active RAF or live Engine behind', async () => {
  const previousRuntime = globalThis.LuminousVttRuntime;
  const previousGuard = globalThis.LuminousVttPerformanceGuard;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCaf = globalThis.cancelAnimationFrame;
  const previousRemove = globalThis.removeEventListener;

  let nextFrameId = 1;
  const frames = new Map();
  let guardStops = 0;

  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.removeEventListener = () => {};

  try {
    for (let cycle = 0; cycle < 25; cycle += 1) {
      const engine = engineStub();
      globalThis.LuminousVttRuntime = { engine };
      globalThis.LuminousVttPerformanceGuard = { stop() { guardStops += 1; } };

      const lifecycle = lifecycleApi.createLifecycle({ log: console });
      await Promise.resolve();

      expect(engine.__lifecycleHardened).toBe(true);
      expect(engine.start()).toBe(true);
      expect(engine.frameId).not.toBeNull();
      expect(frames.size).toBe(1);

      expect(lifecycle.dispose(`cycle-${cycle}`)).toBe(true);
      expect(engine.destroyed).toBe(true);
      expect(engine.isRunning).toBe(false);
      expect(engine.frameId).toBeNull();
      expect(frames.size).toBe(0);
    }

    expect(guardStops).toBe(25);
  } finally {
    globalThis.LuminousVttRuntime = previousRuntime;
    globalThis.LuminousVttPerformanceGuard = previousGuard;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCaf;
    globalThis.removeEventListener = previousRemove;
  }
});
