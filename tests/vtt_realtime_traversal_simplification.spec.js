const { test, expect } = require('@playwright/test');

const URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

async function boot(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.tokenMoveResolver), null, { timeout: 15000 });
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
    engine.camera.zoom = 0.7;
    engine.camera.centerOnWorldPoint({ x: token.x, y: token.y });

    const probe = window.__realtimeTraversalProbe = {
      mouseUpAt: null,
      firstFrameAt: null,
      movedAt: null,
      frameTimes: [],
      realtimeFrames: 0,
      moved: null,
      rejected: null,
    };

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
    await page.waitForTimeout(8);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => Boolean(window.__realtimeTraversalProbe?.moved || window.__realtimeTraversalProbe?.rejected), null, { timeout: 3000 });

  return page.evaluate(() => {
    const probe = window.__realtimeTraversalProbe;
    const intervals = probe.frameTimes.slice(1).map((value, index) => value - probe.frameTimes[index]).sort((a, b) => a - b);
    const p95 = intervals.length ? intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95))] : null;
    return {
      installed: Boolean(window.LuminousVttRuntime.engine.__realtimeTraversalSimplifierV1),
      mouseUpToFirstFrameMs: probe.firstFrameAt - probe.mouseUpAt,
      mouseUpToMovedMs: probe.movedAt - probe.mouseUpAt,
      frameCount: probe.frameTimes.length,
      realtimeFrames: probe.realtimeFrames,
      frameIntervalP95Ms: p95,
      moved: probe.moved,
      rejected: probe.rejected,
    };
  });
}

test('long token drag commits with short realtime visual traversal', async ({ page }) => {
  test.setTimeout(20000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await boot(page);
  const result = await dragLongHorizontal(page);
  console.log('VTT_REALTIME_TRAVERSAL=' + JSON.stringify(result));

  expect(result.installed).toBe(true);
  expect(result.rejected).toBeNull();
  expect(result.moved).toBeTruthy();
  expect(result.frameCount).toBeGreaterThan(2);
  expect(result.realtimeFrames).toBe(result.frameCount);
  expect(result.mouseUpToFirstFrameMs, 'movement should visibly start almost immediately after mouseup').toBeLessThan(120);
  expect(result.mouseUpToMovedMs, '14-cell walk should commit in well under the old 1.2s+ visual traversal').toBeLessThan(350);
  expect(result.frameIntervalP95Ms, 'visual traversal should remain near display cadence').toBeLessThan(35);
});
