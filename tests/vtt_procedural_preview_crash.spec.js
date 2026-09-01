const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const GEN_FILES = [
  'topology.js','surface-core.js','horizontal-plane-core.js','building-physics-core.js',
  'semantic-map-core.js','building-semantic-core.js','building-archetype-core.js','vertical-portal.js',
  'building-navigation-core.js','procedural-zone-core.js','urban-fabric-core.js',
  'procedural-building-generator.js','procedural-building-mix-patch.js','procedural-generator-core.js',
];
const GEN_KEYS = [
  'LuminousVttTopology','LuminousVttSurfaceCore','LuminousVttHorizontalPlanes','LuminousVttBuildingPhysics',
  'LuminousVttSemanticMap','LuminousVttBuildingSemantics','LuminousVttBuildingArchetypes','LuminousVttVerticalPortal',
  'LuminousVttBuildingNavigation','LuminousVttProceduralZone','LuminousVttUrbanFabric',
  'LuminousVttProceduralBuildings',null,'LuminousVttProceduralGenerator',
];

function withGenerator(run) {
  const original = new Map(GEN_KEYS.filter(Boolean).map((key) => [key, global[key]]));
  try {
    for (let i = 0; i < GEN_FILES.length; i += 1) {
      const resolved = require.resolve(path.join(ROOT, 'js/vtt', GEN_FILES[i]));
      delete require.cache[resolved];
      const loaded = require(resolved);
      const key = GEN_KEYS[i];
      if (key && loaded) global[key] = loaded;
    }
    return run(global.LuminousVttProceduralGenerator, global.LuminousVttUrbanFabric, global.LuminousVttProceduralBuildings);
  } finally {
    for (const file of GEN_FILES) {
      try { delete require.cache[require.resolve(path.join(ROOT, 'js/vtt', file))]; } catch (_) {}
    }
    for (const key of GEN_KEYS.filter(Boolean)) {
      const value = original.get(key);
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
}

function defaultCreatorProfile(fabric, buildings) {
  const base = fabric.normalizeProfile('mixed_urban');
  return {
    ...base,
    density: base.density,
    attachBias: base.attachBias,
    alleyBias: base.alleyBias,
    serviceAccessBias: base.serviceAccessBias,
    secondaryRoadChance: base.secondaryRoadChance,
    buildingMix: buildings.normalizeBuildingMix?.(buildings.WEIGHTS?.mixed_urban || null, 'mixed_urban')
      || { shop: .3, apartment_building: .35, workshop: .2, warehouse: .15 },
  };
}

function fakeContext() {
  const fn = () => {};
  return {
    save: fn, restore: fn, fillRect: fn, strokeRect: fn, setLineDash: fn, beginPath: fn,
    moveTo: fn, lineTo: fn, stroke: fn, fill: fn, rect: fn, setTransform: fn, fillText: fn,
    measureText: (text) => ({ width: String(text).length * 7 }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, lineCap: '',
    font: '', textAlign: '', textBaseline: '',
  };
}

function runWorkerGeneration(options) {
  const workerDir = path.join(ROOT, 'js/vtt');
  const messages = [];
  let messageHandler = null;
  const sandbox = {
    console: { log(){}, warn(){}, error(){} },
    importScripts(...scripts) {
      for (const script of scripts) {
        const absolute = path.resolve(workerDir, script);
        vm.runInContext(fs.readFileSync(absolute, 'utf8'), sandbox, { filename: absolute });
      }
    },
    addEventListener(type, handler) { if (type === 'message') messageHandler = handler; },
    postMessage(message) { messages.push(message); },
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/vtt/procedural-generator-worker.js'), sandbox, { filename: 'procedural-generator-worker.js' });
  expect(typeof messageHandler).toBe('function');
  messageHandler({ data: { type: 'generate', requestId: 'worker-contract', options } });
  return messages.at(-1);
}

test('live default Zone Creator configuration generates a valid 3x3 preview', () => withGenerator((gen, fabric, buildings) => {
  const plan = gen.generateZone({
    seed: 'default:zone',
    profile: defaultCreatorProfile(fabric, buildings),
    chunkCols: 3,
    chunkRows: 3,
    minBuildings: 4,
    maxAttempts: 8,
    gridSize: 70,
  });
  expect(plan.validation.valid).toBe(true);
  expect(plan.zone).toMatchObject({ cols: 120, rows: 120, chunkCols: 3, chunkRows: 3 });
}));

test('a valid generated plan can be painted by the ghost preview renderer without throwing', () => withGenerator((gen, fabric, buildings) => {
  const plan = gen.generateZone({
    seed: 'default:zone',
    profile: defaultCreatorProfile(fabric, buildings),
    chunkCols: 3,
    chunkRows: 3,
    minBuildings: 4,
    maxAttempts: 8,
    gridSize: 70,
  });
  const previewPath = path.join(ROOT, 'js/vtt/procedural-preview-renderer-patch.js');
  delete require.cache[require.resolve(previewPath)];
  const preview = require(previewPath);
  const ctx = fakeContext();
  const renderer = { ctx, canvas: { width: 1280, height: 720 }, render() {} };
  const camera = { applyTransformSimple() {} };
  const mapData = {
    dmEditMode: { active: true },
    proceduralEditor: {
      previewPlan: plan,
      previewOptions: { showChunks: true, showParcels: true, showRooms: true, showTopology: true, showLabels: true },
    },
  };
  const stop = preview.install(renderer, mapData);
  expect(() => renderer.render(camera, 0, null, false)).not.toThrow();
  stop();
  delete require.cache[require.resolve(previewPath)];
}));

test('ghost presentation failures are isolated from the VTT render loop and keep the valid plan', () => withGenerator((gen, fabric, buildings) => {
  const plan = gen.generateZone({
    seed: 'default:zone',
    profile: defaultCreatorProfile(fabric, buildings),
    chunkCols: 1,
    chunkRows: 1,
    minBuildings: 1,
    maxAttempts: 8,
    gridSize: 70,
  });
  const previewPath = path.join(ROOT, 'js/vtt/procedural-preview-renderer-patch.js');
  delete require.cache[require.resolve(previewPath)];
  const preview = require(previewPath);
  const renderer = { ctx: fakeContext(), canvas: { width: 1280, height: 720 }, render() { return 'base-render'; } };
  const mapData = { dmEditMode: { active: true }, proceduralEditor: { previewPlan: plan, previewOptions: {} } };
  const stop = preview.install(renderer, mapData);
  expect(() => renderer.render({ applyTransformSimple() { throw new Error('CAMERA_TEST_FAILURE'); } }, 0, null, false)).not.toThrow();
  expect(mapData.proceduralEditor.previewPlan).toBe(plan);
  expect(mapData.proceduralEditor.previewRenderError).toContain('CAMERA_TEST_FAILURE');
  stop();
  delete require.cache[require.resolve(previewPath)];
}));

test('procedural Worker loads the real core stack and generates a valid plan', () => {
  const result = runWorkerGeneration({
    seed: 'worker-contract-zone',
    profileId: 'mixed_urban',
    chunkCols: 1,
    chunkRows: 1,
    minBuildings: 1,
    maxAttempts: 8,
    gridSize: 70,
  });
  expect(result?.type).toBe('generated');
  expect(result?.requestId).toBe('worker-contract');
  expect(result?.plan?.validation?.valid).toBe(true);
  expect(result?.plan?.zone).toMatchObject({ cols: 40, rows: 40, chunkCols: 1, chunkRows: 1 });
});

test('Zone Creator uses a dedicated Web Worker for heavy preview generation', () => {
  const worker = read('js/vtt/procedural-generator-worker.js');
  const runtime = read('js/vtt/procedural-generator-bootstrap.js');
  const authoring = read('js/vtt/procedural-generator-authoring-bootstrap.js');

  for (const dependency of [
    'topology.js','surface-core.js','horizontal-plane-core.js','building-physics-core.js',
    'semantic-map-core.js','building-semantic-core.js','building-archetype-core.js','vertical-portal.js',
    'building-navigation-core.js','procedural-zone-core.js','urban-fabric-core.js',
    'procedural-building-generator.js','procedural-building-mix-patch.js','procedural-generator-core.js',
  ]) expect(worker).toContain(`'./${dependency}'`);
  expect(worker).toContain("event?.data?.type !== 'generate'");
  expect(worker).toContain('core.generateZone(event.data.options || {})');
  expect(runtime).toContain("new Worker(new URL('./procedural-generator-worker.js',import.meta.url))");
  expect(runtime).toContain('function previewAsync(options={})');
  expect(runtime).toContain('preview,previewAsync,apply,persist,createZone');
  expect(authoring).toContain('procedural.previewAsync?procedural.previewAsync(values())');
  expect(authoring).toContain('requestRevision!==generationRevision');
  expect(authoring).toContain('ENCUADRAR falló, pero la zona puede crearse.');
});

test('worker and preview crash-fix modules parse cleanly', () => {
  execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/vtt/procedural-generator-worker.js')], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/vtt/procedural-preview-renderer-patch.js')], { stdio: 'pipe' });
  for (const file of ['js/vtt/procedural-generator-bootstrap.js','js/vtt/procedural-generator-authoring-bootstrap.js']) {
    execFileSync(process.execPath, ['--input-type=module','--check'], { input: read(file), stdio: ['pipe','pipe','pipe'] });
  }
});
