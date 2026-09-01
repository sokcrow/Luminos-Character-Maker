const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const visibility = require('../js/vtt/visibility-mask-core.js');

class Emitter {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) || []) fn(event); return true; }
}
class LocalCustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; } }

test('visibility fingerprint ignores unrelated token motion but invalidates for viewer or vision blockers', () => {
  const viewer = { id: 'p1', x: 35, y: 35, zLayer: 0, lookDeg: 0, visionConeDeg: 120, senses: { darkvisionFt: 60 } };
  const base = {
    viewers: [viewer], viewZ: 0, lookUp: false,
    mapData: { tokens: [{ id: 'npc', x: 100, y: 100 }], topology: [{ id: 'd1', type: 'door', state: 'closed', zLayer: 0 }], walls: [], verticalPortals: [] },
    scene: { sources: [], interiors: [], roofs: [], switches: [], transformers: [] }, environment: { light: 'bright' }, motionTick: 0,
  };
  const first = visibility.visibilityFingerprint(base);
  const npcMoved = visibility.visibilityFingerprint({ ...base, mapData: { ...base.mapData, tokens: [{ id: 'npc', x: 900, y: 900 }] } });
  const viewerMoved = visibility.visibilityFingerprint({ ...base, viewers: [{ ...viewer, x: 70 }] });
  const doorOpened = visibility.visibilityFingerprint({ ...base, mapData: { ...base.mapData, topology: [{ id: 'd1', type: 'door', state: 'open', zLayer: 0 }] } });
  expect(npcMoved).toBe(first);
  expect(viewerMoved).not.toBe(first);
  expect(doorOpened).not.toBe(first);
});

test('visibility mask core quantizes look to 2 degrees and converts visible tiles into Fog cells', () => {
  expect(visibility.quantizeAngleDeg(13.1)).toBe(14);
  expect(visibility.quantizeAngleDeg(359.4)).toBe(0);
  expect(visibility.meaningfulAngleChange(10, 10.8)).toBe(false);
  expect(visibility.meaningfulAngleChange(10, 12.1)).toBe(true);
  const cells = visibility.cellsFromTiles([
    { x: 0, y: 0, w: 35, h: 35 },
    { x: 70, y: 70, w: 35, h: 35 },
  ], { grid: { size: 70, cols: 4, rows: 4 } }, (col, row) => `${col}:${row}`);
  expect([...cells].sort()).toEqual(['0:0', '1:1']);
});

test('POV mouse updates are quantized/throttled while buttons rotate View immediately', () => {
  const visibilityPath = require.resolve('../js/vtt/visibility-mask-core.js');
  const controllerPath = require.resolve('../js/vtt/pov-controller.js');
  delete require.cache[visibilityPath]; delete require.cache[controllerPath];
  const visibilityApi = require(visibilityPath);
  const controllerApi = require(controllerPath);
  const canvas = new Emitter();
  const host = new Emitter();
  let now = 0;
  const timers = [];
  const token = { id: 'p1', x: 0, y: 0, zLayer: 0, lookDeg: 0, facingDeg: 0 };
  host.CustomEvent = LocalCustomEvent;
  host.performance = { now: () => now };
  host.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return timers.length; };
  host.clearTimeout = () => {};
  host.LuminousVttVisibilityMaskCore = visibilityApi;
  host.LuminousVttPovEngine = {
    angleToPointDeg(_token, point) { return point.angle; },
    normalizeAngleDeg: visibilityApi.normalizeAngleDeg,
    nextLayer() { return null; },
    pointInRect() { return false; },
    normalizeRect(v) { return v; },
    elevationForLayer() { return 0; },
    DEFAULT_CEILING_HEIGHT_FT: 10,
  };
  const controller = controllerApi.createController({
    canvas, engine: { activeZ: 0, mapData: {}, camera: {} },
    mapData: { grid: { size: 70, cols: 10, rows: 10 }, lighting: { scene: { roofs: [] } }, tokens: [token], pov: {} },
    stateBridge: { saveLook: async () => {} }, getControlledViewers: () => [token], root: host,
  });
  controller.updateLookFromPoint({ angle: 1.1 });
  expect(token.lookDeg).toBe(2);
  now = 10;
  controller.updateLookFromPoint({ angle: 3.1 });
  expect(token.lookDeg).toBe(2);
  expect(timers.length).toBeGreaterThan(0);
  now = 50;
  timers.at(-1).fn();
  expect(token.lookDeg).toBe(4);
  controller.rotateLook(15);
  expect(token.lookDeg).toBe(20);
  controller.stop();
});

test('Dynamic Lighting owns the mask once and Fog Memory reuses it instead of solving every cell again', () => {
  const lighting = read('js/vtt/dynamic-lighting-bootstrap.js');
  const fog = read('js/vtt/fog-memory-bootstrap.js');
  expect(lighting).toContain("import './visibility-mask-core.js'");
  expect(lighting).toContain('function visibilityMask(');
  expect(lighting).toContain('const offscreenCache = { canvas: null');
  expect(lighting).toContain('const offscreen = ensureOffscreen()');
  expect(lighting).not.toContain("const offscreen = document.createElement('canvas')");
  expect(fog).toContain('runtime.lighting.visibilityMask(viewers, zLayer');
  expect(fog).toContain('visibility.cellsFromTiles(mask.tiles');
  expect(fog).not.toContain('runtime.lighting.perceptionAtPoint?.(viewer, point)');
  expect(fog).not.toContain('for (let row = 0; row < rows; row += 1)');
});

test('Player render only draws a compact look indicator; full cone/radius geometry remains DM/debug responsibility', () => {
  const renderer = read('js/vtt/pov-renderer.js');
  const controller = read('js/vtt/pov-controller.js');
  expect(renderer).toContain('if (options.isDm && !debug) return');
  expect(renderer).toContain('if (!debug && !isViewer) continue');
  expect(controller).toContain('VIEW ◀');
  expect(controller).toContain('VIEW ▶');
  expect(controller).toContain("event.code === 'BracketLeft'");
  expect(controller).toContain("event.code === 'BracketRight'");
  expect(controller).toContain('LOOK_THROTTLE_MS');
});
