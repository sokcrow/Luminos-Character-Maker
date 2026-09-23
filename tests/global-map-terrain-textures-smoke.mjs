import assert from 'node:assert/strict';
import TerrainTextures, {
  terrainKind,
  mountainSpines,
  roughnessForSpines,
  textureSeed,
  textureProfile,
} from '../js/global-map-terrain-textures.js';

assert.equal(terrainKind('mountain'), 'mountain');
assert.equal(terrainKind('montaña_alta'), 'mountain');
assert.equal(terrainKind('sierra_rocosas'), 'mountain');
assert.equal(terrainKind('forest'), 'forest');
assert.equal(terrainKind('playa'), 'beach');
assert.equal(terrainKind('urban'), 'default');

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
