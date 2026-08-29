const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function loadCore() {
  delete require.cache[require.resolve('../js/vtt/surface-core.js')];
  return require('../js/vtt/surface-core.js');
}

function baseMap(cols = 6, rows = 4) {
  return {
    id: 'surface_test',
    grid: { cols, rows, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
    zLevels: { 0:{ zLayer:0, elevationFt:0, label:'Ground' } },
    movement: { terrain: { '0': { '5_3': { multiplier:3, legacy:true } } }, blockTokens:false },
    tokens: [],
  };
}

test('surface grid stays sparse and projects only painted cells into canonical movement terrain', () => {
  const core = loadCore();
  const mapData = baseMap();
  core.ensureMapState(mapData);
  expect(Object.keys(mapData.surfaceMaterials)).toEqual(expect.arrayContaining(['concrete','asphalt','mud','deep_water']));
  expect(mapData.surfaceLayers).toEqual({});

  core.setCell(mapData, 0, 2, 1, 'mud');
  expect(mapData.surfaceLayers['0']).toEqual({ '2_1': { materialId:'mud', elevationOffsetFt:0 } });
  expect(mapData.movement.terrain['0']['2_1']).toMatchObject({ multiplier:2, difficult:true, surfaceMaterialId:'mud', _surface:true });
  expect(mapData.movement.terrain['0']['5_3']).toMatchObject({ multiplier:3, legacy:true });

  core.eraseCell(mapData, 0, 2, 1);
  expect(mapData.surfaceLayers['0']).toBeUndefined();
  expect(mapData.movement.terrain['0']['2_1']).toBeUndefined();
  expect(mapData.movement.terrain['0']['5_3']).toMatchObject({ multiplier:3, legacy:true });
});

test('surface material movement contract blocks walk on deep water but permits swim', () => {
  const core = loadCore();
  global.LuminousVttSurfaceCore = core;
  delete require.cache[require.resolve('../js/vtt/pathfinding.js')];
  const pathfinding = require('../js/vtt/pathfinding.js');
  const mapData = baseMap(3, 3);
  core.ensureMapState(mapData);
  core.setCell(mapData, 0, 1, 1, 'deep_water');
  const token = { id:'p', x:35, y:105, radius:20, zLayer:0 };
  const point = pathfinding.pointForCell({ col:1, row:1 }, mapData, 0);
  expect(pathfinding.pointPassable(token, point, mapData, 0, { movementMode:'walk', blockTokens:false })).toMatchObject({ valid:false, reason:'TERRAIN_MODE_BLOCKED' });
  expect(pathfinding.pointPassable(token, point, mapData, 0, { movementMode:'swim', blockTokens:false }).valid).toBe(true);
});

test('A* consumes painted surface costs and routes around expensive mud when cheaper pavement exists', () => {
  const core = loadCore();
  global.LuminousVttSurfaceCore = core;
  delete require.cache[require.resolve('../js/vtt/pathfinding.js')];
  const pathfinding = require('../js/vtt/pathfinding.js');
  const mapData = baseMap(5, 3);
  mapData.movement.terrain = {};
  core.ensureMapState(mapData);
  core.setCell(mapData, 0, 1, 1, 'mud');
  core.setCell(mapData, 0, 2, 1, 'mud');
  core.setCell(mapData, 0, 3, 1, 'mud');
  const token = { id:'p', x:35, y:105, radius:10, zLayer:0 };
  const route = pathfinding.findPath({
    token,
    start:pathfinding.pointForCell({ col:0,row:1 }, mapData, 0),
    target:pathfinding.pointForCell({ col:4,row:1 }, mapData, 0),
    mapData,
    movementMode:'walk',
    blockTokens:false,
  });
  expect(route.valid).toBe(true);
  expect(route.costFt).toBeLessThan(35);
  expect(route.cells).not.toContainEqual({ col:2, row:1 });
});

test('surface-aware MapDefinition persists surfaces across normalization and floor edits', () => {
  delete global.LuminousVttMapAuthoring;
  delete global.LuminousVttSurfaceCore;
  delete require.cache[require.resolve('../js/vtt/map-authoring.js')];
  delete require.cache[require.resolve('../js/vtt/surface-core.js')];
  delete require.cache[require.resolve('../js/vtt/surface-authoring-patch.js')];
  require('../js/vtt/map-authoring.js');
  const core = require('../js/vtt/surface-core.js');
  require('../js/vtt/surface-authoring-patch.js');
  const authoring = global.LuminousVttMapAuthoring;
  expect(authoring.__surfaceAware).toBe(true);

  const raw = {
    id:'painted_map', name:'Painted Map', grid:{ cols:4,rows:4,size:70,distancePerCell:5 },
    zLevels:{ 0:{zLayer:0,elevationFt:0,label:'Ground'} },
    surfaceMaterials:core.defaultMaterialCatalog(),
    surfaceLayers:{ '0':{ '1_1':{ materialId:'asphalt', elevationOffsetFt:0 } } },
  };
  const normalized = authoring.normalizeDefinition(raw);
  expect(normalized.surfaceLayers['0']['1_1']).toMatchObject({ materialId:'asphalt' });
  const withFloor = authoring.addLevel(normalized, 0, 1);
  expect(withFloor.surfaceLayers['0']['1_1']).toMatchObject({ materialId:'asphalt' });

  const mapData = { id:'old', grid:{cols:2,rows:2,size:70,distancePerCell:5}, zLevels:{0:{zLayer:0,elevationFt:0}}, movement:{terrain:{}}, tokens:[] };
  authoring.applyDefinition(mapData, withFloor);
  expect(mapData.surfaceLayers['0']['1_1']).toMatchObject({ materialId:'asphalt' });
  expect(mapData.movement.terrain['0']['1_1']).toMatchObject({ surfaceMaterialId:'asphalt' });
  expect(authoring.definitionFromMapData(mapData).surfaceLayers['0']['1_1']).toMatchObject({ materialId:'asphalt' });
});

test('floor deletion is blocked while the floor contains painted surfaces', () => {
  const authoring = global.LuminousVttMapAuthoring;
  const core = global.LuminousVttSurfaceCore;
  const mapData = {
    id:'floors', grid:{cols:3,rows:3,size:70,distancePerCell:5},
    zLevels:{0:{zLayer:0,elevationFt:0,label:'Ground'},1:{zLayer:1,elevationFt:15,label:'Upper'}},
    walls:[], topology:[], verticalPortals:[], tokens:[], lighting:{scene:{roofs:[],sources:[]}}, movement:{terrain:{}},
    surfaceMaterials:core.defaultMaterialCatalog(), surfaceLayers:{'1':{'1_1':{materialId:'tile',elevationOffsetFt:0}}},
  };
  core.ensureMapState(mapData);
  expect(authoring.canDeleteLevel(mapData, 1)).toMatchObject({ valid:false, reason:'FLOOR_IN_USE' });
});

test('surface painter composes background then surface then grid and captures paint input before token dragging', () => {
  const source = fs.readFileSync(path.join(__dirname,'..','js','vtt','surface-bootstrap.js'),'utf8');
  const original = source.indexOf('const result = originalDrawGrid(...args)');
  const surface = source.indexOf('surfaceRenderer.drawSurfaceLayer');
  const overlay = source.indexOf('surfaceRenderer.drawGridOverlay');
  expect(original).toBeGreaterThan(-1);
  expect(surface).toBeGreaterThan(original);
  expect(overlay).toBeGreaterThan(surface);
  expect(source).toContain("canvas.addEventListener('mousedown', onPointerDown, true)");
  expect(source).toContain("window.addEventListener('mousemove', onPointerMove, true)");
  expect(source).toContain('bridge?.saveDefinition');
  expect(source).toContain('data-surface-tool="brush"');
  expect(source).toContain('data-surface-tool="rect"');
  expect(source).toContain('data-surface-tool="erase"');
});

test('main bootstrap installs the surface authoring patch before active map lookup and starts painter after map authoring', () => {
  const source = fs.readFileSync(path.join(__dirname,'..','js','vtt','main.js'),'utf8');
  expect(source.indexOf("import './surface-authoring-patch.js';")).toBeLessThan(source.indexOf("import './map-authoring-state.js';"));
  expect(source).toContain("const surfaceModule = await import('./surface-bootstrap.js')");
  expect(source).toContain('LuminousVttSurfaceCore?.ensureMapState?.(mockMapData)');
  expect(source).toContain('window.LuminousVttSurfaceRuntime?.stop?.()');
});
