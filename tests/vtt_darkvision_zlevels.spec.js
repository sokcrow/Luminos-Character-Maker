const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const senses = require('../js/racial-sense-runtime.js');
const spatial = require('../js/vtt/spatial-vision.js');
const visionBridge = require('../js/vtt/character-vision-bridge.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const map = {
  grid: { cols: 20, rows: 20, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
  defaultZStepFt: 15,
  zLevels: {
    0: { zLayer: 0, elevationFt: 0 },
    1: { zLayer: 1, elevationFt: 15 },
  },
};

test('source-backed Limbus races receive canonical 60 ft Darkvision', () => {
  for (const raceId of ['kobold', 'goblin', 'fairy', 'aasimar', 'tiefling', 'felinae', 'half_dragon', 'lupae', 'moonfae', 'yuan_ti_pureblood']) {
    expect(senses.resolveRacialSenses({ raceId }).darkvisionFt, raceId).toBe(60);
  }
  expect(senses.resolveRacialSenses({ raceId: 'lanae' }).darkvisionFt).toBe(0);
});

test('canonical superior Darkvision overrides standard racial range', () => {
  expect(senses.resolveRacialSenses({ raceId: 'elf', raceSubtypeId: 'drow' }).darkvisionFt).toBe(120);
  expect(senses.resolveRacialSenses({ raceId: 'dwarf', raceSubtypeId: 'duergar' }).darkvisionFt).toBe(120);
  expect(senses.resolveRacialSenses({ raceId: 'elf', raceSubtypeId: 'wood' }).darkvisionFt).toBe(60);
});

test('linked character sheet race resolves senses without duplicating them on the VTT token', () => {
  const character = {
    characterName: 'Orosh Test',
    characterBuild: { raceId: 'yuan_ti_pureblood', raceSubtypeId: 'red_eyes' },
  };
  expect(senses.resolveCharacterSenses(character)).toMatchObject({
    raceId: 'yuan_ti_pureblood',
    raceSubtypeId: 'red_eyes',
    darkvisionFt: 60,
    darkvisionMonochrome: true,
    source: 'racial',
  });
  expect(visionBridge.resolveBuildCarrier(character, null)).toBe(character);
});

test('Darkvision changes perceived light and uses grayscale only for actual darkness', () => {
  const racial = senses.resolveRacialSenses({ raceId: 'goblin' });
  expect(senses.perceptionForLightLevel('dim', racial, 50)).toEqual({
    visible: true,
    perceivedLight: 'bright',
    mode: 'darkvision_dim',
    monochrome: false,
  });
  expect(senses.perceptionForLightLevel('darkness', racial, 50)).toEqual({
    visible: true,
    perceivedLight: 'dim',
    mode: 'darkvision',
    monochrome: true,
  });
  expect(senses.perceptionForLightLevel('darkness', racial, 61).visible).toBe(false);
});

test('z levels use physical elevation for 3D range', () => {
  const balcony = { x: 0, y: 0, zLayer: 1, elevationFt: 15 };
  const street = { x: 280, y: 0, zLayer: 0, elevationFt: 0 };
  expect(spatial.horizontalDistanceFt(balcony, street, map)).toBeCloseTo(20, 5);
  expect(spatial.distance3dFt(balcony, street, map)).toBeCloseTo(25, 5);
  expect(spatial.horizontalRadiusPxForRange(60, balcony, 0, map)).toBeCloseTo(813.326, 2);
});

test('cross-level sight requires an open vertical portal crossed by the sight ray', () => {
  const balcony = { x: 140, y: 140, zLayer: 1, elevationFt: 15 };
  const streetPoint = { x: 280, y: 560 };
  const withBalcony = {
    ...map,
    verticalPortals: [{
      id: 'balcony',
      type: 'balcony_edge',
      between: [0, 1],
      from: { col: 0, row: 5 },
      to: { col: 6, row: 5 },
      blocksVision: false,
      blocksLight: false,
      state: 'open',
    }],
  };
  expect(spatial.canTraverseLayers(balcony, streetPoint, 0, withBalcony, 'vision')).toBe(true);
  expect(spatial.canTraverseLayers(balcony, streetPoint, 0, { ...map, verticalPortals: [] }, 'vision')).toBe(false);
  expect(spatial.canTraverseLayers(balcony, streetPoint, 0, {
    ...withBalcony,
    verticalPortals: [{ ...withBalcony.verticalPortals[0], state: 'closed' }],
  }, 'vision')).toBe(false);
});

test('VTT wiring loads linked racial senses, feet grid, grayscale rendering and z portals', () => {
  const html = read('vtt.html');
  const main = read('js/vtt/main.js');
  const engine = read('js/vtt/engine.js');
  const renderer = read('js/vtt/renderer.js');
  const mapData = read('js/vtt/mapData.js');

  expect(html).toContain('js/racial-sense-runtime.js');
  expect(html).toContain('js/vtt/spatial-vision.js');
  expect(html).toContain('js/vtt/character-vision-bridge.js');
  expect(main).toContain('LuminousVttCharacterVisionBridge');
  expect(engine).toContain('horizontalRadiusPxForRange');
  expect(engine).toContain("canTraverseLayers(player, closestIntersect, this.activeZ, this.mapData, 'vision')");
  expect(renderer).toContain("this.ctx.filter = 'grayscale(1)'");
  expect(mapData).toContain("distancePerCell: 5");
  expect(mapData).toContain('verticalPortals');
  expect(mapData).toContain("characterLink: { mode: 'current_player' }");
});

test('new UMD runtimes parse and VTT files keep their ES module contracts', () => {
  const root = path.join(__dirname, '..');
  for (const file of [
    'js/racial-sense-runtime.js',
    'js/vtt/spatial-vision.js',
    'js/vtt/character-vision-bridge.js',
  ]) {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  }

  expect(read('js/vtt/engine.js')).toMatch(/^import\s+\{\s*Camera\s*\}/);
  expect(read('js/vtt/renderer.js')).toMatch(/^export\s+class\s+Renderer/);
  expect(read('js/vtt/main.js')).toMatch(/^import\s+\{\s*Engine\s*\}/);
  expect(read('js/vtt/mapData.js')).toMatch(/^export\s+const\s+mockMapData/);
});