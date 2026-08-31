const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

async function loadGuard() {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

function canvasStub() {
  const listeners = new Map();
  return {
    width: 1920,
    height: 1080,
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, detail = {}) { for (const fn of listeners.get(name) || []) fn({ type: name, detail }); },
  };
}

function mapStub() {
  return {
    grid: { cols: 40, rows: 40, size: 70, distancePerCell: 5 },
    tokens: [{ id: 'p1', x: 350, y: 350, zLayer: 0, lookDeg: 0, visionConeDeg: 120 }],
    topology: [], walls: [], verticalPortals: [],
    lighting: { scene: { sources: [], interiors: [], roofs: [], switches: [], transformers: [] }, environment: { state: { light: 'bright' } } },
    dmEditMode: { active: false },
  };
}

test('idle VTT frames render once and event invalidation redraws without polling every RAF', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realRenders = 0;
    const canvas = canvasStub();
    const renderer = { render() { realRenders += 1; } };
    const mapData = mapStub();
    const engine = { renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null, tokenMotion: null };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });
    expect(api).toBeTruthy();

    for (let i = 0; i < 120; i += 1) renderer.render();
    expect(realRenders).toBe(1);
    expect(api.snapshot().rendered).toBe(1);
    expect(api.snapshot().skipped).toBe(119);

    mapData.tokens[0].x += 70;
    canvas.emit('vtt:token-moved', { tokenId: 'p1' });
    renderer.render();
    expect(realRenders).toBe(2);

    mapData.topology.push({ id: 'door-1', type: 'door', state: 'closed', a: { col: 1, row: 1 }, b: { col: 2, row: 1 } });
    api.invalidate();
    renderer.render();
    expect(realRenders).toBe(3);
    expect(api.snapshot().savedFrames).toBeGreaterThanOrEqual(119);

    api.stop();
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('a short confirmed token traversal cannot recalculate FOV and render on every animation frame', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realRenders = 0;
    let realVision = 0;
    const canvas = canvasStub();
    const renderer = { render() { realRenders += 1; } };
    const mapData = mapStub();
    const engine = {
      renderer,
      mapData,
      canvas,
      camera: { x: 0, y: 0, zoom: 1 },
      activeZ: 0,
      tokenDrag: null,
      tokenMotion: { tokenId: 'p1' },
      calculateVision() { realVision += 1; return { visible: true, fovPolygon: [], visionRadius: 0 }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: false } } });

    for (let frame = 0; frame < 120; frame += 1) {
      mapData.tokens[0].x = 350 + (frame * (70 / 119));
      canvas.emit('vtt:token-preview-moved', { tokenId: 'p1', traversing: true });
      engine.calculateVision();
      renderer.render();
    }

    const stats = api.snapshot();
    expect(realVision).toBeLessThan(20);
    expect(realRenders).toBeLessThan(20);
    expect(stats.visionSaved).toBeGreaterThan(100);
    expect(stats.savedFrames).toBeGreaterThan(100);
    expect(stats.movementFrameMs).toBeCloseTo(50, 4);
    api.stop();
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('DM FREE gets an omniscient render frame without invoking Player FOV calculation', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realVision = 0;
    const canvas = canvasStub();
    const renderer = { render() {} };
    const mapData = mapStub();
    const engine = {
      renderer,
      mapData,
      canvas,
      camera: { x: 0, y: 0, zoom: 1 },
      activeZ: 0,
      tokenDrag: null,
      tokenMotion: null,
      calculateVision() { realVision += 1; return { visible: false }; },
    };
    const api = mod.installPerformanceGuard({ runtime: { engine, bridge: { isDm: true } } });
    const dmVision = engine.calculateVision();
    expect(realVision).toBe(0);
    expect(dmVision).toMatchObject({ visible: true, dmOmniscient: true, perceptionMode: 'dm-omniscient' });
    expect(dmVision.fovPolygon).toHaveLength(4);
    expect(dmVision.visionRadius).toBeGreaterThan(0);
    expect(api.snapshot().dmVisionBypassed).toBe(1);

    mapData.lighting.dmPreviewTokenId = 'p1';
    api.invalidate();
    const playerPov = engine.calculateVision();
    expect(realVision).toBe(1);
    expect(playerPov.dmOmniscient).not.toBe(true);
    api.stop();
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('performance guard loads after Dynamic Lighting and Fog Memory', () => {
  const html = read('vtt.html');
  const lighting = html.indexOf('js/vtt/dynamic-lighting-bootstrap.js');
  const fog = html.indexOf('js/vtt/fog-memory-bootstrap.js');
  const guard = html.indexOf('js/vtt/performance-guard.js');
  expect(lighting).toBeGreaterThan(0);
  expect(fog).toBeGreaterThan(lighting);
  expect(guard).toBeGreaterThan(fog);
});

test('performance guard keeps visual rule inputs and caps active movement before fingerprint work', () => {
  const source = read('js/vtt/performance-guard.js');
  expect(source).toContain('tokenSignature(mapData?.tokens)');
  expect(source).toContain('topologySignature(mapData)');
  expect(source).toContain('mapData.lighting?.scene');
  expect(source).toContain('mapData.procedural?.activeChunkSignature');
  expect(source).toContain('DEFAULT_ACTIVE_FRAME_MS = 1000 / 30');
  expect(source).toContain('DEFAULT_MOVEMENT_FRAME_MS = 1000 / 20');
  expect(source).toContain('DEFAULT_IDLE_SCAN_MS = 1000 / 15');
  expect(source).toContain('engine?.tokenMotion || engine?.tokenDrag');
  expect(source).toContain('if (engine?.tokenMotion)');
  expect(source).toContain('Dynamic Lighting/Fog heavy work is capped at 20 Hz during tokenMotion');
  expect(source).toContain('reject excess animation frames before building token/topology JSON signatures');
});

test('performance guard parses as an ES module', () => {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-syntax-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});
