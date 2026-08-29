const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const topology = require('../js/vtt/topology.js');
global.LuminousVttTopology = topology;
const builder = require('../js/vtt/wall-builder.js');
const interaction = require('../js/vtt/token-interaction.js');
global.LuminousVttTokenInteraction = interaction;
const pathfinding = require('../js/vtt/pathfinding.js');
const lighting = require('../js/vtt/lighting-engine.js');

const repo = path.resolve(__dirname, '..');
const text = (file) => fs.readFileSync(path.join(repo, file), 'utf8');

function mapWith(topologyElements = []) {
  return {
    grid: { cols:5, rows:3, size:70, distancePerCell:5, distanceUnit:'ft' },
    zLevels: { 0:{ zLayer:0, elevationFt:0 }, 1:{ zLayer:1, elevationFt:15 } },
    defaultZStepFt: 15,
    topology: topologyElements,
    walls: [],
    tokens: [],
    movement: { blockTokens:false },
    lighting: { scene:{ sources:[], interiors:[], transformers:[], switches:[], roofs:[] } },
  };
}

test('wall drag is decomposed into deterministic unit edges', () => {
  const forward = builder.createWallRun({ from:{ col:1,row:1 }, to:{ col:4,row:1 }, zLayer:0, profileId:'brick' });
  const reverse = builder.createWallRun({ from:{ col:4,row:1 }, to:{ col:1,row:1 }, zLayer:0, profileId:'brick' });
  expect(forward).toHaveLength(3);
  expect(forward.every((wall) => builder.isUnitEdge(wall.from, wall.to))).toBeTruthy();
  expect(forward.map((wall) => wall.id).sort()).toEqual(reverse.map((wall) => wall.id).sort());
  expect(forward[0].wallProfileId).toBe('brick');
  expect(forward[0].wall.materialId).toBe('brick');
  expect(forward[0].heightFt).toBe(10);
});

test('wall builder never overwrites an opening edge', () => {
  const door = topology.createElement({ id:'door_a', type:'door', from:{ col:2,row:1 }, to:{ col:3,row:1 }, zLayer:0 });
  const incoming = builder.createWallRun({ from:{ col:1,row:1 }, to:{ col:4,row:1 }, zLayer:0, profileId:'concrete' });
  const result = builder.reconcileRun([door], incoming);
  expect(result.save).toHaveLength(2);
  expect(result.skipped).toHaveLength(1);
  expect(result.skipped[0].reason).toBe('EDGE_OCCUPIED_BY_OPENING');
  expect(result.skipped[0].occupantId).toBe('door_a');
});

test('legacy long walls are not duplicated by new unit-edge authoring', () => {
  const legacy = topology.createElement({ id:'legacy_wall', type:'wall', from:{ col:1,row:0 }, to:{ col:1,row:3 }, zLayer:0 });
  const incoming = builder.createWallRun({ from:{ col:1,row:1 }, to:{ col:1,row:2 }, zLayer:0, profileId:'metal' });
  const result = builder.reconcileRun([legacy], incoming);
  expect(result.save).toHaveLength(0);
  expect(result.skipped[0].reason).toBe('EDGE_COVERED_BY_LEGACY_WALL');
});

test('unit walls remain canonical movement, A*, vision and light blockers', () => {
  const walls = builder.createWallRun({ from:{ col:2,row:1 }, to:{ col:2,row:2 }, zLayer:0, profileId:'concrete' });
  const map = mapWith(walls);
  const token = { id:'p1', x:35, y:105, radius:28, zLayer:0, z:[0] };

  const blocking = topology.blockingSegments(map.topology, 'vision', 0, map.grid);
  expect(blocking).toHaveLength(1);
  expect(interaction.isPathClear(token, { x:35,y:105 }, { x:315,y:105 }, map).valid).toBeFalsy();
  expect(lighting.lineBlocked2d({ x:35,y:105,zLayer:0 }, { x:315,y:105,zLayer:0 }, map, 0)).toBeTruthy();

  const route = pathfinding.findPath({ token, start:{ col:0,row:1 }, target:{ col:4,row:1 }, mapData:map, zLayer:0, blockTokens:false });
  expect(route.valid).toBeTruthy();
  expect(route.cells.some((cell) => cell.row !== 1)).toBeTruthy();
});

test('wall blockers are isolated to their authored Z layer', () => {
  const walls = builder.createWallRun({ from:{ col:2,row:1 }, to:{ col:2,row:2 }, zLayer:1, profileId:'metal' });
  const map = mapWith(walls);
  const token0 = { id:'p0', x:35, y:105, radius:28, zLayer:0, z:[0] };
  const token1 = { id:'p1', x:35, y:105, radius:28, zLayer:1, z:[1] };
  expect(interaction.isPathClear(token0, { x:35,y:105 }, { x:315,y:105 }, map).valid).toBeTruthy();
  expect(interaction.isPathClear(token1, { x:35,y:105 }, { x:315,y:105 }, map).valid).toBeFalsy();
  expect(lighting.lineBlocked2d({ x:35,y:105 }, { x:315,y:105 }, map, 0)).toBeFalsy();
  expect(lighting.lineBlocked2d({ x:35,y:105 }, { x:315,y:105 }, map, 1)).toBeTruthy();
});

test('wall builder bootstrap composes with the existing topology controller', () => {
  const bootstrap = text('js/vtt/wall-builder-bootstrap.js');
  const main = text('js/vtt/main.js');
  expect(bootstrap).toContain("controller.tool === 'wall'");
  expect(bootstrap).toContain("return original.down(event)");
  expect(bootstrap).toContain('builder.reconcileRun');
  expect(bootstrap).toContain('bridge.saveElement');
  expect(bootstrap).toContain("EDGE_OCCUPIED_BY_OPENING");
  expect(main).toContain("import('./wall-builder-bootstrap.js')");
  expect(main).toContain('window.LuminousVttWallBuilderRuntime?.stop?.()');
});
