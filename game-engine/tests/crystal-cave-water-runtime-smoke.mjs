import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCrystalCaveRuntimeData } from "../src/map/procedural/CrystalCaveGenerator.js";

const cave = createCrystalCaveRuntimeData({
  seed: "pr819-water-contract-smoke",
  bounds: { x0: -24, x1: 24, z0: -24, z1: 24 },
  water: { surfaceTiles: -.18, maxDepthTiles: .92, shoreDepthTiles: .035, bankOuterRatio: 1.30 }
});

assert.equal(cave.metadata.authority, "map-module");
assert.equal(cave.metadata.hydrology, "continuous-depth-field");
assert.ok(cave.surfaces.length > 0);
assert.ok(cave.route.length >= 12);
assert.equal(typeof cave.floorHeightTilesAt, "function");
assert.equal(typeof cave.sampleWater, "function");

const w = cave.water;
const center = cave.sampleWater({ x: w.cx, z: w.cz });
assert.ok(center, "lake center must be water");
assert.equal(center.surface, w.surfaceTiles);
assert.ok(center.depth > .45, "lake center must have meaningful depth");
assert.ok(Math.abs((center.surface - center.ground) - center.depth) < 1e-9, "depth must equal water surface minus cave ground");

const edge = cave.sampleWater({ x: w.cx + w.rx * .97, z: w.cz });
assert.ok(edge, "inside shoreline must still be water");
assert.ok(edge.depth > 0 && edge.depth < center.depth, "depth must ramp continuously from shore to center");

const outside = cave.sampleWater({ x: w.cx + w.rx * 1.08, z: w.cz });
assert.equal(outside, null, "outside shoreline must not report water");

const shoreGround = cave.floorHeightTilesAt(w.cx + w.rx, w.cz);
const outerBankGround = cave.floorHeightTilesAt(w.cx + w.rx * w.bankOuterRatio, w.cz);
assert.ok(shoreGround < w.surfaceTiles, "shore bed must remain below the water plane");
assert.ok(outerBankGround > shoreGround, "bank must grade upward away from the shoreline");

const forest = await readFile(new URL("../lab/game/forest-0.3.3.1.html", import.meta.url), "utf8");
assert.match(forest, /CrystalCaveGenerator\.js/);
assert.match(forest, /createCrystalCaveRuntimeData/);
assert.doesNotMatch(forest, /function createCrystalCavePlan\(/);
assert.match(forest, /MAP_MODULE_RUNTIME_DATA=new Map\(\[\['crystalCave',CRYSTAL_CAVE_PLAN\]\]\)/);
assert.match(forest, /renderedGroundY=terrainSurfaceGroundYAtWorld\(x,z,mapId\)/);
assert.match(forest, /id:'crystal-cave-underground-lake'/);
assert.match(forest, /surface:\{renderOrder:-4,depthWrite:true\}/);
assert.match(forest, /backgroundColor:0x3278de/);
assert.match(forest, /opacity:1/);
assert.match(forest, /surfaceHeightAt:\(\)=>lakeSurfaceY/);
assert.match(forest, /persistentVisionBlocker=true/);
assert.match(forest, /streamingPolicy='always-loaded'/);
assert.match(forest, /m\.userData\?\.persistentVisionBlocker/);
assert.doesNotMatch(forest, /crystal-cave-wall-[\s\S]{0,260}stressStreamCandidate='rock'/,
  "cave wall meshes must never enter prop streaming");
assert.match(forest, /crystalGlowColor/);
assert.match(forest, /new THREE\.PointLight\(colorHex/);
assert.match(forest, /blending:THREE\.AdditiveBlending/);
assert.match(forest, /for\(const p of \(plan\.dressing\|\|\[\]\)\)/);
assert.match(forest, /mine-loot-chest/);
assert.match(forest, /mine-blocked-door/);
assert.match(forest, /mine-encounter-/);
assert.match(forest, /authoredBlueprint:'mine-floor-1'/);
assert.match(forest, /for\(const lightSpec of \(plan\.facilityLights\|\|\[\]\)\)facilityLights\.push\(mineLamp\(lightSpec\)\)/);
assert.match(forest, /mineFacilityLight=true/);
assert.match(forest, /mineFacilityLightPool=true/);
assert.match(forest, /crystalZoneLight=true/);
assert.match(forest, /crystalZonePool=true/);
assert.match(forest, /emissiveIntensity:1\.85/);
assert.match(forest, /authored-facility\+per-crystal\+crystal-zone-glow/);

console.log("crystal cave water runtime smoke: ok");
