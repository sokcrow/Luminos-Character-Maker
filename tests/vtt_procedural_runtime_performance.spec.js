const { test, expect } = require('@playwright/test');

const URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real procedural chunk culls render collections and localizes FOV wall work', async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.procedural?.previewAsync), null, { timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.LuminousVttProceduralPerformance?.__v1), null, { timeout: 10000 });

  const setup = await page.evaluate(async () => {
    const runtime = window.LuminousVttRuntime;
    const engine = runtime.engine;
    const map = engine.mapData;
    const perf = window.LuminousVttProceduralPerformance;

    const plan = await runtime.procedural.previewAsync({
      profileId: 'mixed_urban',
      seed: 'field:procedural-runtime-performance:v1',
      maxAttempts: 8,
      minBuildings: 3,
    });
    runtime.procedural.apply(plan, { replaceScene: true, persist: false });

    const size = Number(map.grid?.size) || 70;
    const cols = Number(map.grid?.cols) || 40;
    const rows = Number(map.grid?.rows) || 40;
    let token = (map.tokens || []).find((entry) => entry.id === 'player1')
      || (map.tokens || []).find((entry) => entry.viewer === true)
      || (map.tokens || [])[0];
    if (!token) {
      token = { id: 'procedural_perf_viewer', x: 0, y: 0, z: [0], zLayer: 0, gridPosition: { col: 0, row: 0, z: 0 } };
      map.tokens ||= [];
      map.tokens.push(token);
    }
    const col = Math.max(2, Math.min(cols - 3, Math.floor(cols / 2)));
    const row = Math.max(2, Math.min(rows - 3, Math.floor(rows / 2)));
    token.x = (col + 0.5) * size;
    token.y = (row + 0.5) * size;
    token.gridPosition = { col, row, z: 0 };
    token.zLayer = 0;
    token.z = [0];
    token.viewer = true;
    token.senses ||= {};
    map.ambientLight ||= {};
    map.ambientLight.level = 'bright';
    engine.activeZ = 0;

    engine.camera.setZoomBounds?.(0.05, 5);
    engine.camera.zoom = 1;
    engine.camera.centerOnWorldPoint?.({ x: token.x, y: token.y });
    perf.setEnabled(true);

    return {
      validation: JSON.parse(JSON.stringify(plan.validation || {})),
      signature: plan.signature,
      grid: { cols, rows, size },
      totals: {
        topology: Array.isArray(map.topology) ? map.topology.length : 0,
        walls: Array.isArray(map.walls) ? map.walls.length : 0,
        structures: Array.isArray(map.structures) ? map.structures.length : 0,
        worldObjects: Array.isArray(map.worldObjects) ? map.worldObjects.length : 0,
        horizontalPlanes: Array.isArray(map.horizontalPlanes) ? map.horizontalPlanes.length : 0,
        surfaces: Object.keys(map.surfaceLayers?.['0'] || {}).length,
      },
      renderer: engine.renderer?.backend || null,
    };
  });

  // Let the actual engine loop exercise calculateVision + renderer.render repeatedly.
  await page.waitForTimeout(750);

  const result = await page.evaluate(() => {
    const runtime = window.LuminousVttRuntime;
    const engine = runtime.engine;
    const map = engine.mapData;
    const perf = window.LuminousVttProceduralPerformance;
    const before = perf.snapshot();

    // One explicit calculation makes the field independent from scheduler cadence.
    const visionStarted = performance.now();
    const vision = engine.calculateVision();
    const visionElapsedMs = performance.now() - visionStarted;
    engine.renderer.render(engine.camera, engine.activeZ, vision, false);
    const after = perf.snapshot();

    return {
      before,
      after,
      visionElapsedMs,
      totalsAfter: {
        topology: Array.isArray(map.topology) ? map.topology.length : 0,
        walls: Array.isArray(map.walls) ? map.walls.length : 0,
        structures: Array.isArray(map.structures) ? map.structures.length : 0,
        worldObjects: Array.isArray(map.worldObjects) ? map.worldObjects.length : 0,
        horizontalPlanes: Array.isArray(map.horizontalPlanes) ? map.horizontalPlanes.length : 0,
        surfaces: Object.keys(map.surfaceLayers?.[String(Number(engine.activeZ) || 0)] || {}).length,
      },
      fovPoints: Array.isArray(vision?.fovPolygon) ? vision.fovPolygon.length : 0,
    };
  });

  const payload = { setup, ...result };
  console.log('VTT_PROCEDURAL_PERF=' + JSON.stringify(payload));

  expect(setup.validation.valid).toBe(true);
  expect(setup.renderer).toBe('canvas2d');
  expect(setup.totals.surfaces, 'real procedural plan must populate surface cells').toBeGreaterThan(500);
  expect(setup.totals.topology, 'real procedural plan must populate topology').toBeGreaterThan(20);

  expect(result.after.renderFrames, 'procedural culling wrapper must be exercised').toBeGreaterThan(0);
  expect(result.after.visionCalls, 'vision wall locality filter must be exercised').toBeGreaterThan(0);
  expect(result.after.lastTotals).toBeTruthy();
  expect(result.after.lastVisible).toBeTruthy();

  const totalSceneEntries = Object.values(result.after.lastTotals || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const visibleSceneEntries = Object.values(result.after.lastVisible || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  expect(visibleSceneEntries, 'viewport culling must reduce loaded procedural render work').toBeLessThan(totalSceneEntries);
  expect(result.after.lastVisible.surfaces, 'surface renderer must not scan the whole procedural floor').toBeLessThan(result.after.lastTotals.surfaces);

  expect(result.after.lastVisionTotal).toBeGreaterThan(20);
  expect(result.after.lastVisionCandidates, 'FOV should intersect only nearby procedural walls').toBeLessThan(result.after.lastVisionTotal);
  expect(result.after.lastVisionCandidates).toBeGreaterThan(0);

  expect(result.after.cullPrepMaxMs, 'viewport cull preparation should remain frame-cheap').toBeLessThan(25);
  expect(result.after.visionFilterMaxMs, 'vision locality filtering itself should remain cheap').toBeLessThan(20);
  expect(result.visionElapsedMs, 'one loaded procedural FOV calculation must not create a long task').toBeLessThan(50);

  // The culling wrapper is temporary only; canonical scene collections must be intact afterwards.
  expect(result.totalsAfter.topology).toBe(setup.totals.topology);
  expect(result.totalsAfter.surfaces).toBe(setup.totals.surfaces);
});
