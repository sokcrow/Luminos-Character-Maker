const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function freshRequire(relativePath) {
  const file = path.join(__dirname, '..', relativePath);
  delete require.cache[require.resolve(file)];
  return require(file);
}

async function loadPolish() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/vtt/movement-navigation-polish.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `luminous-navigation-polish-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, source);
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

function mapData() {
  return {
    grid: { cols: 30, rows: 30, size: 70, distancePerCell: 5 },
    movement: { diagonalRule: '5e', blockTokens: false, terrain: {} },
    tokens: [],
  };
}

function installRuntimePathfinding() {
  global.LuminousVttTokenInteraction = undefined;
  global.LuminousVttPathfinding = freshRequire('js/vtt/pathfinding.js');
  global.LuminousVttMovementEngine = freshRequire('js/vtt/movement-engine.js');
  global.LuminousVttTokenState = null;
  freshRequire('js/vtt/movement-integration-patch.js');
  return global.LuminousVttPathfinding;
}

function canvasStub() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatch(name, detail = {}) {
      for (const fn of listeners.get(name) || []) fn({ type: name, detail });
    },
  };
}

test('5e equal-cost navigation prefers an unobstructed straight line without changing cost', async () => {
  const base = installRuntimePathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    const runtime = mod.installStraightPathfinding(global);
    expect(runtime.__straightRouteTieBreakPatch).toBe(true);
    const map = mapData();
    const token = { id: 'p1', x: 0, y: 0, zLayer: 0 };

    const horizontal = runtime.findPath({ token, start: { col: 2, row: 8 }, target: { col: 15, row: 8 }, mapData: map, blockTokens: false });
    expect(horizontal.valid).toBe(true);
    expect(horizontal.cells.every((cell) => cell.row === 8)).toBe(true);
    expect(horizontal.costFt).toBe(65);

    const vertical = runtime.findPath({ token, start: { col: 11, row: 3 }, target: { col: 11, row: 17 }, mapData: map, blockTokens: false });
    expect(vertical.valid).toBe(true);
    expect(vertical.cells.every((cell) => cell.col === 11)).toBe(true);
    expect(vertical.costFt).toBe(70);

    const diagonal = runtime.findPath({ token, start: { col: 3, row: 3 }, target: { col: 10, row: 10 }, mapData: map, blockTokens: false });
    expect(diagonal.valid).toBe(true);
    expect(diagonal.cells.every((cell) => cell.col - cell.row === 0)).toBe(true);
    expect(diagonal.costFt).toBe(35);

    // The integration patch still supplies its cheap-terrain admissible heuristic.
    expect(runtime.heuristicFt({ col: 0, row: 0 }, { col: 10, row: 0 }, map)).toBeCloseTo(base.heuristicFt({ col: 0, row: 0 }, { col: 10, row: 0 }, map), 8);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('straightness is only a tie-break: obstacles still detour and repeated plans are deterministic', async () => {
  installRuntimePathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    const runtime = mod.installStraightPathfinding(global);
    const map = mapData();
    map.movement.terrain['8_8'] = { blocked: true };
    const token = { id: 'p1', x: 0, y: 0, zLayer: 0 };
    const options = { token, start: { col: 2, row: 8 }, target: { col: 15, row: 8 }, mapData: map, blockTokens: false };
    const first = runtime.findPath(options);
    const second = runtime.findPath(options);
    expect(first.valid).toBe(true);
    expect(first.cells.some((cell) => cell.row !== 8)).toBe(true);
    expect(first.cells).toEqual(second.cells);
    expect(first.costFt).toBe(second.costFt);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('normal movement uses one continuous polyline timeline and marker survives until canonical move', async () => {
  installRuntimePathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    mod.installStraightPathfinding(global);
    const canvas = canvasStub();
    const map = mapData();
    map.movement.animationMsPerCell = 90;
    const token = { id: 'p1', x: 35, y: 35, zLayer: 0 };
    map.tokens.push(token);

    let now = 0;
    let frames = 0;
    const emitted = [];
    const host = {
      LuminousVttPathfinding: global.LuminousVttPathfinding,
      LuminousVttSceneDirty: { emit() {} },
      performance: { now: () => now },
      requestAnimationFrame(fn) {
        frames += 1;
        const id = frames;
        queueMicrotask(() => { now += 16; fn(now); });
        return id;
      },
      cancelAnimationFrame() {},
      setTimeout,
      clearTimeout,
    };
    const renderer = {
      backend: 'webgl2',
      render() {},
      drawDmObserverOutlines(outlines) { this.lastOutlines = outlines; },
    };
    const engine = {
      mapData: map,
      canvas,
      renderer,
      camera: { zoom: 1 },
      activeZ: 0,
      tokenMotion: null,
      tokenDrag: null,
      async animateTokenPath() { throw new Error('segmented fallback should not run for normal paths'); },
      emitSemanticEvent(type, detail) { emitted.push({ type, detail }); canvas.dispatch(type, detail); },
    };
    const api = mod.installRuntimeNavigationPolish({ host, runtime: { engine } });
    const route = [
      { x: 35, y: 35, z: 0 },
      { x: 105, y: 35, z: 0 },
      { x: 175, y: 35, z: 0 },
      { x: 245, y: 35, z: 0 },
      { x: 315, y: 35, z: 0 },
      { x: 385, y: 35, z: 0 },
    ];

    const result = await engine.animateTokenPath(token, route, { actionMode: 'walk', doorInteractions: [] });
    expect(result).toMatchObject({ valid: true, complete: true });
    expect(token.x).toBeCloseTo(385, 6);
    expect(token.y).toBeCloseTo(35, 6);
    expect(frames).toBe(Math.ceil((5 * 90) / 16));
    expect(emitted.length).toBe(frames);
    expect(api.markers.get('p1')).toMatchObject({ x: 385, y: 35, phase: 'committed' });

    renderer.render();
    expect(renderer.lastOutlines?.length).toBe(2);
    canvas.dispatch('vtt:token-moved', { tokenId: 'p1' });
    expect(api.markers.has('p1')).toBe(false);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('destination marker snaps during drag, clears on rejection, and door interactions keep legacy animation', async () => {
  installRuntimePathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    mod.installStraightPathfinding(global);
    const canvas = canvasStub();
    const map = mapData();
    const token = { id: 'p1', x: 35, y: 35, zLayer: 0 };
    map.tokens.push(token);
    let fallbackCalls = 0;
    const host = {
      LuminousVttPathfinding: global.LuminousVttPathfinding,
      LuminousVttSceneDirty: { emit() {} },
      setTimeout,
      clearTimeout,
    };
    const renderer = { backend: 'canvas2d', render() {}, ctx: {}, };
    const engine = {
      mapData: map,
      canvas,
      renderer,
      camera: { zoom: 1 },
      activeZ: 0,
      tokenMotion: null,
      tokenDrag: null,
      async animateTokenPath() { fallbackCalls += 1; return { valid: true, complete: true }; },
    };
    const api = mod.installRuntimeNavigationPolish({ host, runtime: { engine } });

    canvas.dispatch('vtt:movement-destination-preview', { tokenId: 'p1', target: { x: 222, y: 91 } });
    expect(api.markers.get('p1')).toMatchObject({ x: 245, y: 105, phase: 'preview' });
    canvas.dispatch('vtt:movement-order-rejected', { tokenId: 'p1', reason: 'NO_PATH' });
    expect(api.markers.has('p1')).toBe(false);

    const route = [{ x: 35, y: 35, z: 0 }, { x: 105, y: 35, z: 0 }];
    const result = await engine.animateTokenPath(token, route, { doorInteractions: [{ pathIndex: 0, type: 'door' }] });
    expect(result.valid).toBe(true);
    expect(fallbackCalls).toBe(1);
    expect(api.markers.get('p1')).toMatchObject({ x: 105, y: 35, phase: 'committed' });
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('navigation polish stop restores exact engine and renderer functions and permits clean reinstall', async () => {
  installRuntimePathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    mod.installStraightPathfinding(global);
    const canvas = canvasStub();
    const map = mapData();
    const host = {
      LuminousVttPathfinding: global.LuminousVttPathfinding,
      LuminousVttSceneDirty: { emit() {} },
      setTimeout,
      clearTimeout,
    };
    const originalRender = function originalRender() { return 'rendered'; };
    const originalAnimate = async function originalAnimate() { return { valid: true, complete: true }; };
    const renderer = { backend: 'webgl2', render: originalRender, drawDmObserverOutlines() {} };
    const engine = {
      mapData: map,
      canvas,
      renderer,
      camera: { zoom: 1 },
      activeZ: 0,
      tokenMotion: null,
      tokenDrag: null,
      animateTokenPath: originalAnimate,
    };

    const first = mod.installRuntimeNavigationPolish({ host, runtime: { engine } });
    expect(engine.animateTokenPath).not.toBe(originalAnimate);
    expect(renderer.render).not.toBe(originalRender);
    expect(engine.__navigationPolishRuntime).toBe(first);
    expect(host.LuminousVttNavigationPolishRuntime).toBe(first);

    expect(first.stop()).toBe(true);
    expect(engine.animateTokenPath).toBe(originalAnimate);
    expect(renderer.render).toBe(originalRender);
    expect(engine.__navigationPolishRuntime).toBeUndefined();
    expect(host.LuminousVttNavigationPolishRuntime).toBeUndefined();
    for (const listeners of canvas.listeners.values()) expect(listeners.size).toBe(0);

    const second = mod.installRuntimeNavigationPolish({ host, runtime: { engine } });
    expect(second).not.toBe(first);
    expect(engine.animateTokenPath).not.toBe(originalAnimate);
    expect(renderer.render).not.toBe(originalRender);
    expect(second.stop()).toBe(true);
    expect(engine.animateTokenPath).toBe(originalAnimate);
    expect(renderer.render).toBe(originalRender);
  } finally {
    fs.unlinkSync(tmp);
  }
});
