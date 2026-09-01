const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const stair = require('../js/vtt/stair-route.js');
const movement = require('../js/vtt/vertical-movement.js');
const portalRuntime = require('../js/vtt/vertical-portal.js');
const topology = require('../js/vtt/topology.js');
const tokenControl = require('../js/vtt/token-control.js');
const spatial = require('../js/vtt/spatial-vision.js');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const map = {
  grid: { cols: 20, rows: 20, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
  defaultZStepFt: 15,
  zLevels: {
    0: { zLayer: 0, elevationFt: 0, label: 'Street' },
    1: { zLayer: 1, elevationFt: 15, label: 'Upper' },
  },
  verticalPortals: [],
  topology: [],
};

function stairs(layout = 'straight', overrides = {}) {
  return portalRuntime.normalizePortal({
    id: `stairs_${layout}`,
    type: 'stairs',
    between: [0, 1],
    from: { col: 2, row: 2 },
    to: { col: 2, row: 6 },
    layout,
    widthFt: 5,
    state: 'open',
    blocksVision: false,
    blocksLight: false,
    allowsMovement: true,
    ...overrides,
  }, map);
}

test('straight stairs use 3D route length and connect floor endpoints', () => {
  const route = stair.routeFor(stairs('straight'), map);
  expect(route.layout).toBe('straight');
  expect(route.pathLengthFt).toBeCloseTo(25, 5);
  expect(route.points[0].elevationFt).toBe(0);
  expect(route.points.at(-1).elevationFt).toBe(15);
});

test('switchback stairs build two flights plus an intermediate landing', () => {
  const route = stair.routeFor(stairs('switchback'), map);
  expect(route.points).toHaveLength(4);
  expect(route.points[1].elevationFt).toBeCloseTo(7.5, 5);
  expect(route.points[2].elevationFt).toBeCloseTo(7.5, 5);
  expect(route.points[0].x).not.toBe(route.points.at(-1).x);
  expect(route.pathLengthFt).toBeGreaterThan(25);
});

test('spiral stairs generate a helix rather than a free Z teleport', () => {
  const route = stair.routeFor(stairs('spiral'), map);
  expect(route.points.length).toBeGreaterThanOrEqual(10);
  expect(route.pathLengthFt).toBeGreaterThan(15);
  expect(route.points[0].elevationFt).toBe(0);
  expect(route.points.at(-1).elevationFt).toBe(15);
});

test('vertical ladder is a climb route with doubled default movement cost', () => {
  const route = stair.routeFor(stairs('ladder'), map);
  expect(route.movementMode).toBe('climb');
  expect(route.costMultiplier).toBe(2);
  expect(route.points[0].x).toBeCloseTo(route.points[1].x, 5);
  expect(route.points[0].y).toBeCloseTo(route.points[1].y, 5);
  expect(route.pathLengthFt).toBeCloseTo(15, 5);
});

test('dedicated climb movement removes the ladder extra multiplier', () => {
  const route = stair.routeFor(stairs('ladder'), map);
  expect(movement.effectiveMultiplier(route, { climbSpeedFt: 30 })).toBe(1);
  expect(movement.effectiveMultiplier(route, {})).toBe(2);
});

test('dropping on a stair entrance moves the token to the next Z and grid center', () => {
  const portal = stairs('straight');
  const localMap = { ...map, verticalPortals: [portal] };
  const token = { id: 'p1', x: 175, y: 175, zLayer: 0, z: [0], elevationFt: 0 };
  const result = movement.transitionOnDrop(token, { x: 175, y: 175 }, localMap);
  expect(result.valid).toBe(true);
  expect(result.complete).toBe(true);
  expect(token.zLayer).toBe(1);
  expect(token.gridPosition.z).toBe(1);
  expect(token.elevationFt).toBe(15);
  expect(token.x % 70).toBe(35);
  expect(token.y % 70).toBe(35);
});

test('finite movement budget can leave a token part-way along a U stair', () => {
  const portal = stairs('switchback');
  const localMap = { ...map, verticalPortals: [portal] };
  const token = { id: 'p1', x: 175, y: 175, zLayer: 0, z: [0], elevationFt: 0, movementRemainingFt: 10 };
  const result = movement.transitionOnDrop(token, { x: 175, y: 175 }, localMap);
  expect(result.valid).toBe(true);
  expect(result.complete).toBe(false);
  expect(token.zLayer).toBe(0);
  expect(token.verticalMovement.routeId).toBe(portal.id);
  expect(token.verticalMovement.progressFt).toBeCloseTo(10, 5);
  expect(token.elevationFt).toBeGreaterThan(0);
  expect(token.movementRemainingFt).toBe(0);
});

test('DM can control every draggable token while player is limited to linked token', () => {
  const npc = { id: 'npc', draggable: true, characterLink: { actorId: 'npc_actor' } };
  const mine = { id: 'mine', draggable: true, characterLink: { mode: 'current_player' } };
  const other = { id: 'other', draggable: true, characterLink: { playerId: 'other_player' } };
  const dmResolver = tokenControl.createResolver({ isDm: true, root: {} });
  expect(dmResolver(npc)).toBe(true);
  expect(dmResolver(other)).toBe(true);
  expect(tokenControl.canPlayerControl(mine, { playerId: 'me' })).toBe(true);
  expect(tokenControl.canPlayerControl(other, { playerId: 'me' })).toBe(false);
});

test('wall thickness is stored in feet and converted to collision/render pixels', () => {
  const wall = topology.createElement({
    id: 'thick_wall',
    type: 'wall',
    from: { col: 2, row: 2 },
    to: { col: 2, row: 8 },
    zLayer: 0,
    thicknessFt: 1,
  });
  expect(wall.thicknessFt).toBe(1);
  expect(topology.segment(wall, map.grid).thicknessPx).toBeCloseTo(14, 5);
});

test('straight stair portal allows direct cross-floor sight when no blocking wall interrupts it', () => {
  const portal = stairs('straight');
  const localMap = { ...map, verticalPortals: [portal] };
  const viewer = { x: 140, y: 70, zLayer: 0, elevationFt: 0 };
  expect(spatial.canTraverseLayers(viewer, { x: 140, y: 560 }, 1, localMap, 'vision')).toBe(true);
});

test('DM edit-mode UI exposes topology and stair authoring without exposing player authority', () => {
  const html = read('vtt.html');
  const main = read('js/vtt/main.js');
  const engine = read('js/vtt/engine.js');
  const verticalController = read('js/vtt/vertical-portal-controller.js');
  const topologyController = read('js/vtt/topology-controller.js');

  expect(html).toContain('id="vtt-dm-edit-toggle"');
  expect(html).toContain('value="switchback"');
  expect(html).toContain('value="spiral"');
  expect(html).toContain('value="ladder"');
  expect(html).toContain('id="vtt-vertical-width"');
  expect(html).toContain('id="vtt-topology-thickness"');
  expect(main).toContain('LuminousVttTokenControl');
  expect(main).toContain('LuminousVttDmEditMode');
  expect(engine).toContain('transitionOnDrop');
  expect(verticalController).toContain('this.editActive()');
  expect(topologyController).toContain('this.editActive()');
});

test('new stair/edit runtimes parse and VTT modules keep ES-module wiring', () => {
  for (const file of [
    'js/vtt/stair-route.js',
    'js/vtt/vertical-movement.js',
    'js/vtt/token-control.js',
    'js/vtt/dm-edit-mode.js',
    'js/vtt/vertical-portal.js',
    'js/vtt/spatial-vision.js',
    'js/vtt/topology.js',
    'js/vtt/token-interaction.js',
  ]) {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  }
  expect(read('js/vtt/main.js')).toContain("import { Engine } from './engine.js';");
  expect(read('js/vtt/engine.js')).toContain("import { Camera } from './camera.js';");
  expect(read('js/vtt/render/canvas2d-renderer.js')).toContain('drawStairRouteGuide');
});
