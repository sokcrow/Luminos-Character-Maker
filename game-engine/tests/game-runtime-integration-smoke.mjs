import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";

const calls = {
  movement: [],
  cameraTargets: [],
  cameraUpdates: []
};

const worldBridge = {
  contract: "luminous.runtime-integration-test.v1",
  currentMapId: "forest-runtime-test",
  grid: { playerVisible: false },
  cameraProfile: "runtime-test",

  sampleTerrain(x, z) {
    assert.equal(typeof x, "number");
    assert.equal(typeof z, "number");
    return {
      moveMultiplier: 0.5,
      slopeBand: "flat",
      height: 0,
      water: x >= 5 ? { bodyId: "river-test", depth: 1 } : null
    };
  },

  sampleWater(x) {
    return x >= 5 ? { bodyId: "river-test", depth: 1 } : null;
  },

  resolveMovement(payload) {
    calls.movement.push(payload);
    return {
      x: Math.min(5, payload.proposed.x),
      y: payload.proposed.y,
      z: payload.proposed.z
    };
  },

  setCameraTarget(target, profile) {
    calls.cameraTargets.push({ target: target ? { ...target } : null, profile });
  },

  updateCamera(payload) {
    calls.cameraUpdates.push({
      ...payload,
      target: payload.target ? { ...payload.target } : null
    });
  }
};

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();

assert.equal(engine.metrics().systems, 3, "Map, Units and Camera must mount as independent engine systems");

const connected = runtime.connectView({ LuminousWorldMovementBridge: worldBridge });
assert.equal(connected.connected, true);
assert.equal(connected.map.available, true);
assert.equal(connected.map.contract, worldBridge.contract);
assert.equal(connected.map.mapId, "forest-runtime-test");

const sharedController = {
  resolveIntent() {
    return { moveX: 1, moveZ: 0, sprint: false };
  }
};

const player = runtime.registerUnit({
  id: "hero",
  role: "player",
  transform: { x: 0, y: 0, z: 0 },
  movement: { speed: 10, maxSpeed: 10 },
  controller: sharedController
}, { cameraTarget: true });

const npc = runtime.registerUnit({
  id: "npc-runtime-test",
  role: "npc",
  transform: { x: 0, y: 0, z: 0 },
  movement: { speed: 10, maxSpeed: 10 },
  controller: sharedController
});

assert.equal(calls.cameraTargets.length, 1, "Camera target must be sent to the connected Forest bridge");
assert.equal(calls.cameraTargets[0].target.x, 0);

engine.update(1);

assert.equal(player.transform.x, 5, "Player movement must resolve through MapSystem");
assert.equal(npc.transform.x, 5, "NPC movement must resolve through the same MapSystem");
assert.equal(player.movement.velocityX, npc.movement.velocityX);
assert.equal(calls.movement.length, 2, "Both Units must use the shared movement bridge");

assert.equal(player.metadata.environment.mapId, "forest-runtime-test");
assert.equal(player.metadata.environment.water.bodyId, "river-test");
assert.equal(npc.metadata.environment.water.bodyId, "river-test");

assert.equal(calls.cameraUpdates.length, 1, "CameraSystem must update after the target Unit moves");
assert.equal(calls.cameraUpdates[0].unitId, "hero");
assert.equal(calls.cameraUpdates[0].target.x, 5, "Camera must receive the Unit transform produced by the shared runtime");

const liveSnapshot = runtime.snapshot();
assert.equal(liveSnapshot.connected, true);
assert.equal(liveSnapshot.units.length, 2);
assert.equal(liveSnapshot.camera.targetUnitId, "hero");

runtime.disconnectView();
const disconnected = runtime.snapshot();
assert.equal(disconnected.connected, false);
assert.equal(disconnected.map.available, false, "Map bridge must detach cleanly");
assert.equal(disconnected.camera.bridge.available, false, "Camera bridge must detach cleanly");

engine.dispose();
assert.equal(engine.metrics().disposed, true);

console.log("game-runtime-integration-smoke: ok");
