import assert from "node:assert/strict";
import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { RUNTIME_CONTRACTS } from "../src/core/RuntimeContracts.js";
import {
  normalizeProceduralMapSpec,
  proceduralMapSpecViolations,
  PROCEDURAL_MAP_SPEC_CONTRACT_ID
} from "../src/map/procedural/ProceduralMapSpec.js";
import { UNIT_RUNTIME_CONTRACT_ID, unitContractViolations } from "../src/units/UnitRegistry.js";
import { UNIT_STATE_CONTRACT_ID } from "../src/units/UnitState.js";
import {
  createHudViewModel,
  hudViewModelViolations,
  HUD_VIEW_MODEL_CONTRACT_ID
} from "../src/ui/HudViewModel.js";

assert.equal(RUNTIME_CONTRACTS.unitRuntime, UNIT_RUNTIME_CONTRACT_ID);
assert.equal(RUNTIME_CONTRACTS.unitState, UNIT_STATE_CONTRACT_ID);
assert.equal(RUNTIME_CONTRACTS.proceduralMapSpec, PROCEDURAL_MAP_SPEC_CONTRACT_ID);
assert.equal(RUNTIME_CONTRACTS.hudViewModel, HUD_VIEW_MODEL_CONTRACT_ID);

const spec = normalizeProceduralMapSpec({
  id: "contract-map",
  seed: "contract-map-seed",
  bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 },
  biome: "colinas templadas",
  landform: { hills: 0.6 },
  hydrology: { type: "river" }
});
assert.deepEqual(proceduralMapSpecViolations(spec), []);
assert.equal(spec.metadata.contract, PROCEDURAL_MAP_SPEC_CONTRACT_ID);
assert.equal(Object.isFrozen(spec), true);

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
runtime.registerProceduralMap(spec);
await runtime.loadMap(spec.id);

const unit = runtime.registerUnit({
  id: "contract-unit",
  role: "player",
  movement: { speed: 4, maxSpeed: 4 },
  controller: { resolveIntent: () => ({ moveX: 1, moveZ: 0 }) }
}, { cameraTarget: true });

assert.deepEqual(unitContractViolations(unit), []);
assert.equal(unit.runtimeContract, UNIT_RUNTIME_CONTRACT_ID);
assert.equal(unit.stateContract, UNIT_STATE_CONTRACT_ID);

engine.update(0.25);
const hud = createHudViewModel({ engine, runtime, unitId: unit.id });
assert.deepEqual(hudViewModelViolations(hud), []);
assert.equal(hud.contract, HUD_VIEW_MODEL_CONTRACT_ID);
assert.equal(hud.map.id, spec.id);
assert.equal(hud.map.authority, "module");
assert.equal(hud.map.contract, PROCEDURAL_MAP_SPEC_CONTRACT_ID);
assert.equal(hud.unit.id, unit.id);
assert.equal(hud.unit.runtimeContract, UNIT_RUNTIME_CONTRACT_ID);
assert.equal(hud.unit.stateContract, UNIT_STATE_CONTRACT_ID);
assert.equal(hud.camera.targetUnitId, unit.id);

engine.dispose();
console.log("runtime-contracts-smoke: ok");
