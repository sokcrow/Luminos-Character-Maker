import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { createProceduralMapData } from "../src/map/procedural/ProceduralMapGenerator.js";

const legacyCalls = { terrain: 0, water: 0, movement: 0 };
const legacyBridge = {
  contract: "legacy-html-map.v1",
  currentMapId: "legacy-forest-view",
  sampleTerrain() {
    legacyCalls.terrain += 1;
    return { source: "html", moveMultiplier: 0.1 };
  },
  sampleWater() {
    legacyCalls.water += 1;
    return { bodyId: "html-water" };
  },
  resolveMovement({ proposed }) {
    legacyCalls.movement += 1;
    return proposed;
  },
  presentMap() {},
  updateMap() {}
};

const spec = {
  id: "procedural-runtime-map",
  kind: "procedural-biome",
  seed: "procedural-authority-seed",
  bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 },
  altitude: 2.6,
  moisture: 0.78,
  aridity: 0.12,
  scale: 1,
  biome: "colinas templadas",
  biomeProfile: "temperate",
  landform: { hills: 0.72, rolling: 0.32, ridges: 0.18 },
  hydrology: { type: "river" },
  metadata: { region: "gC" }
};

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
runtime.connectView({ LuminousWorldMovementBridge: legacyBridge });
runtime.registerProceduralMap(spec);
await runtime.loadMap(spec.id);

let snapshot = runtime.snapshot();
assert.equal(snapshot.map.mapId, spec.id);
assert.equal(snapshot.map.authority, "module");
assert.equal(snapshot.map.active.kind, "procedural-biome");
assert.equal(snapshot.map.active.metadata.generator, "ProceduralMapGenerator");

const generated = runtime.map.active.data;
assert.equal(generated.metadata.authority, "map-module");
assert.equal(generated.hydrology.type, "river");
assert.equal(typeof generated.sampleTerrain, "function");
assert.equal(typeof generated.sampleWater, "function");
assert.equal(typeof generated.resolveMovement, "function");

const riverCenter = generated.hydrology.field.points[1];
const water = runtime.map.sampleWater(riverCenter);
assert.equal(water?.type, "river");
assert.equal(water?.source, "procedural-map-module");
assert.ok(water.depth > 0, "Procedural river should have measurable depth at its center line");

const probe = { x: 3.25, y: 0, z: -4.5 };
const terrain = runtime.map.sampleTerrain(probe);
assert.equal(terrain.source, "procedural-map-module");
assert.ok(Number.isFinite(terrain.height));
assert.ok(Number.isFinite(terrain.moveMultiplier));

const twin = createProceduralMapData(spec);
const twinTerrain = twin.sampleTerrain(probe);
assert.deepEqual(twin.hydrology.field.points, generated.hydrology.field.points, "Same seed must create the same hydrology geometry");
assert.equal(twinTerrain.height, terrain.height, "Same seed and coordinates must produce the same terrain height");
assert.equal(twinTerrain.slopeBand, terrain.slopeBand);

assert.equal(legacyCalls.terrain, 0, "Procedural module must not ask the HTML for terrain");
assert.equal(legacyCalls.water, 0, "Procedural module must not ask the HTML for water");
assert.equal(legacyCalls.movement, 0, "Procedural module must not ask the HTML to resolve movement");

const unit = runtime.registerUnit({
  id: "procedural-runtime-unit",
  role: "player",
  transform: { x: 0, y: 0, z: 0 },
  movement: { speed: 100, maxSpeed: 100 },
  controller: {
    resolveIntent() {
      return { moveX: 1, moveZ: 0 };
    }
  }
});

engine.update(1);
assert.equal(unit.transform.x, spec.bounds.maxX, "Procedural MapSystem must own movement bounds");
assert.ok(Number.isFinite(unit.transform.y), "Procedural terrain must resolve the unit elevation");
assert.equal(unit.metadata.environment.mapId, spec.id);

const beforeDisconnect = runtime.map.sampleTerrain(probe);
runtime.disconnectView();
snapshot = runtime.snapshot();
assert.equal(snapshot.connected, false);
assert.equal(snapshot.map.mapId, spec.id, "Procedural map must survive view/HTML disconnect");
assert.equal(snapshot.map.authority, "module");
assert.equal(snapshot.map.bridge.available, false);

const afterDisconnect = runtime.map.sampleTerrain(probe);
assert.deepEqual(afterDisconnect, beforeDisconnect, "Procedural terrain must remain stable without the HTML view");
assert.equal(legacyCalls.terrain, 0);
assert.equal(legacyCalls.water, 0);
assert.equal(legacyCalls.movement, 0);

engine.dispose();
console.log("procedural-map-runtime-smoke: ok");
