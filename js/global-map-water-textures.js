import TerrainTextures from './global-map-terrain-textures.js';

const DEFAULT_LAKE_DEPTH = 0.55;
const DEFAULT_LAKE_SHORE_ROUGHNESS = 0.35;
const DEFAULT_LAKE_WAVE_INTENSITY = 0.25;
const DEFAULT_RIVER_WIDTH_KM = 8;
const DEFAULT_RIVER_FLOW = 0.5;
const DEFAULT_RIVER_BANK_ROUGHNESS = 0.35;
const DEFAULT_RIVER_DEPTH = 0.45;

const LEGACY_WATER_STYLE = Object.freeze({ fill: 'rgba(32,74,100,.74)', stroke: '#70a7c3' });

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
const clamp01 = (value, fallback = 0) => clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, 0, 1);

function normalizeWaterKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function waterTypeFromMetadata(item) {
  const key = normalizeWaterKey(item?.metadata?.waterType ?? item?.metadata?.water_type);
  if (['lake', 'lago', 'lagoon', 'laguna', 'pond', 'reservoir', 'embalse'].includes(key)) return 'lake';
  if (['river', 'rio', 'stream', 'arroyo', 'creek'].includes(key)) return 'river';
  return null;
}

function isLakeRegion(region) {
  return region?.layer === 'water' && waterTypeFromMetadata(region) === 'lake';
}

function isRiverRoute(route) {
  return route?.type === 'waterway' && waterTypeFromMetadata(route) === 'river';
}

function lakeDepth(region) {
  return clamp01(region?.metadata?.depth ?? region?.metadata?.waterDepth, DEFAULT_LAKE_DEPTH);
}

function lakeShoreRoughness(region) {
  return clamp01(region?.metadata?.shoreRoughness ?? region?.metadata?.bankRoughness, DEFAULT_LAKE_SHORE_ROUGHNESS);
}

function lakeWaveIntensity(region) {
  return clamp01(region?.metadata?.waveIntensity ?? region?.metadata?.waves, DEFAULT_LAKE_WAVE_INTENSITY);
}

function riverWidthKm(route) {
  const raw = route?.metadata?.riverWidthKm ?? route?.metadata?.widthKm;
  const value = Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_RIVER_WIDTH_KM;
  return clamp(value, 0.2, 80);
}

function riverFlow(route) {
  return clamp01(route?.metadata?.flow ?? route?.metadata?.flowIntensity, DEFAULT_RIVER_FLOW);
}

function riverBankRoughness(route) {
  return clamp01(route?.metadata?.bankRoughness ?? route?.metadata?.shoreRoughness, DEFAULT_RIVER_BANK_ROUGHNESS);
}

function riverDepth(route) {
  return clamp01(route?.metadata?.waterDepth ?? route?.metadata?.depth, DEFAULT_RIVER_DEPTH);
}

function waterSeed(item, worldSeed = '0', kind = 'water') {
  const identity = [
    worldSeed,
    item?.id || '',
    kind,
    item?.metadata?.waterType || '',
    item?.metadata?.depth ?? '',
    item?.metadata?.waterDepth ?? '',
    item?.metadata?.shoreRoughness ?? '',
    item?.metadata?.bankRoughness ?? '',
    item?.metadata?.waveIntensity ?? '',
    item?.metadata?.riverWidthKm ?? '',
    item?.metadata?.flow ?? '',
  ].join('|');
  return TerrainTextures.stringHash(identity);
}

function lakeProfile(region, worldSeed = '0') {
  const depth = lakeDepth(region);
  const shoreRoughness = lakeShoreRoughness(region);
  const waveIntensity = lakeWaveIntensity(region);
  return Object.freeze({
    depth,
    shoreRoughness,
    waveIntensity,
    rippleCount: Math.round(5 + waveIntensity * 19),
    shoreBands: Math.round(1 + shoreRoughness * 2),
    seed: waterSeed(region, worldSeed, 'lake'),
  });
}

function riverProfile(route, worldSeed = '0') {
  return Object.freeze({
    widthKm: riverWidthKm(route),
    flow: riverFlow(route),
    bankRoughness: riverBankRoughness(route),
    depth: riverDepth(route),
    seed: waterSeed(route, worldSeed, 'river'),
  });
}

function styleForWaterRegion(region) {
  if (!isLakeRegion(region)) return LEGACY_WATER_STYLE;
  const depth = lakeDepth(region);
  const dark = Math.round(84 - depth * 24);
  const blue = Math.round(116 - depth * 18);
  return Object.freeze({
    fill: `rgba(25,${dark},${blue},.78)`,
    stroke: depth > 0.7 ? '#6f9eb7' : '#7fb6cf',
  });
}

function polygonPath(ctx, points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
  return true;
}

function boundsForScreenPoints(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function drawLakeTexture(ctx, region, screenPoints, options = {}) {
  if (!ctx || !isLakeRegion(region) || !Array.isArray(screenPoints) || screenPoints.length < 3) return null;
  const profile = lakeProfile(region, options.seed ?? '0');
  const random = TerrainTextures.createRandom(profile.seed);
  const bounds = boundsForScreenPoints(screenPoints);
  const diagonal = Math.hypot(bounds.width, bounds.height);
  if (diagonal < 4) return profile;

  ctx.save();
  polygonPath(ctx, screenPoints);
  ctx.clip();

  const gradient = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  gradient.addColorStop(0, `rgba(121,181,205,${0.04 + (1 - profile.depth) * 0.08})`);
  gradient.addColorStop(1, `rgba(3,25,42,${0.10 + profile.depth * 0.15})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

  const rippleCount = Math.min(60, Math.max(2, Math.round(profile.rippleCount * Math.max(0.55, Math.min(2.5, diagonal / 180)))));
  for (let index = 0; index < rippleCount; index += 1) {
    const x = bounds.minX + random() * bounds.width;
    const y = bounds.minY + random() * bounds.height;
    const length = 4 + random() * (8 + profile.waveIntensity * 18);
    const bend = (random() - 0.5) * (2 + profile.waveIntensity * 5);
    ctx.beginPath();
    ctx.moveTo(x - length / 2, y);
    ctx.quadraticCurveTo(x, y + bend, x + length / 2, y);
    ctx.strokeStyle = `rgba(174,220,232,${0.08 + profile.waveIntensity * 0.16})`;
    ctx.lineWidth = 0.55 + profile.waveIntensity * 0.8;
    ctx.stroke();
  }

  for (let band = 0; band < profile.shoreBands; band += 1) {
    polygonPath(ctx, screenPoints);
    ctx.strokeStyle = `rgba(155,198,190,${0.12 + profile.shoreRoughness * 0.10})`;
    ctx.lineWidth = 1 + band * 1.4 + profile.shoreRoughness * 2.4;
    ctx.stroke();
  }

  ctx.restore();
  return profile;
}

function riverScreenWidth(route, zoom = 1) {
  return clamp(riverWidthKm(route) * Math.max(0.001, finite(zoom, 1)), 2, 42);
}

function polylinePath(ctx, points) {
  if (!Array.isArray(points) || points.length < 2) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  return true;
}

function drawRiver(ctx, route, screenPoints, options = {}) {
  if (!ctx || !isRiverRoute(route) || !Array.isArray(screenPoints) || screenPoints.length < 2) return null;
  const profile = riverProfile(route, options.seed ?? '0');
  const width = riverScreenWidth(route, options.zoom ?? 1);
  const bankExtra = 1.5 + profile.bankRoughness * 4.5;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  polylinePath(ctx, screenPoints);
  ctx.strokeStyle = `rgba(62,72,64,${0.58 + profile.bankRoughness * 0.18})`;
  ctx.lineWidth = width + bankExtra * 2;
  ctx.stroke();

  polylinePath(ctx, screenPoints);
  const blue = Math.round(141 + (1 - profile.depth) * 22);
  ctx.strokeStyle = `rgba(54,121,${blue},.92)`;
  ctx.lineWidth = width;
  ctx.stroke();

  polylinePath(ctx, screenPoints);
  ctx.strokeStyle = `rgba(162,211,226,${0.10 + profile.flow * 0.22})`;
  ctx.lineWidth = Math.max(0.7, width * 0.18);
  ctx.stroke();

  if (profile.flow > 0.12 && width >= 3) {
    const random = TerrainTextures.createRandom(profile.seed);
    for (let segment = 1; segment < screenPoints.length; segment += 1) {
      const a = screenPoints[segment - 1], b = screenPoints[segment];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 10) continue;
      const marks = Math.min(6, Math.max(1, Math.floor(length / 70)));
      const nx = -dy / length, ny = dx / length;
      for (let mark = 0; mark < marks; mark += 1) {
        const t = (mark + 1) / (marks + 1);
        const side = (random() - 0.5) * width * 0.45;
        const x = a.x + dx * t + nx * side;
        const y = a.y + dy * t + ny * side;
        const dash = 2 + profile.flow * 5;
        ctx.beginPath();
        ctx.moveTo(x - dx / length * dash, y - dy / length * dash);
        ctx.lineTo(x + dx / length * dash, y + dy / length * dash);
        ctx.strokeStyle = `rgba(194,230,238,${0.10 + profile.flow * 0.18})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }

  if (options.selected === true) {
    polylinePath(ctx, screenPoints);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  ctx.restore();
  return Object.freeze({ ...profile, screenWidth: width });
}

const api = Object.freeze({
  DEFAULT_LAKE_DEPTH,
  DEFAULT_LAKE_SHORE_ROUGHNESS,
  DEFAULT_LAKE_WAVE_INTENSITY,
  DEFAULT_RIVER_WIDTH_KM,
  DEFAULT_RIVER_FLOW,
  DEFAULT_RIVER_BANK_ROUGHNESS,
  DEFAULT_RIVER_DEPTH,
  LEGACY_WATER_STYLE,
  normalizeWaterKey,
  waterTypeFromMetadata,
  isLakeRegion,
  isRiverRoute,
  lakeDepth,
  lakeShoreRoughness,
  lakeWaveIntensity,
  riverWidthKm,
  riverFlow,
  riverBankRoughness,
  riverDepth,
  waterSeed,
  lakeProfile,
  riverProfile,
  styleForWaterRegion,
  drawLakeTexture,
  riverScreenWidth,
  drawRiver,
});

if (typeof globalThis !== 'undefined') globalThis.LuminousGlobalMapWaterTextures = api;

export {
  DEFAULT_LAKE_DEPTH,
  DEFAULT_LAKE_SHORE_ROUGHNESS,
  DEFAULT_LAKE_WAVE_INTENSITY,
  DEFAULT_RIVER_WIDTH_KM,
  DEFAULT_RIVER_FLOW,
  DEFAULT_RIVER_BANK_ROUGHNESS,
  DEFAULT_RIVER_DEPTH,
  LEGACY_WATER_STYLE,
  normalizeWaterKey,
  waterTypeFromMetadata,
  isLakeRegion,
  isRiverRoute,
  lakeDepth,
  lakeShoreRoughness,
  lakeWaveIntensity,
  riverWidthKm,
  riverFlow,
  riverBankRoughness,
  riverDepth,
  waterSeed,
  lakeProfile,
  riverProfile,
  styleForWaterRegion,
  drawLakeTexture,
  riverScreenWidth,
  drawRiver,
};
export default api;
