import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Camera } from '../js/vtt/camera.js';
import { WebGLWorldTransform } from '../js/vtt/render/world-transform.js';
import { WebGL2Renderer } from '../js/vtt/render/webgl2-renderer.js';
import '../js/vtt/camera-follow.js';
import '../js/vtt/dm-observer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) {
      const set = listeners.get(type) || new Set();
      set.add(handler);
      listeners.set(type, set);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      for (const handler of [...(listeners.get(event?.type) || [])]) handler(event);
      return true;
    },
  };
}

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

function makeCanvas({ logicalWidth = 1920, logicalHeight = 1080, dpr = 2, left = 100, top = 50 } = {}) {
  const target = eventTarget();
  return {
    ...target,
    width: logicalWidth * dpr,
    height: logicalHeight * dpr,
    clientWidth: logicalWidth,
    clientHeight: logicalHeight,
    style: {},
    getBoundingClientRect() {
      return { left, top, width: logicalWidth, height: logicalHeight, right: left + logicalWidth, bottom: top + logicalHeight };
    },
  };
}

function installDomStubs() {
  const win = eventTarget();
  win.CustomEvent = TestCustomEvent;
  win.setTimeout = (callback) => { callback(); return 1; };
  win.clearTimeout = () => {};
  win.requestAnimationFrame = (callback) => { callback(0); return 1; };
  win.cancelAnimationFrame = () => {};
  globalThis.window = win;
  globalThis.document = { body: {} };
  globalThis.CustomEvent = TestCustomEvent;
  return win;
}

test('CAM-01/02 worldToScreen y screenToWorld son inversas', () => {
  installDomStubs();
  const camera = new Camera(makeCanvas());
  camera.x = -237.25;
  camera.y = 91.5;
  camera.zoom = 2.35;

  const world = { x: 1337.125, y: 742.875 };
  const screen = camera.worldToScreen(world.x, world.y);
  const roundTrip = camera.screenToWorld(screen.x, screen.y);

  expect(roundTrip.x).toBeCloseTo(world.x, 10);
  expect(roundTrip.y).toBeCloseTo(world.y, 10);
  camera.destroy();
});

test('CAM-04/05 pan conserva desplazamiento visual bajo distintos zoom', () => {
  installDomStubs();
  const camera = new Camera(makeCanvas({ logicalWidth: 1600, logicalHeight: 900, dpr: 1 }));
  camera.zoom = 2;
  const point = { x: 500, y: 300 };
  const before = camera.worldToScreen(point.x, point.y);
  let manualPanCalls = 0;
  camera.setManualPanListener(() => { manualPanCalls += 1; });

  camera.onMouseDown({ button: 1, clientX: 100, clientY: 100, preventDefault() {} });
  camera.onMouseMove({ clientX: 200, clientY: 160 });
  camera.onMouseUp();

  const after = camera.worldToScreen(point.x, point.y);
  expect(camera.x).toBeCloseTo(50, 10);
  expect(camera.y).toBeCloseTo(30, 10);
  expect(after.x - before.x).toBeCloseTo(100, 10);
  expect(after.y - before.y).toBeCloseTo(60, 10);
  expect(manualPanCalls).toBe(1);
  camera.destroy();
});

test('CAM-08/09 viewport lógico no usa el framebuffer DPR como coordenada de juego', () => {
  installDomStubs();
  const canvas = makeCanvas({ logicalWidth: 1920, logicalHeight: 1080, dpr: 2 });
  const camera = new Camera(canvas);

  expect(canvas.width).toBe(3840);
  expect(camera.viewportSize()).toEqual({ width: 1920, height: 1080 });

  camera.zoom = 1.5;
  expect(camera.centerOnWorldPoint(700, 400)).toBe(true);
  const screen = camera.worldToScreen(700, 400);
  expect(screen.x).toBeCloseTo(960, 10);
  expect(screen.y).toBeCloseTo(540, 10);
  camera.destroy();
});

test('CAM-10 centerOnWorldPoint conserva firma Legacy (x,y) y firma nueva ({x,y})', () => {
  installDomStubs();
  const camera = new Camera(makeCanvas({ logicalWidth: 1600, logicalHeight: 900, dpr: 1 }));
  camera.zoom = 2;

  expect(camera.centerOnWorldPoint(300, 250)).toBe(true);
  expect(camera.worldToScreen(300, 250)).toEqual({ x: 800, y: 450 });

  expect(camera.centerOnWorldPoint({ x: 900, y: 650 })).toBe(true);
  expect(camera.worldToScreen(900, 650)).toEqual({ x: 800, y: 450 });
  camera.destroy();
});

test('CAM-06 zoom permanece anclado al cursor usando CSS pixels', () => {
  installDomStubs();
  const canvas = makeCanvas({ logicalWidth: 1920, logicalHeight: 1080, dpr: 2, left: 40, top: 25 });
  const camera = new Camera(canvas);
  camera.x = -150;
  camera.y = 75;
  camera.zoom = 1.25;

  const event = {
    clientX: 40 + 875,
    clientY: 25 + 460,
    deltaY: -100,
    preventDefault() {},
  };
  const before = camera.eventToWorld(event);
  camera.onWheel(event);
  const after = camera.eventToWorld(event);

  expect(after.x).toBeCloseTo(before.x, 10);
  expect(after.y).toBeCloseTo(before.y, 10);
  camera.destroy();
});

test('CAM-03 WebGL world transform conserva exactamente la matemática de Camera', () => {
  const transform = new WebGLWorldTransform();
  const camera = { x: -312.5, y: 47.25, zoom: 1.75 };
  const viewport = { width: 1920, height: 1080 };
  transform.sync(camera, viewport);

  const point = { x: 1400, y: 920 };
  const screen = transform.worldToScreen(point.x, point.y);
  const expectedScreen = {
    x: (point.x + camera.x) * camera.zoom,
    y: (point.y + camera.y) * camera.zoom,
  };
  expect(screen.x).toBeCloseTo(expectedScreen.x, 10);
  expect(screen.y).toBeCloseTo(expectedScreen.y, 10);

  const clip = transform.worldToClip(point.x, point.y);
  expect(clip.x).toBeCloseTo((expectedScreen.x / viewport.width) * 2 - 1, 10);
  expect(clip.y).toBeCloseTo(1 - (expectedScreen.y / viewport.height) * 2, 10);
});

test('CAM-15/16 DM observer ya no depende de CanvasRenderingContext2D', () => {
  const observer = read('js/vtt/dm-observer.js');
  const factory = read('js/vtt/render/renderer-factory.js');
  const adapter = read('js/vtt/render/dm-observer-overlay.js');
  const webgl = read('js/vtt/render/webgl2-renderer.js');

  expect(observer).not.toContain('renderer?.ctx');
  expect(observer).not.toContain('camera.applyTransformSimple?.(ctx)');
  expect(observer).toContain('renderer.drawDmObserverOutlines');
  expect(factory).toContain('installDmObserverOverlay(renderer)');
  expect(adapter).toContain("renderer.backend === 'canvas2d'");
  expect(webgl).toContain('drawDmObserverOutlines(outlines = [], camera = null)');
});

test('CAM-09 WebGL2 resize separa viewport lógico y framebuffer DPR', () => {
  const webgl = read('js/vtt/render/webgl2-renderer.js');
  expect(webgl).toContain('framebufferWidth = Math.max(1, Math.round(this.logicalViewport.width * this.devicePixelRatio))');
  expect(webgl).toContain('framebufferHeight = Math.max(1, Math.round(this.logicalViewport.height * this.devicePixelRatio))');
  expect(webgl).toContain('this.canvas.width = framebufferWidth');
  expect(webgl).toContain('this.canvas.height = framebufferHeight');
});

test('CAM-15 WebGL2 genera geometría world-space para el cono del observer', () => {
  const vertices = WebGL2Renderer.prototype.observerConeVertices.call({}, {
    x: 500,
    y: 300,
    radius: 140,
    coneDeg: 120,
    facingDeg: 0,
  });

  expect(vertices).toBeInstanceOf(Float32Array);
  expect(vertices.length).toBeGreaterThan(8);
  expect(vertices[0]).toBeCloseTo(500, 6);
  expect(vertices[1]).toBeCloseTo(300, 6);
  expect(vertices[vertices.length - 2]).toBeCloseTo(500, 6);
  expect(vertices[vertices.length - 1]).toBeCloseTo(300, 6);
});

test('CAM-20 Camera.destroy retira listeners registrados', () => {
  const win = installDomStubs();
  const canvas = makeCanvas();
  const camera = new Camera(canvas);

  expect(canvas.listeners.get('mousedown')?.size).toBe(1);
  expect(canvas.listeners.get('wheel')?.size).toBe(1);
  expect(win.listeners.get('mousemove')?.size).toBe(1);
  expect(win.listeners.get('mouseup')?.size).toBe(1);

  camera.destroy();

  expect(canvas.listeners.get('mousedown')?.size || 0).toBe(0);
  expect(canvas.listeners.get('wheel')?.size || 0).toBe(0);
  expect(win.listeners.get('mousemove')?.size || 0).toBe(0);
  expect(win.listeners.get('mouseup')?.size || 0).toBe(0);
});

test('CAM-05/08 Engine delega mouse, centrado y resize al contrato de Camera', () => {
  const engine = read('js/vtt/engine.js');

  expect(engine).toContain('return this.camera.eventToWorld(event);');
  expect(engine).not.toContain('return this.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);');
  expect(engine).toContain('this.camera.centerOnWorldPoint(mapWidth / 2, mapHeight / 2);');
  expect(engine).toContain("if (this.renderer?.backend === 'webgl2')");
  expect(engine).toContain('this.renderer.resize?.(width, height);');
  expect(engine).toContain('this.camera.centerOnWorldPoint(centerBefore);');
});

test('CAM-11/12 Camera Follow centra y libera follow al hacer pan manual', () => {
  const host = installDomStubs();
  const canvas = makeCanvas({ logicalWidth: 1600, logicalHeight: 900, dpr: 1 });
  const camera = new Camera(canvas);
  const token = { id: 'player-1', x: 720, y: 410, viewer: true, zLayer: 0 };
  const mapData = { tokens: [token], grid: { size: 70, distancePerCell: 5 }, lighting: {} };
  const runtime = { engine: { camera, canvas, mapData }, bridge: { isDm: false } };
  const api = globalThis.LuminousVttCameraFollow;
  const controller = api.createController({ runtime, mapData, root: host });

  controller.setEnabled(true, { reason: 'test', centerNow: true });
  const centered = camera.worldToScreen(token.x, token.y);
  expect(centered.x).toBeCloseTo(800, 8);
  expect(centered.y).toBeCloseTo(450, 8);
  expect(controller.state().enabled).toBe(true);

  camera.manualPanListener?.({ dx: 10, dy: 0 });
  expect(controller.state().enabled).toBe(false);

  controller.stop();
  camera.destroy();
});

test('CAM-13/14 Camera Follow conserva hotkeys y evita seguir drag preview no confirmado', () => {
  const follow = read('js/vtt/camera-follow.js');

  expect(follow).toContain("event.code === 'KeyF'");
  expect(follow).toContain("event.code === 'Home'");
  expect(follow).toContain("if (event?.type === 'vtt:token-preview-moved')");
  expect(follow).toContain('if (!isConfirmedTraversalPreview(event.detail || {})) return;');
  expect(follow).toContain("queueTraversalSync(event?.detail?.remote ? 'remote-token-traversal' : 'token-traversal');");
});

test('CAM-16/17/18 DM Observer solo consume click cuando FOLLOW/VIEW AS están armados', () => {
  const host = installDomStubs();
  const canvas = makeCanvas({ logicalWidth: 1280, logicalHeight: 720, dpr: 1 });
  const player = { id: 'p1', x: 400, y: 300, viewer: true, canonicalScope: 'player', zLayer: 0 };
  const npc = { id: 'npc1', x: 700, y: 300, canonicalScope: 'npc', zLayer: 0 };
  const mapData = { tokens: [player, npc], grid: { size: 70 }, lighting: {} };
  const calls = [];
  const cameraFollow = {
    setEnabled(value) { calls.push(['enabled', value]); },
    clearTarget() { calls.push(['clear']); },
    setTarget(id) { calls.push(['target', id]); },
  };
  const engine = {
    canvas,
    mapData,
    camera: {},
    tokenAtEvent: (event) => event.hitToken || null,
    setZLayer() {},
  };
  const runtime = { engine, bridge: { isDm: true } };
  const api = globalThis.LuminousVttDmObserver;
  const controller = api.createController({ runtime, mapData, cameraFollow, root: host });

  let consumed = false;
  canvas.dispatchEvent({
    type: 'click', button: 0, hitToken: player,
    preventDefault() { consumed = true; }, stopPropagation() {}, stopImmediatePropagation() {},
  });
  expect(consumed).toBe(false);

  controller.select(api.MODES.FOLLOW);
  canvas.dispatchEvent({
    type: 'click', button: 0, hitToken: npc,
    preventDefault() { consumed = true; }, stopPropagation() {}, stopImmediatePropagation() {},
  });
  expect(calls.some(([kind, id]) => kind === 'target' && id === 'npc1')).toBe(true);

  const callCount = calls.length;
  controller.select(api.MODES.VIEW_AS);
  canvas.dispatchEvent({
    type: 'click', button: 0, hitToken: npc,
    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
  });
  expect(calls.length).toBe(callCount);

  controller.select(api.MODES.VIEW_AS);
  canvas.dispatchEvent({
    type: 'click', button: 0, hitToken: player,
    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
  });
  expect(mapData.lighting.dmPreviewTokenId).toBe('p1');

  controller.stop();
});

test('CAM-20 lifecycle destruye renderer y camera para evitar listeners/contextos duplicados', () => {
  const lifecycle = read('js/vtt/runtime-lifecycle.js');

  expect(lifecycle).toContain("globalThis.removeEventListener?.('resize', engine.handleResize)");
  expect(lifecycle).toContain("engine.canvas?.removeEventListener?.('mousedown', engine.handleTokenMouseDown)");
  expect(lifecycle).toContain('engine.renderer?.destroy?.();');
  expect(lifecycle).toContain('engine.camera?.destroy?.();');
});
