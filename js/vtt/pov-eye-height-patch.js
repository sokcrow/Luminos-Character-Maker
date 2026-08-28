import './pov-engine.js';

const base = window.LuminousVttPovEngine;
if (base && !base.__eyePointDistancePatched) {
  function perceptionAtPoint(viewer = {}, target = {}, scene = {}, mapData = {}, environment = {}, now = Date.now(), options = {}) {
    if (!options.lookUp || base.layerOf(target) <= base.layerOf(viewer)) {
      return base.perceptionAtPoint(viewer, target, scene, mapData, environment, now, options);
    }

    // Look Up originates at the creature's eyes, not at the token's feet/base elevation.
    // Set eyeHeightFt to zero after lifting elevationFt so the base PoV engine does not
    // apply eye height a second time for roof rays or 3D lighting distance.
    const eye = base.eyePoint(viewer, mapData);
    const eyeViewer = { ...viewer, elevationFt: eye.elevationFt, eyeHeightFt: 0 };
    return base.perceptionAtPoint(eyeViewer, target, scene, mapData, environment, now, options);
  }

  window.LuminousVttPovEngine = Object.freeze({
    ...base,
    __eyePointDistancePatched: true,
    perceptionAtPoint,
  });
}
