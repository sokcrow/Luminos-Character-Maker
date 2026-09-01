const { test, expect } = require('@playwright/test');

const URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

function routeMetrics(path = []) {
  let turns = 0;
  const rows = [];
  let lastDirection = null;
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    rows.push(Number(point.row));
    if (!index) continue;
    const previous = path[index - 1];
    const direction = `${Math.sign(Number(point.col) - Number(previous.col))},${Math.sign(Number(point.row) - Number(previous.row))}`;
    if (lastDirection && direction !== lastDirection) turns += 1;
    lastDirection = direction;
  }
  return {
    cells: path.length,
    startCol: path.length ? Number(path[0].col) : null,
    endCol: path.length ? Number(path[path.length - 1].col) : null,
    turns,
    rowExcursion: rows.length ? Math.max(...rows) - Math.min(...rows) : 0,
  };
}

async function bootLoadedMap(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.tokenMoveResolver), null, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttPathfinding?.__runtimeFinalizedPathfindingV3), null, { timeout: 5000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttLongDragHotfix?.__v1), null, { timeout: 5000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttDirectRouteHotfix?.__v1), null, { timeout: 5000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.__realtimeTraversalSimplifierV1), null, { timeout: 5000 });

  await page.evaluate(() => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    const size = Number(map.grid?.size) || 70;

    map.grid.cols = 120;
    map.grid.rows = 120;
    map.walls = [];
    map.structures = [];
    map.worldObjects = [];
    map.movement ||= {};
    map.movement.blockTokens = false;
    map.movement.diagonalRule = '5e';
    map.movement.terrain = { '100_100': { multiplier: 0.5 } };
    map.movement.terrainCells = {};
    delete map.movement.animationMsPerCell;
    delete map.movement.realtimeAnimationMsPerCell;
    delete map.movement.realtimeAnimationMinMs;
    delete map.movement.realtimeAnimationMaxMs;

    // Hundreds of topology records reproduce the real loaded-map cost without
    // blocking the horizontal test corridor on row 10.
    map.topology = Array.from({ length: 900 }, (_, index) => {
      const row = 40 + (index % 70);
      const col = 1 + ((index * 7) % 115);
      return {
        id: `perf_wall_${index}`,
        type: 'wall',
        from: { col, row },
        to: { col: Math.min(120, col + 1), row },
        z: [0],
        thicknessFt: 0.5,
      };
    });

    token.x = 3.5 * size;
    token.y = 10.5 * size;
    token.gridPosition = { col: 3, row: 10, z: 0 };
    token.zLayer = 0;
    token.z = [0];
    token.draggable = true;
    token.viewer = true;
    engine.activeZ = 0;

    if (engine.cameraFollowActive === true) engine.camera.manualPanListener?.({ benchmark: true });
    engine.camera.setZoomBounds?.(0.05, 5);
    engine.camera.zoom = 0.22;
    engine.camera.centerOnWorldPoint({ x: 36.5 * size, y: 10.5 * size });

    window.LuminousVttLongDragHotfix.ensure();
    window.LuminousVttDirectRouteHotfix.ensure();
    const baselineLong = window.LuminousVttLongDragHotfix.snapshot();
    const baselineDirect = window.LuminousVttDirectRouteHotfix.snapshot();
    window.__longDragProbe = {
      baselineLong,
      baselineDirect,
      mouseUpAt: null,
      movedAt: null,
      firstFrameAt: null,
      moved: null,
      rejected: null,
      traversalFrames: 0,
    };

    window.addEventListener('mouseup', () => {
      window.__longDragProbe.mouseUpAt ??= performance.now();
    }, true);
    engine.canvas.addEventListener('vtt:token-preview-moved', (event) => {
      if (!event.detail?.traversing) return;
      window.__longDragProbe.firstFrameAt ??= performance.now();
      window.__longDragProbe.traversalFrames += 1;
    });
    engine.canvas.addEventListener('vtt:token-moved', (event) => {
      window.__longDragProbe.movedAt = performance.now();
      window.__longDragProbe.moved = JSON.parse(JSON.stringify(event.detail || {}));
    });
    engine.canvas.addEventListener('vtt:movement-order-rejected', (event) => {
      window.__longDragProbe.rejected = JSON.parse(JSON.stringify(event.detail || {}));
    });
  });
}

async function dragToColumn(page, targetCol = 70) {
  const points = await page.evaluate((col) => {
    const engine = window.LuminousVttRuntime.engine;
    const map = engine.mapData;
    const token = map.tokens.find((entry) => entry.id === 'player1') || map.tokens[0];
    const start = engine.camera.worldToScreen(token.x, token.y);
    const target = engine.camera.worldToScreen((col + 0.5) * map.grid.size, 10.5 * map.grid.size);
    const rect = engine.canvas.getBoundingClientRect();
    return {
      start: { x: rect.left + start.x, y: rect.top + start.y },
      target: { x: rect.left + target.x, y: rect.top + target.y },
    };
  }, targetCol);

  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down({ button: 'left' });
  const dragStarted = Date.now();
  for (let index = 1; index <= 90; index += 1) {
    const t = index / 90;
    await page.mouse.move(
      points.start.x + ((points.target.x - points.start.x) * t),
      points.start.y + ((points.target.y - points.start.y) * t),
    );
    await page.waitForTimeout(6);
  }
  const dragElapsedMs = Date.now() - dragStarted;

  const beforeDrop = await page.evaluate(() => ({
    long: window.LuminousVttLongDragHotfix.snapshot(),
    direct: window.LuminousVttDirectRouteHotfix.snapshot(),
    hudVisible: !document.getElementById('vtt-fast-drag-hud')?.hidden,
    hudText: document.getElementById('vtt-fast-drag-hud')?.textContent || '',
  }));

  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => Boolean(window.__longDragProbe?.moved || window.__longDragProbe?.rejected), null, { timeout: 3000 });

  return page.evaluate(({ dragElapsedMs, beforeDrop }) => {
    const probe = window.__longDragProbe;
    const afterLong = window.LuminousVttLongDragHotfix.snapshot();
    const afterDirect = window.LuminousVttDirectRouteHotfix.snapshot();
    return {
      dragElapsedMs,
      beforeDrop,
      afterLong,
      afterDirect,
      longPathCallsDuringDrag: beforeDrop.long.pathCalls - probe.baselineLong.pathCalls,
      directPathCallsDuringDrag: beforeDrop.direct.findPathCalls - probe.baselineDirect.findPathCalls,
      directFindPathCalls: afterDirect.findPathCalls - probe.baselineDirect.findPathCalls,
      directHits: afterDirect.directHits - probe.baselineDirect.directHits,
      fallbackCalls: afterDirect.fallbackCalls - probe.baselineDirect.fallbackCalls,
      mouseUpToFirstFrameMs: probe.firstFrameAt - probe.mouseUpAt,
      mouseUpToMovedMs: probe.movedAt - probe.mouseUpAt,
      traversalFrames: probe.traversalFrames,
      moved: probe.moved,
      rejected: probe.rejected,
    };
  }, { dragElapsedMs, beforeDrop });
}

test('loaded 120x120 long drag does no pathfinding until drop and does not stall the browser', async ({ page }) => {
  test.setTimeout(30000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await bootLoadedMap(page);
  const result = await dragToColumn(page, 70);
  result.route = routeMetrics(result.moved?.path || []);
  console.log('VTT_LONG_DRAG=' + JSON.stringify(result));

  expect(result.beforeDrop.long.pathfindingInstalled).toBe(true);
  expect(result.beforeDrop.long.collisionBroadphaseInstalled).toBe(true);
  expect(result.beforeDrop.direct.installed).toBe(true);
  expect(result.longPathCallsDuringDrag, 'mousemove must never run legacy/full pathfinding').toBe(0);
  expect(result.directPathCallsDuringDrag, 'mousemove must never run direct drop validation either').toBe(0);
  expect(result.beforeDrop.hudVisible, 'cheap drag HUD should remain responsive').toBe(true);
  expect(result.beforeDrop.hudText).toContain('ft');
  expect(result.dragElapsedMs, '90 pointer updates on a loaded map must stay interactive').toBeLessThan(1800);

  expect(result.rejected).toBeNull();
  expect(result.moved).toBeTruthy();
  expect(result.directFindPathCalls).toBeGreaterThan(0);
  expect(result.directHits, 'legal aligned movement should use the direct corridor').toBeGreaterThan(0);
  expect(result.fallbackCalls, 'clear straight movement must never enter A*').toBe(0);
  expect(result.afterDirect.contextBuildMaxMs, 'direct collision index should build quickly').toBeLessThan(120);

  expect(result.route.startCol).toBe(3);
  expect(result.route.endCol).toBe(70);
  expect(result.route.rowExcursion).toBe(0);
  expect(result.route.turns).toBe(0);

  expect(result.mouseUpToFirstFrameMs, 'movement should start immediately after the single drop validation').toBeLessThan(180);
  expect(result.mouseUpToMovedMs, '67-cell loaded-map move should finish without multi-second blocking').toBeLessThan(650);
  expect(result.traversalFrames).toBeGreaterThan(2);
});
