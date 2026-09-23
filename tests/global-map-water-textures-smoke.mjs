import assert from 'node:assert/strict';
import WaterTextures, {
  isLakeRegion,
  isRiverRoute,
  lakeProfile,
  riverProfile,
  riverScreenWidth,
  styleForWaterRegion,
  waterSeed,
} from '../js/global-map-water-textures.js';

const legacyLake = { id:'legacy-water', layer:'water', terrain:'lake', metadata:null };
assert.equal(isLakeRegion(legacyLake), false, 'legacy water stays semantically untyped');
assert.equal(WaterTextures.isWaterBodyRegion(legacyLake), true, 'legacy water must receive the visual water renderer');
assert.notDeepEqual(styleForWaterRegion(legacyLake), WaterTextures.LEGACY_WATER_STYLE, 'legacy water should now render with the water-body visual');

const lake = {
  id:'lake_a',
  layer:'water',
  terrain:'lake',
  metadata:{ waterType:'lake', depth:0.75, shoreRoughness:0.6, waveIntensity:0.4 },
};
assert.equal(isLakeRegion(lake), true);
const lakeP = lakeProfile(lake, 'world-7');
assert.equal(lakeP.depth, 0.75);
assert.equal(lakeP.shoreRoughness, 0.6);
assert.equal(lakeP.waveIntensity, 0.4);
assert.ok(lakeP.rippleCount > 5);
assert.notDeepEqual(styleForWaterRegion(lake), WaterTextures.LEGACY_WATER_STYLE);

const clampedLake = lakeProfile({
  id:'lake_b',
  layer:'water',
  metadata:{ waterType:'lago', depth:9, shoreRoughness:-4, waveIntensity:2 },
});
assert.equal(clampedLake.depth, 1);
assert.equal(clampedLake.shoreRoughness, 0);
assert.equal(clampedLake.waveIntensity, 1);

const legacyWaterway = { id:'old-river', type:'waterway', points:[{xKm:0,yKm:0},{xKm:1,yKm:1}], metadata:null };
assert.equal(isRiverRoute(legacyWaterway), false, 'legacy waterways stay semantically untyped');
assert.equal(WaterTextures.isWaterwayRoute(legacyWaterway), true, 'legacy waterways must receive the river visual renderer');

const river = {
  id:'river_a',
  type:'waterway',
  metadata:{ waterType:'river', riverWidthKm:12, flow:0.8, bankRoughness:0.45, waterDepth:0.7 },
};
assert.equal(isRiverRoute(river), true);
const riverP = riverProfile(river, 'world-7');
assert.equal(riverP.widthKm, 12);
assert.equal(riverP.flow, 0.8);
assert.equal(riverP.bankRoughness, 0.45);
assert.equal(riverP.depth, 0.7);

const defaultRiver = riverProfile({ id:'river_default', type:'waterway', metadata:{ waterType:'rio' } });
assert.equal(defaultRiver.widthKm, WaterTextures.DEFAULT_RIVER_WIDTH_KM);
assert.equal(defaultRiver.flow, WaterTextures.DEFAULT_RIVER_FLOW);
assert.equal(defaultRiver.bankRoughness, WaterTextures.DEFAULT_RIVER_BANK_ROUGHNESS);
assert.equal(defaultRiver.depth, WaterTextures.DEFAULT_RIVER_DEPTH);

const clampedRiver = riverProfile({
  id:'river_b',
  type:'waterway',
  metadata:{ waterType:'river', riverWidthKm:999, flow:-3, bankRoughness:8, waterDepth:5 },
});
assert.equal(clampedRiver.widthKm, 80);
assert.equal(clampedRiver.flow, 0);
assert.equal(clampedRiver.bankRoughness, 1);
assert.equal(clampedRiver.depth, 1);

assert.ok(riverScreenWidth(river, 0.5) > riverScreenWidth({ ...river, metadata:{ ...river.metadata, riverWidthKm:2 } }, 0.5));
assert.equal(riverScreenWidth({ ...river, metadata:{ ...river.metadata, riverWidthKm:0.2 } }, 0.01), 2);
assert.equal(riverScreenWidth({ ...river, metadata:{ ...river.metadata, riverWidthKm:80 } }, 4), 42);

const seedA = waterSeed(lake, 'world-7', 'lake');
const seedB = waterSeed(lake, 'world-7', 'lake');
const seedC = waterSeed({ ...lake, metadata:{ ...lake.metadata, waveIntensity:0.8 } }, 'world-7', 'lake');
assert.equal(seedA, seedB, 'same water inputs must produce stable texture seed');
assert.notEqual(seedA, seedC, 'visual metadata changes must alter deterministic texture seed');

assert.equal(isLakeRegion({ ...lake, layer:'terrain' }), false);
assert.equal(isRiverRoute({ ...river, type:'road' }), false);

console.log('global map water textures smoke: ok');
