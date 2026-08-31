const { test, expect } = require('@playwright/test');

class MockCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail || null; this.button = init.button ?? 0; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

class MockTarget {
  constructor() { this.listeners = new Map(); this.CustomEvent = MockCustomEvent; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatchEvent(event) { for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event); return true; }
}

function loadFollow() {
  delete require.cache[require.resolve('../js/vtt/camera-follow.js')];
  return require('../js/vtt/camera-follow.js');
}
function loadObserver() {
  delete require.cache[require.resolve('../js/vtt/dm-observer.js')];
  return require('../js/vtt/dm-observer.js');
}
function loadLighting() {
  delete require.cache[require.resolve('../js/vtt/lighting-engine.js')];
  return require('../js/vtt/lighting-engine.js');
}

function cameraHarness() {
  const centers = [];
  let constraint = null;
  return {
    centers,
    camera: {
      zoom: 1,
      centerOnWorldPoint(point) { centers.push({ x: Number(point.x), y: Number(point.y) }); return true; },
      setManualPanListener() {},
      setCenterConstraint(fn) { constraint = fn; },
      setZoomBounds() {},
      enforceCenterConstraint() { return false; },
      applyTransformSimple() {},
    },
    constraint: () => constraint,
  };
}

function hostFor(runtime) {
  const host = new MockTarget();
  host.LuminousVttRuntime = runtime;
  host.setTimeout = (fn) => { fn(); return 1; };
  host.setInterval = () => { throw new Error('POLLING_IS_FORBIDDEN'); };
  host.clearInterval = () => {};
  return host;
}

function event(type, detail = {}) { return new MockCustomEvent(type, { detail }); }

function playerToken(id, x, y, z = 0, extra = {}) {
  return { id, x, y, zLayer: z, gridPosition: { col: Math.floor(x / 70), row: Math.floor(y / 70), z }, canonicalScope: 'player', canonicalPlayerKey: id, playerId: id, ...extra };
}

test('field: P1 camera follows only P1 while seven remote tokens move', async () => {
  const followApi = loadFollow();
  const canvas = new MockTarget();
  const mapData = { grid: { size: 70, distancePerCell: 5 }, tokens: Array.from({ length: 8 }, (_, i) => playerToken(`p${i + 1}`, 100 + i * 50, 100, 0, { viewer: i === 0 })) };
  const harness = cameraHarness();
  const runtime = { bridge: { isDm: false }, engine: { canvas, camera: harness.camera }, lighting: { controlledViewers: () => [mapData.tokens.find((t) => t.viewer)] } };
  const host = hostFor(runtime);
  const controller = followApi.createController({ runtime, mapData, root: host });
  const initialCenters = harness.centers.length;

  for (let round = 0; round < 25; round += 1) {
    for (let i = 1; i < 8; i += 1) {
      mapData.tokens[i].x += 7;
      canvas.dispatchEvent(event('vtt:token-moved', { tokenId: `p${i + 1}` }));
    }
  }
  expect(harness.centers.length).toBe(initialCenters);

  mapData.tokens[0].x = 420;
  mapData.tokens[0].y = 315;
  canvas.dispatchEvent(event('vtt:token-moved', { tokenId: 'p1' }));
  expect(harness.centers.at(-1)).toEqual({ x: 420, y: 315 });
  expect(harness.centers.length).toBe(initialCenters + 1);
  controller.stop();
});

test('field: reconnect replaces the token object but camera follows canonical identity, not stale object reference', async () => {
  const followApi = loadFollow();
  const canvas = new MockTarget();
  const original = playerToken('p1', 140, 140, 0, { viewer: true });
  const mapData = { grid: { size: 70, distancePerCell: 5 }, tokens: [original] };
  const harness = cameraHarness();
  const runtime = { bridge: { isDm: false }, engine: { canvas, camera: harness.camera }, lighting: { controlledViewers: () => [mapData.tokens[0]] } };
  const host = hostFor(runtime);
  const controller = followApi.createController({ runtime, mapData, root: host });

  const replacement = playerToken('p1', 980, 560, 2, { viewer: true });
  mapData.tokens = [replacement];
  canvas.dispatchEvent(event('vtt:canonical-tokens-synced', { scope: 'players', tokenIds: ['p1'], viewerTokenId: 'p1' }));

  expect(controller.target()).toBe(replacement);
  expect(controller.target()).not.toBe(original);
  expect(controller.state().targetLayer).toBe(2);
  expect(harness.centers.at(-1)).toEqual({ x: 980, y: 560 });
  controller.stop();
});

test('field: regional/local and Z events recenter the same canonical player without a timer', async () => {
  const followApi = loadFollow();
  const canvas = new MockTarget();
  const p1 = playerToken('p1', 70, 70, 0, { viewer: true });
  const mapData = { grid: { size: 70, distancePerCell: 5 }, tokens: [p1] };
  const harness = cameraHarness();
  const runtime = { bridge: { isDm: false }, engine: { canvas, camera: harness.camera }, lighting: { controlledViewers: () => [p1] } };
  const controller = followApi.createController({ runtime, mapData, root: hostFor(runtime) });

  p1.x = 1260; p1.y = 210; p1.zLayer = 1; p1.gridPosition.z = 1;
  canvas.dispatchEvent(event('vtt:regional-local-transition-applied', { tokenId: 'p1' }));
  expect(harness.centers.at(-1)).toEqual({ x: 1260, y: 210 });
  expect(controller.state().targetLayer).toBe(1);

  p1.x = 1330; p1.y = 350; p1.zLayer = 2; p1.gridPosition.z = 2;
  canvas.dispatchEvent(event('vtt:token-z-transition', { tokenId: 'p1', complete: true, targetZ: 2 }));
  expect(harness.centers.at(-1)).toEqual({ x: 1330, y: 350 });
  expect(controller.state().targetLayer).toBe(2);
  controller.stop();
});

test('field: DM Free, Follow and View As are distinct and never mutate the observed player viewer flag', async () => {
  const followApi = loadFollow();
  const observerApi = loadObserver();
  const canvas = new MockTarget();
  const p4 = playerToken('p4', 700, 420, 1, { name: 'P4', viewer: false, facingDeg: 90 });
  const p7 = playerToken('p7', 350, 280, 0, { name: 'P7', viewer: false });
  const mapData = { grid: { size: 70, distancePerCell: 5 }, lighting: { dmPreviewTokenId: null }, tokens: [p4, p7] };
  const harness = cameraHarness();
  const layers = [];
  const runtime = { bridge: { isDm: true }, engine: { canvas, camera: harness.camera, activeZ: 0, setZLayer(z) { this.activeZ = z; } }, setLayer(z) { layers.push(z); this.engine.activeZ = z; } };
  const host = hostFor(runtime);
  const cameraFollow = followApi.createController({ runtime, mapData, root: host });
  const observer = observerApi.createController({ runtime, mapData, cameraFollow, root: host });

  expect(observer.state()).toMatchObject({ mode: 'free', targetTokenId: null });
  expect(mapData.lighting.dmPreviewTokenId).toBe(null);

  observer.follow('p4');
  expect(observer.state()).toMatchObject({ mode: 'follow', targetTokenId: 'p4', targetPlayerId: 'p4', targetLayer: 1 });
  expect(mapData.lighting.dmPreviewTokenId).toBe(null);
  expect(cameraFollow.state().enabled).toBe(true);
  expect(layers.at(-1)).toBe(1);
  expect(p4.viewer).toBe(false);

  observer.viewAs('p4');
  expect(observer.state().mode).toBe('view_as');
  expect(mapData.lighting.dmPreviewTokenId).toBe('p4');
  expect(cameraFollow.state().tokenRules).toBe(true);
  expect(p4.viewer).toBe(false);

  observer.free();
  expect(observer.state().mode).toBe('free');
  expect(mapData.lighting.dmPreviewTokenId).toBe(null);
  expect(cameraFollow.state().enabled).toBe(false);
  expect(p4.viewer).toBe(false);
  observer.stop(); cameraFollow.stop();
});

test('field: DM View As survives canonical replacement, follows new layer, and ignores unrelated player movement', async () => {
  const followApi = loadFollow();
  const observerApi = loadObserver();
  const canvas = new MockTarget();
  const p4 = playerToken('p4', 200, 200, 0, { viewer: false });
  const p7 = playerToken('p7', 300, 300, 0, { viewer: false });
  const mapData = { grid: { size: 70, distancePerCell: 5 }, lighting: {}, tokens: [p4, p7] };
  const harness = cameraHarness();
  const layers = [];
  const runtime = { bridge: { isDm: true }, engine: { canvas, camera: harness.camera, activeZ: 0 }, setLayer(z) { layers.push(z); this.engine.activeZ = z; } };
  const host = hostFor(runtime);
  const cameraFollow = followApi.createController({ runtime, mapData, root: host });
  const observer = observerApi.createController({ runtime, mapData, cameraFollow, root: host });
  observer.viewAs('p4');
  const beforeUnrelated = harness.centers.length;

  p7.x = 999;
  canvas.dispatchEvent(event('vtt:token-moved', { tokenId: 'p7' }));
  expect(harness.centers.length).toBe(beforeUnrelated);

  const replacement = playerToken('p4', 1120, 840, 3, { viewer: false });
  mapData.tokens = [replacement, p7];
  canvas.dispatchEvent(event('vtt:canonical-tokens-synced', { scope: 'players', tokenIds: ['p4', 'p7'] }));
  expect(observer.target()).toBe(replacement);
  expect(observer.state().targetLayer).toBe(3);
  expect(layers.at(-1)).toBe(3);
  expect(harness.centers.at(-1)).toEqual({ x: 1120, y: 840 });
  expect(mapData.lighting.dmPreviewTokenId).toBe('p4');
  observer.stop(); cameraFollow.stop();
});

test('field: eight-player observer switching stays single-target and event-driven', async () => {
  const followApi = loadFollow();
  const observerApi = loadObserver();
  const canvas = new MockTarget();
  const mapData = { grid: { size: 70, distancePerCell: 5 }, lighting: {}, tokens: Array.from({ length: 8 }, (_, i) => playerToken(`p${i + 1}`, i * 140, i * 70, i % 3, { viewer: false })) };
  const harness = cameraHarness();
  const runtime = { bridge: { isDm: true }, engine: { canvas, camera: harness.camera, activeZ: 0 }, setLayer(z) { this.engine.activeZ = z; } };
  const host = hostFor(runtime);
  const cameraFollow = followApi.createController({ runtime, mapData, root: host });
  const observer = observerApi.createController({ runtime, mapData, cameraFollow, root: host });

  for (let round = 0; round < 20; round += 1) {
    const id = `p${(round % 8) + 1}`;
    if (round % 3 === 0) observer.follow(id);
    else if (round % 3 === 1) observer.viewAs(id);
    else observer.free();
    const state = observer.state();
    if (state.mode === 'free') expect(state.targetTokenId).toBe(null);
    else expect(state.targetTokenId).toBe(id);
  }
  expect(mapData.tokens.filter((token) => token.viewer === true)).toHaveLength(0);
  observer.stop(); cameraFollow.stop();
});

test('field: canonical POV is a real 120 degree cone, not a circular placeholder', async () => {
  const lighting = loadLighting();
  expect(lighting.DEFAULT_VISION_CONE_DEG).toBe(120);
  const origin = { x: 0, y: 0 };
  const at = (deg) => ({ x: Math.cos(deg * Math.PI / 180) * 100, y: Math.sin(deg * Math.PI / 180) * 100 });
  expect(lighting.pointInCone(origin, at(50), 0, lighting.DEFAULT_VISION_CONE_DEG)).toBe(true);
  expect(lighting.pointInCone(origin, at(60), 0, lighting.DEFAULT_VISION_CONE_DEG)).toBe(true);
  expect(lighting.pointInCone(origin, at(70), 0, lighting.DEFAULT_VISION_CONE_DEG)).toBe(false);
  expect(lighting.pointInCone(origin, at(-70), 0, lighting.DEFAULT_VISION_CONE_DEG)).toBe(false);
});

test('field: camera/observer boot successfully when polling APIs throw', async () => {
  const followApi = loadFollow();
  const observerApi = loadObserver();
  const canvas = new MockTarget();
  const p1 = playerToken('p1', 100, 100, 0, { viewer: false });
  const mapData = { grid: { size: 70, distancePerCell: 5 }, lighting: {}, tokens: [p1] };
  const harness = cameraHarness();
  const runtime = { bridge: { isDm: true }, engine: { canvas, camera: harness.camera, activeZ: 0 }, setLayer() {} };
  const host = hostFor(runtime);
  expect(() => {
    const cameraFollow = followApi.createController({ runtime, mapData, root: host });
    const observer = observerApi.createController({ runtime, mapData, cameraFollow, root: host });
    observer.viewAs('p1');
    canvas.dispatchEvent(event('vtt:token-moved', { tokenId: 'p1' }));
    observer.stop(); cameraFollow.stop();
  }).not.toThrow();
});
