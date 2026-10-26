import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { UNIT_RUNTIME_CONTRACT_ID, unitContractViolations } from "../src/units/UnitRegistry.js";
import { UNIT_STATE_CONTRACT_ID } from "../src/units/UnitState.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();

runtime.map.attachBridge({
  sampleTerrain() {
    return { height: 0, moveMultiplier: 0.5, slopeBand: "flat" };
  },
  sampleWater() {
    return null;
  }
});

const sharedController = {
  resolveIntent() {
    return { moveX: 1, moveZ: 0, sprint: false, speedScale: 1 };
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
assert.equal(player.state.contract, UNIT_STATE_CONTRACT_ID);
assert.equal(npc.state.contract, UNIT_STATE_CONTRACT_ID);
assert.deepEqual(unitContractViolations(player), []);
assert.deepEqual(unitContractViolations(npc), []);

for (const unit of [player, npc]) {
  assert.equal(unit.state.locomotion, "ground");
  assert.deepEqual(unit.state.velocity, { x: 0, y: 0, z: 0 });
  assert.equal(unit.state.vertical.falling, false);
  assert.equal(unit.state.buoyancy.active, false);
  assert.equal(unit.state.environment.water, null);
  assert.equal(unit.state.animation.state, "idle");
  assert.equal(unit.state.controllerState.intent, unit.intent);
}

engine.update(1);

assert.equal(player.transform.x, 5);
assert.equal(npc.transform.x, 5);
assert.equal(player.transform.z, npc.transform.z);
assert.equal(player.movement.velocityX, npc.movement.velocityX);
assert.equal(player.state.velocity.x, player.movement.velocityX);
assert.equal(npc.state.velocity.x, npc.movement.velocityX);
assert.equal(player.state.movement.desiredX, 1);
assert.equal(npc.state.movement.desiredX, 1);
assert.equal(player.state.movement.movedDistance, 5);
assert.equal(npc.state.movement.movedDistance, 5);
assert.equal(player.state.environment.mapId, runtime.map.activeMapId());
assert.equal(npc.state.environment.mapId, runtime.map.activeMapId());
assert.equal(player.metadata.lastMovement.terrainMultiplier, 0.5);
assert.equal(npc.metadata.lastMovement.terrainMultiplier, 0.5);
assert.notEqual(player.role, npc.role);
assert.deepEqual(
  { x: player.transform.x, y: player.transform.y, z: player.transform.z },
  { x: npc.transform.x, y: npc.transform.y, z: npc.transform.z },
  "Player and NPC with equivalent state/input must use identical movement physics"
);
assert.deepEqual(
  player.state.velocity,
  npc.state.velocity,
  "Player and NPC must expose equivalent authoritative velocity state"
);

engine.dispose();
console.log("universal-unit-runtime-smoke: ok");
