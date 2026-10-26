(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LuminousGlobalMapCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const CONFIG = Object.freeze({
    schemaVersion: 1,
    defaultWorldId: "luminous",
    defaultWidthKm: 5500,
    defaultHeightKm: 4000,
    regionalHexDistanceKm: 20,
    maxRegions: 512,
    maxRegionVertices: 512,
    maxMarkers: 4096,
    maxRoutes: 4096,
    maxRoutePoints: 1024,
  });

  const REGION_LAYERS = Object.freeze(["district", "jurisdiction", "terrain", "water", "special"]);
  const JURISDICTIONS = Object.freeze(["nest", "backstreets", "outskirts"]);
  const SOURCE_PRIORITY = Object.freeze({ procedural: 0, campaign: 1, dm: 2, canon: 3 });
  const MARKER_TYPES = Object.freeze(["nest", "city", "town", "villa", "industrial", "poi", "checkpoint"]);
  const ROUTE_TYPES = Object.freeze(["road", "dirt_road", "trail", "rail", "waterway"]);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Math.trunc(finite(value, fallback));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
  const clean = (value, fallback = "") => String(value ?? fallback).trim() || fallback;
  const safeKey = (value, fallback = "") => clean(value, fallback).replace(/[.#$\[\]\/]/g, "_").replace(/\s+/g, "_").slice(0, 120) || fallback;
  const enumValue = (value, allowed, fallback) => allowed.includes(clean(value).toLowerCase()) ? clean(value).toLowerCase() : fallback;

  function normalizeBounds(raw = {}) {
    const widthKm = clamp(raw.widthKm ?? raw.width, 100, 20000);
    const heightKm = clamp(raw.heightKm ?? raw.height, 100, 20000);
    return Object.freeze({
      minXKm: finite(raw.minXKm, 0),
      minYKm: finite(raw.minYKm, 0),
      widthKm: widthKm || CONFIG.defaultWidthKm,
      heightKm: heightKm || CONFIG.defaultHeightKm,
    });
  }

  function defaultBounds() {
    return normalizeBounds({ widthKm: CONFIG.defaultWidthKm, heightKm: CONFIG.defaultHeightKm });
  }

  function normalizePoint(raw = {}, bounds = defaultBounds()) {
    const maxX = bounds.minXKm + bounds.widthKm;
    const maxY = bounds.minYKm + bounds.heightKm;
    return Object.freeze({
      xKm: clamp(raw.xKm ?? raw.x, bounds.minXKm, maxX),
      yKm: clamp(raw.yKm ?? raw.y, bounds.minYKm, maxY),
    });
  }

  function normalizePointList(raw, bounds, maxPoints) {
    const source = Array.isArray(raw) ? raw : [];
    if (source.length > maxPoints) throw new Error("GLOBAL_MAP_POINT_LIMIT");
    return Object.freeze(source.map((point) => normalizePoint(point, bounds)));
  }

  function polygonArea(points = []) {
    let sum = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index], b = points[(index + 1) % points.length];
      sum += a.xKm * b.yKm - b.xKm * a.yKm;
    }
    return Math.abs(sum) / 2;
  }

  function pointInPolygon(point, polygon = []) {
    if (!point || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      const intersects = ((a.yKm > point.yKm) !== (b.yKm > point.yKm))
        && point.xKm < ((b.xKm - a.xKm) * (point.yKm - a.yKm)) / ((b.yKm - a.yKm) || Number.EPSILON) + a.xKm;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function boundsForPoints(points = []) {
    if (!points.length) return null;
    let minXKm = Infinity, minYKm = Infinity, maxXKm = -Infinity, maxYKm = -Infinity;
    for (const point of points) {
      minXKm = Math.min(minXKm, point.xKm);
      minYKm = Math.min(minYKm, point.yKm);
      maxXKm = Math.max(maxXKm, point.xKm);
      maxYKm = Math.max(maxYKm, point.yKm);
    }
    return Object.freeze({ minXKm, minYKm, maxXKm, maxYKm });
  }

  function boxesOverlap(a, b) {
    return !!a && !!b && a.minXKm <= b.maxXKm && a.maxXKm >= b.minXKm && a.minYKm <= b.maxYKm && a.maxYKm >= b.minYKm;
  }

  function normalizeRegionalOrigin(raw, bounds) {
    if (!raw || typeof raw !== "object") return null;
    const point = normalizePoint(raw, bounds);
    return Object.freeze({
      xKm: point.xKm,
      yKm: point.yKm,
      q: integer(raw.q, 0),
      r: integer(raw.r, 0),
      hexDistanceKm: clamp(raw.hexDistanceKm, 1, 100) || CONFIG.regionalHexDistanceKm,
      rotationDeg: finite(raw.rotationDeg, 0),
    });
  }

  function normalizeRegion(raw = {}, bounds = defaultBounds(), index = 0) {
    const polygon = normalizePointList(raw.polygon ?? raw.points, bounds, CONFIG.maxRegionVertices);
    if (polygon.length < 3) throw new Error("GLOBAL_MAP_REGION_POLYGON_REQUIRED");
    const source = enumValue(raw.source ?? raw.sourceTier, Object.keys(SOURCE_PRIORITY), "campaign");
    const layer = enumValue(raw.layer, REGION_LAYERS, "terrain");
    const jurisdiction = raw.jurisdiction == null ? null : enumValue(raw.jurisdiction, JURISDICTIONS, "outskirts");
    const id = safeKey(raw.id, `region_${index + 1}`);
    return Object.freeze({
      id,
      name: clean(raw.name, id).slice(0, 120),
      layer,
      districtId: safeKey(raw.districtId ?? raw.district_id),
      jurisdiction,
      terrain: safeKey(raw.terrain ?? raw.biome, "unknown").toLowerCase(),
      source,
      locked: raw.locked === true || source === "canon",
      visibleToPlayers: raw.visibleToPlayers !== false,
      polygon,
      bounds: boundsForPoints(polygon),
      areaKm2: polygonArea(polygon),
      regionalOrigin: normalizeRegionalOrigin(raw.regionalOrigin, bounds),
      metadata: raw.metadata && typeof raw.metadata === "object" ? Object.freeze(clone(raw.metadata)) : null,
    });
  }

  function normalizeMarker(raw = {}, bounds = defaultBounds(), index = 0) {
    const point = normalizePoint(raw, bounds);
    const id = safeKey(raw.id, `marker_${index + 1}`);
    return Object.freeze({
      id,
      type: enumValue(raw.type, MARKER_TYPES, "poi"),
      name: clean(raw.name, id).slice(0, 120),
      xKm: point.xKm,
      yKm: point.yKm,
      districtId: safeKey(raw.districtId ?? raw.district_id),
      visibleToPlayers: raw.visibleToPlayers !== false,
      locked: raw.locked === true,
      metadata: raw.metadata && typeof raw.metadata === "object" ? Object.freeze(clone(raw.metadata)) : null,
    });
  }

  function normalizeRoute(raw = {}, bounds = defaultBounds(), index = 0) {
    const points = normalizePointList(raw.points, bounds, CONFIG.maxRoutePoints);
    if (points.length < 2) throw new Error("GLOBAL_MAP_ROUTE_POINTS_REQUIRED");
    const id = safeKey(raw.id, `route_${index + 1}`);
    return Object.freeze({
      id,
      type: enumValue(raw.type ?? raw.surface, ROUTE_TYPES, "road"),
      name: clean(raw.name, id).slice(0, 120),
      districtId: safeKey(raw.districtId ?? raw.district_id),
      visibleToPlayers: raw.visibleToPlayers !== false,
      locked: raw.locked === true,
      points,
      bounds: boundsForPoints(points),
      metadata: raw.metadata && typeof raw.metadata === "object" ? Object.freeze(clone(raw.metadata)) : null,
    });
  }

  function recordValues(raw) {
    if (Array.isArray(raw)) return raw;
    return raw && typeof raw === "object" ? Object.values(raw) : [];
  }

  function normalizeDocument(raw = {}) {
    const bounds = normalizeBounds(raw.bounds || {});
    const regionRaw = recordValues(raw.regions);
    const markerRaw = recordValues(raw.markers);
    const routeRaw = recordValues(raw.routes);
    if (regionRaw.length > CONFIG.maxRegions) throw new Error("GLOBAL_MAP_REGION_LIMIT");
    if (markerRaw.length > CONFIG.maxMarkers) throw new Error("GLOBAL_MAP_MARKER_LIMIT");
    if (routeRaw.length > CONFIG.maxRoutes) throw new Error("GLOBAL_MAP_ROUTE_LIMIT");

    const regions = regionRaw.map((item, index) => normalizeRegion(item, bounds, index));
    const markers = markerRaw.map((item, index) => normalizeMarker(item, bounds, index));
    const routes = routeRaw.map((item, index) => normalizeRoute(item, bounds, index));
    return Object.freeze({
      schemaVersion: CONFIG.schemaVersion,
      worldId: safeKey(raw.worldId, CONFIG.defaultWorldId),
      seed: clean(raw.seed, "0").slice(0, 120),
      generatorVersion: clean(raw.generatorVersion, "manual_v1").slice(0, 80),
      revision: Math.max(1, integer(raw.revision, 1)),
      updatedAtWorldTs: Math.max(0, finite(raw.updatedAtWorldTs, 0)),
      bounds,
      regions: Object.freeze(regions),
      markers: Object.freeze(markers),
      routes: Object.freeze(routes),
    });
  }

  function blankDocument(input = {}) {
    return normalizeDocument({
      worldId: input.worldId || CONFIG.defaultWorldId,
      seed: input.seed || "0",
      generatorVersion: input.generatorVersion || "manual_v1",
      revision: 1,
      bounds: input.bounds || { widthKm: CONFIG.defaultWidthKm, heightKm: CONFIG.defaultHeightKm },
      regions: [], markers: [], routes: [],
    });
  }

  function toRecord(list = []) {
    const out = {};
    for (const item of list) out[item.id] = clone(item);
    return out;
  }

  function serialize(docRaw = {}) {
    const doc = normalizeDocument(docRaw);
    const stripDerived = (item) => {
      const next = clone(item);
      delete next.bounds;
      delete next.areaKm2;
      return next;
    };
    return {
      schemaVersion: CONFIG.schemaVersion,
      worldId: doc.worldId,
      seed: doc.seed,
      generatorVersion: doc.generatorVersion,
      revision: doc.revision,
      updatedAtWorldTs: doc.updatedAtWorldTs,
      bounds: clone(doc.bounds),
      regions: Object.fromEntries(doc.regions.map((item) => [item.id, stripDerived(item)])),
      markers: toRecord(doc.markers),
      routes: Object.fromEntries(doc.routes.map((item) => [item.id, stripDerived(item)])),
    };
  }

  function mutate(docRaw, collection, value, options = {}) {
    const doc = normalizeDocument(docRaw);
    const key = collection === "regions" ? "regions" : collection === "markers" ? "markers" : collection === "routes" ? "routes" : null;
    if (!key) throw new Error("GLOBAL_MAP_COLLECTION_INVALID");
    const current = doc[key];
    const bounds = doc.bounds;
    const normalizer = key === "regions" ? normalizeRegion : key === "markers" ? normalizeMarker : normalizeRoute;
    const item = normalizer(value, bounds, current.length);
    const existing = current.find((entry) => entry.id === item.id);
    if (existing?.locked && options.force !== true) throw new Error("GLOBAL_MAP_ITEM_LOCKED");
    const nextList = current.filter((entry) => entry.id !== item.id).concat(item);
    return normalizeDocument({ ...serialize(doc), [key]: nextList, revision: doc.revision + 1 });
  }

  function remove(docRaw, collection, idRaw, options = {}) {
    const doc = normalizeDocument(docRaw);
    const key = collection === "regions" ? "regions" : collection === "markers" ? "markers" : collection === "routes" ? "routes" : null;
    if (!key) throw new Error("GLOBAL_MAP_COLLECTION_INVALID");
    const id = safeKey(idRaw);
    const existing = doc[key].find((entry) => entry.id === id);
    if (!existing) return doc;
    if (existing.locked && options.force !== true) throw new Error("GLOBAL_MAP_ITEM_LOCKED");
    return normalizeDocument({ ...serialize(doc), [key]: doc[key].filter((entry) => entry.id !== id), revision: doc.revision + 1 });
  }

  function visibleDocument(docRaw, isDm = false) {
    const doc = normalizeDocument(docRaw);
    if (isDm) return doc;
    return normalizeDocument({
      ...serialize(doc),
      regions: doc.regions.filter((item) => item.visibleToPlayers),
      markers: doc.markers.filter((item) => item.visibleToPlayers),
      routes: doc.routes.filter((item) => item.visibleToPlayers),
    });
  }

  function sourceRank(region) {
    return SOURCE_PRIORITY[region?.source] ?? 0;
  }

  function effectiveRegionAt(docRaw, pointRaw, layer = null, isDm = false) {
    const doc = visibleDocument(docRaw, isDm);
    const point = normalizePoint(pointRaw, doc.bounds);
    const candidates = doc.regions.filter((region) => (!layer || region.layer === layer) && pointInPolygon(point, region.polygon));
    candidates.sort((a, b) => sourceRank(b) - sourceRank(a) || a.areaKm2 - b.areaKm2 || a.id.localeCompare(b.id));
    return candidates[0] || null;
  }

  function viewportWorldBounds(camera = {}, viewport = {}) {
    const zoom = Math.max(0.0001, finite(camera.zoom, 1));
    const width = Math.max(1, finite(viewport.width, 1)) / zoom;
    const height = Math.max(1, finite(viewport.height, 1)) / zoom;
    return Object.freeze({
      minXKm: finite(camera.xKm, 0),
      minYKm: finite(camera.yKm, 0),
      maxXKm: finite(camera.xKm, 0) + width,
      maxYKm: finite(camera.yKm, 0) + height,
    });
  }

  function cull(docRaw, camera, viewport, isDm = false) {
    const doc = visibleDocument(docRaw, isDm);
    const box = viewportWorldBounds(camera, viewport);
    return Object.freeze({
      regions: Object.freeze(doc.regions.filter((item) => boxesOverlap(item.bounds, box))),
      routes: Object.freeze(doc.routes.filter((item) => boxesOverlap(item.bounds, box))),
      markers: Object.freeze(doc.markers.filter((item) => item.xKm >= box.minXKm && item.xKm <= box.maxXKm && item.yKm >= box.minYKm && item.yKm <= box.maxYKm)),
      bounds: box,
    });
  }

  function axialOffsetKm(qRaw, rRaw, hexDistanceKm = CONFIG.regionalHexDistanceKm) {
    const q = integer(qRaw, 0), r = integer(rRaw, 0), distance = Math.max(1, finite(hexDistanceKm, CONFIG.regionalHexDistanceKm));
    return Object.freeze({ xKm: distance * (q + r / 2), yKm: distance * (Math.sqrt(3) / 2) * r });
  }

  function regionalHexToGlobal(regionRaw, hexRaw = {}) {
    const origin = regionRaw?.regionalOrigin;
    if (!origin) return null;
    const delta = axialOffsetKm(integer(hexRaw.q, 0) - origin.q, integer(hexRaw.r, 0) - origin.r, origin.hexDistanceKm);
    const radians = finite(origin.rotationDeg, 0) * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    return Object.freeze({
      xKm: origin.xKm + delta.xKm * cos - delta.yKm * sin,
      yKm: origin.yKm + delta.xKm * sin + delta.yKm * cos,
    });
  }

  function playerGlobalPosition(docRaw, worldPosition = {}, isDm = false) {
    const doc = visibleDocument(docRaw, isDm);
    const regionalHex = worldPosition.regionalHex || worldPosition.hex || {};
    const districtId = safeKey(regionalHex.district ?? worldPosition.district_id ?? worldPosition.regionId);
    if (!districtId) return null;
    const district = doc.regions.find((region) => region.layer === "district" && region.districtId === districtId && region.regionalOrigin)
      || doc.regions.find((region) => region.layer === "district" && region.id === districtId && region.regionalOrigin);
    if (!district) return null;
    const point = regionalHexToGlobal(district, regionalHex);
    return point ? Object.freeze({ ...point, districtId, regionId: district.id }) : null;
  }

  return Object.freeze({
    CONFIG,
    REGION_LAYERS,
    JURISDICTIONS,
    SOURCE_PRIORITY,
    MARKER_TYPES,
    ROUTE_TYPES,
    normalizeBounds,
    normalizePoint,
    polygonArea,
    pointInPolygon,
    boundsForPoints,
    boxesOverlap,
    normalizeRegion,
    normalizeMarker,
    normalizeRoute,
    normalizeDocument,
    blankDocument,
    serialize,
    upsertRegion: (doc, value, options) => mutate(doc, "regions", value, options),
    upsertMarker: (doc, value, options) => mutate(doc, "markers", value, options),
    upsertRoute: (doc, value, options) => mutate(doc, "routes", value, options),
    removeRegion: (doc, id, options) => remove(doc, "regions", id, options),
    removeMarker: (doc, id, options) => remove(doc, "markers", id, options),
    removeRoute: (doc, id, options) => remove(doc, "routes", id, options),
    visibleDocument,
    effectiveRegionAt,
    viewportWorldBounds,
    cull,
    axialOffsetKm,
    regionalHexToGlobal,
    playerGlobalPosition,
  });
});
