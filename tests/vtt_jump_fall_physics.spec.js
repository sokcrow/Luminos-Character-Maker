const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

require('../js/vtt/floor-opening-core.js');
require('../js/vtt/horizontal-plane-core.js');
require('../js/vtt/surface-core.js');
require('../js/vtt/topology.js');
require('../js/vtt/token-interaction.js');
require('../js/vtt/pathfinding.js');
require('../js/vtt/jump-fall-physics.js');

const physics = globalThis.LuminousVttJumpFallPhysics;
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function map(cols = 5, rows = 1) {
  return {
    id: 'jump-fall',
    grid: { cols, rows, size: 70, distancePerCell: 5 },
    walls: [], topology: [], tokens: [],
    movement: { terrain: {}, diagonalRule: '5e', blockTokens: true },
    surfaceLayers: {}, floorOpenings: [], horizontalPlanes: [],
    zLevels: { 0: { elevationFt: 0 }, 1: { elevationFt: 10 }, 2: { elevationFt: 20 } },
  };
}
function point(col, row = 0, z = 0) { return { x: (col + 0.5) * 70, y: (row + 0.5) * 70, col, row, z, zLayer: z }; }
function token(col = 0, patch = {}) { return { id: 'mover', ...point(col), radius: 10, speedFt: 30, gridPosition: { col, row: 0, z: 0 }, ...patch }; }
function surface(mapData, z, ...cols) {
  mapData.surfaceLayers[String(z)] ||= {};
  cols.forEach((col) => { mapData.surfaceLayers[String(z)][`${col}_0`] = { materialId: 'concrete', elevationOffsetFt: 0 }; });
}

test('horizontal jump uses 5 ft per 10 ft run-up plus 5 ft per 4 Power', () => {
  expect(physics.horizontalJumpFt({ runUpFt: 0, checkPower: 3 })).toBe(0);
  expect(physics.horizontalJumpFt({ runUpFt: 10, checkPower: 4 })).toBe(10);
  expect(physics.horizontalJumpFt({ runUpFt: 20, checkPower: 14 })).toBe(25);
  expect(physics.horizontalJumpFt({ runUpFt: 29.9, checkPower: 7.9 })).toBe(15);
});

test('vertical jump uses STR Mod/2 in 5-ft steps plus 5 ft per 10 Power', () => {
  expect(physics.verticalJumpFt({ strMod: -2, checkPower: 9 })).toBe(0);
  expect(physics.verticalJumpFt({ strMod: 1, checkPower: 10 })).toBe(5);
  expect(physics.verticalJumpFt({ strMod: 2, checkPower: 9 })).toBe(5);
  expect(physics.verticalJumpFt({ strMod: 4, checkPower: 21 })).toBe(20);
});

test('fall damage table is percentage based and uses the highest reached threshold', () => {
  expect(physics.fallBaseDamagePct(10)).toBe(0);
  expect(physics.fallBaseDamagePct(14.9)).toBe(0);
  expect(physics.fallBaseDamagePct(15)).toBe(5);
  expect(physics.fallBaseDamagePct(34.9)).toBe(20);
  expect(physics.fallBaseDamagePct(45)).toBe(50);
  expect(physics.fallBaseDamagePct(64.9)).toBe(90);
  expect(physics.fallBaseDamagePct(65)).toBe(100);
  expect(physics.fallBaseDamagePct(500)).toBe(100);
});

test('fall mitigation is 5 percentage points per 5 Power and lethal falls retain the 50% skill-only floor', () => {
  expect(physics.fallSkillMitigationPct(4)).toBe(0);
  expect(physics.fallSkillMitigationPct(5)).toBe(5);
  expect(physics.fallSkillMitigationPct(18)).toBe(15);
  expect(physics.resolveFallDamage({ distanceFt: 45, maxHp: 120, checkPower: 18 })).toMatchObject({ basePct: 50, skillMitigationPct: 15, finalPct: 35, damage: 42 });
  expect(physics.resolveFallDamage({ distanceFt: 65, maxHp: 100, checkPower: 100 })).toMatchObject({ basePct: 100, afterSkillPct: 50, finalPct: 50, damage: 50 });
  expect(physics.resolveFallDamage({ distanceFt: 65, maxHp: 100, checkPower: 100, externalMitigationPct: 30 })).toMatchObject({ afterSkillPct: 50, finalPct: 20, damage: 20 });
});

test('authored surface layers make missing cells real void while legacy maps remain walkable', () => {
  const authored = map(3);
  surface(authored, 0, 0, 2);
  expect(physics.supportAtCell(authored, 0, 0, 0)).toMatchObject({ supported: true, source: 'surface' });
  expect(physics.supportAtCell(authored, 0, 1, 0)).toMatchObject({ supported: false, source: 'surface_void' });
  const legacy = map(3);
  expect(physics.supportAtCell(legacy, 0, 1, 0)).toMatchObject({ supported: true, source: 'legacy_default' });
});

test('explicit open floor openings are unsupported and closed trapdoors support movement', () => {
  const m = map(2);
  m.floorOpenings = [
    { id: 'hole', type: 'hole', zLayer: 1, toZLayer: 0, footprint: { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 }, state: 'open', fallThrough: true },
    { id: 'trap', type: 'trapdoor', zLayer: 1, toZLayer: 0, footprint: { minCol: 1, maxCol: 1, minRow: 0, maxRow: 0 }, state: 'closed', fallThrough: true },
  ];
  expect(physics.supportAtCell(m, 1, 0, 0).supported).toBe(false);
  expect(physics.supportAtCell(m, 1, 1, 0).supported).toBe(true);
});

test('support-aware pathfinding routes walkers away from void but never blocks Fly', () => {
  const m = map(3);
  surface(m, 0, 0, 2);
  const mover = token(0);
  m.tokens = [mover];
  physics.installSupportAwarePathfinding(globalThis);
  const pf = globalThis.LuminousVttPathfinding;
  expect(pf.findPath({ token: mover, start: point(0), target: point(2), mapData: m, movementMode: 'walk' })).toMatchObject({ valid: false, reason: 'NO_PATH' });
  expect(pf.findPath({ token: mover, start: point(0), target: point(2), mapData: m, movementMode: 'fly' }).valid).toBe(true);
});

test('jump planner requires a real gap and checks horizontal and vertical capacity', () => {
  const m = map(4);
  surface(m, 0, 0, 3);
  const mover = token(0, { strengthMod: 4 });
  const success = physics.planJump({ token: mover, from: point(0), target: point(3), mapData: m, runUpFt: 20, checkPower: 14, strMod: 4 });
  expect(success).toMatchObject({ valid: true, horizontalFt: 15, maxHorizontalFt: 25, maxVerticalFt: 15, movementCostFt: 15 });
  const fail = physics.planJump({ token: mover, from: point(0), target: point(3), mapData: m, runUpFt: 0, checkPower: 4, strMod: 4 });
  expect(fail).toMatchObject({ valid: false, reason: 'JUMP_HORIZONTAL_RANGE_INSUFFICIENT', maxHorizontalFt: 5 });
});

test('vertical landing rise is enforced independently from horizontal range', () => {
  const m = map(2);
  surface(m, 0, 0);
  surface(m, 1, 1);
  const mover = token(0, { strengthMod: 2 });
  expect(physics.planJump({ token: mover, from: point(0), target: point(1, 0, 1), targetZ: 1, mapData: m, runUpFt: 20, checkPower: 4, strMod: 2 })).toMatchObject({ valid: false, reason: 'JUMP_VERTICAL_RANGE_INSUFFICIENT', verticalRiseFt: 10, maxVerticalFt: 5 });
  expect(physics.planJump({ token: mover, from: point(0), target: point(1, 0, 1), targetZ: 1, mapData: m, runUpFt: 20, checkPower: 10, strMod: 2 }).valid).toBe(true);
});

test('fall planner finds the first supported lower layer and measures physical elevation difference', () => {
  const m = map(2);
  surface(m, 1, 0);
  surface(m, 0, 0, 1);
  const mover = token(0, { zLayer: 1, z: [1], gridPosition: { col: 0, row: 0, z: 1 }, elevationFt: 10 });
  const plan = physics.fallPlan({ token: mover, from: point(0, 0, 1), target: point(1, 0, 1), mapData: m });
  expect(plan).toMatchObject({ valid: true, movementType: 'fall', fromZ: 1, targetZ: 0, fallDistanceFt: 10, movementCostFt: 0 });
});

test('runtime integration requests checks only from the committed resolver and uses canonical movement claims/fixed damage', () => {
  const bootstrap = read('js/vtt/jump-fall-bootstrap.js');
  const checks = read('js/vtt/jump-fall-checks.js');
  const damage = read('js/vtt/jump-fall-damage.js');
  expect(checks).toContain("theatre_check_requests");
  expect(checks).toContain("theatre_check_live");
  expect(bootstrap).toContain('reserveMovementDestinationClaim');
  expect(bootstrap).toContain('cancelMovementDestinationClaim');
  expect(bootstrap).toContain('restoreFromClaim');
  expect(bootstrap).toContain('fallApproach');
  expect(damage).toContain('LuminousFixedDamageRuntime');
  expect(damage).toContain('vtt:fall-damage');
  expect(bootstrap).not.toMatch(/mousemove[^\n]*requestCheckPower/i);
});

test('VTT mainline preload imports jump/fall bootstrap before movement runtime becomes interactive', () => {
  const patch = read('js/vtt/physical-state-patch.js');
  expect(patch).toContain("import './jump-fall-bootstrap.js';");
});
