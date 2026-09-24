import TerrainTextures from '../../../js/global-map-terrain-textures.js';

const floorIds = Object.freeze([...TerrainTextures.FLOOR_TEXTURE_IDS]);

export const WORLD_FLOOR_TILES_PER_REPEAT = 8;
export const WORLD_FLOOR_REPEAT_PER_TILE = 1 / WORLD_FLOOR_TILES_PER_REPEAT;

export function worldFloorRepeatForTiles(uTiles = 1, vTiles = 1) {
  return Object.freeze([
    Math.max(1, Math.abs(Number(uTiles) || 1) * WORLD_FLOOR_REPEAT_PER_TILE),
    Math.max(1, Math.abs(Number(vTiles) || 1) * WORLD_FLOOR_REPEAT_PER_TILE),
  ]);
}

export const WORLD_FLOOR_MATERIAL_BINDINGS = Object.freeze({
  forestGround:'floor_grass_01',
  grasslandGround:'floor_grass_01',
  groveGround:'floor_grass_01',

  forestPath:'floor_dirt_01',
  grovePath:'floor_dirt_01',

  desertGround:'floor_sand_01',
  beachGround:'floor_sand_01',
  wetSandGround:'floor_sand_01',

  groveStone:'floor_flagstone_01',
  cobble:'floor_cobblestone_01',

  groveMud:'floor_mud_01',
  swampPath:'floor_mud_01',
  swampMud:'floor_mud_01',

  swampGround:'floor_swamp_01',
  swampGroundFX:'floor_swamp_01',

  arcticGround:'floor_snow_01',

  floor:'floor_wood_01',
});

export const WORLD_FLOOR_PRESET_MATERIALS = Object.freeze({
  dirtGround:'floor_dirt_01',
  sandGround:'floor_sand_01',
  stoneGround:'floor_stone_01',
  gravelGround:'floor_gravel_01',
  mudGround:'floor_mud_01',
  snowGround:'floor_snow_01',
  iceGround:'floor_ice_01',
  swampFloor:'floor_swamp_01',
  caveGround:'floor_cave_01',
  cobblestoneGround:'floor_cobblestone_01',
  flagstoneGround:'floor_flagstone_01',
  woodFloor:'floor_wood_01',
  brickFloor:'floor_brick_01',
  marbleFloor:'floor_marble_01',
  tileFloor:'floor_tile_01',
  metalFloor:'floor_metal_01',
  concreteFloor:'floor_concrete_01',
});

export function worldFloorTexturePath(textureId) {
  return TerrainTextures.FLOOR_TEXTURE_PATHS[textureId] || null;
}

export function resolveWorldFloorTextureUrl(textureId, baseUrl = import.meta.url) {
  const rel = worldFloorTexturePath(textureId);
  return rel ? new URL('../../../' + rel, baseUrl).href : null;
}

function validTextureId(textureId) {
  return floorIds.includes(String(textureId || ''));
}

function ensureUserData(material) {
  if (!material.userData || typeof material.userData !== 'object') material.userData = {};
  return material.userData;
}

function setTextureRepeat(texture, repeat = [1, 1]) {
  if (!texture?.repeat || typeof texture.repeat.set !== 'function') return;
  const x = Math.max(.0001, Number(repeat?.[0]) || 1);
  const y = Math.max(.0001, Number(repeat?.[1]) || 1);
  texture.repeat.set(x, y);
}

function resetTextureTransform(texture) {
  if (!texture) return;
  try { texture.offset?.set?.(0, 0); } catch {}
  try { texture.center?.set?.(.5, .5); } catch {}
  if ('rotation' in texture) texture.rotation = 0;
}

function detachLegacySurfaceFilter(material, textureId) {
  if (!material) return;
  const data = ensureUserData(material);
  if (data.paperFXSurfaceConfig && !data.worldFloorLegacyPaperFX) {
    data.worldFloorLegacyPaperFX = data.paperFXSurfaceConfig;
  }
  data.paperFX = false;
  data.paperFXBehavior = 'world-floor-color';
  delete data.paperFXSurfaceConfig;
  delete data.paperFXMask;

  // PaperFX surface() overrides <map_fragment> and interprets map.r as a mask.
  // Repository floor PNGs are full-color albedo and must use the stock map shader.
  material.onBeforeCompile = () => {};
  material.customProgramCacheKey = () => `world-floor-color:${textureId}`;
}

export function createRepositoryWorldFloorTextureRuntime({
  THREE,
  mats,
  renderer = null,
  baseUrl = import.meta.url,
  logger = console,
  onMaterialTextureReady = null,
} = {}) {
  if (!THREE?.TextureLoader || !THREE?.MeshStandardMaterial) throw new Error('WORLD_FLOOR_THREE_REQUIRED');
  if (!mats || typeof mats !== 'object') throw new Error('WORLD_FLOOR_MATERIALS_REQUIRED');

  const loader = new THREE.TextureLoader();
  const textureTasks = new Map();
  const materialsByTextureId = new Map();
  const canonicalMaterials = Object.create(null);

  try { loader.setCrossOrigin?.('anonymous'); } catch {}

  const maxAnisotropy = Math.max(1, Number(renderer?.capabilities?.getMaxAnisotropy?.()) || 1);

  function registerMaterial(material, textureId, options = {}) {
    if (!material || !validTextureId(textureId)) return material || null;
    const data = ensureUserData(material);
    data.worldFloorTextureId = textureId;
    data.worldFloorTexturePath = worldFloorTexturePath(textureId);
    data.worldFloorTextureSource = 'repository-local';
    data.worldFloorRepeatPerTile = WORLD_FLOOR_REPEAT_PER_TILE;
    if (Array.isArray(options.repeat)) data.worldFloorRepeat = [Number(options.repeat[0]) || 1, Number(options.repeat[1]) || 1];
    if (!data.worldFloorTextureState) data.worldFloorTextureState = 'idle';

    if (!materialsByTextureId.has(textureId)) materialsByTextureId.set(textureId, new Set());
    materialsByTextureId.get(textureId).add(material);

    const task = textureTasks.get(textureId);
    if (task?.status === 'ready' && task.texture) applyLoadedTexture(material, textureId, task.texture);
    return material;
  }

  function applyLoadedTexture(material, textureId, sourceTexture) {
    if (!material || !sourceTexture) return null;
    const previous = material.map || null;
    const next = typeof sourceTexture.clone === 'function' ? sourceTexture.clone() : sourceTexture;

    const data = ensureUserData(material);
    next.wrapS = next.wrapT = THREE.RepeatWrapping;
    if ('colorSpace' in next && THREE.SRGBColorSpace) next.colorSpace = THREE.SRGBColorSpace;
    if ('magFilter' in next && THREE.LinearFilter) next.magFilter = THREE.LinearFilter;
    if ('minFilter' in next && THREE.LinearMipmapLinearFilter) next.minFilter = THREE.LinearMipmapLinearFilter;
    if ('anisotropy' in next) next.anisotropy = Math.min(maxAnisotropy, 8);
    resetTextureTransform(next);
    setTextureRepeat(next, data.worldFloorRepeat || [1, 1]);
    next.needsUpdate = true;

    detachLegacySurfaceFilter(material, textureId);
    material.map = next;
    if (material.color?.setHex) material.color.setHex(0xffffff);
    material.needsUpdate = true;

    data.worldFloorTextureState = 'ready';
    data.worldFloorTextureId = textureId;
    data.worldFloorTexturePath = worldFloorTexturePath(textureId);

    try {
      onMaterialTextureReady?.({
        material,
        textureId,
        path:data.worldFloorTexturePath,
        texture:next,
      });
    } catch (error) {
      logger?.warn?.('World floor texture refresh callback failed:', error);
    }
    return next;
  }

  function ensureTexture(textureId) {
    if (!validTextureId(textureId)) return Promise.resolve(null);
    const existing = textureTasks.get(textureId);
    if (existing) return existing.promise;

    const url = resolveWorldFloorTextureUrl(textureId, baseUrl);
    const task = { status:'loading', texture:null, error:null, promise:null };
    task.promise = new Promise((resolve) => {
      loader.load(
        url,
        (texture) => {
          task.status = 'ready';
          task.texture = texture;
          const targets = materialsByTextureId.get(textureId) || [];
          for (const material of targets) applyLoadedTexture(material, textureId, texture);
          resolve(texture);
        },
        undefined,
        (error) => {
          task.status = 'error';
          task.error = error || new Error('WORLD_FLOOR_TEXTURE_LOAD_FAILED');
          const targets = materialsByTextureId.get(textureId) || [];
          for (const material of targets) ensureUserData(material).worldFloorTextureState = 'error';
          logger?.warn?.('Repository floor texture failed; keeping procedural fallback:', textureId, url, error);
          resolve(null);
        },
      );
    });
    textureTasks.set(textureId, task);
    return task.promise;
  }

  function ensureMaterial(material) {
    const textureId = material?.userData?.worldFloorTextureId;
    return textureId ? ensureTexture(textureId) : Promise.resolve(null);
  }

  function materialForTextureId(textureId, { ensure = true } = {}) {
    const material = canonicalMaterials[textureId] || null;
    if (material && ensure) ensureMaterial(material);
    return material;
  }

  function materialForTerrain(terrain, options) {
    const textureId = TerrainTextures.floorTextureId(terrain);
    return textureId ? materialForTextureId(textureId, options) : null;
  }

  function status(textureId) {
    const task = textureTasks.get(textureId);
    return Object.freeze({
      textureId,
      path:worldFloorTexturePath(textureId),
      status:task?.status || 'idle',
      loaded:task?.status === 'ready',
    });
  }

  for (const textureId of floorIds) {
    const material = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:1, metalness:0 });
    const data = ensureUserData(material);
    data.paperRepeat = { u:.55, v:.55 };
    canonicalMaterials[textureId] = registerMaterial(material, textureId);
  }

  mats.worldFloorById = canonicalMaterials;

  for (const [materialName, textureId] of Object.entries(WORLD_FLOOR_MATERIAL_BINDINGS)) {
    if (mats[materialName]) registerMaterial(mats[materialName], textureId);
  }

  for (const [materialName, textureId] of Object.entries(WORLD_FLOOR_PRESET_MATERIALS)) {
    if (!mats[materialName]) {
      const material = new THREE.MeshStandardMaterial({
        color:0xffffff,
        roughness:textureId === 'floor_metal_01' ? .82 : 1,
        metalness:textureId === 'floor_metal_01' ? .18 : 0,
      });
      ensureUserData(material).paperRepeat = { u:.55, v:.55 };
      mats[materialName] = material;
    }
    registerMaterial(mats[materialName], textureId);
  }

  return Object.freeze({
    mode:'repository-local',
    floorIds,
    bindings:WORLD_FLOOR_MATERIAL_BINDINGS,
    presets:WORLD_FLOOR_PRESET_MATERIALS,
    registerMaterial,
    applyLoadedTexture,
    ensureTexture,
    ensureMaterial,
    materialForTextureId,
    materialForTerrain,
    status,
    texturePath:worldFloorTexturePath,
    textureUrl:(textureId) => resolveWorldFloorTextureUrl(textureId, baseUrl),
  });
}

export default Object.freeze({
  WORLD_FLOOR_TILES_PER_REPEAT,
  WORLD_FLOOR_REPEAT_PER_TILE,
  WORLD_FLOOR_MATERIAL_BINDINGS,
  WORLD_FLOOR_PRESET_MATERIALS,
  worldFloorRepeatForTiles,
  worldFloorTexturePath,
  resolveWorldFloorTextureUrl,
  createRepositoryWorldFloorTextureRuntime,
});
