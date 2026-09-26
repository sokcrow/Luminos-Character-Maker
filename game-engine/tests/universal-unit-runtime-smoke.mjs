import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { UNIT_RUNTIME_CONTRACT_ID, unitContractViolations } from "../src/units/UnitRegistry.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();

runtime.map.attachBridge({
  sampleTerrain() {
    return { moveMultiplier: 0.5, slopeBand: "flat" };
  },
  sampleWater() {
    return null;
  }
});

const sharedController = {
  resolveIntent() {
    return { moveX: 1, moveZ: 0, sprint: false };
  }
};

const player = runtime.registerUnit({
  id: "hero",
  role: "player",
  tags: ["player"],
  transform: { x: 0, y: 0, z: 0 },
  movement: { speed: 10, maxSpeed: 10 },
  controller: sharedController
});

const npc = runtime.registerUnit({
  id: "npc-1",
  role: "npc",
  tags: ["npc"],
  transform: { x: 0, y: 0, z: 0 },
  movement: { speed: 10, maxSpeed: 10 },
  controller: sharedController
});

assert.equal(player.runtimeContract, UNIT_RUNTIME_CONTRACT_ID);
assert.equal(npc.runtimeContract, UNIT_RUNTIME_CONTRACT_ID);
assert.deepEqual(unitContractViolations(player), []);
assert.deepEqual(unitContractViolations(npc), []);

engine.update(1);

assert.equal(player.transform.x, 5);
assert.equal(npc.transform.x, 5);
assert.equal(player.transform.z, npc.transform.z);
assert.equal(player.movement.velocityX, npc.movement.velocityX);
assert.equal(player.metadata.lastMovement.terrainMultiplier, 0.5);
assert.equal(npc.metadata.lastMovement.terrainMultiplier, 0.5);
assert.notEqual(player.role, npc.role);
assert.deepEqual(
  { x: player.transform.x, y: player.transform.y, z: player.transform.z },
  { x: npc.transform.x, y: npc.transform.y, z: npc.transform.z },
  "Player and NPC with equivalent state/input must use identical movement physics"
);

engine.dispose();
console.log("universal-unit-runtime-smoke: ok");
