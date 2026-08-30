const { test, expect } = require('@playwright/test');
const Graph = require('../js/regional-world-graph-core.js');
const Travel = require('../js/regional-travel-core.js');
const Scheduler = require('../js/world-time-scheduler-core.js');
const Streaming = require('../js/vtt/world-streaming-core.js');

const hex = (q, r = 0, district = 'K') => ({ district, q, r });
const key = (q, r = 0, district = 'K') => Travel.hexKey(hex(q, r, district));
const road = (from, to, extra = {}) => ({ from, to, routeType: 'road', ...extra });
const calendar = () => ({ timestamp: '2026-08-30T12:00:00.000Z', año: 2026, mes: 8, dia: 30, hora: 12, minuto: 0, segundo: 0 });

function corridorDefinition(revision = 1) {
  const A = hex(0, 0), N = hex(1, 0), B = hex(2, 0);
  const C = hex(0, 1), D = hex(1, 1), E = hex(2, 1);
  return {
    id: 'k_test_graph',
    revision,
    nodes: [
      { ...A, jurisdiction: 'outskirts', terrain: 'plains' },
      { ...N, jurisdiction: 'nest', terrain: 'plains', requiredAccess: ['pass_k'] },
      { ...B, jurisdiction: 'outskirts', terrain: 'plains', settlementId: 'villa_b' },
      { ...C, jurisdiction: 'backstreets', terrain: 'plains' },
      { ...D, jurisdiction: 'backstreets', terrain: 'plains' },
      { ...E, jurisdiction: 'outskirts', terrain: 'plains' },
    ],
    edges: [
      road(A, N, { id: 'nest_gate_west' }),
      road(N, B, { id: 'nest_gate_east' }),
      road(A, C, { id: 'bypass_1' }),
      road(C, D, { id: 'bypass_2' }),
      road(D, E, { id: 'bypass_3' }),
      road(E, B, { id: 'bypass_4' }),
    ],
  };
}

function makeGraph(revision = 1) {
  Graph.clearRegistry();
  return Graph.registerGraph(corridorDefinition(revision));
}

function graphCommand(result, commandId = 'graph_trip', accessMode = 'normal') {
  const command = Travel.toSchedulerCommand(result.plan, commandId);
  command.payload.routing = { ...result.routing, accessMode };
  return command;
}

test.describe('Regional World Graph v1', () => {
  test.beforeEach(() => Graph.clearRegistry());

  test('jurisdiction is independent from terrain and settlement metadata', () => {
    const graph = makeGraph();
    expect(graph.nodes.get(key(1, 0)).jurisdiction).toBe('nest');
    expect(graph.nodes.get(key(1, 0)).terrain).toBe('plains');
    expect(graph.nodes.get(key(2, 0)).jurisdiction).toBe('outskirts');
    expect(graph.nodes.get(key(2, 0)).settlementId).toBe('villa_b');
  });

  test('public travel routes around a Nest when the group lacks its pass', () => {
    const graph = makeGraph();
    const result = Graph.findRoute(graph, { origin: hex(0, 0), destination: hex(2, 0), transportId: 'public_bus' });
    expect(result.valid).toBe(true);
    expect(result.route.map(Travel.hexKey)).toEqual([key(0, 0), key(0, 1), key(1, 1), key(2, 1), key(2, 0)]);
    expect(result.durationSeconds).toBe(4 * 2400);
  });

  test('a valid Nest pass unlocks the shorter infrastructure route', () => {
    const graph = makeGraph();
    const result = Graph.findRoute(graph, {
      origin: hex(0, 0), destination: hex(2, 0), transportId: 'public_bus', accessState: { grants: ['pass_k'] },
    });
    expect(result.valid).toBe(true);
    expect(result.route.map(Travel.hexKey)).toEqual([key(0, 0), key(1, 0), key(2, 0)]);
    expect(result.durationSeconds).toBe(2 * 2400);
  });

  test('a Nest destination is blocked without access instead of spawning through it', () => {
    const graph = makeGraph();
    const denied = Graph.findRoute(graph, { origin: hex(0, 0), destination: hex(1, 0), transportId: 'walking' });
    expect(denied.valid).toBe(false);
    expect(denied.reason).toBe('destination_access_required');
    expect(denied.requiredAccess).toEqual(['pass_k']);

    const allowed = Graph.findRoute(graph, {
      origin: hex(0, 0), destination: hex(1, 0), transportId: 'walking', accessState: { grants: ['pass_k'] },
    });
    expect(allowed.valid).toBe(true);
  });

  test('transport capabilities are honored by the graph, not reimplemented', () => {
    const graph = Graph.registerGraph({
      id: 'rail_only',
      nodes: [{ ...hex(0), terrain: 'plains' }, { ...hex(1), terrain: 'mountain' }],
      edges: [{ from: hex(0), to: hex(1), routeType: 'rail', id: 'rail' }],
      autoConnectAdjacent: false,
    });
    expect(Graph.findRoute(graph, { origin: hex(0), destination: hex(1), transportId: 'train' }).valid).toBe(true);
    expect(Graph.findRoute(graph, { origin: hex(0), destination: hex(1), transportId: 'public_bus' }).reason).toBe('no_route');
  });

  test('entry side is derived from the physical last hex transition', () => {
    expect(Graph.movementEntrySide(hex(0, 0), hex(1, 0))).toBe('west');
    expect(Graph.movementEntrySide(hex(1, 0), hex(0, 0))).toBe('east');
    expect(Graph.movementEntrySide(hex(0, 0), hex(1, -1))).toBe('southwest');
    expect(Graph.movementEntrySide(hex(0, 0), hex(0, 1))).toBe('northwest');
  });

  test('graph fingerprint is deterministic and revision-sensitive', () => {
    const first = Graph.createGraph(corridorDefinition(1));
    const second = Graph.createGraph(corridorDefinition(1));
    const revised = Graph.createGraph(corridorDefinition(2));
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(revised.fingerprint).not.toBe(first.fingerprint);
  });

  test('graph-produced travel uses the existing Travel ETA and one scheduler event', () => {
    const graph = makeGraph();
    const result = Graph.createTravelPlan({
      graphId: graph.id, groupId: 'party', memberIds: ['p1', 'p2'], worldId: 'luminous',
      origin: hex(0, 0), destination: hex(2, 0), transportId: 'public_bus',
    });
    expect(result.valid).toBe(true);
    expect(result.plan.durationSeconds).toBe(result.routeResult.durationSeconds);
    expect(result.routing.mode).toBe('graph_v1');
    expect(result.routing.destinationEntrySide).toBe('northwest');

    const command = graphCommand(result);
    expect(Graph.validateScheduledCommand(command).valid).toBe(true);
    const applied = Scheduler.applyCommandToCalendar(calendar(), command);
    expect(Object.keys(Scheduler.schedulerStateFrom(applied.calendar).events)).toHaveLength(1);
  });

  test('a client cannot forge a route through a restricted Nest while keeping a valid ETA', () => {
    const graph = makeGraph();
    const forgedTravel = Travel.createTravelPlan({
      groupId: 'party', memberIds: ['p1'], worldId: 'luminous', transportId: 'public_bus',
      route: [hex(0, 0), hex(1, 0), hex(2, 0)],
      segments: [{ surface: 'road', terrain: 'plains' }, { surface: 'road', terrain: 'plains' }],
    });
    const command = Travel.toSchedulerCommand(forgedTravel.plan, 'forged_nest');
    command.payload.routing = {
      mode: 'graph_v1', routeMode: 'fastest', graphId: graph.id, graphRevision: graph.revision,
      graphFingerprint: graph.fingerprint, destinationEntrySide: 'west', accessMode: 'normal',
    };
    const checked = Graph.validateScheduledCommand(command);
    expect(checked.valid).toBe(false);
    expect(checked.reason).toBe('graph_route_mismatch');
  });

  test('DM bypass must be explicit and cannot validate as ordinary player access', () => {
    const graph = makeGraph();
    const result = Graph.createTravelPlan({
      graphId: graph.id, groupId: 'party', memberIds: ['p1'], worldId: 'luminous',
      origin: hex(0, 0), destination: hex(2, 0), transportId: 'public_bus', accessState: { bypassAccess: true },
    });
    const command = graphCommand(result, 'dm_bypass', 'bypass');
    expect(Graph.validateScheduledCommand(command, { allowRestricted: false }).valid).toBe(false);
    expect(Graph.validateScheduledCommand(command, { allowRestricted: true }).valid).toBe(true);
  });

  test('stale graph revision or fingerprint is rejected before travel', () => {
    const graph = makeGraph();
    const result = Graph.createTravelPlan({
      graphId: graph.id, groupId: 'party', memberIds: ['p1'], origin: hex(0, 0), destination: hex(2, 0), transportId: 'public_bus',
    });
    const revisionCommand = graphCommand(result, 'stale_revision');
    revisionCommand.payload.routing.graphRevision += 1;
    expect(Graph.validateScheduledCommand(revisionCommand).reason).toBe('graph_revision_mismatch');

    const fingerprintCommand = graphCommand(result, 'stale_fingerprint');
    fingerprintCommand.payload.routing.graphFingerprint = 'deadbeef';
    expect(Graph.validateScheduledCommand(fingerprintCommand).reason).toBe('graph_fingerprint_mismatch');
  });

  test('eight independent parties remain eight scheduler events and do not stream crossed hexes', () => {
    const nodes = [], edges = [];
    const width = 32, height = 8;
    for (let r = 0; r < height; r += 1) {
      for (let q = 0; q < width; q += 1) {
        nodes.push({ ...hex(q, r), jurisdiction: 'outskirts', terrain: 'plains' });
        if (q > 0) edges.push(road(hex(q - 1, r), hex(q, r), { id: `road_${q - 1}_${r}_${q}_${r}` }));
      }
    }
    const graph = Graph.registerGraph({ id: 'stress_graph', nodes, edges, autoConnectAdjacent: false });
    const manager = Streaming.createLifecycleManager({ warmTtlMs: 0, maxWarmChunks: 0, maxActiveChunks: 8 });
    manager.reconcile(Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`, position: { worldId: 'luminous', regionId: 'K', zoneId: `origin${i}`, chunkCol: 0, chunkRow: 0, x: 1, y: 1 },
    })), 0);

    let state = calendar();
    for (let i = 0; i < 8; i += 1) {
      const result = Graph.createTravelPlan({
        graphId: graph.id, groupId: `g${i}`, memberIds: [`p${i}`], worldId: 'luminous',
        origin: hex(0, i), destination: hex(width - 1, i), transportId: 'private_bus',
      });
      expect(result.valid).toBe(true);
      expect(result.routeResult.visitedCount).toBeLessThanOrEqual(nodes.length);
      const command = graphCommand(result, `graph_stress_${i}`);
      expect(Graph.validateScheduledCommand(command).valid).toBe(true);
      state = Scheduler.applyCommandToCalendar(state, command).calendar;
    }

    const scheduler = Scheduler.schedulerStateFrom(state);
    expect(Object.keys(scheduler.events)).toHaveLength(8);
    expect(Object.keys(scheduler.groups)).toHaveLength(8);
    expect(JSON.stringify(scheduler).length).toBeLessThan(150000);
    expect(manager.snapshot().activeChunks).toBe(8);
    expect(manager.snapshot().residentChunks).toBe(8);
  });

  test('graph size and invalid edges fail closed instead of creating unbounded work', () => {
    expect(() => Graph.createGraph({ id: 'empty', nodes: [] })).toThrow('GRAPH_NODE_COUNT_INVALID');
    expect(() => Graph.createGraph({
      id: 'skip', nodes: [hex(0), hex(2)], edges: [{ from: hex(0), to: hex(2), routeType: 'road' }], autoConnectAdjacent: false,
    })).toThrow('GRAPH_EDGE_NOT_ADJACENT');
  });
});
