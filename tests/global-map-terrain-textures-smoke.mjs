import assert from 'node:assert/strict';
import TerrainTextures, {
  terrainKind,
  mountainSpines,
  roughnessForSpines,
  textureSeed,
  textureProfile,
  FLOOR_TEXTURE_IDS,
  floorTextureId,
  floorTexturePath,
  drawFloorTexture,
  drawTerrainTexture,
} from '../js/global-map-terrain-textures.js';

assert.equal(terrainKind('mountain'), 'mountain');
assert.equal(terrainKind('montaña_alta'), 'mountain');
assert.equal(terrainKind('sierra_rocosas'), 'mountain');
assert.equal(terrainKind('forest'), 'forest');
assert.equal(terrainKind('playa'), 'beach');
assert.equal(terrainKind('urban'), 'default');

assert.equal(FLOOR_TEXTURE_IDS.length, 18);
assert.equal(floorTextureId('grass'), 'floor_grass_01');
assert.equal(floorTextureId('cobblestone'), 'floor_cobblestone_01');
assert.equal(floorTextureId({ terrain:'snow' }), 'floor_snow_01');
assert.equal(floorTexturePath('floor_concrete_01'), 'Assets/Images/World/Floors/floor_concrete_01.png');
assert.equal(floorTexturePath('unknown_surface'), null);

const textureCalls = [];
const pattern = {
  transform:null,
  setTransform(value) { this.transform = value; },
};
const fakeCtx = {
  globalAlpha:1,
  fillStyle:null,
  save() { textureCalls.push('save'); },
  restore() { textureCalls.push('restore'); },
  beginPath() { textureCalls.push('beginPath'); },
  moveTo() {},
  lineTo() {},
  closePath() {},
  clip() { textureCalls.push('clip'); },
  createPattern(image, repetition) {
    textureCalls.push(['createPattern', image, repetition]);
    return pattern;
  },
  fillRect(x, y, width, height) {
    textureCalls.push(['fillRect', x, y, width, height]);
  },
};
const fakeTextureImage = { complete:true, naturalWidth:256, width:256 };
const polygon = [{x:10,y:20},{x:210,y:20},{x:210,y:140},{x:10,y:140}];

const floorDraw = drawFloorTexture(fakeCtx, { terrain:'grass' }, polygon, {
  textureImage:fakeTextureImage,
  tileSizePx:64,
});
assert.equal(floorDraw.id, 'floor_grass_01');
assert.equal(floorDraw.path, 'Assets/Images/World/Floors/floor_grass_01.png');
assert.equal(floorDraw.drawn, true, 'local floor texture must be drawn');
assert.equal(pattern.transform.a, 0.25);
assert.ok(textureCalls.some((entry) => Array.isArray(entry) && entry[0] === 'createPattern' && entry[2] === 'repeat'));
assert.ok(textureCalls.some((entry) => Array.isArray(entry) && entry[0] === 'fillRect'));

const terrainDraw = drawTerrainTexture(fakeCtx, { terrain:'dirt' }, polygon, {
  textureImage:fakeTextureImage,
  tileSizePx:64,
});
assert.equal(terrainDraw.id, 'floor_dirt_01', 'terrain renderer must use local floor textures');

assert.equal(mountainSpines({ terrain:'mountain', metadata:{} }), 5);
assert.equal(mountainSpines({ terrain:'mountain', metadata:{ mountainSpines:0 } }), 0);
assert.equal(mountainSpines({ terrain:'mountain', metadata:{ mountainSpines:99 } }), 12);
assert.equal(mountainSpines({ terrain:'mountain', metadata:{ ridgeDensity:0.5 } }), 6);

const smooth = roughnessForSpines(0);
const middle = roughnessForSpines(6);
const rough = roughnessForSpines(12);
assert.ok(smooth < middle && middle < rough, 'roughness must increase with mountain spines');
assert.ok(smooth >= 0 && rough <= 1, 'roughness must remain normalized');

const lowProfile = textureProfile({ id:'ridge', terrain:'mountain', metadata:{ mountainSpines:2 } });
const highProfile = textureProfile({ id:'ridge', terrain:'mountain', metadata:{ mountainSpines:11 } });
assert.ok(lowProfile.ridgeCount < highProfile.ridgeCount);
assert.ok(lowProfile.facetCount < highProfile.facetCount);
assert.ok(lowProfile.roughness < highProfile.roughness);

const a = textureSeed({ id:'north', terrain:'mountain', metadata:{ mountainSpines:8 } }, 'world-42');
const b = textureSeed({ id:'north', terrain:'mountain', metadata:{ mountainSpines:8 } }, 'world-42');
const c = textureSeed({ id:'north', terrain:'mountain', metadata:{ mountainSpines:9 } }, 'world-42');
assert.equal(a, b, 'same world/region/spines must produce stable mountain texture');
assert.notEqual(a, c, 'changing spines must change deterministic mountain texture seed');

assert.equal(TerrainTextures.styleForRegion({ terrain:'plains' }).fill, 'rgba(78,91,75,.38)');
assert.notEqual(TerrainTextures.styleForRegion({ terrain:'mountain' }).fill, 'rgba(78,91,75,.38)');

console.log('global map terrain textures smoke: ok');
