(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttPovEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const DEFAULT_EYE_HEIGHT_FT = 5;
  const DEFAULT_CEILING_HEIGHT_FT = 10;
  const LOOK_UP_INTERIOR_DEPTH_FT = 5;
  const EPSILON = 1e-9;

  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, num(value, min)));

  function lightingRuntime() {
    if (browserRoot?.LuminousVttLightingEngine) return browserRoot.LuminousVttLightingEngine;
    if (typeof require !== 'undefined') {
      try { return require('./lighting-engine.js'); } catch (_) {}
    }
    return null;
  }

  function topologyRuntime() {
    if (browserRoot?.LuminousVttTopology) return browserRoot.LuminousVttTopology;
    if (typeof require !== 'undefined') {
      try { return require('./topology.js'); } catch (_) {}
    }
    return null;
  }

  function normalizeAngleDeg(value) {
    const lighting = lightingRuntime();
    if (lighting?.normalizeAngleDeg) return lighting.normalizeAngleDeg(value);
    const angle = num(value, 0) % 360;
    return angle < 0 ? angle + 360 : angle;
  }

  function angleToPointDeg(origin = {}, point = {}) {
    const lighting = lightingRuntime();
    if (lighting?.angleToPointDeg) return lighting.angleToPointDeg(origin, point);
    return normalizeAngleDeg((Math.atan2(num(point.y) - num(origin.y), num(point.x) - num(origin.x)) * 180) / Math.PI);
  }

  function layerOf(entity = {}) {
    const lighting = lightingRuntime();
    if (lighting?.layerOf) return lighting.layerOf(entity);
    if (Number.isFinite(Number(entity.zLayer))) return Number(entity.zLayer);
    if (Number.isFinite(Number(entity.gridPosition?.z))) return Number(entity.gridPosition.z);
    if (Array.isArray(entity.z) && entity.z.length) return Number(entity.z[0]) || 0;
    return 0;
  }

  function elevationForLayer(mapData = {}, zLayer = 0) {
    const lighting = lightingRuntime();
    if (lighting?.elevationForLayer) return lighting.elevationForLayer(mapData, zLayer);
    const record = mapData.zLevels?.[String(zLayer)] || mapData.zLevels?.[zLayer];
    if (Number.isFinite(Number(record?.elevationFt))) return Number(record.elevationFt);
    return Number(zLayer) * num(mapData.defaultZStepFt, 15);
  }

  function feetToPixels(feet, mapData = {}) {
    const lighting = lightingRuntime();
    if (lighting?.feetToPixels) return lighting.feetToPixels(feet, mapData);
    const size = Math.max(1, num(mapData.grid?.size, 70));
    const distancePerCell = Math.max(0.001, num(mapData.grid?.distancePerCell, 5));
    return (Math.max(0, num(feet)) / distancePerCell) * size;
  }

  function eyeHeightFt(viewer = {}) {
    return Math.max(0, num(viewer.eyeHeightFt, DEFAULT_EYE_HEIGHT_FT));
  }

  function eyePoint(viewer = {}, mapData = {}) {
    const lighting = lightingRuntime();
    const base = lighting?.elevationFt ? lighting.elevationFt(viewer, mapData) : num(viewer.elevationFt, elevationForLayer(mapData, layerOf(viewer)));
    return {
      x: num(viewer.x),
      y: num(viewer.y),
      zLayer: layerOf(viewer),
      elevationFt: base + eyeHeightFt(viewer),
    };
  }

  function normalizeRect(raw = {}) {
    const x1 = Math.min(num(raw.x1 ?? raw.x), num(raw.x2 ?? raw.x) + Math.max(0, num(raw.width)));
    const x2 = Math.max(num(raw.x1 ?? raw.x), num(raw.x2 ?? raw.x) + Math.max(0, num(raw.width)));
    const y1 = Math.min(num(raw.y1 ?? raw.y), num(raw.y2 ?? raw.y) + Math.max(0, num(raw.height)));
    const y2 = Math.max(num(raw.y1 ?? raw.y), num(raw.y2 ?? raw.y) + Math.max(0, num(raw.height)));
    return { x1, y1, x2, y2 };
  }

  function pointInRect(point = {}, rect = {}, tolerance = 0) {
    const r = normalizeRect(rect);
    return num(point.x) >= r.x1 - tolerance && num(point.x) <= r.x2 + tolerance
      && num(point.y) >= r.y1 - tolerance && num(point.y) <= r.y2 + tolerance;
  }

  function ceilingHeightFt(raw = {}, mapData = {}) {
    return Math.max(0.1, num(raw.ceilingHeightFt ?? raw.roof?.ceilingHeightFt ?? mapData.defaultCeilingHeightFt, DEFAULT_CEILING_HEIGHT_FT));
  }

  function normalizeRoof(raw = {}, mapData = {}) {
    const rect = normalizeRect(raw);
    const zLayer = Number.isFinite(Number(raw.zLayer)) ? Number(raw.zLayer) : 0;
    const baseElevation = elevationForLayer(mapData, zLayer);
    const elevationFt = Number.isFinite(Number(raw.elevationFt))
      ? Number(raw.elevationFt)
      : baseElevation + ceilingHeightFt(raw, mapData);
    return {
      ...raw,
      id: clean(raw.id || 'roof'),
      zLayer,
      x1: rect.x1,
      y1: rect.y1,
      x2: rect.x2,
      y2: rect.y2,
      elevationFt,
      transparent: raw.transparent === true,
    };
  }

  function roofsForScene(scene = {}, mapData = {}) {
    const result = [];
    for (const raw of Array.isArray(scene.roofs) ? scene.roofs : []) result.push(normalizeRoof(raw, mapData));
    for (const interior of Array.isArray(scene.interiors) ? scene.interiors : []) {
      if (interior?.roof?.present === false || interior?.roof == null) continue;
      const rect = normalizeRect(interior);
      result.push(normalizeRoof({
        id: `${clean(interior.id || 'interior')}:roof`,
        zLayer: Number.isFinite(Number(interior.zLayer)) ? Number(interior.zLayer) : 0,
        x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2,
        elevationFt: interior.roof?.elevationFt,
        ceilingHeightFt: interior.roof?.ceilingHeightFt ?? interior.ceilingHeightFt,
        transparent: interior.roof?.transparent === true,
        sourceInteriorId: clean(interior.id),
      }, mapData));
    }
    return result;
  }

  function rayPlaneIntersection(from = {}, to = {}, planeElevationFt = 0) {
    const z0 = num(from.elevationFt);
    const z1 = num(to.elevationFt);
    const dz = z1 - z0;
    if (Math.abs(dz) <= EPSILON) return null;
    const t = (num(planeElevationFt) - z0) / dz;
    if (t <= EPSILON || t >= 1 - EPSILON) return null;
    return {
      t,
      x: num(from.x) + ((num(to.x) - num(from.x)) * t),
      y: num(from.y) + ((num(to.y) - num(from.y)) * t),
      elevationFt: num(planeElevationFt),
    };
  }

  function roofOcclusion(viewer = {}, target = {}, scene = {}, mapData = {}) {
    const from = eyePoint(viewer, mapData);
    const targetElevation = Number.isFinite(Number(target.elevationFt)) ? Number(target.elevationFt) : elevationForLayer(mapData, layerOf(target));
    const to = { x: num(target.x), y: num(target.y), zLayer: layerOf(target), elevationFt: targetElevation };
    if (to.elevationFt <= from.elevationFt + EPSILON) return { blocked: false, roof: null, intersection: null };
    for (const roof of roofsForScene(scene, mapData)) {
      if (roof.transparent) continue;
      const hit = rayPlaneIntersection(from, to, roof.elevationFt);
      if (!hit) continue;
      if (pointInRect(hit, roof, EPSILON)) return { blocked: true, roof, intersection: hit };
    }
    return { blocked: false, roof: null, intersection: null };
  }

  function projectedShadowWidthFt(roofWidthFt, eyeToRoofFt, eyeToTargetFt) {
    const width = Math.max(0, num(roofWidthFt));
    const near = Math.max(EPSILON, num(eyeToRoofFt));
    const far = Math.max(0, num(eyeToTargetFt));
    return width * (far / near);
  }

  function segmentDistancePx(point = {}, segment = {}) {
    const px = num(point.x), py = num(point.y), ax = num(segment.x1), ay = num(segment.y1), bx = num(segment.x2), by = num(segment.y2);
    const dx = bx - ax, dy = by - ay;
    const len2 = (dx * dx) + (dy * dy);
    if (len2 <= EPSILON) return Math.hypot(px - ax, py - ay);
    const t = clamp((((px - ax) * dx) + ((py - ay) * dy)) / len2, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function boundaryCandidates(point = {}, interior = {}) {
    const rect = normalizeRect(interior);
    return [
      { side: 'left', distance: Math.abs(num(point.x) - rect.x1), point: { x: rect.x1, y: clamp(point.y, rect.y1, rect.y2) } },
      { side: 'right', distance: Math.abs(rect.x2 - num(point.x)), point: { x: rect.x2, y: clamp(point.y, rect.y1, rect.y2) } },
      { side: 'top', distance: Math.abs(num(point.y) - rect.y1), point: { x: clamp(point.x, rect.x1, rect.x2), y: rect.y1 } },
      { side: 'bottom', distance: Math.abs(rect.y2 - num(point.y)), point: { x: clamp(point.x, rect.x1, rect.x2), y: rect.y2 } },
    ].sort((a, b) => a.distance - b.distance);
  }

  function blockingSegmentsForLayer(mapData = {}, zLayer = 0) {
    const lighting = lightingRuntime();
    if (lighting?.blockersForLayer) return lighting.blockersForLayer(mapData, zLayer);

    const result = [];
    const topology = topologyRuntime();
    if (topology) {
      for (const raw of Array.isArray(mapData.topology) ? mapData.topology : []) {
        const element = topology.normalizeElement(raw);
        if (!topology.elementOnLayer(element, zLayer)) continue;
        if (!topology.effectiveFlags(element).blocksVision) continue;
        result.push(topology.segment(element, mapData.grid));
      }
    }
    for (const wall of Array.isArray(mapData.walls) ? mapData.walls : []) {
      const onLayer = Array.isArray(wall.z)
        ? wall.z.map(Number).includes(Number(zLayer))
        : Number(wall.z ?? wall.zLayer ?? 0) === Number(zLayer);
      if (!onLayer || wall.blocksVision === false) continue;
      result.push({ x1: num(wall.x1), y1: num(wall.y1), x2: num(wall.x2), y2: num(wall.y2), blocksVision: true });
    }
    return result;
  }

  function boundaryIsOpen(boundaryPoint = {}, zLayer = 0, mapData = {}) {
    const tolerance = Math.max(3, num(mapData.grid?.size, 70) * 0.12);
    return !blockingSegmentsForLayer(mapData, zLayer)
      .some((segment) => segmentDistancePx(boundaryPoint, segment) <= tolerance);
  }

  function nearVisualOpening(point = {}, interior = {}, mapData = {}, depthFt = LOOK_UP_INTERIOR_DEPTH_FT) {
    const lighting = lightingRuntime();
    const maxPx = feetToPixels(depthFt, mapData);
    if (lighting?.openingSegments) {
      const explicit = lighting.openingSegments(mapData, Number(interior.zLayer ?? layerOf(point))) || [];
      if (explicit.some((segment) => segmentDistancePx(point, segment) <= maxPx + EPSILON)) return true;
    }
    return boundaryCandidates(point, interior)
      .some((candidate) => candidate.distance <= maxPx + EPSILON && boundaryIsOpen(candidate.point, Number(interior.zLayer ?? layerOf(point)), mapData));
  }

  function hasInternalLight(point = {}, scene = {}, mapData = {}, environment = {}, now = Date.now()) {
    const lighting = lightingRuntime();
    if (!lighting) return false;
    const ambient = lighting.ambientAtPoint?.(point, scene, mapData, environment);
    if (ambient && ambient.origin === 'interior' && ambient.level !== 'darkness') return true;
    for (const source of Array.isArray(scene.sources) ? scene.sources : []) {
      const level = lighting.sourceLevelAtPoint?.(source, point, scene, mapData, now);
      if (level && level !== 'darkness') return true;
    }
    return false;
  }

  function lookUpInteriorGate(viewer = {}, target = {}, scene = {}, mapData = {}, environment = {}, now = Date.now()) {
    const lighting = lightingRuntime();
    const interior = lighting?.interiorAtPoint?.(target, scene, mapData) || null;
    if (!interior) return { allowed: true, reason: 'EXTERIOR', interior: null };
    if (hasInternalLight(target, scene, mapData, environment, now)) return { allowed: true, reason: 'INTERNAL_LIGHT', interior };
    if (nearVisualOpening(target, interior, mapData, num(interior.lookUpPenetrationFt, LOOK_UP_INTERIOR_DEPTH_FT))) {
      return { allowed: true, reason: 'OPENING_5FT', interior };
    }
    return { allowed: false, reason: 'INTERIOR_DEPTH_LIMIT', interior };
  }

  function sceneForLookUp(scene = {}) {
    return {
      ...scene,
      interiors: (Array.isArray(scene.interiors) ? scene.interiors : []).map((interior) => ({
        ...interior,
        roof: interior.roof ? { ...interior.roof, transparent: true } : interior.roof,
      })),
    };
  }

  function lookDeg(viewer = {}) {
    if (Number.isFinite(Number(viewer.lookDeg))) return normalizeAngleDeg(viewer.lookDeg);
    if (Number.isFinite(Number(viewer.facingDeg))) return normalizeAngleDeg(viewer.facingDeg);
    return 0;
  }

  function perceptionAtPoint(viewer = {}, target = {}, scene = {}, mapData = {}, environment = {}, now = Date.now(), options = {}) {
    const lighting = lightingRuntime();
    if (!lighting?.perceptionAtPoint) return { visible: false, reason: 'LIGHTING_RUNTIME_REQUIRED' };
    const observer = { ...viewer, facingDeg: lookDeg(viewer) };
    if (!options.lookUp || layerOf(target) <= layerOf(viewer)) return lighting.perceptionAtPoint(observer, target, scene, mapData, environment, now);

    const roof = roofOcclusion(observer, target, scene, mapData);
    if (roof.blocked) return { visible: false, reason: 'ROOF_OCCLUSION', roofId: roof.roof?.id || null };
    const gate = lookUpInteriorGate(observer, target, scene, mapData, environment, now);
    if (!gate.allowed) return { visible: false, reason: gate.reason, interiorId: gate.interior?.id || null };

    const result = lighting.perceptionAtPoint(observer, target, sceneForLookUp(scene), mapData, environment, now);
    return result?.visible ? { ...result, lookUp: true, lookUpReason: gate.reason } : result;
  }

  function availableLayers(mapData = {}) {
    const levels = mapData.zLevels || {};
    if (Array.isArray(levels)) return levels.map((entry) => Number(entry?.zLayer ?? entry?.z)).filter(Number.isFinite).sort((a, b) => a - b);
    return Object.entries(levels).map(([key, entry]) => Number(entry?.zLayer ?? entry?.z ?? key)).filter(Number.isFinite).sort((a, b) => a - b);
  }

  function nextLayer(viewerOrLayer = 0, mapData = {}) {
    const current = typeof viewerOrLayer === 'object' ? layerOf(viewerOrLayer) : Number(viewerOrLayer) || 0;
    const next = availableLayers(mapData).find((value) => value > current);
    return Number.isFinite(next) ? next : null;
  }

  return Object.freeze({
    DEFAULT_EYE_HEIGHT_FT,
    DEFAULT_CEILING_HEIGHT_FT,
    LOOK_UP_INTERIOR_DEPTH_FT,
    normalizeAngleDeg,
    angleToPointDeg,
    layerOf,
    elevationForLayer,
    feetToPixels,
    eyeHeightFt,
    eyePoint,
    normalizeRect,
    pointInRect,
    normalizeRoof,
    roofsForScene,
    rayPlaneIntersection,
    roofOcclusion,
    projectedShadowWidthFt,
    segmentDistancePx,
    boundaryCandidates,
    boundaryIsOpen,
    nearVisualOpening,
    hasInternalLight,
    lookUpInteriorGate,
    sceneForLookUp,
    lookDeg,
    perceptionAtPoint,
    availableLayers,
    nextLayer,
  });
});
