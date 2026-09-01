const { test, expect } = require('@playwright/test');

const URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

function routeMetrics(cells = []) {
  const rows = cells.map((cell) => Number(cell.row)).filter(Number.isFinite);
  const cols = cells.map((cell) => Number(cell.col)).filter(Number.isFinite);
  let turns = 0;
  let reversalsY = 0;
  let previousDirection = null;
  let previousDy = 0;
  for (let index = 1; index < cells.length; index += 1) {
    const dx = Math.sign(Number(cells[index].col) - Number(cells[index - 1].col));
    const dy = Math.sign(Number(cells[index].row) - Number(cells[index - 1].row));
    const direction = `${dx},${dy}`;
    if (previousDirection && direction !== previousDirection) turns += 1;
    if (previousDy && dy && previousDy !== dy) reversalsY += 1;
    if (dy) previousDy = dy;
    previousDirection = direction;
  }
  return {
    cells: cells.length,
    turns,
    reversalsY,
    rowExcursion: rows.length ? Math.max(...rows) - Math.min(...rows) : 0,
    colExcursion: cols.length ? Math.max(...cols) - Math.min(...cols) : 0,
  };
}

async function prepare(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.tokenMoveResolver), null, { timeout: 15000 });
  await page.evaluate(() => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    map.walls = [];
    map.topology = [];
    map.movement ||= {};
    map.movement.terrain = {};
    map.movement.terrainCells = {};
    map.movement.blockTokens = false;
    map.movement.diagonalRule = '5e';
    map.movement.animationMsPerCell = 20;
    token.x = (3 + 0.5) * map.grid.size;
    token.y = (10 + 0.5) * map.grid.size;
    token.gridPosition = { col: 3, row: 10, z: 0 };
    token.zLayer = 0;
    token.z = [0];
    token.draggable = true;
    engine.activeZ = 0;
    engine.camera.zoom = 0.7;
    engine.camera.centerOnWorldPoint({ x: token.x + 7 * map.grid.size, y: token.y });
  });
}

async function installProbe(page) {
  await page.evaluate(() => {
    const base = window.LuminousVttPathfinding;
    window.__vttFieldProbe = {
      pathfinderFlags: {
        v2: Boolean(base?.__straightRouteTieBreakPatchV2),
        straight: Boolean(base?.__straightRouteTieBreakPatch),
        cheapTerrain: Boolean(base?.__cheapTerrainHeuristicPatch),
      },
      plans: [],
      mouseDownAt: null,
      mouseUpAt: null,
      firstTraversalAt: null,
      movedAt: null,
      previewFrames: [],
      movedDetail: null,
    };
    const probe = window.__vttFieldProbe;
    const wrapped = Object.freeze({
      ...base,
      findPath(args) {
        const started = performance.now();
        const result = base.findPath(args);
        probe.plans.push({
          ms: performance.now() - started,
          valid: Boolean(result?.valid),
          visited: Number(result?.visited ?? -1),
          fastPath: result?.fastPath || null,
          cells: Array.isArray(result?.cells) ? result.cells.map(({ col, row }) => ({ col, row })) : [],
        });
        return result;
      },
    });
    window.LuminousVttPathfinding = wrapped;
    const canvas = window.LuminousVttRuntime.engine.canvas;
    window.addEventListener('mousedown', () => { probe.mouseDownAt ??= performance.now(); }, true);
    window.addEventListener('mouseup', () => { probe.mouseUpAt ??= performance.now(); }, true);
    canvas.addEventListener('vtt:token-preview-moved', (event) => {
      if (!event.detail?.traversing) return;
      const now = performance.now();
      probe.firstTraversalAt ??= now;
      probe.previewFrames.push(now);
    });
    canvas.addEventListener('vtt:token-moved', (event) => {
      probe.movedAt = performance.now();
      probe.movedDetail = JSON.parse(JSON.stringify(event.detail || {}));
    });
  });
}

async function resetForRun(page) {
  return page.evaluate(() => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    token.x = (3 + 0.5) * map.grid.size;
    token.y = (10 + 0.5) * map.grid.size;
    token.gridPosition = { col: 3, row: 10, z: 0 };
    token.zLayer = 0;
    token.z = [0];
    engine.tokenMotion = null;
    engine.tokenDrag = null;
    engine.camera.zoom = 0.7;
    engine.camera.centerOnWorldPoint({ x: token.x + 7 * map.grid.size, y: token.y });
    const start = engine.camera.worldToScreen(token.x, token.y);
    const targetWorld = { x: (17 + 0.5) * map.grid.size, y: (10 + 0.5) * map.grid.size };
    const target = engine.camera.worldToScreen(targetWorld.x, targetWorld.y);
    const rect = engine.canvas.getBoundingClientRect();
    return {
      start: { x: rect.left + start.x, y: rect.top + start.y },
      target: { x: rect.left + target.x, y: rect.top + target.y },
    };
  });
}

async function dragAndMeasure(page) {
  const points = await resetForRun(page);
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down({ button: 'left' });
  const steps = 36;
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    await page.mouse.move(
      points.start.x + (points.target.x - points.start.x) * t,
      points.start.y + (points.target.y - points.start.y) * t,
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => Boolean(window.__vttFieldProbe?.movedAt), null, { timeout: 10000 });
  return page.evaluate(() => {
    const probe = window.__vttFieldProbe;
    const planMs = probe.plans.map((entry) => entry.ms);
    const frames = probe.previewFrames;
    const intervals = frames.slice(1).map((value, index) => value - frames[index]).sort((a, b) => a - b);
    const percentile = (values, q) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * q))] : null;
    return {
      pathfinderFlags: probe.pathfinderFlags,
      planningCalls: probe.plans.length,
      planningTotalMs: planMs.reduce((sum, value) => sum + value, 0),
      planningMaxMs: planMs.length ? Math.max(...planMs) : 0,
      planningAvgMs: planMs.length ? planMs.reduce((sum, value) => sum + value, 0) / planMs.length : 0,
      dropToTraversalMs: probe.firstTraversalAt != null && probe.mouseUpAt != null ? probe.firstTraversalAt - probe.mouseUpAt : null,
      mouseDownToMovedMs: probe.movedAt != null && probe.mouseDownAt != null ? probe.movedAt - probe.mouseDownAt : null,
      traversalMs: probe.movedAt != null && probe.firstTraversalAt != null ? probe.movedAt - probe.firstTraversalAt : null,
      frameIntervalP95Ms: percentile(intervals, 0.95),
      previewFrameCount: frames.length,
      finalPath: Array.isArray(probe.movedDetail?.path)
        ? probe.movedDetail.path.map(({ col, row }) => ({ col, row }))
        : [],
      plans: probe.plans,
    };
  });
}

test('real canvas drag A/B exposes runtime pathfinder and movement latency', async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await prepare(page);

  await installProbe(page);
  const before = await dragAndMeasure(page);
  before.route = routeMetrics(before.finalPath);
  console.log('VTT_FIELD_BEFORE=' + JSON.stringify(before));

  expect(before.pathfinderFlags.v2, 'production page should reveal whether V2 is actually connected').toBe(false);

  await page.evaluate(async () => {
    await import(`/js/vtt/movement-navigation-polish.js?field=${Date.now()}`);
  });
  await page.waitForFunction(() => Boolean(window.LuminousVttPathfinding?.__straightRouteTieBreakPatchV2), null, { timeout: 5000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.__navigationPolishRuntime), null, { timeout: 5000 });

  await installProbe(page);
  const after = await dragAndMeasure(page);
  after.route = routeMetrics(after.finalPath);
  console.log('VTT_FIELD_AFTER=' + JSON.stringify(after));

  expect(after.pathfinderFlags.v2).toBe(true);
  expect(after.route.rowExcursion).toBe(0);
  expect(after.route.reversalsY).toBe(0);
  expect(after.plans.some((plan) => plan.fastPath === 'aligned')).toBe(true);
});
