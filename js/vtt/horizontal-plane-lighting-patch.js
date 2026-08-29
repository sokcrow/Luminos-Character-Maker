import './floor-opening-core.js';
import './horizontal-plane-core.js';
import './lighting-engine.js';
import './pov-engine.js';
import './horizontal-plane-perception-patch.js';

export const installed=Boolean(globalThis.LuminousVttHorizontalPlanePerceptionPatch?.install?.());
