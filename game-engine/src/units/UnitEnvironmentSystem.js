import { ensureUnitRuntimeState } from "./UnitState.js";

export class UnitEnvironmentSystem {
  update(unit, dt, context = {}) {
    const state = ensureUnitRuntimeState(unit);
    const mapSystem = context.mapSystem || null;
    const point = unit.transform;
    const terrain = mapSystem?.sampleTerrain?.(point) || unit.mobility.terrainSample || null;
    const water = mapSystem?.sampleWater?.(point) || null;
    const mapId = mapSystem?.activeMapId?.() ?? null;

    unit.mobility.terrainSample = terrain;
    unit.mobility.waterSample = water;
    state.environment.surface = terrain;
    state.environment.water = water;
    state.environment.slope = terrain?.slope ?? terrain?.slopeBand ?? null;
    state.environment.groundHeight = Number.isFinite(Number(terrain?.height)) ? Number(terrain.height) : null;
    state.environment.wetness = Number.isFinite(Number(water?.wetness)) ? Number(water.wetness) : (water ? 1 : 0);
    state.environment.current = water?.current ?? null;
    state.environment.mapId = mapId;

    unit.metadata.environment = {
      dt,
      terrain,
      water,
      mapId
    };
    return unit.metadata.environment;
  }
}
