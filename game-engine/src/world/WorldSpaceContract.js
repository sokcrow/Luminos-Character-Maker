const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

export const WORLD_SPACE_CONTRACT = deepFreeze({
  id: "luminous-continuous-world-v1",
  scale: {
    feetPerTile: 5,
    worldUnitsPerTile: 1.5
  },
  grid: {
    playerVisible: false,
    combatEndpointSnapping: false,
    roles: [
      "biome-sampling",
      "ecology-distribution",
      "navigation-cache",
      "terrain-semantics",
      "encounter-analysis"
    ]
  },
  exploration: {
    mode: "continuous-free",
    budgeted: false,
    obeysCollision: true,
    obeysTerrainSpeed: true
  },
  combat: {
    mode: "continuous-budgeted-path",
    budgeted: true,
    endpointSnapping: false,
    measurement: "traveled-path-from-turn-origin",
    difficultTerrainMoveMultiplier: 0.5
  },
  placement: {
    coordinates: "continuous-xz",
    footprint: "radius",
    tileCentersRequired: false
  }
});

export const feetPerWorldUnit = (contract = WORLD_SPACE_CONTRACT) =>
  Number(contract.scale.feetPerTile) / Number(contract.scale.worldUnitsPerTile);

export function worldUnitsToFeet(worldUnits, contract = WORLD_SPACE_CONTRACT) {
  return Number(worldUnits) * feetPerWorldUnit(contract);
}

export function feetToWorldUnits(feet, contract = WORLD_SPACE_CONTRACT) {
  return Number(feet) / feetPerWorldUnit(contract);
}
