import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";

const legacyCalls = {
  terrain: 0,
  water: 0,
  movement: 0,
  presented: [],
  updated: 0
};

const legacyViewBridge = {
  contract: "legacy-html-map.v1",
  currentMapId: "html-legacy-map",
  sampleTerrain() {
    legacyCalls.terrain += 1;
    return { moveMultiplier: 0.1, source: "html" };
  },
  sampleWater() {
    legacyCalls.water += 1;
    return { bodyId: "html-water" };
  },
  resolveMovement({ proposed }) {
    legacyCalls.movement += 1;
    return { ...proposed, x: -999 };
  },
  presentMap(payload) {
    legacyCalls.presented.push(payload?.id || null);
  },
  updateMap() {
    legacyCalls.updated += 1;
  }
};

const moduleCalls = {
  generated: 0,
  terrain: 0,
  water: 0,
  movement: 0,
  updates: 0
};

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
runtime.connectView({ LuminousWorldMovementBridge: legacyViewBridge });

runtime.registerMap({
  id: "module-map",
  kind: "procedural-test",
  seed: "authority-seed",
  metadata: { authority: "map-module" },
  async generate() {
    moduleCalls.generated += 1;
    return {
      sampleTerrain(point) {
        moduleCalls.terrain += 1;
        return {
          height: 2,
          slopeBand: "flat",
          moveMultiplier: 0.5,
          source: "module",
          point: { x: point.x, z: point.z }
        };
      },
      sampleWater(point) {
        moduleCalls.water += 1;
        return point.x >= 3 ? { bodyId: "module-river", depth: 0.75 } : null;
      },
      resolveMovement({ proposed }) {
        moduleCalls.movement += 1;
        return { ...proposed, x: Math.min(3, proposed.x) };
      },
      update() {
        moduleCalls.updates += 1;
      }
    };
  }
});

await runtime.loadMap("module-map");

let snapshot = runtime.snapshot();
assert.equal(snapshot.map.mapId, "module-map");
assert.equal(snapshot.map.authority, "module");
assert.equal(snapshot.map.active.kind, "procedural-test");
assert.ok(legacyCalls.presented.includes("module-map"), "View bridge should receive the module map only for presentation");
assert.equal(moduleCalls.generated, 1, "Map generation must execute in the module runtime");

const unit = runtime.registerUnit({
  id: "map-authority-unit",
  role: "npc",
  transform: { x: 0, y: 0, z: 0 },
  movement: { speed: 10, maxSpeed: 10 },
  controller: {
    resolveIntent() {
      return { moveX: 1, moveZ: 0 };
    }
  }
});

engine.update(1);

assert.equal(unit.transform.x, 3, "Module movement resolver must be authoritative");
assert.equal(unit.metadata.lastMovement.terrainMultiplier, 0.5, "Module terrain sampler must drive Unit movement");
assert.equal(unit.metadata.environment.water.bodyId, "module-river", "Module water sampler must drive environment state");
assert.ok(moduleCalls.terrain >= 2);
assert.ok(moduleCalls.water >= 1);
assert.equal(moduleCalls.movement, 1);
assert.ok(moduleCalls.updates >= 1);
assert.equal(legacyCalls.terrain, 0, "HTML terrain sampler must not run while a module map is active");
assert.equal(legacyCalls.water, 0, "HTML water sampler must not run while a module map is active");
assert.equal(legacyCalls.movement, 0, "HTML movement resolver must not run while a module map is active");

runtime.disconnectView();
snapshot = runtime.snapshot();
assert.equal(snapshot.connected, false);
assert.equal(snapshot.map.mapId, "module-map", "Module map must survive without the HTML view");
assert.equal(snapshot.map.authority, "module");
assert.equal(snapshot.map.bridge.available, false);

unit.transform.x = 0;
unit.transform.z = 0;
engine.update(1);
assert.equal(unit.transform.x, 3, "Map runtime must continue working after the HTML/view disconnects");
assert.equal(unit.metadata.environment.water.bodyId, "module-river");

engine.dispose();
console.log("map-runtime-authority-smoke: ok");
