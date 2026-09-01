const { test, expect } = require('@playwright/test');
const portalRuntime = require('../js/vtt/vertical-portal.js');
const movement = require('../js/vtt/vertical-movement.js');

const map = {
  grid: { cols: 20, rows: 20, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
  defaultZStepFt: 15,
  zLevels: {
    0: { zLayer: 0, elevationFt: 0 },
    1: { zLayer: 1, elevationFt: 15 },
  },
  verticalPortals: [],
};

function switchback() {
  return portalRuntime.normalizePortal({
    id: 'stairs_resume',
    type: 'stairs',
    between: [0, 1],
    from: { col: 2, row: 2 },
    to: { col: 2, row: 6 },
    layout: 'switchback',
    widthFt: 5,
    allowsMovement: true,
    state: 'open',
  }, map);
}

test('a token stopped inside a U stair resumes that same route on its next movement budget', () => {
  const portal = switchback();
  const localMap = { ...map, verticalPortals: [portal] };
  const token = {
    id: 'walker',
    x: 175,
    y: 175,
    zLayer: 0,
    z: [0],
    elevationFt: 0,
    movementRemainingFt: 10,
  };

  const first = movement.transitionOnDrop(token, { x: 175, y: 175 }, localMap);
  expect(first.valid).toBe(true);
  expect(first.complete).toBe(false);
  const firstProgress = token.verticalMovement.progressFt;
  expect(firstProgress).toBeGreaterThan(0);

  token.movementRemainingFt = 10;
  const second = movement.transitionOnDrop(token, { x: token.x + 300, y: token.y + 300 }, localMap);
  expect(second.valid).toBe(true);
  expect(second.resumed).toBe(true);
  expect(token.verticalMovement.progressFt).toBeGreaterThan(firstProgress);
  expect(token.verticalMovement.costSpentFt).toBeCloseTo(20, 5);
});

test('repeated movement budgets eventually complete the stair and place the token on destination Z', () => {
  const portal = switchback();
  const localMap = { ...map, verticalPortals: [portal] };
  const token = {
    id: 'walker',
    x: 175,
    y: 175,
    zLayer: 0,
    z: [0],
    elevationFt: 0,
    movementRemainingFt: 10,
  };

  let result = movement.transitionOnDrop(token, { x: 175, y: 175 }, localMap);
  let guard = 0;
  while (!result.complete && guard < 10) {
    token.movementRemainingFt = 10;
    result = movement.transitionOnDrop(token, { x: token.x, y: token.y }, localMap);
    guard += 1;
  }

  expect(result.complete).toBe(true);
  expect(token.zLayer).toBe(1);
  expect(token.z).toEqual([1]);
  expect(token.gridPosition.z).toBe(1);
  expect(token.elevationFt).toBe(15);
  expect(token.verticalMovement).toBeUndefined();
  expect(token.lastVerticalTravel.routeId).toBe(portal.id);
});
