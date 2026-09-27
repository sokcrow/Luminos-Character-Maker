import assert from "node:assert/strict";
import {
  CRYSTAL_CAVE_CONTRACT_ID,
  CRYSTAL_CAVE_WATER_VISUAL,
  createCrystalCaveData
} from "../src/map/procedural/CrystalCaveGenerator.js";

const cave=createCrystalCaveData({
  id:"crystalCave",
  seed:"pr819-cave-water-smoke",
  bounds:{minX:-24,maxX:24,minZ:-24,maxZ:24},
  waterSurfaceTiles:-.18,
  waterDepthTiles:.82
});

assert.equal(CRYSTAL_CAVE_CONTRACT_ID,"luminous.crystal-cave-procedural.v2");
assert.equal(cave.metadata.authority,"map-module");
assert.equal(cave.metadata.hydrologyAuthority,"terrain-water-shared-field");
assert.equal(CRYSTAL_CAVE_WATER_VISUAL.color,0x3278de);
assert.equal(CRYSTAL_CAVE_WATER_VISUAL.opacity,1);
assert.equal(CRYSTAL_CAVE_WATER_VISUAL.patternMask.enabled,true);
assert.equal(CRYSTAL_CAVE_WATER_VISUAL.patternMask.backgroundColor,0x3278de);

const water=cave.water;
const center=cave.sampleWater({x:water.cx,z:water.cz});
assert.ok(center,"lake center must be water");
assert.ok(center.depth>.6,"lake center must have meaningful depth");
assert.ok(Math.abs(center.depth-(center.waterSurfaceTiles-center.groundHeightTiles))<1e-9,
  "water depth must equal surface minus the same cave ground field");

const nearEdge=cave.sampleWater({x:water.cx+water.rx*.985,z:water.cz});
assert.ok(nearEdge,"inside shoreline must still sample water");
assert.ok(nearEdge.depth<center.depth,"depth must increase continuously away from shoreline");
assert.ok(nearEdge.depth<.08,"shoreline must start shallow rather than drop to a fixed legacy depth");

const bankGround=cave.floorHeightTilesAt(water.cx+water.rx*1.05,water.cz);
const dryGround=cave.floorHeightTilesAt(water.cx+water.rx*1.20,water.cz);
assert.ok(bankGround<dryGround+.25,"bank grading must remain continuous outside the shoreline");
assert.equal(cave.sampleWater({x:water.cx+water.rx*1.01,z:water.cz}),null,
  "outside the shoreline must not be treated as water");

assert.equal(typeof cave.resolveMovement,"undefined",
  "CrystalCaveGenerator must not own player movement; Unit runtime remains authoritative");
assert.ok(cave.surfaces.some(s=>s.locomotion==="swim"),"map adapter must receive swim surfaces");
assert.ok(cave.surfaces.some(s=>s.terrain==="stone"),"map adapter must receive ground surfaces");

console.log("crystal cave modular water contract: ok");
