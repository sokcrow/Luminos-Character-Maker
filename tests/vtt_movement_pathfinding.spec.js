const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
require('../js/vtt/topology.js');
require('../js/vtt/token-interaction.js');
const pathfinding = require('../js/vtt/pathfinding.js');
const movement = require('../js/vtt/movement-engine.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const token = (patch = {}) => ({ id: 'mover', x: 35, y: 175, zLayer: 0, z: [0], radius: 8, speedFt: 30, gridPosition: { col: 0, row: 2, z: 0 }, ...patch });

function map5() {
  return {
    id: 'move-test',
    grid: { cols: 5, rows: 5, size: 70, distancePerCell: 5 },
    walls: [], topology: [], tokens: [], movement: { diagonalRule: '5e', blockTokens: true },
  };
}

test('A* routes around a movement wall instead of treating a blocked straight line as impossible', () => {
  const mapData = map5();
  mapData.walls.push({ x1: 140, y1: 70, x2: 140, y2: 280, z: [0], blocksMovement: true, blocksVision: true });
  const mover = token();
  mapData.tokens = [mover];
  const route = pathfinding.findPath({ token: mover, start: { x: 35, y: 175 }, target: { x: 315, y: 175 }, mapData });
  expect(route.valid).toBe(true);
  expect(route.path.length).toBeGreaterThan(5);
  expect(route.costFt).toBeGreaterThan(20);
  expect(route.path[route.path.length - 1]).toMatchObject({ col: 4, row: 2 });
});

test('A* prevents diagonal corner cutting', () => {
  const mapData = { ...map5(), grid: { cols: 2, rows: 2, size: 70, distancePerCell: 5 } };
  mapData.movement.terrain = { 0: { '1_0': { blocked: true }, '0_1': { blocked: true } } };
  const mover = token({ x: 35, y: 35, gridPosition: { col: 0, row: 0, z: 0 } });
  mapData.tokens = [mover];
  const route = pathfinding.findPath({ token: mover, start: { x: 35, y: 35 }, target: { x: 105, y: 105 }, mapData });
  expect(route.valid).toBe(false);
  expect(route.reason).toBe('NO_PATH');
});

test('difficult terrain multiplies movement cost', () => {
  const mapData = { ...map5(), grid: { cols: 3, rows: 1, size: 70, distancePerCell: 5 } };
  mapData.movement.terrain = { 0: { '1_0': { difficult: true, multiplier: 2 } } };
  const mover = token({ x: 35, y: 35, gridPosition: { col: 0, row: 0, z: 0 } });
  mapData.tokens = [mover];
  const route = pathfinding.findPath({ token: mover, start: { x: 35, y: 35 }, target: { x: 175, y: 35 }, mapData });
  expect(route.valid).toBe(true);
  expect(route.costFt).toBe(15);
});

test('other tokens can block path cells and may be disabled for planning queries', () => {
  const mapData = { ...map5(), grid: { cols: 3, rows: 1, size: 70, distancePerCell: 5 } };
  const mover = token({ x: 35, y: 35, radius: 10, gridPosition: { col: 0, row: 0, z: 0 } });
  const blocker = token({ id: 'blocker', x: 105, y: 35, radius: 10, gridPosition: { col: 1, row: 0, z: 0 } });
  mapData.tokens = [mover, blocker];
  expect(pathfinding.findPath({ token: mover, start: mover, target: { x: 175, y: 35 }, mapData }).valid).toBe(false);
  expect(pathfinding.findPath({ token: mover, start: mover, target: { x: 175, y: 35 }, mapData, blockTokens: false }).valid).toBe(true);
});

test('5e diagonals cost one cell while euclidean is available as an alternate rule', () => {
  const mapData = { ...map5(), grid: { cols: 2, rows: 2, size: 70, distancePerCell: 5 } };
  const mover = token({ x: 35, y: 35, radius: 8, gridPosition: { col: 0, row: 0, z: 0 } });
  mapData.tokens = [mover];
  const five = pathfinding.findPath({ token: mover, start: mover, target: { x: 105, y: 105 }, mapData, diagonalRule: '5e' });
  const euclidean = pathfinding.findPath({ token: mover, start: mover, target: { x: 105, y: 105 }, mapData, diagonalRule: 'euclidean' });
  expect(five.costFt).toBe(5);
  expect(euclidean.costFt).toBeCloseTo(5 * Math.SQRT2, 5);
});

test('ROUND TIME gives a speed budget, Dash adds speed, prone costs half speed to stand', () => {
  const mover = token({ x: 35, y: 35 });
  const world = movement.normalizeWorldState({ mode: 'round', roundId: 3, worldSeconds: 12 });
  expect(world.roundSeconds).toBe(6);
  expect(movement.beginRound(mover, 3).remainingFt).toBe(30);
  expect(movement.spend(mover, 10, world)).toMatchObject({ valid: true, remainingFt: 20 });
  expect(movement.dash(mover, world)).toMatchObject({ valid: true, addedFt: 30, remainingFt: 50 });
  movement.setProne(mover, true);
  expect(movement.standUp(mover, world)).toMatchObject({ valid: true, costFt: 15, remainingFt: 35 });
  expect(mover.movementState.prone).toBe(false);
});

test('round movement refuses a route that exceeds remaining speed', () => {
  const mapData = { ...map5(), grid: { cols: 5, rows: 1, size: 70, distancePerCell: 5 } };
  const mover = token({ x: 35, y: 35, speedFt: 10, gridPosition: { col: 0, row: 0, z: 0 } });
  mapData.tokens = [mover];
  const world = movement.normalizeWorldState({ mode: 'round', roundId: 1 });
  movement.beginRound(mover, 1);
  const plan = movement.planMove({ token: mover, start: mover, target: { x: 315, y: 35 }, mapData, worldState: world });
  expect(plan.valid).toBe(false);
  expect(plan.reason).toBe('INSUFFICIENT_MOVEMENT');
  expect(plan.movementCostFt).toBe(20);
});

test('climb and swim cost double without dedicated speed and normal cost with dedicated speed', () => {
  const noClimb = token({ climbSpeedFt: 0 });
  const climber = token({ climbSpeedFt: 20 });
  expect(movement.modeCostMultiplier(noClimb, 'climb')).toBe(2);
  expect(movement.modeCostMultiplier(climber, 'climb')).toBe(1);
  expect(movement.modeSpeedFt(noClimb, 'climb')).toBe(30);
  expect(movement.modeSpeedFt(climber, 'climb')).toBe(20);
});

test('teleport ignores intervening walls but still requires a valid destination', () => {
  const mapData = { ...map5(), grid: { cols: 3, rows: 1, size: 70, distancePerCell: 5 } };
  mapData.walls = [{ x1: 70, y1: 0, x2: 70, y2: 70, z: [0], blocksMovement: true }];
  const mover = token({ x: 35, y: 35, gridPosition: { col: 0, row: 0, z: 0 } });
  mapData.tokens = [mover];
  const plan = movement.planMove({ token: mover, start: mover, target: { x: 175, y: 35 }, mapData, worldState: { mode: 'round', roundId: 1 }, movementType: 'teleport' });
  expect(plan.valid).toBe(true);
  expect(plan.movementCostFt).toBe(0);
});

test('movement integration replaces direct-drop resolution with planned paths', () => {
  const source = read('js/vtt/movement-integration-patch.js');
  expect(source).toContain('movement.planMove');
  expect(source).toContain('movement.commitMove');
  expect(source).toContain('__pathfindingMovementPatch');
  expect(source).toContain('token.verticalMovement');
});

test('world movement state is DM canonical per map and advances six-second rounds', () => {
  const source = read('js/vtt/movement-state.js');
  expect(source).toContain("campaña/estado_mundo/vttMovement");
  expect(source).toContain("currentState.worldSeconds + currentState.roundSeconds");
  expect(source).toContain("normalizedMode === 'round'");
});

test('movement bootstrap exposes FREE / ROUND TIME / NEXT ROUND and future AI round event', () => {
  const source = read('js/vtt/movement-bootstrap.js');
  expect(source).toContain('FREE');
  expect(source).toContain('ROUND TIME');
  expect(source).toContain('NEXT ROUND');
  expect(source).toContain("CustomEvent('vtt:world-round'");
  expect(source).toContain('movement.reconcileVertical');
  expect(source).toContain('planMove');
});

test('main installs pathfinding movement patch before Engine uses token interaction and starts runtime UI', () => {
  const source = read('js/vtt/main.js');
  const pathIndex = source.indexOf("import './pathfinding.js'");
  const patchIndex = source.indexOf("import './movement-integration-patch.js'");
  const engineIndex = source.indexOf('new Engine(canvas, mockMapData)');
  expect(pathIndex).toBeGreaterThan(-1);
  expect(patchIndex).toBeGreaterThan(pathIndex);
  expect(engineIndex).toBeGreaterThan(patchIndex);
  expect(source).toContain("import('./movement-bootstrap.js')");
  expect(source).toContain('LuminousVttRuntime?.movement?.stop?.()');
});