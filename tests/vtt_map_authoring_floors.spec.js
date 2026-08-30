const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const authoring = require('../js/vtt/map-authoring.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('floor manager supports positive and negative logical Z without forcing Roof', () => {
  let map = authoring.createDefinition({ id: 'warehouse', name: 'Warehouse' });
  map = authoring.addLevel(map, 0, 1);
  map = authoring.addLevel(map, 0, -1);
  expect(authoring.levelEntries(map.zLevels).map((entry) => entry.zLayer)).toEqual([-1, 0, 1]);
  expect(map.zLevels['-1'].label).toBe('Basement 1');
  expect(map.zLevels['1'].label).toBe('Floor 1');
  expect(map.zLevels['1'].label).not.toBe('Roof');
});

test('floor elevation is physical and independent from logical layer', () => {
  let map = authoring.createDefinition({ id: 'tower', defaultZStepFt: 15 });
  map = authoring.addLevel(map, 0, 1);
  map = authoring.updateLevel(map, 1, { elevationFt: 22, label: 'Mezzanine' });
  expect(map.zLevels['1'].zLayer).toBe(1);
  expect(map.zLevels['1'].elevationFt).toBe(22);
  expect(map.zLevels['1'].label).toBe('Mezzanine');
});

test('floor backgrounds persist URL, fit and opacity', () => {
  let map = authoring.createDefinition({ id: 'lab' });
  map = authoring.updateLevel(map, 0, { background: { url: 'https://example.test/lab.webp', fit: 'cover', opacity: 0.75 } });
  expect(map.zLevels['0'].background).toEqual({ url: 'https://example.test/lab.webp', storagePath: '', fit: 'cover', opacity: 0.75 });
});

test('switching map definitions clears scene-specific geometry but retains player template', () => {
  const target = {
    id: 'old',
    grid: { cols: 10, rows: 10, size: 70, distancePerCell: 5 },
    zLevels: { 0: { zLayer: 0, elevationFt: 0, label: 'Old' } },
    walls: [{ id: 'wall' }], topology: [{ id: 'door' }], verticalPortals: [{ id: 'stairs' }],
    tokens: [{ id: 'player', characterLink: { mode: 'current_player' } }, { id: 'npc' }],
    lighting: { scene: { sources: [{ id: 'lamp' }], interiors: [], transformers: [], switches: [], roofs: [] } },
  };
  authoring.applyDefinition(target, authoring.createDefinition({ id: 'new', name: 'New' }));
  expect(target.id).toBe('new');
  expect(target.walls).toEqual([]);
  expect(target.topology).toEqual([]);
  expect(target.verticalPortals).toEqual([]);
  expect(target.tokens).toHaveLength(1);
  expect(target.tokens[0].characterLink.mode).toBe('current_player');
  expect(target.lighting.scene.sources).toEqual([]);
});

test('active floor cannot be deleted while it owns scene dependencies', () => {
  const mapData = {
    zLevels: { 0: { zLayer: 0 }, 1: { zLayer: 1 } },
    topology: [{ id: 'door', z: [1] }], walls: [], verticalPortals: [], tokens: [], lighting: { scene: { roofs: [], sources: [] } },
  };
  expect(authoring.canDeleteLevel(mapData, 1).valid).toBe(false);
  mapData.topology = [];
  expect(authoring.canDeleteLevel(mapData, 1).valid).toBe(true);
});

test('map state uses DM-owned campaign world paths and activates map instance', () => {
  const source = read('js/vtt/map-authoring-state.js');
  expect(source).toContain("campaña/estado_mundo/vttMaps");
  expect(source).toContain("campaña/estado_mundo/vttMapActive");
  expect(source).toContain("campaña/estado_mundo/instancia_activa");
  expect(source).toContain("updates[INSTANCE_ROOT] = 'mapa'");
  expect(source).toContain('firebase?.storage?.()');
});

test('failed Firebase map save rolls local map cache back instead of leaving a phantom map', async () => {
  const statePath = path.join(__dirname, '..', 'js/vtt/map-authoring-state.js');
  delete require.cache[require.resolve(statePath)];
  const state = require(statePath);
  const db = {
    ref() {
      return {
        child() { return { set: async () => { throw new Error('PERMISSION_DENIED'); } }; },
        on() {}, off() {},
      };
    },
  };
  const database = () => db;
  database.ServerValue = { TIMESTAMP: 123 };
  const root = {
    LuminousVttMapAuthoring: authoring,
    firebase: { auth: () => ({ currentUser: { uid: state.DM_UID } }), database },
    document: { body: { classList: { contains: () => false } } },
  };
  const mapData = authoring.createDefinition({ id: 'active', name: 'Active' });
  const bridge = state.createBridge({ mapData, root });
  await expect(bridge.saveDefinition(authoring.createDefinition({ id: 'new-map', name: 'New Map' }))).rejects.toThrow('PERMISSION_DENIED');
  expect(bridge.list()).toEqual([]);
});

test('main resolves the active map before constructing the engine and reloads on map switch', () => {
  const source = read('js/vtt/main.js');
  const resolveIndex = source.indexOf('resolveActiveDefinition');
  const engineIndex = source.indexOf('new Engine(canvas, mockMapData)');
  expect(resolveIndex).toBeGreaterThan(-1);
  expect(engineIndex).toBeGreaterThan(resolveIndex);
  expect(source).toContain("import('./map-authoring-bootstrap.js')");
  expect(source).toContain('window.location.reload()');
  expect(source).toContain('setLayer: applyLayer');
});

test('DM map UI exposes floor creation in both directions and per-floor image controls', () => {
  const source = read('js/vtt/map-authoring-bootstrap.js');
  expect(source).toContain('+ ABOVE');
  expect(source).toContain('+ BELOW');
  expect(source).toContain('BACKGROUND URL');
  expect(source).toContain('UPLOAD IMAGE');
  expect(source).toContain('GHOST LOWER FLOOR');
  expect(source).toContain('Roof is only a label');
});
