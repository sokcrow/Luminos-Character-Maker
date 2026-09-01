const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('memory defaults patch includes legacy walls in dungeon observations', () => {
  const patch = read('js/vtt/memory-defaults-patch.js');
  expect(patch).toContain('legacyWalls(mapData');
  expect(patch).toContain('(Array.isArray(mapData.walls) ? mapData.walls : []).map');
  expect(patch).toContain('...legacyWalls(mapData)');
});

test('DM REMEMBER LAYER grants a geometry-capable profile snapshot when no profile existed', () => {
  const patch = read('js/vtt/memory-defaults-patch.js');
  expect(patch).toContain('Math.max(2');
  expect(patch).toContain('dmGrantedLayerMemory: true');
  expect(patch).toContain('capabilitiesForRank(rank, mapData)');
});

test('memory compatibility patch loads after lighting but before fog bootstrap', () => {
  const html = read('vtt.html');
  const lighting = html.indexOf('dynamic-lighting-bootstrap.js');
  const patch = html.indexOf('memory-defaults-patch.js');
  const fog = html.indexOf('fog-memory-bootstrap.js');
  expect(lighting).toBeGreaterThan(-1);
  expect(patch).toBeGreaterThan(lighting);
  expect(fog).toBeGreaterThan(patch);
});

test('last-known portal memory is not rewritten by an unseen live state change', () => {
  const engine = require('../js/vtt/memory-engine.js');
  const mapData = { grid: { cols: 5, rows: 5, size: 70, distancePerCell: 5 }, environmentTags: ['dungeon'] };
  const profile = engine.resolveProfile({ character: { stats: { inteligencia: 16 } }, mapData });
  const closed = { id: 'door', type: 'door', from: { col: 1, row: 1 }, to: { col: 1, row: 2 }, z: [0], state: 'closed' };
  let result = engine.observeDungeon({ memory: engine.emptyMemory(), profile, mapData, zLayer: 0, visibleCells: new Set(['1_1']), topology: [closed], now: 10 });
  expect(result.memory.dungeon.objects.door.lastKnownState).toBe('closed');

  const opened = { ...closed, state: 'open' };
  result = engine.observeDungeon({ memory: result.memory, profile, mapData, zLayer: 0, visibleCells: new Set(['4_4']), topology: [opened], now: 20 });
  expect(result.memory.dungeon.objects.door.lastKnownState).toBe('closed');
});
