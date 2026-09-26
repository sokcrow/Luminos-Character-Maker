function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeUnitIntent(intent = {}) {
  return {
    moveX: finite(intent.moveX ?? intent.x),
    moveZ: finite(intent.moveZ ?? intent.z),
    sprint: Boolean(intent.sprint),
    action: intent.action ?? null
  };
}

export class UnitControllerSystem {
  update(unit, dt, context = {}) {
    const controller = unit?.controller;
    let intent = null;

    if (typeof controller === "function") {
      intent = controller(unit, dt, context);
    } else if (controller?.resolveIntent) {
      intent = controller.resolveIntent(unit, dt, context);
    } else if (controller?.intent) {
      intent = controller.intent;
    }

    const normalized = normalizeUnitIntent(intent || {});
    unit.movement.intentX = normalized.moveX;
    unit.movement.intentZ = normalized.moveZ;
    unit.metadata.lastIntent = normalized;
    return normalized;
  }
}
