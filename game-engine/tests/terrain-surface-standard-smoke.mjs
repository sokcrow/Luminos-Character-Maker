import assert from "node:assert/strict";
import {
  TERRAIN_SURFACE_STANDARD,
  terrainSurfaceProfileKey,
  terrainSurfaceProfile,
  terrainSurfaceTierForSlope,
  terrainSurfaceMaterialKinds,
  terrainSurfaceMaterialKind,
  terrainCoastMaterialKinds,
  terrainCoastSurfaceWeights,
} from "../src/world/TerrainSurfaceStandard.js";

assert.equal(terrainSurfaceTierForSlope(12), "base");
assert.equal(terrainSurfaceTierForSlope(29), "transition");
assert.equal(terrainSurfaceTierForSlope(38), "rock");
assert.equal(terrainSurfaceTierForSlope(50), "rock");

assert.equal(terrainSurfaceProfileKey("ARCTIC"), "arctic");
assert.equal(terrainSurfaceProfileKey("unknown-biome"), "temperate");
assert.deepEqual(terrainSurfaceProfile("desert"), {
  base:"desertGround", transition:"gravelGround", rock:"stoneGround"
});

const expectedProfiles = {
  temperate:{ base:"forestGround", transition:"dirtGround", rock:"stoneGround" },
  forest:{ base:"forestGround", transition:"dirtGround", rock:"stoneGround" },
  grassland:{ base:"grasslandGround", transition:"dirtGround", rock:"stoneGround" },
  desert:{ base:"desertGround", transition:"gravelGround", rock:"stoneGround" },
  swamp:{ base:"swampGround", transition:"mudGround", rock:"stoneGround" },
  arctic:{ base:"arcticGround", transition:"gravelGround", rock:"stoneGround" },
};

const expectedCoasts = {
  temperate:{ shore:"beachGround", base:"forestGround", transition:"dirtGround", rock:"stoneGround" },
  forest:{ shore:"beachGround", base:"forestGround", transition:"dirtGround", rock:"stoneGround" },
  grassland:{ shore:"beachGround", base:"grasslandGround", transition:"dirtGround", rock:"stoneGround" },
  desert:{ shore:"beachGround", base:"desertGround", transition:"gravelGround", rock:"stoneGround" },
  swamp:{ shore:"mudGround", base:"swampGround", transition:"mudGround", rock:"stoneGround" },
  arctic:{ shore:"gravelGround", base:"arcticGround", transition:"gravelGround", rock:"stoneGround" },
};
for (const [biomeProfile, expected] of Object.entries(expectedProfiles)) {
  assert.deepEqual(terrainSurfaceMaterialKinds({ biomeProfile }), expected);
  assert.deepEqual(terrainCoastMaterialKinds({ biomeProfile }), expectedCoasts[biomeProfile]);
  // forestGround used to be supplied as a universal default by procedural maps.
  // Non-temperate biomes must now resolve it back to their own authoritative base.
  assert.equal(
    terrainSurfaceMaterialKinds({ biomeProfile, baseKind:"forestGround" }).base,
    expected.base
  );
}

assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"desert", slopeDeg:12 }), "desertGround");
assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"desert", slopeDeg:30 }), "gravelGround");
assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"grassland", slopeDeg:38 }), "stoneGround");
assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"arctic", slopeDeg:12 }), "arcticGround");
assert.equal(terrainSurfaceMaterialKind({ biomeProfile:"swamp", slopeDeg:30 }), "mudGround");

// Authored local materials still win when they are intentional, and an explicit
// override is available for the rare case that a biome truly wants forestGround.
assert.equal(terrainSurfaceMaterialKinds({ biomeProfile:"arctic", baseKind:"groveStone" }).base, "groveStone");
assert.equal(terrainSurfaceMaterialKinds({ biomeProfile:"desert", baseOverride:"forestGround" }).base, "forestGround");

const flatBeach = terrainCoastSurfaceWeights({ distanceTiles:1, slopeDeg:8 });
assert.ok(flatBeach.shore > .9);
const inlandFlat = terrainCoastSurfaceWeights({ distanceTiles:9, slopeDeg:8 });
assert.ok(inlandFlat.base > .95);
const inlandIncline = terrainCoastSurfaceWeights({ distanceTiles:9, slopeDeg:30 });
assert.ok(inlandIncline.transition > 0);
const cliff = terrainCoastSurfaceWeights({ distanceTiles:1, slopeDeg:50 });
assert.ok(cliff.rock > .99);
for (const sample of [flatBeach,inlandFlat,inlandIncline,cliff]) {
  const total=sample.shore+sample.base+sample.transition+sample.rock;
  assert.ok(Math.abs(total-1)<1e-9);
}
assert.equal(TERRAIN_SURFACE_STANDARD.thresholds.maxWalkDeg, 43);

console.log("terrain surface standard smoke: ok");
