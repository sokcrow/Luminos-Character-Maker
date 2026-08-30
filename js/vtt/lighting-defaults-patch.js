import './lighting-engine.js';

const base = window.LuminousVttLightingEngine;
if (base) {
  const finite = (value) => Number.isFinite(Number(value));
  const effectiveViewerCone = (viewer = {}) => finite(viewer.visionConeDeg)
    ? Math.max(1, Math.min(base.DEFAULT_VISION_CONE_DEG, Number(viewer.visionConeDeg)))
    : base.DEFAULT_VISION_CONE_DEG;
  const withViewerDefaults = (viewer = {}) => ({
    ...viewer,
    visionConeDeg: effectiveViewerCone(viewer),
  });
  const withSourceDefaults = (source = {}) => ({
    ...source,
    coneDeg: finite(source.coneDeg) ? Number(source.coneDeg) : 90,
  });
  const withSceneDefaults = (scene = {}) => ({
    ...scene,
    sources: (scene.sources || []).map(withSourceDefaults),
  });

  window.LuminousVttLightingEngine = Object.freeze({
    ...base,
    visionConeDeg: effectiveViewerCone,
    normalizeSource: (source, mapData) => base.normalizeSource(withSourceDefaults(source), mapData),
    sourcePosition: (source, mapData, nowMs) => base.sourcePosition(withSourceDefaults(source), mapData, nowMs),
    sourceLevelAtPoint: (source, point, scene, mapData, nowMs) => base.sourceLevelAtPoint(withSourceDefaults(source), point, withSceneDefaults(scene), mapData, nowMs),
    lightAtPoint: (point, scene, mapData, environment, nowMs) => base.lightAtPoint(point, withSceneDefaults(scene), mapData, environment, nowMs),
    perceptionAtPoint: (viewer, point, scene, mapData, environment, nowMs) => base.perceptionAtPoint(withViewerDefaults(viewer), point, withSceneDefaults(scene), mapData, environment, nowMs),
  });
}
