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
assert.equal(cave.chunkSize,128,"Mine Floor 1 must use 128x128 chunks");
assert.equal(cave.chunks.length,2,"Mine Floor 1 must consist of exactly two chunks");
assert.deepEqual(cave.bounds,{x0:0,x1:256,z0:0,z1:128},"two horizontal chunks must form a 256x128 tile floor");
assert.equal(cave.chunks[0].x1,cave.chunks[1].x0,"chunk A and B must share one seamless vertical boundary");
assert.equal(cave.metadata.layoutAuthority,"authored-two-chunk");
assert.equal(cave.metadata.layout,"mine-floor-1-blueprint");
assert.equal(cave.blockedDoors.length,2,"blueprint must keep both blocked doors");
assert.equal(cave.loot.length,4,"blueprint must keep all four loot anchors");
assert.equal(cave.encounters.length,5,"blueprint must keep miners, bats, scavengers and boss anchors");
assert.ok(cave.dressing.length>=30,"mine rooms must be visibly dressed instead of empty");
assert.ok(cave.chasms.length>=2,"reference rift must exist as real non-floor geometry");
assert.equal(cave.contains(173,75),false,"main rift center must not be walkable floor");
assert.equal(cave.contains(170,61),true,"bridge must remain walkable across the rift");
assert.ok(cave.corridors.some(x=>x.route==="primary"),"yellow primary route must exist");
assert.ok(cave.corridors.some(x=>x.route==="secondary"),"blue secondary route must exist");
assert.ok(cave.crystals.every(x=>/^#[0-9a-f]{6}$/i.test(x.color)),"every authored crystal must carry its own glow color");
assert.ok(cave.facilityLights.length>=20,"installations must have authored lighting coverage");
assert.ok(cave.facilityLights.every(x=>Number(x.intensity)>0&&Number(x.range)>0),"facility light specs must be physically meaningful");
assert.ok(cave.crystalLightZones.length>=4,"major crystal zones must provide colored fill light");
assert.ok(cave.crystalLightZones.every(x=>Number(x.intensity)>.5&&Number(x.range)>=8),"crystal zones must visibly illuminate the cave");
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
