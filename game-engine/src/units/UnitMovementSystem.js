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
    const mapSystem = context.mapSystem || null;
    const movement = unit.movement;
    const transform = unit.transform;
    const direction = normalizedDirection(movement.intentX, movement.intentZ);
    const baseSpeed = Math.min(
      Math.max(0, finite(movement.speed)),
      Math.max(0, finite(movement.maxSpeed, movement.speed)) || Math.max(0, finite(movement.speed))
    );
    const terrain = mapSystem?.sampleTerrain?.(transform) || null;
    const terrainMultiplier = Math.max(0, finite(terrain?.moveMultiplier, 1));
    const mobilityMultiplier = Math.max(0, finite(unit.mobility?.multiplier, 1));
    const speed = baseSpeed * terrainMultiplier * mobilityMultiplier;
    const distance = speed * Math.max(0, finite(dt));

    const from = { x: transform.x, y: transform.y, z: transform.z };
    const proposed = {
      x: transform.x + direction.x * distance,
      y: transform.y,
      z: transform.z + direction.z * distance
    };
    const resolved = mapSystem?.resolveMovement?.(unit, from, proposed, dt) || proposed;

    movement.velocityX = dt > 0 ? (resolved.x - transform.x) / dt : 0;
    movement.velocityY = dt > 0 ? (resolved.y - transform.y) / dt : 0;
    movement.velocityZ = dt > 0 ? (resolved.z - transform.z) / dt : 0;
    transform.x = finite(resolved.x, transform.x);
    transform.y = finite(resolved.y, transform.y);
    transform.z = finite(resolved.z, transform.z);
    if (direction.length) transform.yaw = Math.atan2(direction.x, direction.z);

    unit.mobility.terrainSample = terrain;
    unit.metadata.lastMovement = {
      dt,
      speed,
      terrainMultiplier,
      mobilityMultiplier,
      from,
      to: { x: transform.x, y: transform.y, z: transform.z }
    };
    return unit.metadata.lastMovement;
  }
}
