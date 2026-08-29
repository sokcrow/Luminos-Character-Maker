const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function fresh(modulePath) {
  const resolved = require.resolve(path.join(ROOT, modulePath));
  delete require.cache[resolved];
  return require(resolved);
}
function resetGlobals() {
  for (const key of [
    'LuminousVttStructureCore','LuminousVttStructureRenderer','LuminousVttStructureAuthoringPatch',
  ]) delete global[key];
}
function mapBase() {
  return {
    id: 'structure_test',
    grid: { size: 70, cols: 6, rows: 4, distancePerCell: 5 },
    zLevels: { 0: { elevationFt: 0 }, 1: { elevationFt: 15 } },
    topology: [], tokens: [], structures: [],
  };
}

test.beforeEach(() => resetGlobals());

test('canonical catalog defines the four structure primitive contracts', () => {
  const core = fresh('js/vtt/structure-core.js');
  const catalog = core.normalizeDefinitionCatalog();
  expect(catalog['pillar:concrete']).toMatchObject({ type: 'pillar', geometry: 'pillar' });
  expect(catalog['pillar:concrete'].physical).toMatchObject({ blocksMovement: true, blocksVision: true, coverQuality: 'major', fallProtection: false });
  expect(catalog['fence:chain'].physical).toMatchObject({ blocksMovement: true, blocksVision: false, climbable: true, fallProtection: true });
  expect(catalog['railing:metal'].physical).toMatchObject({ heightFt: 3.5, blocksMovement: true, blocksVision: false, coverQuality: 'partial', fallProtection: true });
  expect(catalog['barrier:concrete'].physical).toMatchObject({ heightFt: 3, blocksMovement: true, blocksVision: false, coverQuality: 'major', climbable: true, fallProtection: true });
});

test('linear runs become deterministic unit edges and reverse drawing is stable', () => {
  const core = fresh('js/vtt/structure-core.js');
  const map = mapBase(); core.ensureMapState(map);
  const forward = core.createLinearRun({ type: 'railing', from: { col: 1, row: 1 }, to: { col: 4, row: 1 }, zLayer: 0, definitionId: 'railing:metal', mapData: map });
  const reverse = core.createLinearRun({ type: 'railing', from: { col: 4, row: 1 }, to: { col: 1, row: 1 }, zLayer: 0, definitionId: 'railing:metal', mapData: map });
  expect(forward).toHaveLength(3);
  expect(forward.every((edge) => core.isUnitEdge(edge.from, edge.to))).toBeTruthy();
  expect(forward.map((edge) => edge.id).sort()).toEqual(reverse.map((edge) => edge.id).sort());
  const conflict = core.reconcileRun([forward[1]], [reverse[1]]);
  expect(conflict.save).toHaveLength(0);
  expect(conflict.skipped[0].reason).toBe('STRUCTURE_EDGE_OCCUPIED');
});

test('railing/fence/barrier movement blockers and pillar footprint project through topology', () => {
  const core = fresh('js/vtt/structure-core.js');
  global.LuminousVttStructureCore = core;
  global.LuminousVttTopology = fresh('js/vtt/topology.js');
  fresh('js/vtt/structure-topology-patch.js');
  const map = mapBase(); core.ensureMapState(map);
  map.structures.push(
    ...core.createLinearRun({ type: 'railing', from: { col: 1, row: 0 }, to: { col: 1, row: 2 }, zLayer: 0, definitionId: 'railing:metal', mapData: map }),
    core.createPillar({ col: 3, row: 1, zLayer: 0, mapData: map }),
  );
  core.bindMap(map);
  const movement = global.LuminousVttTopology.blockingSegments([], 'movement', 0, map.grid);
  const vision = global.LuminousVttTopology.blockingSegments([], 'vision', 0, map.grid);
  expect(movement.filter((entry) => entry.structure?.type === 'railing')).toHaveLength(2);
  expect(movement.some((entry) => entry.structure?.type === 'pillar' && entry.x1 === entry.x2 && entry.thicknessPx > 0)).toBeTruthy();
  expect(vision.some((entry) => entry.structure?.type === 'railing')).toBeFalsy();
  expect(vision.filter((entry) => entry.structure?.type === 'pillar')).toHaveLength(4);
});

test('token movement and A* consume structure blockers through the existing topology contract', () => {
  const core = fresh('js/vtt/structure-core.js');
  global.LuminousVttStructureCore = core;
  global.LuminousVttTopology = fresh('js/vtt/topology.js');
  fresh('js/vtt/structure-topology-patch.js');
  global.LuminousVttTokenInteraction = fresh('js/vtt/token-interaction.js');
  const pathfinding = fresh('js/vtt/pathfinding.js');
  const map = mapBase(); core.ensureMapState(map);
  map.structures.push(...core.createLinearRun({ type: 'barrier', from: { col: 2, row: 0 }, to: { col: 2, row: 2 }, zLayer: 0, definitionId: 'barrier:concrete', mapData: map }));
  core.bindMap(map);
  const token = { id: 'p1', x: 105, y: 35, zLayer: 0, z: [0], radius: 20 };
  const direct = global.LuminousVttTokenInteraction.isPathClear(token, { x: 105, y: 35 }, { x: 175, y: 35 }, map);
  expect(direct.valid).toBeFalsy();
  const route = pathfinding.findPath({ token, start: { col: 1, row: 0 }, target: { col: 3, row: 0 }, mapData: map, zLayer: 0, blockTokens: false });
  expect(route.valid).toBeTruthy();
  expect(route.cells.some((cell) => cell.row >= 2)).toBeTruthy();
});

test('structure physical resolver respects height, cover and Z isolation', () => {
  const core = fresh('js/vtt/structure-core.js');
  global.LuminousVttStructureCore = core;
  const basePhysical = fresh('js/vtt/physical-resolver.js');
  global.LuminousVttPhysicalResolver = basePhysical;
  fresh('js/vtt/structure-physical-patch.js');
  const physical = global.LuminousVttPhysicalResolver;
  const map = mapBase(); core.ensureMapState(map);
  map.structureDefinitions['pillar:low'] = core.normalizeDefinition({ id: 'pillar:low', name: 'Low Pillar', type: 'pillar', physical: { heightFt: 2, diameterFt: 2, blocksMovement: true, blocksVision: true, coverQuality: 'partial' } });
  const tall = core.createPillar({ col: 1, row: 0, zLayer: 0, definitionId: 'pillar:concrete', mapData: map });
  const low = core.createPillar({ col: 3, row: 0, zLayer: 0, definitionId: 'pillar:low', mapData: map });
  const railing = core.createLinearRun({ type: 'railing', from: { col: 1, row: 1 }, to: { col: 2, row: 1 }, zLayer: 0, definitionId: 'railing:metal', mapData: map })[0];
  const barrierZ1 = core.createLinearRun({ type: 'barrier', from: { col: 1, row: 1 }, to: { col: 2, row: 1 }, zLayer: 1, definitionId: 'barrier:concrete', mapData: map })[0];
  map.structures.push(tall, low, railing, barrierZ1); core.bindMap(map);
  const viewer = { x: 0, y: 35, zLayer: 0, eyeHeightFt: 5.5, heightFt: 6 };
  expect(physical.blocksLineOfEffect(viewer, { x: 140, y: 35, zLayer: 0, elevationFt: 5.5 }, map, 'vision')).toBeTruthy();
  expect(physical.blocksLineOfEffect({ x: 140, y: 35, zLayer: 0, eyeHeightFt: 5.5 }, { x: 280, y: 35, zLayer: 0, elevationFt: 5.5 }, map, 'vision')).toBeFalsy();
  const cover = physical.coverAtToken({ x: 105, y: 95, zLayer: 0, heightFt: 6 }, map);
  expect(cover.nearbyStructures.some((entry) => entry.instance.type === 'railing' && entry.level === 'partial')).toBeTruthy();
  expect(physical.nearbyStructureCover({ x: 105, y: 95, zLayer: 0 }, map).some((entry) => entry.instance.zLayer === 1)).toBeFalsy();
});

test('fall protection is explicit and layer-local', () => {
  const core = fresh('js/vtt/structure-core.js');
  const map = mapBase(); core.ensureMapState(map);
  map.structures.push(
    ...core.createLinearRun({ type: 'railing', from: { col: 0, row: 1 }, to: { col: 2, row: 1 }, zLayer: 0, definitionId: 'railing:metal', mapData: map }),
    ...core.createLinearRun({ type: 'barrier', from: { col: 0, row: 2 }, to: { col: 1, row: 2 }, zLayer: 1, definitionId: 'barrier:concrete', mapData: map }),
    core.createPillar({ col: 2, row: 2, zLayer: 0, mapData: map }),
  );
  expect(core.fallProtectionSegments(map, 0)).toHaveLength(2);
  expect(core.fallProtectionSegments(map, 1)).toHaveLength(1);
});

test('MapDefinition round-trip retains structure definitions and instances and blocks floor deletion', () => {
  fresh('js/vtt/map-authoring.js');
  fresh('js/vtt/surface-core.js');
  fresh('js/vtt/surface-authoring-patch.js');
  const core = fresh('js/vtt/structure-core.js'); global.LuminousVttStructureCore = core;
  fresh('js/vtt/structure-authoring-patch.js');
  const authoring = global.LuminousVttMapAuthoring;
  const map = mapBase();
  map.zLevels = { 0: { id: 0, label: 'Ground', elevationFt: 0 }, 1: { id: 1, label: 'Upper', elevationFt: 15 } };
  core.ensureMapState(map);
  map.structures.push(core.createPillar({ col: 2, row: 1, zLayer: 1, mapData: map }));
  const definition = authoring.definitionFromMapData(map);
  expect(definition.structures).toHaveLength(1);
  const restored = mapBase();
  authoring.applyDefinition(restored, definition);
  expect(restored.structures[0]).toMatchObject({ type: 'pillar', zLayer: 1, definitionId: 'pillar:concrete' });
  const gate = authoring.canDeleteLevel(restored, 1);
  expect(gate.valid).toBeFalsy();
  expect(gate.dependencies.structures).toHaveLength(1);
});

test('bootstrap exposes dedicated structure tools without hijacking topology tools', async () => {
  const fs = require('fs');
  const bootstrap = fs.readFileSync(path.join(ROOT, 'js/vtt/structure-bootstrap.js'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'js/vtt/main.js'), 'utf8');
  expect(bootstrap).toContain("['select','pillar','fence','railing','barrier','erase']");
  expect(bootstrap).toContain("runtime.controller?.setTool?.('select')");
  expect(bootstrap).toContain("runtime.surfaces?.setTool?.('select')");
  expect(main).toContain("import './structure-topology-patch.js';");
  expect(main).toContain("import './structure-physical-patch.js';");
  expect(main).toContain("import('./structure-bootstrap.js')");
});
