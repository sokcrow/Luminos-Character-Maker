import { HUD_VIEW_MODEL_CONTRACT_ID } from "../ui/HudViewModel.js";
import { PROCEDURAL_MAP_SPEC_CONTRACT_ID } from "../map/procedural/ProceduralMapSpec.js";
import { UNIT_RUNTIME_CONTRACT_ID } from "../units/UnitRegistry.js";
import { UNIT_STATE_CONTRACT_ID } from "../units/UnitState.js";

export const RUNTIME_CONTRACTS = Object.freeze({
  unitRuntime: UNIT_RUNTIME_CONTRACT_ID,
  unitState: UNIT_STATE_CONTRACT_ID,
  proceduralMapSpec: PROCEDURAL_MAP_SPEC_CONTRACT_ID,
  hudViewModel: HUD_VIEW_MODEL_CONTRACT_ID
});

export function runtimeContractsSnapshot() {
  return { ...RUNTIME_CONTRACTS };
}
