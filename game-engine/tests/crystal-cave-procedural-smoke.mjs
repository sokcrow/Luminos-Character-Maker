import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { createCrystalCaveData, createCrystalCaveDefinition, CRYSTAL_CAVE_CONTRACT_ID } from "../src/map/procedural/CrystalCaveGenerator.js";

const spec={id:"crystal-cave-test",seed:"pastel-42",bounds:{minX:-160,maxX:160,minZ:-160,maxZ:160},chunkSize:24,activeRadius:2};
const a=createCrystalCaveData(spec),b=createCrystalCaveData(spec);
assert.equal(a.metadata.contract,CRYSTAL_CAVE_CONTRACT_ID);
assert.deepEqual(a.chunksAround({x:0,z:0}),b.chunksAround({x:0,z:0}),"same seed must reproduce cave chunks");
assert.equal(a.chunksAround({x:0,z:0}).length,25,"radius 2 streams 5x5 nearby chunks");
assert.ok(a.chunksAround({x:0,z:0}).some(c=>c.open),"spawn neighborhood must contain cave");
assert.ok(a.chunksAround({x:0,z:0}).flatMap(c=>c.crystals).length>0,"crystal cave must place pastel crystal instances");

const engine=new GameEngine();const runtime=new GameRuntime({engine}).mount();
runtime.registerMap(createCrystalCaveDefinition(spec));await runtime.loadMap(spec.id);
assert.equal(runtime.snapshot().map.authority,"module");
assert.equal(runtime.snapshot().map.active.metadata.generator,"CrystalCaveGenerator");
assert.equal(typeof runtime.map.active.data.chunksAround,"function");
assert.equal(runtime.map.active.data.metadata.streaming,"nearby-chunks");
engine.dispose();
console.log("crystal-cave-procedural-smoke: ok");
