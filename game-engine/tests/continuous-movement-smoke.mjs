import assert from "node:assert/strict";
import { WORLD_SPACE_CONTRACT, worldUnitsToFeet } from "../src/world/WorldSpaceContract.js";
import { TERRAIN_SLOPE_STANDARD, terrainSlopeBand, resolveTerrainSlopeTraversal, resolveTerrainSlopeSlide, resolveTerrainMoveMultiplier } from "../src/world/TerrainMobility.js";
import { CombatMovementTracker, measureContinuousPath } from "../src/world/ContinuousMovement.js";
import { footprintDistanceFeet, oppositionAngleDegrees } from "../src/world/CombatGeometry.js";

assert.equal(WORLD_SPACE_CONTRACT.grid.playerVisible, false);
assert.equal(WORLD_SPACE_CONTRACT.grid.combatEndpointSnapping, false);
assert.equal(worldUnitsToFeet(1.5), 5);
assert.equal(worldUnitsToFeet(3), 10);
assert.equal(resolveTerrainMoveMultiplier({ moveMultiplier: .72, tags: ["difficult", "bushes"] }), .5);
assert.equal(TERRAIN_SLOPE_STANDARD.normalDeg, 24);
assert.equal(TERRAIN_SLOPE_STANDARD.difficultDeg, 34);
assert.equal(TERRAIN_SLOPE_STANDARD.maxWalkDeg, 43);
assert.equal(terrainSlopeBand(20), "normal");
assert.equal(terrainSlopeBand(30), "incline");
assert.equal(terrainSlopeBand(38), "steep");
assert.equal(terrainSlopeBand(48), "blocked");
assert.equal(resolveTerrainMoveMultiplier({ walkable:true, slopeDeg:30 }), .82);
assert.equal(resolveTerrainMoveMultiplier({ walkable:true, slopeDeg:38 }), .68);
assert.equal(resolveTerrainMoveMultiplier({ walkable:true, slopeDeg:48 }), 0);
assert.equal(resolveTerrainSlopeTraversal({ slopeDeg:48, climbable:true }).climbable, true);
assert.equal(resolveTerrainMoveMultiplier({ walkable:true, slopeDeg:48, climbable:true }), 0);
assert.equal(resolveTerrainMoveMultiplier({ walkable:true, slopeDeg:48, allowSteepTraversal:true }), .68);
assert.equal(resolveTerrainMoveMultiplier({ walkable:true, slopeDeg:60, locomotion:"swim" }), 1, "ground slope must not slow or block swimming");
const downhillSlide = resolveTerrainSlopeSlide({ slopeDeg:55, hx:1, hz:0, locomotion:"ground" });
assert.equal(downhillSlide.active, true, "downhill slide must remain available on blocked natural slopes");
assert.equal(Math.round(downhillSlide.downhillX * 100) / 100, -1);
assert.equal(Math.round(downhillSlide.downhillZ * 100) / 100, 0);
assert.equal(Object.is(downhillSlide.downhillZ, -0), false, "slide vectors must normalize signed zero for runtime/strict assertions");
assert.equal(downhillSlide.speedMultiplier, TERRAIN_SLOPE_STANDARD.slideMultiplier);
assert.equal(resolveTerrainSlopeSlide({ slopeDeg:38, hx:1, hz:0 }).active, false);
assert.equal(resolveTerrainSlopeSlide({ slopeDeg:60, hx:1, hz:0, locomotion:"swim" }).active, false);


const normal = measureContinuousPath([{ x: 0, z: 0 }, { x: 3, z: 0 }]);
assert.equal(Math.round(normal.pathDistanceFt), 10);
assert.equal(Math.round(normal.movementCostFt), 10);

const difficult = measureContinuousPath([{ x: 0, z: 0 }, { x: 3, z: 0 }], {
  terrainSampler: () => ({ walkable: true, tags: ["difficult"], moveMultiplier: .72 })
});
assert.equal(Math.round(difficult.pathDistanceFt), 10);
assert.equal(Math.round(difficult.movementCostFt), 20);

const tracker = new CombatMovementTracker();
tracker.beginTurn({ unitId: "hero", start: { x: 0, z: 0 }, movementFt: 30 });
assert.equal(tracker.commitPath([{ x: 0, z: 0 }, { x: 3, z: 0 }]).ok, true);
tracker.setTerrainSampler(() => ({ tags: ["difficult"] }));
const second = tracker.commitPath([{ x: 3, z: 0 }, { x: 6, z: 0 }]);
assert.equal(second.ok, true);
assert.equal(Math.round(second.turn.remainingFt), 0);
const rejected = tracker.commitPath([{ x: 6, z: 0 }, { x: 6.3, z: 0 }]);
assert.equal(rejected.ok, false);
assert.equal(rejected.reason, "movement_budget_exceeded");
assert.equal(Math.round(tracker.snapshot().current.x), 6);

const blocked = measureContinuousPath([{ x: 0, z: 0 }, { x: 1.5, z: 0 }], {
  terrainSampler: () => ({ walkable: false })
});
assert.equal(blocked.blocked, true);

assert.equal(Math.round(footprintDistanceFeet(
  { x: 0, z: 0, radiusWorld: .3 },
  { x: 1.5, z: 0, radiusWorld: .3 }
) * 10) / 10, 3);
assert.equal(Math.round(oppositionAngleDegrees({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: -1, z: 0 })), 180);

console.log("continuous movement smoke: ok");
