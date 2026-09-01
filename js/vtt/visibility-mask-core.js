(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttVisibilityMaskCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULT_LOOK_STEP_DEG = 2;
  const DEFAULT_LOOK_THROTTLE_MS = 50;

  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim();

  function normalizeAngleDeg(value) {
    const angle = num(value, 0) % 360;
    return angle < 0 ? angle + 360 : angle;
  }

  function signedAngleDeltaDeg(a, b) {
    let delta = normalizeAngleDeg(a) - normalizeAngleDeg(b);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function quantizeAngleDeg(value, stepDeg = DEFAULT_LOOK_STEP_DEG) {
    const step = Math.max(0.1, num(stepDeg, DEFAULT_LOOK_STEP_DEG));
    return normalizeAngleDeg(Math.round(normalizeAngleDeg(value) / step) * step);
  }

  function meaningfulAngleChange(previous, next, stepDeg = DEFAULT_LOOK_STEP_DEG) {
    if (!Number.isFinite(Number(previous))) return true;
    return Math.abs(signedAngleDeltaDeg(quantizeAngleDeg(next, stepDeg), quantizeAngleDeg(previous, stepDeg))) >= Math.max(0.1, num(stepDeg, DEFAULT_LOOK_STEP_DEG)) - 1e-9;
  }

  function viewerSignature(viewer = {}) {
    return [
      clean(viewer.id),
      num(viewer.x),
      num(viewer.y),
      num(viewer.zLayer ?? viewer.gridPosition?.z ?? viewer.z?.[0]),
      num(viewer.elevationFt),
      quantizeAngleDeg(viewer.lookDeg ?? viewer.facingDeg),
      num(viewer.eyeHeightFt, 5),
      num(viewer.visionConeDeg, 120),
      num(viewer.senses?.darkvisionFt ?? viewer.darkvisionFt),
    ];
  }

  function topologySignature(mapData = {}) {
    return (Array.isArray(mapData.topology) ? mapData.topology : []).map((element) => [
      clean(element?.id),
      clean(element?.type),
      clean(element?.state),
      num(element?.zLayer ?? element?.z),
      num(element?.a?.col ?? element?.x1),
      num(element?.a?.row ?? element?.y1),
      num(element?.b?.col ?? element?.x2),
      num(element?.b?.row ?? element?.y2),
      element?.blocksVision !== false,
    ]);
  }

  function wallsSignature(mapData = {}) {
    return (Array.isArray(mapData.walls) ? mapData.walls : []).map((wall) => [
      clean(wall?.id), num(wall?.x1), num(wall?.y1), num(wall?.x2), num(wall?.y2), wall?.z ?? wall?.zLayer ?? 0, wall?.blocksVision !== false,
    ]);
  }

  function portalsSignature(mapData = {}) {
    return (Array.isArray(mapData.verticalPortals) ? mapData.verticalPortals : []).map((portal) => [
      clean(portal?.id), clean(portal?.type), clean(portal?.state), portal?.from?.z ?? portal?.fromZ ?? null, portal?.to?.z ?? portal?.toZ ?? null,
    ]);
  }

  function lightSceneSignature(scene = {}) {
    const sources = (Array.isArray(scene.sources) ? scene.sources : []).map((source) => [
      clean(source?.id), num(source?.x), num(source?.y), num(source?.zLayer), num(source?.elevationFt), source?.enabled !== false,
      source?.functional !== false, num(source?.brightFt), num(source?.dimAdditionalFt), clean(source?.shape), num(source?.directionDeg),
      num(source?.coneDeg), clean(source?.circuitId), source?.motion?.startedAt ?? null, source?.motion?.durationMs ?? null,
    ]);
    const interiors = (Array.isArray(scene.interiors) ? scene.interiors : []).map((zone) => [
      clean(zone?.id), num(zone?.x1 ?? zone?.x), num(zone?.y1 ?? zone?.y), num(zone?.x2 ?? (num(zone?.x) + num(zone?.width))),
      num(zone?.y2 ?? (num(zone?.y) + num(zone?.height))), num(zone?.zLayer), clean(zone?.baseLight), zone?.roof?.present !== false,
      zone?.roof?.transparent === true,
    ]);
    const roofs = (Array.isArray(scene.roofs) ? scene.roofs : []).map((roof) => [
      clean(roof?.id), num(roof?.x1 ?? roof?.x), num(roof?.y1 ?? roof?.y), num(roof?.x2 ?? (num(roof?.x) + num(roof?.width))),
      num(roof?.y2 ?? (num(roof?.y) + num(roof?.height))), num(roof?.zLayer), num(roof?.elevationFt), roof?.transparent === true,
    ]);
    const switches = (Array.isArray(scene.switches) ? scene.switches : []).map((entry) => [clean(entry?.id), clean(entry?.circuitId), clean(entry?.state), entry?.enabled !== false]);
    const transformers = (Array.isArray(scene.transformers) ? scene.transformers : []).map((entry) => [clean(entry?.id), entry?.powered !== false, entry?.damaged === true, entry?.circuits || []]);
    return { sources, interiors, roofs, switches, transformers };
  }

  function visibilityFingerprint({ viewers = [], viewZ = 0, lookUp = false, mapData = {}, scene = {}, environment = null, motionTick = 0 } = {}) {
    return JSON.stringify({
      z: num(viewZ),
      lookUp: Boolean(lookUp),
      viewers: (Array.isArray(viewers) ? viewers : []).map(viewerSignature),
      topology: topologySignature(mapData),
      walls: wallsSignature(mapData),
      portals: portalsSignature(mapData),
      scene: lightSceneSignature(scene),
      environment,
      motionTick: num(motionTick),
    });
  }

  function cellsFromTiles(tiles = [], mapData = {}, cellKey = (col, row) => `${col},${row}`) {
    const size = Math.max(1, num(mapData.grid?.size, 70));
    const cols = Math.max(1, Math.trunc(num(mapData.grid?.cols, 1)));
    const rows = Math.max(1, Math.trunc(num(mapData.grid?.rows, 1)));
    const result = new Set();
    for (const tile of Array.isArray(tiles) ? tiles : []) {
      const x1 = num(tile?.x), y1 = num(tile?.y), x2 = x1 + Math.max(0, num(tile?.w)), y2 = y1 + Math.max(0, num(tile?.h));
      const minCol = Math.max(0, Math.min(cols - 1, Math.floor(x1 / size)));
      const maxCol = Math.max(0, Math.min(cols - 1, Math.floor(Math.max(x1, x2 - 1e-6) / size)));
      const minRow = Math.max(0, Math.min(rows - 1, Math.floor(y1 / size)));
      const maxRow = Math.max(0, Math.min(rows - 1, Math.floor(Math.max(y1, y2 - 1e-6) / size)));
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) result.add(cellKey(col, row));
      }
    }
    return result;
  }

  return Object.freeze({
    DEFAULT_LOOK_STEP_DEG,
    DEFAULT_LOOK_THROTTLE_MS,
    normalizeAngleDeg,
    signedAngleDeltaDeg,
    quantizeAngleDeg,
    meaningfulAngleChange,
    viewerSignature,
    topologySignature,
    wallsSignature,
    portalsSignature,
    lightSceneSignature,
    visibilityFingerprint,
    cellsFromTiles,
  });
});
