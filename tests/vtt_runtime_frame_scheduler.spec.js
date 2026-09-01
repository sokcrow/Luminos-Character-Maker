const { test, expect } = require('@playwright/test');
const lifecycleApi = require('../js/vtt/runtime-lifecycle.js');

function withFakeScheduler(run) {
  const previous = {
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    addEventListener: global.addEventListener,
    removeEventListener: global.removeEventListener,
    performance: Object.getOwnPropertyDescriptor(global, 'performance'),
  };

  let now = 0;
  let nextId = 1;
  const frames = [];
  const timers = [];

  global.requestAnimationFrame = (callback) => {
    const frame = { id: nextId++, callback, cancelled: false };
    frames.push(frame);
    return frame.id;
  };
  global.cancelAnimationFrame = (id) => {
    const frame = frames.find((entry) => entry.id === id);
    if (frame) frame.cancelled = true;
  };
  global.setTimeout = (callback, delay = 0) => {
    const timer = { id: nextId++, callback, dueAt: now + Math.max(0, Number(delay) || 0), cancelled: false };
    timers.push(timer);
    return timer.id;
  };
  global.clearTimeout = (id) => {
    const timer = timers.find((entry) => entry.id === id);
    if (timer) timer.cancelled = true;
  };
  global.addEventListener = () => {};
  global.removeEventListener = () => {};
  Object.defineProperty(global, 'performance', {
    configurable: true,
    value: { now: () => now },
  });

  const nextFrame = () => {
    while (frames.length) {
      const frame = frames.shift();
      if (frame.cancelled) continue;
      frame.callback(now);
      return true;
    }
    return false;
  };

  const flushDueTimers = () => {
    let ran = false;
    while (true) {
      const due = timers
        .filter((timer) => !timer.cancelled && timer.dueAt <= now)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
      if (!due) break;
      due.cancelled = true;
      due.callback();
      ran = true;
    }
    return ran;
  };

  const advance = (ms) => {
    now += Math.max(0, Number(ms) || 0);
    flushDueTimers();
  };

  try {
    return run({ frames, timers, nextFrame, advance, now: () => now });
  } finally {
    global.requestAnimationFrame = previous.requestAnimationFrame;
    global.cancelAnimationFrame = previous.cancelAnimationFrame;
    global.setTimeout = previous.setTimeout;
    global.clearTimeout = previous.clearTimeout;
    global.addEventListener = previous.addEventListener;
    global.removeEventListener = previous.removeEventListener;
    if (previous.performance) Object.defineProperty(global, 'performance', previous.performance);
    else delete global.performance;
  }
}

function fakeEngine() {
  let renders = 0;
  let visions = 0;
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
    renderer: { render() { renders += 1; } },
    calculateVision() { visions += 1; return { visible: true }; },
    cancelTokenMotion() {},
    handleResize() {},
    handleTokenMouseDown() {},
    handleTokenMouseMove() {},
    handleTokenMouseUp() {},
    loop() {},
  };
  return { engine, counts: () => ({ renders, visions }) };
}

test('idle engine schedules a delayed wake instead of chaining RAF forever', () => {
  withFakeScheduler(({ nextFrame, advance }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);
    engine.setFrameDelayResolver(() => 1000 / 15);

    expect(engine.start()).toBe(true);
    expect(nextFrame()).toBe(true);
    expect(counts()).toEqual({ renders: 1, visions: 1 });

    let stats = engine.getFrameSchedulerStats();
    expect(stats.delayedWakePending).toBe(true);
    expect(stats.delayedFramesScheduled).toBe(1);
    expect(stats.framesExecuted).toBe(1);

    advance(60);
    expect(nextFrame()).toBe(false);
    advance(7);
    expect(nextFrame()).toBe(true);
    expect(counts()).toEqual({ renders: 2, visions: 2 });

    stats = engine.getFrameSchedulerStats();
    expect(stats.framesExecuted).toBe(2);
    expect(stats.delayedFramesScheduled).toBe(2);
    engine.stop();
  });
});

test('explicit invalidation pulls an idle delayed wake forward immediately', () => {
  withFakeScheduler(({ nextFrame }) => {
    const { engine } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);
    engine.setFrameDelayResolver(() => 1000 / 15);
    engine.start();
    expect(nextFrame()).toBe(true);
    expect(engine.getFrameSchedulerStats().delayedWakePending).toBe(true);

    expect(engine.requestFrame({ immediate: true })).toBe(true);
    let stats = engine.getFrameSchedulerStats();
    expect(stats.delayedWakePending).toBe(false);
    expect(stats.framePending).toBe(true);
    expect(stats.immediateWakeups).toBe(1);

    expect(nextFrame()).toBe(true);
    stats = engine.getFrameSchedulerStats();
    expect(stats.framesExecuted).toBe(2);
    engine.stop();
  });
});

test('active cadence can pull idle wake earlier without repeated events postponing it', () => {
  withFakeScheduler(({ nextFrame, advance }) => {
    const { engine } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);
    engine.setFrameDelayResolver(() => 1000 / 15);
    engine.start();
    nextFrame();

    expect(engine.requestFrame({ immediate: false, delayMs: 1000 / 30 })).toBe(true);
    let stats = engine.getFrameSchedulerStats();
    expect(stats.delayedWakeupsPulledForward).toBe(1);

    advance(10);
    expect(engine.requestFrame({ immediate: false, delayMs: 1000 / 30 })).toBe(false);
    advance(24);
    expect(nextFrame()).toBe(true);

    stats = engine.getFrameSchedulerStats();
    expect(stats.framesExecuted).toBe(2);
    engine.stop();
  });
});

test('stop cancels delayed scheduler wake and prevents stale frames', () => {
  withFakeScheduler(({ nextFrame, advance }) => {
    const { engine, counts } = fakeEngine();
    lifecycleApi.hardenEngineRuntime(engine);
    engine.setFrameDelayResolver(() => 1000 / 15);
    engine.start();
    nextFrame();
    expect(engine.getFrameSchedulerStats().delayedWakePending).toBe(true);

    engine.stop();
    expect(engine.getFrameSchedulerStats().delayedWakePending).toBe(false);
    advance(1000);
    expect(nextFrame()).toBe(false);
    expect(counts()).toEqual({ renders: 1, visions: 1 });
  });
});
