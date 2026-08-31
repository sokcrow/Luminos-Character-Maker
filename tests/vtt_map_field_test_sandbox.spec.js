const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const Sandbox = require('../js/vtt/map-field-test-sandbox-core.js');
const Streaming = require('../js/vtt/world-streaming-core.js');
const Simulation = require('../js/vtt/map-simulation-core.js');
const Discovery = require('../js/vtt/player-discovery-core.js');
const Chunk = require('../js/vtt/procedural-chunk-streaming-core.js');
const Graph = require('../js/regional-world-graph-core.js');

const scenario = () => Sandbox.createScenario();
const hex = (q, r) => ({ district: Sandbox.CONFIG.regionId, q, r });

test.describe('Map Field-Test Sandbox', () => {
  test('fixture is deterministic and contains exactly the 37 radius-3 regional hexes', () => {
    const a = scenario(), b = scenario();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.regionalHexes).toHaveLength(37);
    expect(new Set(a.regionalHexes.map(h => h.key)).size).toBe(37);
    for (const h of a.regionalHexes) expect(Sandbox.axialDistance(h.q, h.r)).toBeLessThanOrEqual(3);
  });

  test('legal geography uses only Nest, Backstreets and Outskirts while wilderness remains terrain', () => {
    const s = scenario();
    expect(new Set(s.regionalHexes.map(h => h.jurisdiction))).toEqual(new Set(['nest', 'backstreets', 'outskirts']));
    const wilderness = s.regionalHexes.filter(h => h.landcover.startsWith('wilderness_'));
    expect(wilderness.length).toBeGreaterThan(0);
    expect(wilderness.every(h => h.jurisdiction === 'outskirts')).toBeTruthy();
    expect(s.regionalHexes.some(h => h.features.villa)).toBeTruthy();
    expect(s.regionalHexes.some(h => h.features.checkpoint)).toBeTruthy();
    expect(s.regionalHexes.some(h => h.features.road)).toBeTruthy();
    expect(s.regionalHexes.some(h => h.features.dirtRoad)).toBeTruthy();
    expect(s.regionalHexes.some(h => h.features.rail)).toBeTruthy();
  });

  test('real Regional World Graph routes road and rail and enforces the Nest pass', () => {
    const graph = Graph.createGraph(scenario().graphDefinition);
    expect(graph.stats.nodeCount).toBe(37);

    const denied = Graph.findRoute(graph, {
      origin: hex(-1, 0), destination: hex(0, 0), transportId: 'walking', accessState: { grants: [] },
    });
    expect(denied.valid).toBeFalsy();
    expect(denied.reason).toBe('destination_access_required');

    const road = Graph.findRoute(graph, {
      origin: hex(-3, 0), destination: hex(3, 0), transportId: 'public_bus', accessState: { grants: ['nest_pass'] },
    });
    expect(road.valid).toBeTruthy();
    expect(road.route).toHaveLength(7);
    expect(road.segments.every(segment => ['road', 'dirt_road'].includes(segment.surface))).toBeTruthy();

    const rail = Graph.findRoute(graph, {
      origin: hex(-2, -1), destination: hex(3, -1), transportId: 'train', accessState: { grants: [] },
    });
    expect(rail.valid).toBeTruthy();
    expect(rail.segments).toHaveLength(5);
    expect(rail.segments.every(segment => segment.surface === 'rail')).toBeTruthy();
  });

  test('local sandbox has 8 logical Zones with interiors, wilderness, rail and a multi-level building', () => {
    const zones = scenario().zones;
    expect(zones).toHaveLength(8);
    expect(new Set(zones.map(z => z.id)).size).toBe(8);
    expect(zones.every(z => z.chunkCols === 3 && z.chunkRows === 3 && z.logicalCells === 14400)).toBeTruthy();
    expect(zones.some(z => z.kind === 'nest_entry')).toBeTruthy();
    expect(zones.some(z => z.kind === 'villa')).toBeTruthy();
    expect(zones.some(z => z.kind === 'wilderness')).toBeTruthy();
    expect(zones.some(z => z.kind === 'rail')).toBeTruthy();
    expect(zones.some(z => z.features.includes('interior'))).toBeTruthy();
    expect(zones.some(z => z.zLayers.length >= 3)).toBeTruthy();
  });

  test('8-player scenario assigns the intended split-party stress roles', () => {
    const players = scenario().players;
    expect(players).toHaveLength(8);
    expect(new Set(players.map(p => p.id)).size).toBe(8);
    expect(players[0].position.zoneId).toBe(players[1].position.zoneId);
    expect(players[0].position.chunkCol).not.toBe(players[1].position.chunkCol);
    expect(players.find(p => p.id === 'P4').position.zLayer).toBe(2);
    expect(players.find(p => p.id === 'P5').scenario).toBe('wilderness');
    expect(players.find(p => p.id === 'P6').scenario).toBe('road');
    expect(players.find(p => p.id === 'P7').regionalTravel).toBeTruthy();
    expect(players.find(p => p.id === 'P8').reconnect).toBeTruthy();
  });

  test('World Streaming keeps the 8 separated player chunks bounded to 12,800 live cells', () => {
    const manager = Streaming.createLifecycleManager({ maxActiveChunks: 8, maxWarmChunks: 16, warmTtlMs: 1000 });
    const result = manager.reconcile(scenario().players, 0);
    expect(result.metrics.uniqueActors).toBe(8);
    expect(result.metrics.activeChunks).toBe(8);
    expect(result.metrics.liveCells).toBe(12800);
    expect(result.metrics.overActiveBudget).toBe(0);
    expect(result.metrics.peakActiveChunks).toBeLessThanOrEqual(8);
  });

  test('Simulation Bubbles deduplicate players sharing a Zone and remain within the 8-Zone budget', () => {
    const manager = Simulation.createSimulationBubbleManager({ maxActiveZones: 8, maxWarmZones: 16, warmTtlMs: 1000 });
    const result = manager.reconcile(scenario().players, 0);
    expect(result.metrics.uniqueActors).toBe(8);
    expect(result.metrics.activeZones).toBe(7);
    expect(result.metrics.actorRefs).toBe(8);
    expect(result.metrics.overActiveBudget).toBe(0);
  });

  test('a logical 120x120 Zone materializes only one 40x40 chunk and transitions one chunk at a time', () => {
    const zone = scenario().zones.find(z => z.id === 'backstreets_market');
    let descriptor = Chunk.createDescriptor(zone);
    const budget = Chunk.performanceBudget(descriptor);
    expect(budget.logicalCells).toBe(14400);
    expect(budget.liveCells).toBe(1600);
    expect(budget.loadedChunks).toBe(1);
    expect(budget.logicalChunks).toBe(9);

    descriptor = Chunk.withActiveChunk(descriptor, { col: 0, row: 1 });
    const transition = Chunk.resolveTransition(descriptor, { x: 40 * 70 + 1, y: 20 * 70 }, Chunk.liveGrid());
    expect(transition.valid).toBeTruthy();
    expect(transition.target).toEqual({ col: 1, row: 1 });
    const next = Chunk.withActiveChunk(descriptor, transition.target);
    expect(next.activeChunk).toEqual({ col: 1, row: 1 });
    const generation = Chunk.chunkGenerationOptions(next, next.activeChunk);
    expect(generation.chunkCols).toBe(1);
    expect(generation.chunkRows).toBe(1);
  });

  test('all 8 local views together still generate only eight 40x40 live chunks, never eight 120x120 Zones', () => {
    let liveCells = 0, logicalCells = 0;
    for (const zone of scenario().zones) {
      const budget = Chunk.performanceBudget(Chunk.createDescriptor(zone));
      liveCells += budget.liveCells;
      logicalCells += budget.logicalCells;
      expect(budget.loadedChunks).toBe(1);
    }
    expect(liveCells).toBe(12800);
    expect(logicalCells).toBe(115200);
    expect(liveCells).toBeLessThan(logicalCells);
  });

  test('P1 and P2 maintain different Fog knowledge even inside the same Zone', () => {
    const [p1, p2] = scenario().players;
    const identity = p1.position;
    let r1 = Discovery.blank(identity, 100), r2 = Discovery.blank(identity, 100);
    r1 = Discovery.capture(r1, { identity, zLayer: 0, chunkCol: 0, chunkRow: 1, worldNow: 100, cells: [{ worldCol: 5, worldRow: 45 }] }).record;
    r2 = Discovery.capture(r2, { identity, zLayer: 0, chunkCol: 1, chunkRow: 1, worldNow: 100, cells: [{ worldCol: 48, worldRow: 48 }] }).record;
    expect(Discovery.slice(r1, { zLayer: 0, chunkCol: 0, chunkRow: 1 }).cells).toEqual([{ col: 5, row: 5 }]);
    expect(Discovery.slice(r1, { zLayer: 0, chunkCol: 1, chunkRow: 1 }).cells).toEqual([]);
    expect(Discovery.slice(r2, { zLayer: 0, chunkCol: 1, chunkRow: 1 }).cells).toEqual([{ col: 8, row: 8 }]);
  });

  test('P8 reconnect reconstructs the same Fog record without leaking another Zone', () => {
    const p8 = scenario().players.find(p => p.id === 'P8');
    let record = Discovery.blank(p8.position, 500);
    record = Discovery.capture(record, {
      identity: p8.position, zLayer: p8.position.zLayer, chunkCol: 1, chunkRow: 1, worldNow: 500,
      cells: [{ worldCol: 44, worldRow: 47 }, { worldCol: 45, worldRow: 47 }],
      topology: [{ id: 'door_ruins', type: 'door', state: 'closed' }],
    }).record;
    const restored = Discovery.normalize(JSON.parse(JSON.stringify(record)), p8.position);
    expect(Discovery.metrics(restored)).toEqual(Discovery.metrics(record));
    expect(Discovery.slice(restored, { zLayer: 1, chunkCol: 1, chunkRow: 1 })).toEqual(Discovery.slice(record, { zLayer: 1, chunkCol: 1, chunkRow: 1 }));
    expect(Discovery.zoneKey(restored)).toBe(`${Sandbox.CONFIG.worldId}/${Sandbox.CONFIG.regionId}/outskirts_ruins`);
  });

  test('disconnect makes P8 chunk dormant after TTL and reconnect reactivates exactly its canonical chunk', () => {
    const players = scenario().players;
    const p8 = players.find(p => p.id === 'P8');
    const manager = Streaming.createLifecycleManager({ maxActiveChunks: 8, maxWarmChunks: 16, warmTtlMs: 1000 });
    manager.reconcile(players, 0);
    manager.reconcile(players.filter(p => p.id !== 'P8'), 100);
    expect(manager.chunkState(p8.position)).toBe(Streaming.STATES.WARM);
    manager.tick(1101);
    expect(manager.chunkState(p8.position)).toBe(Streaming.STATES.DORMANT);
    manager.reconcile(players, 1200);
    expect(manager.chunkState(p8.position)).toBe(Streaming.STATES.ACTIVE);
    expect(manager.actorPosition('P8').zoneId).toBe('outskirts_ruins');
  });

  test('Seed+Delta survives a Zone becoming DORMANT and can be imported on return', () => {
    const players = scenario().players;
    const p4 = players.find(p => p.id === 'P4');
    const bubbles = Simulation.createSimulationBubbleManager({ maxActiveZones: 8, maxWarmZones: 16, warmTtlMs: 1000 });
    const store = Simulation.createDeltaStore();
    bubbles.reconcile(players, 0);
    store.recordEntityChange(p4.position, {
      entityId: 'factory_door_01', kind: 'topology', operation: 'upsert', patch: { state: 'open', zLayer: 2 },
      seed: 'field-factory-seed', generatorVersion: Sandbox.CONFIG.generatorVersion, updatedAt: 300,
    });
    bubbles.reconcile(players.filter(p => p.id !== 'P4'), 400);
    bubbles.tick(1401);
    expect(bubbles.stateOf(p4.position)).toBe(Simulation.STATES.DORMANT);
    const dormant = store.get(p4.position, 1401);
    expect(dormant.entities.factory_door_01.patch).toEqual({ state: 'open', zLayer: 2 });

    const restoredStore = Simulation.createDeltaStore();
    restoredStore.importRecord(JSON.parse(JSON.stringify(dormant)));
    expect(restoredStore.get(p4.position, 1500).entities.factory_door_01.patch.state).toBe('open');
  });

  test('published source Rules keep configured DM authority and player/request ownership guards', () => {
    const rulesPath = path.join(__dirname, '..', 'database.rules.json');
    const source = fs.readFileSync(rulesPath, 'utf8');
    const rules = JSON.parse(source).rules;
    const writes = [
      rules.campaña.estado_mundo['.write'],
      rules.campaña.jugadores['$nombre_personaje']['.write'],
      rules.vtt_topology['$mapId']['.write'],
      rules.vtt_topology_action_requests['$mapId']['$requestId']['.write'],
      rules.vtt_world_object_action_requests['$mapId']['$requestId']['.write'],
      rules.vtt_regional_local_transition_requests['$mapId']['$requestId']['.write'],
    ];
    for (const rule of writes) {
      expect(rule).toContain("child('config').child('dm_uid')");
      expect(rule).toContain("!root.child('campaña').child('config').child('dm_uid').exists()");
      expect(rule.trim()).not.toBe('auth != null');
    }
    expect(rules.campaña.jugadores['$nombre_personaje']['.write']).toContain("data.child('uid').val() === auth.uid");
    expect(rules.vtt_topology_action_requests['$mapId']['$requestId']['.write']).toContain("newData.child('requesterUid').val() === auth.uid");
    expect(rules.vtt_world_object_action_requests['$mapId']['$requestId']['.write']).toContain("newData.child('requesterUid').val() === auth.uid");
    expect(rules.vtt_regional_local_transition_requests['$mapId']['$requestId']['.write']).toContain("child('uid').val() === auth.uid");
  });

  test('sandbox core has no polling, timers or Firebase dependency', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'vtt', 'map-field-test-sandbox-core.js'), 'utf8');
    expect(source).not.toMatch(/setInterval\s*\(/);
    expect(source).not.toMatch(/setTimeout\s*\(/);
    expect(source).not.toMatch(/requestAnimationFrame\s*\(/);
    expect(source).not.toMatch(/firebase|\.database\s*\(/i);
  });
});
