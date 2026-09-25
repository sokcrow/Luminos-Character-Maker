import assert from "node:assert/strict";
import {
  TERRAIN_SURFACE_STANDARD,
  terrainSurfaceTierForSlope,
  terrainSurfaceMaterialKinds,
  terrainSurfaceMaterialKind,
} from "../src/world/TerrainSurfaceStandard.js";

assert.equal(terrainSurfaceTierForSlope(12), "base");
assert.equal(terrainSurfaceTierForSlope(29), "transition");
assert.equal(terrainSurfaceTierForSlope(38), "rock");
assert.equal(terrainSurfaceTierForSlope(50), "rock");
assert.deepEqual(
  terrainSurfaceMaterialKinds({ biomeProfile:"forest", baseKind:"forestGround" }),
  { base:"forestGround", transition:"dirtGround", rock:"stoneGround" }
);
assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"desert", baseKind:"desertGround", slopeDeg:30 }), "gravelGround");
assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"grassland", baseKind:"grasslandGround", slopeDeg:38 }), "stoneGround");
assert.equal(TERRAIN_SURFACE_STANDARD.thresholds.maxWalkDeg, 43);

console.log("terrain surface standard smoke: ok");
