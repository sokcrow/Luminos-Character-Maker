const { test, expect } = require('@playwright/test');

const URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

function routeMetrics(path = []) {
  let turns = 0;
  let reversalsY = 0;
  let lastDirection = null;
  let lastDy = 0;
  const rows = [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    rows.push(Number(point.row));
    if (!index) continue;
    const previous = path[index - 1];
    const dx = Math.sign(Number(point.col) - Number(previous.col));
    const dy = Math.sign(Number(point.row) - Number(previous.row));
    const direction = `${dx},${dy}`;
    if (lastDirection && direction !== lastDirection) turns += 1;
    if (lastDy && dy && lastDy !== dy) reversalsY += 1;
    if (dy) lastDy = dy;
    lastDirection = direction;
  }
  return {
    cells: path.length,
    startCol: path.length ? Number(path[0].col) : null,
    endCol: path.length ? Number(path[path.length - 1].col) : null,
    turns,
    reversalsY,
    rowExcursion: rows.length ? Math.max(...rows) - Math.min(...rows) : 0,
  };
}

async function boot(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.tokenMoveResolver), null, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttPathfinding?.__runtimeFinalizedPathfindingV3), null, { timeout: 5000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.__realtimeTraversalSimplifierV1), null, { timeout: 5000 });

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
    delete map.movement.animationMsPerCell;
    delete map.movement.realtimeAnimationMsPerCell;
    delete map.movement.realtimeAnimationMinMs;
    delete map.movement.realtimeAnimationMaxMs;

    token.x = 3.5 * map.grid.size;
    token.y = 10.5 * map.grid.size;
    token.gridPosition = { col: 3, row: 10, z: 0 };
    token.zLayer = 0;
    token.z = [0];
    token.draggable = true;
    token.viewer = true;
    engine.activeZ = 0;

    // A navigation benchmark must keep the viewport fixed. This calls the same
    // manual-pan release hook used by the product without actually changing x/y.
    if (engine.cameraFollowActive === true) engine.camera.manualPanListener?.({ benchmark: true });
    engine.camera.zoom = 0.7;
    engine.camera.centerOnWorldPoint({ x: token.x, y: token.y });

    const pathfinder = window.LuminousVttPathfinding;
    const probe = window.__realtimeTraversalProbe = {
      mouseUpAt: null,
      firstFrameAt: null,
      movedAt: null,
      frameTimes: [],
      realtimeFrames: 0,
      moved: null,
      rejected: null,
      plans: [],
    };

    const wrappedPathfinder = Object.freeze({
      ...pathfinder,
      findPath(args) {
        const startedAt = performance.now();
        const result = pathfinder.findPath(args);
        probe.plans.push({
          ms: performance.now() - startedAt,
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

    window.addEventListener('mouseup', () => { probe.mouseUpAt ??= performance.now(); }, true);
    engine.canvas.addEventListener('vtt:token-preview-moved', (event) => {
      if (!event.detail?.traversing) return;
      const now = performance.now();
      probe.firstFrameAt ??= now;
      probe.frameTimes.push(now);
      if (event.detail?.realtimeVisual === true) probe.realtimeFrames += 1;
    });
    engine.canvas.addEventListener('vtt:token-moved', (event) => {
      probe.movedAt = performance.now();
      probe.moved = JSON.parse(JSON.stringify(event.detail || {}));
    });
    engine.canvas.addEventListener('vtt:movement-order-rejected', (event) => {
      probe.rejected = JSON.parse(JSON.stringify(event.detail || {}));
    });
  });
}

async function dragLongHorizontal(page) {
  const points = await page.evaluate(() => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    const start = engine.camera.worldToScreen(token.x, token.y);
    const target = engine.camera.worldToScreen(17.5 * map.grid.size, 10.5 * map.grid.size);
    const rect = engine.canvas.getBoundingClientRect();
    return {
      start: { x: rect.left + start.x, y: rect.top + start.y },
      target: { x: rect.left + target.x, y: rect.top + target.y },
    };
  });

  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down({ button: 'left' });
  for (let index = 1; index <= 36; index += 1) {
    const t = index / 36;
    await page.mouse.move(
      points.start.x + ((points.target.x - points.start.x) * t),
      points.start.y + ((points.target.y - points.start.y) * t),
    );
    await page.waitForTimeout(12);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => Boolean(window.__realtimeTraversalProbe?.moved || window.__realtimeTraversalProbe?.rejected), null, { timeout: 3000 });

  return page.evaluate(() => {
    const probe = window.__realtimeTraversalProbe;
    const intervals = probe.frameTimes.slice(1).map((value, index) => value - probe.frameTimes[index]).sort((a, b) => a - b);
    const p95 = intervals.length ? intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95))] : null;
    const planMs = probe.plans.map((entry) => entry.ms);
    return {
      installed: Boolean(window.LuminousVttRuntime.engine.__realtimeTraversalSimplifierV1),
      runtimeFinalized: Boolean(window.LuminousVttPathfinding?.__runtimeFinalizedPathfindingV3),
      cameraFollowActive: Boolean(window.LuminousVttRuntime.engine.cameraFollowActive),
      mouseUpToFirstFrameMs: probe.firstFrameAt - probe.mouseUpAt,
      mouseUpToMovedMs: probe.movedAt - probe.mouseUpAt,
      frameCount: probe.frameTimes.length,
      realtimeFrames: probe.realtimeFrames,
      frameIntervalP95Ms: p95,
      planningCalls: probe.plans.length,
      planningTotalMs: planMs.reduce((sum, value) => sum + value, 0),
      planningMaxMs: planMs.length ? Math.max(...planMs) : 0,
      plans: probe.plans,
      moved: probe.moved,
      rejected: probe.rejected,
    };
  });
}

test('real token drag stays straight, plans cheaply, and commits with realtime visual traversal', async ({ page }) => {
  test.setTimeout(20000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await boot(page);
  const result = await dragLongHorizontal(page);
  const path = result.moved?.path || [];
  result.route = routeMetrics(path);
  console.log('VTT_REALTIME_MOVEMENT=' + JSON.stringify(result));

  expect(result.installed).toBe(true);
  expect(result.runtimeFinalized).toBe(true);
  expect(result.cameraFollowActive, 'benchmark viewport must remain fixed').toBe(false);
  expect(result.rejected).toBeNull();
  expect(result.moved).toBeTruthy();

  expect(result.route.startCol).toBe(3);
  expect(result.route.endCol).toBe(17);
  expect(result.route.cells).toBe(15);
  expect(result.route.rowExcursion, 'horizontal route must never leave its source row').toBe(0);
  expect(result.route.reversalsY, 'horizontal route must never reverse vertically').toBe(0);
  expect(result.route.turns, 'horizontal route must keep one direction').toBe(0);

  const routedPlans = result.plans.filter((plan) => plan.cells.length > 1);
  expect(routedPlans.length).toBeGreaterThan(0);
  expect(routedPlans.every((plan) => plan.fastPath === 'aligned')).toBe(true);
  expect(Math.max(...routedPlans.map((plan) => plan.visited))).toBe(0);
  expect(result.planningMaxMs, 'single clean-field plan should stay under 10ms').toBeLessThan(10);
  expect(result.planningTotalMs, 'full drag planning should stay under 50ms').toBeLessThan(50);

  expect(result.frameCount).toBeGreaterThan(2);
  expect(result.realtimeFrames).toBe(result.frameCount);
  expect(result.mouseUpToFirstFrameMs, 'movement should visibly start almost immediately after mouseup').toBeLessThan(120);
  expect(result.mouseUpToMovedMs, '14-cell walk should commit in well under the old 1.2s+ traversal').toBeLessThan(350);
  expect(result.frameIntervalP95Ms, 'visual traversal should remain near display cadence').toBeLessThan(35);
});
