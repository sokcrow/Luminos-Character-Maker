function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value, digits = 3) {
  const number = finite(value);
  const scale = 10 ** digits;
  return Math.round(number * scale) / scale;
}

export const HUD_VIEW_MODEL_CONTRACT_ID = "luminous.hud-view-model.v1";

export function createHudViewModel({ engine, runtime, unitId = null } = {}) {
  if (!engine) throw new Error("HUD view model requires GameEngine");
  if (!runtime) throw new Error("HUD view model requires GameRuntime");

  const runtimeSnapshot = runtime.snapshot();
  const targetId = unitId || runtimeSnapshot.camera.targetUnitId || runtimeSnapshot.units[0]?.id || null;
  const unit = targetId ? runtime.units.get(targetId) : null;
  const terrain = unit ? runtime.map.sampleTerrain(unit.transform) : null;
  const water = unit ? runtime.map.sampleWater(unit.transform) : null;
  const resources = unit?.components?.resources || unit?.metadata?.resources || null;

  return Object.freeze({
    contract: HUD_VIEW_MODEL_CONTRACT_ID,
    engine: Object.freeze({ ...engine.metrics() }),
    map: Object.freeze({
      id: runtimeSnapshot.map.mapId,
      authority: runtimeSnapshot.map.authority,
      kind: runtimeSnapshot.map.active?.kind || null,
      generator: runtimeSnapshot.map.active?.metadata?.generator || null,
      contract: runtimeSnapshot.map.active?.metadata?.contract || null
    }),
    camera: Object.freeze({
      targetUnitId: runtimeSnapshot.camera.targetUnitId,
      profile: runtimeSnapshot.camera.profile?.id || runtimeSnapshot.camera.profile || null,
      bridgeAvailable: Boolean(runtimeSnapshot.camera.bridge?.available)
    }),
    unit: unit ? Object.freeze({
      id: unit.id,
      role: unit.role,
      runtimeContract: unit.runtimeContract,
      stateContract: unit.stateContract,
      locomotion: unit.state?.locomotion || null,
      transform: Object.freeze({
        x: rounded(unit.transform.x),
        y: rounded(unit.transform.y),
        z: rounded(unit.transform.z),
        yaw: rounded(unit.transform.yaw)
      }),
      velocity: Object.freeze({
        x: rounded(unit.movement.velocityX),
        y: rounded(unit.movement.velocityY),
        z: rounded(unit.movement.velocityZ)
      }),
      terrain: terrain ? Object.freeze({
        height: rounded(terrain.height),
        slopeBand: terrain.slopeBand || null,
        moveMultiplier: finite(terrain.moveMultiplier, 1),
        source: terrain.source || null
      }) : null,
      water: water ? Object.freeze({
        type: water.type || null,
        depth: rounded(water.depth),
        source: water.source || null
      }) : null,
      resources: resources ? Object.freeze({ ...resources }) : null
    }) : null
  });
}

export function hudViewModelViolations(model) {
  const violations = [];
  if (!model || typeof model !== "object") return ["hud_missing"];
  if (model.contract !== HUD_VIEW_MODEL_CONTRACT_ID) violations.push("contract_mismatch");
  if (!model.engine) violations.push("engine_missing");
  if (!model.map) violations.push("map_missing");
  if (!model.camera) violations.push("camera_missing");
  return violations;
}
