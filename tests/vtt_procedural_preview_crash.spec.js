const { test, expect } = require('@playwright/test');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
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
