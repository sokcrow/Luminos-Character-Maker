import { ensureUnitRuntimeState } from "./UnitState.js";

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizedDirection(x, z) {
  const length = Math.hypot(x, z);
  if (!length) return { x: 0, z: 0, length: 0 };
  return { x: x / length, z: z / length, length };
}

export class UnitMovementSystem {
  update(unit, dt, context = {}) {
    const state = ensureUnitRuntimeState(unit);
    const mapSystem = context.mapSystem || null;
    const movement = unit.movement;
    const transform = unit.transform;
    const direction = normalizedDirection(state.movement.desiredX, state.movement.desiredZ);
    const baseSpeed = Math.min(
      Math.max(0, finite(movement.speed)),
      Math.max(0, finite(movement.maxSpeed, movement.speed)) || Math.max(0, finite(movement.speed))
    );
    const terrain = mapSystem?.sampleTerrain?.(transform) || null;
    const terrainMultiplier = Math.max(0, finite(terrain?.moveMultiplier, 1));
    const mobilityMultiplier = Math.max(0, finite(unit.mobility?.multiplier, 1));
    const speedScale = Math.max(0, finite(state.movement.speedScale, 1));
    const speed = baseSpeed * terrainMultiplier * mobilityMultiplier * speedScale;
    const distance = speed * Math.max(0, finite(dt));

    const from = { x: transform.x, y: transform.y, z: transform.z };
    const proposed = {
      x: transform.x + direction.x * distance,
      y: transform.y,
      z: transform.z + direction.z * distance
    };
    const resolved = mapSystem?.resolveMovement?.(unit, from, proposed, dt) || proposed;

    const velocityX = dt > 0 ? (resolved.x - transform.x) / dt : 0;
    const velocityY = dt > 0 ? (resolved.y - transform.y) / dt : 0;
    const velocityZ = dt > 0 ? (resolved.z - transform.z) / dt : 0;
    state.velocity.x = velocityX;
    state.velocity.y = velocityY;
    state.velocity.z = velocityZ;
    movement.velocityX = velocityX;
    movement.velocityY = velocityY;
    movement.velocityZ = velocityZ;

    transform.x = finite(resolved.x, transform.x);
    transform.y = finite(resolved.y, transform.y);
    transform.z = finite(resolved.z, transform.z);
    if (direction.length) {
      transform.yaw = Math.atan2(direction.x, direction.z);
      state.movement.lastDirX = direction.x;
      state.movement.lastDirZ = direction.z;
      const facing = direction.x < 0 ? -1 : direction.x > 0 ? 1 : state.facing.targetSign;
      state.facing.targetSign = facing;
    }

    const moved = Math.hypot(transform.x - from.x, transform.z - from.z);
    state.movement.movedDistanceFrame = moved;
    state.movement.movedDistance += moved;
    state.movement.lastX = transform.x;
    state.movement.lastZ = transform.z;
    state.movement.speedFactor = terrainMultiplier * mobilityMultiplier * speedScale;

    unit.mobility.terrainSample = terrain;
    unit.metadata.lastMovement = {
      dt,
      speed,
      terrainMultiplier,
      mobilityMultiplier,
      speedScale,
      from,
      to: { x: transform.x, y: transform.y, z: transform.z }
    };
    return unit.metadata.lastMovement;
  }
}
