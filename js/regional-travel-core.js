(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LuminousRegionalTravelCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const CONFIG = Object.freeze({
    schemaVersion: 1,
    hexDistanceKm: 20,
    maxRouteHexes: 256,
    maxMembers: 8,
    maxWaitSeconds: 86400,
    maxStopSeconds: 86400,
    maxDurationSeconds: 31 * 24 * 60 * 60,
  });

  const TRANSPORTS = Object.freeze({
    walking: Object.freeze({ id: "walking", speedKph: 4.8, surfaces: Object.freeze(["road", "dirt_road", "trail", "offroad", "rough"]) }),
    public_bus: Object.freeze({ id: "public_bus", speedKph: 30, surfaces: Object.freeze(["road", "dirt_road"]) }),
    private_bus: Object.freeze({ id: "private_bus", speedKph: 60, surfaces: Object.freeze(["road", "dirt_road", "rough"]) }),
    train: Object.freeze({ id: "train", speedKph: 80, surfaces: Object.freeze(["rail"]) }),
  });

  const TERRAIN_TIME = Object.freeze({ road: 1, plains: 1, forest: 1.5, hills: 1.5, swamp: 2, desert: 1.5, mountain: 2.5, deep_snow: 2 });
  const SURFACE_TIME = Object.freeze({ road: 1, dirt_road: 1.25, trail: 1.2, offroad: 1.5, rough: 1.6, rail: 1 });
  const SURFACE_TERRAIN_SENSITIVITY = Object.freeze({ road: 0.2, dirt_road: 0.55, trail: 0.8, offroad: 1, rough: 1, rail: 0 });

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Math.trunc(finite(value, fallback));
  const safeKey = (value, fallback = "") => String(value ?? fallback).trim().replace(/[.#$\[\]\/]/g, "_").replace(/\s+/g, "_").slice(0, 120) || fallback;
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(finite(value, min))));

  function normalizeMembers(value) {
    const out = [], seen = new Set();
    for (const raw of Array.isArray(value) ? value : []) {
      const id = safeKey(raw);
      if (!id || seen.has(id)) continue;
      seen.add(id); out.push(id);
      if (out.length >= CONFIG.maxMembers) break;
    }
    return out;
  }

  function normalizeHex(raw = {}) {
    return Object.freeze({ district: safeKey(raw.district ?? raw.regionId ?? raw.region, "region"), q: integer(raw.q ?? raw.col ?? raw.x, 0), r: integer(raw.r ?? raw.row ?? raw.y, 0) });
  }

  function hexKey(raw = {}) { const h = normalizeHex(raw); return `${h.district}:${h.q},${h.r}`; }
  function axialDistance(aRaw, bRaw) {
    const a = normalizeHex(aRaw), b = normalizeHex(bRaw);
    if (a.district !== b.district) return Infinity;
    const dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  function areAdjacent(a, b) { return axialDistance(a, b) === 1; }

  function normalizeTransport(id) { const key = safeKey(id, "walking").toLowerCase(); return TRANSPORTS[key] || null; }
  function normalizeTerrain(value) { const key = safeKey(value, "plains").toLowerCase(); return TERRAIN_TIME[key] ? key : "plains"; }
  function normalizeSurface(value) { const key = safeKey(value, "offroad").toLowerCase(); return SURFACE_TIME[key] ? key : "offroad"; }

  function segmentMultiplier(segment = {}) {
    const terrain = normalizeTerrain(segment.terrain), surface = normalizeSurface(segment.surface);
    const terrainBase = TERRAIN_TIME[terrain], sensitivity = SURFACE_TERRAIN_SENSITIVITY[surface];
    const terrainEffective = 1 + (terrainBase - 1) * sensitivity;
    const quality = Math.max(1, Math.min(3, finite(segment.routeQualityMultiplier, 1)));
    const weather = Math.max(1, Math.min(3, finite(segment.weatherMultiplier, 1)));
    return SURFACE_TIME[surface] * terrainEffective * quality * weather;
  }

  function normalizeRoute(route) {
    if (!Array.isArray(route) || route.length < 2 || route.length > CONFIG.maxRouteHexes) return null;
    return route.map(normalizeHex);
  }

  function normalizeSegments(route, rawSegments) {
    const segments = [], input = Array.isArray(rawSegments) ? rawSegments : [];
    for (let i = 0; i < route.length - 1; i += 1) {
      if (!areAdjacent(route[i], route[i + 1])) return null;
      const raw = input[i] || {};
      segments.push(Object.freeze({
        from: hexKey(route[i]), to: hexKey(route[i + 1]), distanceKm: CONFIG.hexDistanceKm,
        surface: normalizeSurface(raw.surface), terrain: normalizeTerrain(raw.terrain),
        routeQualityMultiplier: Math.max(1, Math.min(3, finite(raw.routeQualityMultiplier, 1))),
        weatherMultiplier: Math.max(1, Math.min(3, finite(raw.weatherMultiplier, 1))),
      }));
    }
    return segments;
  }

  function validateCapabilities(transport, segments) {
    if (!transport) return { valid: false, reason: "unknown_transport" };
    for (const segment of segments || []) if (!transport.surfaces.includes(segment.surface)) return { valid: false, reason: "surface_not_supported", surface: segment.surface };
    return { valid: true };
  }
  function segmentDurationSeconds(segment, transport) {
    const rawSeconds = (segment.distanceKm / transport.speedKph) * 3600 * segmentMultiplier(segment);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(rawSeconds)) * 8;
    return Math.ceil(rawSeconds - tolerance);
  }

  function createTravelPlan(input = {}) {
    const groupId = safeKey(input.groupId ?? input.activityGroupId), memberIds = normalizeMembers(input.memberIds), route = normalizeRoute(input.route), transport = normalizeTransport(input.transportId ?? input.transport);
    if (!groupId) return { valid: false, reason: "invalid_group" };
    if (!memberIds.length) return { valid: false, reason: "invalid_members" };
    if (!route) return { valid: false, reason: "invalid_route" };
    if (!transport) return { valid: false, reason: "unknown_transport" };
    const segments = normalizeSegments(route, input.segments);
    if (!segments) return { valid: false, reason: "invalid_route_hop" };
    const capability = validateCapabilities(transport, segments);
    if (!capability.valid) return capability;
    const waitSeconds = clampInt(input.waitSeconds, 0, CONFIG.maxWaitSeconds), stopSeconds = clampInt(input.stopSeconds, 0, CONFIG.maxStopSeconds);
    const travelSeconds = segments.reduce((sum, segment) => sum + segmentDurationSeconds(segment, transport), 0), durationSeconds = travelSeconds + waitSeconds + stopSeconds;
    if (!(durationSeconds > 0) || durationSeconds > CONFIG.maxDurationSeconds) return { valid: false, reason: "duration_out_of_bounds" };
    const distanceKm = segments.length * CONFIG.hexDistanceKm;
    const plan = Object.freeze({
      schemaVersion: CONFIG.schemaVersion, groupId, memberIds: Object.freeze(memberIds), worldId: safeKey(input.worldId, "luminous"),
      originHex: hexKey(route[0]), destinationHex: hexKey(route[route.length - 1]),
      route: Object.freeze(route.map((h) => Object.freeze({ district: h.district, q: h.q, r: h.r }))), segments: Object.freeze(segments),
      transportId: transport.id, distanceKm, waitSeconds, stopSeconds, travelSeconds, durationSeconds,
    });
    return { valid: true, plan };
  }

  function toSchedulerCommand(planOrResult, commandId) {
    const plan = planOrResult?.plan || planOrResult;
    if (!plan || plan.schemaVersion !== CONFIG.schemaVersion) throw new Error("VALID_TRAVEL_PLAN_REQUIRED");
    return {
      commandId: safeKey(commandId || `regional_travel_${plan.groupId}_${plan.destinationHex}`), type: "start_activity", groupId: plan.groupId,
      memberIds: [...plan.memberIds], durationSeconds: plan.durationSeconds, activityType: "regional_travel",
      payload: {
        schemaVersion: plan.schemaVersion, worldId: plan.worldId, route: clone(plan.route),
        segments: clone(plan.segments).map(({ from, to, distanceKm, ...segment }) => segment),
        transportId: plan.transportId, waitSeconds: plan.waitSeconds, stopSeconds: plan.stopSeconds,
        originHex: plan.originHex, destinationHex: plan.destinationHex, distanceKm: plan.distanceKm,
      }, priority: 40,
    };
  }

  function validateScheduledCommand(command = {}) {
    if (command.type !== "start_activity" || command.activityType !== "regional_travel") return { valid: true, specialized: false };
    const payload = command.payload && typeof command.payload === "object" ? command.payload : {};
    const result = createTravelPlan({ ...payload, groupId: command.groupId, memberIds: command.memberIds });
    if (!result.valid) return { ...result, specialized: true };
    if (integer(command.durationSeconds, -1) !== result.plan.durationSeconds) return { valid: false, specialized: true, reason: "duration_mismatch", expectedDurationSeconds: result.plan.durationSeconds };
    if (payload.originHex && payload.originHex !== result.plan.originHex) return { valid: false, specialized: true, reason: "origin_mismatch" };
    if (payload.destinationHex && payload.destinationHex !== result.plan.destinationHex) return { valid: false, specialized: true, reason: "destination_mismatch" };
    if (finite(payload.distanceKm, result.plan.distanceKm) !== result.plan.distanceKm) return { valid: false, specialized: true, reason: "distance_mismatch" };
    return { valid: true, specialized: true, plan: result.plan };
  }

  function destinationWorldPosition(plan, arrivalId, arrivedAtWorldTs) {
    const destination = normalizeHex(plan?.route?.[plan.route.length - 1] || {});
    return {
      schemaVersion: 1, worldId: safeKey(plan?.worldId, "luminous"), regionId: destination.district, zoneId: `regional_${destination.q}_${destination.r}`,
      chunkCol: 0, chunkRow: 0, x: 0, y: 0, zLayer: 0, elevationFt: 0,
      regionalHex: { district: destination.district, q: destination.q, r: destination.r }, travelArrivalId: safeKey(arrivalId), arrivedAtWorldTs: finite(arrivedAtWorldTs, 0),
    };
  }

  return Object.freeze({
    CONFIG, TRANSPORTS, TERRAIN_TIME, SURFACE_TIME, normalizeMembers, normalizeHex, hexKey, axialDistance, areAdjacent,
    normalizeTransport, normalizeTerrain, normalizeSurface, segmentMultiplier, normalizeRoute, normalizeSegments, validateCapabilities,
    segmentDurationSeconds, createTravelPlan, toSchedulerCommand, validateScheduledCommand, destinationWorldPosition,
  });
});
