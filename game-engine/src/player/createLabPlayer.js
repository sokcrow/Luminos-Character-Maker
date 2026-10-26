export function createLabPlayer(overrides = {}) {
  const id = String(overrides.id || "lab-player-1");
  return {
    id,
    unitId: id,
    name: overrides.name || "Lab Player",
    type: "player",
    inventario_activo: {},
    inventario_stash: {},
    equipment: {},
    resources: {
      hp: { current: 10, max: 10 },
      sp: { current: 10, max: 10 }
    },
    wallet: { AHN: 250000 },
    flags: {},
    ...overrides
  };
}
