import assert from "node:assert/strict";
import { WORLD_SPACE_CONTRACT, worldUnitsToFeet } from "../src/world/WorldSpaceContract.js";
import { resolveTerrainMoveMultiplier } from "../src/world/TerrainMobility.js";
import { CombatMovementTracker, measureContinuousPath } from "../src/world/ContinuousMovement.js";
import { footprintDistanceFeet, oppositionAngleDegrees } from "../src/world/CombatGeometry.js";

assert.equal(WORLD_SPACE_CONTRACT.grid.playerVisible, false);
assert.equal(WORLD_SPACE_CONTRACT.grid.combatEndpointSnapping, false);
assert.equal(worldUnitsToFeet(1.5), 5);
assert.equal(worldUnitsToFeet(3), 10);
assert.equal(resolveTerrainMoveMultiplier({ moveMultiplier: .72, tags: ["difficult", "bushes"] }), .5);

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
