import { ensureUnitRuntimeState } from "./UnitState.js";

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeUnitIntent(intent = {}) {
  return {
    moveX: finite(intent.moveX ?? intent.x),
    moveZ: finite(intent.moveZ ?? intent.z),
    speedScale: Math.max(0, finite(intent.speedScale, 1)),
    sprint: Boolean(intent.sprint),
    action: intent.action ?? null,
    wantsRun: Boolean(intent.wantsRun ?? intent.sprint),
    wantsInteract: Boolean(intent.wantsInteract),
    wantsTalk: Boolean(intent.wantsTalk),
    wantsUse: Boolean(intent.wantsUse)
  };
}

export class UnitControllerSystem {
  update(unit, dt, context = {}) {
    const state = ensureUnitRuntimeState(unit);
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
    Object.assign(unit.intent, normalized);
    state.controllerState.intent = unit.intent;
    state.movement.desiredX = normalized.moveX;
    state.movement.desiredZ = normalized.moveZ;
    state.movement.speedScale = normalized.speedScale;

    // Compatibility mirrors for view/content code while Unit.state is authoritative.
    unit.movement.intentX = normalized.moveX;
    unit.movement.intentZ = normalized.moveZ;
    unit.metadata.lastIntent = normalized;
    return normalized;
  }
}
