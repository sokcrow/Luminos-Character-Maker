(function (root, factory) {
  "use strict";
  const Travel = typeof module !== "undefined" && module.exports
    ? require("./regional-travel-core.js")
    : root?.LuminousRegionalTravelCore;
  const api = factory(Travel);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LuminousRegionalWorldGraphCore = api;
})(typeof window !== "undefined" ? window : globalThis, function (Travel) {
  "use strict";

  if (!Travel) throw new Error("LUMINOUS_REGIONAL_TRAVEL_CORE_REQUIRED");

  const CONFIG = Object.freeze({
    schemaVersion: 1,
    maxNodes: 8192,
    maxEdges: 65536,
    maxVisitedNodes: 8192,
    routingMode: "graph_v1",
    routeMode: "fastest",
  });

  const JURISDICTIONS = Object.freeze(["nest", "backstreets", "outskirts"]);
  const ENTRY_SIDES = Object.freeze(["west", "southwest", "southeast", "east", "northeast", "northwest"]);
  const DIRECTIONS = Object.freeze([
    Object.freeze([1, 0]), Object.freeze([1, -1]), Object.freeze([0, -1]),
    Object.freeze([-1, 0]), Object.freeze([-1, 1]), Object.freeze([0, 1]),
  ]);
  const ROUTE_SURFACES = Object.freeze({
    highway: "road",
    road: "road",
    dirt: "dirt_road",
    dirt_road: "dirt_road",
    trail: "trail",
    rail: "rail",
    offroad: "offroad",
    rough: "rough",
  });

  const registry = new Map();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Math.trunc(finite(value, fallback));
  const safeKey = (value, fallback = "") => String(value ?? fallback).trim().replace(/[.#$\[\]\/]/g, "_").replace(/\s+/g, "_").slice(0, 120) || fallback;
  const bool = (value, fallback = false) => value == null ? fallback : value === true;

  function stableHash(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function normalizeRequirements(value) {
    const list = Array.isArray(value) ? value : value && typeof value === "object" ? Object.keys(value).filter((key) => value[key]) : value ? [value] : [];
    const out = [], seen = new Set();
    for (const raw of list) {
      const key = safeKey(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return Object.freeze(out.sort());
  }

  function normalizeAccessState(raw = {}) {
    const grants = normalizeRequirements(raw.grants ?? raw.passes ?? raw.accessKeys);
    return Object.freeze({
      grants,
      grantSet: new Set(grants),
      bypassAccess: raw.bypassAccess === true,
    });
  }

  function normalizeJurisdiction(value) {
    const key = safeKey(value, "outskirts").toLowerCase();
    return JURISDICTIONS.includes(key) ? key : "outskirts";
  }

  function normalizeNode(raw = {}) {
    const hex = Travel.normalizeHex(raw.hex || raw);
    return Object.freeze({
      key: Travel.hexKey(hex),
      hex,
      jurisdiction: normalizeJurisdiction(raw.jurisdiction),
      terrain: Travel.normalizeTerrain(raw.terrain ?? raw.biome),
      settlementId: safeKey(raw.settlementId ?? raw.settlement?.id),
      requiredAccess: normalizeRequirements(raw.requiredAccess ?? raw.access?.required),
      blocked: raw.blocked === true,
      metadata: raw.metadata && typeof raw.metadata === "object" ? Object.freeze(clone(raw.metadata)) : null,
    });
  }

  function routeSurface(raw = {}) {
    const routeType = safeKey(raw.routeType ?? raw.type ?? raw.surface, "offroad").toLowerCase();
    return Travel.normalizeSurface(ROUTE_SURFACES[routeType] || raw.surface || "offroad");
  }

  function edgeRefKey(value) {
    if (typeof value === "string") return value;
    return Travel.hexKey(value || {});
  }

  function normalizeEdge(raw, nodes, index, reverse = false) {
    const from = reverse ? edgeRefKey(raw.to) : edgeRefKey(raw.from);
    const to = reverse ? edgeRefKey(raw.from) : edgeRefKey(raw.to);
    if (!nodes.has(from) || !nodes.has(to)) throw Object.assign(new Error("GRAPH_EDGE_NODE_MISSING"), { from, to });
    const fromNode = nodes.get(from), toNode = nodes.get(to);
    if (!Travel.areAdjacent(fromNode.hex, toNode.hex)) throw Object.assign(new Error("GRAPH_EDGE_NOT_ADJACENT"), { from, to });
    const surface = routeSurface(raw);
    const baseId = safeKey(raw.id, `edge_${index}_${from}_${to}_${surface}`);
    return Object.freeze({
      id: reverse ? `${baseId}_reverse` : baseId,
      from,
      to,
      surface,
      terrain: Travel.normalizeTerrain(raw.terrain ?? toNode.terrain),
      routeQualityMultiplier: Math.max(1, Math.min(3, finite(raw.routeQualityMultiplier ?? raw.qualityMultiplier, 1))),
      weatherMultiplier: Math.max(1, Math.min(3, finite(raw.weatherMultiplier, 1))),
      requiredAccess: normalizeRequirements(raw.requiredAccess ?? raw.access?.required),
      blocked: raw.blocked === true,
      routeType: safeKey(raw.routeType ?? raw.type ?? surface, surface).toLowerCase(),
      auto: false,
    });
  }

  function autoEdge(fromNode, toNode) {
    return Object.freeze({
      id: `auto_${fromNode.key}_to_${toNode.key}`,
      from: fromNode.key,
      to: toNode.key,
      surface: "offroad",
      terrain: toNode.terrain,
      routeQualityMultiplier: 1,
      weatherMultiplier: 1,
      requiredAccess: Object.freeze([]),
      blocked: false,
      routeType: "offroad",
      auto: true,
    });
  }

  function canonicalGraphData(id, revision, nodes, edges) {
    return {
      id,
      revision,
      nodes: [...nodes.values()].map((node) => ({
        key: node.key,
        jurisdiction: node.jurisdiction,
        terrain: node.terrain,
        settlementId: node.settlementId,
        requiredAccess: [...node.requiredAccess],
        blocked: node.blocked,
      })).sort((a, b) => a.key.localeCompare(b.key)),
      edges: edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        surface: edge.surface,
        terrain: edge.terrain,
        routeQualityMultiplier: edge.routeQualityMultiplier,
        weatherMultiplier: edge.weatherMultiplier,
        requiredAccess: [...edge.requiredAccess],
        blocked: edge.blocked,
        routeType: edge.routeType,
        auto: edge.auto,
      })).sort((a, b) => `${a.from}|${a.to}|${a.surface}|${a.id}`.localeCompare(`${b.from}|${b.to}|${b.surface}|${b.id}`)),
    };
  }

  function createGraph(definition = {}) {
    const id = safeKey(definition.id ?? definition.graphId, "regional_world");
    const revision = Math.max(1, integer(definition.revision, 1));
    const rawNodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    if (!rawNodes.length || rawNodes.length > CONFIG.maxNodes) throw new Error("GRAPH_NODE_COUNT_INVALID");

    const nodes = new Map();
    for (const raw of rawNodes) {
      const node = normalizeNode(raw);
      if (nodes.has(node.key)) throw Object.assign(new Error("GRAPH_DUPLICATE_NODE"), { nodeKey: node.key });
      nodes.set(node.key, node);
    }

    const edges = [];
    const explicit = Array.isArray(definition.edges) ? definition.edges : [];
    for (let index = 0; index < explicit.length; index += 1) {
      const raw = explicit[index] || {};
      edges.push(normalizeEdge(raw, nodes, index, false));
      if (raw.oneWay !== true) edges.push(normalizeEdge(raw, nodes, index, true));
    }

    if (definition.autoConnectAdjacent !== false) {
      for (const node of nodes.values()) {
        for (const [dq, dr] of DIRECTIONS) {
          const neighborKey = Travel.hexKey({ district: node.hex.district, q: node.hex.q + dq, r: node.hex.r + dr });
          const neighbor = nodes.get(neighborKey);
          if (neighbor) edges.push(autoEdge(node, neighbor));
        }
      }
    }

    if (edges.length > CONFIG.maxEdges) throw new Error("GRAPH_EDGE_COUNT_INVALID");
    const adjacency = new Map();
    for (const key of nodes.keys()) adjacency.set(key, []);
    for (const edge of edges) adjacency.get(edge.from).push(edge);
    for (const list of adjacency.values()) list.sort((a, b) => `${a.to}|${a.surface}|${a.id}`.localeCompare(`${b.to}|${b.surface}|${b.id}`));

    const canonical = canonicalGraphData(id, revision, nodes, edges);
    const fingerprint = stableHash(JSON.stringify(canonical));
    return Object.freeze({
      schemaVersion: CONFIG.schemaVersion,
      id,
      revision,
      fingerprint,
      nodes,
      edges: Object.freeze(edges),
      adjacency,
      autoConnectAdjacent: definition.autoConnectAdjacent !== false,
      stats: Object.freeze({ nodeCount: nodes.size, edgeCount: edges.length }),
    });
  }

  function registerGraph(definition) {
    const graph = definition?.nodes instanceof Map && definition?.adjacency instanceof Map ? definition : createGraph(definition);
    registry.set(graph.id, graph);
    return graph;
  }
  function unregisterGraph(graphId) { return registry.delete(safeKey(graphId)); }
  function clearRegistry() { registry.clear(); }
  function getGraph(graphId) { return registry.get(safeKey(graphId)) || null; }
  function listGraphs() { return [...registry.values()]; }

  function hasRequirements(requirements, accessState) {
    if (!requirements?.length || accessState.bypassAccess) return true;
    return requirements.every((key) => accessState.grantSet.has(key));
  }
  function canEnterNode(node, accessState) {
    return !!node && !node.blocked && hasRequirements(node.requiredAccess, accessState);
  }
  function canUseEdge(edge, accessState) {
    return !!edge && !edge.blocked && hasRequirements(edge.requiredAccess, accessState);
  }

  function segmentFromEdge(edge) {
    return Object.freeze({
      surface: edge.surface,
      terrain: edge.terrain,
      routeQualityMultiplier: edge.routeQualityMultiplier,
      weatherMultiplier: edge.weatherMultiplier,
    });
  }

  function movementEntrySide(fromRaw, toRaw) {
    const from = Travel.normalizeHex(fromRaw), to = Travel.normalizeHex(toRaw);
    if (from.district !== to.district) return null;
    const key = `${to.q - from.q},${to.r - from.r}`;
    return ({
      "1,0": "west",
      "1,-1": "southwest",
      "0,-1": "southeast",
      "-1,0": "east",
      "-1,1": "northeast",
      "0,1": "northwest",
    })[key] || null;
  }

  class MinHeap {
    constructor() { this.items = []; }
    push(item) {
      const items = this.items;
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (!this.less(items[i], items[p])) break;
        [items[i], items[p]] = [items[p], items[i]];
        i = p;
      }
    }
    pop() {
      const items = this.items;
      if (!items.length) return null;
      const first = items[0], last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        while (true) {
          const l = i * 2 + 1, r = l + 1;
          let best = i;
          if (l < items.length && this.less(items[l], items[best])) best = l;
          if (r < items.length && this.less(items[r], items[best])) best = r;
          if (best === i) break;
          [items[i], items[best]] = [items[best], items[i]];
          i = best;
        }
      }
      return first;
    }
    less(a, b) { return a.cost !== b.cost ? a.cost < b.cost : a.key.localeCompare(b.key) < 0; }
    get size() { return this.items.length; }
  }

  function findRoute(graphOrId, input = {}) {
    const graph = typeof graphOrId === "string" ? getGraph(graphOrId) : graphOrId;
    if (!graph?.nodes || !graph?.adjacency) return { valid: false, reason: "graph_not_registered" };
    const originKey = edgeRefKey(input.origin ?? input.originHex);
    const destinationKey = edgeRefKey(input.destination ?? input.destinationHex);
    const origin = graph.nodes.get(originKey), destination = graph.nodes.get(destinationKey);
    if (!origin || !destination) return { valid: false, reason: "graph_node_missing" };
    if (originKey === destinationKey) return { valid: false, reason: "same_origin_destination" };

    const transport = Travel.normalizeTransport(input.transportId ?? input.transport);
    if (!transport) return { valid: false, reason: "unknown_transport" };
    const accessState = normalizeAccessState(input.accessState || {});
    if (!canEnterNode(destination, accessState)) return { valid: false, reason: destination.blocked ? "destination_blocked" : "destination_access_required", requiredAccess: [...destination.requiredAccess] };

    const dist = new Map([[originKey, 0]]);
    const hops = new Map([[originKey, 0]]);
    const prev = new Map();
    const heap = new MinHeap();
    heap.push({ key: originKey, cost: 0 });
    let visitedCount = 0;

    while (heap.size) {
      const current = heap.pop();
      if (current.cost !== dist.get(current.key)) continue;
      visitedCount += 1;
      if (visitedCount > CONFIG.maxVisitedNodes) return { valid: false, reason: "route_search_limit" };
      if (current.key === destinationKey) break;

      for (const edge of graph.adjacency.get(current.key) || []) {
        const nextNode = graph.nodes.get(edge.to);
        if (!canUseEdge(edge, accessState) || !canEnterNode(nextNode, accessState)) continue;
        const segment = segmentFromEdge(edge);
        if (!Travel.validateCapabilities(transport, [segment]).valid) continue;
        const nextHops = (hops.get(current.key) || 0) + 1;
        if (nextHops >= Travel.CONFIG.maxRouteHexes) continue;
        const nextCost = current.cost + Travel.segmentDurationSeconds({ ...segment, distanceKm: Travel.CONFIG.hexDistanceKm }, transport);
        const known = dist.get(edge.to);
        if (known == null || nextCost < known) {
          dist.set(edge.to, nextCost);
          hops.set(edge.to, nextHops);
          prev.set(edge.to, { from: current.key, edge });
          heap.push({ key: edge.to, cost: nextCost });
        }
      }
    }

    if (!dist.has(destinationKey)) return { valid: false, reason: "no_route", visitedCount };
    const nodeKeys = [destinationKey], pathEdges = [];
    let cursor = destinationKey;
    while (cursor !== originKey) {
      const step = prev.get(cursor);
      if (!step) return { valid: false, reason: "route_reconstruction_failed" };
      pathEdges.push(step.edge);
      cursor = step.from;
      nodeKeys.push(cursor);
    }
    nodeKeys.reverse();
    pathEdges.reverse();
    const route = nodeKeys.map((key) => clone(graph.nodes.get(key).hex));
    const segments = pathEdges.map((edge) => clone(segmentFromEdge(edge)));
    const destinationEntrySide = movementEntrySide(route[route.length - 2], route[route.length - 1]);
    return {
      valid: true,
      graphId: graph.id,
      graphRevision: graph.revision,
      graphFingerprint: graph.fingerprint,
      routeMode: CONFIG.routeMode,
      route,
      segments,
      edgeIds: pathEdges.map((edge) => edge.id),
      durationSeconds: dist.get(destinationKey),
      destinationEntrySide,
      visitedCount,
    };
  }

  function routingMetadata(graph, routeResult) {
    return Object.freeze({
      mode: CONFIG.routingMode,
      routeMode: CONFIG.routeMode,
      graphId: graph.id,
      graphRevision: graph.revision,
      graphFingerprint: graph.fingerprint,
      destinationEntrySide: ENTRY_SIDES.includes(routeResult.destinationEntrySide) ? routeResult.destinationEntrySide : null,
    });
  }

  function createTravelPlan(input = {}) {
    const graph = input.graph || getGraph(input.graphId);
    if (!graph) return { valid: false, reason: "graph_not_registered" };
    const routeResult = findRoute(graph, input);
    if (!routeResult.valid) return routeResult;
    const travel = Travel.createTravelPlan({
      groupId: input.groupId ?? input.activityGroupId,
      memberIds: input.memberIds,
      worldId: input.worldId,
      route: routeResult.route,
      segments: routeResult.segments,
      transportId: input.transportId ?? input.transport,
      waitSeconds: input.waitSeconds,
      stopSeconds: input.stopSeconds,
    });
    if (!travel.valid) return travel;
    return { valid: true, plan: travel.plan, routeResult, routing: routingMetadata(graph, routeResult) };
  }

  function routeSignature(route) {
    return (Array.isArray(route) ? route : []).map((hex) => Travel.hexKey(hex)).join(">");
  }
  function segmentSignature(segments) {
    return JSON.stringify((Array.isArray(segments) ? segments : []).map((segment) => ({
      surface: Travel.normalizeSurface(segment.surface),
      terrain: Travel.normalizeTerrain(segment.terrain),
      routeQualityMultiplier: Math.max(1, Math.min(3, finite(segment.routeQualityMultiplier, 1))),
      weatherMultiplier: Math.max(1, Math.min(3, finite(segment.weatherMultiplier, 1))),
    })));
  }

  function validateScheduledCommand(command = {}, options = {}) {
    const routing = command?.payload?.routing;
    if (command?.type !== "start_activity" || command?.activityType !== "regional_travel" || routing?.mode !== CONFIG.routingMode) {
      return { valid: true, specialized: false };
    }
    const travelValidation = Travel.validateScheduledCommand(command);
    if (!travelValidation.valid) return { ...travelValidation, specialized: true };
    const graph = getGraph(routing.graphId);
    if (!graph) return { valid: false, specialized: true, reason: "graph_not_registered" };
    if (integer(routing.graphRevision, -1) !== graph.revision) return { valid: false, specialized: true, reason: "graph_revision_mismatch" };
    if (String(routing.graphFingerprint || "") !== graph.fingerprint) return { valid: false, specialized: true, reason: "graph_fingerprint_mismatch" };
    if (routing.routeMode !== CONFIG.routeMode) return { valid: false, specialized: true, reason: "unsupported_route_mode" };

    const route = travelValidation.plan.route;
    const result = findRoute(graph, {
      origin: route[0],
      destination: route[route.length - 1],
      transportId: travelValidation.plan.transportId,
      accessState: options.accessState || { bypassAccess: options.allowRestricted === true },
    });
    if (!result.valid) return { ...result, specialized: true };
    if (routeSignature(result.route) !== routeSignature(route)) return { valid: false, specialized: true, reason: "graph_route_mismatch" };
    if (segmentSignature(result.segments) !== segmentSignature(travelValidation.plan.segments)) return { valid: false, specialized: true, reason: "graph_segment_mismatch" };
    if ((routing.destinationEntrySide || null) !== (result.destinationEntrySide || null)) return { valid: false, specialized: true, reason: "entry_side_mismatch" };
    return { valid: true, specialized: true, plan: travelValidation.plan, routeResult: result, graph };
  }

  return Object.freeze({
    CONFIG,
    JURISDICTIONS,
    ENTRY_SIDES,
    DIRECTIONS,
    ROUTE_SURFACES,
    normalizeRequirements,
    normalizeAccessState,
    normalizeJurisdiction,
    normalizeNode,
    createGraph,
    registerGraph,
    unregisterGraph,
    clearRegistry,
    getGraph,
    listGraphs,
    canEnterNode,
    canUseEdge,
    segmentFromEdge,
    movementEntrySide,
    findRoute,
    routingMetadata,
    createTravelPlan,
    validateScheduledCommand,
  });
});
