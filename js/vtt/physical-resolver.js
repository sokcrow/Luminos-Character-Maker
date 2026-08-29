(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttPhysicalResolver = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const EPS = 1e-7;
  const DEFAULT_TOKEN_HEIGHT_FT = 6;
  const DEFAULT_EYE_HEIGHT_FT = 5.5;
  const COVER_LEVELS = Object.freeze(['none', 'partial', 'major', 'full']);
  const COVER_RANK = Object.freeze({ none: 0, partial: 1, major: 2, full: 3 });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim().toLowerCase();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function coreRuntime() {
    if (root?.LuminousVttWorldObjectCore) return root.LuminousVttWorldObjectCore;
    if (typeof require !== 'undefined') {
      try { return require('./world-object-core.js'); } catch (_) {}
    }
    return null;
  }

  function lightingRuntime() {
    if (root?.LuminousVttLightingEngine) return root.LuminousVttLightingEngine;
    if (typeof require !== 'undefined') {
      try { return require('./lighting-engine.js'); } catch (_) {}
    }
    return null;
  }

  function layerOf(entity = {}) {
    const lighting = lightingRuntime();
    if (lighting?.layerOf) return lighting.layerOf(entity);
    if (Number.isFinite(Number(entity.zLayer))) return Number(entity.zLayer);
    if (Number.isFinite(Number(entity.gridPosition?.z))) return Number(entity.gridPosition.z);
    if (Array.isArray(entity.z) && entity.z.length) return Number(entity.z[0]) || 0;
    if (Number.isFinite(Number(entity.position?.zLayer))) return Number(entity.position.zLayer);
    return 0;
  }

  function feetPerPixel(mapData = {}) {
    const lighting = lightingRuntime();
    if (lighting?.feetPerPixel) return lighting.feetPerPixel(mapData);
    const size = Math.max(1, finite(mapData.grid?.size, 70));
    return Math.max(0.001, finite(mapData.grid?.distancePerCell, 5)) / size;
  }

  function layerElevationFt(mapData = {}, zLayer = 0) {
    const lighting = lightingRuntime();
    if (lighting?.elevationForLayer) return lighting.elevationForLayer(mapData, zLayer);
    const record = mapData.zLevels?.[String(zLayer)] || mapData.zLevels?.[zLayer];
    if (Number.isFinite(Number(record?.elevationFt))) return Number(record.elevationFt);
    return finite(zLayer) * finite(mapData.defaultZStepFt, 15);
  }

  function entityBaseElevationFt(entity = {}, mapData = {}) {
    const zLayer = layerOf(entity);
    const layerBase = layerElevationFt(mapData, zLayer);
    if (entity.position && Number.isFinite(Number(entity.position.elevationFt))) return layerBase + Number(entity.position.elevationFt);
    if (Number.isFinite(Number(entity.elevationFt))) {
      const raw = Number(entity.elevationFt);
      if (Math.abs(raw) < Math.abs(layerBase) + 12 && zLayer !== 0) return layerBase + raw;
      return raw;
    }
    return layerBase;
  }

  function tokenHeightFt(token = {}) {
    const candidates = [token.heightFt, token.bodyHeightFt, token.physicalHeightFt, token.actor?.heightFt, token.raw?.heightFt];
    const value = candidates.find((entry) => Number.isFinite(Number(entry)) && Number(entry) > 0);
    return value == null ? DEFAULT_TOKEN_HEIGHT_FT : Number(value);
  }

  function eyeHeightFt(token = {}, mapData = {}) {
    const relative = Number.isFinite(Number(token.eyeHeightFt))
      ? Math.max(0, Number(token.eyeHeightFt))
      : Math.min(tokenHeightFt(token), DEFAULT_EYE_HEIGHT_FT);
    return entityBaseElevationFt(token, mapData) + relative;
  }

  function tokenTopFt(token = {}, mapData = {}) {
    return entityBaseElevationFt(token, mapData) + tokenHeightFt(token);
  }

  function objectBaseFt(instance = {}, mapData = {}) {
    return entityBaseElevationFt(instance, mapData);
  }

  function objectTopFt(instance = {}, definition = {}, mapData = {}) {
    return objectBaseFt(instance, mapData) + Math.max(0, finite(definition?.physical?.heightFt, 0));
  }

  function definitionsMap(mapData = {}) {
    const catalog = root?.LuminousVttWorldObjectCatalog?.byId || {};
    return { ...catalog, ...(mapData.worldObjectDefinitions || {}) };
  }

  function definitionFor(instance, mapData = {}) {
    const core = coreRuntime();
    if (!instance || !core) return null;
    return core.resolveDefinition(instance, definitionsMap(mapData));
  }

  function pointInsideRect(point = {}, rect = {}) {
    const x = finite(point.x, NaN), y = finite(point.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return x >= finite(rect.x) - EPS && x <= finite(rect.x) + finite(rect.width) + EPS
      && y >= finite(rect.y) - EPS && y <= finite(rect.y) + finite(rect.height) + EPS;
  }

  function segmentRectInterval(from = {}, to = {}, rect = {}) {
    const x0 = finite(from.x, NaN), y0 = finite(from.y, NaN);
    const x1 = finite(to.x, NaN), y1 = finite(to.y, NaN);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    const minX = finite(rect.x), maxX = minX + Math.max(0, finite(rect.width));
    const minY = finite(rect.y), maxY = minY + Math.max(0, finite(rect.height));
    const dx = x1 - x0, dy = y1 - y0;
    let t0 = 0, t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < EPS) return q >= -EPS;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    if (!clip(-dx, x0 - minX) || !clip(dx, maxX - x0) || !clip(-dy, y0 - minY) || !clip(dy, maxY - y0)) return null;
    if (t1 < 0 || t0 > 1 || t0 > t1) return null;
    return { enter: Math.max(0, t0), exit: Math.min(1, t1) };
  }

  function rayElevationFt(entity = {}, mapData = {}, mode = 'point') {
    if (mode === 'viewer' || Number.isFinite(Number(entity.eyeHeightFt))) return eyeHeightFt(entity, mapData);
    if (Number.isFinite(Number(entity.rayElevationFt))) return Number(entity.rayElevationFt);
    if (Number.isFinite(Number(entity.elevationFt))) return Number(entity.elevationFt);
    return entityBaseElevationFt(entity, mapData);
  }

  function occlusionKind(definition = {}) {
    return clean(definition?.physical?.occlusion || 'opaque') || 'opaque';
  }

  function occlusionBlocks(definition = {}, kind = 'vision') {
    const mode = occlusionKind(definition);
    if (['none', 'transparent', 'open'].includes(mode)) return false;
    if (kind === 'light' && mode === 'vision_only') return false;
    if (kind === 'vision' && mode === 'light_only') return false;
    return true;
  }

  function objectOccludersBetween(from = {}, to = {}, mapData = {}, kind = 'vision') {
    const core = coreRuntime();
    if (!core || layerOf(from) !== layerOf(to)) return [];
    const fromElevation = rayElevationFt(from, mapData, Number.isFinite(Number(from.eyeHeightFt)) ? 'viewer' : 'point');
    const toElevation = rayElevationFt(to, mapData, Number.isFinite(Number(to.eyeHeightFt)) ? 'viewer' : 'point');
    const hits = [];
    for (const instance of Array.isArray(mapData.worldObjects) ? mapData.worldObjects : []) {
      if (core.objectLayer(instance) !== layerOf(from) || core.isDestroyed(instance)) continue;
      const definition = definitionFor(instance, mapData);
      if (!definition || !occlusionBlocks(definition, kind)) continue;
      const rect = core.footprintRect(instance, definition, mapData.grid || {});
      const interval = segmentRectInterval(from, to, rect);
      if (!interval) continue;
      const t = Math.max(interval.enter, Math.min(interval.exit, (interval.enter + interval.exit) / 2));
      if (t <= 0.01 || t >= 0.99) continue;
      const rayFt = fromElevation + (toElevation - fromElevation) * t;
      const baseFt = objectBaseFt(instance, mapData);
      const topFt = objectTopFt(instance, definition, mapData);
      if (rayFt + EPS < baseFt || rayFt - EPS > topFt) continue;
      hits.push({ instance, definition, rect, interval, rayFt, baseFt, topFt, t });
    }
    return hits.sort((a, b) => a.t - b.t);
  }

  function blocksLineOfEffect(from = {}, to = {}, mapData = {}, kind = 'vision') {
    return objectOccludersBetween(from, to, mapData, kind).length > 0;
  }

  function qualityLevel(value) {
    const quality = clean(value);
    if (quality === 'full') return 'full';
    if (['major', 'three_quarters', 'three-quarters', 'heavy'].includes(quality)) return 'major';
    if (['partial', 'half', 'light'].includes(quality)) return 'partial';
    return 'none';
  }

  function inferredCoverLevel(instance, definition, target = {}, mapData = {}) {
    const explicit = qualityLevel(definition?.cover?.quality);
    if (explicit !== 'none') return explicit;
    const targetBase = entityBaseElevationFt(target, mapData);
    const height = Math.max(0.1, tokenHeightFt(target));
    const ratio = (objectTopFt(instance, definition, mapData) - targetBase) / height;
    if (ratio >= 0.92) return 'full';
    if (ratio >= 0.62) return 'major';
    if (ratio >= 0.28) return 'partial';
    return 'none';
  }

  function coverBetween(attacker = {}, target = {}, mapData = {}) {
    const core = coreRuntime();
    if (!core || layerOf(attacker) !== layerOf(target)) return { level: 'none', rank: 0, objects: [] };
    let best = 'none';
    const objects = [];
    for (const instance of Array.isArray(mapData.worldObjects) ? mapData.worldObjects : []) {
      if (core.objectLayer(instance) !== layerOf(target) || core.isDestroyed(instance)) continue;
      const definition = definitionFor(instance, mapData);
      if (!definition?.affordances?.cover) continue;
      const rect = core.footprintRect(instance, definition, mapData.grid || {});
      const interval = segmentRectInterval(attacker, target, rect);
      if (!interval || interval.enter <= 0.01 || interval.enter >= 0.99) continue;
      const level = inferredCoverLevel(instance, definition, target, mapData);
      if (COVER_RANK[level] <= 0) continue;
      objects.push({ instance, definition, rect, level, rank: COVER_RANK[level], interval });
      if (COVER_RANK[level] > COVER_RANK[best]) best = level;
    }
    return { level: best, rank: COVER_RANK[best], objects: objects.sort((a, b) => b.rank - a.rank) };
  }

  function distanceToRectPx(point = {}, rect = {}) {
    const px = finite(point.x), py = finite(point.y);
    const nearestX = Math.max(finite(rect.x), Math.min(px, finite(rect.x) + finite(rect.width)));
    const nearestY = Math.max(finite(rect.y), Math.min(py, finite(rect.y) + finite(rect.height)));
    return Math.hypot(px - nearestX, py - nearestY);
  }

  function distanceToObjectFt(token = {}, instance = {}, definition = {}, mapData = {}) {
    const core = coreRuntime();
    if (!core || layerOf(token) !== core.objectLayer(instance)) return Infinity;
    const rect = core.footprintRect(instance, definition, mapData.grid || {});
    return distanceToRectPx(token, rect) * feetPerPixel(mapData);
  }

  function hidingSpotAt(token = {}, mapData = {}) {
    const core = coreRuntime();
    if (!core) return null;
    const hiddenId = token.stealthState?.hiddenInObjectId || token.hiddenInObjectId || null;
    for (const instance of Array.isArray(mapData.worldObjects) ? mapData.worldObjects : []) {
      if (core.objectLayer(instance) !== layerOf(token) || core.isDestroyed(instance)) continue;
      const definition = definitionFor(instance, mapData);
      if (!definition?.affordances?.hideInside) continue;
      const rect = core.footprintRect(instance, definition, mapData.grid || {});
      const logicallyInside = hiddenId && String(hiddenId) === String(instance.instanceId);
      if (logicallyInside || pointInsideRect(token, rect)) return { instance, definition, rect, concealment: clean(definition.hideSpot?.concealment || 'full') || 'full' };
    }
    return null;
  }

  function hidingCandidatesNear(token = {}, mapData = {}, rangeFt = 5) {
    const core = coreRuntime();
    if (!core) return [];
    const results = [];
    for (const instance of Array.isArray(mapData.worldObjects) ? mapData.worldObjects : []) {
      if (core.objectLayer(instance) !== layerOf(token) || core.isDestroyed(instance)) continue;
      const definition = definitionFor(instance, mapData);
      if (!definition?.affordances?.hideInside) continue;
      const distanceFt = distanceToObjectFt(token, instance, definition, mapData);
      if (distanceFt <= Math.max(0, finite(rangeFt, 5)) + EPS) results.push({ instance, definition, distanceFt });
    }
    return results.sort((a, b) => a.distanceFt - b.distanceFt);
  }

  function occupantsFor(instanceId, mapData = {}) {
    return (Array.isArray(mapData.tokens) ? mapData.tokens : []).filter((token) => {
      const id = token.stealthState?.hiddenInObjectId || token.hiddenInObjectId;
      return id && String(id) === String(instanceId);
    });
  }

  function canEnterHide(token = {}, instance = {}, definition = {}, mapData = {}, rangeFt = 5) {
    if (!definition?.affordances?.hideInside) return { valid: false, reason: 'NOT_A_HIDING_SPOT' };
    const core = coreRuntime();
    if (!core || core.isDestroyed(instance)) return { valid: false, reason: 'HIDING_SPOT_DESTROYED' };
    if (definition.affordances.openable && instance.state?.open !== true) return { valid: false, reason: 'HIDING_SPOT_CLOSED' };
    const distanceFt = distanceToObjectFt(token, instance, definition, mapData);
    if (distanceFt > Math.max(0, finite(rangeFt, 5)) + EPS) return { valid: false, reason: 'OUT_OF_RANGE', distanceFt };
    const capacity = Math.max(1, Math.trunc(finite(definition.hideSpot?.capacity, 1)));
    const occupants = occupantsFor(instance.instanceId, mapData).filter((entry) => String(entry.id) !== String(token.id));
    if (occupants.length >= capacity) return { valid: false, reason: 'HIDING_SPOT_FULL', capacity };
    return { valid: true, reason: null, distanceFt, capacity };
  }

  function applyHideState(token = {}, instance = {}, definition = {}) {
    const next = token;
    next.stealthState = {
      ...(clone(next.stealthState) || {}),
      hidden: true,
      hiddenInObjectId: instance.instanceId,
      concealment: clean(definition?.hideSpot?.concealment || 'full') || 'full',
      hiddenSince: Date.now(),
    };
    return next;
  }

  function exitHideState(token = {}) {
    const next = token;
    next.stealthState = { ...(clone(next.stealthState) || {}), hidden: false, hiddenInObjectId: null, concealment: null, hiddenSince: null };
    return next;
  }

  function coverAtToken(token = {}, mapData = {}) {
    const preferred = token.coverState?.objectId || token.preferredCoverObjectId || null;
    const core = coreRuntime();
    if (!core) return { level: 'none', rank: 0, object: null };
    const nearby = [];
    for (const instance of Array.isArray(mapData.worldObjects) ? mapData.worldObjects : []) {
      if (core.objectLayer(instance) !== layerOf(token) || core.isDestroyed(instance)) continue;
      const definition = definitionFor(instance, mapData);
      if (!definition?.affordances?.cover) continue;
      const distanceFt = distanceToObjectFt(token, instance, definition, mapData);
      if (distanceFt > 5 + EPS) continue;
      const level = inferredCoverLevel(instance, definition, token, mapData);
      nearby.push({ instance, definition, distanceFt, level, rank: COVER_RANK[level] || 0 });
    }
    nearby.sort((a, b) => (String(a.instance.instanceId) === String(preferred) ? -1 : String(b.instance.instanceId) === String(preferred) ? 1 : b.rank - a.rank || a.distanceFt - b.distanceFt));
    const best = nearby[0];
    return best ? { level: best.level, rank: best.rank, object: best, nearby } : { level: 'none', rank: 0, object: null, nearby: [] };
  }

  function physicalState(token = {}, mapData = {}) {
    const hiding = hidingSpotAt(token, mapData);
    const cover = coverAtToken(token, mapData);
    return {
      zLayer: layerOf(token),
      elevationFt: entityBaseElevationFt(token, mapData),
      eyeHeightFt: eyeHeightFt(token, mapData),
      heightFt: tokenHeightFt(token),
      hidden: Boolean(token.stealthState?.hidden && hiding),
      hiding,
      cover,
    };
  }

  return Object.freeze({
    EPS,
    DEFAULT_TOKEN_HEIGHT_FT,
    DEFAULT_EYE_HEIGHT_FT,
    COVER_LEVELS,
    COVER_RANK,
    layerOf,
    feetPerPixel,
    layerElevationFt,
    entityBaseElevationFt,
    tokenHeightFt,
    eyeHeightFt,
    tokenTopFt,
    objectBaseFt,
    objectTopFt,
    definitionsMap,
    definitionFor,
    pointInsideRect,
    segmentRectInterval,
    rayElevationFt,
    occlusionKind,
    occlusionBlocks,
    objectOccludersBetween,
    blocksLineOfEffect,
    qualityLevel,
    inferredCoverLevel,
    coverBetween,
    distanceToRectPx,
    distanceToObjectFt,
    hidingSpotAt,
    hidingCandidatesNear,
    occupantsFor,
    canEnterHide,
    applyHideState,
    exitHideState,
    coverAtToken,
    physicalState,
  });
});
