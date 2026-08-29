import './surface-core.js';
import './floor-opening-core.js';
import './floor-opening-terrain-patch.js';
import './elevator-floor-support-patch.js';
import './elevator-terrain-patch.js';

globalThis.LuminousVttFloorOpeningTerrainPatch?.install?.();
globalThis.LuminousVttElevatorFloorSupportPatch?.install?.();
globalThis.LuminousVttElevatorTerrainPatch?.install?.();
