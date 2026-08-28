(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttSpatialVision = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function layerOf(entity = {}) {
    if (Number.isFinite(Number(entity.zLayer))) return Number(entity.zLayer);
    if (Number.isFinite(Number(entity.gridPosition?.z))) return Number(entity.gridPosition.z);
    if (Array.isArray(entity.z) && entity.z.length) return Number(entity.z[0]) || 0;
    return 0;
  }

  function zLevelRecord(mapData = {}, zLayer) {
    const levels = mapData.zLevels || {};
    if (Array.isArray(levels)) return levels.find((entry) => Number(entry?.zLayer ?? entry?.z) === Number(zLayer)) || null;
    return levels[String(zLayer)] || levels[zLayer] || null;
  }

  function elevationForLayer(mapData = {}, zLayer) {
    const record = zLevelRecord(mapData, zLayer);
    if (record && Number.isFinite(Number(record.elevationFt))) return Number(record.elevationFt);
    const step = numberOr(mapData.defaultZStepFt, 10);
    return Number(zLayer || 0) * step;
  }

  function elevationFt(entity = {}, mapData = {}) {
    if (Number.isFinite(Number(entity.elevationFt))) return Number(entity.elevationFt);
    return elevationForLayer(mapData, layerOf(entity));
  }

  function feetPerPixel(mapData = {}) {
    const size = Math.max(1, numberOr(mapData.grid?.size, 70));
    const distancePerCell = Math.max(0.001, numberOr(mapData.grid?.distancePerCell, 5));
    return distancePerCell / size;
  }

  function horizontalDistanceFt(a = {}, b = {}, mapData = {}) {
    return Math.hypot(numberOr(b.x) - numberOr(a.x), numberOr(b.y) - numberOr(a.y)) * feetPerPixel(mapData);
  }

  function distance3dFt(a = {}, b = {}, mapData = {}) {
    const horizontal = horizontalDistanceFt(a, b, mapData);
    const vertical = elevationFt(b, mapData) - elevationFt(a, mapData);
    return Math.hypot(horizontal, vertical);
  }

  function horizontalRadiusPxForRange(rangeFt, viewer = {}, targetLayer, mapData = {}) {
    const range = Math.max(0, numberOr(rangeFt));
    const fromElevation = elevationFt(viewer, mapData);
    const toElevation = elevationForLayer(mapData, targetLayer);
    const vertical = Math.abs(toElevation - fromElevation);
    if (vertical >= range) return 0;
    const horizontalFt = Math.sqrt(Math.max(0, (range * range) - (vertical * vertical)));
    return horizontalFt / feetPerPixel(mapData);
  }

  function orientation(a, b, c) {
    return ((numberOr(b.y) - numberOr(a.y)) * (numberOr(c.x) - numberOr(b.x)))
      - ((numberOr(b.x) - numberOr(a.x)) * (numberOr(c.y) - numberOr(b.y)));
  }

  function onSegment(a, b, c) {
    return numberOr(b.x) <= Math.max(numberOr(a.x), numberOr(c.x)) + 1e-9
      && numberOr(b.x) + 1e-9 >= Math.min(numberOr(a.x), numberOr(c.x))
      && numberOr(b.y) <= Math.max(numberOr(a.y), numberOr(c.y)) + 1e-9
      && numberOr(b.y) + 1e-9 >= Math.min(numberOr(a.y), numberOr(c.y));
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
    if (Math.abs(o1) < 1e-9 && onSegment(a, c, b)) return true;
    if (Math.abs(o2) < 1e-9 && onSegment(a, d, b)) return true;
    if (Math.abs(o3) < 1e-9 && onSegment(c, a, d)) return true;
    if (Math.abs(o4) < 1e-9 && onSegment(c, b, d)) return true;
    return false;
  }

  function vertexToPoint(vertex = {}, mapData = {}) {
    const size = Math.max(1, numberOr(mapData.grid?.size, 70));
    return { x: numberOr(vertex.col) * size, y: numberOr(vertex.row) * size };
  }

  function portalLayers(portal = {}) {
    if (Array.isArray(portal.between) && portal.between.length >= 2) return portal.between.slice(0, 2).map(Number);
    return [Number(portal.fromZ ?? 0), Number(portal.toZ ?? 0)];
  }

  function portalConnects(portal = {}, fromZ, toZ) {
    const [a, b] = portalLayers(portal);
    return (a === Number(fromZ) && b === Number(toZ)) || (a === Number(toZ) && b === Number(fromZ));
  }

  function portalAllows(portal = {}, kind = 'vision') {
    if (portal.state === 'closed') return false;
    const flag = kind === 'light' ? 'blocksLight' : 'blocksVision';
    return portal[flag] !== true;
  }

  function rayCrossesPortal(fromPoint, targetPoint, portal = {}, mapData = {}) {
    const a = portal.a || portal.from;
    const b = portal.b || portal.to;
    if (!a || !b) return false;
    return segmentsIntersect(fromPoint, targetPoint, vertexToPoint(a, mapData), vertexToPoint(b, mapData));
  }

  function canTraverseLayers(viewer = {}, targetPoint = {}, targetLayer, mapData = {}, kind = 'vision') {
    const fromLayer = layerOf(viewer);
    const toLayer = Number(targetLayer);
    if (fromLayer === toLayer) return true;
    const portals = Array.isArray(mapData.verticalPortals) ? mapData.verticalPortals : [];
    return portals.some((portal) => portalConnects(portal, fromLayer, toLayer)
      && portalAllows(portal, kind)
      && rayCrossesPortal({ x: numberOr(viewer.x), y: numberOr(viewer.y) }, targetPoint, portal, mapData));
  }

  return Object.freeze({
    layerOf,
    zLevelRecord,
    elevationForLayer,
    elevationFt,
    feetPerPixel,
    horizontalDistanceFt,
    distance3dFt,
    horizontalRadiusPxForRange,
    segmentsIntersect,
    vertexToPoint,
    portalLayers,
    portalConnects,
    portalAllows,
    rayCrossesPortal,
    canTraverseLayers,
  });
});