const MAX_MOUNTAIN_SPINES = 12;
const DEFAULT_MOUNTAIN_SPINES = 5;

const FLOOR_TEXTURE_BASE_PATH = 'Assets/Images/World/Floors';
const FLOOR_TEXTURE_IDS = Object.freeze([
  'floor_grass_01',
  'floor_dirt_01',
  'floor_sand_01',
  'floor_stone_01',
  'floor_gravel_01',
  'floor_mud_01',
  'floor_snow_01',
  'floor_ice_01',
  'floor_swamp_01',
  'floor_cave_01',
  'floor_cobblestone_01',
  'floor_flagstone_01',
  'floor_wood_01',
  'floor_brick_01',
  'floor_marble_01',
  'floor_tile_01',
  'floor_metal_01',
  'floor_concrete_01',
]);
const FLOOR_TEXTURE_PATHS = Object.freeze(Object.fromEntries(
  FLOOR_TEXTURE_IDS.map((id) => [id, `${FLOOR_TEXTURE_BASE_PATH}/${id}.png`])
));
const FLOOR_TEXTURE_TERRAIN_MAP = Object.freeze({
  grass:'floor_grass_01', plains:'floor_grass_01', meadow:'floor_grass_01', forest:'floor_grass_01',
  dirt:'floor_dirt_01', earth:'floor_dirt_01', soil:'floor_dirt_01',
  sand:'floor_sand_01', sandy:'floor_sand_01', beach:'floor_sand_01', dune:'floor_sand_01',
  stone:'floor_stone_01', rock:'floor_stone_01', rocky:'floor_stone_01', mountain:'floor_stone_01',
  gravel:'floor_gravel_01',
  mud:'floor_mud_01', muddy:'floor_mud_01',
  snow:'floor_snow_01', snowy:'floor_snow_01',
  ice:'floor_ice_01', icy:'floor_ice_01',
  swamp:'floor_swamp_01', marsh:'floor_swamp_01', bog:'floor_swamp_01',
  cave:'floor_cave_01', cavern:'floor_cave_01',
  cobblestone:'floor_cobblestone_01',
  flagstone:'floor_flagstone_01',
  wood:'floor_wood_01', wooden:'floor_wood_01',
  brick:'floor_brick_01',
  marble:'floor_marble_01',
  tile:'floor_tile_01', tiled:'floor_tile_01',
  metal:'floor_metal_01', metallic:'floor_metal_01',
  concrete:'floor_concrete_01',
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizeTerrainKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function floorTextureId(regionOrTerrain) {
  const raw = typeof regionOrTerrain === 'object' && regionOrTerrain
    ? regionOrTerrain.floorTextureId ?? regionOrTerrain.textureId ?? regionOrTerrain.terrain ?? regionOrTerrain.biome ?? ''
    : regionOrTerrain;
  const key = normalizeTerrainKey(raw);
  if (FLOOR_TEXTURE_PATHS[key]) return key;
  if (FLOOR_TEXTURE_TERRAIN_MAP[key]) return FLOOR_TEXTURE_TERRAIN_MAP[key];
  const tokens = key.split('_').filter(Boolean);
  for (const token of tokens) {
    if (FLOOR_TEXTURE_TERRAIN_MAP[token]) return FLOOR_TEXTURE_TERRAIN_MAP[token];
  }
  return null;
}

function floorTexturePath(idOrRegion) {
  const id = floorTextureId(idOrRegion);
  return id ? FLOOR_TEXTURE_PATHS[id] : null;
}

function floorTextureDescriptor(idOrRegion) {
  const id = floorTextureId(idOrRegion);
  return id ? Object.freeze({ id, path: FLOOR_TEXTURE_PATHS[id] }) : null;
}

function terrainKind(regionOrTerrain) {
  const raw = typeof regionOrTerrain === 'object' && regionOrTerrain
    ? regionOrTerrain.terrain ?? regionOrTerrain.biome ?? ''
    : regionOrTerrain;
  const key = normalizeTerrainKey(raw);
  const tokens = new Set(key.split('_').filter(Boolean));
  const has = (...values) => values.some((value) => tokens.has(value) || key === value || key.includes(`_${value}_`) || key.startsWith(`${value}_`) || key.endsWith(`_${value}`));

  if (has('mountain','mountains','mountainous','montana','montanas','sierra','alpine','ridge','ridges','rocky','crag','crags','highland','highlands','peak','peaks')) return 'mountain';
  if (has('forest','forested','woods','woodland','bosque','bosques','jungle','selva')) return 'forest';
  if (has('beach','beaches','coast','coastal','shore','sand','sandy','playa','playas','dune','dunes')) return 'beach';
  return 'default';
}

function mountainSpines(region = {}) {
  const metadata = region?.metadata && typeof region.metadata === 'object' ? region.metadata : {};
  const direct = [
    metadata.mountainSpines,
    metadata.mountain_spines,
    metadata.spines,
    metadata.ridgeCount,
    metadata.ridges,
  ].find((value) => Number.isFinite(Number(value)));

  if (direct != null) return Math.round(clamp(direct, 0, MAX_MOUNTAIN_SPINES));

  const density = [metadata.ridgeDensity, metadata.ridge_density]
    .find((value) => Number.isFinite(Number(value)));
  if (density != null) {
    const normalized = clamp(density, 0, 1);
    return Math.round(normalized * MAX_MOUNTAIN_SPINES);
  }

  return DEFAULT_MOUNTAIN_SPINES;
}

function roughnessForSpines(spinesRaw) {
  const spines = clamp(finite(spinesRaw, DEFAULT_MOUNTAIN_SPINES), 0, MAX_MOUNTAIN_SPINES);
  const normalized = spines / MAX_MOUNTAIN_SPINES;
  return Number((0.18 + Math.pow(normalized, 0.82) * 0.82).toFixed(4));
}

function stringHash(value) {
  let hash = 2166136261 >>> 0;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function textureSeed(region = {}, worldSeed = '0') {
  return stringHash(`${worldSeed}|${region.id || ''}|${normalizeTerrainKey(region.terrain || region.biome)}|${mountainSpines(region)}`);
}

function createRandom(seedRaw) {
  let state = (Number(seedRaw) >>> 0) || 0x6d2b79f5;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function styleForRegion(region = {}) {
  if (terrainKind(region) === 'mountain') {
    const roughness = roughnessForSpines(mountainSpines(region));
    const alpha = 0.34 + roughness * 0.16;
    return {
      fill: `rgba(83,80,74,${alpha.toFixed(3)})`,
      stroke: roughness > 0.68 ? '#a5a096' : '#918d84',
    };
  }
  return { fill: 'rgba(78,91,75,.38)', stroke: '#77856f' };
}

function textureProfile(region = {}) {
  const kind = terrainKind(region);
  if (kind !== 'mountain') return Object.freeze({ kind, spines: 0, roughness: 0, ridgeCount: 0, facetCount: 0 });
  const spines = mountainSpines(region);
  const roughness = roughnessForSpines(spines);
  return Object.freeze({
    kind,
    spines,
    roughness,
    ridgeCount: Math.max(2, Math.round(2 + spines * 1.75)),
    facetCount: Math.max(8, Math.round(10 + spines * 8 + roughness * 28)),
  });
}

function polygonBounds(points = []) {
  if (!points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    const x = finite(point?.x), y = finite(point?.y);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function clipPolygon(ctx, points) {
  if (!ctx || !points?.length) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
  ctx.clip();
  return true;
}

function drawMountainTexture(ctx, region, screenPoints, options = {}) {
  if (!ctx || !Array.isArray(screenPoints) || screenPoints.length < 3) return null;
  const bounds = polygonBounds(screenPoints);
  if (!bounds || bounds.width < 2 || bounds.height < 2) return null;

  const profile = textureProfile(region);
  if (profile.kind !== 'mountain') return null;

  const zoom = Math.max(0.02, finite(options.zoom, 0.1));
  const random = createRandom(textureSeed(region, options.seed ?? '0'));
  const visibility = Math.max(0.3, Math.min(1.25, 0.45 + Math.sqrt(zoom) * 0.75));
  const ridgeCount = Math.max(1, Math.round(profile.ridgeCount * visibility));
  const facetCount = Math.min(180, Math.max(6, Math.round(profile.facetCount * visibility)));
  const diagonal = Math.hypot(bounds.width, bounds.height);

  ctx.save();
  clipPolygon(ctx, screenPoints);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha *= 0.38 + profile.roughness * 0.3;

  for (let ridge = 0; ridge < ridgeCount; ridge += 1) {
    const horizontal = random() > 0.42;
    const span = (horizontal ? bounds.width : bounds.height) * (0.38 + random() * 0.5);
    const segments = 3 + Math.round(profile.roughness * 5);
    const startX = bounds.minX + random() * bounds.width;
    const startY = bounds.minY + random() * bounds.height;
    const angleBase = horizontal ? (random() - 0.5) * 0.6 : Math.PI / 2 + (random() - 0.5) * 0.65;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let x = startX, y = startY;
    for (let segment = 1; segment <= segments; segment += 1) {
      const jitter = (random() - 0.5) * (0.25 + profile.roughness * 0.72);
      const step = span / segments;
      x += Math.cos(angleBase + jitter) * step;
      y += Math.sin(angleBase + jitter) * step;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = ridge % 3 === 0 ? 'rgba(218,211,198,.42)' : 'rgba(37,36,34,.62)';
    ctx.lineWidth = 0.55 + profile.roughness * 1.05;
    ctx.stroke();

    if (profile.spines >= 4 && diagonal > 18) {
      const teeth = Math.max(1, Math.round(profile.spines / 3));
      for (let tooth = 0; tooth < teeth; tooth += 1) {
        const t = (tooth + 1) / (teeth + 1);
        const tx = startX + (x - startX) * t;
        const ty = startY + (y - startY) * t;
        const toothSize = 1.2 + profile.roughness * 3.2 + random() * 1.8;
        ctx.beginPath();
        ctx.moveTo(tx - toothSize, ty + toothSize * 0.45);
        ctx.lineTo(tx, ty - toothSize);
        ctx.lineTo(tx + toothSize, ty + toothSize * 0.45);
        ctx.strokeStyle = 'rgba(202,196,184,.45)';
        ctx.lineWidth = 0.45 + profile.roughness * 0.55;
        ctx.stroke();
      }
    }
  }

  for (let index = 0; index < facetCount; index += 1) {
    const x = bounds.minX + random() * bounds.width;
    const y = bounds.minY + random() * bounds.height;
    const radius = 0.35 + random() * (0.8 + profile.roughness * 1.8);
    ctx.beginPath();
    ctx.moveTo(x - radius, y + radius * 0.4);
    ctx.lineTo(x, y - radius);
    ctx.lineTo(x + radius, y + radius * 0.45);
    ctx.strokeStyle = index % 4 === 0 ? 'rgba(221,214,201,.28)' : 'rgba(31,30,29,.34)';
    ctx.lineWidth = 0.4 + profile.roughness * 0.45;
    ctx.stroke();
  }

  ctx.restore();
  return Object.freeze({ ...profile, ridgeCount, facetCount });
}

function drawTerrainTexture(ctx, region, screenPoints, options = {}) {
  if (terrainKind(region) !== 'mountain') return null;
  return drawMountainTexture(ctx, region, screenPoints, options);
}

const api = Object.freeze({
  MAX_MOUNTAIN_SPINES,
  DEFAULT_MOUNTAIN_SPINES,
  FLOOR_TEXTURE_BASE_PATH,
  FLOOR_TEXTURE_IDS,
  FLOOR_TEXTURE_PATHS,
  FLOOR_TEXTURE_TERRAIN_MAP,
  floorTextureId,
  floorTexturePath,
  floorTextureDescriptor,
  normalizeTerrainKey,
  terrainKind,
  mountainSpines,
  roughnessForSpines,
  stringHash,
  textureSeed,
  createRandom,
  styleForRegion,
  textureProfile,
  drawMountainTexture,
  drawTerrainTexture,
});

if (typeof globalThis !== 'undefined') globalThis.LuminousGlobalMapTerrainTextures = api;

export {
  MAX_MOUNTAIN_SPINES,
  DEFAULT_MOUNTAIN_SPINES,
  FLOOR_TEXTURE_BASE_PATH,
  FLOOR_TEXTURE_IDS,
  FLOOR_TEXTURE_PATHS,
  FLOOR_TEXTURE_TERRAIN_MAP,
  floorTextureId,
  floorTexturePath,
  floorTextureDescriptor,
  normalizeTerrainKey,
  terrainKind,
  mountainSpines,
  roughnessForSpines,
  stringHash,
  textureSeed,
  createRandom,
  styleForRegion,
  textureProfile,
  drawMountainTexture,
  drawTerrainTexture,
};
export default api;
