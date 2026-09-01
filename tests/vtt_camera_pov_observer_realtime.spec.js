const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'js', 'vtt', name), 'utf8');

class LocalEmitter {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatchEvent(event) {
    for (const fn of this.listeners.get(event.type) || []) fn(event);
    return true;
  }
}

class LocalCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; }
}

test('camera follow and HUD use event-driven sync with no polling timers', async () => {
  const follow = read('camera-follow.js');
  const hud = read('map-hud-bootstrap.js');
  expect(follow).not.toContain('setInterval');
  expect(hud).not.toContain('setInterval');
  expect(follow).toContain("'vtt:canonical-tokens-synced'");
  expect(follow).toContain("'vtt:regional-local-transition-applied'");
  expect(follow).toContain("'vtt:procedural-chunk-loaded'");
  expect(hud).toContain("'vtt:dm-observer-changed'");
  expect(hud).toContain("'vtt:canonical-tokens-synced'");
});

test('Player camera ignores drag preview and follows only confirmed post-drop traversal, coalesced to one camera update per frame', () => {
  delete require.cache[require.resolve('../js/vtt/camera-follow.js')];
  const cameraApi = require('../js/vtt/camera-follow.js');
  const canvas = new LocalEmitter();
  const frames = [];
  const centers = [];
  const token = { id: 'player-1', viewer: true, x: 35, y: 35, zLayer: 0, skills: { perception: 0 } };
  const mapData = { grid: { size: 70, distancePerCell: 5 }, tokens: [token], lighting: {} };
  const camera = {
    setZoomBounds() {}, setCenterConstraint() {}, enforceCenterConstraint() { return false; }, setManualPanListener() {},
    centerOnWorldPoint(point) { centers.push({ ...point }); return true; },
  };
  const engine = { canvas, camera, mapData };
  const runtime = { engine, bridge: { isDm: false } };
  const host = new LocalEmitter();
  host.CustomEvent = LocalCustomEvent;
  host.LuminousVttRuntime = runtime;
  host.setTimeout = () => 0;
  host.clearTimeout = () => {};
  host.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  host.cancelAnimationFrame = () => {};

  const controller = cameraApi.createController({ runtime, mapData, root: host });
  canvas.dispatchEvent({ type: 'vtt:token-preview-moved', detail: { tokenId: token.id, x: 70, y: 35 } });
  expect(frames).toHaveLength(0);
  expect(centers).toHaveLength(0);

  token.x = 70;
  canvas.dispatchEvent({ type: 'vtt:token-preview-moved', detail: { tokenId: token.id, traversing: true } });
  token.x = 84;
  canvas.dispatchEvent({ type: 'vtt:token-preview-moved', detail: { tokenId: token.id, traversing: true } });
  token.x = 105;
  canvas.dispatchEvent({ type: 'vtt:token-preview-moved', detail: { tokenId: token.id, traversing: true } });
  expect(frames).toHaveLength(1);
  frames.shift()(16);
  expect(centers).toEqual([{ x: 105, y: 35 }]);

  controller.stop();
});

test('DM observer is read-only local camera/POV state and never writes Realtime', async () => {
  const observer = read('dm-observer.js');
  expect(observer).not.toMatch(/firebase/i);
  expect(observer).not.toContain('.database(');
  expect(observer).not.toContain('.ref(');
  expect(observer).not.toContain('.transaction(');
  expect(observer).not.toContain('.update(');
  expect(observer).not.toContain('.set(');
  expect(observer).not.toMatch(/\.viewer\s*=(?!=)/);
  expect(observer).not.toContain('requestAnimationFrame');
  expect(observer).not.toContain('setInterval');
  expect(observer).toContain('mapData.lighting.dmPreviewTokenId = targetId');
  expect(observer).toContain('mapData.lighting.dmPreviewTokenId = null');
});

test('DM FREE is omniscient, normal token clicks remain gameplay clicks, and VIEW AS is explicit', () => {
  delete require.cache[require.resolve('../js/vtt/dm-observer.js')];
  const observerApi = require('../js/vtt/dm-observer.js');
  const canvas = new LocalEmitter();
  const agatha = { id: 'agatha', draggable: true, x: 35, y: 35, zLayer: 0 };
  const player = { id: 'player-2', canonicalScope: 'player', playerId: 'p2', draggable: true, x: 105, y: 35, zLayer: 0 };
  const mapData = { grid: { size: 70 }, tokens: [agatha, player], lighting: {}, dmEditMode: { active: false } };
  const renderer = { render() {}, ctx: null };
  const engine = {
    canvas,
    renderer,
    mapData,
    activeZ: 0,
    viewerToken() { return mapData.tokens[0]; },
    tokenAtEvent(event) { return event.token || null; },
    setZLayer(z) { this.activeZ = z; },
  };
  const runtime = { engine, bridge: { isDm: true }, setLayer(z) { engine.activeZ = z; } };
  const host = new LocalEmitter();
  host.CustomEvent = LocalCustomEvent;
  const cameraFollow = {
    setEnabled() {}, clearTarget() {}, setTarget() {},
  };
  const controller = observerApi.createController({ runtime, mapData, cameraFollow, root: host });

  expect(controller.state().mode).toBe(observerApi.MODES.FREE);
  expect(engine.viewerToken()).toBeNull();

  let prevented = false;
  let stopped = false;
  canvas.dispatchEvent({
    type: 'click', button: 0, token: player,
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
    stopImmediatePropagation() { stopped = true; },
  });
  expect(prevented).toBe(false);
  expect(stopped).toBe(false);
  expect(controller.state().mode).toBe(observerApi.MODES.FREE);
  expect(engine.viewerToken()).toBeNull();

  controller.select(observerApi.MODES.VIEW_AS);
  canvas.dispatchEvent({
    type: 'click', button: 0, token: player,
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
    stopImmediatePropagation() { stopped = true; },
  });
  expect(controller.state().mode).toBe(observerApi.MODES.VIEW_AS);
  expect(mapData.lighting.dmPreviewTokenId).toBe('player-2');
  expect(engine.viewerToken()).toBe(player);

  controller.free();
  expect(engine.viewerToken()).toBeNull();
  controller.stop();
  expect(engine.viewerToken()).toBe(agatha);
});

test('DM observer modes preserve full DM vision for Follow and activate player POV only for View As', async () => {
  const observer = read('dm-observer.js');
  expect(observer).toContain("FOLLOW: 'follow'");
  expect(observer).toContain("VIEW_AS: 'view_as'");
  expect(observer).toContain('mode = MODES.FOLLOW');
  expect(observer).toContain('mode = MODES.VIEW_AS');
  expect(observer).toContain('mapData.lighting.dmPreviewTokenId = targetId');
  expect(observer).toContain('cameraFollow.setTarget(targetId, { follow: true })');
  expect(observer).toContain('syncLayer(token)');
  expect(observer).toContain('if (!selectingMode || event.button !== 0');
  expect(observer).toContain('FREE CAMERA · OMNISCIENT DM');
});

test('DM free view draws only lightweight local player-cone outlines while exact View As uses existing lighting POV', async () => {
  const observer = read('dm-observer.js');
  const lighting = read('lighting-engine.js');
  expect(observer).toContain('function drawOutlines()');
  expect(observer).toContain('if (mode === MODES.VIEW_AS || stopped) return');
  expect(observer).toContain('lighting?.visionConeDeg?.(token)');
  expect(observer).toContain('|| 120');
  expect(observer).toContain('renderedAfter > renderedBefore');
  expect(lighting).toContain('const DEFAULT_VISION_CONE_DEG = 120');
  expect(lighting).toContain('pointInCone(viewer, point, facingDeg(viewer), visionConeDeg(viewer))');
});

test('canonical token reconnect emits a local sync event from the existing token-state callback', async () => {
  const main = read('main.js');
  expect(main).toContain('onTokensChanged: (change = {}) =>');
  expect(main).toContain("new EventCtor('vtt:canonical-tokens-synced'");
  expect(main).toContain('viewerTokenId');
  expect(main).not.toContain('vtt_camera_observer_requests');
});

test('observer does not create scheduler/calendar/world-state write surfaces', async () => {
  const combined = `${read('camera-follow.js')}\n${read('dm-observer.js')}\n${read('map-hud-bootstrap.js')}`;
  expect(combined).not.toContain('campaña/calendario');
  expect(combined).not.toContain('world_scheduler_requests');
  expect(combined).not.toContain('mapSimulationZones');
  expect(combined).not.toContain('playerDiscovery');
});
