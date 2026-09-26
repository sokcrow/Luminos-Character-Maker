export class UnitEnvironmentSystem {
  update(unit, dt, context = {}) {
    const mapSystem = context.mapSystem || null;
    const point = unit.transform;
    const terrain = mapSystem?.sampleTerrain?.(point) || unit.mobility.terrainSample || null;
    const water = mapSystem?.sampleWater?.(point) || null;

    unit.mobility.terrainSample = terrain;
    unit.mobility.waterSample = water;
    unit.metadata.environment = {
      dt,
      terrain,
      water,
      mapId: mapSystem?.activeMapId?.() ?? null
    };
    return unit.metadata.environment;
  }
}
