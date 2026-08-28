(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttLightingEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const LEVELS = Object.freeze({ BRIGHT: 'bright', DIM: 'dim', DARKNESS: 'darkness' });
  const RANK = Object.freeze({ darkness: 0, dim: 1, bright: 2 });
  const DEFAULT_VISION_CONE_DEG = 120;
  const DARK_NEAR_DIM_FT = 3;
  const EXTERIOR_INTERIOR_PENETRATION_FT = 5;
  const DEFAULT_DAYLIGHT_HOURS = Object.freeze({ start: 6, end: 18 });

  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, num(value, min)));

  function topologyRuntime() {
    if (root?.LuminousVttTopology) return root.LuminousVttTopology;
    if (typeof require !== 'undefined') {
      try { return require('./topology.js'); } catch (_) {}
    }
    return null;
  }

  function spatialRuntime() {
    if (root?.LuminousVttSpatialVision) return root.LuminousVttSpatialVision;
    if (typeof require !== 'undefined') {
      try { return require('./spatial-vision.js'); } catch (_) {}
    }
    return null;
  }

  function feetPerPixel(mapData = {}) {
    const size = Math.max(1, num(mapData.grid?.size, 70));
    return Math.max(0.001, num(mapData.grid?.distancePerCell, 5)) / size;
  }

  function feetToPixels(feet, mapData = {}) { return Math.max(0, num(feet)) / feetPerPixel(mapData); }
  function pixelsToFeet(px, mapData = {}) { return Math.max(0, num(px)) * feetPerPixel(mapData); }

  function layerOf(entity = {}) {
    const spatial = spatialRuntime();
    if (spatial?.layerOf) return spatial.layerOf(entity);
    if (Number.isFinite(Number(entity.zLayer))) return Number(entity.zLayer);
    if (Number.isFinite(Number(entity.gridPosition?.z))) return Number(entity.gridPosition.z);
    if (Array.isArray(entity.z) && entity.z.length) return Number(entity.z[0]) || 0;
    return 0;
  }

  function elevationForLayer(mapData = {}, zLayer = 0) {
    const spatial = spatialRuntime();
    if (spatial?.elevationForLayer) return spatial.elevationForLayer(mapData, zLayer);
    const record = mapData.zLevels?.[String(zLayer)] || mapData.zLevels?.[zLayer];
    if (Number.isFinite(Number(record?.elevationFt))) return Number(record.elevationFt);
    return Number(zLayer) * num(mapData.defaultZStepFt, 15);
  }

  function elevationFt(entity = {}, mapData = {}) {
    if (Number.isFinite(Number(entity.elevationFt))) return Number(entity.elevationFt);
    return elevationForLayer(mapData, layerOf(entity));
  }

  function distance3dFt(a = {}, b = {}, mapData = {}) {
    const horizontalFt = Math.hypot(num(b.x) - num(a.x), num(b.y) - num(a.y)) * feetPerPixel(mapData);
    return Math.hypot(horizontalFt, elevationFt(b, mapData) - elevationFt(a, mapData));
  }

  function normalizeAngleDeg(value) {
    const angle = num(value, 0) % 360;
    return angle < 0 ? angle + 360 : angle;
  }

  function signedAngleDeltaDeg(a, b) {
    let delta = normalizeAngleDeg(a) - normalizeAngleDeg(b);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function angleToPointDeg(origin = {}, point = {}) {
    return normalizeAngleDeg((Math.atan2(num(point.y) - num(origin.y), num(point.x) - num(origin.x)) * 180) / Math.PI);
  }

  function pointInCone(origin = {}, point = {}, facingDeg = 0, coneDeg = DEFAULT_VISION_CONE_DEG) {
    const cone = clamp(coneDeg, 1, 360);
    if (cone >= 359.999) return true;
    return Math.abs(signedAngleDeltaDeg(angleToPointDeg(origin, point), facingDeg)) <= (cone / 2) + 1e-9;
  }

  function normalizeLevel(value, fallback = LEVELS.DARKNESS) {
    const id = clean(value).toLowerCase();
    return Object.values(LEVELS).includes(id) ? id : fallback;
  }

  function strongerLevel(a, b) {
    const left = normalizeLevel(a);
    const right = normalizeLevel(b);
    return RANK[right] > RANK[left] ? right : left;
  }

  function normalizeRect(rect = {}) {
    const x1 = Math.min(num(rect.x1 ?? rect.x), num(rect.x2 ?? rect.x) + Math.max(0, num(rect.width)));
    const x2 = Math.max(num(rect.x1 ?? rect.x), num(rect.x2 ?? rect.x) + Math.max(0, num(rect.width)));
    const y1 = Math.min(num(rect.y1 ?? rect.y), num(rect.y2 ?? rect.y) + Math.max(0, num(rect.height)));
    const y2 = Math.max(num(rect.y1 ?? rect.y), num(rect.y2 ?? rect.y) + Math.max(0, num(rect.height)));
    return { x1, y1, x2, y2 };
  }

  function normalizeInterior(raw = {}, mapData = {}) {
    const rect = normalizeRect(raw);
    return {
      ...raw,
      id: clean(raw.id),
      zLayer: Number.isFinite(Number(raw.zLayer)) ? Number(raw.zLayer) : 0,
      x1: rect.x1,
      y1: rect.y1,
      x2: rect.x2,
      y2: rect.y2,
      baseLight: normalizeLevel(raw.baseLight, LEVELS.DARKNESS),
      exteriorPenetrationFt: Math.max(0, num(raw.exteriorPenetrationFt, EXTERIOR_INTERIOR_PENETRATION_FT)),
      roof: {
        present: raw.roof?.present !== false,
        transparent: raw.roof?.transparent === true,
      },
      label: clean(raw.label || raw.id || 'INTERIOR'),
    };
  }

  function pointInInterior(point = {}, interior = {}) {
    if (Number(layerOf(point)) !== Number(interior.zLayer ?? 0)) return false;
    return num(point.x) >= num(interior.x1) && num(point.x) <= num(interior.x2)
      && num(point.y) >= num(interior.y1) && num(point.y) <= num(interior.y2);
  }

  function interiorAtPoint(point = {}, scene = {}, mapData = {}) {
    return (Array.isArray(scene.interiors) ? scene.interiors : [])
      .map((item) => normalizeInterior(item, mapData))
      .find((item) => pointInInterior(point, item)) || null;
  }

  function segmentDistancePx(point, segment) {
    const px = num(point.x), py = num(point.y), ax = num(segment.x1), ay = num(segment.y1), bx = num(segment.x2), by = num(segment.y2);
    const dx = bx - ax, dy = by - ay;
    const len2 = (dx * dx) + (dy * dy);
    if (!len2) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, (((px - ax) * dx) + ((py - ay) * dy)) / len2));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function topologySegments(mapData = {}, zLayer = 0, blocking = true) {
    const topology = topologyRuntime();
    if (!topology) return [];
    const list = [];
    for (const raw of Array.isArray(mapData.topology) ? mapData.topology : []) {
      const element = topology.normalizeElement(raw);
      if (!topology.elementOnLayer(element, zLayer)) continue;
      const flags = topology.effectiveFlags(element);
      const blocksLight = flags.blocksVision === true;
      if (blocking !== blocksLight) continue;
      list.push({ ...topology.segment(element, mapData.grid), blocksLight });
    }
    return list;
  }

  function legacySegments(mapData = {}, zLayer = 0) {
    return (Array.isArray(mapData.walls) ? mapData.walls : [])
      .filter((wall) => (Array.isArray(wall.z) ? wall.z.map(Number).includes(Number(zLayer)) : Number(wall.z ?? 0) === Number(zLayer)))
      .filter((wall) => wall.blocksVision !== false)
      .map((wall) => ({ x1: num(wall.x1), y1: num(wall.y1), x2: num(wall.x2), y2: num(wall.y2), blocksLight: true }));
  }

  function openingSegments(mapData = {}, zLayer = 0) {
    const topology = topologyRuntime();
    const result = [];
    if (topology) {
      for (const raw of Array.isArray(mapData.topology) ? mapData.topology : []) {
        const element = topology.normalizeElement(raw);
        if (!topology.elementOnLayer(element, zLayer)) continue;
        if (topology.effectiveFlags(element).blocksVision) continue;
        if (!['door', 'window', 'curtain_window'].includes(element.type)) continue;
        result.push(topology.segment(element, mapData.grid));
      }
    }
    const spatial = spatialRuntime();
    for (const portal of Array.isArray(mapData.verticalPortals) ? mapData.verticalPortals : []) {
      const layers = spatial?.portalLayers?.(portal) || portal.between || [];
      if (!layers.map(Number).includes(Number(zLayer))) continue;
      if (spatial?.portalAllows && !spatial.portalAllows(portal, 'light')) continue;
      const a = spatial?.vertexToPoint?.(portal.from || portal.a, mapData);
      const b = spatial?.vertexToPoint?.(portal.to || portal.b, mapData);
      if (a && b) result.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, vertical: true });
    }
    return result;
  }

  function nearExteriorOpening(point = {}, interior = {}, mapData = {}) {
    const maxPx = feetToPixels(interior.exteriorPenetrationFt, mapData);
    return openingSegments(mapData, interior.zLayer).some((segment) => segmentDistancePx(point, segment) <= maxPx + 1e-9);
  }

  function calendarHour(calendar = {}) {
    if (Number.isFinite(Number(calendar.hora ?? calendar.hour))) return ((Number(calendar.hora ?? calendar.hour) % 24) + 24) % 24;
    if (calendar.timestamp) {
      const parsed = new Date(calendar.timestamp);
      if (!Number.isNaN(parsed.getTime())) return parsed.getUTCHours();
    }
    return 12;
  }

  function isDayFromCalendar(calendar = {}, daylightHours = DEFAULT_DAYLIGHT_HOURS) {
    const hour = calendarHour(calendar);
    const start = clamp(daylightHours?.start, 0, 23.999);
    const end = clamp(daylightHours?.end, 0, 24);
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  function exteriorEnvironment({ weatherState, calendar, environmentEngine, daylightHours, overrideLevel } = {}) {
    if (overrideLevel) return { state: { light: normalizeLevel(overrideLevel, LEVELS.BRIGHT) }, isDay: true, source: 'override' };
    const isDay = isDayFromCalendar(calendar || {}, daylightHours || DEFAULT_DAYLIGHT_HOURS);
    if (environmentEngine?.resolveEnvironment) {
      const resolved = environmentEngine.resolveEnvironment({ encounterType: 'outdoor', weather: weatherState, isDay });
      return { ...resolved, source: 'environment-engine' };
    }
    return { state: { light: isDay ? LEVELS.BRIGHT : LEVELS.DARKNESS }, isDay, source: 'fallback' };
  }

  function ambientAtPoint(point = {}, scene = {}, mapData = {}, environment = {}) {
    const exterior = normalizeLevel(environment?.state?.light ?? mapData.ambientLight?.level, LEVELS.BRIGHT);
    const interior = interiorAtPoint(point, scene, mapData);
    if (!interior) return { level: exterior, origin: 'exterior', interior: null };
    if (nearExteriorOpening(point, interior, mapData)) return { level: exterior, origin: 'exterior_penetration', interior };
    return { level: interior.baseLight, origin: 'interior', interior };
  }

  function normalizeTransformer(raw = {}) {
    const repair = raw.repair && typeof raw.repair === 'object' ? clone(raw.repair) : null;
    return {
      ...raw,
      id: clean(raw.id),
      powered: raw.powered !== false,
      damaged: raw.damaged === true,
      circuits: Array.isArray(raw.circuits) ? raw.circuits.map(clean).filter(Boolean) : [],
      repair,
    };
  }

  function normalizeSwitch(raw = {}) {
    return {
      ...raw,
      id: clean(raw.id),
      circuitId: clean(raw.circuitId || 'main') || 'main',
      state: raw.state === 'off' ? 'off' : 'on',
      interactable: raw.interactable !== false,
      interactionFt: Math.max(0, num(raw.interactionFt, 5)),
      x: num(raw.x), y: num(raw.y), zLayer: num(raw.zLayer, 0), elevationFt: num(raw.elevationFt, 0),
    };
  }

  function circuitPower(scene = {}, circuitId = '') {
    const id = clean(circuitId);
    if (!id) return { powered: true, reason: 'NO_CIRCUIT' };
    const transformers = (Array.isArray(scene.transformers) ? scene.transformers : []).map(normalizeTransformer)
      .filter((transformer) => transformer.circuits.includes(id));
    if (transformers.length && !transformers.some((transformer) => transformer.powered && !transformer.damaged)) {
      return { powered: false, reason: 'TRANSFORMER_OFFLINE' };
    }
    const switches = (Array.isArray(scene.switches) ? scene.switches : []).map(normalizeSwitch).filter((entry) => entry.circuitId === id);
    if (switches.length && !switches.some((entry) => entry.state === 'on')) return { powered: false, reason: 'SWITCH_OFF' };
    return { powered: true, reason: 'POWERED' };
  }

  function normalizeSource(raw = {}, mapData = {}) {
    const shape = raw.shape === 'cone' ? 'cone' : 'radius';
    const zLayer = Number.isFinite(Number(raw.zLayer)) ? Number(raw.zLayer) : 0;
    return {
      ...raw,
      id: clean(raw.id),
      label: clean(raw.label || raw.id || 'LIGHT'),
      x: num(raw.x), y: num(raw.y), zLayer,
      elevationFt: Number.isFinite(Number(raw.elevationFt)) ? Number(raw.elevationFt) : elevationForLayer(mapData, zLayer),
      brightFt: Math.max(0, num(raw.brightFt, 0)),
      dimAdditionalFt: Math.max(0, num(raw.dimAdditionalFt, 0)),
      shape,
      directionDeg: normalizeAngleDeg(raw.directionDeg),
      coneDeg: clamp(raw.coneDeg, 1, 360) || 90,
      enabled: raw.enabled !== false,
      functional: raw.functional !== false,
      circuitId: clean(raw.circuitId),
      color: clean(raw.color || '#ffd27a') || '#ffd27a',
      flicker: raw.flicker && typeof raw.flicker === 'object' ? clone(raw.flicker) : (raw.flicker ? { enabled: true } : null),
      attachedToTokenId: clean(raw.attachedToTokenId) || null,
      ownerPlayerId: clean(raw.ownerPlayerId) || null,
      throwRangeFt: Number.isFinite(Number(raw.throwRangeFt)) ? Math.max(0, Number(raw.throwRangeFt)) : null,
      motion: raw.motion && typeof raw.motion === 'object' ? clone(raw.motion) : null,
    };
  }

  function sourcePowered(source = {}, scene = {}) {
    if (!source.enabled) return { powered: false, reason: 'DISABLED' };
    if (!source.functional) return { powered: false, reason: 'BROKEN' };
    return circuitPower(scene, source.circuitId);
  }

  function tokenById(tokens = [], id) { return (Array.isArray(tokens) ? tokens : []).find((token) => clean(token.id) === clean(id)) || null; }

  function interpolateMotion(motion = {}, nowMs = Date.now()) {
    const startedAt = num(motion.startedAt, nowMs);
    const durationMs = Math.max(1, num(motion.durationMs, 1));
    const t = clamp((num(nowMs, startedAt) - startedAt) / durationMs, 0, 1);
    const from = motion.from || {};
    const to = motion.to || {};
    const arcHeightFt = Math.max(0, num(motion.arcHeightFt, 0));
    return {
      x: num(from.x) + (num(to.x) - num(from.x)) * t,
      y: num(from.y) + (num(to.y) - num(from.y)) * t,
      zLayer: t >= 1 ? num(to.zLayer, num(from.zLayer)) : num(from.zLayer),
      elevationFt: num(from.elevationFt) + (num(to.elevationFt) - num(from.elevationFt)) * t + (4 * arcHeightFt * t * (1 - t)),
      progress: t,
      complete: t >= 1,
    };
  }

  function sourcePosition(rawSource = {}, mapData = {}, nowMs = Date.now()) {
    const source = normalizeSource(rawSource, mapData);
    if (source.attachedToTokenId) {
      const token = tokenById(mapData.tokens, source.attachedToTokenId);
      if (token) return { ...source, x: num(token.x), y: num(token.y), zLayer: layerOf(token), elevationFt: elevationFt(token, mapData), attachment: true };
    }
    if (source.motion) return { ...source, ...interpolateMotion(source.motion, nowMs), attachment: false };
    return { ...source, attachment: false };
  }

  function orientation(a, b, c) { return ((num(b.y) - num(a.y)) * (num(c.x) - num(b.x))) - ((num(b.x) - num(a.x)) * (num(c.y) - num(b.y))); }
  function onSegment(a, b, c) { return num(b.x) <= Math.max(num(a.x), num(c.x)) + 1e-9 && num(b.x) + 1e-9 >= Math.min(num(a.x), num(c.x)) && num(b.y) <= Math.max(num(a.y), num(c.y)) + 1e-9 && num(b.y) + 1e-9 >= Math.min(num(a.y), num(c.y)); }
  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
    if (Math.abs(o1) < 1e-9 && onSegment(a, c, b)) return true;
    if (Math.abs(o2) < 1e-9 && onSegment(a, d, b)) return true;
    if (Math.abs(o3) < 1e-9 && onSegment(c, a, d)) return true;
    if (Math.abs(o4) < 1e-9 && onSegment(c, b, d)) return true;
    return false;
  }

  function blockersForLayer(mapData = {}, zLayer = 0) { return [...legacySegments(mapData, zLayer), ...topologySegments(mapData, zLayer, true)]; }

  function lineBlocked2d(from = {}, to = {}, mapData = {}, zLayer = 0) {
    return blockersForLayer(mapData, zLayer).some((wall) => segmentsIntersect(from, to, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }));
  }

  function roofBlocksDirectCrossLayer(from = {}, to = {}, scene = {}, mapData = {}) {
    const fromInterior = interiorAtPoint(from, scene, mapData);
    const toInterior = interiorAtPoint(to, scene, mapData);
    const blocks = (interior) => interior?.roof?.present === true && interior?.roof?.transparent !== true;
    return blocks(fromInterior) || blocks(toInterior);
  }

  function canTraverseLayers(from = {}, to = {}, scene = {}, mapData = {}, kind = 'light') {
    const fromZ = layerOf(from), toZ = layerOf(to);
    if (fromZ === toZ) return true;
    const spatial = spatialRuntime();
    if (spatial?.canTraverseLayers?.(from, to, toZ, mapData, kind)) return true;
    return !roofBlocksDirectCrossLayer(from, to, scene, mapData);
  }

  function lineOfEffect(from = {}, to = {}, scene = {}, mapData = {}, kind = 'light') {
    const fromZ = layerOf(from), toZ = layerOf(to);
    if (!canTraverseLayers(from, to, scene, mapData, kind)) return false;
    if (lineBlocked2d(from, to, mapData, fromZ)) return false;
    if (toZ !== fromZ && lineBlocked2d(from, to, mapData, toZ)) return false;
    return true;
  }

  function sourceLevelAtPoint(rawSource, point = {}, scene = {}, mapData = {}, nowMs = Date.now()) {
    const source = sourcePosition(rawSource, mapData, nowMs);
    if (!sourcePowered(source, scene).powered) return LEVELS.DARKNESS;
    if (source.shape === 'cone' && !pointInCone(source, point, source.directionDeg, source.coneDeg)) return LEVELS.DARKNESS;
    const distance = distance3dFt(source, point, mapData);
    if (distance > source.brightFt + source.dimAdditionalFt + 1e-9) return LEVELS.DARKNESS;
    if (!lineOfEffect(source, point, scene, mapData, 'light')) return LEVELS.DARKNESS;
    return distance <= source.brightFt + 1e-9 ? LEVELS.BRIGHT : LEVELS.DIM;
  }

  function lightAtPoint(point = {}, scene = {}, mapData = {}, environment = {}, nowMs = Date.now()) {
    const ambient = ambientAtPoint(point, scene, mapData, environment);
    let level = ambient.level;
    let sourceId = null;
    for (const rawSource of Array.isArray(scene.sources) ? scene.sources : []) {
      const candidate = sourceLevelAtPoint(rawSource, point, scene, mapData, nowMs);
      if (RANK[candidate] > RANK[level]) {
        level = candidate;
        sourceId = rawSource.id || null;
        if (level === LEVELS.BRIGHT) break;
      }
    }
    return { level, ambient, sourceId };
  }

  function visionConeDeg(viewer = {}) { return clamp(viewer.visionConeDeg, 1, 360) || DEFAULT_VISION_CONE_DEG; }
  function facingDeg(viewer = {}) { return normalizeAngleDeg(viewer.facingDeg); }

  function darkvisionRangeFt(viewer = {}) {
    return Math.max(0, num(viewer.senses?.darkvisionFt ?? viewer.darkvisionFt, 0));
  }

  function perceptionAtPoint(viewer = {}, point = {}, scene = {}, mapData = {}, environment = {}, nowMs = Date.now()) {
    if (!pointInCone(viewer, point, facingDeg(viewer), visionConeDeg(viewer))) return { visible: false, mode: 'outside_cone', level: LEVELS.DARKNESS, monochrome: false };
    if (!lineOfEffect(viewer, point, scene, mapData, 'vision')) return { visible: false, mode: 'occluded', level: LEVELS.DARKNESS, monochrome: false };
    const light = lightAtPoint(point, scene, mapData, environment, nowMs);
    const distanceFt = distance3dFt(viewer, point, mapData);
    if (light.level !== LEVELS.DARKNESS) return { visible: true, mode: light.level === LEVELS.BRIGHT ? 'normal_bright' : 'normal_dim', level: light.level, monochrome: false, distanceFt, light };
    if (distanceFt <= DARK_NEAR_DIM_FT + 1e-9) return { visible: true, mode: 'near_dim', level: LEVELS.DIM, monochrome: false, distanceFt, light };
    const range = darkvisionRangeFt(viewer);
    if (range > 0 && distanceFt <= range + 1e-9) return { visible: true, mode: 'darkvision', level: LEVELS.DIM, monochrome: true, distanceFt, light };
    return { visible: false, mode: 'darkness', level: LEVELS.DARKNESS, monochrome: false, distanceFt, light };
  }

  function lightVisualIntensity(source = {}, nowMs = Date.now()) {
    const normalized = normalizeSource(source);
    const flicker = normalized.flicker;
    if (!flicker?.enabled) return 1;
    const amount = clamp(flicker.amount, 0, 0.45) || 0.08;
    const speed = Math.max(0.1, num(flicker.speed, 7));
    const seed = clean(normalized.id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const wave = (Math.sin((nowMs / 1000) * speed + seed) + Math.sin((nowMs / 1000) * speed * 1.73 + seed * 0.13)) / 2;
    return clamp(1 + wave * amount, 1 - amount, 1 + amount);
  }

  function createThrowMotion(source = {}, target = {}, mapData = {}, options = {}) {
    const from = sourcePosition(source, mapData, options.startedAt ?? Date.now());
    const toZ = Number.isFinite(Number(target.zLayer)) ? Number(target.zLayer) : from.zLayer;
    const to = {
      x: num(target.x, from.x), y: num(target.y, from.y), zLayer: toZ,
      elevationFt: Number.isFinite(Number(target.elevationFt)) ? Number(target.elevationFt) : elevationForLayer(mapData, toZ),
    };
    const distanceFt = distance3dFt(from, to, mapData);
    const speedFtPerSecond = Math.max(1, num(options.speedFtPerSecond, 30));
    return {
      from: { x: from.x, y: from.y, zLayer: from.zLayer, elevationFt: from.elevationFt },
      to,
      startedAt: num(options.startedAt, Date.now()),
      durationMs: Math.max(120, num(options.durationMs, (distanceFt / speedFtPerSecond) * 1000)),
      arcHeightFt: Math.max(0, num(options.arcHeightFt, Math.min(8, distanceFt * 0.25))),
    };
  }

  return Object.freeze({
    LEVELS,
    RANK,
    DEFAULT_VISION_CONE_DEG,
    DARK_NEAR_DIM_FT,
    EXTERIOR_INTERIOR_PENETRATION_FT,
    DEFAULT_DAYLIGHT_HOURS,
    feetPerPixel,
    feetToPixels,
    pixelsToFeet,
    layerOf,
    elevationForLayer,
    elevationFt,
    distance3dFt,
    normalizeAngleDeg,
    signedAngleDeltaDeg,
    angleToPointDeg,
    pointInCone,
    normalizeLevel,
    strongerLevel,
    normalizeInterior,
    pointInInterior,
    interiorAtPoint,
    openingSegments,
    nearExteriorOpening,
    calendarHour,
    isDayFromCalendar,
    exteriorEnvironment,
    ambientAtPoint,
    normalizeTransformer,
    normalizeSwitch,
    circuitPower,
    normalizeSource,
    sourcePowered,
    interpolateMotion,
    sourcePosition,
    blockersForLayer,
    lineBlocked2d,
    canTraverseLayers,
    lineOfEffect,
    sourceLevelAtPoint,
    lightAtPoint,
    visionConeDeg,
    facingDeg,
    darkvisionRangeFt,
    perceptionAtPoint,
    lightVisualIntensity,
    createThrowMotion,
  });
});