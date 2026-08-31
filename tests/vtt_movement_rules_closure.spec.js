const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

require('../js/vtt/topology.js');
require('../js/vtt/token-interaction.js');
require('../js/vtt/pathfinding.js');
require('../js/vtt/movement-engine.js');
require('../js/vtt/token-state.js');
require('../js/vtt/token-state-dynamic-patch.js');
require('../js/vtt/movement-integration-patch.js');
require('../js/vtt/movement-rules.js');
require('../js/vtt/movement-rules-runtime.js');

const rules = globalThis.LuminousVttMovementRules;
const pathfinding = globalThis.LuminousVttPathfinding;
const movement = globalThis.LuminousVttMovementEngine;
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function token(id, col, patch = {}) {
  return {
    id,
    x: (col + 0.5) * 70,
    y: 35,
    zLayer: 0,
    z: [0],
    radius: 10,
    size: 'medium',
    speedFt: 30,
    gridPosition: { col, row: 0, z: 0 },
    ...patch,
  };
}

function lineMap(cols = 5) {
  return {
    id: 'movement-rules',
    grid: { cols, rows: 1, size: 70, distancePerCell: 5 },
    walls: [],
    topology: [],
    tokens: [],
    movement: { diagonalRule: '5e', blockTokens: true },
  };
}

test('space arbitration is deterministic: DM > Player > GOAP, then lower latency and arrival order', () => {
  const claims = [
    { tokenId: 'goap', authority: 'goap', rttMs: 1, receivedAtMs: 1 },
    { tokenId: 'player-slow', authority: 'player', rttMs: 80, receivedAtMs: 5 },
    { tokenId: 'dm', authority: 'dm', rttMs: 500, receivedAtMs: 20 },
    { tokenId: 'player-fast', authority: 'player', rttMs: 20, receivedAtMs: 30 },
  ];
  expect(rules.resolveSpaceClaim(claims).tokenId).toBe('dm');
  expect(rules.resolveSpaceClaim(claims.filter((claim) => claim.authority !== 'dm')).tokenId).toBe('player-fast');
  expect(rules.resolveSpaceClaim([
    { tokenId: 'late', authority: 'player', rttMs: 20, receivedAtMs: 20 },
    { tokenId: 'early', authority: 'player', rttMs: 20, receivedAtMs: 10 },
  ]).tokenId).toBe('early');
});

test('allies may be traversed but an occupied destination is never legal', () => {
  const mapData = lineMap(3);
  const mover = token('mover', 0, { teamId: 'A' });
  const ally = token('ally', 1, { teamId: 'A' });
  mapData.tokens = [mover, ally];
  const through = pathfinding.findPath({ token: mover, start: mover, target: { x: 175, y: 35 }, mapData });
  expect(through.valid).toBe(true);
  expect(through.costFt).toBe(10);
  const endOnAlly = pathfinding.findPath({ token: mover, start: mover, target: ally, mapData });
  expect(endOnAlly).toMatchObject({ valid: false, reason: 'OCCUPIED_DESTINATION' });
});

test('hostiles block traversal unless mover is at least two size categories smaller; destination remains forbidden', () => {
  const mapData = lineMap(3);
  const medium = token('medium', 0, { teamId: 'A', size: 'medium' });
  const hostile = token('hostile', 1, { teamId: 'B', size: 'large' });
  mapData.tokens = [medium, hostile];
  expect(pathfinding.findPath({ token: medium, start: medium, target: { x: 175, y: 35 }, mapData })).toMatchObject({ valid: false, reason: 'NO_PATH' });

  const small = token('small', 0, { teamId: 'A', size: 'small' });
  hostile.size = 'large';
  mapData.tokens = [small, hostile];
  const through = pathfinding.findPath({ token: small, start: small, target: { x: 175, y: 35 }, mapData });
  expect(through.valid).toBe(true);
  expect(pathfinding.findPath({ token: small, start: small, target: hostile, mapData })).toMatchObject({ valid: false, reason: 'OCCUPIED_DESTINATION' });
});

test('round start is retained, actual path cost is spent, and reset returns to turn origin with fresh base movement', () => {
  const mapData = lineMap(5);
  const mover = token('mover', 0, { speedFt: 30 });
  mapData.tokens = [mover];
  const world = movement.normalizeWorldState({ mode: 'round', roundId: 11 });
  movement.beginRound(mover, 11);
  expect(movement.movementStart(mover)).toMatchObject({ x: 35, y: 35, gridPosition: { col: 0, row: 0, z: 0 } });

  const plan = movement.planMove({ token: mover, start: mover, target: { x: 175, y: 35 }, mapData, worldState: world });
  expect(plan).toMatchObject({ valid: true, movementCostFt: 10 });
  expect(movement.commitMove(mover, plan, world)).toMatchObject({ valid: true, remainingFt: 20 });
  mover.x = 175;
  mover.gridPosition = { col: 2, row: 0, z: 0 };
  expect(mover.movementTurnHistory).toHaveLength(1);

  expect(movement.dash(mover, world, { actionType: 'quick_action' })).toMatchObject({ valid: true, actionType: 'quick_action', noise: 'high' });
  const reset = movement.resetMovement(mover, world);
  expect(reset).toMatchObject({ valid: true, remainingFt: 30, refundActionType: 'quick_action' });
  expect(mover).toMatchObject({ x: 35, y: 35, gridPosition: { col: 0, row: 0, z: 0 }, movementRemainingFt: 30 });
  expect(mover.movementState.dashed).toBe(false);
  expect(mover.movementTurnHistory).toEqual([]);
});

test('route over remaining combat movement is rejected instead of clipping or teleporting', () => {
  const mapData = lineMap(5);
  const mover = token('mover', 0, { speedFt: 10 });
  mapData.tokens = [mover];
  const world = movement.normalizeWorldState({ mode: 'round', roundId: 1 });
  movement.beginRound(mover, 1);
  const plan = movement.planMove({ token: mover, start: mover, target: { x: 315, y: 35 }, mapData, worldState: world });
  expect(plan).toMatchObject({ valid: false, reason: 'INSUFFICIENT_MOVEMENT', movementCostFt: 20, remainingFt: 10 });
});

test('walk stops at a closed door; Dash bursts an unlocked door with noise and may continue', () => {
  expect(rules.doorTraversal({ mode: 'walk', door: { state: 'closed', locked: false } })).toMatchObject({ valid: false, actionRequired: true, reason: 'DOOR_ACTION_REQUIRED' });
  expect(rules.doorTraversal({ mode: 'dash', dashActive: true, remainingFt: 20, door: { state: 'closed', locked: false } })).toMatchObject({ valid: true, opensDoor: true, burstOpen: true, continueMovement: true, noise: 'high', soundEvent: 'DASH_DOOR_BURST' });
  expect(rules.doorTraversal({ mode: 'dash', dashActive: true, door: { state: 'locked', locked: true } })).toMatchObject({ valid: false, reason: 'DOOR_LOCKED' });
});

test('memory is stale geometry only, minimap is a separate unlock, and unsaved empty zones may regenerate', () => {
  expect(rules.rememberVisibility({ visibleNow: true, remembered: true, intelligenceAllowsMemory: true })).toMatchObject({ layer: 'VISIBLE_NOW', liveActors: true });
  expect(rules.rememberVisibility({ visibleNow: false, remembered: true, intelligenceAllowsMemory: true })).toMatchObject({ layer: 'REMEMBERED', liveActors: false });
  expect(rules.rememberVisibility({ visibleNow: false, remembered: true, intelligenceAllowsMemory: true, minimapUnlocked: true })).toMatchObject({ layer: 'REMEMBERED', liveActors: false, minimap: true });
  expect(rules.zoneShouldPersist({ playerCount: 1, dmSaved: false })).toBe(true);
  expect(rules.zoneShouldPersist({ playerCount: 0, dmSaved: true })).toBe(true);
  expect(rules.zoneShouldPersist({ playerCount: 0, dmSaved: false })).toBe(false);
});

test('runtime drag contract keeps token stationary until release and then animates traversal previews', () => {
  const engineSource = read('js/vtt/engine.js');
  const bootstrapSource = read('js/vtt/movement-bootstrap.js');
  expect(engineSource).toContain('if (this.tokenMoveResolver)');
  expect(engineSource).toContain("CustomEvent('vtt:movement-destination-preview'");
  expect(engineSource).toContain('await this.tokenMoveResolver');
  expect(engineSource).toContain('await this.animateTokenPath');
  expect(engineSource).toContain("traversing: true");
  expect(bootstrapSource).toContain("import './movement-rules-runtime.js'");
  expect(bootstrapSource).toContain('engine.setTokenMoveResolver?.(resolveMovementOrder)');
  expect(bootstrapSource).toContain('movement.commitMove');
  expect(bootstrapSource).toContain('RESET MOVE');
  expect(bootstrapSource).toContain("preview.valid ? '#55ff80' : '#ff5f5f'");
  expect(bootstrapSource).toContain('isActiveCombatTurn(token)');
});
