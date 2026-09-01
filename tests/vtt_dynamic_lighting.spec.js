const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lighting = require('../js/vtt/lighting-engine.js');
const environmentEngine = require('../js/environment-engine.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function map(overrides = {}) {
  return {
    id: 'test-map',
    grid: { cols: 20, rows: 20, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
    defaultZStepFt: 15,
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

function darkEnv() { return { state: { light: 'darkness', visibility: 'clear' } }; }
function brightEnv() { return { state: { light: 'bright', visibility: 'clear' } }; }
function scene(overrides = {}) { return { sources: [], interiors: [], transformers: [], switches: [], ...overrides }; }

function viewer(overrides = {}) {
  return {
    id: 'viewer', x: 70, y: 70, zLayer: 0, elevationFt: 0,
    facingDeg: 0, visionConeDeg: 120, senses: { darkvisionFt: 0 },
    ...overrides,
  };
}

test('vision is directional with a configurable 120 degree default cone', () => {
  expect(lighting.DEFAULT_VISION_CONE_DEG).toBe(120);
  const origin = { x: 0, y: 0 };
  expect(lighting.pointInCone(origin, { x: 100, y: 0 }, 0, 120)).toBe(true);
  expect(lighting.pointInCone(origin, { x: 50, y: 86.6 }, 0, 120)).toBe(true);
  expect(lighting.pointInCone(origin, { x: 0, y: 100 }, 0, 120)).toBe(false);
  expect(lighting.pointInCone(origin, { x: -100, y: 0 }, 0, 120)).toBe(false);
});

test('normal vision in darkness only gets a 3 ft dim pocket', () => {
  const m = map();
  const v = viewer({ x: 0, y: 0 });
  const near = { x: lighting.feetToPixels(2.9, m), y: 0, zLayer: 0, elevationFt: 0 };
  const far = { x: lighting.feetToPixels(3.1, m), y: 0, zLayer: 0, elevationFt: 0 };
  const nearResult = lighting.perceptionAtPoint(v, near, scene(), m, darkEnv());
  const farResult = lighting.perceptionAtPoint(v, far, scene(), m, darkEnv());
  expect(nearResult).toMatchObject({ visible: true, mode: 'near_dim', level: 'dim', monochrome: false });
  expect(farResult.visible).toBe(false);
});

test('Darkvision is grayscale only when darkness itself is being perceived', () => {
  const m = map();
  const v = viewer({ x: 0, y: 0, senses: { darkvisionFt: 60 } });
  const point = { x: lighting.feetToPixels(20, m), y: 0, zLayer: 0, elevationFt: 0 };
  const dark = lighting.perceptionAtPoint(v, point, scene(), m, darkEnv());
  expect(dark).toMatchObject({ visible: true, mode: 'darkvision', monochrome: true, level: 'dim' });

  const litScene = scene({ sources: [{ id: 'torch', x: point.x, y: point.y, zLayer: 0, elevationFt: 0, brightFt: 10, dimAdditionalFt: 10, enabled: true }] });
  const lit = lighting.perceptionAtPoint(v, point, litScene, m, darkEnv());
  expect(lit.visible).toBe(true);
  expect(lit.monochrome).toBe(false);
  expect(lit.mode).toBe('normal_bright');
});

test('outside weather and calendar drive natural ambient light through EnvironmentEngine', () => {
  const noon = lighting.exteriorEnvironment({
    weatherState: { actual: { tipo: 'nublado' } },
    calendar: { hora: 12 },
    environmentEngine,
  });
  const midnight = lighting.exteriorEnvironment({
    weatherState: { actual: { tipo: 'soleado' } },
    calendar: { hora: 0 },
    environmentEngine,
  });
  expect(noon.source).toBe('environment-engine');
  expect(noon.state.light).toBe('bright');
  expect(noon.state.sunlight).toBe('diffuse');
  expect(midnight.state.light).toBe('darkness');
  expect(midnight.state.sunlight).toBe('none');
});

test('daylight hours are configurable instead of hard-coded as a universal sunrise', () => {
  expect(lighting.isDayFromCalendar({ hora: 12 }, { start: 6, end: 18 })).toBe(true);
  expect(lighting.isDayFromCalendar({ hora: 20 }, { start: 6, end: 18 })).toBe(false);
  expect(lighting.isDayFromCalendar({ hora: 20 }, { start: 18, end: 6 })).toBe(true);
});

test('interiors are dark beyond 5 ft of an opening but receive exterior light near a window', () => {
  const m = map({
    topology: [{ id: 'window', type: 'window', from: { col: 0, row: 0 }, to: { col: 0, row: 2 }, z: [0], state: 'closed', thresholds: { lockpick: 12, break: 10 } }],
  });
  const s = scene({ interiors: [{ id: 'room', zLayer: 0, x1: 0, y1: 0, x2: 700, y2: 700, baseLight: 'darkness', exteriorPenetrationFt: 5, roof: { present: true, transparent: false } }] });
  const near = { x: lighting.feetToPixels(4, m), y: 35, zLayer: 0, elevationFt: 0 };
  const deep = { x: lighting.feetToPixels(8, m), y: 140, zLayer: 0, elevationFt: 0 };
  expect(lighting.ambientAtPoint(near, s, m, brightEnv()).origin).toBe('exterior_penetration');
  expect(lighting.ambientAtPoint(near, s, m, brightEnv()).level).toBe('bright');
  expect(lighting.ambientAtPoint(deep, s, m, brightEnv()).level).toBe('darkness');
});

test('closed windows pass light while walls and closed doors block it', () => {
  const source = { id: 'lamp', x: 35, y: 105, zLayer: 0, elevationFt: 0, brightFt: 30, dimAdditionalFt: 0, enabled: true };
  const target = { x: 175, y: 105, zLayer: 0, elevationFt: 0 };
  const windowMap = map({ topology: [{ id: 'w', type: 'window', from: { col: 1, row: 0 }, to: { col: 1, row: 3 }, z: [0], state: 'closed', thresholds: { lockpick: 12, break: 10 } }] });
  const wallMap = map({ topology: [{ id: 'wall', type: 'wall', from: { col: 1, row: 0 }, to: { col: 1, row: 3 }, z: [0] }] });
  const doorMap = map({ topology: [{ id: 'door', type: 'door', from: { col: 1, row: 0 }, to: { col: 1, row: 3 }, z: [0], state: 'closed', thresholds: { lockpick: 15, break: 15 } }] });
  expect(lighting.sourceLevelAtPoint(source, target, scene(), windowMap)).toBe('bright');
  expect(lighting.sourceLevelAtPoint(source, target, scene(), wallMap)).toBe('darkness');
  expect(lighting.sourceLevelAtPoint(source, target, scene(), doorMap)).toBe('darkness');
});

test('open or broken doors stop blocking light and closed curtain windows block it', () => {
  const source = { id: 'lamp', x: 35, y: 105, zLayer: 0, elevationFt: 0, brightFt: 30, dimAdditionalFt: 0, enabled: true };
  const target = { x: 175, y: 105, zLayer: 0, elevationFt: 0 };
  const mk = (type, state) => map({ topology: [{ id: 'x', type, from: { col: 1, row: 0 }, to: { col: 1, row: 3 }, z: [0], state, thresholds: { lockpick: 12, break: 10 } }] });
  expect(lighting.sourceLevelAtPoint(source, target, scene(), mk('door', 'open'))).toBe('bright');
  expect(lighting.sourceLevelAtPoint(source, target, scene(), mk('door', 'broken'))).toBe('bright');
  expect(lighting.sourceLevelAtPoint(source, target, scene(), mk('curtain_window', 'closed'))).toBe('darkness');
});

test('artificial light uses real 3D distance between Z levels', () => {
  const m = map();
  const source = { id: 'street', x: 70, y: 70, zLayer: 0, elevationFt: 0, brightFt: 20, dimAdditionalFt: 20, enabled: true };
  const directlyAbove = { x: 70, y: 70, zLayer: 1, elevationFt: 15 };
  const fartherAbove = { x: lighting.feetToPixels(20, m) + 70, y: 70, zLayer: 1, elevationFt: 15 };
  expect(lighting.distance3dFt(source, directlyAbove, m)).toBeCloseTo(15, 6);
  expect(lighting.sourceLevelAtPoint(source, directlyAbove, scene(), m)).toBe('bright');
  expect(lighting.distance3dFt(source, fartherAbove, m)).toBeCloseTo(25, 6);
  expect(lighting.sourceLevelAtPoint(source, fartherAbove, scene(), m)).toBe('dim');
});

test('opaque roofs block cross-floor light while transparent roofs permit it', () => {
  const m = map();
  const source = { id: 'below', x: 140, y: 140, zLayer: 0, elevationFt: 0, brightFt: 30, dimAdditionalFt: 0, enabled: true };
  const target = { x: 140, y: 140, zLayer: 1, elevationFt: 15 };
  const opaque = scene({ interiors: [{ id: 'upper', zLayer: 1, x1: 0, y1: 0, x2: 300, y2: 300, roof: { present: true, transparent: false } }] });
  const transparent = scene({ interiors: [{ id: 'upper', zLayer: 1, x1: 0, y1: 0, x2: 300, y2: 300, roof: { present: true, transparent: true } }] });
  expect(lighting.sourceLevelAtPoint(source, target, opaque, m)).toBe('darkness');
  expect(lighting.sourceLevelAtPoint(source, target, transparent, m)).toBe('bright');
});

test('vertical openings permit cross-floor light even when an interior roof exists', () => {
  const m = map({ verticalPortals: [{ id: 'opening', type: 'opening', between: [0, 1], from: { col: 1, row: 1 }, to: { col: 3, row: 1 }, blocksLight: false, blocksVision: false, state: 'open' }] });
  const source = { id: 'below', x: 70, y: 140, zLayer: 0, elevationFt: 0, brightFt: 30, dimAdditionalFt: 0, enabled: true };
  const target = { x: 210, y: 0, zLayer: 1, elevationFt: 15 };
  const s = scene({ interiors: [{ id: 'upper', zLayer: 1, x1: 0, y1: 0, x2: 400, y2: 400, roof: { present: true, transparent: false } }] });
  expect(lighting.canTraverseLayers(source, target, s, m, 'light')).toBe(true);
});

test('strongest illumination wins and overlapping Dim sources do not become Bright', () => {
  expect(lighting.strongerLevel('dim', 'dim')).toBe('dim');
  expect(lighting.strongerLevel('darkness', 'dim')).toBe('dim');
  expect(lighting.strongerLevel('dim', 'bright')).toBe('bright');
  const m = map();
  const point = { x: 140, y: 70, zLayer: 0, elevationFt: 0 };
  const s = scene({ sources: [
    { id: 'a', x: 0, y: 70, zLayer: 0, elevationFt: 0, brightFt: 5, dimAdditionalFt: 20, enabled: true },
    { id: 'b', x: 280, y: 70, zLayer: 0, elevationFt: 0, brightFt: 5, dimAdditionalFt: 20, enabled: true },
  ] });
  expect(lighting.lightAtPoint(point, s, m, darkEnv()).level).toBe('dim');
});

test('radius and cone light sources share the same mechanical level rules', () => {
  const m = map();
  const ahead = { x: lighting.feetToPixels(10, m), y: 0, zLayer: 0, elevationFt: 0 };
  const behind = { x: -lighting.feetToPixels(10, m), y: 0, zLayer: 0, elevationFt: 0 };
  const cone = { id: 'phone', x: 0, y: 0, zLayer: 0, elevationFt: 0, brightFt: 15, dimAdditionalFt: 15, enabled: true, shape: 'cone', directionDeg: 0, coneDeg: 60 };
  expect(lighting.sourceLevelAtPoint(cone, ahead, scene(), m)).toBe('bright');
  expect(lighting.sourceLevelAtPoint(cone, behind, scene(), m)).toBe('darkness');
});

test('attached lights follow canonical token X/Y/Z/elevation', () => {
  const m = map({ tokens: [{ id: 'p1', x: 210, y: 350, zLayer: 1, elevationFt: 17 }] });
  const position = lighting.sourcePosition({ id: 'torch', attachedToTokenId: 'p1', brightFt: 20, dimAdditionalFt: 20 }, m, 1000);
  expect(position).toMatchObject({ x: 210, y: 350, zLayer: 1, elevationFt: 17, attachment: true });
});

test('transformers and switches gate a circuit without affecting unrelated circuits', () => {
  const s = scene({
    transformers: [
      { id: 't-main', powered: true, damaged: false, circuits: ['lobby'] },
      { id: 't-side', powered: true, damaged: false, circuits: ['stairs'] },
    ],
    switches: [
      { id: 's-lobby', circuitId: 'lobby', state: 'off' },
      { id: 's-stairs', circuitId: 'stairs', state: 'on' },
    ],
  });
  expect(lighting.circuitPower(s, 'lobby')).toMatchObject({ powered: false, reason: 'SWITCH_OFF' });
  expect(lighting.circuitPower(s, 'stairs')).toMatchObject({ powered: true });
  s.transformers[1].damaged = true;
  expect(lighting.circuitPower(s, 'stairs')).toMatchObject({ powered: false, reason: 'TRANSFORMER_OFFLINE' });
});

test('transformer repair has no invented item skill or DC defaults', () => {
  const transformer = lighting.normalizeTransformer({ id: 't', powered: false, damaged: true, circuits: ['main'] });
  expect(transformer.repair).toBeNull();
  const controllerSource = read('js/vtt/lighting-controller.js');
  expect(controllerSource).toContain('REPAIR CHECK · optional, no defaults');
  expect(controllerSource).not.toContain('repair: { requiredItem:');
});

test('flicker changes presentation intensity without changing mechanical light level', () => {
  const m = map();
  const source = { id: 'fire', x: 0, y: 0, zLayer: 0, elevationFt: 0, brightFt: 20, dimAdditionalFt: 20, enabled: true, flicker: { enabled: true, amount: 0.2, speed: 9 } };
  const point = { x: lighting.feetToPixels(10, m), y: 0, zLayer: 0, elevationFt: 0 };
  expect(lighting.sourceLevelAtPoint(source, point, scene(), m, 1000)).toBe('bright');
  expect(lighting.sourceLevelAtPoint(source, point, scene(), m, 1800)).toBe('bright');
  expect(lighting.lightVisualIntensity(source, 1000)).not.toBe(lighting.lightVisualIntensity(source, 1800));
});

test('thrown light motion interpolates in real time instead of teleporting', () => {
  const m = map();
  const source = { id: 'flare', x: 0, y: 0, zLayer: 0, elevationFt: 0, brightFt: 10, dimAdditionalFt: 10 };
  const motion = lighting.createThrowMotion(source, { x: 280, y: 0, zLayer: 0, elevationFt: 0 }, m, { startedAt: 1000, durationMs: 1000, arcHeightFt: 5 });
  const start = lighting.interpolateMotion(motion, 1000);
  const middle = lighting.interpolateMotion(motion, 1500);
  const end = lighting.interpolateMotion(motion, 2000);
  expect(start.x).toBe(0);
  expect(middle.x).toBe(140);
  expect(middle.elevationFt).toBeCloseTo(5, 6);
  expect(end.x).toBe(280);
  expect(end.complete).toBe(true);
});

test('lighting state reuses existing campaign authority and canonical Check UI roots', () => {
  const state = read('js/vtt/lighting-state.js');
  const rules = JSON.parse(read('database.rules.json')).rules;
  expect(state).toContain("const WORLD_ROOT = 'campaña/estado_mundo/vttLighting'");
  expect(state).toContain("const PLAYER_ROOT = 'campaña/jugadores'");
  expect(state).toContain("const CHECK_COMMAND_ROOT = 'theatre_check_commands'");
  expect(state).toContain("const CHECK_LIVE_ROOT = 'theatre_check_live'");
  expect(rules.campaña.estado_mundo['.write']).toContain('e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1');
  expect(rules.campaña.jugadores['$nombre_personaje']['.write']).toContain("data.child('uid').val() === auth.uid");
  expect(rules.vtt_lighting).toBeUndefined();
});

test('DM editor and view-as-token integration are wired into EDIT MODE', () => {
  const controller = read('js/vtt/lighting-controller.js');
  const bootstrap = read('js/vtt/dynamic-lighting-bootstrap.js');
  const html = read('vtt.html');
  expect(controller).toContain('body.vtt-dm-edit-active .vtt-light-toolbar');
  expect(controller).toContain('LIGHTING');
  expect(controller).toContain('INTERIOR');
  expect(controller).toContain('TRANSFORMER');
  expect(controller).toContain('SWITCH');
  expect(controller).toContain('VIEW AS TOKEN');
  expect(bootstrap).toContain("if (bridge.isDm && !mapData.lighting?.dmPreviewTokenId) renderFullMap");
  expect(bootstrap).toContain('renderTokenVision');
  expect(html).toContain('js/vtt/dynamic-lighting-bootstrap.js');
});

test('players combine only tokens they control; there is no party-wide vision flag', () => {
  const bootstrap = read('js/vtt/dynamic-lighting-bootstrap.js');
  expect(bootstrap).toContain('canPlayerControl?.(token, identity)');
  expect(bootstrap).not.toContain('partyVision');
  expect(bootstrap).not.toContain('sharedVision');
});

test('facing rotates separately and movement updates the vision direction', () => {
  const bootstrap = read('js/vtt/dynamic-lighting-bootstrap.js');
  const state = read('js/vtt/lighting-state.js');
  expect(bootstrap).toContain("if (!['[', ']'].includes(event.key)");
  expect(bootstrap).toContain("canvas.addEventListener('vtt:token-moved', updateFacingFromMove)");
  expect(bootstrap).toContain('lightingStateBridge.saveFacing(token)');
  expect(state).toContain("child('facingDeg').set(facing)");
});

test('portable sources expose drop pickup and configured throw actions', () => {
  const controller = read('js/vtt/lighting-controller.js');
  const state = read('js/vtt/lighting-state.js');
  expect(controller).toContain("drop.textContent = 'DROP'");
  expect(controller).toContain("thr.textContent = 'THROW'");
  expect(controller).toContain("attach.textContent = 'PICK UP'");
  expect(controller).toContain('thr.disabled = !Number.isFinite(Number(source.throwRangeFt))');
  expect(state).toContain("reason: 'THROW_RANGE_UNCONFIGURED'");
  expect(state).toContain("requestSourceThrow: (sourceId, target");
});

test('dynamic lighting files parse and the module bootstrap parses as ESM', () => {
  for (const file of [
    'js/vtt/lighting-engine.js',
    'js/vtt/environment-light-bridge.js',
    'js/vtt/lighting-state.js',
    'js/vtt/lighting-controller.js',
    'js/vtt/multiplayer-senses-bridge.js',
  ]) execFileSync(process.execPath, ['--check', path.join(__dirname, '..', file)], { stdio: 'pipe' });

  const tmp = path.join(os.tmpdir(), `luminous-lighting-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/dynamic-lighting-bootstrap.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});