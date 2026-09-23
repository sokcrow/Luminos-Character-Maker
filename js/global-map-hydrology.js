import TerrainTextures from './global-map-terrain-textures.js';

const GENERATOR_VERSION = 'global_hydrology_v1';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');
}

function regionText(region = {}) {
  return normalizeKey(`${region.terrain || ''}_${region.name || ''}_${region.id || ''}`);
}

function moistureScore(region = {}) {
  const key = regionText(region);
  if (/(desert|arid|dune|duna|seca|seco)/.test(key)) return 0.06;
  if (/(forest|bosque|jungle|selva|swamp|pantano)/.test(key)) return 0.92;
  if (/(temperate|templad|grass|pradera|oak|roble|meadow|valley|valle)/.test(key)) return 0.68;
  if (/(arctic|snow|nev|ice|hielo|frio|tundra)/.test(key)) return 0.56;
  if (/(coast|costa|beach|playa)/.test(key)) return 0.32;
  if (/(mountain|montan|sierra|ridge|cresta|alpine|rocky)/.test(key)) return 0.30;
  return 0.44;
}

function sourceScore(region = {}) {
  const key = regionText(region);
  if (/(mountain|montan|sierra|ridge|cresta|alpine|nev|snow)/.test(key)) return 1;
  if (/(hill|colina|paso|upland|meseta|mesa|cliff)/.test(key)) return 0.76;
  if (/(arctic|tundra|forest|bosque|temperate|templad)/.test(key)) return 0.60;
  if (/(grass|pradera|oak|roble)/.test(key)) return 0.45;
  if (/(desert|arid|dune|duna)/.test(key)) return 0.28;
  return 0.50;
}

function averagePoint(points = []) {
  if (!points.length) return { xKm: 0, yKm: 0 };
  const sum = points.reduce((acc, point) => ({ xKm: acc.xKm + point.xKm, yKm: acc.yKm + point.yKm }), { xKm: 0, yKm: 0 });
  return { xKm: sum.xKm / points.length, yKm: sum.yKm / points.length };
}

function pointInPolygon(point, polygon = []) {
  if (!point || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = ((a.yKm > point.yKm) !== (b.yKm > point.yKm))
      && point.xKm < ((b.xKm - a.xKm) * (point.yKm - a.yKm)) / ((b.yKm - a.yKm) || Number.EPSILON) + a.xKm;
    if (crosses) inside = !inside;
  }
  return inside;
}

function regionBounds(region = {}) {
  if (region.bounds) return region.bounds;
  let minXKm = Infinity, minYKm = Infinity, maxXKm = -Infinity, maxYKm = -Infinity;
  for (const p of region.polygon || []) {
    minXKm = Math.min(minXKm, p.xKm);
    minYKm = Math.min(minYKm, p.yKm);
    maxXKm = Math.max(maxXKm, p.xKm);
    maxYKm = Math.max(maxYKm, p.yKm);
  }
  return { minXKm, minYKm, maxXKm, maxYKm };
}

function interiorAnchor(region, seed = '0') {
  const polygon = region?.polygon || [];
  let anchor = averagePoint(polygon);
  if (pointInPolygon(anchor, polygon)) return anchor;
  const bounds = regionBounds(region);
  const random = TerrainTextures.createRandom(TerrainTextures.stringHash(`${seed}|${region?.id}|anchor`));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const point = {
      xKm: bounds.minXKm + random() * Math.max(0, bounds.maxXKm - bounds.minXKm),
      yKm: bounds.minYKm + random() * Math.max(0, bounds.maxYKm - bounds.minYKm),
    };
    if (pointInPolygon(point, polygon)) return point;
  }
  return polygon[0] ? { ...polygon[0] } : anchor;
}

function pullInside(anchor, candidate, polygon) {
  if (pointInPolygon(candidate, polygon)) return candidate;
  let lo = 0, hi = 1, best = { ...anchor };
  for (let step = 0; step < 18; step += 1) {
    const t = (lo + hi) / 2;
    const point = {
      xKm: anchor.xKm + (candidate.xKm - anchor.xKm) * t,
      yKm: anchor.yKm + (candidate.yKm - anchor.yKm) * t,
    };
    if (pointInPolygon(point, polygon)) { best = point; lo = t; }
    else hi = t;
  }
  return best;
}

function lakePolygon(region, seed = '0') {
  const bounds = regionBounds(region);
  const width = Math.max(1, bounds.maxXKm - bounds.minXKm);
  const height = Math.max(1, bounds.maxYKm - bounds.minYKm);
  const anchor = interiorAnchor(region, seed);
  const random = TerrainTextures.createRandom(TerrainTextures.stringHash(`${seed}|${region.id}|lake-shape`));
  const baseRadius = Math.max(3, Math.min(width, height) * (0.095 + random() * 0.055));
  const count = 11;
  const polygon = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count + (random() - 0.5) * 0.16;
    const radius = baseRadius * (0.70 + random() * 0.42);
    const candidate = {
      xKm: anchor.xKm + Math.cos(angle) * radius,
      yKm: anchor.yKm + Math.sin(angle) * radius,
    };
    polygon.push(pullInside(anchor, candidate, region.polygon || []));
  }
  return { anchor, polygon };
}

function nearestBoundaryOutlet(source, bounds) {
  const edges = [
    { distance: Math.abs(source.xKm - bounds.minXKm), point: { xKm: bounds.minXKm, yKm: source.yKm } },
    { distance: Math.abs(bounds.minXKm + bounds.widthKm - source.xKm), point: { xKm: bounds.minXKm + bounds.widthKm, yKm: source.yKm } },
    { distance: Math.abs(source.yKm - bounds.minYKm), point: { xKm: source.xKm, yKm: bounds.minYKm } },
    { distance: Math.abs(bounds.minYKm + bounds.heightKm - source.yKm), point: { xKm: source.xKm, yKm: bounds.minYKm + bounds.heightKm } },
  ];
  edges.sort((a, b) => a.distance - b.distance);
  return edges[0].point;
}

function riverPoints(source, target, seed = '0') {
  const random = TerrainTextures.createRandom(TerrainTextures.stringHash(`${seed}|river|${source.xKm},${source.yKm}|${target.xKm},${target.yKm}`));
  const dx = target.xKm - source.xKm, dy = target.yKm - source.yKm;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance, ny = dx / distance;
  const segments = 7;
  const amplitude = Math.min(distance * 0.11, 90);
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const taper = Math.sin(Math.PI * t);
    const meander = (random() - 0.5) * 2 * amplitude * taper;
    points.push({
      xKm: source.xKm + dx * t + nx * meander,
      yKm: source.yKm + dy * t + ny * meander,
    });
  }
  return points;
}

function existingLakeAnchors(doc = {}) {
  return (doc.regions || [])
    .filter(region => region.layer === 'water')
    .map(region => ({ id: region.id, point: averagePoint(region.polygon || []), existing: true }));
}

function planHydrology(doc = {}, options = {}) {
  const seed = String(options.seed ?? doc.seed ?? '0');
  const terrainRegions = (doc.regions || []).filter(region => region.layer === 'terrain' && (region.polygon || []).length >= 3);
  const existingWaterRegions = (doc.regions || []).filter(region => region.layer === 'water');
  const existingWaterways = (doc.routes || []).filter(route => route.type === 'waterway');
  if (!terrainRegions.length) {
    return Object.freeze({ version: GENERATOR_VERSION, seed, lakes: Object.freeze([]), rivers: Object.freeze([]), summary: Object.freeze({ terrainRegions: 0, lakes: 0, rivers: 0, existingWaterRegions: existingWaterRegions.length, existingWaterways: existingWaterways.length }) });
  }

  const scoredWet = terrainRegions
    .map(region => {
      const random = TerrainTextures.createRandom(TerrainTextures.stringHash(`${seed}|${region.id}|wet-score`));
      return { region, score: moistureScore(region) + random() * 0.18 };
    })
    .filter(item => moistureScore(item.region) >= 0.18)
    .sort((a, b) => b.score - a.score || a.region.id.localeCompare(b.region.id));

  const desiredLakeCount = existingWaterRegions.length ? 0 : Math.min(2, Math.max(1, Math.round(terrainRegions.length / 6)));
  const lakes = [];
  for (const item of scoredWet.slice(0, desiredLakeCount)) {
    const shape = lakePolygon(item.region, seed);
    const moisture = moistureScore(item.region);
    lakes.push(Object.freeze({
      id: `hydro_lake_${item.region.id}`,
      name: `Lago · ${item.region.name || item.region.id}`,
      layer: 'water',
      districtId: item.region.districtId || '',
      jurisdiction: item.region.jurisdiction || null,
      terrain: 'lake',
      source: 'procedural',
      visibleToPlayers: true,
      polygon: Object.freeze(shape.polygon),
      anchor: Object.freeze(shape.anchor),
      metadata: Object.freeze({
        waterType: 'lake',
        depth: clamp(0.42 + moisture * 0.34, 0, 1),
        shoreRoughness: clamp(0.22 + (1 - moisture) * 0.48, 0, 1),
        waveIntensity: clamp(0.12 + moisture * 0.26, 0, 1),
        generatedBy: GENERATOR_VERSION,
        hostTerrainRegionId: item.region.id,
      }),
    }));
  }

  const lakeTargets = existingLakeAnchors(doc).concat(lakes.map(lake => ({ id: lake.id, point: lake.anchor, existing: false })));
  const scoredSources = terrainRegions
    .map(region => {
      const random = TerrainTextures.createRandom(TerrainTextures.stringHash(`${seed}|${region.id}|source-score`));
      return { region, score: sourceScore(region) + random() * 0.14 };
    })
    .sort((a, b) => b.score - a.score || a.region.id.localeCompare(b.region.id));

  const desiredRiverCount = existingWaterways.length ? 0 : Math.min(2, Math.max(1, Math.floor((terrainRegions.length + 2) / 5)));
  const rivers = [];
  for (const item of scoredSources.slice(0, desiredRiverCount)) {
    const source = interiorAnchor(item.region, `${seed}|river-source`);
    let target = null;
    if (lakeTargets.length) {
      target = lakeTargets
        .map(candidate => ({ ...candidate, distance: Math.hypot(candidate.point.xKm - source.xKm, candidate.point.yKm - source.yKm) }))
        .filter(candidate => candidate.distance > 1)
        .sort((a, b) => a.distance - b.distance)[0]?.point || null;
    }
    if (!target) target = nearestBoundaryOutlet(source, doc.bounds);
    const elevation = sourceScore(item.region);
    const path = riverPoints(source, target, `${seed}|${item.region.id}`);
    rivers.push(Object.freeze({
      id: `hydro_river_${item.region.id}_${rivers.length + 1}`,
      name: `Río · ${item.region.name || item.region.id}`,
      districtId: item.region.districtId || '',
      type: 'waterway',
      visibleToPlayers: true,
      points: Object.freeze(path),
      metadata: Object.freeze({
        waterType: 'river',
        riverWidthKm: clamp(4.5 + elevation * 8.5, 2, 18),
        flow: clamp(0.40 + elevation * 0.42, 0, 1),
        bankRoughness: clamp(0.24 + (1 - moistureScore(item.region)) * 0.35, 0, 1),
        waterDepth: clamp(0.34 + elevation * 0.34, 0, 1),
        generatedBy: GENERATOR_VERSION,
        sourceTerrainRegionId: item.region.id,
      }),
    }));
  }

  return Object.freeze({
    version: GENERATOR_VERSION,
    seed,
    lakes: Object.freeze(lakes),
    rivers: Object.freeze(rivers),
    summary: Object.freeze({
      terrainRegions: terrainRegions.length,
      lakes: lakes.length,
      rivers: rivers.length,
      existingWaterRegions: existingWaterRegions.length,
      existingWaterways: existingWaterways.length,
    }),
  });
}

function applyHydrology(docRaw = {}, core = globalThis.LuminousGlobalMapCore, options = {}) {
  if (!core?.normalizeDocument || !core?.upsertRegion || !core?.upsertRoute) throw new Error('GLOBAL_MAP_CORE_REQUIRED');
  let doc = core.normalizeDocument(docRaw);
  const plan = planHydrology(doc, options);
  const existingRegionIds = new Set(doc.regions.map(region => region.id));
  const existingRouteIds = new Set(doc.routes.map(route => route.id));
  let addedLakes = 0, addedRivers = 0;
  for (const lake of plan.lakes) {
    if (existingRegionIds.has(lake.id)) continue;
    const { anchor, ...region } = lake;
    doc = core.upsertRegion(doc, region);
    existingRegionIds.add(lake.id);
    addedLakes += 1;
  }
  for (const river of plan.rivers) {
    if (existingRouteIds.has(river.id)) continue;
    doc = core.upsertRoute(doc, river);
    existingRouteIds.add(river.id);
    addedRivers += 1;
  }
  return Object.freeze({
    document: doc,
    plan,
    addedLakes,
    addedRivers,
    changed: addedLakes + addedRivers > 0,
  });
}

const api = Object.freeze({
  GENERATOR_VERSION,
  normalizeKey,
  moistureScore,
  sourceScore,
  averagePoint,
  pointInPolygon,
  interiorAnchor,
  lakePolygon,
  riverPoints,
  planHydrology,
  applyHydrology,
});

if (typeof globalThis !== 'undefined') globalThis.LuminousGlobalMapHydrology = api;

export {
  GENERATOR_VERSION,
  normalizeKey,
  moistureScore,
  sourceScore,
  averagePoint,
  pointInPolygon,
  interiorAnchor,
  lakePolygon,
  riverPoints,
  planHydrology,
  applyHydrology,
};
export default api;
