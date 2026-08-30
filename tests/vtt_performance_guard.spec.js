const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

async function loadGuard() {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

test('idle VTT frames render once instead of redrawing Lighting/Fog every animation frame', async () => {
  const { mod, tmp } = await loadGuard();
  try {
    let realRenders = 0;
    const listeners = new Map();
    const canvas = {
      width: 1920,
      height: 1080,
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
    };
    const renderer = { render() { realRenders += 1; } };
    const mapData = {
      grid: { cols: 40, rows: 40, size: 70, distancePerCell: 5 },
      tokens: [{ id: 'p1', x: 350, y: 350, zLayer: 0, lookDeg: 0, visionConeDeg: 120 }],
      topology: [], walls: [], verticalPortals: [],
      lighting: { scene: { sources: [], interiors: [], roofs: [], switches: [], transformers: [] }, environment: { state: { light: 'bright' } } },
      dmEditMode: { active: false },
    };
    const engine = { renderer, mapData, canvas, camera: { x: 0, y: 0, zoom: 1 }, activeZ: 0, tokenDrag: null };
    const api = mod.installPerformanceGuard({ runtime: { engine }, activeFrameMs: 0 });
    expect(api).toBeTruthy();

    for (let i = 0; i < 120; i += 1) renderer.render();
    expect(realRenders).toBe(1);
    expect(api.snapshot().rendered).toBe(1);
    expect(api.snapshot().skipped).toBe(119);

    mapData.tokens[0].x += 70;
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

test('performance guard loads after Dynamic Lighting and Fog Memory', () => {
  const html = read('vtt.html');
  const lighting = html.indexOf('js/vtt/dynamic-lighting-bootstrap.js');
  const fog = html.indexOf('js/vtt/fog-memory-bootstrap.js');
  const guard = html.indexOf('js/vtt/performance-guard.js');
  expect(lighting).toBeGreaterThan(0);
  expect(fog).toBeGreaterThan(lighting);
  expect(guard).toBeGreaterThan(fog);
});

test('performance guard keeps visual rule inputs in its frame fingerprint', () => {
  const source = read('js/vtt/performance-guard.js');
  expect(source).toContain('tokenSignature(mapData?.tokens)');
  expect(source).toContain('topologySignature(mapData)');
  expect(source).toContain('mapData.lighting?.scene');
  expect(source).toContain('mapData.procedural?.activeChunkSignature');
  expect(source).toContain('DEFAULT_ACTIVE_FRAME_MS = 1000 / 30');
});

test('performance guard parses as an ES module', () => {
  const tmp = path.join(os.tmpdir(), `luminous-vtt-performance-syntax-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/performance-guard.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});
