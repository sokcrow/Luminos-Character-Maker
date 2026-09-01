const { test, expect } = require('@playwright/test');

const URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

function metrics(cells = []) {
  let turns = 0;
  let reversalsY = 0;
  let lastDir = null;
  let lastDy = 0;
  const rows = [];
  for (let i = 0; i < cells.length; i += 1) {
    rows.push(Number(cells[i].row));
    if (!i) continue;
    const dx = Math.sign(Number(cells[i].col) - Number(cells[i - 1].col));
    const dy = Math.sign(Number(cells[i].row) - Number(cells[i - 1].row));
    const dir = `${dx},${dy}`;
    if (lastDir && dir !== lastDir) turns += 1;
    if (lastDy && dy && lastDy !== dy) reversalsY += 1;
    if (dy) lastDy = dy;
    lastDir = dir;
  }
  return {
    cells: cells.length,
    turns,
    reversalsY,
    rowExcursion: rows.length ? Math.max(...rows) - Math.min(...rows) : 0,
  };
}

async function boot(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.tokenMoveResolver), null, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttPathfinding?.__runtimeFinalizedPathfindingV3), null, { timeout: 5000 });
  await page.evaluate(() => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    map.walls = [];
    map.topology = [];
    map.structures = [];
    map.worldObjects = [];
    map.movement ||= {};
    map.movement.terrain = {};
    map.movement.terrainCells = {};
    map.movement.blockTokens = false;
    map.movement.diagonalRule = '5e';
    map.movement.animationMsPerCell = 20;
    token.x = (3.5) * map.grid.size;
    token.y = (10.5) * map.grid.size;
    token.gridPosition = { col: 3, row: 10, z: 0 };
    token.zLayer = 0;
    token.z = [0];
    token.draggable = true;
    token.viewer = true;
    engine.activeZ = 0;
    engine.camera.zoom = 0.7;
    engine.camera.centerOnWorldPoint({ x: token.x, y: token.y });

    const pathfinder = window.LuminousVttPathfinding;
    const probe = window.__vttFieldProbe = {
      startedAt: performance.now(),
      pathfinderFlags: {
        v2: Boolean(pathfinder?.__straightRouteTieBreakPatchV2),
        straight: Boolean(pathfinder?.__straightRouteTieBreakPatch),
        cheapTerrain: Boolean(pathfinder?.__cheapTerrainHeuristicPatch),
        runtimeFinalized: Boolean(pathfinder?.__runtimeFinalizedPathfindingV3),
      },
      events: [],
      plans: [],
      resolver: { calls: 0, start: null, end: null, result: null, error: null },
      animate: { calls: 0, start: null, end: null, result: null, error: null, inputPath: [] },
      mouse: { down: null, up: null, dragAcquired: false },
      previewCount: 0,
      traversalFrames: [],
      moved: null,
      rejected: null,
    };
    const stamp = (type, detail = null) => probe.events.push({ type, at: performance.now(), detail });

    const wrappedPathfinder = Object.freeze({
      ...pathfinder,
      findPath(args) {
        const at = performance.now();
        const result = pathfinder.findPath(args);
        probe.plans.push({
          at,
          ms: performance.now() - at,
          valid: Boolean(result?.valid),
          reason: result?.reason || null,
          visited: Number(result?.visited ?? -1),
          fastPath: result?.fastPath || null,
          cells: Array.isArray(result?.cells) ? result.cells.map(({ col, row }) => ({ col, row })) : [],
        });
        return result;
      },
    });
    window.LuminousVttPathfinding = wrappedPathfinder;

    const originalResolver = engine.tokenMoveResolver;
    engine.tokenMoveResolver = async (...args) => {
      probe.resolver.calls += 1;
      probe.resolver.start = performance.now();
      stamp('resolver:start');
      try {
        const result = await originalResolver(...args);
        probe.resolver.end = performance.now();
        probe.resolver.result = {
          valid: Boolean(result?.valid),
          reason: result?.reason || null,
          path: Array.isArray(result?.path) ? result.path.map(({ col, row }) => ({ col, row })) : [],
        };
        stamp('resolver:end', probe.resolver.result);
        return result;
      } catch (error) {
        probe.resolver.end = performance.now();
        probe.resolver.error = String(error?.stack || error);
        stamp('resolver:error', probe.resolver.error);
        throw error;
      }
    };

    const originalAnimate = engine.animateTokenPath;
    engine.animateTokenPath = async (...args) => {
      probe.animate.calls += 1;
      probe.animate.start = performance.now();
      probe.animate.inputPath = Array.isArray(args[1]) ? args[1].map(({ col, row }) => ({ col, row })) : [];
      stamp('animate:start', { cells: probe.animate.inputPath.length });
      try {
        const result = await originalAnimate.apply(engine, args);
        probe.animate.end = performance.now();
        probe.animate.result = result ? { valid: result.valid, complete: result.complete, reason: result.reason || null } : null;
        stamp('animate:end', probe.animate.result);
        return result;
      } catch (error) {
        probe.animate.end = performance.now();
        probe.animate.error = String(error?.stack || error);
        stamp('animate:error', probe.animate.error);
        throw error;
      }
    };

    const canvas = engine.canvas;
    window.addEventListener('mousedown', () => { probe.mouse.down ??= performance.now(); stamp('mouse:down'); }, true);
    window.addEventListener('mouseup', () => { probe.mouse.up ??= performance.now(); stamp('mouse:up'); }, true);
    canvas.addEventListener('vtt:movement-destination-preview', () => { probe.previewCount += 1; });
    canvas.addEventListener('vtt:token-preview-moved', (event) => {
      if (!event.detail?.traversing) return;
      probe.traversalFrames.push(performance.now());
      if (probe.traversalFrames.length === 1) stamp('traversal:first-frame');
    });
    canvas.addEventListener('vtt:movement-order-rejected', (event) => {
      probe.rejected = { at: performance.now(), detail: JSON.parse(JSON.stringify(event.detail || {})) };
      stamp('movement:rejected', probe.rejected.detail);
    });
    canvas.addEventListener('vtt:token-moved', (event) => {
      probe.moved = { at: performance.now(), detail: JSON.parse(JSON.stringify(event.detail || {})) };
      stamp('movement:moved');
    });
  });
}

async function drag(page) {
  const points = await page.evaluate(() => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    const targetWorld = { x: 17.5 * map.grid.size, y: 10.5 * map.grid.size };
    const start = engine.camera.worldToScreen(token.x, token.y);
    const target = engine.camera.worldToScreen(targetWorld.x, targetWorld.y);
    const rect = engine.canvas.getBoundingClientRect();
    return {
      start: { x: rect.left + start.x, y: rect.top + start.y },
      target: { x: rect.left + target.x, y: rect.top + target.y },
    };
  });

  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(25);
  const acquired = await page.evaluate(() => Boolean(window.LuminousVttRuntime.engine.tokenDrag));
  await page.evaluate((value) => { window.__vttFieldProbe.mouse.dragAcquired = value; }, acquired);

  for (let i = 1; i <= 36; i += 1) {
    const t = i / 36;
    await page.mouse.move(
      points.start.x + (points.target.x - points.start.x) * t,
      points.start.y + (points.target.y - points.start.y) * t,
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });

  try {
    await page.waitForFunction(() => Boolean(window.__vttFieldProbe?.moved || window.__vttFieldProbe?.rejected), null, { timeout: 5000 });
  } catch (_) {
    // A timeout is itself diagnostic: snapshot the in-flight stage below.
  }

  return page.evaluate(() => {
    const probe = window.__vttFieldProbe;
    const frames = probe.traversalFrames;
    const intervals = frames.slice(1).map((value, index) => value - frames[index]).sort((a, b) => a - b);
    const p95 = intervals.length ? intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95))] : null;
    const planMs = probe.plans.map((entry) => entry.ms);
    const finalPath = probe.moved?.detail?.path || probe.resolver.result?.path || probe.animate.inputPath || [];
    return {
      pathfinderFlags: probe.pathfinderFlags,
      mouse: probe.mouse,
      previewCount: probe.previewCount,
      planningCalls: probe.plans.length,
      planningTotalMs: planMs.reduce((sum, value) => sum + value, 0),
      planningMaxMs: planMs.length ? Math.max(...planMs) : 0,
      planningAvgMs: planMs.length ? planMs.reduce((sum, value) => sum + value, 0) / planMs.length : 0,
      plans: probe.plans,
      resolver: probe.resolver,
      animate: probe.animate,
      traversalFrameCount: frames.length,
      frameIntervalP95Ms: p95,
      moved: probe.moved,
      rejected: probe.rejected,
      engineState: {
        tokenDrag: Boolean(window.LuminousVttRuntime.engine.tokenDrag),
        tokenMotion: window.LuminousVttRuntime.engine.tokenMotion ? { ...window.LuminousVttRuntime.engine.tokenMotion, frameId: Boolean(window.LuminousVttRuntime.engine.tokenMotion.frameId) } : null,
      },
      finalPath: finalPath.map(({ col, row }) => ({ col, row })),
      events: probe.events,
    };
  });
}

test('real canvas drag stays straight and within the navigation performance budget', async ({ page }) => {
  test.setTimeout(30000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await boot(page);
  const result = await drag(page);
  result.route = metrics(result.finalPath);
  console.log('VTT_FIELD_TRACE=' + JSON.stringify(result));

  expect(result.pathfinderFlags.runtimeFinalized).toBe(true);
  expect(result.pathfinderFlags.v2).toBe(true);
  expect(result.mouse.dragAcquired, 'real mouse down must actually acquire the token').toBe(true);
  expect(result.resolver.calls, 'mouseup must enter the real movement resolver').toBe(1);
  expect(result.rejected).toBeNull();
  expect(result.moved, 'movement must reach vtt:token-moved within 5s').toBeTruthy();

  expect(result.route.cells).toBe(15);
  expect(result.route.rowExcursion, 'horizontal drag must never leave its source row').toBe(0);
  expect(result.route.reversalsY, 'horizontal drag must not reverse vertically').toBe(0);
  expect(result.route.turns, 'horizontal drag must have one constant direction').toBe(0);

  const routedPlans = result.plans.filter((plan) => plan.cells.length > 1);
  expect(routedPlans.length).toBeGreaterThan(0);
  expect(routedPlans.every((plan) => plan.fastPath === 'aligned')).toBe(true);
  expect(Math.max(...routedPlans.map((plan) => plan.visited))).toBe(0);
  expect(result.planningMaxMs, 'single plan should stay below 10ms on the clean aligned field case').toBeLessThan(10);
  expect(result.planningTotalMs, 'all drag planning should stay below 50ms on the clean aligned field case').toBeLessThan(50);

  const resolverMs = result.resolver.end - result.resolver.start;
  expect(resolverMs, 'drop resolver should stay below 50ms in the clean field case').toBeLessThan(50);
  expect(result.frameIntervalP95Ms, 'traversal should remain visually near 60Hz').toBeLessThan(35);
});
