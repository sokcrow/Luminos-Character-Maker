const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const pov = require('../js/vtt/pov-engine.js');
const povState = require('../js/vtt/pov-state.js');
const lighting = require('../js/vtt/lighting-engine.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function map(overrides = {}) {
  return {
    id: 'alpha',
    grid: { cols: 20, rows: 20, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
    defaultZStepFt: 15,
    defaultCeilingHeightFt: 10,
    zLevels: {
      0: { zLayer: 0, elevationFt: 0 },
      1: { zLayer: 1, elevationFt: 15 },
      2: { zLayer: 2, elevationFt: 30 },
    },
    walls: [],
    topology: [],
    verticalPortals: [],
    tokens: [],
    ambientLight: { level: 'darkness' },
    ...overrides,
  };
}

function scene(overrides = {}) {
  return { sources: [], interiors: [], roofs: [], transformers: [], switches: [], ...overrides };
}

function viewer(overrides = {}) {
  return {
    id: 'viewer', x: 0, y: 0, zLayer: 0, elevationFt: 0,
    facingDeg: 180, lookDeg: 0, eyeHeightFt: 5, visionConeDeg: 120,
    senses: { darkvisionFt: 0 },
    ...overrides,
  };
}

const brightEnv = () => ({ state: { light: 'bright', visibility: 'clear' } });
const darkEnv = () => ({ state: { light: 'darkness', visibility: 'clear' } });

function fakeRoot({ uid = 'uid-a', playerId = 'alice' } = {}) {
  const writes = [];
  const handlers = [];
  const makeRef = (value) => ({
    path: value,
    child(key) { return makeRef(`${value}/${key}`); },
    async set(payload) { writes.push({ type: 'set', path: value, value: payload }); },
    on(event, handler) { handlers.push({ value, event, handler }); },
    off() {},
  });
  const database = () => ({ ref: (value) => makeRef(value) });
  database.ServerValue = { TIMESTAMP: 123456 };
  const root = {
    document: {},
    datosJugador: { id: playerId, playerId },
    localStorage: { getItem: (key) => key === 'playerId' ? playerId : null },
    firebase: { auth: () => ({ currentUser: { uid } }), database },
    setInterval: () => 1,
    clearInterval() {},
    LuminousVttPovEngine: pov,
  };
  return { root, writes };
}

test('look direction is independent from body facing and drives the vision cone', () => {
  const m = map();
  const v = viewer({ facingDeg: 180, lookDeg: 0 });
  const ahead = { x: lighting.feetToPixels(10, m), y: 0, zLayer: 0, elevationFt: 0 };
  const behind = { x: -lighting.feetToPixels(10, m), y: 0, zLayer: 0, elevationFt: 0 };
  expect(pov.lookDeg(v)).toBe(0);
  expect(pov.perceptionAtPoint(v, ahead, scene(), m, brightEnv()).visible).toBe(true);
  expect(pov.perceptionAtPoint(v, behind, scene(), m, brightEnv()).visible).toBe(false);
});

test('default eye height is 5 ft and default roof plane is 10 ft over its floor', () => {
  const m = map();
  expect(pov.eyePoint(viewer({ eyeHeightFt: undefined }), m).elevationFt).toBe(5);
  const roof = pov.normalizeRoof({ id: 'awning', zLayer: 0, x1: 0, y1: 0, x2: 70, y2: 70 }, m);
  expect(roof.elevationFt).toBe(10);
});

test('a 5 ft roof casts a perspective shadow instead of blocking the whole upper floor', () => {
  const m = map();
  const halfRoof = lighting.feetToPixels(2.5, m);
  const s = scene({ roofs: [{ id: 'small-roof', zLayer: 0, elevationFt: 10, x1: -halfRoof, y1: -halfRoof, x2: halfRoof, y2: halfRoof, transparent: false }] });
  const v = viewer();
  const blocked = { x: 0, y: 0, zLayer: 1, elevationFt: 15 };
  const clear = { x: lighting.feetToPixels(6, m), y: 0, zLayer: 1, elevationFt: 15 };

  expect(pov.roofOcclusion(v, blocked, s, m)).toMatchObject({ blocked: true, roof: { id: 'small-roof' } });
  expect(pov.roofOcclusion(v, clear, s, m).blocked).toBe(false);
  expect(pov.perceptionAtPoint(v, blocked, s, m, brightEnv(), 1000, { lookUp: true }).reason).toBe('ROOF_OCCLUSION');
  expect(pov.perceptionAtPoint(v, clear, s, m, brightEnv(), 1000, { lookUp: true }).visible).toBe(true);
});

test('perspective math gives 10 ft shadow at Z15 and 15 ft shadow at Z20 for the example geometry', () => {
  expect(pov.projectedShadowWidthFt(5, 5, 10)).toBeCloseTo(10, 6);
  expect(pov.projectedShadowWidthFt(5, 5, 15)).toBeCloseTo(15, 6);
});

test('transparent roofs do not occlude Look Up rays', () => {
  const m = map();
  const s = scene({ roofs: [{ id: 'glass', zLayer: 0, elevationFt: 10, x1: -70, y1: -70, x2: 70, y2: 70, transparent: true }] });
  expect(pov.roofOcclusion(viewer(), { x: 0, y: 0, zLayer: 1, elevationFt: 15 }, s, m).blocked).toBe(false);
});

test('an upper dark interior is visible only 5 ft through an un-walled boundary', () => {
  const m = map();
  const interior = { id: 'upper-room', zLayer: 1, x1: 0, y1: 0, x2: 700, y2: 700, baseLight: 'darkness', roof: { present: true, transparent: false } };
  const s = scene({ interiors: [interior] });
  const near = { x: lighting.feetToPixels(4, m), y: 350, zLayer: 1, elevationFt: 15 };
  const deep = { x: lighting.feetToPixels(6, m), y: 350, zLayer: 1, elevationFt: 15 };
  expect(pov.lookUpInteriorGate(viewer(), near, s, m, brightEnv())).toMatchObject({ allowed: true, reason: 'OPENING_5FT' });
  expect(pov.lookUpInteriorGate(viewer(), deep, s, m, brightEnv())).toMatchObject({ allowed: false, reason: 'INTERIOR_DEPTH_LIMIT' });
});

test('a closed wall removes the implicit open-boundary Look Up window', () => {
  const m = map({ topology: [{ id: 'left-wall', type: 'wall', from: { col: 0, row: 0 }, to: { col: 0, row: 10 }, z: [1] }] });
  const s = scene({ interiors: [{ id: 'upper-room', zLayer: 1, x1: 0, y1: 0, x2: 700, y2: 700, baseLight: 'darkness', roof: { present: true, transparent: false } }] });
  const near = { x: lighting.feetToPixels(4, m), y: 350, zLayer: 1, elevationFt: 15 };
  expect(pov.lookUpInteriorGate(viewer(), near, s, m, brightEnv())).toMatchObject({ allowed: false, reason: 'INTERIOR_DEPTH_LIMIT' });
});

test('a normal closed window counts as a valid 5 ft Look Up opening', () => {
  const m = map({ topology: [{ id: 'window', type: 'window', from: { col: 0, row: 0 }, to: { col: 0, row: 10 }, z: [1], state: 'closed', thresholds: { lockpick: 12, break: 10 } }] });
  const s = scene({ interiors: [{ id: 'upper-room', zLayer: 1, x1: 0, y1: 0, x2: 700, y2: 700, baseLight: 'darkness', roof: { present: true, transparent: false } }] });
  const near = { x: lighting.feetToPixels(4, m), y: 350, zLayer: 1, elevationFt: 15 };
  expect(pov.lookUpInteriorGate(viewer(), near, s, m, brightEnv())).toMatchObject({ allowed: true, reason: 'OPENING_5FT' });
});

test('real interior illumination can reveal deeper than the 5 ft ambient Look Up limit', () => {
  const m = map();
  const deep = { x: lighting.feetToPixels(12, m), y: 350, zLayer: 1, elevationFt: 15 };
  const s = scene({
    interiors: [{ id: 'upper-room', zLayer: 1, x1: 0, y1: 0, x2: 700, y2: 700, baseLight: 'darkness', roof: { present: true, transparent: false } }],
    sources: [{ id: 'lamp', x: deep.x, y: deep.y, zLayer: 1, elevationFt: 15, brightFt: 15, dimAdditionalFt: 15, enabled: true }],
  });
  expect(pov.lookUpInteriorGate(viewer(), deep, s, m, darkEnv())).toMatchObject({ allowed: true, reason: 'INTERNAL_LIGHT' });
});

test('Look Up resolves the next logical floor without changing the token physical Z', () => {
  const m = map();
  const token = viewer({ zLayer: 0, elevationFt: 0 });
  const before = { zLayer: token.zLayer, elevationFt: token.elevationFt };
  expect(pov.nextLayer(token, m)).toBe(1);
  expect(token).toMatchObject(before);
  expect(pov.nextLayer(1, m)).toBe(2);
  expect(pov.nextLayer(2, m)).toBeNull();
});

test('player Look direction persists only under their canonical player node', async () => {
  const { root, writes } = fakeRoot({ uid: 'uid-a', playerId: 'alice' });
  const token = { id: 'player-template', characterLink: { mode: 'current_player' }, lookDeg: 37 };
  const bridge = povState.createBridge({ mapData: { id: 'alpha', tokens: [token] }, isDm: false, root });
  await bridge.saveLook(token);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ path: 'campaña/jugadores/alice/vttPov/alpha/lookDeg', value: 37 });
});

test('a player cannot persist another token look direction while DM can persist world PoV', async () => {
  const player = fakeRoot({ uid: 'uid-a', playerId: 'alice' });
  const playerBridge = povState.createBridge({ mapData: { id: 'alpha', tokens: [] }, isDm: false, root: player.root });
  await expect(playerBridge.saveLook({ id: 'player:bob', canonicalPlayerKey: 'bob', canonicalOwnerUid: 'uid-b', lookDeg: 90 })).rejects.toThrow('PLAYER_TOKEN_OWNERSHIP_REQUIRED');

  const dm = fakeRoot({ uid: povState.DM_UID, playerId: 'dm' });
  const dmBridge = povState.createBridge({ mapData: { id: 'alpha', tokens: [] }, isDm: true, root: dm.root });
  await dmBridge.saveLook({ id: 'npc-1', lookDeg: 270 });
  expect(dm.writes[0].path).toBe('campaña/estado_mundo/vttPov/alpha/npc-1');
  expect(dm.writes[0].value.lookDeg).toBe(270);
});

test('runtime wiring uses mouse Look, E lock, hold-Q Look Up, white direction marker and roof authoring', () => {
  const bootstrap = read('js/vtt/dynamic-lighting-bootstrap.js');
  const controller = read('js/vtt/pov-controller.js');
  const renderer = read('js/vtt/pov-renderer.js');

  expect(bootstrap).toContain("import './pov-engine.js'");
  expect(bootstrap).toContain('pov.perceptionAtPoint');
  expect(bootstrap).toContain('povController.viewLayer(activeZ)');
  expect(bootstrap).not.toContain('updateFacingFromMove');
  expect(controller).toContain("key === 'e'");
  expect(controller).toContain("key === 'q'");
  expect(controller).toContain("canvas.addEventListener('mousemove', onPointerMove)");
  expect(controller).toContain("button.textContent = 'ROOF'");
  expect(controller).toContain('mapData.pov.lookUpHeld');
  expect(renderer).toContain("ctx.fillStyle = '#ffffff'");
  expect(renderer).toContain('token.lookDeg');
  expect(renderer).not.toContain('ctx.rotate(');
});

test('new PoV runtimes parse as JavaScript', () => {
  for (const file of ['js/vtt/pov-engine.js', 'js/vtt/pov-state.js', 'js/vtt/pov-controller.js', 'js/vtt/pov-renderer.js', 'js/vtt/dynamic-lighting-bootstrap.js']) {
    execFileSync(process.execPath, ['--check', path.join(__dirname, '..', file)], { stdio: 'pipe' });
  }
});
