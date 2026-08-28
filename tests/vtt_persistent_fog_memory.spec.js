const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const memory = require('../js/vtt/memory-engine.js');
const memoryState = require('../js/vtt/memory-state.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function map(overrides = {}) {
  return {
    id: 'alpha',
    grid: { cols: 10, rows: 10, size: 70, distancePerCell: 5 },
    zLevels: { 0: { zLayer: 0, elevationFt: 0 }, 1: { zLayer: 1, elevationFt: 15 } },
    environmentTags: ['urban', 'dungeon', 'backstreets'],
    memoryRules: {},
    topology: [],
    ...overrides,
  };
}

function fakeRoot({ uid = 'uid-a', playerId = 'alice' } = {}) {
  const writes = [];
  const handlers = [];
  const makeRef = (value) => ({
    path: value,
    child(key) { return makeRef(`${value}/${key}`); },
    async set(payload) { writes.push({ type: 'set', path: value, value: payload }); },
    async remove() { writes.push({ type: 'remove', path: value }); },
    on(event, handler) { handlers.push({ value, event, handler }); },
    off() {},
  });
  const database = () => ({ ref: (value) => makeRef(value) });
  database.ServerValue = { TIMESTAMP: 123456 };
  const root = {
    document: {},
    datosJugador: { id: playerId, playerId, stats: { inteligencia: 12 } },
    localStorage: { getItem: (key) => key === 'playerId' ? playerId : null },
    firebase: { auth: () => ({ currentUser: { uid } }), database },
    LuminousVttMemoryEngine: memory,
  };
  return { root, writes, handlers };
}

test('Intelligence sets a configurable base memory rank without changing vision', () => {
  expect(memory.rankForIntelligence(7, map())).toBe(0);
  expect(memory.rankForIntelligence(8, map())).toBe(1);
  expect(memory.rankForIntelligence(12, map())).toBe(2);
  expect(memory.rankForIntelligence(16, map())).toBe(3);
  const custom = map({ memoryRules: { intThresholds: [{ min: 0, rank: 0 }, { min: 10, rank: 2 }, { min: 18, rank: 3 }] } });
  expect(memory.rankForIntelligence(10, custom)).toBe(2);
  expect(memory.rankForIntelligence(17, custom)).toBe(2);
});

test('map-memory Traits apply only to compatible environment tags', () => {
  const character = { stats: { inteligencia: 8 } };
  const traits = [
    { id: 'urban_navigator', mapMemory: { domains: ['urban'], rankBonus: 1, capabilities: { territory: true } } },
    { id: 'forest_pathfinder', mapMemory: { domains: ['forest'], rankBonus: 2 } },
  ];
  const urban = memory.resolveProfile({ character, traits, mapData: map() });
  expect(urban.rank).toBe(2);
  expect(urban.capabilities.territory).toBe(true);
  expect(urban.appliedTraits.map((entry) => entry.id)).toEqual(['urban_navigator']);

  const forest = memory.resolveProfile({ character, traits, mapData: map({ environmentTags: ['forest', 'dungeon'] }) });
  expect(forest.rank).toBe(3);
  expect(forest.appliedTraits.map((entry) => entry.id)).toEqual(['forest_pathfinder']);
});

test('rank 1 remembers route but not room geometry', () => {
  const profile = memory.resolveProfile({ character: { stats: { inteligencia: 8 } }, mapData: map() });
  const result = memory.observeDungeon({
    memory: memory.emptyMemory(), profile, mapData: map(), zLayer: 0,
    visibleCells: new Set(['2_2', '3_2']),
    routeTokens: [{ x: 175, y: 175, zLayer: 0 }], topology: [], now: 100,
  });
  expect(Object.keys(result.memory.dungeon.layers['0'].routeCells)).toEqual(['2_2']);
  expect(Object.keys(result.memory.dungeon.layers['0'].rememberedCells)).toHaveLength(0);
});

test('rank 2 remembers visible dungeon geometry but does not infer a locked door', () => {
  const m = map();
  const profile = memory.resolveProfile({ character: { stats: { inteligencia: 12 } }, mapData: m });
  const door = { id: 'door-1', type: 'door', from: { col: 2, row: 2 }, to: { col: 2, row: 3 }, z: [0], state: 'locked' };
  const result = memory.observeDungeon({
    memory: memory.emptyMemory(), profile, mapData: m, zLayer: 0,
    visibleCells: new Set(['1_2', '2_2']), routeTokens: [], topology: [door], now: 200,
  });
  expect(result.memory.dungeon.layers['0'].rememberedCells['2_2']).toBe(200);
  expect(result.memory.dungeon.objects['door-1']).toMatchObject({ type: 'door' });
  expect(result.memory.dungeon.objects['door-1'].lockKnowledge).toBeUndefined();
  expect(result.memory.dungeon.objects['door-1'].lastKnownState).toBeUndefined();
});

test('rank 3 remembers last visible state but locked still appears closed until explicitly learned', () => {
  const m = map();
  const profile = memory.resolveProfile({ character: { stats: { inteligencia: 16 } }, mapData: m });
  const door = { id: 'door-1', type: 'door', from: { col: 2, row: 2 }, to: { col: 2, row: 3 }, z: [0], state: 'locked' };
  let result = memory.observeDungeon({
    memory: memory.emptyMemory(), profile, mapData: m, zLayer: 0,
    visibleCells: new Set(['2_2']), routeTokens: [], topology: [door], now: 300,
  });
  expect(result.memory.dungeon.objects['door-1'].lastKnownState).toBe('closed');
  expect(result.memory.dungeon.objects['door-1'].lockKnowledge).toBeUndefined();

  result = memory.learnFact(result.memory, { kind: 'lock_state', elementId: 'door-1', locked: true }, profile, 301);
  expect(result.memory.dungeon.objects['door-1'].lockKnowledge).toBe('locked');
});

test('key-to-door relations are learned facts and not live topology data', () => {
  const m = map();
  const detailed = memory.resolveProfile({ character: { stats: { inteligencia: 16 } }, mapData: m });
  const low = memory.resolveProfile({ character: { stats: { inteligencia: 8 } }, mapData: m });
  const learned = memory.learnFact(memory.emptyMemory(), { kind: 'key_opens', keyId: 'red-key', elementId: 'door-7' }, detailed, 400);
  expect(learned.memory.dungeon.relations.keys['red-key'].opens).toEqual(['door-7']);
  const forgotten = memory.learnFact(memory.emptyMemory(), { kind: 'key_opens', keyId: 'red-key', elementId: 'door-7' }, low, 400);
  expect(forgotten.changed).toBe(false);
});

test('world-place and Backstreets territory memory stores last-known knowledge rather than a live controller', () => {
  const profile = memory.resolveProfile({ character: { stats: { inteligencia: 16 } }, mapData: map() });
  let result = memory.learnFact(memory.emptyMemory(), {
    kind: 'world_place', placeId: 'k7', label: 'Backstreet K-7', locationPrecision: 'exact', services: { workshop: true, clinic: true },
  }, profile, 500);
  result = memory.learnFact(result.memory, { kind: 'territory', zoneId: 'k7', controllerId: 'syndicate-x', confidence: 'high' }, profile, 501);
  expect(result.memory.world.places.k7.services).toMatchObject({ workshop: true, clinic: true });
  expect(result.memory.world.territories.k7).toMatchObject({ controllerId: 'syndicate-x', confidence: 'high', lastConfirmedAt: 501 });
});

test('player memory persists under their existing campaign node and cannot write another player', async () => {
  const { root, writes } = fakeRoot();
  const bridge = memoryState.createBridge({ mapData: map(), isDm: false, root });
  await bridge.saveMemory('alice', memory.emptyMemory());
  expect(writes[0].path).toBe('campaña/jugadores/alice/vttMemory/alpha');
  await expect(bridge.saveMemory('bob', memory.emptyMemory())).rejects.toThrow('PLAYER_MEMORY_OWNERSHIP_REQUIRED');
});

test('DM memory overrides use the existing DM-only world state tree', async () => {
  const { root, writes } = fakeRoot({ uid: memoryState.DM_UID, playerId: 'dm' });
  const bridge = memoryState.createBridge({ mapData: map(), isDm: true, root });
  await bridge.saveOverride('alice', { rank: 3 });
  expect(writes[0].path).toBe('campaña/estado_mundo/vttMemoryOverrides/alpha/alice');
  expect(writes[0].value.rank).toBe(3);
});

test('Fog memory renderer never samples the live scene image for remembered areas', () => {
  const renderer = read('js/vtt/memory-renderer.js');
  expect(renderer).not.toContain('drawImage(');
  expect(renderer).toContain('rememberedCells');
  expect(renderer).toContain('lastKnownState');
  expect(renderer).toContain('MINIMAP');
});

test('runtime integrates PoV observation, last-known memory, minimap and DM controls after dynamic lighting', () => {
  const html = read('vtt.html');
  const bootstrap = read('js/vtt/fog-memory-bootstrap.js');
  const topologyController = read('js/vtt/topology-controller.js');
  expect(html.indexOf('dynamic-lighting-bootstrap.js')).toBeLessThan(html.indexOf('fog-memory-bootstrap.js'));
  expect(bootstrap).toContain('runtime.pov.lookUpPerceptionAtPoint');
  expect(bootstrap).toContain('memory.observeDungeon');
  expect(bootstrap).toContain('rememberKeyDoorRelation');
  expect(bootstrap).toContain('rememberWorldPlace');
  expect(bootstrap).toContain('rememberTerritory');
  expect(bootstrap).toContain('vtt-memory-rank-override');
  expect(topologyController).toContain("kind: 'lock_state'");
  expect(topologyController).toContain("'vtt:memory-learn'");
});

test('new memory UMD runtimes parse as JavaScript', () => {
  for (const file of ['js/vtt/memory-engine.js', 'js/vtt/memory-state.js', 'js/vtt/memory-renderer.js']) {
    execFileSync(process.execPath, ['--check', path.join(__dirname, '..', file)], { stdio: 'pipe' });
  }
});
